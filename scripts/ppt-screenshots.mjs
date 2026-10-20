// 演示项目 PPT 插图素材自动采集脚本
// 用系统 Edge（chromium channel=msedge）以 1920×1080 视口逐路由截图，
// 并复制已有精品截图，归档到 ppt制作素材库（按功能模块分目录）。
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'e:/a/6a578b50553ee2fa56364236';
const OUT = path.join(ROOT, 'ppt制作素材库');
const SRC_SHOTS = path.join(ROOT, 'docs/screenshots');

// 跳过首次访问欢迎弹窗
const PREP = `try{localStorage.setItem('hasVisited','1');}catch(e){}`;
// 管理员登录态（本地降级模式 supabaseEnabled=false），在页面加载后注入 window.currentUser
const ADMIN = { id: 'local-admin', username: 'admin', email: 'admin@dreamcore.art', isAdmin: true, role: 'superadmin', nickname: '', bio: '', avatar: null, createdAt: '2026-10-01T00:00:00.000Z' };

const MOD = {
  home: '01-首页与画廊',
  workshop: '02-创作工坊',
  explore: '03-文化探索',
  account: '04-平台与账户',
  tech: '05-技术证据',
};

// [hash, 模块, 文件名, 额外等待ms]
const SHOTS = [
  ['#/', MOD.home, '01-首页-Hero首屏', 2400],
  ['#/gallery', MOD.home, '02-文旅画廊-瀑布流', 2600],
  ['#/leaderboard', MOD.home, '03-创作者排行榜', 2400],
  ['#/scan', MOD.workshop, '01-AI识文化', 2400],
  ['#/score', MOD.workshop, '02-AI智能评分', 2400],
  ['#/edit', MOD.workshop, '03-AI修图工作台', 2400],
  ['#/craft', MOD.workshop, '04-AI文创工作台', 2800],
  ['#/tutor', MOD.workshop, '05-AI陪练', 2400],
  ['#/curate', MOD.workshop, '06-AI智能策展', 2400],
  ['#/partner', MOD.workshop, '07-合伙人计划', 2400],
  ['#/atlas', MOD.explore, '01-文化故事图鉴', 2600],
  ['#/scenic', MOD.explore, '02-智慧导览', 2600],
  ['#/footprint', MOD.explore, '03-文化探索足迹', 2400],
  ['#/profile', MOD.account, '01-个人中心', 2400],
  ['#/admin', MOD.account, '02-管理后台', 2800],
  ['#/settings', MOD.account, '03-设置中心', 2400],
  ['#/pricing', MOD.account, '04-会员权益定价', 2400],
];

// 已有精品截图 → 对应归档
const COPY = [
  ['gallery-home.png', path.join(MOD.home, '02-文旅画廊-瀑布流(已有).png')],
  ['craft-workbench.png', path.join(MOD.workshop, '04-AI文创工作台(已有).png')],
  ['ai-repaint.png', path.join(MOD.workshop, '08-AI重绘(已有).png')],
  ['self-trained-badge.png', path.join(MOD.tech, '01-自研模型训练徽章(已有).png')],
];

function esc(s) { return String(s); }

async function main() {
  // 建目录
  for (const d of Object.values(MOD)) fs.mkdirSync(path.join(OUT, d), { recursive: true });

  // 复制已有截图
  const copied = [];
  for (const [src, rel] of COPY) {
    const from = path.join(SRC_SHOTS, src);
    const to = path.join(OUT, rel);
    if (fs.existsSync(from)) { fs.copyFileSync(from, to); copied.push(rel); }
  }

  // 启动 Edge
  let browser;
  try { browser = await chromium.launch({ channel: 'msedge', headless: true }); }
  catch (e) { browser = await chromium.launch({ headless: true }); }
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(PREP);
  const page = await ctx.newPage();

  await page.goto('http://localhost:5173/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(2500);

  // 注入管理员登录态（在 checkAuthState 完成后覆盖 window.currentUser）
  await page.evaluate((admin) => {
    try { localStorage.setItem('currentUser', JSON.stringify(admin)); } catch (_) {}
    window.currentUser = admin;
  }, ADMIN);
  await page.waitForTimeout(300);

  const results = [];
  for (const [hash, mod, name, wait] of SHOTS) {
    const outFile = path.join(OUT, mod, name + '.png');
    try {
      await page.evaluate(h => { window.location.hash = h; }, hash);
      await page.waitForTimeout(wait);
      await page.screenshot({ path: outFile, type: 'png' });
      results.push({ ok: 1, name: name + '.png', hash });
    } catch (e) {
      results.push({ ok: 0, name: name + '.png', hash, err: (e.message || String(e)).slice(0, 120) });
    }
    console.log('SHOT', JSON.stringify(results[results.length - 1]));
  }

  await browser.close();
  console.log('COPIED', JSON.stringify(copied));
  console.log('DONE', JSON.stringify({ total: results.length, ok: results.filter(r => r.ok).length }));
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });