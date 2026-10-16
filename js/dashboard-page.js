// ============================================================
// js/dashboard-page.js — P1-2 B 端景区运营数据看板
// 路由 #/dashboard：面向景区 / 博物馆 / 文旅机构的商业化演示页
//   · KPI 卡 ×4：累计打卡 / 今日打卡 / AI 文创生成数 / 覆盖景区数
//   · 热门文化主题 TOP10 柱状图（Canvas 手绘，借鉴 ai-dashboard 风格）
//   · 景区打卡分布 TOP8 横向条形（culture_footprints 中 themeId
//     以 'spot:' 前缀的记录映射回所属景区，景区库共 26 个）
//   · 文创生成趋势折线图（ai_crafts 按 createdAt 聚合近 14 天）
// 数据：IndexedDB 本地聚合（绝不连 Supabase——国内 SNI 阻断，演示机
//       必须离线可用）；数据不足（<3 条）时图表叠加确定性演示种子并
//       标注「含演示数据」角标，KPI 始终显示真实数字。
// 模式：完全套用 pricing-page.js overlay 模板（_injectStyle +
//   modal-overlay + hashchange 自注册 + 关闭清理）；本模块在 import 时
//   自注册监听，main.js 接线时仅需 import 一次即可纳入路由。
// ============================================================

import { runRequest, updateOrderStatus } from './db.js';
import { SCENIC_AREAS, SCENIC_AREA_COUNT } from '../data/scenic-spots.js';
import { getThemeById } from '../data/culture-knowledge.js';

// ------------------------------------------------------------
// v10：订单物流 5 态状态机（与 db.js ORDER_STATES 一致，品类无关）
// paid → producing → shipped → in_transit → delivered
// ------------------------------------------------------------
const ORDER_FLOW = [
  { key: 'paid',       label: '已支付', icon: 'fa-circle-check',      color: '#38bdf8' },
  { key: 'producing',  label: '制作中', icon: 'fa-gear',              color: '#fbbf24' },
  { key: 'shipped',    label: '已发货', icon: 'fa-box',               color: '#a78bfa' },
  { key: 'in_transit', label: '运输中', icon: 'fa-truck-fast',        color: '#f472b6' },
  { key: 'delivered',  label: '已签收', icon: 'fa-house-circle-check', color: '#34d399' }
];

// 时间戳短格式：MM-DD HH:mm（演示看板用）
function _fmtTs(iso) {
  const t = new Date(iso);
  if (isNaN(t.getTime())) return '';
  const p = n => String(n).padStart(2, '0');
  return `${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}`;
}

let overlayEl = null;       // 看板主 overlay（单例）
let _resizeHandler = null;  // 窗口缩放重绘句柄（关闭时移除）
let _lastChart = null;      // 最近一次聚合结果（resize 时免重查库直接重绘）

// ------------------------------------------------------------
// 静态索引：景点 id → 所属景区 / 景区 id → 景区（只读引用 scenic-spots）
// ------------------------------------------------------------
const SPOT_AREA = new Map();
const AREA_INDEX = new Map();
SCENIC_AREAS.forEach(a => {
  AREA_INDEX.set(a.areaId, a);
  (a.spots || []).forEach(s => SPOT_AREA.set(String(s.id), a));
});

// ------------------------------------------------------------
// 演示种子（确定性生成，无随机数；仅内存叠加用于图表展示，不写库，
// KPI 数字始终来自真实本地数据）
// ------------------------------------------------------------
const DEMO_THEME_IDS = ['dunhuang', 'sanxingdui', 'qinghua', 'bingmayong', 'piying', 'jingju', 'tangsancai', 'gugong', 'suxiu', 'lanan'];
const DEMO_THEME_COUNTS = [26, 21, 18, 15, 12, 10, 8, 6, 5, 4];
const DEMO_AREA_COUNTS = [18, 14, 11, 9, 7, 6, 5, 4]; // 叠加到景区库前 8 个景区
const DEMO_CRAFT_DAYS = [2, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 8, 9, 11]; // 近 14 天（旧 → 今，增长叙事）

