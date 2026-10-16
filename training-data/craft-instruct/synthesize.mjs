// ============================================================
// synthesize.mjs — 蒸馏脚本：调 DashScope qwen-plus 批量生成
// 文创方案候选 + 结构校验，产出 candidates.jsonl
//
// 用法（从项目根目录运行，读取 .env 的 DASHSCOPE_API_KEY）：
//   node training-data/craft-instruct/synthesize.mjs [--rounds N] [--resume]
//   --rounds N  每条种子生成 N 个候选（默认 1；2-3 可扩充数据集）
//   --resume    跳过已完成的种子（断点续跑）
// ============================================================
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
// 兼容 --rounds 2 与 --rounds=2 两种写法
const roundsArg = args.find(a => a.startsWith('--rounds'));
const rounds = roundsArg
  ? Number(roundsArg.includes('=') ? roundsArg.split('=')[1] : args[args.indexOf(roundsArg) + 1]) || 1
  : 1;
const resume = args.includes('--resume');
// --limit N：只处理前 N 条种子（小样本先行验证 schema/提示词，再全量）
const limitArg = args.find(a => a.startsWith('--limit'));
const limit = limitArg
  ? Number(limitArg.includes('=') ? limitArg.split('=')[1] : args[args.indexOf(limitArg) + 1]) || 0
  : 0;

// 读取 DASHSCOPE_API_KEY（与 netlify/functions/ai-proxy.mjs 相同来源约定）
function loadKey() {
  if (process.env.DASHSCOPE_API_KEY) return process.env.DASHSCOPE_API_KEY;
  try {
    const env = readFileSync(new URL('../../.env', import.meta.url), 'utf8');
    const m = env.match(/^DASHSCOPE_API_KEY\s*=\s*["']?([^"'\r\n]+)["']?/m);
    if (m) return m[1].trim();
  } catch { /* .env 不存在则仅用环境变量 */ }
  throw new Error('未找到 DASHSCOPE_API_KEY（请在 .env 配置或导出环境变量）');
}
const KEY = loadKey();
const BASE = 'https://dashscope.aliyuncs.com/api/v1';

// —— 与生产 prompt 完全一致（js/ai-craft.js generateIdeaCraft 原样模板，层3 schema 扩展版）——
const CRAFT_TYPE_KEYS = 'wallpaper/poster/card/postcard/template';
const CRAFT_STYLE_KEYS = 'guofeng/feiyi/minimal/qinghua/dunhuang/ink/neon/festive';
const CRAFT_LAYOUT_KEYS = 'poster-hero/poster-sym/postcard-circle/postcard-torn/card-layered/wallpaper-min';
const PALETTE_KEYS = '靛蓝/米白/赭石/朱砂/黛青/绛红/竹青/月白/赭黄/石绿/藤黄/水墨';
function buildIdeaPrompt(idea) {
  return [
    '你是"AI+文旅文创"平台的文创设计顾问，为用户想法定制文创衍生品方案。',
    '用户想法：「' + idea + '」。',
    '请严格输出一个 JSON 对象（禁止 markdown 代码块、禁止任何多余文字），字段如下：',
    'title：文创标题，6-16 个汉字，有文旅美感；',
    'subtitle：副标题文案，8-20 个汉字；',
    'craftType：从 [' + CRAFT_TYPE_KEYS + '] 中选最匹配的一项；',
    'style：从 [' + CRAFT_STYLE_KEYS + '] 中选最匹配的一项；',
    'layout：从 [' + CRAFT_LAYOUT_KEYS + '] 中选与 craftType 匹配的一项，craftType 为 template 时输出空字符串；',
    'palette：2-3 个传统色名，从 [' + PALETTE_KEYS + '] 中选，JSON 字符串数组；',
    'scenes：0-2 个分镜对象数组，每项为 {"desc":"10-24 字分镜画面描述","slot":"main 或 scene"}；',
    'stickers：0-3 个契合主题的 emoji 装饰，JSON 字符串数组。'
  ].join('\n');
}

