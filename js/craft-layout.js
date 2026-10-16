// ============================================================
// js/craft-layout.js — 文创版式引擎（融合改造 层1）
// 依据：.trae/documents/craft-fusion-implementation-plan.md §1
// 职责（纯 Canvas，零 AI 依赖，AI 不可用时完整可用）：
//   1. LAYOUTS 版式定义：分镜槽位（形状/叠压/羽化）+ 文字锚点 + 印章
//   2. buildLayoutCanvas：分镜 clip + 叠压出血（软阴影分层）
//      → 全局调色（主色提取 + 'color' 混合）→ 宣纸纹理（feTurbulence，soft-light）
//      → 径向羽化（destination-in）→ 程序化文字（书法竖排/印章）
//   3. makePaperTexture：feTurbulence 程序生成宣纸纹，离屏缓存一次
// 实现规范（专家知识库 §2，坑1-4/15/16）：
//   - save/restore 与 clip 严格配对；混合模式用毕复位
//   - 纸纹 feTurbulence fractalNoise（octaves≤4）渲染一次进离屏缓存
//   - 撕纸边 = 蒙版边缘噪声位移（种子随机，渲染间稳定）
//   - 导出物理分辨率由调用方保证 ≥2x（ai-craft.renderPreview）
// ============================================================

// ------------------------------------------------------------
// 版式定义（坐标均为画布归一化比例；shape 圆形/扇形自动保持正圆）
// ------------------------------------------------------------

