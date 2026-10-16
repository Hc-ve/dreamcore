// ============================================================
// js/ai-craft.js — M3 AI 文创衍生品生成器
// 职责：
//   1. 基于作品 Canvas 合成 5 类文创衍生品（壁纸/海报/藏品卡/明信片/模板）
//   2. 3 种风格模板叠加（国风/非遗纹样/现代极简）
//   3. Canvas 合成 + 模板叠加 + 文字排版 + dpr 高清适配
//   4. 版本管理（ai_crafts 表）：保存/回溯/删除历史文创
//   5. 路由 #/craft?artworkId=xxx 打开工作台
// 设计原则：
//   1. 纯原生 DOM + Canvas 2D，不引入第三方 UI/绘图库
//   2. 参数变化实时预览（requestAnimationFrame 节流 60fps）
//   3. AI 生成内容显式标注"✨ AI辅助生成"（DOM 徽章 + Canvas 水印）
//   4. 离开路由时完整清理（Canvas / 事件监听器 / RAF）
// 依赖：./db.js（ai_crafts CRUD + getArtworkById）
// ============================================================

import {
  getArtworkById,
  addAiCraft,
  getAiCraftsByArtwork,
  deleteAiCraft,
  recordFootprint,
  addOrder
} from './db.js';

// M6c-1: AI 灵感一键生成（文本能力经 /api/ai 代理，前端零密钥）
// 融合改造层2: 图生图（qwen-image-3.0 I2I，提交/查询分离）
import { textGeneration, imageRepaintSubmit, imageRepaintQuery } from './ai-inference.js';

// 融合改造层1: 版式引擎（纯 Canvas 零 AI 依赖，分镜叠压 + 全局调色 + 宣纸纹理）
import { LAYOUTS, getLayoutsForType, buildLayoutCanvas } from './craft-layout.js';

// P0-1: 文创实物场景预览（纯 Canvas 2D 样机合成，桌面/相框/手机/卡册/社交 5 场景）
import { buildMockupCanvas, SCENES as MOCKUP_SCENES, TYPE_SCENE_MAP as MOCKUP_TYPE_SCENE_MAP } from './craft-mockup.js';

// 阶段C: 3D 旋转实物预览（three.js 懒加载，22 形态程序化建模，贴图源 = 结果画布）
import * as Craft3D from './craft-3d.js';
import { buildImagePrompt, suggestPromptImprovements, detectArtDirection } from './craft-prompt-builder.js';

// 景区文化智能风格匹配引擎：景区 areaId → AI 风格 / 品类建议
import { getScenicCraft } from '../data/scenic-craft-map.js';
// 景区库：按 areaId 查景区中文名（供匹配提示条展示用）
import { getAreaById } from '../data/scenic-spots.js';

// T2 全品类知识库（data/craft-products.js，10 大类 235 种产品）：
// AI 方案输出具体落地产品名（冰箱贴/徽章/书签…），按 canvasType 映射到 5 种设计画布
// 阶段B：两级品类选择器（大类 chips + 产品网格）直接消费本知识库
import { CRAFT_PRODUCTS, CRAFT_CATEGORIES, getProductsByCategory, searchProducts, getProductByName, getCategory } from '../data/craft-products.js';

// G-08 修复：消除 culture-knowledge.js 的双重导入警告（原两处动态 import 现已统一为静态导入）
import { matchThemeByText } from '../data/culture-knowledge.js';

// ------------------------------------------------------------
// 常量定义
// ------------------------------------------------------------

/**
 * 5 种文创衍生品类型
 * @property {string} key    - 类型标识
 * @property {string} label  - 中文标签
 * @property {string} icon   - FontAwesome 图标类
 * @property {string} aspect - 宽高比（w:h）
 * @property {string} desc   - 尺寸说明
 */
const CRAFT_TYPES = [
  { key: 'wallpaper', label: '壁纸', icon: 'fa-image', aspect: '16:9', desc: '桌面壁纸 1920×1080' },
  { key: 'poster', label: '海报', icon: 'fa-panorama', aspect: '3:4', desc: '宣传海报 A3 尺寸' },
  { key: 'card', label: '藏品卡', icon: 'fa-id-card', aspect: '2:3', desc: '收藏卡牌' },
  { key: 'postcard', label: '明信片', icon: 'fa-envelope', aspect: '3:2', desc: '邮寄明信片' },
  { key: 'template', label: '模板', icon: 'fa-layer-group', aspect: '1:1', desc: '社交分享模板' }
];

/**
 * 3 种风格模板
 * @property {string} key    - 风格标识
 * @property {string} label  - 中文标签（存入 styleTheme 字段）
 * @property {string} icon   - FontAwesome 图标类
 * @property {string} desc   - 风格描述
 * @property {string} accent - 主强调色
 * @property {string} bg     - 背景色
 */
const CRAFT_STYLES = [
  { key: 'guofeng', label: '国风', icon: 'fa-paintbrush', desc: '温润东方美学', accent: '#c0392b', bg: '#fdf6e3' },
  { key: 'feiyi', label: '非遗纹样', icon: 'fa-pattern', desc: '浓郁民族色彩', accent: '#8e44ad', bg: '#fff8dc' },
  { key: 'minimal', label: '现代极简', icon: 'fa-circle', desc: '简约留白', accent: '#2c3e50', bg: '#ffffff' },
  // M6c: 新增 5 大文旅风格模板
  { key: 'qinghua', label: '青花瓷', icon: 'fa-droplet', desc: '靛蓝东方雅韵', accent: '#2c5f8a', bg: '#eef3f8' },
  { key: 'dunhuang', label: '敦煌壁画', icon: 'fa-archway', desc: '大漠丝路气象', accent: '#a0522d', bg: '#f5e6c8' },
  { key: 'ink', label: '水墨丹青', icon: 'fa-feather', desc: '留白写意禅境', accent: '#1a1a1a', bg: '#f7f5ef' },
  { key: 'neon', label: '赛博霓虹', icon: 'fa-bolt', desc: '夜游光影未来', accent: '#00e5ff', bg: '#101020', dark: true },
  { key: 'festive', label: '节庆红金', icon: 'fa-fire', desc: '喜庆年味国潮', accent: '#c0392b', bg: '#fff3ec' }
];

/**
 * 融合改造层2: 风格锁提示词后缀（坑1：统一模板 + 固定模型 = 跨分镜画风一致；
 * 与云端固定模型版本号 qwen-image-3.0 配套，坑8：防模型升级风格漂移）
 */
const STYLE_LOCKS = {
  guofeng: '国风工笔画风格，温润东方美学，宣纸质感，柔和自然光影',
  feiyi: '中国非遗纹样装饰画风格，浓郁民族色彩，织物与刺绣质感',
  minimal: '现代极简摄影风格，大面积留白，干净构图，柔和光线',
  qinghua: '青花瓷纹样风格，靛蓝与米白配色，瓷绘笔触，雅致留白',
  dunhuang: '敦煌壁画风格，矿物颜料质感，大漠丝路气象，斑驳肌理',
  ink: '水墨丹青写意风格，墨色晕染，留白意境，气韵生动',
  neon: '赛博霓虹夜景风格，冷暖光对比，未来都市光影',
  festive: '节庆国潮插画风格，红金配色，喜庆氛围，精致细节'
};

// detectArtDirection / buildImagePrompt / suggestPromptImprovements
// 由 ./craft-prompt-builder.js 统一提供（纯函数模块，便于单测与整图创作复用）

// ------------------------------------------------------------
// M6c-1: AI 灵感生成 / 自定义文案 状态
// ------------------------------------------------------------
/** 自定义标题（空串 = 使用作品原标题） */
let craftTitle = '';
/** 自定义副标题（AI 灵感文案或手输，空串不渲染） */
let craftSubtitle = '';
/** 画布上的装饰贴纸（已下线：emoji 贴纸与文创美学不搭，模型 schema 保留 stickers 字段但前端不再渲染） */

/** 预览区最大尺寸约束（CSS 像素） */
const PREVIEW_MAX_W = 820;
const PREVIEW_MAX_H = 560;

/** 缓存的 DOM 引用（避免重复查询） */
let domRefs = null;
/** 当前画布 2D 上下文 */
let canvasCtx = null;
/** 当前原始作品 Image 对象 */
let sourceImage = null;
/** 当前作品记录 */
let currentArtwork = null;
/** 节流用的 RAF id */
let previewRafId = 0;
/** 是否已挂载 */
let mounted = false;
/** 当前 artworkId */
let currentArtworkId = null;
/** 当前选中的文创类型 key */
let currentCraftType = 'wallpaper';
/** 当前选中的风格 key */
let currentStyle = 'guofeng';
// 融合改造层1: 版式状态
/** 当前版式 key（'' = 经典版式，走原合成逻辑，保持向后兼容） */
let currentLayoutId = '';
/** T3 版式变体档位 0-3（作品ID+idea 确定性哈希；同输入稳定、不同输入构图差异化） */
let layoutVariant = 0;
/** 版式离屏画布缓存（羡辙分层法：静态层缓存一次，降低重复渲染开销） */
let layoutCache = null;
// 融合改造层2: AI 重绘分镜状态
/** 分镜 AI 重绘产物（HTMLImageElement[]，与 scene 槽位一一对应；失败槽位以原图占位回退层1 取景） */
let repaintScenes = [];
/** 最近一次重绘标识（taskIds 串，进 cacheKey 使静态层缓存失效） */
let repaintKey = '';
/** 是否正在重绘（防重复提交，坑6） */
let repaintRunning = false;
// P0-1: 实物场景预览状态
/** 当前实物预览场景 key（'' = 未打开面板） */
let mockupScene = '';
/** 3D 模式上次渲染的品类形态 key（形态变化 → 整场景重建；未变 → 只刷贴图） */
let lastForm3d = '';
// ------------------------------------------------------------
// 四阶段商业链路（2026-09-30）：整图创作模式状态
// 阶段① 素材输入（作品图或自定义上传）→ 阶段② v6 策划 + qwen-image 整图重绘
// ------------------------------------------------------------
/** 自定义上传素材图（HTMLImageElement；null = 使用当前作品原图） */
let studioImage = null;
/** 整图设计稿 { img, dataUrl, prompt, negativePrompt, textMode }（null = 未生成，预览走版式合成） */
let studioDesign = null;
/** 整图生成进行中（互斥） */
let studioRunning = false;
/** 连续重生成计数（未改提示词的重复生成 ≤3 次；编辑提示词重置） */
let studioRegenCount = 0;
/** 上次生成所用想法（判断用户是否已编辑 → 重置计数） */
let studioLastIdea = '';
/** 图上文字模式：'model' = AI 绘制（模型直出手写体标题）；'canvas' = 后期排版（Canvas 叠字，零错字）
 * 默认 canvas（P0-1：qwen-image 手写英文易错/乱码，前端叠字可保证商品图文字可用） */
let studioTextMode = 'canvas';
// 融合改造层3: AI 方案扩展字段（schema nullable，向后兼容旧模型/本地兜底）
/** AI 方案推荐的传统色名数组（null = 未提供，走主色自动提取） */
let aiPalette = null;
/** AI 方案的分镜画面描述（string[]，与 scene 槽位按下标对应；逐槽位定制重绘提示词） */
let aiScenePrompts = [];
// T2: AI 推荐的具体落地产品名（'' = 未推荐；来自 craft-products.js 全品类知识库）
let currentProductName = '';
// 阶段B：两级品类选择器当前大类 key
let currentCategoryKey = 'stationery';
// 景区文化智能匹配提示条上下文：openCraft 渲染前置，createWorkbench 挂载后消费
let _scenicMatchHint = null;

// v11: 自定义模型渲染失败标记 —— 防止 renderCustom 失败后无限重试循环
const _customModelFailedKeys = new Set();
function _markCustomModelFailed(key) { if (key) _customModelFailedKeys.add(String(key)); }
function _isCustomModelBlocked(key) { return key && _customModelFailedKeys.has(String(key)); }

// ------------------------------------------------------------
// SubTask 7.1: 工具函数
// ------------------------------------------------------------

/**
 * 将 aspect 字符串（如 "16:9"）解析为宽高比数值
 * @param {string} aspect
 * @returns {number} w/h
 */
function parseAspect(aspect) {
  const [w, h] = aspect.split(':').map(Number);
  return w / h;
}

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
 * 计算预览 Canvas 的 CSS 尺寸（保持宽高比，受最大尺寸约束）
 * @param {string} aspect
 * @returns {{cssW:number, cssH:number}}
 */
function computePreviewSize(aspect) {
  const ratio = parseAspect(aspect);
  let cssW = PREVIEW_MAX_W;
  let cssH = cssW / ratio;
  if (cssH > PREVIEW_MAX_H) {
    cssH = PREVIEW_MAX_H;
    cssW = cssH * ratio;
  }
  return { cssW, cssH };
}

// ------------------------------------------------------------
// SubTask 7.2: Canvas 合成器（作品图 + 模板叠加 + 文字排版）
// ------------------------------------------------------------

/**
 * 将文本按最大宽度换行（用于 Canvas 多行排版）
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} maxWidth
 * @returns {string[]} 行数组
 */
