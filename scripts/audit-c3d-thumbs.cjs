// scripts/audit-c3d-thumbs.cjs — 用 Edge profile 副本直读 IndexedDB，审计所有 3D 模型缩略图状态
const { chromium } = require('playwright');
const path = require('path');
const os = require('os');

const profileDir = path.join(os.tmpdir(), 'dreamcore-idb-audit');

(async () => {
  const ctx = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport: { width: 1280, height: 800 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  // 打开应用（DB 已在副本里，version 12 不触发升级；等应用完成 init）
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const report = await page.evaluate(async () => {
    return await new Promise((resolve, reject) => {
      const req = indexedDB.open('DreamcoreArtDB');
      req.onerror = () => reject(new Error('open error: ' + req.error));
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('custom_3d_models')) {
          db.close();
          return resolve({ error: 'custom_3d_models store 不存在' });
        }
        const tx = db.transaction('custom_3d_models', 'readonly');
        const getAll = tx.objectStore('custom_3d_models').getAll();
        getAll.onsuccess = () => {
          const rows = getAll.result
            .sort((a, b) => (a.id > b.id ? 1 : -1))
            .map(r => ({
              id: r.id,
              name: r.name,
              productKey: r.productKey,
              format: r.format,
              sizeMB: r.size ? +(r.size / 1024 / 1024).toFixed(2) : 0,
              triCount: r.triCount,
              hasFile: r.file instanceof ArrayBuffer,
              fileMB: r.file ? +(r.file.byteLength / 1024 / 1024).toFixed(2) : 0,
              hasThumb: !!r.previewImage,
              thumbKB: r.previewImage ? Math.round(r.previewImage.length / 1024) : 0,
              createdAt: r.createdAt
            }));
          db.close();
          resolve({ count: rows.length, rows });
        };
        getAll.onerror = () => reject(getAll.error);
      };
    });
  });

  console.log(JSON.stringify(report, null, 2));
  await ctx.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
