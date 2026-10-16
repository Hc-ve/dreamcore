// ============================================================
// js/ai-knowledge.js — AI修图·内置案例知识库与智能优化引擎
// 职责：
//   1. 图像特征提取（亮度/对比度/饱和度/色偏/锐度/过曝欠曝比）
//   2. 内置案例知识库（文旅摄影专家经验案例，含特征匹配函数与调参处方）
//   3. 智能决策引擎（多案例加权合成 → 优化方案 plan）
//   4. 像素级增强管线（Minkowski白平衡 → 自适应色阶 → YCbCr振动饱和 → 亮度USM+色度降噪）
//      分块异步执行，支持进度回调与取消
// 设计原则：
//   1. 纯前端 Canvas 像素运算，零网络依赖、零密钥，离线可用
//   2. 案例经验显式可解释：每个决策都引用命中的案例与置信度
//   3. 增强管线按行分块 yield，保证 UI 进度实时刷新且可取消
//   4. 处理尺寸限制 ≤900×600，保证响应及时（比赛演示标准）
//   5. 色彩质量守卫：主导色场景不做白平衡中和；振动饱和保色相；
//      只锐化亮度不放大彩色噪点——确保优化后色彩自然协调、画面干净
// ============================================================

// ------------------------------------------------------------
// 一、图像特征提取
// ------------------------------------------------------------

/**
 * 从图像（HTMLImageElement / HTMLCanvasElement）提取统计特征
 * 内部先降采样到 ≤260px 宽的临时画布再统计，保证毫秒级完成
 * @param {HTMLImageElement|HTMLCanvasElement} img
 * @returns {object} features 特征向量
 *   brightness  亮度均值 0~255
 *   contrast    亮度标准差 0~128
 *   saturation  HSL 饱和度均值 0~1
 *   colorCast   色偏 {r,g,b}（各通道相对灰均值的偏差 -1~1）
 *   sharpness   边缘清晰度 0~1（Laplacian 能量归一化）
 *   overRatio   过曝像素占比 >0.02 即显著
 *   underRatio  欠曝像素占比 >0.02 即显著
 */
export function extractImageFeatures(img) {
  if (!img || !(img.width > 0) || !(img.height > 0)) {
    throw new Error('无效的图像源');
  }
  // 降采样：宽 ≤260，保持比例
  const scale = Math.min(1, 260 / img.width);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data; // 可能抛 tainted 错误，由调用方降级

  // 灰度缓冲
  const gray = new Float32Array(w * h);
  let sumR = 0, sumG = 0, sumB = 0, sumL = 0, sumS = 0, overN = 0, underN = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    sumR += r; sumG += g; sumB += b;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[p] = l; sumL += l;
    if (l > 245) overN++;
    if (l < 16) underN++;
    // HSL 饱和度（快速近似：max-min / max）
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    sumS += mx > 0 ? (mx - mn) / mx : 0;
  }
  const n = w * h;
  const avgR = sumR / n, avgG = sumG / n, avgB = sumB / n;
  const brightness = sumL / n;
  const grayAvg = (avgR + avgG + avgB) / 3;

  // 对比度 = 灰度标准差（归一到 0~1 域为 /128）
  let varSum = 0;
  for (let p = 0; p < n; p++) { const d = gray[p] - brightness; varSum += d * d; }
  const contrast = Math.sqrt(varSum / n);

  // 清晰度：Laplacian 边缘能量（内部像素），归一化
  let lapSum = 0, lapN = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      const lap = Math.abs(4 * gray[p] - gray[p - 1] - gray[p + 1] - gray[p - w] - gray[p + w]);
      lapSum += lap; lapN++;
    }
  }
  const sharpness = Math.min(1, (lapSum / Math.max(1, lapN)) / 24); // 经验归一化

  return {
    width: img.width, height: img.height,
    brightness, contrast, saturation: sumS / n,
    colorCast: { r: (avgR - grayAvg) / 128, g: (avgG - grayAvg) / 128, b: (avgB - grayAvg) / 128 },
    sharpness, overRatio: overN / n, underRatio: underN / n
  };
}

// ------------------------------------------------------------
// 二、内置案例知识库（文旅摄影/文创美学专家经验）
// 每条案例 = 场景 + 特征匹配函数(0~1) + 调参处方 + 经验文案
// ------------------------------------------------------------

