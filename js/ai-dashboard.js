// ============================================================
// js/ai-dashboard.js — M7 数据可视化看板
// 纯原生 Canvas 2D 绘制，无第三方图表库
// 提供 4 个图表：作品分类饼图 / AI评分柱状图 / 文创趋势折线图 / 策展统计环形图
// 入口：window.AIDashboard.renderPanel(content) 由 Admin Tab 调用
// ============================================================

import { runRequest, getAllArtworks, getAllUsers, getAllOrders } from './db.js';

// ------------------------------------------------------------
// 常量定义
// ------------------------------------------------------------

/**
 * 作品分类配置（与 db.js CATEGORIES + normalizeCategory 保持一致，避免饼图占比全 0）
 * M6b-1 文旅文创六分类：景区摄影 / 非遗工艺 / 国风艺术 / AI创作 / 馆藏文化 / 创意设计
 * @constant
 */
const CATEGORIES = [
  { key: 'scenic-photo',    zh: '景区摄影',   color: '#ffd1e8' },
  { key: 'heritage-craft',  zh: '非遗工艺',   color: '#c9b6ff' },
  { key: 'guofeng-art',     zh: '国风艺术',   color: '#a8d8ff' },
  { key: 'ai-art',          zh: 'AI创作',     color: '#ffe0a3' },
  { key: 'museum-culture',  zh: '馆藏文化',   color: '#b6e2c8' },
  { key: 'creative-design', zh: '创意设计',   color: '#ffb6c1' }
];

/**
 * AI 评分等级展示分桶（与 ai-aesthetic.js 的 GRADE_TIERS 对齐，仅改用 S+/S/A/B/C 展示标签）
 * 分数区间：S+ 9.0-10 / S 8.0-8.9 / A 6.5-7.9 / B 5.0-6.4 / C 0-4.9
 * @constant
 */
const GRADE_BUCKETS = [
  { key: 'S+', label: 'S+', min: 9.0,  max: 10.0, color: '#a855f7' },
  { key: 'S',  label: 'S',  min: 8.0,  max: 8.9,  color: '#f59e0b' },
  { key: 'A',  label: 'A',  min: 6.5,  max: 7.9,  color: '#60a5fa' },
  { key: 'B',  label: 'B',  min: 5.0,  max: 6.4,  color: '#34d399' },
  { key: 'C',  label: 'C',  min: 0.0,  max: 4.9,  color: '#9ca3af' }
];

/**
 * 策展展馆状态映射
 * @constant
 */
const HALL_STATUS = {
  draft:     { label: '草稿',   color: '#9ca3af' },
  published: { label: '已发布', color: '#60a5fa' }
};

/**
 * 内部运行时状态：用于资源清理
 * @type {{resizeHandler:Function|null, rafs:Set<number>, observer:MutationObserver|null, contentEl:HTMLElement|null, canvases:Array<HTMLCanvasElement>}}
 */
const _state = {
  resizeHandler: null,
  rafs: new Set(),
  observer: null,
  contentEl: null,
  canvases: []
};

// ============================================================
// 通用工具
// ============================================================

/**
 * 判断当前是否为暗色模式
 * 优先读取 <html data-theme="dark">，其次跟随系统 prefers-color-scheme
 * @returns {boolean}
 */
function isDarkMode() {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr) return attr === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * 获取当前主题色板
 * @returns {{text:string, subText:string, grid:string, axis:string, empty:string, isDark:boolean}}
 */
function themeColors() {
  const dark = isDarkMode();
  return {
    isDark: dark,
    text:    dark ? '#e5e7eb' : '#1f2937',
    subText: dark ? '#9ca3af' : '#6b7280',
    grid:    dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    axis:    dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
    empty:   dark ? '#6b7280' : '#9ca3af'
  };
}

/**
 * HiDPI Canvas 适配：按 devicePixelRatio 放大像素，CSS 尺寸保持
 * @param {HTMLCanvasElement} canvas
 * @param {number} w - CSS 宽度
 * @param {number} h - CSS 高度
 * @returns {CanvasRenderingContext2D}
 */
function setupHiDPICanvas(canvas, w, h) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/**
 * 圆角矩形路径（兼容老版 Canvas）
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} w
 * @param {number} h
 * @param {number} r
 */
