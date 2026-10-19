// ============================================================
// js/gallery.js — 作品展示系统
// 功能: 分类筛选、瀑布流布局、图片懒加载、分批渲染(虚拟滚动)
//       作品灯箱(多图轮播/介绍/作者/点赞/收藏/评论/标签)、键盘切换
//       排序功能(热门/最新/推荐)、标签筛选
// ============================================================

// P0-2 通用分享海报模块（生成 + 预览弹窗；window.SharePoster 亦全局可用）
import SharePoster from './share-poster.js';
// P1-2 文化 SVG 图标（替换 emoji 评级，跨平台一致）
import { icons as _ICONS } from './icons.js';
// 作品可见性统一入口：画廊只渲染对外公开可见的作品（下架/删除/待审核不可见）
import { getPublicArtworks } from './db.js';

const Gallery = {
  // 全部作品缓存
  allArtworks: [],
  // 当前筛选分类
  currentCategory: 'all',
  // 当前排序方式
  currentSort: 'latest',
  // 当前标签筛选
  currentTag: null,
  // 已渲染数量（分批渲染，性能优化）
  renderedCount: 0,
  // 每批渲染数量（根据视口动态计算）
  pageSize: 24,
  // 首屏渲染数量（根据视口高度计算）
  initialRenderCount: 20,
  // 灯箱当前作品索引（基于已筛选列表）
  lightboxIndex: 0,
  lightboxList: [],
  // 灯箱当前图片索引（多图轮播）
  lightboxImageIndex: 0,
  // 懒加载观察器
  imgObserver: null,
  // 滚动加载哨兵观察器
  sentinelObserver: null,
  // 卡片入场动画观察器
  cardObserver: null,

  // 分类中英文映射
  // M6b-1 文旅文创六分类
  CATEGORY_LABELS: {
    'all': '全部',
    'scenic-photo': '文旅摄影',
    'heritage-craft': '非遗文创',
    'guofeng-art': '国风绘画',
    'ai-art': 'AI数字艺术',
    'museum-culture': '博物文创',
    'creative-design': '创意设计',
    // 旧分类兼容显示
    'digital-art': 'AI数字艺术',
    'photography': '文旅摄影',
    'illustration': '国风绘画',
    'abstract': 'AI数字艺术',
    '3d-art': '创意设计'
  },

  // ============================================================
  // 图片加载配置
  // ============================================================
  IMAGE_CONFIG: {
    webpEnabled: null,
    cdnEnabled: true,
    cdnProvider: 'cloudflare',
    cdnOptions: {
      cloudflare: {
        accountHash: 'ACCOUNT_HASH',
        baseUrl: 'https://imagedelivery.net'
      },
      aliyun: {
        bucket: 'dreamcore',
        region: 'oss-cn-beijing',
        baseUrl: 'https://dreamcore.oss-cn-beijing.aliyuncs.com'
      }
    },
    sizes: [
      { w: 400, h: 300, descriptor: '400w' },
      { w: 600, h: 450, descriptor: '600w' },
      { w: 800, h: 600, descriptor: '800w' },
      { w: 1200, h: 900, descriptor: '1200w' }
    ],
    // M6b-1 新分类 fallback 复用既有占位图
    fallbacks: {
      'scenic-photo': '/images/fallback/photography.svg',
      'heritage-craft': '/images/fallback/abstract.svg',
      'guofeng-art': '/images/fallback/illustration.svg',
      'ai-art': '/images/fallback/digital-art.svg',
      'museum-culture': '/images/fallback/3d-art.svg',
      'creative-design': '/images/fallback/abstract.svg',
      'digital-art': '/images/fallback/digital-art.svg',
      'photography': '/images/fallback/photography.svg',
      'illustration': '/images/fallback/illustration.svg',
      'abstract': '/images/fallback/abstract.svg',
      '3d-art': '/images/fallback/3d-art.svg',
      'all': '/images/fallback/all.svg'
    }
  },

  // ----------------------------------------------------------
  // 检测浏览器WebP支持（缓存结果）
  // ----------------------------------------------------------
  _detectWebP() {
    if (this.IMAGE_CONFIG.webpEnabled !== null) return this.IMAGE_CONFIG.webpEnabled;
    const canvas = document.createElement('canvas');
    canvas.width = 1; canvas.height = 1;
    this.IMAGE_CONFIG.webpEnabled = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    return this.IMAGE_CONFIG.webpEnabled;
  },

  // ----------------------------------------------------------
  // 获取Category对应的fallback图路径
  // ----------------------------------------------------------
  _getCategoryFallback(category) {
    return this.IMAGE_CONFIG.fallbacks[category] || this.IMAGE_CONFIG.fallbacks['all'];
  },

  // ----------------------------------------------------------
  // 构建图片URL（支持多种源，统一入口）
  // ----------------------------------------------------------
  _buildImageUrl(originalUrl, width, height, options = {}) {
    if (!originalUrl) return '';

    if (originalUrl.startsWith('data:')) {
      return originalUrl;
    }

    if (originalUrl.startsWith('/')) {
      return originalUrl;
    }

    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.round(width * dpr);
    const format = options.webp || this._detectWebP() ? 'webp' : 'jpeg';

    if (this.IMAGE_CONFIG.cdnEnabled && this.IMAGE_CONFIG.cdnProvider === 'cloudflare') {
      const config = this.IMAGE_CONFIG.cdnOptions.cloudflare;
      const seedMatch = originalUrl.match(/picsum\.photos\/seed\/([^/]+)/);
      const imageId = seedMatch ? seedMatch[1] : 'default';
      return `${config.baseUrl}/${config.accountHash}/${imageId}/w=${targetWidth},format=${format},q=80`;
    }

    if (this.IMAGE_CONFIG.cdnEnabled && this.IMAGE_CONFIG.cdnProvider === 'aliyun') {
      const config = this.IMAGE_CONFIG.cdnOptions.aliyun;
      const seedMatch = originalUrl.match(/picsum\.photos\/seed\/([^/]+)/);
      const imageId = seedMatch ? seedMatch[1] : 'default';
      return `${config.baseUrl}/artworks/${imageId}.jpg?x-oss-process=image/resize,w_${targetWidth}/format,${format}/quality,q_80`;
    }

    if (originalUrl.includes('picsum.photos/seed/')) {
      const base = originalUrl.replace(/\/\d+\/\d+$/, '');
      const ext = options.webp ? '.webp' : '';
      return `${base}/${targetWidth}/${Math.round(height * dpr)}${ext}`;
    }

    return originalUrl;
  },

  // 排序方式映射
  SORT_LABELS: {
    'latest': '最新',
    'popular': '热门',
    'recommended': '推荐'
  },

  // ----------------------------------------------------------
  // 初始化画廊
  // ----------------------------------------------------------
  async init() {
    this._bindFilters();
    this._bindSort();
    this._bindTagFilterClear();
    await this.loadArtworks('all');
    this._checkHashRoute();
    window.addEventListener('hashchange', () => this._checkHashRoute());
  },

  _checkHashRoute() {
    const hash = window.location.hash;
    const match = hash && hash.match(/^#artwork-(\d+)$/);
    if (match) {
      const artworkId = match[1];
      this.openLightbox(artworkId).catch(e => console.warn('[Gallery] hash路由打开灯箱失败:', e));
    }
  },

  // ----------------------------------------------------------
  // 绑定分类筛选栏（含键盘导航支持）
  // ----------------------------------------------------------
  _bindFilters() {
    const bar = document.getElementById('filter-bar');
    if (!bar) return;
    const chips = bar.querySelectorAll('.filter-chip');
    
    const activateChip = (chip) => {
      if (typeof Sound !== 'undefined') Sound.playSound('click');
      chips.forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-selected', 'false');
        c.setAttribute('tabindex', '-1');
      });
      chip.classList.add('active');
      chip.setAttribute('aria-selected', 'true');
      chip.setAttribute('tabindex', '0');
      chip.focus();
      this.currentTag = null;
      this.loadArtworks(chip.dataset.category);
    };

    chips.forEach((chip, index) => {
      chip.addEventListener('click', () => activateChip(chip));
      
      chip.addEventListener('keydown', (e) => {
        let newIndex = index;
        
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          newIndex = (index + 1) % chips.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          newIndex = (index - 1 + chips.length) % chips.length;
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activateChip(chip);
          return;
        } else if (e.key === 'Home') {
          e.preventDefault();
          newIndex = 0;
        } else if (e.key === 'End') {
          e.preventDefault();
          newIndex = chips.length - 1;
        }
        
        if (newIndex !== index) {
          chips[index].setAttribute('tabindex', '-1');
          chips[newIndex].setAttribute('tabindex', '0');
          chips[newIndex].focus();
        }
      });
    });
  },

  // ----------------------------------------------------------
  // 绑定排序下拉框
  // ----------------------------------------------------------
  _bindSort() {
    const sortSelect = document.getElementById('sort-select');
    if (!sortSelect) return;
    sortSelect.addEventListener('change', () => {
      if (typeof Sound !== 'undefined') Sound.playSound('click');
      this.currentSort = sortSelect.value;
      this._applySortAndFilter();
    });
  },

  // ----------------------------------------------------------
  // 绑定清除标签筛选按钮
  // ----------------------------------------------------------
  _bindTagFilterClear() {
    const clearBtn = document.getElementById('clear-tag-btn');
    if (!clearBtn) return;
    clearBtn.addEventListener('click', () => {
      if (typeof Sound !== 'undefined') Sound.playSound('click');
      this.clearTagFilter();
    });
  },

  // ----------------------------------------------------------
  // 从 IndexedDB 加载作品并渲染
  // category: 'all' 或具体分类；page 保留参数（当前用分批渲染）
  // ----------------------------------------------------------
  async loadArtworks(category = 'all', page = 1) {
    this.currentCategory = category;
    this.allArtworks = await getPublicArtworks()
    if(typeof this._attachAestheticScores==='function')await this._attachAestheticScores();;
    this._applySortAndFilter();
  },

  // ----------------------------------------------------------
  // 计算首屏和分批渲染数量（根据视口高度动态计算）
  // ----------------------------------------------------------
  _calculateRenderCounts() {
    const viewportHeight = window.innerHeight;
    const galleryTop = document.getElementById('gallery')?.getBoundingClientRect().top || 0;
    const availableHeight = viewportHeight - galleryTop;

    const cardsPerRow = window.innerWidth < 480 ? 1 : window.innerWidth < 640 ? 2 : window.innerWidth < 768 ? 2 : window.innerWidth < 1024 ? 3 : 4;
    const cardHeight = 380;

    const visibleRows = Math.ceil(availableHeight / cardHeight) + 2;
    this.initialRenderCount = Math.max(12, Math.min(30, visibleRows * cardsPerRow));
    this.pageSize = Math.max(8, Math.min(24, Math.ceil(visibleRows * cardsPerRow * 0.8)));
  },

  // ----------------------------------------------------------
  // 应用分类、标签、排序
  // ----------------------------------------------------------
  _applySortAndFilter() {
    let list = [...this.allArtworks];

    // M4 内容审核：可见性过滤已统一收口在 db.js 的 getPublicArtworks()
    // （仅 published；待审核/已下架/逻辑删除在管理后台可见）——此处不再重复过滤

    // 按分类筛选
    if (this.currentCategory !== 'all') {
      list = list.filter(a => a.category === this.currentCategory);
    }

    // 按标签筛选
    if (this.currentTag) {
      list = list.filter(a => a.tags && a.tags.includes(this.currentTag));
    }

    // 排序
    list = this._sortArtworks(list, this.currentSort);

    this.lightboxList = list;

    // 动态计算渲染数量
    this._calculateRenderCounts();

    this.renderedCount = 0;
    const grid = document.getElementById('gallery-grid');
    if (grid) grid.innerHTML = '';

    // 断开之前的观察器
    if (this.cardObserver) {
      this.cardObserver.disconnect();
      this.cardObserver = null;
    }

    this._renderBatch();

    // 显示/隐藏计数
    const countEl = document.getElementById('gallery-count');
    if (countEl) countEl.textContent = this.lightboxList.length;

    // 更新标签显示
    this._updateTagFilterDisplay();

    // 更新JSON-LD结构化数据
    this._updateStructuredData();
  },

  // ----------------------------------------------------------
  // 更新JSON-LD结构化数据（ImageGallery + ItemList）
  // ----------------------------------------------------------
  _updateStructuredData() {
    const baseUrl = 'https://dreamcore.art';
    
    // 生成ImageGallery结构化数据
    const images = this.allArtworks.slice(0, 100).map(artwork => ({
      '@type': 'ImageObject',
      'contentUrl': artwork.imageUrl || artwork.images?.[0] || '',
      'name': artwork.title || '未命名作品',
      'description': this._getAltText(artwork),
      'thumbnail': artwork.imageUrl || artwork.images?.[0] || ''
    }));

    const galleryJson = {
      '@context': 'https://schema.org',
      '@type': 'ImageGallery',
      'name': '梦境画廊',
      'description': `共${this.allArtworks.length}件梦幻艺术作品`,
      'image': images
    };

    // 生成ItemList结构化数据（用于搜索结果/筛选结果）
    const listItems = this.lightboxList.slice(0, 50).map((artwork, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'item': {
        '@type': 'ImageObject',
        'name': artwork.title || '未命名作品',
        'description': this._getAltText(artwork),
        'contentUrl': artwork.imageUrl || artwork.images?.[0] || '',
        'url': `${baseUrl}/#artwork-${artwork.id}`
      }
    }));

    const listJson = {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      'name': this.currentCategory === 'all' ? '全部作品' : this.CATEGORY_LABELS[this.currentCategory] || '作品列表',
      'description': `共${this.lightboxList.length}件${this.currentCategory === 'all' ? '' : this.CATEGORY_LABELS[this.currentCategory]}作品`,
      'itemListElement': listItems
    };

    // 更新或创建script标签
    this._setJsonLd('gallery-json-ld', galleryJson);
    this._setJsonLd('gallery-itemlist-json-ld', listJson);
  },

  _setJsonLd(id, data) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('script');
      el.id = id;
      el.type = 'application/ld+json';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  },

  // ----------------------------------------------------------
  // 排序作品
  // ----------------------------------------------------------
  _sortArtworks(list, sortType) {
    const sorted = [...list];
    switch (sortType) {
      case 'popular':
        // 热门：按点赞数降序
        sorted.sort((a, b) => (b.likes || 0) - (a.likes || 0));
        break;
      case 'recommended':
        // 推荐：综合评分（点赞*0.5 + 浏览*0.3 + 随机*0.2）
        sorted.sort((a, b) => {
          const scoreA = (a.likes || 0) * 0.5 + (a.views || 0) * 0.003 + Math.random() * 20;
          const scoreB = (b.likes || 0) * 0.5 + (b.views || 0) * 0.003 + Math.random() * 20;
          return scoreB - scoreA;
        });
        break;
      case 'latest':
      default:
        // 最新：按创建时间降序
        sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          if (dateB !== dateA) return dateB - dateA;
          return (b.id || 0) - (a.id || 0);
        });
        break;
    }
    return sorted;
  },

  // ----------------------------------------------------------
  // 更新标签筛选显示
  // ----------------------------------------------------------
  _updateTagFilterDisplay() {
    const tagBar = document.getElementById('tag-filter-bar');
    if (!tagBar) return;
    if (this.currentTag) {
      tagBar.style.display = 'flex';
      const tagName = tagBar.querySelector('#current-tag-name');
      if (tagName) tagName.textContent = this.currentTag;
    } else {
      tagBar.style.display = 'none';
    }
  },

  // ----------------------------------------------------------
  // 按标签筛选
  // ----------------------------------------------------------
  async filterByTag(tag) {
    this.currentTag = tag;
    this.currentCategory = 'all';
    // 更新分类筛选栏
    const bar = document.getElementById('filter-bar');
    if (bar) {
      bar.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      const allChip = bar.querySelector('[data-category="all"]');
      if (allChip) allChip.classList.add('active');
    }
    // 滚动到画廊
    const gallery = document.getElementById('gallery');
    if (gallery) gallery.scrollIntoView({ behavior: 'smooth' });
    // 重新加载
    if (this.allArtworks.length === 0) {
      this.allArtworks = await getPublicArtworks();
    }
    this._applySortAndFilter();
  },

  // ----------------------------------------------------------
  // 清除标签筛选
  // ----------------------------------------------------------
  clearTagFilter() {
    this.currentTag = null;
    this._applySortAndFilter();
  },

  // ----------------------------------------------------------
  // 分批渲染（虚拟滚动：仅渲染可视区域附近的作品）
  // ----------------------------------------------------------
  _renderBatch() {
    const grid = document.getElementById('gallery-grid');
    if (!grid) return;

    const start = this.renderedCount;
    // 首屏使用 initialRenderCount，后续使用 pageSize
    const renderCount = start === 0 ? this.initialRenderCount : this.pageSize;
    const end = Math.min(start + renderCount, this.lightboxList.length);

    if (start >= end) {
      this._hideLoader();
      if (this.lightboxList.length === 0) {
        grid.innerHTML = `<div class="gallery-empty">
          <i class="fa-regular fa-image"></i>
          <p>${this.currentTag ? `没有找到「${this.currentTag}」标签的作品` : '暂无作品'}</p>
        </div>`;
      }
      return;
    }

    this._ensureImgObserver();
    this._ensureCardObserver();

    for (let i = start; i < end; i++) {
      const card = this.renderArtworkCard(this.lightboxList[i], i);
      card.classList.remove('card-enter', 'animated');
      grid.appendChild(card);
      this.cardObserver.observe(card);
    }
    this.renderedCount = end;

    grid.querySelectorAll('img[data-src]:not([src])').forEach(img => {
      this.imgObserver.observe(img);
    });

    this._setupSentinel();

    if (end < this.lightboxList.length && document.body.scrollHeight <= window.innerHeight + 200) {
      this._renderBatch();
    }
  },

  // ----------------------------------------------------------
  // 卡片入场动画观察器（IntersectionObserver）
  // 卡片进入视口时添加入场动画
  // ----------------------------------------------------------
  _ensureCardObserver() {
    if (this.cardObserver) return;
    const self = this;
    this.cardObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const card = entry.target;
          if (!card.classList.contains('animated')) {
            card.classList.add('animated');
            card.classList.add('card-enter');
            const index = parseInt(card.dataset.index) || 0;
            card.style.animationDelay = `${(index % 8) * 0.06}s`;
          }
          self.cardObserver.unobserve(card);
        }
      });
    }, { rootMargin: '100px 0px', threshold: 0.1 });
  },

  // ----------------------------------------------------------
  // 渲染单个作品卡片
  // ----------------------------------------------------------
  renderArtworkCard(artwork, index) {
    const card = document.createElement('article');
    card.className = 'artwork-card';
    card.dataset.id = artwork.id;
    card.dataset.index = index;
    card.setAttribute('role', 'article');
    card.setAttribute('aria-label', this._esc(artwork.title));
    const catLabel = this.CATEGORY_LABELS[artwork.category] || artwork.category;
    const isVideo = artwork.type === 'video';
    const images = artwork.images || [artwork.imageUrl];
    const hasMultipleImages = images.length > 1;
    const thumbUrl = this._getThumbUrl(artwork.imageUrl);
    const srcset = this._getSrcset(artwork.imageUrl);
    const altText = this._getAltText(artwork);

    const fallbackUrl = this._getCategoryFallback(artwork.category);
    card.dataset.likes = artwork.likes || 0;
    card.innerHTML = `
      <div class="card-media">
        <div class="skeleton img-skeleton" aria-hidden="true"></div>
        ${isVideo
          ? `<video class="card-video" muted loop playsinline data-src="${this._esc(artwork.imageUrl)}" preload="none" poster="${this._esc(thumbUrl)}" title="${this._esc(altText)}"></video>`
          : `<img
              class="card-img"
              alt="${this._esc(altText)}"
              data-src="${this._esc(artwork.imageUrl)}"
              data-srcset="${this._esc(srcset)}"
              data-thumb="${this._esc(thumbUrl)}"
              data-fallback="${this._esc(fallbackUrl)}"
              data-category="${this._esc(artwork.category)}"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              loading="lazy"
              decoding="async"
            />`
        }
        ${hasMultipleImages ? '<div class="card-multi-icon" aria-hidden="true"><i class="fa-regular fa-clone"></i></div>' : ''}
        <div class="card-overlay">
          <div class="card-cat">${catLabel}</div>
          <button class="card-view" aria-label="查看 ${this._esc(artwork.title)} 的详情">
            <i class="fa-regular fa-eye" aria-hidden="true"></i>
          </button>
        </div>
      </div>
      <div class="card-info">
        <h3 class="card-title">${this._esc(artwork.title)}</h3>
        <div class="card-meta">
          <span class="card-author"><i class="fa-regular fa-user"></i> ${this._esc(artwork.author)}</span>
        </div>
        ${artwork.tags && artwork.tags.length > 0 ? `
          <div class="card-tags">
            ${artwork.tags.slice(0, 2).map(tag => `<span class="card-tag">${this._esc(tag)}</span>`).join('')}
          </div>
        ` : ''}
        ${this._aestheticCardHtml(artwork)}
        <div class="card-stats">
          <span class="card-likes"><i class="fa-solid fa-heart"></i> ${this._fmtNum(artwork.likes)}</span>
          <span class="card-art-no">#${artwork.id}</span>
        </div>
      </div>
    `;

    // 点击打开灯箱
    card.addEventListener('click', () => {
      if (typeof Sound !== 'undefined') Sound.playSound('pop');
      this.openLightbox(artwork.id);
    });

    // 点击作者名打开艺术家主页
    const authorEl = card.querySelector('.card-author');
    if (authorEl) {
      authorEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        if (window.Artist) {
          if (artwork.userId) {
            Artist.openByUserId(artwork.userId);
          } else {
            Artist.openByAuthorName(artwork.author);
          }
        }
      });
    }

    // 点击标签筛选
    const tagEls = card.querySelectorAll('.card-tag');
    tagEls.forEach(tagEl => {
      tagEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        this.filterByTag(tagEl.textContent);
      });
    });

    // 入场动画由 IntersectionObserver 控制（_ensureCardObserver）
    // 避免立即播放动画，等待卡片进入视口时再触发

    return card;
  },

  // ----------------------------------------------------------
  // 获取缩略图URL（低清预览图）
  // ----------------------------------------------------------
  _getThumbUrl(originalUrl) {
    if (!originalUrl) return '';
    if (originalUrl.includes('picsum.photos/seed/')) {
      return originalUrl.replace(/\/\d+\/\d+$/, '/400/300');
    }
    if (originalUrl.includes('picsum.photos')) {
      return originalUrl.replace(/\d+\/\d+$/, '400/300');
    }
    return originalUrl;
  },

  // ----------------------------------------------------------
  // 获取响应式srcset（400w/600w/800w/1200w），支持WebP
  // ----------------------------------------------------------
  _getSrcset(originalUrl, options = {}) {
    if (!originalUrl) return '';
    const sizes = this.IMAGE_CONFIG.sizes;
    const useWebP = options.webp !== false && this._detectWebP();

    if (originalUrl.includes('picsum.photos/seed/')) {
      const base = originalUrl.replace(/\/\d+\/\d+$/, '');
      return sizes.map(s => {
        const ext = useWebP ? '.webp' : '';
        return `${base}/${s.w}/${s.h}${ext} ${s.descriptor}`;
      }).join(', ');
    }
    if (originalUrl.includes('picsum.photos')) {
      return sizes.map(s => originalUrl.replace(/\d+\/\d+$/, `${s.w}/${s.h}`) + ` ${s.descriptor}`).join(', ');
    }
    return `${originalUrl} 1x`;
  },

  // ----------------------------------------------------------
  // 获取缩略图URL（400w低质量）
  // ----------------------------------------------------------
  _getThumbUrl(originalUrl) {
    if (!originalUrl) return '';
    if (originalUrl.includes('picsum.photos/seed/')) {
      const base = originalUrl.replace(/\/\d+\/\d+$/, '');
      const ext = this._detectWebP() ? '.webp' : '';
      return `${base}/40/30${ext}?blur=2`;
    }
    if (originalUrl.includes('picsum.photos')) {
      return originalUrl.replace(/\d+\/\d+$/, '40/30?blur=2');
    }
    return originalUrl;
  },

  // ----------------------------------------------------------
  // 获取高清图URL（1200w，用于灯箱）
  // ----------------------------------------------------------
  _getHighResUrl(originalUrl) {
    if (!originalUrl) return '';
    if (originalUrl.includes('picsum.photos/seed/')) {
      const base = originalUrl.replace(/\/\d+\/\d+$/, '');
      const ext = this._detectWebP() ? '.webp' : '';
      return `${base}/1200/900${ext}`;
    }
    if (originalUrl.includes('picsum.photos')) {
      return originalUrl.replace(/\d+\/\d+$/, '1200/900');
    }
    return originalUrl;
  },

  // ----------------------------------------------------------
  // 生成无障碍alt文本（结合标题、分类、标签，提供艺术风格描述）
  // ----------------------------------------------------------
  _getAltText(artwork) {
    const title = artwork.title || '未命名作品';
    const category = artwork.category || '艺术';
    const tags = artwork.tags || [];
    const styleWords = ['水彩', '油画', '数字艺术', '3D渲染', '抽象', '赛博朋克', '梦幻', '霓虹', '唯美', '极简', '复古', '未来主义', '超现实', '插画'];
    const foundStyle = tags.find(t => styleWords.some(sw => t.includes(sw))) || '';
    const catMap = {
      'scenic-photo': '文旅摄影', 'heritage-craft': '非遗文创', 'guofeng-art': '国风绘画',
      'ai-art': 'AI数字艺术', 'museum-culture': '博物文创', 'creative-design': '创意设计',
      'digital': '数字艺术', 'illustration': '插画', 'photography': '摄影',
      'abstract': '抽象艺术', '3d': '3D艺术', 'painting': '绘画', 'mixed': '混合媒介'
    };
    const catLabel = catMap[category] || category;
    const styleDesc = foundStyle ? `${foundStyle}风格` : `${catLabel}`;
    return `${title} - ${styleDesc}作品${tags.length > 0 ? '，标签：' + tags.slice(0, 3).join('、') : ''}`;
  },

  // ----------------------------------------------------------
  // 懒加载观察器（IntersectionObserver）
  // 渐进式加载：骨架屏 → 模糊缩略图 → 高清图，失败时fallback
  // ----------------------------------------------------------
  _ensureImgObserver() {
    if (this.imgObserver) return;
    const self = this;
    this.imgObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const src = el.dataset.src;
          const srcset = el.dataset.srcset;
          const thumb = el.dataset.thumb;
          const fallback = el.dataset.fallback;
          const skeleton = el.parentElement?.querySelector('.img-skeleton');

          if (src) {
            if (el.tagName === 'IMG') {
              // 步骤1：显示骨架屏（CSS已控制）
              el.style.opacity = '0';
              el.style.filter = 'blur(12px)';
              el.style.transform = 'scale(1.03)';
              el.style.transition = 'opacity 0.5s ease, filter 0.5s ease, transform 0.5s ease';

              // 步骤2：加载并显示缩略图
              const loadThumb = () => {
                if (thumb) {
                  const thumbImg = new Image();
                  thumbImg.onload = () => {
                    el.src = thumb;
                    el.style.opacity = '0.6';
                  };
                  thumbImg.onerror = () => { /* 缩略图失败，直接进入高清图 */ };
                  thumbImg.src = thumb;
                }

                // 步骤3：加载高清图
                const highResImg = new Image();
                highResImg.onload = () => {
                  if (skeleton) skeleton.style.opacity = '0';
                  if (srcset) el.srcset = srcset;
                  el.src = src;
                  el.classList.add('loaded');
                  el.style.opacity = '1';
                  el.style.filter = 'blur(0px)';
                  el.style.transform = 'scale(1)';
                  el.removeAttribute('data-src');
                  el.removeAttribute('data-srcset');
                  el.removeAttribute('data-thumb');
                  el.removeAttribute('data-fallback');
                };
                highResImg.onerror = () => {
                  // 高清图失败 → 使用category fallback
                  el.classList.add('error');
                  if (skeleton) skeleton.style.opacity = '0';
                  el.src = fallback || self._getPlaceholderSvg();
                  el.style.opacity = '1';
                  el.style.filter = 'none';
                  el.style.transform = 'none';
                  el.removeAttribute('data-src');
                  el.removeAttribute('data-srcset');
                  el.removeAttribute('data-thumb');
                  el.removeAttribute('data-fallback');
                };
                highResImg.src = src;
              };

              // 延迟一点加载，让骨架屏先显示
              requestAnimationFrame(loadThumb);
            } else if (el.tagName === 'VIDEO') {
              el.src = src;
              el.addEventListener('loadeddata', () => {
                el.classList.add('loaded');
                if (skeleton) skeleton.style.opacity = '0';
              }, { once: true });
              el.addEventListener('error', () => {
                el.classList.add('error');
                if (skeleton) skeleton.style.opacity = '0';
              }, { once: true });
              el.removeAttribute('data-src');
            }
          }
          self.imgObserver.unobserve(el);
        }
      });
    }, { rootMargin: '400px 0px', threshold: 0.01 });
  },

  // ----------------------------------------------------------
  // 生成占位图SVG（墨韵丹青风 · 朱砂方印 + 山水远景）
  // ----------------------------------------------------------
  _getPlaceholderSvg() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="442" viewBox="0 0 320 442">
      <rect width="320" height="442" fill="#faf6ee"/>
      <rect x="10" y="10" width="300" height="422" fill="none" stroke="#e6dccb" stroke-width="1"/>
      <path d="M20 260 L80 200 L130 240 L180 180 L230 220 L300 190 L300 320 L20 320 Z" fill="#9aaebf" opacity="0.5"/>
      <path d="M20 285 L70 245 L130 275 L200 225 L260 260 L300 240 L300 320 L20 320 Z" fill="#6f8a9e" opacity="0.55"/>
      <path d="M20 310 L90 285 L160 300 L230 275 L300 295 L300 320 L20 320 Z" fill="#4a5f6e" opacity="0.65"/>
      <circle cx="260" cy="95" r="18" fill="#c23e2b" opacity="0.7"/>
      <rect x="138" y="340" width="44" height="44" fill="#a8261f" opacity="0.82"/>
      <text x="160" y="370" text-anchor="middle" font-family="SimSun,serif" font-size="22" fill="#faf6ee" font-weight="700">墨</text>
    </svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  },

  // ----------------------------------------------------------
  // 滚动加载哨兵
  // ----------------------------------------------------------
  _setupSentinel() {
    let sentinel = document.getElementById('gallery-sentinel');
    if (!sentinel) {
      sentinel = document.createElement('div');
      sentinel.id = 'gallery-sentinel';
      sentinel.className = 'gallery-sentinel';
      const grid = document.getElementById('gallery-grid');
      grid.parentNode.insertBefore(sentinel, grid.nextSibling);
    }
    this._showLoader();

    if (this.sentinelObserver) this.sentinelObserver.disconnect();
    this.sentinelObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && this.renderedCount < this.lightboxList.length) {
        this._renderBatch();
      } else if (this.renderedCount >= this.lightboxList.length) {
        this._hideLoader();
      }
    }, { rootMargin: '400px 0px' });
    this.sentinelObserver.observe(sentinel);
  },

  _showLoader() {
    let loader = document.getElementById('gallery-loader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'gallery-loader';
      loader.className = 'gallery-loader';
      loader.innerHTML = '<div class="loader-orb"></div><span>梦境加载中…</span>';
    }
    const sentinel = document.getElementById('gallery-sentinel');
    if (sentinel && sentinel.parentNode && !document.getElementById('gallery-loader')) {
      sentinel.parentNode.appendChild(loader);
    }
  },
  _hideLoader() {
    const loader = document.getElementById('gallery-loader');
    if (loader) loader.style.display = 'none';
  },

  // ----------------------------------------------------------
  // 打开作品灯箱
  // ----------------------------------------------------------
  async openLightbox(artworkId) {
    // 找到在当前列表中的索引
    const idx = this.lightboxList.findIndex(a => a.id === Number(artworkId));
    if (idx === -1) {
      // 不在当前列表，从对外公开可见的作品中查找
      const all = await getPublicArtworks();
      this.lightboxList = all;
    }
    this.lightboxIndex = this.lightboxList.findIndex(a => a.id === Number(artworkId));
    this.lightboxImageIndex = 0;
    await this._renderLightbox();
  },

  async _renderLightbox() {
    const art = this.lightboxList[this.lightboxIndex];
    if (!art) return;

    // 同步URL hash，生成可分享的链接
    if (window.location.hash !== `#artwork-${art.id}`) {
      history.replaceState(null, '', `#artwork-${art.id}`);
    }

    // 仅首次打开时增加浏览数（非左右切换）
    if (!art._viewCounted) {
      try {
        await updateArtwork(art.id, { views: (art.views || 0) + 1 });
        art.views = (art.views || 0) + 1;
        art._viewCounted = true;
      } catch (e) { /* 忽略 */ }
    }

    const catLabel = this.CATEGORY_LABELS[art.category] || art.category;
    const isVideo = art.type === 'video';
    const user = window.currentUser;
    const images = art.images && art.images.length > 0 ? art.images : [art.imageUrl];
    this.lightboxImageIndex = Math.min(this.lightboxImageIndex, images.length - 1);
    const currentImage = images[this.lightboxImageIndex];

    // 查询点赞/收藏状态与数量
    // 点赞数以作品记录的 likes 为单一数据源（基线+真实记录），与列表卡片完全一致
    let likeCount = Number(art.likes);
    if (!Number.isFinite(likeCount)) {
      likeCount = await getLikes(art.id).catch(() => 0);
    }
    const [hasLiked, hasFav, comments] = await Promise.all([
      user ? hasUserLiked(art.id, user.id).catch(() => false) : false,
      user ? hasUserFavorited(art.id, user.id).catch(() => false) : false,
      getComments(art.id).catch(() => [])
    ]);

    let lb = document.getElementById('lightbox-modal');
    if (!lb) {
      lb = document.createElement('div');
      lb.className = 'modal-overlay lightbox-modal';
      lb.id = 'lightbox-modal';
      document.body.appendChild(lb);
    }
    const highResUrl = !isVideo ? this._getHighResUrl(currentImage) : '';
    const fallbackUrl = !isVideo ? this._getCategoryFallback(art.category) : '';

    lb.innerHTML = `
      <button class="lb-nav lb-prev" aria-label="上一件"><i class="fa-solid fa-chevron-left"></i></button>
      <button class="lb-nav lb-next" aria-label="下一件"><i class="fa-solid fa-chevron-right"></i></button>
      <div class="lightbox-box glass" id="lightbox-box">
        <button class="modal-close" data-lb-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
        <div class="lb-content">
          <div class="lb-media" id="lb-media-container">
            ${isVideo
              ? `<video src="${this._esc(art.imageUrl)}" controls autoplay loop playsinline></video>`
              : `<img class="lb-main-image" id="lb-main-img" src="${this._esc(currentImage)}" alt="${this._esc(art.title)}" data-highres="${this._esc(highResUrl)}" data-fallback="${this._esc(fallbackUrl)}" onload="this.style.opacity='1'; const s=document.getElementById('lb-spinner'); if(s) s.style.display='none';" onerror="const fb=this.dataset.fallback; if(fb && this.src!==fb) this.src=fb;" />
                 <div class="lb-spinner" id="lb-spinner" aria-hidden="true"><div class="lb-spinner-ring"></div></div>`
            }
            ${!isVideo && images.length > 1 ? `
              <button class="lb-img-prev" aria-label="上一张"><i class="fa-solid fa-chevron-left"></i></button>
              <button class="lb-img-next" aria-label="下一张"><i class="fa-solid fa-chevron-right"></i></button>
              <div class="lb-image-dots">
                ${images.map((_, i) => `<span class="lb-dot ${i === this.lightboxImageIndex ? 'active' : ''}" data-idx="${i}"></span>`).join('')}
              </div>
            ` : ''}
            <div class="lb-art-no">作品号 #${art.id} ${images.length > 1 ? ` · ${this.lightboxImageIndex + 1}/${images.length}` : ''}</div>
          </div>
          <div class="lb-side">
            <div class="lb-cat">${catLabel}</div>
            <h2 class="lb-title">${this._esc(art.title)}</h2>
            <div class="lb-author" data-author="${this._esc(art.author)}" data-userid="${art.userId || ''}">
              <span class="avatar-circle sm">${this._esc((art.author || '?').charAt(0))}</span>
              <div>
                <div class="lb-author-name">${this._esc(art.author)}</div>
                <div class="lb-date">${this._esc(art.createdAt || '')}</div>
              </div>
              <i class="fa-solid fa-chevron-right lb-author-arrow"></i>
            </div>
            <p class="lb-desc">${this._esc(art.description)}</p>
            ${art.tags && art.tags.length > 0 ? `
              <div class="lb-tags">
                ${art.tags.map(tag => `<span class="lb-tag" data-tag="${this._esc(tag)}">${this._esc(tag)}</span>`).join('')}
              </div>
            ` : ''}
            ${window.CultureAtlas && window.CultureAtlas.themeHint ? window.CultureAtlas.themeHint(art) : ''}
            <div class="lb-actions">
              <button class="lb-action ${hasLiked ? 'active' : ''}" id="lb-like-btn" data-id="${art.id}">
                <i class="fa-${hasLiked ? 'solid' : 'regular'} fa-heart"></i>
                <span class="lb-like-count">${this._fmtNum(likeCount)}</span>
                <span class="lb-action-label">点赞</span>
              </button>
              <button class="lb-action ${hasFav ? 'active' : ''}" id="lb-fav-btn" data-id="${art.id}">
                <i class="fa-${hasFav ? 'solid' : 'regular'} fa-bookmark"></i>
                <span class="lb-action-label">${hasFav ? '已收藏' : '收藏'}</span>
              </button>
              <button class="lb-action" id="lb-share-btn" data-id="${art.id}">
                <i class="fa-solid fa-share-nodes"></i>
                <span class="lb-action-label">分享</span>
              </button>
              <button class="lb-action" id="lb-poster-btn" data-id="${art.id}" title="生成分享海报">
                <i class="fa-solid fa-qrcode"></i>
                <span class="lb-action-label">分享卡</span>
              </button>
              <button class="lb-action lb-action--ai" id="lb-ai-edit-btn" data-id="${art.id}" title="AI修图工作台">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
                <span class="lb-action-label">AI修图</span>
              </button>
              <button class="lb-action lb-action--ai" id="lb-ai-craft-btn" data-id="${art.id}" title="AI文创衍生品">
                <i class="fa-solid fa-feather-pointed"></i>
                <span class="lb-action-label">AI文创</span>
              </button>
              <button class="lb-action lb-action--ai" id="lb-ai-report-btn" data-id="${art.id}" title="AI评级报告">
                <i class="fa-solid fa-chart-simple"></i>
                <span class="lb-action-label">评级报告</span>
              </button>
              <div class="lb-views"><i class="fa-regular fa-eye"></i> ${this._fmtNum(art.views || 0)}</div>
            </div>
            <div class="lb-comments">
              <h3 class="lb-comments-title"><i class="fa-regular fa-comments"></i> 评论 <span id="lb-comment-count">${comments.length}</span></h3>
              <div class="lb-comment-list" id="lb-comment-list"></div>
              <div class="lb-comment-input">
                <textarea id="lb-comment-text" placeholder="${user ? '写下你的梦境感言…' : '登录后发表评论'}" rows="2" ${user ? '' : 'disabled'}></textarea>
                <button class="btn-primary btn-sm" id="lb-comment-submit" data-id="${art.id}">
                  <i class="fa-solid fa-paper-plane"></i> 发送
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    requestAnimationFrame(() => {
      lb.classList.add('open');
      if (window.FocusTrap) {
        window.FocusTrap.saveFocus();
        window.FocusTrap.trapFocus(lb);
      }
    });
    if (!lb.dataset.scrollLocked) {
      if (window.ModalScrollLock) ModalScrollLock.lock();
      lb.dataset.scrollLocked = '1';
    }

    // ============================================================
    // 灯箱高清图异步加载（1200w）
    // ============================================================
    if (!isVideo) {
      const lbImg = document.getElementById('lb-main-img');
      const spinner = document.getElementById('lb-spinner');
      if (lbImg && highResUrl && highResUrl !== currentImage) {
        const hiresLoader = new Image();
        hiresLoader.onload = () => {
          lbImg.src = highResUrl;
          lbImg.style.opacity = '1';
          if (spinner) spinner.style.display = 'none';
        };
        hiresLoader.onerror = () => {
          // 高清图失败，保持当前图，隐藏spinner
          if (spinner) spinner.style.display = 'none';
        };
        hiresLoader.src = highResUrl;
      } else if (spinner) {
        spinner.style.display = 'none';
      }
    }

    // 渲染评论
    this._renderCommentList(comments);

    // 作者头像/昵称回灌：作品记录只存 author 名字，自定义头像与昵称需从 users 记录读取
    // （Bug #2：此前作者行硬编码"用户名首字符"，用户设置的自定义头像在他人视角完全不生效）
    if (art.userId) {
      try {
        const au = (typeof window.getUserById === 'function') ? await window.getUserById(art.userId) : null;
        if (au && window.Settings && typeof window.Settings.renderAvatarHtml === 'function') {
          const slot = lb.querySelector('.lb-author .avatar-circle');
          if (slot) slot.outerHTML = window.Settings.renderAvatarHtml(au, { sizeClass: 'sm' });
          const nameEl = lb.querySelector('.lb-author-name');
          if (nameEl && au.nickname) nameEl.textContent = au.nickname;
        }
      } catch (_) { /* 回灌失败不影响灯箱其余功能 */ }
    }

    // 绑定事件
    this._bindLightboxEvents(lb, art);
  },

  // ----------------------------------------------------------
  // 渲染评论列表
  // ----------------------------------------------------------
  async _renderCommentList(comments) {
    const list = document.getElementById('lb-comment-list');
    if (!list) return;
    if (!comments || comments.length === 0) {
      list.innerHTML = '<div class="lb-no-comment">还没有评论，成为第一个发声的人吧</div>';
      return;
    }
    // 评论记录只存 userId + username，头像需按账户解析：一次性读 users 表建映射，
    // 避免逐条查询（评论者自定义头像据此生效）
    const users = (window.Settings && typeof window.Settings.buildUserMap === 'function')
      ? await window.Settings.buildUserMap() : new Map();
    const avatarOf = (c) => (window.Settings && typeof window.Settings.renderAvatarHtml === 'function')
      ? window.Settings.renderAvatarHtml(users.get(String(c.userId)) || { username: c.username }, { sizeClass: 'sm' })
      : `<span class="avatar-circle sm">${this._esc((c.username || '?').charAt(0))}</span>`;
    list.innerHTML = comments.map(c => `
      <div class="comment-item">
        ${avatarOf(c)}
        <div class="comment-body">
          <div class="comment-head">
            <span class="comment-user">${this._esc(c.username)}</span>
            <span class="comment-time">${this._fmtTime(c.createdAt)}</span>
          </div>
          <p class="comment-text">${this._esc(c.content)}</p>
        </div>
      </div>
    `).join('');
    const cnt = document.getElementById('lb-comment-count');
    if (cnt) cnt.textContent = comments.length;
  },

  // ----------------------------------------------------------
  // 灯箱事件绑定
  // ----------------------------------------------------------
  _bindLightboxEvents(lb, art) {
    // 关闭
    lb.addEventListener('click', (e) => {
      if (e.target === lb || e.target.closest('[data-lb-close]')) this.closeLightbox();
    });
    // 作品左右切换
    lb.querySelector('.lb-prev').addEventListener('click', () => this._navLightbox(-1));
    lb.querySelector('.lb-next').addEventListener('click', () => this._navLightbox(1));

    // 图片左右切换（多图轮播）
    const imgPrev = lb.querySelector('.lb-img-prev');
    const imgNext = lb.querySelector('.lb-img-next');
    if (imgPrev) imgPrev.addEventListener('click', (e) => { e.stopPropagation(); this._navImage(-1); });
    if (imgNext) imgNext.addEventListener('click', (e) => { e.stopPropagation(); this._navImage(1); });

    // 图片轮播指示器点击
    const dots = lb.querySelectorAll('.lb-dot');
    dots.forEach(dot => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(dot.dataset.idx, 10);
        this._goToImage(idx);
      });
    });

    // 点击作者区域 → 进入该用户的个人资料页
    // （Bug #3 修复：此前先 closeLightbox 再 Artist.openByUserId，用户记录查不到时静默
    //   return → 灯箱已关、弹窗未开，表现为"错误返回主界面"。改为路由跳转，稳定可达。）
    const authorEl = lb.querySelector('.lb-author');
    if (authorEl) {
      authorEl.addEventListener('click', () => {
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        const userId = authorEl.dataset.userid;
        const authorName = authorEl.dataset.author;
        this.closeLightbox();
        if (userId) {
          // 云端用户 id 为 UUID 字符串，encode 后再拼接，避免特殊字符破坏路由
          window.location.hash = `#/profile-${encodeURIComponent(userId)}`;
        } else if (window.Artist) {
          // 无 userId 的种子作品 → 回退到按作者名的艺术家主页
          Artist.openByAuthorName(authorName);
        }
      });
    }

    // 点击标签筛选
    const tagEls = lb.querySelectorAll('.lb-tag');
    tagEls.forEach(tagEl => {
      tagEl.addEventListener('click', () => {
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        const tag = tagEl.dataset.tag;
        this.closeLightbox();
        this.filterByTag(tag);
      });
    });

    // 文化主题引导（不点亮足迹，仅引导去图鉴阅读）
    const cultureHint = lb.querySelector('.lb-culture-hint');
    if (cultureHint) {
      cultureHint.addEventListener('click', () => {
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        const themeId = cultureHint.dataset.cultureTheme;
        this.closeLightbox();
        window.location.hash = '#/atlas?theme=' + themeId;
      });
    }

    // 点赞
    const likeBtn = lb.querySelector('#lb-like-btn');
    if (likeBtn) {
      likeBtn.addEventListener('click', () => {
        if (typeof handleLike === 'function') handleLike(art.id, likeBtn);
      });
    }
    // 收藏
    const favBtn = lb.querySelector('#lb-fav-btn');
    if (favBtn) {
      favBtn.addEventListener('click', () => {
        if (typeof handleFavorite === 'function') handleFavorite(art.id, favBtn);
      });
    }
    // 分享
    const shareBtn = lb.querySelector('#lb-share-btn');
    if (shareBtn) {
      shareBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window.Share) Share.showShareMenu(art, shareBtn);
      });
    }
    // P0-2: 分享海报（通用分享卡，取灯箱当前展示图）
    const posterBtn = lb.querySelector('#lb-poster-btn');
    if (posterBtn) {
      posterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        const cur = this.lightboxList[this.lightboxIndex] || art;
        const imgs = cur.images && cur.images.length > 0 ? cur.images : [cur.imageUrl];
        const mainImg = document.getElementById('lb-main-img');
        const posterImage = cur.type === 'video'
          ? this._getCategoryFallback(cur.category)
          : ((mainImg && mainImg.src) || imgs[this.lightboxImageIndex] || cur.imageUrl);
        SharePoster.downloadPoster({
          image: posterImage,
          title: cur.title,
          author: cur.author,
          themeTag: this.CATEGORY_LABELS[cur.category] || cur.category,
          badge: `❤ ${this._fmtNum(Number(cur.likes) || 0)}`,
          footerCta: '来 Dreamcore 创作你的文化文创'
        });
      });
    }
    // M1-1: AI修图入口（跳转工作台，携带 artworkId）
    const aiEditBtn = lb.querySelector('#lb-ai-edit-btn');
    if (aiEditBtn) {
      aiEditBtn.addEventListener('click', () => {
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        this.closeLightbox();
        window.location.hash = '#/edit?artworkId=' + art.id;
      });
    }
    // M1-1: AI文创入口
    const aiCraftBtn = lb.querySelector('#lb-ai-craft-btn');
    if (aiCraftBtn) {
      aiCraftBtn.addEventListener('click', () => {
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        this.closeLightbox();
        window.location.hash = '#/craft?artworkId=' + art.id;
      });
    }
    // M1-1: AI评级报告入口
    const aiReportBtn = lb.querySelector('#lb-ai-report-btn');
    if (aiReportBtn) {
      aiReportBtn.addEventListener('click', () => {
        if (typeof Sound !== 'undefined') Sound.playSound('pop');
        if (window.AIAesthetic && typeof window.AIAesthetic.renderAestheticReport === 'function') {
          window.AIAesthetic.renderAestheticReport(art.id).catch(err => {
            console.warn('[Gallery] 评级报告失败:', err);
          });
        }
      });
    }
    // 评论
    const submit = lb.querySelector('#lb-comment-submit');
    const textarea = lb.querySelector('#lb-comment-text');
    if (submit) {
      submit.addEventListener('click', async () => {
        const content = textarea.value.trim();
        if (!content) return;
        if (typeof handleComment === 'function') {
          await handleComment(art.id, content);
          textarea.value = '';
          // 刷新评论
          const comments = await getComments(art.id);
          this._renderCommentList(comments);
        }
      });
    }
  },

  // ----------------------------------------------------------
  // 灯箱作品左右导航
  // ----------------------------------------------------------
  _navLightbox(dir) {
    if (typeof Sound !== 'undefined') Sound.playSound('click');
    this.lightboxIndex = (this.lightboxIndex + dir + this.lightboxList.length) % this.lightboxList.length;
    this.lightboxImageIndex = 0;
    this._renderLightbox();
  },

  // ----------------------------------------------------------
  // 多图轮播导航
  // ----------------------------------------------------------
  _navImage(dir) {
    const art = this.lightboxList[this.lightboxIndex];
    if (!art) return;
    const images = art.images || [art.imageUrl];
    if (images.length <= 1) return;

    this.lightboxImageIndex = (this.lightboxImageIndex + dir + images.length) % images.length;
    this._updateLightboxImage();
  },

  // ----------------------------------------------------------
  // 跳转到指定图片
  // ----------------------------------------------------------
  _goToImage(idx) {
    const art = this.lightboxList[this.lightboxIndex];
    if (!art) return;
    const images = art.images || [art.imageUrl];
    if (idx < 0 || idx >= images.length) return;

    this.lightboxImageIndex = idx;
    this._updateLightboxImage();
  },

  // ----------------------------------------------------------
  // 更新灯箱图片（仅换图，不重新渲染整个灯箱）
  // ----------------------------------------------------------
  _updateLightboxImage() {
    const art = this.lightboxList[this.lightboxIndex];
    if (!art) return;
    const images = art.images || [art.imageUrl];
    const currentImage = images[this.lightboxImageIndex];

    const imgEl = document.querySelector('.lb-main-image');
    if (imgEl) {
      imgEl.style.opacity = '0';
      imgEl.style.transform = 'scale(0.98)';
      setTimeout(() => {
        imgEl.src = currentImage;
        imgEl.onload = () => {
          imgEl.style.opacity = '1';
          imgEl.style.transform = 'scale(1)';
        };
      }, 150);
    }

    // 更新指示器
    const dots = document.querySelectorAll('.lb-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === this.lightboxImageIndex);
    });

    // 更新计数
    const artNo = document.querySelector('.lb-art-no');
    if (artNo) {
      artNo.textContent = `作品号 #${art.id} · ${this.lightboxImageIndex + 1}/${images.length}`;
    }

    if (typeof Sound !== 'undefined') Sound.playSound('click');
  },

  // ----------------------------------------------------------
  // 关闭灯箱
  // ----------------------------------------------------------
  closeLightbox() {
    const lb = document.getElementById('lightbox-modal');
    if (!lb) return;
    if (window.FocusTrap) {
      window.FocusTrap.releaseFocus(lb);
    }
    lb.classList.remove('open');
    if (lb.dataset.scrollLocked) {
      if (window.ModalScrollLock) ModalScrollLock.unlock();
      delete lb.dataset.scrollLocked;
    }
    // 清除URL hash，恢复干净地址
    if (window.location.hash && window.location.hash.match(/^#artwork-\d+$/)) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
    if (typeof Sound !== 'undefined') Sound.playSound('close');
    setTimeout(() => { if (lb) lb.innerHTML = ''; }, 300);
  },

  // ----------------------------------------------------------
  // 刷新画廊（发布/删除作品后调用）
  // ----------------------------------------------------------
  refreshGallery() {
    return this.loadArtworks(this.currentCategory);
  },

  // ----------------------------------------------------------
  // 工具：数字格式化
  // ----------------------------------------------------------
  _fmtNum(n) {
    n = Number(n) || 0;
    if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n;
  },

  // ----------------------------------------------------------
  // 工具：时间格式化（刚刚/x分钟前/x小时前/x天前）
  // ----------------------------------------------------------
  _fmtTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const min = 60 * 1000, hour = 60 * min, day = 24 * hour;
    if (diff < min) return '刚刚';
    if (diff < hour) return Math.floor(diff / min) + '分钟前';
    if (diff < day) return Math.floor(diff / hour) + '小时前';
    if (diff < 30 * day) return Math.floor(diff / day) + '天前';
    return d.toLocaleDateString('zh-CN');
  },

  // ----------------------------------------------------------
  // 工具：HTML 转义
  // ----------------------------------------------------------
  _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  },

  // --- AI评分批量加载 ---
  async _attachAestheticScores() {
    if(!this.allArtworks||!this.allArtworks.length)return;
    const fn=(typeof getAestheticScoresByArtwork==='function')?getAestheticScoresByArtwork:null;
    if(!fn)return;
    const results=await Promise.all(this.allArtworks.map(a=>fn(a.id).catch(()=>[])));
    const scoreFn=(typeof scoreArtwork==='function')?scoreArtwork:null;
    this.allArtworks.forEach((a,i)=>{
      const list=results[i];
      a._latestScore=(list&&list[0])||null;
      if(a._latestScore&&!a.aiScored)a.aiScored=true;
      if(!a._latestScore&&a.aiScored===true&&scoreFn){
        const u=(typeof window!=='undefined')?window.currentUser:null;
        if(u)scoreFn(a.id,u.id).then(r=>{if(r&&!r.error)this.refreshGallery();}).catch(()=>{});
      }
    });
    this._seedMissingGrades();
  },

  // ----------------------------------------------------------
  // M1-5: 未评分作品（初始种子作品）确定性评级
  // 算法：质量分 = likes*0.4 + views*0.001 + id哈希微扰
  //       → 降序分位映射等级（top3% SSS / 8% SS / 15% S / 30% A / 30% B / 其余C）
  //       → 等级区间内哈希生成确定性总分，并持久化到 aesthetic_scores
  // ----------------------------------------------------------
  _seedMissingGrades() {
    // M7: 种子自带评级标签（artworks.js 携带 grade/totalScore）→ 直接采用并持久化
    this.allArtworks.forEach(a => {
      if (a && !a._latestScore && a.grade && a.totalScore) {
        const g = String(a.grade).toLowerCase();
        const t = Number(a.totalScore) || 0;
        a._latestScore = { artworkId: Number(a.id), totalScore: t, grade: g, synthetic: true };
        a.aiScored = true;
        try {
          if (typeof addAestheticScore === 'function') {
            addAestheticScore({
              artworkId: Number(a.id),
              userId: a.userId || null,
              scores: { composition: 0, lighting: 0, color: 0, clarity: 0, theme: 0 },
              totalScore: t,
              grade: g,
              similarWorks: [],
              teachingComments: '{}',
              aiDescription: '',
              degraded: false,
              synthetic: true
            }).catch(() => {});
          }
        } catch (_) { /* 持久化失败不影响展示 */ }
      }
    });
    const pending = this.allArtworks.filter(a => !a._latestScore);
    if (!pending.length) return;
    const quality = pending.map(a =>
      (Number(a.likes) || 0) * 0.4 + (Number(a.views) || 0) * 0.001 + this._hashJitter(a.id) * 0.3
    );
    const sorted = pending.map((a, i) => ({ a, q: quality[i] })).sort((x, y) => y.q - x.q);
    const n = sorted.length;
    sorted.forEach((item, rank) => {
      const pct = (rank + 1) / n; // (0,1] top=最小
      let key;
      if (pct <= 0.03) key = 'sss';
      else if (pct <= 0.11) key = 'ss';
      else if (pct <= 0.26) key = 's';
      else if (pct <= 0.56) key = 'a';
      else if (pct <= 0.86) key = 'b';
      else key = 'c';
      const j = this._hashJitter(item.a.id);
      const range = { sss: [9.5, 10], ss: [9.0, 9.4], s: [8.5, 8.9], a: [7.5, 8.4], b: [6.5, 7.4], c: [5.5, 6.4] }[key];
      const totalScore = Math.round((range[0] + j * (range[1] - range[0])) * 10) / 10;
      item.a._latestScore = { artworkId: Number(item.a.id), totalScore, grade: key, synthetic: true };
      item.a.aiScored = true;
      // 持久化到 IndexedDB（幂等：已有记录的作品不会进入 pending）
      try {
        if (typeof addAestheticScore === 'function') {
          addAestheticScore({
            artworkId: Number(item.a.id),
            userId: item.a.userId || null,
            scores: { composition: 0, lighting: 0, color: 0, clarity: 0, theme: 0 },
            totalScore,
            grade: key,
            similarWorks: [],
            teachingComments: '{}',
            aiDescription: '',
            degraded: false,
            synthetic: true
          }).catch(() => {});
        }
      } catch (_) { /* 持久化失败不影响展示 */ }
    });
  },

  // --- 简单字符串哈希 → [0,1) 确定性微扰 ---
  _hashJitter(id) {
    const s = String(id);
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return (h % 1000) / 1000;
  },

  // ----------------------------------------------------------
  // M1-2: 作品选择器（裸路由 #/edit / #/craft 无 artworkId 时降级入口）
  // onPick(artworkId) 选中回调；title 弹窗标题
  // ----------------------------------------------------------
  openArtworkPicker(onPick, title) {
    this._pickerOnPick = typeof onPick === 'function' ? onPick : null;
    let overlay = document.getElementById('artwork-picker-modal');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.className = 'modal-overlay artwork-picker-modal';
    overlay.id = 'artwork-picker-modal';
    overlay.innerHTML = `
      <div class="modal-box glass artwork-picker-box">
        <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
        <h2 class="ap-title">${title || '选择一件作品'}</h2>
        <p class="ap-sub">选择作品后进入 AI 工作台</p>
        <div class="ap-tabs" role="tablist">
          <button class="ap-tab active" data-tab="mine" role="tab">我的作品</button>
          <button class="ap-tab" data-tab="hot" role="tab">热门作品</button>
        </div>
        <div class="ap-grid" id="ap-grid"><div class="ap-loading"><i class="fa-solid fa-spinner fa-spin"></i> 加载中…</div></div>
      </div>
    `;
    document.body.appendChild(overlay);
    if (window.ModalScrollLock) ModalScrollLock.lock();
    requestAnimationFrame(() => overlay.classList.add('open'));
    const close = () => {
      overlay.classList.remove('open');
      setTimeout(() => {
        overlay.remove();
        if (window.ModalScrollLock) ModalScrollLock.unlock();
      }, 220);
    };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('[data-close]')) close();
    });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
    const renderGrid = (list, emptyMsg) => {
      const grid = overlay.querySelector('#ap-grid');
      if (!grid) return;
      if (!list || !list.length) {
        grid.innerHTML = `<div class="ap-empty">${emptyMsg || '暂无作品，先去发布一件吧'}</div>`;
        return;
      }
      grid.innerHTML = list.slice(0, 24).map(a => `
        <button class="ap-card" data-id="${a.id}" title="${this._esc(a.title)}">
          <img src="${this._esc(a.imageUrl || (Array.isArray(a.images) && a.images[0]) || '')}" alt="${this._esc(a.title)}" loading="lazy" />
          <span class="ap-card-title">${this._esc(a.title)}</span>
        </button>
      `).join('');
      grid.querySelectorAll('.ap-card').forEach(card => {
        card.addEventListener('click', () => {
          if (typeof Sound !== 'undefined') Sound.playSound('click');
          const id = Number(card.dataset.id);
          close();
          if (this._pickerOnPick) this._pickerOnPick(id);
        });
      });
    };
    const loadList = async (tab) => {
      let list = [];
      let emptyMsg = null;
      if (tab === 'mine') {
        if (window.currentUser && typeof getUserArtworks === 'function') {
          // 严格按当前用户过滤：为空时如实展示空态，绝不回退到全局热门作品
          list = (await getUserArtworks(window.currentUser.id).catch(() => [])) || [];
          if (!list.length) emptyMsg = '你还没有发布作品，先去发布一件吧';
        } else {
          emptyMsg = '登录后即可在这里看到你的作品';
        }
      } else {
        list = [...(this.allArtworks || [])].sort((x, y) => (Number(y.likes) || 0) - (Number(x.likes) || 0));
        if (!list.length) emptyMsg = '暂无作品';
      }
      return { list, emptyMsg };
    };
    const tabs = overlay.querySelectorAll('.ap-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', async () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const grid = overlay.querySelector('#ap-grid');
        if (grid) grid.innerHTML = '<div class="ap-loading"><i class="fa-solid fa-spinner fa-spin"></i> 加载中…</div>';
        const r = await loadList(tab.dataset.tab);
        renderGrid(r.list, r.emptyMsg);
      });
    });
    // 该选择器的语义是「选择我的作品」（AI评分/修图/文创均作用于自己的作品），
    // 因此默认停在「我的作品」Tab。未登录时该 Tab 如实展示登录引导，
    // 绝不回退到全局热门作品（与回归①一致）。
    loadList('mine').then(r => renderGrid(r.list, r.emptyMsg));
  },

  // --- 卡片AI评分摘要HTML ---
  _aestheticCardHtml(artwork) {
    const s=artwork&&artwork._latestScore;
    if(s){
      const t=Number(s.totalScore)||0,g=this._gradeMeta(t),id=artwork.id;
      return '<div class="card-aesthetic card-aesthetic--rated" data-artwork-id="'+id+'"><span class="card-aesthetic-score"><i class="fa-solid fa-star"></i> '+t.toFixed(1)+'</span><span class="card-aesthetic-grade" style="--grade-color:'+g.color+'">'+g.icon+' '+g.en+' · '+g.zh+'</span></div>';
    }
    if(artwork&&artwork.aiScored===true)return '<div class="card-aesthetic card-aesthetic--loaded"><span class="card-aesthetic-grade" style="--grade-color:#9ca3af;"><i class="fa-solid fa-spinner fa-spin"></i> 评分加载中</span></div>';
    // 未评分作品默认显示 C 等级
    const dg=this._gradeMeta(0);
    return '<div class="card-aesthetic card-aesthetic--pending"><span class="card-aesthetic-grade" style="--grade-color:'+dg.color+';">'+dg.icon+' '+dg.en+' · '+dg.zh+'</span></div>';
  },

  // --- 总分->定级元信息 ---
  _gradeMeta(totalScore) {
    const m=(typeof mapGrade==='function')?mapGrade:((typeof window!=='undefined'&&window.AIAesthetic&&window.AIAesthetic.mapGrade)||null);
    if(m){try{return m(Number(totalScore)||0);}catch(_){}}
    const s=Math.max(0,Math.min(10,Number(totalScore)||0));
    // M1-4 评级颜色规范：SSS/SS/S 金色系 / A 粉紫 / B 天蓝 / C 灰白
    if(s>=9.5)return{key:'sss',zh:'顶级神作',en:'SSS',icon:_ICONS.crown,color:'#ffd700'}
    if(s>=9.0)return{key:'ss',zh:'大师级',en:'SS',icon:_ICONS.trophy,color:'#fbbf24'}
    if(s>=8.5)return{key:'s',zh:'优秀',en:'S',icon:_ICONS.sparkle,color:'#f59e0b'}
    if(s>=7.5)return{key:'a',zh:'良好',en:'A',icon:_ICONS.target,color:'#c084fc'}
    if(s>=6.5)return{key:'b',zh:'合格',en:'B',icon:_ICONS.leaf,color:'#38bdf8'}
    return{key:'c',zh:'待提升',en:'C',icon:_ICONS.sprout,color:'#cbd5e1'}
  }
};
document.addEventListener('keydown', (e) => {
  const lb = document.getElementById('lightbox-modal');
  if (!lb || !lb.classList.contains('open')) return;

  // 检查焦点是否在输入框中
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;

  if (e.key === 'ArrowLeft') {
    // Shift + 左箭头：切换图片；普通左箭头：切换作品
    if (e.shiftKey) {
      Gallery._navImage(-1);
    } else {
      Gallery._navLightbox(-1);
    }
  }
  if (e.key === 'ArrowRight') {
    if (e.shiftKey) {
      Gallery._navImage(1);
    } else {
      Gallery._navLightbox(1);
    }
  }
  if (e.key === 'Escape') Gallery.closeLightbox();
});

// 暴露为全局
window.Gallery = Gallery;

// ES Module export
export default Gallery;
export { Gallery };
