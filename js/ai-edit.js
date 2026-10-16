// ============================================================
// js/ai-edit.js — M2/M7 AI调参修图工作台
// 职责：
//   1. 基于 Canvas + CSS filter 的实时调参（曝光/对比/饱和/锐化/HSL）
//   2. M7 AI智能优化：内置案例知识库智能分析决策 + 像素级参数优化
//      （色彩还原/细节增强/风格统一），醒图式等待交互 + 前后对比
//   3. 19 种内置风格滤镜 + 10 套一键模板（文旅/醒图式）
//   4. 版本管理（edit_versions 表）：保存/回溯/删除历史版本
//   5. 路由 #/edit?artworkId=xxx&focus=xxx 打开工作台
// 设计原则：
//   1. 纯原生 DOM + CSS filter，不引入第三方 UI/滤镜库
//   2. 参数变化实时预览（requestAnimationFrame 节流）
//   3. AI 生成内容显式标注"✨ AI辅助生成"
//   4. 离开路由时完整清理（Canvas / 事件监听器 / 定时器 / RAF）
// 依赖：./ai-knowledge.js（案例知识库+增强管线）、./db.js（edit_versions CRUD）
//      ./ai-inference.js（imageGeneration，复杂滤镜降级）
// ============================================================

import {
  getArtworkById,
  getAestheticScoresByArtwork,
  addEditVersion,
  getEditVersionsByArtwork,
  updateEditVersion,
  deleteEditVersion
} from './db.js';

// M7: 内置案例知识库 + 智能决策引擎 + 像素级增强管线
// M9: AI超清（Super-Resolution）管线
import {
  extractImageFeatures,
  synthesizePlan,
  runEnhancementPipeline,
  runSuperResolutionPipeline
} from './ai-knowledge.js';

// ------------------------------------------------------------
// 常量定义
// ------------------------------------------------------------

/** 默认修图参数（全部中性） */
const DEFAULT_PARAMS = {
  exposure: 0,       // 曝光 -100~100
  contrast: 0,       // 对比度 -100~100
  saturation: 100,   // 饱和度 0~200（100 为中性）
  sharpness: 0,      // 锐化 0~100
  hsl: {
    hue: 0,          // 色相 0~360
    saturation: 100, // HSL 饱和度 0~200（100 为中性）
    luminance: 100   // HSL 明度 0~200（100 为中性）
  }
};

/** 参数滑块配置（label / min / max / step） */
const PARAM_SLIDERS = [
  { key: 'exposure', label: '曝光', icon: 'fa-sun', min: -100, max: 100, step: 1 },
  { key: 'contrast', label: '对比度', icon: 'fa-adjust', min: -100, max: 100, step: 1 },
  { key: 'saturation', label: '饱和度', icon: 'fa-droplet', min: 0, max: 200, step: 1 },
  { key: 'sharpness', label: '锐化', icon: 'fa-arrows-to-circle', min: 0, max: 100, step: 1 },
  { key: 'hue', label: '色相', icon: 'fa-palette', min: 0, max: 360, step: 1 },
  { key: 'hslSat', label: 'HSL饱和', icon: 'fa-wave-square', min: 0, max: 200, step: 1 },
  { key: 'hslLum', label: 'HSL明度', icon: 'fa-circle-half-stroke', min: 0, max: 200, step: 1 }
];

/** 6 种内置风格滤镜（纯 CSS filter 表达式，性能高） */
const STYLE_PRESETS = [
  {
    key: 'none',
    label: '原图',
    icon: 'fa-image',
    cssFilter: '',
    desc: '原始画面，无任何滤镜'
  },
  {
    key: 'guofeng',
    label: '国风',
    icon: 'fa-paintbrush',
    cssFilter: 'sepia(0.15) saturate(1.15) contrast(1.05) brightness(1.02) hue-rotate(-8deg)',
    desc: '温润如玉的东方美学，微暖色调'
  },
  {
    key: 'feiyi',
    label: '非遗纹样',
    icon: 'fa-pattern',
    cssFilter: 'sepia(0.28) saturate(1.35) contrast(1.08) brightness(0.97) hue-rotate(15deg)',
    desc: '浓郁色彩，民族纹样质感'
  },
  {
    key: 'cinema',
    label: '电影感',
    icon: 'fa-film',
    cssFilter: 'contrast(1.2) saturate(0.82) brightness(0.93)',
    desc: '电影胶片质感，低饱和高对比'
  },
  {
    key: 'vintage',
    label: '复古',
    icon: 'fa-clock-rotate-left',
    cssFilter: 'sepia(0.42) contrast(1.05) saturate(0.78) brightness(0.95)',
    desc: '老照片质感，时光沉淀'
  },
  {
    key: 'japanese',
    label: '日系',
    icon: 'fa-cherry-blossom',
    cssFilter: 'saturate(0.72) brightness(1.06) contrast(0.94)',
    desc: '清新淡雅，日系胶片'
  },
  {
    key: 'mono',
    label: '黑白',
    icon: 'fa-circle',
    cssFilter: 'grayscale(1) contrast(1.12) brightness(1.02)',
    desc: '纯黑白，经典永恒'
  },
  // ---- M6c: 新增 12 款文旅/醒图式滤镜 ----
  {
    key: 'qinghua',
    label: '青花瓷',
    icon: 'fa-droplet',
    cssFilter: 'saturate(1.12) contrast(1.06) hue-rotate(-15deg) brightness(1.03)',
    desc: '靛蓝雅韵，东方瓷感'
  },
  {
    key: 'dunhuang',
    label: '敦煌',
    icon: 'fa-archway',
    cssFilter: 'sepia(0.32) saturate(1.3) contrast(1.1) hue-rotate(-5deg)',
    desc: '大漠暖调，壁画质感'
  },
  {
    key: 'ink',
    label: '水墨',
    icon: 'fa-feather',
    cssFilter: 'grayscale(0.85) sepia(0.12) contrast(1.15) brightness(1.05)',
    desc: '淡墨写意，山水禅境'
  },
  {
    key: 'neon',
    label: '赛博霓虹',
    icon: 'fa-bolt',
    cssFilter: 'saturate(1.6) contrast(1.15) hue-rotate(18deg) brightness(0.95)',
    desc: '夜游光影，未来感'
  },
  {
    key: 'festive',
    label: '节庆红金',
    icon: 'fa-fire',
    cssFilter: 'sepia(0.2) saturate(1.45) contrast(1.08) hue-rotate(-10deg)',
    desc: '喜庆国潮，红金年味'
  },
  {
    key: 'cool',
    label: '冷白通透',
    icon: 'fa-snowflake',
    cssFilter: 'saturate(0.9) brightness(1.12) contrast(0.95) hue-rotate(5deg)',
    desc: '冷白质感，干净通透'
  },
  {
    key: 'warm',
    label: '暖阳',
    icon: 'fa-sun',
    cssFilter: 'sepia(0.18) saturate(1.2) brightness(1.08) contrast(1.02)',
    desc: '暖阳氛围，温柔治愈'
  },
  {
    key: 'morandi',
    label: '莫兰迪',
    icon: 'fa-circle-half-stroke',
    cssFilter: 'saturate(0.62) brightness(1.02) contrast(0.92)',
    desc: '低饱和高级灰调'
  },
  {
    key: 'hdr',
    label: 'HDR质感',
    icon: 'fa-bolt-lightning',
    cssFilter: 'contrast(1.25) saturate(1.25) brightness(1.05)',
    desc: '高动态范围，细节增强'
  },
  {
    key: 'fade',
    label: '褪色胶片',
    icon: 'fa-film',
    cssFilter: 'sepia(0.25) saturate(0.6) contrast(0.88) brightness(1.08)',
    desc: '褪色胶片，时光痕迹'
  },
  {
    key: 'night',
    label: '夜景蓝调',
    icon: 'fa-city',
    cssFilter: 'saturate(1.2) contrast(1.18) brightness(0.92) hue-rotate(-12deg)',
    desc: '夜幕蓝调，城市灯光'
  },
  {
    key: 'cherry',
    label: '樱花粉',
    icon: 'fa-spa',
    cssFilter: 'saturate(1.15) brightness(1.06) hue-rotate(-8deg) sepia(0.08)',
    desc: '粉嫩春日，浪漫气息'
  }
];

/**
 * M6c: 一键模板（滤镜 + 调参组合，参照醒图"模板"概念）
 * params 为绝对值（覆盖默认参数，未列出的字段保持默认）
 */