export const LAYOUTS = {
  // 海报·分镜叠压：左书法大字区 + 右主图 + 扇形/圆形分镜叠压出血
  'poster-hero': {
    id: 'poster-hero', label: '分镜叠压', desc: '书法大字 + 扇形分镜叠压', craftTypes: ['poster'], border: true,
    slots: [
      { type: 'main', shape: 'rect', x: 0.27, y: 0.05, w: 0.68, h: 0.56, edge: 'feather' },
      { type: 'scene', shape: 'fan', x: 0.30, y: 0.42, w: 0.36, h: 0.34, edge: 'hard', shadow: true },
      { type: 'scene', shape: 'circle', x: 0.05, y: 0.64, w: 0.30, h: 0.24, edge: 'feather', shadow: true }
    ],
    text: { vertical: true, x: 0.055, y: 0.08, w: 0.20, h: 0.52, size: 0.15 },
    meta: { x: 0.055, y: 0.925, align: 'left' },
    seal: { x: 0.855, y: 0.80 }
  },
  // 海报·对称双图：顶部横排标题 + 左右对称双图 + 中央圆镜出血
  'poster-sym': {
    id: 'poster-sym', label: '对称双图', desc: '左右对称 + 中央圆镜点睛', craftTypes: ['poster'], border: true,
    slots: [
      { type: 'main', shape: 'rect', x: 0.06, y: 0.18, w: 0.42, h: 0.48, edge: 'feather' },
      { type: 'scene', shape: 'rect', x: 0.52, y: 0.18, w: 0.42, h: 0.48, edge: 'feather', focus: [0.62, 0.5], zoom: 1.1 },
      { type: 'scene', shape: 'circle', x: 0.38, y: 0.56, w: 0.24, h: 0.17, edge: 'hard', shadow: true }
    ],
    text: { vertical: false, x: 0.06, y: 0.045, w: 0.88, h: 0.12, size: 0.075, align: 'center' },
    meta: { x: 0.06, y: 0.90, align: 'center' },
    seal: { x: 0.87, y: 0.72 }
  },
  // 明信片·圆窗雅集：右大圆窗 + 左竖排文字 + 小圆叠压
  'postcard-circle': {
    id: 'postcard-circle', label: '圆窗雅集', desc: '大圆窗 + 竖排题字', craftTypes: ['postcard'], border: true,
    slots: [
      { type: 'main', shape: 'circle', x: 0.40, y: 0.06, w: 0.55, h: 0.88, edge: 'feather' },
      { type: 'scene', shape: 'circle', x: 0.26, y: 0.58, w: 0.30, h: 0.44, edge: 'hard', shadow: true }
    ],
    text: { vertical: true, x: 0.05, y: 0.08, w: 0.16, h: 0.56, size: 0.12 },
    meta: { x: 0.05, y: 0.72, align: 'left' },
    seal: { x: 0.05, y: 0.85 }
  },
  // 明信片·撕纸拼贴：上下撕纸条叠压 + 右下文字区
  'postcard-torn': {
    id: 'postcard-torn', label: '撕纸拼贴', desc: '撕纸边缘 + 双条叠压', craftTypes: ['postcard'], border: false,
    slots: [
      { type: 'main', shape: 'torn', x: 0.05, y: 0.05, w: 0.90, h: 0.40, edge: 'hard', shadow: true },
      { type: 'scene', shape: 'torn', x: 0.05, y: 0.50, w: 0.52, h: 0.44, edge: 'hard', shadow: true, focus: [0.6, 0.55], zoom: 1.8 }
    ],
    text: { vertical: false, x: 0.62, y: 0.53, w: 0.33, h: 0.26, size: 0.07, align: 'left' },
    meta: { x: 0.62, y: 0.84, align: 'left' },
    seal: { x: 0.86, y: 0.78 }
  },
  // 藏品卡·上下分层：上主图 + 中分镜出血 + 底部题字
  'card-layered': {
    id: 'card-layered', label: '上下分层', desc: '主图 + 分镜出血 + 题字', craftTypes: ['card'], border: true,
    slots: [
      { type: 'main', shape: 'rect', x: 0.07, y: 0.05, w: 0.86, h: 0.44, edge: 'feather' },
      { type: 'scene', shape: 'rect', x: 0.07, y: 0.46, w: 0.52, h: 0.30, edge: 'hard', shadow: true, focus: [0.68, 0.4], zoom: 1.6 },
      { type: 'scene', shape: 'circle', x: 0.62, y: 0.48, w: 0.30, h: 0.22, edge: 'hard', shadow: true, focus: [0.35, 0.65], zoom: 1.9 }
    ],
    text: { vertical: false, x: 0.07, y: 0.79, w: 0.86, h: 0.10, size: 0.075, align: 'left' },
    meta: { x: 0.07, y: 0.915, align: 'left' },
    seal: { x: 0.85, y: 0.80 }
  },
  // 壁纸·大面留白：右大图 + 左竖排大字 + 小圆点睛
  'wallpaper-min': {
    id: 'wallpaper-min', label: '大面留白', desc: '竖排大字 + 极简留白', craftTypes: ['wallpaper'], border: false,
    slots: [
      { type: 'main', shape: 'rect', x: 0.36, y: 0.08, w: 0.58, h: 0.84, edge: 'feather' },
      { type: 'scene', shape: 'circle', x: 0.30, y: 0.62, w: 0.14, h: 0.28, edge: 'hard', shadow: true, focus: [0.5, 0.75], zoom: 2.0 }
    ],
    text: { vertical: true, x: 0.09, y: 0.10, w: 0.14, h: 0.52, size: 0.11 },
    meta: { x: 0.09, y: 0.78, align: 'left' },
    seal: { x: 0.24, y: 0.82 }
  },

  // ===== T3 版式库扩展（6 → 14，打破模板化；设计语言对标 文创设计参考/ 效果基准）=====

  // 海报·曲水回环：S 形曲线分割（云纹边界）+ 左竖排书法 + 小圆点睛
  'poster-swing': {
    id: 'poster-swing', label: '曲水回环', desc: 'S形曲线分割 + 竖排书法', craftTypes: ['poster'], border: true,
    slots: [
      { type: 'main', shape: 'wave', x: 0.16, y: 0.05, w: 0.79, h: 0.90, edge: 'hard' },
      { type: 'scene', shape: 'circle', x: 0.05, y: 0.62, w: 0.26, h: 0.30, edge: 'feather', shadow: true, focus: [0.4, 0.6], zoom: 1.8 }
    ],
    text: { vertical: true, x: 0.035, y: 0.07, w: 0.13, h: 0.50, size: 0.13 },
    meta: { x: 0.035, y: 0.94, align: 'left' },
    seal: { x: 0.035, y: 0.60 }
  },
  // 海报·画中画：满幅主图 + 横排标题带 + 底部长卷分镜条（博物馆展陈式）
  'poster-frame': {
    id: 'poster-frame', label: '画中画', desc: '满幅主图 + 长卷分镜条', craftTypes: ['poster'], border: true,
    slots: [
      { type: 'main', shape: 'rect', x: 0.05, y: 0.05, w: 0.90, h: 0.50, edge: 'feather' },
      { type: 'scene', shape: 'rect', x: 0.05, y: 0.76, w: 0.58, h: 0.20, edge: 'hard', shadow: true, focus: [0.32, 0.62], zoom: 1.6 },
      { type: 'scene', shape: 'circle', x: 0.68, y: 0.74, w: 0.24, h: 0.24, edge: 'hard', shadow: true, focus: [0.7, 0.4], zoom: 2.0 }
    ],
    text: { vertical: false, x: 0.05, y: 0.60, w: 0.90, h: 0.10, size: 0.075, align: 'left' },
    meta: { x: 0.05, y: 0.975, align: 'left' },
    seal: { x: 0.87, y: 0.615 }
  },
  // 明信片·双重呈现：上全景 + 下特写消融叠压（参考 明信片类_502 效果基准）
  'postcard-duo': {
    id: 'postcard-duo', label: '双重呈现', desc: '全景 + 特写上下呼应', craftTypes: ['postcard'], border: false,
    slots: [
      { type: 'main', shape: 'rect', x: 0.05, y: 0.05, w: 0.90, h: 0.44, edge: 'feather' },
      { type: 'scene', shape: 'rect', x: 0.30, y: 0.46, w: 0.65, h: 0.42, edge: 'feather', focus: [0.6, 0.5], zoom: 2.2 }
    ],
    text: { vertical: true, x: 0.06, y: 0.52, w: 0.14, h: 0.36, size: 0.10 },
    meta: { x: 0.06, y: 0.93, align: 'left' },
    seal: { x: 0.86, y: 0.50 }
  },
  // 藏品卡·拱窗撷景：拱形开窗（博物馆窗洞）+ 小圆陪衬 + 底部题字
  'card-window': {
    id: 'card-window', label: '拱窗撷景', desc: '拱形开窗 + 底部题字', craftTypes: ['card'], border: true,
    slots: [
      { type: 'main', shape: 'arch', x: 0.18, y: 0.06, w: 0.64, h: 0.66, edge: 'hard', shadow: true },
      { type: 'scene', shape: 'circle', x: 0.08, y: 0.55, w: 0.22, h: 0.20, edge: 'feather', shadow: true, focus: [0.35, 0.6], zoom: 2.2 }
    ],
    text: { vertical: false, x: 0.07, y: 0.78, w: 0.86, h: 0.10, size: 0.075, align: 'center' },
    meta: { x: 0.07, y: 0.915, align: 'center' },
    seal: { x: 0.82, y: 0.80 }
  },
  // 藏品卡·四方图谱：2×2 橱窗窗口（参考 藏品卡类_515 民族图谱卡册）
  'card-grid': {
    id: 'card-grid', label: '四方图谱', desc: '2×2 橱窗图谱', craftTypes: ['card'], border: true,
    slots: [
      { type: 'main', shape: 'rect', x: 0.07, y: 0.06, w: 0.40, h: 0.34, edge: 'hard', shadow: true },
      { type: 'scene', shape: 'rect', x: 0.53, y: 0.06, w: 0.40, h: 0.34, edge: 'hard', shadow: true, focus: [0.62, 0.42], zoom: 1.4 },
      { type: 'scene', shape: 'rect', x: 0.07, y: 0.44, w: 0.40, h: 0.34, edge: 'hard', shadow: true, focus: [0.35, 0.65], zoom: 1.8 },
      { type: 'scene', shape: 'rect', x: 0.53, y: 0.44, w: 0.40, h: 0.34, edge: 'hard', shadow: true, focus: [0.7, 0.7], zoom: 2.2 }
    ],
    text: { vertical: false, x: 0.07, y: 0.82, w: 0.86, h: 0.09, size: 0.07, align: 'center' },
    meta: { x: 0.07, y: 0.94, align: 'center' },
    seal: { x: 0.87, y: 0.84 }
  },
  // 壁纸·通幅出血：满幅画面 + 暗角消融 + 角落竖排题字
  'wallpaper-bleed': {
    id: 'wallpaper-bleed', label: '通幅出血', desc: '满幅画面 + 角落题字', craftTypes: ['wallpaper'], border: false,
    slots: [
      { type: 'main', shape: 'rect', x: 0.0, y: 0.0, w: 1.0, h: 1.0, edge: 'feather' },
      { type: 'scene', shape: 'circle', x: 0.76, y: 0.12, w: 0.20, h: 0.34, edge: 'hard', shadow: true, focus: [0.6, 0.4], zoom: 2.2 }
    ],
    text: { vertical: true, x: 0.05, y: 0.55, w: 0.12, h: 0.38, size: 0.10 },
    meta: { x: 0.05, y: 0.95, align: 'left' },
    seal: { x: 0.20, y: 0.88 }
  },
  // 模板·圆心聚焦：中心圆窗 + 环形留白（社交分享主图式）
  'template-center': {
    id: 'template-center', label: '圆心聚焦', desc: '中心圆窗 + 环形留白', craftTypes: ['template'], border: true,
    slots: [
      { type: 'main', shape: 'circle', x: 0.17, y: 0.10, w: 0.66, h: 0.66, edge: 'hard', shadow: true },
      { type: 'scene', shape: 'circle', x: 0.38, y: 0.62, w: 0.24, h: 0.24, edge: 'hard', shadow: true, focus: [0.5, 0.72], zoom: 2.4 }
    ],
    text: { vertical: false, x: 0.08, y: 0.80, w: 0.84, h: 0.09, size: 0.075, align: 'center' },
    meta: { x: 0.08, y: 0.92, align: 'center' },
    seal: { x: 0.85, y: 0.14 }
  },
  // 模板·拼贴格子：三格错落拼贴 + 底部题字（杂志版式感）
  'template-mosaic': {
    id: 'template-mosaic', label: '拼贴格子', desc: '三格拼贴 + 题字条', craftTypes: ['template'], border: false,
    slots: [
      { type: 'main', shape: 'rect', x: 0.05, y: 0.05, w: 0.60, h: 0.44, edge: 'hard', shadow: true },
      { type: 'scene', shape: 'rect', x: 0.70, y: 0.05, w: 0.25, h: 0.44, edge: 'hard', shadow: true, focus: [0.65, 0.45], zoom: 1.6 },
      { type: 'scene', shape: 'rect', x: 0.05, y: 0.54, w: 0.90, h: 0.30, edge: 'hard', shadow: true, focus: [0.4, 0.62], zoom: 1.9 }
    ],
    text: { vertical: false, x: 0.05, y: 0.88, w: 0.72, h: 0.08, size: 0.07, align: 'left' },
    meta: { x: 0.05, y: 0.965, align: 'left' },
    seal: { x: 0.88, y: 0.88 }
  }
};

