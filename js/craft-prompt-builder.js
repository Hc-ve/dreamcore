// ============================================================
// js/craft-prompt-builder.js — 整图创作提示词组装器（纯函数，无 DOM）
// 职责（四阶段商业链路 · 阶段②）：
//   v6 自研模型输出结构化方案（style/palette/title/subtitle，幕后策划），
//   本模块把「用户想法 + v6 方案」确定性组装成 qwen-image-3.0 整图重绘提示词。
// 设计依据（坑9 教训）：
//   风格/艺术指导必须前置 prompt 开头 + "重新上色、重塑笔触"强指令，
//   负面词压制原图写实感，否则 I2I 原图主导性会吃掉画风指令。
// ============================================================

/** 艺术指导关键词（与识别逻辑同源；宽松先行防漏识别） */
const ART_DIRECTION_KEYWORDS = [
  '画风', '风格', '色彩', '色调', '配色', '构图', '排版', '质感', '光影',
  '背景', '氛围', '笔触', '留白', '对比度', '插画', '手绘', '写实', '阴影',
  '字体', '标题', '纹理', '晕染', '极简', '复古', '高清', '4K'
];

/**
 * 判断用户想法是否为详细艺术指导（≥30 字，或命中 ≥2 个艺术关键词）
 * @param {string} idea
 * @returns {boolean}
 */
export function detectArtDirection(idea) {
  const s = String(idea || '').trim();
  if (s.length >= 30) return true;
  if (s.length < 8) return false;
  let hits = 0;
  for (const kw of ART_DIRECTION_KEYWORDS) {
    if (s.includes(kw)) hits++;
    if (hits >= 2) return true;
  }
  return false;
}

/** 画风视觉库：v6 style 枚举 → 整图绘制的画风描述段（比 STYLE_LOCKS 更完整的画面语法） */
const STYLE_VISUALS = {
  guofeng: '国风工笔画风格，温润东方美学，宣纸质感，柔和自然光影，细腻线条',
  feiyi: '中国非遗纹样装饰画风格，浓郁民族色彩，织物与刺绣质感，图腾纹样',
  minimal: '现代极简风格，大面积留白，干净构图，柔和光线，块面化处理',
  qinghua: '青花瓷纹样风格，靛蓝与米白配色，瓷绘笔触，雅致留白',
  dunhuang: '敦煌壁画风格，矿物颜料质感，大漠丝路气象，斑驳肌理，暖褐基调',
  ink: '水墨风插画，大面积留白，极简手绘水墨晕染质感，柔和边缘，简约块面化处理，淡淡的纸张纹理，象牙白色纸底',
  neon: '赛博霓虹夜景风格，冷暖光对比，未来都市光影，高饱和发光色',
  festive: '节庆国潮插画风格，红金配色，喜庆氛围，精致细节'
};

/** 传统色 → 色彩基调描述（v6 palette 字段映射） */
const PALETTE_NOTES = {
  '靛蓝': '靛蓝主调', '米白': '米白柔和底色', '赭石': '赭石暖调', '朱砂': '朱砂点睛',
  '黛青': '黛青冷调', '绛红': '绛红浓郁', '竹青': '竹青清新', '月白': '月白素雅',
  '赭黄': '赭黄温润', '石绿': '石绿雅致', '藤黄': '藤黄明快', '水墨': '墨色浓淡层次'
};

/** 通用质感收尾参数（所有模式共用） */
const QUALITY_SUFFIX = '4K 高清，细腻绘画质感，干净画面，构图稳定，氛围感强，无畸形物体';

/** 基础压制词（负面提示词；注意 model 文字模式下不能压制"文字"本身，但可压制乱码/错拼） */
const NEGATIVE_BASE = '照片写实感,原样复制,摄影质感,水印,logo,杂乱杂物,扭曲变形,错误拼写,乱码字母,字形变形';

/**
 * 组装整图重绘提示词
 * @param {object} p
 * @param {string} p.idea - 用户想法原文
 * @param {object} p.plan - v6 结构化方案 { title, subtitle, style, palette }
 * @param {'model'|'canvas'} [p.textMode] - 文字生成方式：model=AI 绘制图上文字；canvas=后期 Canvas 排版（图上无文字）
 * @param {string} [p.userNegative] - 用户自定义负面词（逗号分隔）
 * @returns {{ prompt: string, negativePrompt: string }}
 */
