// ============================================================
// js/culture-scan.js — AI 文化识图页（"识"）
// 路由 #/scan：上传/拍摄图片 → /api/ai/vision-recognize 识别文化主体
//             → /api/ai/culture-story 生成文化故事（事实卡注入防幻觉）
//             → 「用这个主题创作文创」携带主题跳转文创工作台
// 防幻觉：讲解结果标注来源（平台知识库 / AI 生成仅供参考 + 纠错反馈）
// 足迹联动：识别命中主题 → recordFootprint('scan') + culture:footprint 事件
// ============================================================

import { getPublicArtworks, recordFootprint, saveMemory } from './db.js';
import { getThemeById, matchArtworksByTheme } from '../data/culture-knowledge.js';

let overlayEl = null;
let currentImage = null;   // { dataUrl }
let lastRecognition = null; // vision-recognize 响应
let lastStory = null;       // culture-story 响应

// ------------------------------------------------------------
// 样式注入
// ------------------------------------------------------------
function _injectStyle() {
  if (document.getElementById('culture-scan-style')) return;
  const st = document.createElement('style');
  st.id = 'culture-scan-style';
  st.textContent = `
    .scan-page-box { max-width: 760px; width: 92%; max-height: 88vh; overflow-y: auto; padding: 28px; }
    .cs-title { margin: 0 0 4px; font-size: 1.4rem; }
    .cs-sub { margin: 0 0 18px; font-size: .88rem; opacity: .75; }
    .cs-dropzone { border: 2px dashed var(--border-color, rgba(255,255,255,.2)); border-radius: 14px; padding: 34px 16px; text-align: center; cursor: pointer; margin-bottom: 14px; transition: border-color .2s, background .2s; }
    .cs-dropzone:hover, .cs-dropzone.dragover { border-color: var(--dream-violet, #7c3aed); background: rgba(124,58,237,.08); }
    .cs-dropzone img { max-width: 100%; max-height: 280px; border-radius: 10px; }
    .cs-actions { display: flex; gap: 10px; }
    .cs-actions .btn-primary { flex: 1; }
    .cs-loading { text-align: center; padding: 26px 0; font-size: .95rem; }
    .cs-card { margin-top: 18px; border-radius: 14px; padding: 18px; background: var(--card-bg, rgba(255,255,255,.06)); border: 1px solid var(--border-color, rgba(255,255,255,.1)); }
    .cs-subject { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .cs-subject-name { font-size: 1.25rem; font-weight: 800; }
    .cs-chip { display: inline-block; padding: 3px 12px; border-radius: 14px; font-size: .78rem; background: rgba(124,58,237,.2); border: 1px solid rgba(124,58,237,.4); }
    .cs-chip.gold { background: rgba(251,191,36,.16); border-color: rgba(251,191,36,.45); color: #fbbf24; }
    .cs-meta { margin: 8px 0 0; font-size: .85rem; opacity: .8; }
    .cs-desc { margin: 10px 0 0; font-size: .9rem; line-height: 1.7; opacity: .9; }
    .cs-story-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
    .cs-story-title { margin: 0; font-size: 1.1rem; font-weight: 800; }
    .cs-era { font-size: .82rem; opacity: .7; }
    .cs-story-body { margin: 12px 0 0; font-size: .92rem; line-height: 1.85; }
    .cs-story-body p { margin: 0 0 10px; }
    .cs-legend { margin: 12px 0 0; padding: 12px 14px; border-radius: 10px; background: rgba(251,191,36,.08); border-left: 3px solid #fbbf24; font-size: .88rem; line-height: 1.75; }
    .cs-legend-title { font-weight: 700; color: #fbbf24; margin-bottom: 4px; font-size: .85rem; }
    .cs-tts-row { margin-top: 12px; }
    .cs-tip { margin: 12px 0 0; padding: 12px 14px; border-radius: 10px; background: rgba(52,211,153,.08); border-left: 3px solid #34d399; font-size: .86rem; line-height: 1.7; }
    .cs-tip-title { font-weight: 700; color: #34d399; margin-bottom: 4px; font-size: .85rem; }
    .cs-source { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--border-color, rgba(255,255,255,.12)); flex-wrap: wrap; }
    .cs-source-badge { display: inline-flex; align-items: center; gap: 6px; font-size: .78rem; padding: 4px 12px; border-radius: 12px; }
    .cs-source-badge.kb { color: #34d399; background: rgba(52,211,153,.1); border: 1px solid rgba(52,211,153,.35); }
    .cs-source-badge.ai { color: #fbbf24; background: rgba(251,191,36,.1); border: 1px solid rgba(251,191,36,.35); }
    .cs-provider { font-size: .74rem; opacity: .6; }
    .cs-feedback-btn { font-size: .76rem; padding: 4px 12px; border-radius: 12px; border: 1px solid var(--border-color, rgba(255,255,255,.18)); background: transparent; color: var(--text, #eee); cursor: pointer; opacity: .8; }
    .cs-feedback-btn:hover { opacity: 1; border-color: var(--dream-violet, #7c3aed); }
    .cs-cta-row { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
    .cs-cta-row .btn-primary { flex: 1; min-width: 200px; }
    .cs-hint { margin-top: 10px; font-size: .82rem; opacity: .65; }
    .cs-error { margin-top: 12px; color: #f87171; font-size: .88rem; }
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
function openScan() {
  if (overlayEl) return;
  _injectStyle();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'culture-scan-page';
  overlay.innerHTML = `
    <div class="modal-box scan-page-box glass">
      <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
      <h2 class="cs-title"><i class="fa-solid fa-camera-retro"></i> AI 识文化</h2>
      <p class="cs-sub">拍下文物、建筑、纹样或非遗技艺，AI 识别文化主体并讲述背后的故事</p>

      <input type="file" id="cs-file" accept="image/jpeg,image/png,image/webp" hidden />
      <div class="cs-dropzone" id="cs-dropzone">
        <div id="cs-dz-placeholder">
          <i class="fa-solid fa-cloud-arrow-up" style="font-size:1.7rem;opacity:.6;"></i>
          <p style="margin:8px 0 4px;font-size:.92rem;">点击上传 / 拖拽图片到此处</p>
          <p style="margin:0;font-size:.78rem;opacity:.65;">支持 JPG / PNG / WEBP，&lt;5MB；手机端可直接调用相机</p>
        </div>
      </div>

      <div class="cs-actions">
        <button type="button" class="btn-primary" id="cs-recognize-btn" disabled>
          <i class="fa-solid fa-wand-magic-sparkles"></i> 开始识别</button>
        <button type="button" class="btn-ghost" id="cs-reset-btn" title="重新选择图片">
          <i class="fa-solid fa-rotate"></i></button>
      </div>

      <div id="cs-recognize-result"></div>
      <div id="cs-story-result"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlayEl = overlay;
  if (window.ModalScrollLock) ModalScrollLock.lock();
  requestAnimationFrame(() => overlay.classList.add('open'));

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-close]')) closeScan();
  });

  const dz = overlay.querySelector('#cs-dropzone');
  const fileInput = overlay.querySelector('#cs-file');
  const btn = overlay.querySelector('#cs-recognize-btn');
  dz.addEventListener('click', () => fileInput.click());
  ['dragover', 'dragenter'].forEach(ev => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('dragover'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('dragover'); }));
  dz.addEventListener('drop', (e) => {
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) _handleFile(f);
  });
  fileInput.addEventListener('change', (e) => { if (e.target.files[0]) _handleFile(e.target.files[0]); });
  btn.addEventListener('click', () => _recognize());
  overlay.querySelector('#cs-reset-btn').addEventListener('click', () => _reset());
}

