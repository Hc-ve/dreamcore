import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);

// Mock Supabase + 写 user + 写 custom avatar + 手动触发 Auth
await page.evaluate(async () => {
  // Mock supabase 返回 null session
  if (window.supabase?.auth) {
    window.supabase.auth.getSession = async () => ({ data: { session: null } });
  }
  // 也直接在 localStorage 存
  localStorage.setItem("currentUser", JSON.stringify({
    username: "admin", email: "admin@dreamcore.art", isAdmin: true, id: "u1"
  }));
  localStorage.setItem("dreamcore-avatar-migrated-v3", "done");
  const c = document.createElement("canvas");
  c.width = 1000; c.height = 1000;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 1000);
  g.addColorStop(0, "#2d5a3d"); g.addColorStop(1, "#88c9a1");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1000, 1000);
  ctx.fillStyle = "#fff"; ctx.font = "bold 120px serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("TREE BRIDGE", 500, 500);
  localStorage.setItem("dreamcore-avatar", JSON.stringify({ type: "custom", dataURL: c.toDataURL("image/png") }));

  // 绕过 Supabase：直接把 currentUser 塞进 Auth 闭包
  // 方法：mock checkAuthState 让它走 localStorage
  const origCheck = window.Auth.checkAuthState.bind(window.Auth);
  window.Auth.checkAuthState = async function() {
    const saved = localStorage.getItem('currentUser');
    try {
      this._currentUser = JSON.parse(saved);
      window.currentUser = this._currentUser;
      return this._currentUser;
    } catch { return null; }
  };
  // 也塞到 Auth 内部的 currentUser（需要 eval 闭包变量不行，所以用 getCurrentUser 也行不通）
  // 换个办法：直接改 Auth 模块内部引用
  await window.Auth.checkAuthState();
  // 关键：auth.js 的 currentUser 是闭包变量，updateNavForUser 读的是它
  // 但 checkAuthState 在 Supabase 模式下可能用不同路径
  // 让我直接用 window.Auth.getCurrentUser() 看
  console.log("checkAuthState done, getCurrentUser:", window.Auth.getCurrentUser()?.username);
});

// 重启 page 让 Auth 模块重新初始化 → Supabase enabled + 真 session=null → currentUser 还是 null
// 换更暴力的办法：直接 mock import.meta.env
await page.addInitScript(() => {
  Object.defineProperty(import.meta.env, 'VITE_SUPABASE_URL', { value: '', configurable: true });
  Object.defineProperty(import.meta.env, 'VITE_SUPABASE_ANON_KEY', { value: '', configurable: true });
});

console.log("initScript injected, need reload...");
await browser.close();

// 重开带 initScript
const browser2 = await chromium.launch({ channel: "msedge", headless: true });
const page2 = await browser2.newPage({ viewport: { width: 1400, height: 900 } });

// 拦截 supabase-client 并 mock
await page2.route("**/supabase-client.js", (route) => {
  route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: `export const supabaseEnabled = false; export const supabase = null;`
  });
});

await page2.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
await page2.waitForTimeout(2500);

await page2.evaluate(async () => {
  localStorage.setItem("currentUser", JSON.stringify({
    username: "admin", email: "admin@dreamcore.art", isAdmin: true, id: "u1"
  }));
  localStorage.setItem("dreamcore-avatar-migrated-v3", "done");
  const c = document.createElement("canvas");
  c.width = 1000; c.height = 1000;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 1000);
  g.addColorStop(0, "#2d5a3d"); g.addColorStop(1, "#88c9a1");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1000, 1000);
  ctx.fillStyle = "#fff"; ctx.font = "bold 120px serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("TREE BRIDGE", 500, 500);
  localStorage.setItem("dreamcore-avatar", JSON.stringify({ type: "custom", dataURL: c.toDataURL("image/png") }));
});

await page2.reload({ waitUntil: "load" });
await page2.waitForTimeout(4000);

const navBtn = page2.locator("#user-avatar-btn");
try {
  await navBtn.waitFor({ state: "visible", timeout: 8000 });
  console.log("✅ user-avatar-btn 出现了！");
} catch (e) {
  const info = await page2.evaluate(() => ({
    navBtnExists: !!document.getElementById("user-avatar-btn"),
    areaHTML: document.getElementById("nav-user-area")?.innerHTML?.slice(0, 200),
    supaEnabled: window.supabaseEnabled,
  }));
  console.log("❌ 还是没出现:", JSON.stringify(info));
  await browser2.close();
  process.exit(1);
}

await navBtn.click();
await page2.waitForTimeout(300);

// 最终测量
const r = await page2.evaluate(() => {
  const info = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height), cls: el.className };
  };
  return {
    navImg: info(document.querySelector("#user-avatar-btn img")),
    navBtn: info(document.querySelector("#user-avatar-btn")),
    ddBtn: info(document.querySelector("#user-dropdown .dropdown-header .user-avatar-btn.lg")),
    ddImg: info(document.querySelector("#user-dropdown .dropdown-header .user-avatar-btn.lg img")),
  };
});

console.log("\n=== 自定义上传头像（修复后）===");
console.log("导航栏 img:", r.navImg, "(期望 30x30)");
console.log("下拉大头像 img:", r.ddImg, "(期望 44x44)");
console.log("下拉 .lg 容器:", r.ddBtn);

const ok = (r.navImg?.w === 30 || r.navImg?.w <= 35) && (r.ddImg?.w === 44 || r.ddImg?.w <= 50);
console.log(`\n${ok ? "🎉 全部通过" : "❌ 仍有问题"}`);

await browser2.close();
