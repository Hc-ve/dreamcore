const puppeteer = require('C:\\Users\\86159\\.local\\lib\\node_modules\\puppeteer-core');
const wait = (ms) => new Promise(r => setTimeout(r, ms));

async function run() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  // ==================== Task 1: P0-1 hash is not defined ====================
  console.log('=== TASK 1: P0-1 hash is not defined ===');
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    const consoleMsgs = [];
    const pageErrors = [];
    page.on('console', msg => consoleMsgs.push(`${msg.type()}: ${msg.text()}`));
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto('http://localhost:5173/#/edit?artworkId=1', { waitUntil: 'networkidle2' });
    await wait(3000);

    const hashError = consoleMsgs.find(m => m.includes('hash is not defined')) ||
                      pageErrors.find(m => m.includes('hash is not defined'));
    console.log('hashErrorFound:', !!hashError);
    console.log('hashErrorMsg:', hashError || 'NONE');
    console.log('allPageErrors:', JSON.stringify(pageErrors));
    console.log('consoleMsgCount:', consoleMsgs.length);
    if (consoleMsgs.length > 0) console.log('consoleSample:', JSON.stringify(consoleMsgs.slice(0, 5)));
    await page.close();
  }

  // ==================== Task 2: P0-2 DOM 累积 ====================
  console.log('\n=== TASK 2: P0-2 DOM 累积 ===');
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    const routes = [
      'http://localhost:5173/#/edit?artworkId=1',
      'http://localhost:5173/#/craft?artworkId=1',
      'http://localhost:5173/#/curate',
      'http://localhost:5173/#/tutor',
      'http://localhost:5173/#/partner'
    ];
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'networkidle2' });
      await wait(2000);
      console.log('visited:', route);
    }

    const result = await page.evaluate(() => {
      return {
        h2Count: document.querySelectorAll('h2').length,
        h2Texts: Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim()).slice(0, 15),
        editWorkbenchExists: !!document.querySelector('#ai-edit-workbench'),
        craftWorkbenchExists: !!document.querySelector('.craft-workbench'),
        curatePageExists: !!document.querySelector('.curate-page'),
        tutorPageExists: !!document.querySelector('.tutor-page') || !!document.querySelector('#ai-tutor-page'),
        partnerPageExists: !!document.querySelector('.partner-page') || !!document.querySelector('#ai-partner-page')
      };
    });
    console.log('domResult:', JSON.stringify(result, null, 2));
    await page.close();
  }

  // ==================== Task 3: P0-3 登录验证 ====================
  console.log('\n=== TASK 3: P0-3 登录验证 ===');
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    const consoleMsgs = [];
    page.on('console', msg => consoleMsgs.push(`${msg.type()}: ${msg.text().substring(0, 150)}`));
    page.on('pageerror', err => consoleMsgs.push(`PAGEERROR: ${err.message.substring(0, 150)}`));

    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    await wait(3000);

    const welcomeState = await page.evaluate(() => {
      return {
        welcomeModalExists: !!document.querySelector('.welcome-modal'),
        welcomeH2: document.querySelector('.welcome-modal h2')?.textContent,
        authModalExists: !!document.querySelector('.auth-modal'),
        authPasswordExists: !!document.querySelector('#auth-password')
      };
    });
    console.log('welcomeState:', JSON.stringify(welcomeState, null, 2));

    // 点击 #welcome-enter 关闭 welcome
    const welcomeEnter = await page.$('#welcome-enter');
    if (welcomeEnter) {
      await welcomeEnter.click();
      console.log('clicked #welcome-enter');
      await wait(500);
    } else {
      console.log('NOT FOUND #welcome-enter');
      const btns = await page.$$('.welcome-modal button');
      for (const btn of btns) {
        const txt = await page.evaluate(el => el.textContent.trim(), btn);
        console.log('  welcome btn:', txt);
      }
    }

    // 点击 navbar 登录按钮
    let loginBtn = await page.$('#btn-login');
    if (!loginBtn) loginBtn = await page.$('#footer-login');
    if (!loginBtn) {
      const ghosts = await page.$$('.btn-ghost');
      for (const g of ghosts) {
        const txt = await page.evaluate(el => el.textContent.trim(), g);
        console.log('  ghost btn:', txt);
        if (txt.includes('登录') || txt.toLowerCase().includes('login')) {
          loginBtn = g;
          break;
        }
      }
    }
    if (loginBtn) {
      await loginBtn.click();
      console.log('clicked login btn');
    } else {
      console.log('NOT FOUND login btn, dumping buttons:');
      const allBtns = await page.$$('button');
      for (const b of allBtns) {
        const t = await page.evaluate(el => el.textContent.trim().substring(0, 30), b);
        const id = await page.evaluate(el => el.id, b);
        console.log(`  button id="${id}" text="${t}"`);
      }
    }
    await wait(1000);

    const authState = await page.evaluate(() => {
      return {
        authModalExists: !!document.querySelector('.auth-modal'),
        authModalOpen: !!document.querySelector('.auth-modal.open'),
        authFormExists: !!document.querySelector('#auth-form'),
        authUsernameExists: !!document.querySelector('#auth-username'),
        authPasswordExists: !!document.querySelector('#auth-password'),
        authHintText: document.querySelector('.auth-hint')?.textContent
      };
    });
    console.log('authState:', JSON.stringify(authState, null, 2));
    console.log('consoleErrors:', JSON.stringify(consoleMsgs.filter(m => m.includes('error') || m.includes('PAGEERROR')).slice(0, 5)));
    await page.close();
  }

  await browser.close();
  console.log('\n=== ALL DONE ===');
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
