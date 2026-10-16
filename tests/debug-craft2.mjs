import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto('http://localhost:5173/');
await page.waitForSelector('.artwork-card, .gallery-card', { timeout: 20000 });
await page.evaluate(() => { window.currentUser = { id: 1, username: 'admin', isAdmin: true, role: 'superadmin' }; });

// 跳到 craft
await page.goto('http://localhost:5173/#/craft');
await page.waitForTimeout(5000);

// 第一步：找到并关闭欢迎弹窗
const welcomeClosed = await page.evaluate(() => {
  // 找各种可能的欢迎弹窗
  const candidates = [
    '#welcome-enter', '.welcome-close', '[data-close-welcome]',
    '.onboarding-close', '#welcome-modal .close',
    '.modal-close', '[class*="welcome"] [class*="close"]',
    '.dialog-close'
  ];
  for (const sel of candidates) {
    const el = document.querySelector(sel);
    if (el && el.offsetParent !== null) { el.click(); return { sel }; }
  }
  // 试试点右上角的 X
  const allDivs = document.querySelectorAll('div, button');
  for (const el of allDivs) {
    if (el.textContent.trim() === '×' && el.offsetParent !== null && el.children.length === 0) {
      el.click();
      return { xbutton: true };
    }
  }
  return { noMatch: true };
});
console.log('Welcome closed:', JSON.stringify(welcomeClosed));

await page.waitForTimeout(1500);

// 第二步：现在应该看到"选择作品 · AI文创"弹窗——找热门作品 tab
const step2 = await page.evaluate(() => {
  // 打印整个 body
  const r = {};
  r.body = document.body.innerText.substring(0, 2000);
  
  // 找所有可见元素，特别是 tab 和 button
  const visible = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      const style = window.getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
      const parentRect = node.parentElement?.getBoundingClientRect();
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return NodeFilter.FILTER_REJECT;
      if (rect.top < -50 || rect.left < -50) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let n;
  while ((n = walker.nextNode())) {
    const txt = n.textContent?.trim().substring(0, 40);
    if (txt && n.children.length <= 3) {
      visible.push({
        tag: n.tagName,
        text: txt,
        cls: n.className?.toString?.().substring?.(0,40) || '',
        id: n.id || '',
        rect: (() => { const r = n.getBoundingClientRect(); return {x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height)}; })()
      });
    }
    if (visible.length > 100) break;
  }
  r.visibleCount = visible.length;
  r.visible = visible.slice(0, 80);
  return r;
});

console.log('=== VISIBLE ELEMENTS ===');
for (const el of step2.visible) {
  console.log(`  [${el.tag}] #${el.id} .${el.cls} @(${el.rect.x},${el.rect.y}) "${el.text}"`);
}

// 第三步：找 tab 切换到热门作品
// 先找 tab elements
const tabsClicked = await page.evaluate(() => {
  const allElements = document.querySelectorAll('*');
  const results = [];
  for (const el of allElements) {
    if (el.children.length <= 2 && el.textContent?.trim() === '热门作品') {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        results.push({ tag: el.tagName, cls: el.className?.toString?.(), w: r.width, h: r.height });
        // 别 click 太多次
      }
    }
  }
  return results;
});
console.log('\n=== TABS ===');
console.log(JSON.stringify(tabsClicked, null, 2));

if (tabsClicked.length > 0) {
  await page.getByText('热门作品', { exact: true }).click({ force: true });
  console.log('✅ 点击了 热门作品 tab');
}

await page.waitForTimeout(3000);

// 第四步：看热门作品 tab 里有没有作品
const artworks = await page.evaluate(() => {
  const cards = document.querySelectorAll('.artwork-card, .gallery-card, .artwork-item, [data-artwork-id], .card');
  return Array.from(cards).slice(0, 20).map(c => ({
    cls: c.className?.toString?.().substring?.(0, 60) || '',
    id: c.id || '',
    data: c.dataset ? Object.fromEntries(Object.entries(c.dataset)) : {},
    text: c.textContent?.trim().substring(0, 40)
  }));
});
console.log('\n=== ARTWORKS IN TAB ===');
console.log(`Found: ${artworks.length}`);
for (const a of artworks) console.log(`  ${JSON.stringify(a)}`);

// 截图
await page.screenshot({ path: 'qa-output/bookmark-uv/craft-populated.png', fullPage: false });
console.log('\n📸 screenshot saved');

if (artworks.length > 0) {
  // 试着点第一张
  const first = page.locator('.artwork-card, .gallery-card, .artwork-item, [data-artwork-id]').first();
  if (await first.isVisible({ timeout: 2000 })) {
    await first.click({ force: true });
    console.log('✅ 点击第一张作品');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'qa-output/bookmark-uv/workbench-opened.png' });
  }
}

await browser.close();
