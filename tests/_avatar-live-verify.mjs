import { chromium } from "playwright";

// 验证：修复后的 live 页面 + 强制触发迁移
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

// 1. 先清迁移标记 + 塞一个 1000x1000 大图的 custom avatar（模拟用户已上传未迁过的脏数据）
await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);

const seed = await page.evaluate(() => {
  // 生成 1000x1000 大图
  const c = document.createElement("canvas");
  c.width = 1000; c.height = 1000;
  const ctx = c.getContext("2d");
  // 画个"大树桥"绿林图（模拟用户上传）
  const g = ctx.createLinearGradient(0, 0, 0, 1000);
  g.addColorStop(0, "#2d5a3d");
  g.addColorStop(1, "#88c9a1");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1000, 1000);
  ctx.fillStyle = "#ffffff"; ctx.font = "bold 100px sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("TREE BRIDGE", 500, 500);
  const bigDataURL = c.toDataURL("image/png");

  // 清旧迁移标记 + 写脏数据 localStorage
  localStorage.removeItem("dreamcore-avatar-migrated-v3");
  localStorage.removeItem("dreamcore-avatar-migrated-v2");
  localStorage.setItem("dreamcore-avatar", JSON.stringify({ type: "custom", dataURL: bigDataURL }));
  
  // 同时写登录态
  localStorage.setItem("dreamcore-user", JSON.stringify({
    username: "admin",
    email: "admin@dreamcore.art",
    isAdmin: true,
    loggedInAt: Date.now()
  }));
  
  return { dataURL: bigDataURL.slice(0, 60) + "...", size: bigDataURL.length };
});

console.log("1. 种子数据写入:", seed.size, "bytes, 已清 v3 标记");

// 2. 刷新页面 → Settings.init() 应该触发迁移
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);

// 3. 检查迁移标记 + 头像尺寸
const result = await page.evaluate(() => {
  const migratedV3 = localStorage.getItem("dreamcore-avatar-migrated-v3");
  const avatarRaw = localStorage.getItem("dreamcore-avatar");
  let avatarObj = null;
  try { avatarObj = JSON.parse(avatarRaw); } catch {}
  
  // 检查 dataURL 里编码的实际尺寸
  const checkSize = (url) => new Promise(resolve => {
    if (!url || typeof url !== "string") { resolve(null); return; }
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  });
  
  return new Promise(async resolve => {
    const dim = avatarObj?.dataURL ? await checkSize(avatarObj.dataURL) : null;
    
    // 找导航栏和下拉的头像 img
    const navImg = document.querySelector("#user-avatar-btn img");
    const navCircle = document.querySelector("#user-avatar-btn .avatar-circle");
    let navR = null, navCS = null, btnCS = null;
    if (navImg) {
      navR = navImg.getBoundingClientRect();
      navCS = getComputedStyle(navImg);
      btnCS = getComputedStyle(document.querySelector("#user-avatar-btn"));
    }
    
    return resolve({
      migratedV3,
      migratedV2: localStorage.getItem("dreamcore-avatar-migrated-v2"),
      avatarType: avatarObj?.type,
      storedDim: dim,
      navImg: navImg ? {
        rect: { w: Math.round(navR.width), h: Math.round(navR.height) },
        cs: { width: navCS.width, height: navCS.height, maxW: navCS.maxWidth, maxH: navCS.maxHeight, display: navCS.display },
        inlineW: navImg.getAttribute("width"),
        inlineH: navImg.getAttribute("height"),
        className: navImg.className,
      } : null,
      navBtn: btnCS ? { width: btnCS.width, height: btnCS.height } : null,
    });
  });
});

console.log("\n2. 迁移检查:");
console.log("   v3 标记:", result.migratedV3 || "❌ 未触发!");
console.log("   v2 标记:", result.migratedV2 || "(无)");
console.log("   存储头像类型:", result.avatarType);
console.log("   存储头像实际尺寸:", result.storedDim?.w + "x" + result.storedDim?.h);

console.log("\n3. 导航栏头像 DOM:");
if (result.navImg) {
  console.log("   img.className:", result.navImg.className);
  console.log("   img 内联属性:", `width="${result.navImg.inlineW}" height="${result.navImg.inlineH}"`);
  console.log("   img 实际渲染:", result.navImg.rect.w + "x" + result.navImg.rect.h);
  console.log("   img computed:", `width=${result.navImg.cs.width} height=${result.navImg.cs.height} display=${result.navImg.cs.display}`);
  console.log("   img computed:", `maxW=${result.navImg.cs.maxW} maxH=${result.navImg.cs.maxH}`);
  console.log("   button computed:", result.navBtn);
  
  const ok = Math.abs(result.navImg.rect.w - 30) <= 5 && Math.abs(result.navImg.rect.h - 30) <= 5;
  console.log("\n" + (ok ? "✅ 头像尺寸正常 30x30" : "❌ 头像尺寸异常!"));
} else {
  console.log("   img 未找到（可能未登录态？）");
}

await browser.close();
