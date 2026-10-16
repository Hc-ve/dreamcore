// ============================================================
// synthesize-v6.mjs — v6 文创方案蒸馏脚本（qwen-max 教师，T6b）
// 训练/推理对齐三要素（与 js/ai-craft.js generateIdeaCraft L821-837 逐字一致）：
//   1. prompt 模板逐字复制自生产代码（含作品上下文行/硬性要求/productName 字段）
//   2. hotNames = CRAFT_PRODUCTS.filter(p => p.hot).slice(0, 16)（动态 import 同源）
//   3. layout 清单 = Object.keys(LAYOUTS)（14 种，动态 import 同源）
// 校验新增（对比 v3）：
//   - productName 必须命中 data/craft-products.js 知识库
//   - 贴题校验：theme 存在时 title 须含主题关键词/作品标题词根（教师示范样本必须贴题）
// 产出：candidates-v6.jsonl {instruction, output, idea, themeId, artworkTitle}
// 用法：node training-data/craft-instruct/synthesize-v6.mjs [--resume] [--limit N]
// ============================================================
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { CULTURE_THEMES, matchThemeByText } from '../../data/culture-knowledge.js';
import { CRAFT_PRODUCTS, getProductByName } from '../../data/craft-products.js';
import { LAYOUTS } from '../../js/craft-layout.js';

const args = process.argv.slice(2);
const resume = args.includes('--resume');
// --teacher=deepseek：DashScope 欠费时的备用教师通道（DeepSeek chat/completions）
const teacherArg = args.find(a => a.startsWith('--teacher'));
const teacher = teacherArg?.split('=')[1] || 'qwen';
const limitArg = args.find(a => a.startsWith('--limit'));
const limit = limitArg
  ? Number(limitArg.includes('=') ? limitArg.split('=')[1] : args[args.indexOf(limitArg) + 1]) || 0
  : 0;
// --shard=I/N：并发分片（处理 seeds 中 index % N === I 的子集，输出独立文件避免多进程写交错）
const shardArg = args.find(a => a.startsWith('--shard'));
let shardIdx = -1, shardTotal = 1;
if (shardArg) {
  const m = shardArg.match(/^--shard=(\d+)\/(\d+)$/);
  if (!m) throw new Error('--shard 格式：--shard=I/N（如 --shard=0/4）');
  shardIdx = Number(m[1]); shardTotal = Number(m[2]);
}

function loadKey(name) {
  if (process.env[name]) return process.env[name];
  try {
    const env = readFileSync(new URL('../../.env', import.meta.url), 'utf8');
    const m = env.match(new RegExp(`^${name}\\s*=\\s*["']?([^"'\\r\\n]+)["']?`, 'm'));
    if (m) return m[1].trim();
  } catch { /* .env 不存在则仅用环境变量 */ }
  throw new Error(`未找到 ${name}（请在 .env 配置或导出环境变量）`);
}
const KEY = loadKey(teacher === 'deepseek' ? 'DEEPSEEK_API_KEY' : 'DASHSCOPE_API_KEY');
const BASE = 'https://dashscope.aliyuncs.com/api/v1';

// —— 枚举清单（与生产同源：直接 import 生产数据模块，杜绝手抄漂移）——
const CRAFT_TYPE_KEYS = ['wallpaper', 'poster', 'card', 'postcard', 'template'];
const CRAFT_STYLE_KEYS = ['guofeng', 'feiyi', 'minimal', 'qinghua', 'dunhuang', 'ink', 'neon', 'festive'];
const LAYOUT_KEYS = Object.keys(LAYOUTS);
const PALETTE_KEYS = ['靛蓝', '米白', '赭石', '朱砂', '黛青', '绛红', '竹青', '月白', '赭黄', '石绿', '藤黄', '水墨'];
const hotNames = CRAFT_PRODUCTS.filter(p => p.hot).slice(0, 16).map(p => p.name).join('/');
const PRODUCT_NAMES = new Set(CRAFT_PRODUCTS.map(p => p.name));

