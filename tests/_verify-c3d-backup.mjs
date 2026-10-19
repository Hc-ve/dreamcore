/**
 * 验证「3D 模型管理 → 导出全部 / 导入恢复」跨设备备份链路（回归资产）
 *
 * 真实浏览器操作路径（非直接调函数）：
 *   播种 3 条模型 → 后台 3D模型管理 Tab → 点「导出全部」抓下载 zip
 *   → 校验 zip 结构 → 清空本地库（模拟换设备）→ 点「导入恢复」选 zip
 *   → 断言依赖/字节/绑定关系全部还原 → 二次导入断言去重跳过
 *
 * 断言：
 *   1) 导出 zip 含 manifest.json，kind=dreamcore-c3d-backup，count 与播种数一致
 *   2) zip 含每条的二进制条目 models/<i>.<ext>
 *   3) 导入后记录数还原、name/productKey/format 一致
 *   4) 导入后模型文件字节长度一致（二进制未被损坏/膨胀）
 *   5) 二次导入全部跳过（去重生效，无重复副本）
 *
 * 运行：node tests/_verify-c3d-backup.mjs   （需 dev server 在 5173）
 */
import { chromium } from 'playwright';
import { unzipSync, strFromU8 } from 'fflate';
import fs from 'fs';
import path from 'path';

const BASE = 'http://localhost:5173';
const TMP = path.resolve('tests/_tmp-c3d-backup.zip');
const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
};

// 播种数据（确定性字节，便于导入后比对）
const SEED = [
  { name: '验证-青花瓷杯', len: 4096, format: 'glb', triCount: 1200, productKey: 'mug' },
  { name: '验证-三星堆面具', len: 8192, format: 'glb', triCount: 3400, productKey: 'mask' },
  { name: '验证-风筝模型', len: 2048, format: 'fbx', triCount: 0,   productKey: 'kite' },
];

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('  [pageerror]', e.message));
page.on('dialog', d => d.accept());

const openAdminC3d = async () => {
  await page.evaluate(() => { window.currentUser = { id: 1, username: 'e2e-admin', isAdmin: true, role: 'superadmin' }; });
  await page.evaluate(() => window.showAdminPanel());
  await page.waitForSelector('.admin-tab[data-tab="custom3d"]', { timeout: 8000 });
  await page.click('.admin-tab[data-tab="custom3d"]');
  await page.waitForSelector('#c3d-export', { timeout: 8000 });
};

console.log('\n=== 3D 模型导出/导入备份 · 验证 ===\n');
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.evaluate(() => window.initDB());

// ---- 播种 3 条模型 ----
await page.evaluate((seed) => {
  const mk = (buf, fill) => { const u = new Uint8Array(buf); for (let i = 0; i < u.length; i++) u[i] = (i + fill) % 251; return buf; };
  return (async () => {
    for (const s of seed) {
      const ab = mk(new ArrayBuffer(s.len), s.len % 7);
      await window.addCustom3dModel({
        name: s.name, file: ab, size: s.len, format: s.format,
        triCount: s.triCount, productKey: s.productKey, uploadedBy: 'e2e',
        previewImage: 'data:image/png;base64,' + 'A'.repeat(2600),
      });
    }
  })();
}, SEED);
const seededCount = (await page.evaluate(() => window.getAllCustom3dModels())).length;
check('播种成功（前置条件）', seededCount === SEED.length, `count=${seededCount}`);

// ---- 打开后台 3D模型管理 ----
await openAdminC3d();
await page.waitForSelector('#admin-c3d-grid .admin-c3d-card', { timeout: 8000 });
const btnCount = await page.locator('#c3d-export, #c3d-import-btn').count();
check('列表头出现「导出全部 / 导入恢复」按钮', btnCount === 2, `buttons=${btnCount}`);

// ---- 点「导出全部」并捕获下载 ----
const [download] = await Promise.all([
  page.waitForEvent('download', { timeout: 15000 }),
  page.click('#c3d-export'),
]);
await download.saveAs(TMP);
const zipBytes = fs.readFileSync(TMP);
check('下载得到 zip 文件', zipBytes.length > 0, `size=${(zipBytes.length / 1024).toFixed(1)}KB`);
check('导出文件名符合约定', /^dreamcore-c3d-backup-\d{8}-\d{4}\.zip$/.test(download.suggestedFilename()), download.suggestedFilename());