function closeScan() {
  if (!overlayEl) return;
  const el = overlayEl;
  overlayEl = null;
  currentImage = null;
  lastRecognition = null;
  lastStory = null;
  el.classList.remove('open');
  if (window.ModalScrollLock) ModalScrollLock.unlock();
  if (typeof Sound !== 'undefined') Sound.playSound('close');
  setTimeout(() => el.remove(), 260);
}

function _reset() {
  currentImage = null;
  lastRecognition = null;
  lastStory = null;
  if (!overlayEl) return;
  overlayEl.querySelector('#cs-dropzone').innerHTML = `
    <div id="cs-dz-placeholder">
      <i class="fa-solid fa-cloud-arrow-up" style="font-size:1.7rem;opacity:.6;"></i>
      <p style="margin:8px 0 4px;font-size:.92rem;">点击上传 / 拖拽图片到此处</p>
      <p style="margin:0;font-size:.78rem;opacity:.65;">支持 JPG / PNG / WEBP，&lt;5MB；手机端可直接调用相机</p>
    </div>`;
  overlayEl.querySelector('#cs-recognize-btn').disabled = true;
  overlayEl.querySelector('#cs-recognize-result').innerHTML = '';
  overlayEl.querySelector('#cs-story-result').innerHTML = '';
}

