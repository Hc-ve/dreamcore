import { chromium } from "playwright";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

// 1. 登录态 + 自定义头像（正确 key！）
await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);

await page.evaluate(() => {
  localStorage.setItem("currentUser", JSON.stringify({
    username: "admin", email: "admin@dreamcore.art", isAdmin: true, id: "u1"
  }));
  const c = document.createElement("canvas");
  c.width = 1000; c.height = 1000;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 1000);
  g.addColorStop(0, "#2d5a3d"); g.addColorStop(1, "#88c9a1");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1000, 1000);
  ctx.fillStyle = "#fff"; ctx.font = "bold 120px serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("TREE BRIDGE", 500, 500);
  localStorage.setItem("dreamcore-avatar-migrated-v3", "done");
  localStorage.setItem("dreamcore-avatar", JSON.stringify({ type: "custom", dataURL: c.toDataURL("image/png") }));
});

// 2. reload → Auth.checkAuthState() 从 currentUser 恢复
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(4000);

// 3. 等导航栏按钮
const navBtn = page.locator("#user-avatar-btn");
try {
  await navBtn.waitFor({ state: "visible", timeout: 8000 });
} catch (e) {
  // 手动触发
  await page.evaluate(() => window.Auth?.updateNavForUser());
  await page.waitForTimeout(800);
}

await navBtn.click();
await page.waitForTimeout(300);

const r = await page.evaluate(() => {
  const info = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { actual: { w: Math.round(r.width), h: Math.round(r.height) }, css: { w: cs.width, h: cs.height, overflow: cs.overflow }, cls: el.className };
  };
  return {
    navBtn: info(document.querySelector("#user-avatar-btn")),
    navImg: info(document.querySelector("#user-avatar-btn img")),
    ddOpen: document.querySelector("#user-dropdown")?.classList.contains("open"),
    ddBigBtn: info(document.querySelector("#user-dropdown .dropdown-header .user-avatar-btn.lg")),
    ddBigImg: info(document.querySelector("#user-dropdown .dropdown-header .user-avatar-btn.lg img")),
  };
});

console.log("=== 场景1: 自定义上传头像（1000×1000）===\n");
console.log("导航栏 button:", r.navBtn);
console.log("导航栏 img:", r.navImg);
console.log("下拉 .user-avatar-btn.lg:", r.ddBigBtn);
console.log("下拉 img:", r.ddBigImg);

const n1 = r.navImg && Math.abs(r.navImg.actual.w - 30) <= 5;
const d1 = r.ddBigImg && Math.abs(r.ddBigImg.actual.w - 44) <= 5;
console.log(`\n导航栏 30×30: ${n1 ? "✅" : "❌"}   下拉 44×44: ${d1 ? "✅" : "❌"}`);

// 4. 切系统 SVG 头像 → updateNavForUser 重新渲染
await page.evaluate(() => {
  localStorage.setItem("dreamcore-avatar", JSON.stringify({ type: "system", id: "avatar-1" }));
  window.Auth?.updateNavForUser();
});
await page.waitForTimeout(500);
await page.locator("#user-avatar-btn").click();
await page.waitForTimeout(300);

const r2 = await page.evaluate(() => {
  const info = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { actual: { w: Math.round(r.width), h: Math.round(r.height) }, cls: el.className };
  };
  return {
    navCircle: info(document.querySelector("#user-avatar-btn .avatar-circle")),
    ddBigBtn: info(document.querySelector("#user-dropdown .dropdown-header .user-avatar-btn.lg")),
    ddBigCircle: info(document.querySelector("#user-dropdown .dropdown-header .user-avatar-btn.lg .avatar-circle")),
  };
});

console.log("\n=== 场景2: 系统预设 SVG 头像 ===\n");
console.log("导航栏 span:", r2.navCircle);
console.log("下拉 div.lg:", r2.ddBigBtn);
console.log("下拉 span.lg:", r2.ddBigCircle);

const n2 = r2.navCircle && Math.abs(r2.navCircle.actual.w - 30) <= 5;
const d2 = r2.ddBigCircle && Math.abs(r2.ddBigCircle.actual.w - 44) <= 5;
console.log(`\n导航栏 30×30: ${n2 ? "✅" : "❌"}   下拉 44×44: ${d2 ? "✅" : "❌"}`);

console.log(`\n========== ${(n1 && d1 && n2 && d2) ? "🎉 全部通过" : "❌ 仍有问题"} ==========`);
await browser.close();
