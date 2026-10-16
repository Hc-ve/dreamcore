// ============================================================
// js/share-poster.js — P0-2 通用分享海报模块
// 功能: generatePoster(opts) 900×1200 Canvas 海报 → PNG dataURL
//       showPosterModal(dataURL) 海报预览弹窗（下载/关闭）
//       downloadPoster(opts) 生成 + 预览一步完成
// 布局: 品牌头（雾紫渐变 #ffd1e8→#c9b6ff）+ 主体图（contain 圆角阴影）
//       + 信息区（标题/作者/主题/角标）+ 底部二维码（约 180px，失败降级纯色块）
// 复用: 画廊灯箱 / 文创结果页 / 足迹徽章墙（window.SharePoster 全局可用）
// ============================================================

const POSTER_W = 900;
const POSTER_H = 1200;
const DEFAULT_QR_URL = 'https://dreamcore.art/';
const DEFAULT_SLOGAN = '在 Dreamcore，遇见文化的梦境新生';
const FONT_TEXT = '"Microsoft YaHei", "PingFang SC", sans-serif';
const FONT_EMOJI = '"Segoe UI Emoji", "Microsoft YaHei", sans-serif';
// 青绿点缀（文化功能色 #34d399 的加深档，保证浅底可读）
const ACCENT_TEAL = '#0fa378';

let _QRCode = null;        // qrcode 模块缓存（懒加载，参照 share.js）
let _activeModal = null;
let _escHandler = null;

// ------------------------------------------------------------
// 样式自注入（参照 ai-score-page.js _injectStyle 模式）
// ------------------------------------------------------------
function _injectStyle() {
  if (document.getElementById('share-poster-style')) return;
  const st = document.createElement('style');
  st.id = 'share-poster-style';
  st.textContent = `
    /* --- 海报预览弹窗 --- */
    .share-poster-overlay {
      position: fixed; inset: 0; z-index: 1100;
      background: rgba(26, 16, 51, .62);
      backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
      display: flex; align-items: center; justify-content: center;
      padding: 20px; opacity: 0; visibility: hidden;
      transition: opacity .3s, visibility .3s;
    }
    .share-poster-overlay.open { opacity: 1; visibility: visible; }
    .sp-poster-box {
      position: relative; display: flex; flex-direction: column;
      width: min(420px, 94vw); max-height: 90vh; padding: 20px;
      border-radius: var(--radius, 20px);
      background: var(--glass-bg, rgba(30, 20, 55, .92));
      border: 1px solid var(--glass-border, rgba(201, 182, 255, .35));
      box-shadow: 0 30px 80px rgba(10, 5, 30, .6);
      transform: translateY(24px) scale(.96);
      transition: transform .35s cubic-bezier(.2, .7, .3, 1);
    }
    .share-poster-overlay.open .sp-poster-box { transform: none; }
    .sp-poster-close {
      position: absolute; top: 12px; right: 12px; width: 34px; height: 34px;
      border-radius: 50%; border: 1px solid var(--glass-border, rgba(201,182,255,.35));
      background: rgba(255,255,255,.06); color: var(--text-primary, #eee);
      font-size: 14px; cursor: pointer; z-index: 10; transition: all .3s;
    }
    .sp-poster-close:hover { background: rgba(255,143,177,.2); transform: rotate(90deg); }
    .sp-poster-head {
      display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
      padding-right: 42px; font-size: 1.05rem; font-weight: 700; color: #ffd1e8;
    }
    .sp-poster-scroll { flex: 1; min-height: 0; overflow-y: auto; border-radius: 14px; }
    .sp-poster-img { display: block; width: 100%; height: auto; border-radius: 14px; }
    .sp-poster-actions { margin-top: 14px; }
    .sp-poster-download {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      width: 100%; padding: 12px; border-radius: 999px; text-decoration: none;
      background: linear-gradient(135deg, #ffd1e8, #c9b6ff);
      color: #3b2a5d; font-weight: 700; font-size: 15px; transition: filter .2s;
    }
    .sp-poster-download:hover { filter: brightness(1.06); }
    /* --- 灯箱操作区容纳新增「分享卡」按钮（窄屏换行防溢出） --- */
    .lb-actions { flex-wrap: wrap; row-gap: 10px; }
  `;
  document.head.appendChild(st);
}

