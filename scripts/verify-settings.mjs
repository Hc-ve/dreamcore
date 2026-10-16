/**
 * 设置模块自动化冒烟测试
 * 运行: npx playwright test scripts/test-settings.spec.ts --reporter=line
 * 或直接: node scripts/test-settings.js（下面这个用内置 CDP 的 node 脚本）
 */
// 用原生 fetch + jsdom 做最小验证，不依赖 playwright
import('node:http').then(async () => {
  const res = await fetch('http://localhost:5173/js/settings.js');
  const code = await res.text();
  console.log(`📦 settings.js 加载: ${res.status} (${(code.length/1024).toFixed(1)}KB)`);

  // 关键结构点验证
  const checks = [
    ['Settings export', /export const Settings/],
    ['TABS 数组 (6 个)', /profile.*appearance.*general.*notify.*privacy.*about/s],
    ['SYSTEM_AVATARS (5 款)', /avatarSVG_landscape.*avatarSVG_porcelain.*avatarSVG_lion/s],
    ['Drawer 构建', /sc-drawer-head/],
    ['全屏页渲染', /sp-page-title.*个人资料/],
    ['Gear 入口监听', /#settings-toggle/],
    ['双写兼容 soundEnabled', /soundEnabled/],
    ['双写兼容 dreamcore-theme', /dreamcore-theme/],
    ['实时生效 applyTheme', /applyTheme/],
    ['实时生效 applyBrightness', /applyBrightness/],
    ['init 函数', /Settings.*init\(\)/],
    ['hash 路由 _tryRenderPage', /_tryRenderPage/],
  ];

  let pass = 0, fail = 0;
  for (const [label, re] of checks) {
    const ok = re.test(code);
    if (ok) { console.log(`  ✅ ${label}`); pass++; }
    else { console.log(`  ❌ ${label}`); fail++; }
  }

  // 验证 index.html 也没有 theme-toggle / sound-toggle 了
  const htmlRes = await fetch('http://localhost:5173/');
  const html = await htmlRes.text();
  const themeGone = !html.includes('id="theme-toggle"');
  const soundGone = !html.includes('id="sound-toggle"');
  const gearThere = html.includes('id="settings-toggle"');
  console.log(`\n🏠 index.html:`);
  console.log(`  ${themeGone?'✅':'❌'} theme-toggle 已移除`);
  console.log(`  ${soundGone?'✅':'❌'} sound-toggle 已移除`);
  console.log(`  ${gearThere?'✅':'❌'} #settings-toggle 已添加`);

  // 验证 router 有 settings 路由
  const routerRes = await fetch('http://localhost:5173/js/router.js');
  const routerCode = await routerRes.text();
  const hasRoute = routerCode.includes('settings:') && routerCode.includes('#\\/settings');
  console.log(`\n🛣️  router.js:`);
  console.log(`  ${hasRoute?'✅':'❌'} settings 路由已注册`);

  console.log(`\n📊 代码结构检查: ${pass}/${checks.length} 通过`);
  console.log(`🚀 静态验证完成。请在 Edge 中 Ctrl+Shift+R http://localhost:5173/ 手动验证 Drawer + 全屏页。`);
});
