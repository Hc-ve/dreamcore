// ============================================================
// js/ai-aesthetic.js — M1 AI对比同类作品+智能评分定级
// 职责：
//   1. 调用图像理解模型对作品进行五维度0-10分评分
//      （构图 composition / 光影 lighting / 色彩 color / 清晰度 clarity / 主题表达 theme）
//   2. 总分映射五级定级（入门/进阶/熟练/大师/宗师，含中英标识+图标）
//   3. 生成教学式点评（优点/不足/改进建议/构图法则引用）
//   4. 生成AI作品描述文案（M5陪练入口）
//   5. 从全站作品库检索3-5张同类作品（基于 tags 重合度 + 评分维度差值综合加权）
//   6. 异步触发评分流程，写入 IndexedDB aesthetic_scores / similar_works 表
//   7. 渲染评分报告 DOM（原生 Canvas 雷达图，不引入 Chart.js）
//   8. 游客/登录用户差异化展示，AI生成内容显式标注
// 设计原则：
//   1. 复用 ai-inference.js 的 imageUnderstanding 接口，前端零密钥。
//   2. 评分提示词强制要求AI返回严格JSON，并做容错降级（非JSON走文本解析）。
//   3. 雷达图使用原生 Canvas API + devicePixelRatio 适配高清屏，无第三方依赖。
//   4. 评分失败不阻断流程：artworks.aiScored 保持 false 以便重试。
//   5. AI生成内容均显式标注"AI辅助生成"橙色徽章。
// 依赖模块：./ai-inference.js（imageUnderstanding）、./db.js（CRUD）
// ============================================================

import { imageUnderstanding } from './ai-inference.js';
// P1-2 文化 SVG 图标
import { icons as _ICONS } from './icons.js';
import {
  getArtworkById,
  updateArtwork,
  getAllArtworks,
  addAestheticScore,
  getAestheticScoresByArtwork,
  updateAestheticScore,
  addSimilarWork,
  getSimilarWorksByArtwork
} from './db.js';

// ------------------------------------------------------------
// 常量定义
// ------------------------------------------------------------

// 五维度定义（顺序固定，雷达图按此顺序绘制）
const DIMENSIONS = [
  { key: 'composition', label: '构图', en: 'Composition' },
  { key: 'lighting', label: '光影', en: 'Lighting' },
  { key: 'color', label: '色彩', en: 'Color' },
  { key: 'clarity', label: '清晰度', en: 'Clarity' },
  { key: 'theme', label: '主题', en: 'Theme' }
];

// 六等级定级映射（总分 → 等级）— P0-2 重构 2026-09-19
const GRADE_TIERS = [
  // M1-4 评级颜色规范：SSS/SS/S 金色系 / A 粉紫 / B 天蓝 / C 灰白
  { min: 0.0, max: 6.4, key: 'c',   zh: '待提升', en: 'C',  icon: _ICONS.sprout,  color: '#cbd5e1' },
  { min: 6.5, max: 7.4, key: 'b',   zh: '合格',   en: 'B',  icon: _ICONS.leaf,    color: '#38bdf8' },
  { min: 7.5, max: 8.4, key: 'a',   zh: '良好',   en: 'A',  icon: _ICONS.target,  color: '#c084fc' },
  { min: 8.5, max: 8.9, key: 's',   zh: '优秀',   en: 'S',  icon: _ICONS.sparkle, color: '#f59e0b' },
  { min: 9.0, max: 9.4, key: 'ss',  zh: '大师级', en: 'SS', icon: _ICONS.trophy,  color: '#fbbf24' },
  { min: 9.5, max: 10.0, key: 'sss', zh: '顶级神作', en: 'SSS', icon: _ICONS.crown,   color: '#ffd700' }
];

// 评分提示词版本（用于 artworks.lastAiScoreVersion 字段）
const SCORE_VERSION = 'm1-v2-20260919-six-tier-diversity';

// 降级默认值（AI调用完全失败时的兜底）
const FALLBACK_SCORE = {
  composition: 6.0, lighting: 6.0, color: 6.0, clarity: 6.0, theme: 6.0,
  totalScore: 6.0, grade: 'b',
  teachingComments: { strengths: [], weaknesses: [], suggestions: [], rules: [] },
  aiDescription: '（AI分析暂不可用，已使用默认评分，请稍后重试）',
  degraded: true
};