function roundRect(ctx, x, y, w, h, r) {
  if (h < r * 2) r = h / 2;
  if (w < r * 2) r = w / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * #RRGGBB 转 rgba()
 * @param {string} hex
 * @param {number} alpha
 * @returns {string}
 */
function hexToRgba(hex, alpha) {
  const m = String(hex).replace('#', '');
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * 在 canvas 中央绘制空数据占位文案
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w
 * @param {number} h
 * @param {string} text
 * @param {{empty:string}} tc
 */
function drawEmpty(ctx, w, h, text, tc) {
  ctx.fillStyle = tc.empty;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '13px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(text, w / 2, h / 2);
}

// ============================================================
// 图表 1：作品分类分布饼图（甜甜圈样式）
// ============================================================

/**
 * 绘制作品分类分布饼图
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{category?:string}>} artworks
 */
function drawCategoryPie(canvas, artworks) {
  const cssW = canvas.clientWidth || 360;
  const cssH = 260;
  const ctx = setupHiDPICanvas(canvas, cssW, cssH);
  const tc = themeColors();
  const cx = cssW * 0.34;
  const cy = cssH / 2;
  const r = Math.min(cssW * 0.30, cssH * 0.42);
  const total = artworks.length;

  ctx.clearRect(0, 0, cssW, cssH);

  if (total === 0) {
    drawEmpty(ctx, cssW, cssH, '暂无作品数据', tc);
    return;
  }

  // 按 CATEGORIES 聚合（默认 ai-art 与 normalizeCategory 兜底一致）
  const counts = CATEGORIES.map(c => ({
    ...c,
    count: artworks.filter(a => (a.category || 'ai-art') === c.key).length
  }));

  // 绘制各切片
  let start = -Math.PI / 2;
  counts.forEach(item => {
    if (item.count === 0) return;
    const angle = (item.count / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();
    ctx.strokeStyle = tc.isDark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    start += angle;
  });

  // 中心镂空圆 + 总数
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = tc.isDark ? 'rgba(17,17,29,0.92)' : 'rgba(255,255,255,0.94)';
  ctx.fill();
  ctx.fillStyle = tc.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText(String(total), cx, cy - 8);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = tc.subText;
  ctx.fillText('作品总数', cx, cy + 12);

  // 图例
  const legendX = cssW * 0.60;
  let legendY = 22;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  counts.forEach(item => {
    ctx.fillStyle = item.color;
    ctx.fillRect(legendX, legendY - 5, 10, 10);
    ctx.fillStyle = tc.text;
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(item.zh, legendX + 16, legendY);
    const pct = total ? ((item.count / total) * 100).toFixed(1) : '0.0';
    ctx.fillStyle = tc.subText;
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(`${item.count} · ${pct}%`, legendX + 16, legendY + 14);
    legendY += 30;
  });
}

// ============================================================
// 图表 2：AI 评分分布柱状图
// ============================================================

/**
 * 绘制 AI 评分分布柱状图（按 S+/S/A/B/C 分桶）
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{totalScore?:number}>} scores
 */
function drawScoreBar(canvas, scores) {
  const cssW = canvas.clientWidth || 360;
  const cssH = 260;
  const ctx = setupHiDPICanvas(canvas, cssW, cssH);
  const tc = themeColors();
  const padding = { l: 36, r: 16, t: 24, b: 32 };
  const plotW = cssW - padding.l - padding.r;
  const plotH = cssH - padding.t - padding.b;

  ctx.clearRect(0, 0, cssW, cssH);

  // 分桶
  const buckets = GRADE_BUCKETS.map(g => ({ ...g, count: 0 }));
  scores.forEach(s => {
    const t = Number(s.totalScore);
    if (!Number.isFinite(t)) return;
    const idx = GRADE_BUCKETS.findIndex(g => t >= g.min && t <= g.max);
    if (idx >= 0) buckets[idx].count++;
  });

  const max = Math.max(1, ...buckets.map(b => b.count));
  if (scores.length === 0 || max === 0) {
    drawEmpty(ctx, cssW, cssH, '暂无评分数据', tc);
    return;
  }

  // Y 轴网格 + 刻度
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = Math.round((max / ticks) * i);
    const y = padding.t + plotH - (plotH / ticks) * i;
    ctx.beginPath();
    ctx.moveTo(padding.l, y);
    ctx.lineTo(cssW - padding.r, y);
    ctx.strokeStyle = tc.grid;
    ctx.stroke();
    ctx.fillStyle = tc.subText;
    ctx.fillText(String(v), padding.l - 6, y);
  }

  // 柱子
  const step = plotW / buckets.length;
  const barW = step * 0.55;
  buckets.forEach((b, i) => {
    const x = padding.l + step * i + (step - barW) / 2;
    const h = (b.count / max) * plotH;
    const y = padding.t + plotH - h;
    // 渐变填充
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, b.color);
    grad.addColorStop(1, hexToRgba(b.color, 0.25));
    ctx.fillStyle = grad;
    if (h > 0) {
      roundRect(ctx, x, y, barW, h, 6);
      ctx.fill();
    }
    // 柱顶数量
    if (b.count > 0) {
      ctx.fillStyle = tc.text;
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(b.count), x + barW / 2, y - 4);
    }
    // X 轴标签
    ctx.fillStyle = tc.text;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(b.label, x + barW / 2, padding.t + plotH + 8);
  });
}

