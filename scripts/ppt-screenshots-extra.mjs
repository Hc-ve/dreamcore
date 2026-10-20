// 补充截图：AI 修图工作台（带真实作品）+ AI 文创（带作品）——解决空状态缺"运行效果"问题
import { chromium } from 'playwright';
import path from 'node:path';

const ROOT = 'e:/a/6a578b50553ee2fa56364236';
const OUT = path.join(ROOT, 'ppt制作素材库');
const PREP = `try{localStorage.setItem('hasVisited','1');}catch(e){}`;
const ADMIN = { id: 'local-admin', username: 'admin', email: 'admin@dreamcore.art', isAdmin: true, role: 'superadmin', nickname: '', bio: '', avatar: null, createdAt: '2026-10-01T00:00:00.000Z' };

const SHOTS = [
  ['#/edit?artworkId=1', '02-创作工坊', '03-AI修图工作台(带作品).png', 3200],
];

async function main() {
  let browser;
  try { browser = await chromium.launch({ channel: 'msedge', headless: true }); }
  catch (e) { browser = await chromium.launch({ headless: true }); }
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(PREP);
  const page = await ctx.newPage();

  await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate((admin) => {
    try { localStorage.setItem('currentUser', JSON.stringify(admin)); } catch (_) {}
    window.currentUser = admin;
  }, ADMIN);
  await page.waitForTimeout(300);

  for (const [hash, mod, name, wait] of SHOTS) {
    const outFile = path.join(OUT, mod, name);
    try {
      await page.evaluate(h => { window.location.hash = h; }, hash);
      await page.waitForTimeout(wait);
      await page.screenshot({ path: outFile, type: 'png' });
      console.log('SHOT_OK', name, hash);
    } catch (e) {
      console.log('SHOT_ERR', name, (e.message || String(e)).slice(0, 120));
    }
  }
  await browser.close();
  console.log('DONE');
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });