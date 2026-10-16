import { chromium } from 'playwright';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = 'e:/a/6a578b50553ee2fa56364236/test-screenshots';
const b = await chromium.launch({ executablePath: EDGE, headless: false });
const p = await b.newPage();
const logs = [];
p.on('console', m => {
  const t = m.text().substring(0, 500);
  logs.push({ type: m.type(), text: t });
  console.log(`[${m.type()}] ${t.substring(0, 200)}`);
});
p.on('pageerror', e => console.log('[PAGEERR]', e.message));

console.log('\n=== Goto #/craft?artworkId=1 ===');
await p.goto('http://localhost:5173/#/craft?artworkId=1', { waitUntil: 'networkidle' });
await p.waitForTimeout(5000);

// kill welcome
await p.evaluate(() => document.querySelectorAll('.welcome-modal').forEach(m => m.remove()));
await p.waitForTimeout(1000);

console.log('\n=== Click bookmark ===');
const bookmarkBtn = p.locator('.craft-product-card').filter({ hasText: '书签' }).first();
const cnt = await bookmarkBtn.count();
console.log('Bookmark buttons found:', cnt);
if (cnt > 0) {
  await bookmarkBtn.click();
  console.log('Clicked!');
} else {
  // 先找"文具类" category tab，可能书签在里面
  console.log('Looking for category tabs...');
  const catTabs = p.locator('.craft-category-tab, [class*="category"], .category-chip');
  const ccnt = await catTabs.count();
  console.log('Category tabs:', ccnt);
}

console.log('\n=== Waiting 10s for 3D ===');
await p.waitForTimeout(10000);

await p.screenshot({ path: OUT + '/05-after-3d-wait.png', fullPage: true });

// 检查 canvas + Craft3D 状态
const state = await p.evaluate(() => {
  const canvases = [...document.querySelectorAll('canvas')];
  return {
    canvasCount: canvases.length,
    canvasInfo: canvases.map((c, i) => ({
      idx: i, id: c.id || '',
      parentId: c.parentElement?.id || '',
      parentCls: c.parentElement?.className?.substring(0, 80) || '',
      visible: c.getBoundingClientRect().width > 0,
      width: c.width, height: c.height
    })),
    craft3dActive: typeof Craft3D !== 'undefined' && Craft3D.isActive ? Craft3D.isActive() : 'unknown',
    three3dViewExists: !!document.querySelector('#three3dView'),
    three3dViewCls: document.querySelector('#three3dView')?.className || 'none',
  };
});
console.log('\n=== State ===');
console.log(JSON.stringify(state, null, 2));

// 相关日志
console.log('\n=== CRAFT3D/PBR 关键日志 ===');
const relevant = logs.filter(l => 
  l.text.includes('Craft3D') || l.text.includes('shuqian') || 
  l.text.includes('FORM_PBR') || l.text.includes('✅') || 
  l.text.includes('❌') || l.text.includes('renderCustom') ||
  l.text.includes('roughness') || l.text.includes('metalness') ||
  l.text.includes('PBR')
);
if (relevant.length === 0) {
  console.log('(无相关日志)');
} else {
  relevant.forEach(l => console.log(`[${l.type}] ${l.text.substring(0, 300)}`));
}

console.log('\n=== 所有非debug console 日志 ===');
logs.filter(l => l.type !== 'debug' && !l.text.includes('[vite]')).forEach(l => console.log(`[${l.type}] ${l.text.substring(0, 200)}`));

await b.close();
