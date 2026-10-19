// ============================================================
// js/culture-atlas.js — 文化故事图鉴页（"懂"）
// 路由 #/atlas：12 主题图鉴大厅 → 主题详情（历史源流/文化内涵/典故/
//   文创创作建议 + 关联画廊作品 + 去识图/去创作入口）
// 数据源：data/culture-knowledge.js 事实卡（讲解=事实卡本身，零幻觉）
// 足迹联动（2026-09-25 决策：view 收紧为主动学习）：
//   打开某主题详情完整阅读 = recordFootprint('view') 点亮"读图鉴"行为；
//   画廊浏览不点亮（gallery 灯箱只做主题引导提示，见 themeHint()）
// ============================================================

import { getAllArtworks, recordFootprint } from './db.js';
import { CULTURE_THEMES, EXTENDED_THEMES, getThemeById, matchThemeByText, matchArtworksByTheme, hasFactCard } from '../data/culture-knowledge.js';
import { CULTURE_BADGES } from '../data/culture-badges.js';
// P1-2 emoji→SVG 映射（data 文件保留 emoji，渲染层替换）
import { iconHtml as _iconHtml } from './icons.js';

let overlayEl = null;
let currentThemeId = null; // 当前详情主题（null = 大厅视图）

// ------------------------------------------------------------
// 样式注入
// ------------------------------------------------------------
function _injectStyle() {
  if (document.getElementById('culture-atlas-style')) return;
  const st = document.createElement('style');
  st.id = 'culture-atlas-style';
  st.textContent = `
    .atlas-page-box { max-width: 900px; width: 94%; max-height: 88vh; overflow-y: auto; padding: 28px 28px 48px; }
    .ca-title { margin: 0 0 4px; font-size: 1.4rem; }
    .ca-sub { margin: 0 0 18px; font-size: .88rem; opacity: .75; }
    .ca-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 12px; }
    .ca-card { position: relative; border-radius: 14px; padding: 16px; cursor: pointer; background: var(--card-bg, rgba(255,255,255,.06)); border: 1px solid var(--border-color, rgba(255,255,255,.1)); transition: transform .18s, border-color .18s, box-shadow .18s; }
    .ca-card:hover { transform: translateY(-3px); border-color: var(--dream-violet, #7c3aed); box-shadow: 0 8px 24px rgba(124,58,237,.18); }
    .ca-card-icon { font-size: 1.9rem; line-height: 1; }
    .ca-card-name { margin: 8px 0 2px; font-size: 1.02rem; font-weight: 800; }
    .ca-card-cat { display: inline-block; margin-top: 2px; padding: 2px 10px; border-radius: 12px; font-size: .72rem; background: rgba(124,58,237,.18); border: 1px solid rgba(124,58,237,.35); }
    .ca-card-era { margin: 8px 0 0; font-size: .76rem; opacity: .65; line-height: 1.5; }
    .ca-card-region { margin-top: 2px; font-size: .74rem; opacity: .55; }
    .ca-card-level { position: absolute; top: 12px; right: 12px; font-size: .95rem; }
    .ca-detail-head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .ca-detail-icon { font-size: 2.4rem; }
    .ca-detail-name { margin: 0; font-size: 1.45rem; font-weight: 800; }
    .ca-chip { display: inline-block; padding: 3px 12px; border-radius: 14px; font-size: .76rem; background: rgba(124,58,237,.2); border: 1px solid rgba(124,58,237,.4); }
    .ca-sec { margin: 18px 0 0; }
    .ca-sec-title { margin: 0 0 8px; font-size: .98rem; font-weight: 800; display: flex; align-items: center; gap: 8px; }
    .ca-facts { margin: 0; padding-left: 18px; font-size: .9rem; line-height: 1.85; opacity: .92; }
    .ca-facts li { margin-bottom: 6px; }
    .ca-legend-box, .ca-tip-box { margin-top: 8px; padding: 12px 14px; border-radius: 10px; font-size: .88rem; line-height: 1.75; }
    .ca-legend-box { background: rgba(251,191,36,.08); border-left: 3px solid #fbbf24; }
    .ca-tip-box { background: rgba(52,211,153,.08); border-left: 3px solid #34d399; }
    .ca-box-title { font-weight: 700; margin-bottom: 4px; font-size: .84rem; }
    .ca-legend-box .ca-box-title { color: #fbbf24; }
    .ca-tip-box .ca-box-title { color: #34d399; }
    .ca-works { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; margin-top: 8px; }
    .ca-work { cursor: pointer; border-radius: 10px; overflow: hidden; border: 1px solid var(--border-color, rgba(255,255,255,.12)); transition: border-color .18s, transform .18s; }
    .ca-work:hover { border-color: var(--dream-violet, #7c3aed); transform: translateY(-2px); }
    .ca-work img { display: block; width: 100%; aspect-ratio: 1; object-fit: cover; }
    .ca-work-title { padding: 6px 8px; font-size: .74rem; opacity: .85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ca-cta-row { display: flex; gap: 10px; margin-top: 18px; flex-wrap: wrap; }
    .ca-cta-row .btn-primary { flex: 1; min-width: 190px; }
    .ca-back { margin-bottom: 14px; }
    .ca-lit-toast { margin-top: 14px; padding: 10px 14px; border-radius: 10px; font-size: .84rem; color: #34d399; background: rgba(52,211,153,.1); border: 1px solid rgba(52,211,153,.3); }
    .ca-source-note { margin-top: 16px; padding-top: 10px; border-top: 1px dashed var(--border-color, rgba(255,255,255,.12)); font-size: .76rem; opacity: .6; }
    /* 方案A：扩展文化地标分区（联网讲解） */
    .ca-section-title { margin: 24px 0 10px; font-size: 1rem; font-weight: 800; display: flex; align-items: center; gap: 8px; }
    .ca-grid-ext { grid-template-columns: repeat(auto-fill, minmax(158px, 1fr)); }
    .ca-card.ext .ca-card-icon { font-size: 1.5rem; }
    .ca-card.ext .ca-card-name { font-size: .92rem; }
    .ca-story p { margin: 0 0 10px; font-size: .9rem; line-height: 1.85; opacity: .92; }
    .ca-loading { padding: 40px 0; text-align: center; opacity: .65; font-size: .9rem; }
    .ca-ai-note { display: inline-flex; align-items: center; gap: 6px; margin-top: 14px; padding: 6px 12px; border-radius: 10px; font-size: .76rem; color: #fbbf24; background: rgba(251,191,36,.1); border: 1px solid rgba(251,191,36,.35); }
    .ca-error-box { margin-top: 8px; padding: 14px; border-radius: 10px; font-size: .86rem; line-height: 1.7; background: rgba(248,113,113,.08); border-left: 3px solid #f87171; }
    .ca-tts-row { margin-top: 14px; }
    /* B1 讲解溯源卡片：核心主题=蓝色系「平台知识库」，扩展/无 facts=橙色系「AI 联网生成」 */
    .trace-card { margin-top: 14px; padding: 12px 14px; border-radius: 12px; font-size: .84rem; }
    .trace-card.kb { background: rgba(96,165,250,.09); border: 1px solid rgba(96,165,250,.35); }
    .trace-card.ai { background: rgba(251,191,36,.08); border: 1px solid rgba(251,191,36,.35); }
    .trace-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
    .trace-badge { display: inline-flex; align-items: center; gap: 6px; font-size: .76rem; font-weight: 700; padding: 3px 10px; border-radius: 10px; }
    .trace-card.kb .trace-badge { color: #60a5fa; background: rgba(96,165,250,.14); border: 1px solid rgba(96,165,250,.4); }
    .trace-card.ai .trace-badge { color: #fbbf24; background: rgba(251,191,36,.12); border: 1px solid rgba(251,191,36,.4); }
    .trace-link { font-size: .78rem; font-weight: 700; text-decoration: none; }
    .trace-card.kb .trace-link { color: #60a5fa; }
    .trace-card.ai .trace-link { color: #fbbf24; }
    .trace-link:hover { text-decoration: underline; }
    .trace-theme { margin-top: 8px; font-size: .95rem; font-weight: 800; }
    .trace-chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
    .trace-chip { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; padding: 2px 10px; border-radius: 10px; font-size: .72rem; opacity: .92; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.14); }
    .trace-chip em { font-style: normal; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
    .trace-facts { margin: 8px 0 0; padding-left: 16px; font-size: .78rem; line-height: 1.65; opacity: .88; }
    .trace-facts li { margin-bottom: 3px; }
    .trace-note { margin: 8px 0 0; font-size: .72rem; color: #fbbf24; opacity: .92; }
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
function openAtlas() {
  if (overlayEl) return;
  _injectStyle();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'culture-atlas-page';
  overlay.innerHTML = `
    <div class="modal-box atlas-page-box glass">
      <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
      <div id="ca-body"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlayEl = overlay;
  if (window.ModalScrollLock) ModalScrollLock.lock();
  requestAnimationFrame(() => overlay.classList.add('open'));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-close]')) closeAtlas();
  });
  _renderGrid();
}

