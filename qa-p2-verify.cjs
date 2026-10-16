// P2 修复 + 端到端回归验证
// 用法: node qa-p2-verify.cjs
const puppeteer = require('C:\\Users\\86159\\.local\\lib\\node_modules\\puppeteer-core');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const BASE = 'http://localhost:5173/';

async function run() {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const report = {
    B1_main: null,
    B2_modules: {},
    B3_dashboard: null,
    B4_particles: null
  };

  // ============================================================
  // B1: 主流程验证
  // ============================================================
  console.log('\n=== B1: 主流程验证 ===');
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    const consoleMsgs = [];
    const pageErrors = [];
    page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await wait(3000);

    const audioWarnings = consoleMsgs.filter(m =>
      m.text.includes('AudioContext was not allowed to start') ||
      m.text.includes('AudioContext was not allowed')
    );
    const errorCount = consoleMsgs.filter(m => m.type === 'error').length + pageErrors.length;

    const skeletonCount = await page.evaluate(() => document.querySelectorAll('.skeleton-card').length);
    const artworkCount = await page.evaluate(() => document.querySelectorAll('.artwork-card').length);
    const galleryCount = await page.evaluate(() => document.getElementById('gallery-count')?.textContent);

    // 点击第一个作品卡片 → 灯箱
    let lightboxOpened = false;
    const firstCard = await page.$('.artwork-card');
    if (firstCard) {
      await firstCard.click();
      await wait(1200);
      lightboxOpened = await page.evaluate(() =>
        !!document.querySelector('.lightbox.open, .lightbox-modal.open, #lightbox.open, .lightbox-overlay.open, .lightbox[aria-hidden="false"]')
        || (document.querySelector('.lightbox') && getComputedStyle(document.querySelector('.lightbox')).display !== 'none')
      );
      // ESC 关灯箱
      if (lightboxOpened) {
        await page.keyboard.press('Escape');
        await wait(600);
      }
    }

    // 切到移动端 375x667
    await page.setViewport({ width: 375, height: 667 });
    await wait(500);
    const mobileMenu = await page.evaluate(() => {
      const mt = document.getElementById('menu-toggle');
      // offsetParent 为 null 表示隐藏；非 null 表示可见
      return {
        exists: !!mt,
        visible: mt ? mt.offsetParent !== null : false,
        // fallback: 检查计算样式
        display: mt ? getComputedStyle(mt).display : 'none'
      };
    });

    // 检查次要按钮是否被收纳
    const secondaryHidden = await page.evaluate(() => {
      const r = (id) => {
        const el = document.getElementById(id);
        if (!el) return { exists: false, display: 'unknown' };
        const cs = getComputedStyle(el);
        return { exists: true, display: cs.display };
      };
      return {
        btn_search: r('btn-search'),
        sound_toggle: r('sound-toggle'),
        theme_toggle: r('theme-toggle'),
        btn_publish: r('btn-publish'),
        nav_user_area: r('nav-user-area')
      };
    });

    report.B1_main = {
      consoleErrors: errorCount,
      audioWarnings: audioWarnings.length,
      skeletonShown: skeletonCount >= 6 || artworkCount > 0, // 加载中或已加载完成
      artworkCount,
      galleryCountText: galleryCount,
      lightboxOpened,
      mobileMenuVisible: mobileMenu.visible || mobileMenu.display === 'flex',
      secondaryButtons: secondaryHidden
    };
    console.log('B1 result:', JSON.stringify(report.B1_main, null, 2));
    if (audioWarnings.length > 0) console.log('  audio warning sample:', audioWarnings[0].text.substring(0, 120));
    if (pageErrors.length > 0) console.log('  pageerror sample:', pageErrors[0].substring(0, 120));
    await page.close();
  }

  // ============================================================
  // B2: 7 个 M 模块路由全验证
  // ============================================================
  console.log('\n=== B2: 7 个 M 模块路由全验证 ===');
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    const consoleMsgs = [];
    page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => consoleMsgs.push({ type: 'pageerror', text: err.message }));

    // 先到首页关闭 welcome modal
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await wait(2000);
    const welcomeEnter = await page.$('#welcome-enter');
    if (welcomeEnter) { await welcomeEnter.click(); await wait(400); }

    const routes = [
      { name: 'M1 AI Edit',   hash: '#/edit?artworkId=1',   selector: '#ai-edit-workbench' },
      { name: 'M2 AI Craft',  hash: '#/craft?artworkId=1',  selector: '.craft-workbench' },
      { name: 'M3 AI Curate', hash: '#/curate',             selector: '.curate-page' },
      { name: 'M4 AI Tutor',  hash: '#/tutor',              selector: '.tutor-page, #ai-tutor-page' },
      { name: 'M5 AI Partner',hash: '#/partner',            selector: '.partner-page, #ai-partner-page' }
    ];

    for (const r of routes) {
      await page.goto(BASE + r.hash, { waitUntil: 'networkidle2' });
      await wait(2000);
      const exists = await page.evaluate(sel => !!document.querySelector(sel), r.selector);
      const errors = consoleMsgs.filter(m => m.type === 'error' || m.type === 'pageerror').length;
      report.B2_modules[r.name] = { route: r.hash, mounted: exists, errors };
      console.log(`  ${r.name}: mounted=${exists}, errors=${errors}`);
      consoleMsgs.length = 0;
    }

    // M6 Admin: 未登录应跳登录 modal
    await page.goto(BASE + '#/admin', { waitUntil: 'networkidle2' });
    await wait(2000);
    // welcome 可能再弹出
    const we2 = await page.$('#welcome-enter');
    if (we2) { await we2.click(); await wait(400); }
    const adminLoginModal = await page.evaluate(() => {
      const am = document.querySelector('.auth-modal');
      return { authModalExists: !!am, authModalOpen: !!(am && (am.classList.contains('open') || getComputedStyle(am).display !== 'none')) };
    });
    report.B2_modules['M6 Admin (未登录跳登录)'] = adminLoginModal;
    console.log('  M6 Admin (未登录跳登录):', JSON.stringify(adminLoginModal));

    // M7 灯箱内点 "AI Editing" 按钮 → 应跳 #/edit?artworkId=1
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await wait(2000);
    const we3 = await page.$('#welcome-enter');
    if (we3) { await we3.click(); await wait(400); }
    const firstCard = await page.$('.artwork-card');
    let m7EditJump = false;
    if (firstCard) {
      await firstCard.click();
      await wait(1500);
      // 找灯箱内 AI Editing 按钮
      const editBtn = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('.lightbox button, .lightbox-modal button, [class*="lightbox"] button'));
        return buttons.find(b => /AI\s*Editing|AI\s*编辑|AI编辑|Editing/i.test(b.textContent)) || null;
      });
      if (editBtn) {
        try {
          await editBtn.click();
          await wait(1500);
          const hash = await page.evaluate(() => location.hash);
          m7EditJump = hash.includes('edit') && hash.includes('artworkId');
        } catch(e) { /* 元素可能不存在 */ }
      }
    }
    report.B2_modules['M7 灯箱→AI Editing 跳转'] = { jumpedToEdit: m7EditJump };
    console.log('  M7 灯箱→AI Editing 跳转:', m7EditJump);
    await page.close();
  }

  // ============================================================
  // B3: 数据看板验证（先登录 admin/admin123）
  // ============================================================
  console.log('\n=== B3: 数据看板验证 ===');
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await wait(2000);

    // 关闭 welcome
    const we = await page.$('#welcome-enter');
    if (we) { await we.click(); await wait(400); }

    // 打开登录 modal
    const loginBtn = await page.$('#btn-login') || await page.$('#footer-login');
    if (loginBtn) { await loginBtn.click(); await wait(800); }
    else {
      // 尝试点击 nav-user-area 内的登录按钮
      const nu = await page.$('#nav-user-area button');
      if (nu) { await nu.click(); await wait(800); }
    }

    // 填表单 admin/admin123
    const userInput = await page.$('#auth-username');
    const passInput = await page.$('#auth-password');
    if (userInput && passInput) {
      await userInput.click({ clickCount: 3 });
      await userInput.type('admin');
      await passInput.click({ clickCount: 3 });
      await passInput.type('admin123');
      // 提交
      const submitBtn = await page.$('#auth-form button[type="submit"]') ||
                        await page.evaluateHandle(() => {
                          const btns = Array.from(document.querySelectorAll('.auth-modal button'));
                          return btns.find(b => /登录|登 录|Login|登入/i.test(b.textContent)) || null;
                        });
      if (submitBtn) {
        await submitBtn.click();
        await wait(1500);
      }
    }

    // 访问 #/admin
    await page.goto(BASE + '#/admin', { waitUntil: 'networkidle2' });
    await wait(2000);

    // 点「数据看板」Tab
    const dashboardTab = await page.evaluateHandle(() => {
      const tabs = Array.from(document.querySelectorAll('button, .tab, [role="tab"]'));
      return tabs.find(t => /数据看板|Dashboard|看板/i.test(t.textContent)) || null;
    });
    if (dashboardTab) {
      try { await dashboardTab.click(); await wait(2000); } catch(e) {}
    }

    const dashState = await page.evaluate(() => ({
      canvasCount: document.querySelectorAll('.chart-canvas').length,
      kpiCount: document.querySelectorAll('.kpi-card').length,
      aiTagExists: !!document.querySelector('.dashboard-ai-tag')
    }));
    report.B3_dashboard = dashState;
    console.log('  B3 result:', JSON.stringify(dashState));
    await page.close();
  }

  // ============================================================
  // B4: 粒子主题切换验证
  // ============================================================
  console.log('\n=== B4: 粒子主题切换验证 ===');
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto(BASE, { waitUntil: 'networkidle2' });
    await wait(3000);

    const we = await page.$('#welcome-enter');
    if (we) { await we.click(); await wait(400); }

    // 找主题切换器
    const switcherInfo = await page.evaluate(() => {
      const switcher = document.querySelector('.particle-theme-switcher') ||
                       document.querySelector('[class*="theme-switcher"]');
      const chips = Array.from(document.querySelectorAll('.theme-chip, [class*="theme-chip"]'));
      return {
        switcherExists: !!switcher,
        chipCount: chips.length,
        firstActive: chips[0]?.classList.contains('active') ? 0 : -1,
        activeIndex: chips.findIndex(c => c.classList.contains('active'))
      };
    });

    let switched = false;
    if (switcherInfo.chipCount >= 2) {
      // 点第 2 个 theme-chip
      const clicked = await page.evaluate(() => {
        const chips = Array.from(document.querySelectorAll('.theme-chip, [class*="theme-chip"]'));
        if (chips.length >= 2) { chips[1].click(); return true; }
        return false;
      });
      if (clicked) {
        await wait(1000);
        const after = await page.evaluate(() => {
          const chips = Array.from(document.querySelectorAll('.theme-chip, [class*="theme-chip"]'));
          return {
            activeIndex: chips.findIndex(c => c.classList.contains('active')),
            firstActive: chips[0]?.classList.contains('active')
          };
        });
        switched = after.activeIndex === 1;
      }
    }

    report.B4_particles = {
      switcherExists: switcherInfo.switcherExists,
      chipCount: switcherInfo.chipCount,
      initialActiveIndex: switcherInfo.activeIndex,
      switchedToSecond: switched
    };
    console.log('  B4 result:', JSON.stringify(report.B4_particles));
    await page.close();
  }

  await browser.close();
  console.log('\n=== ALL DONE ===');
  console.log('\n===== FINAL REPORT =====');
  console.log(JSON.stringify(report, null, 2));
}

run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
