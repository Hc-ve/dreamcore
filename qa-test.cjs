const puppeteer = require('C:\\Users\\86159\\.local\\lib\\node_modules\\puppeteer-core');
const fs = require('fs');
const path = require('path');

const TARGET = 'http://localhost:5173/';
const OUT = 'C:\\Users\\86159\\AppData\\Roaming\\TRAE SOLO CN\\ModularData\\ai-agent\\work-mode-projects\\6a578b50553ee2fa56364236\\qa-output';
fs.mkdirSync(OUT + '\\screenshots', { recursive: true });

const issues = [];
const consoleErrors = [];
const networkErrors = [];
let issueCounter = 0;

// Compatibility: newer Puppeteer removed wait
const wait = (ms) => new Promise(r => setTimeout(r, ms));

function addIssue(severity, module, title, steps, expected, actual, screenshot) {
  issueCounter++;
  issues.push({ id: `ISSUE-${String(issueCounter).padStart(3, '0')}`, severity, module, title, steps, expected, actual, screenshot });
}

async function screenshot(page, name) {
  const file = `${OUT}\\screenshots\\${name}.png`;
  await page.screenshot({ path: file, fullPage: false });
  return file;
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      const text = msg.text();
      if (!text.includes('favicon') && !text.includes('robots.txt') && !text.includes('DevTools')) {
        consoleErrors.push({ type: msg.type(), text: text.substring(0, 300) });
      }
    }
  });

  page.on('requestfailed', req => {
    const url = req.url();
    if (!url.includes('favicon') && !url.includes('robots.txt')) {
      networkErrors.push({ url: url.substring(0, 200), error: req.failure().errorText });
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push({ type: 'pageerror', text: err.message.substring(0, 300) });
  });

  // === P0: HOMEPAGE ===
  console.log('\n=== P0: Homepage ===');
  try {
    const resp = await page.goto(TARGET, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(3000);
    await screenshot(page, 'p0-homepage');
    const checks = await page.evaluate(() => ({
      hasParticles: !!document.querySelector('#particles-js, .particles, canvas, [class*="particle"]'),
      has3DCursor: !!document.querySelector('[class*="cursor"], [id*="cursor"], #three-cursor'),
      hasNav: !!document.querySelector('nav, .navbar, [class*="nav"]'),
      hasGallery: !!document.querySelector('[class*="gallery"], [class*="masonry"], [id*="gallery"], .artwork-card, .card'),
      bodyText: document.body.innerText.substring(0, 300)
    }));
    console.log('Homepage checks:', JSON.stringify({ ...checks, bodyText: checks.bodyText.substring(0, 100) }));
    if (!checks.hasNav) addIssue('P1', 'Homepage', 'Navbar missing', 'Navigate to homepage', 'Navbar visible', 'No nav found', 'p0-homepage');
    if (!checks.hasGallery) addIssue('P0', 'Homepage', 'Gallery not rendered', 'Navigate to homepage', 'Gallery visible', 'No gallery found', 'p0-homepage');
  } catch (e) {
    addIssue('P0', 'Homepage', 'Homepage load failed', `Navigate to ${TARGET}`, 'Page loads', e.message, 'p0-homepage');
  }

  // === P0: GALLERY CATEGORIES ===
  console.log('\n=== P0: Gallery Categories ===');
  try {
    const chips = await page.$$('[class*="chip"], [class*="filter"], [class*="category"], .filter-btn, button[class*="cat"]');
    console.log(`Found ${chips.length} chips`);
    if (chips.length === 0) addIssue('P1', 'Gallery', 'Category chips not found', 'Look for filter chips', 'Category chips visible', 'No chips found', 'p0-homepage');
    for (let i = 0; i < Math.min(5, chips.length); i++) {
      try { await chips[i].click(); await wait(800); } catch (e) {}
    }
    if (chips.length > 0) await screenshot(page, 'p0-categories');
  } catch (e) {
    addIssue('P1', 'Gallery', 'Category interaction failed', 'Click category chips', 'Gallery filters', e.message, null);
  }

  // === P0: ARTWORK LIGHTBOX ===
  console.log('\n=== P0: Artwork Lightbox ===');
  try {
    await page.goto(TARGET, { waitUntil: 'networkidle2' });
    await wait(2000);
    const cardSelectors = ['.artwork-card', '.card', '[class*="artwork"]', '[class*="card-item"]', '.masonry-item', 'article'];
    let cardClicked = false;
    for (const sel of cardSelectors) {
      const cards = await page.$$(sel);
      if (cards.length > 0) {
        await cards[0].click();
        await wait(2000);
        cardClicked = true;
        await screenshot(page, 'p0-lightbox');
        const hasLightbox = await page.evaluate(() => !!document.querySelector('[class*="lightbox"], [class*="modal"], [class*="overlay"], [id*="lightbox"], [class*="artwork-detail"]'));
        console.log('Lightbox opened:', hasLightbox);
        await page.keyboard.press('ArrowRight'); await wait(500);
        await page.keyboard.press('ArrowLeft'); await wait(500);
        await page.keyboard.press('Escape'); await wait(1000);
        await screenshot(page, 'p0-lightbox-closed');
        if (!hasLightbox) addIssue('P1', 'Lightbox', 'Lightbox did not open', 'Click artwork card', 'Lightbox appears', 'No lightbox detected', 'p0-lightbox');
        break;
      }
    }
    if (!cardClicked) addIssue('P1', 'Lightbox', 'No artwork cards clickable', 'Click artwork card', 'Lightbox opens', 'No cards found', 'p0-homepage');
  } catch (e) {
    addIssue('P1', 'Lightbox', 'Lightbox interaction error', 'Click artwork + keyboard nav', 'Works', e.message, 'p0-lightbox');
  }

  // === P0: SORTING ===
  console.log('\n=== P0: Sorting ===');
  try {
    const sortEls = await page.$$('select[class*="sort"], .sort-select, [class*="sort"], select');
    console.log(`Sort elements: ${sortEls.length}`);
    if (sortEls.length > 0) {
      try {
        await sortEls[0].click(); await wait(500);
        const options = await sortEls[0].$$('option');
        console.log(`Sort options: ${options.length}`);
      } catch (e) {}
    } else {
      const sortBtns = await page.$$('button[class*="sort"], [class*="sort-btn"], [data-sort]');
      if (sortBtns.length === 0) addIssue('P2', 'Gallery', 'Sort dropdown not found', 'Look for sort control', 'Sort with 4 options', 'Not found', null);
    }
  } catch (e) {
    addIssue('P2', 'Sorting', 'Sort interaction failed', 'Use sort dropdown', 'Gallery re-sorts', e.message, null);
  }

  // === P0: SEARCH ===
  console.log('\n=== P0: Search ===');
  try {
    await page.goto(TARGET, { waitUntil: 'networkidle2' });
    await wait(2000);
    const searchInput = await page.$('input[type="search"], input[placeholder*="搜索"], input[placeholder*="search"], .search-input, input[class*="search"]');
    if (searchInput) {
      await searchInput.click();
      await searchInput.type('艺术');
      await wait(1000);
      await page.keyboard.press('Enter');
      await wait(3000);
      await screenshot(page, 'p0-search-results');
      console.log('Search completed');
    } else {
      // Look for search button
      const searchBtns = await page.$$('button[class*="search"], [class*="search-btn"]');
      if (searchBtns.length > 0) {
        await searchBtns[0].click();
        await wait(1000);
        await screenshot(page, 'p0-search-opened');
      } else {
        addIssue('P2', 'Search', 'Search not found', 'Look for search bar', 'Search input visible', 'Not found', 'p0-homepage');
      }
    }
  } catch (e) {
    addIssue('P2', 'Search', 'Search interaction failed', 'Type in search + Enter', 'Search results', e.message, null);
  }

  // === P0: LOGIN ===
  console.log('\n=== P0: Login ===');
  try {
    await page.goto(TARGET + '#/login', { waitUntil: 'networkidle2' });
    await wait(2000);
    await screenshot(page, 'p0-login-page');
    const inputs = await page.$$('input');
    console.log(`Login inputs: ${inputs.length}`);
    if (inputs.length >= 2) {
      await inputs[0].click({ clickCount: 3 }); await inputs[0].type('admin');
      await inputs[1].click({ clickCount: 3 }); await inputs[1].type('admin123');
      await wait(500);
      // Find and click submit
      const btns = await page.$$('button');
      for (const btn of btns) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text.includes('登录') || text.toLowerCase().includes('login') || text.includes('Sign') || text.includes('确定') || text.includes('submit')) {
          await btn.click();
          await wait(3000);
          break;
        }
      }
      await screenshot(page, 'p0-login-result');
      const url = page.url();
      console.log(`After login URL: ${url}`);
      if (url.includes('login')) {
        addIssue('P0', 'Login', 'Login may have failed', 'Login admin/admin123', 'Redirect away from login', `URL: ${url}`, 'p0-login-result');
      }
    }
  } catch (e) {
    addIssue('P0', 'Login', 'Login flow error', 'Navigate to #/login + submit', 'Login success', e.message, 'p0-login-page');
  }

  // === P0: PROFILE ===
  console.log('\n=== P0: Profile ===');
  try {
    await page.goto(TARGET + '#/profile', { waitUntil: 'networkidle2' });
    await wait(2000);
    await screenshot(page, 'p0-profile');
  } catch (e) {
    addIssue('P2', 'Profile', 'Profile page error', 'Navigate to #/profile', 'Profile renders', e.message, 'p0-profile');
  }

  // === P0: ADMIN ===
  console.log('\n=== P0: Admin ===');
  try {
    await page.goto(TARGET + '#/admin', { waitUntil: 'networkidle2' });
    await wait(3000);
    await screenshot(page, 'p0-admin');
    const tabs = await page.$$('[class*="tab"], .tab, button[class*="tab"], [role="tab"], [data-tab]');
    console.log(`Admin tabs: ${tabs.length}`);
    for (let i = 0; i < tabs.length; i++) {
      try {
        const tabName = await page.evaluate(el => el.textContent.trim().substring(0, 20), tabs[i]);
        await tabs[i].click();
        await wait(1500);
        console.log(`  Tab: ${tabName}`);
      } catch (e) {}
    }
    if (tabs.length > 0) await screenshot(page, 'p0-admin-last-tab');

    // Try to find and click dashboard tab
    const allTabs = await page.$$('[class*="tab"], [role="tab"]');
    for (const tab of allTabs) {
      const text = await page.evaluate(el => el.textContent.trim(), tab);
      if (text.includes('数据') || text.includes('看板') || text.includes('dashboard') || text.includes('Dashboard')) {
        await tab.click();
        await wait(3000);
        await screenshot(page, 'p0-admin-dashboard');
        const hasCharts = await page.evaluate(() => !!document.querySelector('canvas, svg, [class*="chart"], [class*="kpi"], [class*="stat"]'));
        console.log('Dashboard charts:', hasCharts);
        if (!hasCharts) addIssue('P1', 'Dashboard', 'Dashboard charts not rendered', 'Admin -> Data Dashboard', 'Charts visible', 'No charts found', 'p0-admin-dashboard');
        break;
      }
    }
  } catch (e) {
    addIssue('P0', 'Admin', 'Admin page error', 'Navigate to #/admin', 'Admin with tabs', e.message, 'p0-admin');
  }

  // === P0: PARTICLE THEMES ===
  console.log('\n=== P0: Particle Themes ===');
  try {
    await page.goto(TARGET, { waitUntil: 'networkidle2' });
    await wait(2000);
    const themeBtns = await page.$$('[class*="theme"], .theme-btn, [data-theme]');
    console.log(`Theme buttons: ${themeBtns.length}`);
    if (themeBtns.length === 0) {
      addIssue('P2', 'Themes', 'Theme switcher not found', 'Look for theme buttons', '4 theme buttons', 'Not found', 'p0-homepage');
    } else {
      for (let i = 0; i < Math.min(4, themeBtns.length); i++) {
        try {
          await themeBtns[i].click();
          await wait(1000);
          await screenshot(page, `p0-theme-${i}`);
        } catch (e) {}
      }
    }
  } catch (e) {
    addIssue('P2', 'Themes', 'Theme switch failed', 'Click theme buttons', 'Background changes', e.message, null);
  }

  // === P1: MODULE ROUTES ===
  console.log('\n=== P1: Module Routes ===');
  const routes = [
    { hash: '#/edit?artworkId=1', name: 'edit', mod: 'M2-Edit' },
    { hash: '#/craft?artworkId=1', name: 'craft', mod: 'M3-Craft' },
    { hash: '#/curate', name: 'curate', mod: 'M4-Curate' },
    { hash: '#/curate?hallId=1', name: 'curate-hall', mod: 'M4-CurateHall' },
    { hash: '#/tutor', name: 'tutor', mod: 'M5-Tutor' },
    { hash: '#/partner', name: 'partner', mod: 'M6-Partner' },
  ];
  for (const route of routes) {
    try {
      const errorsBefore = consoleErrors.length;
      await page.goto(TARGET + route.hash, { waitUntil: 'networkidle2', timeout: 20000 });
      await wait(3000);
      await screenshot(page, `p1-${route.name}`);
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 300));
      console.log(`  ${route.name}: ${bodyText.substring(0, 80)}`);
      if (bodyText.length < 50) {
        addIssue('P1', route.mod, `${route.name} page empty`, `Navigate to ${route.hash}`, 'Page content visible', 'Page appears empty', `p1-${route.name}`);
      }
      const newErrors = consoleErrors.slice(errorsBefore);
      if (newErrors.length > 0) {
        addIssue('P1', route.mod, `${route.name} has console errors`, `Navigate to ${route.hash}`, 'No console errors', `${newErrors.length} errors`, `p1-${route.name}`);
      }
    } catch (e) {
      addIssue('P1', route.mod, `${route.name} route failed`, `Navigate to ${route.hash}`, 'Page loads', e.message.substring(0, 150), `p1-${route.name}`);
    }
  }

  // === P1: PARTNER FORM VALIDATION ===
  console.log('\n=== P1: Partner Form ===');
  try {
    await page.goto(TARGET + '#/partner', { waitUntil: 'networkidle2' });
    await wait(2000);
    const btns = await page.$$('button');
    for (const btn of btns) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('提交') || text.includes('申请') || text.includes('submit') || text.includes('Send')) {
        await btn.click();
        await wait(1500);
        await screenshot(page, 'p1-partner-validation');
        break;
      }
    }
  } catch (e) {
    addIssue('P2', 'Partner', 'Partner form test failed', 'Submit empty form', 'Validation errors', e.message, 'p1-partner');
  }

  // === P2: RESPONSIVE ===
  console.log('\n=== P2: Responsive ===');
  try {
    await page.setViewport({ width: 375, height: 667 });
    await page.goto(TARGET, { waitUntil: 'networkidle2' });
    await wait(2000);
    await screenshot(page, 'p2-mobile-home');
    await page.goto(TARGET + '#/admin', { waitUntil: 'networkidle2' });
    await wait(1500);
    await screenshot(page, 'p2-mobile-admin');
    await page.setViewport({ width: 1440, height: 900 });
  } catch (e) {
    addIssue('P2', 'Responsive', 'Mobile layout issue', 'Set viewport 375x667', 'Responsive layout', e.message, 'p2-mobile-home');
  }

  // === P2: EMPTY STATES ===
  console.log('\n=== P2: Empty States ===');
  try {
    await page.goto(TARGET, { waitUntil: 'networkidle2' });
    await wait(1000);
    const searchInput = await page.$('input[type="search"], input[placeholder*="搜索"], input[class*="search"]');
    if (searchInput) {
      await searchInput.click();
      await searchInput.type('zzzznonexistent12345');
      await page.keyboard.press('Enter');
      await wait(2000);
      await screenshot(page, 'p2-search-empty');
    }
    await page.goto(TARGET + '#/profile', { waitUntil: 'networkidle2' });
    await wait(2000);
    await screenshot(page, 'p2-profile-empty');
  } catch (e) {
    addIssue('P2', 'EmptyState', 'Empty state test failed', 'Search nonexistent term', 'Empty state message', e.message, null);
  }

  // === P3: RESOURCE CLEANUP ===
  console.log('\n=== P3: Resource Cleanup ===');
  try {
    await page.goto(TARGET + '#/edit?artworkId=1', { waitUntil: 'networkidle2' });
    await wait(3000);
    const canvasEdit = await page.evaluate(() => document.querySelectorAll('canvas').length);
    console.log(`Edit canvases: ${canvasEdit}`);
    await screenshot(page, 'p3-edit-before');
    await page.goto(TARGET + '#/gallery', { waitUntil: 'networkidle2' });
    await wait(2000);
    const canvasGallery1 = await page.evaluate(() => document.querySelectorAll('canvas').length);
    console.log(`Gallery canvases (after edit): ${canvasGallery1}`);
    await page.goto(TARGET + '#/craft?artworkId=1', { waitUntil: 'networkidle2' });
    await wait(2000);
    await page.goto(TARGET + '#/gallery', { waitUntil: 'networkidle2' });
    await wait(2000);
    const canvasGallery2 = await page.evaluate(() => document.querySelectorAll('canvas').length);
    await page.goto(TARGET + '#/curate', { waitUntil: 'networkidle2' });
    await wait(2000);
    await page.goto(TARGET + '#/gallery', { waitUntil: 'networkidle2' });
    await wait(2000);
    const canvasGallery3 = await page.evaluate(() => document.querySelectorAll('canvas').length);
    console.log(`Gallery canvases (final): ${canvasGallery3}`);
    await screenshot(page, 'p3-gallery-after-curate');
  } catch (e) {
    addIssue('P2', 'Cleanup', 'Resource cleanup test failed', 'Navigate between routes', 'Clean transition', e.message, null);
  }

  // === WRITE REPORT ===
  const report = {
    timestamp: new Date().toISOString(),
    target: TARGET,
    summary: {
      totalIssues: issues.length,
      p0: issues.filter(i => i.severity === 'P0').length,
      p1: issues.filter(i => i.severity === 'P1').length,
      p2: issues.filter(i => i.severity === 'P2').length,
    },
    consoleErrors: [...new Set(consoleErrors.map(e => e.text))].slice(0, 30),
    networkErrors: networkErrors.slice(0, 20),
    issues: issues
  };
  fs.writeFileSync(`${OUT}\\qa-report.json`, JSON.stringify(report, null, 2));
  console.log('\n=== REPORT SAVED ===');
  console.log(`Issues: ${issues.length} (P0:${report.summary.p0} P1:${report.summary.p1} P2:${report.summary.p2})`);
  console.log(`Console errors: ${consoleErrors.length}, Network errors: ${networkErrors.length}`);
  console.log(`Report: ${OUT}\\qa-report.json`);

  await browser.close();
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
