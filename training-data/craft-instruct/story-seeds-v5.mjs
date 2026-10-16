// ============================================================
// story-seeds-v5.mjs — v5 讲解任务蒸馏种子生成器（数据增强）
// 产出 story-seeds-v5.jsonl，供 synthesize-story-v5.mjs 消费。
// v5 增强方向（相对 v4 的 307 条）：
//   ① 景点级讲解对：与生产 scenic-recommend.js _fetchSpotStory 逐字对齐
//      （subject = "景区·景点名"，description = spot.desc）+ 裸景点名变体
//   ② 景区级讲解对：与 _fetchAreaStory 对齐（subject = 景区名，description = "地区，slogan"）
//   ③ 泛称类与口语化问法：讲解指令多样化（"讲讲XX""XX有什么好玩的"等 5 种句式）
//   ④ 核心 12 主题 facts 增补采样（sample 7/8/9）
// 防测试泄漏：验收保留主题（黄山/泰山/武当山/龙门石窟）及其景区下所有景点不进训练种子。
// 用法：node training-data/craft-instruct/story-seeds-v5.mjs
// ============================================================
import { writeFileSync } from 'node:fs';
import { EXTENDED_THEMES, CULTURE_THEMES } from '../../data/culture-knowledge.js';
import { SCENIC_AREAS } from '../../data/scenic-spots.js';

// 模型验收专用主题（OOD 泛化测试，严禁加入训练种子）
const HOLDOUT_THEMES = new Set(['huangshan', 'taishan', 'wudang', 'longmen']);
// 验收主题对应的景区（该景区下所有景点同样禁止入训练）
const HOLDOUT_AREAS = new Set(['huangshan', 'taishan', 'longmen']);

// —— 泛称/口语化问法模板（讲解指令多样化，覆盖用户真实说法）——
const COLLOQUIAL_TEMPLATES = [
  (s) => `讲讲${s}的历史和文化内涵。`,
  (s) => `${s}有什么好玩的？帮我介绍一下它的文化背景。`,
  (s) => `我拍到了${s}，讲讲这个宝贝。`,
  (s) => `带孩子去${s}玩，先给我讲讲它的来历。`,
  (s) => `朋友问我${s}是什么，帮我讲讲它的故事。`
];

const seeds = [];
const coveredSubjects = new Set();

// —— ① 景点级讲解（生产对齐 + 裸名变体）——
let spotCount = 0;
for (const area of SCENIC_AREAS) {
  if (HOLDOUT_AREAS.has(area.areaId)) continue;
  for (const spot of area.spots) {
    // v1：与生产 _fetchSpotStory 逐字对齐
    seeds.push({ task: 'open', themeId: null, subject: `${area.name}·${spot.name}`, description: spot.desc, sample: 0 });
    // v2：裸景点名（识图/泛化入口）
    seeds.push({ task: 'open', themeId: null, subject: spot.name, description: '', sample: 0 });
    coveredSubjects.add(spot.name);
    spotCount++;
  }
  // —— ② 景区级讲解（与生产 _fetchAreaStory 对齐）——
  seeds.push({ task: 'open', themeId: null, subject: area.name, description: `${area.region}，${area.slogan || ''}`, sample: 0 });
  coveredSubjects.add(area.name);
}

// —— ③ 泛称/口语化问法 ——
// 景点轮转 5 种句式（每个景点 1 条）
let ci = 0;
for (const area of SCENIC_AREAS) {
  if (HOLDOUT_AREAS.has(area.areaId)) continue;
  for (const spot of area.spots) {
    const tpl = COLLOQUIAL_TEMPLATES[ci % COLLOQUIAL_TEMPLATES.length];
    seeds.push({ task: 'colloquial', themeId: null, subject: spot.name, question: tpl(spot.name), sample: 0 });
    ci++;
  }
}
// 扩展主题（剔除验收 HOLDOUT）轮转句式（每个主题 2 条）
let ei = 0;
for (const t of EXTENDED_THEMES) {
  if (HOLDOUT_THEMES.has(t.themeId)) continue;
  for (let k = 0; k < 2; k++) {
    const tpl = COLLOQUIAL_TEMPLATES[(ei + k) % COLLOQUIAL_TEMPLATES.length];
    seeds.push({ task: 'colloquial', themeId: null, subject: t.name, question: tpl(t.name), sample: 0 });
  }
  ei += 2;
}

// —— ④ 核心 12 主题 facts 增补采样（v4 已有 sample 0-6，v5 增补 7/8/9）——
for (const t of CULTURE_THEMES) {
  for (let i = 7; i <= 9; i++) {
    seeds.push({ task: 'facts', themeId: t.themeId, subject: t.name, description: '', sample: i });
  }
}

writeFileSync(new URL('./story-seeds-v5.jsonl', import.meta.url), seeds.map(s => JSON.stringify(s)).join('\n') + '\n');
const byTask = seeds.reduce((acc, s) => { acc[s.task] = (acc[s.task] || 0) + 1; return acc; }, {});
console.log(`v5 种子生成完成：共 ${seeds.length} 条 → story-seeds-v5.jsonl`);
console.log(`  景点级(open) ${byTask.open}（含景区级/裸名变体）| 口语化(colloquial) ${byTask.colloquial} | 事实卡增补(facts) ${byTask.facts}`);
console.log(`  覆盖景点 ${spotCount} 个（剔除验收景区景点）；验收保留主题/景区未入训练`);