// ------------------------------------------------------------
// 样式注入（雾紫粉梦核设计语言，玻璃拟态 + 青绿文化点缀）
// ------------------------------------------------------------
function _injectStyle() {
  if (document.getElementById('dashboard-page-style')) return;
  const st = document.createElement('style');
  st.id = 'dashboard-page-style';
  st.textContent = `
    .dashboard-page-box { max-width: 1080px; width: 94%; max-height: 90vh; overflow-y: auto; padding: 28px 26px 22px; }
    .dbp-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
    .dbp-title { margin: 0 0 6px; font-size: 1.5rem; font-weight: 800; color: var(--text-primary); }
    .dbp-title-grad { background: linear-gradient(120deg, var(--dream-purple), var(--dream-pink)); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
    .dbp-sub { margin: 0; font-size: .9rem; color: var(--text-secondary); }
    .dbp-view-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px; border-radius: 999px;
      font-size: .74rem; font-weight: 700; color: #34d399; background: rgba(52,211,153,.1); border: 1px solid rgba(52,211,153,.35);
      white-space: nowrap; }

    /* ---- KPI 卡片区（桌面 4 横排 / 平板 2×2 / 手机 1 列） ---- */
    .dbp-kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 18px; }
    .dbp-kpi { display: flex; align-items: center; gap: 12px; padding: 16px; border-radius: var(--radius);
      border: 1.5px solid var(--glass-border); background: var(--glass-bg); backdrop-filter: blur(12px);
      transition: transform .25s, box-shadow .25s; }
    .dbp-kpi:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(201,182,255,.2); }
    .dbp-kpi-icon { flex: none; width: 42px; height: 42px; border-radius: 13px; display: flex; align-items: center;
      justify-content: center; font-size: 1.05rem; color: #fff; background: linear-gradient(135deg, #34d399, #6ee7b7);
      box-shadow: 0 6px 16px rgba(52,211,153,.32); }
    .dbp-kpi:nth-child(2) .dbp-kpi-icon, .dbp-kpi:nth-child(4) .dbp-kpi-icon {
      background: linear-gradient(135deg, var(--dream-purple), var(--dream-pink)); box-shadow: 0 6px 16px rgba(201,182,255,.35); }
    .dbp-kpi-body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .dbp-kpi-num { font-size: 1.5rem; font-weight: 800; color: var(--text-primary); line-height: 1.1; font-variant-numeric: tabular-nums; }
    .dbp-kpi-label { font-size: .8rem; font-weight: 700; color: var(--text-primary); }
    .dbp-kpi-sub { font-size: .7rem; color: var(--text-secondary); }

    /* ---- 空状态 ---- */
    .dbp-empty { margin: 6px 0 18px; padding: 30px 20px; text-align: center; border-radius: var(--radius);
      border: 1.5px dashed var(--glass-border); background: rgba(52,211,153,.05); }
    .dbp-empty-icon { width: 58px; height: 58px; margin: 0 auto 12px; border-radius: 50%; display: flex;
      align-items: center; justify-content: center; font-size: 1.5rem; color: #34d399;
      background: rgba(52,211,153,.12); border: 1px solid rgba(52,211,153,.3); }
    .dbp-empty-title { margin: 0 0 6px; font-size: 1.05rem; font-weight: 800; color: var(--text-primary); }
    .dbp-empty-text { margin: 0 auto 14px; max-width: 420px; font-size: .84rem; color: var(--text-secondary); line-height: 1.7; }
    .dbp-empty-cta { display: inline-flex; align-items: center; gap: 8px; padding: 10px 22px; border-radius: 999px;
      font-size: .9rem; font-weight: 800; text-decoration: none; color: #052e1f;
      background: linear-gradient(90deg, #34d399, #6ee7b7); box-shadow: 0 8px 20px rgba(52,211,153,.35);
      transition: transform .2s, box-shadow .2s; }
    .dbp-empty-cta:hover { transform: translateY(-2px); box-shadow: 0 12px 26px rgba(52,211,153,.45); }

    /* ---- 图表区 ---- */
    .dbp-charts { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .dbp-chart-card { position: relative; padding: 16px 16px 12px; border-radius: var(--radius);
      border: 1.5px solid var(--glass-border); background: var(--glass-bg); backdrop-filter: blur(12px); }
    .dbp-chart-wide { grid-column: 1 / -1; }
    .dbp-chart-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .dbp-chart-title { margin: 0; font-size: .95rem; font-weight: 800; color: var(--text-primary); }
    .dbp-chart-sub { margin: 2px 0 0; font-size: .72rem; color: var(--text-secondary); }
    .dbp-demo-badge { display: none; flex: none; padding: 3px 10px; border-radius: 999px; font-size: .68rem;
      font-weight: 700; color: #b45309; background: rgba(251,191,36,.14); border: 1px solid rgba(251,191,36,.4); }
    .dbp-charts.is-demo .dbp-demo-badge { display: inline-flex; }
    .dbp-canvas { display: block; width: 100%; }

    /* ---- 商业化钩子脚注 ---- */
    .dbp-footnote { margin: 16px 0 0; padding: 12px 14px; border-radius: 12px; font-size: .78rem;
      color: var(--text-secondary); line-height: 1.7; background: rgba(201,182,255,.08);
      border-left: 3px solid var(--dream-purple); }
    .dbp-footnote i { color: #34d399; margin-right: 6px; }

    /* ---- v10：文创订单卡区块（5 态物流时间线 + 演示快进） ---- */
    .dbp-orders { margin-top: 14px; }
    .dbp-orders-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 10px; }
    .dbp-order-list { display: flex; flex-direction: column; gap: 10px; }
    .dbp-order-card { padding: 14px 16px 12px; border-radius: var(--radius);
      border: 1.5px solid var(--glass-border); background: var(--glass-bg); backdrop-filter: blur(12px); }
    .dbp-order-top { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
    .dbp-order-product { font-size: .95rem; font-weight: 800; color: var(--text-primary); }
    .dbp-order-no { font-size: .72rem; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
    .dbp-order-status { display: inline-flex; align-items: center; gap: 5px; margin-left: auto; padding: 4px 12px;
      border-radius: 999px; font-size: .72rem; font-weight: 800; white-space: nowrap; }
    .dbp-order-meta { display: flex; gap: 14px; flex-wrap: wrap; font-size: .74rem; color: var(--text-secondary);
      margin-bottom: 12px; font-variant-numeric: tabular-nums; }
    .dbp-order-meta strong { color: var(--text-primary); }

    /* 5 态物流时间线：横向节点 + 连接线（.done 已过 / .cur 当前） */
    .dbp-track { display: flex; align-items: flex-start; }
    .dbp-track-node { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px;
      position: relative; min-width: 0; }
    .dbp-track-node::before { content: ''; position: absolute; top: 9px; left: -50%; width: 100%; height: 2.5px;
      background: var(--glass-border); }
    .dbp-track-node:first-child::before { display: none; }
    .dbp-track-node.done::before, .dbp-track-node.cur.done::before { background: linear-gradient(90deg, #34d399, #6ee7b7); }
    .dbp-track-dot { position: relative; z-index: 1; width: 19px; height: 19px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; font-size: .58rem; color: #fff;
      background: var(--text-secondary); box-shadow: 0 0 0 3px var(--glass-bg); }
    .dbp-track-node.done .dbp-track-dot { background: linear-gradient(135deg, #34d399, #6ee7b7); }
    .dbp-track-node.cur .dbp-track-dot { background: linear-gradient(135deg, var(--dream-purple), var(--dream-pink));
      box-shadow: 0 0 0 3px var(--glass-bg), 0 0 0 5px rgba(201,182,255,.3); }
    .dbp-track-label { font-size: .72rem; font-weight: 700; color: var(--text-secondary); }
    .dbp-track-node.done .dbp-track-label, .dbp-track-node.cur .dbp-track-label { color: var(--text-primary); }
    .dbp-track-time { font-size: .64rem; color: var(--text-secondary); font-variant-numeric: tabular-nums; }

    /* 演示快进按钮：每点一次推进一个物流状态 */
    .dbp-ff-btn { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px;
      border-radius: 999px; border: 1px solid rgba(201,182,255,.4); font-size: .72rem; font-weight: 800;
      color: var(--text-primary); background: rgba(201,182,255,.12); cursor: pointer;
      transition: transform .2s, box-shadow .2s; }
    .dbp-ff-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 14px rgba(201,182,255,.3); }
    .dbp-ff-btn:disabled { opacity: .45; cursor: not-allowed; }
    .dbp-orders-empty { padding: 22px 16px; text-align: center; border-radius: var(--radius);
      border: 1.5px dashed var(--glass-border); font-size: .82rem; color: var(--text-secondary); }

    /* ---- 响应式 ---- */
    @media (max-width: 860px) {
      .dbp-kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .dbp-charts { grid-template-columns: 1fr; }
    }
    @media (max-width: 480px) {
      .dashboard-page-box { padding: 20px 14px 16px; }
      .dbp-kpi-grid { grid-template-columns: 1fr; }
      .dbp-kpi { padding: 13px 14px; }
    }
  `;
  document.head.appendChild(st);
}