// ============================================================
// 图表 3：文创衍生品趋势折线图（近 14 天）
// ============================================================

/**
 * 绘制文创衍生品趋势折线图
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{createdAt?:string|number|Date}>} crafts
 */
function drawCraftTrend(canvas, crafts) {
  const cssW = canvas.clientWidth || 360;
  const cssH = 260;
  const ctx = setupHiDPICanvas(canvas, cssW, cssH);
  const tc = themeColors();
  const padding = { l: 36, r: 16, t: 36, b: 32 };
  const plotW = cssW - padding.l - padding.r;
  const plotH = cssH - padding.t - padding.b;

  ctx.clearRect(0, 0, cssW, cssH);

  // 顶部累计文案
  ctx.fillStyle = tc.subText;
  ctx.font = '11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`累计文创总数 ${crafts.length}`, padding.l, 16);

  // 按天聚合最近 14 天
  const days = 14;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    buckets.push({ date: d, count: 0 });
  }
  crafts.forEach(c => {
    const t = new Date(c.createdAt);
    if (isNaN(t.getTime())) return;
    t.setHours(0, 0, 0, 0);
    const diff = Math.round((today - t) / 86400000);
    if (diff >= 0 && diff < days) {
      buckets[days - 1 - diff].count++;
    }
  });

  const max = Math.max(1, ...buckets.map(b => b.count));
  if (crafts.length === 0) {
    drawEmpty(ctx, cssW, cssH, '暂无文创数据', tc);
    return;
  }

  // Y 轴网格
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const v = Math.round((max / ticks) * i);
    const y = padding.t + plotH - (plotH / ticks) * i;
    ctx.beginPath();
    ctx.moveTo(padding.l, y);
    ctx.lineTo(cssW - padding.r, y);
    ctx.strokeStyle = tc.grid;
    ctx.stroke();
    ctx.fillStyle = tc.subText;
    ctx.fillText(String(v), padding.l - 6, y);
  }

  // 计算折线点
  const stepX = plotW / (days - 1);
  const pts = buckets.map((b, i) => ({
    x: padding.l + stepX * i,
    y: padding.t + plotH - (b.count / max) * plotH,
    count: b.count
  }));

  // 渐变填充区
  ctx.beginPath();
  ctx.moveTo(pts[0].x, padding.t + plotH);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, padding.t + plotH);
  ctx.closePath();
  const fillGrad = ctx.createLinearGradient(0, padding.t, 0, padding.t + plotH);
  fillGrad.addColorStop(0, 'rgba(201,182,255,0.55)');
  fillGrad.addColorStop(1, 'rgba(201,182,255,0.02)');
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // 折线
  ctx.beginPath();
  pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = '#c9b6ff';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // 数据点
  pts.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#c9b6ff';
    ctx.fill();
    ctx.strokeStyle = tc.isDark ? '#1a1a2e' : '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // X 轴标签（每 3 天一个 + 最后一天）
  ctx.fillStyle = tc.subText;
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  buckets.forEach((b, i) => {
    if (i % 3 === 0 || i === days - 1) {
      const label = `${b.date.getMonth() + 1}/${b.date.getDate()}`;
      ctx.fillText(label, padding.l + stepX * i, padding.t + plotH + 8);
    }
  });
}