const TEMPLATE_PRESETS = [
  { key: 'lvyou', label: '文旅大片', icon: 'fa-mountain-sun', styleKey: 'cinema', params: { contrast: 15, saturation: 92 }, desc: '电影级对比，旅行大片质感' },
  { key: 'guzhen', label: '古镇晨曦', icon: 'fa-torii-gate', styleKey: 'guofeng', params: { exposure: 12, contrast: 6 }, desc: '温润晨光，古韵悠然' },
  { key: 'bowuguan', label: '博物雅藏', icon: 'fa-landmark', styleKey: 'vintage', params: { sharpness: 25, contrast: 8 }, desc: '老照片质感，馆藏沉淀' },
  { key: 'yejing', label: '夜游灯光', icon: 'fa-city', styleKey: 'night', params: { exposure: -6, contrast: 12 }, desc: '夜幕蓝调，霓虹初上' },
  { key: 'qingxin', label: '清新日系', icon: 'fa-leaf', styleKey: 'japanese', params: { exposure: 8 }, desc: '淡雅通透，日常记录' },
  { key: 'nongqing', label: '民俗浓情', icon: 'fa-masks-theater', styleKey: 'feiyi', params: { saturation: 125, contrast: 10 }, desc: '浓郁民族色彩，节庆氛围' },
  { key: 'lengbai', label: '冷白通透', icon: 'fa-snowflake', styleKey: 'cool', params: { exposure: 10 }, desc: '冷白皮质感，通透干净' },
  { key: 'nuanyang', label: '暖阳氛围', icon: 'fa-sun', styleKey: 'warm', params: { exposure: 8, saturation: 115 }, desc: '暖阳滤镜，氛围感拉满' },
  { key: 'molandi', label: '莫兰迪灰', icon: 'fa-circle-half-stroke', styleKey: 'morandi', params: {}, desc: '低饱和高级灰，文艺静物' },
  { key: 'yingpian', label: 'HDR质感', icon: 'fa-bolt-lightning', styleKey: 'hdr', params: { sharpness: 18 }, desc: '高动态细节，风光增强' }
];

/** 缓存的 DOM 引用（避免重复查询） */
let domRefs = null;
/** 当前画布 2D 上下文 */
let canvasCtx = null;
/** 当前原始图片 Image 对象 */
let sourceImage = null;
/** 节流用的 RAF id */
let previewRafId = 0;
/** 是否已挂载 */
let mounted = false;
/** 当前 artworkId */
let currentArtworkId = null;
/** 当前参数（深拷贝，避免 DEFAULT_PARAMS 被污染） */
let currentParams = JSON.parse(JSON.stringify(DEFAULT_PARAMS));
/** 当前选中的风格滤镜 key */
let currentStyleKey = 'none';
/** M6c: 当前应用的一键模板 key（null 表示未使用模板） */
let currentTemplateKey = null;
/** M7: 原始图备份（AI智能优化后用于对比/恢复） */
let originalSource = null;
/** M7: 是否已执行过AI智能优化 */
let hasOptimized = false;
/** M7: 是否处于前后对比模式 */
let compareActive = false;
/** M7: 智能优化进行中标记 */
let optimizing = false;
/** M7: 智能优化取消标记 */
let optimizeCancelled = false;
/** M7: 最近一次智能优化方案（保存版本时引用） */
let lastPlan = null;

/** M9: AI超清进行中 / 取消标记 */
let srRunning = false;
let srCancelled = false;

/** M8: 自动暂存状态（防意外数据丢失） */
let autoSaveTimer = 0;        // 防抖定时器
let autoSaveDirty = false;     // 自上次自动暂存后是否有变更
let autoSaving = false;        // 自动暂存进行中（防重入）
let lastHdDataUrl = '';        // 最近一次高清导出的 dataURL（供发布引导带入）
/** M8: 自动暂存配置：防抖 6s 触发，每篇作品最多保留 3 条自动暂存版本 */
const AUTO_SAVE_DELAY = 6000;
const AUTO_SAVE_KEEP = 3;

/** M7: 毫秒级等待（优化流程节奏控制） */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ------------------------------------------------------------
// SubTask 6.1: CSS Filter 构建
// ------------------------------------------------------------

/**
 * 根据当前参数构建完整 CSS filter 字符串
 * 逻辑：基础调参 + HSL + 风格滤镜 叠加
 * @returns {string} CSS filter 值
 */
function buildCssFilter() {
  const p = currentParams;
  const parts = [];

  // 基础调参（映射到 CSS filter）
  // 曝光 exposure -100~100 → brightness(0.5 ~ 1.5)
  parts.push(`brightness(${1 + p.exposure / 200})`);
  // 对比度 contrast -100~100 → contrast(0.5 ~ 1.5)
  parts.push(`contrast(${1 + p.contrast / 200})`);
  // 饱和度 saturation 0~200 → saturate(0 ~ 2)
  parts.push(`saturate(${p.saturation / 100})`);
  // HSL 叠加
  parts.push(`hue-rotate(${p.hsl.hue}deg)`);
  parts.push(`saturate(${p.hsl.saturation / 100})`);
  parts.push(`brightness(${p.hsl.luminance / 100})`);

  // 锐化：CSS 无原生锐化，用 contrast + saturate 组合近似
  // （真正锐化需 Canvas convolve，此处用近似方案保持高性能）
  if (p.sharpness > 0) {
    // 锐化 0~100 → contrast(1.0 ~ 1.25) + 微 saturate
    const boost = 1 + p.sharpness / 400;
    parts.push(`contrast(${boost.toFixed(3)})`);
    parts.push(`saturate(${(1 + p.sharpness / 800).toFixed(3)})`);
  }

  // 风格滤镜（如果不是原图）
  if (currentStyleKey && currentStyleKey !== 'none') {
    const preset = STYLE_PRESETS.find(s => s.key === currentStyleKey);
    if (preset && preset.cssFilter) {
      parts.push(preset.cssFilter);
    }
  }

  return parts.join(' ');
}

/**
 * 构建 canvas context filter（Webkit 内核支持）
 * @returns {string}
 */
function buildCanvasFilter() {
  // Canvas filter 与 CSS filter 格式兼容
  return buildCssFilter();
}

// ------------------------------------------------------------
// SubTask 6.2: 图片加载 + Canvas 预览渲染
// ------------------------------------------------------------

/**
 * 加载图片 URL 为 HTMLImageElement（支持跨域）
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    if (!url) return reject(new Error('图片URL为空'));
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`图片加载失败: ${url}`));
    img.src = url;
  });
}

/**
 * 节流的预览重绘（requestAnimationFrame 保证 60fps）
 */
function schedulePreviewRender() {
  // M8: 任何触发重绘的变更都视为"有未暂存的修改"（参数/滤镜/模板/智能优化统一挂点）
  markAutoSaveDirty();
  if (previewRafId) cancelAnimationFrame(previewRafId);
  previewRafId = requestAnimationFrame(() => {
    renderPreview();
    previewRafId = 0;
  });
}

/**
 * 将原图按当前参数渲染到 Canvas（使用 Canvas filter 实现高性能实时预览）
 */
function renderPreview() {
  if (!domRefs || !canvasCtx || !sourceImage) return;
  const canvas = domRefs.previewCanvas;
  if (!canvas) return;

  const dpr = window.devicePixelRatio || 1;
  // 计算渲染尺寸（保持宽高比，限制最大高度 600px）
  const maxH = 600;
  const ratio = sourceImage.width / sourceImage.height;
  let cssH = Math.min(sourceImage.height, maxH);
  let cssW = cssH * ratio;
  // 限制最大宽度
  const maxW = Math.min(canvas.clientWidth || 800, 900);
  if (cssW > maxW) {
    cssW = maxW;
    cssH = cssW / ratio;
  }
  canvas.style.height = cssH + 'px';
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 应用 filter（Canvas filter 在主流浏览器都支持）
  canvasCtx.filter = buildCanvasFilter();
  canvasCtx.clearRect(0, 0, cssW, cssH);
  canvasCtx.drawImage(sourceImage, 0, 0, cssW, cssH);
  canvasCtx.filter = 'none';
}

/**
 * 将当前 Canvas 导出为 base64（用于保存版本）
 * @returns {string} dataURL
 */
function exportCanvasBase64() {
  if (!domRefs || !domRefs.previewCanvas) return '';
  try {
    return domRefs.previewCanvas.toDataURL('image/jpeg', 0.92);
  } catch (err) {
    console.warn('[AI-Edit] 导出失败（可能是跨域图片）:', err && err.message);
    return '';
  }
}

/**
 * M8: 高清导出 — 将当前修图结果以 2 倍分辨率（长边≤1800px）JPEG(0.95) 导出
 * 在离屏 Canvas 上以同参数重绘，不依赖预览画布的 DPR 缩放
 * @returns {{ dataUrl: string, fileName: string }} 导出结果
 */
