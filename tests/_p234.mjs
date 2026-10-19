import fs from 'fs';
const p = 'E:/a/6a578b50553ee2fa56364236/js/settings.js';
let c = fs.readFileSync(p, 'utf8');
const pass = [];

// P2 - renderTab profile redirect block
const p2old = `      case 'profile':   content.innerHTML = tabProfile();   initProfileTab(content);   break;`;
const p2new = `      case 'profile':
        {
          const _u2 = (typeof window.currentUser !== 'undefined' && window.currentUser) ||
                      (window.Auth && window.Auth.getCurrentUser && window.Auth.getCurrentUser()) || null;
          if (!_u2) {
            content.innerHTML = '';
            const parent = content.parentElement;
            if (parent) { const b = parent.querySelector('.sp-tab[data-tab="appearance"]'); if (b) b.click(); }
            return;
          }
        }
        content.innerHTML = tabProfile();
        initProfileTab(content);
        break;`;
if (c.includes(p2old)) { c = c.replace(p2old, p2new); pass.push('P2'); } else pass.push('P2_FAIL');

// P3 - tabProfile auth guard
const p3old = `function tabProfile() {
  // 容错：avatar 可能是脏数据
  let cur = getSetting('avatar');`;
const lockedHtml = `<div class="sp-page-title">个人资料</div>
      <div class="sp-auth-locked sp-auth-locked-full">
        <div class="sp-auth-locked-icon"><i class="fa-solid fa-user-lock"></i></div>
        <div class="sp-auth-locked-text">
          <div class="sp-auth-locked-title">需要登录</div>
          <div class="sp-auth-locked-desc">头像、昵称、个人简介、兴趣标签等个人资料编辑功能需要登录后才能使用。请先登录你的账户。</div>
        </div>
        <div class="sp-auth-locked-actions">
          <button class="sp-btn sp-btn-primary" id="sp-goto-login-full">立即登录</button>
          <button class="sp-btn" id="sp-goto-home">回到首页</button>
        </div>
      </div>`;
const p3new = `function tabProfile() {
  const _u = (typeof window.currentUser !== 'undefined' && window.currentUser) ||
             (window.Auth && window.Auth.getCurrentUser && window.Auth.getCurrentUser()) || null;
  if (!_u) { return \`${lockedHtml}\`; }
  // 容错：avatar 可能是脏数据
  let cur = getSetting('avatar');`;
if (c.includes(p3old)) { c = c.replace(p3old, p3new); pass.push('P3'); } else pass.push('P3_FAIL');

// P4 - initProfileTab login bindings + early return
const p4old = `function initProfileTab(content) {
  // 系统头像选择`;
const p4new = `function initProfileTab(content) {
  const _loginBtn = content.querySelector('#sp-goto-login, #sp-goto-login-full');
  if (_loginBtn) { _loginBtn.addEventListener('click', () => { if (window.Auth && window.Auth.openLogin) window.Auth.openLogin(); else window.location.hash = '#/login'; }); }
  const _homeBtn = content.querySelector('#sp-goto-home');
  if (_homeBtn) { _homeBtn.addEventListener('click', () => { window.location.hash = '#/'; }); }
  if (!content.querySelector('.avatar-picker')) return;
  // 系统头像选择`;
if (c.includes(p4old)) { c = c.replace(p4old, p4new); pass.push('P4'); } else pass.push('P4_FAIL');

fs.writeFileSync(p, c, 'utf8');
console.log(JSON.stringify(pass));
console.log('Final len:', c.length);
