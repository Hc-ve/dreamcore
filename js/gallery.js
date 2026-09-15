// ============================================================
// js/gallery.js — 作品展示系统
// 功能: 分类筛选、瀑布流布局、图片懒加载、分批渲染(虚拟滚动)
//       作品灯箱(多图轮播/介绍/作者/点赞/收藏/评论/标签)、键盘切换
//       排序功能(热门/最新/推荐)、标签筛选
// ============================================================

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
  CATEGORY_LABELS: {
    'all': '全部',
    'digital-art': '数字艺术',
    'photography': '摄影',
    'illustration': '插画',
    'abstract': '抽象',
    '3d-art': '3D艺术'
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
    fallbacks: {
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
    this.allArtworks = await getAllArtworks();
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
      this.allArtworks = await getAllArtworks();
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
  // 生成占位图SVG（base64）
  // ----------------------------------------------------------
  _getPlaceholderSvg() {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300">
      <rect fill="rgba(201,182,255,0.1)" width="400" height="300"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-family="sans-serif" font-size="14">图片加载失败</text>
    </svg>`;
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
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
      // 不在当前列表，从全部作品中查找
      const all = await getAllArtworks();
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
    const [likeCount, hasLiked, hasFav, comments] = await Promise.all([
      getLikes(art.id).catch(() => art.likes || 0),
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
              <span class="avatar-circle sm">${this._esc(art.author.charAt(0))}</span>
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

    // 绑定事件
    this._bindLightboxEvents(lb, art);
  },

  // ----------------------------------------------------------
  // 渲染评论列表
  // ----------------------------------------------------------
  _renderCommentList(comments) {
    const list = document.getElementById('lb-comment-list');
    if (!list) return;
    if (!comments || comments.length === 0) {
      list.innerHTML = '<div class="lb-no-comment">还没有评论，成为第一个发声的人吧</div>';
      return;
    }
    list.innerHTML = comments.map(c => `
      <div class="comment-item">
        <span class="avatar-circle sm">${this._esc((c.username || '?').charAt(0))}</span>
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

    // 点击作者区域打开艺术家主页
    const authorEl = lb.querySelector('.lb-author');
    if (authorEl) {
      authorEl.addEventListener('click', () => {
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        const userId = authorEl.dataset.userid;
        const authorName = authorEl.dataset.author;
        if (window.Artist) {
          this.closeLightbox();
          if (userId) {
            Artist.openByUserId(Number(userId));
          } else {
            Artist.openByAuthorName(authorName);
          }
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
  }
};

// 键盘事件
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