// ------------------------------------------------------------
// 文件处理
// ------------------------------------------------------------
function _handleFile(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { alert('仅支持 JPG / PNG / WEBP 图片'); return; }
  if (file.size > 5 * 1024 * 1024) { alert('图片不能超过 5MB'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    currentImage = { dataUrl: e.target.result };
    lastRecognition = null;
    lastStory = null;
    const dz = overlayEl.querySelector('#cs-dropzone');
    dz.innerHTML = '<img src="' + currentImage.dataUrl + '" alt="待识别图片预览" />';
    overlayEl.querySelector('#cs-recognize-btn').disabled = false;
    overlayEl.querySelector('#cs-recognize-result').innerHTML = '';
    overlayEl.querySelector('#cs-story-result').innerHTML = '';
    if (typeof Sound !== 'undefined') Sound.playSound('click');
  };
  reader.readAsDataURL(file);
}

// ------------------------------------------------------------
// API 调用
// ------------------------------------------------------------
async function _postJson(path, body, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || 120000);
  try {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || ('请求失败 ' + r.status));
    return d;
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------
// 识别 + 讲解主流程
// ------------------------------------------------------------
async function _recognize() {
  if (!currentImage || !overlayEl) return;
  const btn = overlayEl.querySelector('#cs-recognize-btn');
  const recEl = overlayEl.querySelector('#cs-recognize-result');
  const storyEl = overlayEl.querySelector('#cs-story-result');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AI 识别中…';
  recEl.innerHTML = '<div class="cs-loading"><i class="fa-solid fa-spinner fa-spin"></i> 正在识别文化主体，正在重试，请稍候…</div>';
  storyEl.innerHTML = '';

  try {
    // ① 识图
    lastRecognition = await _postJson('/api/ai/vision-recognize', { image: currentImage.dataUrl }, 120000);
    recEl.innerHTML = _recognizeHtml(lastRecognition);
    if (typeof Sound !== 'undefined') Sound.playSound('success');

    // ② 足迹点亮（识别行为）：命中知识库主题才点亮
    if (lastRecognition.themeId) {
      try {
        const lit = await recordFootprint(_userId(), lastRecognition.themeId, 'scan', {
          sourceArtworkId: null,
          meta: { subject: lastRecognition.subject }
        });
        if (lit) {
          window.dispatchEvent(new CustomEvent('culture:footprint', {
            detail: { themeId: lastRecognition.themeId, action: 'scan', level: 'new' }
          }));
        }
      } catch (e) { console.warn('[CultureScan] 足迹记录失败（不阻塞）:', e && e.message); }
    }

    // ③ 讲解
    await _loadStory(storyEl);
  } catch (err) {
    recEl.innerHTML = '<p class="cs-error">识别失败：' + _esc(err.message || err) + '</p><p class="cs-hint">请检查网络后重试，或换一张更清晰的文化主体图片</p>';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 重新识别';
  }
}

function _recognizeHtml(rec) {
  if (/非文化主体/.test(rec.subject || '')) {
    return '<div class="cs-card"><div class="cs-subject"><span class="cs-subject-name">🤔 未识别出文化主体</span></div>'
      + '<p class="cs-desc">这张图片似乎与文化艺术主体无关。试试文物、古建筑、传统纹样、非遗技艺或戏曲服饰的图片吧。</p></div>';
  }
  const themeChip = rec.themeName
    ? '<span class="cs-chip gold"><i class="fa-solid fa-book-bookmark"></i> ' + _esc(rec.themeName) + '</span>'
    : '';
  return '<div class="cs-card">'
    + '<div class="cs-subject"><span class="cs-subject-name">' + _esc(rec.subject) + '</span>'
    + (rec.category ? '<span class="cs-chip">' + _esc(rec.category) + '</span>' : '') + themeChip + '</div>'
    + (rec.era ? '<p class="cs-meta"><i class="fa-regular fa-clock"></i> ' + _esc(rec.era) + '</p>' : '')
    + (rec.description ? '<p class="cs-desc">' + _esc(rec.description) + '</p>' : '')
    + '</div>';
}

async function _loadStory(storyEl) {
  const rec = lastRecognition;
  if (!rec) return;
  const isTheme = !!rec.themeId;
  storyEl.innerHTML = '<div class="cs-loading"><i class="fa-solid fa-spinner fa-spin"></i> 正在生成文化故事'
    + (isTheme ? '（依据平台文化知识库）' : '') + '，正在重试，请稍候…</div>';
  try {
    lastStory = await _postJson('/api/ai/culture-story', {
      themeId: rec.themeId || undefined,
      subject: rec.subject,
      description: rec.description
    }, 150000);
    storyEl.innerHTML = _storyHtml(lastStory);
    if (typeof Sound !== 'undefined') Sound.playSound('success');
  } catch (err) {
    storyEl.innerHTML = '<p class="cs-error">故事生成失败：' + _esc(err.message || err) + '</p>';
  }
}

function _providerLabel(story) {
  if (story.provider === 'self-trained') return '⚡ 自研微调模型 DreamCraft-1.5B';
  const map = { dashscope: '云端大模型 qwen', deepseek: 'DeepSeek', mimo: 'MiMo' };
  return map[story.provider] || story.provider || '';
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
    era ? '<span class="trace-chip"><i class="fa-regular fa-clock"></i> <em title="' + _esc(era) + '">' + _esc(era) + '</em></span>' : '',
    region ? '<span class="trace-chip"><i class="fa-solid fa-location-dot"></i> <em title="' + _esc(region) + '">' + _esc(region) + '</em></span>' : ''
  ].join('');
  const factList = facts.map(f => '<li>' + _esc(f) + '</li>').join('');
  return '<div class="trace-card ' + (isCore ? 'kb' : 'ai') + '">'
    + '<div class="trace-head">'
    + (isCore
      ? '<span class="trace-badge"><i class="fa-solid fa-database"></i> 📋 平台知识库</span>'
      : '<span class="trace-badge"><i class="fa-solid fa-globe"></i> 🌐 AI 联网生成</span>')
    + '<a class="trace-link" href="#/atlas?theme=' + _esc(story.themeId) + '">查看完整知识卡 →</a>'
    + '</div>'
    + '<div class="trace-theme">' + _esc(name) + '</div>'
    + (chips ? '<div class="trace-chips">' + chips + '</div>' : '')
    + (factList ? '<ul class="trace-facts">' + factList + '</ul>' : '')
    + (isCore ? '' : '<p class="trace-note"><i class="fa-solid fa-triangle-exclamation"></i> 本卡内容为 AI 联网搜索生成，仅供参考</p>')
    + '</div>';
}