// ------------------------------------------------------------
// Canvas 通用工具（与 ai-dashboard.js 同套绘制风格，本地复制不 import）
// ------------------------------------------------------------
function _isDarkMode() {
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr) return attr === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function _themeColors() {
  const dark = _isDarkMode();
  return {
    isDark: dark,
    text:    dark ? '#e5e7eb' : '#1f2937',
    subText: dark ? '#9ca3af' : '#6b7280',
    grid:    dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    axis:    dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)',
    empty:   dark ? '#6b7280' : '#9ca3af'
  };
}

function _setupHiDPICanvas(canvas, w, h) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function _roundRect(ctx, x, y, w, h, r) {
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

function _hexToRgba(hex, alpha) {
  const m = String(hex).replace('#', '');
  const r = parseInt(m.substring(0, 2), 16);
  const g = parseInt(m.substring(2, 4), 16);
  const b = parseInt(m.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function _drawEmpty(ctx, w, h, text, tc) {
  ctx.fillStyle = tc.empty;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '13px system-ui, -apple-system, "Segoe UI", sans-serif';
  ctx.fillText(text, w / 2, h / 2);
}

// ------------------------------------------------------------
// 数据读取：IndexedDB 本地聚合（等待 DB 就绪，旧库缺表时降级为空数据）
// ------------------------------------------------------------
async function _loadData() {
  for (let i = 0; i < 12; i++) {
    try {
      const footprints = await runRequest('culture_footprints', 'readonly', s => s.getAll());
      const crafts = await runRequest('ai_crafts', 'readonly', s => s.getAll());
      // P3 B3: 订单表单独容错（v9 前旧库缺 orders 表时降级为空，不影响其余数据）
      let orders = [];
      try { orders = (await runRequest('orders', 'readonly', s => s.getAll())) || []; } catch (_) { /* 旧库无表 */ }
      return { footprints: footprints || [], crafts: crafts || [], orders };
    } catch (e) {
      // DB 尚未初始化完成 / 旧版本库缺表 → 短暂等待后重试
      await new Promise(r => setTimeout(r, 150));
    }
  }
  return { footprints: [], crafts: [], orders: [] };
}

// ------------------------------------------------------------
// 聚合：KPI + 三张图表数据（needsDemo 时叠加确定性演示种子）
// ------------------------------------------------------------
function _aggregate(footprints, crafts, orders, needsDemo) {
  // 打卡足迹：themeId 以 'spot:' 前缀的记录
  const visits = footprints.filter(f => String(f.themeId || '').startsWith('spot:'));

  // KPI（始终真实数据）
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCount = visits.filter(f => {
    const t = new Date(f.createdAt);
    return !isNaN(t.getTime()) && t >= todayStart;
  }).length;
  const areaSet = new Set();
  visits.forEach(f => {
    const area = SPOT_AREA.get(String(f.themeId).slice(5));
    if (area) areaSet.add(area.areaId);
  });

  // 图表 1：热门文化主题（非 spot: 足迹按 themeId 聚合）
  const themeMap = new Map();
  footprints.forEach(f => {
    const id = String(f.themeId || '');
    if (!id || id.startsWith('spot:')) return;
    themeMap.set(id, (themeMap.get(id) || 0) + 1);
  });

  // 图表 2：景区打卡分布（spot:xx → 所属景区聚合）
  const areaMap = new Map();
  visits.forEach(f => {
    const area = SPOT_AREA.get(String(f.themeId).slice(5));
    if (area) areaMap.set(area.areaId, (areaMap.get(area.areaId) || 0) + 1);
  });

  // 图表 3：文创趋势（ai_crafts 按天聚合近 14 天）
  const days = 14;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const trend = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    trend.push({ date: d, count: 0 });
  }
  crafts.forEach(c => {
    const t = new Date(c.createdAt);
    if (isNaN(t.getTime())) return;
    t.setHours(0, 0, 0, 0);
    const diff = Math.round((today - t) / 86400000);
    if (diff >= 0 && diff < days) trend[days - 1 - diff].count++;
  });

  // 数据不足时叠加演示种子（仅图表，不影响 KPI）
  if (needsDemo) {
    DEMO_THEME_IDS.forEach((id, i) => themeMap.set(id, (themeMap.get(id) || 0) + DEMO_THEME_COUNTS[i]));
    DEMO_AREA_COUNTS.forEach((n, i) => {
      const a = SCENIC_AREAS[i];
      if (a) areaMap.set(a.areaId, (areaMap.get(a.areaId) || 0) + n);
    });
    trend.forEach((b, i) => { b.count += DEMO_CRAFT_DAYS[i]; });
  }

  const themeRows = [...themeMap.entries()]
    .map(([id, count]) => ({ label: (getThemeById(id) || {}).name || id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const areaRows = [...areaMap.entries()]
    .map(([id, count]) => ({
      label: (AREA_INDEX.get(id) || {}).name || id,
      region: (AREA_INDEX.get(id) || {}).region || '',
      count
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const trendTotal = trend.reduce((n, b) => n + b.count, 0);

  // P3 B3: 文创订单 KPI（真实订单数据，不叠演示种子）
  const todayOrders = orders.filter(o => {
    const t = new Date(o.createdAt);
    return !isNaN(t.getTime()) && t >= todayStart;
  }).length;
  const revenue = orders.reduce((n, o) => n + (Number(o.price) || 0), 0);

  return {
    kpi: { total: visits.length, today: todayCount, crafts: crafts.length, areas: areaSet.size, orders: orders.length, todayOrders, revenue },
    themeRows, areaRows, trend, trendTotal
  };
}

// ------------------------------------------------------------
// 图表 1：热门文化主题 TOP10 柱状图（青绿=TOP3 / 雾紫=其余）
// ------------------------------------------------------------
function _drawThemeBar(canvas, rows) {
  if (!canvas) return;
  const cssW = canvas.clientWidth || 360;
  const cssH = 290;
  const ctx = _setupHiDPICanvas(canvas, cssW, cssH);
  const tc = _themeColors();
  ctx.clearRect(0, 0, cssW, cssH);
  if (!rows || rows.length === 0) {
    _drawEmpty(ctx, cssW, cssH, '暂无主题足迹数据', tc);
    return;
  }
  const n = rows.length;
  const padding = { l: 30, r: 8, t: 30, b: 62 };
  const plotW = cssW - padding.l - padding.r;
  const plotH = cssH - padding.t - padding.b;
  const max = Math.max(1, ...rows.map(r => r.count));

  // Y 轴网格 + 刻度
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const v = Math.round((max / 4) * i);
    const y = padding.t + plotH - (plotH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.l, y);
    ctx.lineTo(cssW - padding.r, y);
    ctx.strokeStyle = tc.grid;
    ctx.stroke();
    ctx.fillStyle = tc.subText;
    ctx.fillText(String(v), padding.l - 5, y);
  }

  const step = plotW / n;
  const barW = Math.min(step * 0.6, 34);
  rows.forEach((r, i) => {
    const x = padding.l + step * i + (step - barW) / 2;
    const h = (r.count / max) * plotH;
    const y = padding.t + plotH - h;
    const color = i < 3 ? '#34d399' : '#c9b6ff';
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, color);
    grad.addColorStop(1, _hexToRgba(color, 0.25));
    ctx.fillStyle = grad;
    if (h > 0) {
      _roundRect(ctx, x, y, barW, h, 5);
      ctx.fill();
    }
    // 柱顶数量
    if (r.count > 0) {
      ctx.fillStyle = tc.text;
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(r.count), x + barW / 2, y - 3);
    }
    // X 轴标签（-33° 旋转，容纳 4-6 字主题名）
    const label = r.label.length > 6 ? r.label.slice(0, 5) + '…' : r.label;
    ctx.save();
    ctx.translate(x + barW / 2 + 3, padding.t + plotH + 10);
    ctx.rotate(-Math.PI / 5.5);
    ctx.fillStyle = tc.text;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });
}

// ------------------------------------------------------------
// 图表 2：景区打卡分布 TOP8 横向条形排名
// ------------------------------------------------------------
function _drawAreaRank(canvas, rows) {
  if (!canvas) return;
  const cssW = canvas.clientWidth || 360;
  const rowH = 36;
  const cssH = rows && rows.length ? 24 + rows.length * rowH + 6 : 240;
  const ctx = _setupHiDPICanvas(canvas, cssW, cssH);
  const tc = _themeColors();
  ctx.clearRect(0, 0, cssW, cssH);
  if (!rows || rows.length === 0) {
    _drawEmpty(ctx, cssW, cssH, '暂无打卡数据', tc);
    return;
  }
  const labelW = Math.max(76, Math.min(118, cssW * 0.3));
  const max = Math.max(1, ...rows.map(r => r.count));
  const barMaxW = Math.max(40, cssW - labelW - 46);
  rows.forEach((r, i) => {
    const cy = 16 + i * rowH + rowH / 2;
    // 排名（TOP3 青绿高亮）
    ctx.fillStyle = i < 3 ? '#34d399' : tc.subText;
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), 6, cy);
    // 景区名
    const name = r.label.length > 6 ? r.label.slice(0, 5) + '…' : r.label;
    ctx.fillStyle = tc.text;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(name, 20, cy);
    // 条形（TOP3 青绿渐变 / 其余雾紫渐变）
    const w = Math.max(4, (r.count / max) * barMaxW);
    const bh = 14;
    const grad = ctx.createLinearGradient(labelW, 0, labelW + w, 0);
    if (i < 3) {
      grad.addColorStop(0, '#34d399');
      grad.addColorStop(1, '#6ee7b7');
    } else {
      grad.addColorStop(0, '#c9b6ff');
      grad.addColorStop(1, '#e2d8ff');
    }
    ctx.fillStyle = grad;
    _roundRect(ctx, labelW, cy - bh / 2, w, bh, 7);
    ctx.fill();
    // 条形末端数量
    ctx.fillStyle = tc.text;
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(String(r.count), labelW + w + 8, cy);
  });
}

// ------------------------------------------------------------
// 图表 3：文创生成趋势折线图（近 14 天，雾紫渐变填充 + 青绿折线）
// ------------------------------------------------------------
function _drawCraftTrend(canvas, buckets, total) {
  if (!canvas) return;
  const cssW = canvas.clientWidth || 360;
  const cssH = 240;
  const ctx = _setupHiDPICanvas(canvas, cssW, cssH);
  const tc = _themeColors();
  ctx.clearRect(0, 0, cssW, cssH);
  const days = buckets.length;
  const hasData = total > 0;

  // 顶部累计文案
  if (hasData) {
    ctx.fillStyle = tc.subText;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`近 14 天生成 ${total} 件 AI 文创`, 8, 14);
  } else {
    _drawEmpty(ctx, cssW, cssH, '近 14 天暂无文创生成', tc);
    return;
  }

  const padding = { l: 30, r: 14, t: 34, b: 30 };
  const plotW = cssW - padding.l - padding.r;
  const plotH = cssH - padding.t - padding.b;
  const max = Math.max(1, ...buckets.map(b => b.count));

  // Y 轴网格 + 刻度
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) {
    const v = Math.round((max / 4) * i);
    const y = padding.t + plotH - (plotH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.l, y);
    ctx.lineTo(cssW - padding.r, y);
    ctx.strokeStyle = tc.grid;
    ctx.stroke();
    ctx.fillStyle = tc.subText;
    ctx.fillText(String(v), padding.l - 5, y);
  }

  // 折线点
  const stepX = plotW / (days - 1);
  const pts = buckets.map((b, i) => ({
    x: padding.l + stepX * i,
    y: padding.t + plotH - (b.count / max) * plotH
  }));

  // 雾紫渐变填充区
  ctx.beginPath();
  ctx.moveTo(pts[0].x, padding.t + plotH);
  pts.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pts[pts.length - 1].x, padding.t + plotH);
  ctx.closePath();
  const fillGrad = ctx.createLinearGradient(0, padding.t, 0, padding.t + plotH);
  fillGrad.addColorStop(0, 'rgba(201,182,255,0.5)');
  fillGrad.addColorStop(1, 'rgba(201,182,255,0.02)');
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // 青绿折线
  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // 数据点
  pts.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#34d399';
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

function _drawCharts(chart) {
  const ov = overlayEl;
  if (!ov || !chart) return;
  _drawThemeBar(ov.querySelector('#dbp-chart-theme'), chart.themeRows);
  _drawAreaRank(ov.querySelector('#dbp-chart-area'), chart.areaRows);
  _drawCraftTrend(ov.querySelector('#dbp-chart-trend'), chart.trend, chart.trendTotal);
}

// ------------------------------------------------------------
// KPI 卡片模板
// ------------------------------------------------------------
function _kpiCard(key, icon, label, sub) {
  return `
    <div class="dbp-kpi" data-kpi="${key}">
      <span class="dbp-kpi-icon"><i class="fa-solid ${icon}" aria-hidden="true"></i></span>
      <div class="dbp-kpi-body">
        <span class="dbp-kpi-num">—</span>
        <span class="dbp-kpi-label">${label}</span>
        <span class="dbp-kpi-sub">${sub}</span>
      </div>
    </div>`;
}

function _setKpi(ov, key, value) {
  const el = ov.querySelector(`.dbp-kpi[data-kpi="${key}"] .dbp-kpi-num`);
  if (el) el.textContent = String(value);
}

// ------------------------------------------------------------
// 异步刷新：读库 → KPI → 空状态切换 → 画图
// ------------------------------------------------------------
async function _refresh() {
  const ov = overlayEl;
  if (!ov) return;
  const { footprints, crafts, orders } = await _loadData();
  if (overlayEl !== ov) return; // 等待期间看板已被关闭

  const totalReal = footprints.length + crafts.length;
  const hasAny = totalReal > 0;
  const needsDemo = hasAny && totalReal < 3; // 数据不足（<3 条）：图表叠加演示种子

  const chart = _aggregate(footprints, crafts, orders, needsDemo);
  _setKpi(ov, 'total', chart.kpi.total);
  _setKpi(ov, 'today', chart.kpi.today);
  _setKpi(ov, 'crafts', chart.kpi.crafts);
  _setKpi(ov, 'areas', chart.kpi.areas);
  // P3 B3: 文创订单卡（数字 + 副标题动态更新：今日单数 · 累计销售额）
  _setKpi(ov, 'orders', chart.kpi.orders);
  const ordersSub = ov.querySelector('.dbp-kpi[data-kpi="orders"] .dbp-kpi-sub');
  if (ordersSub) ordersSub.textContent = `今日 ${chart.kpi.todayOrders} 单 · 累计销售额 ¥${chart.kpi.revenue}`;

  // 空状态：本地无数据时显示友好引导（图表 canvas 仍渲染占位提示）
  const emptyBox = ov.querySelector('.dbp-empty');
  if (emptyBox) emptyBox.style.display = hasAny ? 'none' : '';
  // 「含演示数据」角标
  const chartsEl = ov.querySelector('.dbp-charts');
  if (chartsEl) chartsEl.classList.toggle('is-demo', needsDemo);

  _lastChart = chart;
  _drawCharts(chart);

  // v10：文创订单卡（物流 5 态时间线 + 演示快进）
  _renderOrders(ov, orders);
}

// ------------------------------------------------------------
// v10：文创订单卡渲染（每单一张卡：产品/订单号/价格/物流单号
// + 5 态时间线进度条 + 演示快进按钮；品类无关——明信片/冰箱贴/
// 文具盒等全部品类共用同一链路）
// ------------------------------------------------------------
function _renderOrders(ov, orders) {
  const listEl = ov.querySelector('#dbp-order-list');
  if (!listEl) return;
  const list = (orders || []).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (!list.length) {
    listEl.innerHTML = '<div class="dbp-orders-empty">暂无文创订单——在 AI 文创预览中「一键定制下单」后，物流进度会实时展示在这里</div>';
    return;
  }
  listEl.innerHTML = list.map(o => {
    const curIdx = Math.max(0, ORDER_FLOW.findIndex(s => s.key === o.status));
    const st = ORDER_FLOW[curIdx] || ORDER_FLOW[0];
    // 各态时间戳：取 timeline 中该状态最后一条记录
    const tsOf = key => {
      const tl = Array.isArray(o.timeline) ? o.timeline : [];
      for (let i = tl.length - 1; i >= 0; i--) {
        if (tl[i] && tl[i].state === key) return _fmtTs(tl[i].ts);
      }
      return '';
    };
    const trackHtml = ORDER_FLOW.map((s, i) => {
      const cls = i < curIdx ? 'done' : (i === curIdx ? 'done cur' : '');
      return `
        <div class="dbp-track-node ${cls}">
          <span class="dbp-track-dot"><i class="fa-solid ${s.icon}" aria-hidden="true"></i></span>
          <span class="dbp-track-label">${s.label}</span>
          <span class="dbp-track-time">${tsOf(s.key)}</span>
        </div>`;
    }).join('');
    const isFinal = o.status === 'delivered';
    return `
      <div class="dbp-order-card" data-order-id="${o.id}">
        <div class="dbp-order-top">
          <span class="dbp-order-product">${o.product || '文创衍生品'}</span>
          <span class="dbp-order-no">${o.orderNo || ''}</span>
          <span class="dbp-order-status" style="color:${st.color};background:${st.color}1a;border:1px solid ${st.color}55;">
            <i class="fa-solid ${st.icon}" aria-hidden="true"></i> ${st.label}
          </span>
        </div>
        <div class="dbp-order-meta">
          <span>金额 <strong>¥${Number(o.price) || 0}</strong></span>
          <span>下单 ${_fmtTs(o.createdAt)}</span>
          ${o.trackingNo ? `<span>物流单号 <strong>${o.trackingNo}</strong></span>` : ''}
        </div>
        <div class="dbp-track">${trackHtml}</div>
        <div style="display:flex;justify-content:flex-end;margin-top:10px;">
          <button type="button" class="dbp-ff-btn" data-ff="${o.id}" ${isFinal ? 'disabled' : ''}>
            <i class="fa-solid fa-forward" aria-hidden="true"></i> ${isFinal ? '已签收' : '演示快进'}
          </button>
        </div>
      </div>`;
  }).join('');
}

// 演示快进：每次点击推进一个物流状态（paid→…→delivered），随后整板刷新
async function _advanceOrder(id) {
  try {
    await updateOrderStatus(id); // 省略 status → 自动推进下一态
  } catch (err) {
    console.warn('[Dashboard] 订单状态推进失败:', err && err.message);
    return;
  }
  if (typeof Sound !== 'undefined') Sound.playSound('click');
  _refresh();
}

// ------------------------------------------------------------
// 主页面：KPI + 空状态 + 三张图表 + 商业化脚注
// ------------------------------------------------------------
function openDashboard() {
  if (overlayEl) return;
  // Vite dev 下静态 import 与动态 import('/js/dashboard-page.js') 可能因
  // ?t= 查询参数差异产生双模块实例（各自 overlayEl 独立），两次执行
  // openFromHash 会创建两个 #dashboard-page —— 以 DOM 存在性兜底幂等：
  // 已有 overlay 时直接接管，绝不重复创建（p1-dashboard strict mode 防御）
  const existing = document.getElementById('dashboard-page');
  if (existing) { overlayEl = existing; return; }
  _injectStyle();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'dashboard-page';
  overlay.innerHTML = `
    <div class="modal-box dashboard-page-box glass">
      <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
      <div class="dbp-head">
        <div class="dbp-head-text">
          <h2 class="dbp-title"><span class="dbp-title-grad">景区运营看板</span></h2>
          <p class="dbp-sub">B 端数据演示 · 本地聚合</p>
        </div>
        <span class="dbp-view-badge"><i class="fa-solid fa-building-columns" aria-hidden="true"></i> 景区运营视角 · 演示数据</span>
      </div>

      <div class="dbp-kpi-grid">
        ${_kpiCard('total', 'fa-location-dot', '累计打卡数', '景点点亮总量')}
        ${_kpiCard('today', 'fa-calendar-day', '今日打卡', '当日实时新增')}
        ${_kpiCard('crafts', 'fa-wand-magic-sparkles', 'AI 文创生成数', '衍生品累计生成')}
        ${_kpiCard('areas', 'fa-map-location-dot', '覆盖景区数', '景区库共 ' + SCENIC_AREA_COUNT + ' 个')}
        ${_kpiCard('orders', 'fa-cart-shopping', '文创订单', '今日 0 单 · 累计销售额 ¥0')}
      </div>

      <div class="dbp-empty" style="display:none;">
        <div class="dbp-empty-icon"><i class="fa-solid fa-compass" aria-hidden="true"></i></div>
        <h3 class="dbp-empty-title">本机暂无运营数据</h3>
        <p class="dbp-empty-text">去智慧导览浏览景点即可自动打卡，AI 文创生成数据也会实时汇入本看板，快来点亮第一份数据吧。</p>
        <a class="dbp-empty-cta" href="#/scenic"><i class="fa-solid fa-route" aria-hidden="true"></i> 去智慧导览打卡</a>
      </div>

      <div class="dbp-charts">
        <div class="dbp-chart-card">
          <div class="dbp-chart-head">
            <div>
              <h4 class="dbp-chart-title"><i class="fa-solid fa-ranking-star" style="color:#34d399;margin-right:6px;"></i>热门文化主题 TOP10</h4>
              <p class="dbp-chart-sub">按用户探索足迹聚合</p>
            </div>
            <span class="dbp-demo-badge"><i class="fa-solid fa-seedling"></i> 含演示数据</span>
          </div>
          <canvas class="dbp-canvas" id="dbp-chart-theme"></canvas>
        </div>
        <div class="dbp-chart-card">
          <div class="dbp-chart-head">
            <div>
              <h4 class="dbp-chart-title"><i class="fa-solid fa-map-location-dot" style="color:#34d399;margin-right:6px;"></i>景区打卡分布 TOP8</h4>
              <p class="dbp-chart-sub">景点打卡足迹映射回所属景区</p>
            </div>
            <span class="dbp-demo-badge"><i class="fa-solid fa-seedling"></i> 含演示数据</span>
          </div>
          <canvas class="dbp-canvas" id="dbp-chart-area"></canvas>
        </div>
        <div class="dbp-chart-card dbp-chart-wide">
          <div class="dbp-chart-head">
            <div>
              <h4 class="dbp-chart-title"><i class="fa-solid fa-chart-line" style="color:#34d399;margin-right:6px;"></i>文创生成趋势 · 近 14 天</h4>
              <p class="dbp-chart-sub">按 AI 文创生成时间聚合</p>
            </div>
            <span class="dbp-demo-badge"><i class="fa-solid fa-seedling"></i> 含演示数据</span>
          </div>
          <canvas class="dbp-canvas" id="dbp-chart-trend"></canvas>
        </div>
      </div>

      <div class="dbp-orders">
        <div class="dbp-orders-head">
          <div>
            <h4 class="dbp-chart-title"><i class="fa-solid fa-truck-fast" style="color:#34d399;margin-right:6px;"></i>文创订单 · 物流跟踪</h4>
            <p class="dbp-chart-sub">已支付 → 制作中 → 已发货 → 运输中 → 已签收（演示快进可加速流转）</p>
          </div>
        </div>
        <div class="dbp-order-list" id="dbp-order-list"></div>
      </div>

      <p class="dbp-footnote"><i class="fa-solid fa-circle-info" aria-hidden="true"></i>演示数据为本机本地聚合（IndexedDB），实际部署可对接景区票务/闸机系统</p>
    </div>
  `;
  document.body.appendChild(overlay);
  overlayEl = overlay;
  if (window.ModalScrollLock) ModalScrollLock.lock();
  requestAnimationFrame(() => overlay.classList.add('open'));

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-close]')) _closeFromButton();
    const ffBtn = e.target.closest('[data-ff]');
    if (ffBtn && !ffBtn.disabled) _advanceOrder(Number(ffBtn.dataset.ff));
  });

  // 窗口缩放时按最近聚合结果重绘（免重查库）
  _resizeHandler = () => {
    if (overlayEl && _lastChart) _drawCharts(_lastChart);
  };
  window.addEventListener('resize', _resizeHandler);

  _refresh();
}

