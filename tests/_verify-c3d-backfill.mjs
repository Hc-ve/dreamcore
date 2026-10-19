/**
 * 验证「后台 → 3D模型管理 → 立即补齐缩略图」修复（回归资产）
 *
 * 修复的三个问题：
 *   1) 点击按钮无反应 —— 旧实现被 _refreshList 里的自动补齐占用标志位后「静默 return」
 *   2) 自动补齐会随 _refreshList 反复触发（成功→刷新→再自动补齐的回路）
 *   3) 补齐只走 GLTFLoader，FBX 模型必然失败
 *
 * 断言：
 *   A) 点击后立刻有可见反馈（进度文案出现），不再「无反应」
 *   B) 3 个有效 GLB 全部补齐成功，卡片出现缩略图
 *   C) FBX 记录确实走 FBX 分支（日志 format=fbx），且失败被计数上报
 *   D) 最终提示同时给出成功/失败数
 *
 * 运行：node tests/_verify-c3d-backfill.mjs   （需 dev server 在 5173）
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const results = [];
const check = (name, pass, detail = '') => {
  results.push(pass);
  console.log(`${pass ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const GLB_COUNT = 3;

/**
 * Node 侧手工构造一个最小合法 GLB（单个四边形网格）。
 * 不用 three 的 GLTFExporter：它在 Node 下依赖浏览器 FileReader。
 * 页面内也无法裸 import('three')（裸说明符仅由 Vite 在应用模块内重写）。
 */
function buildMinimalGlb() {
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.53, 0.67, 0.4, 1], metallicFactor: 0, roughnessFactor: 1 } }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 4, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] },
      { bufferView: 1, componentType: 5123, count: 6, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 48, target: 34962 },
      { buffer: 0, byteOffset: 48, byteLength: 12, target: 34963 },
    ],
    buffers: [{ byteLength: 60 }],
  };
  const pos = new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);   // 48B
  const idx = new Uint16Array([0, 1, 2, 0, 2, 3]);                       // 12B
  const bin = new Uint8Array(60);
  bin.set(new Uint8Array(pos.buffer), 0);
  bin.set(new Uint8Array(idx.buffer), 48);

  const enc = new TextEncoder();
  const jsonBytes = enc.encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  const jsonChunk = new Uint8Array(jsonBytes.length + jsonPad).fill(0x20); // 空格补齐
  jsonChunk.set(jsonBytes, 0);
  const binPad = (4 - (bin.length % 4)) % 4;
  const binChunk = new Uint8Array(bin.length + binPad);
  binChunk.set(bin, 0);

  const total = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546c67, true);   // 'glTF'
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonChunk.length, true);
  dv.setUint32(16, 0x4e4f534a, true);  // 'JSON'
  out.set(jsonChunk, 20);
  let off = 20 + jsonChunk.length;
  dv.setUint32(off, binChunk.length, true);
  dv.setUint32(off + 4, 0x004e4942, true); // 'BIN\0'
  out.set(binChunk, off + 8);
  return out.buffer;
}

const GLB_B64 = Buffer.from(new Uint8Array(buildMinimalGlb())).toString('base64');

const browser = await chromium.launch({ channel: 'msedge', headless: !process.env.HEADED });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
const logs = [];
page.on('pageerror', e => console.log('  [pageerror]', e.message));
page.on('console', m => { if (m.text().includes('Admin C3D')) logs.push(m.text()); });
page.on('dialog', d => d.accept());

console.log('\n=== 立即补齐缩略图 · 修复验证 ===\n');
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.evaluate(() => window.initDB());

// ---- 播种：3 个可解析 GLB（无缩略图）+ 1 个 FBX（无缩略图，用于验证分支）----
await page.evaluate(async ({ glbB64, glbCount }) => {
  const bin = atob(glbB64);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  const ab = u.buffer;
  for (let i = 0; i < glbCount; i++) {
    await window.addCustom3dModel({
      name: `补齐验证-GLB-${i}`, file: ab.slice(0), size: ab.byteLength, format: 'glb',
      triCount: 12, productKey: 'mug', uploadedBy: 'e2e', previewImage: '',
    });
  }
  // FBX：随机字节（非法 FBX）—— 只为验证走了 FBX 分支并失败上报
  const badFbx = new ArrayBuffer(512);
  new Uint8Array(badFbx).fill(7);
  await window.addCustom3dModel({
    name: '补齐验证-FBX', file: badFbx, size: 512, format: 'fbx',
    triCount: 0, productKey: 'kite', uploadedBy: 'e2e', previewImage: '',
  });
}, { glbB64: GLB_B64, glbCount: GLB_COUNT });