function exportHighQuality() {
  if (!sourceImage) return { dataUrl: '', fileName: '' };
  const sw = sourceImage.width, sh = sourceImage.height;
  const w = Math.min(Math.round(sw * 2), 1800) || sw;
  const h = Math.round(w * sh / sw) || sh;
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const ctx = off.getContext('2d');
  ctx.filter = buildCanvasFilter();
  ctx.drawImage(sourceImage, 0, 0, w, h);
  ctx.filter = 'none';
  try {
    const dataUrl = off.toDataURL('image/jpeg', 0.95);
    const ts = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const title = (domRefs && domRefs.artTitle ? domRefs.artTitle.textContent.trim() : '作品') || '作品';
    const fileName = `${title}-修图-${ts.getFullYear()}${pad(ts.getMonth() + 1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}.jpg`;
    return { dataUrl, fileName };
  } catch (err) {
    console.warn('[AI-Edit] 高清导出失败（可能是跨域图片）:', err && err.message);
    return { dataUrl: '', fileName: '' };
  }
}

// ------------------------------------------------------------
// M8: 自动暂存（防意外数据丢失）
// ------------------------------------------------------------

/**
 * 标记"有未暂存的修改"，防抖 AUTO_SAVE_DELAY 后自动暂存一条版本
 * （所有参数/滤镜/模板/智能优化的变更都会经过 schedulePreviewRender，在此统一挂点）
 */
function markAutoSaveDirty() {
  if (!mounted || !currentArtworkId) return;
  autoSaveDirty = true;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(runAutoSave, AUTO_SAVE_DELAY);
}

/**
 * 执行自动暂存：写入 versionType='auto-save' 的版本记录，
 * 并将本作品的自动暂存数量裁剪到最近 AUTO_SAVE_KEEP 条
 */
async function runAutoSave() {
  if (autoSaving || !autoSaveDirty || !mounted || !currentArtworkId) return;
  const user = window.currentUser;
  if (!user) { autoSaveDirty = false; return; } // 未登录不自动暂存（与保存版本策略一致）
  autoSaving = true;
  try {
    const record = {
      artworkId: currentArtworkId,
      userId: user.id || user.username,
      versionType: 'auto-save',
      parameters: {
        exposure: currentParams.exposure,
        contrast: currentParams.contrast,
        saturation: currentParams.saturation,
        sharpness: currentParams.sharpness,
        hsl: { ...currentParams.hsl },
        template: currentTemplateKey || undefined,
        smartOpt: lastPlan
          ? { cases: lastPlan.matchedCases.slice(0, 3).map(c => c.name), styleKey: lastPlan.styleKey }
          : undefined
      },
      filterName: currentStyleKey,
      imageData: exportCanvasBase64()
    };
    await addEditVersion(record);
    autoSaveDirty = false;
    // 裁剪：仅保留最近 AUTO_SAVE_KEEP 条自动暂存，避免版本列表被刷屏
    try {
      const all = await getEditVersionsByArtwork(currentArtworkId);
      const autos = (all || []).filter(v => v.versionType === 'auto-save').sort((a, b) => b.id - a.id);
      for (let i = AUTO_SAVE_KEEP; i < autos.length; i++) {
        await deleteEditVersion(autos[i].id);
      }
    } catch (_) { /* 裁剪失败不影响主流程 */ }
    // 更新指示标签 + 刷新版本列表
    if (domRefs && domRefs.autosaveTag) {
      const t = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      if (domRefs.autosaveTime) domRefs.autosaveTime.textContent = `已自动暂存 ${pad(t.getHours())}:${pad(t.getMinutes())}`;
      domRefs.autosaveTag.hidden = false;
    }
    await loadVersionHistory();
  } catch (err) {
    console.warn('[AI-Edit] 自动暂存失败（不阻塞编辑）:', err && err.message);
  } finally {
    autoSaving = false;
  }
}

/**
 * 显示/隐藏保存成功引导卡片
 */
function showSaveCard() {
  if (domRefs && domRefs.saveCard) domRefs.saveCard.hidden = false;
}
function hideSaveCard() {
  if (domRefs && domRefs.saveCard) domRefs.saveCard.hidden = true;
}

// ------------------------------------------------------------
// SubTask 6.3: AI 推荐参数
// ------------------------------------------------------------

/**
 * 基于 M1 评分的低分维度，智能推荐调参参数
 * 映射规则（每档低分 → 参数调整量）：
 *   lighting < 6 → 曝光+15, 对比度+10
 *   color    < 6 → 饱和度+20
 *   clarity  < 6 → 锐化+30, 对比度+5
 *   composition < 6 → 无法调参修复，返回文字建议
 *   theme    < 6 → 推荐风格滤镜（国风/非遗/日系）
 * @param {number} artworkId
 * @returns {Promise<{params: object, styleKey: string|null, tips: string[]}>}
 */
async function recommendByAestheticScore(artworkId) {
  const tips = [];
  const recommended = { ...JSON.parse(JSON.stringify(DEFAULT_PARAMS)) };
  let styleKey = null;

  let scoreRecord = null;
  try {
    const list = await getAestheticScoresByArtwork(artworkId);
    scoreRecord = list && list[0] ? list[0] : null;
  } catch (_) {
    return { params: recommended, styleKey: null, tips: ['（暂无可用于分析的AI评分，请先完成M1评分）'] };
  }

  if (!scoreRecord || !scoreRecord.scores) {
    return { params: recommended, styleKey: null, tips: ['该作品尚未完成AI评分，建议先触发M1评分定级后再使用AI推荐'] };
  }

  const s = scoreRecord.scores;
  const LOW = 6.0;

  if (s.lighting < LOW) {
    const delta = Math.round((LOW - s.lighting) * 8);
    recommended.exposure = Math.min(100, delta);
    recommended.contrast = Math.min(100, Math.round(delta * 0.7));
    tips.push(`光影维度得分较低（${s.lighting.toFixed(1)}），已自动提升曝光+${recommended.exposure}、对比度+${recommended.contrast}`);
  }
  if (s.color < LOW) {
    const delta = Math.round((LOW - s.color) * 10);
    recommended.saturation = Math.min(200, 100 + delta);
    tips.push(`色彩维度得分较低（${s.color.toFixed(1)}），已自动提升饱和度至 ${recommended.saturation}`);
  }
  if (s.clarity < LOW) {
    const delta = Math.round((LOW - s.clarity) * 12);
    recommended.sharpness = Math.min(100, delta);
    recommended.contrast = Math.min(100, recommended.contrast + Math.round(delta * 0.3));
    tips.push(`清晰度维度得分较低（${s.clarity.toFixed(1)}），已自动提升锐化+${recommended.sharpness}`);
  }
  if (s.composition < LOW) {
    tips.push(`构图维度得分较低（${s.composition.toFixed(1)}）—— 构图问题无法通过调参完全修复，建议参考三分法/引导线/黄金分割进行二次创作`);
  }
  if (s.theme < LOW) {
    const tags = (scoreRecord._artworkTags || '').toLowerCase();
    if (/古风|国风|汉服|山水/.test(tags)) styleKey = 'guofeng';
    else if (/非遗|纹样|民族|刺绣/.test(tags)) styleKey = 'feiyi';
    else if (/日系|和风|清新/.test(tags)) styleKey = 'japanese';
    else styleKey = 'cinema';
    tips.push(`主题表达得分较低（${s.theme.toFixed(1)}），已根据标签推荐 "${STYLE_PRESETS.find(s => s.key === styleKey)?.label || styleKey}" 风格滤镜`);
  }

  // 如果所有维度都 ≥ LOW，给正向提示
  if (s.lighting >= LOW && s.color >= LOW && s.clarity >= LOW && s.composition >= LOW && s.theme >= LOW) {
    tips.push('🎉 AI评分显示作品整体表现良好，建议微调即可，或选择一个风格滤镜增添艺术感');
    styleKey = styleKey || 'guofeng';
  }

  return { params: recommended, styleKey, tips };
}

// ------------------------------------------------------------
// M7: AI 智能优化（知识库决策 + 像素级增强 + 醒图式等待交互）
// ------------------------------------------------------------

/**
 * 更新醒图式等待浮层进度
 * @param {number} pct 0~100
 * @param {string} stage 阶段文案
 */
function setOptimizeProgress(pct, stage) {
  if (!domRefs) return;
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  if (domRefs.aiProgressRing) domRefs.aiProgressRing.style.setProperty('--p', p);
  if (domRefs.aiProgressPct) domRefs.aiProgressPct.textContent = p + '%';
  if (domRefs.aiStage && stage) {
    domRefs.aiStage.textContent = p >= 100 ? stage : stage + '…';
  }
}

function showOptimizeOverlay() {
  if (!domRefs || !domRefs.aiOverlay) return;
  setOptimizeProgress(0, 'AI 智能分析中');
  domRefs.aiOverlay.hidden = false;
  requestAnimationFrame(() => domRefs?.aiOverlay?.classList.add('edit-ai-overlay--on'));
}

function hideOptimizeOverlay() {
  if (!domRefs || !domRefs.aiOverlay) return;
  domRefs.aiOverlay.classList.remove('edit-ai-overlay--on');
  // 等淡出动画结束再隐藏
  setTimeout(() => { if (domRefs && domRefs.aiOverlay) domRefs.aiOverlay.hidden = true; }, 240);
}

