import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

// 收集 console
const logs = [];
page.on("console", msg => logs.push(`[${msg.type()}] ${msg.text()}`));

await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2000);

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

  // 加 try-catch 看哪里炸了
  try {
    console.log("1.Auth exists:", !!window.Auth);
    console.log("2.getSetting exists:", !!window.Settings?.getSetting);
    const u = await window.Auth.checkAuthState();
    console.log("3.checkAuthState 返回:", JSON.stringify(u));
    console.log("4.currentUser in Auth:", !!window.Auth.getCurrentUser());
    const areaBefore = document.getElementById("nav-user-area");
    console.log("5.nav-user-area exists:", !!areaBefore, "innerHTML开头:", areaBefore?.innerHTML?.slice(0, 80));
    window.Auth.updateNavForUser();
    const navBtn = document.getElementById("user-avatar-btn");
    console.log("6.after updateNavForUser, btn exists:", !!navBtn);
  } catch (e) {
    console.log("❌ ERROR:", e.message, e.stack?.slice(0, 300));
  }
});

await page.waitForTimeout(800);

console.log("\n=== Console Logs ===");
logs.forEach(l => console.log(l));

await browser.close();
