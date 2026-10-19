import fs from 'fs';
const p = 'E:/a/6a578b50553ee2fa56364236/js/settings.js';
let c = fs.readFileSync(p, 'utf8');
// Normalize to LF for matching
const orig = c;
c = c.replace(/\r\n/g, '\n');

// P3: Find "function tabProfile() {" then "// 容错" and insert auth guard between
const tabProfileSig = 'function tabProfile() {';
const tpIdx = c.indexOf(tabProfileSig);
console.log('tabProfile sig at:', tpIdx);
// Find first // 容错 after that
const commentIdx = c.indexOf('// 容错：avatar', tpIdx);
console.log('容错 comment at:', commentIdx);
if (tpIdx > 0 && commentIdx > 0) {
  const guard = `  const _u = (typeof window.currentUser !== 'undefined' && window.currentUser) ||
             (window.Auth && window.Auth.getCurrentUser && window.Auth.getCurrentUser()) || null;
  if (!_u) {
    return \`<div class="sp-page-title">个人资料</div>
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
      </div>\`;
  }
`;
  // Insert just before "// 容错"
  c = c.slice(0, commentIdx) + guard + c.slice(commentIdx);
  console.log('P3 OK');
}

// P4: initProfileTab - insert after function sig
const ipSig = 'function initProfileTab(content) {';
const ipIdx = c.indexOf(ipSig);
console.log('initProfileTab sig at:', ipIdx);
const avatarCmt = c.indexOf('// 系统头像选择', ipIdx);
console.log('系统头像 comment at:', avatarCmt);
if (ipIdx > 0 && avatarCmt > 0) {
  const initCode = `  const _loginBtn = content.querySelector('#sp-goto-login, #sp-goto-login-full');
  if (_loginBtn) { _loginBtn.addEventListener('click', () => { if (window.Auth && window.Auth.openLogin) window.Auth.openLogin(); else window.location.hash = '#/login'; }); }
  const _homeBtn = content.querySelector('#sp-goto-home');
  if (_homeBtn) { _homeBtn.addEventListener('click', () => { window.location.hash = '#/'; }); }
  if (!content.querySelector('.avatar-picker')) return;
`;
  c = c.slice(0, avatarCmt) + initCode + c.slice(avatarCmt);
  console.log('P4 OK');
}

// Restore CRLF if original had it
if (orig.includes('\r\n')) c = c.replace(/\n/g, '\r\n');

fs.writeFileSync(p, c, 'utf8');
console.log('Final len:', c.length);