function closeAtlas() {
  if (!overlayEl) return;
  const el = overlayEl;
  overlayEl = null;
  currentThemeId = null;
  // 关闭图鉴浮层不会改变 hash（无 hashchange），须主动停止可能仍在播放的语音讲解
  if (window.TTSPlayer && window.TTSPlayer.stop) window.TTSPlayer.stop();
  el.classList.remove('open');
  if (window.ModalScrollLock) ModalScrollLock.unlock();
  if (typeof Sound !== 'undefined') Sound.playSound('close');
  setTimeout(() => el.remove(), 260);
}

function _body() { return overlayEl ? overlayEl.querySelector('#ca-body') : null; }

// ------------------------------------------------------------
// 视图 1：图鉴大厅（12 主题网格）
// ------------------------------------------------------------
async function _renderGrid() {
  const body = _body();
  if (!body) return;
  let levelMap = {};
  try {
    const { getFootprintsByUser } = await import('./db.js');
    const list = await getFootprintsByUser(_userId());
    for (const r of list) {
      if (!levelMap[r.themeId]) levelMap[r.themeId] = new Set();
      levelMap[r.themeId].add(r.action);
    }
  } catch (e) { /* 足迹读取失败不影响浏览 */ }

  body.innerHTML = `
    <h2 class="ca-title"><i class="fa-solid fa-book-atlas"></i> 文化故事图鉴</h2>
    <p class="ca-sub">${CULTURE_THEMES.length} 个核心主题（人工校对事实卡 · 零幻觉）+ ${EXTENDED_THEMES.length} 处扩展文化地标（AI 联网讲解 · 仅供参考）—— 历史源流 / 文化内涵 / 经典典故</p>
    <div class="ca-grid">
      ${CULTURE_THEMES.map(t => {
        const badge = CULTURE_BADGES[t.themeId] || {};
        const actions = levelMap[t.themeId];
        const n = actions ? actions.size : 0;
        const medal = n >= 3 ? '神' : n === 2 ? '妙' : n === 1 ? '佳' : '';
        return `<div class="ca-card" data-theme="${t.themeId}" role="button" tabindex="0">
          ${medal ? `<span class="ca-card-level" title="已点亮 ${n}/3 行为" aria-label="已点亮 ${n}/3">${medal}</span>` : ''}
          <div class="ca-card-icon">${_iconHtml(badge.icon || '📜')}</div>
          <div class="ca-card-name">${_esc(t.name)}</div>
          <span class="ca-card-cat">${_esc(t.category)}</span>
          <p class="ca-card-era">${_esc(t.era)}</p>
          <p class="ca-card-region"><i class="fa-solid fa-location-dot"></i> ${_esc(t.region)}</p>
        </div>`;
      }).join('')}
    </div>
    <h3 class="ca-section-title"><i class="fa-solid fa-earth-asia"></i> 扩展文化地标 · 联网讲解 <span class="ca-chip" style="font-size:.68rem;">AI 生成 · 仅供参考</span></h3>
    <div class="ca-grid ca-grid-ext">
      ${EXTENDED_THEMES.map(t => {
        const badge = CULTURE_BADGES[t.themeId] || {};
        const actions = levelMap[t.themeId];
        const n = actions ? actions.size : 0;
        const medal = n >= 3 ? '神' : n === 2 ? '妙' : n === 1 ? '佳' : '';
        return `<div class="ca-card ext" data-theme="${t.themeId}" role="button" tabindex="0">
          ${medal ? `<span class="ca-card-level" title="已点亮 ${n}/3 行为">${medal}</span>` : ''}
          <div class="ca-card-icon">${_iconHtml(badge.icon || t.icon || '📍')}</div>
          <div class="ca-card-name">${_esc(t.name)}</div>
          <span class="ca-card-cat">${_esc(t.category)}</span>
          <p class="ca-card-region"><i class="fa-solid fa-location-dot"></i> ${_esc(t.region)}</p>
        </div>`;
      }).join('')}
    </div>`;

  body.querySelectorAll('.ca-card').forEach(card => {
    card.addEventListener('click', () => _openDetail(card.dataset.theme));
  });
  if (typeof Sound !== 'undefined') Sound.playSound('pop');
}