const EXPERT_CASES = [
  {
    key: 'underexposed',
    name: '欠曝暗沉',
    scenario: '夜游灯光 / 室内展厅 / 博物馆弱光',
    experience: '常见于夜游与室内展馆拍摄，整体灰暗、暗部死黑；经验上先提升曝光再补对比，暗部细节适度回升即可，过度提亮会放大噪点。',
    match: (f) => {
      if (f.brightness >= 100) return 0;
      return clamp01((100 - f.brightness) / 55) * (0.55 + 0.45 * clamp01(f.underRatio / 0.12));
    },
    params: { exposure: 22, contrast: 10, saturation: 108 },
    pipeline: { wb: 0.2, levels: 0.55, vibrance: 0.35, usm: 0.45, denoise: 0.35 },
    styleKey: null, styleOnly: false,
    tip: '检测到画面整体偏暗（亮度 {b}），已参考「欠曝暗沉」案例提升曝光与暗部层次'
  },
  {
    key: 'overexposed',
    name: '高光过曝',
    scenario: '晴天户外 / 舞台灯光 / 天空反光',
    experience: '天空与灯光区域溢出后色彩信息不可逆丢失，经验上先回落整体曝光，再用色阶收缩回收高光边缘的浅层次。',
    match: (f) => f.overRatio > 0.015 ? clamp01((f.overRatio - 0.015) / 0.10) : 0,
    params: { exposure: -14, contrast: 6, saturation: 106 },
    pipeline: { wb: 0.15, levels: 0.5, vibrance: 0.3, usm: 0.3, denoise: 0.1 },
    styleKey: null,
    tip: '检测到 {p}% 高光溢出，已参考「高光过曝」案例回收亮部层次'
  },
  {
    key: 'washed-out',
    name: '灰蒙低对比',
    scenario: '阴天 / 雾天 / 空气通透度差',
    experience: '阴天雾天拍摄画面像蒙灰，经验上以自适应色阶为主拉开明暗，配合适度对比，切忌一步拉满导致层次断裂。',
    match: (f) => {
      if (f.contrast >= 52) return 0;
      return clamp01((52 - f.contrast) / 26);
    },
    params: { contrast: 16, saturation: 112 },
    pipeline: { wb: 0.25, levels: 0.8, vibrance: 0.4, usm: 0.4, denoise: 0.1 },
    styleKey: null,
    tip: '检测到画面对比度偏弱（灰蒙感），已参考「灰蒙低对比」案例增强明暗层次'
  },
  {
    key: 'desaturated',
    name: '色彩寡淡',
    scenario: '手机直出 / 压缩传播后褪色',
    experience: '经社媒压缩转存的图片饱和度普遍流失 10%~25%，经验上以振动饱和（低饱像素提得多、高饱像素提得少）还原，比全局拉饱和更自然。',
    match: (f) => {
      if (f.saturation >= 0.42) return 0;
      return clamp01((0.42 - f.saturation) / 0.22);
    },
    params: { saturation: 124, contrast: 6 },
    pipeline: { wb: 0.3, levels: 0.35, vibrance: 0.8, usm: 0.25, denoise: 0.05 },
    styleKey: null,
    tip: '检测到色彩饱和度偏低（{s}%），已参考「色彩寡淡」案例做振动饱和还原'
  },
  {
    key: 'color-cast',
    name: '白平衡偏色',
    scenario: '室内钨丝灯 / 树荫 / 水下偏蓝',
    experience: '人眼会自适应但相机不会，偏色会让文化题材的"正色"失真（如朱砂不红、石青不青）；经验上以 Shades-of-Gray（Minkowski 范数）白平衡稳健校正，再交由风格滤镜定调。',
    match: (f) => {
      const cast = Math.max(Math.abs(f.colorCast.r), Math.abs(f.colorCast.g), Math.abs(f.colorCast.b));
      if (cast < 0.055) return 0;
      return clamp01((cast - 0.055) / 0.12);
    },
    params: { saturation: 108 },
    pipeline: { wb: 0.95, levels: 0.25, vibrance: 0.25, usm: 0.25, denoise: 0.05 },
    styleKey: null,
    tip: '检测到画面存在色偏（R{r} G{g} B{bb}），已参考「白平衡偏色」案例做色彩还原'
  },
  {
    key: 'blurry',
    name: '细节模糊',
    scenario: '手抖 / 焦点偏移 / 平台压缩',
    experience: '压缩与手抖让纹理（织物纹样、錾刻肌理、建筑细节）发虚；经验上用 USM 半径 1.5、强度中高的掩模锐化恢复边缘，扁平区域同时轻降噪防止锐化噪点。',
    match: (f) => {
      if (f.sharpness >= 0.42) return 0;
      return clamp01((0.42 - f.sharpness) / 0.3);
    },
    params: { sharpness: 32, contrast: 8 },
    pipeline: { wb: 0.1, levels: 0.3, vibrance: 0.2, usm: 0.9, denoise: 0.4 },
    styleKey: null,
    tip: '检测到画面细节锐度偏低，已参考「细节模糊」案例进行 USM 细节增强'
  },
  {
    key: 'night-scene',
    name: '夜景蓝调',
    scenario: '城市夜游 / 灯光秀 / 夜市',
    experience: '夜景的优势在冷暖对比：经验上保留蓝调暗部、只提升灯光暖部饱和与锐度，配合"夜景蓝调"风格让霓虹更通透。',
    match: (f) => {
      if (f.brightness >= 85) return 0;
      const cool = f.colorCast.b - Math.max(f.colorCast.r, f.colorCast.g);
      return clamp01((85 - f.brightness) / 60) * clamp01(0.5 + cool);
    },
    params: { exposure: 8, contrast: 14, saturation: 118 },
    pipeline: { wb: 0.2, levels: 0.45, vibrance: 0.5, usm: 0.55, denoise: 0.45 },
    styleKey: 'night',
    tip: '识别为夜景蓝调场景，已参考「夜景蓝调」案例优化灯光层次并匹配夜景风格'
  },
  {
    key: 'cultural-warm',
    name: '文博暖调',
    scenario: '敦煌壁画 / 民俗节庆 / 非遗手作',
    experience: '文博题材的灵魂在暖调矿物色（赭石/朱砂/泥金）；经验上保留暖基底只做色彩还原与细节增强，避免冷调白平衡洗掉岁月感，并匹配敦煌/国风风格统一调性。',
    match: (f, s, tags) => {
      const kw = ['敦煌', '民俗', '非遗', '节庆', '纹样', '手作', '刺绣', '年画', '青铜', '泥金'];
      const hit = kw.some(k => tags.includes(k));
      const warm = f.colorCast.r > 0.02 && f.colorCast.b < 0.03;
      return clamp01((hit ? 0.6 : 0) + (warm ? 0.4 : 0) + (f.saturation > 0.45 ? 0.1 : 0));
    },
    params: { saturation: 112, contrast: 10, sharpness: 18 },
    pipeline: { wb: 0.35, levels: 0.4, vibrance: 0.45, usm: 0.6, denoise: 0.15 },
    styleKey: null, // 由 tags 决定 dunhuang/guofeng/feiyi
    styleOnly: true,
    tip: '识别为文博暖调题材，已参考「文博暖调」案例做色彩还原并推荐风格滤镜'
  },
  {
    key: 'cultural-ink',
    name: '水墨素雅',
    scenario: '水墨写意 / 园林禅境 / 古建留白',
    experience: '素雅题材最忌饱和拉高变"俗"；经验上只做细节锐化与轻微对比，压低饱和留住灰调呼吸感，匹配水墨风格统一调性。',
    match: (f, s, tags) => {
      const kw = ['水墨', '禅', '园林', '古建', '留白', '山水', '黑白'];
      const hit = kw.some(k => tags.includes(k));
      const pale = f.saturation < 0.3;
      // 仅凭"低饱和"不足以判定水墨题材（高亮浅色照片也低饱和），须有题材关键词命中
      return hit ? clamp01(0.65 + (pale ? 0.35 : 0)) : (pale ? 0.25 : 0);
    },
    params: { saturation: 96, contrast: 12, sharpness: 22 },
    pipeline: { wb: 0.15, levels: 0.4, vibrance: 0.1, usm: 0.65, denoise: 0.1 },
    styleKey: 'ink',
    tip: '识别为水墨素雅题材，已参考「水墨素雅」案例保灰调、强细节，并匹配水墨风格'
  },
  {
    key: 'well-balanced',
    name: '整体良好·轻度精修',
    scenario: '曝光色彩俱佳，仅需出片感',
    experience: '底子好的图不需要大动；经验上只做轻度色阶规整 + 低强度锐化收边，再交给风格滤镜出氛围，保持原片质感。',
    match: (f) => {
      const ok = f.brightness > 85 && f.brightness < 190 && f.contrast > 42 &&
                 f.saturation > 0.35 && f.sharpness > 0.35;
      return ok ? 0.45 : 0;
    },
    params: { contrast: 6, saturation: 106, sharpness: 12 },
    pipeline: { wb: 0.15, levels: 0.3, vibrance: 0.2, usm: 0.3, denoise: 0.05 },
    styleKey: null,
    tip: '画面基础素质良好，已参考「整体良好」案例做轻度精修提升出片质感'
  }
];

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

