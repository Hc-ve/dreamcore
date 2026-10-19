// ============================================================
// js/api/migrate-to-cloud.js — IndexedDB → Supabase 同步
// 用法：登录后控制台执行 CloudMigrate.run()（批量迁移，含进度回调）
//       发布作品时由 publish.js 自动调用 CloudMigrate.syncArtworkToCloud(id)
//       （方案B：作品发布即上云的最小双写同步）
// 通道：统一经服务端云函数 /api/sync-artwork（service key 上传 Storage 与入库）
//       —— Storage RLS 不放行客户端直传，故客户端不再直接写云端
// 同步成功的本地作品打 cloudMigrated 标记（幂等可重跑）
// ============================================================
import { supabase, supabaseEnabled } from './supabase-client.js';
// 本地四态 → 云端三态映射（draft/published/offline），与 db.js 单一事实来源对齐
import { CLOUD_STATUS_MAP } from '../db.js';

// ------------------------------------------------------------
// 收集本地评分/评论并调用服务端同步通道
// @returns {Promise<{cloudId:string, image_url:string, scores:number, comments:number}>} 失败 throw
// ------------------------------------------------------------
async function _syncViaServer(a, accessToken) {
  // 评分记录（单条解析失败跳过，不阻断）
  const scores = [];
  try {
    const ss = await window.getAestheticScoresByArtwork(a.id);
    for (const s of (ss || [])) {
      try {
        scores.push({
          scores: typeof s.scores === 'string' ? JSON.parse(s.scores) : (s.scores || {}),
          total_score: Number(s.totalScore) || 0,
          grade: String(s.grade || ''),
          ai_description: s.aiDescription || '',
          teaching_comments: typeof s.teachingComments === 'string' ? (() => { try { return JSON.parse(s.teachingComments); } catch (_) { return {}; } })() : (s.teachingComments || {}),
          model: s.model || 'local-fallback',
          degraded: !!s.degraded
        });
      } catch (_) { /* 忽略坏记录 */ }
    }
  } catch (_) { /* 评分读取失败不阻断 */ }

  // 评论记录
  const comments = [];
  try {
    const cs = await window.getComments(a.id);
    for (const c of (cs || [])) comments.push({ content: String(c.content || c.text || '') });
  } catch (_) { /* 评论读取失败不阻断 */ }

  let imageUrl = a.imageUrl || (Array.isArray(a.images) && a.images[0]) || '';
  if (imageUrl && !/^(data:|https?:)/.test(imageUrl)) {
    throw new Error('图片地址为相对路径，无法上云: ' + imageUrl.slice(0, 60));
  }

  const res = await fetch('/api/sync-artwork', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: accessToken,
      artwork: {
        title: a.title || '未命名作品',
        description: a.description || '',
        image_url: imageUrl,
        tags: Array.isArray(a.tags) ? a.tags : [],
        category: a.category || 'other',
        ai_scored: !!a.aiScored,
        like_count: Number(a.likes) || 0,
        view_count: Number(a.views) || 0
      },
      scores,
      comments
    })
  });
  let out = null;
  try { out = await res.json(); } catch (_) { /* 非 JSON 响应 */ }
  if (!res.ok || !out || !out.ok) {
    const msg = out && out.error ? out.error : ('HTTP ' + res.status);
    throw new Error('云端同步失败: ' + msg);
  }
  return out;
}

// ------------------------------------------------------------
// 取当前云端会话的 access_token（未登录 → null）
// ------------------------------------------------------------
async function _getAccessToken() {
  if (!supabaseEnabled || !supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: sessionData } = await supabase.auth.getSession();
  return (sessionData && sessionData.session && sessionData.session.access_token) || null;
}

// ------------------------------------------------------------
// 状态变更回写云端（经 /api/update-artwork-status 服务端通道）
// @returns {Promise<{ok?:boolean, skipped?:boolean, failed?:boolean, reason?:string, error?:string}>}
// ------------------------------------------------------------
async function _writeStatusToCloud(payload) {
  const accessToken = await _getAccessToken();
  if (!accessToken) return { skipped: true, reason: 'cloud-session-missing' };
  const res = await fetch('/api/update-artwork-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: accessToken, ...payload })
  });
  let out = null;
  try { out = await res.json(); } catch (_) { /* 非 JSON 响应 */ }
  if (!res.ok || !out || !out.ok) {
    const msg = out && out.error ? out.error : ('HTTP ' + res.status);
    throw new Error(msg);
  }
  return { ok: true, cloudId: out.cloudId, status: out.status, op: out.op };
}

