// ============================================================
// netlify/functions/sync-artwork.mjs — 方案B：作品发布即上云（服务端通道）
// POST /api/sync-artwork
//   body: { access_token, artwork: {...}, scores: [], comments: [] }
// 流程：校验 access_token（GoTrue /auth/v1/user）→ data:URL 图片上传
//       Storage（service key，绕开 Storage RLS 对客户端直传的限制）→
//       artworks 入库 → aesthetic_scores / comments 附带同步
// 安全：service_role 密钥仅在本服务端函数内使用，永不下发前端；
//       user_id 一律取自校验通过的 access_token，不信任客户端传值
// ============================================================

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type'
    },
    body: JSON.stringify(obj)
  };
}

// 旧等级体系 → 新六等级映射（与 js/api/migrate-to-cloud.js 保持一致）
function mapGrade(grade, totalScore) {
  const g = String(grade || '').toLowerCase();
  if (['sss', 'ss', 's', 'a', 'b', 'c'].includes(g)) return g;
  const t = Number(totalScore) || 0;
  if (t >= 9.5) return 'sss';
  if (t >= 9.0) return 'ss';
  if (t >= 8.5) return 's';
  if (t >= 7.5) return 'a';
  if (t >= 6.5) return 'b';
  return 'c';
}

// 用 access_token 换取用户身份（原生 /auth/v1/user 返回顶层用户对象）
async function verifyUser(sbUrl, srKey, token) {
  const res = await fetch(sbUrl + '/auth/v1/user', {
    headers: { apikey: srKey, Authorization: 'Bearer ' + token }
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user && user.id ? user : null;
}

// data:URL → Storage 公网 URL（service key 上传，路径隔离到 user.id/ 下）
async function uploadImage(sbUrl, srKey, userId, dataUrl) {
  const m = String(dataUrl || '').match(/^data:([\w/+.-]+);base64,(.+)$/);
  if (!m) throw new Error('图片 data:URL 格式无效');
  const mime = m[1];
  const b64 = m[2];
  const ext = (mime.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '') || 'png';
  const path = userId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
  const buf = Buffer.from(b64, 'base64');
  const res = await fetch(sbUrl + '/storage/v1/object/artworks/' + path, {
    method: 'POST',
    headers: {
      apikey: srKey,
      Authorization: 'Bearer ' + srKey,
      'Content-Type': mime,
      'x-upsert': 'true'
    },
    body: buf
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error('图片上传失败 (' + res.status + ')：' + t.slice(0, 120));
  }
  return sbUrl + '/storage/v1/object/public/artworks/' + path;
}

export async function handler(event) {
  const sbUrl = process.env.VITE_SUPABASE_URL || '';
  const srKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!sbUrl || !srKey) {
    return json(503, { error: '云端同步通道未开通：请在 .env / Netlify 环境变量配置 SUPABASE_SERVICE_ROLE_KEY' });
  }
  try {
    if (event.httpMethod === 'OPTIONS') return { statusCode: 204, body: '' };
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

    const body = JSON.parse(event.body || '{}');
    const accessToken = String(body.access_token || '');
    const aw = body.artwork || {};
    if (!accessToken) return json(401, { error: '缺少云端登录凭证' });

    const user = await verifyUser(sbUrl, srKey, accessToken);
    if (!user) return json(401, { error: '云端登录已过期，请重新登录' });

    // 图片：data:URL 上传 Storage；http(s) URL 直接复用；其余拒绝
    let imageUrl = String(aw.image_url || '');
    if (imageUrl.startsWith('data:')) {
      imageUrl = await uploadImage(sbUrl, srKey, user.id, imageUrl);
    } else if (!/^https?:/.test(imageUrl)) {
      return json(400, { error: '图片地址无效（仅支持 data: / http(s): URL）' });
    }

    // 作品入库（user_id 取自服务端校验结果，不信任客户端传值）
    const ins = await fetch(sbUrl + '/rest/v1/artworks', {
      method: 'POST',
      headers: { apikey: srKey, Authorization: 'Bearer ' + srKey, 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({
        user_id: user.id,
        title: String(aw.title || '未命名作品').slice(0, 60),
        description: String(aw.description || '').slice(0, 300),
        image_url: imageUrl,
        tags: Array.isArray(aw.tags) ? aw.tags : [],
        category: String(aw.category || 'other'),
        status: 'published',
        ai_scored: !!aw.ai_scored,
        like_count: Number(aw.like_count) || 0,
        view_count: Number(aw.view_count) || 0
      })
    });
    if (!ins.ok) {
      const t = await ins.text();
      return json(502, { error: '作品入库失败 (' + ins.status + ')：' + t.slice(0, 120) });
    }
    const row = (await ins.json())[0];
    const cloudId = row.id;

    // 评分/评论附带同步：单条失败不阻断（计数返回，由调用方决定重试策略）
    let scoresOk = 0, commentsOk = 0;
    for (const s of (Array.isArray(body.scores) ? body.scores : [])) {
      try {
        const r = await fetch(sbUrl + '/rest/v1/aesthetic_scores', {
          method: 'POST',
          headers: { apikey: srKey, Authorization: 'Bearer ' + srKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artwork_id: cloudId,
            user_id: user.id,
            scores: (s && s.scores) || {},
            total_score: Number(s && s.total_score) || 0,
            grade: mapGrade(s && s.grade, s && s.total_score),
            ai_description: String((s && s.ai_description) || '').slice(0, 2000),
            teaching_comments: (s && s.teaching_comments) || {},
            model: String((s && s.model) || 'local-fallback'),
            degraded: !!(s && s.degraded)
          })
        });
        if (r.ok) scoresOk++;
      } catch (_) { /* 单条失败忽略 */ }
    }
    for (const c of (Array.isArray(body.comments) ? body.comments : [])) {
      try {
        const r = await fetch(sbUrl + '/rest/v1/comments', {
          method: 'POST',
          headers: { apikey: srKey, Authorization: 'Bearer ' + srKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artwork_id: cloudId,
            user_id: user.id,
            content: String((c && c.content) || '').slice(0, 1000)
          })
        });
        if (r.ok) commentsOk++;
      } catch (_) { /* 单条失败忽略 */ }
    }

    return json(200, { ok: true, cloudId, image_url: imageUrl, scores: scoresOk, comments: commentsOk });
  } catch (e) {
    return json(500, { error: (e && e.message) || String(e) });
  }
}
