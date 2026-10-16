// ============================================================
// synthesize-story-v5.mjs — v5 讲解任务蒸馏脚本（qwen-max 教师）
// 三种任务与生产 /api/ai/culture-story prompt 对齐：
//   - open       → buildStoryPromptOpen（景区/景点/扩展地标）
//   - colloquial → buildStoryPromptColloquial（泛称口语化问法，指令多样化）
//   - facts      → buildStoryPromptWithFacts（核心 12 主题事实卡注入防幻觉）
// 产出 story-candidates-v5.jsonl：{instruction, output, system, task, themeId, subject}
// 用法（项目根目录运行）：
//   node training-data/craft-instruct/synthesize-story-v5.mjs [--resume] [--limit N]
// ============================================================
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { getThemeById } from '../../data/culture-knowledge.js';

const args = process.argv.slice(2);
const resume = args.includes('--resume');
const limitArg = args.find(a => a.startsWith('--limit'));
const limit = limitArg
  ? Number(limitArg.includes('=') ? limitArg.split('=')[1] : args[args.indexOf(limitArg) + 1]) || 0
  : 0;

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

// —— 与 ai-proxy.mjs 逐字一致（勿改动，训练/推理对齐的关键）——
const STORY_SYSTEM = '你是一位严谨的博物馆金牌讲解员。你的讲解必须完全基于给定材料忠实转述，严禁编造史实、年代、数字与人名；材料中没有的信息用概括性语言带过，不许杜撰。输出必须是严格的 JSON，不要 markdown 代码块。';

const SCHEMA_LINE = '{"name":"主体名","era":"一句话年代（不确定写 年代不详）","connotation":"文化内涵讲解，180-280字，2-3个自然段（用\\n分段）","legend":"相关的经典典故或背景故事，100-160字，没有可靠典故则概括其文化意义","creationTip":"文创创作建议，50字以内"}';

function buildStoryPromptWithFacts(theme) {
  const facts = theme.facts.map((f) => `- ${f}`).join('\n');
  const legends = theme.legends.map((l) => `- ${l}`).join('\n');
  return [
    `【文化主题】${theme.name}（${theme.era}，${theme.region}）`,
    '',
    '【已核实的事实卡（讲解的唯一事实来源）】',
    facts,
    '',
    '【经典典故（legend 字段从中选取一条转述）】',
    legends,
    '',
    `请基于以上事实卡，为文化主题《${theme.name}》撰写讲解词，严格只返回如下 JSON：`,
    '{"name":"主题名","era":"一句话年代","connotation":"文化内涵讲解，180-280字，2-3个自然段（用\\n分段）","legend":"最经典的一个典故，100-160字","creationTip":"文创创作建议，50字以内"}',
    '硬性要求：connotation 与 legend 中出现的所有年代、数字、人名、地名必须来自事实卡；不得新增任何史实细节。'
  ].join('\n');
}

function buildStoryPromptOpen(subject, description) {
  return [
    `请介绍文化主体「${subject}」${description ? `（图片描述：${description}）` : ''}的历史与文化内涵。`,
    '',
    '严格只返回如下 JSON：',
    SCHEMA_LINE,
    '要求：内容需准确可靠，不确定的信息不要编造，年代与数字仅在确有把握时给出。'
  ].join('\n');
}

function buildStoryPromptColloquial(question) {
  return [
    question,
    '',
    '严格只返回如下 JSON：',
    SCHEMA_LINE,
    '要求：内容需准确可靠，不确定的信息不要编造，年代与数字仅在确有把握时给出。'
  ].join('\n');
}

// —— 讲解 JSON 结构校验（与 synthesize-story.mjs / story_accept.py 逐字对齐）——
const HAN_RE = /[\u4e00-\u9fa5]/g;
const han = (s) => (String(s || '').match(HAN_RE) || []).length;
function validateStory(story) {
  if (!story || typeof story !== 'object') return '非对象';
  for (const k of ['name', 'era', 'connotation', 'legend', 'creationTip']) {
    if (typeof story[k] !== 'string' || !story[k].trim()) return `${k} 缺失或非字符串`;
  }
  if (han(story.name) < 2) return 'name 过短';
  if (han(story.connotation) < 120 || han(story.connotation) > 300) return `connotation 汉字数 ${han(story.connotation)} 不在 120-300`;
  if (han(story.legend) < 60 || han(story.legend) > 190) return `legend 汉字数 ${han(story.legend)} 不在 60-190`;
  if (han(story.creationTip) > 60) return 'creationTip 汉字数超限';
  if (!story.connotation.includes('\n')) return 'connotation 未分段';
  return null;
}

