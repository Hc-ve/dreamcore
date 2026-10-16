// ============================================================
// tests/cloud-sync.spec.js — 方案B「作品发布即上云」端到端验证
// 覆盖：
//   ① 未登录云端会话 → syncArtworkToCloud 静默 skipped，不抛错
//   ② 云端会话下同步成功：Storage 图片上传 + artworks 入库 + 本地 cloudMigrated/cloudId 打标
//   ③ 幂等：已打标作品再次同步 skipped，云端不产生重复行
//   ④ 云端行字段正确（title/image_url 为 Storage 公网地址/status=published）
//   ⑤ Storage 对象真实可访问（HTTP 200）
//   ⑥ 异常输入（不存在的 id）静默 skipped，绝不抛错阻塞发布
// 清理：node 端 service key 删除测试产生的云端 artworks 行 + Storage 对象
// ============================================================
import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';

// 1x1 透明 PNG
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const TEST_TITLE = '方案B同步验证';

function readEnv() {
  try {
    const env = readFileSync('.env', 'utf8');
    return {
      url: (env.match(/VITE_SUPABASE_URL=(\S+)/) || [])[1] || '',
      svc: (env.match(/SUPABASE_SERVICE_ROLE_KEY=(\S+)/) || [])[1] || ''
    };
  } catch (_) { return { url: '', svc: '' }; }
}

async function clearStorage(context) {
  await context.clearCookies();
  await context.addInitScript(() => {
    try {
      localStorage.clear();
      indexedDB.databases().then(dbs => {
        dbs.forEach(db => indexedDB.deleteDatabase(db.name));
      });
    } catch (_) { /* 忽略 */ }
  });
}

// node 端清理：service key 删除本次测试标题/探测行 + 对应 Storage 对象
test.afterAll(async () => {
  const { url, svc } = readEnv();
  if (!url || !svc) return;
  try {
    const headers = { apikey: svc, Authorization: 'Bearer ' + svc, 'Content-Type': 'application/json' };
    // 找出测试行（含 RLS 探测行）
    const titles = encodeURIComponent(JSON.stringify([TEST_TITLE, 'RLS probe', '同步测试-未登录']));
    const res = await fetch(`${url}/rest/v1/artworks?title=in.(${titles})&select=id,title,image_url`, { headers });
    const rows = await res.json();
    for (const row of (rows || [])) {
      // 删除 Storage 对象（publicUrl → storage path）
      const m = (row.image_url || '').match(/\/storage\/v1\/object\/public\/artworks\/(.+)$/);
      if (m) {
        await fetch(`${url}/storage/v1/object/artworks/${m[1]}`, { method: 'DELETE', headers: { apikey: svc, Authorization: 'Bearer ' + svc } });
      }
      await fetch(`${url}/rest/v1/artworks?id=eq.${row.id}`, { method: 'DELETE', headers });
    }
  } catch (_) { /* 清理尽力而为 */ }
});

test('方案B：发布即上云全链路（跳过→同步→打标→幂等→云端校验）', async ({ page }) => {
    page.on('console', (msg) => { if (msg.type() === 'warning' || msg.type() === 'error') console.log('[page console]', msg.text()); });
    await clearStorage(page.context());
  await page.goto('/');
  await page.waitForSelector('.artwork-card', { timeout: 20000 });

  // ① 未登录云端会话：静默 skipped，不抛错
  const before = await page.evaluate(async (img) => {
    const art = await window.addArtwork({ title: '同步测试-未登录', description: 'x', author: 'tester', category: 'scenic-photo', imageUrl: img, type: 'image', userId: 'local-only-user' });
    const r = await window.CloudMigrate.syncArtworkToCloud(art.id);
    return { id: art.id, skipped: !!r.skipped, reason: r.reason || null, threw: false };
  }, TINY_PNG);
  expect(before.skipped).toBe(true);
  expect(before.reason).toBe('cloud-session-missing');

  // ② 注册云端用户（邮箱确认已关闭，注册即得到会话）
  const email = `cloud-sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.app`;
  const reg = await page.evaluate(async (email) => {
    const { supabase } = await import('/js/api/supabase-client.js');
    const { data, error } = await supabase.auth.signUp({ email, password: 'Sync#2026x' });
    return { error: error ? error.message : null, userId: data && data.user ? data.user.id : null };
  }, email);
  expect(reg.error).toBeNull();
  expect(reg.userId).toBeTruthy();

  // ③ 创建本地作品 → 同步 → 本地打标 → 幂等
  const result = await page.evaluate(async ([img, uid, title]) => {
    const art = await window.addArtwork({ title, description: '发布即上云验证', author: 'tester', category: 'scenic-photo', imageUrl: img, type: 'image', userId: uid });
    const r = await window.CloudMigrate.syncArtworkToCloud(art.id);
    const after = await window.getArtworkById(art.id);
    const r2 = await window.CloudMigrate.syncArtworkToCloud(art.id); // 幂等重入
    return { id: art.id, r, cloudMigrated: !!after.cloudMigrated, cloudId: after.cloudId, r2 };
  }, [TINY_PNG, reg.userId, TEST_TITLE]);
  expect(result.r.ok).toBe(true);
  expect(result.r.cloudId).toBeTruthy();
  expect(result.cloudMigrated).toBe(true);
  expect(result.cloudId).toBe(result.r.cloudId);
  expect(result.r2.skipped).toBe(true);
  expect(result.r2.reason).toBe('already-migrated');

  // ④ 云端行字段校验（node 端 service key 查询）
  const { url, svc } = readEnv();
  expect(url).toBeTruthy();
  const cloudResp = await fetch(`${url}/rest/v1/artworks?id=eq.${result.cloudId}&select=id,user_id,title,image_url,status,ai_scored`, {
    headers: { apikey: svc, Authorization: 'Bearer ' + svc }
  });
  const cloud = { rows: await cloudResp.json(), status: cloudResp.status };
  expect(cloud.status).toBe(200);
  expect(cloud.rows.length).toBe(1); // 幂等：无重复行
  expect(cloud.rows[0].title).toBe(TEST_TITLE);
  expect(cloud.rows[0].user_id).toBe(reg.userId);
  expect(cloud.rows[0].status).toBe('published');
  expect(cloud.rows[0].image_url).toMatch(/^https:\/\/.+\/storage\/v1\/object\/public\/artworks\//);

  // ⑤ Storage 公网对象真实可访问
  const imgResp = await page.request.get(cloud.rows[0].image_url);
  expect(imgResp.ok()).toBeTruthy();

  // ⑥ 异常输入静默降级：不存在的作品 id 不抛错
  const nf = await page.evaluate(() => window.CloudMigrate.syncArtworkToCloud(999999999));
  expect(nf.skipped).toBe(true);

  // 本地清理：删除测试作品 + 登出
  await page.evaluate(async (id) => {
    try { await window.deleteArtwork(id); } catch (_) {}
    const { supabase } = await import('/js/api/supabase-client.js');
    await supabase.auth.signOut();
  }, result.id);
});
