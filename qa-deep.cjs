const puppeteer = require('C:\\Users\\86159\\.local\\lib\\node_modules\\puppeteer-core');
const fs = require('fs');
const OUT = 'C:\\Users\\86159\\AppData\\Roaming\\TRAE SOLO CN\\ModularData\\ai-agent\\work-mode-projects\\6a578b50553ee2fa56364236\\qa-output';
const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  const consoleMsgs = [];
  page.on('console', msg => consoleMsgs.push(`${msg.type()}: ${msg.text().substring(0, 200)}`));
  page.on('pageerror', err => consoleMsgs.push(`PAGEERROR: ${err.message.substring(0, 200)}`));

  // === DEEP 1: Login flow ===
  console.log('\n=== DEEP: Login ===');
  await page.goto('http://localhost:5173/#/login', { waitUntil: 'networkidle2' });
  await wait(2000);
  const loginHTML = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input')).map(i => ({ type: i.type, placeholder: i.placeholder, name: i.name, id: i.id }));
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim().substring(0, 30));
    const forms = document.querySelectorAll('form').length;
    const bodyText = document.body.innerText.substring(0, 500);
    return { inputs, buttons, forms, bodyText };
  });
  console.log('Login page:', JSON.stringify(loginHTML, null, 2));

  // Try filling and submitting
  const inputs = await page.$$('input');
  console.log(`Found ${inputs.length} inputs`);
  if (inputs.length >= 2) {
    // Fill first text-like and first password
    for (const inp of inputs) {
      const type = await page.evaluate(el => el.type, inp);
      if (type === 'text' || type === 'email' || type === '') {
        await inp.click({ clickCount: 3 }); await inp.type('admin');
      } else if (type === 'password') {
        await inp.click({ clickCount: 3 }); await inp.type('admin123');
      }
    }
    await wait(500);
    // Click login button
    const btns = await page.$$('button');
    for (const btn of btns) {
      const text = await page.evaluate(el => el.textContent.trim(), btn);
      console.log(`  Button: "${text}"`);
      if (text.includes('登录') || text.toLowerCase().includes('login') || text.includes('Sign')) {
        await btn.click();
        console.log('  Clicked login button');
        break;
      }
    }
    await wait(3000);
    const afterLogin = await page.evaluate(() => ({
      url: location.href,
      bodyText: document.body.innerText.substring(0, 500),
      hasError: document.body.innerText.includes('错误') || document.body.innerText.includes('失败') || document.body.innerText.includes('error') || document.body.innerText.includes('失败'),
      hasToast: !!document.querySelector('[class*="toast"], [class*="message"], [class*="alert"]')
    }));
    console.log('After login:', JSON.stringify(afterLogin, null, 2));
    const errs = consoleMsgs.slice(-10);
    console.log('Console msgs:', JSON.stringify(errs, null, 2));
  }

  // === DEEP 2: Admin page ===
  console.log('\n=== DEEP: Admin ===');
  consoleMsgs.length = 0;
  await page.goto('http://localhost:5173/#/admin', { waitUntil: 'networkidle2' });
  await wait(3000);
  const adminInfo = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('[class*="tab"], [role="tab"], [data-tab], .tab-item')).map(t => t.textContent.trim().substring(0, 30));
    const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent.trim().substring(0, 50));
    const bodyText = document.body.innerText.substring(0, 800);
    const tables = document.querySelectorAll('table').length;
    const forms = document.querySelectorAll('form').length;
    return { tabs, headings, bodyText, tables, forms };
  });
  console.log('Admin page:', JSON.stringify(adminInfo, null, 2));
  const adminErrs = consoleMsgs.slice();
  console.log('Admin console:', JSON.stringify(adminErrs.slice(0, 10), null, 2));

  // === DEEP 3: Module route content ===
  console.log('\n=== DEEP: Route content ===');
  const routes = ['#/edit?artworkId=1', '#/craft?artworkId=1', '#/curate', '#/tutor', '#/partner'];
  for (const route of routes) {
    consoleMsgs.length = 0;
    await page.goto('http://localhost:5173/' + route, { waitUntil: 'networkidle2' });
    await wait(2000);
    const info = await page.evaluate(() => {
      const main = document.querySelector('main, [class*="main"], [role="main"], #app > div > div');
      const mainText = main ? main.innerText.substring(0, 300) : 'no main found';
      const headings = Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent.trim().substring(0, 40));
      const buttons = Array.from(document.querySelectorAll('button')).length;
      const canvases = document.querySelectorAll('canvas').length;
      const forms = document.querySelectorAll('form').length;
      return { mainText, headings, buttons, canvases, forms };
    });
    const routeName = route.split('#')[1].split('?')[0];
    console.log(`${routeName}: ${JSON.stringify(info)}`);
    if (consoleMsgs.length > 0) console.log(`  Console: ${JSON.stringify(consoleMsgs.slice(0, 3))}`);
  }

  // === DEEP 4: Partner form validation ===
  console.log('\n=== DEEP: Partner form ===');
  await page.goto('http://localhost:5173/#/partner', { waitUntil: 'networkidle2' });
  await wait(2000);
  const partnerInfo = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim().substring(0, 30));
    const inputs = Array.from(document.querySelectorAll('input, textarea, select')).map(i => ({ tag: i.tagName, type: i.type, placeholder: i.placeholder, name: i.name }));
    const labels = Array.from(document.querySelectorAll('label')).map(l => l.textContent.trim().substring(0, 30));
    return { buttons, inputs, labels };
  });
  console.log('Partner page:', JSON.stringify(partnerInfo, null, 2));

  // === DEEP 5: Tutor AI ===
  console.log('\n=== DEEP: Tutor ===');
  await page.goto('http://localhost:5173/#/tutor', { waitUntil: 'networkidle2' });
  await wait(2000);
  const tutorInfo = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim().substring(0, 40));
    const bodyText = document.body.innerText.substring(0, 500);
    return { buttons, bodyText };
  });
  console.log('Tutor page:', JSON.stringify(tutorInfo, null, 2));

  await browser.close();
}
run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
