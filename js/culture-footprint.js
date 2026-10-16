// ============================================================
// js/culture-footprint.js — 文化探索足迹页（"藏"）
// 路由 #/footprint：高德地图文化版图（12 主题发源地标记点亮）
//   + 六分区徽章墙（铜/银/金分级）+ 点亮进度 + canvas 分享卡片
// 三行为点亮：view（读图鉴）/ craft（创作文创）/ scan（AI 识图）
// 地图：高德 JS API 2.0（学生个人参赛非商用，免费额度）；
//      AMAP_KEY 为空或加载失败时降级为纯徽章墙（无地图，功能不残缺）
// ============================================================

import { getFootprintsByUser } from './db.js';
import { CULTURE_THEMES, EXTENDED_THEMES, ALL_THEMES, getThemeById } from '../data/culture-knowledge.js';
import { FOOTPRINT_ACTIONS, badgeLevel, BADGE_GROUPS, CULTURE_BADGES, THEME_LOCATIONS } from '../data/culture-badges.js';
// P1-2 emoji→SVG
import { iconHtml as _iconHtml } from './icons.js';

// 高德开放平台 Web端(JS API) key —— 注册 https://lbs.amap.com 创建应用获取
// 留空时本页自动降级为徽章墙模式（不加载地图）
const AMAP_KEY = '7c8b5ee16ce9957aae0b45c664bbd74b';

let overlayEl = null;
let mapInstance = null;
let footprintListener = null;

// ------------------------------------------------------------
// 样式注入
// ------------------------------------------------------------
function _injectStyle() {
  if (document.getElementById('culture-footprint-style')) return;
  const st = document.createElement('style');
  st.id = 'culture-footprint-style';
  st.textContent = `
    .fp-page-box { max-width: 900px; width: 94%; max-height: 88vh; overflow-y: auto; padding: 28px; }
    .fp-title { margin: 0 0 4px; font-size: 1.4rem; }
    .fp-sub { margin: 0 0 16px; font-size: .88rem; opacity: .75; }
    .fp-summary { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; padding: 12px 16px; border-radius: 12px; background: var(--card-bg, rgba(255,255,255,.06)); border: 1px solid var(--border-color, rgba(255,255,255,.1)); font-size: .88rem; }
    .fp-summary b { font-size: 1.1rem; }
    .fp-progress { flex: 1; min-width: 160px; height: 8px; border-radius: 6px; background: rgba(255,255,255,.1); overflow: hidden; }
    .fp-progress-bar { height: 100%; border-radius: 6px; background: linear-gradient(90deg, #7c3aed, #fbbf24); transition: width .6s ease; }
    .fp-map-wrap { position: relative; border-radius: 14px; overflow: hidden; border: 1px solid var(--border-color, rgba(255,255,255,.12)); margin-bottom: 20px; }
    #fp-map { width: 100%; height: 380px; }
    .fp-map-fallback { padding: 26px 16px; text-align: center; font-size: .86rem; opacity: .7; }
    .fp-group { margin-bottom: 18px; }
    .fp-group-title { margin: 0 0 10px; font-size: .95rem; font-weight: 800; display: flex; align-items: center; gap: 8px; }
    .fp-badges { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
    .fp-badge { border-radius: 14px; padding: 14px; background: var(--card-bg, rgba(255,255,255,.06)); border: 1px solid var(--border-color, rgba(255,255,255,.1)); transition: transform .18s, border-color .18s; cursor: pointer; }
    .fp-badge:hover { transform: translateY(-2px); border-color: var(--dream-violet, #7c3aed); }
    .fp-badge.unlit { opacity: .45; filter: grayscale(1); }
    .fp-badge-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .fp-badge-icon { font-size: 1.7rem; }
    .fp-badge-medal { font-size: .95rem; }
    .fp-badge-name { margin: 6px 0 2px; font-size: .95rem; font-weight: 800; }
    .fp-badge-desc { margin: 0; font-size: .76rem; opacity: .65; line-height: 1.5; }
    .fp-badge-actions { display: flex; gap: 8px; margin-top: 8px; font-size: .72rem; }
    .fp-act { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 10px; border: 1px solid var(--border-color, rgba(255,255,255,.14)); opacity: .45; }
    .fp-act.done { opacity: 1; color: #34d399; border-color: rgba(52,211,153,.4); background: rgba(52,211,153,.08); }
    .fp-share-row { display: flex; gap: 10px; margin-top: 6px; flex-wrap: wrap; }
    .fp-legend-note { margin-top: 18px; padding-top: 10px; border-top: 1px dashed var(--border-color, rgba(255,255,255,.12)); font-size: .78rem; opacity: .65; line-height: 1.8; }
    /* 高德地图自定义标记 */
    .fp-marker { display: flex; flex-direction: column; align-items: center; cursor: pointer; filter: grayscale(1); opacity: .55; transition: filter .3s, opacity .3s; }
    .fp-marker.lit { filter: none; opacity: 1; }
    .fp-marker-icon { display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; font-size: 1.15rem; background: rgba(20,16,38,.85); border: 2px solid rgba(255,255,255,.3); box-shadow: 0 2px 8px rgba(0,0,0,.4); }
    .fp-marker.lit .fp-marker-icon { border-color: #fbbf24; box-shadow: 0 0 14px rgba(251,191,36,.65); }
    .fp-marker.lit.gold .fp-marker-icon { border-color: #fde68a; background: rgba(80,60,10,.9); box-shadow: 0 0 18px rgba(253,230,138,.85); }
    .fp-marker.ext .fp-marker-icon { width: 28px; height: 28px; font-size: .85rem; }
    .fp-marker.ext .fp-marker-label { font-size: .62rem; padding: 1px 6px; }
    .fp-marker-label { margin-top: 3px; padding: 1px 7px; border-radius: 8px; font-size: .68rem; color: #eee; background: rgba(20,16,38,.8); white-space: nowrap; }
  `;
  document.head.appendChild(st);
}

