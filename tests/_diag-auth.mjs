import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-remote-fonts'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
await p.addInitScript(() => {
  Object.defineProperty(document, 'fonts', { get() { return { ready: Promise.resolve(), addEventListener: () => {}, load: () => Promise.resolve() }; } });
});
await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2000);

// 先看当前 Auth 模块状态
const pre = await p.evaluate(() => ({
  hasCurrentUser: typeof window.currentUser !== 'undefined',
  currentUserVal: window.currentUser,
  hasAuth: !!window.Auth,
  hasGetCurrentUser: !!(window.Auth && window.Auth.getCurrentUser),
  authGetResult: window.Auth && window.Auth.getCurrentUser ? window.Auth.getCurrentUser() : 'n/a',
  htmlHasFine: document.documentElement.classList.contains('has-fine-pointer'),
}));
console.log('BEFORE:', JSON.stringify(pre, null, 2));

// 设置 window.currentUser 并导航
await p.evaluate(() => {
  window.currentUser = { id: 1, email: 't@t.com', nickname: '测试' };
  window.location.hash = '#/settings';
});
await p.waitForTimeout(1500);

const post = await p.evaluate(() => {
  const u = (typeof window.currentUser !== 'undefined' && window.currentUser) ||
            (window.Auth && window.Auth.getCurrentUser && window.Auth.getCurrentUser()) || null;
  return {
    window_currentUser: window.currentUser,
    hasUser: !!u,
    allTabs: [...document.querySelectorAll('.sp-tab')].map(b => b.dataset.tab),
    hash: location.hash,
  };
});
console.log('AFTER:', JSON.stringify(post, null, 2));

await browser.close();