/** 无 AI 分镜图时，scene 槽位从原图取景的焦点/变焦变体（确定性，渲染间稳定） */
const SCENE_FOCUS = [[0.32, 0.34], [0.68, 0.42], [0.5, 0.7], [0.72, 0.28], [0.3, 0.68]];
const SCENE_ZOOM = 1.7;

/** 书法字体栈（楷书优先，Windows/WinUI 均有映射） */
const KAI_FONT = `"KaiTi","STKaiti","DFKai-SB","Noto Serif SC","SimSun",serif`;

/** 层3 前向兼容：常见传统色名 → hex（palette 数组传入时使用） */
const NAMED_COLORS = {
  '靛蓝': '#2c5f8a', '米白': '#f5f0e6', '赭石': '#a0522d', '朱砂': '#c0392b', '黛青': '#425066',
  '绛红': '#8c2f39', '竹青': '#6b8e5a', '月白': '#eaf0f0', '赭黄': '#d4a017', '石绿': '#4a7c6f',
  '藤黄': '#e6b422', '水墨': '#2b2b2b'
};

/**
 * 取适配某文创类型的版式列表
 * @param {string} craftType - CRAFT_TYPES key
 * @returns {object[]} LAYOUTS 值数组
 */
export function getLayoutsForType(craftType) {
  return Object.values(LAYOUTS).filter(l => l.craftTypes.includes(craftType));
}

