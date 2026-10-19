import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-remote-fonts'] });

async function testCase(name, initScript) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const page = await ctx.newPage();
  await page.addInitScript(initScript);
  await page.goto('http://localhost:5173/#/settings?tab=profile', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  
  const info = await page.evaluate(() => {
    // 屏蔽其他模块，只看 settings host
    const host = document.getElementById('__settings_host');
    if (!host) return { error: 'no settings host' };
    const locked = host.querySelector('.sp-auth-locked');
    const loginBtn = host.querySelector('#sp-goto-login');
    const emailBtn = host.querySelector('#sp-change-email');
    const pwdBtn = host.querySelector('#sp-change-password');
    return {
      lockedExists: !!locked,
      loginBtnExists: !!loginBtn,
      emailBtnExists: !!emailBtn,
      emailBtnDisabled: emailBtn?.disabled || false,
      pwdBtnExists: !!pwdBtn,
      pwdBtnDisabled: pwdBtn?.disabled || false,
      hintText: host.querySelector('.sp-card h3')?.textContent?.trim() || '',
      authLockedTitle: locked?.querySelector('.sp-auth-locked-title')?.textContent?.trim() || '',
    };
  });
  await page.screenshot({ path: `tests/security-${name}.png`, fullPage: true });
  console.log(`\n[${name}]`);
  console.log(`  ${JSON.stringify(info)}`);
  await ctx.close();
  return info;
}

// Case 1: 未登录（清 localStorage）
const i1 = await testCase('guest', () => {
  Object.defineProperty(document, 'fonts', { get() { return { ready: Promise.resolve(), addEventListener: ()=>{}, load: ()=>Promise.resolve() }; } });
  try { localStorage.clear(); localStorage.setItem('hasVisited', '1'); } catch(_) {}
});
console.log(`  ✅ locked 状态卡 = ${i1.lockedExists && !i1.emailBtnExists ? 'PASS' : 'FAIL'}`);

// Case 2: 已登录但本地开发模式（无 Supabase）
const i2 = await testCase('loggedin-local', () => {
  Object.defineProperty(document, 'fonts', { get() { return { ready: Promise.resolve(), addEventListener: ()=>{}, load: ()=>Promise.resolve() }; } });
  try { 
    localStorage.clear(); 
    localStorage.setItem('hasVisited', '1');
    localStorage.setItem('currentUser', JSON.stringify({ id: 1, username: 'testuser', email: 'test@example.com' }));
  } catch(_) {}
});
console.log(`  ✅ 已登录按钮 disabled = ${!i2.lockedExists && i2.emailBtnDisabled && i2.pwdBtnDisabled ? 'PASS' : 'FAIL'}`);

await browser.close();
