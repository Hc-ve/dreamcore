import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const results = [];

async function chk(name, fn) {
  try { const r = await fn(); results.push({name, ...r}); console.log(`${r.ok?"OK":"FAIL"} ${name} ${r.msg||""}`); }
  catch(e) { results.push({name,ok:false,msg:e.message}); console.log(`FAIL ${name} ${e.message}`); }
}

await chk("BUG002 hash尾斜杠", async () => {
  await page.goto("http://localhost:5173/#/", { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const t = await page.title();
  return { ok: !t.includes("未找到"), msg: `title=${t}` };
});

await chk("BUG001 score深链", async () => {
  await page.goto("http://localhost:5173/#/score", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const info = await page.evaluate(() => {
    const o = document.querySelector(".modal-overlay#score-page");
    if (!o) return {has:false};
    return { has:true, cls:o.className, open:o.classList.contains("open"), vis:getComputedStyle(o).visibility, op:getComputedStyle(o).opacity };
  });
  return { ok: info.has && info.open && info.vis==="visible", msg: JSON.stringify(info) };
});

await chk("BUG003 搜索框回车", async () => {
  await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  try {
    await page.locator("#nav-search-input").fill("青花");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1200);
  } catch {}
  const h = await page.evaluate(() => window.location.hash);
  return { ok: h.includes("search"), msg: `hash=${h}` };
});

await chk("BUG004 画廊loading", async () => {
  await page.goto("http://localhost:5173/", { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  const info = await page.evaluate(() => {
    const l = document.getElementById("gallery-loader");
    const c = document.querySelectorAll("#gallery .artwork-card").length;
    if (!l) return {has:false, cards:c};
    return {has:true, disp:getComputedStyle(l).display, cards:c};
  });
  return { ok: info.cards>0 && (!info.has || info.disp==="none"), msg: JSON.stringify(info) };
});

await browser.close();
console.log("\n=== SUMMARY ===");
results.forEach(r => console.log(`${r.ok?"PASS":"FAIL"} | ${r.name} | ${r.msg||""}`));
