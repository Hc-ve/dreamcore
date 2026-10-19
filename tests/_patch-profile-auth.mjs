import fs from 'fs';
const p = 'E:/a/6a578b50553ee2fa56364236/js/settings.js';
let c = fs.readFileSync(p, 'utf8');
let pass = 0, fail = 0;

function apply(oldSnippet, newSnippet, label) {
  if (c.includes(oldSnippet)) {
    c = c.replace(oldSnippet, newSnippet);
    console.log('  ✅ ' + label);
    pass++;
    return true;
  }
  console.log('  ❌ ' + label + ' (snippet not found)');
  fail++;
  return false;
}

console.log('Applying auth guards to settings.js...');

// Patch 1: renderFullSettings - TABS filter + URL redirect
const p1old = "function renderFullSettings(container) {\n  try {\n    const tab = new URLSearchParams(window.location.hash.split('?')[1] || '').get('tab') || 'profile';";
const p1new = "function renderFullSettings(container) {\n  try {\n    const _u = (typeof window.currentUser !== 'undefined' && window.currentUser) ||\n               (window.Auth && window.Auth.getCurrentUser && window.Auth.getCurrentUser()) || null;\n    const _loggedIn = !!_u;\n    const visibleTabs = _loggedIn ? TABS : TABS.filter(t => t.id !== 'profile');\n    let tab = new URLSearchParams(window.location.hash.split('?')[1] || '').get('tab') || 'profile';\n    if (!_loggedIn && tab === 'profile') {\n      tab = 'appearance';\n      history.replaceState(null, '', '#/settings?tab=appearance');\n    }";
apply(p1old, p1new, 'P1 renderFullSettings TABS filter + URL redirect');

// Also need to fix the TABS.map reference from TABS to visibleTabs
const p1bOld = "${TABS.map(t => `";
const p1bNew = "${visibleTabs.map(t => `";
apply(p1bOld, p1bNew, 'P1b TABS.map -> visibleTabs.map');

// Patch 2: renderTab - profile redirect
const p2old = "function renderTab(content, id) {\n  try {\n    switch (id) {\n      case 'profile':   content.innerHTML = tabProfile();   initProfileTab(content);   break;";
const p2new = "function renderTab(content, id) {\n  try {\n    const _u2 = (typeof window.currentUser !== 'undefined' && window.currentUser) ||\n                (window.Auth && window.Auth.getCurrentUser && window.Auth.getCurrentUser()) || null;\n    const _loggedIn2 = !!_u2;\n    switch (id) {\n      case 'profile':\n        if (!_loggedIn2) {\n          content.innerHTML = '';\n          const parent = content.parentElement;\n          if (parent) {\n            const btn = parent.querySelector('.sp-tab[data-tab=\"appearance\"]');\n            if (btn) btn.click();\n          }\n          return;\n        }\n        content.innerHTML = tabProfile();\n        initProfileTab(content);\n        break;";
apply(p2old, p2new, 'P2 renderTab profile redirect');

// Patch 3: tabProfile auth guard - just after function tabProfile() line
const p3old = "function tabProfile() {\n  // 容错：avatar 可能是脏数据\n  let cur = getSetting('avatar');";
const p3new = "function tabProfile() {\n  const _user = (typeof window.currentUser !== 'undefined' && window.currentUser) ||\n                (window.Auth && window.Auth.getCurrentUser && window.Auth.getCurrentUser()) || null;\n  if (!_user) {\n    const lockedCard = '<div class=\"sp-page-title\">个人资料</div>'\n      + '<div class=\"sp-auth-locked sp-auth-locked-full\">'\n      + '<div class=\"sp-auth-locked-icon\"><i class=\"fa-solid fa-user-lock\"></i></div>'\n      + '<div class=\"sp-auth-locked-text\">'\n      + '<div class=\"sp-auth-locked-title\">需要登录</div>'\n      + '<div class=\"sp-auth-locked-desc\">头像、昵称、个人简介、兴趣标签等个人资料编辑功能需要登录后才能使用。请先登录你的账户。</div>'\n      + '</div>'\n      + '<div class=\"sp-auth-locked-actions\">'\n      + '<button class=\"sp-btn sp-btn-primary\" id=\"sp-goto-login-full\">立即登录</button>'\n      + '<button class=\"sp-btn\" id=\"sp-goto-home\">回到首页</button>'\n      + '</div></div>';\n    return lockedCard;\n  }\n  // 容错：avatar 可能是脏数据\n  let cur = getSetting('avatar');";
apply(p3old, p3new, 'P3 tabProfile auth guard + state card');

// Patch 4: initProfileTab - login button bindings + early return for logged-out state
const p4old = "function initProfileTab(content) {\n  // 系统头像选择";
const p4new = "function initProfileTab(content) {\n  const loginBtn = content.querySelector('#sp-goto-login, #sp-goto-login-full');\n  if (loginBtn) {\n    loginBtn.addEventListener('click', () => {\n      if (window.Auth && typeof window.Auth.openLogin === 'function') {\n        window.Auth.openLogin();\n      } else {\n        window.location.hash = '#/login';\n      }\n    });\n  }\n  const homeBtn = content.querySelector('#sp-goto-home');\n  if (homeBtn) {\n    homeBtn.addEventListener('click', () => { window.location.hash = '#/'; });\n  }\n  if (!content.querySelector('.avatar-picker')) {\n    return;\n  }\n  // 系统头像选择";
apply(p4old, p4new, 'P4 initProfileTab login btn + early return');

fs.writeFileSync(p, c, 'utf8');
console.log('\n=== RESULT ===');
console.log('Pass: ' + pass + '  Fail: ' + fail);
console.log('Final length: ' + c.length);