/**
 * 将优化方案 plan 的调参映射为工作台参数结构
 * @param {object} plan synthesizePlan 结果
 */
function mergePlanParams(plan) {
  return {
    exposure: plan.params.exposure,
    contrast: plan.params.contrast,
    saturation: plan.params.saturation,
    sharpness: plan.params.sharpness,
    hsl: { hue: 0, saturation: 100, luminance: 100 }
  };
}

/**
 * M7 核心：AI 智能优化主流程
 * 阶段：智能分析 → 知识库匹配 → 色彩还原 → 细节增强 → 风格统一
 * 全程醒图式浮层展示进度，可随时取消
 */
async function runSmartOptimize() {
  if (!currentArtworkId || !sourceImage || !domRefs) return;
  if (optimizing || srRunning) return;
  optimizing = true;
  optimizeCancelled = false;
  const btn = domRefs.btnAiRecommend;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 优化中…';
  showOptimizeOverlay();
  const cancelled = () => optimizeCancelled;

  try {
    // ── 阶段一：智能分析（提取像素统计特征）0% → 15%
    setOptimizeProgress(4, 'AI 智能分析中');
    await sleep(280);
    if (cancelled()) throw new Error('__CANCELLED__');
    const features = extractImageFeatures(sourceImage); // tainted 时抛错 → 降级
    setOptimizeProgress(14, 'AI 智能分析中');
    await sleep(180);
    if (cancelled()) throw new Error('__CANCELLED__');

    // ── 阶段二：匹配内置案例知识库 15% → 25%
    setOptimizeProgress(18, '匹配案例知识库');
    let scores = null;
    let tags = [];
    try {
      const list = await getAestheticScoresByArtwork(currentArtworkId);
      if (list && list[0] && list[0].scores) scores = list[0].scores;
    } catch (_) { /* 评分不可用则纯靠像素特征 */ }
    try {
      const art = await getArtworkById(currentArtworkId);
      if (art && Array.isArray(art.tags)) tags = art.tags;
    } catch (_) { /* ignore */ }
    const plan = synthesizePlan(features, scores, tags);
    // 防叠加：管线振动饱和、滑参饱和、风格滤镜 saturate 三重叠加会过饱和/溢出
    // 滤镜含 saturate(>1.05) 时管线振动强度减半（滑参饱和已由 synthesizePlan 压制）
    {
      const styleDef = plan.styleKey ? STYLE_PRESETS.find(s => s.key === plan.styleKey) : null;
      const satM = styleDef && styleDef.cssFilter ? styleDef.cssFilter.match(/saturate\(([\d.]+)\)/) : null;
      if (satM && parseFloat(satM[1]) > 1.05 && plan.pipeline.vibrance > 0.05) {
        plan.pipeline.vibrance = Math.round(plan.pipeline.vibrance * 50) / 100;
      }
    }
    setOptimizeProgress(25, '色彩还原中');
    await sleep(160);
    if (cancelled()) throw new Error('__CANCELLED__');

    // ── 阶段三/四：像素级增强管线（色彩还原 25→55 / 细节增强 55→90）
    const enhanced = await runEnhancementPipeline(sourceImage, plan, {
      onProgress: (pct, stage) => setOptimizeProgress(pct, stage),
      isCancelled: cancelled
    });

    // ── 阶段五：风格统一 90% → 100%
    setOptimizeProgress(92, '风格统一调整中');
    if (!originalSource) originalSource = sourceImage; // 首次优化前备份原图
    sourceImage = enhanced; // 增强结果成为新的图源（叠加滑参/滤镜仍实时生效）
    currentParams = mergePlanParams(plan);
    if (plan.styleKey) currentStyleKey = plan.styleKey;
    currentTemplateKey = null;
    lastPlan = plan;
    await sleep(240);
    setOptimizeProgress(100, '优化完成');
    await sleep(380);

    // 应用到 UI
    hasOptimized = true;
    if (domRefs.btnCompare) domRefs.btnCompare.disabled = false;
    rebuildStyleGrid();
    rebuildTemplateGrid();
    rebuildSliderGroup();
    schedulePreviewRender();
    hideOptimizeOverlay();

    // 可解释的决策报告
    const caseNames = plan.matchedCases.slice(0, 3).map(c => `「${c.name}」`).join('、');
    const styleLabel = plan.styleKey ? (STYLE_PRESETS.find(s => s.key === plan.styleKey)?.label || plan.styleKey) : '';
    showAiTips([
      `✨ 已基于知识库 ${caseNames} ${plan.matchedCases.length > 3 ? '等 ' + plan.matchedCases.length + ' 个案例' : '的案例经验'}完成智能优化`,
      ...plan.tips,
      styleLabel
        ? `已匹配风格滤镜「${styleLabel}」，保持画面调性统一`
        : '色彩还原与细节增强已完成，可继续叠加风格滤镜'
    ]);
    if (window.showToast) showToast('✨ AI 智能优化完成，点击「前后对比」查看效果', 'success');
  } catch (err) {
    hideOptimizeOverlay();
    if (err && err.message === '__CANCELLED__') {
      if (window.showToast) showToast('已取消智能优化', 'info');
    } else {
      // 降级：像素级增强不可用（如跨域画布污染），退回纯参数推荐
      console.warn('[AI-Edit] 像素级增强不可用，降级为参数推荐模式:', err && err.message);
      try {
        const result = await recommendByAestheticScore(currentArtworkId);
        currentParams = result.params;
        if (result.styleKey) currentStyleKey = result.styleKey;
        currentTemplateKey = null;
        rebuildStyleGrid();
        rebuildTemplateGrid();
        rebuildSliderGroup();
        schedulePreviewRender();
        showAiTips(['（当前图片不支持像素级增强，已降级为参数推荐模式）', ...result.tips]);
        if (window.showToast) showToast('已降级为参数推荐模式', 'info');
      } catch (e2) {
        if (window.showToast) showToast('AI推荐失败：' + (e2 && e2.message || '未知错误'), 'warn');
      }
    }
  } finally {
    optimizing = false;
    if (domRefs && domRefs.btnAiRecommend) {
      domRefs.btnAiRecommend.disabled = false;
      domRefs.btnAiRecommend.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> AI智能优化';
    }
  }
}

/**
 * M9: AI超清主流程（参照图3"AI超清"交互：进度百分比 + 取消 + 完成提示）
 * 阶段：特征分析 → 预降噪 → 结构感知细节重建 → 局部微对比 → 量化验证
 * 复用 M7 醒图式等待浮层，全程展示进度，可随时取消
 */
async function runSuperResolution() {
  if (!currentArtworkId || !sourceImage || !domRefs) return;
  if (srRunning || optimizing) return;
  srRunning = true;
  srCancelled = false;
  const btn = domRefs.btnSr;
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 超清中…'; }
  showOptimizeOverlay();
  const cancelled = () => srCancelled;

  try {
    const result = await runSuperResolutionPipeline(sourceImage, {
      onProgress: (pct, stage) => setOptimizeProgress(pct, stage),
      isCancelled: cancelled
    });

    // 超清结果成为新的图源（叠加滑参/滤镜仍实时生效），并备份原图供对比/重置
    if (!originalSource) originalSource = sourceImage;
    sourceImage = result.canvas;
    hasOptimized = true;
    if (domRefs.btnCompare) domRefs.btnCompare.disabled = false;
    schedulePreviewRender(); // 触发重渲染 + 自动暂存标记
    await sleep(200);
    setOptimizeProgress(100, 'AI 超清完成');
    await sleep(360);
    hideOptimizeOverlay();

    // 可解释的量化报告（Laplacian 清晰度能量提升倍数）
    const gainPct = Math.max(0, Math.round((result.metrics.gain - 1) * 100));
    showAiTips([
      '✨ AI 超清处理完成：已恢复画面细节与边缘清晰度',
      `清晰度指标（Laplacian 边缘能量）提升约 ${gainPct}%（${result.metrics.before.toFixed(1)} → ${result.metrics.after.toFixed(1)}）`,
      '处理流程：特征分析 → 预降噪 → 结构感知细节重建 → 局部微对比；平坦区不锐化，杜绝 AI 幻觉纹理',
      '点击「前后对比」可拖动分割线查看超清前后效果'
    ]);
    if (window.showToast) showToast(`✨ AI 超清完成，清晰度提升约 ${gainPct}%`, 'success');
  } catch (err) {
    hideOptimizeOverlay();
    if (err && err.message === '__CANCELLED__') {
      if (window.showToast) showToast('已取消 AI 超清', 'info');
    } else {
      console.warn('[AI-Edit] AI超清处理失败:', err && err.message);
      if (window.showToast) showToast('AI 超清失败：' + (err && err.message || '未知错误'), 'warn');
    }
  } finally {
    srRunning = false;
    if (domRefs && domRefs.btnSr) {
      domRefs.btnSr.disabled = false;
      domRefs.btnSr.innerHTML = '<i class="fa-solid fa-expand"></i> AI超清';
    }
  }
}