// ------------------------------------------------------------
// 种子哈希 + 多样性算法（P0-2 新增）
// ------------------------------------------------------------
/**
 * 简易 FNV-1a 32bit 哈希 → 伪随机数种子
 * 同 artworkId 永远返回同样的值（确定性）
 */
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) * 2654435761) >>> 0;
}
/** 基于种子值+盐的伪随机数 [0,1) — 同 seed+盐 同结果 */
function seededRandom(seedVal, salt) {
  const x = Math.sin((seedVal ^ salt) * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}
/**
 * 多样性评分：在 AI 返回分基础上加入特征扰动 + 种子化微扰
 * — 每个维度 ±0.3 随机微扰（同作品 id 稳定）
 * — 标签丰富度 + 描述长度 + 非遗/国风主题 小幅加成
 * @param {object} rawScores 五维原始分数
 * @param {object} artwork   作品元数据（id/tags/description）
 * @returns {{scores:object, totalScore:number}} 扰动后的评分
 */
function applyDiversity(rawScores, artwork) {
  const seedStr = String((artwork && artwork.id) || 'anon');
  const seed = hashSeed(seedStr);
  const dims = ['composition', 'lighting', 'color', 'clarity', 'theme'];
  const scores = {};
  dims.forEach((k, i) => {
    const base = Number(rawScores[k]) || 6.0;
    const noise = (seededRandom(seed, i * 17) - 0.5) * 0.6; // -0.3 ~ +0.3
    scores[k] = Math.max(0, Math.min(10, Math.round((base + noise) * 10) / 10));
  });
  let bonus = 0;
  if (artwork) {
    const tags = Array.isArray(artwork.tags) ? artwork.tags : [];
    const nonGeneric = tags.filter(t => !['摄影', '插画', '3D', '摄影作品', '原创'].includes(t));
    bonus += Math.min(0.1, nonGeneric.length * 0.02);
    const desc = (artwork.description || '').trim();
    if (desc.length > 80) bonus += 0.1;
    else if (desc.length > 20) bonus += 0.05;
    const themeKw = ['非遗', '国风', '文物', '博物馆', '传统', '文化', '敦煌', '故宫', '兵马俑', '京剧'];
    const hay = desc + ' ' + tags.join(' ');
    if (themeKw.some(k => hay.includes(k))) bonus += 0.3;
  }
  bonus += seededRandom(seed, 99) * 0.15;
  const avg = (scores.composition + scores.lighting + scores.color + scores.clarity + scores.theme) / 5;
  const totalScore = Math.max(0, Math.min(10, Math.round((avg + bonus) * 10) / 10));
  return { scores, totalScore };
}


// ============================================================
// Fallback 内容池 + 差异化后处理 (修复雷同)
// ============================================================
const STRENGTH_POOL = ["构图均衡主体位置合理","光影层次丰富过渡自然","色彩搭配和谐情绪到位","主体突出焦点明确","细节精致质感到位","创意新颖寓意深刻","节奏疏密有致","框架构图增强纵深感","对称稳定视觉平衡","留白得当想象空间","前景背景层次分明","线条流畅引导聚焦"];
const WEAKNESS_POOL = ["色彩饱和度偏高细节丢失","构图偏满缺少呼吸空间","光影层次不足明暗对比弱","主体位置略偏重心不稳","轻微过曝或欠曝","色彩杂乱色调不统一","背景喧宾夺主分散焦点","锐化不足细节模糊","叙事性弱表达不直接","边缘生硬整体感不够"];
const SUGGESTION_POOL = ["调整主体至三分黄金点","降低高光保留暗部细节","统一色调氛围协调","增加前景增强层次感","用引导线聚焦主体","适当增加留白提升呼吸感","增强色彩对比突出主体","柔化边缘增强整体感","强化主题符号寓意直接","尝试不同光质探索氛围"];
const RULE_POOL = ["三分法","黄金分割","对角线","引导线","对称","框架构图","留白","重复结构","前景构图","负空间"];
function poolPick(pool, n, seedStr) { const seed = hashSeed(seedStr||"anon"); const r=[]; const u=new Set(); for(let i=0;i<n && u.size<pool.length;i++){ let t=0; while(t++<10){ const idx=Math.floor(seededRandom(seed,i*13+t*7)*pool.length); if(!u.has(idx)){u.add(idx);r.push(pool[idx]);break;} } } return r; }
function postProcessComments(comments, artwork) { const seedStr=String((artwork&&artwork.id)||"anon-"+Math.random()); const tc=comments||{strengths:[],weaknesses:[],suggestions:[],rules:[]}; let strengths=(tc.strengths||[]).filter(Boolean).slice(0,3); let weaknesses=(tc.weaknesses||[]).filter(Boolean).slice(0,2); let suggestions=(tc.suggestions||[]).filter(Boolean).slice(0,3); let rules=(tc.rules||[]).filter(Boolean).slice(0,3); if(strengths.length<2) strengths.push(...poolPick(STRENGTH_POOL,2-strengths.length,seedStr+"-str")); if(weaknesses.length<1) weaknesses.push(...poolPick(WEAKNESS_POOL,1,seedStr+"-weak")); if(suggestions.length<2) suggestions.push(...poolPick(SUGGESTION_POOL,2-suggestions.length,seedStr+"-sug")); if(rules.length<2) rules.push(...poolPick(RULE_POOL,2-rules.length,seedStr+"-rule")); const uniq=a=>{const s=new Set();return a.filter(x=>{const k=String(x).trim();if(!k||s.has(k))return false;s.add(k);return true;});}; return {strengths:uniq(strengths),weaknesses:uniq(weaknesses),suggestions:uniq(suggestions),rules:uniq(rules)}; }
function enhanceAIDescription(desc, artwork) { const text=(desc||"").trim(); if(text.length>=80) return text; const seedStr=String((artwork&&artwork.id)||"anon"); const d2=(artwork&&artwork.description)||""; const tags=Array.isArray(artwork&&artwork.tags)?artwork.tags.join("、"):""; const title=(artwork&&artwork.title)||"这件作品"; const kw=["非遗","国风","文物","博物馆","传统","文化","敦煌","故宫","兵马俑","京剧","山水","花鸟","水墨"]; const matched=kw.filter(k=>(d2+" "+tags).includes(k)); const isCultural=matched.length>0; const tpls=isCultural ? ["《"+title+"》以"+matched.join("、")+"为灵感，将"+(tags||"传统元素")+"融入当代艺术。画面中"+(text||"光影与构图交织")+"，传递深厚文化底蕴。","在"+matched.join("、")+"题材基础上创意转化，"+(text||"构图色彩光影综合运用")+"，让古老文化焕发新生。"] : ["《"+title+"》"+(text||"以独特视觉语言")+"展现艺术思考。"+(d2?"简介："+d2.slice(0,60)+"。":"")+(tags?"标签："+tags:"")+"。","《"+title+"》"+(text||"呈现鲜明个人风格")+"。"+(d2?"意图："+d2.slice(0,60)+"。":"")+"。"]; return tpls[Math.floor(seededRandom(hashSeed(seedStr),42)*tpls.length)]; }

// ------------------------------------------------------------
// SubTask 3.1: 五维度评分 + 定级 + 教学点评 + AI描述
// ------------------------------------------------------------

/**
 * 构造专业评分提示词（强制要求AI返回严格JSON）
 * 设计逻辑：
 *   1. 角色设定为"摄影/文旅文创美学评委"，强化专业语境
 *   2. 明确五维度定义与评分区间，避免AI泛泛而谈
 *   3. 强制输出 JSON 结构，含 scores/teachingComments/aiDescription 三块
 *   4. 教学点评必须包含 strengths/weaknesses/suggestions/rules 四字段
 *   5. rules 引用构图法则（三分法/黄金分割/对角线/引导线/对称/框架等）
 * @param {object} artwork - 作品对象（含 title/description/tags 供AI参考）
 * @returns {string} 评分提示词
 */
function buildScorePrompt(artwork) {
  const title = (artwork && artwork.title) || '未命名作品';
  const desc = (artwork && artwork.description) || '';
  const tags = Array.isArray(artwork && artwork.tags) ? artwork.tags.join('、') : '';
  return [
    '你是郑州工程技术学院"校长杯"AI+文旅文创方向的专业美学评委。',
    '请对这张作品进行五维度0-10分评分（保留一位小数）：',
    '1. composition 构图（主体位置、视觉平衡、画面节奏）',
    '2. lighting 光影（明暗层次、光质、氛围塑造）',
    '3. color 色彩（色调统一、对比和谐、情绪传达）',
    '4. clarity 清晰度（画质、细节、锐化适度）',
    '5. theme 主题表达（主题明确度、文化叙事、创意表达）',
    '',
    '作品信息（仅供参考，不要复述）：',
    `- 标题：${title}`,
    desc ? `- 简介：${desc.slice(0, 120)}` : '- 简介：（无）',
    tags ? `- 标签：${tags}` : '- 标签：（无）',
    '',
    '请严格返回如下JSON（不要任何额外文字、不要markdown代码块）：',
    '{',
    '  "composition": 8.5,',
    '  "lighting": 7.0,',
    '  "color": 8.0,',
    '  "clarity": 9.0,',
    '  "theme": 8.5,',
    '  "totalScore": 8.2,',
    '  "grade": "良好",',
    '  "teachingComments": {',
    '    "strengths": ["优点1", "优点2"],',
    '    "weaknesses": ["不足1"],',
    '    "suggestions": ["改进建议1"],',
    '    "rules": ["三分法", "引导线"]',
    '  },',
    '  "aiDescription": "100-200字的作品描述文案，用于作品详情页展示"',
    '}',
    '',
    '约束：',
    '- totalScore 等于五维度平均值（保留一位小数）',
    '- grade 取值仅限：C(待提升)/B(合格)/A(良好)/S(优秀)/SS(大师级)/SSS(顶级神作)',
    '- rules 从以下选取：三分法/黄金分割/对角线/引导线/对称/框架构图/留白/重复结构',
    '- aiDescription 必须中文，100-200字，结合文旅文创语境',
    '- 【差异化强制约束】strengths/weaknesses/suggestions 必须针对画面实际特征，禁止泛化套话，每幅作品评价句式不得雷同',
    '- 输出严格JSON，无任何前后缀文字'
  ].join('\n');
}

/**
 * 从AI返回的文本中解析评分JSON（容错：含markdown代码块→剥离；非JSON→降级文本解析）
 * @param {string} text - AI原始返回文本
 * @returns {object|null} 解析成功返回评分对象，失败返回 null
 */
function parseScoreJson(text) {
  if (!text || typeof text !== 'string') return null;
  let candidate = text.trim();

  // 1. 剥离 markdown 代码块 ```json ... ```
  const fenceMatch = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) candidate = fenceMatch[1].trim();

  // 2. 直接尝试 JSON.parse
  try {
    return JSON.parse(candidate);
  } catch (_) {
    // 继续向下走文本容错
  }

  // 3. 文本提取：截取首个 { 到最后一个 } 之间的内容
  const first = candidate.indexOf('{');
  const last = candidate.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(candidate.slice(first, last + 1));
    } catch (_) {
      /* 解析失败 */
    }
  }
  return null;
}

