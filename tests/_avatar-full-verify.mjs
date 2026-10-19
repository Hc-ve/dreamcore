import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

// 直接注入：模拟完整的登录头像 DOM（带 200x200 的 dataURL）
const result = await page.evaluate(async () => {
  // 200x200 裁剪后的图（settings.js 迁移产物）
  const c = document.createElement("canvas");
  c.width = 200; c.height = 200;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#2d5a3d"; ctx.fillRect(0, 0, 200, 200);
  ctx.fillStyle = "#fff"; ctx.font = "bold 24px sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("200x200", 100, 100);
  const dataURL200 = c.toDataURL("image/png");

  // 1000x1000 未裁剪的用户原图
  const c2 = document.createElement("canvas");
  c2.width = 1000; c2.height = 1000;
  const ctx2 = c2.getContext("2d");
  ctx2.fillStyle = "#ff4444"; ctx2.fillRect(0, 0, 1000, 1000);
  ctx2.fillStyle = "#fff"; ctx2.font = "bold 80px sans-serif";
  ctx2.textAlign = "center"; ctx2.textBaseline = "middle";
  ctx2.fillText("1000x1000", 500, 500);
  const dataURL1000 = c2.toDataURL("image/png");

  // 模拟 auth.js L131 的实际输出（带内联 width/height）
  const navBtn = document.createElement("button");
  navBtn.id = "test-user-avatar-btn";
  navBtn.className = "user-avatar-btn";
  navBtn.innerHTML = `<img src="${dataURL200}" class="avatar-circle avatar-img" width="30" height="30" alt="头像">`;

  // 下拉大头像
  const ddHeader = document.createElement("div");
  ddHeader.className = "dropdown-header";
  const bigBtn = document.createElement("div");
  bigBtn.className = "user-avatar-btn lg";
  bigBtn.innerHTML = `<img src="${dataURL200}" class="avatar-circle lg avatar-img" width="44" height="44" alt="头像">`;

  // 对比：没带内联属性的老写法（上一轮 commit 之前的状态）
  const oldBtn = document.createElement("button");
  oldBtn.className = "user-avatar-btn";
  oldBtn.innerHTML = `<img src="${dataURL200}" class="avatar-circle avatar-img" alt="头像">`;

  // 对比：1000x1000 大图 + 有内联属性
  const bigImgBtn = document.createElement("button");
  bigImgBtn.className = "user-avatar-btn";
  bigImgBtn.innerHTML = `<img src="${dataURL1000}" class="avatar-circle avatar-img" width="30" height="30" alt="头像">`;

  // 对比：1000x1000 + 无内联属性（最坏情况）
  const bigImgOldBtn = document.createElement("button");
  bigImgOldBtn.className = "user-avatar-btn";
  bigImgOldBtn.innerHTML = `<img src="${dataURL1000}" class="avatar-circle avatar-img" alt="头像">`;

  const wrap = document.createElement("div");
  wrap.style.position = "fixed"; wrap.style.left = "-9999px"; wrap.style.top = "0";
  wrap.id = "avatar-test-wrap";
  wrap.appendChild(navBtn);
  wrap.appendChild(ddHeader); ddHeader.appendChild(bigBtn); wrap.appendChild(ddHeader);
  wrap.appendChild(oldBtn);
  wrap.appendChild(bigImgBtn);
  wrap.appendChild(bigImgOldBtn);
  document.body.appendChild(wrap);

  await new Promise(r => setTimeout(r, 300));

  const measureImg = (btn, label) => {
    const img = btn.querySelector("img");
    const r = img.getBoundingClientRect();
    const btnR = btn.getBoundingClientRect();
    const cs = getComputedStyle(img);
    const btnCS = getComputedStyle(btn);
    return {
      label,
      imgActual: { w: Math.round(r.width), h: Math.round(r.height) },
      btnActual: { w: Math.round(btnR.width), h: Math.round(btnR.height) },
      imgCS: { width: cs.width, height: cs.height, display: cs.display, maxW: cs.maxWidth, minW: cs.minWidth },
      btnCS: { width: btnCS.width, height: btnCS.height, overflow: btnCS.overflow },
      inline: { w: img.getAttribute("width"), h: img.getAttribute("height") },
    };
  };

  return [
    measureImg(navBtn, "① 200x200图 + 内联30x30 → 导航栏小头像"),
    measureImg(bigBtn, "② 200x200图 + 内联44x44 → 下拉大头像"),
    measureImg(oldBtn, "③ 200x200图 + 无内联属性（老写法）"),
    measureImg(bigImgBtn, "④ 1000x1000图 + 内联30x30 → 极端大图"),
    measureImg(bigImgOldBtn, "⑤ 1000x1000图 + 无内联属性（最坏情况）"),
  ];
});

console.log("=== 头像尺寸端到端验证 ===\n");
let allOk = true;
for (const v of result) {
  const expected = v.label.includes("44") ? 44 : 30;
  const ok = Math.abs(v.imgActual.w - expected) <= 5 && Math.abs(v.imgActual.h - expected) <= 5;
  if (!ok) allOk = false;
  console.log(`${ok ? "✅" : "❌"} ${v.label}`);
  console.log(`   img渲染: ${v.imgActual.w}x${v.imgActual.h} (期望 ${expected}x${expected})`);
  console.log(`   btn渲染: ${v.btnActual.w}x${v.btnActual.h}`);
  console.log(`   btn CSS: ${v.btnCS.width}x${v.btnCS.height} overflow=${v.btnCS.overflow}`);
  console.log(`   img CSS: width=${v.imgCS.width} display=${v.imgCS.display} maxW=${v.imgCS.maxW} minW=${v.imgCS.minW}`);
  console.log(`   inline: ${v.inline.w}x${v.inline.h}`);
  console.log();
}

console.log(allOk ? "🎉 全部通过!" : "⚠️ 还有场景未覆盖");
await browser.close();
