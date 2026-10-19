import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-remote-fonts'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const p = await ctx.newPage();
await p.addInitScript(() => {
  Object.defineProperty(document, 'fonts', { get() { return { ready: Promise.resolve(), addEventListener: () => {}, load: () => Promise.resolve() }; } });
});
await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(2000);

// 模拟登录：直接调 Auth 模块
await p.evaluate(async () => {
  if (window.Auth) {
    // 尝试直接设置 currentUser
    window.currentUser = { id: 1, email: 'test@test.com', nickname: '测试用户' };
    if (window.Auth.getCurrentUser) {
      // 有些 Auth 模块是闭包的 currentUser，需要触发重新检测
      // 这里试一下 localStorage 恢复路径
      localStorage.setItem('currentUser', JSON.stringify(window.currentUser));
    }
    // 尝试调用 checkAuthState
    if (typeof window.Auth.checkAuthState === 'function') {
      try { await window.Auth.checkAuthState(); } catch(e) { console.log('checkAuthState err:', e.message); }
    }
  }
});
await p.waitForTimeout(500);

// 现在导航到 settings
await p.evaluate(() => { window.location.hash = '#/settings'; });
await p.waitForTimeout(1500);

const r = await p.evaluate(() => {
  const tabs = [...document.querySelectorAll('.sp-tab')].map(b => b.dataset.tab);
  const _u = (typeof window.currentUser !== 'undefined' && window.currentUser) ||
             (window.Auth && window.Auth.getCurrentUser && window.Auth.getCurrentUser()) || null;
  return {
    hasUser: !!_u,
    user: _u,
    allTabs: tabs,
    profileBtnExists: tabs.includes('profile'),
  };
});
console.log(JSON.stringify(r, null, 2));
if (r.profileBtnExists) {
  const pb = await p.$('.sp-tab[data-tab="profile"]');
  if (pb) { await pb.click(); await p.waitForTimeout(600); }
  const r2 = await p.evaluate(() => ({ avatarPicker: !!document.querySelector('.avatar-picker'), nickname: !!document.querySelector('#sp-nickname'), locked: !!document.querySelector('.sp-auth-locked') }));
  console.log('After click profile:', JSON.stringify(r2));
  console.log(r2.avatarPicker && r2.nickname && !r2.locked ? '✅ PASS' : '❌ FAIL');
} else {
  console.log('❌ FAIL: profile button not shown even with logged-in user');
}
await browser.close();