// ------------------------------------------------------------
// 视图 2：主题详情（完整阅读 = view 点亮）
// ------------------------------------------------------------
async function _openDetail(themeId) {
  const theme = getThemeById(themeId);
  const body = _body();
  if (!theme || !body) return;
  currentThemeId = themeId;

  // 关联作品
  let works = [];
  try {
    const all = await getAllArtworks();
    works = matchArtworksByTheme(all, themeId).slice(0, 6);
  } catch (e) { /* 画廊读取失败不阻塞 */ }

  // view 点亮：打开主题详情完整阅读 = 主动学习行为
  let litToast = '';
  try {
    const lit = await recordFootprint(_userId(), themeId, 'view', { meta: { via: 'atlas' } });
    if (lit) {
      window.dispatchEvent(new CustomEvent('culture:footprint', { detail: { themeId, action: 'view', level: 'new' } }));
      litToast = '<div class="ca-lit-toast"><i class="fa-solid fa-circle-check"></i> 已点亮「读图鉴」足迹 —— 去<a href="#/footprint" style="color:inherit;text-decoration:underline;" data-close>探索足迹</a>查看徽章</div>';
      if (window.showToast) showToast('📖 已点亮「' + theme.name + '」读图鉴足迹', 'success');
    }
  } catch (e) { console.warn('[CultureAtlas] view 足迹记录失败（不阻塞）:', e && e.message); }

  const badge = CULTURE_BADGES[themeId] || {};

  // 方案A分级渲染：核心主题（有事实卡）本地零幻觉渲染；
  // 扩展主题先出骨架，再调云函数联网生成讲解（含"AI 生成，仅供参考"标注）
  const isCore = hasFactCard(theme);
  // 云端 TTS 语音讲解文本（核心=事实卡，扩展=联网讲解结果，tts-player.js 委托接管）
  const coreTtsText = `${theme.name}。${(theme.facts || []).join(' ')} 典故：${(theme.legends || []).join(' ')}`;
  const coreTtsBtn = `<div class="ca-tts-row"><button type="button" class="btn-ghost tts-btn" data-tts-text="${_esc(coreTtsText)}"><i class="fa-solid fa-volume-high"></i> 语音讲解</button></div>`;
  const midHtml = isCore ? `
    <div class="ca-sec">
      <h3 class="ca-sec-title"><i class="fa-solid fa-landmark"></i> 历史源流 · 文化内涵</h3>
      <ul class="ca-facts">${theme.facts.map(f => `<li>${_esc(f)}</li>`).join('')}</ul>
    </div>

    <div class="ca-sec">
      <h3 class="ca-sec-title"><i class="fa-solid fa-book-open"></i> 经典典故</h3>
      ${theme.legends.map(l => `<div class="ca-legend-box"><div class="ca-box-title">典故</div>${_esc(l)}</div>`).join('')}
    </div>

    <div class="ca-sec">
      <h3 class="ca-sec-title"><i class="fa-solid fa-lightbulb"></i> 文创创作建议</h3>
      <div class="ca-tip-box"><div class="ca-box-title">创作提示</div>${_esc(theme.creationTip)}</div>
    </div>
    ${coreTtsBtn}`
    : `<div id="ca-ext-body"><div class="ca-loading"><i class="fa-solid fa-spinner fa-spin"></i> 正在联网生成「${_esc(theme.name)}」文化讲解…</div></div>`;
  const sourceNote = isCore
    ? '<p class="ca-source-note"><i class="fa-solid fa-circle-check"></i> 内容依据平台文化知识库（人工校对事实卡），可溯源至公认史实。</p>'
    : '<p class="ca-source-note"><i class="fa-solid fa-cloud"></i> 本主题为扩展文化地标，讲解由 AI 实时联网搜索生成，仅供参考。</p>';

  body.innerHTML = `
    <button type="button" class="btn-ghost ca-back" data-back><i class="fa-solid fa-arrow-left"></i> 返回图鉴</button>
    <div class="ca-detail-head">
      <span class="ca-detail-icon">${_iconHtml(badge.icon || t_iconFallback(theme))}</span>
      <div>
        <h2 class="ca-detail-name">${_esc(theme.name)}</h2>
        <div>
          <span class="ca-chip">${_esc(theme.category)}</span>
          <span class="ca-chip"><i class="fa-solid fa-location-dot"></i> ${_esc(theme.region)}</span>
          <span class="ca-chip"><i class="fa-regular fa-clock"></i> ${_esc(theme.era)}</span>
        </div>
      </div>
    </div>

    ${midHtml}

    ${works.length > 0 ? `
    <div class="ca-sec">
      <h3 class="ca-sec-title"><i class="fa-solid fa-images"></i> 关联画廊作品（${works.length}）</h3>
      <div class="ca-works">
        ${works.map(w => `<div class="ca-work" data-artwork="${w.id}" role="button" tabindex="0" title="${_esc(w.title)}">
          <img src="${_esc(w.imageUrl)}" alt="${_esc(w.title)}" loading="lazy" />
          <div class="ca-work-title">${_esc(w.title)}</div>
        </div>`).join('')}
      </div>
    </div>` : ''}

    <div class="ca-cta-row">
      <button type="button" class="btn-primary" id="ca-craft-btn"><i class="fa-solid fa-feather-pointed"></i> 用「${_esc(theme.name)}」主题创作文创</button>
      <button type="button" class="btn-ghost" id="ca-scan-btn"><i class="fa-solid fa-camera-retro"></i> 去识图</button>
    </div>
    ${litToast}
    ${sourceNote}`;

  body.querySelector('[data-back]').addEventListener('click', () => { currentThemeId = null; _renderGrid(); });
  body.querySelectorAll('.ca-work').forEach(el => {
    el.addEventListener('click', () => { closeAtlas(); location.hash = '#artwork-' + el.dataset.artwork; });
  });
  body.querySelector('#ca-scan-btn').addEventListener('click', () => { closeAtlas(); location.hash = '#/scan'; });
  body.querySelector('#ca-craft-btn').addEventListener('click', () => _goCraft(theme, works));
  if (typeof Sound !== 'undefined') Sound.playSound('open');
  if (overlayEl) overlayEl.querySelector('.atlas-page-box').scrollTop = 0;

  // 扩展主题：异步拉取联网讲解并填充
  if (!isCore) _fetchExtStory(themeId, theme);
}

