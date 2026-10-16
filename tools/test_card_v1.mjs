import { chromium } from 'playwright';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = 'e:/a/6a578b50553ee2fa56364236/test-screenshots';
const b = await chromium.launch({ executablePath: EDGE, headless: false });
const p = await b.newPage();
const logs = [];
p.on('console', m => {
  const t = m.text().substring(0, 500);
  logs.push({ type: m.type(), text: t });
  console.log(`[${m.type()}] ${t.substring(0, 300)}`);
});
p.on('pageerror', e => console.log('[PAGEERR]', e.message));

// Step 1: goto
console.log('\n=== 1. Goto ===');
await p.goto('http://localhost:5173/#/craft?artworkId=1', { waitUntil: 'networkidle' });
await p.waitForTimeout(5000);
await p.evaluate(() => document.querySelectorAll('.welcome-modal').forEach(m => m.remove()));
await p.waitForTimeout(1000);

// Step 2: click bookmark category
console.log('\n=== 2. Click bookmark ===');
const bm = p.locator('.craft-product-card').filter({ hasText: '藏品卡' }).first();
await bm.click();
console.log('Bookmark clicked');
await p.waitForTimeout(2000);

// Step 3: click 3D mockup chip
console.log('\n=== 3. Click 3D chip ===');
// 先看 chip 的可见性
const chipInfo = await p.evaluate(() => {
  const chip = document.querySelector('.craft-mockup-chip-3d');
  if (!chip) return { error: 'not found' };
  const cr = chip.getBoundingClientRect();
  const style = getComputedStyle(chip);
  const parent = chip.parentElement;
  const parentCr = parent?.getBoundingClientRect();
  const parentStyle = parent ? getComputedStyle(parent) : null;
  // 滚动到可见位置
  chip.scrollIntoView({ behavior: 'instant', block: 'center' });
  return {
    cr: { x: cr.x, y: cr.y, w: cr.width, h: cr.height },
    display: style.display, visibility: style.visibility, opacity: style.opacity,
    hidden: chip.hidden,
    parentCr: parentCr ? { x: parentCr.x, y: parentCr.y, w: parentCr.width, h: parentCr.height } : null,
    parentOverflow: parentStyle?.overflow || '',
    parentCls: parent?.className?.substring(0, 80) || '',
    text: chip.innerText.trim().substring(0, 30)
  };
});
console.log('Chip info:', JSON.stringify(chipInfo, null, 2));

const chip3d = p.locator('.craft-mockup-chip-3d');
const c3 = await chip3d.count();
console.log('3D chips found:', c3);
if (c3 > 0) {
  // 用 JS 直接触发 click（绕过 Playwright 可见性检查）
  await p.evaluate(() => {
    const chip = document.querySelector('.craft-mockup-chip-3d');
    if (chip) {
      chip.scrollIntoView({ behavior: 'instant', block: 'center' });
      chip.click();
      console.log('[JS] 3D chip clicked via evaluate!');
    }
  });
  console.log('3D chip clicked via JS!');
}

// Step 4: wait for 3D render
console.log('\n=== 4. Wait 12s for Three.js ===');
await p.waitForTimeout(12000);

await p.screenshot({ path: OUT + '/06-bookmark-3d.png', fullPage: true });
console.log('Screenshot saved');

// Check state
const st = await p.evaluate(() => {
  const canvases = [...document.querySelectorAll('canvas')];
  return {
    canvasCount: canvases.length,
    canvasSizes: canvases.map(c => ({ id: c.id, w: c.width, h: c.height, visible: c.getBoundingClientRect().width > 0 })),
    craft3dExists: !!document.querySelector('#craft-3d-view'),
    craft3dHidden: document.querySelector('#craft-3d-view')?.hidden ?? 'N/A',
    craft3dChildCount: document.querySelector('#craft-3d-view')?.children.length ?? 0,
    craft3dActive: typeof Craft3D !== 'undefined' && Craft3D.isActive ? Craft3D.isActive() : 'unknown',
    mockupChipsText: [...document.querySelectorAll('.craft-mockup-chip')].map(c => c.innerText.trim())
  };
});
console.log('\n=== State ===');
console.log(JSON.stringify(st, null, 2));

// 关键日志
console.log('\n=== CRAFT3D/PBR 关键日志 ===');
const rel = logs.filter(l => 
  l.text.includes('Craft3D') || l.text.includes('shuqian') || 
  l.text.includes('FORM_PBR') || l.text.includes('✅') || 
  l.text.includes('❌') || l.text.includes('renderCustom') ||
  l.text.includes('roughness') || l.text.includes('metalness') ||
  l.text.includes('PBR') || l.text.includes('金属') || l.text.includes('书签')
);
rel.forEach(l => console.log(`[${l.type()}] ${l.text.substring(0, 400)}`));

const errors = logs.filter(l => l.type === 'error');
if (errors.length > 0) {
  console.log(`\n❌ ERRORS (${errors.length}):`);
  errors.forEach(l => console.log(`  ${l.text.substring(0, 300)}`));
} else {
  console.log('\n✅ 零 console errors');
}

// 也检查程序渲染日志
console.log('\n=== 全部非debug日志 ===');
logs.filter(l => l.type !== 'debug' && !l.text.includes('[vite]')).forEach(l => console.log(`[${l.type}] ${l.text.substring(0, 300)}`));

await b.close();