// —— buildIdeaPrompt：与 js/ai-craft.js generateIdeaCraft 逐字一致（勿改动）——
function buildIdeaPrompt(idea, artCtx) {
  const typeKeys = CRAFT_TYPE_KEYS.join('/');
  const styleKeys = CRAFT_STYLE_KEYS.join('/');
  return [
    '你是"AI+文旅文创"平台的文创设计顾问，为用户想法定制文创衍生品方案。',
    artCtx.title ? '用户正在为作品《' + artCtx.title + '》设计文创衍生品。' : '',
    artCtx.themeName ? '作品所属文化主题：「' + artCtx.themeName + '」' + (artCtx.themeFact ? '。主题事实：' + artCtx.themeFact : '') + (artCtx.creationTip ? '。设计语言建议：' + artCtx.creationTip : '') : '',
    '用户想法：「' + idea + '」。',
    '硬性要求：title 与 subtitle 必须紧扣作品主题与用户想法进行融合创作，禁止脱离作品主题凭空发挥。',
    '请严格输出一个 JSON 对象（禁止 markdown 代码块、禁止任何多余文字），字段如下：',
    'title：文创标题，6-16 个汉字，必须体现作品主题元素；',
    'subtitle：副标题文案，8-20 个汉字，呼应主题意境；',
    'productName：从 [' + hotNames + '] 等文创产品中推荐最匹配的一项具体产品名，直接输出产品名；',
    'craftType：从 [' + typeKeys + '] 中选与 productName 形态最匹配的一项；',
    'style：从 [' + styleKeys + '] 中选最匹配的一项；',
    'layout：从 [' + LAYOUT_KEYS.join('/') + '] 中选与 craftType 匹配的一项，craftType 为 template 时输出空字符串；',
    'palette：2-3 个传统色名，从 [' + PALETTE_KEYS.join('/') + '] 中选，JSON 字符串数组；',
    'scenes：0-2 个分镜对象数组，每项为 {"desc":"10-24 字分镜画面描述","slot":"main 或 scene"}；',
    'stickers：0-3 个契合主题的 emoji 装饰，JSON 字符串数组。'
  ].filter(Boolean).join('\n');
}

// —— 生产同源的 artCtx 构建（ai-craft.js L805-816：hay = title + tags，蒸馏无 tags）——
function buildArtCtx(artworkTitle) {
  const artCtx = { title: '', themeName: '', themeFact: '', creationTip: '' };
  artCtx.title = artworkTitle || '';
  const theme = artworkTitle ? matchThemeByText(artworkTitle) : null;
  if (theme) {
    artCtx.themeName = theme.name;
    artCtx.themeFact = (theme.facts && theme.facts[0]) || '';
    artCtx.creationTip = theme.creationTip || '';
  }
  return { artCtx, theme };
}

// —— 标注校验规范化（数据清洗环节：确定性知识库推导，非编造）——
// 教师偶发缺陷模式（实测）：productName 给了但 craftType 漏输出/空串；
// productName→canvasType 是知识库内建映射，确定性补齐后再进校验
function normalize(plan) {
  if (!plan || typeof plan !== 'object') return plan;
  const prod = typeof plan.productName === 'string' ? getProductByName(plan.productName) : null;
  if (prod && !CRAFT_TYPE_KEYS.includes(plan.craftType)) {
    plan.craftType = prod.canvasType;
  }
  // layout 缺失/非法但 craftType 合法：取该类型第一个版式（LAYOUTS 定义顺序即默认推荐）
  if (CRAFT_TYPE_KEYS.includes(plan.craftType) && plan.craftType !== 'template'
    && !LAYOUT_TYPE_MAP[plan.layout]) {
    plan.layout = LAYOUT_KEYS.find(k => LAYOUT_TYPE_MAP[k].includes(plan.craftType));
  }
  return plan;
}

// —— 结构校验（9 字段全量 + productName 知识库命中 + 贴题校验）——
const HAN_RE = /[\u4e00-\u9fa5]/g;
const han = (s) => (String(s || '').match(HAN_RE) || []).length;
const LAYOUT_TYPE_MAP = Object.fromEntries(LAYOUT_KEYS.map(k => [k, LAYOUTS[k].craftTypes]));

function validate(plan, seed, theme) {
  if (!plan || typeof plan !== 'object') return '非对象';
  if (typeof plan.title !== 'string') return 'title 缺失';
  const hn = han(plan.title);
  if (hn < 6 || hn > 16) return `标题汉字数 ${hn} 不在 6-16`;
  if (typeof plan.subtitle !== 'string') return 'subtitle 缺失';
  const hsub = han(plan.subtitle);
  if (hsub < 8 || hsub > 20) return `副标题汉字数 ${hsub} 不在 8-20`;
  // productName：新增硬校验，必须命中全品类知识库
  if (typeof plan.productName !== 'string' || !PRODUCT_NAMES.has(plan.productName)) return `productName 未命中知识库: ${plan.productName}`;
  if (!CRAFT_TYPE_KEYS.includes(plan.craftType)) return `craftType 非法: ${plan.craftType}`;
  if (!CRAFT_STYLE_KEYS.includes(plan.style)) return `style 非法: ${plan.style}`;
  if (plan.craftType === 'template') {
    if (plan.layout) return `template 不应有 layout: ${plan.layout}`;
  } else {
    if (!LAYOUT_TYPE_MAP[plan.layout]) return `layout 缺失或非法: ${plan.layout}`;
    if (!LAYOUT_TYPE_MAP[plan.layout].includes(plan.craftType)) return `layout ${plan.layout} 与 craftType ${plan.craftType} 不匹配`;
  }
  if (!Array.isArray(plan.palette) || plan.palette.length < 2 || plan.palette.length > 3) return 'palette 非法（需 2-3 个）';
  if (plan.palette.some(c => !PALETTE_KEYS.includes(c))) return `palette 含非法色名: ${plan.palette.join(',')}`;
  if (!Array.isArray(plan.scenes) || plan.scenes.length > 2) return 'scenes 非法（0-2 个）';
  for (const s of plan.scenes) {
    if (!s || typeof s !== 'object' || typeof s.desc !== 'string') return 'scenes 项缺 desc';
    const hd = han(s.desc);
    if (hd < 10 || hd > 24) return `scenes desc 汉字数 ${hd} 不在 10-24`;
    if (s.slot !== 'main' && s.slot !== 'scene') return `scenes slot 非法: ${s.slot}`;
  }
  if (!Array.isArray(plan.stickers) || plan.stickers.length > 3) return 'stickers 非法';
  // 贴题校验（教师示范样本必须贴题，学生才有得学）：
  // 2-gram 重叠法——主题名/keywords/作品标题 的任意连续 2 字出现在 title 中即视为扣题
  // （修复：完整 keyword 匹配漏掉「银饰蝶舞」扣《苗族银饰》这类子串命中）
  if (theme) {
    const refs = [theme.name, ...theme.keywords, seed.artworkTitle].filter(Boolean);
    const hit = refs.some(ref => {
      for (let i = 0; i + 2 <= ref.length; i++) {
        if (plan.title.includes(ref.slice(i, i + 2))) return true;
      }
      return false;
    });
    if (!hit) return `贴题校验失败: 「${plan.title}」未扣主题《${theme.name}》`;
  }
  return null;
}

