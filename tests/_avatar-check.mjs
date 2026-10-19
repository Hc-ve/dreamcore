import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3500);

// 打开用户下拉（先模拟登录态 —— 如果已登录就直接点）
const btn = page.locator("#user-avatar-btn");
const exists = await btn.count();
console.log("user-avatar-btn exists:", exists);

if (exists > 0) {
  await btn.click();
  await page.waitForTimeout(300);
  
  const info = await page.evaluate(() => {
    const navImg = document.querySelector("#user-avatar-btn img.avatar-img");
    const dropdownImg = document.querySelector(".user-dropdown img.avatar-img");
    const navCircle = document.querySelector("#user-avatar-btn .avatar-circle");
    const dropdownCircle = document.querySelector(".user-dropdown .avatar-circle");
    
    const getInfo = (el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        cls: el.className,
        w: Math.round(r.width),
        h: Math.round(r.height),
        csW: cs.width,
        csH: cs.height,
        vis: cs.visibility,
        disp: cs.display
      };
    };
    return {
      navImg: getInfo(navImg),
      dropdownImg: getInfo(dropdownImg),
      navCircle: getInfo(navCircle),
      dropdownCircle: getInfo(dropdownCircle)
    };
  });
  console.log(JSON.stringify(info, null, 2));
  
  // 判定：nav img 应该接近 30x30，dropdown 应该接近 44x44
  if (info.navImg) {
    const ok = Math.abs(info.navImg.w - 30) <= 10;
    console.log(`\n导航栏头像尺寸 ${info.navImg.w}x${info.navImg.h} — ${ok ? "OK" : "过大/过小"}`);
  }
  if (info.dropdownImg) {
    const ok = Math.abs(info.dropdownImg.w - 44) <= 15;
    console.log(`下拉菜单头像尺寸 ${info.dropdownImg.w}x${info.dropdownImg.h} — ${ok ? "OK" : "过大/过小"}`);
  }
} else {
  console.log("未登录态，跳过头像尺寸检查");
}

await browser.close();
