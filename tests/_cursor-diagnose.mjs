import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-remote-fonts'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(() => {
  Object.defineProperty(document, 'fonts', { get() { return { ready: Promise.resolve(), addEventListener: () => {}, load: () => Promise.resolve() }; } });
  try { localStorage.clear(); localStorage.setItem('hasVisited', '1'); } catch(_) {}
});

await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

// Home 页面 cursor 位置基线
await page.mouse.move(200, 200);
await page.waitForTimeout(80);
const home1 = await page.evaluate(() => {
  const dot = document.getElementById('cursor-dot');
  return { left: dot.style.left, top: dot.style.top, rect: dot.getBoundingClientRect() };
});
console.log('HOME @(200,200):', JSON.stringify(home1));

await page.mouse.move(600, 400);
await page.waitForTimeout(80);
const home2 = await page.evaluate(() => {
  const dot = document.getElementById('cursor-dot');
  return { left: dot.style.left, top: dot.style.top, rect: dot.getBoundingClientRect() };
});
console.log('HOME @(600,400):', JSON.stringify(home2));

// 打开 Drawer 快捷面板（齿轮按钮）
await page.click('#settings-toggle');
await page.waitForTimeout(600);
console.log('\n--- Drawer 快捷面板 ---');
await page.mouse.move(120, 300);
await page.waitForTimeout(80);
const d1 = await page.evaluate(() => {
  const dot = document.getElementById('cursor-dot');
  return { left: dot.style.left, top: dot.style.top, rect: dot.getBoundingClientRect(), z: getComputedStyle(dot).zIndex };
});
console.log('DRAWER @(120,300):', JSON.stringify(d1));

// 进入全屏 #/settings
await page.evaluate(() => { window.location.hash = '#/settings'; });
await page.waitForTimeout(1200);
console.log('\n--- 全屏 #/settings ---');

// 先在 host 外（navbar 区域）
await page.mouse.move(200, 30);
await page.waitForTimeout(80);
const s0 = await page.evaluate(() => {
  const dot = document.getElementById('cursor-dot');
  return { left: dot.style.left, top: dot.style.top };
});
console.log('SETTINGS outside host @(200,30):', JSON.stringify(s0));

// host 内部 - tab 区域
await page.mouse.move(200, 100);
await page.waitForTimeout(80);
const s1 = await page.evaluate(() => {
  const dot = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  const host = document.getElementById('__settings_host');
  return {
    dot_left: dot?.style.left,
    dot_top: dot?.style.top,
    dot_rect: dot?.getBoundingClientRect(),
    ring_rect: ring?.getBoundingClientRect(),
    host_top: host?.getBoundingClientRect().top,
    host_bottom: host?.getBoundingClientRect().bottom,
    html_has_fine_pointer: document.documentElement.classList.contains('has-fine-pointer'),
    body_cursor_blurred: document.body.classList.contains('cursor-blurred'),
  };
});
console.log('SETTINGS @(200,100):', JSON.stringify(s1));

// host 内部 - content 区域（有 input）
await page.mouse.move(600, 400);
await page.waitForTimeout(80);
const s2 = await page.evaluate(() => {
  const dot = document.getElementById('cursor-dot');
  return { left: dot?.style.left, top: dot?.style.top, rect: dot?.getBoundingClientRect() };
});
console.log('SETTINGS @(600,400) in content:', JSON.stringify(s2));

// 检查 cursor 元素是否被什么遮挡
const overlay = await page.evaluate(() => {
  const dot = document.getElementById('cursor-dot');
  const rect = dot.getBoundingClientRect();
  // 取 cursor-dot 中心点的 elementFromPoint
  const el = document.elementFromPoint(rect.left + rect.width/2, rect.top + rect.height/2);
  return {
    dot_center_x: rect.left + rect.width/2,
    dot_center_y: rect.top + rect.height/2,
    element_at_center: el ? el.tagName + (el.id ? '#'+el.id : '') + (el.className ? '.'+String(el.className).slice(0,60) : '') : null,
    element_z: el ? getComputedStyle(el).zIndex : null,
    element_pos: el ? getComputedStyle(el).position : null,
  };
});
console.log('\nElement at cursor center:', JSON.stringify(overlay));

await browser.close();