// ------------------------------------------------------------
// T3 版式变体：同一版式按（种子 + 档位）确定性抖动构图，打破模板化
// ------------------------------------------------------------

/** 字符串 → uint32 哈希（djb2，与项目用户名哈希同源思路） */
function hashString(str) {
  let h = 5381;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

/**
 * 生成版式变体：槽位 x/y ±15%、w/h ±9% 确定性偏移，文字锚点微移
 * （同种子同档位结果稳定 → 渲染间不抖动；不同 idea/作品 → 构图差异化）
 * @param {object} layout - LAYOUTS 条目
 * @param {number} variant - 变体档位 0-3（0 = 原版，直接返回）
 * @param {string|number} seed - 确定性种子（作品ID + idea）
 * @returns {object} 变体版式（深拷贝，不污染 LAYOUTS 原定义）
 */
export function makeLayoutVariant(layout, variant, seed) {
  if (!layout || !variant) return layout;
  const rnd = mulberry32((hashString(seed) + Number(variant) * 7919) >>> 0);
  const v = JSON.parse(JSON.stringify(layout));
  v.slots.forEach(s => {
    const dw = (rnd() - 0.5) * 0.30; // ±15%
    const dh = (rnd() - 0.5) * 0.30;
    const sw = 1 + (rnd() - 0.5) * 0.18; // ±9%
    const sh = 1 + (rnd() - 0.5) * 0.18;
    s.w = clamp(s.w * sw, 0.08, 1 - Math.max(0, s.x + dw));
    s.h = clamp(s.h * sh, 0.08, 1 - Math.max(0, s.y + dh));
    s.x = clamp(s.x + dw, 0.02, Math.max(0.02, 1 - s.w));
    s.y = clamp(s.y + dh, 0.02, Math.max(0.02, 1 - s.h));
  });
  if (v.text) v.text.x = clamp(v.text.x + (rnd() - 0.5) * 0.06, 0.02, 0.9);
  if (v.seal) { v.seal.x = clamp(v.seal.x + (rnd() - 0.5) * 0.08, 0.02, 0.95); v.seal.y = clamp(v.seal.y + (rnd() - 0.5) * 0.08, 0.02, 0.95); }
  return v;
}

// ------------------------------------------------------------
// 工具函数
// ------------------------------------------------------------

/** 确定性伪随机（撕纸边抖动用，保证每次渲染形状一致） */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbLum([r, g, b]) { return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }

// ------------------------------------------------------------
// 宣纸纹理（feTurbulence 程序生成，离屏缓存一次；坑15）
// ------------------------------------------------------------

const PAPER_TEX_SIZE = 256;
let _paperTexCanvas = null;
let _paperWarming = null;

/** feTurbulence SVG data URL：灰阶噪点（rgb 锁 0.5 中灰 + alpha 随机，soft-light 下呈宣纸颗粒） */
function makePaperSVG() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAPER_TEX_SIZE}" height="${PAPER_TEX_SIZE}">`
    + `<filter id="p" x="0" y="0" width="100%" height="100%">`
    + `<feTurbulence type="fractalNoise" baseFrequency="0.085" numOctaves="4" stitchTiles="stitch" seed="23"/>`
    + `<feColorMatrix type="matrix" values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0.9 0 0 0 0"/>`
    + `</filter><rect width="100%" height="100%" filter="url(#p)"/></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** 同步兜底：双倍频值噪声（模块导入即预热 feTurbulence，此处仅在竞态时短暂使用） */
function makeJsNoise(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const id = x.createImageData(size, size);
  const rnd = mulberry32(20260923);
  const cg = 8;
  const coarse = [];
  for (let i = 0; i < cg; i++) { coarse[i] = []; for (let j = 0; j < cg; j++) coarse[i][j] = rnd(); }
  const sample = (u, v) => { // 双线性插值 + 环回（保证可平铺）
    const i0 = Math.floor(u) % cg, j0 = Math.floor(v) % cg;
    const i1 = (i0 + 1) % cg, j1 = (j0 + 1) % cg;
    const fu = u - Math.floor(u), fv = v - Math.floor(v);
    const a = coarse[i0][j0] * (1 - fu) + coarse[i1][j0] * fu;
    const b = coarse[i0][j1] * (1 - fu) + coarse[i1][j1] * fu;
    return a * (1 - fv) + b * fv;
  };
  const d = id.data;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const big = sample(px / size * cg, py / size * cg);
      const v = 128 + (big - 0.5) * 44 + (rnd() - 0.5) * 28;
      const o = (py * size + px) * 4;
      d[o] = d[o + 1] = d[o + 2] = v; d[o + 3] = 255;
    }
  }
  x.putImageData(id, 0, 0);
  return c;
}

/** 异步预热宣纸纹（feTurbulence 优先，失败用 JS 噪声兜底） */
export function makePaperTexture() {
  if (_paperWarming) return _paperWarming;
  _paperWarming = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = PAPER_TEX_SIZE;
        c.getContext('2d').drawImage(img, 0, 0);
        _paperTexCanvas = c;
      } catch (_) { /* 保底 */ }
      resolve(_paperTexCanvas);
    };
    img.onerror = () => { resolve(_paperTexCanvas); };
    img.src = makePaperSVG();
  }).catch(() => _paperTexCanvas);
  // 立即给同步兜底，Promise 就绪后自动替换
  if (!_paperTexCanvas) _paperTexCanvas = makeJsNoise(PAPER_TEX_SIZE);
  return _paperWarming;
}

/** 渲染时同步取纸纹缓存（预热通常在首帧前完成） */
function getPaperTextureSync() {
  if (!_paperTexCanvas) _paperTexCanvas = makeJsNoise(PAPER_TEX_SIZE);
  return _paperTexCanvas;
}

// 模块加载即预热（浏览器环境）
if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
  makePaperTexture();
}

// ------------------------------------------------------------
// 调色板解析（全局调色：主色提取 + 风格色 + 层3 色名兼容）
// ------------------------------------------------------------

/** 缩图取像素众数桶，提取主色（跨域图已带 crossOrigin，getImageData 异常时回退风格色） */
function extractDominant(img) {
  const s = 24;
  const c = document.createElement('canvas');
  c.width = s; c.height = s;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, s, s);
  const d = x.getImageData(0, 0, s, s).data;
  const buckets = new Map();
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const key = ((r >> 5) << 10) | ((g >> 5) << 5) | (b >> 5);
    const bk = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 };
    bk.n++; bk.r += r; bk.g += g; bk.b += b;
    buckets.set(key, bk);
  }
  let best = null;
  buckets.forEach(bk => { if (!best || bk.n > best.n) best = bk; });
  if (!best) return null;
  return [Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)];
}

/**
 * 解析调色板：paper 纸底色 / ink 墨色 / accent 强调色 / dominant 主色 / dark 深底标记
 * @param {string[]|null} palette - 层3 传统色名数组（可选）
 * @param {object} plan - { styleDef?:{accent,bg,dark,label} }
 * @param {HTMLImageElement} baseImage
 */
function resolvePalette(palette, plan, baseImage) {
  const styleDef = (plan && plan.styleDef) || {};
  let dominant = null;
  try { if (baseImage) dominant = extractDominant(baseImage); } catch (_) { /* 跨域污染时回退 */ }
  if (!dominant) dominant = hexToRgb(styleDef.accent) || [138, 111, 77];

  let paper = styleDef.bg || '#f5f0e6';
  let accent = styleDef.accent || '#c0392b';
  // 层3 色名数组：[主色, 底色, 点缀] 惯例
  if (Array.isArray(palette) && palette.length) {
    const c0 = NAMED_COLORS[palette[0]] ? hexToRgb(NAMED_COLORS[palette[0]]) : hexToRgb(palette[0]);
    const c1 = palette[1] && NAMED_COLORS[palette[1]] ? NAMED_COLORS[palette[1]] : (palette[1] || null);
    if (c0) accent = NAMED_COLORS[palette[0]] || palette[0];
    if (c1) paper = c1;
  }

  const dark = !!styleDef.dark || rgbLum(hexToRgb(paper) || [245, 240, 230]) < 0.35;
  // 墨色随主色调加深 → 文字与画面同一色系（"分层但像一张纸"的关键）
  const ink = dark
    ? '#f2efe6'
    : `rgb(${Math.round(dominant[0] * 0.30)},${Math.round(dominant[1] * 0.30)},${Math.round(dominant[2] * 0.30)})`;
  return { paper, ink, accent, dominant, dark };
}

// ------------------------------------------------------------
// 槽位渲染（clip 严格配对 + 羽化 destination-in + 软阴影叠压）
// ------------------------------------------------------------

/** 构造形状路径（在槽位层局部坐标系内） */
function buildShapePath(x, shape, w, h, seed) {
  x.beginPath();
  if (shape === 'circle') {
    x.arc(w / 2, h / 2, Math.min(w, h) / 2 * 0.985, 0, Math.PI * 2);
  } else if (shape === 'fan') {
    // 折扇：底心为轴，向上张开约 144°
    const cx = w / 2, cy = h * 0.99;
    const r = Math.min(w, h) * 0.98;
    x.moveTo(cx, cy);
    x.arc(cx, cy, r, Math.PI * 1.08, Math.PI * 1.92);
    x.closePath();
  } else if (shape === 'torn') {
    // 撕纸边：矩形四边逐段噪声位移（种子确定 → 形状稳定）
    const rnd = mulberry32(seed);
    const jag = Math.min(w, h) * 0.022;
    const step = Math.max(12, Math.min(w, h) * 0.08);
    const edge = (x0, y0, x1, y1) => {
      const len = Math.hypot(x1 - x0, y1 - y0);
      // 步长逐边随机化，避免撕裂纹理周期性重复
      const n = Math.max(1, Math.ceil(len / (step * (0.75 + rnd() * 0.5))));
      const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
      const pts = [];
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const off = (rnd() - 0.5) * 2 * jag * (i < n ? 1 : 0.3); // 角点抖动减半避免开叉
        pts.push([x0 + (x1 - x0) * t + nx * off, y0 + (y1 - y0) * t + ny * off]);
      }
      return pts;
    };
    const pts = [
      ...edge(0, 0, w, 0), ...edge(w, 0, w, h),
      ...edge(w, h, 0, h), ...edge(0, h, 0, 0)
    ];
    x.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
    x.closePath();
  } else if (shape === 'arch') {
    // T3 拱形开窗：下半矩形 + 顶部半圆拱（博物馆窗洞 / 异形开窗边框）
    const aw = Math.min(w, h * 0.72); // 拱身总高 = 拱半径×2 + 矩形身，宽不超过总高的 72%
    const r = aw / 2;
    const left = (w - aw) / 2;
    x.moveTo(left, h);
    x.lineTo(left, r);
    x.arc(left + r, r, r, Math.PI, Math.PI * 2);
    x.lineTo(left + aw, h);
    x.closePath();
  } else if (shape === 'wave') {
    // T3 S 形曲线边界：左缘双贝塞尔内凹外凸（云纹曲线分割，参考 海报类_275）
    x.moveTo(0, 0);
    x.lineTo(w, 0);
    x.lineTo(w, h);
    x.lineTo(0, h);
    x.bezierCurveTo(w * 0.40, h * 0.82, -w * 0.12, h * 0.58, w * 0.16, h * 0.40);
    x.bezierCurveTo(w * 0.36, h * 0.26, -w * 0.06, h * 0.12, 0, 0);
    x.closePath();
  } else {
    // rect：微圆角直角矩形
    const r = Math.min(w, h) * 0.02;
    x.moveTo(r, 0);
    x.arcTo(w, 0, w, h, r);
    x.arcTo(w, h, 0, h, r);
    x.arcTo(0, h, 0, 0, r);
    x.arcTo(0, 0, w, 0, r);
    x.closePath();
  }
}

/** 按焦点/变焦取源图区域 cover 填充目标矩形 */
function drawImageCoverFocus(x, img, dx, dy, dw, dh, focus = [0.5, 0.5], zoom = 1) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  let cw = iw / zoom, ch = ih / zoom;
  const dr = dw / dh;
  if (cw / ch > dr) cw = ch * dr; else ch = cw / dr;
  const sx = clamp(focus[0] * iw - cw / 2, 0, iw - cw);
  const sy = clamp(focus[1] * ih - ch / 2, 0, ih - ch);
  x.drawImage(img, sx, sy, cw, ch, dx, dy, dw, dh);
}

/** 径向羽化：radialGradient 蒙版 + destination-in（坑：蒙版只作用于本层内容）
 *  圆形沿圆轮廓宽羽化；矩形/扇形用对角线半径的柔和过渡 */
function applyFeather(x, w, h, shape) {
  const cx = w / 2, cy = h / 2;
  let g;
  if (shape === 'circle') {
    const r = Math.min(w, h) / 2 * 0.985;
    g = x.createRadialGradient(cx, cy, r * 0.45, cx, cy, r * 1.15);
  } else {
    const r = Math.hypot(w, h) / 2;
    g = x.createRadialGradient(cx, cy, r * 0.55, cx, cy, r * 0.98);
  }
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.save();
  x.globalCompositeOperation = 'destination-in';
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  x.restore();
}

/** hex 颜色 + 透明度 → rgba() 字符串（非 hex 输入回退米白） */
function withAlpha(hex, a) {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(245,240,230,${a})`;
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;
}

