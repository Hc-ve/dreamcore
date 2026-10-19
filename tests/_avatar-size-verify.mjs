import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

const result = await page.evaluate(() => {
  // 注入 1000x1000 大图 dataURL（模拟未裁剪的用户上传图）
  const bigDataURL = (() => {
    const c = document.createElement("canvas");
    c.width = 1000; c.height = 1000;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ff4444"; ctx.fillRect(0, 0, 1000, 1000);
    ctx.fillStyle = "#fff"; ctx.font = "bold 80px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("BIG", 500, 500);
    return c.toDataURL("image/png");
  })();

  // 模拟 auth.js 的实际 DOM 输出（带内联 width/height）
  const markup = `
    <div id="avatar-probe" style="position:fixed;left:-9999px;top:0">
      <div class="user-menu">
        <button class="user-avatar-btn">
          <img src="${bigDataURL}" class="avatar-circle avatar-img" width="30" height="30" alt="">
        </button>
      </div>
      <div class="user-dropdown">
        <div class="dropdown-header">
          <div class="user-avatar-btn lg">
            <img src="${bigDataURL}" class="avatar-circle lg avatar-img" width="44" height="44" alt="">
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML("beforeend", markup);

  // 也模拟 settings.js 迁移后的 100x100 小图
  const smallDataURL = (() => {
    const c = document.createElement("canvas");
    c.width = 100; c.height = 100;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#44ff44"; ctx.fillRect(0, 0, 100, 100);
    ctx.fillStyle = "#000"; ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("100x100", 50, 50);
    return c.toDataURL("image/png");
  })();
  document.body.insertAdjacentHTML("beforeend", `
    <div id="small-avatar-probe" style="position:fixed;left:-9999px;top:-9999px">
      <div class="user-menu">
        <button class="user-avatar-btn">
          <img src="${smallDataURL}" class="avatar-circle avatar-img" width="30" height="30" alt="">
        </button>
      </div>
    </div>
  `);

  // 等图片加载完再量
  return new Promise(resolve => {
    setTimeout(() => {
      const measure = (selector, expected, label) => {
        const img = document.querySelector(selector);
        if (!img) return { label, found: false };
        const r = img.getBoundingClientRect();
        const cs = getComputedStyle(img);
        const circle = img.closest(".avatar-circle");
        const cr = circle ? circle.getBoundingClientRect() : null;
        const ok = Math.abs(r.width - expected) <= 5 && Math.abs(r.height - expected) <= 5;
        return {
          label, found: true,
          expected,
          actualW: Math.round(r.width), actualH: Math.round(r.height),
          circleW: cr ? Math.round(cr.width) : null,
          circleH: cr ? Math.round(cr.height) : null,
          csWidth: cs.width, csHeight: cs.height,
          csMaxW: cs.maxWidth, csMaxH: cs.maxHeight,
          csMinW: cs.minWidth, csMinH: cs.minHeight,
          csObjectFit: cs.objectFit,
          inlineW: img.getAttribute("width"),
          inlineH: img.getAttribute("height"),
          ok
        };
      };

      resolve({
        bigNav: measure("#avatar-probe img.avatar-circle.avatar-img:not(.lg)", 30, "大图+30x30内联 → 导航栏小头像"),
        bigDropdown: measure("#avatar-probe img.avatar-circle.lg.avatar-img", 44, "大图+44x44内联 → 下拉大头像"),
        smallNav: measure("#small-avatar-probe img.avatar-circle.avatar-img", 30, "100x100图+30x30内联 → 导航栏小头像"),
      });
    }, 600);
  });
});

console.log("=== 头像尺寸专项验证 ===");
console.log();
let allOk = true;
for (const [, v] of Object.entries(result)) {
  if (!v.found) { console.log(`❌ ${v.label}: 元素未找到`); allOk = false; continue; }
  if (v.ok) {
    console.log(`✅ ${v.label}`);
  } else {
    console.log(`❌ ${v.label} — 期望 ${v.expected}×${v.expected}，实际 ${v.actualW}×${v.actualH}`);
    allOk = false;
  }
  console.log(`   computed: width=${v.csWidth} height=${v.csHeight}  maxW=${v.csMaxW} maxH=${v.csMaxH}  minW=${v.csMinW}`);
  console.log(`   inline attr: ${v.inlineW}×${v.inlineH}  circle: ${v.circleW}×${v.circleH}`);
}

console.log(allOk ? "\n🎉 全部通过！头像尺寸约束已生效" : "\n❌ 仍有问题，继续排查");

await browser.close();
