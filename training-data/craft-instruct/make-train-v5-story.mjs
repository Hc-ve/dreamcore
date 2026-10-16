// ============================================================
// make-train-v5-story.mjs — 合并 v5 讲解专用训练集（纯讲解任务，双模型架构）
//   v4 教训：1370 文创 + 307 讲解混合训练 → 任务干扰，讲解合规率仅 90%。
//   v5 策略：讲解模型只训讲解数据（v4 307 条 + v5 增补条），消除任务干扰。
//   ① story-candidates.jsonl（v4 讲解 307 条）
//   ② story-candidates-v5.jsonl（v5 增补：景点/景区/口语化/facts 增补）
// 产出 train-v5-story.jsonl，拷贝到 LlamaFactory-main/data/（dataset dreamcraft_v5_story）
// 用法：node training-data/craft-instruct/make-train-v5-story.mjs
// ============================================================
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const v4 = readFileSync(new URL('./story-candidates.jsonl', import.meta.url), 'utf8')
  .trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
let v5 = [];
try {
  v5 = readFileSync(new URL('./story-candidates-v5.jsonl', import.meta.url), 'utf8')
    .trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
} catch { /* v5 增补文件尚未生成时仅用 v4 */ }

// 防泄漏硬校验：验收保留主题不得进入训练集（含 v5 景点种子经景区名关联的保留景区）
const HOLDOUT = ['huangshan', 'taishan', 'wudang', 'longmen'];
const HOLDOUT_AREA_NAMES = ['黄山', '泰山', '武当山', '龙门石窟'];
const all = [...v4, ...v5];
const leaked = all.filter(s => HOLDOUT.includes(s.themeId));
if (leaked.length > 0) {
  console.error(`防泄漏校验失败：发现验收保留主题样本 ${leaked.length} 条（${[...new Set(leaked.map(s => s.themeId))].join(',')}）`);
  process.exit(1);
}
// 景区级防泄漏：黄山/泰山/武当山/龙门石窟 景区下的景点 subject 一律排除
const areaLeaked = all.filter(s => HOLDOUT_AREA_NAMES.some(a => String(s.subject || '').startsWith(a + '·')));
if (areaLeaked.length > 0) {
  console.error(`防泄漏校验失败：发现验收保留景区景点样本 ${areaLeaked.length} 条（${[...new Set(areaLeaked.map(s => s.subject))].slice(0, 5).join(',')} 等）`);
  process.exit(1);
}

const rows = all.map(r => JSON.stringify({
  instruction: r.instruction, output: r.output, system: r.system
}));

// 逐行 JSON 可解析性校验
for (const [i, line] of rows.entries()) {
  try { JSON.parse(line); } catch (e) { console.error(`第 ${i + 1} 行 JSON 损坏: ${e.message}`); process.exit(1); }
}

writeFileSync(new URL('./train-v5-story.jsonl', import.meta.url), rows.join('\n') + '\n');
copyFileSync(new URL('./train-v5-story.jsonl', import.meta.url), new URL('training-env/LlamaFactory-main/data/train-v5-story.jsonl', root));
console.log(`train-v5-story.jsonl 生成完成：v4 讲解 ${v4.length} + v5 增补 ${v5.length} = ${rows.length} 条（纯讲解任务）`);
console.log('已拷贝到 training-env/LlamaFactory-main/data/train-v5-story.jsonl（dataset: dreamcraft_v5_story）');
