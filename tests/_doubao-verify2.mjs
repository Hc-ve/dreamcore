import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

// BUG002
await page.goto("http://localhost:5173/#/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
const t2 = await page.title();
console.log(`BUG002  title="${t2}"  is404=${t2.includes("未找到")}`);

// BUG001
await page.goto("http://localhost:5173/#/score", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
const info1 = await page.evaluate(() => {
  const o = document.querySelector(".modal-overlay#score-page");
  if (!o) return {has:false};
  return { has:true, cls:o.className, open:o.classList.contains("open"), vis:getComputedStyle(o).visibility, op:getComputedStyle(o).opacity };
});
console.log(`BUG001  ${JSON.stringify(info1)}`);

await browser.close();
