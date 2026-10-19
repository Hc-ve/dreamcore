// ============================================================
// js/ai-curate.js — M4 AI 智能策展模块
// 职责：
//   1. 按非遗/地域/季节光影主题聚类作品生成 3-5 个展馆
//   2. 主题聚类算法（tags/description 关键词匹配 + AI 评分维度）
//   3. Canvas 展馆封面合成（3-4 张作品拼贴 + 主题文字）
//   4. 草稿/发布状态管理（curated_halls 表）
//   5. 路由 #/curate（列表页）+ #/curate?hallId=xxx（详情页）
// 设计原则：
//   1. 纯原生 DOM + Canvas 2D，不引入第三方 UI/绘图库
//   2. AI 生成内容显式标注"✨ AI辅助生成"（DOM 徽章 + Canvas 水印）
//   3. 离开路由时完整清理（Canvas / 事件监听器 / RAF）
// 依赖：./db.js（curated_halls CRUD + getPublicArtworks + getArtworkById）
// ============================================================

import {
  addCuratedHall,
  getCuratedHall,
  getCuratedHallsByTheme,
  updateCuratedHall,
  deleteCuratedHall,
  getPublicArtworks,
  getArtworkById
} from './db.js';

// ------------------------------------------------------------
// 常量定义
// ------------------------------------------------------------

/**
 * 3 大策展主题
 * @property {string} key       - 主题标识
 * @property {string} label      - 中文标签
 * @property {string} desc       - 主题描述
 * @property {string[]} keywords - 关键词（用于匹配 tags/description）
 * @property {string} accent      - 主强调色
 * @property {string} bg         - 封面背景色
 */
const CURATE_THEMES = [
  { key: 'feiyi', label: '非遗', desc: '非物质文化遗产主题', keywords: ['非遗', '传统', '民俗', '手工艺', '刺绣', '剪纸', '陶瓷', '漆器', '竹编', '木雕'], accent: '#8e44ad', bg: '#fff8dc' },
  { key: 'region', label: '地域', desc: '地域风光主题', keywords: ['山水', '城市', '乡村', '地域', '江南', '塞北', '高原', '海岛', '古镇', '田野'], accent: '#16a085', bg: '#eafaf1' },
  { key: 'season', label: '季节光影', desc: '季节光影主题', keywords: ['春', '夏', '秋', '冬', '光影', '晨', '暮', '日出', '夕阳', '月色', '朝霞', '黄昏'], accent: '#d97706', bg: '#fff7ed' }
];

/** 每个展馆作品数量区间 */
const HALL_ARTWORK_MIN = 8;
const HALL_ARTWORK_MAX = 12;
/** 生成展馆数量区间 */
const HALL_COUNT_MIN = 3;
const HALL_COUNT_MAX = 5;
/** 封面 Canvas 尺寸（CSS 像素） */
const COVER_W = 480;
const COVER_H = 300;

// ------------------------------------------------------------
// 模块状态（openCurate/closeCurate 间复用，closeCurate 完整清理）
// ------------------------------------------------------------
/** 缓存的 DOM 引用 */
let domRefs = null;
/** 是否已挂载 */
let mounted = false;
/** 当前展馆列表 */
let hallsCache = [];
/** 当前详情页 hallId */
let currentHallId = null;
/** 节流用的 RAF id */
let coverRafId = 0;
/** resize 监听句柄 */
let resizeHandler = null;
/** esc 监听句柄 */
let escHandler = null;

// ------------------------------------------------------------
// SubTask 8.1: 工具函数（复用 ai-craft 模式）
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
 * 按目标矩形"cover"模式绘制图片（保持比例裁剪填充）
 */
