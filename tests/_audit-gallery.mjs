import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });

// 拦截 artworks 图片请求 → 返回 404（真实图片丢失）
let blockedCount = 0;
await ctx.route('**/images/artworks/**', async route => {
  blockedCount++;
  await route.fulfill({ status: 404, contentType: 'image/jpeg' });
});

const page = await ctx.newPage();
page.setDefaultNavigationTimeout(15000);
await page.goto('http://localhost:5173/#/gallery', { waitUntil: 'domcontentloaded' });

// 慢慢滚动触发 IntersectionObserver 加载所有画廊图
for (let i = 0; i < 10; i++) {
  await page.evaluate(() => window.scrollBy(0, window.innerHeight));
  await page.waitForTimeout(400);
}
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(1000);

// 给 onerror 处理留时间
await page.waitForTimeout(3500);

const report = await page.evaluate(() => {
  const imgs = document.querySelectorAll('#gallery-grid img, .gallery-grid img, .gallery-card img, .gallery-item img');
  const data = [];
  let withSrc = 0, phData = 0, phFallbackSvg = 0, brokenNaturalZero = 0, stillLoading = 0;
  let dataSrcFallback = 0;
  for (const img of imgs) {
    const r = img.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    withSrc++;
    const src = img.getAttribute('src') || '';
    const ds = img.dataset.src || '';
    const isDataSvg = src.startsWith('data:image/svg');
    const isLocalFallback = src.startsWith('/images/fallback/');
    const naturalBad = img.naturalWidth === 0 && img.complete;
    const loading = !img.complete;
    const hasDataSrcFallback = !!ds && ds !== src;
    if (isDataSvg) phData++;
    if (isLocalFallback) phFallbackSvg++;
    if (naturalBad) brokenNaturalZero++;
    if (loading) stillLoading++;
    if (hasDataSrcFallback) dataSrcFallback++;
    data.push({ src: src.slice(0, 100), ds: ds.slice(0, 100), nw: img.naturalWidth, complete: img.complete });
  }
  return { total: withSrc, phData, phFallbackSvg, dataSrcFallback, brokenNaturalZero, stillLoading, sample: data };
});
console.log('断网画廊白卡率审计 (scroll + fulfill 404):');
console.log(`  ctx.route 拦截次数: ${blockedCount}`);
console.log(`  可见 <img> 总数: ${report.total}`);
console.log(`  落到 data: SVG 占位: ${report.phData}`);
console.log(`  落到 /images/fallback/*.svg: ${report.phFallbackSvg}`);
console.log(`  src 与 data-src 不同（有 fallback 逻辑）: ${report.dataSrcFallback}`);
console.log(`  naturalWidth===0 complete=true (真失败·白卡): ${report.brokenNaturalZero}`);
console.log(`  仍在加载中: ${report.stillLoading}`);
console.log(`  白卡率 = ${report.total > 0 ? (report.brokenNaturalZero / report.total * 100).toFixed(1) : 'N/A'}%`);
for (const s of report.sample) console.log(`    sample: src=${s.src} ds=${s.ds} nw=${s.nw} complete=${s.complete}`);

await page.screenshot({ path: 'docs/ui-audit/gallery-offline.png', fullPage: true });
await ctx.close();
await browser.close();
console.log('DONE gallery audit');
