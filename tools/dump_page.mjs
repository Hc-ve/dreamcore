import { chromium } from 'playwright';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const b = await chromium.launch({ executablePath: EDGE, headless: false });
const p = await b.newPage();
p.on('console', m => console.log('[c]', m.type(), m.text().substring(0, 200)));
p.on('pageerror', e => console.log('[e]', e.message));

await p.goto('http://localhost:5173/#/craft', { waitUntil: 'networkidle' });
await p.waitForTimeout(4000);

const info = await p.evaluate(() => {
  const r = { hash: location.hash, modals: [], workspace: null, craftElems: [] };
  document.querySelectorAll('[class*="modal-overlay"]').forEach(el => {
    const cr = el.getBoundingClientRect();
    r.modals.push({
      cls: el.className.substring(0, 120),
      id: el.id,
      visible: cr.width > 0 && cr.height > 0,
      textPreview: el.innerText?.substring(0, 80)
    });
  });
  const ws = document.querySelector('#craft-workspace, #ai-craft-workspace, .craft-workspace, [class*="craft-panel"], [class*="craft-workspace"]');
  if (ws) {
    const cr = ws.getBoundingClientRect();
    r.workspace = { cls: ws.className.substring(0, 120), id: ws.id, visible: cr.width > 0 };
  }
  r.craftElems = [...document.querySelectorAll('[data-product-key], .craft-card, .product-item, .category-chip, [data-craft-type]')]
    .slice(0, 20).map(el => ({
      key: el.dataset.productKey || el.dataset.craftType || '',
      cls: el.className.substring(0, 60),
      text: el.innerText?.trim().substring(0, 30)
    }));
  // 找所有可见按钮文本
  r.visibleButtons = [...document.querySelectorAll('button')].filter(el => {
    const cr = el.getBoundingClientRect();
    return cr.width > 0 && cr.height > 0;
  }).slice(0, 30).map(el => el.innerText.trim().substring(0, 30));
  // artwork-picker 内部
  const ap = document.querySelector('#artwork-picker-modal');
  if (ap) {
    r.artworkPicker = {
      htmlSnippet: ap.innerHTML.substring(0, 1500),
      tabs: [...ap.querySelectorAll('[role="tab"], .tab, button')].slice(0, 10).map(el => ({text: el.innerText.trim().substring(0, 30), cls: el.className.substring(0, 60)})),
      items: [...ap.querySelectorAll('.artwork-item, .work-item, .picker-item, [class*="art"], [class*="work"]')].slice(0, 10).map(el => ({cls: el.className.substring(0, 60), text: el.innerText.trim().substring(0, 40)}))
    };
  }
  // welcome modal 内部
  const wm = document.querySelector('.welcome-modal');
  if (wm) {
    r.welcomeModal = {
      closeBtn: wm.querySelector('.modal-close') ? 'exists' : 'missing',
      htmlSnippet: wm.innerHTML.substring(0, 500)
    };
  }
  return r;
});

console.log('\n=== PAGE DUMP ===');
console.log(JSON.stringify(info, null, 2));

await p.screenshot({ path: 'test-screenshots/debug.png', fullPage: true });
console.log('\nScreenshot saved to test-screenshots/debug.png');

await b.close();