function drawImageCover(ctx, img, dx, dy, dw, dh) {
  if (!img || !img.width) return;
  const sRatio = img.width / img.height;
  const dRatio = dw / dh;
  let sx, sy, sw, sh;
  if (sRatio > dRatio) {
    sh = img.height;
    sw = sh * dRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / dRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
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
 * HTML 转义（防 XSS）
 */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ------------------------------------------------------------
// SubTask 8.2: 主题聚类算法
// ------------------------------------------------------------

/**
 * 主题聚类：将作品按主题关键词匹配度分组
 * 基于作品 tags / description / title 中的关键词匹配 + AI 评分维度
 * @param {Array} artworks - getPublicArtworks() 返回的作品列表
 * @param {string} themeKey - CURATE_THEMES key
 * @returns {Array} 匹配该主题的作品列表（按匹配度降序）
 */
function clusterArtworksByTheme(artworks, themeKey) {
  const theme = CURATE_THEMES.find(t => t.key === themeKey);
  if (!theme || !Array.isArray(artworks)) return [];

  const scored = artworks.map(art => {
    const haystack = [
      Array.isArray(art.tags) ? art.tags.join(' ') : (art.tags || ''),
      art.description || '',
      art.title || '',
      art.category || ''
    ].join(' ').toLowerCase();

    let score = 0;
    theme.keywords.forEach(kw => {
      const kwLower = kw.toLowerCase();
      if (haystack.includes(kwLower)) score += 1;
    });
    // AI 评分维度：已有 AI 评分的作品优先（视为高质量展品）
    if (art.aiScore != null) score += art.aiScore >= 80 ? 0.5 : 0.2;
    // 类别加分（数字艺术/摄影更契合策展）
    if (art.category === 'photography' || art.category === 'digital-art') score += 0.1;
    return { art, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.art);
}

// ------------------------------------------------------------
// SubTask 8.3: 展馆生成（generateHalls）
// ------------------------------------------------------------

/**
 * 生成 3-5 个展馆草案（按主题聚类，每馆 8-12 件作品）
 * @param {object} [options] - { count?: 3-5, userId?: string }
 * @returns {Promise<Array>} 新建的展馆记录列表
 */
async function generateHalls(options = {}) {
  const user = window.currentUser;
  const userId = options.userId || (user && (user.id || user.username)) || null;

  let artworks = [];
  try {
    // 对外展示：策展馆仅从公开可见作品中取材（下架/逻辑删除/待审核不入展）
    artworks = await getPublicArtworks();
  } catch (err) {
    console.error('[AI-Curate] 加载作品失败:', err);
    throw new Error('加载作品库失败');
  }
  if (!artworks.length) throw new Error('作品库为空，无法生成展馆');

  // 每个主题生成 1-2 个展馆，总数控制在 3-5
  const targetCount = Math.min(HALL_COUNT_MAX, Math.max(HALL_COUNT_MIN, options.count || HALL_COUNT_MIN));
  const hallsData = [];

  // 轮询主题，分配作品
  const themeArtworksMap = {};
  CURATE_THEMES.forEach(t => {
    themeArtworksMap[t.key] = clusterArtworksByTheme(artworks, t.key);
  });

  // 已分配的作品 id 集合（避免同一作品出现在多个展馆）
  const assignedIds = new Set();
  let generated = 0;
  let themeIdx = 0;

  while (generated < targetCount) {
    const theme = CURATE_THEMES[themeIdx % CURATE_THEMES.length];
    const pool = themeArtworksMap[theme.key].filter(a => !assignedIds.has(a.id));
    // 该主题剩余作品不足一个展馆时跳过
    if (pool.length < HALL_ARTWORK_MIN) {
      themeIdx++;
      if (themeIdx > CURATE_THEMES.length * 3) break; // 防死循环
      continue;
    }
    // 每馆取 8-12 件
    const take = Math.min(HALL_ARTWORK_MAX, pool.length);
    const picks = pool.slice(0, take);
    picks.forEach(p => assignedIds.add(p.id));

    const hallNumber = generated + 1;
    const title = `${theme.label}·梦境第${hallNumber}展`;
    const description = buildHallDescription(theme, picks);
    const artworkIds = picks.map(p => p.id);

    hallsData.push({
      theme: theme.key,
      themeLabel: theme.label,
      title,
      description,
      artworkIds,
      status: 'draft',
      userId,
      cover: null // 封面延迟生成
    });

    generated++;
    themeIdx++;
  }

  // 持久化到 DB（草稿状态）
  const saved = [];
  for (const data of hallsData) {
    try {
      const record = await addCuratedHall({
        name: data.title,
        description: data.description,
        theme: data.theme,
        artworkIds: data.artworkIds,
        aiGeneratedSummary: `AI聚类·${data.themeLabel}主题·${data.artworkIds.length}件作品`,
        status: 'draft',
        createdBy: data.userId
      });
      saved.push(record);
    } catch (err) {
      console.error('[AI-Curate] 保存展馆失败:', err);
    }
  }

  // 异步生成封面（不阻塞返回）
  saved.forEach(hall => {
    buildHallCover(hall.artworkIds).then(cover => {
      if (!cover) return;
      updateCuratedHall(hall.id, { cover }).catch(() => { /* ignore */ });
      // 同步更新缓存
      const cached = hallsCache.find(h => h.id === hall.id);
      if (cached) cached.cover = cover;
      refreshCoverInDOM(hall.id, cover);
    }).catch(() => { /* ignore */ });
  });

  return saved;
}

/**
 * 根据主题与作品列表生成展馆描述（AI 文案模板）
 */
function buildHallDescription(theme, picks) {
  const count = picks.length;
  const tagSet = new Set();
  picks.slice(0, 6).forEach(p => {
    if (Array.isArray(p.tags)) p.tags.slice(0, 2).forEach(t => tagSet.add(t));
  });
  const tags = Array.from(tagSet).slice(0, 4).join('、');
  return `「${theme.desc}」专题策展，精选 ${count} 件梦境作品${tags ? `，涵盖 ${tags} 等元素` : ''}。由 AI 按主题关键词聚类生成，呈现${theme.label}美学的多元表达。`;
}

// ------------------------------------------------------------
// SubTask 8.4: Canvas 展馆封面合成（buildHallCover）
// ------------------------------------------------------------

/**
 * 合成展馆封面：3-4 张作品拼贴 + 主题文字 + AI 水印
 * @param {number[]} artworkIds
 * @returns {Promise<string>} dataURL（失败返回 ''）
 */
async function buildHallCover(artworkIds) {
  if (!Array.isArray(artworkIds) || !artworkIds.length) return '';
  const ids = artworkIds.slice(0, 4);

  // 加载作品图
  const imgs = [];
  for (const id of ids) {
    try {
      const art = await getArtworkById(id);
      if (!art) continue;
      const url = art.imageUrl || (Array.isArray(art.images) && art.images[0]) || '';
      if (!url) continue;
      const img = await loadImage(url);
      imgs.push(img);
    } catch (_) { /* skip failed image */ }
  }
  if (!imgs.length) return '';

  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(COVER_W * dpr);
  canvas.height = Math.floor(COVER_H * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  drawCover(ctx, imgs);

  try {
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch (err) {
    console.warn('[AI-Curate] 封面导出失败:', err && err.message);
    return '';
  }
}

/**
 * 绘制封面到 ctx（拼贴 + 文字 + 水印）
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLImageElement[]} imgs
 */
function drawCover(ctx, imgs) {
  const w = COVER_W;
  const h = COVER_H;

  // 1. 背景
  ctx.fillStyle = '#0f0a1e';
  ctx.fillRect(0, 0, w, h);

  // 2. 拼贴区域（左侧 2/3 图片网格 + 右侧 1/3 主图）
  const gap = 6;
  const leftW = Math.floor(w * 0.62);
  const rightX = leftW + gap;
  const rightW = w - rightX - gap;

  if (imgs.length === 1) {
    drawImageCover(ctx, imgs[0], gap, gap, w - gap * 2, h - gap * 2);
  } else if (imgs.length === 2) {
    drawImageCover(ctx, imgs[0], gap, gap, leftW - gap, h - gap * 2);
    drawImageCover(ctx, imgs[1], rightX, gap, rightW, h - gap * 2);
  } else if (imgs.length === 3) {
    const halfH = (h - gap * 3) / 2;
    drawImageCover(ctx, imgs[0], gap, gap, leftW - gap, h - gap * 2);
    drawImageCover(ctx, imgs[1], rightX, gap, rightW, halfH);
    drawImageCover(ctx, imgs[2], rightX, gap * 2 + halfH, rightW, halfH);
  } else {
    // 4 张：左侧 2x2 + 右侧主图
    const halfH = (h - gap * 3) / 2;
    const halfW = (leftW - gap * 2) / 2;
    drawImageCover(ctx, imgs[0], gap, gap, halfW, halfH);
    drawImageCover(ctx, imgs[1], gap * 2 + halfW, gap, halfW, halfH);
    drawImageCover(ctx, imgs[2], gap, gap * 2 + halfH, halfW, halfH);
    drawImageCover(ctx, imgs[3], gap * 2 + halfW, gap * 2 + halfH, halfW, halfH);
    // 右侧主图用第一张放大
    if (imgs[0]) drawImageCover(ctx, imgs[0], rightX, gap, rightW, h - gap * 2);
  }

  // 3. 半透明渐变蒙层（底部文字区）
  const grad = ctx.createLinearGradient(0, h * 0.5, 0, h);
  grad.addColorStop(0, 'rgba(15,10,30,0)');
  grad.addColorStop(1, 'rgba(15,10,30,0.88)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, h * 0.5, w, h * 0.5);

  // 4. 主题文字（左下）
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.font = '600 22px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('AI 智能策展', gap + 4, h - 14);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText(`${imgs.length}+ 件梦境作品`, gap + 4, h - 38);
  ctx.restore();

}

// ------------------------------------------------------------
// SubTask 8.5: DOM 构建与列表渲染
// ------------------------------------------------------------

/**
 * 创建策展页面 DOM（列表页骨架）
 * @returns {HTMLElement}
 */
function createCuratePage() {
  const wrap = document.createElement('section');
  wrap.className = 'curate-page';
  wrap.id = 'curate-page';
  wrap.innerHTML = `
    <header class="curate-header">
      <div class="curate-title-row">
        <h2 class="curate-title"><i class="fa-solid fa-wand-magic-sparkles"></i> AI 智能策展</h2>
      </div>
      <p class="curate-subtitle">按非遗/地域/季节光影主题聚类作品，AI 生成主题展馆</p>
      <div class="curate-header-actions">
        <button class="btn-primary" id="curate-generate" title="生成 3-5 个展馆草案"><i class="fa-solid fa-wand-magic-sparkles"></i> 生成展馆草案</button>
        <button class="btn-ghost" id="curate-back-home" title="返回首页"><i class="fa-solid fa-house"></i> 返回</button>
      </div>
    </header>
    <div class="curate-halls-grid" id="curate-halls-grid">
      <div class="curate-loading"><i class="fa-solid fa-spinner fa-spin"></i> 加载中…</div>
    </div>
  `;
  return wrap;
}

/**
 * 渲染展馆卡片网格
 * @param {Array} halls - 展馆记录列表
 */
function renderHallsGrid(halls) {
  if (!domRefs || !domRefs.hallsGrid) return;
  const grid = domRefs.hallsGrid;
  if (!halls.length) {
    grid.innerHTML = `
      <div class="curate-empty">
        <i class="fa-solid fa-folder-open"></i>
        <p>暂无展馆，点击「生成展馆草案」由 AI 创建主题展馆</p>
      </div>`;
    return;
  }
  grid.innerHTML = '';
  halls.forEach(hall => {
    const theme = CURATE_THEMES.find(t => t.key === hall.theme) || CURATE_THEMES[0];
    const card = document.createElement('article');
    card.className = 'curate-hall-card glass';
    card.dataset.hallId = hall.id;
    const statusClass = hall.status === 'published' ? 'published' : 'draft';
    const statusText = hall.status === 'published' ? '已发布' : '草稿';
    const time = new Date(hall.createdAt);
    const timeStr = `${time.getMonth() + 1}/${time.getDate()} ${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
    card.innerHTML = `
      <div class="curate-hall-cover">
        ${hall.cover ? `<img src="${esc(hall.cover)}" alt="${esc(hall.name)}" />` : `<div class="curate-hall-cover-empty" style="background:${theme.bg};color:${theme.accent}"><i class="fa-solid fa-images"></i><span>${esc(theme.label)}</span></div>`}
        <span class="curate-hall-status curate-hall-status--${statusClass}">${statusText}</span>
      </div>
      <div class="curate-hall-info">
        <div class="curate-hall-theme" style="color:${theme.accent}">${esc(theme.label)}主题</div>
        <h3 class="curate-hall-name">${esc(hall.name)}</h3>
        <p class="curate-hall-desc">${esc(hall.description || '')}</p>
        <div class="curate-hall-meta">
          <span><i class="fa-solid fa-image"></i> ${(hall.artworkIds || []).length} 件</span>
          <span><i class="fa-regular fa-clock"></i> ${timeStr}</span>
        </div>
        <div class="curate-hall-actions">
          <button class="btn-ghost btn-sm curate-view" data-hall-id="${hall.id}"><i class="fa-solid fa-eye"></i> 查看</button>
          ${hall.status === 'draft'
            ? `<button class="btn-primary btn-sm curate-publish" data-hall-id="${hall.id}"><i class="fa-solid fa-upload"></i> 发布</button>`
            : `<span class="curate-published-tag"><i class="fa-solid fa-check"></i> 已上线</span>`}
          <button class="btn-ghost btn-sm curate-delete" data-hall-id="${hall.id}" title="删除"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

/**
 * 刷新某个展馆在 DOM 中的封面
 */
function refreshCoverInDOM(hallId, cover) {
  if (!domRefs || !domRefs.hallsGrid) return;
  const card = domRefs.hallsGrid.querySelector(`.curate-hall-card[data-hall-id="${hallId}"] .curate-hall-cover`);
  if (!card) return;
  const empty = card.querySelector('.curate-hall-cover-empty');
  if (empty && cover) {
    const img = document.createElement('img');
    img.src = cover;
    img.alt = '展馆封面';
    empty.replaceWith(img);
  }
}

// ------------------------------------------------------------
// SubTask 8.6: 展馆详情页
// ------------------------------------------------------------

/**
 * 渲染展馆详情页（作品网格 + 主题描述 + AI 徽章）
 * @param {number} hallId
 */
async function renderHallDetail(hallId) {
  if (!domRefs || !domRefs.root) return;
  currentHallId = Number(hallId);
  let hall = null;
  try {
    hall = await getCuratedHall(hallId);
  } catch (err) {
    console.error('[AI-Curate] 加载展馆失败:', err);
  }
  if (!hall) {
    if (window.showToast) showToast('展馆不存在或已被删除', 'warn');
    openCurate();
    return;
  }

  const theme = CURATE_THEMES.find(t => t.key === hall.theme) || CURATE_THEMES[0];

  // 加载作品详情
  const artworks = [];
  for (const aid of (hall.artworkIds || [])) {
    try {
      const a = await getArtworkById(aid);
      if (a) artworks.push(a);
    } catch (_) { /* skip */ }
  }

  const root = domRefs.root;
  root.innerHTML = `
    <header class="curate-header">
      <div class="curate-title-row">
        <button class="btn-ghost btn-sm" id="curate-back-list"><i class="fa-solid fa-arrow-left"></i> 返回列表</button>
      </div>
      <h2 class="curate-detail-title">${esc(hall.name)}</h2>
      <p class="curate-subtitle">${esc(hall.description || '')}</p>
      <div class="curate-detail-meta">
        <span class="curate-hall-theme" style="color:${theme.accent}"><i class="fa-solid fa-tag"></i> ${esc(theme.label)}主题</span>
        <span><i class="fa-solid fa-image"></i> ${artworks.length} 件作品</span>
        <span class="curate-hall-status curate-hall-status--${hall.status === 'published' ? 'published' : 'draft'}">${hall.status === 'published' ? '已发布' : '草稿'}</span>
      </div>
      <div class="curate-header-actions">
        ${hall.status === 'draft'
          ? `<button class="btn-primary" id="curate-detail-publish"><i class="fa-solid fa-upload"></i> 发布展馆</button>`
          : `<span class="curate-published-tag"><i class="fa-solid fa-check"></i> 展馆已上线</span>`}
        <button class="btn-ghost" id="curate-detail-back-home"><i class="fa-solid fa-house"></i> 返回首页</button>
      </div>
    </header>
    <div class="curate-hall-detail" id="curate-hall-detail">
      ${artworks.length
        ? `<div class="curate-artworks-grid">${artworks.map(a => `
            <a class="curate-artwork-thumb" href="#artwork-${a.id}" title="${esc(a.title)}">
              <img src="${esc(a.imageUrl || (Array.isArray(a.images) && a.images[0]) || '')}" alt="${esc(a.title)}" loading="lazy" />
              <span class="curate-artwork-title">${esc(a.title || '未命名')}</span>
            </a>`).join('')}</div>`
        : `<div class="curate-empty"><i class="fa-solid fa-image"></i><p>展馆暂无作品</p></div>`}
    </div>
  `;

  // 绑定详情页事件
  root.querySelector('#curate-back-list')?.addEventListener('click', () => {
    if (typeof Sound !== 'undefined') Sound.playSound('click');
    window.location.hash = '#/curate';
  });
  root.querySelector('#curate-detail-back-home')?.addEventListener('click', () => {
    if (typeof Sound !== 'undefined') Sound.playSound('click');
    window.location.hash = '';
  });
  root.querySelector('#curate-detail-publish')?.addEventListener('click', () => {
    publishHall(hallId);
  });
}

// ------------------------------------------------------------
// SubTask 8.7: 发布展馆
// ------------------------------------------------------------

/**
 * 将草稿展馆发布（status: draft → published）
 * @param {number} hallId
 */
async function publishHall(hallId) {
  if (typeof Sound !== 'undefined') Sound.playSound('click');
  try {
    const updated = await updateCuratedHall(hallId, { status: 'published' });
    // 同步缓存
    const idx = hallsCache.findIndex(h => h.id === hallId);
    if (idx >= 0) hallsCache[idx] = { ...hallsCache[idx], ...updated };
    if (window.showToast) showToast(`展馆「${updated.name}」已发布`, 'success');
    // 当前在详情页则刷新详情，否则刷新列表
    if (currentHallId === Number(hallId)) {
      renderHallDetail(hallId);
    } else {
      renderHallsGrid(hallsCache);
    }
  } catch (err) {
    console.error('[AI-Curate] 发布展馆失败:', err);
    if (window.showToast) showToast('发布失败：' + (err && err.message || '未知错误'), 'error');
  }
}

/**
 * 删除展馆
 * @param {number} hallId
 */
async function deleteHall(hallId) {
  try {
    await deleteCuratedHall(hallId);
    hallsCache = hallsCache.filter(h => h.id !== hallId);
    renderHallsGrid(hallsCache);
    if (window.showToast) showToast('展馆已删除', 'info');
  } catch (err) {
    console.error('[AI-Curate] 删除展馆失败:', err);
    if (window.showToast) showToast('删除失败：' + (err && err.message || '未知错误'), 'error');
  }
}

// ------------------------------------------------------------
// SubTask 8.8: 加载展馆列表
// ------------------------------------------------------------

/**
 * 从 DB 加载所有展馆（合并所有主题）
 * @returns {Promise<Array>}
 */
async function loadAllHalls() {
  const all = [];
  for (const theme of CURATE_THEMES) {
    try {
      const list = await getCuratedHallsByTheme(theme.key);
      all.push(...list);
    } catch (err) {
      console.warn('[AI-Curate] 加载主题展馆失败:', theme.key, err);
    }
  }
  // 按创建时间降序
  all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return all;
}

// ------------------------------------------------------------
// SubTask 8.9: 入口 openCurate / 出口 closeCurate
// ------------------------------------------------------------

/**
 * 打开 AI 智能策展页面（列表页）
 * @param {object} [opts] - { hallId?: number } 传入则直接进详情页
 */
async function openCurate(opts = {}) {
  // 关闭已有灯箱
  if (window.Gallery && typeof Gallery.closeLightbox === 'function') {
    try { Gallery.closeLightbox(); } catch (_) { /* ignore */ }
  }
  // 若已挂载先清理
  if (mounted) closeCurate(true);

  const hallId = opts.hallId != null ? Number(opts.hallId) : null;

  // 构建 DOM
  const wrap = createCuratePage();
  document.body.appendChild(wrap);

  domRefs = {
    root: wrap,
    hallsGrid: wrap.querySelector('#curate-halls-grid'),
    btnGenerate: wrap.querySelector('#curate-generate'),
    btnBackHome: wrap.querySelector('#curate-back-home')
  };

  // 锁定背景滚动（全屏页面）
  if (window.ModalScrollLock) window.ModalScrollLock.lock();

  // 事件绑定
  bindUIEvents();

  // 入场动画
  requestAnimationFrame(() => wrap.classList.add('curate-page--open'));

  mounted = true;

  // 加载展馆列表
  try {
    hallsCache = await loadAllHalls();
    renderHallsGrid(hallsCache);
  } catch (err) {
    console.error('[AI-Curate] 加载展馆列表失败:', err);
    if (domRefs.hallsGrid) {
      domRefs.hallsGrid.innerHTML = '<div class="curate-empty"><i class="fa-solid fa-triangle-exclamation"></i><p>加载失败，请刷新重试</p></div>';
    }
  }

  // 若指定 hallId，进入详情页
  if (hallId) {
    renderHallDetail(hallId);
  }
}

/**
 * 关闭策展页面（完整清理资源）
 * @param {boolean} [skipAnim] - 跳过退场动画（用于重建场景）
 */
function closeCurate(skipAnim = false) {
  if (!mounted) return;

  // 取消 pending RAF
  if (coverRafId) {
    cancelAnimationFrame(coverRafId);
    coverRafId = 0;
  }
  // 移除事件监听器
  if (escHandler) {
    document.removeEventListener('keydown', escHandler);
    escHandler = null;
  }
  if (resizeHandler) {
    window.removeEventListener('resize', resizeHandler);
    resizeHandler = null;
  }

  // 解锁背景滚动
  if (window.ModalScrollLock) window.ModalScrollLock.unlock();

  // DOM 退场
  const root = domRefs && domRefs.root;
  if (root) {
    if (skipAnim) {
      if (root.parentNode) root.remove();
    } else {
      root.classList.remove('curate-page--open');
      root.classList.add('curate-page--leaving');
      const node = root;
      setTimeout(() => { if (node.parentNode) node.remove(); }, 320);
    }
  }

  // 重置状态
  domRefs = null;
  hallsCache = [];
  currentHallId = null;
  mounted = false;
}

/**
 * 绑定 UI 事件
 */
function bindUIEvents() {
  if (!domRefs) return;

  // 生成展馆草案
  domRefs.btnGenerate?.addEventListener('click', async () => {
    if (typeof Sound !== 'undefined') Sound.playSound('click');
    const user = window.currentUser;
    if (!user) {
      if (window.Auth) Auth.requireLogin();
      return;
    }
    const btn = domRefs.btnGenerate;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AI 策展中…';
    try {
      const newHalls = await generateHalls({ count: HALL_COUNT_MIN, userId: user.id || user.username });
      hallsCache = await loadAllHalls();
      renderHallsGrid(hallsCache);
      if (window.showToast) showToast(`✨ AI 已生成 ${newHalls.length} 个主题展馆草案`, 'success');
    } catch (err) {
      if (window.showToast) showToast('生成失败：' + (err && err.message || '未知错误'), 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> 生成展馆草案';
    }
  });

  // 返回首页
  domRefs.btnBackHome?.addEventListener('click', () => {
    if (typeof Sound !== 'undefined') Sound.playSound('click');
    window.location.hash = '';
  });

  // 展馆卡片事件委托（查看/发布/删除）
  domRefs.hallsGrid?.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('.curate-view');
    const pubBtn = e.target.closest('.curate-publish');
    const delBtn = e.target.closest('.curate-delete');
    const card = e.target.closest('.curate-hall-card');

    if (viewBtn) {
      e.preventDefault();
      if (typeof Sound !== 'undefined') Sound.playSound('click');
      const id = Number(viewBtn.dataset.hallId);
      window.location.hash = `#/curate?hallId=${id}`;
      return;
    }
    if (pubBtn) {
      e.preventDefault();
      publishHall(Number(pubBtn.dataset.hallId));
      return;
    }
    if (delBtn) {
      e.preventDefault();
      const id = Number(delBtn.dataset.hallId);
      if (!confirm('确认删除该展馆？此操作不可撤销')) return;
      deleteHall(id);
      return;
    }
    // 点击卡片其他区域也进入详情
    if (card && !e.target.closest('button')) {
      if (typeof Sound !== 'undefined') Sound.playSound('click');
      const id = Number(card.dataset.hallId);
      window.location.hash = `#/curate?hallId=${id}`;
    }
  });

  // ESC 返回
  escHandler = (e) => {
    if (e.key === 'Escape') {
      // 详情页 ESC 返回列表，列表页 ESC 关闭
      if (currentHallId) {
        window.location.hash = '#/curate';
      } else {
        window.location.hash = '';
      }
    }
  };
  document.addEventListener('keydown', escHandler);
}

/**
 * 从 hash 路由参数解析并打开策展页面
 * 支持格式：#/curate （列表页）、#/curate?hallId=xxx （详情页）
 * @returns {boolean} 是否匹配
 */
function openFromHash() {
  const hash = window.location.hash || '';
  const match = hash.match(/^#\/curate(?:\?(.*))?$/);
  if (!match) return false;
  const qs = match[1] || '';
  const params = {};
  qs.split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
  });
  if (params.hallId) {
    openCurate({ hallId: params.hallId }).catch(err => {
      console.error('[AI-Curate] openFromHash 失败:', err);
    });
  } else {
    openCurate().catch(err => {
      console.error('[AI-Curate] openFromHash 失败:', err);
    });
  }
  return true;
}

// ------------------------------------------------------------
// 模块导出（ES Module）
// ------------------------------------------------------------
export {
  // 入口/出口
  openCurate,
  closeCurate,
  openFromHash,
  // 策展操作
  generateHalls,
  publishHall,
  deleteHall,
  renderHallDetail,
  // 聚类与封面
  clusterArtworksByTheme,
  buildHallCover,
  // 常量
  CURATE_THEMES
};

// ------------------------------------------------------------
// 全局挂载（兼容非模块化旧代码通过 window.AICurate 调用）
// ------------------------------------------------------------
if (typeof window !== 'undefined') {
  window.AICurate = {
    openCurate,
    closeCurate,
    openFromHash,
    generateHalls,
    publishHall,
    CURATE_THEMES
  };
}