// ------------------------------------------------------------
// 基础绘制工具
// ------------------------------------------------------------
function _roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function _truncText(ctx, text, maxW) {
  let t = String(text == null ? '' : text);
  if (ctx.measureText(t).width <= maxW) return t;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

function _softCircle(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

// ------------------------------------------------------------
// 图片加载：url（crossOrigin）/ HTMLImageElement（decode 就绪）/ Canvas 直用
// 返回 null 表示不可用（调用方降级占位，不抛错阻塞导出）
// ------------------------------------------------------------
async function _loadImage(image) {
  if (!image) return null;
  if (typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement) {
    return image;
  }
  if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement) {
    try { await image.decode(); } catch (_) { /* 已就绪或损坏，交由下方判断 */ }
    return (image.complete && image.naturalWidth > 0) ? image : null;
  }
  if (typeof image === 'string') {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
      img.src = image;
    });
    try { await img.decode(); } catch (_) { /* 忽略，下方兜底 */ }
    return (img.complete && img.naturalWidth > 0) ? img : null;
  }
  return null;
}

// ------------------------------------------------------------
// 二维码（qrcode npm 包，懒加载；任何失败都降级，不阻塞导出）
// ------------------------------------------------------------
async function _getQRCode() {
  if (_QRCode) return _QRCode;
  try {
    const mod = await import('qrcode');
    _QRCode = (mod && typeof mod.toDataURL === 'function') ? mod : (mod && mod.default);
  } catch (err) {
    console.warn('[SharePoster] qrcode 库加载失败，二维码将降级为文字块:', err);
  }
  return _QRCode;
}

async function _buildQRImage(qrUrl) {
  const QR = await _getQRCode();
  if (!QR || typeof QR.toDataURL !== 'function') return null;
  try {
    const dataUrl = await QR.toDataURL(qrUrl, {
      width: 360,           // 2x 生成，缩绘至 180px 保证清晰
      margin: 2,
      color: { dark: '#3b2a5d', light: '#ffffff' }
    });
    return await _loadImage(dataUrl);
  } catch (err) {
    console.warn('[SharePoster] 二维码生成失败，降级为文字块:', err);
    return null;
  }
}

// ------------------------------------------------------------
// 海报各区块绘制
// ------------------------------------------------------------
function _drawBackground(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, POSTER_H);
  g.addColorStop(0, '#fdf7fc');
  g.addColorStop(0.5, '#f5efff');
  g.addColorStop(1, '#ece6ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);
  // 梦核柔光点缀
  _softCircle(ctx, 110, 1060, 170, 'rgba(255,209,232,.5)');
  _softCircle(ctx, 820, 890, 110, 'rgba(201,182,255,.4)');
}