// ------------------------------------------------------------
// 三、智能决策引擎：特征 + 评分 + 标签 → 多案例加权合成优化方案
// ------------------------------------------------------------

/**
 * 综合图像特征、AI美学评分、作品标签，检索案例并合成优化方案
 * @param {object} features extractImageFeatures 结果
 * @param {object|null} scores 五维评分 {composition,lighting,color,clarity,theme}（可 null）
 * @param {string[]} tags 作品标签
 * @returns {object} plan {
 *   matchedCases: [{key,name,confidence,experience}],  命中案例（按置信度降序）
 *   params: {exposure,contrast,saturation,sharpness},  合成后的调参（绝对值）
 *   pipeline: {wb,levels,vibrance,usm,denoise},         增强管线强度 0~1
 *   styleKey: string|null,                              推荐风格
 *   tips: string[]                                      可解释决策文案
 * }
 */
export function synthesizePlan(features, scores, tags) {
  const tagStr = Array.isArray(tags) ? tags.join(' ') : String(tags || '');

  // 0. 主导色场景守卫：画面被单一颜色强烈主导（|色偏|>0.45，如非遗蓝染/朱砂红）
  //    属于有意配色而非白平衡失误，任何白平衡算法都不应中和主色调
  const maxCast = Math.max(Math.abs(features.colorCast.r), Math.abs(features.colorCast.g), Math.abs(features.colorCast.b));
  const isDominant = maxCast > 0.45;

  // 1. 案例匹配
  const ranked = EXPERT_CASES
    .map(c => {
      let conf = c.match(features, scores, tagStr) || 0;
      // 主导色场景：色偏案例置信度大幅衰减（主导色≠色偏）
      if (isDominant && c.key === 'color-cast') conf *= 0.3;
      // 2. AI 美学评分联动：低分维度增强对应案例置信度
      if (scores) {
        if (c.key === 'underexposed' && scores.lighting < 6) conf = Math.min(1, conf + 0.3);
        if (c.key === 'desaturated' && scores.color < 6) conf = Math.min(1, conf + 0.3);
        if (c.key === 'color-cast' && scores.color < 5.5) conf = Math.min(1, conf + 0.25);
        if (c.key === 'blurry' && scores.clarity < 6) conf = Math.min(1, conf + 0.35);
        if (c.key === 'washed-out' && scores.lighting < 5.5) conf = Math.min(1, conf + 0.2);
      }
      return { key: c.key, name: c.name, confidence: Math.round(conf * 100) / 100, case: c };
    })
    .filter(m => m.confidence >= 0.3)
    .sort((a, b) => b.confidence - a.confidence);

  // 2. 兜底：无命中案例时启用「整体良好」轻度精修
  if (!ranked.length) {
    const fallback = EXPERT_CASES.find(c => c.key === 'well-balanced');
    ranked.push({ key: fallback.key, name: fallback.name, confidence: 1, case: fallback });
  }

  const primary = ranked[0];
  const totalConf = ranked.reduce((s, m) => s + m.confidence, 0);

  // 3. 加权合成调参：主案例处方 + 次案例按置信度比例叠加
  const params = { exposure: 0, contrast: 0, saturation: 100, sharpness: 0 };
  ranked.forEach((m, i) => {
    const w = i === 0 ? 1 : (m.confidence / totalConf) * 0.6;
    const p = m.case.params;
    params.exposure += Math.round((p.exposure || 0) * w);
    params.contrast += Math.round((p.contrast || 0) * w);
    params.saturation += Math.round((p.saturation !== undefined ? p.saturation - 100 : 0) * w);
    params.sharpness += Math.round((p.sharpness || 0) * w);
  });
  params.exposure = clamp(params.exposure, -100, 100);
  params.contrast = clamp(params.contrast, -100, 100);
  // 饱和度硬性区间 [80, 140]：任何案例组合都不得输出"近乎黑白"或"俗艳"的饱和，
  // 色彩自然协调是底线（80≈轻降饱和，140≈明显增饱和，均属自然范围）
  params.saturation = clamp(params.saturation, 80, 140);
  params.sharpness = clamp(params.sharpness, 0, 100);

  // 4. 合成管线强度：取主案例强度 + 次案例按比例微调（上限 1）
  const pipeline = { wb: 0, levels: 0, vibrance: 0, usm: 0, denoise: 0 };
  Object.keys(pipeline).forEach(k => {
    let v = 0;
    ranked.forEach((m, i) => {
      const w = i === 0 ? 1 : (m.confidence / totalConf) * 0.5;
      v += (m.case.pipeline[k] || 0) * w;
    });
    pipeline[k] = Math.min(1, Math.round(v * 100) / 100);
  });

  // 4.1 主导色场景：白平衡强度大幅收缩（增益接近中性，只去除轻微冷/暖漂移）
  if (isDominant) pipeline.wb = Math.min(pipeline.wb, 0.15);

  // 4.2 防叠加：管线振动饱和与滑参饱和作用于同一目标，二者取强——
  //     振动饱和显著时（>0.5）把滑参饱和压回 ~100，避免双重饱和导致色域溢出/色带
  if (pipeline.vibrance > 0.5 && params.saturation > 104) {
    params.saturation = Math.round(100 + (params.saturation - 100) * 0.4);
  }

  // 5. 风格推荐：题材案例优先，其次场景案例
  let styleKey = null;
  const styleHit = ranked.find(m => m.case.styleKey);
  if (styleHit) styleKey = styleHit.case.styleKey;
  if (primary.case.styleOnly) {
    // 文博暖调按标签细化风格
    if (/敦煌|大漠/.test(tagStr)) styleKey = 'dunhuang';
    else if (/非遗|纹样|民族|刺绣|民俗/.test(tagStr)) styleKey = 'feiyi';
    else styleKey = 'guofeng';
  }

  // 6. 可解释文案
  const tips = [];
  const fmt = (v) => Math.round(v);
  ranked.slice(0, 3).forEach(m => {
    let t = m.case.tip || m.name;
    t = t.replace('{b}', fmt(features.brightness))
         .replace('{p}', fmt(features.overRatio * 100))
         .replace('{s}', fmt(features.saturation * 100))
         .replace('{r}', fmt(features.colorCast.r * 100))
         .replace('{g}', fmt(features.colorCast.g * 100))
         .replace('{bb}', fmt(features.colorCast.b * 100));
    tips.push(t + `（置信度 ${Math.round(m.confidence * 100)}%）`);
  });
  // 主导色保护说明置于首位：向用户解释为何不做白平衡中和
  if (isDominant) {
    const c = features.colorCast;
    const domName = c.b > 0.45 ? '冷色/蓝色' : (c.r > 0.45 ? '暖色/红色' : '绿色');
    tips.unshift(`检测到画面以${domName}为主导（有意配色，如非遗蓝染/朱砂等题材），已启用主导色保护，不做白平衡中和，保持主色调纯正`);
  }
  tips.push(`知识库决策：参考 ${ranked.slice(0, 3).map(m => `「${m.name}」`).join('、')} ${ranked.length > 3 ? '等 ' + ranked.length + ' 个案例' : '的案例经验'}，自动调节 ${describeParams(params)}`);

  return {
    matchedCases: ranked.map(m => ({ key: m.key, name: m.name, confidence: m.confidence, experience: m.case.experience })),
    params, pipeline, styleKey, tips,
    dominantColor: isDominant
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function describeParams(p) {
  const parts = [];
  if (p.exposure) parts.push(`曝光${p.exposure > 0 ? '+' : ''}${p.exposure}`);
  if (p.contrast) parts.push(`对比${p.contrast > 0 ? '+' : ''}${p.contrast}`);
  if (p.saturation !== 100) parts.push(`饱和${p.saturation}`);
  if (p.sharpness) parts.push(`锐化+${p.sharpness}`);
  return parts.join('、') || '默认参数';
}

// ------------------------------------------------------------
// 四、像素级增强管线（分块异步、可取消、带进度）
// ------------------------------------------------------------

const nextTick = () => new Promise(r => requestAnimationFrame(() => r()));

/**
 * 执行增强管线：白平衡 → 自适应色阶 → 振动饱和 → 降噪+USM锐化
 * @param {HTMLImageElement|HTMLCanvasElement} img 原图
 * @param {object} plan synthesizePlan 的结果（使用 pipeline 强度）
 * @param {object} hooks { onProgress(pct, stageText), isCancelled() }
 * @returns {Promise<HTMLCanvasElement>} 增强后的画布
 */
export async function runEnhancementPipeline(img, plan, hooks = {}) {
  const { onProgress = () => {}, isCancelled = () => false } = hooks;
  const pl = plan.pipeline;

  // 1. 绘制到工作画布（≤900×600，保持比例）
  const maxW = 900, maxH = 600;
  const ratio = img.width / img.height;
  let w = img.width, h = img.height;
  if (w > maxW) { w = maxW; h = Math.round(w / ratio); }
  if (h > maxH) { h = maxH; w = Math.round(h * ratio); }
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const src = ctx.getImageData(0, 0, w, h); // tainted 时抛错 → 调用方降级
  const d = src.data;

  // 2. Stage A：色彩还原（白平衡 + 自适应色阶 + 振动饱和）单遍完成，25%→55%
  {
    // 白平衡：Shades-of-Gray Minkowski 范数（p=6，Finlayson & Trezzi 2004）
    // 比灰世界（p=1 等价均值）更稳健——对主导色/高饱场景不易把有意配色误判为色偏
    const P = 6;
    let sumR = 0, sumG = 0, sumB = 0;
    for (let i = 0; i < d.length; i += 4) {
      sumR += Math.pow(d[i], P); sumG += Math.pow(d[i + 1], P); sumB += Math.pow(d[i + 2], P);
    }
    const n = d.length / 4;
    const mR = Math.pow(sumR / n, 1 / P), mG = Math.pow(sumG / n, 1 / P), mB = Math.pow(sumB / n, 1 / P);
    const gray = (mR + mG + mB) / 3 || 1;
    let gainR = gray / mR, gainG = gray / mG, gainB = gray / mB;
    // 文博暖调保护：暖调题材（plan.styleKey 为敦煌/国风/非遗）白平衡强度减半，留住暖基底
    const protectWarm = ['dunhuang', 'guofeng', 'feiyi', 'festive', 'warm'].includes(plan.styleKey);
    let wbS = pl.wb * (protectWarm ? 0.5 : 1);
    // 主导色场景守卫：有意配色不做白平衡中和，增益钳制在近中性区间
    if (plan.dominantColor) wbS *= 0.15;
    const gainLo = plan.dominantColor ? 0.9 : 0.8;
    const gainHi = plan.dominantColor ? 1.12 : 1.25;
    const mix = (g) => 1 + (g - 1) * wbS;
    gainR = clamp(mix(gainR), gainLo, gainHi);
    gainG = clamp(mix(gainG), gainLo, gainHi);
    gainB = clamp(mix(gainB), gainLo, gainHi);

    // 自适应色阶：按直方图 0.5% 分位裁剪，按强度混合
    const hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) {
      hist[Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2])]++;
    }
    const clipN = Math.max(1, Math.floor(n * 0.005));
    let lo = 0, hi = 255, acc = 0;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= clipN) { lo = v; break; } }
    acc = 0;
    for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= clipN) { hi = v; break; } }
    if (hi - lo < 24) { lo = 0; hi = 255; } // 防极端拉伸
    const loT = lo + (0 - lo) * pl.levels, hiT = hi + (255 - hi) * pl.levels;
    const range = Math.max(16, hiT - loT);

    const vibS = pl.vibrance;
    const rowsPerChunk = Math.max(8, Math.floor(24000 / w));
    for (let y0 = 0; y0 < h; y0 += rowsPerChunk) {
      if (isCancelled()) throw new Error('__CANCELLED__');
      const y1 = Math.min(h, y0 + rowsPerChunk);
      for (let y = y0; y < y1; y++) {
        let i = y * w * 4;
        for (let x = 0; x < w; x++, i += 4) {
          let r = d[i] * gainR, g = d[i + 1] * gainG, b = d[i + 2] * gainB;
          // 自适应色阶（亮度域 S 形轻压，防生硬）
          let l = 0.299 * r + 0.587 * g + 0.114 * b;
          const nl = clamp(((l - loT) / range) * 255, 0, 255);
          // 色阶软限制：lift 收缩到 0.82~1.22，避免极端拉伸导致色带/断层
          const lift = l > 1 ? clamp(nl / l, 0.82, 1.22) : 1;
          r *= lift; g *= lift; b *= lift;
          // 振动饱和（YCbCr 色度缩放）：以亮度为锚等比缩放色度向量，
          // 色相恒定不漂移（min-channel 重缩放会漂色相，导致灰区出现彩色斑驳）
          if (vibS > 0) {
            const Y = 0.299 * r + 0.587 * g + 0.114 * b;
            const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
            const sat = mx > 0 ? (mx - mn) / mx : 0;
            if (mx > 0) {
              // 低饱像素提升多、高饱像素受上限保护（k ≤ 1.45），防止过饱和溢出
              let k = 1 + vibS * (1 - sat) * 0.38 + vibS * 0.05;
              k = Math.min(k, 1.45);
              r = Y + (r - Y) * k;
              g = Y + (g - Y) * k;
              b = Y + (b - Y) * k;
            }
          }
          d[i] = r; d[i + 1] = g; d[i + 2] = b;
        }
      }
      const pctDone = (y1 / h);
      onProgress(25 + pctDone * 30, '色彩还原中');
      await nextTick();
    }
  }

  // 3. Stage B：细节增强（亮度-only USM + 色度降噪），55%→90%
  // 行业实践：只锐化亮度通道、只平滑色度通道（Photoshop LAB Lightness 锐化 /
  // Lightroom 亮度-颜色降噪分离），避免逐通道锐化放大彩色噪点导致画面显脏
  if (pl.usm > 0.05 || pl.denoise > 0.05) {
    const radius = pl.usm > 0.6 ? 2 : 1;
    const blur = boxBlurSep(d, w, h, radius);                       // 亮度 USM 低频
    const blurCol = pl.denoise > 0.05 ? boxBlurSep(d, w, h, 2) : null; // 色度降噪低频（更大半径）
    const amount = 0.35 + pl.usm * 0.95;                             // USM 强度 0.35~1.3
    const noiseT = 14 - pl.denoise * 6;                              // 平坦区判定阈值
    const rowsPerChunk = Math.max(6, Math.floor(16000 / w));
    for (let y0 = 0; y0 < h; y0 += rowsPerChunk) {
      if (isCancelled()) throw new Error('__CANCELLED__');
      const y1 = Math.min(h, y0 + rowsPerChunk);
      for (let y = y0; y < y1; y++) {
        let i = y * w * 4;
        for (let x = 0; x < w; x++, i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const Y = 0.299 * r + 0.587 * g + 0.114 * b;
          const Yb = 0.299 * blur[i] + 0.587 * blur[i + 1] + 0.114 * blur[i + 2];
          const delta = Y - Yb; // 亮度高频（边缘信号）
          let outR = r, outG = g, outB = b;
          // 亮度-only USM：同一亮度 delta 加回三通道 → 只锐化明度边缘，色彩零漂移
          if (pl.usm > 0.05 && Math.abs(delta) >= 2.5) {
            let usmR = outR + amount * delta;
            let usmG = outG + amount * delta;
            let usmB = outB + amount * delta;
            // 高光保护：亮部锐化不得把原本未溢出的像素推过 250（防死白扩散）
            usmR = Math.min(usmR, Math.max(r, 250));
            usmG = Math.min(usmG, Math.max(g, 250));
            usmB = Math.min(usmB, Math.max(b, 250));
            outR = usmR; outG = usmG; outB = usmB;
          }
          // 色度降噪：平坦区把色度向量向低频版本靠拢，保留亮度细节
          if (blurCol && Math.abs(delta) < noiseT) {
            const cm = pl.denoise * 0.6;
            const Yc = 0.299 * blurCol[i] + 0.587 * blurCol[i + 1] + 0.114 * blurCol[i + 2];
            const Yo = 0.299 * outR + 0.587 * outG + 0.114 * outB;
            outR = Yo + (blurCol[i] - Yc) * cm + (outR - Yo) * (1 - cm);
            outG = Yo + (blurCol[i + 1] - Yc) * cm + (outG - Yo) * (1 - cm);
            outB = Yo + (blurCol[i + 2] - Yc) * cm + (outB - Yo) * (1 - cm);
          }
          d[i] = clamp(outR, 0, 255);
          d[i + 1] = clamp(outG, 0, 255);
          d[i + 2] = clamp(outB, 0, 255);
        }
      }
      onProgress(55 + (y1 / h) * 35, '细节增强中');
      await nextTick();
    }
  } else {
    onProgress(90, '细节增强中');
    await nextTick();
  }

  ctx.putImageData(src, 0, 0);
  onProgress(100, '优化完成');
  return canvas;
}