// —— 教师调用：qwen-max（DashScope 兼容模式）/ deepseek-chat（OpenAI 兼容模式）——
async function dashscopeText(prompt, temperature) {
  if (teacher === 'deepseek') {
    const r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: 500
      })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(`deepseek-chat 调用失败 ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
    return d?.choices?.[0]?.message?.content || '';
  }
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
  const msg = d?.output?.choices?.[0]?.message;
  if (typeof msg?.content === 'string') return msg.content;
  return d?.output?.text || '';
}

// —— 主流程 ——
const seedsPath = new URL('./seeds-v6.jsonl', import.meta.url);
const outPath = shardIdx >= 0
  ? new URL(`./candidates-v6.shard${shardIdx}.jsonl`, import.meta.url)
  : new URL('./candidates-v6.jsonl', import.meta.url);
let seeds = readFileSync(seedsPath, 'utf8').trim().split('\n').map(l => JSON.parse(l));
if (shardIdx >= 0) seeds = seeds.filter((_, i) => i % shardTotal === shardIdx);

// 断点续跑：以 (artworkTitle|idea) 为去重键
const done = new Set();
if (resume && existsSync(outPath)) {
  for (const line of readFileSync(outPath, 'utf8').trim().split('\n')) {
    if (!line) continue;
    try { const r = JSON.parse(line); done.add(`${r.artworkTitle}|${r.idea}`); } catch { /* 忽略坏行 */ }
  }
  console.log(`续跑模式：已完成 ${done.size} 条种子`);
}

let ok = 0, bad = 0, skipped = 0, onTopic = 0;
const seedsToRun = limit > 0 ? seeds.slice(0, limit) : seeds;
for (const seed of seedsToRun) {
  const key = `${seed.artworkTitle}|${seed.idea}`;
  if (resume && done.has(key)) { skipped++; continue; }
  const { artCtx, theme } = buildArtCtx(seed.artworkTitle);
  const prompt = buildIdeaPrompt(seed.idea, artCtx);
  try {
    let accepted = false;
    for (let attempt = 0; attempt < 2 && !accepted; attempt++) {
      const text = await dashscopeText(prompt, attempt === 0 ? 0.2 : 0.5);
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) { if (attempt === 1) console.error(`\n无JSON [${seed.idea}] 原文: ${text.slice(0, 100)}`); continue; }
      const plan = normalize(JSON.parse(m[0]));
      const err = validate(plan, seed, theme);
      if (err) { if (attempt === 1) console.error(`\n校验失败 [${seed.idea}]: ${err}`); continue; }
      const ordered = {
        title: plan.title, subtitle: plan.subtitle, productName: plan.productName,
        craftType: plan.craftType, style: plan.style,
        layout: plan.craftType === 'template' ? '' : plan.layout,
        palette: plan.palette, scenes: plan.scenes, stickers: plan.stickers
      };
      if (theme) onTopic++;
      appendFileSync(outPath, JSON.stringify({
        instruction: prompt, output: JSON.stringify(ordered),
        idea: seed.idea, themeId: seed.themeId, artworkTitle: seed.artworkTitle
      }) + '\n');
      ok++;
      accepted = true;
      process.stdout.write(`\r蒸馏进度 ok=${ok} bad=${bad} 贴题=${onTopic} / ${seedsToRun.length}`);
    }
    if (!accepted) bad++;
  } catch (e) {
    bad++;
    console.error(`\n失败 [${seed.idea}]: ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 400));
}
console.log(`\n完成：合格 ${ok} 条（其中主题贴题 ${onTopic}）→ candidates-v6.jsonl，不合格 ${bad} 条，续跑跳过 ${skipped} 条`);
