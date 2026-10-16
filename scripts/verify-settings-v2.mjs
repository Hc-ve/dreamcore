// 跑这个：node scripts/verify-settings-v2.mjs
// 用 fetch 检查 Vite 提供的最新 settings.js 是否包含关键修复点

const res = await fetch('http://localhost:5173/js/settings.js?t=' + Date.now());
const code = await res.text();
console.log(`📦 settings.js v2 加载: ${res.status} (${(code.length/1024).toFixed(1)}KB)`);

const checks = [
  ['v2.0.0 版本号', code.includes("VERSION: '2.0.0'")],
  ['SYSTEM_AVATARS 导出', code.includes('SYSTEM_AVATARS, // 暴露给 auth.js')],
  ['avatar-changed 事件', code.includes("dreamcore:avatar-changed")],
  ['init try-catch', /init\(\)\s*\{[^}]*try/i.test(code)],
  ['SYSTEM_AVATARS.push 初始化', code.includes('SYSTEM_AVATARS.push')],
  ['renderFullSettings try-catch', code.includes('renderFullSettings(container) {') && code.includes('console.error')],
  ['renderTab try-catch', code.includes('renderTab(content, id)') && code.includes('页面加载出错')],
  ['_tryRenderPage try-catch', code.includes('_tryRenderPage()') && code.includes('console.error')],
  ['sp-back-btn 返回按钮', code.includes('sp-back-btn') && code.includes('history.back')],
  ['tabProfile 脏数据保护', code.includes('typeof cur !== ') || code.includes('cur.type !==')],
  ['双写 soundEnabled', code.includes("localStorage.setItem('soundEnabled'")],
  ['双写 dreamcore-theme', code.includes("localStorage.setItem('dreamcore-theme'")],
  ['initRealtimeApply 日志', code.includes('applyTheme →')],
  ['setSetting debug 日志', code.includes("'[Settings] setSetting'")],
];

let pass = 0, fail = 0;
for (const [label, ok] of checks) {
  if (ok) { console.log(`  ✅ ${label}`); pass++; }
  else { console.log(`  ❌ ${label}`); fail++; }
}
console.log(`\n📊 修复点检查: ${pass}/${checks.length} 通过`);

// auth.js 检查
const authRes = await fetch('http://localhost:5173/js/auth.js?t=' + Date.now());
const authCode = await authRes.text();
console.log(`\n📦 auth.js v2: ${authRes.status}`);
const authChecks = [
  ['移除 notification-bell', !authCode.includes('notification-bell')],
  ['监听 avatar-changed', authCode.includes('dreamcore:avatar-changed')],
  ['调用 updateNavForUser', authCode.includes('updateNavForUser()') && authCode.includes('dreamcore:avatar-changed')],
  ['getSetting avatar', authCode.includes('Settings.getSetting') && authCode.includes('avatar')],
];
for (const [label, ok] of authChecks) {
  if (ok) { console.log(`  ✅ ${label}`); pass++; }
  else { console.log(`  ❌ ${label}`); fail++; }
}

console.log(`\n📊 总计: ${pass}/${checks.length + authChecks.length}`);
console.log(`\n🚀 测试步骤：Edge 打开 http://localhost:5173/ → Ctrl+Shift+R 硬刷新 → Console 搜 "[Settings]" 看日志`);