function _storyHtml(story) {
  const paras = String(story.connotation || '').split(/\n+/).filter(Boolean)
    .map(p => '<p>' + _esc(p) + '</p>').join('');
  const kb = story.knowledgeBase;
  const sourceBadge = kb
    ? '<span class="cs-source-badge kb"><i class="fa-solid fa-circle-check"></i> 依据平台文化知识库</span>'
    : '<span class="cs-source-badge ai"><i class="fa-solid fa-triangle-exclamation"></i> AI 生成，仅供参考</span>';
  const theme = story.themeId ? getThemeById(story.themeId) : null;
  const cta = theme
    ? '<div class="cs-cta-row">'
      + '<button type="button" class="btn-primary" id="cs-craft-btn"><i class="fa-solid fa-feather-pointed"></i> 用「' + _esc(theme.name) + '」主题创作文创</button>'
      + '<button type="button" class="btn-ghost" id="cs-atlas-btn"><i class="fa-solid fa-map-location-dot"></i> 查看文化图鉴</button>'
      + '</div>'
    : '';
  // 云端 TTS 语音讲解（CosyVoice，tts-player.js 全局委托接管 .tts-btn）
  const ttsText = (story.name || '') + '。' + String(story.connotation || '').replace(/\n+/g, ' ') + '。典故：' + (story.legend || '');
  const ttsBtn = '<div class="cs-tts-row"><button type="button" class="btn-ghost tts-btn" data-tts-text="' + _esc(ttsText) + '"><i class="fa-solid fa-volume-high"></i> 语音讲解</button></div>';
  return '<div class="cs-card">'
    + '<div class="cs-story-head"><h3 class="cs-story-title">' + _esc(story.name) + '</h3>'
    + '<span class="cs-era">' + _esc(story.era) + '</span></div>'
    + '<div class="cs-story-body">' + paras + '</div>'
    + '<div class="cs-legend"><div class="cs-legend-title"><i class="fa-solid fa-book-open"></i> 典故</div>' + _esc(story.legend) + '</div>'
    + '<div class="cs-tip"><div class="cs-tip-title"><i class="fa-solid fa-lightbulb"></i> 文创创作建议</div>' + _esc(story.creationTip) + '</div>'
    + ttsBtn
    + _traceCardHtml(story)
    + '<div class="cs-source">' + sourceBadge
    + '<span class="cs-provider">讲解模型：' + _esc(_providerLabel(story)) + '</span>'
    + (kb ? '' : '<button type="button" class="cs-feedback-btn" id="cs-feedback-btn"><i class="fa-solid fa-flag"></i> 内容纠错反馈</button>')
    + '</div>'
    + cta
    + '</div>';
}

