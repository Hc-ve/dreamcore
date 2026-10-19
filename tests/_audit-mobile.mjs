import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  disableHTTPCache: true,
});
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(15000);
await page.goto('http://localhost:5173/?v=' + Date.now(), { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const report = await page.evaluate(() => {
  const sel = 'button, .btn, .btn-primary, .btn-ghost, .ai-icon-btn, .filter-chip, .chip, .nav-links a, .lb-tab, .footer-nav a, .search-btn, .hero-cta .btn-primary, .hero-cta .btn-ghost, .modal-close, .drawer-close, .sc-close, .welcome-close, .ca-close, .lb-close';
  const all = document.querySelectorAll(sel);
  const visible = [];
  const hidden = [];
  for (const el of all) {
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const h = r.height, w = r.width;
    const isHidden = style.display === 'none' || style.visibility === 'hidden' || h === 0 || w === 0;
    const entry = {
      tag: el.tagName,
      cls: (el.className || '').toString().slice(0, 50),
      h: Math.round(h), w: Math.round(w),
      text: (el.textContent || '').trim().slice(0, 20),
      reason: isHidden ? (style.display === 'none' ? 'display:none' : style.visibility === 'hidden' ? 'visibility:hidden' : 'zero-size') : null,
    };
    if (isHidden) hidden.push(entry);
    else visible.push(entry);
  }
  const belowVisible = visible.filter(e => e.h < 44 || e.w < 44);
  return {
    total: all.length,
    hiddenCount: hidden.length,
    visibleCount: visible.length,
    belowVisibleCount: belowVisible.length,
    belowVisible,
    hidden: hidden.slice(0, 20),
  };
});
console.log('MOBILE 390px 视口审计 (仅可见元素):');
console.log(`  候选总数: ${report.total}`);
console.log(`  隐藏元素（豁免）: ${report.hiddenCount}`);
console.log(`  可见元素: ${report.visibleCount}`);
console.log(`  可见 <44px 按钮数: ${report.belowVisibleCount}  ← 验收目标 0`);
for (const b of report.belowVisible) console.log(`    <44px: ${b.tag}.${b.cls} h=${b.h} w=${b.w} "${b.text}"`);
console.log(`\n  隐藏元素明细 (前20):`);
for (const b of report.hidden) console.log(`    HIDDEN [${b.reason}]: ${b.tag}.${b.cls} h=${b.h} w=${b.w} "${b.text}"`);

await page.screenshot({ path: 'docs/ui-audit/mobile-390.png', fullPage: true });
await ctx.close();
await browser.close();
console.log('DONE mobile audit');
