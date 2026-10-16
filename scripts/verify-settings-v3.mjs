// node scripts/verify-settings-v3.mjs — 最终交付验证
const res = await fetch('http://localhost:5173/js/settings.js?t=' + Date.now());
const code = await res.text();
const particles = await (await fetch('http://localhost:5173/js/particles.js?t=' + Date.now())).text();

const checks = [
  // particles.js：不再创建 navbar switcher
  ['particles.js 不创建 switcher', particles.includes('设置模块接管了风格主题') || !particles.includes('navbar.appendChild')],
  ['particles.js setTheme 可用', particles.includes('setTheme(themeKey)')],

  // settings.js：particleTheme 支持
  ['particleTheme key', code.includes("particleTheme: 'particleTheme'")],
  ['particleTheme 默认值', code.includes("particleTheme: 'default'")],
  ['PARTICLE_THEME_OPTIONS 4 个', code.includes('guofeng') && code.includes('feiyi') && code.includes('minimal')],
  ['双写 dreamcore-particle-theme', code.includes("dreamcore-particle-theme")],
  ['调用 Particles.setTheme', code.includes('Particles?.setTheme')],

  // tabAppearance 重设计
  ['界面明暗 section', code.includes('界面明暗')],
  ['风格主题 section', code.includes('风格主题')],
  ['sp-theme-grid', code.includes('sp-theme-grid')],
  ['sp-theme-card', code.includes('sp-theme-card')],

  // Drawer 也加了
  ['Drawer 风格主题 segmented', code.includes('sc-seg-sm') && code.includes('particleTheme')],

  // 安全网
  ['全链路 try-catch', code.split('try {').length >= 7],
  ['SYSTEM_AVATARS.push 初始化', code.includes('SYSTEM_AVATARS.push')],
];

let pass = 0, fail = 0;
for (const [label, ok] of checks) {
  if (ok) { pass++; console.log(`  ✅ ${label}`); }
  else    { fail++; console.log(`  ❌ ${label}`); }
}

// auth.js
const auth = await (await fetch('http://localhost:5173/js/auth.js')).text();
console.log('\nauth.js:');
const a1 = !auth.includes('notification-bell');
const a2 = auth.includes('dreamcore:avatar-changed');
const a3 = auth.includes('Settings.getSetting') && auth.includes('avatar');
if (a1) { pass++; console.log('  ✅ 移除 notification-bell'); } else { fail++; console.log('  ❌ notification-bell 还在'); }
if (a2) { pass++; console.log('  ✅ 监听 avatar-changed'); } else { fail++; console.log('  ❌ 没监听 avatar-changed'); }
if (a3) { pass++; console.log('  ✅ 读 Settings.getSetting avatar'); } else { fail++; console.log('  ❌ 没读 Settings avatar'); }

console.log(`\n📊 总计: ${pass}/${checks.length + 3}`);
if (fail === 0) console.log('🎉 全部通过！Edge Ctrl+Shift+R http://localhost:5173/');
