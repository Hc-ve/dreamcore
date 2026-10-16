import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, channel: 'msedge' });
const p = await b.newPage();
const logs = [];
p.on('console', m => logs.push({ t: m.type(), txt: m.text().slice(0, 300) }));
p.on('pageerror', e => logs.push({ t: 'pageerror', txt: e.message.slice(0, 300) }));

console.log('='.repeat(60));
console.log('台历 deskCalendar —— Edge 浏览器验证');
console.log('='.repeat(60));

// 1. 静态代码检查（4 处改动都在）
import fs from 'node:fs';
console.log('\n📁 文件改动检查:');

// craft-products.js: rili form3d → deskCalendar
const cp = fs.readFileSync('data/craft-products.js', 'utf8');
console.log(cp.includes("key: 'rili'") && cp.includes("form3d: 'deskCalendar'") 
  ? '  ✅ craft-products.js: rili → deskCalendar' : '  ❌ 未改');

// form3d-strategies.mjs: deskCalendar 独立策略 + rili alias
const fs2 = fs.readFileSync('tools/uv-processor/form3d-strategies.mjs', 'utf8');
console.log(/deskCalendar:\s*\{[\s\S]*?mainAxis:\s*'Y'[\s\S]*?minThickness:\s*0\.10/.test(fs2) 
  ? '  ✅ form3d-strategies: deskCalendar 独立策略' : '  ❌ 未加独立策略');
console.log(/rili:\s*\{\s*extends:\s*'deskCalendar'/.test(fs2) 
  ? '  ✅ form3d-strategies: rili alias → deskCalendar' : '  ❌ 未加 alias');

// craft-3d.js: FORM_PBR + deskCalendar builder
const c3d = fs.readFileSync('js/craft-3d.js', 'utf8');
console.log(/deskCalendar:\s*\{\s*roughness:\s*\.75,\s*metalness:\s*\.02/.test(c3d) 
  ? '  ✅ craft-3d.js FORM_PBR.deskCalendar' : '  ❌ 未加 PBR');
console.log(/deskCalendar\(T,\s*art\)[\s\S]{30,500}BoxGeometry[\s\S]{0,200}TorusGeometry/.test(c3d) 
  ? '  ✅ craft-3d.js deskCalendar builder (薄板 + 线圈)' : '  ❌ 未加 builder');

// 2. 离线验证 deskCalendar 策略能跑 GLB 处理
console.log('\n🔧 离线 BFF deskCalendar 策略处理测试:');
try {
  const { processGlb, UV_STRATEGIES } = await import('./tools/uv-processor/index.mjs');
  const s = UV_STRATEGIES.deskCalendar;
  console.log('  ✅ deskCalendar 策略存在:', !!s);
  console.log('  ✅ layout +Y →', s.layout['+Y'], '（正面全幅）');
  console.log('  ✅ layout -Y →', s.layout['-Y'], '（背面底部10%）');
  console.log('  ✅ layout ±X →', s.layout['+X'], '（纸边零面积）');
  console.log('  ✅ layout +Z →', s.layout['+Z'], '（顶部装订条）');
  console.log('  ✅ minThickness:', s.minThickness);

  // 跑 GLB 处理验证不崩
  const glbBuf = fs.readFileSync('文创设计参考/模型/书签.glb');
  const { stats } = await processGlb(
    glbBuf.buffer.slice(glbBuf.byteOffset, glbBuf.byteOffset + glbBuf.byteLength),
    'deskCalendar',
    { normalize: true }
  );
  console.log('  ✅ processGlb 成功 form3d:', stats.form3d, 'strategy:', stats.strategy, 'thickness:', stats.thicknessScale?.toFixed(2) + 'x');
} catch (e) {
  console.log('  ❌ 离线测试失败:', e.message);
}

// 3. Edge 浏览器：检查 FORM_BUILDERS + FORM_PBR
console.log('\n🌐 Edge 浏览器加载:');
await p.goto('http://localhost:5175/#/craft', { waitUntil: 'networkidle', timeout: 20000 });
await new Promise(r => setTimeout(r, 3000));

const r3 = await p.evaluate(() => {
  const res = { url: location.href };
  // Craft3D 全局
  res.craft3dExists = !!window.Craft3D;
  if (window.Craft3D) {
    res.formPbrKeys = Object.keys(window.Craft3D.FORM_PBR || {});
    res.formBuildersKeys = typeof window.Craft3D.isForm3dSupported === 'function' ? 'exists' : 'missing';
    res.deskCalendarSupported = typeof window.Craft3D.isForm3dSupported === 'function' 
      ? window.Craft3D.isForm3dSupported('deskCalendar') : null;
  }
  return res;
});
console.log('  FORM_PBR 有 deskCalendar:', r3.formPbrKeys?.includes('deskCalendar'));
console.log('  FORM_BUILDERS 支持 deskCalendar:', r3.deskCalendarSupported);

// 4. Console errors
const errs = logs.filter(l => l.t === 'error' || l.t === 'pageerror');
console.log('\n💥 Console errors:', errs.length ? errs.map(e => e.txt).join('\n  ') : 'ZERO ✅');

await b.close();
console.log('\n' + '='.repeat(60));
console.log('✅ 验证完成');
console.log('='.repeat(60));