function _drawBrandHeader(ctx) {
  const g = ctx.createLinearGradient(0, 0, POSTER_W, 0);
  g.addColorStop(0, '#ffd1e8');
  g.addColorStop(1, '#c9b6ff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, POSTER_W, 150);

  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(150,100,200,.35)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 56px ${FONT_TEXT}`;
  ctx.fillText('Dreamcore', POSTER_W / 2, 78);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  ctx.font = `24px ${FONT_TEXT}`;
  ctx.fillText('梦核文创 · AI + 文旅文创艺术共创社区', POSTER_W / 2, 118);
}

function _drawMainImage(ctx, img) {
  const boxX = 60, boxY = 175, boxW = 780, boxH = 590;
  // 白色底卡 + 柔和阴影
  ctx.save();
  ctx.shadowColor = 'rgba(105,75,165,.3)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 14;
  _roundRectPath(ctx, boxX, boxY, boxW, boxH, 24);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();

  ctx.save();
  _roundRectPath(ctx, boxX, boxY, boxW, boxH, 24);
  ctx.clip();
  if (img) {
    // contain 适配居中
    ctx.fillStyle = '#f6f1fc';
    ctx.fillRect(boxX, boxY, boxW, boxH);
    const s = Math.min(boxW / img.width, boxH / img.height);
    const w = img.width * s, h = img.height * s;
    ctx.drawImage(img, boxX + (boxW - w) / 2, boxY + (boxH - h) / 2, w, h);
  } else {
    // 图片缺失/加载失败：梦核渐变占位（不阻塞导出）
    const g = ctx.createLinearGradient(boxX, boxY, boxX + boxW, boxY + boxH);
    g.addColorStop(0, '#ffd1e8');
    g.addColorStop(1, '#c9b6ff');
    ctx.fillStyle = g;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(59,42,93,.55)';
    ctx.font = `64px ${FONT_EMOJI}`;
    ctx.fillText('🎨', boxX + boxW / 2, boxY + boxH / 2 - 6);
    ctx.font = `26px ${FONT_TEXT}`;
    ctx.fillText('Dreamcore · 梦核文创', boxX + boxW / 2, boxY + boxH / 2 + 44);
  }
  ctx.restore();
}

function _drawBadge(ctx, badge) {
  const text = String(badge || '').trim();
  if (!text) return;
  const boxX = 60, boxY = 175, boxW = 780;
  ctx.save();
  ctx.font = `bold 26px ${FONT_TEXT}`;
  const tw = ctx.measureText(text).width;
  const pillW = Math.min(tw + 44, 700);
  const pillH = 52;
  const x = boxX + boxW - pillW - 20;
  const y = boxY + 20;
  ctx.shadowColor = 'rgba(30,15,60,.35)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  _roundRectPath(ctx, x, y, pillW, pillH, 26);
  ctx.fillStyle = 'rgba(59,42,93,.85)';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + pillW / 2, y + pillH / 2 + 2);
  ctx.restore();
}

function _drawInfo(ctx, { title, author, themeTag }) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#3b2a5d';
  ctx.font = `bold 46px ${FONT_TEXT}`;
  ctx.fillText(_truncText(ctx, title || '未命名作品', 780), POSTER_W / 2, 845);

  const parts = [];
  if (author) parts.push({ t: `by ${author}`, c: '#8a7ab0' });
  if (themeTag) parts.push({ t: `#${themeTag}`, c: ACCENT_TEAL });
  if (parts.length > 0) {
    ctx.font = `26px ${FONT_TEXT}`;
    const gap = 36;
    let total = 0;
    for (let i = 0; i < parts.length; i++) {
      total += ctx.measureText(parts[i].t).width + (i > 0 ? gap : 0);
    }
    let x = (POSTER_W - total) / 2;
    ctx.textAlign = 'left';
    for (const p of parts) {
      ctx.fillStyle = p.c;
      ctx.fillText(p.t, x, 893);
      x += ctx.measureText(p.t).width + gap;
    }
    ctx.textAlign = 'center';
  }
}

function _drawQRArea(ctx, qrImg, qrUrl) {
  const cardX = 350, cardY = 912, cardS = 200;
  ctx.save();
  ctx.shadowColor = 'rgba(120,90,180,.3)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 10;
  _roundRectPath(ctx, cardX, cardY, cardS, cardS, 18);
  ctx.fillStyle = qrImg ? '#ffffff' : '#c9b6ff';
  ctx.fill();
  ctx.restore();

  if (qrImg) {
    ctx.drawImage(qrImg, 360, 922, 180, 180);
  } else {
    // 降级：纯色块 + 站点文字（不阻塞导出）
    let host = qrUrl || DEFAULT_QR_URL;
    try { host = new URL(host).hostname || host; } catch (_) { /* 保持原样 */ }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 30px ${FONT_TEXT}`;
    ctx.fillText(_truncText(ctx, host, 170), cardX + cardS / 2, cardY + cardS / 2 - 12);
    ctx.font = `20px ${FONT_TEXT}`;
    ctx.fillText('扫码访问', cardX + cardS / 2, cardY + cardS / 2 + 26);
    ctx.textBaseline = 'alphabetic';
  }
}

function _drawFooterText(ctx, { slogan, footerCta }) {
  const hasCta = !!footerCta;
  if (slogan) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5a4a82';
    ctx.font = `24px ${FONT_TEXT}`;
    ctx.fillText(_truncText(ctx, slogan, 800), POSTER_W / 2, hasCta ? 1148 : 1168);
  }
  if (hasCta) {
    ctx.textAlign = 'center';
    ctx.fillStyle = ACCENT_TEAL;
    ctx.font = `bold 23px ${FONT_TEXT}`;
    ctx.fillText(_truncText(ctx, footerCta, 800), POSTER_W / 2, 1182);
  }
}

// ------------------------------------------------------------
// API: generatePoster(opts) → Promise<PNG dataURL>
// opts = { image, title, author?, slogan?, badge?, themeTag?, qrUrl?, footerCta? }
// ------------------------------------------------------------
async function generatePoster(opts = {}) {
  const {
    image = null,
    title = '未命名作品',
    author = '',
    slogan = DEFAULT_SLOGAN,
    badge = '',
    themeTag = '',
    qrUrl = DEFAULT_QR_URL,
    footerCta = ''
  } = opts;

  // 主体图与二维码并行就绪（各自内部降级，不会 reject）
  const [img, qrImg] = await Promise.all([
    _loadImage(image),
    _buildQRImage(qrUrl)
  ]);

  const cv = document.createElement('canvas');
  cv.width = POSTER_W;
  cv.height = POSTER_H;
  const ctx = cv.getContext('2d');

  _drawBackground(ctx);
  _drawBrandHeader(ctx);
  _drawMainImage(ctx, img);
  _drawBadge(ctx, badge);
  _drawInfo(ctx, { title, author, themeTag });
  _drawQRArea(ctx, qrImg, qrUrl);
  _drawFooterText(ctx, { slogan, footerCta });

  return cv.toDataURL('image/png');
}

// ------------------------------------------------------------
// API: 海报预览弹窗
// ------------------------------------------------------------
function closePosterModal() {
  if (_escHandler) {
    document.removeEventListener('keydown', _escHandler);
    _escHandler = null;
  }
  if (!_activeModal) return;
  const modal = _activeModal;
  _activeModal = null;
  modal.classList.remove('open');
  setTimeout(() => modal.remove(), 300);
  if (window.ModalScrollLock) ModalScrollLock.unlock();
}

function showPosterModal(dataURL) {
  if (!dataURL || typeof dataURL !== 'string') return null;
  _injectStyle();
  closePosterModal();

  const overlay = document.createElement('div');
  overlay.className = 'share-poster-overlay';
  overlay.id = 'share-poster-modal';
  overlay.innerHTML = `
    <div class="sp-poster-box" role="dialog" aria-label="分享海报预览">
      <button class="sp-poster-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
      <div class="sp-poster-head"><i class="fa-solid fa-qrcode"></i><span>作品分享海报</span></div>
      <div class="sp-poster-scroll">
        <img class="sp-poster-img" src="${dataURL}" alt="分享海报预览" />
      </div>
      <div class="sp-poster-actions">
        <a class="sp-poster-download" download="dreamcore-share.png" href="${dataURL}">
          <i class="fa-solid fa-download"></i> 下载海报
        </a>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  _activeModal = overlay;
  if (window.ModalScrollLock) ModalScrollLock.lock();
  requestAnimationFrame(() => overlay.classList.add('open'));

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-close]')) closePosterModal();
  });
  _escHandler = (e) => {
    if (e.key === 'Escape') closePosterModal();
  };
  document.addEventListener('keydown', _escHandler);
  return overlay;
}

// ------------------------------------------------------------
// API: downloadPoster(opts) → 生成 + 弹预览（失败 toast 不抛出）
// ------------------------------------------------------------
async function downloadPoster(opts) {
  try {
    const dataURL = await generatePoster(opts);
    showPosterModal(dataURL);
    if (window.showToast) window.showToast('🖼 分享海报已生成，点击「下载海报」保存', 'success');
    return dataURL;
  } catch (err) {
    console.error('[SharePoster] 海报生成失败:', err);
    if (window.showToast) window.showToast('分享海报生成失败，请重试', 'error');
    return null;
  }
}

// ------------------------------------------------------------
// 导出：window 全局（供足迹/文创等非模块调用）+ ES Module
// ------------------------------------------------------------
const SharePoster = { generatePoster, showPosterModal, closePosterModal, downloadPoster };
window.SharePoster = SharePoster;

_injectStyle(); // 模块加载即注入（含灯箱操作区换行样式，保证新增按钮三端不溢出）

export default SharePoster;
export { SharePoster, generatePoster, showPosterModal, closePosterModal, downloadPoster };
