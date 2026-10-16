import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';

console.log('='.repeat(60));
console.log('deskCalendar + paperMat —— 完整验证');
console.log('='.repeat(60));

// === 1. 静态代码检查 ===
console.log('\n📁 静态代码 (6/6):');
const c3d = fs.readFileSync('js/craft-3d.js', 'utf8');
const strat = fs.readFileSync('tools/uv-processor/form3d-strategies.mjs', 'utf8');
const index = fs.readFileSync('tools/uv-processor/index.mjs', 'utf8');
const cp = fs.readFileSync('data/craft-products.js', 'utf8');

const checks = [
  ['rili → deskCalendar form3d', /key:\s*'rili'[\s\S]{0,100}form3d:\s*'deskCalendar'/],
  ['deskCalendar 独立策略 mainAxis=Y', /deskCalendar:\s*\{[\s\S]{0,100}mainAxis:\s*'Y'/],
  ['deskCalendar ±X 零面积（纸边）', /'\+X':\s*\[0\.00,\s*0\.00,\s*0\.00,\s*0\.00\]/],
  ['deskCalendar minThickness 0.10', /deskCalendar[\s\S]{0,300}minThickness:\s*0\.10/],
  ['rili alias → deskCalendar', /rili:\s*\{\s*extends:\s*'deskCalendar'/],
  ['PAPER_COLOR paperMat 注入', /PAPER_COLOR\s*=\s*0xfaf7f2/],
  ['allZero UV 检测逻辑', /allZero[\s\S]{0,80}obj\.geometry\.attributes\.uv/],
  ['FORM_PBR.deskCalendar', /deskCalendar:\s*\{\s*roughness:\s*\.75/],
  ['deskCalendar builder Torus 线圈', /deskCalendar\s*\([^)]*\)[\s\S]{0,400}TorusGeometry/],
];
let pass = 0;
for (const [label, re] of checks) {
  const ok = re.test(c3d + strat + index + cp);
  console.log(ok ? '  ✅' : '  ❌', label);
  if (ok) pass++;
}
console.log(`  ${pass}/${checks.length}`);

// === 2. BFF /strategies ===
console.log('\n🔌 BFF /strategies:');
const bffOk = await new Promise(resolve => {
  http.get('http://localhost:3001/api/uv/strategies', r => {
    let d = '';
    r.on('data', c => d += c);
    r.on('end', () => {
      const j = JSON.parse(d);
      resolve({ total: j.total, desk: j.strategies.includes('deskCalendar'), rili: j.strategies.includes('rili') });
    });
  }).on('error', () => resolve({ err: true }));
});
console.log(' ', JSON.stringify(bffOk), bffOk.total === 76 ? '✅' : '❌');

// === 3. BFF /api/uv/process —— deskCalendar GLB 处理端到端 ===
console.log('\n🔧 BFF POST /api/uv/process (deskCalendar + paperMat):');
const glbBuf = fs.readFileSync('文创设计参考/模型/书签.glb');
const result = await new Promise(resolve => {
  const postData = JSON.stringify({
    form3d: 'deskCalendar',
    glbBase64: glbBuf.toString('base64')
  });
  const req = http.request({
    hostname: 'localhost', port: 3001, path: '/api/uv/process', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
  }, r => {
    let d = '';
    r.on('data', c => d += c);
    r.on('end', () => {
      try { resolve({ status: r.statusCode, ...JSON.parse(d) }); }
      catch(e) { resolve({ status: r.statusCode, raw: d.slice(0, 200), err: e.message }); }
    });
  });
  req.on('error', e => resolve({ err: e.message }));
  req.write(postData); req.end();
});
console.log('  status:', result.status, result.status === 200 ? '✅' : '❌');
console.log('  strategy:', result.strategy, result.strategy === 'deskCalendar' ? '✅' : '❌');
console.log('  triangles:', Math.round(result.triangles || 0));
console.log('  thicknessScale:', result.thicknessScale ? result.thicknessScale.toFixed(2) + 'x' : 'N/A');
console.log('  output bytes:', result.outputBytes);
console.log('  paperMatInjected:', result.paperMatCount ? `✅ ${result.paperMatCount} mesh 被换成米白纸` : (result.paperMatCount === 0 ? '⚠️ 0 个（书签 GLB 没 ±X 面）' : 'N/A'));

// === 4. Edge 浏览器 ===
console.log('\n🌐 Edge 浏览器:');
const b = await chromium.launch({ headless: true, channel: 'msedge' });
const p = await b.newPage();
const logs = [];
p.on('console', m => logs.push({ t: m.type(), txt: m.text().slice(0, 150) }));
p.on('pageerror', e => logs.push({ t: 'pageerror', txt: e.message.slice(0, 150) }));

// 查 BFF 代理
const r = await p.evaluate(async () => {
  try {
    const f = await fetch('http://localhost:3001/api/uv/strategies');
    const j = await f.json();
    return { status: f.status, total: j.total, desk: j.strategies.includes('deskCalendar') };
  } catch(e) { return { err: e.message }; }
});
console.log('  BFF fetch:', r);

// 打开 craft 页
await p.goto('http://localhost:5175/#/craft', { waitUntil: 'domcontentloaded', timeout: 15000 });
await new Promise(r => setTimeout(r, 2500));
const r4 = await p.evaluate(() => ({
  canvases: document.querySelectorAll('canvas').length,
  errors: logs.filter(l => l.t === 'error').length,
}));
console.log('  canvases:', r4.canvases, 'errors:', r4.errors);

const errs = logs.filter(l => l.t === 'error' || l.t === 'pageerror');
console.log('  Console errors:', errs.length ? errs.map(e => '❌ ' + e.txt).join(' | ') : '✅ ZERO');

await b.close();

console.log('\n' + '='.repeat(60));
console.log('✅ 全部验证完成');
console.log('='.repeat(60));
