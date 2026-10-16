import { chromium } from 'playwright';

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUT = 'e:/a/6a578b50553ee2fa56364236/test-screenshots';
const b = await chromium.launch({ executablePath: EDGE, headless: false });
const p = await b.newPage();
const allLogs = [];
p.on('console', m => {
  const t = m.text().substring(0, 300);
  allLogs.push({ type: m.type(), text: t });
  if (t.includes('Craft3D') || t.includes('FORM_PBR') || t.includes('shuqian') || t.includes('✅') || t.includes('❌')) {
    console.log(`[${m.type()}] ${t}`);
  }
});
p.on('pageerror', e => console.log('[PAGEERR]', e.message));

console.log('=== Goto #/craft ===');
await p.goto('http://localhost:5173/#/craft', { waitUntil: 'networkidle' });
await p.waitForTimeout(4000);

// 先关 welcome modal（可能自动消失？或点 overlay）
await p.keyboard.press('Escape').catch(() => {});
await p.waitForTimeout(300);

// 切热门作品 tab
console.log('=== Click hot tab ===');
const hotTab = p.locator('#artwork-picker-modal .ap-tab[data-tab="hot"]');
await hotTab.click();
await p.waitForTimeout(1500);

// dump ap-grid 内容
const gridInfo = await p.evaluate(() => {
  const grid = document.querySelector('#ap-grid');
  if (!grid) return { error: 'no grid' };
  return {
    html: grid.innerHTML.substring(0, 2000),
    childCount: grid.children.length,
    items: [...grid.children].map(c => ({ tag: c.tagName, cls: c.className.substring(0, 80), text: c.innerText?.substring(0, 50) }))
  };
});
console.log('Grid info:', JSON.stringify(gridInfo, null, 2));

await p.screenshot({ path: OUT + '/01-after-hot-tab.png', fullPage: true });

// 如果有作品，点第一个
if (gridInfo.items && gridInfo.items.length > 0 && !gridInfo.items[0].cls.includes('empty')) {
  const firstItem = p.locator('#ap-grid > *:not(.ap-empty)').first();
  await firstItem.click();
  console.log('Clicked first artwork');
  await p.waitForTimeout(3000);
} else {
  console.log('No artworks found in hot tab. Trying to close picker and force openCraft...');
  // 试试直接用 JS 调 openCraft 跳过 picker
  await p.evaluate(() => {
    const modal = document.querySelector('#artwork-picker-modal');
    if (modal) modal.remove();
  });
  await p.waitForTimeout(500);
}

// 检查 workspace
const wsInfo = await p.evaluate(() => {
  const ws = document.querySelector('#craft-workspace, .craft-workspace, [class*="craft-panel"], #ai-craft-panel, [class*="craft-panel"]');
  if (!ws) {
    // 更广泛搜
    const all = document.querySelectorAll('[class*="workspace"], [class*="craft-panel"], #craft-workspace, #ai-craft');
    return { notFound: true, candidates: [...all].map(e => ({ cls: e.className.substring(0, 100), id: e.id })).slice(0, 10) };
  }
  const cr = ws.getBoundingClientRect();
  return { cls: ws.className.substring(0, 150), id: ws.id, visible: cr.width > 0, childCount: ws.children.length };
});
console.log('Workspace:', JSON.stringify(wsInfo, null, 2));

// dump 品类选择器
const cats = await p.evaluate(() => {
  return [...document.querySelectorAll('[data-product-key], .craft-chip, .category-chip, [class*="product"], [class*="craft-item"]')]
    .slice(0, 30).map(el => ({
      k: el.dataset.productKey || '',
      cls: el.className.substring(0, 80),
      text: el.innerText?.trim().substring(0, 30),
      visible: el.getBoundingClientRect().width > 0
    }));
});
console.log('Category elements:', cats.filter(c => c.visible));

await p.screenshot({ path: OUT + '/02-after-pick.png', fullPage: true });

// Console 报告
console.log('\n=== CONSOLE KEY LOGS ===');
const craftLogs = allLogs.filter(l => l.text.includes('Craft3D') || l.text.includes('shuqian') || l.text.includes('FORM_PBR') || l.text.includes('✅') || l.text.includes('❌'));
craftLogs.forEach(l => console.log(`  [${l.type}] ${l.text}`));

const errors = allLogs.filter(l => l.type === 'error' || l.text.includes('❌'));
console.log(`\nErrors: ${errors.length}`);
errors.forEach(l => console.log(`  ❌ ${l.text}`));

await b.close();