// ============================================================
// 图表 4：策展统计双环环形图
// ============================================================

/**
 * 绘制策展统计双环环形图
 * 外环：draft / published 占比；内环：按 theme 主题分布
 * @param {HTMLCanvasElement} canvas
 * @param {Array<{status?:string, theme?:string}>} halls
 */
function drawCurateStats(canvas, halls) {
  const cssW = canvas.clientWidth || 360;
  const cssH = 260;
  const ctx = setupHiDPICanvas(canvas, cssW, cssH);
  const tc = themeColors();
  const cx = cssW * 0.34;
  const cy = cssH / 2;
  const rOuter = Math.min(cssW * 0.30, cssH * 0.44);
  const rMid   = rOuter * 0.78;
  const rInner = rOuter * 0.50;

  ctx.clearRect(0, 0, cssW, cssH);

  if (halls.length === 0) {
    drawEmpty(ctx, cssW, cssH, '暂无策展数据', tc);
    return;
  }

  const total = halls.length;

  // 外环：状态分布
  const statusCounts = Object.entries(HALL_STATUS).map(([key, info]) => ({
    key, label: info.label, color: info.color,
    count: halls.filter(h => (h.status || 'draft') === key).length
  }));

  // 内环：主题分布
  const themePalette = ['#ffd1e8', '#c9b6ff', '#a8d8ff', '#ffe0a3', '#b6e2c8', '#fbcfe8', '#ddd6fe'];
  const themeMap = {};
  halls.forEach(h => {
    const t = h.theme || 'unknown';
    if (!themeMap[t]) themeMap[t] = { key: t, count: 0 };
    themeMap[t].count++;
  });
  const themeCounts = Object.values(themeMap).map((t, i) => ({
    ...t,
    color: themePalette[i % themePalette.length]
  }));

  // 绘制外环
  let start = -Math.PI / 2;
  statusCounts.forEach(s => {
    if (s.count === 0) return;
    const angle = (s.count / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rOuter, start, start + angle);
    ctx.arc(cx, cy, rMid, start + angle, start, true);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    ctx.strokeStyle = tc.isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    start += angle;
  });

  // 绘制内环
  start = -Math.PI / 2;
  themeCounts.forEach(s => {
    if (s.count === 0) return;
    const angle = (s.count / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rInner + (rMid - rInner) * 0.5, start, start + angle);
    ctx.arc(cx, cy, rInner, start + angle, start, true);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    start += angle;
  });

  // 中心镂空 + 总数
  ctx.beginPath();
  ctx.arc(cx, cy, rInner * 0.85, 0, Math.PI * 2);
  ctx.fillStyle = tc.isDark ? 'rgba(17,17,29,0.92)' : 'rgba(255,255,255,0.94)';
  ctx.fill();
  ctx.fillStyle = tc.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(String(total), cx, cy - 8);
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = tc.subText;
  ctx.fillText('展馆总数', cx, cy + 12);

  // 图例
  const legendX = cssW * 0.60;
  let legendY = 14;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillStyle = tc.subText;
  ctx.fillText('状态', legendX, legendY);
  legendY += 14;
  statusCounts.forEach(s => {
    ctx.fillStyle = s.color;
    ctx.fillRect(legendX, legendY - 5, 10, 10);
    ctx.fillStyle = tc.text;
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`${s.label} ${s.count}`, legendX + 16, legendY);
    legendY += 18;
  });
  legendY += 6;
  ctx.fillStyle = tc.subText;
  ctx.font = '11px system-ui, sans-serif';
  ctx.fillText('主题', legendX, legendY);
  legendY += 14;
  themeCounts.slice(0, 6).forEach(s => {
    ctx.fillStyle = s.color;
    ctx.fillRect(legendX, legendY - 5, 10, 10);
    ctx.fillStyle = tc.text;
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`${s.key || '其他'} ${s.count}`, legendX + 16, legendY);
    legendY += 18;
  });
}