/** 渲染单个槽位到离屏层（clip + 内容 + 羽化 + T4 渐变蒙版） */
function renderSlotLayer(img, slot, pw, ph, focus, zoom, seed, pal) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(pw); c.height = Math.ceil(ph);
  const x = c.getContext('2d');
  x.save();
  buildShapePath(x, slot.shape, c.width, c.height, seed);
  x.clip();
  drawImageCoverFocus(x, img, 0, 0, c.width, c.height, focus, zoom);
  // T4 渐变蒙版：硬边槽位四边向内 ~7% 宽的纸色渐变消融，缓解"剪贴感"
  if (slot.edge !== 'feather' && pal) {
    const bw = Math.min(c.width, c.height) * 0.07;
    const edges = [
      [0, 0, 0, bw, 0, 0, 0, 1, 0],        // 上
      [0, c.height, 0, c.height - bw, 0, c.height, 0, 1, c.height], // 下
      [0, 0, bw, 0, 0, 0, 1, 0, 0],        // 左
      [c.width, 0, c.width - bw, 0, c.width, 0, c.width, 1, c.height] // 右
    ];
    for (const [gx0, gy0, gx1, gy1, rx0, ry0, rx1, ry1] of edges) {
      const g = x.createLinearGradient(gx0, gy0, gx1, gy1);
      g.addColorStop(0, withAlpha(pal.paper, 0.38));
      g.addColorStop(1, withAlpha(pal.paper, 0));
      x.fillStyle = g;
      x.fillRect(rx0, ry0, rx1, ry1);
    }
  }
  x.restore();
  if (slot.edge === 'feather') applyFeather(x, c.width, c.height, slot.shape);
  return c;
}

