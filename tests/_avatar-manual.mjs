import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);

// 模拟用户已登录：直接写 localStorage，然后手动跑 Auth 全链路
await page.evaluate(async () => {
  localStorage.setItem("currentUser", JSON.stringify({
    username: "admin", email: "admin@dreamcore.art", isAdmin: true
  }));
  localStorage.setItem("dreamcore-avatar-migrated-v3", "done");
  const c = document.createElement("canvas");
  c.width = 1000; c.height = 1000;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#2d5a3d"; ctx.fillRect(0, 0, 1000, 1000);
  ctx.fillStyle = "#fff"; ctx.font = "bold 120px serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("TREE BRIDGE", 500, 500);
  localStorage.setItem("dreamcore-avatar", JSON.stringify({ type: "custom", dataURL: c.toDataURL("image/png") }));

  // 手动走 Auth 全链路
  console.log("before checkAuthState, Auth exists:", !!window.Auth);
  const u = await window.Auth.checkAuthState();
  console.log("checkAuthState 返回:", u?.username, "currentUser:", window.Auth.getCurrentUser()?.username);
  window.Auth.updateNavForUser();
  console.log("after updateNavForUser, user-avatar-btn exists:", !!document.getElementById("user-avatar-btn"));
});

await page.waitForTimeout(500);

const info = await page.evaluate(() => {
  const navBtn = document.getElementById("user-avatar-btn");
  const area = document.getElementById("nav-user-area");
  const navImg = document.querySelector("#user-avatar-btn img");
  return {
    navBtnExists: !!navBtn,
    areaHTML: area?.innerHTML?.slice(0, 300),
    navImgHTML: navImg?.outerHTML?.slice(0, 200),
  };
});

console.log("\n=== 结果 ===");
console.log(JSON.stringify(info, null, 2));
await browser.close();
