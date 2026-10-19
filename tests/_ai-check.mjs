import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const errs = [];
page.on("pageerror", e => errs.push(`[pageerror] ${e.message}`));
page.on("console", m => { if (m.type() === 'error') errs.push(`[console.error] ${m.text()}`); });

await page.goto("http://localhost:5173/", { waitUntil: "load" });
await page.waitForTimeout(2500);

const check = await page.evaluate(() => {
  const keys = window.AI ? Object.keys(window.AI) : null;
  return {
    aiExists: !!window.AI,
    hasAnalyzeImage: !!(window.AI?.analyzeImage),
    hasGenerateTitle: !!(window.AI?.generateTitleSuggestions),
    methodCount: keys?.length,
    sampleMethods: keys?.filter(k => k.includes('Title') || k.includes('analyze') || k.includes('fallback') || k.includes('tutor')).slice(0, 20),
  };
});

console.log("AI 对象检查:");
console.log(JSON.stringify(check, null, 2));
if (errs.length) {
  console.log("\n⚠️ 页面错误:");
  errs.forEach(e => console.log(e));
}
await browser.close();