/** 将槽位层带软阴影合成到主画布（阴影跟随羽化轮廓 → 分镜叠压层次自然）
 *  T4 接触阴影：紧贴暗影 + 宽幅环境影双层叠压，"放在纸上"而非"贴在纸上" */
function drawSlot(ctx, img, slot, W, H, slotIndex, pal) {
  if (!img || !(img.naturalWidth || img.width)) return;
  const px = slot.x * W, py = slot.y * H;
  const pw = slot.w * W, ph = slot.h * H;
  if (pw < 8 || ph < 8) return;
  const focus = slot.focus || (slot.type === 'main' ? [0.5, 0.42] : SCENE_FOCUS[(slotIndex + SCENE_FOCUS.length) % SCENE_FOCUS.length]);
  const zoom = slot.zoom || (slot.type === 'main' ? 1.06 : SCENE_ZOOM);
  const layer = renderSlotLayer(img, slot, pw, ph, focus, zoom, 1000 + slotIndex * 97, pal);
  ctx.save();
  if (slot.shadow !== false) {
    // 第一层：紧贴接触影（清晰、深）
    ctx.shadowColor = 'rgba(40, 28, 16, 0.30)';
    ctx.shadowBlur = Math.min(pw, ph) * 0.05;
    ctx.shadowOffsetY = Math.min(pw, ph) * 0.018;
    ctx.drawImage(layer, px, py);
    // 第二层：宽幅环境影（弥散、浅）
    ctx.shadowColor = 'rgba(40, 28, 16, 0.16)';
    ctx.shadowBlur = Math.min(pw, ph) * 0.16;
    ctx.shadowOffsetY = Math.min(pw, ph) * 0.05;
  }
  ctx.drawImage(layer, px, py);
  ctx.restore();
}

