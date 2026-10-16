// scripts/debug-admin.cjs — 调试副本里的后台登录态
const { chromium } = require('playwright');
const path = require('path');
const os = require('os');

const profileDir = path.join(os.tmpdir(), 'dreamcore-idb-audit');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const ctx = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport: { width: 1440, height: 1000 }
  });
  const page = ctx.pages()[0] || await ctx.newPage();

  const logs = [];
  page.on('console', m => logs.push(`[${m.type()}] ${m.text()}`));

  await page.addInitScript(() => {
    localStorage.setItem('currentUser', JSON.stringify({
      id: 1, username: 'admin', isAdmin: true, role: 'superadmin', email: 'admin@local'
    }));
  });

  await page.goto('http://localhost:5173/#/admin', { waitUntil: 'networkidle', timeout: 20000 });
  await sleep(4000);

  const state = await page.evaluate(() => ({
    lsUser: localStorage.getItem('currentUser'),
    winUser: window.currentUser ? { username: window.currentUser.username, isAdmin: window.currentUser.isAdmin, role: window.currentUser.role } : null,
    hash: location.hash,
    bodyHasAdmin: !!document.querySelector('[class*="admin"]'),
    tabTexts: [...document.querySelectorAll('*')].filter(e => e.children.length === 0 && /3D|模型管理/.test(e.textContent || '')).slice(0, 5).map(e => e.textContent.trim()),
    modalOpen: document.getElementById('auth-modal')?.classList.contains('open')
  }));
  console.log(JSON.stringify(state, null, 2));
  console.log('--- console (后20条) ---');
  logs.slice(-20).forEach(l => console.log(l));
  await page.screenshot({ path: 'qa-output/debug-admin.png' });
  await ctx.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
