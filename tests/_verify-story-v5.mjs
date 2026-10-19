/**
 * Dreamcore 自研讲解模型端到端验证（BFF 链路）
 * 目的：确认 /api/ai/culture-story 的首位降级项 self-trained 真正命中
 *       dreamcraft-story-1.5b:v5，而不是回落到 dashscope。
 * 对应后端：netlify/functions/ai-proxy.mjs#handleCultureStory（STORY_CHAIN 首位 self-trained）
 *
 * 运行：node tests/_verify-story-v5.mjs [baseUrl]   （默认 http://localhost:5173）
 * 前置：ollama serve 在跑 且 ollama list 含 dreamcraft-story-1.5b:v5
 */
const BASE = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '');

// 场景1：OOD 主体（无事实卡）→ buildStoryPromptOpen → 自研 open prompt
// 场景2：核心主题（命中事实卡）→ buildStoryPromptWithFacts → 事实卡注入防幻觉
const CASES = [
  { label: 'OOD 主体 / 中山陵（open prompt）', body: { subject: '中山陵' } },
  { label: '核心主题 / 三星堆（事实卡注入）', body: { themeId: 'sanxingdui' } },
  { label: '核心主题 / 三星堆（文本匹配）', body: { subject: '三星堆' } },
];

const han = (s) => ((s || '').match(/[\u4e00-\u9fa5]/g) || []).length;
let pass = 0;

console.log(`\n=== 自研讲解链路端到端验证 — ${BASE} ===\n`);
for (const c of CASES) {
  const t0 = Date.now();
  try {
    const r = await fetch(`${BASE}/api/ai/culture-story`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c.body),
    });
    const text = await r.text();
    let d;
    try { d = JSON.parse(text); } catch { d = { _raw: text.slice(0, 200) }; }
    const dt = Date.now() - t0;
    if (!r.ok) {
      console.log(`❌ [${c.label}] HTTP ${r.status} — ${d.error || text.slice(0, 120)}`);
      continue;
    }
    // 结构校验：5 字段 + knowledgeBase/provider/themeId/themeName
    const fields = ['name', 'era', 'connotation', 'legend', 'creationTip'];
    const missing = fields.filter((f) => !d[f]);
    const okProvider = d.provider === 'self-trained';
    // BFF 护栏阈值：connotation ≥110 汉字、legend ≥60 汉字（isValidStoryOutput）
    const okLen = han(d.connotation) >= 110 && han(d.legend) >= 60;
    const ok = missing.length === 0 && okProvider && okLen;
    if (ok) pass++;
    console.log(`${ok ? '✅' : '❌'} [${c.label}] ${dt}ms`);
    console.log(`   provider=${d.provider}  knowledgeBase=${d.knowledgeBase}  themeId=${d.themeId || '-'}`);
    console.log(`   name="${d.name}"  era="${d.era}"`);
    console.log(`   connotation=${han(d.connotation)}字  legend=${han(d.legend)}字  creationTip=${han(d.creationTip)}字`);
    if (missing.length) console.log(`   ⚠ 缺字段: ${missing.join(',')}`);
    if (!okProvider) console.log(`   ⚠ 未走自研（降级了）— provider=${d.provider}`);
    console.log(`   解说节选: ${String(d.connotation).replace(/\n/g, ' ').slice(0, 80)}…`);
  } catch (e) {
    console.log(`❌ [${c.label}] 异常 — ${e.message}`);
  }
  console.log('');
}
console.log(`=== 结果：${pass}/${CASES.length} 走自研模型且结构合规 ===`);
process.exit(pass === CASES.length ? 0 : 1);
