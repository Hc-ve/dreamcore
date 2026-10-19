import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.addInitScript(() => { localStorage.clear(); localStorage.setItem("dreamcore-theme", "dark"); });
await page.goto("http://localhost:5173", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForTimeout(3000);

const r = await page.evaluate(() => {
  const p = window.Particles;
  const canvas = document.getElementById("particle-canvas");
  const ctxt = canvas?.getContext?.("webgl") || canvas?.getContext?.("webgl2");
  return {
    ptExists: !!p,
    sceneChildren: p?.scene?.children?.length,
    theme: p?.currentTheme,
    isPaused: p?.isPaused,
    canvasW: canvas?.width, canvasH: canvas?.height,
    canvasOp: canvas ? getComputedStyle(canvas).opacity : null,
    canvasDisp: canvas ? getComputedStyle(canvas).display : null,
    themeAttr: document.documentElement.getAttribute("data-theme"),
    styleAttr: document.documentElement.getAttribute("data-style"),
    heroBg: getComputedStyle(document.querySelector(".hero-section") || document.querySelector("body")).backgroundColor,
    centerPixels: ctxt ? (() => {
      try {
        const d = new Uint8Array(400);
        ctxt.readPixels(0, 0, 10, 10, d);
        let lit = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] > 20) lit++;
        return lit;
      } catch(e) { return "readPixels failed: " + e.message; }
    })() : "no webgl ctx",
  };
});
console.log("=== Dark Mode Verification ===");
console.log(JSON.stringify(r, null, 2));

import { mkdirSync, existsSync } from "fs";
if (!existsSync("docs/ui-audit")) mkdirSync("docs/ui-audit", { recursive: true });

await page.screenshot({ path: "docs/ui-audit/verify-dark-hero.png", fullPage: true });

await ctx.close();
const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page2 = await ctx2.newPage();
await page2.addInitScript(() => { localStorage.clear(); localStorage.setItem("dreamcore-theme", "light"); });
await page2.goto("http://localhost:5173", { waitUntil: "domcontentloaded", timeout: 60000 });
await page2.waitForTimeout(3000);
await page2.screenshot({ path: "docs/ui-audit/verify-light-hero.png", fullPage: true });
await ctx2.close();
await browser.close();