/**
 * M7: 应用/退出前后对比模式 UI
 */
function applyCompareUI() {
  if (!domRefs) return;
  const active = compareActive && hasOptimized;
  if (domRefs.compareLayer) domRefs.compareLayer.hidden = !active;
  if (domRefs.compareRange) domRefs.compareRange.hidden = !active;
  if (domRefs.btnCompare) {
    domRefs.btnCompare.classList.toggle('active', active);
    domRefs.btnCompare.innerHTML = active
      ? '<i class="fa-solid fa-columns"></i> 退出对比'
      : '<i class="fa-solid fa-columns"></i> 前后对比';
  }
  if (active) {
    // 原图叠加层（originalSource 为优化前图源）
    if (domRefs.compareOriginal && originalSource) {
      const src = originalSource.src || (originalSource.toDataURL ? originalSource.toDataURL('image/jpeg', 0.92) : '');
      if (domRefs.compareOriginal.src !== src) domRefs.compareOriginal.src = src;
    }
    updateComparePosition(Number(domRefs.compareRange?.value ?? 50));
  }
}

/**
 * M7: 更新对比分割位置（原图左侧裁剪 + 分割线）
 * @param {number} v 0~100
 */
function updateComparePosition(v) {
  if (!domRefs) return;
  const pct = Math.max(0, Math.min(100, v));
  if (domRefs.compareOriginal) {
    domRefs.compareOriginal.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
  }
  if (domRefs.compareDivider) {
    domRefs.compareDivider.style.left = pct + '%';
  }
}

// ------------------------------------------------------------
// SubTask 6.4: DOM 构建与 UI 交互
// ------------------------------------------------------------

/**
 * 创建修图工作台 DOM（整体结构）
 * @returns {HTMLElement} 根节点
 */
function createWorkbench() {
  const wrap = document.createElement('section');
  wrap.className = 'edit-workbench glass';
  wrap.innerHTML = `
    <header class="edit-header">
      <div class="edit-title-row">
        <h2 class="edit-title"><i class="fa-solid fa-paintbrush"></i> AI修图工作台</h2>
      </div>
      <p class="edit-subtitle">19 款风格滤镜 · 10 套一键模板 · AI智能优化 · 版本管理</p>
      <div class="edit-header-actions">
        <span class="edit-autosave-tag" id="edit-autosave-tag" hidden><i class="fa-solid fa-cloud-arrow-down"></i> <span id="edit-autosave-time"></span></span>
        <button class="btn-ghost" id="edit-ai-recommend" title="基于知识库案例的AI智能优化"><i class="fa-solid fa-wand-magic-sparkles"></i> AI智能优化</button>
        <button class="btn-ghost" id="edit-sr" title="AI超清：恢复细节、提升清晰度"><i class="fa-solid fa-expand"></i> AI超清</button>
        <button class="btn-primary" id="edit-save-hd" title="保存高清作品到你的设备"><i class="fa-solid fa-download"></i> 保存作品</button>
        <button class="btn-ghost" id="edit-close" title="关闭工作台"><i class="fa-solid fa-xmark"></i> 关闭</button>
      </div>
    </header>

    <div class="edit-body">
      <!-- 左侧预览 -->
      <div class="edit-preview-area">
        <div class="edit-original-label">
          <span class="edit-art-title" id="edit-art-title">加载中…</span>
          <span class="edit-art-no" id="edit-art-no"></span>
        </div>
        <div class="edit-canvas-wrap" id="edit-canvas-wrap">
          <div class="edit-canvas-box" id="edit-canvas-box">
            <canvas id="edit-preview-canvas" class="edit-preview-canvas" aria-label="修图预览"></canvas>
            <!-- M7: 前后对比层（原图按分割线裁剪叠加） -->
            <div class="edit-compare-layer" id="edit-compare-layer" hidden>
              <img id="edit-compare-original" class="edit-compare-original" alt="原图" />
              <div class="edit-compare-divider" id="edit-compare-divider">
                <span class="edit-compare-handle"><i class="fa-solid fa-left-right"></i></span>
              </div>
              <span class="edit-compare-tag edit-compare-tag-l">原图</span>
              <span class="edit-compare-tag edit-compare-tag-r">AI 优化后</span>
            </div>
            <!-- M7: 醒图式智能优化等待浮层 -->
            <div class="edit-ai-overlay" id="edit-ai-overlay" hidden>
              <div class="edit-ai-overlay-card">
                <div class="edit-ai-progress-ring" id="edit-ai-progress-ring">
                  <span class="edit-ai-progress-pct" id="edit-ai-progress-pct">0%</span>
                </div>
                <div class="edit-ai-stage" id="edit-ai-stage">AI 智能分析中…</div>
                <div class="edit-ai-sub" id="edit-ai-sub">效果即将生成，请耐心等待</div>
                <button class="edit-ai-cancel" id="edit-ai-cancel">取消</button>
              </div>
            </div>
            <!-- M8: 保存成功引导卡片（高清保存后出现，引导发布） -->
            <div class="edit-save-card" id="edit-save-card" hidden>
              <i class="fa-solid fa-circle-check edit-save-card-icon"></i>
              <div class="edit-save-card-title" id="edit-save-card-title">作品已保存到你的设备</div>
              <div class="edit-save-card-sub" id="edit-save-card-sub">可以发布到社区，让更多人看到你的创作</div>
              <div class="edit-save-card-actions">
                <button class="btn-ghost" id="edit-save-card-later">继续编辑</button>
                <button class="btn-primary" id="edit-save-card-publish"><i class="fa-solid fa-cloud-arrow-up"></i> 发布作品</button>
              </div>
            </div>
            <div class="edit-canvas-loading" id="edit-canvas-loading">
              <i class="fa-solid fa-spinner fa-spin"></i> 图片加载中…
            </div>
            <!-- M7: 前后对比分割滑杆 -->
            <input type="range" id="edit-compare-range" class="edit-compare-range" min="0" max="100" value="50" step="1" hidden aria-label="前后对比分割位置" />
          </div>
        </div>
        <!-- M9: 画布下方次级功能小按钮行（醒图式，参照图2：重置/前后对比/保存版本不再是头部主按钮） -->
        <div class="edit-canvas-tools" id="edit-canvas-tools">
          <button class="edit-tool-btn" id="edit-reset" title="重置所有参数"><i class="fa-solid fa-rotate-left"></i> 重置</button>
          <button class="edit-tool-btn" id="edit-compare" title="前后效果对比" disabled><i class="fa-solid fa-columns"></i> 前后对比</button>
          <button class="edit-tool-btn" id="edit-save" title="保存修图版本到历史记录"><i class="fa-solid fa-floppy-disk"></i> 保存版本</button>
        </div>
        <div class="edit-ai-tips" id="edit-ai-tips" style="display:none"></div>
      </div>

      <!-- 右侧控制面板 -->
      <div class="edit-control-area">
        <!-- 风格滤镜 -->
        <div class="edit-panel">
          <h3 class="edit-panel-title"><i class="fa-solid fa-wand-magic-sparkles"></i> 风格滤镜</h3>
          <div class="edit-style-grid" id="edit-style-grid"></div>
        </div>

        <!-- M6c: 一键模板 -->
        <div class="edit-panel">
          <h3 class="edit-panel-title"><i class="fa-solid fa-layer-group"></i> 一键模板</h3>
          <div class="edit-style-grid" id="edit-template-grid"></div>
        </div>

        <!-- 基础调参 -->
        <div class="edit-panel">
          <h3 class="edit-panel-title"><i class="fa-solid fa-sliders"></i> 基础调参</h3>
          <div class="edit-slider-group" id="edit-slider-group"></div>
        </div>

        <!-- 历史版本 -->
        <div class="edit-panel">
          <h3 class="edit-panel-title"><i class="fa-solid fa-clock-rotate-left"></i> 历史版本 <span class="edit-version-count" id="edit-version-count">0</span></h3>
          <div class="edit-version-list" id="edit-version-list"></div>
        </div>
      </div>
    </div>
  `;
  return wrap;
}

/**
 * 绑定所有 UI 事件（滑块/滤镜/按钮）
 */
