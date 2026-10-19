import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });

for (const [name, w, h] of [['hero-verify', 1440, 900], ['hero-verify-mobile', 390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const r = await page.evaluate(() => {
    const em = document.querySelector('.hero-title em') || document.querySelector('h1.hero-title em');
    const daily = document.querySelector('.hero-daily-icon');
    const exploreBtn = document.getElementById('hero-explore');
    const exploreIcon = exploreBtn ? exploreBtn.querySelector('i') : null;
    return {
      emFontFamily: em ? getComputedStyle(em).fontFamily : null,
      emFontStyle: em ? getComputedStyle(em).fontStyle : null,
      emBgClip: em ? getComputedStyle(em).backgroundClip : null,
      emGradient: em ? getComputedStyle(em).backgroundImage : null,
      dailyHTML: daily ? daily.innerHTML.slice(0, 80) : null,
      dailyChild: daily ? daily.children[0]?.tagName : null,
      exploreBtnClass: exploreBtn ? exploreBtn.className : null,
      exploreBtnText: exploreBtn ? exploreBtn.textContent?.trim() : null,
      exploreIconClass: exploreIcon ? exploreIcon.className : null,
      exploreIconChar: exploreIcon ? exploreIcon.textContent : null,
    };
  });
  console.log(`\n=== ${name} ${w}x${h} ===`);
  console.log('hero-title em font-family:', r.emFontFamily);
  console.log('hero-title em font-style:', r.emFontStyle);
  console.log('hero-title em background-clip:', r.emBgClip);
  console.log('hero-title em background-image:', r.emGradient);
  console.log('hero-daily-icon innerHTML:', r.dailyHTML);
  console.log('hero-daily-icon firstChild tag:', r.dailyChild);
  console.log('hero-explore class:', r.exploreBtnClass);
  console.log('hero-explore text:', r.exploreBtnText);
  console.log('hero-explore icon class:', r.exploreIconClass);
  console.log('hero-explore icon char:', r.exploreIconChar);

  await page.screenshot({ path: `docs/ui-audit/${name}.png`, fullPage: true });
  await ctx.close();
}
await browser.close();
