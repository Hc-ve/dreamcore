/** 测试报告 5 bug 验证 */
import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-remote-fonts'] });
let passed = 0, failed = 0;
function c(n, req, ok, d = '') { if (ok) { passed++; console.log(`  ✅ [BUG-${n}] ${req}`); } else { failed++; console.log(`  ❌ [BUG-${n}] ${req} — ${d}`); } }

async function ctx() {
  const g = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await g.newPage();
  await p.addInitScript(() => {
    Object.defineProperty(document, 'fonts', { get() { return { ready: Promise.resolve(), load: ()=>Promise.resolve(), addEventListener: ()=>{} }; } });
    try { localStorage.clear(); localStorage.setItem('hasVisited', '1'); } catch(_) {}
  });
  return { g, p };
}

// BUG-001: pricing
console.log('\n=== BUG-001 会员权益 ===');
let { g, p } = await ctx();
await p.goto('http://localhost:5173/#/pricing', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
await p.screenshot({ path: 'tests/fix-pricing.png', fullPage: true });
let info = await p.evaluate(() => {
  const host = document.getElementById('__legal_host');
  const notfound = document.getElementById('__notfound_host');
  return {
    hostExists: !!host,
    notfoundExists: !!notfound,
    hasCards: host?.querySelectorAll('div[style*="box-shadow"], div[style*="border:1px"]').length >= 3 || host?.textContent?.includes('免费体验'),
    body: host?.textContent?.slice(0, 60) || '',
    h: host ? Math.round(host.getBoundingClientRect().height) : 0,
    title: document.title,
  };
});
c('001a', '#/pricing 有 __legal_host', info.hostExists, JSON.stringify(info));
c('001b', '非 404', !info.notfoundExists, '');
c('001c', '显示定价方案卡片', info.hasCards, info.body);
c('001d', '页面高度足够', info.h > 600, `h=${info.h}`);
c('001e', 'title 正确包含定价/会员', info.title?.includes('定价') || info.title?.includes('会员'), info.title);
await g.close();

// BUG-002: ai-disclosure
console.log('\n=== BUG-002 AI内容说明 ===');
({ g, p } = await (async () => { const r = await ctx(); return r; })());
await p.goto('http://localhost:5173/#/ai-disclosure', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
await p.screenshot({ path: 'tests/fix-disclosure.png', fullPage: true });
info = await p.evaluate(() => {
  const host = document.getElementById('__legal_host');
  return {
    hostExists: !!host,
    hasContent: host?.textContent?.includes('AI 生成') || host?.textContent?.includes('标识'),
    h: host ? Math.round(host.getBoundingClientRect().height) : 0,
    title: document.title,
  };
});
c('002a', '#/ai-disclosure 有 __legal_host', info.hostExists, JSON.stringify(info));
c('002b', '有 AI 标识相关内容', info.hasContent, '');
c('002c', 'title 正确', info.title?.includes('AI 生成') || info.title?.includes('披露'), info.title);
await g.close();

// BUG-003+004: privacy.html / terms.html 静态页面可访问
console.log('\n=== BUG-003+004 隐私政策/用户协议 ===');
const responses = await Promise.all(['privacy.html', 'terms.html'].map(async file => {
  const r = await fetch('http://localhost:5173/' + file).then(x => ({ ok: x.ok, status: x.status, textSample: x.text().then(t => t.slice(0, 80)) })).catch(e => ({ ok: false, err: e.message }));
  return { file, ...r };
}));
responses.forEach(r => {
  c(r.file === 'privacy.html' ? '003' : '004', `${r.file} HTTP 200`, r.ok && r.status === 200, r.err || `status=${r.status}`);
});

// BUG-005: 404 有返回首页按钮
console.log('\n=== BUG-005 404 页引导 ===');
({ g, p } = await (async () => { const r = await ctx(); return r; })());
await p.goto('http://localhost:5173/#/definitely-not-real-route-abcxyz', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(1500);
await p.screenshot({ path: 'tests/fix-404.png', fullPage: true });
info = await p.evaluate(() => {
  const nf = document.getElementById('__notfound_host');
  if (!nf) return { nfExists: false };
  const links = Array.from(nf.querySelectorAll('a')).map(a => ({ text: a.textContent?.trim(), href: a.getAttribute('href') }));
  return {
    nfExists: true,
    hasBackHome: links.some(l => l.href === '#/' && l.text.includes('首页')),
    hasBackGallery: links.some(l => l.href === '#/gallery'),
    linkCount: links.length,
    accentColorOK: getComputedStyle(nf.querySelector('a[href="#/"]'))?.backgroundColor?.includes('168, 38'),
    links,
  };
});
c('005a', '404 host 渲染', info.nfExists, '');
c('005b', '有"返回首页"按钮', info.hasBackHome, JSON.stringify(info.links));
c('005c', '有额外引导（画廊/AI识文化）', info.hasBackGallery && info.linkCount >= 3, `links=${info.linkCount}`);
await g.close();

await browser.close();
console.log(`测试报告修复验证: ${passed} passed, ${failed} failed`);
console.log(`============================================`);
process.exit(f > 0 ? 1 : 0);