/** 扩展主题图标兜底（EXTENDED_THEMES 自带 icon 字段） */
function t_iconFallback(theme) { return theme.icon || '📍'; }

/**
 * 扩展文化地标联网讲解：POST /api/ai/culture-story
 * 返回 { name, era, connotation, legend, creationTip, knowledgeBase:false, themeId, themeName }
 */
async function _fetchExtStory(themeId, theme) {
  const target = () => overlayEl && currentThemeId === themeId ? overlayEl.querySelector('#ca-ext-body') : null;
  try {
    const r = await fetch('/api/ai/culture-story', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themeId, subject: theme.name })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
    const ext = target();
    if (!ext) return; // 用户已返回大厅/关闭页面
    const extTtsText = `${theme.name}。${String(d.connotation || '').replace(/\n+/g, ' ')}。典故：${d.legend || ''}`;
    ext.innerHTML = `
      <div class="ca-sec">
        <h3 class="ca-sec-title"><i class="fa-solid fa-landmark"></i> 历史源流 · 文化内涵</h3>
        <div class="ca-story">${String(d.connotation || '').split(/\n+/).filter(Boolean).map(p => `<p>${_esc(p)}</p>`).join('')}</div>
      </div>
      <div class="ca-sec">
        <h3 class="ca-sec-title"><i class="fa-solid fa-book-open"></i> 经典典故</h3>
        <div class="ca-legend-box"><div class="ca-box-title">典故</div>${_esc(d.legend)}</div>
      </div>
      <div class="ca-sec">
        <h3 class="ca-sec-title"><i class="fa-solid fa-lightbulb"></i> 文创创作建议</h3>
        <div class="ca-tip-box"><div class="ca-box-title">创作提示</div>${_esc(d.creationTip)}</div>
      </div>
      <div class="ca-tts-row"><button type="button" class="btn-ghost tts-btn" data-tts-text="${_esc(extTtsText)}"><i class="fa-solid fa-volume-high"></i> 语音讲解</button></div>
      ${_traceCardHtml(d)}
      <div class="ca-ai-note"><i class="fa-solid fa-circle-exclamation"></i> 以上讲解由 AI 联网搜索生成，仅供参考；核心 ${CULTURE_THEMES.length} 主题为人工校对事实卡讲解。</div>`;
  } catch (e) {
    console.warn('[CultureAtlas] 扩展主题讲解生成失败:', e && e.message);
    const ext = target();
    if (!ext) return;
    ext.innerHTML = `<div class="ca-error-box"><i class="fa-solid fa-triangle-exclamation"></i> 讲解生成失败：${_esc(e.message || '网络异常')}<br/>
      <button type="button" class="btn-ghost" id="ca-retry-btn" style="margin-top:8px;"><i class="fa-solid fa-rotate-right"></i> 重试</button></div>`;
    const retry = ext.querySelector('#ca-retry-btn');
    if (retry) retry.addEventListener('click', () => {
      ext.innerHTML = '<div class="ca-loading"><i class="fa-solid fa-spinner fa-spin"></i> 正在重试，请稍候…</div>';
      _fetchExtStory(themeId, theme);
    });
  }
}