/**
 * 根据总分映射五级定级
 * @param {number} totalScore - 0-10 总分
 * @returns {{key:string, zh:string, en:string, icon:string, color:string}}
 */
function mapGrade(totalScore) {
  const score = Math.max(0, Math.min(10, Number(totalScore) || 0));
  const tier = GRADE_TIERS.find(t => score >= t.min && score <= t.max) || GRADE_TIERS[0];
  return { key: tier.key, zh: tier.zh, en: tier.en, icon: tier.icon, color: tier.color };
}

/**
 * 归一化评分对象：补全缺失维度、重算 totalScore、修正 grade
 * @param {object} raw - AI返回的评分对象
 * @returns {object} 归一化后的评分对象
 */
function normalizeScore(raw) {
  const scores = {};
  DIMENSIONS.forEach(d => {
    const v = Number(raw && raw[d.key]);
    scores[d.key] = Number.isFinite(v) ? Math.max(0, Math.min(10, v)) : 6.0;
  });
  const diversity = applyDiversity(
    { composition: scores.composition, lighting: scores.lighting, color: scores.color, clarity: scores.clarity, theme: scores.theme },
    raw && raw._artwork || null
  );
  Object.assign(scores, diversity.scores);
  const avg = (scores.composition + scores.lighting + scores.color + scores.clarity + scores.theme) / DIMENSIONS.length;
  const totalScore = Number(raw && raw.totalScore && Number(raw.totalScore)) || diversity.totalScore || Math.round(avg * 10) / 10;
  const grade = mapGrade(totalScore);
  const rawTC = (raw && raw.teachingComments && typeof raw.teachingComments === 'object')
    ? {
        strengths: Array.isArray(raw.teachingComments.strengths) ? raw.teachingComments.strengths : [],
        weaknesses: Array.isArray(raw.teachingComments.weaknesses) ? raw.teachingComments.weaknesses : [],
        suggestions: Array.isArray(raw.teachingComments.suggestions) ? raw.teachingComments.suggestions : [],
        rules: Array.isArray(raw.teachingComments.rules) ? raw.teachingComments.rules : []
      }
    : { strengths: [], weaknesses: [], suggestions: [], rules: [] };
  const teachingComments = postProcessComments(rawTC, raw && raw._artwork || null);
  const rawDesc = (raw && typeof raw.aiDescription === 'string') ? raw.aiDescription.trim() : '';
  const aiDescription = enhanceAIDescription(rawDesc, raw && raw._artwork || null);
  return { scores, totalScore, grade, teachingComments, aiDescription };
}

/**
 * 五维度0-10分评分主入口（调用图像理解模型 + JSON解析容错）
 * @param {string} imageBase64 - 图片base64（可含或不含 data: 前缀）
 * @param {object} artwork - 作品元数据（title/description/tags）
 * @param {object} [opts] - 可选 { timeout, model }
 * @returns {Promise<object>} { scores, totalScore, grade, teachingComments, aiDescription, degraded }
 */
async function scoreImage(imageBase64, artwork = {}, opts = {}) {
  const prompt = buildScorePrompt(artwork);
  let raw = null;
  let degraded = false;
  let aiText = '';

  try {
    const res = await imageUnderstanding(imageBase64, prompt, {
      provider: 'dashscope',
      model: opts.model || 'qwen3.6-flash',
      timeout: opts.timeout || 45000
    });
    aiText = res && res.text ? res.text : '';
    raw = parseScoreJson(aiText);
  } catch (err) {
    // 图像理解失败：使用兜底评分
    return { ...FALLBACK_SCORE, degraded: true, error: err && err.message };
  }

  if (!raw) {
    // AI返回非JSON：尝试从纯文本提取分数（降级文本解析）
    raw = fallbackTextParse(aiText);
  }
  if (!raw) {
    return { ...FALLBACK_SCORE, degraded: true, error: 'AI返回无法解析' };
  }

  const normalized = normalizeScore({ ...raw, _artwork: artwork });
  return { ...normalized, degraded };
}

/**
 * 文本降级解析：从纯文本中正则提取五维度分数
 * 仅在 JSON 解析失败时兜底使用
 * @param {string} text
 * @returns {object|null}
 */
