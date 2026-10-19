import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-remote-fonts'] });

// 验证 1：未登录 → 显示"请先登录"状态卡
console.log('\n=== Case 1: 未登录态 ===');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.addInitScript(() => { Object.defineProperty(document, 'fonts', { get() { return { ready: Promise.resolve() }; } }); });
  await p.goto('http://localhost:5173/#/settings?tab=profile', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3000);
  const i = await p.evaluate(() => ({
    locked: !!document.querySelector('.sp-auth-locked'),
    loginBtn: !!document.querySelector('#sp-goto-login'),
    emailBtn: !!document.querySelector('#sp-change-email'),
    pwdBtn: !!document.querySelector('#sp-change-password'),
  }));
  await p.screenshot({ path: 'tests/sec-guest.png' });
  console.log('未登录 → locked=', i.locked, ' loginBtn=', i.loginBtn, ' emailBtn=', i.emailBtn ? 'BUG! 未登录不应显示' : 'ok隐藏');
  await ctx.close();
}

// 验证 2：模拟登录成功（supabase 真跑）
console.log('\n=== Case 2: 模拟已登录（localStorage 注入 + 直接调 checkAuthState 前确保 Supabase 返回 null → 回退）===');
// 由于 supabaseEnabled=true 且无真 session，checkAuthState 会返回 null。
// 我们绕过 checkAuthState，直接让 window.currentUser 生效后看安全模块
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.addInitScript(() => { Object.defineProperty(document, 'fonts', { get() { return { ready: Promise.resolve() }; } }); });
  await p.goto('http://localhost:5173/#/settings?tab=profile', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(3000);
  // 模拟：手动设 currentUser + 触发 Auth 事件
  await p.evaluate(() => {
    window.currentUser = { id: 1, username: 'dreamcore_test', email: 'test@dreamcore.art' };
    // 重新渲染 profile tab（手动）
    if (window.Settings && typeof Settings.reRenderTab === 'function') {
      Settings.reRenderTab('profile');
    }
    // 或者简单重 hash
    const hash = location.hash;
    location.hash = '#';
    setTimeout(() => location.hash = hash, 50);
  });
  await p.waitForTimeout(1500);
  const i = await p.evaluate(() => ({
    locked: !!document.querySelector('.sp-auth-locked'),
    emailBtn: !!document.querySelector('#sp-change-email'),
    emailDisabled: document.querySelector('#sp-change-email')?.disabled,
    pwdBtn: !!document.querySelector('#sp-change-password'),
    pwdDisabled: document.querySelector('#sp-change-password')?.disabled,
    emailText: document.querySelector('.sp-security-value')?.textContent?.trim(),
  }));
  await p.screenshot({ path: 'tests/sec-loggedin.png' });
  console.log('已登录 → locked=', i.locked, '(应为 false)');
  console.log('已登录 → emailBtn=', i.emailBtn, pwdBtn=i.pwdBtn, emailDisabled=i.emailDisabled, pwdDisabled=i.pwdDisabled);
  console.log('已登录 → email显示:', i.emailText);
  await ctx.close();
}

await browser.close();