function wrapText(ctx, text, maxWidth) {
  const lines = [];
  if (!text) return lines;
  // 按字符拆分（兼容中英文：中文逐字，英文按词）
  const isCJK = /[\u4e00-\u9fa5]/.test(text);
  if (isCJK) {
    let line = '';
    for (const ch of text) {
      if (ctx.measureText(line + ch).width > maxWidth && line) {
        lines.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    if (line) lines.push(line);
  } else {
    const words = text.split(/\s+/);
    let line = '';
    for (const w of words) {
      if (ctx.measureText(line + ' ' + w).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else {
        line = line ? line + ' ' + w : w;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/**
 * 按目标矩形"cover"模式绘制图片（保持比例裁剪填充）
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} img
 * @param {number} dx 目标 x
 * @param {number} dy 目标 y
 * @param {number} dw 目标宽
 * @param {number} dh 目标高
 */
function drawImageCover(ctx, img, dx, dy, dw, dh) {
  if (!img || !img.width) return;
  const sRatio = img.width / img.height;
  const dRatio = dw / dh;
  let sx, sy, sw, sh;
  if (sRatio > dRatio) {
    // 源图更宽 → 裁剪左右
    sh = img.height;
    sw = sh * dRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    // 源图更高 → 裁剪上下
    sw = img.width;
    sh = sw / dRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

/**
 * 按目标矩形"contain"模式绘制图片（保持比例完整留白）
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement} img
 * @param {number} dx
 * @param {number} dy
 * @param {number} dw
 * @param {number} dh
 */
function drawImageContain(ctx, img, dx, dy, dw, dh) {
  if (!img || !img.width) return;
  const sRatio = img.width / img.height;
  const dRatio = dw / dh;
  let drawW, drawH, drawX, drawY;
  if (sRatio > dRatio) {
    drawW = dw;
    drawH = dw / sRatio;
    drawX = dx;
    drawY = dy + (dh - drawH) / 2;
  } else {
    drawH = dh;
    drawW = dh * sRatio;
    drawX = dx + (dw - drawW) / 2;
    drawY = dy;
  }
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
}

/**
 * Canvas 合成器：将作品图 + 风格模板 + 文字排版绘制到画布
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} artwork      - 作品记录（含 imageUrl/title/author/tags）
 * @param {string} typeKey     - CRAFT_TYPES key
 * @param {string} styleKey    - CRAFT_STYLES key
 * @param {object} dims        - { w, h } CSS 像素尺寸
 * @param {object} [params]    - 可选参数 { title?, author? }
 */
function buildCraftCanvas(ctx, artwork, typeKey, styleKey, dims, params = {}) {
  const { w, h } = dims;
  if (!ctx || !artwork) return;
  const typeDef = CRAFT_TYPES.find(t => t.key === typeKey) || CRAFT_TYPES[0];
  const styleDef = CRAFT_STYLES.find(s => s.key === styleKey) || CRAFT_STYLES[0];
  const title = params.title || artwork.title || '未命名作品';
  const author = params.author || artwork.author || '梦境艺术家';

  // 融合改造层1：版式引擎分支（未选版式走下方原逻辑，保持向后兼容）
  if (currentLayoutId && sourceImage) {
    try {
      // 静态层缓存 key：版式/类型/风格/文案/物理尺寸/层2分镜产物/层3调色板/T3变体任一变化才重合成
      const cacheKey = [
        currentArtworkId, currentLayoutId, typeKey, styleKey,
        title, craftSubtitle, author, styleDef.label,
        ctx.canvas.width, ctx.canvas.height, repaintKey,
        aiPalette ? aiPalette.join('/') : '', layoutVariant
      ].join('|');
      if (!layoutCache || layoutCache.key !== cacheKey) {
        const off = buildLayoutCanvas({
          baseImage: sourceImage,
          scenes: repaintScenes,
          layoutId: currentLayoutId,
          palette: aiPalette, // 层3：AI 方案传统色（null 时引擎走主色自动提取）
          plan: {
            title,
            subtitle: craftSubtitle,
            author,
            typeLabel: typeDef.label,
            styleLabel: styleDef.label,
            styleDef
          },
          width: ctx.canvas.width,
          height: ctx.canvas.height,
          variant: layoutVariant, // T3：版式变体档位
          variantSeed: currentArtworkId + '|' + (craftTitle || title) // T3：确定性种子
        });
        layoutCache = off ? { key: cacheKey, canvas: off } : null;
      }
      if (layoutCache) {
        ctx.drawImage(layoutCache.canvas, 0, 0, w, h);
        return;
      }
    } catch (err) {
      console.warn('[AI-Craft] 版式引擎渲染失败，回退经典版式:', err && err.message);
      layoutCache = null;
      // 落入下方经典逻辑（渲染链路永不白屏）
    }
  }

  // 1. 背景
  ctx.fillStyle = styleDef.bg;
  ctx.fillRect(0, 0, w, h);

  // 2. 计算内容区域（根据类型留出文字空间）
  const padding = Math.round(Math.min(w, h) * 0.05);
  let contentX, contentY, contentW, contentH;
  // 横向（壁纸/明信片）底部留文字；纵向（海报/藏品卡）底部留文字；模板居中
  const isLandscape = w >= h;
  if (typeKey === 'template') {
    // 1:1 模板：居中正方形图 + 底部文字
    const imgSize = Math.min(w, h) - padding * 3 - 40;
    contentX = (w - imgSize) / 2;
    contentY = padding;
    contentW = imgSize;
    contentH = imgSize;
  } else if (isLandscape) {
    // 横向：图片占上部 78%，底部文字
    contentX = padding;
    contentY = padding;
    contentW = w - padding * 2;
    contentH = h * 0.78 - padding;
  } else {
    // 纵向：图片占上部 72%，底部文字
    contentX = padding;
    contentY = padding;
    contentW = w - padding * 2;
    contentH = h * 0.72 - padding;
  }

  // 3. 绘制作品图（cover 模式填充内容区）
  if (sourceImage) {
    ctx.save();
    // 国风/非遗：圆角裁剪；极简：直角
    if (styleKey !== 'minimal') {
      const r = Math.min(contentW, contentH) * 0.02;
      roundRectPath(ctx, contentX, contentY, contentW, contentH, r);
      ctx.clip();
    }
    drawImageCover(ctx, sourceImage, contentX, contentY, contentW, contentH);
    ctx.restore();
  }

  // 4. 风格模板叠加
  applyStyleOverlay(ctx, styleKey, w, h, contentX, contentY, contentW, contentH, padding);

  // 5. 文字排版（底部区域）
  const textY = contentY + contentH + padding * 0.6;
  const textH = h - textY - padding;
  drawCraftText(ctx, artwork, typeDef, styleDef, title, author, padding, textY, textH, w);

}

/**
 * 圆角矩形路径（不填充，仅构造路径供 clip/stroke）
 */
function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * 风格模板叠加层
 * - 国风：朱红边框 + 篆书标题底 + 印章
 * - 非遗纹样：民族纹样边框 + 饱和色彩点缀
 * - 现代极简：细线分割 + 大量留白
 */
function applyStyleOverlay(ctx, styleKey, w, h, cx, cy, cw, ch, pad) {
  if (styleKey === 'guofeng') {
    // 朱红边框
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.008);
    roundRectPath(ctx, cx, cy, cw, ch, Math.min(cw, ch) * 0.02);
    ctx.stroke();
    // 内侧细金线
    ctx.strokeStyle = 'rgba(192,57,43,0.3)';
    ctx.lineWidth = 1;
    const inset = Math.max(3, Math.min(w, h) * 0.012);
    roundRectPath(ctx, cx + inset, cy + inset, cw - inset * 2, ch - inset * 2, Math.min(cw, ch) * 0.015);
    ctx.stroke();
    // 印章（右下角红方块 + 白字）
    const sealSize = Math.max(20, Math.min(w, h) * 0.05);
    const sx = cx + cw - sealSize - pad * 0.5;
    const sy = cy + ch - sealSize - pad * 0.5;
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(sx, sy, sealSize, sealSize);
    ctx.fillStyle = '#fdf6e3';
    ctx.font = `bold ${Math.round(sealSize * 0.4)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('梦', sx + sealSize / 2, sy + sealSize / 2);
  } else if (styleKey === 'feiyi') {
    // 民族纹样边框：交替菱形点阵
    ctx.fillStyle = '#8e44ad';
    const dotR = Math.max(2, Math.min(w, h) * 0.006);
    const step = dotR * 6;
    // 顶边
    for (let x = cx; x <= cx + cw; x += step) {
      ctx.beginPath();
      ctx.arc(x, cy - dotR * 2, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
    // 底边
    for (let x = cx; x <= cx + cw; x += step) {
      ctx.beginPath();
      ctx.arc(x, cy + ch + dotR * 2, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
    // 左右边
    for (let y = cy; y <= cy + ch; y += step) {
      ctx.beginPath();
      ctx.arc(cx - dotR * 2, y, dotR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + cw + dotR * 2, y, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
    // 四角菱形
    ctx.fillStyle = '#d4a017';
    const cornerR = dotR * 1.8;
    [[cx, cy], [cx + cw, cy], [cx, cy + ch], [cx + cw, cy + ch]].forEach(([px, py]) => {
      ctx.beginPath();
      ctx.moveTo(px, py - cornerR);
      ctx.lineTo(px + cornerR, py);
      ctx.lineTo(px, py + cornerR);
      ctx.lineTo(px - cornerR, py);
      ctx.closePath();
      ctx.fill();
    });
  } else if (styleKey === 'qinghua') {
    // M6c 青花瓷：靛蓝双线边框 + 底部海波纹
    ctx.strokeStyle = '#2c5f8a';
    ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.006);
    roundRectPath(ctx, cx, cy, cw, ch, Math.min(cw, ch) * 0.02);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(44,95,138,0.35)';
    ctx.lineWidth = 1;
    const inset = Math.max(3, Math.min(w, h) * 0.012);
    roundRectPath(ctx, cx + inset, cy + inset, cw - inset * 2, ch - inset * 2, Math.min(cw, ch) * 0.015);
    ctx.stroke();
    // 底部海波纹（一排半圆弧）
    ctx.strokeStyle = 'rgba(44,95,138,0.5)';
    const waveY = cy + ch - inset * 3;
    const step = cw / 9;
    ctx.beginPath();
    for (let i = 0; i < 9; i++) {
      ctx.arc(cx + step * i + step / 2, waveY, step / 2.4, Math.PI, 0, false);
    }
    ctx.stroke();
  } else if (styleKey === 'dunhuang') {
    // M6c 敦煌壁画：土红粗框 + 金色飘带弧线 + 角点
    ctx.strokeStyle = '#a0522d';
    ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.012);
    roundRectPath(ctx, cx, cy, cw, ch, Math.min(cw, ch) * 0.015);
    ctx.stroke();
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.004);
    // 顶部三条飘带弧线
    const bandY = cy + ch * 0.1;
    for (let i = 0; i < 3; i++) {
      const off = i * Math.min(w, h) * 0.02;
      ctx.beginPath();
      ctx.moveTo(cx + cw * 0.1, bandY + off);
      ctx.quadraticCurveTo(cx + cw / 2, bandY - Math.min(w, h) * 0.03 + off, cx + cw * 0.9, bandY + off);
      ctx.stroke();
    }
    // 四角金点
    ctx.fillStyle = '#b8860b';
    [[cx, cy], [cx + cw, cy], [cx, cy + ch], [cx + cw, cy + ch]].forEach(([px, py]) => {
      ctx.beginPath();
      ctx.arc(px, py, Math.max(3, Math.min(w, h) * 0.008), 0, Math.PI * 2);
      ctx.fill();
    });
  } else if (styleKey === 'ink') {
    // M6c 水墨丹青：右上淡墨圆弧（禅意）+ 左下朱砂印章
    ctx.save();
    ctx.strokeStyle = 'rgba(26,26,26,0.16)';
    ctx.lineWidth = Math.max(4, Math.min(w, h) * 0.02);
    const r = Math.min(cw, ch) * 0.14;
    ctx.beginPath();
    ctx.arc(cx + cw * 0.82, cy + ch * 0.16, r, 0, Math.PI * 1.75);
    ctx.stroke();
    ctx.restore();
    const sealSize = Math.max(18, Math.min(w, h) * 0.045);
    const sx = cx + cw - sealSize - pad * 0.5;
    const sy = cy + ch - sealSize - pad * 0.5;
    ctx.fillStyle = '#a52a2a';
    ctx.fillRect(sx, sy, sealSize, sealSize);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(sealSize * 0.42)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('印', sx + sealSize / 2, sy + sealSize / 2);
  } else if (styleKey === 'neon') {
    // M6c 赛博霓虹：发光青框 + 品红四角括号
    ctx.save();
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = Math.min(w, h) * 0.03;
    ctx.strokeStyle = '#00e5ff';
    ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.005);
    roundRectPath(ctx, cx, cy, cw, ch, Math.min(cw, ch) * 0.02);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = '#ff2d95';
    ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.007);
    const L = Math.min(cw, ch) * 0.08;
    const corners = [[cx, cy, 1, 1], [cx + cw, cy, -1, 1], [cx, cy + ch, 1, -1], [cx + cw, cy + ch, -1, -1]];
    corners.forEach(([px, py, dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(px + dx * L, py);
      ctx.lineTo(px, py);
      ctx.lineTo(px, py + dy * L);
      ctx.stroke();
    });
  } else if (styleKey === 'festive') {
    // M6c 节庆红金：红双框 + 金菱形角 + 顶部灯笼串
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = Math.max(2.5, Math.min(w, h) * 0.01);
    roundRectPath(ctx, cx, cy, cw, ch, Math.min(cw, ch) * 0.015);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(212,160,23,0.8)';
    ctx.lineWidth = 1;
    const inset = Math.max(3, Math.min(w, h) * 0.012);
    roundRectPath(ctx, cx + inset, cy + inset, cw - inset * 2, ch - inset * 2, Math.min(cw, ch) * 0.012);
    ctx.stroke();
    ctx.fillStyle = '#d4a017';
    const cornerR = Math.max(4, Math.min(w, h) * 0.012);
    [[cx, cy], [cx + cw, cy], [cx, cy + ch], [cx + cw, cy + ch]].forEach(([px, py]) => {
      ctx.beginPath();
      ctx.moveTo(px, py - cornerR);
      ctx.lineTo(px + cornerR, py);
      ctx.lineTo(px, py + cornerR);
      ctx.lineTo(px - cornerR, py);
      ctx.closePath();
      ctx.fill();
    });
    ctx.fillStyle = '#c0392b';
    const dotR = Math.max(2.5, Math.min(w, h) * 0.007);
    const step = dotR * 7;
    for (let x = cx + step; x < cx + cw; x += step) {
      ctx.beginPath();
      ctx.arc(x, cy - dotR * 2.2, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // 现代极简：细线分割（图片与文字之间）
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy + ch + pad * 0.3);
    ctx.lineTo(cx + cw, cy + ch + pad * 0.3);
    ctx.stroke();
  }
}

/**
 * 绘制文创文字排版（标题/作者/AI徽章）
 * 注：已移除 typeDef.label 类型标签硬画 —— 产品名应由具体产品形态决定，
 *      不再强制在 Canvas 上显示"藏品卡/海报/明信片"等分类名
 */
function drawCraftText(ctx, artwork, typeDef, styleDef, title, author, pad, textY, textH, w) {
  const textX = pad;
  const textW = w - pad * 2;
  const dark = !!styleDef.dark;
  const mainCol = dark ? '#ffffff' : (styleDef.key === 'minimal' ? '#2c3e50' : '#333');
  const subCol = dark ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.55)';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // 🗑️ 已移除类型标签硬画（typeDef.label.toUpperCase）—— 强制显示"藏品卡"
  // 与用户选产品（书签/手账本）不符，且文案版式不通用

  // 标题（字稍小：0.32→0.26，适配多产品通用布局）
  const serifKeys = ['guofeng', 'ink', 'qinghua', 'dunhuang'];
  const titleFont = Math.max(12, Math.round(textH * 0.26));
  ctx.font = `600 ${titleFont}px ${serifKeys.includes(styleDef.key) ? 'serif' : 'sans-serif'}`;
  ctx.fillStyle = mainCol;
  const titleLines = wrapText(ctx, title, textW);
  // 类型标签已删，标题起始 Y 上移（原 0.22 是为类型标签留空间的）
  let lineY = textY + Math.max(textH * 0.04, titleFont * 0.2);
  const lineH = titleFont * 1.3;
  titleLines.slice(0, 2).forEach(line => {
    ctx.fillText(line, textX, lineY);
    lineY += lineH;
  });

  // M6c: AI 灵感副标题（单行，超出截断）
  if (craftSubtitle) {
    ctx.font = `${Math.max(10, Math.round(textH * 0.15))}px sans-serif`;
    ctx.fillStyle = subCol;
    const subLines = wrapText(ctx, craftSubtitle, textW);
    if (subLines[0]) {
      ctx.fillText(subLines[0], textX, lineY + 2);
      lineY += Math.max(12, textH * 0.15) * 1.5;
    }
  }

  // 作者 + 风格（小字）
  ctx.font = `${Math.max(10, Math.round(textH * 0.16))}px sans-serif`;
  ctx.fillStyle = dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)';
  const metaText = `${author} · ${styleDef.label}`;
  ctx.fillText(metaText, textX, lineY + 2);
}

// ------------------------------------------------------------
// M6c-1: AI 灵感一键生成（想法 → 标题/副标题/类型/风格）
// ------------------------------------------------------------

/**
 * T2: 文本命中产品名（idea/作品标题/主题词中显式提到某产品时返回该产品）
 * 只做显式命中，不做随机兜底——保证"推荐落地产品"可预期、可解释
 * @param {string} text
 * @returns {object|null} CRAFT_PRODUCTS 条目
 */
function _matchProductByText(text) {
  const t = String(text || '');
  if (!t) return null;
  return CRAFT_PRODUCTS.find(p => t.includes(p.name)) || null;
}

/**
 * T2: 按优先级做产品文本匹配（用户想法 > 作品标题 > 文化主题）
 * （防"作品标题里的产品名压过用户显式指定"——如标题《三星堆盲盒》+ 想法"做冰箱贴"应推冰箱贴）
 * @param {...string} parts 按优先级传入的文本
 * @returns {object|null}
 */
function _matchProductByPriority(...parts) {
  for (const p of parts) {
    const hit = _matchProductByText(p);
    if (hit) return hit;
  }
  return null;
}

/**
 * T2: 解析 AI 返回的 productName（精确名优先，产品名包含在返回串中亦可）
 * @param {string} name
 * @returns {object|null}
 */
function _resolveProduct(name) {
  const s = String(name || '').trim();
  if (!s) return null;
  return getProductByName(s) || CRAFT_PRODUCTS.find(p => s.includes(p.name)) || null;
}

/**
 * AI 不可用时的本地降级方案：关键词匹配 + 作品上下文注入（T2 贴题修复）
 * @param {string} idea
 * @param {{title:string, themeName:string}} [artCtx] 作品上下文（标题/文化主题）
 */
function _localIdeaPlan(idea, artCtx) {
  let style = 'guofeng';
  if (/敦煌|飞天|壁画|大漠|丝路|石窟/.test(idea)) style = 'dunhuang';
  else if (/青花|瓷|海洋|蓝调|江南水乡/.test(idea)) style = 'qinghua';
  else if (/水墨|山水|禅|留白|书法|写意/.test(idea)) style = 'ink';
  else if (/霓虹|赛博|夜游|未来|科技|灯光/.test(idea)) style = 'neon';
  else if (/春节|新年|红|喜庆|福|庙会|灯笼/.test(idea)) style = 'festive';
  else if (/非遗|民族|绣|扎染|苗银|纹样/.test(idea)) style = 'feiyi';
  else if (/极简|简约|现代|品牌|商务/.test(idea)) style = 'minimal';
  let type = 'poster';
  let typeHit = false;
  if (/壁纸|桌面|屏保|电脑/.test(idea)) { type = 'wallpaper'; typeHit = true; }
  else if (/明信片|邮寄|旅途/.test(idea)) { type = 'postcard'; typeHit = true; }
  else if (/卡牌|收藏|卡面|纪念卡/.test(idea)) { type = 'card'; typeHit = true; }
  else if (/模板|分享|朋友圈|社交/.test(idea)) { type = 'template'; typeHit = true; }
  // T2：产品关键词映射（优先级：想法 > 作品标题 > 主题词；命中 → 推荐产品并随其形态切换画布）
  const artTitle = (artCtx && artCtx.title) || '';
  const themeName = (artCtx && artCtx.themeName) || '';
  const product = _matchProductByPriority(idea, artTitle, themeName);
  if (product && !typeHit) type = product.canvasType;
  // T2：标题从作品标题/文化主题提取主题词拼接（离线兜底也紧扣作品，不脱离主题）
  const core = (artTitle || themeName).replace(/[（(【〔].*?[)）】〕]/g, '').slice(0, 8);
  const short = idea.length > 10 ? idea.slice(0, 10) : idea;
  return {
    title: (core ? core + '·' : '') + short,
    subtitle: themeName ? `以「${themeName}」为魂，让作品走入日常` : '灵感源自你的想法，AI 与你共创文旅之美',
    craftType: type,
    style: style,
    stickers: [],
    productName: product ? product.name : ''
  };
}

/**
 * 展示本次生成方案的模型来源徽标（竞赛可视化亮点）
 * self-trained → 自研微调模型；其他 provider → 云端模型；null（本地方案）→ 隐藏
 * @param {string|null} provider - ai-inference 返回的 provider，null 表示本地降级方案
 */
function _showModelBadge(provider) {
  if (!domRefs || !domRefs.modelBadge) return;
  const el = domRefs.modelBadge;
  if (provider === 'self-trained') {
    el.textContent = '⚡ 自研微调模型 DreamCraft-1.5B';
    el.classList.add('self-trained');
    el.hidden = false;
  } else if (provider) {
    el.textContent = '☁ 云端大模型 ' + provider;
    el.classList.remove('self-trained');
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

/**
 * T2: 展示 AI 推荐的落地产品徽标（全品类知识库 233 种产品的可视化出口）
 * @param {string} name - 具体产品名（'' = 隐藏）
 */
function _showProductBadge(name) {
  if (!domRefs || !domRefs.productBadge) return;
  const el = domRefs.productBadge;
  if (name) {
    const p = getProductByName(name);
    const cat = p && getCategory(p.category);
    el.textContent = '🎁 推荐落地产品：' + name + (cat ? ' · ' + cat.label : '');
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

/**
 * 【四阶段商业链路·阶段②a】v6 幕后策划：读取用户想法 → textGeneration → 结构化 JSON 方案
 * 自研微调模型（provider: 'self-trained'）优先，不可用自动降级云端；
 * 全部失败时降级本地关键词方案（_localIdeaPlan），保证按钮永远可用。
 * @param {string} idea - 用户想法文本
 * @returns {Promise<{plan:object, artCtx:object, provider:string|null}>}
 */
async function requestCraftPlan(idea) {
  const typeKeys = CRAFT_TYPES.map(t => t.key).join('/');
  const styleKeys = CRAFT_STYLES.map(s => s.key).join('/');
  // T2 贴题修复核心：注入作品上下文（标题/标签/文化主题事实卡）——
  // 此前 prompt 只含用户想法，导致文案与作品主题脱节（如秦淮河作品生成"铠甲战魂"）
  const artCtx = { title: '', themeName: '', themeFact: '', creationTip: '', visionSubject: '', visionDesc: '' };
  try {
    const hay = `${currentArtwork.title || ''} ${(currentArtwork.tags || []).join(',')}`;
    const theme = matchThemeByText(hay);
    artCtx.title = (currentArtwork && currentArtwork.title) || '';
    if (theme) {
      artCtx.themeName = theme.name;
      artCtx.themeFact = (theme.facts && theme.facts[0]) || '';
      artCtx.creationTip = theme.creationTip || '';
    }
  } catch (_) { /* 知识库不可用时静默降级（仅缺主题信息，不影响生成） */ }

  // P1-4：vision 识别素材图内容，注入策划上下文（标题贴题修复核心）
  try {
    const srcImg = studioImage || sourceImage;
    if (srcImg && typeof imageToBase64 === 'function') {
      const imgB64 = await imageToBase64(srcImg, 1024); // 识图用小图即可（省 token/延迟）
      if (imgB64) {
        const { imageUnderstanding } = await import('./ai-inference.js');
        // 8s 超时：真实 qwen-vl 接口通常 2-5s，给足余量；
        // 失败/超时仍静默降级，不阻塞主流程
        const vi = await Promise.race([
          imageUnderstanding(imgB64, '请识别这张图片的主体内容、核心元素、构图特征和色彩基调，用简短中文描述。如果图片里有明显文字或 logo，也请说明。', { timeout: 8000 }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('vision timeout')), 8000))
        ]).catch(() => null);
        if (vi && vi.text) {
          const trimmed = vi.text.replace(/\s+/g, ' ').trim().slice(0, 180);
          artCtx.visionDesc = trimmed;
          const m = trimmed.match(/(?:主体是|这是|画面中)\s*([^,，。\s]{2,8})/);
          if (m) artCtx.visionSubject = m[1];
        }
      }
    }
  } catch (err) { /* vision 失败静默降级 */ }
  // T2 贴题性边界：用户上传自定义素材图后，不应被种子作品主题牵着走
  // studioImage !== null 表示用户主动上传了素材；否则走模板库内置作品主题
  const hasCustomImage = !!studioImage;
  // T2：产品名候选（爆款优先，控制 prompt 长度）
  const hotNames = CRAFT_PRODUCTS.filter(p => p.hot).slice(0, 16).map(p => p.name).join('/');
  // 层3 schema 扩展 + T2 上下文注入（v6 训练数据 synthesize.mjs 与本 prompt 逐字对齐）
  const prompt = [
    '你是"AI+文旅文创"平台的文创设计顾问，为用户想法定制文创衍生品方案。',
    artCtx.title ? '用户正在为作品《' + artCtx.title + '》设计文创衍生品。' : '',
    // 上传自定义素材时：主题事实降级为"可选灵感"，vision 识别成为主依据
    hasCustomImage && artCtx.themeName
      ? ('作品原文化主题（仅供参考，非强制）：「' + artCtx.themeName + '」。请以用户想法和上传素材图为准。')
      : (artCtx.themeName ? '作品所属文化主题：「' + artCtx.themeName + '」' + (artCtx.themeFact ? '。主题事实：' + artCtx.themeFact : '') + (artCtx.creationTip ? '。设计语言建议：' + artCtx.creationTip : '') : ''),
    // P1-4：vision 识别注入——让 v6 策划知道素材图实际是什么（不再全部三星堆化）
    artCtx.visionDesc ? ('用户上传的素材图内容识别：' + artCtx.visionDesc + '。标题必须贴合素材图实际内容。') : '',
    '用户想法：「' + idea + '」。',
    hasCustomImage
      ? '硬性要求：title 与 subtitle 必须紧扣用户想法和素材图实际内容进行融合创作，可适度参考作品标题，禁止强行套用原文化主题。'
      : '硬性要求：title 与 subtitle 必须紧扣作品主题与用户想法进行融合创作，禁止脱离作品主题凭空发挥。',
    '请严格输出一个 JSON 对象（禁止 markdown 代码块、禁止任何多余文字），字段如下：',
    'title：文创标题，6-16 个汉字，必须体现作品主题元素；',
    'subtitle：副标题文案，8-20 个汉字，呼应主题意境；',
    'productName：从 [' + hotNames + '] 等文创产品中推荐最匹配的一项具体产品名，直接输出产品名；',
    'craftType：从 [' + typeKeys + '] 中选与 productName 形态最匹配的一项；',
    'style：从 [' + styleKeys + '] 中选最匹配的一项' + (detectArtDirection(idea) ? '；用户想法已含明确画风描述时，选择与其画风最接近的风格项' : '') + ';',
    'layout：从 [' + Object.keys(LAYOUTS).join('/') + '] 中选与 craftType 匹配的一项，craftType 为 template 时输出空字符串；',
    'palette：2-3 个传统色名，从 [靛蓝/米白/赭石/朱砂/黛青/绛红/竹青/月白/赭黄/石绿/藤黄/水墨] 中选，JSON 字符串数组；',
    'scenes：0-2 个分镜对象数组，每项为 {"desc":"10-24 字分镜画面描述","slot":"main 或 scene"}；',
    'stickers：0-3 个契合主题的 emoji 装饰，JSON 字符串数组。'
  ].filter(Boolean).join('\n');
  let plan = null;
  let aiProvider = null;
  try {
    // schema 任务低温生成（坑12：与 Modelfile temperature 0.1 同向，保证 JSON 稳定）
    const r = await textGeneration(prompt, { provider: 'self-trained', maxTokens: 500, temperature: 0.2, timeout: 25000 });
    const m = (r.text || '').match(/\{[\s\S]*\}/);
    if (m) {
      plan = JSON.parse(m[0]);
      aiProvider = r.provider || null;
    }
  } catch (err) {
    console.warn('[AI-Craft] v6 策划失败，使用本地方案:', err && err.message);
  }
  if (!plan || typeof plan !== 'object') {
    plan = _localIdeaPlan(idea, artCtx);
    aiProvider = null;
  }
  _showModelBadge(aiProvider);
  return { plan, artCtx, provider: aiProvider };
}

/**
 * 应用 v6 策划方案到工作台（风格/类型/落地产品/文案/版式变体/palette/scenes + 网格重建）
 * @param {object} plan - v6 输出的结构化 JSON 方案
 * @param {string} idea - 用户想法（版式变体哈希种子）
 * @param {object} artCtx - 作品上下文
 */
function applyCraftPlan(plan, idea, artCtx) {
  // 校验并应用
  const styleDef = CRAFT_STYLES.find(s => s.key === plan.style);
  const typeDef = CRAFT_TYPES.find(t => t.key === plan.craftType);
  currentStyle = styleDef ? styleDef.key : 'guofeng';
  currentCraftType = typeDef ? typeDef.key : 'poster';
  // T2：落地产品推荐（AI productName 优先，无则按优先级文本命中兜底；有效时画布随产品形态切换）
  // 阶段B：经 selectProductByName 联动两级选择器（切大类 + 高亮选中卡 + 画布/版式/徽标）
  const product = _resolveProduct(plan.productName)
    || _matchProductByPriority(idea, `${artCtx.title} ${artCtx.themeName}`);
  if (product) {
    selectProductByName(product.name);
  } else {
    currentProductName = '';
    _showProductBadge('');
  }
  craftTitle = String(plan.title || '').slice(0, 24);
  craftSubtitle = String(plan.subtitle || '').slice(0, 30);
  // T3：版式变体档位 =（作品ID + idea）确定性哈希 % 4 —— 不同提示词 → 差异化构图
  {
    let hv = 5381;
    const seedStr = currentArtworkId + '|' + idea;
    for (let i = 0; i < seedStr.length; i++) hv = ((hv << 5) + hv + seedStr.charCodeAt(i)) >>> 0;
    layoutVariant = hv % 4;
  }
  if (domRefs.titleInput) domRefs.titleInput.value = craftTitle;
  if (domRefs.subtitleInput) domRefs.subtitleInput.value = craftSubtitle;
  // 层3 前向兼容：AI 方案携带 layout 字段时自动切换版式
  if (plan.layout && LAYOUTS[plan.layout] && LAYOUTS[plan.layout].craftTypes.includes(currentCraftType)) {
    currentLayoutId = plan.layout;
    rebuildLayoutGrid();
  }
  // 层3：palette 扩展字段（null 安全：非法/缺失时清空，渲染走主色自动提取）
  if (Array.isArray(plan.palette)) {
    aiPalette = plan.palette.filter(c => typeof c === 'string' && c.length).slice(0, 3);
    if (!aiPalette.length) aiPalette = null;
  } else {
    aiPalette = null;
  }
  // 层3：scenes 分镜描述（按 slot 顺序对齐分镜槽位，逐槽位定制重绘提示词）
  aiScenePrompts = Array.isArray(plan.scenes)
    ? plan.scenes.map(s => (s && typeof s.desc === 'string') ? s.desc.slice(0, 40) : '').slice(0, 2)
    : [];
  // 类型可能被 AI 方案切换 → 版式网格按新类型重建，不适配的版式回退经典
  if (currentLayoutId) {
    const lay = LAYOUTS[currentLayoutId];
    if (!lay || !lay.craftTypes.includes(currentCraftType)) currentLayoutId = '';
  }
  rebuildTypeGrid();
  rebuildStyleGrid();
  rebuildLayoutGrid();
}

// ------------------------------------------------------------
// 四阶段商业链路·阶段①②：AI 整图创作主链路（单窗口）
//   阶段① 素材 = 自定义上传图（studioImage）或当前作品原图（sourceImage）
//   阶段② v6 幕后策划（requestCraftPlan）→ promptBuilder 确定性扩写
//         → qwen-image-3.0 整图重绘（I2I 提交/查询分离，150s 窗口）
//   迭代优化：重新生成 ≤3 次（复用存储 prompt；编辑想法重置计数）
// ------------------------------------------------------------

/** 更新整图创作状态条（ok = 成功色） */
function setStudioStatus(text, ok) {
  if (!domRefs || !domRefs.studioStatus) return;
  domRefs.studioStatus.textContent = text || '';
  domRefs.studioStatus.classList.toggle('ok', !!ok);
  domRefs.studioStatus.hidden = !text;
}

/** 生成按钮 busy 态（防重复提交） */
function setStudioBusy(busy) {
  if (!domRefs || !domRefs.studioGen) return;
  domRefs.studioGen.disabled = !!busy;
  domRefs.studioGen.innerHTML = busy
    ? '<i class="fa-solid fa-spinner fa-spin"></i> AI 创作中…'
    : '<i class="fa-solid fa-wand-magic-sparkles"></i> 开始创作';
  if (domRefs.studioRegen) domRefs.studioRegen.disabled = !!busy;
}

/** 素材图槽渲染：作品原图 / 自定义上传图 */
function renderStudioImageSlot() {
  if (!domRefs || !domRefs.studioImageSlot) return;
  const src = studioImage ? studioImage.src : (sourceImage ? sourceImage.src : '');
  if (src) {
    domRefs.studioImageSlot.style.backgroundImage = `url("${src}")`;
    domRefs.studioImageSlot.classList.add('has-img');
  } else {
    domRefs.studioImageSlot.style.backgroundImage = '';
    domRefs.studioImageSlot.classList.remove('has-img');
  }
  if (domRefs.studioResetBtn) domRefs.studioResetBtn.hidden = !studioImage;
}

/** 设置自定义上传素材图（dataURL → HTMLImageElement） */
async function setStudioImage(dataUrl) {
  try {
    const img = await loadImage(dataUrl);
    studioImage = img;
    renderStudioImageSlot();
    if (window.showToast) showToast('已使用你上传的图片作为创作素材', 'success');
  } catch (err) {
    if (window.showToast) showToast('图片加载失败：' + (err && err.message || ''), 'error');
  }
}

/** 恢复为当前作品原图 */
function resetStudioImage() {
  studioImage = null;
  renderStudioImageSlot();
  if (window.showToast) showToast('已恢复为当前作品原图', 'info');
}

/** 渲染提示词改进建议 chips（suggestPromptImprovements 纯函数） */
function renderStudioSuggestions() {
  if (!domRefs || !domRefs.studioSuggestBox) return;
  const idea = domRefs.studioIdea ? domRefs.studioIdea.value.trim() : '';
  if (!idea) {
    if (window.showToast) showToast('请先输入想法，再获取建议', 'warn');
    return;
  }
  const list = suggestPromptImprovements(idea);
  if (!list.length) {
    setStudioStatus('你的想法已经很具体，直接开始创作吧', true);
    domRefs.studioSuggestBox.hidden = true;
    return;
  }
  domRefs.studioSuggestBox.innerHTML = '';
  for (const item of list) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'craft-suggest-chip';
    chip.textContent = item.label;
    chip.title = '点击追加到想法末尾';
    chip.addEventListener('click', () => {
      if (!domRefs.studioIdea) return;
      const cur = domRefs.studioIdea.value.trim();
      domRefs.studioIdea.value = (cur ? cur + '，' : '') + item.append;
      domRefs.studioSuggestBox.hidden = true;
      domRefs.studioIdea.focus();
    });
    domRefs.studioSuggestBox.appendChild(chip);
  }
  domRefs.studioSuggestBox.hidden = false;
}

/**
 * 【四阶段商业链路·阶段②b】AI 整图创作主入口
 * 管线：素材转码（≤2048）→ v6 策划（regen 复用方案跳过）→ promptBuilder 扩写
 *       → imageRepaintSubmit 单任务 → 指数退避轮询（1s→10s，150s 总超时）
 *       → loadImage 上屏 → studioDesign → schedulePreviewRender（3D 贴图源自动跟随）
 * @param {{regen?:boolean}} [opts] - regen=true 重新生成（复用上次 prompt，不重复策划）
 */
async function runStudioCreate(opts = {}) {
  const regen = !!opts.regen;
  if (studioRunning) return;
  if (!domRefs || !domRefs.studioIdea || !domRefs.studioGen) return;
  const idea = domRefs.studioIdea.value.trim();
  if (!idea) {
    if (window.showToast) showToast('请先输入你的创作想法', 'warn');
    return;
  }
  const srcImg = studioImage || sourceImage;
  if (!srcImg) {
    if (window.showToast) showToast('素材图未加载，无法创作', 'warn');
    return;
  }
  // 迭代优化机制：未改想法的连续重生成 ≤3 次；编辑想法自动重置并重新策划
  const ideaChanged = idea !== studioLastIdea;
  if (ideaChanged) {
    studioRegenCount = 0;
    studioLastIdea = idea;
  }
  // 复用上次 prompt 仅限「想法未变」的重复生成
  const reuse = regen && studioDesign && !ideaChanged;
  if (regen && !reuse && !studioDesign) {
    if (window.showToast) showToast('请先完成一次创作', 'warn');
    return;
  }
  if (reuse && studioRegenCount >= 3) {
    if (window.showToast) showToast('本轮已重新生成 3 次，请修改想法后再试（可用「调整提示词建议」）', 'warn');
    return;
  }

  if (typeof Sound !== 'undefined') Sound.playSound('pop');
  studioRunning = true;
  setStudioBusy(true);
  if (domRefs.studioSuggestBox) domRefs.studioSuggestBox.hidden = true;
  try {
    // 1. 确定整图重绘提示词（reuse 复用上次；否则 v6 策划 → promptBuilder 确定性扩写）
    let prompt = reuse && studioDesign ? studioDesign.prompt : '';
    let negativePrompt = reuse && studioDesign ? studioDesign.negativePrompt : '';
    if (!prompt) {
      setStudioStatus('自研模型策划中…');
      const { plan, artCtx } = await requestCraftPlan(idea);
      applyCraftPlan(plan, idea, artCtx);
      const built = buildImagePrompt({
        idea,
        plan,
        textMode: studioTextMode,
        userNegative: domRefs.studioNegative ? domRefs.studioNegative.value.trim() : ''
      });
      prompt = built.prompt;
      negativePrompt = built.negativePrompt;
    }

    // 2. 素材转码（长边 ≤2048 适配 qwen-image-3.0 I2I 像素上限）
    setStudioStatus('素材转码中…');
    const imageB64 = await imageToBase64(srcImg, 2048);
    if (!imageB64) throw new Error('素材图转码失败（跨域限制）');

    // 3. 提交整图重绘任务（提交/查询分离，不阻塞）
    // P0 修复：提交阶段偶发 502，增加 1 次幂等重试；重试仍失败进入 catch 兜底提示
    setStudioStatus('AI 整图创作中，约 1-2 分钟，请稍候…');
    let submit = null;
    let submitErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        submit = await imageRepaintSubmit(imageB64, prompt, { timeout: 20000, negativePrompt });
        if (submit && submit.taskId) { submitErr = null; break; }
      } catch (err) {
        submitErr = err;
        if (attempt === 0) {
          setStudioStatus('提交遇到网络抖动，正在自动重试…');
          await _sleep(800);
        }
      }
    }
    if (!submit || !submit.taskId) {
      throw new Error('整图任务提交失败' + (submitErr ? '：' + (submitErr.message || '网络错误') : '') + '，请手动重试');
    }

    // 4. 指数退避轮询（坑5/6/7：1s→2s→…上限10s；总超时150s 与云函数判定窗口对齐）
    const deadline = Date.now() + 150 * 1000;
    let delay = 1000;
    let result = null;
    while (!result && Date.now() < deadline) {
      await _sleep(delay);
      try {
        const r = await imageRepaintQuery(submit.taskId, { timeout: 15000 });
        if (r.status === 'succeeded') result = r;
        else if (r.status === 'failed') throw new Error('整图生成失败，请重试');
      } catch (err) {
        if (err && /失败，请重试/.test(String(err.message))) throw err;
        // 单次查询抖动不判死，下轮再试
      }
      delay = Math.min(delay * 2, 10000);
    }
    if (!result) throw new Error('生成超时（150s），请重试');

    // 5. 上屏：设计稿存 studioDesign → renderPreview 切换为整图渲染分支
    const img = await loadImage(result.imageUrl);
    studioDesign = { img, dataUrl: result.imageUrl, prompt, negativePrompt, textMode: studioTextMode };
    if (reuse) studioRegenCount++;
    layoutCache = null; // 版式静态层缓存失效（精修模式与整图模式互斥切换）
    if (domRefs.studioActions) domRefs.studioActions.hidden = false;
    setStudioStatus(
      reuse
        ? `已重新生成（${studioRegenCount}/3 次）；不满意可继续重新生成，满意后到下方选择文创产品`
        : '整图设计稿已生成；不满意可「重新生成」，满意后到下方选择文创产品看 3D 实物预览',
      true
    );
    schedulePreviewRender();
    if (window.showToast) showToast('✨ AI 整图创作完成' + (currentProductName ? '，推荐落地：' + currentProductName : ''), 'success');
  } catch (err) {
    console.warn('[AI-Craft] AI 整图创作失败:', err && err.message);
    setStudioStatus('创作失败：' + (err && err.message || '未知错误') + '；可点击重新生成重试');
    if (window.showToast) showToast('AI 整图创作失败：' + (err && err.message || '未知错误'), 'error');
  } finally {
    studioRunning = false;
    setStudioBusy(false);
  }
}

// ------------------------------------------------------------
// 融合改造层2: AI 重绘分镜（图生图管线）
// ------------------------------------------------------------

/** sleep 工具（轮询退避用） */
function _sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 原图 → base64 dataURL（离屏缩放，长边 ≤ maxSide；qwen-image-3.0 I2I 像素上限 2048×2048）
 * 跨域污染画布时 toBlob 抛 SecurityError → 返回 ''（调用方降级，不重绘）
 * @param {HTMLImageElement} img
 * @param {number} [maxSide]
 * @returns {Promise<string>} dataURL；失败返回 ''
 */
async function imageToBase64(img, maxSide = 2048) {
  try {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return '';
    const scale = Math.min(1, maxSide / Math.max(iw, ih));
    const w = Math.max(1, Math.round(iw * scale));
    const h = Math.max(1, Math.round(ih * scale));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    const blob = await canvasToBlob(c, 'image/jpeg', 0.9);
    return await blobToDataURL(blob);
  } catch (err) {
    console.warn('[AI-Craft] 原图转码失败（可能跨域污染）:', err && err.message);
    return '';
  }
}

/**
 * 更新重绘进度浮层文案
 * @param {string} text
 */
function setRepaintProgress(text) {
  if (domRefs && domRefs.repaintProgress) domRefs.repaintProgress.textContent = text;
}

/**
 * 设置重绘按钮 loading 态
 * @param {boolean} running
 */
function setRepaintBtnState(running) {
  if (!domRefs || !domRefs.repaintBtn) return;
  domRefs.repaintBtn.disabled = running;
  domRefs.repaintBtn.innerHTML = running
    ? '<i class="fa-solid fa-spinner fa-spin"></i> AI 重绘分镜中…'
    : '<i class="fa-solid fa-wand-magic-sparkles"></i> AI 重绘分镜';
}

/**
 * 层2主入口：AI 重绘当前版式的全部分镜槽位
 * 管线（方案 §2.3，坑5/6/7）：
 *   原图缩放转码 → 并行提交 N 个图生图任务（立即返回 taskId）
 *   → 串行指数退避轮询（1s→2s→…上限10s，总超时150s，防 429）
 *   → 成功分镜 loadImage 上屏；失败分镜以原图占位（层1 变焦取景兜底，画面不白屏）
 * 防重复：repaintRunning 互斥（坑6）
 */
async function runSceneRepaint() {
  if (repaintRunning) return;
  if (!currentLayoutId) {
    if (window.showToast) showToast('请先在「版式构图」中选择一个版式', 'warn');
    return;
  }
  // 四阶段互斥：整图设计稿模式下预览只显示设计稿，分镜重绘不生效
  if (studioDesign) {
    if (window.showToast) showToast('当前是整图设计稿模式；如需分镜精修，请先点「恢复作品图」后重新创作', 'warn');
    return;
  }
  const layout = LAYOUTS[currentLayoutId];
  const sceneCount = layout ? layout.slots.filter(s => s.type === 'scene').length : 0;
  if (!sceneCount) {
    if (window.showToast) showToast('当前版式没有分镜槽位，无需重绘', 'warn');
    return;
  }
  if (!sourceImage) {
    if (window.showToast) showToast('作品图片未加载，无法重绘', 'warn');
    return;
  }

  const lockedLayoutId = currentLayoutId; // 中途换版式则丢弃结果
  repaintRunning = true;
  setRepaintBtnState(true);
  if (domRefs.repaintOverlay) domRefs.repaintOverlay.hidden = false;
  setRepaintProgress('原图转码中…');
  let okCount = 0;
  // 轮询工作集（本次运行局部状态）：pending = 待完成任务下标集，images = 分镜图（按下标对齐槽位）
  const pending = new Set();
  const sceneImages = new Array(sceneCount).fill(null);
  try {
    // 1. 原图转码（长边 ≤2048 适配 qwen-image-3.0 I2I 像素上限）
    const imageB64 = await imageToBase64(sourceImage, 2048);
    if (!imageB64) throw new Error('原图转码失败（跨域限制）');

    // 2. 风格锁提示词（坑1：统一模板；坑8：云函数固定 qwen-image-3.0 版本）
    //    层3：aiScenePrompts[i] 存在时逐槽位定制分镜画面描述（AI 方案 scenes 字段），否则用通用主题
    //    坑9（2026-09-24）：风格锁放在长 prompt 末尾会被 I2I 的原图主导性压过
    //    （用户选"节庆红金"仍输出原图青灰水墨底色）→ 风格锁前置 + 显式"重新上色渲染"强指令
    const styleLock = STYLE_LOCKS[currentStyle] || STYLE_LOCKS.guofeng;
    const idea = domRefs.studioIdea ? domRefs.studioIdea.value.trim() : '';
    const subject = idea || craftTitle || (currentArtwork && currentArtwork.title) || '作品';
    // 提示词智能直通：详细艺术指导（画风/色彩/构图等）→ 最高优先级前置，风格锁降为辅助基调
    const isArtDirection = detectArtDirection(idea);
    const slotPrompt = (i) => {
      const sceneDesc = aiScenePrompts[i] || '';
      if (isArtDirection) {
        return `用户艺术指导（最高优先级，逐字严格执行）：${idea}。` +
          `辅助基调：${styleLock}。` +
          `在以上指导约束下完整重新绘制整幅画面，仅保留原图的构图布局与主体元素位置` +
          (sceneDesc ? `。分镜画面：${sceneDesc}` : '') +
          `。主体完整清晰，细节丰富`;
      }
      return `${styleLock}。以此艺术风格完整重新绘制整幅画面：` +
        `重新上色、重塑笔触与质感，呈现该风格特有的配色与氛围，` +
        `仅保留原图的构图布局与主体元素位置` +
        (sceneDesc ? `。分镜画面：${sceneDesc}` : '') +
        `。主题「${subject}」，细节丰富，主体完整清晰`;
    };

    // 3. 并行提交全部分镜任务（提交不阻塞，立即返回 taskId）
    setRepaintProgress(`提交 ${sceneCount} 个分镜任务…`);
    const submits = [];
    for (let i = 0; i < sceneCount; i++) {
      // 负面提示词：基础压制词 + 用户自定义负面词（AI 灵感区输入框）合并传递
      const userNegative = domRefs.negativeInput ? domRefs.negativeInput.value.trim() : '';
      const negativePrompt = [
        '照片写实感,原样复制,摄影质感,文字,水印,logo,边框',
        userNegative
      ].filter(Boolean).join(',');
      submits.push(imageRepaintSubmit(imageB64, slotPrompt(i), {
        timeout: 20000,
        // 坑9 配套：负向词压制"照片写实/原样复刻"，让风格迁移真正生效
        negativePrompt
      }).catch(() => null));
    }
    const taskIdList = (await Promise.all(submits)).map(r => (r && r.taskId) || '');
    const validIdx = taskIdList.map((t, i) => (t ? i : -1)).filter(i => i >= 0);
    validIdx.forEach(i => pending.add(i));
    if (!validIdx.length) throw new Error('分镜任务全部提交失败');
    const taskIdStr = taskIdList.filter(Boolean).join(',');

    // 4. 串行轮询（坑7：多任务串行查询避免 429；指数退避 1s→10s；总超时 150s，与云函数判定窗口对齐）
    const deadline = Date.now() + 150 * 1000;
    let delay = 1000;
    while (pending.size && Date.now() < deadline) {
      await _sleep(delay);
      for (const i of Array.from(pending)) {
        let r;
        try {
          r = await imageRepaintQuery(taskIdList[i], { timeout: 15000 });
        } catch (_) {
          continue; // 单次查询抖动不判死，下轮再试
        }
        if (r.status === 'succeeded') {
          try {
            const img = await loadImage(r.imageUrl); // crossOrigin=anonymous，远程无 CORS 头时加载失败按失败处理
            sceneImages[i] = img;
            okCount++;
          } catch (_) { /* 图片加载失败 → 该分镜回退原图 */ }
          pending.delete(i);
        } else if (r.status === 'failed') {
          pending.delete(i);
        }
        setRepaintProgress(`分镜生成中… 完成 ${sceneCount - pending.size}/${sceneCount}，正在重试，请稍候…`);
      }
      delay = Math.min(delay * 2, 10000);
    }

    // 5. 汇总上屏：失败槽位以原图占位，保持槽位对齐（层1 变焦取景兜底）
    if (currentLayoutId === lockedLayoutId) {
      if (okCount > 0) {
        repaintScenes = sceneImages.map(img => img || sourceImage);
        repaintKey = taskIdStr + '@' + Date.now(); // 静态层缓存失效
        schedulePreviewRender();
        if (window.showToast) showToast(`AI 已重绘 ${okCount}/${sceneCount} 个分镜`, 'success');
      } else {
        // 全部失败：保留层1 原取景，画面不白屏（验收：断 API key 仍可导出）
        if (window.showToast) showToast('AI 重绘失败，已保留原取景', 'warn');
      }
      if (domRefs.repaintHint) {
        domRefs.repaintHint.textContent = okCount > 0
          ? `已重绘 ${okCount}/${sceneCount} 分镜；点击按钮可再次重绘`
          : 'AI 重绘失败已回退原取景；点击按钮可重试';
      }
    }
  } catch (err) {
    console.warn('[AI-Craft] AI 重绘分镜失败:', err && err.message);
    if (window.showToast) showToast('AI 重绘失败：' + (err && err.message || '未知错误'), 'error');
  } finally {
    repaintRunning = false;
    setRepaintBtnState(false);
    if (domRefs && domRefs.repaintOverlay) domRefs.repaintOverlay.hidden = true;
  }
}

// ------------------------------------------------------------
// SubTask 7.3: 预览渲染（RAF 节流）
// ------------------------------------------------------------

/**
 * 节流的预览重绘（requestAnimationFrame 保证 60fps）
 */
function schedulePreviewRender() {
  if (previewRafId) cancelAnimationFrame(previewRafId);
  previewRafId = requestAnimationFrame(() => {
    renderPreview();
    previewRafId = 0;
  });
}

/**
 * 将当前作品按选中类型+风格渲染到 Canvas（dpr 高清适配）
 */
function renderPreview() {
  if (!domRefs || !canvasCtx || !currentArtwork) return;
  const canvas = domRefs.previewCanvas;
  if (!canvas) return;

  const typeDef = CRAFT_TYPES.find(t => t.key === currentCraftType) || CRAFT_TYPES[0];
  const { cssW, cssH } = computePreviewSize(typeDef.aspect);
  // 层1规范：导出物理分辨率 ≥2x（与 CSS 尺寸分离，下载/保存共用此画布）
  const dpr = Math.max(window.devicePixelRatio || 1, 2);

  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 清空 + 合成（传入自定义文案）
  canvasCtx.clearRect(0, 0, cssW, cssH);
  // 【四阶段·阶段③前置】整图设计稿模式：设计稿 cover-fit 铺满画布
  // （该画布同时是 3D 实物预览的贴图源 → 设计稿自动映射到品类 3D 模型）
  if (studioDesign && studioDesign.img) {
    const img = studioDesign.img;
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (iw && ih) {
      const scale = Math.max(cssW / iw, cssH / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      canvasCtx.drawImage(img, (cssW - dw) / 2, (cssH - dh) / 2, dw, dh);
      // canvas 文字模式：图上无字（生成时已压制），由系统排版叠加标题（中文零错字）
      if (studioDesign.textMode === 'canvas' && (craftTitle || craftSubtitle)) {
        const pad = Math.max(10, cssW * 0.04);
        // P1：文字叠加描边 + 投影，浅色图案上仍清晰可读
        function drawOutlinedText(ctx, text, x, y, fill, stroke, width, blur) {
          ctx.save();
          ctx.lineJoin = 'round';
          ctx.lineWidth = width;
          ctx.strokeStyle = stroke;
          ctx.strokeText(text, x, y);
          ctx.shadowColor = 'rgba(0,0,0,' + (blur > 6 ? 0.55 : 0.45) + ')';
          ctx.shadowBlur = blur;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = Math.max(1, blur * 0.25);
          ctx.fillStyle = fill;
          ctx.fillText(text, x, y);
          ctx.restore();
        }
        if (craftSubtitle) {
          canvasCtx.save();
          canvasCtx.font = `${Math.max(11, cssW * 0.026)}px "KaiTi","STKaiti",serif`;
          canvasCtx.textAlign = 'center';
          canvasCtx.textBaseline = 'bottom';
          drawOutlinedText(canvasCtx, craftSubtitle, cssW / 2, cssH - pad,
            'rgba(255,255,255,0.93)', 'rgba(0,0,0,0.68)', Math.max(1, cssW * 0.0018), 4);
          canvasCtx.restore();
        }
        if (craftTitle) {
          canvasCtx.save();
          canvasCtx.font = `bold ${Math.max(16, cssW * 0.045)}px "KaiTi","STKaiti",serif`;
          canvasCtx.textAlign = 'center';
          canvasCtx.textBaseline = 'bottom';
          const titleY = cssH - pad - (craftSubtitle ? Math.max(18, cssW * 0.04) : 0);
          drawOutlinedText(canvasCtx, craftTitle, cssW / 2, titleY,
            'rgba(255,255,255,0.97)', 'rgba(0,0,0,0.78)', Math.max(1.4, cssW * 0.0026), 6);
          canvasCtx.restore();
        }
      }
      // P0-1: 实物预览面板打开时，同步重绘当前场景（保持与结果画布一致）
      if (domRefs.mockupPanel && !domRefs.mockupPanel.hidden) renderMockupScene();
      return;
    }
  }
  buildCraftCanvas(canvasCtx, currentArtwork, currentCraftType, currentStyle, { w: cssW, h: cssH }, {
    title: craftTitle || undefined,
    subtitle: craftSubtitle || undefined
  });

  // P0-1: 实物预览面板打开时，同步重绘当前场景（保持与结果画布一致）
  if (domRefs.mockupPanel && !domRefs.mockupPanel.hidden) renderMockupScene();
}

/**
 * Canvas → Blob（toBlob 实现，避开大画布 toDataURL 的内存峰值；坑2）
 * @returns {Promise<Blob>}
 */
function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.92) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('toBlob 返回空'))),
        type,
        quality
      );
    } catch (err) {
      reject(err); // 跨域污染画布时抛 SecurityError，由调用方降级
    }
  });
}

/** Blob → dataURL（IndexedDB 存储格式保持不变） */
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('Blob 读取失败'));
    fr.readAsDataURL(blob);
  });
}

/**
 * 将当前 Canvas 导出为 base64（toBlob → FileReader 链路，坑2 禁 toDataURL）
 * @returns {Promise<string>} dataURL（失败返回 ''）
 */
async function exportCanvasBase64() {
  if (!domRefs || !domRefs.previewCanvas) return '';
  try {
    const blob = await canvasToBlob(domRefs.previewCanvas, 'image/jpeg', 0.92);
    return await blobToDataURL(blob);
  } catch (err) {
    console.warn('[AI-Craft] 导出失败（可能是跨域图片）:', err && err.message);
    return '';
  }
}

// ------------------------------------------------------------
// SubTask 7.4: DOM 构建与 UI 交互
// ------------------------------------------------------------

/**
 * 创建文创工作台 DOM（整体结构）
 * @returns {HTMLElement}
 */
function createWorkbench() {
  const wrap = document.createElement('section');
  wrap.className = 'craft-workbench glass';
  wrap.innerHTML = `
    <header class="craft-header">
      <div class="craft-title-row">
        <h2 class="craft-title"><i class="fa-solid fa-wand-magic-sparkles"></i> AI 文创衍生品</h2>
      </div>
      <!-- 景区文化智能匹配提示条：openCraft 渲染时根据 scenic 上下文显示，默认隐藏 -->
      <div class="craft-scenic-match-hint" id="craft-scenic-match-hint" data-scenic-match="true" hidden>
        <i class="fa-solid fa-wand-magic-sparkles"></i>
        <span>已为您匹配 <strong id="craft-scenic-area-name"></strong> 景区 · <strong id="craft-scenic-style-name"></strong> 风格</span>
      </div>
      <p class="craft-subtitle">基于作品合成壁纸/海报/藏品卡/明信片/模板，8 大文旅风格 · 版式构图 · 输入想法 AI 一键生成</p>
      <div class="craft-header-actions">
        <button class="btn-ghost" id="craft-mockup-btn" title="预览实物场景效果（桌面/相框/手机/卡册/社交）"><i class="fa-solid fa-cube"></i> 实物预览</button>
        <button class="btn-ghost" id="craft-poster-btn" title="生成分享海报"><i class="fa-solid fa-qrcode"></i> 分享海报</button>
        <button class="btn-ghost" id="craft-download" title="下载当前文创"><i class="fa-solid fa-download"></i> 下载</button>
        <button class="btn-primary" id="craft-save" title="保存文创到数字文创馆"><i class="fa-solid fa-floppy-disk"></i> 保存文创</button>
        <button class="btn-ghost" id="craft-close" title="关闭工作台"><i class="fa-solid fa-xmark"></i> 关闭</button>
      </div>
    </header>

    <div class="craft-body">
      <!-- 左侧预览 -->
      <div class="craft-preview-area">
        <div class="craft-original-label">
          <span class="craft-art-title" id="craft-art-title">加载中…</span>
          <span class="craft-art-no" id="craft-art-no"></span>
        </div>
        <div class="craft-canvas-wrap" id="craft-canvas-wrap">
          <canvas id="craft-preview-canvas" class="craft-preview-canvas" aria-label="文创衍生品预览"></canvas>
          <div class="craft-canvas-loading" id="craft-canvas-loading">
            <i class="fa-solid fa-spinner fa-spin"></i> 图片加载中…
          </div>
          <!-- 融合改造层2: AI 重绘分镜进度浮层（复用超清浮层观感） -->
          <div class="craft-repaint-overlay" id="craft-repaint-overlay" hidden>
            <div class="craft-repaint-overlay-card">
              <i class="fa-solid fa-wand-magic-sparkles fa-fade"></i>
              <strong>AI 重绘分镜中</strong>
              <span id="craft-repaint-progress">提交任务…</span>
            </div>
          </div>
        </div>
        <!-- P0-1: 实物场景预览面板（叠加在结果预览区上） -->
        <div class="craft-mockup-panel" id="craft-mockup-panel" hidden>
          <div class="craft-mockup-head">
            <h3 class="craft-mockup-title"><i class="fa-solid fa-cube"></i> 实物场景预览</h3>
            <button class="btn-ghost craft-mockup-close" id="craft-mockup-close" title="关闭实物预览"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="craft-mockup-chips" id="craft-mockup-chips" role="tablist" aria-label="实物场景切换"></div>
          <div class="craft-mockup-stage">
            <canvas id="craft-mockup-canvas" aria-label="实物场景预览图"></canvas>
            <div class="craft-3d-view" id="craft-3d-view" hidden aria-label="3D 实物预览"></div>
          </div>
          <div class="craft-mockup-actions">
            <button class="btn-primary" id="craft-mockup-export"><i class="fa-solid fa-download"></i> 导出场景图</button>
            <button class="craft-mockup-order" id="craft-mockup-order">🛍 一键定制下单</button>
          </div>
        </div>
      </div>

      <!-- 右侧控制面板 -->
      <div class="craft-control-area">
        <!-- 四阶段·阶段①②：AI 整图创作（单窗口主入口：想法 + 素材图 → 整图重绘） -->
        <div class="craft-panel craft-studio-panel">
          <h3 class="craft-panel-title"><i class="fa-solid fa-wand-magic-sparkles"></i> AI 整图创作</h3>
          <div class="craft-studio-image-row">
            <div class="craft-studio-image-slot" id="craft-studio-image-slot" title="当前素材图（点击可更换）"></div>
            <div class="craft-studio-image-btns">
              <button type="button" class="btn-ghost" id="craft-studio-upload-btn" title="上传自己的照片作为创作素材"><i class="fa-solid fa-upload"></i> 上传图片</button>
              <button type="button" class="btn-ghost" id="craft-studio-reset-btn" hidden title="恢复为当前作品原图"><i class="fa-solid fa-rotate-left"></i> 恢复作品图</button>
            </div>
            <input type="file" id="craft-studio-file" accept="image/*" hidden />
          </div>
          <textarea id="craft-studio-idea" class="craft-idea-box" rows="3" placeholder="输入想法（越具体效果越好），如：水墨风插画，大面积留白，纸纹质感，低对比度柔光"></textarea>
          <div class="craft-studio-textmode" role="radiogroup" aria-label="图上文字生成方式">
            <span class="craft-studio-textmode-label">图上文字：</span>
            <button type="button" class="craft-textmode-opt" data-textmode="model" title="AI 直接把标题画进图里（手写体效果自然，但英文可能拼错）">AI 绘制</button>
            <button type="button" class="craft-textmode-opt sel" data-textmode="canvas" title="图上无文字，由系统排版叠加（零错字，可编辑，商品图推荐）">后期排版</button>
          </div>
          <input id="craft-studio-negative" class="craft-negative-input" maxlength="120" placeholder="负面提示词（可选），如：照片写实，强烈阴影，噪点" title="整图重绘时排除的元素，与基础压制词叠加生效" />
          <button class="btn-primary craft-studio-btn" id="craft-studio-generate"><i class="fa-solid fa-wand-magic-sparkles"></i> 开始创作</button>
          <div class="craft-studio-status" id="craft-studio-status" hidden></div>
          <div class="craft-studio-actions" id="craft-studio-actions" hidden>
            <button type="button" class="btn-ghost" id="craft-studio-regen"><i class="fa-solid fa-rotate-right"></i> 重新生成</button>
            <button type="button" class="btn-ghost" id="craft-studio-suggest-btn"><i class="fa-solid fa-lightbulb"></i> 调整提示词建议</button>
          </div>
          <div class="craft-studio-suggestions" id="craft-studio-suggestions" hidden></div>
          <p class="craft-idea-hint">自研模型策划画风与文案 → AI 整图重绘你的图片；满意后到「文创产品」选品类看 3D 实物预览</p>
          <span id="craft-model-badge" class="craft-model-badge" hidden></span>
          <span id="craft-product-badge" class="craft-model-badge craft-product-badge" hidden></span>
        </div>

        <!-- 阶段③：文创产品（两级品类选择器，10 大类 × 235 种产品） -->
        <div class="craft-panel">
          <h3 class="craft-panel-title"><i class="fa-solid fa-shapes"></i> 文创产品 <span class="craft-picker-count" id="craft-picker-count"></span></h3>
          <div class="craft-category-chips" id="craft-category-chips" role="tablist" aria-label="文创产品大类"></div>
          <div class="craft-product-grid" id="craft-product-grid"></div>
        </div>

        <!-- 精修模式（高级面板折叠：风格 / 版式 / 分镜重绘 / 文案 / 历史） -->
        <details class="craft-refine" id="craft-refine">
          <summary><i class="fa-solid fa-sliders"></i> 精修模式 · 风格 / 版式 / 分镜重绘 / 文案 / 历史</summary>
          <div class="craft-refine-body">
            <!-- 风格模板 -->
            <div class="craft-panel">
              <h3 class="craft-panel-title"><i class="fa-solid fa-palette"></i> 风格模板</h3>
              <div class="craft-style-grid" id="craft-style-grid"></div>
            </div>

            <!-- 融合改造层1: 版式构图（版式引擎，纯 Canvas 无 AI） -->
            <div class="craft-panel">
              <h3 class="craft-panel-title"><i class="fa-solid fa-table-cells-large"></i> 版式构图</h3>
              <div class="craft-layout-grid" id="craft-layout-grid"></div>
              <!-- 融合改造层2: AI 重绘分镜（图生图，失败自动回退层1 取景兜底） -->
              <div class="craft-repaint-row">
                <button class="btn-primary craft-repaint-btn" id="craft-repaint-btn"><i class="fa-solid fa-wand-magic-sparkles"></i> AI 重绘分镜</button>
                <input id="craft-negative-input" class="craft-negative-input" maxlength="120" placeholder="负面提示词（可选），如：照片写实，强烈阴影，噪点" title="重绘时排除的元素，与基础压制词叠加生效" />
                <p class="craft-repaint-hint" id="craft-repaint-hint">选择版式后，AI 以统一画风重绘分镜槽位</p>
              </div>
            </div>

            <!-- 文案标题 -->
            <div class="craft-panel">
              <h3 class="craft-panel-title"><i class="fa-solid fa-pen-nib"></i> 文案标题</h3>
              <input id="craft-title-input" class="craft-title-input" maxlength="24" placeholder="留空使用作品标题" />
              <input id="craft-subtitle-input" class="craft-title-input" maxlength="30" placeholder="副标题文案（可选）" />
            </div>

            <!-- 历史文创 -->
            <div class="craft-panel">
              <h3 class="craft-panel-title"><i class="fa-solid fa-clock-rotate-left"></i> 历史文创 <span class="craft-version-count" id="craft-version-count">0</span></h3>
              <div class="craft-version-list" id="craft-version-list"></div>
            </div>
          </div>
        </details>
      </div>
    </div>
  `;
  return wrap;
}

/**
 * 绑定所有 UI 事件
 */
function bindUIEvents() {
  if (!domRefs) return;

  // 保存按钮
  domRefs.btnSave?.addEventListener('click', () => saveCraft());

  // 下载按钮
  domRefs.btnDownload?.addEventListener('click', () => downloadCraft());

  // 关闭按钮
  domRefs.btnClose?.addEventListener('click', () => closeCraft());

  // P0-1: 实物场景预览（打开/关闭/切场景/导出/定制）+ P0-2 挂载点②: 分享海报
  domRefs.btnMockup?.addEventListener('click', () => openMockupPanel());
  domRefs.btnPoster?.addEventListener('click', () => shareCraftPoster());
  domRefs.mockupClose?.addEventListener('click', () => closeMockupPanel());
  domRefs.mockupExport?.addEventListener('click', () => exportMockupScene());
  domRefs.mockupOrder?.addEventListener('click', () => orderCraftMockup());

  // ESC 键关闭
  const onEsc = (e) => {
    if (e.key === 'Escape') closeCraft();
  };
  document.addEventListener('keydown', onEsc);
  domRefs._escHandler = onEsc;

  // 四阶段·阶段①②：AI 整图创作（单窗口主入口）
  domRefs.studioGen?.addEventListener('click', () => runStudioCreate());
  domRefs.studioRegen?.addEventListener('click', () => runStudioCreate({ regen: true }));
  domRefs.studioSuggestBtn?.addEventListener('click', () => renderStudioSuggestions());
  domRefs.studioUploadBtn?.addEventListener('click', () => domRefs.studioFile?.click());
  domRefs.studioImageSlot?.addEventListener('click', () => domRefs.studioFile?.click());
  domRefs.studioResetBtn?.addEventListener('click', () => resetStudioImage());
  // 上传素材图（FileReader dataURL 模式，同 culture-scan 上传链路）
  domRefs.studioFile?.addEventListener('change', () => {
    const file = domRefs.studioFile.files && domRefs.studioFile.files[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => setStudioImage(String(fr.result || ''));
    fr.onerror = () => (window.showToast ? showToast('图片读取失败', 'error') : 0);
    fr.readAsDataURL(file);
    domRefs.studioFile.value = ''; // 允许重复选择同一文件
  });
  // 编辑想法 → 重置本轮重生成计数（用户改了提示词 = 新一轮创作）
  domRefs.studioIdea?.addEventListener('input', () => {
    if (studioLastIdea && domRefs.studioIdea.value.trim() !== studioLastIdea) studioRegenCount = 0;
  });
  // 图上文字模式切换（model = AI 绘制 / canvas = 后期排版）
  (domRefs.studioTextModes || []).forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.textmode;
      if (!mode || mode === studioTextMode) return;
      studioTextMode = mode;
      (domRefs.studioTextModes || []).forEach(b => b.classList.toggle('sel', b === btn));
      // 已有设计稿时切换文字模式 → 重算叠字渲染（model 模式若设计稿是 canvas 生成需重新生成）
      if (studioDesign) schedulePreviewRender();
    });
  });
  // 精修模式：AI 重绘分镜（折叠面板内，保留原有能力）
  domRefs.repaintBtn?.addEventListener('click', () => runSceneRepaint());

  // M6c: 标题/副标题实时预览
  domRefs.titleInput?.addEventListener('input', () => {
    craftTitle = domRefs.titleInput.value.trim();
    schedulePreviewRender();
  });
  domRefs.subtitleInput?.addEventListener('input', () => {
    craftSubtitle = domRefs.subtitleInput.value.trim();
    schedulePreviewRender();
  });

  // 窗口 resize 重绘
  const onResize = () => schedulePreviewRender();
  window.addEventListener('resize', onResize);
  domRefs._resizeHandler = onResize;
}

/**
 * 构建两级品类选择器（阶段B：10 大类 chips + 产品网格，爆款置顶，235 种产品全暴露）
 * @param {boolean} syncCategory - true 时选中产品所在大类优先（打开/重渲染保持上下文连续）；
 *                                 用户手动点大类 chip 时必须传 false，否则切换会被拉回产品大类
 */
function rebuildTypeGrid(syncCategory = true) {
  if (!domRefs || !domRefs.categoryChips || !domRefs.typeGrid) return;
  // 选中产品所在大类优先（保持上下文连续；手动切换大类时跳过）
  if (syncCategory) {
    const selProduct = currentProductName ? getProductByName(currentProductName) : null;
    if (selProduct && selProduct.category !== currentCategoryKey) currentCategoryKey = selProduct.category;
  }

  // 一级：大类 chips
  domRefs.categoryChips.innerHTML = '';
  CRAFT_CATEGORIES.forEach(c => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `craft-category-chip${c.key === currentCategoryKey ? ' active' : ''}`;
    btn.dataset.key = c.key;
    btn.title = c.desc;
    btn.innerHTML = `<i class="fa-solid ${c.icon}"></i><span>${c.label}</span>`;
    btn.addEventListener('click', () => {
      if (typeof Sound !== 'undefined') Sound.playSound('click');
      currentCategoryKey = c.key;
      rebuildTypeGrid(false); // 手动切大类：不拉回产品所在大类
    });
    domRefs.categoryChips.appendChild(btn);
  });

  // 二级：产品网格（爆款置顶 + 🔥 角标 + 画布规格/3D 支持标注）
  domRefs.typeGrid.innerHTML = '';
  const products = [...getProductsByCategory(currentCategoryKey)]
    .sort((a, b) => (b.hot ? 1 : 0) - (a.hot ? 1 : 0));
  if (domRefs.pickerCount) domRefs.pickerCount.textContent = `${products.length} 种`;
  products.forEach(p => {
    const typeDef = CRAFT_TYPES.find(t => t.key === p.canvasType);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `craft-product-card${p.name === currentProductName ? ' active' : ''}`;
    btn.dataset.key = p.key;
    btn.dataset.name = p.name;
    btn.title = p.name + (p.form3d ? '（支持 3D 实物预览）' : '');
    btn.innerHTML = `
      <span class="craft-product-name">${p.hot ? '<i class="fa-solid fa-fire"></i> ' : ''}${p.name}</span>
      <span class="craft-product-spec">${typeDef ? typeDef.label + ' · ' + typeDef.aspect : p.canvasType}${p.form3d ? ' · 3D' : ''}</span>
    `;
    btn.addEventListener('click', () => {
      if (typeof Sound !== 'undefined') Sound.playSound('click');
      applyProductSelection(p);
    });
    domRefs.typeGrid.appendChild(btn);
  });
}

/**
 * 应用产品选择：切换画布规格 + 版式回退 + 分镜失效 + 产品徽标 + 预览刷新
 * @param {object} product - craft-products.js 产品定义
 */
function applyProductSelection(product) {
  if (!product) return;
  currentProductName = product.name;
  currentCraftType = product.canvasType;
  // 层1：切换类型后当前版式不适用则回退经典版式
  if (currentLayoutId) {
    const lay = LAYOUTS[currentLayoutId];
    if (!lay || !lay.craftTypes.includes(currentCraftType)) currentLayoutId = '';
  }
  // 层2：类型切换版式可能回退，分镜产物一并失效
  if (!currentLayoutId) {
    repaintScenes = [];
    repaintKey = '';
  }
  _showProductBadge(currentProductName);
  rebuildTypeGrid();
  rebuildLayoutGrid();
  rebuildMockupChips(); // 保证 chip disabled/active 状态跟随产品 form3d 同步
  schedulePreviewRender();

  // 阶段C：3D 预览跟随产品切换（面板开着时的三种场景）
  if (domRefs && domRefs.mockupPanel && !domRefs.mockupPanel.hidden) {
    if (mockupScene === '3d') {
      // 场景 A：用户在 3D 模式下切产品 → 销毁旧实例 + 重建新形态（或无 form3d → fallback）
      Craft3D.dispose();
      if (product.form3d) {
        renderMockupScene();
      } else {
        _fallbackTo2D(true);
        if (window.showToast) showToast('该产品暂无 3D 形态，已切换 2D 场景', 'info');
      }
    } else if (product.form3d && !Craft3D.isActive()) {
      // 场景 B：此前 fallback 到 2D 后，切回有 form3d 的产品 → 3D chip 已恢复 enabled
      // 不强制自动进入 3D（尊重用户此前 fallback 的选择），但确保用户手动点 chip 时能正常 render
      // lastForm3d 在此处不需要 reset — renderMockupScene 内部会按 form3d 比对决定 refresh 还是重建
    }
  }
}

/**
 * 按产品名选中产品（AI 推荐/历史联动）：精确命中 → 模糊匹配 → 不动
 * @param {string} name
 */
function selectProductByName(name) {
  const s = String(name || '').trim();
  if (!s) return;
  let product = getProductByName(s);
  if (!product) {
    const hits = searchProducts(s);
    if (hits.length) product = hits[0];
  }
  if (product) {
    currentCategoryKey = product.category;
    applyProductSelection(product);
    // 滚动到选中卡片（爆款置顶后仍可能在网格深处）
    const card = domRefs && domRefs.typeGrid && domRefs.typeGrid.querySelector(`.craft-product-card[data-key="${product.key}"]`);
    if (card) card.scrollIntoView({ block: 'nearest' });
  }
}

/**
 * 构建风格按钮网格
 */
function rebuildStyleGrid() {
  if (!domRefs || !domRefs.styleGrid) return;
  domRefs.styleGrid.innerHTML = '';
  CRAFT_STYLES.forEach(s => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `craft-style-chip${s.key === currentStyle ? ' active' : ''}`;
    btn.dataset.key = s.key;
    btn.title = s.desc;
    btn.innerHTML = `
      <span class="craft-style-icon" style="color:${s.accent}"><i class="fa-solid ${s.icon}"></i></span>
      <span class="craft-style-label">${s.label}</span>
      <span class="craft-style-desc">${s.desc}</span>
    `;
    btn.addEventListener('click', () => {
      if (typeof Sound !== 'undefined') Sound.playSound('click');
      currentStyle = s.key;
      rebuildStyleGrid();
      schedulePreviewRender();
    });
    domRefs.styleGrid.appendChild(btn);
  });
}

/**
 * 构建版式按钮网格（融合改造层1：经典版式 + 当前类型适配版式，切换即重渲染）
 */
function rebuildLayoutGrid() {
  if (!domRefs || !domRefs.layoutGrid) return;
  domRefs.layoutGrid.innerHTML = '';
  const options = [
    { id: '', label: '经典版式', desc: '原版合成' },
    ...getLayoutsForType(currentCraftType)
  ];
  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `craft-layout-chip${currentLayoutId === opt.id ? ' active' : ''}`;
    btn.innerHTML = `
      <span class="craft-layout-name">${opt.label}</span>
      <span class="craft-layout-desc">${opt.desc || ''}</span>
    `;
    btn.addEventListener('click', () => {
      if (typeof Sound !== 'undefined') Sound.playSound('click');
      currentLayoutId = opt.id;
      // 层2：分镜产物与槽位绑定，换版式即失效（失败槽位自然回退层1 取景）
      repaintScenes = [];
      repaintKey = '';
      rebuildLayoutGrid();
      schedulePreviewRender();
    });
    domRefs.layoutGrid.appendChild(btn);
  });
  updateRepaintHint();
}

/**
 * 层2：更新「AI 重绘分镜」按钮提示文案（按当前版式的分镜槽位数）
 */
function updateRepaintHint() {
  if (!domRefs || !domRefs.repaintHint) return;
  if (!currentLayoutId) {
    domRefs.repaintHint.textContent = '先在上方选择版式，AI 才能重绘分镜槽位';
    return;
  }
  const layout = LAYOUTS[currentLayoutId];
  const n = layout ? layout.slots.filter(s => s.type === 'scene').length : 0;
  domRefs.repaintHint.textContent = n
    ? `当前版式有 ${n} 个分镜槽位，AI 以统一画风重绘；失败自动回退原取景`
    : '当前版式无分镜槽位';
}

// ------------------------------------------------------------
// SubTask 7.5: 历史文创加载与管理
// ------------------------------------------------------------

/**
 * 🎯 恢复历史文创版本
 * 根因修复 v2（v1 有 race condition）：
 *   v1 问题：rebuildTypeGrid/StyleGrid → RAF(renderPreview) 入队
 *           → 异步 drawImage 在 RAF 之后才画 / 或根本被 RAF 的 renderPreview
 *             覆盖了（因为 renderPreview 会改 canvas.width → 浏览器清空）
 *   v2 策略：
 *     ① 不调 rebuildTypeGrid/StyleGrid（它们内部会调 schedulePreviewRender）
 *        手动改 grid 的 active 样式 → 但不触发重画
 *     ② 用【双 RAF】：先让 renderPreview 跑完改好 canvas 尺寸 → 再 drawImage 覆盖
 *     ③ 如果 record 有 imageData → 完全像素还原（忽略 type/style/layout 重画）
 *        因为 imageData 就是当时所见即所得的完整画面
 */
function _restoreCraftVersion(v) {
  if (!v) return;
  if (typeof Sound !== 'undefined') Sound.playSound('click');

  // ==== 1. 恢复状态变量（不触发 schedulePreviewRender） ====
  if (v.craftType) {
    currentCraftType = v.craftType;
    // 产品名匹配：恢复时若当前选中产品的画布不匹配 → 清空（防错位）
    if (currentProductName && getProductByName(currentProductName)?.canvasType !== v.craftType) {
      currentProductName = '';
      _showProductBadge('');
    }
    // 🆕 只改 grid 的 active 样式，不调 rebuildTypeGrid（它内部会 schedulePreviewRender）
    document.querySelectorAll('.craft-type-item').forEach(el => {
      el.classList.toggle('active', el.dataset.key === currentCraftType);
    });
  }
  const styleKey = CRAFT_STYLES.find(s => s.label === v.styleTheme)?.key;
  if (styleKey) {
    currentStyle = styleKey;
    // 🆕 只改 grid 的 active 样式
    document.querySelectorAll('.craft-style-item').forEach(el => {
      el.classList.toggle('active', el.dataset.key === currentStyle);
    });
  }
  // 🆕 恢复标题/副标题/产品名
  craftTitle = v.craftTitle || '';
  craftSubtitle = v.craftSubtitle || '';
  if (v.productName && typeof v.productName === 'string') {
    const p = getProductByName(v.productName);
    if (p && p.canvasType === currentCraftType) {
      currentProductName = v.productName;
      _showProductBadge(v.productName);
    }
  }

  // ==== 2. 回写输入框 ====
  if (domRefs) {
    if (domRefs.titleInput) domRefs.titleInput.value = craftTitle;
    if (domRefs.subtitleInput) domRefs.subtitleInput.value = craftSubtitle;
  }

  // ==== 3. 🎯 像素级还原 Canvas（核心 + race condition 修复） ====
  if (v.imageData && domRefs?.previewCanvas) {
    // 方案：双 RAF 确保 drawImage 在"任何可能触发的 schedulePreviewRender"之后执行
    //  RAF#1: 让当前帧已入队的 renderPreview 跑完（改 canvas.width/height → 浏览器清空）
    //  RAF#2: 在稳定的 canvas 上画回 imageData（覆盖 renderPreview 画的内容）
    const canvas = domRefs.previewCanvas;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // RAF 链里先让 Image load（dataURL 是同步解析的）
        const img = new Image();
        img.onload = () => {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          // drawImage：canvas.width/height 是 renderPreview 改后的物理尺寸
          // 图会被拉伸，但比"还原不了"好；如果 record 是同一 aspect ratio 就完美
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.dispatchEvent(new Event('craft:restored'));
          if (window.showToast) showToast(`✓ 已恢复文创 #${v.id}`, 'success');
        };
        img.onerror = () => {
          console.warn('[AI-Craft] 恢复：imageData 加载失败，fallback schedulePreviewRender');
          schedulePreviewRender();
          if (window.showToast) showToast(`✓ 已恢复文创 #${v.id}（按当前状态重绘）`, 'success');
        };
        img.src = v.imageData;
      });
    });
  } else {
    // 老记录没 imageData → fallback：按恢复后的 state 重画
    schedulePreviewRender();
    if (window.showToast) showToast(`✓ 已恢复文创 #${v.id}`, 'success');
  }
}

/**
 * 从 IndexedDB 加载当前作品的历史文创列表
 */
async function loadCraftHistory() {
  if (!domRefs || !domRefs.versionList || !currentArtworkId) return;
  domRefs.versionList.innerHTML = '<div class="craft-version-loading"><i class="fa-solid fa-spinner fa-spin"></i></div>';
  try {
    const list = await getAiCraftsByArtwork(currentArtworkId);
    domRefs.versionCount.textContent = list.length;
    if (!list.length) {
      domRefs.versionList.innerHTML = '<div class="craft-version-empty">暂无历史文创，选择类型与风格后点击「保存文创」</div>';
      return;
    }
    domRefs.versionList.innerHTML = '';
    list.forEach(v => {
      const card = document.createElement('div');
      card.className = 'craft-version-card';
      card.dataset.craftId = v.id;
      const time = new Date(v.createdAt);
      const timeStr = `${time.getMonth() + 1}/${time.getDate()} ${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
      const typeLabel = CRAFT_TYPES.find(t => t.key === v.craftType)?.label || v.craftType;
      const styleLabel = v.styleTheme || '';
      card.innerHTML = `
        <div class="craft-version-thumb">
          ${v.imageData ? `<img src="${v.imageData}" alt="文创 ${v.id}" />` : '<div class="craft-version-thumb-empty"><i class="fa-solid fa-image"></i></div>'}
        </div>
        <div class="craft-version-info">
          <div class="craft-version-head">
            <span class="craft-version-type"><i class="fa-solid fa-wand-magic-sparkles"></i> AI</span>
            <span class="craft-version-time">${timeStr}</span>
          </div>
          <div class="craft-version-meta">#${v.id} · ${typeLabel}${styleLabel ? ' · ' + styleLabel : ''}</div>
        </div>
        <div class="craft-version-actions">
          <button class="craft-version-restore btn-ghost" title="恢复此文创"><i class="fa-solid fa-rotate-left"></i></button>
          <button class="craft-version-delete btn-ghost" title="删除此文创"><i class="fa-solid fa-trash"></i></button>
        </div>
      `;
      // 🎯 card 整体可点：恢复到工作台（用户点缩略图/标题都能还原）
      card.addEventListener('click', (ev) => {
        // 点击按钮时不要冒泡（按钮自己有 handler）
        if (ev.target.closest('.craft-version-actions')) return;
        _restoreCraftVersion(v);
      });
      // 恢复按钮（显式小图标，兼容老交互）
      card.querySelector('.craft-version-restore')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        _restoreCraftVersion(v);
      });
      // 删除按钮
      card.querySelector('.craft-version-delete')?.addEventListener('click', async () => {
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        if (!confirm(`确认删除文创 #${v.id}？此操作不可撤销`)) return;
        try {
          await deleteCraftRecord(v.id);
          await loadCraftHistory();
          if (window.showToast) showToast('文创已删除', 'info');
        } catch (err) {
          if (window.showToast) showToast('删除失败：' + (err && err.message || '未知错误'), 'error');
        }
      });
      domRefs.versionList.appendChild(card);
    });
  } catch (err) {
    console.error('[AI-Craft] 加载历史文创失败:', err);
    domRefs.versionList.innerHTML = '<div class="craft-version-empty">加载失败，请刷新重试</div>';
  }
}

/**
 * 保存当前文创到 IndexedDB
 */
async function saveCraft() {
  if (!currentArtworkId || !currentArtwork) return;
  const user = window.currentUser;
  if (!user) {
    if (window.Auth) Auth.requireLogin();
    return;
  }
  if (typeof Sound !== 'undefined') Sound.playSound('click');
  domRefs.btnSave.disabled = true;
  domRefs.btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 保存中…';
  try {
    const imageData = await exportCanvasBase64();
    if (!imageData) {
      if (window.showToast) showToast('图片导出失败，请重试', 'error');
      return;
    }
    const styleDef = CRAFT_STYLES.find(s => s.key === currentStyle) || CRAFT_STYLES[0];
    const typeDef = CRAFT_TYPES.find(t => t.key === currentCraftType) || CRAFT_TYPES[0];
    const record = {
      artworkId: currentArtworkId,
      userId: user.id || user.username,
      craftType: currentCraftType,
      styleTheme: styleDef.label,
      imageData: imageData,
      craftTitle: craftTitle || '',
      craftSubtitle: craftSubtitle || '',
      productName: currentProductName || '',
      aiPrompt: `${currentProductName || typeDef.label}·${styleDef.label}风格·${craftTitle || currentArtwork.title || ''}${craftSubtitle ? '·「' + craftSubtitle + '」' : ''}`
    };
    const saved = await addAiCraft(record);
    await loadCraftHistory();
    if (window.showToast) showToast(`🎨 文创 #${saved.id} 已保存到数字文创馆`, 'success');
    // 文化足迹点亮（craft 行为）：作品文本命中文化知识库主题时记录，失败不阻塞
    try {
      const hay = `${currentArtwork.title || ''} ${(currentArtwork.tags || []).join(',')} ${craftTitle || ''} ${record.aiPrompt}`;
      const theme = matchThemeByText(hay);
      if (theme) {
        const lit = await recordFootprint(user.id || user.username, theme.themeId, 'craft', {
          meta: { craftId: saved.id, themeName: theme.name }
        });
        if (lit) {
          window.dispatchEvent(new CustomEvent('culture:footprint', {
            detail: { themeId: theme.themeId, action: 'craft', level: 'new' }
          }));
          if (window.showToast) showToast(`✨ 点亮「${theme.name}」创作足迹，去探索足迹看徽章`, 'success');
        }
      }
    } catch (e) { console.warn('[AI-Craft] 文化足迹记录失败（不阻塞）:', e && e.message); }
  } catch (err) {
    console.error('[AI-Craft] 保存文创失败:', err);
    if (window.showToast) showToast('保存失败：' + (err && err.message || '未知错误'), 'error');
  } finally {
    domRefs.btnSave.disabled = false;
    domRefs.btnSave.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> 保存文创';
  }
}

/**
 * 删除文创记录（封装 db 调用，便于历史列表调用）
 * @param {number} id
 */
async function deleteCraftRecord(id) {
  return deleteAiCraft(id);
}

/**
 * 下载当前文创为图片文件（toBlob + ObjectURL，导出 2x 物理分辨率）
 */
async function downloadCraft() {
  if (!domRefs || !domRefs.previewCanvas) return;
  if (typeof Sound !== 'undefined') Sound.playSound('click');
  let url = '';
  try {
    const blob = await canvasToBlob(domRefs.previewCanvas, 'image/png');
    url = URL.createObjectURL(blob);
    const typeDef = CRAFT_TYPES.find(t => t.key === currentCraftType) || CRAFT_TYPES[0];
    const link = document.createElement('a');
    link.download = `dreamcore-craft-${typeDef.key}-${Date.now()}.png`;
    link.href = url;
    link.click();
    if (window.showToast) showToast('文创已下载', 'success');
  } catch (err) {
    if (window.showToast) showToast('下载失败：' + (err && err.message || '未知错误'), 'error');
  } finally {
    if (url) setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

// ------------------------------------------------------------
// P0-1: 文创实物场景预览（js/craft-mockup.js 纯 Canvas 样机，切换/导出均重绘）
// P0-2 挂载点②: 结果页分享海报（js/share-poster.js 通用模块）
// ------------------------------------------------------------

/**
 * 打开实物预览面板：默认场景按当前文创类型映射（postcard→desk 等）
 */
function openMockupPanel() {
  if (!domRefs || !domRefs.mockupPanel) return;
  if (typeof Sound !== 'undefined') Sound.playSound('click');
  mockupScene = MOCKUP_TYPE_SCENE_MAP[currentCraftType] || (MOCKUP_SCENES[0] && MOCKUP_SCENES[0].key) || 'desk';
  rebuildMockupChips();
  domRefs.mockupPanel.hidden = false;
  renderMockupScene();
}

/**
 * 关闭实物预览面板（工作台与结果画布保持不动）
 */
function closeMockupPanel() {
  if (!domRefs || !domRefs.mockupPanel) return;
  Craft3D.dispose(); // 阶段C：关闭面板即释放 3D 资源（CanvasTexture 显式释放）
  if (domRefs.three3dView) domRefs.three3dView.hidden = true;
  if (domRefs.mockupCanvas) domRefs.mockupCanvas.style.display = '';
  domRefs.mockupPanel.hidden = true;
}

/**
 * 当前选中产品的 3D 形态（无产品/无 form3d 返回 ''，3D chip 置灰回退 2D）
 */
function _currentForm3d() {
  if (!currentProductName) return '';
  const p = getProductByName(currentProductName);
  return (p && p.form3d) || '';
}

/**
 * 3D 场景不可用时回退 2D 默认场景（保持面板可用，不白屏）
 */
function _fallbackTo2D(rebuildChips) {
  mockupScene = MOCKUP_TYPE_SCENE_MAP[currentCraftType] || (MOCKUP_SCENES[0] && MOCKUP_SCENES[0].key) || 'desk';
  if (rebuildChips) rebuildMockupChips();
  renderMockupScene();
}

/**
 * 构建场景切换 chips（阶段C：首位 3D 旋转 + 5 个 2D 场景横排，窄屏 flex-wrap 换行）
 */
function rebuildMockupChips() {
  if (!domRefs || !domRefs.mockupChips) return;
  domRefs.mockupChips.innerHTML = '';

  // 阶段C：首位插入"3D 旋转"chip（当前产品无 form3d → 置灰不可点，回退 2D 场景）
  const form3d = _currentForm3d();
  const btn3d = document.createElement('button');
  btn3d.type = 'button';
  btn3d.className = 'craft-mockup-chip craft-mockup-chip-3d' + (mockupScene === '3d' ? ' active' : '');
  btn3d.dataset.scene = '3d';
  btn3d.title = form3d
    ? `3D 旋转实物预览（${currentProductName || Craft3D.FORM3D_LABELS[form3d] || form3d}），可拖拽旋转/滚轮缩放`
    : '当前产品暂无 3D 形态，请选择带「3D」标注的产品';
  btn3d.innerHTML = `<i class="fa-solid fa-cube"></i><span>3D 旋转</span>`;
  if (!form3d) {
    btn3d.disabled = true;
    btn3d.classList.add('disabled');
  } else {
    btn3d.addEventListener('click', () => {
      if (typeof Sound !== 'undefined') Sound.playSound('click');
      if (mockupScene === '3d') return;
      mockupScene = '3d';
      rebuildMockupChips();
      renderMockupScene();
    });
  }
  domRefs.mockupChips.appendChild(btn3d);

  MOCKUP_SCENES.forEach(s => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'craft-mockup-chip' + (s.key === mockupScene ? ' active' : '');
    btn.dataset.scene = s.key;
    btn.title = s.hint || s.label;
    btn.innerHTML = `<i class="fa-solid ${s.icon}"></i><span>${s.label}</span>`;
    btn.addEventListener('click', () => {
      if (typeof Sound !== 'undefined') Sound.playSound('click');
      if (mockupScene === s.key) return;
      mockupScene = s.key;
      rebuildMockupChips();
      renderMockupScene(); // buildMockupCanvas 为纯函数，切换即重绘
    });
    domRefs.mockupChips.appendChild(btn);
  });
}

/**
 * 将当前场景样机绘制到面板预览 canvas（基于当前结果 canvas 实时合成）
 * 阶段C：mockupScene==='3d' → three.js 查看器（活跃时仅刷新贴图，不重建场景）；
 *        three 加载失败 / 无 form3d → 自动回退 2D 场景
 */
function renderMockupScene() {
  if (!domRefs || !domRefs.mockupCanvas) return;

  if (mockupScene === '3d') {
    const form3d = _currentForm3d();
    if (!form3d) { _fallbackTo2D(true); return; }
    // 已在 3D 模式且场景活跃：品类形态未变 → 只刷贴图（设计稿更新等）；
    // 形态变化（品类切换走了非产品选择器路径）→ 整场景重建（明信片↔冰箱贴模型不同）
    if (Craft3D.isActive()) {
      if (lastForm3d === form3d) { Craft3D.refresh(domRefs.previewCanvas); return; }
      Craft3D.dispose();
    }
    lastForm3d = form3d;
    // P2.1：3D 模式前清空 2D mockup canvas 并隐藏，防止紫色场景背景残留透出
    if (domRefs.mockupCanvas) {
      const mc = domRefs.mockupCanvas;
      mc.style.display = 'none';
      const mctx = mc.getContext('2d');
      if (mctx) mctx.clearRect(0, 0, mc.width, mc.height);
    }
    if (domRefs.three3dView) domRefs.three3dView.hidden = false;
    // 产品 key：自定义模型按 product.key 绑定（craft-products.js 里的唯一标识）
    const _product = getProductByName(currentProductName);
    const _productKey = _product && _product.key;
    // 🎯 查产品 form3d 给 Craft3D 做 FORM_PBR 品类独立材质（书签→金属感、卡牌→纸感）
    const _form3d = (_product?.form3d) || currentCraftType;
    // v11 自定义模型优先：查 cache 看当前品类是否有运营上传的自定义 3D 模型
    //   先检查是否标记过 renderCustom 失败（避免无限重试循环）
    let customModel = null;
    if (!_isCustomModelBlocked(_productKey)) {
      customModel = _productKey && Craft3D.getCachedCustomModel(_productKey);
    }
    if (!customModel) {
      // 非 async 函数：用 .then 回源 IndexedDB，拿到后 async retry renderCustom
      Craft3D.loadCustomModelsCache().then(() => {
        if (_isCustomModelBlocked(_productKey)) {
          // 之前已经 renderCustom 失败过了，直接走程序化 fallback
          _procedural3DFallback(); return;
        }
        const fresh = _productKey && Craft3D.getCachedCustomModel(_productKey);
        if (fresh) {
          Craft3D.renderCustom(domRefs.three3dView, fresh, domRefs.previewCanvas, currentProductName, _form3d, _productKey).catch(err => {
            console.warn('[AI-Craft] 自定义 3D 模型加载失败，回退程序化模板:', err && err.message);
            _markCustomModelFailed(_productKey);
            if (window.showToast) showToast('自定义模型加载失败，已回退通用模板', 'warn');
            _fallbackTo2D(true);
          });
        } else {
          // 回源后仍无绑定，走原程序化 builder
          _procedural3DFallback();
        }
      }).catch(e => console.warn('[AI-Craft] 回源自定义模型失败:', e && e.message));
      return;
    }
    // 有绑定且未被 block：走 renderCustom（复用上面算好的 _form3d 变量）
    Craft3D.renderCustom(domRefs.three3dView, customModel, domRefs.previewCanvas, currentProductName, _form3d, _productKey).catch(err => {
      console.warn('[AI-Craft] 自定义 3D 模型加载失败，回退程序化模板:', err && err.message);
      _markCustomModelFailed(_productKey);
      if (window.showToast) showToast('自定义模型加载失败，已回退通用模板', 'warn');
      _fallbackTo2D(true);
    });
    return;
  }

  // 局部辅助：走原程序化 3D builder（fallback 保证兼容性）
  function _procedural3DFallback() {
    const form3d = _currentForm3d();
    if (!form3d) { _fallbackTo2D(true); return; }
    const _product = getProductByName(currentProductName);
    const _productKey = _product?.key;
    Craft3D.render(domRefs.three3dView, form3d, domRefs.previewCanvas, currentProductName, _productKey).catch(err => {
      console.warn('[AI-Craft] 3D 预览加载失败，回退 2D 场景:', err && err.message);
      if (window.showToast) showToast('3D 预览暂不可用，已回退 2D 场景', 'info');
      _fallbackTo2D(true);
    });
  }

  // 2D 分支：释放 3D 资源并复位舞台
  Craft3D.dispose();
  if (domRefs.three3dView) domRefs.three3dView.hidden = true;
  domRefs.mockupCanvas.style.display = '';

  let mock = null;
  try {
    mock = buildMockupCanvas(domRefs.previewCanvas, mockupScene);
  } catch (err) {
    console.warn('[AI-Craft] 实物场景合成失败:', err && err.message);
  }
  if (!mock || !mock.width) return;
  const canvas = domRefs.mockupCanvas;
  canvas.width = mock.width;
  canvas.height = mock.height;
  canvas.dataset.scene = mockupScene || '';
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(mock, 0, 0);
}

/**
 * 导出当前实物场景图（PNG，1200×900；阶段C：3D 分支同 tick render + toDataURL）
 */
async function exportMockupScene() {
  if (!domRefs || !domRefs.previewCanvas) return;
  if (typeof Sound !== 'undefined') Sound.playSound('click');

  // 阶段C：3D 视图导出（snapshot 内部 render + toDataURL，无需 preserveDrawingBuffer）
  if (mockupScene === '3d' && Craft3D.isActive()) {
    try {
      const dataUrl = Craft3D.snapshot();
      if (!dataUrl || dataUrl.length < 128) throw new Error('empty snapshot');
      const link = document.createElement('a');
      link.download = `dreamcore-3d-${_currentForm3d() || 'preview'}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      if (window.showToast) showToast('3D 场景图已导出', 'success');
    } catch (err) {
      if (window.showToast) showToast('3D 场景图导出失败：' + (err && err.message || '未知错误'), 'error');
    }
    return;
  }

  let url = '';
  try {
    const mock = buildMockupCanvas(domRefs.previewCanvas, mockupScene);
    const blob = await canvasToBlob(mock, 'image/png');
    url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `dreamcore-mockup-${mockupScene}-${Date.now()}.png`;
    link.href = url;
    link.click();
    if (window.showToast) showToast('实物场景图已导出', 'success');
  } catch (err) {
    if (window.showToast) showToast('场景图导出失败：' + (err && err.message || '未知错误'), 'error');
  } finally {
    if (url) setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

// ============================================================
// P3 B3: 演示级一键定制下单（模拟支付状态机 select → loading(1.2s) → success）
// 复用 pricing-page 下单弹窗模式；成功写入 orders 表（v9）供运营看板聚合
// ============================================================

// 尺寸档位（基础价，按 craftType 微调见 TYPE_PRICE_DELTA）
const ORDER_SIZES = [
  { key: 's', label: '小号', price: 29 },
  { key: 'm', label: '中号', price: 49 },
  { key: 'l', label: '大号', price: 69 }
];
// 材质档位
const ORDER_MATERIALS = [
  { key: 'fleece', label: '绒布' },
  { key: 'rice', label: '宣纸' },
  { key: 'acrylic', label: '亚克力' }
];
// 按 craftType 微调价格（壁纸幅面大 +10 / 海报 +5 / 藏品卡 -6 / 明信片 -10 / 模板 +0）
const TYPE_PRICE_DELTA = { wallpaper: 10, poster: 5, card: -6, postcard: -10, template: 0 };

let craftOrderEl = null;    // 下单弹窗 overlay（叠加于工作台之上）
let craftOrderState = null; // { step: select|loading|success, material, size, orderNo, price }

// 当前尺寸实付价（基础价 + craftType 微调，下限 ¥9）
function _orderPrice(sizeKey) {
  const size = ORDER_SIZES.find(s => s.key === sizeKey) || ORDER_SIZES[1];
  return Math.max(9, size.price + (TYPE_PRICE_DELTA[currentCraftType] || 0));
}

// 订单号：DC + 年月日 + 4 位确定性随机（LCG 种子随机，同 craft-mockup.js makeRand 模式）
function _makeOrderNo() {
  let s = ((Number(currentArtworkId) || 0) * 2654435761 + Date.now()) >>> 0 || 1;
  s = (s * 1664525 + 1013904223) >>> 0;
  const rand4 = String(1000 + Math.floor((s / 4294967296) * 9000));
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `DC${ymd}${rand4}`;
}

function _orderSelLabel(list, key) {
  const it = list.find(x => x.key === key);
  return it ? it.label : '';
}

// HTML 属性转义（收货信息回填避免 XSS/引号截断）
function _escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * 一键定制下单：打开模拟支付弹窗（幂等，可重复下单）
 * 落库字段：userId（未登录 'guest'）/ artworkId / craftType / scene / price / status:'paid' / orderNo
 */
function orderCraftMockup() {
  if (!domRefs) return;
  if (craftOrderEl) return;
  if (typeof Sound !== 'undefined') Sound.playSound('click');
  craftOrderState = { step: 'select', material: 'fleece', size: 'm', orderNo: '', price: 0, receiver: '', phone: '', address: '' };
  const ov = document.createElement('div');
  ov.className = 'modal-overlay craft-order-overlay';
  ov.id = 'craft-order-modal';
  ov.innerHTML = '<div class="modal-box cm-order-box"></div>';
  document.body.appendChild(ov);
  craftOrderEl = ov;
  if (window.ModalScrollLock) ModalScrollLock.lock();
  requestAnimationFrame(() => ov.classList.add('open'));
  ov.addEventListener('click', (e) => {
    if (e.target === ov || e.target.closest('[data-close]')) { closeCraftOrderModal(); return; }
    const opt = e.target.closest('.cm-opt');
    if (opt && craftOrderState && craftOrderState.step === 'select') {
      craftOrderState[opt.dataset.group] = opt.dataset.value;
      _renderCraftOrderStep();
    }
    if (e.target.closest('#cm-submit-btn') && craftOrderState && craftOrderState.step === 'select') _submitCraftOrder();
    if (e.target.closest('#cm-done-btn')) closeCraftOrderModal();
  });
  // v11：收货信息输入实时写入状态（点材质/尺寸重绘时保留已填内容）
  ov.addEventListener('input', (e) => {
    const f = e.target.closest('[data-field]');
    if (f && craftOrderState && craftOrderState.step === 'select') {
      craftOrderState[f.dataset.field] = f.value;
    }
  });
  _renderCraftOrderStep();
}

// 三态重绘（select 选材质+尺寸 / loading / success 订单号）
function _renderCraftOrderStep() {
  if (!craftOrderEl || !craftOrderState) return;
  const box = craftOrderEl.querySelector('.cm-order-box');
  if (!box) return;
  const typeDef = CRAFT_TYPES.find(t => t.key === currentCraftType) || CRAFT_TYPES[0];
  const workTitle = craftTitle || (currentArtwork && currentArtwork.title) || '我的文创作品';
  const productLabel = currentProductName || typeDef.label; // T2：AI 推荐产品优先展示
  const head = `
    <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
    <h3 class="cm-order-title">🛍 一键定制下单</h3>
    <p class="cm-order-sub">${productLabel} · ${workTitle} · 将作品变成实物</p>`;
  if (craftOrderState.step === 'select') {
    box.innerHTML = head + `
      <div class="cm-step-select">
        <div class="cm-group-label">材质</div>
        <div class="cm-opts">
          ${ORDER_MATERIALS.map(m => `<button type="button" class="cm-opt${craftOrderState.material === m.key ? ' sel' : ''}" data-group="material" data-value="${m.key}">${m.label}</button>`).join('')}
        </div>
        <div class="cm-group-label">尺寸</div>
        <div class="cm-opts">
          ${ORDER_SIZES.map(s => `<button type="button" class="cm-opt${craftOrderState.size === s.key ? ' sel' : ''}" data-group="size" data-value="${s.key}">${s.label} ¥${_orderPrice(s.key)}</button>`).join('')}
        </div>
        <div class="cm-group-label">收货信息</div>
        <div class="cm-fields">
          <input type="text" class="cm-text-input" data-field="receiver" placeholder="收货人姓名" value="${_escHtml(craftOrderState.receiver)}" autocomplete="off">
          <input type="tel" class="cm-text-input" data-field="phone" placeholder="联系电话" value="${_escHtml(craftOrderState.phone)}" autocomplete="off">
          <input type="text" class="cm-text-input" data-field="address" placeholder="收货地址（省市区 + 详细地址）" value="${_escHtml(craftOrderState.address)}" autocomplete="off">
        </div>
        <p class="cm-order-summary">当前选择：${_orderSelLabel(ORDER_MATERIALS, craftOrderState.material)} · ${_orderSelLabel(ORDER_SIZES, craftOrderState.size)} · 合计 <strong>¥${_orderPrice(craftOrderState.size)}</strong></p>
        <button type="button" class="cm-submit-btn" id="cm-submit-btn"><i class="fa-solid fa-paper-plane"></i> 提交订单</button>
      </div>`;
  } else if (craftOrderState.step === 'loading') {
    box.innerHTML = head + `
      <div class="cm-order-loading"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem;color:#34d399;"></i>
        <p style="margin:12px 0 0;">订单提交中，正在为你预留制作档期…</p></div>`;
  } else if (craftOrderState.step === 'success') {
    box.innerHTML = head + `
      <div class="cm-order-success">
        <span class="cm-ok-icon"><i class="fa-solid fa-check"></i></span>
        <p class="cm-order-no">订单号：${craftOrderState.orderNo}</p>
        <p class="cm-order-summary">${_orderSelLabel(ORDER_MATERIALS, craftOrderState.material)} · ${_orderSelLabel(ORDER_SIZES, craftOrderState.size)} · 合计 ¥${craftOrderState.price} · 预计 7 个工作日发货</p>
        <p class="cm-order-done">演示环境订单，仅存本地 · 物流状态可在「运营看板 → 文创订单」跟踪</p>
        <button type="button" class="cm-submit-btn" id="cm-done-btn" style="margin-top:14px;"><i class="fa-solid fa-circle-check"></i> 完成</button>
      </div>`;
  }
}

// 提交订单：模拟 1.2s 支付延迟 → 成功态 + 写 orders 表（失败静默降级不影响演示）
function _submitCraftOrder() {
  if (!craftOrderState || craftOrderState.step !== 'select') return;
  // v11：读取收货信息并校验非空（读取 DOM 最新值，覆盖状态）
  const readField = (f) => {
    const el = craftOrderEl && craftOrderEl.querySelector(`[data-field="${f}"]`);
    return el ? String(el.value || '').trim() : '';
  };
  const receiver = readField('receiver');
  const phone = readField('phone');
  const address = readField('address');
  if (!receiver || !phone || !address) {
    if (window.showToast) showToast('请填写收货人、联系电话与收货地址', 'warn');
    return;
  }
  craftOrderState.receiver = receiver;
  craftOrderState.phone = phone;
  craftOrderState.address = address;
  craftOrderState.step = 'loading';
  _renderCraftOrderStep();
  setTimeout(async () => {
    if (!craftOrderState || craftOrderState.step !== 'loading') return;
    craftOrderState.step = 'success';
    craftOrderState.orderNo = _makeOrderNo();
    craftOrderState.price = _orderPrice(craftOrderState.size);
    const typeDef = CRAFT_TYPES.find(t => t.key === currentCraftType);
    try {
      await addOrder({
        userId: (window.currentUser && window.currentUser.id) != null ? window.currentUser.id : 'guest',
        artworkId: currentArtworkId,
        craftType: currentCraftType,
        product: currentProductName || (typeDef && typeDef.label) || currentCraftType || '',
        scene: mockupScene,
        price: craftOrderState.price,
        status: 'paid',
        orderNo: craftOrderState.orderNo,
        // v11：规格（材质/尺寸）与收货信息随单落库
        material: _orderSelLabel(ORDER_MATERIALS, craftOrderState.material),
        size: _orderSelLabel(ORDER_SIZES, craftOrderState.size),
        receiver: craftOrderState.receiver,
        phone: craftOrderState.phone,
        address: craftOrderState.address,
        // v10：物流时间线初始 paid 节点（后续 5 态流转见仪表盘订单卡）
        timeline: [{ state: 'paid', ts: new Date().toISOString(), note: '模拟支付成功，订单已进入制作排期' }]
      });
    } catch (err) {
      console.warn('[AI-Craft] 订单落库失败（演示降级）:', err && err.message);
      if (window.showToast) showToast('订单已生成，但本地存储写入失败', 'warn');
    }
    _renderCraftOrderStep();
  }, 1200);
}

// 关闭下单弹窗（closeCraft 离开路由时同步调用）
function closeCraftOrderModal() {
  if (!craftOrderEl) return;
  const el = craftOrderEl;
  craftOrderEl = null;
  craftOrderState = null;
  el.classList.remove('open');
  if (window.ModalScrollLock) ModalScrollLock.unlock();
  if (typeof Sound !== 'undefined') Sound.playSound('close');
  setTimeout(() => el.remove(), 260);
}

/**
 * P0-2 挂载点②：分享海报（当前结果 canvas 直接作主体图）
 * SharePoster 由并行模块异步挂载，未就绪时兜底提示
 */
async function shareCraftPoster() {
  if (!domRefs || !domRefs.previewCanvas) return;
  if (typeof Sound !== 'undefined') Sound.playSound('click');
  if (!window.SharePoster || typeof window.SharePoster.downloadPoster !== 'function') {
    if (window.showToast) showToast('分享海报模块加载中，请稍后再试', 'warn');
    return;
  }
  const typeDef = CRAFT_TYPES.find(t => t.key === currentCraftType) || CRAFT_TYPES[0];
  const user = window.currentUser;
  const title = craftTitle || (currentArtwork && currentArtwork.title) || '未命名作品';
  const author = (user && (user.username || user.displayName))
    || (currentArtwork && currentArtwork.author)
    || 'Dreamcore 创作者';
  // P1 串联：从景区进入时 _scenicMatchHint 仍有值，用它拼景区主题标签
  const styleLabel = CRAFT_STYLES.find(s => s.key === currentStyle)?.label || '';
  const themeTag = _scenicMatchHint
    ? `${_scenicMatchHint.areaName} AI文创 · ${styleLabel}风格`
    : undefined;
  try {
    await window.SharePoster.downloadPoster({
      image: domRefs.previewCanvas,
      title,
      author,
      slogan: craftSubtitle || undefined,
      badge: typeDef.label,
      themeTag,
      footerCta: 'AI 一键生成你的文化文创'
    });
    if (window.showToast) showToast('分享海报已生成并导出', 'success');
  } catch (err) {
    if (window.showToast) showToast('分享海报生成失败：' + (err && err.message || '未知错误'), 'error');
  }
}

// ------------------------------------------------------------
// SubTask 7.6: 入口 openCraft / 出口 closeCraft
// ------------------------------------------------------------

/**
 * 打开 AI 文创衍生品工作台
 * 路由格式：#/craft?artworkId=xxx
 * @param {object} opts - { artworkId: number|string }
 */
async function openCraft(opts = {}) {
  const artworkId = Number(opts.artworkId) || null;
  if (!artworkId) {
    if (window.showToast) showToast('缺少作品参数，无法打开文创工作台', 'warn');
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
  currentArtwork = artwork;

  // 关闭已有灯箱（防止叠加）
  if (window.Gallery && typeof Gallery.closeLightbox === 'function') {
    try { Gallery.closeLightbox(); } catch (_) { /* ignore */ }
  }

  // 如果已挂载，先关闭重建
  if (mounted) closeCraft();

  // 重置选择
  currentCraftType = 'wallpaper';
  // 景区文创预置：style/category 显式传入优先（来自 scenic-recommend 已查好的映射），
  // 未传入时用 scenic  areaId 查「景区文化智能风格匹配引擎」兜底
  const scenicCraft = opts.scenic ? getScenicCraft(opts.scenic) : null;
  currentStyle = opts.style || (scenicCraft && scenicCraft.style) || 'guofeng';
  const scenicArea = opts.scenic ? getAreaById(opts.scenic) : null;
  // 模块级：匹配提示条渲染上下文（openCraft 末尾挂载时消费）
  _scenicMatchHint = scenicArea && scenicCraft
    ? { areaName: scenicArea.name, areaId: opts.scenic, styleKey: scenicCraft.style }
    : null;
  if (opts.category) currentCategoryKey = opts.category;
  // 层1：重置版式状态与静态层缓存
  currentLayoutId = '';
  layoutVariant = 0;
  layoutCache = null;
  // 层2：重置 AI 重绘分镜状态
  repaintScenes = [];
  repaintKey = '';
  repaintRunning = false;
  // 层3：重置 AI 方案扩展字段
  aiPalette = null;
  aiScenePrompts = [];
  // T2：重置落地产品推荐
  currentProductName = '';
  // M6c: 重置灵感状态
  craftTitle = '';
  craftSubtitle = '';
  // 四阶段：重置整图创作状态
  studioImage = null;
  studioDesign = null;
  studioRunning = false;
  studioRegenCount = 0;
  studioLastIdea = '';
  studioTextMode = 'canvas';

  // 构建 DOM
  const wrap = createWorkbench();
  wrap.id = 'ai-craft-workbench';
  wrap.className += ' craft-workbench-mounted';

  // 插入到 body 末尾（覆盖层）
  document.body.appendChild(wrap);

  // 锁定背景滚动
  if (window.ModalScrollLock) window.ModalScrollLock.lock();

  // 渲染景区文化智能匹配提示条（_scenicMatchHint 由上方 scenic 参数解析写入）
  if (_scenicMatchHint) {
    const hint = wrap.querySelector('#craft-scenic-match-hint');
    if (hint) {
      const areaNameEl = hint.querySelector('#craft-scenic-area-name');
      const styleNameEl = hint.querySelector('#craft-scenic-style-name');
      if (areaNameEl) areaNameEl.textContent = _scenicMatchHint.areaName;
      const styleLabel = CRAFT_STYLES.find(s => s.key === _scenicMatchHint.styleKey)?.label || _scenicMatchHint.styleKey;
      if (styleNameEl) styleNameEl.textContent = styleLabel;
      hint.removeAttribute('hidden');
    }
  }

  // 引用缓存
  domRefs = {
    root: wrap,
    previewCanvas: wrap.querySelector('#craft-preview-canvas'),
    canvasLoading: wrap.querySelector('#craft-canvas-loading'),
    artTitle: wrap.querySelector('#craft-art-title'),
    artNo: wrap.querySelector('#craft-art-no'),
    btnDownload: wrap.querySelector('#craft-download'),
    btnSave: wrap.querySelector('#craft-save'),
    btnClose: wrap.querySelector('#craft-close'),
    // P0-1: 实物场景预览 / P0-2 挂载点②: 分享海报
    btnMockup: wrap.querySelector('#craft-mockup-btn'),
    btnPoster: wrap.querySelector('#craft-poster-btn'),
    mockupPanel: wrap.querySelector('#craft-mockup-panel'),
    mockupChips: wrap.querySelector('#craft-mockup-chips'),
    mockupCanvas: wrap.querySelector('#craft-mockup-canvas'),
    three3dView: wrap.querySelector('#craft-3d-view'),
    mockupClose: wrap.querySelector('#craft-mockup-close'),
    mockupExport: wrap.querySelector('#craft-mockup-export'),
    mockupOrder: wrap.querySelector('#craft-mockup-order'),
    typeGrid: wrap.querySelector('#craft-product-grid'),
    categoryChips: wrap.querySelector('#craft-category-chips'),
    pickerCount: wrap.querySelector('#craft-picker-count'),
    styleGrid: wrap.querySelector('#craft-style-grid'),
    layoutGrid: wrap.querySelector('#craft-layout-grid'),
    repaintBtn: wrap.querySelector('#craft-repaint-btn'),
    repaintHint: wrap.querySelector('#craft-repaint-hint'),
    negativeInput: wrap.querySelector('#craft-negative-input'),
    repaintOverlay: wrap.querySelector('#craft-repaint-overlay'),
    repaintProgress: wrap.querySelector('#craft-repaint-progress'),
    versionList: wrap.querySelector('#craft-version-list'),
    versionCount: wrap.querySelector('#craft-version-count'),
    // 四阶段·阶段①②：AI 整图创作（单窗口主入口）
    studioIdea: wrap.querySelector('#craft-studio-idea'),
    studioGen: wrap.querySelector('#craft-studio-generate'),
    studioStatus: wrap.querySelector('#craft-studio-status'),
    studioActions: wrap.querySelector('#craft-studio-actions'),
    studioRegen: wrap.querySelector('#craft-studio-regen'),
    studioSuggestBtn: wrap.querySelector('#craft-studio-suggest-btn'),
    studioSuggestBox: wrap.querySelector('#craft-studio-suggestions'),
    studioFile: wrap.querySelector('#craft-studio-file'),
    studioUploadBtn: wrap.querySelector('#craft-studio-upload-btn'),
    studioResetBtn: wrap.querySelector('#craft-studio-reset-btn'),
    studioImageSlot: wrap.querySelector('#craft-studio-image-slot'),
    studioNegative: wrap.querySelector('#craft-studio-negative'),
    studioTextModes: wrap.querySelectorAll('.craft-textmode-opt'),
    modelBadge: wrap.querySelector('#craft-model-badge'),
    productBadge: wrap.querySelector('#craft-product-badge'),
    titleInput: wrap.querySelector('#craft-title-input'),
    subtitleInput: wrap.querySelector('#craft-subtitle-input'),
    _escHandler: null,
    _resizeHandler: null
  };

  // 设置作品信息
  domRefs.artTitle.textContent = artwork.title || '未命名作品';
  domRefs.artNo.textContent = `#${artwork.id}`;

  // 初始化 Canvas
  canvasCtx = domRefs.previewCanvas.getContext('2d');

  // 构建 UI 控件
  rebuildTypeGrid();
  rebuildStyleGrid();
  rebuildLayoutGrid(); // 层1：版式构图网格

  // 层1规范（坑4）：书法字体就绪后重绘一次（首帧可能用了回退字体）
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { if (mounted) schedulePreviewRender(); }).catch(() => { /* ignore */ });
  }

  // 绑定事件
  bindUIEvents();

  // 加载历史文创
  loadCraftHistory();

  // 加载原图并渲染
  const imgUrl = artwork.imageUrl || (Array.isArray(artwork.images) && artwork.images[0]) || '';
  if (domRefs.canvasLoading) domRefs.canvasLoading.style.display = 'flex';
  try {
    sourceImage = await loadImage(imgUrl);
    if (domRefs.canvasLoading) domRefs.canvasLoading.style.display = 'none';
    renderStudioImageSlot(); // 四阶段：素材图槽首帧 = 作品原图
    schedulePreviewRender();
  } catch (err) {
    if (domRefs.canvasLoading) {
      domRefs.canvasLoading.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> 图片加载失败：${err && err.message || '未知错误'}`;
    }
    // 即使图片失败也渲染背景+文字
    schedulePreviewRender();
  }

  // 入场动画
  requestAnimationFrame(() => {
    wrap.classList.add('craft-workbench--open');
  });

  mounted = true;
}

/**
 * 关闭文创工作台（完整清理资源）
 */
function closeCraft() {
  if (!mounted || !domRefs) return;

  // P3 B3: 同步关闭可能存在的一键下单弹窗（避免悬空 overlay）
  closeCraftOrderModal();

  // 阶段C: 释放 3D 查看器资源（CanvasTexture/WebGL 上下文）
  Craft3D.dispose();

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
  currentArtwork = null;

  // 解锁背景滚动
  if (window.ModalScrollLock) window.ModalScrollLock.unlock();

  // DOM 退场动画 → 移除
  const root = domRefs.root;
  if (root) {
    root.classList.remove('craft-workbench--open');
    root.classList.add('craft-workbench--leaving');
    setTimeout(() => {
      if (root.parentNode) root.remove();
    }, 320);
  }

  // 重置状态
  domRefs = null;
  currentArtworkId = null;
  currentCraftType = 'wallpaper';
  currentStyle = 'guofeng';
  currentLayoutId = '';
  layoutCache = null;
  repaintScenes = [];
  repaintKey = '';
  repaintRunning = false;
  craftTitle = '';
  craftSubtitle = '';
  mockupScene = '';
  lastForm3d = '';
  // 四阶段：清理整图创作状态
  studioImage = null;
  studioDesign = null;
  studioRunning = false;
  studioRegenCount = 0;
  studioLastIdea = '';
  studioTextMode = 'canvas';
  mounted = false;
  _scenicMatchHint = null;
}

/**
 * 从 hash 路由参数解析并打开工作台
 * 支持格式：#/craft?artworkId=5
 */
function openFromHash() {
  const hash = window.location.hash || '';
  const match = hash.match(/^#\/craft(?:\?(.*))?$/);
  if (!match) return false;
  const qs = match[1] || '';
  const params = {};
  qs.split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });
  if (params.artworkId) {
    openCraft({
      artworkId: params.artworkId,
      style: params.style,
      category: params.category,
      scenic: params.scenic
    }).catch(err => {
      console.error('[AI-Craft] openFromHash 失败:', err);
    });
  } else if (window.Gallery && typeof window.Gallery.openArtworkPicker === 'function') {
    // M1-2: 裸路由无 artworkId → 降级为作品选择器
    window.Gallery.openArtworkPicker((id) => {
      openCraft({ artworkId: id }).catch(err => {
        console.error('[AI-Craft] openFromHash 失败:', err);
      });
    }, '选择作品 · AI文创');
  }
  return true;
}

// ------------------------------------------------------------
// 模块导出（ES Module）
// ------------------------------------------------------------
export {
  // 入口/出口
  openCraft,
  closeCraft,
  openFromHash,
  // 常量
  CRAFT_TYPES,
  CRAFT_STYLES,
  // 工具函数
  buildCraftCanvas,
  exportCanvasBase64,
  // 历史管理
  loadCraftHistory,
  saveCraft,
  deleteCraftRecord
};

// ------------------------------------------------------------
// 景区文化智能匹配提示条样式（幂等注入，零外部 css 依赖）
// ------------------------------------------------------------
function _injectScenicHintStyle() {
  if (document.getElementById('craft-scenic-hint-style')) return;
  const style = document.createElement('style');
  style.id = 'craft-scenic-hint-style';
  style.textContent = `
    .craft-scenic-match-hint {
      margin-top: 4px; margin-bottom: 8px; padding: 8px 14px;
      border-radius: 10px; font-size: 12.5px; line-height: 1.5;
      color: #065f46; font-weight: 600;
      background: linear-gradient(135deg, rgba(52,211,153,.16), rgba(156,163,255,.14));
      border: 1px solid rgba(52,211,153,.45);
      display: inline-flex; align-items: center; gap: 8px;
    }
    .craft-scenic-match-hint i { color: #059669; }
    .craft-scenic-match-hint strong { color: #047857; font-weight: 700; }
  `;
  document.head.appendChild(style);
}

// ------------------------------------------------------------
// M6c: 工作台增强控件样式（幂等注入）
// ------------------------------------------------------------
function _injectM6cStyle() {
  if (document.getElementById('craft-m6c-style')) return;
  const style = document.createElement('style');
  style.id = 'craft-m6c-style';
  style.textContent = `
    .craft-idea-box { width:100%; box-sizing:border-box; border-radius:10px; border:1px solid rgba(128,128,128,.25); background:rgba(127,127,127,.08); color:inherit; padding:10px 12px; font-size:13px; line-height:1.5; resize:vertical; min-height:56px; font-family:inherit; }
    .craft-idea-box:focus { outline:none; border-color:#c0392b; }
    .craft-idea-btn { width:100%; margin-top:8px; display:inline-flex; align-items:center; justify-content:center; gap:6px; }
    .craft-idea-hint { margin:8px 0 0; font-size:11px; opacity:.55; line-height:1.5; }
    .craft-model-badge { margin-top:8px; padding:4px 12px; border-radius:999px; font-size:11px; line-height:1.4; background:rgba(127,127,127,.1); border:1px solid rgba(128,128,128,.3); opacity:.85; }
    .craft-model-badge.self-trained { background:linear-gradient(90deg, rgba(0,229,255,.12), rgba(192,57,43,.12)); border-color:rgba(0,150,199,.45); color:#0b7fa6; font-weight:600; }
    .craft-product-badge { margin-top:6px; background:rgba(211,149,11,.1); border-color:rgba(191,121,24,.4); color:#9a6b0b; font-weight:600; }
    .craft-title-input { width:100%; box-sizing:border-box; margin-bottom:8px; border-radius:10px; border:1px solid rgba(128,128,128,.25); background:rgba(127,127,127,.08); color:inherit; padding:9px 12px; font-size:13px; font-family:inherit; }
    .craft-title-input:focus { outline:none; border-color:#c0392b; }
  `;
  document.head.appendChild(style);
}
if (typeof document !== 'undefined' && typeof document.getElementById === 'function') { _injectM6cStyle(); _injectScenicHintStyle(); }

// ------------------------------------------------------------
// P0-1/P0-2: 实物预览面板样式（幂等注入，同 M6c 模式；不碰 css/style.css）
// 设计语言：雾紫粉梦核（--dream-pink/--dream-purple）+ 玻璃质感，文化功能点缀青绿 #34d399
// 三端适配：chips flex-wrap 换行，≤480px 操作按钮纵向铺满
// ------------------------------------------------------------
function _injectMockupStyle() {
  if (document.getElementById('craft-mockup-style')) return;
  const style = document.createElement('style');
  style.id = 'craft-mockup-style';
  style.textContent = `
    .craft-preview-area { position: relative; }
    .craft-mockup-panel { position: absolute; inset: 0; z-index: 30; display: flex; flex-direction: column; gap: 14px; padding: 18px 20px; border-radius: var(--radius); border: 1px solid var(--glass-border); background: var(--glass-bg); backdrop-filter: blur(24px) saturate(160%); -webkit-backdrop-filter: blur(24px) saturate(160%); overflow-x: hidden; overflow-y: auto; animation: craftMockupIn .28s ease; }
    .craft-mockup-panel[hidden] { display: none !important; }
    @keyframes craftMockupIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
    .craft-mockup-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-shrink: 0; }
    .craft-mockup-title { margin: 0; font-size: 16px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
    .craft-mockup-title i { color: var(--dream-purple); }
    .craft-mockup-close { padding: 6px 10px; font-size: 13px; }
    .craft-mockup-chips { display: flex; flex-wrap: wrap; gap: 8px; flex-shrink: 0; }
    .craft-mockup-chip { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 999px; border: 1px solid var(--glass-border); background: var(--bg-surface, rgba(127,127,127,.08)); color: var(--text-secondary, #6b6577); font-size: 13px; font-family: inherit; cursor: pointer; transition: border-color .25s, background .25s, box-shadow .25s, color .25s; }
    .craft-mockup-chip i { font-size: 12px; color: var(--dream-purple); }
    .craft-mockup-chip:hover { border-color: var(--dream-purple); color: var(--text-primary, inherit); }
    .craft-mockup-chip.active { background: linear-gradient(135deg, rgba(255,209,232,.42), rgba(201,182,255,.42)); border-color: var(--dream-purple); color: var(--text-primary, inherit); box-shadow: 0 2px 14px rgba(201,182,255,.4); }
    /* 阶段C: 3D 旋转 chip（青绿点缀 + 无 form3d 置灰态） */
    .craft-mockup-chip-3d i { color: #34d399; }
    .craft-mockup-chip-3d.active { border-color: #34d399; box-shadow: 0 2px 14px rgba(52,211,153,.35); }
    .craft-mockup-chip.disabled, .craft-mockup-chip:disabled { opacity: .42; cursor: not-allowed; }
    .craft-mockup-chip:disabled:hover { border-color: var(--glass-border); color: var(--text-secondary, #6b6577); }
    .craft-mockup-chip:disabled i { color: #9b93ab; }
    .craft-mockup-stage { flex: 1; min-height: 220px; display: flex; align-items: center; justify-content: center; border: 1px dashed var(--glass-border); border-radius: var(--radius-sm); background: rgba(127,127,127,.05); overflow: hidden; }
    #craft-mockup-canvas { display: block; max-width: 100%; max-height: 100%; border-radius: var(--radius-sm); box-shadow: 0 10px 44px rgba(0,0,0,.22); }
    .craft-mockup-actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; flex-shrink: 0; }
    .craft-mockup-actions .btn-primary, .craft-mockup-actions .btn-ghost { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 16px; font-size: 13px; }
    /* P3 B3: 一键定制下单主按钮（青绿 #34d399 填充，全幅视觉主导） */
    .craft-mockup-order { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 10px 18px; font-size: 13px; font-family: inherit; font-weight: 700; cursor: pointer; border-radius: 999px; border: 1.5px solid #34d399; background: linear-gradient(135deg, #34d399, #2bb58a); color: #fff; box-shadow: 0 4px 16px rgba(52,211,153,.35); transition: transform .2s, box-shadow .2s; }
    .craft-mockup-order:hover { transform: translateY(-1px); box-shadow: 0 6px 22px rgba(52,211,153,.5); }
    /* P3 B3: 模拟支付下单弹窗（叠加于工作台 z-index 9000 之上） */
    .craft-order-overlay { z-index: 9500; }
    .cm-order-box { max-width: 420px; width: 92%; max-height: 86vh; overflow-y: auto; padding: 26px 24px;
      border-radius: var(--radius); background: var(--glass-bg); backdrop-filter: blur(28px) saturate(160%);
      box-shadow: 0 30px 80px rgba(0,0,0,.35), 0 0 0 1px var(--glass-border); }
    .cm-order-title { margin: 0 0 4px; font-size: 1.12rem; font-weight: 800; color: var(--text-primary); }
    .cm-order-sub { margin: 0 0 16px; font-size: .8rem; color: var(--text-secondary); }
    .cm-group-label { margin: 12px 0 8px; font-size: .84rem; font-weight: 700; color: var(--text-primary); }
    .cm-opts { display: flex; flex-wrap: wrap; gap: 8px; }
    .cm-opt { padding: 8px 14px; border-radius: 999px; border: 1.5px solid var(--glass-border);
      background: transparent; color: var(--text-secondary); font-size: .82rem; font-family: inherit; cursor: pointer; transition: all .2s; }
    .cm-opt:hover { border-color: #34d399; color: var(--text-primary); }
    .cm-opt.sel { border-color: #34d399; background: rgba(52,211,153,.16); color: var(--text-primary); font-weight: 700; }
    .cm-order-summary { margin: 14px 0 4px; font-size: .8rem; color: var(--text-secondary); }
    .cm-order-summary strong { color: #34d399; }
    .cm-fields { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
    .cm-text-input { width: 100%; box-sizing: border-box; padding: 9px 12px; border-radius: 10px;
      border: 1px solid var(--glass-border); background: rgba(127,127,127,.08); color: var(--text-primary);
      font-size: .84rem; font-family: inherit; }
    .cm-text-input::placeholder { color: var(--text-secondary); opacity: .6; }
    .cm-text-input:focus { outline: none; border-color: #34d399; }
    .cm-submit-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; width: 100%;
      margin-top: 12px; padding: 11px 16px; font-size: .9rem; font-family: inherit; font-weight: 700; color: #fff;
      background: linear-gradient(135deg, #34d399, #2bb58a); border: none; border-radius: 999px; cursor: pointer;
      box-shadow: 0 4px 16px rgba(52,211,153,.35); transition: box-shadow .2s; }
    .cm-submit-btn:hover { box-shadow: 0 6px 22px rgba(52,211,153,.5); }
    .cm-order-loading { text-align: center; padding: 30px 0 22px; font-size: .92rem; color: var(--text-primary); }
    .cm-order-success { text-align: center; padding: 18px 0 6px; }
    .cm-ok-icon { display: inline-flex; align-items: center; justify-content: center; width: 54px; height: 54px;
      border-radius: 50%; font-size: 1.5rem; color: #fff; background: #34d399; box-shadow: 0 6px 20px rgba(52,211,153,.45); }
    .cm-order-no { margin: 14px 0 2px; font-size: 1.14rem; font-weight: 800; color: var(--text-primary); letter-spacing: .5px; }
    .cm-order-done { margin: 4px 0 0; font-size: .76rem; color: var(--text-secondary); opacity: .8; }
    @media (max-width: 960px) {
      .craft-mockup-panel { padding: 14px; gap: 10px; }
      .craft-mockup-stage { min-height: 200px; }
    }
    @media (max-width: 480px) {
      .craft-mockup-chip { padding: 6px 11px; font-size: 12px; }
      .craft-mockup-actions { flex-direction: column; }
      .craft-mockup-actions .btn-primary, .craft-mockup-actions .btn-ghost, .craft-mockup-order { width: 100%; }
    }
  `;
  document.head.appendChild(style);
}
if (typeof document !== 'undefined' && typeof document.getElementById === 'function') _injectMockupStyle();

// ------------------------------------------------------------
// 全局挂载（兼容非模块化旧代码通过 window.AICraft 调用）
// ------------------------------------------------------------
if (typeof window !== 'undefined') {
  window.AICraft = {
    openCraft,
    closeCraft,
    openFromHash,
    orderCraftMockup,
    closeCraftOrderModal,
    CRAFT_TYPES,
    CRAFT_STYLES,
    buildCraftCanvas
  };
}