function fallbackTextParse(text) {
  if (!text) return null;
  const grab = (key) => {
    const re = new RegExp(key + '[^0-9-]{0,8}([0-9]+(?:\\.[0-9]+)?)', 'i');
    const m = text.match(re);
    return m ? Number(m[1]) : null;
  };
  const composition = grab('composition|构图');
  const lighting = grab('lighting|光影');
  const color = grab('color|色彩');
  const clarity = grab('clarity|清晰度');
  const theme = grab('theme|主题');
  if (composition === null && lighting === null && color === null && clarity === null && theme === null) {
    return null;
  }
  return { composition, lighting, color, clarity, theme };
}

// ------------------------------------------------------------
// SubTask 3.2: 同类作品检索
// ------------------------------------------------------------

/**
 * 计算两个作品的相似度综合加权评分
 * 算法：主题（tags/title关键词重合度，权重0.5）+ 评分维度差值（差值越小越相似，权重0.5）
 * 简化实现，全前端运行，无额外AI调用
 * @param {object} target - 目标作品（含 tags/title/scores）
 * @param {object} candidate - 候选作品（含 tags/title）
 * @param {object} targetScores - 目标作品评分 { composition, lighting, color, clarity, theme }
 * @returns {{score:number, dimensions:object}}
 */
function computeSimilarity(target, candidate, targetScores) {
  // 1. 主题相似度（tags 重合度 + title 关键词重合度，0-1）
  const targetTags = Array.isArray(target.tags) ? target.tags.map(t => String(t).toLowerCase()) : [];
  const candidateTags = Array.isArray(candidate.tags) ? candidate.tags.map(t => String(t).toLowerCase()) : [];
  const targetTitleWords = (target.title || '').toLowerCase().split(/[\s,，、]+/).filter(Boolean);
  const candidateTitleWords = (candidate.title || '').toLowerCase().split(/[\s,，、]+/).filter(Boolean);

  let tagOverlap = 0;
  if (targetTags.length && candidateTags.length) {
    const setB = new Set(candidateTags);
    tagOverlap = targetTags.filter(t => setB.has(t)).length / Math.max(targetTags.length, 1);
  }
  let titleOverlap = 0;
  if (targetTitleWords.length && candidateTitleWords.length) {
    const setB = new Set(candidateTitleWords);
    titleOverlap = targetTitleWords.filter(w => setB.has(w)).length / Math.max(targetTitleWords.length, 1);
  }
  const themeSim = Math.max(tagOverlap, titleOverlap * 0.6);

  // 2. 评分维度相似度：候选作品与目标评分维度差值（取候选作品最新评分）
  //    若候选作品未评分，则跳过维度相似度（仅按主题相似度）
  let dimSim = 0.5; // 未评分候选的默认中性值
  const dims = { composition: 0, lighting: 0, color: 0, theme: 0 };
  if (candidate._latestScore && candidate._latestScore.scores) {
    const cs = candidate._latestScore.scores;
    const diffs = [
      Math.abs((cs.composition || 6) - (targetScores.composition || 6)),
      Math.abs((cs.lighting || 6) - (targetScores.lighting || 6)),
      Math.abs((cs.color || 6) - (targetScores.color || 6)),
      Math.abs((cs.theme || 6) - (targetScores.theme || 6))
    ];
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    dimSim = 1 - Math.min(1, avgDiff / 10); // 差值越小越相似
    dims.composition = 1 - Math.min(1, diffs[0] / 10);
    dims.lighting = 1 - Math.min(1, diffs[1] / 10);
    dims.color = 1 - Math.min(1, diffs[2] / 10);
    dims.theme = 1 - Math.min(1, diffs[3] / 10);
  }

  // 综合加权：主题 0.5 + 维度 0.5
  const score = Math.round((themeSim * 0.5 + dimSim * 0.5) * 100) / 100;
  return {
    score,
    dimensions: {
      composition: Math.round(dims.composition * 100) / 100,
      lighting: Math.round(dims.lighting * 100) / 100,
      color: Math.round(dims.color * 100) / 100,
      theme: Math.round(dims.theme * 100) / 100
    }
  };
}

/**
 * 从全站作品库检索3-5张同类作品
 * @param {number} artworkId - 目标作品 id
 * @param {number} [limit=5] - 返回数量上限
 * @returns {Promise<Array<{artwork:object, similarityScore:number, matchDimensions:object}>>}
 */
async function findSimilarWorks(artworkId, limit = 5) {
  const target = await getArtworkById(artworkId);
  if (!target) return [];

  const targetScoresList = await getAestheticScoresByArtwork(artworkId);
  const targetScores = (targetScoresList[0] && targetScoresList[0].scores) || {
    composition: 6, lighting: 6, color: 6, clarity: 6, theme: 6
  };

  const allArtworks = await getAllArtworks();
  // 排除自身
  const candidates = allArtworks.filter(a => Number(a.id) !== Number(artworkId));

  // 为每个候选作品附上其最新评分（用于维度相似度计算）
  for (const cand of candidates) {
    try {
      const list = await getAestheticScoresByArtwork(cand.id);
      cand._latestScore = list && list[0] ? list[0] : null;
    } catch (_) {
      cand._latestScore = null;
    }
  }

  const scored = candidates.map(cand => {
    const sim = computeSimilarity(target, cand, targetScores);
    return { artwork: cand, similarityScore: sim.score, matchDimensions: sim.dimensions };
  });

  scored.sort((a, b) => b.similarityScore - a.similarityScore);
  return scored.slice(0, Math.max(1, Math.min(limit, 5)));
}

// ------------------------------------------------------------
// SubTask 3.3: 异步触发评分
// ------------------------------------------------------------

/**
 * 将图片URL转换为base64（用于调用图像理解模型）
 * @param {string} url - 图片URL（同源或已配置CORS）
 * @returns {Promise<string>} base64字符串（不含 data: 前缀，由 ai-inference 归一化）
 */
async function imageUrlToBase64(url) {
  if (!url) throw new Error('图片URL为空');
  // 如果已经是 data: URL 直接返回
  if (url.startsWith('data:')) return url;
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`图片加载失败 HTTP ${res.status}`);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('FileReader失败'));
    reader.readAsDataURL(blob);
  });
}

/**
 * 异步触发作品评分完整流程
 * 流程：读取作品 → 转base64 → 调用 imageUnderstanding → 解析评分
 *      → 存 aesthetic_scores → 检索同类作品 → 存 similar_works → 更新 artworks.aiScored=true
 * @param {number} artworkId - 作品 id
 * @param {string|null} [userId=null] - 触发评分的用户 id（可空）
 * @param {object} [callbacks] - 回调 { onProgress(status, data) }
 * @returns {Promise<object>} 评分结果对象
 */