function _esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
}

function _userId() {
  return (window.currentUser && window.currentUser.id) != null ? window.currentUser.id : 0;
}

// ------------------------------------------------------------
// 打开 / 关闭
// ------------------------------------------------------------
async function openFootprint() {
  if (overlayEl) return;
  _injectStyle();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'culture-footprint-page';
  overlay.innerHTML = `
    <div class="modal-box fp-page-box glass">
      <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
      <h2 class="fp-title"><i class="fa-solid fa-map-location-dot"></i> 文化探索足迹</h2>
      <p class="fp-sub">读图鉴 · 创文创 · AI 识图，三种行为点亮中华文化版图（${CULTURE_THEMES.length} 个核心主题 + ${EXTENDED_THEMES.length} 处文化地标），铜 → 银 → 金集齐徽章</p>
      <div id="fp-body"><p class="fp-map-fallback">加载足迹中…</p></div>
    </div>`;
  document.body.appendChild(overlay);
  overlayEl = overlay;
  if (window.ModalScrollLock) ModalScrollLock.lock();
  requestAnimationFrame(() => overlay.classList.add('open'));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-close]')) closeFootprint();
  });

  // 足迹点亮事件实时刷新（识图/读图鉴/创作保存时）
  footprintListener = () => { if (overlayEl) _render(); };
  window.addEventListener('culture:footprint', footprintListener);

  await _render();
  if (typeof Sound !== 'undefined') Sound.playSound('open');
}

function closeFootprint() {
  if (!overlayEl) return;
  const el = overlayEl;
  overlayEl = null;
  if (footprintListener) { window.removeEventListener('culture:footprint', footprintListener); footprintListener = null; }
  el.classList.remove('open');
  if (window.ModalScrollLock) ModalScrollLock.unlock();
  if (typeof Sound !== 'undefined') Sound.playSound('close');
  setTimeout(() => el.remove(), 260);
  // 地图实例销毁交给 overlay 移除（AMap 2.0 无显式 destroy，置空引用即可）
  mapInstance = null;
}

