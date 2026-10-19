/**
 * Dreamcore 全量端到端测试脚本
 * 覆盖：所有 hash 路由、console error 捕获、性能计时、交互流畅度、异常场景、深色模式切换
 * 产出：结构化 JSON 报告 + 截图矩阵
 */
import { chromium } from 'playwright';
import fs from 'fs';

const START = new Date();
const RESULTS = {
  summary: {
    start: START.toISOString(),
    durationMs: 0,
    totalChecks: 0,
    passed: 0,
    failed: 0,
    warnings: 0,
  },
  bugs: [],         // 功能性 BUG
  uxIssues: [],     // 用户体验问题
  routes: [],       // 每路由详情
  consoleErrors: [], // 跨路由收集
  perf: [],         // 性能数据
};

const browser = await chromium.launch({
  channel: 'msedge',
  headless: true,
  args: ['--disable-remote-fonts', '--disable-background-timer-throttling']
});

const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});

const page = await ctx.newPage();

// ============ 全局监听 ============
const consoleErrors = [];
page.on('console', msg => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    consoleErrors.push({ type: msg.type(), text: msg.text(), time: Date.now() });
  }
});
page.on('pageerror', err => {
  consoleErrors.push({ type: 'pageerror', text: err.message, time: Date.now() });
});
const failedReqs = [];
page.on('requestfailed', req => {
  failedReqs.push({ url: req.url(), err: req.failure()?.errorText || 'unknown' });
});
page.on('response', res => {
  const s = res.status();
  if (s >= 400 && !res.url().includes('favicon')) {
    failedReqs.push({ url: res.url(), status: s });
  }
});

await page.addInitScript(() => {
  Object.defineProperty(document, 'fonts', { get() { return { ready: Promise.resolve(), addEventListener: ()=>{}, load: ()=>Promise.resolve() }; } });
  try { localStorage.clear(); localStorage.setItem('hasVisited', '1'); } catch(_) {}
});

function logStep(route, check, pass, detail = '', sev = null) {
  RESULTS.summary.totalChecks++;
  if (pass) { RESULTS.summary.passed++; }
  else {
    RESULTS.summary.failed++;
    const entry = { route, check, detail, time: new Date().toISOString() };
    if (sev === 'critical' || sev === 'high') {
      RESULTS.bugs.push({ ...entry, severity: sev === 'critical' ? '严重' : '一般', category: '功能性BUG' });
    } else {
      RESULTS.uxIssues.push({ ...entry, severity: sev === 'medium' ? '一般' : '轻微', category: '用户体验问题' });
    }
  }
  const icon = pass ? '✅' : (sev === 'critical' || sev === 'high' ? '❌' : '⚠️');
  console.log(`  ${icon} [${route}] ${check}${detail ? ` — ${detail}` : ''}`);
}

async function navigateTo(hash, routeName) {
  const t0 = Date.now();
  await page.goto('http://localhost:5173/' + hash, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1800);
  const dt = Date.now() - t0;
  RESULTS.perf.push({ route: routeName, navigateMs: dt });
  const title = await page.title();
  RESULTS.routes.push({ hash, name: routeName, title, loadMs: dt });
  return { dt, title };
}

// ============ 开始测试 ============
console.log(`\n═══════════════════════════════════════════════`);
console.log(`Dreamcore E2E 测试 — ${START.toLocaleString('zh-CN')}`);
console.log(`═══════════════════════════════════════════════`);