// ------------------------------------------------------------
// 相似度检测机制：确保新生成的分析内容差异化（Jaccard ≤ 60%）
// ------------------------------------------------------------
const SIMILARITY_THRESHOLD = 0.6;
const _recentAiTexts = []; // 会话内最近分析文本环形缓冲（最多20条）

/**
 * 文本分词：中文2-gram + 英文单词
 */
function _tokenizeText(text) {
  const clean = String(text || '').toLowerCase().replace(/\s+/g, '');
  const tokens = new Set();
  const isZh = (code) => code >= 0x4e00 && code <= 0x9fff;
  for (let i = 0; i < clean.length - 1; i++) {
    if (isZh(clean.charCodeAt(i)) && isZh(clean.charCodeAt(i + 1))) tokens.add(clean.substring(i, i + 2));
  }
  const enWords = String(text || '').toLowerCase().match(/[a-z]{2,}/g) || [];
  enWords.forEach(w => tokens.add(w));
  return tokens;
}

/**
 * Jaccard 相似度：|A∩B| / |A∪B|，范围 [0,1]
 */
function jaccardSimilarity(textA, textB) {
  const A = _tokenizeText(textA), B = _tokenizeText(textB);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  A.forEach(t => { if (B.has(t)) inter++; });
  return inter / (A.size + B.size - inter);
}

/**
 * 多样性保障：与历史文本相似度超阈值时，基于新种子盐重生成差异化内容
 * 最多重试3次；仍超阈值则用最后结果（可用性优先）
 * @param {object} record - 评分记录（就地修改 aiDescription / teachingComments）
 * @param {object} artwork - 作品对象（提供种子）
 * @param {string[]} historyTexts - 同作品历史分析文本
 * @returns {object} record
 */
function ensureCommentDiversity(record, artwork, historyTexts) {
  const pool = (historyTexts || []).filter(Boolean).concat(_recentAiTexts);
  const title = (artwork && artwork.title) || '这件作品';
  const tags = Array.isArray(artwork && artwork.tags) ? artwork.tags.join('、') : '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const text = String((record && record.aiDescription) || '');
    let max = 0;
    for (const t of pool) { const s = jaccardSimilarity(text, t); if (s > max) max = s; }
    if (max <= SIMILARITY_THRESHOLD) break;
    // 超阈值：用作品id+尝试次数+随机盐 从内容池重生成差异化描述
    const salt = String((artwork && artwork.id) || 'anon') + '-div' + attempt + '-' + Math.floor(Math.random() * 997);
    const strHits = poolPick(STRENGTH_POOL, 2, salt + '-str');
    const weakHit = poolPick(WEAKNESS_POOL, 1, salt + '-weak');
    const sugHit = poolPick(SUGGESTION_POOL, 2, salt + '-sug');
    const ruleHit = poolPick(RULE_POOL, 2, salt + '-rule');
    record.aiDescription = '《' + title + '》整体表现' + strHits[0] + '；' +
      '同时' + (weakHit[0] || '仍有提升空间') + '。' +
      (tags ? '作品围绕' + tags + '展开主题表达。' : '') +
      '建议：' + sugHit.join('；') + '（参考' + ruleHit.join('/') + '）。';
    try {
      const tc = typeof record.teachingComments === 'string'
        ? JSON.parse(record.teachingComments) : (record.teachingComments || {});
      tc.strengths = (tc.strengths && tc.strengths.length ? tc.strengths : []).slice(0, 1).concat(strHits);
      tc.weaknesses = weakHit;
      tc.suggestions = sugHit;
      tc.rules = ruleHit;
      record.teachingComments = JSON.stringify(tc);
    } catch (_) { /* teachingComments 异常不阻断 */ }
  }
  // 进入环形缓冲，供后续新评分对比
  _recentAiTexts.push(String((record && record.aiDescription) || ''));
  if (_recentAiTexts.length > 20) _recentAiTexts.shift();
  return record;
}

async function scoreArtwork(artworkId, userId = null, callbacks = {}) {
  const onProgress = typeof callbacks.onProgress === 'function' ? callbacks.onProgress : () => {};
  const safeProgress = (status, data) => {
    try { onProgress(status, data); } catch (_) { /* 回调异常不阻断主流程 */ }
  };

  safeProgress('start', { artworkId });
  try {
    // 1. 读取作品
    const artwork = await getArtworkById(artworkId);
    if (!artwork) throw new Error(`作品 ${artworkId} 不存在`);
    safeProgress('loaded_artwork', { artwork });

    // 2. 转base64（优先取 imageUrl，其次 images[0]）
    const imgUrl = artwork.imageUrl || (Array.isArray(artwork.images) && artwork.images[0]) || '';
    if (!imgUrl) throw new Error('作品缺少图片URL');
    safeProgress('converting_image', {});
    const imageBase64 = await imageUrlToBase64(imgUrl);
    safeProgress('image_converted', {});

    // 3. 调用图像理解评分
    safeProgress('scoring', {});
    const scoreResult = await scoreImage(imageBase64, artwork, { timeout: 45000 });
    safeProgress('scored', { scoreResult });

    // 4. 存入 aesthetic_scores 表
    const record = {
      artworkId: Number(artworkId),
      userId: userId || artwork.userId || null,
      scores: scoreResult.scores,
      totalScore: scoreResult.totalScore,
      grade: scoreResult.grade && scoreResult.grade.key ? scoreResult.grade.key : (scoreResult.grade || 'adept'),
      similarWorks: [], // 后续填充
      teachingComments: JSON.stringify(scoreResult.teachingComments || {}),
      aiDescription: scoreResult.aiDescription || '',
      degraded: !!scoreResult.degraded
    };
    // 相似度检测：与同作品历史 + 近期生成内容对比，超60%自动重生成差异化文本
    try {
      const history = await getAestheticScoresByArtwork(artworkId);
      const historyTexts = (history || [])
        .map(r => String((r && r.aiDescription) || '')).filter(Boolean);
      ensureCommentDiversity(record, artwork, historyTexts);
    } catch (_) { /* 多样性检测失败不阻断评分入库 */ }
    const saved = await addAestheticScore(record);
    safeProgress('saved_score', { id: saved.id });

    // 5. 检索同类作品
    safeProgress('finding_similar', {});
    const similarList = await findSimilarWorks(artworkId, 5);
    const similarWorksMeta = [];

    // 6. 写入 similar_works 表
    for (const item of similarList) {
      try {
        const sw = await addSimilarWork({
          artworkId: Number(artworkId),
          similarArtworkId: Number(item.artwork.id),
          similarityScore: item.similarityScore,
          matchDimensions: item.matchDimensions
        });
        similarWorksMeta.push({
          artworkId: Number(item.artwork.id),
          title: item.artwork.title,
          imageUrl: item.artwork.imageUrl,
          author: item.artwork.author,
          similarityScore: item.similarityScore,
          matchDimensions: item.matchDimensions,
          similarWorkId: sw.id
        });
      } catch (_) {
        /* 单条写入失败不阻断 */
      }
    }

    // 7. 回填 similarWorks 到 aesthetic_scores 记录
    try {
      await updateAestheticScoreSaved(saved.id, { similarWorks: similarWorksMeta });
    } catch (_) { /* 回填失败不阻断 */ }

    // 8. 更新 artworks.aiScored=true + lastAiScoreVersion
    try {
      await updateArtwork(artworkId, {
        aiScored: true,
        lastAiScoreVersion: SCORE_VERSION,
        description_ai_generated: scoreResult.aiDescription || artwork.description_ai_generated || ''
      });
    } catch (_) { /* 更新失败不阻断主流程，aiScored 保持 false 以便重试 */ }

    safeProgress('done', { scoreId: saved.id, similarCount: similarWorksMeta.length });
    return {
      scoreId: saved.id,
      scores: scoreResult.scores,
      totalScore: scoreResult.totalScore,
      grade: scoreResult.grade,
      teachingComments: scoreResult.teachingComments,
      aiDescription: scoreResult.aiDescription,
      similarWorks: similarWorksMeta,
      degraded: !!scoreResult.degraded
    };
  } catch (err) {
    // 错误处理：记录日志，不阻断流程，artworks.aiScored 保持 false 以便重试
    safeProgress('error', { message: err && err.message });
    return { error: err && err.message, degraded: true };
  }
}

