import { chromium } from 'playwright';

const matrix = [
  ['light', null, 'default-light'],
  ['light', 'guofeng', 'guofeng-light'],
  ['light', 'feiyi', 'feiyi-light'],
  ['light', 'minimal', 'minimal-light'],
  ['dark', null, 'default-dark'],
  ['dark', 'guofeng', 'guofeng-dark'],
  ['dark', 'feiyi', 'feiyi-dark'],
  ['dark', 'minimal', 'minimal-dark'],
];

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  channel: 'msedge',
  headless: true,
});

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

for (const [theme, style, name] of matrix) {
  const page = await context.newPage();
  await page.addInitScript(({ t, s }) => {
    try { localStorage.clear(); } catch (e) {}
    localStorage.setItem('dreamcore-theme', t);
    if (s) localStorage.setItem('dreamcore-particle-theme', s);
  }, { t: theme, s: style });

  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  const attrs = await page.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    style: document.documentElement.getAttribute('data-style'),
    bgDark: getComputedStyle(document.documentElement).getPropertyValue('--bg-dark').trim(),
    lsParticleTheme: localStorage.getItem('dreamcore-particle-theme'),
    lsParticleThemeLegacy: localStorage.getItem('dreamcore-particleTheme'),
    lsTheme: localStorage.getItem('dreamcore-theme'),
    lsPrefTheme: localStorage.getItem('dreamcore-pref-theme'),
  }));
  console.log(`${name}: ${JSON.stringify(attrs)}`);

  await page.screenshot({ path: `docs/ui-audit/theme-matrix/${name}.png`, fullPage: false, timeout: 180000 });
  await page.close();
}

await browser.close();
console.log('DONE');
