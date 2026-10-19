import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage();
await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);

const probe = await page.evaluate(() => {
  const bigDataURL = (() => {
    const c = document.createElement("canvas");
    c.width = 1000; c.height = 1000;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ff4444"; ctx.fillRect(0, 0, 1000, 1000);
    return c.toDataURL("image/png");
  })();

  // 场景1: 纯 span.avatar-circle（无 img 子元素）
  const s1 = document.createElement("span");
  s1.className = "avatar-circle";
  s1.textContent = "X";

  // 场景2: span.avatar-circle > img.avatar-circle.avatar-img（auth.js 实际输出）
  const s2 = document.createElement("span");
  s2.className = "avatar-circle";
  const img2 = document.createElement("img");
  img2.className = "avatar-circle avatar-img";
  img2.width = 30; img2.height = 30;
  img2.src = bigDataURL;
  s2.appendChild(img2);

  // 场景3: span.avatar-circle > img.avatar-img（不带 avatar-circle 类）
  const s3 = document.createElement("span");
  s3.className = "avatar-circle";
  const img3 = document.createElement("img");
  img3.className = "avatar-img";
  img3.width = 30; img3.height = 30;
  img3.src = bigDataURL;
  s3.appendChild(img3);

  const wrap = document.createElement("div");
  wrap.style.position = "fixed"; wrap.style.left = "-9999px"; wrap.id = "probe";
  wrap.appendChild(s1); wrap.appendChild(s2); wrap.appendChild(s3);
  document.body.appendChild(wrap);

  const measure = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName, cls: el.className,
      w: Math.round(r.width), h: Math.round(r.height),
      csW: cs.width, csH: cs.height,
      csDisplay: cs.display, csPos: cs.position, csFloat: cs.float,
      csFlexG: cs.flexGrow, csFlexS: cs.flexShrink, csFlexB: cs.flexBasis,
      csMinW: cs.minWidth, csMinH: cs.minHeight,
      csMaxW: cs.maxWidth, csMaxH: cs.maxHeight,
    };
  };

  // 也列出页面里所有匹配 .avatar-circle 和 img.avatar-img 的 CSS 规则
  const rules = [];
  for (const ss of document.styleSheets) {
    try {
      for (const r of ss.cssRules) {
        const sel = r.selectorText || "";
        if (sel.includes("avatar-circle") || sel.includes("avatar-img")) {
          rules.push({ sel, css: r.cssText.slice(0, 250) });
        }
      }
    } catch {}
  }

  return {
    s1_span_only: measure(s1),
    s2_span_with_both: measure(s2),
    s2_img_inside: measure(img2),
    s3_span_with_single: measure(s3),
    s3_img_inside: measure(img3),
    rules,
  };
});

console.log("=== 场景诊断 ===\n");
for (const [k, v] of Object.entries(probe)) {
  if (k === "rules") continue;
  console.log(`--- ${k} ---`);
  console.log(`  元素: ${v.tag}.${v.cls}`);
  console.log(`  实际尺寸: ${v.w}x${v.h}  (期望 30x30)`);
  console.log(`  computed W/H: ${v.csW} x ${v.csH}`);
  console.log(`  display=${v.csDisplay} pos=${v.csPos} flex=${v.csFlexG}/${v.csFlexS}/${v.csFlexB}`);
  console.log(`  min=${v.csMinW}/${v.csMinH} max=${v.csMaxW}/${v.csMaxH}`);
  console.log();
}

console.log(`=== 相关 CSS 规则（共 ${probe.rules.length} 条）===\n`);
for (const r of probe.rules) {
  console.log(`  选择器: ${r.sel}`);
  console.log(`  ${r.css}`);
  console.log();
}

await browser.close();