// ------------------------------------------------------------
// 渲染主体：进度总览 + 地图 + 徽章墙
// ------------------------------------------------------------
async function _render() {
  const body = overlayEl ? overlayEl.querySelector('#fp-body') : null;
  if (!body) return;

  // 读取足迹 → themeId → Set(actions)
  const actionMap = {};
  try {
    const list = await getFootprintsByUser(_userId());
    for (const r of list) {
      if (!actionMap[r.themeId]) actionMap[r.themeId] = new Set();
      actionMap[r.themeId].add(r.action);
    }
  } catch (e) { console.warn('[CultureFootprint] 足迹读取失败:', e && e.message); }

  const litThemes = ALL_THEMES.filter(t => actionMap[t.themeId] && actionMap[t.themeId].size > 0);
  const litCore = CULTURE_THEMES.filter(t => actionMap[t.themeId] && actionMap[t.themeId].size > 0);
  const litExt = litThemes.length - litCore.length;
  let gold = 0, silver = 0, bronze = 0;
  ALL_THEMES.forEach(t => {
    const lv = badgeLevel(actionMap[t.themeId] ? [...actionMap[t.themeId]] : []);
    if (lv.level === 'gold') gold++;
    else if (lv.level === 'silver') silver++;
    else if (lv.level === 'bronze') bronze++;
  });
  const pct = Math.round(litThemes.length / ALL_THEMES.length * 100);

  body.innerHTML = `
    <div class="fp-summary">
      <span>已点亮 <b>${litThemes.length}</b> / ${ALL_THEMES.length} 个文化主题（核心 ${litCore.length}/${CULTURE_THEMES.length} · 地标 ${litExt}/${EXTENDED_THEMES.length}）</span>
      <div class="fp-progress"><div class="fp-progress-bar" style="width:${pct}%"></div></div>
      <span>神 ${gold} · 妙 ${silver} · 佳 ${bronze}</span>
    </div>
    <div class="fp-map-wrap" id="fp-map-wrap"></div>
    <div id="fp-groups">
      ${BADGE_GROUPS.map(g => `
        <div class="fp-group">
          <h3 class="fp-group-title"><i class="fa-solid fa-compass"></i> ${_esc(g.name)}</h3>
          <div class="fp-badges">
            ${g.themeIds.map(tid => {
              const theme = getThemeById(tid);
              const badge = CULTURE_BADGES[tid] || {};
              if (!theme) return '';
              const actions = actionMap[tid] || new Set();
              const lv = badgeLevel([...actions]);
              return `<div class="fp-badge ${lv.level === 'none' ? 'unlit' : ''}" data-theme="${tid}" role="button" tabindex="0">
                <div class="fp-badge-head">
                  <span class="fp-badge-icon">${_iconHtml(badge.icon || '📜')}</span>
                  <span class="fp-badge-medal" title="${lv.desc}">${lv.level === 'none' ? '' : _iconHtml(lv.icon) + ' ' + lv.label}</span>
                </div>
                <div class="fp-badge-name">${_esc(badge.name || theme.name)}</div>
                <p class="fp-badge-desc">${_esc(badge.desc || '')}</p>
                <div class="fp-badge-actions">
                  ${Object.values(FOOTPRINT_ACTIONS).map(a =>
                    `<span class="fp-act ${actions.has(a.id) ? 'done' : ''}">${a.icon} ${a.label}</span>`).join('')}
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>`).join('')}
    </div>
    <div class="fp-share-row">
      <button type="button" class="btn-primary" id="fp-share-btn"><i class="fa-solid fa-share-nodes"></i> 生成足迹分享卡</button>
    </div>
    <p class="fp-legend-note">
      点亮规则：<b>读图鉴</b>（进入文化图鉴阅读主题故事）· <b>创文创</b>（保存该主题文创作品）· <b>AI 识图</b>（识别出该主题）<br/>
      徽章分级：🥉 铜任一行为 → 🥈 银两种行为 → 🥇 金三行为全解锁。足迹保存在本地并随登录账号同步。
    </p>`;

  // 徽章卡点击 → 跳图鉴详情（读故事/继续点亮）
  body.querySelectorAll('.fp-badge').forEach(el => {
    el.addEventListener('click', () => { closeFootprint(); location.hash = '#/atlas?theme=' + el.dataset.theme; });
  });
  body.querySelector('#fp-share-btn').addEventListener('click', () => _shareCard(actionMap, { lit: litThemes.length, litExt, total: ALL_THEMES.length, gold, silver, bronze }));

  await _renderMap(actionMap);
}

// ------------------------------------------------------------
// 高德地图文化版图
// ------------------------------------------------------------
async function _renderMap(actionMap) {
  const wrap = overlayEl ? overlayEl.querySelector('#fp-map-wrap') : null;
  if (!wrap) return;

  if (!AMAP_KEY) {
    wrap.innerHTML = '<div class="fp-map-fallback"><i class="fa-solid fa-map"></i> 文化版图地图未配置（需高德 JS API key）· 下方徽章墙完整呈现点亮进度</div>';
    return;
  }
  wrap.innerHTML = '<div id="fp-map"></div>';

  try {
    const AMap = await _loadAMap();
    if (!overlayEl) return; // 用户已关闭页面
    mapInstance = new AMap.Map('fp-map', {
      center: [110.5, 34.5],
      zoom: 4,
      mapStyle: 'amap://styles/dark',
      viewMode: '2D',
      zooms: [4, 8]
    });
    ALL_THEMES.forEach(t => {
      // 核心 12 主题坐标在 THEME_LOCATIONS；扩展主题坐标内联在主题条目（lng/lat）
      const loc = THEME_LOCATIONS[t.themeId] || (t.lng != null ? t : null);
      if (!loc) return;
      const isCore = !!THEME_LOCATIONS[t.themeId];
      const badge = CULTURE_BADGES[t.themeId] || {};
      const actions = actionMap[t.themeId] || new Set();
      const lv = badgeLevel([...actions]);
      const lit = lv.level !== 'none';
      const marker = new AMap.Marker({
        position: [loc.lng, loc.lat],
        anchor: 'bottom-center',
        content: `<div class="fp-marker ${isCore ? '' : 'ext'} ${lit ? 'lit' : ''} ${lv.level === 'gold' ? 'gold' : ''}" title="${_esc(loc.place || t.region)}">
          <div class="fp-marker-icon">${badge.icon || t.icon || '📍'}</div>
          <div class="fp-marker-label">${_esc(t.name)}</div>
        </div>`
      });
      marker.on('click', () => { closeFootprint(); location.hash = '#/atlas?theme=' + t.themeId; });
      mapInstance.add(marker);
    });
  } catch (e) {
    console.warn('[CultureFootprint] 高德地图加载失败，降级徽章墙:', e && e.message);
    wrap.innerHTML = '<div class="fp-map-fallback"><i class="fa-solid fa-triangle-exclamation"></i> 地图加载失败（网络或 key 无效）· 下方徽章墙完整呈现点亮进度</div>';
  }
}

/** 动态加载高德 JS API 2.0（单例 Promise） */
function _loadAMap() {
  if (window.AMap) return Promise.resolve(window.AMap);
  if (window._amapLoading) return window._amapLoading;
  window._amapLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}`;
    s.onload = () => window.AMap ? resolve(window.AMap) : reject(new Error('AMap 未挂载'));
    s.onerror = () => reject(new Error('高德脚本加载失败'));
    document.head.appendChild(s);
    setTimeout(() => reject(new Error('高德脚本加载超时')), 10000);
  });
  return window._amapLoading;
}

