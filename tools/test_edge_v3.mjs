import { chromium } from 'playwright';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = 'e:/a/6a578b50553ee2fa56364236/test-screenshots';
const b = await chromium.launch({ executablePath: EDGE, headless: false });
const p = await b.newPage();
const allLogs = [];
p.on('console', m => {
  const t = m.text().substring(0, 400);
  allLogs.push({ type: m.type(), text: t });
  if (t.includes('Craft3D') || t.includes('shuqian') || t.includes('FORM_PBR') || t.includes('✅') || t.includes('❌') || t.includes('renderCustom')) {
    console.log(`[${m.type()}] ${t}`);
  }
});
p.on('pageerror', e => console.log('[PAGEERR]', e.message));

console.log('=== Step 1: Goto #/craft ===');
await p.goto('http://localhost:5173/#/craft', { waitUntil: 'networkidle' });
await p.waitForTimeout(4000);

console.log('=== Step 2: Kill welcome modal with JS ===');
await p.evaluate(() => {
  // 关掉 welcome modal（可能挡住了其他元素）
  const w = document.querySelector('.welcome-modal');
  if (w) { w.classList.remove('open'); w.style.display = 'none'; w.remove(); }
  // 杀掉 artwork-picker-modal，看看能不能强制进工作台
  const ap = document.querySelector('#artwork-picker-modal');
  if (ap) { ap.classList.remove('open'); ap.style.display = 'none'; ap.remove(); }
});
await p.waitForTimeout(500);

// 现在看有没有 workspace 元素
const wsAfterKill = await p.evaluate(() => {
  const r = {};
  const ws = document.querySelector('#craft-workspace, .craft-workspace, [class*="craft-panel"], #ai-craft-panel');
  r.hasWorkspace = !!ws;
  if (ws) {
    const cr = ws.getBoundingClientRect();
    r.ws = { cls: ws.className.substring(0, 150), visible: cr.width > 0 };
  }
  // 找所有 modal
  r.modals = [...document.querySelectorAll('[class*="modal"]')].filter(el => {
    const cr = el.getBoundingClientRect();
    return cr.width > 0;
  }).map(el => ({ cls: el.className.substring(0, 100), visible: true }));
  // 品类元素
  r.cats = [...document.querySelectorAll('[data-product-key], .craft-chip, .category-chip, [class*="product"]')].slice(0, 20).map(el => ({
    k: el.dataset.productKey || '', text: el.innerText?.trim().substring(0, 30), cls: el.className.substring(0, 60)
  }));
  return r;
});
console.log('After kill modals:', JSON.stringify(wsAfterKill, null, 2));

// 如果还没 workspace，看看 window.AICraft 对象
const acInfo = await p.evaluate(() => {
  const r = { hasAICraft: typeof window.AICraft !== 'undefined', keys: [] };
  if (r.hasAICraft) r.keys = Object.keys(window.AICraft);
  return r;
});
console.log('window.AICraft:', JSON.stringify(acInfo));

await p.screenshot({ path: OUT + '/03-after-kill-modals.png', fullPage: true });

// 也许可以直接 Craft3D.renderCustom 来测试 PBR？让我用 Craft3D 的程序化 render 测
console.log('\n=== Step 3: Try to trigger craft category via JS ===');
const triggerResult = await p.evaluate(async () => {
  // 看看 CRAFT_PRODUCTS 有没有导出
  const r = {};
  try {
    r.hasCraftProducts = typeof CRAFT_PRODUCTS !== 'undefined';
    r.CRAFT_PRODUCTS_count = r.hasCraftProducts ? CRAFT_PRODUCTS.length : 'N/A';
  } catch(e) { r.err1 = e.message; }
  
  // 看看 Craft3D 对象
  try {
    r.hasCraft3D = typeof Craft3D !== 'undefined';
    r.Craft3D_keys = r.hasCraft3D ? Object.keys(Craft3D).slice(0, 20) : 'N/A';
  } catch(e) { r.err2 = e.message; }
  
  // 看看 AICraft
  try {
    r.AICraft_type = typeof AICraft;
    if (typeof AICraft !== 'undefined') r.AICraft_keys = Object.keys(AICraft);
  } catch(e) { r.err3 = e.message; }
  
  // 看看 getProductByName
  try {
    r.hasGetProductByName = typeof getProductByName === 'function';
    if (r.hasGetProductByName) r.shuqianProduct = getProductByName('书签');
  } catch(e) { r.err4 = e.message; }
  
  return r;
});
console.log('JS probes:', JSON.stringify(triggerResult, null, 2));

// 截图并结束
await p.screenshot({ path: OUT + '/04-final-state.png', fullPage: true });

console.log('\n=== ALL CONSOLE LOGS (filtered) ===');
allLogs.filter(l => l.type !== 'debug' && !l.text.includes('[vite]')).forEach(l => console.log(`[${l.type}] ${l.text.substring(0, 200)}`));

await b.close();