/**
 * B1 讲解溯源卡片：把 culture-story 返回的 knowledgeBase/themeId/themeName 显性化
 * - 核心主题（themeId 命中 CULTURE_THEMES 且有 facts）→ 蓝色系「📋 平台知识库」卡
 * - 扩展主题 / 无 facts → 橙色系「🌐 AI 联网生成」卡（复用黄标样式规范）
 * - 响应缺 themeId → 返回空串（优雅降级，不渲染卡片）
 * 摘要 2 条：核心主题取知识库 facts 前 2 条；扩展主题无 facts，取讲解正文前 2 段
 */
function _traceCardHtml(story) {
  if (!story || !story.themeId) return '';
  const theme = getThemeById(story.themeId);
  const isCore = !!(theme && Array.isArray(theme.facts) && theme.facts.length > 0);
  const name = story.themeName || (theme && theme.name) || '';
  if (!name) return '';
  const era = (theme && theme.era) || story.era || '';
  const region = (theme && theme.region) || '';
  const facts = isCore
    ? theme.facts.slice(0, 2)
    : String(story.connotation || '').split(/\n+/).filter(Boolean).slice(0, 2);
  const chips = [
    era ? `<span class="trace-chip"><i class="fa-regular fa-clock"></i> <em title="${_esc(era)}">${_esc(era)}</em></span>` : '',
    region ? `<span class="trace-chip"><i class="fa-solid fa-location-dot"></i> <em title="${_esc(region)}">${_esc(region)}</em></span>` : ''
  ].join('');
  const factList = facts.map(f => `<li>${_esc(f)}</li>`).join('');
  return `
    <div class="trace-card ${isCore ? 'kb' : 'ai'}">
      <div class="trace-head">
        ${isCore
          ? '<span class="trace-badge"><i class="fa-solid fa-database"></i> 📋 平台知识库</span>'
          : '<span class="trace-badge"><i class="fa-solid fa-globe"></i> 🌐 AI 联网生成</span>'}
        <a class="trace-link" href="#/atlas?theme=${_esc(story.themeId)}">查看完整知识卡 →</a>
      </div>
      <div class="trace-theme">${_esc(name)}</div>
      ${chips ? `<div class="trace-chips">${chips}</div>` : ''}
      ${factList ? `<ul class="trace-facts">${factList}</ul>` : ''}
      ${isCore ? '' : '<p class="trace-note"><i class="fa-solid fa-triangle-exclamation"></i> 本卡内容为 AI 联网搜索生成，仅供参考</p>'}
    </div>`;
}

