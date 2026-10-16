// ============================================================
// js/ai-score-page.js — M6a-3 AI评分独立页
// 路由 #/score：双 Tab（上传新照片 / 选择已发布作品）进行 AI 评级分析
// 设计原则：纯原生 DOM + 内联样式注入，复用 ai-aesthetic 评分链路
// 依赖：./ai-aesthetic.js（scoreImage / scoreArtwork / renderAestheticReport）
// ============================================================

import { scoreImage, scoreArtwork, renderAestheticReport } from './ai-aesthetic.js';

let overlayEl = null;
let currentFile = null;

const TIER_META = {
  sss: { zh: '顶级神作', en: 'SSS', color: '#ffd700' },
  ss:  { zh: '大师级',   en: 'SS',  color: '#fbbf24' },
  s:   { zh: '优秀',     en: 'S',   color: '#f59e0b' },
  a:   { zh: '良好',     en: 'A',   color: '#c084fc' },
  b:   { zh: '合格',     en: 'B',   color: '#38bdf8' },
  c:   { zh: '待提升',   en: 'C',   color: '#cbd5e1' }
};

function _injectStyle() {
  if (document.getElementById('ai-score-page-style')) return;
  const st = document.createElement('style');
  st.id = 'ai-score-page-style';
  st.textContent = `
    .score-page-box { max-width: 720px; width: 92%; max-height: 88vh; overflow-y: auto; padding: 28px; }
    .sp-title { margin: 0 0 4px; font-size: 1.4rem; }
    .sp-sub { margin: 0 0 18px; font-size: 0.88rem; opacity: .75; }
    .sp-tabs { display: flex; gap: 8px; margin-bottom: 18px; }
    .sp-tab { flex: 1; padding: 10px; border-radius: 10px; border: 1.5px solid var(--border-color, rgba(255,255,255,.14)); background: transparent; color: var(--text, #eee); font-size: .95rem; cursor: pointer; transition: all .2s; }
    .sp-tab.active { border-color: var(--dream-violet, #7c3aed); background: rgba(124,58,237,.18); font-weight: 700; }
    .sp-dropzone { border: 2px dashed var(--border-color, rgba(255,255,255,.2)); border-radius: 14px; padding: 30px 16px; text-align: center; cursor: pointer; margin-bottom: 14px; transition: border-color .2s; }
    .sp-dropzone:hover { border-color: var(--dream-violet, #7c3aed); }
    .sp-dropzone img { max-width: 100%; max-height: 260px; border-radius: 10px; }
    .sp-result { margin-top: 16px; }
    .sp-badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 18px; border-radius: 22px; font-weight: 800; font-size: 1.05rem; color: #fff; text-shadow: 0 1px 4px rgba(0,0,0,.4); }
    .sp-dim { display: flex; align-items: center; gap: 10px; margin: 8px 0; font-size: .85rem; }
    .sp-dim-label { width: 56px; flex: none; opacity: .8; }
    .sp-dim-bar { flex: 1; height: 8px; border-radius: 4px; background: rgba(125,125,155,.25); overflow: hidden; }
    .sp-dim-fill { height: 100%; border-radius: 4px; background: linear-gradient(90deg, #7c3aed, #c026d3); }
    .sp-dim-val { width: 36px; text-align: right; flex: none; font-weight: 600; }
    .sp-loading { text-align: center; padding: 26px 0; font-size: .95rem; }
    .sp-hint { margin-top: 10px; font-size: .82rem; opacity: .65; }
  `;
  document.head.appendChild(st);
}

function _esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c]));
}

