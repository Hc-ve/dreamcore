// ============================================================
// tests/_verify-selftrained.mjs
// 目的：验证 BFF 是否真正把 ai-craft 的策划请求路由到「自研模型」(ollama)，
//       而非静默降级到云端 provider。
// 方法：用真实模块构造与 js/ai-craft.js#requestCraftPlan 逐字对齐的 prompt，
//       POST /api/ai/text-generation（provider=self-trained），检查响应 provider 字段。
// 用法：node tests/_verify-selftrained.mjs [baseUrl]
// ============================================================

import { CRAFT_PRODUCTS } from '../data/craft-products.js';
import { LAYOUTS } from '../js/craft-layout.js';

const BASE = process.argv[2] || 'http://localhost:5174';

// 与 ai-craft.js 保持一致的取值来源
const typeKeys = ['wallpaper', 'poster', 'card', 'postcard', 'template'].join('/');
const styleKeys = ['guofeng', 'feiyi', 'minimal', 'qinghua', 'dunhuang', 'ink', 'neon', 'festive'].join('/');
const hotNames = CRAFT_PRODUCTS.filter(p => p.hot).slice(0, 16).map(p => p.name).join('/');
const layoutKeys = Object.keys(LAYOUTS).join('/');

function buildPrompt(idea, title, themeName) {
  return [
    '你是"AI+文旅文创"平台的文创设计顾问，为用户想法定制文创衍生品方案。',
    title ? '用户正在为作品《' + title + '》设计文创衍生品。' : '',
    themeName ? '作品所属文化主题：「' + themeName + '」' : '',
    '用户想法：「' + idea + '」。',
    '硬性要求：title 与 subtitle 必须紧扣作品主题与用户想法进行融合创作，禁止脱离作品主题凭空发挥。',
    '请严格输出一个 JSON 对象（禁止 markdown 代码块、禁止任何多余文字），字段如下：',
    'title：文创标题，6-16 个汉字，必须体现作品主题元素；',
    'subtitle：副标题文案，8-20 个汉字，呼应主题意境；',
    'productName：从 [' + hotNames + '] 等文创产品中推荐最匹配的一项具体产品名，直接输出产品名；',
    'craftType：从 [' + typeKeys + '] 中选与 productName 形态最匹配的一项；',
    'style：从 [' + styleKeys + '] 中选最匹配的一项;',
    'layout：从 [' + layoutKeys + '] 中选与 craftType 匹配的一项，craftType 为 template 时输出空字符串；',
    'palette：2-3 个传统色名，从 [靛蓝/米白/赭石/朱砂/黛青/绛红/竹青/月白/赭黄/石绿/藤黄/水墨] 中选，JSON 字符串数组；',
    'scenes：0-2 个分镜对象数组，每项为 {"desc":"10-24 字分镜画面描述","slot":"main 或 scene"}；',
    'stickers：0-3 个契合主题的 emoji 装饰，JSON 字符串数组。'
  ].filter(Boolean).join('\n');
}

async function call(idea, title, themeName) {
  const prompt = buildPrompt(idea, title, themeName);
  const t0 = Date.now();
  const r = await fetch(`${BASE}/api/ai/text-generation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, provider: 'self-trained', maxTokens: 500, temperature: 0.2, timeout: 25000 })
  });
  const d = await r.json().catch(() => ({}));
  const ms = Date.now() - t0;
  return { status: r.status, ms, d };
}

const cases = [
  ['做成书签', '青绿千里江山', '中国山水画'],
  ['做一组明信片', '敦煌飞天壁画', '敦煌文化']
];

for (const [idea, title, theme] of cases) {
  const { status, ms, d } = await call(idea, title, theme);
  const text = d.text || d.error || '';
  const m = (text || '').match(/\{[\s\S]*\}/);
  let plan = null;
  try { plan = m ? JSON.parse(m[0]) : null; } catch (_) {}
  console.log('==================================================');
  console.log(`想法：「${idea}」 / 作品：《${title}》`);
  console.log(`HTTP ${status} | 耗时 ${ms}ms | provider=${d.provider || '(缺失)'}`);
  console.log('原始返回:', text.slice(0, 400).replace(/\n/g, ' '));
  if (plan) {
    console.log('解析 JSON:', JSON.stringify(plan, null, 0));
    // schema 校验（与训练数据 acceptance 对齐）
    const bad = [];
    if (typeof plan.title !== 'string' || plan.title.length < 2) bad.push('title');
    if (typeof plan.subtitle !== 'string') bad.push('subtitle');
    if (!plan.productName) bad.push('productName');
    if (!typeKeys.split('/').includes(plan.craftType)) bad.push('craftType=' + plan.craftType);
    if (!styleKeys.split('/').includes(plan.style)) bad.push('style=' + plan.style);
    if (plan.craftType !== 'template' && !layoutKeys.split('/').includes(plan.layout)) bad.push('layout=' + plan.layout);
    if (!Array.isArray(plan.palette)) bad.push('palette');
    console.log(bad.length ? '❌ schema 偏差: ' + bad.join(' , ') : '✅ schema 全字段合规');
  } else {
    console.log('❌ 未解析出 JSON（可能为云端降级或模型未按 schema 输出）');
  }
}
console.log('==================================================');