function bindUIEvents() {
  if (!domRefs) return;

  // 重置按钮
  domRefs.btnReset?.addEventListener('click', () => {
    currentParams = JSON.parse(JSON.stringify(DEFAULT_PARAMS));
    currentStyleKey = 'none';
    currentTemplateKey = null;
    // M7: 若已做过智能优化，恢复原图
    if (hasOptimized && originalSource) {
      sourceImage = originalSource;
      hasOptimized = false;
      lastPlan = null;
    }
    compareActive = false;
    if (domRefs.btnCompare) domRefs.btnCompare.disabled = true;
    applyCompareUI();
    rebuildStyleGrid();
    rebuildTemplateGrid();
    rebuildSliderGroup();
    schedulePreviewRender();
    hideAiTips();
  });

  // M7: AI智能优化按钮（重构：知识库决策 + 像素级增强 + 醒图式等待交互）
  domRefs.btnAiRecommend?.addEventListener('click', () => {
    if (typeof Sound !== 'undefined') Sound.playSound('click');
    runSmartOptimize();
  });

  // M7: 取消智能优化 / M9: 取消AI超清（同一浮层同一取消按钮）
  domRefs.aiCancel?.addEventListener('click', () => {
    optimizeCancelled = true;
    srCancelled = true;
  });

  // M9: AI超清按钮
  domRefs.btnSr?.addEventListener('click', () => {
    if (typeof Sound !== 'undefined') Sound.playSound('click');
    runSuperResolution();
  });

  // M7: 前后对比切换
  domRefs.btnCompare?.addEventListener('click', () => {
    if (!hasOptimized) return;
    if (typeof Sound !== 'undefined') Sound.playSound('click');
    compareActive = !compareActive;
    applyCompareUI();
  });

  // M7: 对比分割滑杆
  domRefs.compareRange?.addEventListener('input', () => {
    updateComparePosition(Number(domRefs.compareRange.value));
  });

  // 保存按钮
  domRefs.btnSave?.addEventListener('click', async () => {
    if (!currentArtworkId) return;
    const user = window.currentUser;
    if (!user) {
      if (window.Auth) Auth.requireLogin();
      return;
    }
    if (typeof Sound !== 'undefined') Sound.playSound('click');
    domRefs.btnSave.disabled = true;
    domRefs.btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 保存中…';
    try {
      const imageData = exportCanvasBase64();
      const record = {
        artworkId: currentArtworkId,
        userId: user.id || user.username,
        versionType: currentStyleKey === 'none' ? 'manual-edit' : 'ai-edit',
        parameters: {
          exposure: currentParams.exposure,
          contrast: currentParams.contrast,
          saturation: currentParams.saturation,
          sharpness: currentParams.sharpness,
          hsl: { ...currentParams.hsl },
          template: currentTemplateKey || undefined,
          // M7: 记录智能优化决策来源（命中案例）
          smartOpt: lastPlan
            ? { cases: lastPlan.matchedCases.slice(0, 3).map(c => c.name), styleKey: lastPlan.styleKey }
            : undefined
        },
        filterName: currentStyleKey,
        imageData: imageData
      };
      const saved = await addEditVersion(record);
      await loadVersionHistory();
      if (window.showToast) showToast(`✂️ 版本 #${saved.id} 已保存`, 'success');
    } catch (err) {
      console.error('[AI-Edit] 保存版本失败:', err);
      if (window.showToast) showToast('保存失败：' + (err && err.message || '未知错误'), 'error');
    } finally {
      domRefs.btnSave.disabled = false;
      domRefs.btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> 保存版本';
    }
  });

  // 关闭按钮
  domRefs.btnClose?.addEventListener('click', () => {
    closeEdit();
  });

  // M8: 保存作品（高清导出到设备）→ 成功后引导发布
  domRefs.btnSaveHd?.addEventListener('click', async () => {
    if (typeof Sound !== 'undefined') Sound.playSound('click');
    const btn = domRefs.btnSaveHd;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 保存中…';
    try {
      await new Promise(r => setTimeout(r, 60)); // 让加载态先渲染一帧
      const { dataUrl, fileName } = exportHighQuality();
      if (!dataUrl) throw new Error('画布为空或图片跨域受限，无法导出');
      // 触发浏览器下载（保存到用户设备）
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      lastHdDataUrl = dataUrl;
      showSaveCard();
      if (window.showToast) showToast('已保存高清作品到你的设备', 'success');
    } catch (err) {
      console.error('[AI-Edit] 高清保存失败:', err && err.message);
      if (window.showToast) showToast('保存失败：' + (err && err.message || '未知错误'), 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-download"></i> 保存作品';
    }
  });

  // M8: 保存成功卡片 — 继续编辑 / 发布作品
  domRefs.saveCardLater?.addEventListener('click', () => {
    if (typeof Sound !== 'undefined') Sound.playSound('click');
    hideSaveCard();
  });
  domRefs.saveCardPublish?.addEventListener('click', () => {
    if (typeof Sound !== 'undefined') Sound.playSound('click');
    const dataUrl = lastHdDataUrl;
    const artTitle = domRefs.artTitle ? domRefs.artTitle.textContent.trim() : '修图作品';
    const artworkId = currentArtworkId;
    hideSaveCard();
    closeEdit();
    // 引导前往发布页：带入修图结果，用户补标题/描述即可发布
    if (window.Publish && dataUrl) {
      Publish.showPublishModal({
        dataUrl,
        name: artTitle + '.jpg',
        artworkId
      });
    } else if (window.Publish) {
      Publish.showPublishModal();
    } else if (window.showToast) {
      showToast('已保存作品，可点击顶部「发布」继续发布', 'info');
    }
  });

  // ESC 键关闭
  const onEsc = (e) => {
    if (e.key === 'Escape') closeEdit();
  };
  document.addEventListener('keydown', onEsc);
  // 保存 handler 引用以便清理
  domRefs._escHandler = onEsc;

  // 窗口 resize 重绘
  const onResize = () => schedulePreviewRender();
  window.addEventListener('resize', onResize);
  domRefs._resizeHandler = onResize;
}

/**
 * 构建风格滤镜按钮网格
 */
function rebuildStyleGrid() {
  if (!domRefs || !domRefs.styleGrid) return;
  domRefs.styleGrid.innerHTML = '';
  STYLE_PRESETS.forEach(preset => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `edit-style-chip${preset.key === currentStyleKey ? ' active' : ''}`;
    btn.dataset.key = preset.key;
    btn.title = preset.desc;
    btn.innerHTML = `
      <span class="edit-style-icon"><i class="fa-solid ${preset.icon}"></i></span>
      <span class="edit-style-label">${preset.label}</span>
      ${preset.cssFilter ? `<span class="edit-style-preview" style="filter:${preset.cssFilter}"></span>` : ''}
    `;
    btn.addEventListener('click', () => {
      if (typeof Sound !== 'undefined') Sound.playSound('click');
      currentStyleKey = preset.key;
      // M6c: 手动选滤镜视为脱离模板
      if (currentTemplateKey !== null) {
        currentTemplateKey = null;
        rebuildTemplateGrid();
      }
      rebuildStyleGrid();
      schedulePreviewRender();
    });
    domRefs.styleGrid.appendChild(btn);
  });
}

/**
 * M6c: 构建一键模板按钮网格（复用风格芯片样式，零新增 CSS）
 */
function rebuildTemplateGrid() {
  if (!domRefs || !domRefs.templateGrid) return;
  domRefs.templateGrid.innerHTML = '';
  TEMPLATE_PRESETS.forEach(tpl => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'edit-style-chip' + (tpl.key === currentTemplateKey ? ' active' : '');
    btn.title = tpl.desc;
    btn.innerHTML = '<span class="edit-style-icon"><i class="fa-solid ' + tpl.icon + '"></i></span>' +
      '<span class="edit-style-label">' + tpl.label + '</span>';
    btn.addEventListener('click', () => {
      if (typeof Sound !== 'undefined') Sound.playSound('click');
      applyTemplate(tpl);
    });
    domRefs.templateGrid.appendChild(btn);
  });
}

/**
 * M6c: 应用一键模板（滤镜 + 调参组合，一键成片）
 * @param {object} tpl - TEMPLATE_PRESETS 项
 */
function applyTemplate(tpl) {
  currentStyleKey = tpl.styleKey;
  currentTemplateKey = tpl.key;
  // 以默认参数为底，模板参数覆盖（绝对值）
  const base = JSON.parse(JSON.stringify(DEFAULT_PARAMS));
  Object.assign(base, tpl.params || {});
  currentParams = base;
  rebuildStyleGrid();
  rebuildTemplateGrid();
  rebuildSliderGroup();
  schedulePreviewRender();
  if (window.showToast) showToast('已应用模板「' + tpl.label + '」', 'info');
}

/**
 * 构建滑块组
 */
