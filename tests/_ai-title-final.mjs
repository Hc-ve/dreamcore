import { chromium } from "playwright";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

await page.goto("http://localhost:5173/", { waitUntil: "load" });
await page.waitForTimeout(2500);

// 场景 1：青绿山水插画
const landscape = await page.evaluate(() => {
  const c = document.createElement("canvas");
  c.width = 800; c.height = 600; const ctx = c.getContext("2d");
  const sky = ctx.createLinearGradient(0, 0, 0, 300);
  sky.addColorStop(0, '#cde8d4'); sky.addColorStop(1, '#8fbf9c');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 800, 300);
  ctx.fillStyle = '#3a7a50';
  ctx.beginPath();
  ctx.moveTo(0, 320); ctx.lineTo(150, 180); ctx.lineTo(280, 250);
  ctx.lineTo(420, 150); ctx.lineTo(580, 240); ctx.lineTo(720, 200);
  ctx.lineTo(800, 280); ctx.lineTo(800, 400); ctx.lineTo(0, 400); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2d8a6e'; ctx.fillRect(0, 380, 800, 220);
  ctx.fillStyle = '#c4a56a'; ctx.fillRect(200, 370, 80, 30);
  ctx.fillStyle = '#6b4f3a'; ctx.fillRect(220, 320, 10, 50); ctx.fillRect(250, 320, 10, 50);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(${60 + Math.random()*40}, ${130 + Math.random()*60}, ${80 + Math.random()*40}, 0.7)`;
    ctx.beginPath(); ctx.arc(Math.random()*800, 350 + Math.random()*200, 4 + Math.random()*6, 0, Math.PI*2); ctx.fill();
  }
  return c.toDataURL("image/png");
});

// 场景 2：夕阳红（暖色场景）
const sunset = await page.evaluate(() => {
  const c = document.createElement("canvas");
  c.width = 800; c.height = 600; const ctx = c.getContext("2d");
  const sky = ctx.createLinearGradient(0, 0, 0, 600);
  sky.addColorStop(0, '#1a0a2e'); sky.addColorStop(0.4, '#c05a3a');
  sky.addColorStop(0.7, '#f4a460'); sky.addColorStop(1, '#ffd27f');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 800, 600);
  // 太阳
  ctx.fillStyle = '#ff6b35'; ctx.beginPath(); ctx.arc(500, 300, 60, 0, Math.PI*2); ctx.fill();
  // 剪影山
  ctx.fillStyle = '#1a0a0a';
  ctx.beginPath();
  ctx.moveTo(0, 500); ctx.lineTo(150, 380); ctx.lineTo(300, 440);
  ctx.lineTo(450, 360); ctx.lineTo(600, 420); ctx.lineTo(800, 380);
  ctx.lineTo(800, 600); ctx.lineTo(0, 600); ctx.closePath(); ctx.fill();
  return c.toDataURL("image/png");
});

// 场景 3：暗夜星空（冷调暗色）
const night = await page.evaluate(() => {
  const c = document.createElement("canvas");
  c.width = 800; c.height = 600; const ctx = c.getContext("2d");
  ctx.fillStyle = '#0a0a1a'; ctx.fillRect(0, 0, 800, 600);
  for (let i = 0; i < 150; i++) {
    const br = 150 + Math.random()*100;
    ctx.fillStyle = `rgba(${br},${br},255,${0.3 + Math.random()*0.7})`;
    ctx.beginPath(); ctx.arc(Math.random()*800, Math.random()*600, 0.5 + Math.random()*2, 0, Math.PI*2); ctx.fill();
  }
  // 月亮
  ctx.fillStyle = '#e0e0f0'; ctx.beginPath(); ctx.arc(650, 120, 35, 0, Math.PI*2); ctx.fill();
  return c.toDataURL("image/png");
});

async function testScene(name, dataURL, category) {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`场景：${name}（category=${category}）`);
  console.log(`${"=".repeat(50)}`);

  const f = await page.evaluate(async (url) => await window.AI.analyzeImage(url), dataURL);
  console.log(`📷 特征: 场景标签=[${f.sceneTags?.join(', ')}] 语义标签=[${f.semanticTags?.join(', ')}]`);
  console.log(`   HSV: H=${Math.round(f.avgH)}° S=${(f.avgS*100).toFixed(0)}% V=${(f.avgV*100).toFixed(0)}% 色温=${f.warmRatio < 0.4 ? '冷调' : f.warmRatio > 0.6 ? '暖调' : '中调'}`);

  const sets = [];
  for (let i = 0; i < 3; i++) {
    const res = await page.evaluate(async ({ url, cat }) => {
      const ft = await window.AI.analyzeImage(url);
      return await window.AI.generateTitleSuggestions('Screenshot_001.png', cat, ft);
    }, { url: dataURL, cat: category });
    sets.push(res);
    console.log(`\n  第 ${i+1} 次: ${res.titles.join(' / ')}`);
    // nonce 泄漏检测
    if (res.description && /[a-z0-9]{4,}-[0-9]{2,}/i.test(res.description)) {
      console.log(`  ⚠️ 文案可能泄漏种子编号！`);
    }
  }

  // 差异化检查
  const uniqueSets = new Set(sets.map(s => s.titles.slice().sort().join('|')));
  const diff = uniqueSets.size === 3 ? "✅ 每次不同" : uniqueSets.size === 1 ? "❌ 完全相同" : "⚠️ 部分重复";
  console.log(`\n  差异化: ${diff}（${uniqueSets.size}/3）`);

  // 老模板清除检查
  const allTitles = sets.flatMap(s => s.titles);
  const forbidden = ['未加载', '像素云海', '第404号', '梦境碎片', '像素星河', '数字幻影'];
  const hasForbidden = allTitles.some(t => forbidden.some(f => t.includes(f)));
  console.log(`  禁止词: ${hasForbidden ? '❌ 出现老模板' : '✅ 已清除'}`);

  return { sceneTags: f.sceneTags, uniqueSets: uniqueSets.size, hasForbidden };
}

const results = [];
results.push(await testScene("青绿山水插画", landscape, "illustration"));
results.push(await testScene("夕阳红（暖色）", sunset, "photography"));
results.push(await testScene("暗夜星空", night, "digital-art"));

console.log(`\n${"=".repeat(50)}`);
console.log("🎉 总体评估：");
console.log(`${"=".repeat(50)}`);

const landscapeOK = results[0].sceneTags?.includes('landscape') || results[0].sceneTags?.includes('chinese-traditional');
const sunsetOK = results[1].sceneTags?.includes('sunset') || results[1].sceneTags?.includes('warm-toned');
const nightOK = results[2].sceneTags?.includes('night') || results[2].sceneTags?.includes('cosmic');
const allDiff = results.every(r => r.uniqueSets >= 2);
const allClean = results.every(r => !r.hasForbidden);

console.log(`✅ 青绿山水识别: ${landscapeOK ? "PASS" : "FAIL"}`);
console.log(`✅ 夕阳暖色识别: ${sunsetOK ? "PASS" : "FAIL"}`);
console.log(`✅ 暗夜星空识别: ${nightOK ? "PASS" : "FAIL"}`);
console.log(`✅ 三次差异化:   ${allDiff ? "PASS" : "FAIL"}`);
console.log(`✅ 老模板清除:   ${allClean ? "PASS" : "FAIL"}`);

const all = landscapeOK && sunsetOK && nightOK && allDiff && allClean;
console.log(`\n${all ? "🎉🎉🎉 全部通过！修复彻底完成" : "❌ 仍有未解决问题"}`);

await browser.close();