async function dashscopeText(prompt, temperature) {
  const r = await fetch(`${BASE}/services/aigc/text-generation/generation`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen-max',
      input: { messages: [{ role: 'system', content: STORY_SYSTEM }, { role: 'user', content: prompt }] },
      parameters: { max_tokens: 1024, temperature }
    })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(`qwen-max 调用失败 ${r.status}: ${JSON.stringify(d).slice(0, 200)}`);
  const msg = d?.output?.choices?.[0]?.message;
  if (typeof msg?.content === 'string') return msg.content;
  return d?.output?.text || '';
}

// —— 主流程 ——
const seedsPath = new URL('./story-seeds-v5.jsonl', import.meta.url);
const outPath = new URL('./story-candidates-v5.jsonl', import.meta.url);
const seeds = readFileSync(seedsPath, 'utf8').trim().split('\n').map(l => JSON.parse(l));

// 断点续跑：以 (task, themeId, subject, sample) 为去重键
const done = new Set();
if (resume && existsSync(outPath)) {
  for (const line of readFileSync(outPath, 'utf8').trim().split('\n')) {
    if (!line) continue;
    try {
      const r = JSON.parse(line);
      done.add(`${r.task}|${r.themeId}|${r.subject}|${r.sample ?? 0}`);
    } catch { /* 忽略坏行 */ }
  }
  console.log(`续跑模式：已完成 ${done.size} 条种子`);
}

let ok = 0, bad = 0, skipped = 0;
const seedsToRun = limit > 0 ? seeds.slice(0, limit) : seeds;
for (const seed of seedsToRun) {
  const key = `${seed.task}|${seed.themeId}|${seed.subject}|${seed.sample ?? 0}`;
  if (resume && done.has(key)) { skipped++; continue; }
  const theme = seed.themeId ? getThemeById(seed.themeId) : null;
  const prompt = seed.task === 'facts' && theme
    ? buildStoryPromptWithFacts(theme)
    : seed.task === 'colloquial'
      ? buildStoryPromptColloquial(seed.question)
      : buildStoryPromptOpen(seed.subject, seed.description || '');
  try {
    let accepted = false;
    for (let attempt = 0; attempt < 2 && !accepted; attempt++) {
      const temp = attempt === 0 ? (seed.task === 'facts' ? 0.2 : 0.5) : 0.8;
      const text = await dashscopeText(prompt, temp);
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) { if (attempt === 1) console.error(`\n无JSON [${seed.subject}] 原文: ${text.slice(0, 120)}`); continue; }
      const story = JSON.parse(m[0]);
      const err = validateStory(story);
      if (err) { if (attempt === 1) console.error(`\n校验失败 [${seed.subject}]: ${err}`); continue; }
      const ordered = {
        name: story.name, era: story.era,
        connotation: story.connotation, legend: story.legend, creationTip: story.creationTip
      };
      const sample = {
        instruction: prompt, output: JSON.stringify(ordered), system: STORY_SYSTEM,
        task: seed.task, themeId: seed.themeId, subject: seed.subject, sample: seed.sample ?? 0
      };
      appendFileSync(outPath, JSON.stringify(sample) + '\n');
      ok++;
      accepted = true;
      process.stdout.write(`\r蒸馏进度 ok=${ok} bad=${bad} / ${seedsToRun.length}`);
    }
    if (!accepted) bad++;
  } catch (e) {
    bad++;
    console.error(`\n失败 [${seed.subject}]: ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 400));
}
console.log(`\n完成：合格 ${ok} 条 → story-candidates-v5.jsonl，不合格 ${bad} 条，续跑跳过 ${skipped} 条`);
