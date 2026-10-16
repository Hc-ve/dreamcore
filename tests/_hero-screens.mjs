// ============================================================
// tests/_hero-screens.mjs — P2-3 Hero 四档视口断行复核
// 运行: node tests/_hero-screens.mjs
// 输出: docs/ui-audit/hero-matrix/hero-{w}.png
// ============================================================
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const OUT = 'docs/ui-audit/hero-matrix';
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const viewports = [
  ['hero-1440', 1440, 900],
  ['hero-1024', 1024, 768],
  ['hero-768',  768,  1024],
  ['hero-390',  390,  844],
];

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const results = [];

for (const [name, w, h] of viewports) {
  try {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(15000);

    const url = 'http://localhost:5173';
    console.log(`▶ ${name} (${w}×${h}) → ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    // Hero 区域定位
    const hero = page.locator('#hero, .hero-section, .hero-title').first();
    const box = await hero.boundingBox();
    const outPath = path.join(OUT, `${name}.png`);

    if (box) {
      const clip = {
        x: Math.max(0, box.x - 20),
        y: Math.max(0, box.y - 20),
        width: Math.min(box.width + 40, w),
        height: Math.min(box.height + 120, h - box.y)
      };
      await page.screenshot({ path: outPath, clip });
    } else {
      await page.screenshot({ path: outPath, fullPage: true });
    }

    // 溢出检测：hero 子元素是否超出 hero 右边界
    const overflowInfo = await page.evaluate(() => {
      const h = document.querySelector('#hero, .hero-section');
      if (!h) return { found: false };
      const hRect = h.getBoundingClientRect();
      const kids = [...h.querySelectorAll('*')];
      const offenders = [];
      for (const el of kids) {
        const r = el.getBoundingClientRect();
        if (r.right > hRect.right + 2 || r.bottom > hRect.bottom + 4) {
          // 只记宽度/高度上超出 2px 以上的
          if ((r.right - hRect.right) > 2) offenders.push({ tag: el.tagName, cls: el.className?.toString?.().slice?.(0,60) || '', overflowX: +(r.right - hRect.right).toFixed(1) });
        }
      }
      return { found: true, heroW: +hRect.width.toFixed(0), viewportW: window.innerWidth, offenders };
    });

    const size = fs.statSync(outPath).size;
    results.push({ name, w, h, file: outPath, sizeKB: Math.round(size/1024), overflow: overflowInfo });
    console.log(`  ✓ ${path.basename(outPath)} (${Math.round(size/1024)}KB)  heroW=${overflowInfo.heroW ?? '?'}  offenders=${overflowInfo.offenders?.length ?? '?'}`);

    await ctx.close();
  } catch (e) {
    console.error(`  ✗ ${name} FAIL: ${e.message}`);
    results.push({ name, w, h, error: e.message });
  }
}

await browser.close();

// 汇总
console.log('\n====== P2-3 Hero 断行复核汇总 ======');
for (const r of results) {
  if (r.error) { console.log(`  ✗ ${r.name}: ${r.error}`); continue; }
  const status = r.overflow.offenders?.length ? '⚠ 有溢出' : '✓ 无溢出';
  console.log(`  ${r.name} (${r.w}×${r.h}) → ${path.basename(r.file)}  ${status}`);
  if (r.overflow.offenders?.length) {
    for (const o of r.overflow.offenders) console.log(`    ↳ ${o.tag}.${o.cls} 右溢出 ${o.overflowX}px`);
  }
}
console.log('====================================\n');
