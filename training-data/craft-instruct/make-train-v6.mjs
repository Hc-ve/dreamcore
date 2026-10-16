// ============================================================
// make-train-v6.mjs — v6 训练集组装（T6c 数据质量管线：清洗/去重/标注校验/防泄漏）
// 输入：candidates-v6.jsonl（qwen-max 蒸馏合格样本）
// 处理：
//   1. JSON 行级清洗（坏行/缺字段丢弃）
//   2. 全量重校验（9 字段 + productName 知识库命中 + layout 匹配——二次防线）
//   3. 精确去重（instruction 全文相同只留 1 条）+ 输出近重复统计（title 完全相同计数）
//   4. 防泄漏终扫（黑名单词不得出现在 instruction/output；出现即丢弃并告警）
// 输出：train-v6.jsonl（llamafactory alpaca：{instruction, output}）+ 质量统计报告
// 用法：node training-data/craft-instruct/make-train-v6.mjs
// ============================================================
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { LEAK_BLACKLIST } from './seeds-v6.mjs';
import { CRAFT_PRODUCTS } from '../../data/craft-products.js';
import { LAYOUTS } from '../../js/craft-layout.js';

const HAN_RE = /[\u4e00-\u9fa5]/g;
const han = (s) => (String(s || '').match(HAN_RE) || []).length;
const PRODUCT_NAMES = new Set(CRAFT_PRODUCTS.map(p => p.name));
const LAYOUT_TYPE_MAP = Object.fromEntries(Object.keys(LAYOUTS).map(k => [k, LAYOUTS[k].craftTypes]));
const TYPE_KEYS = ['wallpaper', 'poster', 'card', 'postcard', 'template'];
const STYLE_KEYS = ['guofeng', 'feiyi', 'minimal', 'qinghua', 'dunhuang', 'ink', 'neon', 'festive'];
const PALETTE_KEYS = ['靛蓝', '米白', '赭石', '朱砂', '黛青', '绛红', '竹青', '月白', '赭黄', '石绿', '藤黄', '水墨'];

function revalidate(plan) {
  if (!plan || typeof plan !== 'object') return '非对象';
  if (typeof plan.title !== 'string' || han(plan.title) < 6 || han(plan.title) > 16) return 'title 非法';
  if (typeof plan.subtitle !== 'string' || han(plan.subtitle) < 8 || han(plan.subtitle) > 20) return 'subtitle 非法';
  if (!PRODUCT_NAMES.has(plan.productName)) return `productName 未命中知识库: ${plan.productName}`;
  if (!TYPE_KEYS.includes(plan.craftType)) return `craftType 非法: ${plan.craftType}`;
  if (!STYLE_KEYS.includes(plan.style)) return `style 非法: ${plan.style}`;
  if (plan.craftType === 'template') { if (plan.layout) return 'template 不应有 layout'; }
  else {
    if (!LAYOUT_TYPE_MAP[plan.layout]) return `layout 非法: ${plan.layout}`;
    if (!LAYOUT_TYPE_MAP[plan.layout].includes(plan.craftType)) return 'layout/craftType 不匹配';
  }
  if (!Array.isArray(plan.palette) || plan.palette.length < 2 || plan.palette.length > 3
    || plan.palette.some(c => !PALETTE_KEYS.includes(c))) return 'palette 非法';
  if (!Array.isArray(plan.scenes) || plan.scenes.length > 2) return 'scenes 非法';
  for (const s of plan.scenes) {
    if (!s || typeof s.desc !== 'string' || han(s.desc) < 10 || han(s.desc) > 24
      || (s.slot !== 'main' && s.slot !== 'scene')) return 'scenes 项非法';
  }
  if (!Array.isArray(plan.stickers) || plan.stickers.length > 3) return 'stickers 非法';
  return null;
}

// 输入：所有分片（candidates-v6.jsonl + candidates-v6.shard*.jsonl，多进程并发蒸馏产物）
const dir = new URL('.', import.meta.url);
const files = readdirSync(dir).filter(f => /^candidates-v6(\.shard\d+)?\.jsonl$/.test(f));
const raw = files.flatMap(f =>
  readFileSync(new URL(f, import.meta.url), 'utf8').trim().split('\n').filter(Boolean)
);
const seen = new Set();          // instruction 精确去重
const titleCount = new Map();    // 输出近重复统计
const stats = { total: raw.length, badLine: 0, revalidateDrop: 0, dupDrop: 0, leakDrop: 0, kept: 0 };
const kept = [];
const leakHits = [];

for (const line of raw) {
  let r;
  try { r = JSON.parse(line); } catch { stats.badLine++; continue; }
  // 防泄漏终扫（instruction 与 output 双扫）
  const leak = LEAK_BLACKLIST.find(w => (r.instruction || '').includes(w) || (r.output || '').includes(w));
  if (leak) { stats.leakDrop++; leakHits.push(`${leak} @ ${r.idea || ''}`); continue; }
  // 输出重校验（二次防线）
  let plan;
  try { plan = JSON.parse(r.output); } catch { stats.revalidateDrop++; continue; }
  if (revalidate(plan)) { stats.revalidateDrop++; continue; }
  // instruction 精确去重
  if (seen.has(r.instruction)) { stats.dupDrop++; continue; }
  seen.add(r.instruction);
  titleCount.set(plan.title, (titleCount.get(plan.title) || 0) + 1);
  kept.push({ instruction: r.instruction, output: r.output });
  stats.kept++;
}

// —— 产出 ——
const out = new URL('./train-v6.jsonl', import.meta.url);
writeFileSync(out, kept.map(s => JSON.stringify(s)).join('\n') + '\n');

// —— 质量统计报告（供 T9 可视化报告引用）——
const dupTitles = [...titleCount.entries()].filter(([, n]) => n > 3).length;
const typeDist = {};
const productCat = {};
for (const s of kept) {
  const p = JSON.parse(s.output);
  typeDist[p.craftType] = (typeDist[p.craftType] || 0) + 1;
  const prod = CRAFT_PRODUCTS.find(x => x.name === p.productName);
  const cat = prod ? prod.category : '未知';
  productCat[cat] = (productCat[cat] || 0) + 1;
}
const report = {
  生成时间: new Date().toISOString(),
  蒸馏候选总数: stats.total,
  坏行丢弃: stats.badLine,
  重校验丢弃: stats.revalidateDrop,
  精确去重丢弃: stats.dupDrop,
  防泄漏丢弃: stats.leakDrop,
  最终训练集: stats.kept,
  高重复标题数_出现超3次: dupTitles,
  craftType分布: typeDist,
  产品大类分布: productCat
};
writeFileSync(new URL('./train-v6-stats.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (leakHits.length) console.error('防泄漏命中明细（已丢弃）:\n' + leakHits.join('\n'));
console.log(`\n→ train-v6.jsonl（${stats.kept} 条，alpaca 格式）+ train-v6-stats.json`);
