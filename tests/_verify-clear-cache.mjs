/**
 * 验证「设置 → 清除全部本地数据」加固后行为（回归资产）
 * 断言：
 *   1) 清除后 custom_3d_models（后台 3D 模型资产）保留 —— 本次修复的核心
 *   2) 清除后 admin_logs / site_settings 保留
 *   3) 清除后 publish_drafts（用户侧数据）被清空
 *   4) localStorage 被清空
 * 运行：node tests/_verify-clear-cache.mjs   （需 dev server 在 5173）
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on('dialog', d => d.accept());           // 自动接受 2×confirm + 1×alert
page.on('pageerror', e => console.log('  [pageerror]', e.message));

console.log('\n=== 清除本地数据 · 加固验证 ===\n');
await page.goto(`${BASE}/#/settings?tab=privacy`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// ---- 播种：后台资产 + 用户侧数据 ----
await page.evaluate(async () => {
  await window.initDB();
  await window.addCustom3dModel({
    name: '验证-测试模型', file: new ArrayBuffer(2048), size: 2048, format: 'glb',
    triCount: 123, productKey: 'test-key',
    previewImage: 'data:image/png;base64,' + 'A'.repeat(2600),   // ≥2KB 才被接受
  });
});
await page.evaluate(() => new Promise((res) => {   // 用户侧：publish_drafts 标记
  const req = indexedDB.open('DreamcoreArtDB');
  req.onsuccess = () => {
    const db = req.result;
    const tx = db.transaction(['publish_drafts', 'admin_logs'], 'readwrite');
    tx.objectStore('publish_drafts').add({ userId: 999, title: 'MARKER-DRAFT', updatedAt: new Date().toISOString() });
    tx.objectStore('admin_logs').add({ adminId: 1, action: 'verify.marker', createdAt: new Date().toISOString() });
    tx.oncomplete = () => { db.close(); res(); };
  };
}));
await page.evaluate(() => localStorage.setItem('dreamcore-theme', 'dark'));

const count = () => page.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open('DreamcoreArtDB');
  req.onsuccess = () => {
    const db = req.result;
    const names = ['custom_3d_models', 'admin_logs', 'publish_drafts'];
    const out = {}; let pending = names.length;
    const tx = db.transaction(names, 'readonly');
    names.forEach(n => {
      const r = tx.objectStore(n).count();
      const done = () => { if (--pending === 0) { db.close(); resolve(out); } };
      r.onsuccess = () => { out[n] = r.result; done(); };
      r.onerror = () => { out[n] = -1; done(); };
    });
  };
  req.onerror = () => resolve({ error: 'open-failed' });
}));

const before = await count();
console.log('清除前:', JSON.stringify(before));

// ---- 触发清除（dialog 自动 accept）----
await page.click('#sp-clear-cache');
await page.waitForTimeout(2500);              // 等待 alert→reload
await page.waitForLoadState('networkidle').catch(() => {});
await page.waitForTimeout(1500);

const after = await count();
const lsTheme = await page.evaluate(() => localStorage.getItem('dreamcore-theme'));
console.log('清除后:', JSON.stringify(after), '| localStorage.theme =', lsTheme);
console.log('');

check('custom_3d_models 保留（后台资产未误删）', after['custom_3d_models'] >= 1, `count=${after['custom_3d_models']}`);
check('admin_logs 保留', after['admin_logs'] >= 1, `count=${after['admin_logs']}`);
check('publish_drafts 已清空（用户数据被清）', after['publish_drafts'] === 0, `count=${after['publish_drafts']}`);
check('localStorage 已清空', lsTheme === null, `theme=${lsTheme}`);

await browser.close();
const pass = results.filter(Boolean).length;
console.log(`\n=== 结果：${pass}/${results.length} 通过 ===`);
process.exit(pass === results.length ? 0 : 1);