function openScore() {
  if (overlayEl) return;
  _injectStyle();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'score-page';
  overlay.innerHTML = `
    <div class="modal-box score-page-box glass">
      <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
      <h2 class="sp-title">AI 智能评分</h2>
      <p class="sp-sub">五维度美学分析 · 六等级定级（SSS / SS / S / A / B / C）</p>
      <div class="sp-tabs">
        <button class="sp-tab active" data-tab="upload">上传新照片</button>
        <button class="sp-tab" data-tab="mine">已发布作品</button>
      </div>
      <div class="sp-panel" data-panel="upload">
        <input type="file" id="sp-file" accept="image/jpeg,image/png,image/webp" hidden />
        <div class="sp-dropzone" id="sp-dropzone">
          <div id="sp-dz-placeholder"><i class="fa-solid fa-cloud-arrow-up" style="font-size:1.6rem;opacity:.6;"></i><p style="margin:8px 0 0;font-size:.9rem;">点击上传照片（JPG / PNG / WEBP，&lt;5MB）</p></div>
        </div>
        <button type="button" class="btn-primary btn-block" id="sp-score-btn" disabled>
          <i class="fa-solid fa-wand-magic-sparkles"></i> 开始 AI 评分</button>
        <div class="sp-result" id="sp-upload-result"></div>
      </div>
      <div class="sp-panel" data-panel="mine" style="display:none;">
        <button type="button" class="btn-primary btn-block" id="sp-pick-btn">
          <i class="fa-solid fa-images"></i> 选择已发布作品</button>
        <div class="sp-result" id="sp-mine-result"><p class="sp-hint">选择作品后查看其 AI 评分报告，也可重新评分。</p></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlayEl = overlay;
  if (window.ModalScrollLock) ModalScrollLock.lock();
  requestAnimationFrame(() => overlay.classList.add('open'));

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-close]')) closeScore();
  });

  // Tab 切换
  overlay.querySelectorAll('.sp-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      overlay.querySelectorAll('.sp-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      overlay.querySelectorAll('.sp-panel').forEach(p => {
        p.style.display = p.dataset.panel === tab.dataset.tab ? '' : 'none';
      });
      if (typeof Sound !== 'undefined') Sound.playSound('click');
    });
  });

  // 上传 Tab
  const dz = overlay.querySelector('#sp-dropzone');
  const fileInput = overlay.querySelector('#sp-file');
  const scoreBtn = overlay.querySelector('#sp-score-btn');
  dz.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) _handleFile(e.target.files[0], dz, scoreBtn);
  });
  scoreBtn.addEventListener('click', () => _scoreUpload());

  // 已发布作品 Tab
  overlay.querySelector('#sp-pick-btn').addEventListener('click', () => {
    if (typeof Sound !== 'undefined') Sound.playSound('click');
    if (window.Gallery && Gallery.openArtworkPicker) {
      Gallery.openArtworkPicker((id) => _renderMineReport(id), '选择作品进行 AI 评分');
    }
  });
}

function _handleFile(file, dz, scoreBtn) {
  const err = null;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { alert('仅支持 JPG / PNG / WEBP 图片'); return; }
  if (file.size > 5 * 1024 * 1024) { alert('图片不能超过 5MB'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    currentFile = { file, dataUrl: e.target.result };
    dz.innerHTML = '<img src="' + currentFile.dataUrl + '" alt="预览" />';
    scoreBtn.disabled = false;
    if (typeof Sound !== 'undefined') Sound.playSound('click');
  };
  reader.readAsDataURL(file);
}

function _gradeOf(res) {
  const g = res && res.grade;
  const key = g && g.key ? g.key : String(g || 'b').toLowerCase();
  return TIER_META[key] || TIER_META.b;
}

function _resultHtml(res) {
  const meta = _gradeOf(res);
  const sc = (res && res.scores) || res || {};
  const total = Number(res && res.totalScore) || 0;
  const dims = [
    ['构图', sc.composition],
    ['光影', sc.lighting],
    ['色彩', sc.color],
    ['清晰度', sc.clarity],
    ['主题', sc.theme]
  ];
  const bars = dims.map(([label, v]) => {
    const val = Number(v) || 0;
    return '<div class="sp-dim"><span class="sp-dim-label">' + label + '</span><div class="sp-dim-bar"><div class="sp-dim-fill" style="width:' + (val * 10) + '%"></div></div><span class="sp-dim-val">' + val.toFixed(1) + '</span></div>';
  }).join('');
  const desc = res && res.aiDescription ? '<div style="margin-top:12px;background:var(--card-bg,rgba(255,255,255,.06));border-radius:10px;padding:12px;font-size:.85rem;line-height:1.6;opacity:.85;">' + _esc(res.aiDescription).replace(/AI辅助生成/g, '').trim() + '</div>' : '';
  const degradedNote = res && res.degraded ? '<p class="sp-hint">（AI 暂时不可用，已使用本地算法评分）</p>' : '';
  return '<div class="sp-badge" style="background:linear-gradient(135deg,' + meta.color + ',rgba(0,0,0,.25));border:1.5px solid ' + meta.color + ';box-shadow:0 4px 18px ' + meta.color + '55;">' + meta.en + ' · ' + meta.zh + '<span style="font-weight:500;opacity:.9;">⭐ ' + total.toFixed(1) + '</span></div>'
    + '<div style="margin-top:14px;">' + bars + '</div>' + desc + degradedNote;
}

async function _scoreUpload() {
  if (!currentFile) return;
  const resultEl = overlayEl.querySelector('#sp-upload-result');
  const scoreBtn = overlayEl.querySelector('#sp-score-btn');
  scoreBtn.disabled = true;
  scoreBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AI 分析中，约需 10-30 秒…';
  resultEl.innerHTML = '<div class="sp-loading"><i class="fa-solid fa-spinner fa-spin"></i> 正在进行五维度美学分析…</div>';
  try {
    const res = await scoreImage(currentFile.dataUrl, { title: currentFile.file.name.replace(/\.[^.]+$/, ''), tags: [], description: '' });
    resultEl.innerHTML = _resultHtml(res);
    if (typeof Sound !== 'undefined') Sound.playSound('success');
  } catch (err) {
    resultEl.innerHTML = '<p class="sp-hint" style="color:#f87171;">评分失败：' + _esc(err.message || err) + '</p>';
  } finally {
    scoreBtn.disabled = false;
    scoreBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 重新评分';
  }
}

async function _renderMineReport(id) {
  const box = overlayEl.querySelector('#sp-mine-result');
  if (!box) return;
  box.innerHTML = '<div class="sp-loading"><i class="fa-solid fa-spinner fa-spin"></i> 加载评分报告…</div>';
  try {
    box.innerHTML = '';
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;';
    actions.innerHTML = '<button type="button" class="btn-ghost" id="sp-rescore-btn" style="flex:1;padding:10px;"><i class="fa-solid fa-rotate"></i> 重新评分</button>';
    box.appendChild(actions);
    const reportRoot = await renderAestheticReport(Number(id), {});
    box.appendChild(reportRoot);
    actions.querySelector('#sp-rescore-btn').addEventListener('click', async () => {
      const btn = actions.querySelector('#sp-rescore-btn');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AI 重新评分中…';
      try {
        await scoreArtwork(Number(id), (window.currentUser && window.currentUser.id) || null);
        box.innerHTML = '';
        if (typeof Sound !== 'undefined') Sound.playSound('success');
        _renderMineReport(id);
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-rotate"></i> 重新评分（失败，重试）';
      }
    });
  } catch (err) {
    box.innerHTML = '<p class="sp-hint" style="color:#f87171;">加载失败：' + _esc(err.message || err) + '</p>';
  }
}

function closeScore() {
  if (!overlayEl) return;
  const el = overlayEl;
  overlayEl = null;
  currentFile = null;
  el.classList.remove('open');
  if (window.ModalScrollLock) ModalScrollLock.unlock();
  if (typeof Sound !== 'undefined') Sound.playSound('close');
  setTimeout(() => el.remove(), 260);
}

function isScoreHash() {
  return /^#\/score(?:\?.*)?$/.test(window.location.hash || '');
}

function openFromHash() {
  if (isScoreHash()) openScore();
  else closeScore();
}

window.AIScorePage = { openScore, closeScore, openFromHash };

export { openScore, closeScore, openFromHash, isScoreHash };