// —— 结构校验（与 js/ai-craft.js 应用侧校验一致）——
const VALID_TYPES = CRAFT_TYPE_KEYS.split('/');
const VALID_STYLES = CRAFT_STYLE_KEYS.split('/');
// layout 合法值 → 可用 craftType 映射（与 js/craft-layout.js LAYOUTS 定义一致）
const LAYOUT_TYPE_MAP = {
  'poster-hero': ['poster'], 'poster-sym': ['poster'],
  'postcard-circle': ['postcard'], 'postcard-torn': ['postcard'],
  'card-layered': ['card'], 'wallpaper-min': ['wallpaper']
};
const VALID_PALETTES = PALETTE_KEYS.split('/');
const HAN_RE = /[\u4e00-\u9fa5]/g;
function validate(plan, seed) {
  if (!plan || typeof plan !== 'object') return '非对象';
  if (typeof plan.title !== 'string') return 'title 缺失';
  const han = (plan.title.match(HAN_RE) || []).length;
  if (han < 6 || han > 16) return `标题汉字数 ${han} 不在 6-16`;
  if (typeof plan.subtitle !== 'string') return 'subtitle 缺失';
  const hanSub = (plan.subtitle.match(HAN_RE) || []).length;
  if (hanSub < 8 || hanSub > 20) return `副标题汉字数 ${hanSub} 不在 8-20`;
  if (!VALID_TYPES.includes(plan.craftType)) return `craftType 非法: ${plan.craftType}`;
  if (!VALID_STYLES.includes(plan.style)) return `style 非法: ${plan.style}`;
  // 层3 layout：非 template 必填且须匹配 craftType；template 无版式（空串/null）
  if (plan.craftType === 'template') {
    if (plan.layout) return `template 不应有 layout: ${plan.layout}`;
  } else {
    if (!LAYOUT_TYPE_MAP[plan.layout]) return `layout 缺失或非法: ${plan.layout}`;
    if (!LAYOUT_TYPE_MAP[plan.layout].includes(plan.craftType)) return `layout ${plan.layout} 与 craftType ${plan.craftType} 不匹配`;
  }
  // 层3 palette：2-3 个合法传统色名
  if (!Array.isArray(plan.palette) || plan.palette.length < 2 || plan.palette.length > 3) return 'palette 非法（需 2-3 个）';
  if (plan.palette.some(c => !VALID_PALETTES.includes(c))) return `palette 含非法色名: ${plan.palette.join(',')}`;
  // 层3 scenes：0-2 个分镜对象，desc 10-24 汉字 + slot 枚举
  if (!Array.isArray(plan.scenes) || plan.scenes.length > 2) return 'scenes 非法（0-2 个）';
  for (const s of plan.scenes) {
    if (!s || typeof s !== 'object' || typeof s.desc !== 'string') return 'scenes 项缺 desc';
    const hd = (s.desc.match(HAN_RE) || []).length;
    if (hd < 10 || hd > 24) return `scenes desc 汉字数 ${hd} 不在 10-24`;
    if (s.slot !== 'main' && s.slot !== 'scene') return `scenes slot 非法: ${s.slot}`;
  }
  if (!Array.isArray(plan.stickers) || plan.stickers.length > 3) return 'stickers 非法';
  // 种子标注 vs 模型输出一致性（弱校验：仅提示人工复核，不强制拦截）
  if (seed && seed.style && plan.style !== seed.style) return null; // 允许（风格可能跨界）
  return null;
}

// —— 调用 DashScope 文本生成（层3 蒸馏教师升级 qwen-max，温度 0.2-0.3 保 JSON 稳定）——
async function dashscopeText(prompt, temperature) {
  const r = await fetch(`${BASE}/services/aigc/text-generation/generation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen-max',
      input: { messages: [{ role: 'user', content: prompt }] },
      parameters: { max_tokens: 500, temperature }
    })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`qwen-max 调用失败 ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
  // DashScope 响应格式兼容：旧版 choices[0].message.content / 新版 output.text
  // （与 netlify/functions/ai-proxy.mjs extractQwenText 同逻辑）
  const msg = d?.output?.choices?.[0]?.message;
  if (typeof msg?.content === 'string') return msg.content;
  return d?.output?.text || '';
}

// —— 主流程 ——
const seedsPath = new URL('./seeds.jsonl', import.meta.url);
const outPath = new URL('./candidates.jsonl', import.meta.url);
const seeds = readFileSync(seedsPath, 'utf8').trim().split('\n').map(l => JSON.parse(l));

// 断点续跑：读已完成的 idea 集合
const done = new Set();
if (resume && existsSync(outPath)) {
  for (const line of readFileSync(outPath, 'utf8').trim().split('\n')) {
    if (!line) continue;
    try { done.add(JSON.parse(line).idea); } catch { /* 忽略坏行 */ }
  }
  console.log(`续跑模式：已完成 ${done.size} 条种子`);
}

let ok = 0, bad = 0, skipped = 0;
const seedsToRun = limit > 0 ? seeds.slice(0, limit) : seeds;
for (const seed of seedsToRun) {
  if (resume && done.has(seed.idea)) { skipped++; continue; }
  const prompt = buildIdeaPrompt(seed.idea);
  for (let round = 0; round < rounds; round++) {
    try {
      const text = await dashscopeText(prompt, round === 0 ? 0.2 : 0.3);
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) { bad++; console.error(`\n无JSON [${seed.idea}] 原文: ${text.slice(0, 120)}`); continue; }
      const plan = JSON.parse(m[0]);
      const err = validate(plan, seed);
      if (err) { bad++; console.error(`\n校验失败 [${seed.idea}]: ${err}`); continue; }
      const sample = { instruction: prompt, output: JSON.stringify(plan), idea: seed.idea };
      appendFileSync(outPath, JSON.stringify(sample) + '\n');
      ok++;
      process.stdout.write(`\r蒸馏进度 ok=${ok} bad=${bad}`);
    } catch (e) {
      bad++;
      console.error(`\n失败 [${seed.idea}]: ${e.message}`);
    }
    // 温和限速，避免触发 DashScope QPS 限制
    await new Promise(r => setTimeout(r, 500));
  }
}
console.log(`\n完成：合格 ${ok} 条 → candidates.jsonl，不合格 ${bad} 条，续跑跳过 ${skipped} 条`);
console.log('下一步：人工筛选/润色 candidates.jsonl → 重命名为 train.jsonl（参考 README.md）');