// ============================================================
// 资源清理
// ============================================================

/**
 * 清理看板运行时资源：resize 监听器 / RAF / MutationObserver / canvas 显存
 * 必须在切 Tab / closeDashboard 时调用
 * @private
 */
function _cleanup() {
  // 1. 移除 resize 监听器
  if (_state.resizeHandler) {
    window.removeEventListener('resize', _state.resizeHandler);
    _state.resizeHandler = null;
  }
  // 2. 取消所有 RAF
  if (_state.rafs && _state.rafs.size) {
    _state.rafs.forEach(id => cancelAnimationFrame(id));
    _state.rafs.clear();
  }
  // 3. 断开 MutationObserver
  if (_state.observer) {
    _state.observer.disconnect();
    _state.observer = null;
  }
  // 4. 释放 canvas 显存（width=0 触发 GPU 释放）
  if (_state.canvases && _state.canvases.length) {
    _state.canvases.forEach(c => {
      if (c) { c.width = 0; c.height = 0; }
    });
    _state.canvases = [];
  }
  _state.contentEl = null;
}

// ============================================================
// 主入口：renderPanel
// ============================================================

/**
 * 渲染数据看板到指定容器（Admin Tab 入口）
 * @param {HTMLElement} content - 看板挂载容器
 * @returns {Promise<void>}
 */
