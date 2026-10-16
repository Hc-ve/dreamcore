/**
 * 在 Edge Console 里直接粘贴运行：诊断 Settings 模块状态
 */
console.log('========== Settings 诊断 ==========');

// 1. Settings 模块是否加载
const S = window.Settings;
console.log('[1] window.Settings 存在:', !!S);
console.log('    Settings.getSetting:', typeof S?.getSetting);
console.log('    Settings.setSetting:', typeof S?.setSetting);

// 2. SYSTEM_AVATARS 数组
console.log('[2] SYSTEM_AVATARS 长度:', window.__SYSTEM_AVATARS__?.length || '(未暴露，直接查)');
// 从已渲染的 DOM 里看头像 picker 的数量
const avatarCount = document.querySelectorAll('.avatar-option').length;
console.log('    DOM 里头像选项数量:', avatarCount);

// 3. 当前设置值
const keys = ['theme', 'fontSize', 'brightness', 'sound', 'avatar', 'nickname'];
console.log('[3] localStorage 中设置值:');
keys.forEach(k => {
  try {
    const stored = localStorage.getItem('dreamcore-' + k);
    const legacy = k === 'theme' ? localStorage.getItem('dreamcore-theme') : k === 'sound' ? localStorage.getItem('soundEnabled') : null;
    console.log(`    ${k}: dreamcore-${k}=${stored?.slice(0,50)} | legacy=${legacy}`);
  } catch (e) { console.log(`    ${k}: ERROR`, e.message); }
});

// 4. data-theme / data-font-size 实际状态
console.log('[4] documentElement 属性:');
console.log('    data-theme:', document.documentElement.getAttribute('data-theme'));
console.log('    data-font-size:', document.documentElement.getAttribute('data-font-size'));
console.log('    __brightness_overlay:', !!document.getElementById('__brightness_overlay'));

// 5. 事件链：手动触发 setSetting 看有没有抛错
console.log('[5] 手动测试 setSetting("theme", "dark") →');
try {
  if (S?.setSetting) {
    S.setSetting('theme', 'dark');
    console.log('    ✅ setSetting 没抛错');
    console.log('    data-theme 现在是:', document.documentElement.getAttribute('data-theme'));
  } else {
    console.log('    ❌ Settings 模块没加载！');
  }
} catch (e) {
  console.log('    ❌ setSetting 抛异常:', e.message);
}

// 6. Drawer 是否能打开、事件有没有绑
const gear = document.querySelector('#settings-toggle');
console.log('[6] #settings-toggle 存在:', !!gear);
const drawer = document.querySelector('.sc-drawer');
console.log('    .sc-drawer 存在:', !!drawer);
const host = document.querySelector('#__settings_host');
console.log('    #__settings_host 存在:', !!host);

// 7. 全屏页 DOM 状态
const spContent = document.querySelector('#sp-content');
console.log('[7] #sp-content 存在:', !!spContent, '内容长度:', spContent?.innerHTML?.length || 0);

console.log('========== 诊断结束 ==========');