// ------------------------------------------------------------
// 关闭与路由
// ------------------------------------------------------------
function closeDashboard() {
  // 双实例防御：另一实例已 remove DOM 时，本实例残留引用重置（否则看板永远打不开）
  if (overlayEl && !document.contains(overlayEl)) { overlayEl = null; return; }
  if (!overlayEl) return;
  const el = overlayEl;
  overlayEl = null;
  _lastChart = null;
  if (_resizeHandler) {
    window.removeEventListener('resize', _resizeHandler);
    _resizeHandler = null;
  }
  el.classList.remove('open');
  if (window.ModalScrollLock) ModalScrollLock.unlock();
  if (typeof Sound !== 'undefined') Sound.playSound('close');
  setTimeout(() => el.remove(), 260);
}

// 关闭按钮 / 遮罩点击：清除 hash 返回上一页（hashchange 触发 closeDashboard）
function _closeFromButton() {
  if (window.location.hash && /^#\/dashboard/.test(window.location.hash)) {
    window.location.hash = '';
  } else {
    closeDashboard();
  }
}

function isDashboardHash() {
  return /^#\/dashboard(?:\?.*)?$/.test(window.location.hash || '');
}

function openFromHash() {
  if (isDashboardHash()) openDashboard();
  else closeDashboard();
}

window.DashboardPage = { openDashboard, closeDashboard, openFromHash };

// 模块自注册路由监听：import 即生效（main.js 接线时仅需 import，无需重复绑定）。
// ES Module 单例保证重复 import 只注册一次；openDashboard/closeDashboard 幂等。
window.addEventListener('hashchange', openFromHash);
// 覆盖 import 时 hash 已就位的场景（如测试先导航后 import、深链刷新）
openFromHash();

export { openDashboard, closeDashboard, openFromHash, isDashboardHash };
