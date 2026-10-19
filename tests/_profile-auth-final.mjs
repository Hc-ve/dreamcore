import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-remote-fonts'] });

function makeCtx(loginScript) {
  return browser.newContext({ viewport: { width: 1280, height: 900 } }).then(async ctx => {
    const p = await ctx.newPage();
    const init = `Object.defineProperty(document,'fonts',{get(){return{ready:Promise.resolve(),addEventListener:()=>{},load:()=>Promise.resolve()}}});try{localStorage.clear();localStorage.setItem('hasVisited','1');}catch(_){};${loginScript}`;
    await p.addInitScript(init);
    return { ctx, p };
  });
}

// Case 1: 未登录
console.log('\n=== Case 1: 未登录态 ===');
{
  const { ctx, p } = await makeCtx('');
  await p.goto('http://localhost:5173/#/settings', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  const r = await p.evaluate(() => {
    const tabs = [...document.querySelectorAll('.sp-tab')].map(b => b.dataset.tab);
    const tabTexts = [...document.querySelectorAll('.sp-tab span')].map(s => s.textContent.trim());
    const hasProfileTab = tabs.includes('profile');
    const contentHasAvatarPicker = !!document.querySelector('.avatar-picker');
    const contentHasNicknameInput = !!document.querySelector('#sp-nickname');
    const contentHasBioTextarea = !!document.querySelector('#sp-bio');
    const hasLockedCard = !!document.querySelector('.sp-auth-locked');
    const activeTab = document.querySelector('.sp-tab.active')?.dataset.tab;
    return { tabs, tabTexts, hasProfileTab, contentHasAvatarPicker, contentHasNicknameInput, contentHasBioTextarea, hasLockedCard, activeTab, hash: location.hash };
  });
  console.log(JSON.stringify(r, null, 2));
  console.log('  ✅ 无"个人资料"tab:', !r.hasProfileTab);
  console.log('  ✅ 无头像选择器:', !r.contentHasAvatarPicker);
  console.log('  ✅ 无昵称输入:', !r.contentHasNicknameInput);
  console.log('  ✅ 当前tab=appearance:', r.activeTab === 'appearance');

  // Case 1b: 直接访问 ?tab=profile 防绕过
  await p.evaluate(() => { window.location.hash = '#/settings?tab=profile'; });
  await p.waitForTimeout(800);
  const r2 = await p.evaluate(() => {
    const active = document.querySelector('.sp-tab.active')?.dataset.tab;
    return { activeTab: active, hash: location.hash, avatarExists: !!document.querySelector('.avatar-picker') };
  });
  console.log('  ✅ 直接访问 ?tab=profile 被redirect:', r2.activeTab === 'appearance' || r2.hash.includes('appearance'));
  console.log('  ✅ redirect 后无头像控件:', !r2.avatarExists);

  await ctx.close();
}

// Case 2: 已登录
console.log('\n=== Case 2: 已登录态 ===');
{
  const { ctx, p } = await makeCtx(`
    try {
      localStorage.setItem('dreamcore-currentUser', JSON.stringify({ id: 1, email: 'test@test.com', nickname: '测试用户' }));
    } catch(_){}
    window.currentUser = { id: 1, email: 'test@test.com' };
    window.Auth = window.Auth || {};
    window.Auth.getCurrentUser = () => ({ id: 1, email: 'test@test.com' });
  `);
  await p.goto('http://localhost:5173/#/settings', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);

  // 手动触发 Auth.checkAuthState() 已被拦截，用 JS 直接让 Auth.getCurrentUser 有返回值
  // 但 Settings.init() 已经执行过了——这里需要 reload 让 init 重新拿值
  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(1500);
  // 点击个人资料 tab
  const profileBtn = await p.$('.sp-tab[data-tab="profile"]');
  if (profileBtn) {
    await profileBtn.click();
    await p.waitForTimeout(500);
  }
  const r = await p.evaluate(() => {
    const tabs = [...document.querySelectorAll('.sp-tab')].map(b => b.dataset.tab);
    return {
      hasProfileTab: tabs.includes('profile'),
      avatarPicker: !!document.querySelector('.avatar-picker'),
      nicknameInput: !!document.querySelector('#sp-nickname'),
      bioTextarea: !!document.querySelector('#sp-bio'),
      tagsRow: !!document.querySelector('#sp-tags'),
      securityRow: !!document.querySelector('#sp-change-password'),
      lockedCard: !!document.querySelector('.sp-auth-locked'),
    };
  });
  console.log(JSON.stringify(r, null, 2));
  console.log('  ✅ 有"个人资料"tab:', r.hasProfileTab);
  console.log('  ✅ 有头像选择器:', r.avatarPicker);
  console.log('  ✅ 有昵称输入:', r.nicknameInput);
  console.log('  ✅ 有简介 textarea:', r.bioTextarea);
  console.log('  ✅ 有兴趣标签:', r.tagsRow);
  console.log('  ✅ 有安全操作区:', r.securityRow);
  console.log('  ✅ 无未登录状态卡:', !r.lockedCard);

  await ctx.close();
}

await browser.close();
console.log('\n=== ALL DONE ===');