// ------------------------------------------------------------
// 文字排版（书法竖排/横排 + 署名 + 印章）
// ------------------------------------------------------------

/** 印章：2 字竖排小方印（作者首字 + '印'），微旋转拟手钤 */
function drawSeal(ctx, plan, x, y, minDim, pal) {
  const s = minDim * 0.075;
  const author = (plan.author || '').replace(/\s/g, '');
  const chars = [author ? author[0] : '梦', '印'];
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.05);
  ctx.fillStyle = '#b03a2e';
  ctx.beginPath();
  const r = s * 0.10;
  ctx.moveTo(r, 0);
  ctx.arcTo(s, 0, s, s, r);
  ctx.arcTo(s, s, 0, s, r);
  ctx.arcTo(0, s, 0, 0, r);
  ctx.arcTo(0, 0, s, 0, r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f7f2e8';
  ctx.font = `700 ${Math.round(s * 0.38)}px ${KAI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(chars[0], s / 2, s * 0.27);
  ctx.fillText(chars[1], s / 2, s * 0.73);
  ctx.restore();
}

/** 按最大宽度换行（横排标题用，中英混排） */
function wrapByMeasure(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const ch of String(text)) {
    if (line && ctx.measureText(line + ch).width > maxWidth) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** 程序化文字块：书法标题（竖排逐字/横排换行）+ 竖排副标题列 + 署名 + 印章 */
function drawTextBlock(ctx, plan, layout, W, H, pal) {
  const t = layout.text;
  const title = String(plan.title || '未命名作品');
  const subtitle = String(plan.subtitle || '');
  const meta = [plan.author, plan.styleLabel].filter(Boolean).join(' · ');
  const minDim = Math.min(W, H);
  ctx.save();
  ctx.fillStyle = pal.ink;

  if (t.vertical) {
    // 竖排书法大字：逐字下排，字号自适应区域高度
    const rx = t.x * W, ry = t.y * H, rw = t.w * W, rh = t.h * H;
    const chars = [...title].slice(0, 12);
    let size = t.size * minDim;
    size = Math.min(size, rh / (chars.length * 1.12));
    size = Math.max(16, size);
    ctx.font = `600 ${Math.round(size)}px ${KAI_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const cx = rx + Math.min(rw, size) / 2;
    chars.forEach((ch, i) => ctx.fillText(ch, cx, ry + i * size * 1.12));
    if (subtitle) {
      // 副标题：标题右侧竖排小字列（对联式）
      const ss = Math.max(12, size * 0.30);
      ctx.font = `400 ${Math.round(ss)}px ${KAI_FONT}`;
      const sx = Math.min(cx + size * 1.06, rx + rw);
      const subChars = [...subtitle].slice(0, Math.max(2, Math.floor(rh / (ss * 1.3))));
      subChars.forEach((ch, i) => ctx.fillText(ch, sx, ry + 6 + i * ss * 1.3));
    }
  } else {
    // 横排标题：区域宽内换行，最多 2 行，超出缩小字号
    const rx = t.x * W, ry = t.y * H, rw = t.w * W, rh = t.h * H;
    const align = t.align || 'left';
    let size = t.size * minDim;
    ctx.font = `600 ${Math.round(size)}px ${KAI_FONT}`;
    let lines = wrapByMeasure(ctx, title, rw);
    if (lines.length > 2) {
      size = Math.max(14, size * 2 / lines.length);
      ctx.font = `600 ${Math.round(size)}px ${KAI_FONT}`;
      lines = wrapByMeasure(ctx, title, rw).slice(0, 2);
    }
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    const tx = align === 'center' ? rx + rw / 2 : rx;
    let ly = ry;
    lines.forEach(line => {
      ctx.fillText(line, tx, ly);
      ly += size * 1.22;
    });
    if (subtitle) {
      ctx.font = `400 ${Math.max(11, Math.round(size * 0.36))}px ${KAI_FONT}`;
      const subLines = wrapByMeasure(ctx, subtitle, rw).slice(0, 2);
      subLines.forEach(line => {
        ctx.fillText(line, tx, ly + size * 0.1);
        ly += Math.max(11, size * 0.36) * 1.3;
      });
    }
  }

  // 署名（作者 · 风格）
  if (meta && layout.meta) {
    const m = layout.meta;
    ctx.font = `${Math.max(10, Math.round(minDim * 0.024))}px sans-serif`;
    ctx.globalAlpha = 0.72;
    ctx.textAlign = m.align || 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(meta, m.align === 'center' ? W / 2 : m.x * W, m.y * H);
    ctx.globalAlpha = 1;
  }

  // 印章
  if (layout.seal) {
    drawSeal(ctx, plan, layout.seal.x * W, layout.seal.y * H, minDim, pal);
  }
  ctx.restore();
}