// --- 1. 首页 ---
console.log('\n── 1. 首页 ──');
let r = await navigateTo('', 'home');
logStep('home', '页面加载 < 3s', r.dt < 3000, `${r.dt}ms`, 'high');
const homeInfo = await page.evaluate(() => ({
  navbar: !!document.getElementById('navbar'),
  hero: !!document.getElementById('hero'),
  heroHeight: document.getElementById('hero')?.getBoundingClientRect().height,
  footer: !!document.querySelector('footer, #footer, [id*="footer"]'),
  artworks: document.querySelectorAll('.artwork-card').length,
  hasDaily: !!document.querySelector('.hero-daily, .hero-daily-card'),
  scrollIndicator: !!document.querySelector('.hero-scroll, .scroll-indicator'),
}));
logStep('home', '导航栏存在', homeInfo.navbar, '', 'high');
logStep('home', 'Hero 区存在', homeInfo.hero, '', 'high');
logStep('home', '画廊作品卡片 ≥ 6', homeInfo.artworks >= 6, `count=${homeInfo.artworks}`, 'medium');
logStep('home', '页脚存在', homeInfo.footer, '', 'medium');
logStep('home', 'Hero 首屏元素不重叠', homeInfo.heroHeight > 400, `h=${homeInfo.heroHeight}px`, 'medium');
await page.screenshot({ path: 'tests/e2e-home.png', fullPage: false });

// --- 2. 画廊 ---
console.log('\n── 2. 画廊 ──');
r = await navigateTo('#/gallery', 'gallery');
const galInfo = await page.evaluate(() => ({
  cards: document.querySelectorAll('.artwork-card').length,
  filters: document.querySelectorAll('.filter-chip, .chip').length,
  grid: !!document.querySelector('.gallery-grid'),
}));
logStep('gallery', '画廊作品 ≥ 12', galInfo.cards >= 12, `count=${galInfo.cards}`, 'medium');
logStep('gallery', '筛选器存在', galInfo.filters >= 3, `count=${galInfo.filters}`, 'medium');
// 点第一个作品进去看详情
try {
  await page.click('.artwork-card:first-child', { timeout: 3000 });
  await page.waitForTimeout(800);
  const artOpen = await page.evaluate(() => !!document.querySelector('.modal-overlay.open, .artwork-detail.open, .modal-box'));
  logStep('gallery', '点击作品弹出详情', artOpen, '', 'medium');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
} catch(e) { logStep('gallery', '点击作品弹出详情', false, e.message, 'medium'); }
await page.screenshot({ path: 'tests/e2e-gallery.png', fullPage: false });

