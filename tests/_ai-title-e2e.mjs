import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto("http://localhost:5173/", { waitUntil: "load" });
await page.waitForTimeout(2500);

// 1. 模拟青绿山水插画（跟用户截图里那张类似）
const testArt = await page.evaluate(() => {
  const c = document.createElement("canvas");
  c.width = 800; c.height = 600;
  const ctx = c.getContext("2d");
  // 天空：淡绿青
  const sky = ctx.createLinearGradient(0, 0, 0, 300);
  sky.addColorStop(0, '#cde8d4'); sky.addColorStop(1, '#8fbf9c');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 800, 300);
  // 远山：暗青
  ctx.fillStyle = '#3a7a50';
  ctx.beginPath();
  ctx.moveTo(0, 320); ctx.lineTo(150, 180); ctx.lineTo(280, 250);
  ctx.lineTo(420, 150); ctx.lineTo(580, 240); ctx.lineTo(720, 200);
  ctx.lineTo(800, 280); ctx.lineTo(800, 400); ctx.lineTo(0, 400); ctx.closePath();
  ctx.fill();
  // 近水：碧绿
  ctx.fillStyle = '#2d8a6e'; ctx.fillRect(0, 380, 800, 180);
  // 桥/建筑点缀
  ctx.fillStyle = '#c4a56a'; ctx.fillRect(200, 370, 80, 30);
  ctx.fillStyle = '#6b4f3a'; ctx.fillRect(220, 320, 10, 50); ctx.fillRect(250, 320, 10, 50);
  ctx.fillStyle = '#2a5a40'; ctx.beginPath(); ctx.arc(550, 360, 40, 0, Math.PI * 2); ctx.fill();
  // 树点
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(${60 + Math.random()*40}, ${130 + Math.random()*60}, ${80 + Math.random()*40}, 0.7)`;
    ctx.beginPath(); ctx.arc(Math.random()*800, 350 + Math.random()*180, 4 + Math.random()*6, 0, Math.PI*2); ctx.fill();
  }
  return c.toDataURL("image/png");
});

// 2. 测 AI.analyzeImage 对这张图的特征识别
const feature = await page.evaluate(async (dataURL) => {
  return await window.AI.analyzeImage(dataURL);
}, testArt);

console.log("=== ① 图像特征分析 ===\n");
console.log("主色调 HSV:", `H=${Math.round(feature.avgH)}° S=${(feature.avgS*100).toFixed(0)}% V=${(feature.avgV*100).toFixed(0)}%`);
console.log("色相丰富度:", feature.richness, "桶");
console.log("色温:", feature.warmRatio < 0.4 ? "冷调 ✅" : feature.warmRatio > 0.6 ? "暖调" : "中调");
console.log("场景标签 (sceneTags):", feature.sceneTags);
console.log("语义标签 (semanticTags):", feature.semanticTags);

const landscapeHit = feature.sceneTags?.includes('landscape') || feature.sceneTags?.includes('nature');
const chineseHit = feature.sceneTags?.includes('chinese-traditional');
console.log(`\n青绿山水识别: landscape=${landscapeHit ? "✅" : "❌"}  chinese-traditional=${chineseHit ? "✅" : "❌"}`);

// 3. 测 3 次 AI 推荐标题（都是同一张图，但每次 shuffle 应不同）
console.log("\n=== ② AI 推荐标题（同图 × 3 次） ===\n");
const sets = [];
for (let i = 0; i < 3; i++) {
  const res = await page.evaluate(async ({ dataURL, idx }) => {
    const f = await window.AI.analyzeImage(dataURL);
    return await window.AI.generateTitleSuggestions('Screenshot_2026_0921_184435.png', 'illustration', f);
  }, { dataURL: testArt, idx: i });
  sets.push(res.titles);
  console.log(`第 ${i+1} 次: ${res.titles.join(' / ')}`);
  console.log(`  文案: ${res.description.slice(0, 60)}...`);
}

// 4. 检查"未加载的黄昏"等老模板是否还出现
const forbidden = ['未加载', '像素云海', '第404号梦境', '像素星河'];
const allTitles = sets.flat();
const hasForbidden = allTitles.some(t => forbidden.some(f => t.includes(f)));

// 5. 检查结果是否跟"青绿山水"主题相关
const greenThemeKeywords = ['山', '水', '青', '翠', '溪', '谷', '松', '绿', '林', '国', '古', '水墨', '云雾', '山居', '秋', '山野', '自然', '绿野'];
const relevantCount = allTitles.filter(t => greenThemeKeywords.some(k => t.includes(k))).length;

// 6. 检查 3 次结果是否有差异（每次 shuffle 应不同）
const uniqueSets = new Set(sets.map(s => s.sort().join('|')));

console.log(`\n=== ③ 质量评估 ===`);
console.log(`禁止词出现: ${hasForbidden ? "❌ 有老模板" : "✅ 已清除老模板"}`);
console.log(`与"青绿山水"相关: ${relevantCount}/9`);
console.log(`3 次结果差异化: ${uniqueSets.size === 3 ? "✅ 每次不同" : uniqueSets.size === 1 ? "❌ 完全一样" : "⚠️ 部分重复"}`);

const allPass = landscapeHit && !hasForbidden && relevantCount >= 4 && uniqueSets.size >= 2;
console.log(`\n${allPass ? "🎉 全部通过" : "❌ 仍有问题"}`);

await browser.close();
