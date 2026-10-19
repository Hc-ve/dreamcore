// 三重暴力修复自定义头像巨大 BUG
// 第 1 层：源头 — Canvas 强制缩到 100x100
// 第 2 层：渲染 — img 加内联 width/height 属性
// 第 3 层：CSS — max-width/max-height 硬约束兜底
import fs from "fs";

// ========== 1. settings.js: _ensureSquareAvatar 永远缩 100x100 ==========
let s = fs.readFileSync("js/settings.js", "utf8");

// 1a. 去掉 fast path（对已是 200x200 的跳过重绘），改为永远重绘到 100x100
const oldFast = `      if (img.naturalWidth === img.naturalHeight && img.naturalWidth === 200) {
        resolve(dataURL); // 已经是 200x200，直接返回
        return;
      }`;
const newFast = `      // 永远重绘到 100x100，不管原尺寸多大 —— 彻底消除 intrinsic size 撑爆
      // if (img.naturalWidth === img.naturalHeight && img.naturalWidth === 200) { resolve(dataURL); return; }`;
if (s.includes(oldFast)) {
  s = s.replace(oldFast, newFast);
  console.log("✅ 1a _ensureSquareAvatar: fast path removed");
} else {
  console.log("⚠️ 1a fast path block not found, skip");
}

// 1b. canvas 尺寸从 200→100
const oldCanvas = `      c.width = 200; c.height = 200;
      const ctx = c.getContext('2d');
      const size = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - size) / 2;
      const sy = (img.naturalHeight - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);`;
const newCanvas = `      const T = 100; c.width = T; c.height = T;
      const ctx = c.getContext('2d');
      const size = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - size) / 2;
      const sy = (img.naturalHeight - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, T, T);`;
if (s.includes(oldCanvas)) {
  s = s.replace(oldCanvas, newCanvas);
  console.log("✅ 1b canvas: 200x200 → 100x100");
} else {
  console.log("⚠️ 1b canvas block not found, skip");
}

// 1c. 迁移标记升级，让已迁过的老用户也触发一次（因为之前 fast path 跳过了）
s = s.replace(/dreamcore-avatar-migrated-v2/g, "dreamcore-avatar-migrated-v3");
console.log("✅ 1c 迁移标记 v2 → v3");

fs.writeFileSync("js/settings.js", s);

// ========== 2. auth.js: img 加内联 width/height ==========
let a = fs.readFileSync("js/auth.js", "utf8");

// 2a. 导航栏小头像 img
const oldNavImg = `<img src="${'$'}{av.dataURL}" class="avatar-circle avatar-img" alt="头像">`;
const newNavImg = `<img src="${'$'}{av.dataURL}" class="avatar-circle avatar-img" width="30" height="30" alt="头像">`;
if (a.includes(oldNavImg)) {
  a = a.replace(oldNavImg, newNavImg);
  console.log("✅ 2a nav img: width=30 height=30");
} else {
  // fallback: 直接找字符串
  const i = a.indexOf("class=\"avatar-circle avatar-img\" alt=\"头像\"");
  if (i > 0) {
    a = a.slice(0, i) + "class=\"avatar-circle avatar-img\" width=\"30\" height=\"30\" alt=\"头像\"" + a.slice(i + 50);
    console.log("✅ 2a nav img patched (fallback)");
  } else {
    console.log("⚠️ 2a nav img not found");
  }
}

// 2b. 下拉菜单大头像 — 通过 replace 链复用，追加 width/height 30→44
const oldReplace = `.replace('avatar-btn', 'avatar-btn lg').replace('class="avatar-circle', 'class="avatar-circle lg')`;
const newReplace = oldReplace + `.replace('width="30" height="30"', 'width="44" height="44"')`;
if (a.includes(oldReplace)) {
  a = a.replace(oldReplace, newReplace);
  console.log("✅ 2b dropdown replace chain: width/height 30→44");
} else {
  console.log("⚠️ 2b replace chain not found, skip");
}

fs.writeFileSync("js/auth.js", a);

// ========== 3. settings.css: max 兜底 ==========
let css = fs.readFileSync("css/settings.css", "utf8");

// 3a. 导航栏 avatar-img（原规则）
const oldCss = `.user-avatar-btn .avatar-img {
  /* 不用 width:100% —— 父 user-avatar-btn 无显式尺寸，100% 解析为 0px
     尺寸由 .avatar-circle 原生 class（30x30 / lg 44x44）控制 */
  object-fit: cover;
  border-radius: 50%;
  display: block;
}`;
const newCss = `/* 自定义头像 img 三重约束：max-width/max-height 硬兜底 + width/height 填充 + min-width:0 消 flex intrinsic */
.user-avatar-btn .avatar-img {
  max-width: 100%;
  max-height: 100%;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex: 0 0 100%;
  object-fit: cover;
  border-radius: 50%;
  display: block;
  overflow: hidden;
}`;
if (css.includes(oldCss)) {
  css = css.replace(oldCss, newCss);
  console.log("✅ 3a settings.css nav avatar-img: max-width/max-height 硬兜底");
} else {
  // CRLF 兼容尝试
  const oldCss2 = oldCss.replace(/\n/g, "\r\n");
  if (css.includes(oldCss2)) {
    css = css.replace(oldCss2, newCss.replace(/\n/g, "\r\n"));
    console.log("✅ 3a settings.css patched (CRLF)");
  } else {
    console.log("⚠️ 3a CSS block not found, skip");
  }
}

// 3b. lg 变体也补 max
css = css.replace(
  `.avatar-circle.lg.avatar-img { object-fit: cover; border-radius: 50%; display: block; }`,
  `.avatar-circle.lg.avatar-img { max-width:100%; max-height:100%; width:100%; height:100%; object-fit: cover; border-radius: 50%; display: block; }`
);
console.log("✅ 3b settings.css lg variant: max added");

fs.writeFileSync("css/settings.css", css);

// ========== 4. cache buster ==========
let h = fs.readFileSync("index.html", "utf8");
const oldHref = `/css/settings.css?v=2`;
const newHref = `/css/settings.css?v=3`;
const times = (h.match(/settings\.css\?v=2/g) || []).length;
h = h.replace(/settings\.css\?v=2/g, "settings.css?v=3");
fs.writeFileSync("index.html", h);
console.log(`✅ 4 cache buster: ${times}处 v=2 → v=3`);

console.log("\n========== 全部修复完成 ==========");
