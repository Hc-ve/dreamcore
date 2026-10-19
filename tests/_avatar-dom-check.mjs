import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto("http://localhost:5173/", { waitUntil: "load" });
await page.waitForTimeout(4000);

// 查 DOM 现状
const dom = await page.evaluate(() => {
  const area = document.getElementById("nav-user-area");
  const navBtn = document.getElementById("user-avatar-btn");
  const scriptCount = document.querySelectorAll("script[src]").length;
  return {
    areaExists: !!area,
    areaHTML: area?.innerHTML?.slice(0, 200) || "(null)",
    navBtnExists: !!navBtn,
    scripts: scriptCount,
    bodyChildren: document.body.children.length,
    AuthWindow: !!window.Auth,
    AuthKeys: window.Auth ? Object.keys(window.Auth).slice(0, 10) : [],
    hasInit: !!window.Auth?.init,
    avatarSetting: localStorage.getItem("dreamcore-avatar")?.slice(0, 80),
  };
});
console.log("=== DOM 现状 ===");
console.log(JSON.stringify(dom, null, 2));

// 如果 Auth 存在，手动触发 updateNavForUser
if (dom.AuthWindow && !dom.navBtnExists) {
  await page.evaluate(() => {
    if (window.Auth?.updateNavForUser) window.Auth.updateNavForUser();
  });
  await page.waitForTimeout(500);
  const navBtn2 = await page.evaluate(() => !!document.getElementById("user-avatar-btn"));
  console.log("\n手动触发后 user-avatar-btn:", navBtn2 ? "✅ 存在" : "❌ 仍不存在");
}

await browser.close();