// ------------------------------------------------------------
// CTA 事件委托：创作文创 / 查看图鉴 / 纠错反馈
// ------------------------------------------------------------
function bindScanEvents() {
  // 故事卡片中的按钮在 _loadStory 后动态插入，用事件委托统一处理
  document.addEventListener('click', async (e) => {
    const craftBtn = e.target.closest('#cs-craft-btn');
    if (craftBtn) { e.preventDefault(); await _goCraft(); return; }
    const atlasBtn = e.target.closest('#cs-atlas-btn');
    if (atlasBtn) { e.preventDefault(); closeScan(); location.hash = '#/atlas'; return; }
    const fbBtn = e.target.closest('#cs-feedback-btn');
    if (fbBtn) { e.preventDefault(); await _sendFeedback(fbBtn); }
  });
}
let eventsBound = false;
function ensureEvents() { if (!eventsBound) { eventsBound = true; bindScanEvents(); } }

/** 用主题跳转文创工作台：匹配画廊主题作品 → hash 跳转 → 预填灵感输入框 */
async function _goCraft() {
  const story = lastStory || {};
  const themeId = story.themeId;
  if (!themeId) return;
  const theme = getThemeById(themeId);
  if (!theme) return;

  // 匹配画廊中该主题的作品作为文创底图
  let artworkId = null;
  try {
    // 对外展示：仅从公开可见作品中选文创底图（下架/逻辑删除/待审核不参与）
    const all = await getPublicArtworks();
    const matched = matchArtworksByTheme(all, themeId);
    if (matched.length > 0) {
      // 优先高清高清度高的作品（views 高 → 更可能代表性）
      matched.sort((a, b) => (b.views || 0) - (a.views || 0));
      artworkId = matched[0].id;
    }
  } catch (e) { /* 匹配失败不阻塞跳转 */ }

  if (artworkId == null) {
    if (window.showToast) showToast('画廊中暂无「' + theme.name + '」主题作品，先去逛逛画廊找灵感吧', 'warn');
    closeScan();
    location.hash = '#gallery';
    return;
  }

  const idea = story.creationTip || ('以' + theme.name + '为主题，设计一款融合传统元素与现代审美的文创衍生品');
  closeScan();
  location.hash = '#/craft?artworkId=' + artworkId;
  // 工作台经 hashchange 异步挂载（约 300-900ms），轮询预填灵感输入框
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    const el = document.getElementById('craft-idea-input');
    if (el) {
      el.value = idea;
      clearInterval(timer);
      el.focus();
    } else if (tries > 30) {
      clearInterval(timer);
    }
  }, 300);
}

/** 纠错反馈：记录到本地 AI 记忆（type: culture-feedback），供后续知识库增补 */
async function _sendFeedback(btn) {
  const story = lastStory || {};
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-check"></i> 已收到反馈';
  try {
    await saveMemory(_userId(), 'culture-feedback',
      `识图纠错：${(lastRecognition && lastRecognition.subject) || ''}（${story.name || ''}）`,
      { themeId: story.themeId || null, subject: lastRecognition && lastRecognition.subject, description: lastRecognition && lastRecognition.description });
  } catch (e) { /* 记录失败不影响反馈确认 */ }
  if (window.showToast) showToast('感谢反馈！我们会据此核实并增补文化知识库', 'success');
}

// ------------------------------------------------------------
// 路由
// ------------------------------------------------------------
function isScanHash() {
  return /^#\/scan(?:\?.*)?$/.test(window.location.hash || '');
}

function openFromHash() {
  ensureEvents();
  if (isScanHash()) openScan();
  else closeScan();
}

window.CultureScan = { openScan, closeScan, openFromHash };

export { openScan, closeScan, openFromHash, isScanHash };