const seeded = (await page.evaluate(() => window.getAllCustom3dModels())).length;
check('播种成功（4 条均无缩略图）', seeded === GLB_COUNT + 1, `count=${seeded}`);

// ---- 打开后台 3D模型管理 ----
await page.evaluate(() => { window.currentUser = { id: 1, username: 'e2e-admin', isAdmin: true, role: 'superadmin' }; });
await page.evaluate(() => window.showAdminPanel());
await page.waitForSelector('.admin-tab[data-tab="custom3d"]', { timeout: 8000 });
await page.click('.admin-tab[data-tab="custom3d"]');
await page.waitForSelector('#c3d-backfill-btn', { timeout: 8000 });

const statusText = await page.locator('#c3d-status-text').textContent();
check('状态条显示缺失数', /缺失\s*4/.test(statusText), statusText.trim());
const btnVisible = await page.locator('#c3d-backfill-btn').isVisible();
check('「立即补齐缩略图」按钮可见', btnVisible);

// ---- 点击按钮，立刻检查可见反馈（本次修复的核心）----
await page.click('#c3d-backfill-btn');
await page.waitForTimeout(250);
const immediate = await page.evaluate(() => {
  const p = document.querySelector('#c3d-progress');
  const b = document.querySelector('#c3d-backfill-btn');
  return { visible: !!p && getComputedStyle(p).display !== 'none', text: p?.textContent || '', disabled: b?.disabled };
});
check('点击后立刻有可见反馈（不再无反应）', immediate.visible && immediate.text.length > 0,
  `visible=${immediate.visible} text="${immediate.text}" disabled=${immediate.disabled}`);

// ---- 等补齐结束（按钮恢复可点 + 文案含「补齐完成」）----
// 注意：waitForFunction 的第二个参数是 arg，options 必须放第三个参数
let timedOut = false;
await page.waitForFunction(() => {
  const b = document.querySelector('#c3d-backfill-btn');
  const p = document.querySelector('#c3d-progress');
  return b && !b.disabled && p && p.textContent.includes('补齐完成');
}, null, { timeout: 90000 }).catch(() => { timedOut = true; });
const finalText = await page.locator('#c3d-progress').textContent().catch(() => '');
if (timedOut) {
  console.log('  [诊断] 90s 未完成，最后进度文案：', finalText.trim());
  console.log('  [诊断] 最后 15 条 Admin C3D 日志：');
  logs.slice(-15).forEach(l => console.log('    ·', l));
}
check('补齐流程能在合理时间内结束', !timedOut, timedOut ? '超时未结束' : finalText.trim());
check('结果提示同时给出成功/失败数', new RegExp(`成功\\s*${GLB_COUNT}`).test(finalText) && /失败\s*1/.test(finalText), finalText.trim());

// ---- 断言缩略图已落库 + 卡片显示 ----
const withThumb = await page.evaluate(async () => {
  const all = await window.getAllCustom3dModels();
  return all.filter(r => r.previewImage && r.previewImage.startsWith('data:image/')).length;
});
check(`${GLB_COUNT} 个 GLB 补齐成功（库中已有缩略图）`, withThumb === GLB_COUNT, `withThumb=${withThumb}`);
const imgCount = await page.locator('#admin-c3d-grid .admin-c3d-card-thumb img').count();
check('卡片列表中已渲染缩略图', imgCount === GLB_COUNT, `img=${imgCount}`);

// ---- 断言 FBX 分支确实被执行 ----
const fbxLog = logs.find(l => l.includes('format=fbx'));
check('FBX 记录走 FBX 分支（日志含 format=fbx）', !!fbxLog, fbxLog || '未捕获到 FBX 分支日志');

await browser.close();
const pass = results.filter(Boolean).length;
console.log(`\n=== 结果：${pass}/${results.length} 通过 ===`);
process.exit(pass === results.length ? 0 : 1);