function rebuildSliderGroup() {
  if (!domRefs || !domRefs.sliderGroup) return;
  domRefs.sliderGroup.innerHTML = '';

  PARAM_SLIDERS.forEach(s => {
    // 从 currentParams 取值（hue/hslSat/hslLum 映射到 hsl 对象）
    let value;
    if (s.key === 'hue') value = currentParams.hsl.hue;
    else if (s.key === 'hslSat') value = currentParams.hsl.saturation;
    else if (s.key === 'hslLum') value = currentParams.hsl.luminance;
    else value = currentParams[s.key];

    const row = document.createElement('div');
    row.className = 'edit-slider-row';
    row.innerHTML = `
      <label class="edit-slider-label">
        <i class="fa-solid ${s.icon}"></i>
        <span>${s.label}</span>
        <span class="edit-slider-value" data-value="${s.key}">${value}</span>
      </label>
      <input type="range" class="edit-range" min="${s.min}" max="${s.max}" step="${s.step}" value="${value}" data-param="${s.key}" />
    `;
    const input = row.querySelector('input[type="range"]');
    const valEl = row.querySelector('.edit-slider-value');
    input.addEventListener('input', () => {
      const v = Number(input.value);
      valEl.textContent = v;
      // 更新参数对象
      if (s.key === 'hue') currentParams.hsl.hue = v;
      else if (s.key === 'hslSat') currentParams.hsl.saturation = v;
      else if (s.key === 'hslLum') currentParams.hsl.luminance = v;
      else currentParams[s.key] = v;
      // M6c: 手动调参视为脱离模板，取消模板高亮
      if (currentTemplateKey !== null) {
        currentTemplateKey = null;
        rebuildTemplateGrid();
      }
      schedulePreviewRender();
    });
    domRefs.sliderGroup.appendChild(row);
  });
}

/**
 * 显示 AI 推荐提示条
 * @param {string[]} tips
 */
function showAiTips(tips) {
  if (!domRefs || !domRefs.aiTips) return;
  if (!tips || !tips.length) { hideAiTips(); return; }
  domRefs.aiTips.innerHTML = `
    <div class="edit-ai-tips-title"><i class="fa-solid fa-wand-magic-sparkles"></i> AI推荐建议</div>
    <ul class="edit-ai-tips-list">
      ${tips.map(t => `<li>${t}</li>`).join('')}
    </ul>
  `;
  domRefs.aiTips.style.display = 'block';
}

function hideAiTips() {
  if (domRefs && domRefs.aiTips) domRefs.aiTips.style.display = 'none';
}

// ------------------------------------------------------------
// SubTask 6.5: 版本历史加载与回溯
// ------------------------------------------------------------

/**
 * 从 IndexedDB 加载当前作品的修图版本历史
 */
async function loadVersionHistory() {
  if (!domRefs || !domRefs.versionList) return;
  domRefs.versionList.innerHTML = '<div class="edit-version-loading"><i class="fa-solid fa-spinner fa-spin"></i></div>';
  try {
    const list = await getEditVersionsByArtwork(currentArtworkId);
    domRefs.versionCount.textContent = list.length;
    if (!list.length) {
      domRefs.versionList.innerHTML = '<div class="edit-version-empty">暂无历史版本，调整参数后点击「保存版本」</div>';
      return;
    }
    domRefs.versionList.innerHTML = '';
    list.forEach(v => {
      const card = document.createElement('div');
      card.className = 'edit-version-card';
      card.dataset.versionId = v.id;
      const time = new Date(v.createdAt);
      const timeStr = `${time.getMonth() + 1}/${time.getDate()} ${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
      const paramSummary = summarizeParams(v.parameters);
      const styleLabel = STYLE_PRESETS.find(s => s.key === v.filterName)?.label || (v.filterName || '');
      card.innerHTML = `
        <div class="edit-version-thumb">
          ${v.imageData ? `<img src="${v.imageData}" alt="版本 ${v.id}" />` : '<div class="edit-version-thumb-empty"><i class="fa-solid fa-image"></i></div>'}
        </div>
        <div class="edit-version-info">
          <div class="edit-version-head">
            <span class="edit-version-type">${v.versionType === 'ai-edit' ? '<i class="fa-solid fa-wand-magic-sparkles"></i> AI' : v.versionType === 'auto-save' ? '<i class="fa-solid fa-cloud-arrow-down"></i> 自动' : '<i class="fa-solid fa-paintbrush"></i> 手动'}</span>
            <span class="edit-version-time">${timeStr}</span>
          </div>
          <div class="edit-version-meta">#${v.id} ${styleLabel ? '· ' + styleLabel : ''}</div>
          <div class="edit-version-params">${paramSummary}</div>
        </div>
        <div class="edit-version-actions">
          <button class="edit-version-restore btn-ghost" title="恢复此版本"><i class="fa-solid fa-rotate-left"></i></button>
          <button class="edit-version-delete btn-ghost" title="删除此版本"><i class="fa-solid fa-trash"></i></button>
        </div>
      `;
      // 恢复按钮
      card.querySelector('.edit-version-restore')?.addEventListener('click', async () => {
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        await restoreVersion(v);
      });
      // 删除按钮
      card.querySelector('.edit-version-delete')?.addEventListener('click', async () => {
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        if (!confirm(`确认删除版本 #${v.id}？此操作不可撤销`)) return;
        try {
          await deleteEditVersion(v.id);
          await loadVersionHistory();
          if (window.showToast) showToast('版本已删除', 'info');
        } catch (err) {
          if (window.showToast) showToast('删除失败：' + (err && err.message || '未知错误'), 'error');
        }
      });
      domRefs.versionList.appendChild(card);
    });
  } catch (err) {
    console.error('[AI-Edit] 加载版本历史失败:', err);
    domRefs.versionList.innerHTML = '<div class="edit-version-empty">加载失败，请刷新重试</div>';
  }
}

/**
 * 将 parameters 对象概括为简短描述
 * @param {object} params
 * @returns {string}
 */
function summarizeParams(params) {
  if (!params) return '';
  const parts = [];
  if (params.exposure !== undefined && params.exposure !== 0) parts.push(`曝光${params.exposure > 0 ? '+' : ''}${params.exposure}`);
  if (params.contrast !== undefined && params.contrast !== 0) parts.push(`对比${params.contrast > 0 ? '+' : ''}${params.contrast}`);
  if (params.saturation !== undefined && params.saturation !== 100) parts.push(`饱和${params.saturation}`);
  if (params.sharpness !== undefined && params.sharpness !== 0) parts.push(`锐化${params.sharpness}`);
  const hsl = params.hsl;
  if (hsl && hsl.hue !== undefined && hsl.hue !== 0) parts.push(`色相${hsl.hue}°`);
  return parts.join(' · ') || '默认参数';
}

/**
 * 从历史版本恢复参数
 * @param {object} versionRecord
 */
async function restoreVersion(versionRecord) {
  try {
    if (versionRecord.parameters) {
      // 深拷贝，补全缺失字段
      const p = JSON.parse(JSON.stringify(versionRecord.parameters));
      currentParams = {
        exposure: p.exposure ?? 0,
        contrast: p.contrast ?? 0,
        saturation: p.saturation ?? 100,
        sharpness: p.sharpness ?? 0,
        hsl: {
          hue: p.hsl?.hue ?? 0,
          saturation: p.hsl?.saturation ?? 100,
          luminance: p.hsl?.luminance ?? 100
        }
      };
    }
    if (versionRecord.filterName) {
      currentStyleKey = versionRecord.filterName;
    }
    // M6c: 回填模板高亮（若该版本由模板生成）
    currentTemplateKey = (versionRecord.parameters && versionRecord.parameters.template) || null;
    rebuildStyleGrid();
    rebuildTemplateGrid();
    rebuildSliderGroup();
    schedulePreviewRender();
    if (window.showToast) showToast(`✓ 已恢复版本 #${versionRecord.id}`, 'success');
  } catch (err) {
    if (window.showToast) showToast('恢复失败：' + (err && err.message || '未知错误'), 'error');
  }
}

// ------------------------------------------------------------
// SubTask 6.6: 入口 openEdit / 出口 closeEdit
// ------------------------------------------------------------

/**
 * 打开 AI 修图工作台
 * 路由格式：#/edit?artworkId=xxx&focus=lighting
 * @param {object} opts - { artworkId: number|string, focus?: string }
 */