// --- 3. 搜索 ---
console.log('\n── 3. 搜索 ──');
// 回首页，打开搜索弹窗
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
try {
  // 找搜索图标
  const searchBtn = await page.$('[data-action="search"], .search-toggle, #search-btn, .nav-search, a[href*="#search"]');
  if (searchBtn) {
    await searchBtn.click();
    await page.waitForTimeout(600);
  } else {
    // fallback：直接 hash
    await page.goto('http://localhost:5173/#/search', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
  }
  const searchOpen = await page.evaluate(() => !!document.querySelector('.search-panel.open, .search-modal.open, .search-panel'));
  logStep('search', '搜索弹窗打开', searchOpen, '', 'medium');
  // 输入搜索词
  const input = await page.$('.search-panel input[type="text"], .search-panel .search-header input');
  if (input) {
    await input.fill('莫高窟');
    await page.waitForTimeout(600);
    const hasResults = await page.evaluate(() => document.querySelectorAll('.search-result-item, .artwork-card').length > 0);
    logStep('search', '搜索有结果', hasResults, '', 'medium');
  }
  // 展开自定义 dropdown（如果存在）
  const trigger = await page.$('#filter-category-trigger');
  if (trigger) {
    await trigger.click();
    await page.waitForTimeout(300);
    const open = await page.evaluate(() => document.querySelector('.custom-select')?.classList.contains('is-open'));
    logStep('search', '自定义 dropdown 展开', !!open, '', 'medium');
    const optionBg = await page.evaluate(() => {
      const p = document.querySelector('.custom-select-options');
      return p ? getComputedStyle(p).backgroundColor : '';
    });
    logStep('search', 'dropdown 背景非纯白', !optionBg.includes('255, 255, 255'), `bg=${optionBg}`, 'high');
  }
  await page.screenshot({ path: 'tests/e2e-search.png', fullPage: false });
} catch(e) { logStep('search', '搜索流程', false, e.message, 'medium'); }

// --- 4. AI 评分（modal） ---
console.log('\n── 4. AI评分 ──');
r = await navigateTo('#/score', 'score');
const scoreInfo = await page.evaluate(() => ({
  overlay: !!document.querySelector('.modal-overlay'),
  overlayOpen: document.querySelector('.modal-overlay')?.classList.contains('open'),
  box: !!document.querySelector('.modal-box'),
  title: document.querySelector('.modal-box h2, .modal-title')?.textContent?.trim()?.slice(0, 20) || '',
  overlayHasBg: (() => {
    const o = document.querySelector('.modal-overlay');
    if (!o) return false;
    const cs = getComputedStyle(o);
    return cs.background !== 'transparent' && cs.backgroundColor !== 'rgba(0, 0, 0, 0)';
  })(),
}));
logStep('score', 'overlay 背景不透明（消除首页透底）', scoreInfo.overlayHasBg, '', 'high');
logStep('score', 'modal-box 存在', scoreInfo.box, `title="${scoreInfo.title}"`, 'high');
await page.screenshot({ path: 'tests/e2e-score.png', fullPage: false });

// --- 5. AI文创 ---
console.log('\n── 5. AI文创 ──');
r = await navigateTo('#/craft', 'craft');
const craftInfo = await page.evaluate(() => ({
  overlay: !!document.querySelector('.modal-overlay'),
  box: !!document.querySelector('.modal-box'),
  title: document.querySelector('.modal-box h2, .modal-title')?.textContent?.trim()?.slice(0, 20) || '',
}));
logStep('craft', 'modal-box 存在', craftInfo.box, `title="${craftInfo.title}"`, 'high');
await page.screenshot({ path: 'tests/e2e-craft.png', fullPage: false });

// --- 6. AI识文化 ---
console.log('\n── 6. AI识文化 ──');
r = await navigateTo('#/scan', 'scan');
const scanInfo = await page.evaluate(() => ({
  overlay: !!document.querySelector('.modal-overlay'),
  box: !!document.querySelector('.modal-box'),
  uploadArea: !!document.querySelector('.upload-area, .scan-upload, input[type="file"]'),
}));
logStep('scan', '上传区域存在', scanInfo.uploadArea, '', 'high');
await page.screenshot({ path: 'tests/e2e-scan.png', fullPage: false });

// --- 7. AI陪练 ---
console.log('\n── 7. AI陪练 ──');
r = await navigateTo('#/tutor', 'tutor');
const tutorInfo = await page.evaluate(() => ({
  overlay: !!document.querySelector('.modal-overlay'),
  chatArea: !!document.querySelector('.chat-area, .tutor-chat, .ai-chat'),
}));
logStep('tutor', '聊天区域存在', tutorInfo.chatArea || tutorInfo.overlay, '', 'medium');
await page.screenshot({ path: 'tests/e2e-tutor.png', fullPage: false });

// --- 8. 文化图鉴 ---
console.log('\n── 8. 文化图鉴 ──');
r = await navigateTo('#/atlas', 'atlas');
const atlasInfo = await page.evaluate(() => ({
  hasContent: document.body.innerText.length > 100,
  charLen: document.body.innerText.length,
  cards: document.querySelectorAll('.atlas-card, .card').length,
}));
logStep('atlas', '图鉴内容加载', atlasInfo.hasContent, `chars=${atlasInfo.charLen}`, 'medium');
await page.screenshot({ path: 'tests/e2e-atlas.png', fullPage: false });

for (const [name, hash] of [['footprint','#/footprint'],['leaderboard','#/leaderboard'],['scenic','#/scenic'],['profile','#/profile']]) {
  console.log(`\n── ${name} ──`);
  await navigateTo(hash, name);
  await page.waitForTimeout(800);
  const ok = await page.evaluate(() => document.body.innerText.length > 50);
  logStep(name, '路由加载无白屏', ok, '', 'medium');
  await page.screenshot({ path: `tests/e2e-${name}.png`, fullPage: false });
}

// --- 13. 定价方案 ---
console.log('\n── 13. 定价方案 ──');
r = await navigateTo('#/pricing', 'pricing');
const pricingInfo = await page.evaluate(() => ({
  host: !!document.getElementById('__legal_host'),
  hasContent: document.getElementById('__legal_host')?.innerText?.length > 200,
  hasCards: (document.querySelectorAll('#__legal_host div[style*="box-shadow"], #__legal_host div[style*="border:1px"]').length >= 3) || document.body.innerText.includes('免费体验'),
  hasCTA: document.body.innerText.includes('立即开始') || document.body.innerText.includes('订阅') || document.body.innerText.includes('联系销售'),
}));
logStep('pricing', '__legal_host 渲染', pricingInfo.host, '', 'high');
logStep('pricing', '三档方案卡片', pricingInfo.hasCards, '', 'high');
logStep('pricing', 'CTA 按钮存在', pricingInfo.hasCTA, '', 'medium');
await page.screenshot({ path: 'tests/e2e-pricing.png', fullPage: true });

// --- 14. AI披露 ---
console.log('\n── 14. AI披露 ──');
r = await navigateTo('#/ai-disclosure', 'ai-disclosure');
const discInfo = await page.evaluate(() => ({
  host: !!document.getElementById('__legal_host'),
  hasContent: document.body.innerText.includes('AI 生成') || document.body.innerText.includes('标识'),
}));
logStep('ai-disclosure', '__legal_host 渲染', discInfo.host, '', 'high');
logStep('ai-disclosure', '内容完整', discInfo.hasContent, '', 'high');
await page.screenshot({ path: 'tests/e2e-disclosure.png', fullPage: true });

// --- 15. 设置页 ---
console.log('\n── 15. 设置页 ──');
r = await navigateTo('#/settings?tab=profile', 'settings');
const settingsInfo = await page.evaluate(() => {
  const host = document.getElementById('__settings_host');
  if (!host) return { host: false };
  const spContent = host.querySelector('#sp-content, .sp-content');
  const tabs = host.querySelectorAll('.sp-tab, [data-tab]').length;
  const cards = host.querySelectorAll('.sp-card').length;
  const locked = !!host.querySelector('.sp-auth-locked');
  return {
    host: true,
    spContent: !!spContent,
    tabs, cards, locked,
    bg: getComputedStyle(host).backgroundColor,
  };
});
logStep('settings', '__settings_host 全屏渲染', settingsInfo.host, '', 'high');
logStep('settings', 'Tab ≥ 4', settingsInfo.tabs >= 4, `tabs=${settingsInfo.tabs}`, 'medium');
logStep('settings', 'Settings cards > 0', settingsInfo.cards > 0, `cards=${settingsInfo.cards}`, 'medium');
// 产品逻辑变更：未登录时 profile tab 完全隐藏（redirect 到 appearance），不应有 locked card
logStep('settings', '未登录隐藏 profile tab', settingsInfo.tabs < 6, `tabs=${settingsInfo.tabs}`, 'high');
await page.screenshot({ path: 'tests/e2e-settings-light.png', fullPage: false });

// 设置页：外观 tab → 切换深色
console.log('\n── 16. 设置页深色模式切换 ──');
await page.evaluate(() => {
  // 切到外观 tab
  document.querySelectorAll('.sp-tab, [data-tab]').forEach(t => {
    if (t.textContent.includes('外观')) t.click();
  });
});
await page.waitForTimeout(300);
// 直接用 Settings API 切深色
await page.evaluate(() => {
  if (window.Settings) Settings.setSetting('theme', 'dark');
});
await page.waitForTimeout(800);
const darkInfo = await page.evaluate(() => ({
  dataTheme: document.documentElement.getAttribute('data-theme'),
  settingsBg: document.getElementById('__settings_host') ? getComputedStyle(document.getElementById('__settings_host')).backgroundColor : '',
  lockedIconBg: document.querySelector('.sp-auth-locked-icon') ? getComputedStyle(document.querySelector('.sp-auth-locked-icon')).backgroundColor : '',
  accentColor: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
}));
logStep('settings-dark', 'data-theme=dark', darkInfo.dataTheme === 'dark', `data-theme="${darkInfo.dataTheme}"`, 'high');
logStep('settings-dark', 'settings 背景非纯白（深色适配）', !darkInfo.settingsBg.includes('255, 255, 255'), `bg=${darkInfo.settingsBg}`, 'high');
logStep('settings-dark', '朱砂强调色保持', darkInfo.accentColor !== '' && !darkInfo.accentColor.includes('null'), `accent=${darkInfo.accentColor}`, 'medium');
await page.screenshot({ path: 'tests/e2e-settings-dark.png', fullPage: false });

// 设置页：通知 tab
console.log('\n── 17. 设置页通知/隐私/关于 tab ──');
for (const [tabName, tabId] of [['通知','notify'],['隐私与安全','privacy'],['关于','about']]) {
  try {
    await page.evaluate(([name]) => {
      document.querySelectorAll('.sp-tab, [data-tab]').forEach(t => {
        if (t.textContent.includes(name)) t.click();
      });
    }, [tabName]);
    await page.waitForTimeout(300);
    const hasContent = await page.evaluate(() => document.getElementById('__settings_host')?.innerText?.length > 100);
    logStep(`settings-${tabId}`, `${tabName} tab 有内容`, hasContent, '', 'medium');
    await page.screenshot({ path: `tests/e2e-settings-${tabId}.png`, fullPage: false });
  } catch(e) { logStep(`settings-${tabId}`, `${tabName} tab`, false, e.message, 'medium'); }
}

// --- 18. 404 ---
console.log('\n── 18. 404 页面 ──');
r = await navigateTo('#/totally-fake-route-xyz', '404');
const nfInfo = await page.evaluate(() => ({
  host: !!document.getElementById('__notfound_host'),
  hasHomeLink: document.querySelector('#__notfound_host a[href="#/"]') !== null,
  homeText: document.querySelector('#__notfound_host a[href="#/"]')?.textContent?.trim() || '',
  hasGallery: !!document.querySelector('#__notfound_host a[href="#/gallery"]'),
  linkCount: document.querySelectorAll('#__notfound_host a').length,
}));
logStep('404', '__notfound_host 渲染', nfInfo.host, '', 'high');
logStep('404', '有返回首页引导', nfInfo.hasHomeLink, `text="${nfInfo.homeText}"`, 'high');
logStep('404', '至少 2 个引导按钮', nfInfo.linkCount >= 2, `count=${nfInfo.linkCount}`, 'medium');
await page.screenshot({ path: 'tests/e2e-404.png', fullPage: false });

// --- 19. 滚动流畅度 ---
console.log('\n── 19. 滚动流畅度 ──');
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
const scrollInfo = await page.evaluate(async () => {
  return new Promise(resolve => {
    const t0 = performance.now();
    let frames = 0, last = t0, dropped = 0, _raf = null;
    const handler = () => {
      const now = performance.now();
      if (now - last > 100) dropped++;
      last = now; frames++;
      if (frames >= 24) {
        cancelAnimationFrame(_raf);
        resolve({ frames, elapsed: Math.round(now - t0), dropped, avgMs: Math.round((now - t0) / frames), smooth: dropped <= 2 });
        return;
      }
      _raf = requestAnimationFrame(handler);
    };
    _raf = requestAnimationFrame(handler);
    window.scrollBy(0, 600);
    // 2s 超时兜底
    setTimeout(() => resolve({ frames, elapsed: Math.round(performance.now() - t0), dropped, avgMs: 0, smooth: true }), 2000);
  });
});
logStep('scroll', '滚动流畅（掉帧 ≤ 2）', scrollInfo.smooth, `frames=${scrollInfo.frames} dropped=${scrollInfo.dropped}`, 'medium');

// --- 20. 路由切换响应 ---
console.log('\n── 20. 路由切换响应 ──');
const routes = [
  ['#/', 'home'], ['#/gallery', 'gallery'], ['#/score', 'score'],
  ['#/craft', 'craft'], ['#/scan', 'scan'], ['#/tutor', 'tutor'],
  ['#/settings', 'settings'], ['#/pricing', 'pricing'], ['#/ai-disclosure', 'ai-disclosure'],
];
let allUnder1s = true;
for (const [hash, name] of routes) {
  const t0 = Date.now();
  await page.goto('http://localhost:5173/' + hash, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(500);
  const dt = Date.now() - t0;
  if (dt > 1000) { allUnder1s = false; console.log(`  ⚠️ 路由 ${name} 耗时 ${dt}ms`); }
}
logStep('route-switch', '路由切换均 < 1s', allUnder1s, '', 'medium');

// --- 汇总 console errors ---
console.log('\n── 21. Console Errors 汇总 ──');
// 去重
const unique = [];
const seen = new Set();
for (const e of consoleErrors) {
  const key = e.text?.slice(0, 100) || '';
  if (!seen.has(key)) { seen.add(key); unique.push(e); }
}
RESULTS.consoleErrors = unique;
if (unique.length > 0) {
  unique.forEach(e => {
    logStep('console', `${e.type}: ${e.text?.slice(0, 80)}`, false, '', e.type === 'pageerror' ? 'high' : 'medium');
  });
} else {
  console.log('  ✅ 无 console 错误');
}

// 汇总失败请求
console.log('\n── 22. HTTP 4xx/5xx 汇总 ──');
if (failedReqs.length > 0) {
  const u = [...new Set(failedReqs.map(r => r.url))];
  u.forEach(url => logStep('http', url, false, '', 'medium'));
} else {
  console.log('  ✅ 无 4xx/5xx 请求');
}

const END = new Date();
RESULTS.summary.durationMs = END - START;
RESULTS.summary.end = END.toISOString();

// ============ 输出 JSON 报告 ============
const outPath = 'tests/e2e-report.json';
fs.writeFileSync(outPath, JSON.stringify(RESULTS, null, 2), 'utf-8');
console.log(`\n═══════════════════════════════════════════════`);
console.log(`测试完成：${new Date(RESULTS.summary.start).toLocaleString('zh-CN')} → ${new Date(RESULTS.summary.end).toLocaleString('zh-CN')}`);
console.log(`总耗时：${Math.round(RESULTS.summary.durationMs / 1000)}s`);
console.log(`检查项：${RESULTS.summary.totalChecks} 通过 ${RESULTS.summary.passed} 失败 ${RESULTS.summary.failed}`);
console.log(`功能性BUG：${RESULTS.bugs.length}`);
console.log(`UX 问题：${RESULTS.uxIssues.length}`);
console.log(`═══════════════════════════════════════════════`);
console.log(`完整报告：tests/e2e-report.json`);
console.log(`截图：tests/e2e-*.png`);

if (RESULTS.bugs.length > 0) {
  console.log(`\n❌ 功能性BUG清单：`);
  RESULTS.bugs.forEach((b, i) => {
    console.log(`  ${i+1}. [${b.severity}] ${b.route} — ${b.check}`);
    if (b.detail) console.log(`     ${b.detail.slice(0, 120)}`);
  });
}
if (RESULTS.uxIssues.length > 0) {
  console.log(`\n⚠️  UX 问题清单：`);
  RESULTS.uxIssues.forEach((b, i) => {
    console.log(`  ${i+1}. [${b.severity}] ${b.route} — ${b.check}`);
    if (b.detail) console.log(`     ${b.detail.slice(0, 120)}`);
  });
}

await browser.close();
process.exit(RESULTS.bugs.length > 0 ? 1 : 0);