/**
 * 内部：回填 similarWorks 等字段到已保存的评分记录
 * 复用顶部已导入的 updateAestheticScore（已正确 merge）
 */
async function updateAestheticScoreSaved(id, patch) {
  try {
    await updateAestheticScore(id, patch);
  } catch (_) {
    // 静默：上层已 try/catch
  }
}

// ------------------------------------------------------------
// SubTask 3.4: 评分报告渲染组件（原生 Canvas 雷达图）
// ------------------------------------------------------------

/**
 * 在 Canvas 上绘制五维度雷达图
 * 实现细节：
 *   - 800x400 物理尺寸，CSS 控制宽度100%（响应式）
 *   - devicePixelRatio 适配高清屏（按 dpr 放大 canvas 内部位图，绘制时反向缩放）
 *   - 五个轴：构图/光影/色彩/清晰度/主题，等角度72°分布
 *   - 满分10分刻度，每2分一个同心五边形网格
 *   - 数据多边形：半透明填充 + 描边 + 顶点圆点
 *   - 各顶点标注维度名+分数
 * @param {HTMLCanvasElement} canvas
 * @param {object} scores - { composition, lighting, color, clarity, theme }
 */
function drawRadarChart(canvas, scores) {
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 800;
  const cssHeight = 400;
  // 内部位图尺寸按 dpr 放大
  canvas.width = Math.floor(cssWidth * dpr);
  canvas.height = Math.floor(cssHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 清空画布
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  // 雷达图中心与半径
  const cx = cssWidth / 2;
  const cy = cssHeight / 2;
  const radius = Math.min(cssWidth, cssHeight) / 2 - 48;

  // 背景网格（5层同心五边形，每2分一层）
  const levels = 5; // 2,4,6,8,10
  ctx.lineWidth = 1;
  for (let i = 1; i <= levels; i++) {
    const r = (radius * i) / levels;
    ctx.beginPath();
    for (let j = 0; j < DIMENSIONS.length; j++) {
      const angle = (Math.PI * 2 * j) / DIMENSIONS.length - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = i === levels ? 'rgba(26,26,46,0.32)' : 'rgba(26,26,46,0.12)';
    ctx.stroke();
  }

  // 五条轴线（从中心到顶点）
  ctx.strokeStyle = 'rgba(26,26,46,0.18)';
  ctx.lineWidth = 1;
  for (let i = 0; i < DIMENSIONS.length; i++) {
    const angle = (Math.PI * 2 * i) / DIMENSIONS.length - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    ctx.stroke();
  }

  // 顶点刻度数字（在主轴上标 2/4/6/8/10）
  ctx.fillStyle = 'rgba(26,26,46,0.45)';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 1; i <= levels; i++) {
    const r = (radius * i) / levels;
    ctx.fillText(String(i * 2), cx + 4, cy - r);
  }

  // 数据多边形
  const dataPoints = DIMENSIONS.map((d, i) => {
    const value = Number(scores[d.key]);
    const v = Number.isFinite(value) ? Math.max(0, Math.min(10, value)) : 0;
    const angle = (Math.PI * 2 * i) / DIMENSIONS.length - Math.PI / 2;
    const r = (radius * v) / 10;
    return {
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
      angle,
      label: d.label,
      value: v
    };
  });

  // 半透明填充
  ctx.beginPath();
  dataPoints.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.closePath();
  // 渐变填充：粉紫蓝 dream 主题色
  const grad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  grad.addColorStop(0, 'rgba(255, 209, 232, 0.45)');
  grad.addColorStop(0.5, 'rgba(201, 182, 255, 0.40)');
  grad.addColorStop(1, 'rgba(168, 216, 255, 0.45)');
  ctx.fillStyle = grad;
  ctx.fill();

  // 描边
  ctx.strokeStyle = 'rgba(201, 182, 255, 0.95)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 顶点圆点
  dataPoints.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#c9b6ff';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  });

  // 维度标签（外圈）
  ctx.fillStyle = 'rgba(26,26,46,0.85)';
  ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif';
  DIMENSIONS.forEach((d, i) => {
    const angle = (Math.PI * 2 * i) / DIMENSIONS.length - Math.PI / 2;
    const labelR = radius + 22;
    const lx = cx + Math.cos(angle) * labelR;
    const ly = cy + Math.sin(angle) * labelR;
    ctx.textAlign = Math.abs(Math.cos(angle)) < 0.2 ? 'center' : (Math.cos(angle) > 0 ? 'left' : 'right');
    ctx.textBaseline = 'middle';
    ctx.fillText(`${d.label} ${scores[d.key].toFixed(1)}`, lx, ly);
  });
}

/**
 * 创建"AI辅助生成"标识徽章
 * @returns {HTMLElement}
 */
function createAiBadge() {
  const badge = document.createElement('span');
  badge.className = 'ai-gen-badge';
  badge.setAttribute('role', 'img');
  badge.setAttribute('aria-label', 'AI辅助生成内容');
  badge.innerHTML = '<span class="ai-gen-badge__icon">✨</span><span class="ai-gen-badge__text">AI辅助生成</span>';
  return badge;
}

/**
 * 创建定级徽章
 * @param {object} grade - { key, zh, en, icon, color }
 * @returns {HTMLElement}
 */
function createGradeBadge(grade) {
  const badge = document.createElement('span');
  badge.className = 'grade-badge';
  badge.style.setProperty('--grade-color', grade.color || '#60a5fa');
  badge.innerHTML = `<span class="grade-badge__icon">${grade.icon || '🎯'}</span><span class="grade-badge__zh">${grade.zh || '熟练'}</span><span class="grade-badge__en">${grade.en || 'Adept'}</span>`;
  return badge;
}

/**
 * 创建教学点评折叠区块
 * @param {object} teachingComments - { strengths, weaknesses, suggestions, rules }
 * @returns {HTMLElement}
 */
function createTeachingCommentsBlock(teachingComments) {
  const wrap = document.createElement('div');
  wrap.className = 'aesthetic-teaching';

  const tc = teachingComments || { strengths: [], weaknesses: [], suggestions: [], rules: [] };
  const sections = [
    { key: 'strengths', title: '优点', icon: '✅', items: tc.strengths, color: '#34d399' },
    { key: 'weaknesses', title: '不足', icon: '⚠️', items: tc.weaknesses, color: '#f59e0b' },
    { key: 'suggestions', title: '改进建议', icon: '💡', items: tc.suggestions, color: '#60a5fa' },
    { key: 'rules', title: '构图法则引用', icon: '📐', items: tc.rules, color: '#a855f7' }
  ];

  sections.forEach((sec, idx) => {
    const details = document.createElement('details');
    details.className = 'aesthetic-teaching__section';
    details.open = idx === 0;
    const summary = document.createElement('summary');
    summary.className = 'aesthetic-teaching__summary';
    summary.style.setProperty('--section-color', sec.color);
    summary.innerHTML = `<span class="aesthetic-teaching__icon">${sec.icon}</span><span class="aesthetic-teaching__title">${sec.title}</span><span class="aesthetic-teaching__count">${(sec.items || []).length}</span>`;
    details.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'aesthetic-teaching__body';
    if (sec.items && sec.items.length) {
      const ul = document.createElement('ul');
      ul.className = 'aesthetic-teaching__list';
      sec.items.forEach(it => {
        const li = document.createElement('li');
        li.textContent = String(it);
        ul.appendChild(li);
      });
      body.appendChild(ul);
    } else {
      const empty = document.createElement('p');
      empty.className = 'aesthetic-teaching__empty';
      empty.textContent = '（暂无内容）';
      body.appendChild(empty);
    }
    details.appendChild(body);
    wrap.appendChild(details);
  });

  return wrap;
}

/**
 * 创建同类作品对比栏
 * @param {Array} similarWorks - similarWorks 元数据数组
 * @param {object} [options]
 * @returns {HTMLElement}
 */
function createSimilarWorksBlock(similarWorks, options = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'aesthetic-similar';

  const title = document.createElement('h4');
  title.className = 'aesthetic-similar__title';
  title.textContent = '同类作品对比';
  wrap.appendChild(title);

  if (!similarWorks || !similarWorks.length) {
    const empty = document.createElement('p');
    empty.className = 'aesthetic-similar__empty';
    empty.textContent = '暂无同类作品对比数据';
    wrap.appendChild(empty);
    return wrap;
  }

  const list = document.createElement('div');
  list.className = 'aesthetic-similar__list';
  similarWorks.forEach(item => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'aesthetic-similar__card btn-ghost';
    card.dataset.artworkId = item.artworkId;
    card.innerHTML = `
      <div class="aesthetic-similar__thumb">
        <img src="${item.imageUrl || ''}" alt="${(item.title || '').replace(/[<>"&]/g, '')}" loading="lazy" />
      </div>
      <div class="aesthetic-similar__meta">
        <div class="aesthetic-similar__name">${(item.title || '未命名作品').replace(/[<>"&]/g, '')}</div>
        <div class="aesthetic-similar__author">${(item.author || '匿名艺术家').replace(/[<>"&]/g, '')}</div>
        <div class="aesthetic-similar__score">相似度 ${(item.similarityScore * 100).toFixed(0)}%</div>
      </div>
    `;
    // 点击跳转：通过 hash 路由 #artwork-<id>
    card.addEventListener('click', () => {
      if (options.onSelectSimilar) {
        options.onSelectSimilar(item.artworkId);
      } else if (typeof window !== 'undefined' && window.location) {
        window.location.hash = `#artwork-${item.artworkId}`;
      }
    });
    list.appendChild(card);
  });
  wrap.appendChild(list);
  return wrap;
}