// ------------------------------------------------------------
// Canvas 分享卡片
// ------------------------------------------------------------
function _shareCard(actionMap, stats) {
  const W = 900, H = 1200;
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');

  // 背景：深紫渐变
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#1a1033');
  g.addColorStop(0.55, '#241748');
  g.addColorStop(1, '#120a26');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 标题
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 56px "Microsoft YaHei", sans-serif';
  ctx.fillText('文化探索足迹', W / 2, 120);
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.font = '26px "Microsoft YaHei", sans-serif';
  ctx.fillText('Dreamcore · AI+文旅文创艺术共创社区', W / 2, 168);

  // 进度
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px "Microsoft YaHei", sans-serif';
  ctx.fillText(`已点亮 ${stats.lit} / ${stats.total} 个文化主题`, W / 2, 250);
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.font = '24px "Microsoft YaHei", sans-serif';
  ctx.fillText(`🥇 金 ${stats.gold} · 🥈 银 ${stats.silver} · 🥉 铜 ${stats.bronze}`, W / 2, 292);

  // 点亮徽章网格（4 列 × 3 行）
  const cell = 190, startX = (W - cell * 4) / 2 + cell / 2, startY = 380;
  CULTURE_THEMES.forEach((t, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = startX + col * cell, y = startY + row * cell + 40;
    const actions = actionMap[t.themeId] || new Set();
    const lv = badgeLevel([...actions]);
    const lit = lv.level !== 'none';
    const badge = CULTURE_BADGES[t.themeId] || {};
    ctx.globalAlpha = lit ? 1 : 0.28;
    ctx.font = '58px "Segoe UI Emoji", "Microsoft YaHei", sans-serif';
    ctx.fillText(badge.icon || '📜', x, y + 20);
    ctx.fillStyle = lit ? '#fde68a' : 'rgba(255,255,255,.5)';
    ctx.font = 'bold 22px "Microsoft YaHei", sans-serif';
    ctx.fillText(t.name, x, y + 62);
    if (lit) {
      ctx.font = '20px sans-serif';
      ctx.fillText(lv.icon + lv.label, x, y + 90);
    }
    ctx.globalAlpha = 1;
  });

  // 扩展文化地标点亮行（核心网格下方）
  if (stats.litExt > 0) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 26px "Microsoft YaHei", sans-serif';
    ctx.fillText(`📍 另有 ${stats.litExt} 处扩展文化地标已点亮（联网讲解主题）`, W / 2, 930);
  }

  // 底部
  const d = new Date();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.font = '22px "Microsoft YaHei", sans-serif';
  ctx.fillText(`${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日 · 识→懂→创→藏`, W / 2, H - 60);

  // 下载
  const a = document.createElement('a');
  a.download = `dreamcore-文化探索足迹-${Date.now()}.png`;
  a.href = cv.toDataURL('image/png');
  a.click();
  if (window.showToast) showToast('🖼 足迹分享卡已生成，快去分享吧', 'success');
}

// ------------------------------------------------------------
// 路由
// ------------------------------------------------------------
function isFootprintHash() {
  return /^#\/footprint(?:\?.*)?$/.test(window.location.hash || '');
}

function openFromHash() {
  if (isFootprintHash()) openFootprint();
  else closeFootprint();
}

window.CultureFootprint = { openFootprint, closeFootprint, openFromHash };

export { openFootprint, closeFootprint, openFromHash, isFootprintHash };