const CloudMigrate = {
  /**
   * 批量迁移 IndexedDB 未上云作品
   * @param {(msg:string, done:number, total:number)=>void} [onProgress]
   * @returns {Promise<{migrated:number, skipped:number, scores:number, comments:number, failed:string[]}>}
   */
  // 运行锁：防止并发触发导致重复迁移（同一作品被多轮同时读取 pending）
  _running: false,

  async run(onProgress) {
    if (!supabaseEnabled || !supabase) throw new Error('Supabase 未配置（检查 .env 的 VITE_SUPABASE_*）');
    if (this._running) throw new Error('迁移正在进行中，请勿重复触发');
    this._running = true;
    const report = (msg, done, total) => { try { onProgress && onProgress(msg, done, total); } catch (_) {} };
    try {
      report('检查登录状态…', 0, 0);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('请先登录云端账号后再执行迁移');

      const artworks = await window.getAllArtworks();
      const pending = artworks.filter(a => a && !a.cloudMigrated);
      report(`待迁移作品 ${pending.length} 件（已迁移 ${artworks.length - pending.length} 件）`, 0, pending.length);

      const res = { migrated: 0, skipped: 0, scores: 0, comments: 0, failed: [] };

      for (let i = 0; i < pending.length; i++) {
        const a = pending[i];
        try {
          const r = await this.syncArtworkToCloud(a.id);
          if (r.failed) throw new Error(r.error || '未知失败');
          if (r.skipped) throw new Error('被跳过: ' + (r.reason || ''));
          res.scores += r.scores || 0;
          res.comments += r.comments || 0;
          res.migrated++;
          report(`已迁移「${a.title || '未命名'}」`, res.migrated, pending.length);
        } catch (e) {
          res.failed.push((a.title || '未命名') + ': ' + (e.message || e));
          res.skipped++;
          report(`迁移失败「${a.title || '未命名'}」: ${e.message}`, res.migrated + res.skipped, pending.length);
        }
      }
      report(`迁移完成：成功 ${res.migrated} 件，失败 ${res.skipped} 件，评分 ${res.scores} 条，评论 ${res.comments} 条`, res.migrated, pending.length);
      return res;
    } finally {
      this._running = false; // 无论成功失败都释放运行锁
    }
  },

  /**
   * 方案B：单条作品发布即上云（publish.js 在用户确认发布后调用）
   * fire-and-forget：任何失败都静默降级（console.warn），绝不阻塞发布主流程；
   * 同步成功才打 cloudMigrated 标记，失败的作品保持未标记，可被 run() 补迁移。
   * 未登录云端 / Supabase 未配置 → 静默跳过（本地发布不受影响）。
   * @param {number|string} artworkId 本地作品 id
   * @returns {Promise<{ok?:boolean, cloudId?:string, scores?:number, comments?:number, skipped?:boolean, failed?:boolean, reason?:string, error?:string}>}
   */
  async syncArtworkToCloud(artworkId) {
    try {
      if (artworkId == null) return { skipped: true, reason: 'no-artwork-id' };
      if (!supabaseEnabled || !supabase) return { skipped: true, reason: 'supabase-disabled' };
      const a = await window.getArtworkById(artworkId);
      if (!a) return { skipped: true, reason: 'artwork-not-found' };
      if (a.cloudMigrated) return { skipped: true, reason: 'already-migrated', cloudId: a.cloudId };

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { skipped: true, reason: 'cloud-session-missing' };
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData && sessionData.session && sessionData.session.access_token;
      if (!accessToken) return { skipped: true, reason: 'cloud-session-missing' };

      const out = await _syncViaServer(a, accessToken);
      // 本地打标（幂等）；打标失败不视为同步失败（下次 run() 会按 cloudMigrated 补跑）
      try { await window.updateArtwork(a.id, { cloudMigrated: true, cloudId: out.cloudId }); } catch (_) {}
      console.log('[CloudMigrate] 作品已同步云端:', a.title || '未命名', '→', out.cloudId);
      return { ok: true, cloudId: out.cloudId, image_url: out.image_url, scores: out.scores || 0, comments: out.comments || 0 };
    } catch (e) {
      // 静默降级：演示环境断网/云端异常时发布体验不受影响
      console.warn('[CloudMigrate] 云端同步失败（不影响本地发布）:', e && e.message || e);
      return { failed: true, error: e && e.message || String(e) };
    }
  },

  /**
   * 后台改状态 → 回写云端 artworks.status（best-effort）
   * fire-and-forget：失败仅 console.warn，绝不阻塞后台操作主流程；
   * 未上云（无 cloudId）/未登录云端 → 静默跳过。
   * @param {number|string} artworkId 本地作品 id
   * @param {'pending'|'published'|'rejected'|'deleted'} status 本地状态
   */
  async updateArtworkStatusToCloud(artworkId, status) {
    try {
      if (artworkId == null) return { skipped: true, reason: 'no-artwork-id' };
      const a = await window.getArtworkById(artworkId);
      if (!a) return { skipped: true, reason: 'artwork-not-found' };
      if (!a.cloudId) return { skipped: true, reason: 'not-migrated' };
      const cloudStatus = CLOUD_STATUS_MAP[status];
      if (!cloudStatus) return { skipped: true, reason: 'unknown-status' };
      const r = await _writeStatusToCloud({ cloudId: a.cloudId, op: 'status', status: cloudStatus });
      if (r.ok) console.log('[CloudMigrate] 状态已回写云端:', a.title || '未命名', '→', cloudStatus);
      return r;
    } catch (e) {
      console.warn('[CloudMigrate] 云端状态回写失败（不影响本地后台操作）:', e && e.message || e);
      return { failed: true, error: e && e.message || String(e) };
    }
  },

  /**
   * 物理删除 → 同步删除云端 artworks 行（best-effort）
   * 注意：必须在本地删除前捕获 cloudId（本地删除后无法再查到）。
   * @param {string} cloudId 云端作品 id（本地作品的 cloudId）
   */
  async deleteArtworkFromCloud(cloudId) {
    try {
      if (!cloudId) return { skipped: true, reason: 'no-cloud-id' };
      const r = await _writeStatusToCloud({ cloudId, op: 'delete' });
      if (r.ok) console.log('[CloudMigrate] 云端作品已删除:', cloudId);
      return r;
    } catch (e) {
      console.warn('[CloudMigrate] 云端删除失败（不影响本地后台操作）:', e && e.message || e);
      return { failed: true, error: e && e.message || String(e) };
    }
  }
};

window.CloudMigrate = CloudMigrate;
export default CloudMigrate;
export { CloudMigrate };
