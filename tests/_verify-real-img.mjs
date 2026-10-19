// 端到端验证：真实树桥森林图 → analyzeImage 标签 + generateTitleSuggestions 真实生成
import { chromium } from 'playwright';
import fs from 'fs';

const IMG = 'e:\\a\\6a578b50553ee2fa56364236\\作品测试\\AI数字艺术（通过AI技术生成的具有艺术感的作品属于此类别）\\Screenshot_2026_0921_184341.png';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
await page.route('**/js/api/supabase-client.js', route =>
  route.fulfill({ contentType: 'application/javascript', body: 'export const supabase = null; export const supabaseEnabled = false;' })
);
await page.goto('http://localhost:5173/#/', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

const dataUrl = 'data:image/png;base64,' + fs.readFileSync(IMG).toString('base64');

// 1) 特征标签
const feature = await page.evaluate(async (du) => window.AI.analyzeImage(du), dataUrl);
console.log('===== 特征分析（修复后）=====');
console.log(`dominantHue=${feature.dominantHue}  avgS=${feature.avgS.toFixed(2)}  avgV=${feature.avgV.toFixed(2)}`);
console.log(`sceneTags: [${feature.sceneTags.join(', ')}]`);
console.log(`semanticTags: [${feature.semanticTags.join(', ')}]`);
const tagOk = feature.sceneTags.includes('landscape') && feature.sceneTags.includes('nature');
console.log(`标签命中 landscape/nature: ${tagOk ? '✅ PASS' : '❌ FAIL'}`);

// 2) 真实生成 2 次（走 publish.js 同款入参：文件名 + AI数字艺术分类 + feature）
const gen = await page.evaluate(async ({ du, feat }) => {
  const r1 = await window.AI.generateTitleSuggestions('Screenshot_2026_0921_184341.png', 'ai-art', feat);
  const r2 = await window.AI.generateTitleSuggestions('Screenshot_2026_0921_184341.png', 'ai-art', feat);
  return { r1, r2 };
}, { du: dataUrl, feat: feature });

console.log('\n===== 生成结果第1次 =====');
console.log('标题: ' + gen.r1.titles.join(' | '));
console.log('文案: ' + gen.r1.description);
console.log('\n===== 生成结果第2次 =====');
console.log('标题: ' + gen.r2.titles.join(' | '));
console.log('文案: ' + gen.r2.description);

// 相关性关键词（森林图应命中；星焰虹海类宇宙/抽象词为反指标）
const pos = ['森', '林', '绿', '树', '翠', '青', '漪', '水', '桥', '荫', '苔', '屿', '泽', '屿', '洲', '木', '叶', '雾', '幽', '谧'];
const neg = ['星', '焰', '虹', '海', '宇宙', '银河', '像素', '机械', '赛博'];
const score = (r) => {
  const text = (r.titles.join('') + r.description);
  const p = pos.filter(k => text.includes(k)).length;
  const n = neg.filter(k => text.includes(k)).length;
  return { p, n };
};
const s1 = score(gen.r1), s2 = score(gen.r2);
console.log('\n===== 相关性评分 =====');
console.log(`第1次: 正向元素 ${s1.p} 个 / 反向元素 ${s1.n} 个`);
console.log(`第2次: 正向元素 ${s2.p} 个 / 反向元素 ${s2.n} 个`);
const relOk = (s1.p >= 2 && s1.n <= 1) && (s2.p >= 2 && s2.n <= 1);
console.log(`标题-图片相关性: ${relOk ? '✅ PASS' : '❌ FAIL'}`);

const diffOk = JSON.stringify(gen.r1.titles) !== JSON.stringify(gen.r2.titles);
console.log(`两次差异化: ${diffOk ? '✅ PASS' : '❌ FAIL'}`);

await browser.close();
console.log('\n总结: ' + (tagOk && relOk && diffOk ? '🎉 全部通过' : '⚠️ 存在未通过项，见上'));