// ------------------------------------------------------------
// 底图与边框
// ------------------------------------------------------------

/** 纸底：底色平涂 + 边缘暗角（纸张氛围） */
function paintPaperBase(ctx, W, H, pal) {
  ctx.fillStyle = pal.paper;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) / 2);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, pal.dark ? 'rgba(0,0,0,0.38)' : 'rgba(58, 38, 18, 0.10)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** 细双线边框（外粗内细，传统裱边感） */
function drawFrame(ctx, W, H, pal) {
  const minDim = Math.min(W, H);
  const m = minDim * 0.030;
  ctx.save();
  ctx.strokeStyle = pal.dark ? 'rgba(240,235,225,0.5)' : pal.ink;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = Math.max(1.2, minDim * 0.0035);
  ctx.strokeRect(m, m, W - m * 2, H - m * 2);
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = Math.max(0.8, minDim * 0.0015);
  const m2 = m * 1.7;
  ctx.strokeRect(m2, m2, W - m2 * 2, H - m2 * 2);
  ctx.restore();
}

// ------------------------------------------------------------
// 主入口：buildLayoutCanvas
// ------------------------------------------------------------

/**
 * 版式引擎主入口：按版式定义合成离屏画布
 * @param {object} opts
 * @param {HTMLImageElement} opts.baseImage - 底图（用户作品照片）
 * @param {HTMLImageElement[]} [opts.scenes] - 分镜图（层2 AI 产物；空数组时从底图变焦取景）
 * @param {string} opts.layoutId - LAYOUTS key
 * @param {string[]|null} [opts.palette] - 传统色名数组（层3 前向兼容）
 * @param {object} [opts.plan] - { title, subtitle, author, styleLabel, styleDef }
 * @param {number} [opts.width] - 目标画布物理宽（px）
 * @param {number} [opts.height] - 目标画布物理高（px）
 * @param {number} [opts.variant] - T3 版式变体档位 0-3（默认 0 原版）
 * @param {string|number} [opts.variantSeed] - T3 变体种子（作品ID + idea）
 * @returns {HTMLCanvasElement|null} 离屏画布；版式不存在返回 null
 */
export function buildLayoutCanvas({ baseImage, scenes = [], layoutId, palette = null, plan = {}, width = 800, height = 600, variant = 0, variantSeed = '' } = {}) {
  const base = LAYOUTS[layoutId];
  if (!base) return null;
  const layout = makeLayoutVariant(base, variant, variantSeed);
  const W = Math.max(64, Math.round(width));
  const H = Math.max(64, Math.round(height));
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d');
  const pal = resolvePalette(palette, plan, baseImage);

  // 1. 纸底
  paintPaperBase(ctx, W, H, pal);

  // 2. 分镜槽位（顺序绘制 → 后画叠压先画，软阴影分层出血）
  const pool = [baseImage, ...scenes].filter(im => im && (im.naturalWidth || im.width));
  if (pool.length) {
    layout.slots.forEach((slot, i) => {
      drawSlot(ctx, pool[i % pool.length], slot, W, H, i, pal);
    });
    // T4 色彩呼应：主槽位中心向外的强调色软光，把分镜与纸底"缝"进同一色域
    const ms = layout.slots[0];
    const cx = (ms.x + ms.w / 2) * W, cy = (ms.y + ms.h / 2) * H;
    const rr = Math.max(ms.w * W, ms.h * H) * 0.9;
    const ac = hexToRgb(pal.accent) || pal.dominant;
    const eg = ctx.createRadialGradient(cx, cy, rr * 0.25, cx, cy, rr);
    eg.addColorStop(0, `rgba(${ac[0]},${ac[1]},${ac[2]},0.12)`);
    eg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = eg;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // 3. 全局调色：主色 'color' 混合统一色系（多次分镜"像一张纸"的关键）
  ctx.save();
  ctx.globalCompositeOperation = 'color';
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = `rgb(${pal.dominant[0]},${pal.dominant[1]},${pal.dominant[2]})`;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // 4. 宣纸纹理：soft-light 平铺一次（T4 按风格区分强度——水墨/敦煌重肌理，霓虹/极简轻肌理）
  const TEX_ALPHA = { ink: 0.22, dunhuang: 0.20, feiyi: 0.18, guofeng: 0.16, qinghua: 0.14, festive: 0.12, minimal: 0.08, neon: 0.05 };
  const texAlpha = TEX_ALPHA[(plan.styleDef && plan.styleDef.key) || ''] != null ? TEX_ALPHA[plan.styleDef.key] : 0.16;
  const pat = ctx.createPattern(getPaperTextureSync(), 'repeat');
  if (pat) {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = texAlpha;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // 5. 裱边细框（版式可选）
  if (layout.border) drawFrame(ctx, W, H, pal);

  // 6. 程序化文字 + 印章
  drawTextBlock(ctx, plan, layout, W, H, pal);

  return out;
}