/**
 * 分离式 box blur（对 RGB 三通道），返回新数组（ImageData data 格式）
 * 用于近似高斯模糊（跑两遍等价于更平滑的核）
 */
function boxBlurSep(src, w, h, radius) {
  const tmp = new Uint8ClampedArray(src.length);
  const out = new Uint8ClampedArray(src.length);
  const win = radius * 2 + 1;
  // 水平
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let ch = 0; ch < 3; ch++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const x = clamp(k, 0, w - 1);
        sum += src[row + x * 4 + ch];
      }
      for (let x = 0; x < w; x++) {
        tmp[row + x * 4 + ch] = sum / win;
        const xAdd = Math.min(w - 1, x + radius + 1) * 4 + ch;
        const xSub = Math.max(0, x - radius) * 4 + ch;
        sum += src[row + xAdd] - src[row + xSub];
      }
    }
  }
  // 垂直
  for (let x = 0; x < w; x++) {
    const col = x * 4;
    for (let ch = 0; ch < 3; ch++) {
      let sum = 0;
      for (let k = -radius; k <= radius; k++) {
        const y = clamp(k, 0, h - 1);
        sum += tmp[y * w * 4 + col + ch];
      }
      for (let y = 0; y < h; y++) {
        out[y * w * 4 + col + ch] = sum / win;
        const yAdd = Math.min(h - 1, y + radius + 1);
        const ySub = Math.max(0, y - radius);
        sum += tmp[yAdd * w * 4 + col + ch] - tmp[ySub * w * 4 + col + ch];
      }
    }
  }
  return out;
}

