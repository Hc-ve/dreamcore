import { chromium } from 'playwright';
const b = await chromium.launch({ headless: true, channel: 'msedge' });
const p = await b.newPage();
const logs = [];
p.on('console', m => logs.push({ t: m.type(), txt: m.text().slice(0, 200) }));
p.on('pageerror', e => logs.push({ t: 'pageerror', txt: e.message.slice(0, 200) }));

console.log('=== Test: Full notebook flow ===');

// Step 1: BFF strategies (direct, not through Vite proxy)
const r1 = await p.evaluate(async () => {
  const f = await fetch('http://localhost:3001/api/uv/strategies');
  const j = await f.json();
  return { status: f.status, notebook: j.strategies.includes('notebook'), total: j.total };
});
console.log('BFF strategies:', JSON.stringify(r1));

// Step 2: Open craft page with artworkId (known to work from earlier bookmark test)
await p.goto('http://localhost:5173/#/craft?artworkId=1', { waitUntil: 'networkidle', timeout: 20000 });
await new Promise(r => setTimeout(r, 3000));

const r2 = await p.evaluate(() => ({
  url: location.href,
  canvases: document.querySelectorAll('canvas').length,
  craft3dActive: !!window.Craft3D?.isActive?.(),
  viewExists: !!document.getElementById('craft-3d-view'),
  viewHidden: document.getElementById('craft-3d-view')?.hidden,
  hasPbrNotebook: !!window.Craft3D?.FORM_PBR?.notebook,
  pbrNotebook: window.Craft3D?.FORM_PBR?.notebook,
}));
console.log('After open:', JSON.stringify(r2, null, 2));

// Step 3: Look for product buttons, try to click 手账本
const r3 = await p.evaluate(async () => {
  const all = Array.from(document.querySelectorAll('button, [role="button"], .product-btn, [data-product-key], .cat-item'));
  const found = [];
  for (const el of all) {
    const t = el.textContent?.trim() || '';
    const k = el.getAttribute('data-product-key') || '';
    if (t.length < 40 && t.length > 0) found.push({ tag: el.tagName, k, t: t.slice(0, 30) });
  }
  const target = found.find(x => x.k === 'shouzhang' || x.k === 'bijiben' || x.t.includes('手账') || x.t.includes('笔记本'));
  let clicked = null;
  if (target) {
    all.find(el => (el.getAttribute('data-product-key') || '') === target.k || (el.textContent?.trim() || '').slice(0, 30) === target.t)?.click();
    clicked = target;
  }
  return { foundTotal: found.length, clicked };
});
console.log('Click product:', JSON.stringify(r3, null, 2));
await new Promise(r => setTimeout(r, 3500));

// Step 4: Force show 3D if view exists
const r4 = await p.evaluate(() => {
  const view = document.getElementById('craft-3d-view');
  if (view) view.hidden = false;
  if (window.Craft3D?.render) {
    try { Craft3D.render(); } catch (e) { /* ignore */ }
  }
  if (window.Craft3D?.renderCustom) {
    try { Craft3D.renderCustom(); } catch (e) { /* ignore */ }
  }
  return { viewExists: !!view };
});
console.log('Force 3D:', JSON.stringify(r4));
await new Promise(r => setTimeout(r, 2500));

// Step 5: Final state check
const r5 = await p.evaluate(() => {
  return {
    canvases: document.querySelectorAll('canvas').length,
    craft3dActive: !!window.Craft3D?.isActive?.(),
    viewHidden: document.getElementById('craft-3d-view')?.hidden,
    viewChildren: document.getElementById('craft-3d-view')?.children?.length,
  };
});
console.log('Final state:', JSON.stringify(r5, null, 2));

// Step 6: Errors + relevant logs
const errs = logs.filter(l => l.t === 'error' || l.t === 'pageerror');
console.log('\n=== Console errors ===');
console.log(errs.length ? errs.map(e => e.txt) : 'ZERO ✅');

const relevant = logs.filter(l => /BFF|UV|notebook|shouzhang|renderCustom|form3d|预处理|策略/i.test(l.txt));
console.log('\n=== Relevant logs ===');
console.log(relevant.length ? relevant.map(l => `[${l.t}] ${l.txt}`).join('\n') : '(none — notebook可能走程序化render不走renderCustom)');

await b.close();
console.log('\nDone ✅');
