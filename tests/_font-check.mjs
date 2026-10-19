import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto("http://localhost:5173/#/settings?tab=profile", { waitUntil: "load" });
await page.waitForTimeout(3500);

const r = await page.evaluate(() => {
  const tabsHead = document.querySelector(".sp-tabs-head");
  const backBtn = document.querySelector(".sp-back-btn");
  // "设置" 文本是 .sp-tabs-head 里除了 button 之外的第一个 span（或直接 text 节点的父）
  const headChildren = tabsHead ? [...tabsHead.childNodes].map(c => ({ type: c.nodeType, text: c.textContent?.trim().slice(0, 20), tag: c.tagName || null, cls: c.className || null })) : [];

  const tab1 = document.querySelector(".sp-tab:nth-child(2)"); // 第一个 tab（紧跟 .sp-tabs-head）

  const info = (el, label) => {
    if (!el) return { label, found: false };
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      label, found: true,
      tag: el.tagName, cls: el.className,
      rect: { w: Math.round(r.width), h: Math.round(r.height) },
      fontSize: cs.fontSize, fontWeight: cs.fontWeight,
      letterSpacing: cs.letterSpacing, lineHeight: cs.lineHeight,
      textTransform: cs.textTransform,
      color: cs.color,
      text: el.textContent?.trim().slice(0, 30),
    };
  };

  // "设置" 文本：.sp-tabs-head 里不是 button 的第一个子元素
  const setupTextEl = tabsHead ? [...tabsHead.children].find(c => !c.classList.contains("sp-back-btn")) : null;

  return {
    tabsHead: info(tabsHead, "① .sp-tabs-head 容器"),
    backBtn: info(backBtn, "② .sp-back-btn 返回按钮"),
    setupText: info(setupTextEl, "③ '设置' 文本 span"),
    tab1: info(tab1, "④ 第一个 tab 按钮（个人资料）"),
    headChildren,
  };
});

console.log("=== 设置页字体样式分析 ===\n");
console.log(`DOM 子元素: ${JSON.stringify(r.headChildren, null, 2)}`);
console.log();
for (const [k, v] of Object.entries(r)) {
  if (k === "headChildren") continue;
  if (!v.found) { console.log(`${v.label}: ❌ 未找到`); continue; }
  console.log(`${v.label} — <${v.tag} class="${v.cls}">`);
  console.log(`  文本: "${v.text}"`);
  console.log(`  字号: ${v.fontSize}  字重: ${v.fontWeight}  行高: ${v.lineHeight}`);
  console.log(`  字间距: ${v.letterSpacing}  大小写: ${v.textTransform}  颜色: ${v.color}`);
  console.log(`  实际 rect: ${v.rect.w}×${v.rect.h}`);
  console.log();
}

// 对比：看全局 base font-size
const base = await page.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  return { fontSize: cs.fontSize };
});
console.log(`全局根元素 font-size: ${base.fontSize}`);

await browser.close();
