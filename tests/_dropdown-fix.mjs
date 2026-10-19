import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-remote-fonts'] });

async function testTheme(theme, name) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript(([t]) => {
    Object.defineProperty(document, 'fonts', { get() { return { ready: Promise.resolve(), addEventListener: ()=>{}, load: ()=>Promise.resolve() }; } });
    try { localStorage.clear(); localStorage.setItem('hasVisited', '1'); localStorage.setItem('dreamcore-theme', t); } catch(_) {}
  }, [theme]);
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.evaluate(() => { if (window.Search && Search.showSearchBar) Search.showSearchBar(); });
  await page.waitForTimeout(1200);
  // 展开 dropdown
  await page.click('#filter-category-trigger');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `tests/dropdown-${name}.png`, fullPage: false });
  
  const info = await page.evaluate(() => {
    const optsWrap = document.querySelector('.custom-select-options');
    const trigger = document.querySelector('.custom-select-trigger');
    const firstOpt = document.querySelector('.custom-select-option');
    if (!optsWrap) return { error: 'no dropdown' };
    return {
      isOpen: optsWrap.classList.contains('is-open'),
      optsCount: optsWrap.children.length,
      optsPanelBg: getComputedStyle(optsWrap).backgroundColor,
      optsBorder: getComputedStyle(optsWrap).borderColor,
      optsPanelZ: getComputedStyle(optsWrap).zIndex,
      triggerBg: getComputedStyle(trigger).backgroundColor,
      firstOptBg: firstOpt ? getComputedStyle(firstOpt).backgroundColor : null,
      firstOptColor: firstOpt ? getComputedStyle(firstOpt).color : null,
      isDark: document.documentElement.getAttribute('data-theme') === 'dark',
    };
  });
  console.log(`\n[${name}] theme=${theme}`);
  console.log(`  ${JSON.stringify(info)}`);
  
  // 白底检测：不应该有 255,255,255 背景
  const whiteBg = (info.optsPanelBg || '').includes('255, 255, 255') || (info.optsPanelBg || '').includes('rgb(255');
  console.log(`  ✅ dropdown 无白屏 = ${!whiteBg}`);
  
  await ctx.close();
}

await testTheme('light', 'light-fixed');
await testTheme('dark', 'dark-fixed');
await browser.close();