/** 用主题跳转文创工作台（优先携带关联作品作为底图） */
function _goCraft(theme, works) {
  closeAtlas();
  if (works.length > 0) {
    location.hash = '#/craft?artworkId=' + works[0].id;
    _prefillIdea(theme.creationTip || ('以' + theme.name + '为主题，设计一款融合传统元素与现代审美的文创衍生品'));
  } else {
    location.hash = '#/craft';
    _prefillIdea(theme.creationTip || ('以' + theme.name + '为主题，设计一款融合传统元素与现代审美的文创衍生品'));
  }
}

function _prefillIdea(idea) {
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    const el = document.getElementById('craft-idea-input');
    if (el) { el.value = idea; clearInterval(timer); el.focus(); }
    else if (tries > 30) clearInterval(timer);
  }, 300);
}

// ------------------------------------------------------------
// gallery 灯箱主题引导提示（不点亮，仅引导去图鉴）
// ------------------------------------------------------------
function themeHint(art) {
  if (!art) return '';
  const hay = `${art.title || ''} ${art.tags ? art.tags.join(',') : ''} ${art.description || ''}`;
  const theme = matchThemeByText(hay);
  if (!theme) return '';
  const badge = CULTURE_BADGES[theme.themeId] || {};
  return `
    <div class="lb-culture-hint" data-culture-theme="${theme.themeId}" role="button" tabindex="0"
         style="margin-top:10px;padding:8px 12px;border-radius:10px;cursor:pointer;font-size:.8rem;
                background:rgba(124,58,237,.1);border:1px solid rgba(124,58,237,.3);display:inline-flex;align-items:center;gap:8px;">
      <span style="font-size:1.05rem;">${_iconHtml(badge.icon || '📜')}</span>
      <span>属于「${_esc(theme.name)}」文化主题 · 去图鉴读懂它 <i class="fa-solid fa-arrow-right"></i></span>
    </div>`;
}

// ------------------------------------------------------------
// 路由
// ------------------------------------------------------------
function isAtlasHash() {
  return /^#\/atlas(?:\?.*)?$/.test(window.location.hash || '');
}

function openFromHash() {
  if (!isAtlasHash()) { closeAtlas(); return; }
  const m = (window.location.hash || '').match(/[?&]theme=([\w-]+)/);
  const themeId = m ? m[1] : null;
  if (overlayEl && themeId && themeId !== currentThemeId) { _openDetail(themeId); return; }
  if (!overlayEl) {
    openAtlas();
    if (themeId) _openDetail(themeId);
  }
}

window.CultureAtlas = { openAtlas, closeAtlas, openFromHash, themeHint };

export { openAtlas, closeAtlas, openFromHash, isAtlasHash, themeHint };
