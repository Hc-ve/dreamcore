import fs from "fs";
let s = fs.readFileSync("js/auth.js", "utf8");

// L131: 导航栏头像 img — 加 width=30 height=30
const old1 = `<img src="${'$'}{av.dataURL}" class="avatar-circle avatar-img" alt="头像">`;
const nw1  = `<img src="${'$'}{av.dataURL}" class="avatar-circle avatar-img" width="30" height="30" alt="头像">`;

if (s.includes(old1)) {
  s = s.replace(old1, nw1);
  console.log("✅ auth.js: nav avatar img added width=30 height=30");
} else {
  // 尝试定位
  const i = s.indexOf(`class="avatar-circle avatar-img" alt="头像"`);
  if (i > 0) {
    const fullMatch = s.slice(i - 60, i + 50);
    console.log("找到片段:", JSON.stringify(fullMatch));
    // 手动 patch：找到那个 img 标签
    const imgStart = s.lastIndexOf("<img", i);
    const imgEnd = s.indexOf(">", i) + 1;
    const oldImg = s.slice(imgStart, imgEnd);
    const newImg = oldImg.replace('class="avatar-circle avatar-img"', 'class="avatar-circle avatar-img" width="30" height="30"');
    s = s.replace(oldImg, newImg);
    console.log("✅ auth.js: nav avatar img patched (fallback)");
  } else {
    console.log("❌ nav avatar img not found");
  }
}

// L151: 下拉菜单头像 — 通过 replace 复用 nav avatar 的 HTML
// 原始代码: avatarHtml.replace('avatar-btn', 'avatar-btn lg').replace('class="avatar-circle', 'class="avatar-circle lg')
// 加一个 replace 把 width=30 height=30 换成 width=44 height=44
const old2 = `.replace('avatar-btn', 'avatar-btn lg').replace('class="avatar-circle', 'class="avatar-circle lg')`;
const nw2  = `.replace('avatar-btn', 'avatar-btn lg').replace('class="avatar-circle', 'class="avatar-circle lg').replace('width="30" height="30"', 'width="44" height="44"')`;

if (s.includes(old2)) {
  s = s.replace(old2, nw2);
  console.log("✅ auth.js: dropdown avatar img width/height 30->44");
} else {
  console.log("⚠️ dropdown replace block not found — 可能不需要改（inline attr 会被 CSS 覆盖，CSS 已经写对了）");
}

fs.writeFileSync("js/auth.js", s);
console.log("\nauth.js 保存完成");