async function openEdit(opts = {}) {
  const artworkId = Number(opts.artworkId) || null;
  if (!artworkId) {
    if (window.showToast) showToast('缺少作品参数，无法打开修图工作台', 'warn');
    return;
  }
  currentArtworkId = artworkId;

  // 读取作品信息
  let artwork = null;
  try {
    artwork = await getArtworkById(artworkId);
  } catch (_) { /* ignore */ }
  if (!artwork) {
    if (window.showToast) showToast('作品不存在或已被删除', 'warn');
    return;
  }

  // 关闭已有的灯箱/弹窗（防止叠加）
  if (window.Gallery && typeof Gallery.closeLightbox === 'function') {
    try { Gallery.closeLightbox(); } catch (_) { /* ignore */ }
  }

  // 如果已挂载，先关闭重建（避免 DOM 残留）
  if (mounted) closeEdit();

  // 重置参数
  currentParams = JSON.parse(JSON.stringify(DEFAULT_PARAMS));
  currentStyleKey = 'none';
  currentTemplateKey = null;
  // M7: 重置智能优化状态
  originalSource = null;
  hasOptimized = false;
  compareActive = false;
  optimizing = false;
  optimizeCancelled = false;
  lastPlan = null;

  // 构建 DOM
  const wrap = createWorkbench();
  wrap.id = 'ai-edit-workbench';
  wrap.className += ' edit-workbench-mounted';

  // 插入到 body 末尾（覆盖层）
  document.body.appendChild(wrap);

  // 锁定背景滚动
  if (window.ModalScrollLock) window.ModalScrollLock.lock();

  // 引用缓存
  domRefs = {
    root: wrap,
    previewCanvas: wrap.querySelector('#edit-preview-canvas'),
    canvasBox: wrap.querySelector('#edit-canvas-box'),
    canvasLoading: wrap.querySelector('#edit-canvas-loading'),
    artTitle: wrap.querySelector('#edit-art-title'),
    artNo: wrap.querySelector('#edit-art-no'),
    btnReset: wrap.querySelector('#edit-reset'),
    btnAiRecommend: wrap.querySelector('#edit-ai-recommend'),
    btnSr: wrap.querySelector('#edit-sr'),
    btnCompare: wrap.querySelector('#edit-compare'),
    btnSave: wrap.querySelector('#edit-save'),
    btnClose: wrap.querySelector('#edit-close'),
    styleGrid: wrap.querySelector('#edit-style-grid'),
    templateGrid: wrap.querySelector('#edit-template-grid'),
    sliderGroup: wrap.querySelector('#edit-slider-group'),
    versionList: wrap.querySelector('#edit-version-list'),
    versionCount: wrap.querySelector('#edit-version-count'),
    aiTips: wrap.querySelector('#edit-ai-tips'),
    // M7: 智能优化浮层 / 对比层
    aiOverlay: wrap.querySelector('#edit-ai-overlay'),
    aiProgressRing: wrap.querySelector('#edit-ai-progress-ring'),
    aiProgressPct: wrap.querySelector('#edit-ai-progress-pct'),
    aiStage: wrap.querySelector('#edit-ai-stage'),
    aiCancel: wrap.querySelector('#edit-ai-cancel'),
    compareLayer: wrap.querySelector('#edit-compare-layer'),
    compareOriginal: wrap.querySelector('#edit-compare-original'),
    compareDivider: wrap.querySelector('#edit-compare-divider'),
    compareRange: wrap.querySelector('#edit-compare-range'),
    // M8: 高清保存 / 发布引导 / 自动暂存
    btnSaveHd: wrap.querySelector('#edit-save-hd'),
    saveCard: wrap.querySelector('#edit-save-card'),
    saveCardLater: wrap.querySelector('#edit-save-card-later'),
    saveCardPublish: wrap.querySelector('#edit-save-card-publish'),
    autosaveTag: wrap.querySelector('#edit-autosave-tag'),
    autosaveTime: wrap.querySelector('#edit-autosave-time'),
    _escHandler: null,
    _resizeHandler: null
  };

  // 设置作品信息
  domRefs.artTitle.textContent = artwork.title || '未命名作品';
  domRefs.artNo.textContent = `#${artwork.id}`;

  // 初始化 Canvas
  canvasCtx = domRefs.previewCanvas.getContext('2d');

  // 构建 UI 控件
  rebuildStyleGrid();
  rebuildTemplateGrid();
  rebuildSliderGroup();

  // 绑定事件
  bindUIEvents();

  // 加载版本历史
  loadVersionHistory();

  // 加载原图并渲染
  const imgUrl = artwork.imageUrl || (Array.isArray(artwork.images) && artwork.images[0]) || '';
  if (domRefs.canvasLoading) domRefs.canvasLoading.style.display = 'flex';
  try {
    sourceImage = await loadImage(imgUrl);
    if (domRefs.canvasLoading) domRefs.canvasLoading.style.display = 'none';
    schedulePreviewRender();
  } catch (err) {
    if (domRefs.canvasLoading) {
      domRefs.canvasLoading.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> 图片加载失败：${err && err.message || '未知错误'}`;
    }
  }

  // focus 参数：如果有，自动触发 AI 推荐
  if (opts.focus) {
    const focusMap = {
      lighting: 'btnAiRecommend',
      color: 'btnAiRecommend',
      clarity: 'btnAiRecommend'
    };
    // 有 focus 参数时，延迟触发 AI 推荐（等图片加载完）
    setTimeout(() => domRefs?.btnAiRecommend?.click(), 600);
  }

  // 入场动画
  requestAnimationFrame(() => {
    wrap.classList.add('edit-workbench--open');
  });

  mounted = true;
}

/**
 * 关闭修图工作台（完整清理资源）
 */
function closeEdit() {
  if (!mounted || !domRefs) return;

  // M7: 取消进行中的智能优化
  optimizeCancelled = true;
  optimizing = false;

  // M9: 取消进行中的 AI超清
  srCancelled = true;
  srRunning = false;

  // M8: 清理自动暂存定时器与保存卡片状态
  clearTimeout(autoSaveTimer);
  autoSaveTimer = 0;
  autoSaveDirty = false;
  autoSaving = false;
  hideSaveCard();
  lastHdDataUrl = '';

  // 取消 pending RAF
  if (previewRafId) {
    cancelAnimationFrame(previewRafId);
    previewRafId = 0;
  }

  // 移除事件监听器
  if (domRefs._escHandler) {
    document.removeEventListener('keydown', domRefs._escHandler);
    domRefs._escHandler = null;
  }
  if (domRefs._resizeHandler) {
    window.removeEventListener('resize', domRefs._resizeHandler);
    domRefs._resizeHandler = null;
  }

  // 关闭 Canvas（释放位图内存）
  if (domRefs.previewCanvas) {
    const c = domRefs.previewCanvas;
    c.width = 0;
    c.height = 0;
  }
  canvasCtx = null;
  sourceImage = null;

  // 解锁背景滚动
  if (window.ModalScrollLock) window.ModalScrollLock.unlock();

  // DOM 退场动画 → 移除
  const root = domRefs.root;
  if (root) {
    root.classList.remove('edit-workbench--open');
    root.classList.add('edit-workbench--leaving');
    setTimeout(() => {
      if (root.parentNode) root.remove();
    }, 320);
  }

  // 重置状态
  domRefs = null;
  currentArtworkId = null;
  currentParams = JSON.parse(JSON.stringify(DEFAULT_PARAMS));
  currentStyleKey = 'none';
  currentTemplateKey = null;
  // M7: 重置智能优化状态
  originalSource = null;
  hasOptimized = false;
  compareActive = false;
  optimizeCancelled = false;
  lastPlan = null;
  mounted = false;
}

/**
 * 便捷函数：从 hash 路由参数解析并打开工作台
 * 支持格式：#/edit?artworkId=5 &focus=lighting
 */
function openFromHash() {
  const hash = window.location.hash || '';
  const match = hash.match(/^#\/edit(?:\?(.*))?$/);
  if (!match) return false;
  const qs = match[1] || '';
  const params = {};
  qs.split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });
  if (params.artworkId) {
    openEdit({ artworkId: params.artworkId, focus: params.focus }).catch(err => {
      console.error('[AI-Edit] openFromHash 失败:', err);
    });
  } else if (window.Gallery && typeof window.Gallery.openArtworkPicker === 'function') {
    // M1-2: 裸路由无 artworkId → 降级为作品选择器
    window.Gallery.openArtworkPicker((id) => {
      openEdit({ artworkId: id }).catch(err => {
        console.error('[AI-Edit] openFromHash 失败:', err);
      });
    }, '选择作品 · AI修图');
  }
  return true;
}

// ------------------------------------------------------------
// 模块导出（ES Module）
// ------------------------------------------------------------
export {
  // 入口/出口
  openEdit,
  closeEdit,
  openFromHash,
  // 参数/滤镜（外部可引用）
  DEFAULT_PARAMS,
  STYLE_PRESETS,
  TEMPLATE_PRESETS,
  PARAM_SLIDERS,
  // 工具函数（测试/调试用）
  buildCssFilter,
  recommendByAestheticScore,
  exportCanvasBase64,
  // M7: 智能优化流程（测试/外部调用）
  runSmartOptimize
};

// ------------------------------------------------------------
// 全局挂载（兼容非模块化旧代码通过 window.AIEdit 调用）
// ------------------------------------------------------------
if (typeof window !== 'undefined') {
  window.AIEdit = {
    openEdit,
    closeEdit,
    openFromHash,
    DEFAULT_PARAMS,
    STYLE_PRESETS,
    TEMPLATE_PRESETS,
    PARAM_SLIDERS,
    buildCssFilter,
    recommendByAestheticScore,
    exportCanvasBase64,
    runSmartOptimize
  };
}
