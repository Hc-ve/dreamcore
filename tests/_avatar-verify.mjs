import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

// 直接在页面里造测试 DOM 验证 CSS 是否生效
const testResult = await page.evaluate(() => {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.innerHTML = `
    <span class="avatar-circle"><img class="avatar-circle avatar-img" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iODAwIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjgwMCIgZmlsbD0icmdiYSgyNTUsMCwwKSIvPjwvc3ZnPg=="></span>
    <span class="avatar-circle lg"><img class="avatar-circle lg avatar-img" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MDAiIGhlaWdodD0iODAwIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjgwMCIgZmlsbD0icmdiYSgwLDI1NSwwKSIvPjwvc3ZnPg=="></span>
  `;
  document.body.appendChild(container);
  const imgs = container.querySelectorAll("img");
  return Array.from(imgs).map(img => {
    const r = img.getBoundingClientRect();
    const cs = getComputedStyle(img);
    return { cls: img.className, w: Math.round(r.width), h: Math.round(r.height), csW: cs.width, csH: cs.height };
  });
});

console.log("测试结果:");
for (const r of testResult) {
  const expected = r.cls.includes("lg") ? 44 : 30;
  const ok = Math.abs(r.w - expected) <= 5;
  console.log(`  ${r.cls.split(" ").join(".")} → ${r.w}x${r.h} (预期 ~${expected}) ${ok ? "✅" : "❌"}`);
  console.log(`    computed: ${r.csW} x ${r.csH}`);
}

// 也确认 CSS 文件里的规则确实被加载了
const cssOk = await page.evaluate(() => {
  const sheets = Array.from(document.styleSheets);
  let foundCircle = false, foundLg = false;
  for (const sheet of sheets) {
    try {
      const rules = sheet.cssRules;
      for (const r of rules) {
        if (r.selectorText === ".avatar-circle.avatar-img" && r.cssText.includes("width: 100%")) foundCircle = true;
        if (r.selectorText === ".avatar-circle.lg.avatar-img" && r.cssText.includes("width: 100%")) foundLg = true;
      }
    } catch {}
  }
  return { foundCircle, foundLg };
});
console.log(`\nCSS 规则已加载: .avatar-circle.avatar-img=${cssOk.foundCircle}, .avatar-circle.lg.avatar-img=${cssOk.foundLg}`);

await browser.close();