// ------------------------------------------------------------
// 五、M9: AI 超清（Super-Resolution）管线
// 市场调研结论（Photoshop Super Resolution / 醒图AI超清 / 美图画质修复 /
// Topaz Gigapixel / Real-ESRGAN / 浏览器端 Pica+USM 方案）：
//   1. 商业产品通用范式 = 特征分析 → 预降噪 → 细节重建 → 局部对比 → 量化验证
//   2. 纯前端无 GPU/无模型下载场景，业界标准做法（Pica/Glfx 系工具）：
//      高质量重采样 + 多遍 Unsharp Mask + 边缘门控细节恢复
//   3. 防幻觉约束（fidelity 优先）：平坦区不锐化、锐化增量限幅、只动亮度
//      通道——避免"无中生有"的纹理（Real-ESRGAN 类生成式方案的常见副作用）
// 设计：
//   Stage 1 特征分析（模糊度/噪声评估，决定强度）
//   Stage 2 预降噪（色度降噪 + 平坦区亮度降噪，边缘保护）
//   Stage 3 结构感知细节重建（微尺度 r=1 + 结构尺度 r=3 双遍亮度 USM，
//           梯度门控 + 振铃限幅 + 高光保护）
//   Stage 4 局部微对比（clarity，大半径差值增强中频层次）
//   Stage 5 量化验证（Laplacian 清晰度能量前后对比，输出提升百分比）
// ------------------------------------------------------------