// ---- 校验 zip 结构 ----
let entries = null, manifest = null;
try {
  entries = unzipSync(new Uint8Array(zipBytes));
  manifest = JSON.parse(strFromU8(entries['manifest.json']));
} catch (e) { console.log('  zip 解析异常：', e.message); }
check('zip 内含 manifest.json 且可解析', !!manifest);
check('manifest.kind 正确', manifest?.kind === 'dreamcore-c3d-backup', manifest?.kind);
check('manifest.count 与播种数一致', manifest?.count === SEED.length, `count=${manifest?.count}`);
const binEntries = Object.keys(entries || {}).filter(k => k.startsWith('models/'));
check('zip 含每条的二进制条目', binEntries.length === SEED.length, `entries=${binEntries.join(', ')}`);

// ---- 清空本地库（模拟换设备/数据丢失）----
await page.evaluate(() => new Promise((res) => {
  const req = indexedDB.open('DreamcoreArtDB');
  req.onsuccess = () => {
    const db = req.result;
    const tx = db.transaction('custom_3d_models', 'readwrite');
    tx.objectStore('custom_3d_models').clear();
    tx.oncomplete = () => { db.close(); res(); };
  };
}));
const afterClear = (await page.evaluate(() => window.getAllCustom3dModels())).length;
check('清库后模型数为 0（数据已丢失）', afterClear === 0, `count=${afterClear}`);

// ---- 重开后台（空态）→ 点「导入恢复」选 zip ----
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.evaluate(() => window.initDB());
await openAdminC3d();
// 触发隐藏 input 的上传
await page.setInputFiles('#c3d-import', TMP);
await page.waitForFunction(() => {
  const m = document.querySelector('#c3d-io-msg');
  return m && m.textContent.includes('导入完成');
}, { timeout: 15000 });
const ioText = await page.locator('#c3d-io-msg').textContent();
console.log('  导入提示：', ioText.trim());

// ---- 断言导入结果（ArrayBuffer 无法跨 evaluate 序列化，故在浏览器内归约成纯量）----
const restored = await page.evaluate(() => {
  return (async () => {
    const all = await window.getAllCustom3dModels();
    return all.map(r => ({
      name: r.name, format: r.format, productKey: r.productKey,
      size: r.size,
      fileLen: r.file instanceof ArrayBuffer ? r.file.byteLength : -1,
      createdAt: r.createdAt,
      hasPreview: !!r.previewImage,
    }));
  })();
});
check('导入后记录数还原', restored.length === SEED.length, `count=${restored.length}`);

const byName = Object.fromEntries(restored.map(r => [r.name, r]));
const namesOk = SEED.every(s => byName[s.name]);
check('导入后名称全部匹配', namesOk, restored.map(r => r.name).join(' / '));
const metaOk = SEED.every(s => byName[s.name] && byName[s.name].format === s.format && byName[s.name].productKey === s.productKey);
check('导入后 format / 绑定关系一致', metaOk);
const sizeOk = SEED.every(s => byName[s.name] && byName[s.name].fileLen === s.len);
const sizeDetail = SEED.map(s => `${s.name}=${byName[s.name]?.fileLen ?? 'NOFILE'}(期望${s.len})`).join(' / ');
check('导入后模型二进制字节长度一致', sizeOk, sizeDetail);

// 字节内容抽样比对（首/中/尾）
const bytesMatch = await page.evaluate((seed) => {
  return (async () => {
    const all = await window.getAllCustom3dModels();
    const map = Object.fromEntries(all.map(r => [r.name, r]));
    for (const s of seed) {
      const r = map[s.name];
      if (!r || !r.file) return `缺文件: ${s.name}`;
      const u = new Uint8Array(r.file);
      if (u.length !== s.len) return `长度不符: ${s.name}`;
      // 抽查首/中/尾三处字节
      for (const idx of [0, (s.len >> 1), s.len - 1]) {
        const expect = (idx + (s.len % 7)) % 251;
        if (u[idx] !== expect) return `字节不符: ${s.name}@${idx} got=${u[idx]} expect=${expect}`;
      }
    }
    return 'ok';
  })();
}, SEED);
check('导入后模型字节内容完好', bytesMatch === 'ok', bytesMatch);

// ---- 二次导入：应全部跳过（去重）----
await page.setInputFiles('#c3d-import', TMP);
await page.waitForFunction(() => {
  const m = document.querySelector('#c3d-io-msg');
  return m && m.textContent.includes('导入完成');
}, { timeout: 15000 });
const ioText2 = await page.locator('#c3d-io-msg').textContent();
const afterSecond = (await page.evaluate(() => window.getAllCustom3dModels())).length;
check('二次导入全部跳过（无重复副本）', afterSecond === SEED.length && /跳过重复/.test(ioText2), `count=${afterSecond} · ${ioText2.trim()}`);

await browser.close();
try { fs.unlinkSync(TMP); } catch (_) {}

const pass = results.filter(Boolean).length;
console.log(`\n=== 结果：${pass}/${results.length} 通过 ===`);
process.exit(pass === results.length ? 0 : 1);