async function renderPanel(content) {
  if (!content) return;
  // 清理上次资源（切 Tab 再回来的场景）
  _cleanup();
  _state.contentEl = content;

  // 1. 异步并行拉取所有数据
  // P0 修复：文创衍生品 KPI 改从 orders 表聚合（与一键下单落库口径一致），
  // 保留 ai_crafts 作为趋势辅助口径（无 orders 数据时回退展示）。
  const [artworks, users, orders, aiCrafts, halls, scores, partners] = await Promise.all([
    getAllArtworks(),
    getAllUsers(),
    getAllOrders().catch(() => []),
    runRequest('ai_crafts', 'readonly', s => s.getAll()).catch(() => []),
    runRequest('curated_halls', 'readonly', s => s.getAll()).catch(() => []),
    runRequest('aesthetic_scores', 'readonly', s => s.getAll()).catch(() => []),
    runRequest('partner_applications', 'readonly', s => s.getAll()).catch(() => [])
  ]);
  // 以 orders 为真实商业口径；orders 为空且 ai_crafts 有数据时回退到 ai_crafts（兼容历史）
  const crafts = orders.length || !aiCrafts.length ? orders : aiCrafts;

  const publishedHalls = halls.filter(h => h.status === 'published').length;
  const pendingPartners = partners.filter(p => p.status === 'pending').length;

  // 2. 构建 DOM（KPI + 2x2 图表网格）
  content.innerHTML = `
    <div class="admin-dashboard">
      <div class="kpi-grid">
        <div class="kpi-card glass">
          <div class="kpi-icon kpi-icon-pink"><i class="fa-regular fa-images"></i></div>
          <div class="kpi-body">
            <div class="kpi-num">${artworks.length}</div>
            <div class="kpi-label">作品总数</div>
          </div>
        </div>
        <div class="kpi-card glass">
          <div class="kpi-icon kpi-icon-purple"><i class="fa-regular fa-users"></i></div>
          <div class="kpi-body">
            <div class="kpi-num">${users.length}</div>
            <div class="kpi-label">注册用户</div>
          </div>
        </div>
        <div class="kpi-card glass">
          <div class="kpi-icon kpi-icon-blue"><i class="fa-solid fa-palette"></i></div>
          <div class="kpi-body">
            <div class="kpi-num">${crafts.length}</div>
            <div class="kpi-label">文创衍生品</div>
          </div>
        </div>
        <div class="kpi-card glass">
          <div class="kpi-icon kpi-icon-yellow"><i class="fa-solid fa-wand-magic-sparkles"></i></div>
          <div class="kpi-body">
            <div class="kpi-num">${halls.length}</div>
            <div class="kpi-label">策展展馆<span class="kpi-sub">已发布 ${publishedHalls}</span></div>
          </div>
        </div>
      </div>

      <div class="charts-grid">
        <div class="chart-card glass">
          <h4><i class="fa-solid fa-chart-pie"></i> 作品分类分布 <span class="chart-badge">${artworks.length}</span></h4>
          <canvas class="chart-canvas" id="chart-category"></canvas>
        </div>
        <div class="chart-card glass">
          <h4><i class="fa-solid fa-chart-column"></i> AI 评分分布 <span class="chart-badge">${scores.length}</span></h4>
          <canvas class="chart-canvas" id="chart-score"></canvas>
        </div>
        <div class="chart-card glass">
          <h4><i class="fa-solid fa-chart-line"></i> 文创趋势（近 14 天） <span class="chart-badge">${crafts.length}</span></h4>
          <canvas class="chart-canvas" id="chart-craft"></canvas>
        </div>
        <div class="chart-card glass">
          <h4><i class="fa-solid fa-circle-nodes"></i> 策展统计 <span class="chart-badge">${halls.length}</span></h4>
          <canvas class="chart-canvas" id="chart-curate"></canvas>
        </div>
      </div>

      <div class="dashboard-footer">
        <span class="dashboard-meta">合伙人申请待审 ${pendingPartners} · 评分维度 5 项 · 数据更新于 ${new Date().toLocaleString('zh-CN')}</span>
      </div>
    </div>
  `;

  // 3. 绘制函数（供 rAF 与 resize 调用）
  const drawAll = () => {
    const c1 = content.querySelector('#chart-category');
    const c2 = content.querySelector('#chart-score');
    const c3 = content.querySelector('#chart-craft');
    const c4 = content.querySelector('#chart-curate');
    _state.canvases = [c1, c2, c3, c4].filter(Boolean);
    if (c1) drawCategoryPie(c1, artworks);
    if (c2) drawScoreBar(c2, scores);
    if (c3) drawCraftTrend(c3, crafts);
    if (c4) drawCurateStats(c4, halls);
  };

  // 4. 用双 rAF 等待布局稳定后再绘制（确保 canvas.clientWidth 正确）
  const raf1 = requestAnimationFrame(() => {
    drawAll();
    const raf2 = requestAnimationFrame(drawAll);
    _state.rafs.add(raf2);
  });
  _state.rafs.add(raf1);

  // 5. resize 监听器（节流 150ms）
  let resizeTimer = 0;
  _state.resizeHandler = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawAll, 150);
  };
  window.addEventListener('resize', _state.resizeHandler);

  // 6. MutationObserver 监听 content 子节点变化
  // 切到其他 Tab 时 admin.js 会重置 innerHTML，admin-dashboard 被移除 → 自动 cleanup
  _state.observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of Array.from(m.removedNodes)) {
        if (node.nodeType !== 1) continue;
        if (node.classList && (node.classList.contains('admin-dashboard') || node.querySelector && node.querySelector('.admin-dashboard'))) {
          _cleanup();
          return;
        }
      }
    }
  });
  _state.observer.observe(content, { childList: true });
}

// ============================================================
// 独立打开 / 关闭（预留 #/dashboard 路由，当前不绑定）
// ============================================================

/**
 * 独立打开数据看板（脱离 Admin 弹窗，预留路由）
 * @returns {Promise<void>}
 */
async function openDashboard() {
  _cleanup();
  let host = document.querySelector('#ai-dashboard-standalone');
  if (host) host.remove();
  host = document.createElement('div');
  host.id = 'ai-dashboard-standalone';
  host.className = 'ai-dashboard-standalone';
  document.body.appendChild(host);
  await renderPanel(host);
}

/**
 * 关闭数据看板并完整清理资源
 */
function closeDashboard() {
  _cleanup();
  const host = document.querySelector('#ai-dashboard-standalone');
  if (host) host.remove();
}

// ============================================================
// 全局挂载 + ES Module 导出
// ============================================================

window.AIDashboard = { openDashboard, closeDashboard, renderPanel };

export { openDashboard, closeDashboard, renderPanel, drawCategoryPie, drawScoreBar, drawCraftTrend, drawCurateStats };
export default { openDashboard, closeDashboard, renderPanel };