export function buildImagePrompt({ idea, plan, textMode = 'model', userNegative = '' }) {
  const ideaStr = String(idea || '').trim();
  const planStyle = plan && plan.style && STYLE_VISUALS[plan.style] ? plan.style : (plan && plan.style) || '';
  const visual = STYLE_VISUALS[planStyle] || STYLE_VISUALS.guofeng;
  const parts = [];

  // 1. 最高优先级前置：用户详细艺术指导 逐字透传（坑9：前置才能压过 I2I 原图主导性）
  if (detectArtDirection(ideaStr)) {
    parts.push(`用户艺术指导（最高优先级，逐字严格执行）：${ideaStr}。`);
    parts.push(`辅助画风基调：${visual}。`);
  } else {
    parts.push(`${visual}。${ideaStr ? `创作主题与要点：${ideaStr}。` : ''}`);
  }

  // 2. 整图重绘强指令（重新上色/重塑笔触，防原图写实感复辟；保留原图构图骨架与主体元素位置）
  parts.push('在以上指导下对原图完整重新绘制整幅画面：重新上色、重塑笔触与质感，提炼画面核心视觉符号，仅保留原图的构图骨架与主体元素位置');

  // 3. 色彩基调（v6 palette 映射；无则省略，交由画风段主导）
  if (plan && Array.isArray(plan.palette)) {
    const notes = plan.palette.map(c => PALETTE_NOTES[c] || c).filter(Boolean).slice(0, 3);
    if (notes.length) parts.push(`色彩基调：${notes.join('，')}，整体色调和谐统一`);
  }

  // 4. 文字指令（双模式）
  const title = String((plan && plan.title) || '').trim();
  const subtitle = String((plan && plan.subtitle) || '').trim();
  if (textMode === 'model') {
    const hasAsciiTitle = title && /[a-zA-Z]{3,}/.test(title);
    const titlePart = hasAsciiTitle
      ? `首行为优雅的手写风格英文标题「${title}」`
      : `首行为优雅的手写风格英文标题（将「${title || '作品主题'}」译为简洁诗意的英文短语）`;
    const subPart = subtitle
      ? (/[a-zA-Z]{3,}/.test(subtitle)
        ? `，次行为字号更小的无衬线英文短句「${subtitle}」`
        : `，次行为字号更小的无衬线英文短句（将「${subtitle}」译为一句英文描述）`)
      : '';
    parts.push(`画面最底端居中排版两行文字：${titlePart}${subPart}，文字清晰优雅、不遮挡画面主体，所有单词必须拼写正确、字母完整不变形，除这两行外画面不出现任何其他文字`);
  } else {
    parts.push('画面中不出现任何文字、字母、数字与排版元素（文字将由系统后期叠加）');
  }

  // 5. 质感收尾
  parts.push(QUALITY_SUFFIX);

  // 负面词：canvas 模式追加文字压制；model 模式绝不压制文字（否则模型不画标题）
  const neg = [NEGATIVE_BASE];
  if (textMode === 'canvas') neg.push('文字,字母');
  if (userNegative) neg.push(String(userNegative).trim());

  return { prompt: parts.join('。'), negativePrompt: neg.join(',') };
}

/**
 * 提示词改进建议（缺失维度检测 → 可点击追加的建议 chips）
 * @param {string} idea - 用户当前想法
 * @returns {Array<{ label: string, append: string }>} 建议列表（最多 6 条，空 = 已足够详细）
 */
export function suggestPromptImprovements(idea) {
  const s = String(idea || '');
  const out = [];
  const has = (...kws) => kws.some(k => s.includes(k));

  if (!has('画风', '风格', '水墨', '工笔', '国风', '青花', '霓虹', '插画', '水彩', '极简', '国潮', '壁画'))
    out.push({ label: '🎨 补充画风', append: '水墨风插画，极简手绘水墨晕染质感' });
  if (!has('构图', '分版', '对称', '满幅', '留白', '排版'))
    out.push({ label: '🖼 补充构图', append: '大面积留白，简约块面化处理' });
  if (!has('色', '色调', '配色', '调'))
    out.push({ label: '🎨 补充色彩', append: '低对比度，柔光，温柔复古色调' });
  if (!has('高清', '4K', '质感', '纹理'))
    out.push({ label: '✨ 补充质感', append: '4K高清，细腻绘画质感，淡淡的纸张纹理' });
  if (!has('文字', '标题', '字体', '英文'))
    out.push({ label: '🔤 说明文字', append: '画面底端居中排版手写体英文标题' });
  return out.slice(0, 6);
}