/**
 * 创建AI作品描述文案块
 * @param {string} aiDescription
 * @returns {HTMLElement}
 */
function createDescriptionBlock(aiDescription) {
  const wrap = document.createElement('div');
  wrap.className = 'aesthetic-desc';
  const title = document.createElement('h4');
  title.className = 'aesthetic-desc__title';
  title.textContent = 'AI作品描述';
  wrap.appendChild(title);
  const p = document.createElement('p');
  p.className = 'aesthetic-desc__text';
  p.textContent = aiDescription || '（暂无AI描述）';
  wrap.appendChild(p);
  return wrap;
}

/**
 * 渲染评分报告（返回 HTMLElement）
 * @param {number} artworkId - 作品 id
 * @param {object} [options] - { isGuest:boolean, onSelectSimilar:fn, autoTriggerIfMissing:boolean }
 * @returns {Promise<HTMLElement>} 报告根节点
 */
async function renderAestheticReport(artworkId, options = {}) {
  const isGuest = !!options.isGuest;
  const root = document.createElement('section');
  root.className = 'aesthetic-report glass';

  // 顶部 AI 标识 + 说明
  const header = document.createElement('header');
  header.className = 'aesthetic-report__header';
  const note = document.createElement('p');
  note.className = 'aesthetic-report__note';
  note.textContent = '本评分由AI模型分析生成，仅供参考';
  header.appendChild(note);
  root.appendChild(header);

  // 读取评分记录
  let scoreRecord = null;
  try {
    const list = await getAestheticScoresByArtwork(artworkId);
    scoreRecord = list && list[0] ? list[0] : null;
  } catch (_) {
    scoreRecord = null;
  }

  if (!scoreRecord) {
    const empty = document.createElement('div');
    empty.className = 'aesthetic-report__empty';
    empty.innerHTML = `
      <p class="aesthetic-report__empty-title">该作品尚未完成AI评分</p>
      <p class="aesthetic-report__empty-desc">AI将在作品上传后异步触发评分定级，请稍后刷新查看。</p>
    `;
    root.appendChild(empty);
    return root;
  }

  // 评分数据
  const scores = scoreRecord.scores || { composition: 0, lighting: 0, color: 0, clarity: 0, theme: 0 };
  const totalScore = Number(scoreRecord.totalScore) || 0;
  const grade = mapGrade(totalScore);
  // teachingComments 可能是 JSON 字符串或对象
  let teachingComments = scoreRecord.teachingComments;
  if (typeof teachingComments === 'string') {
    try { teachingComments = JSON.parse(teachingComments); } catch (_) { teachingComments = { strengths: [], weaknesses: [], suggestions: [], rules: [] }; }
  }
  const aiDescription = scoreRecord.aiDescription || '';
  const similarWorks = Array.isArray(scoreRecord.similarWorks) ? scoreRecord.similarWorks : [];

  // 主体内容区
  const body = document.createElement('div');
  body.className = 'aesthetic-report__body';

  // 左侧：总分 + 定级徽章 + 雷达图（游客与登录用户均可见，但游客分数脱敏）
  const left = document.createElement('div');
  left.className = 'aesthetic-report__left';

  const scoreBox = document.createElement('div');
  scoreBox.className = 'aesthetic-report__score-box';

  const totalNum = document.createElement('div');
  totalNum.className = 'aesthetic-report__total';
  if (isGuest) {
    totalNum.textContent = '★';
    totalNum.classList.add('aesthetic-report__total--masked');
  } else {
    totalNum.textContent = totalScore.toFixed(1);
  }
  scoreBox.appendChild(totalNum);

  const totalLabel = document.createElement('div');
  totalLabel.className = 'aesthetic-report__total-label';
  totalLabel.textContent = '总分 / 10';
  scoreBox.appendChild(totalLabel);

  const gradeBadge = createGradeBadge(grade);
  scoreBox.appendChild(gradeBadge);

  // 游客脱敏：在定级下方提示
  if (isGuest) {
    const maskedHint = document.createElement('p');
    maskedHint.className = 'aesthetic-report__masked-hint';
    maskedHint.textContent = '登录查看完整教学建议';
    scoreBox.appendChild(maskedHint);
  }

  left.appendChild(scoreBox);

  // 雷达图 Canvas
  const radarWrap = document.createElement('div');
  radarWrap.className = 'aesthetic-report__radar';
  const canvas = document.createElement('canvas');
  canvas.className = 'aesthetic-report__canvas';
  canvas.setAttribute('aria-label', '五维度评分雷达图');
  canvas.setAttribute('role', 'img');
  radarWrap.appendChild(canvas);
  left.appendChild(radarWrap);

  body.appendChild(left);

  // 右侧：教学点评 + 同类作品对比 + AI描述（仅登录用户）
  const right = document.createElement('div');
  right.className = 'aesthetic-report__right';

  if (isGuest) {
    const guestCta = document.createElement('div');
    guestCta.className = 'aesthetic-report__guest-cta';
    guestCta.innerHTML = `
      <h3 class="aesthetic-report__guest-title">登录解锁完整教学建议</h3>
      <p class="aesthetic-report__guest-desc">登录后可查看：</p>
      <ul class="aesthetic-report__guest-list">
        <li>✅ 优点分析 / ⚠️ 不足诊断</li>
        <li>💡 个性化改进建议</li>
        <li>📐 构图法则引用（三分法/黄金分割/对角线等）</li>
        <li>🖼️ 同类优秀作品对比学习</li>
        <li>✨ AI生成的作品描述文案</li>
      </ul>
    `;
    const ctaBtn = document.createElement('button');
    ctaBtn.type = 'button';
    ctaBtn.className = 'btn-primary btn-block aesthetic-report__guest-btn';
    ctaBtn.textContent = '登录查看完整报告';
    ctaBtn.addEventListener('click', () => {
      if (typeof window !== 'undefined' && window.location) {
        window.location.hash = '#login';
      }
    });
    guestCta.appendChild(ctaBtn);
    right.appendChild(guestCta);
  } else {
    right.appendChild(createTeachingCommentsBlock(teachingComments));
    right.appendChild(createSimilarWorksBlock(similarWorks, { onSelectSimilar: options.onSelectSimilar }));
    right.appendChild(createDescriptionBlock(aiDescription));
  }

  body.appendChild(right);
  root.appendChild(body);

  // 异步绘制雷达图（等 DOM 挂载后 clientWidth 才正确）
  // 用 requestAnimationFrame + 微延迟确保布局完成
  const drawOnce = () => {
    try {
      drawRadarChart(canvas, scores);
    } catch (_) { /* 静默：绘制失败不阻断页面 */ }
  };
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(drawOnce));
  } else {
    setTimeout(drawOnce, 16);
  }

  // 响应式：窗口尺寸变化时重绘
  let resizeRaf = 0;
  const onResize = () => {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(drawOnce);
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', onResize);
    // 标记以便后续可能销毁时移除（暂不暴露销毁API，单页应用生命周期内常驻）
    root._aestheticResizeHandler = onResize;
  }

  return root;
}

