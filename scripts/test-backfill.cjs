// scripts/test-backfill.cjs — 在 Edge profile 副本上实测缩略图补齐（不碰真实数据）
const { chromium } = require('playwright');
const path = require('path');
const os = require('os');

const profileDir = path.join(os.tmpdir(), 'dreamcore-idb-audit');

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ctx = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport: { width: 1440, height: 1000 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  // 页面脚本执行前注入管理员登录态
  await page.addInitScript(() => {
    localStorage.setItem('currentUser', JSON.stringify({
      id: 1, username: 'admin', isAdmin: true, role: 'superadmin', email: 'admin@local'
    }));
  });

  const c3dLogs = [];
  page.on('console', m => {
    const t = m.text();
    if (t.includes('[Admin C3D]') || t.includes('[craft-3d]')) c3dLogs.push(`[${m.type()}] ${t}`);
  });
  page.on('pageerror', e => c3dLogs.push('[pageerror] ' + e.message));

  await page.goto('http://localhost:5173/#/admin', { waitUntil: 'networkidle', timeout: 20000 });
  await sleep(2500);

  // 点 3D 模型管理
  const tab = page.locator('text=3D模型管理').first();
  await tab.waitFor({ state: 'visible', timeout: 10000 });
  await tab.click();
  console.log('已进入 3D 模型管理，等待补齐循环…');

  // 轮询 DB：直到全部有缩略图或超时 5 分钟
  const readStatus = () => page.evaluate(() => new Promise((resolve, reject) => {
    const req = indexedDB.open('DreamcoreArtDB');
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction('custom_3d_models', 'readonly');
      const r = tx.objectStore('custom_3d_models').getAll();
      r.onsuccess = () => resolve(r.result
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
        .map(x => ({ id: x.id, name: (x.name || '').trim(), hasThumb: !!x.previewImage })));
      r.onerror = () => reject(r.error);
    };
    req.onerror = () => reject(req.error);
  }));

  const deadline = Date.now() + 300000;
  let status = [];
  while (Date.now() < deadline) {
    await sleep(8000);
    status = await readStatus();
    const done = status.filter(s => s.hasThumb).length;
    console.log(`进度 ${done}/${status.length}：` + status.map(s => (s.hasThumb ? '✓' : '·') + s.name).join(' '));
    if (status.length > 0 && done === status.length) break;
  }

  console.log('\n=== 补齐相关日志 ===');
  c3dLogs.forEach(l => console.log(l));

  console.log('\n=== 最终状态 ===');
  status.forEach(s => console.log(`${s.hasThumb ? '✓ 有图' : '✗ 缺图'}  id=${s.id}  ${s.name}`));

  await page.screenshot({ path: 'qa-output/backfill-result.png', fullPage: true });
  await ctx.close();

  const missing = status.filter(s => !s.hasThumb);
  process.exit(missing.length === 0 ? 0 : 2);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
