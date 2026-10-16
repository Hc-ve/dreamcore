/** 诊断 craft 页面结构 */
import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

await page.goto('http://localhost:5173/');
await page.waitForSelector('.artwork-card', { timeout: 20000 });
await page.evaluate(() => { window.currentUser = { id: 1, username: 'admin', isAdmin: true, role: 'superadmin' }; });

await page.goto('http://localhost:5173/#/craft');
await page.waitForTimeout(4000);

const info = await page.evaluate(() => {
  const r = {};
  r.url = location.href;
  r.title = document.title;
  r.text = document.body.innerText;
  r.buttons = Array.from(document.querySelectorAll('button')).slice(0, 30).map(b => ({
    text: b.textContent.trim().substring(0, 40),
    cls: b.className,
    id: b.id
  }));
  r.chips = Array.from(document.querySelectorAll('[data-product-key], [data-key], .craft-chip, .product-chip, .craft-product, .product-item, .product-card, [class*="product"]')).map(el => ({
    tag: el.tagName,
    cls: el.className?.substring(0, 60),
    key: el.dataset?.productKey || el.dataset?.key || '',
    text: el.textContent?.trim().substring(0, 40)
  })).slice(0, 40);
  return r;
});

console.log('URL:', info.url);
console.log('Title:', info.title);
console.log('--- BODY TEXT ---');
console.log(info.text.substring(0, 2000));
console.log('--- BUTTONS ---');
info.buttons.forEach(b => console.log(`  [${b.id}] ${b.cls?.substring(0,30)} → "${b.text}"`));
console.log('--- PRODUCT ELEMENTS ---');
info.chips.forEach(c => console.log(`  ${c.tag}.${c.cls} data-key="${c.key}" → "${c.text}"`));

const outDir = 'qa-output/bookmark-uv';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
await page.screenshot({ path: `${outDir}/craft-debug.png`, fullPage: true });
console.log('\n📸 screenshot saved');

await browser.close();