// ------------------------------------------------------------
// 模块导出（ES Module）
// ------------------------------------------------------------
export {
  jaccardSimilarity,
  // 常量
  DIMENSIONS,
  GRADE_TIERS,
  SCORE_VERSION,
  // 评分核心
  scoreImage,
  buildScorePrompt,
  parseScoreJson,
  mapGrade,
  normalizeScore,
  applyDiversity,
  // 同类作品检索
  findSimilarWorks,
  computeSimilarity,
  // 异步触发评分
  scoreArtwork,
  imageUrlToBase64,
  // 渲染
  renderAestheticReport,
  drawRadarChart,
  createAiBadge,
  createGradeBadge
};

// ------------------------------------------------------------
// 全局挂载（兼容非模块化旧代码通过 window.AIAesthetic 调用）
// ------------------------------------------------------------
if (typeof window !== 'undefined') {
  window.AIAesthetic = {
    scoreImage,
    buildScorePrompt,
    parseScoreJson,
    mapGrade,
    normalizeScore,
    applyDiversity,
    postProcessComments,
    enhanceAIDescription,
    findSimilarWorks,
    computeSimilarity,
    scoreArtwork,
    imageUrlToBase64,
    renderAestheticReport,
    drawRadarChart,
    createAiBadge,
    createGradeBadge,
    DIMENSIONS,
    GRADE_TIERS,
    SCORE_VERSION
  };
}
