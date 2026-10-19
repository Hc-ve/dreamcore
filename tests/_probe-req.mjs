// tests/_probe-req.mjs — 定位前端失败请求（回归辅助诊断）
// 用法: node tests/_probe-req.mjs [baseUrl]
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:5173/';
const ROUTES = ['', '#/gallery', '#/craft', '#/settings', '#/publish', '#/tutor', '#/score', '#/scenic',
  '#/pricing', '#/ai-disclosure', '#/partner', '#/admin', '#/edit', '#/profile', '#/atlas',
  '#/footprint', '#/leaderboard', '#/scan', '#/search', '#/detail'];

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await (await browser.newContext()).newPage();
const fails = new Map();
page.on('requestfailed', (r) => fails.set(r.url(), (r.failure() && r.failure().errorText) || '?'));
const resp = [];
page.on('response', (r) => { if (r.status() >= 400) resp.push(r.status() + ' ' + r.url()); });

for (const h of ROUTES) {
  try {
    await page.goto(BASE + h, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
  } catch (e) { /* ignore */ }
}
console.log('FAILED REQUESTS (' + fails.size + '):');
for (const [u, t] of fails) console.log(' -', t, '|', u);
console.log('HTTP >=400 (' + resp.length + '):');
for (const s of resp.slice(0, 20)) console.log(' -', s);

// Font Awesome 本地化校验：字体是否加载 + 图标伪元素是否真实渲染
try {
  const scan = async (route) => {
    await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1200);
    return await page.evaluate(async () => {
      await document.fonts.ready;
      const loaded = document.fonts.check('900 16px "Font Awesome 6 Free"');
      const icons = [...document.querySelectorAll('i[class*="fa-"], span[class*="fa-"]')]
        .map((e) => getComputedStyle(e, '::before').content)
        .filter((c) => c && c !== 'none' && c !== '""');
      return { route: location.hash || '#/', solidFontLoaded: loaded, renderedIcons: icons.length, sample: icons.slice(0, 3) };
    });
  };
  console.log('FA CHECK:', JSON.stringify(await scan('')));
  console.log('FA CHECK:', JSON.stringify(await scan('#/settings')));
} catch (e) { console.log('FA CHECK failed:', e.message); }
await browser.close();
