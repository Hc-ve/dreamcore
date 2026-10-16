// ============================================================
// make-train-v4.mjs — 合并 v4 训练集：v3 文创数据 + 讲解任务蒸馏数据
//   ① train-v2.jsonl（1370 条文创，v3 同源）→ 补 system:""（保持 qwen 模板默认 system，与 v3 行为一致）
//   ② story-candidates.jsonl（讲解任务，自带 STORY_SYSTEM）→ 仅保留 instruction/output/system
// 产出 train-v4.jsonl，并拷贝到 LlamaFactory-main/data/（dataset dreamcraft_v4 引用）
// 用法：node training-data/craft-instruct/make-train-v4.mjs
// ============================================================
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const craft = readFileSync(new URL('./train-v2.jsonl', import.meta.url), 'utf8')
  .trim().split('\n').map(l => JSON.parse(l));
const story = readFileSync(new URL('./story-candidates.jsonl', import.meta.url), 'utf8')
  .trim().split('\n').filter(Boolean).map(l => JSON.parse(l));

// 防泄漏硬校验：验收保留主题不得进入训练集
const HOLDOUT = ['huangshan', 'taishan', 'wudang', 'longmen'];
const leaked = story.filter(s => HOLDOUT.includes(s.themeId));
if (leaked.length > 0) {
  console.error(`防泄漏校验失败：发现验收保留主题样本 ${leaked.length} 条（${[...new Set(leaked.map(s => s.themeId))].join(',')}），请检查 story-seeds.mjs`);
  process.exit(1);
}

const craftRows = craft.map(r => JSON.stringify({ instruction: r.instruction, output: r.output, system: '' }));
const storyRows = story.map(r => JSON.stringify({ instruction: r.instruction, output: r.output, system: r.system }));
const all = [...craftRows, ...storyRows];

// 逐行 JSON 可解析性校验
for (const [i, line] of all.entries()) {
  try { JSON.parse(line); } catch (e) { console.error(`第 ${i + 1} 行 JSON 损坏: ${e.message}`); process.exit(1); }
}

writeFileSync(new URL('./train-v4.jsonl', import.meta.url), all.join('\n') + '\n');
copyFileSync(new URL('./train-v4.jsonl', import.meta.url), new URL('training-env/LlamaFactory-main/data/train-v4.jsonl', root));
console.log(`train-v4.jsonl 生成完成：文创 ${craftRows.length} + 讲解 ${storyRows.length} = ${all.length} 条`);
console.log('已拷贝到 training-env/LlamaFactory-main/data/train-v4.jsonl（dataset: dreamcraft_v4）');