/**
 * 计算图像 Laplacian 边缘能量（清晰度客观指标，PSNR 之外的轻量替代）
 * @param {Uint8ClampedArray} d ImageData.data
 * @param {number} w 宽
 * @param {number} h 高
 * @returns {number} 平均 |Laplacian|（越大越清晰）
 */
function laplacianEnergy(d, w, h) {
  const gray = new Float32Array(w * h);
  for (let p = 0, i = 0; p < w * h; p++, i += 4) {
    gray[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }
  let sum = 0, cnt = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      sum += Math.abs(4 * gray[p] - gray[p - 1] - gray[p + 1] - gray[p - w] - gray[p + w]);
      cnt++;
    }
  }
  return cnt ? sum / cnt : 0;
}

/**
 * M9: AI 超清主管线——从模糊输入恢复细节、提升清晰度
 * @param {HTMLImageElement|HTMLCanvasElement} img 输入图像
 * @param {object} hooks { onProgress(pct, stageText), isCancelled() }
 * @returns {Promise<{canvas: HTMLCanvasElement, metrics: {before:number,after:number,gain:number}}>}
 */
export async function runSuperResolutionPipeline(img, hooks = {}) {
  const { onProgress = () => {}, isCancelled = () => false } = hooks;

  // 0. 绘制到工作画布（超清处理上限 1200×800，高于智能优化的 900×600）
  const maxW = 1200, maxH = 800;
  const ratio = img.width / img.height;
  let w = img.width, h = img.height;
  if (w > maxW) { w = maxW; h = Math.round(w / ratio); }
  if (h > maxH) { h = maxH; w = Math.round(h * ratio); }
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  const src = ctx.getImageData(0, 0, w, h); // tainted 时抛错 → 调用方降级
  const d = src.data;

  // 处理前清晰度基准
  const before = laplacianEnergy(d, w, h);

  // ── Stage 1：特征分析（模糊度评估 → 超清强度）0% → 12%
  onProgress(5, 'AI 超清分析中');
  await nextTick();
  if (isCancelled()) throw new Error('__CANCELLED__');
  const feat = extractImageFeatures(canvas); // 降采样统计，毫秒级
  // 模糊度 0~1：锐度越低越模糊
  const blurScore = clamp01((0.5 - feat.sharpness) / 0.35);
  const usmMicro = 0.55 + 0.75 * blurScore;      // 微尺度 USM 强度 0.55~1.30
  const usmStruct = 0.30 + 0.45 * blurScore;     // 结构尺度强度 0.30~0.75
  const clarityS = 0.14 + 0.18 * blurScore;      // 局部对比强度 0.14~0.32
  const denoiseS = 0.22 + 0.18 * blurScore;      // 预降噪强度 0.22~0.40
  onProgress(12, 'AI 超清分析中');
  await nextTick();
  if (isCancelled()) throw new Error('__CANCELLED__');

  // ── Stage 2：预降噪（色度 + 平坦区亮度，边缘保护）12% → 28%
  {
    const blurCol = boxBlurSep(d, w, h, 2);
    const noiseT = 13;
    const rowsPerChunk = Math.max(8, Math.floor(20000 / w));
    for (let y0 = 0; y0 < h; y0 += rowsPerChunk) {
      if (isCancelled()) throw new Error('__CANCELLED__');
      const y1 = Math.min(h, y0 + rowsPerChunk);
      for (let y = y0; y < y1; y++) {
        let i = y * w * 4;
        for (let x = 0; x < w; x++, i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const Y = 0.299 * r + 0.587 * g + 0.114 * b;
          const Yc = 0.299 * blurCol[i] + 0.587 * blurCol[i + 1] + 0.114 * blurCol[i + 2];
          if (Math.abs(Y - Yc) < noiseT) { // 平坦区才降噪，边缘原样保留
            const cm = denoiseS * 0.6;
            d[i]     = Y + (blurCol[i] - Yc) * cm + (r - Y) * (1 - cm);
            d[i + 1] = Y + (blurCol[i + 1] - Yc) * cm + (g - Y) * (1 - cm);
            d[i + 2] = Y + (blurCol[i + 2] - Yc) * cm + (b - Y) * (1 - cm);
          }
        }
      }
      onProgress(12 + (y1 / h) * 16, '正在超清处理');
      await nextTick();
    }
  }

  // ── Stage 3：结构感知细节重建（双尺度亮度 USM）28% → 74%
  {
    const blur1 = boxBlurSep(d, w, h, 1);  // 微尺度低频（像素级细节）
    const blur3 = boxBlurSep(d, w, h, 3);  // 结构尺度低频（轮廓结构）
    const gateT = 1.4;                     // 边缘门控阈值（防幻觉：平坦区不锐化）
    const clampAdd = 38;                   // 振铃限幅（单像素锐化增量上限）
    const rowsPerChunk = Math.max(6, Math.floor(16000 / w));
    for (let y0 = 0; y0 < h; y0 += rowsPerChunk) {
      if (isCancelled()) throw new Error('__CANCELLED__');
      const y1 = Math.min(h, y0 + rowsPerChunk);
      for (let y = y0; y < y1; y++) {
        let i = y * w * 4;
        for (let x = 0; x < w; x++, i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const Y = 0.299 * r + 0.587 * g + 0.114 * b;
          const Yb1 = 0.299 * blur1[i] + 0.587 * blur1[i + 1] + 0.114 * blur1[i + 2];
          const Yb3 = 0.299 * blur3[i] + 0.587 * blur3[i + 1] + 0.114 * blur3[i + 2];
          const dMicro = Y - Yb1, dStruct = Y - Yb3;
          // 边缘门控：仅在有真实边缘/纹理处重建细节
          if (Math.max(Math.abs(dMicro), Math.abs(dStruct)) < gateT) continue;
          let add = usmMicro * dMicro + usmStruct * dStruct;
          add = Math.max(-clampAdd, Math.min(clampAdd, add)); // 振铃抑制
          let or_ = r + add, og = g + add, ob = b + add;
          // 高光/暗部保护：锐化不得把未溢出像素推过 250 / 压破 6
          or_ = Math.min(or_, Math.max(r, 250)); og = Math.min(og, Math.max(g, 250)); ob = Math.min(ob, Math.max(b, 250));
          d[i]     = Math.max(6, or_);
          d[i + 1] = Math.max(6, og);
          d[i + 2] = Math.max(6, ob);
        }
      }
      onProgress(28 + (y1 / h) * 46, '正在超清处理');
      await nextTick();
    }
  }

  // ── Stage 4：局部微对比（clarity，中频层次增强）74% → 92%
  {
    const blur8 = boxBlurSep(d, w, h, 8);
    const rowsPerChunk = Math.max(8, Math.floor(20000 / w));
    for (let y0 = 0; y0 < h; y0 += rowsPerChunk) {
      if (isCancelled()) throw new Error('__CANCELLED__');
      const y1 = Math.min(h, y0 + rowsPerChunk);
      for (let y = y0; y < y1; y++) {
        let i = y * w * 4;
        for (let x = 0; x < w; x++, i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const Y = 0.299 * r + 0.587 * g + 0.114 * b;
          const Yb = 0.299 * blur8[i] + 0.587 * blur8[i + 1] + 0.114 * blur8[i + 2];
          const add = Math.max(-18, Math.min(18, clarityS * (Y - Yb)));
          d[i]     = clamp(r + add, 0, 255);
          d[i + 1] = clamp(g + add, 0, 255);
          d[i + 2] = clamp(b + add, 0, 255);
        }
      }
      onProgress(74 + (y1 / h) * 18, '正在超清处理');
      await nextTick();
    }
  }

  // ── Stage 5：量化验证（清晰度提升客观指标）92% → 100%
  onProgress(94, '正在超清处理');
  await nextTick();
  if (isCancelled()) throw new Error('__CANCELLED__');
  const after = laplacianEnergy(d, w, h);
  ctx.putImageData(src, 0, 0);
  onProgress(100, 'AI 超清完成');
  await nextTick();
  return { canvas, metrics: { before, after, gain: before > 0 ? after / before : 1 } };
}

// ------------------------------------------------------------
// 模块导出
// ------------------------------------------------------------
export { EXPERT_CASES };
