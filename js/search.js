// ============================================================
// js/search.js — 搜索系统增强版
// 功能: 模糊匹配 / 历史记录 / 热门搜索 / 排序筛选 / 空状态
//       M7 智能搜索增强: 语义搜索 + 标签云 + AI 评分筛选
// ============================================================

// 作品可见性统一入口：搜索只暴露对外公开可见的作品（下架/删除/待审核不可见）
import { getAestheticScoresByArtwork, getPublicArtworks } from './db.js';
import { DIMENSIONS } from './ai-aesthetic.js';

const Search = {
  debounceTimer: null,
  isOpen: false,
  allArtworks: [],
  currentResults: [],
  currentKeyword: '',
  currentSort: 'relevance',
  currentCategory: 'all',
  // M7 增强状态
  currentMinScore: 0,
  _scoresCache: new Map(),
  _tagCloudRendered: false,
  HOT_KEYWORDS: ['梦幻', '抽象', '霓虹', '星河', '赛博朋克', '水彩', '未来', '自然'],
  HISTORY_KEY: 'dreamcore_search_history',
  MAX_HISTORY: 10,

  init() {
    const navInput = document.getElementById('nav-search-input');
    if (navInput) {
      navInput.addEventListener('input', (e) => {
        this.handleSearch(e.target.value);
      });
      navInput.addEventListener('focus', async () => {
        if (this.allArtworks.length === 0) {
          this.allArtworks = await getPublicArtworks();
        }
      });
    }
  },

  async showSearchBar() {
    if (typeof Sound !== 'undefined') Sound.playSound('pop');
    // 每次打开都刷新 IndexedDB —— 用户发布/删除/编辑作品后 Search 必须感知变化
    this.allArtworks = await getPublicArtworks();
    const overlay = document.getElementById('search-modal');
    if (overlay) {
      if (!this.isOpen) {
        overlay.classList.add('open');
        this.isOpen = true;
        if (window.ModalScrollLock) ModalScrollLock.lock();
        // 重新打开时刷新历史记录列表和焦点陷阱
        this._renderHistoryList();
        this._setupFocusTrap(overlay);
        this._renderEnhancedPanel();
      }
      setTimeout(() => {
        const input = overlay.querySelector('#search-input');
        if (input) input.focus();
      }, 200);
      return;
    }
    this._buildModal();
    this._renderEnhancedPanel();
  },

  _triggerElement: null,

  _buildModal() {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay search-modal';
    overlay.id = 'search-modal';
    overlay.innerHTML = `
      <div class="search-panel glass">
        <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
        <div class="search-header">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" id="search-input" placeholder="搜索作品名 / 作品号 / 艺术家…" autocomplete="off" />
        </div>
        <div class="search-suggest" id="search-suggest-section">
          <div class="search-dropdown-section">
            <div class="search-dropdown-title"><span><i class="fa-solid fa-fire"></i> 热门搜索</span></div>
            <div class="search-hot-list" id="search-hot-list"></div>
          </div>
          <div class="search-dropdown-section" id="search-history-section">
            <div class="search-dropdown-title">
              <span><i class="fa-regular fa-clock"></i> 搜索历史</span>
              <button class="search-history-clear" id="search-history-clear">清除全部</button>
            </div>
            <div class="search-history-list" id="search-history-list"></div>
          </div>
        </div>
        <div class="search-enhanced-panel" id="search-enhanced-panel">
          <div class="tag-cloud" id="search-tag-cloud"></div>
          <div class="search-filters">
            <div class="filter-group">
              <label>分类</label>
              <div class="custom-select" id="filter-category-wrap">
                <div class="custom-select-trigger" id="filter-category-trigger">
                  <span class="custom-select-label">全部</span>
                  <i class="fa-solid fa-chevron-down"></i>
                </div>
                <div class="custom-select-options" id="filter-category-options">
                  <!-- JS 填充 -->
                </div>
                <!-- 保留原生 select 作值同步 -->
                <select id="filter-category" hidden><option value="all">全部</option></select>
              </div>
            </div>
            <div class="filter-group">
              <label>AI 评分</label>
              <div class="score-range">最低分 <input type="number" min="0" max="10" step="0.1" id="filter-min-score" value="0" /></div>
            </div>
          </div>
        </div>
        <div class="search-results" id="search-results">
          <div class="search-empty-hint">输入关键词，开始探索梦境艺术</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    if (window.ModalScrollLock) ModalScrollLock.lock();
    requestAnimationFrame(() => overlay.classList.add('open'));
    this.isOpen = true;

    const input = overlay.querySelector('#search-input');
    input.addEventListener('input', (e) => this.handleSearch(e.target.value));
    input.addEventListener('focus', () => this._showSuggest());
    // G-02 修复：Enter 键提交搜索 → 渲染结果 + 关弹窗 + 更新 hash（让 Router 更新标题/canonical）
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const q = (e.target.value || '').trim();
        if (!q) return;
        this._doSearch(q);
        // 关弹窗后更新 hash —— Router 会更新 document.title / canonical
        setTimeout(() => {
          window.location.hash = `#search?q=${encodeURIComponent(q)}`;
        }, 50);
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('[data-close]')) this._close();
    });

    overlay.addEventListener('click', (e) => {
      if (!e.target.closest('.search-header') && !e.target.closest('.search-suggest')) {
        this._hideSuggest();
      }
    });

    document.getElementById('search-history-clear')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearHistory();
    });

    this._renderHotList();
    this._renderHistoryList();
    this._setupEnhancedPanelHandlers();

    setTimeout(() => {
      input.focus();
      this._setupFocusTrap(overlay);
    }, 200);
  },

  _setupFocusTrap(overlay) {
    const focusable = Array.from(overlay.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const trapHandler = (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this._close();
      }
    };

    overlay._focusTrapHandler = trapHandler;
    overlay.addEventListener('keydown', trapHandler);
  },

  _removeFocusTrap() {
    const overlay = document.getElementById('search-modal');
    if (overlay && overlay._focusTrapHandler) {
      overlay.removeEventListener('keydown', overlay._focusTrapHandler);
      overlay._focusTrapHandler = null;
    }
  },

  _showSuggest() {
    const section = document.getElementById('search-suggest-section');
    if (section) section.style.display = 'block';
  },

  _hideSuggest() {
    const section = document.getElementById('search-suggest-section');
    if (section) section.style.display = 'none';
  },

  _renderHotList() {
    const list = document.getElementById('search-hot-list');
    if (!list) return;
    list.innerHTML = this.HOT_KEYWORDS.map((kw, i) => `
      <span class="search-hot-tag ${i === 0 ? 'hot-1' : ''}" data-kw="${this._esc(kw)}">${this._esc(kw)}</span>
    `).join('');
    list.querySelectorAll('.search-hot-tag').forEach(tag => {
      tag.addEventListener('click', () => {
        const kw = tag.dataset.kw;
        this._doSearch(kw);
      });
    });
  },

  _getHistory() {
    try {
      const raw = localStorage.getItem(this.HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },

  _saveHistory(keyword) {
    if (!keyword || !keyword.trim()) return;
    let history = this._getHistory();
    history = history.filter(h => h !== keyword);
    history.unshift(keyword);
    history = history.slice(0, this.MAX_HISTORY);
    try { localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history)); } catch {}
  },

  _removeHistory(keyword) {
    let history = this._getHistory();
    history = history.filter(h => h !== keyword);
    try { localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history)); } catch {}
    this._renderHistoryList();
  },

  clearHistory() {
    try { localStorage.removeItem(this.HISTORY_KEY); } catch {}
    this._renderHistoryList();
    if (window.showToast) showToast('搜索历史已清除', 'success');
  },

  _renderHistoryList() {
    const list = document.getElementById('search-history-list');
    const section = document.getElementById('search-history-section');
    if (!list || !section) return;

    const history = this._getHistory();
    if (history.length === 0) {
      section.style.display = 'none';
      return;
    }
    section.style.display = 'block';
    list.innerHTML = history.map(kw => `
      <div class="search-history-item" data-kw="${this._esc(kw)}">
        <i class="fa-regular fa-clock" style="font-size:10px;opacity:0.6;"></i>
        <span>${this._esc(kw)}</span>
        <span class="history-remove" title="删除"><i class="fa-solid fa-xmark"></i></span>
      </div>
    `).join('');
    list.querySelectorAll('.search-history-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.history-remove')) {
          e.stopPropagation();
          this._removeHistory(item.dataset.kw);
          return;
        }
        this._doSearch(item.dataset.kw);
      });
    });
  },

  handleSearch(keyword) {
    clearTimeout(this.debounceTimer);
    const q = (keyword || '').trim();
    if (!q) {
      this._renderEmptyState();
      this._showSuggest();
      return;
    }
    this.debounceTimer = setTimeout(() => {
      this._doSearch(q);
    }, 300);
  },

  _doSearch(keyword) {
    const input = document.getElementById('search-input');
    if (input) input.value = keyword;
    this.currentKeyword = keyword;
    this.currentSort = 'relevance';
    this.currentCategory = 'all';
    this._syncCategorySelect();
    this._hideSuggest();
    this._saveHistory(keyword);
    const results = this._search(keyword);
    this.currentResults = results;
    this.renderSearchResults(results, keyword);
    if (typeof Sound !== 'undefined') Sound.playSound('click');
  },

  _search(q) {
    const kw = q.toLowerCase();
    const trimmed = q.trim();
    const idMatch = trimmed.match(/^#?(\d+)$/);
    const isIdSearch = !!idMatch;
    const idVal = isIdSearch ? parseInt(idMatch[1], 10) : null;

    // M7: 关键词搜索走语义搜索；ID 搜索保留精确匹配
    if (isIdSearch) {
      return this.allArtworks.filter(a => a.id === idVal);
    }
    return this.semanticSearch(q, this.allArtworks);
  },

  _sortResults(results, sortType, keyword) {
    const sorted = [...results];
    switch (sortType) {
      case 'popular':
        sorted.sort((a, b) => (b.likes || 0) - (a.likes || 0));
        break;
      case 'latest':
        sorted.sort((a, b) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          if (dateB !== dateA) return dateB - dateA;
          return (b.id || 0) - (a.id || 0);
        });
        break;
      case 'relevance':
      default:
        const kw = keyword.toLowerCase();
        sorted.sort((a, b) => {
          const scoreA = this._calcRelevance(a, kw);
          const scoreB = this._calcRelevance(b, kw);
          return scoreB - scoreA;
        });
        break;
    }
    return sorted;
  },

  _calcRelevance(art, kw) {
    let score = 0;
    const title = (art.title || '').toLowerCase();
    const author = (art.author || '').toLowerCase();
    const desc = (art.description || '').toLowerCase();
    const tags = art.tags || [];

    if (title === kw) score += 100;
    else if (title.startsWith(kw)) score += 60;
    else if (title.includes(kw)) score += 40;

    if (author === kw) score += 50;
    else if (author.includes(kw)) score += 25;

    if (tags.some(t => t.toLowerCase() === kw)) score += 45;
    else if (tags.some(t => t.toLowerCase().includes(kw))) score += 20;

    if (desc.includes(kw)) score += 10;

    score += (art.likes || 0) * 0.01;
    return score;
  },

  async renderSearchResults(results, keyword) {
    const container = document.getElementById('search-results');
    if (!container) return;

    // 分类筛选（chips 与 enhanced panel 的 select 共用 currentCategory）
    let filtered = this.currentCategory === 'all'
      ? results
      : results.filter(a => a.category === this.currentCategory);

    // M7: AI 评分最低分筛选（异步获取评分）
    if (this.currentMinScore > 0) {
      filtered = await this._applyScoreFilter(filtered, this.currentMinScore);
    }

    const sorted = this._sortResults(filtered, this.currentSort, keyword);

    if (!sorted || sorted.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fa-regular fa-face-frown empty-state-icon"></i>
          <p class="empty-state-text">未找到与「${this._esc(keyword)}」相关的作品</p>
          <p class="empty-state-hint">试试其他关键词，如作品名、艺术家或作品号</p>
        </div>
      `;
      return;
    }

    const catLabels = window.Gallery ? Gallery.CATEGORY_LABELS : {};
    const sortLabels = { relevance: '相关度', latest: '最新', popular: '热门' };

    const categories = ['all', ...new Set(results.map(a => a.category))];

    container.innerHTML = `
      <div class="search-result-count">找到 <strong>${sorted.length}</strong> 件相关作品</div>
      <div class="search-result-toolbar">
        <div class="search-filter-chips">
          ${categories.map(cat => `
            <button class="search-filter-chip ${this.currentCategory === cat ? 'active' : ''}" data-cat="${cat}">
              ${cat === 'all' ? '全部' : (catLabels[cat] || cat)}
            </button>
          `).join('')}
        </div>
        <select class="search-sort-select" id="search-sort-select">
          ${Object.entries(sortLabels).map(([val, label]) => `
            <option value="${val}" ${this.currentSort === val ? 'selected' : ''}>${label}</option>
          `).join('')}
        </select>
      </div>
      <div class="search-grid" id="search-grid"></div>
    `;

    const grid = container.querySelector('#search-grid');
    sorted.slice(0, 60).forEach(art => {
      const card = document.createElement('div');
      card.className = 'search-card';
      const isVideo = art.type === 'video';
      const catLabel = (window.Gallery && Gallery.CATEGORY_LABELS[art.category]) || art.category;
      card.innerHTML = `
        <div class="search-card-media">
          ${isVideo
            ? `<video muted src="${this._esc(art.imageUrl)}"></video>`
            : `<img loading="lazy" src="${this._esc(art.imageUrl)}" alt="${this._esc(art.title)}" />`}
          <span class="search-cat">${catLabel}</span>
        </div>
        <div class="search-card-info">
          <h4>${this._highlight(art.title, keyword)}</h4>
          <div class="search-card-author">
            <i class="fa-regular fa-user"></i> ${this._highlight(art.author, keyword)}
            <span class="search-no">#${art.id}</span>
          </div>
        </div>
      `;
      card.addEventListener('click', () => {
        this._close();
        if (window.Gallery) Gallery.openLightbox(art.id);
      });
      grid.appendChild(card);
    });

    container.querySelectorAll('.search-filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        this.currentCategory = chip.dataset.cat;
        this._syncCategorySelect();
        this.renderSearchResults(results, keyword);
      });
    });

    const sortSelect = document.getElementById('search-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        this.currentSort = sortSelect.value;
        this.renderSearchResults(results, keyword);
      });
    }
  },

  // ------------------------------------------------------------
  // M7 智能搜索增强：语义搜索 / 标签云 / 筛选面板
  // ------------------------------------------------------------

  /**
   * 语义搜索：关键词 + 标签 + 描述 + 作者 + 分类匹配，加权排序
   * @param {string} query - 查询词
   * @param {Array} artworks - 作品列表
   * @returns {Array} 过滤并按相关度排序后的作品
   */
  semanticSearch(query, artworks) {
    const q = (query || '').toLowerCase().trim();
    if (!q) return artworks;
    return artworks.filter(art => {
      const title = (art.title || '').toLowerCase();
      const desc = (art.description || '').toLowerCase();
      const tags = (art.tags || []).map(t => t.toLowerCase());
      const author = (art.author || '').toLowerCase();
      const category = (art.category || '').toLowerCase();
      return title.includes(q) || desc.includes(q) || tags.some(t => t.includes(q)) || author.includes(q) || category.includes(q);
    }).sort((a, b) => this._matchScore(q, b) - this._matchScore(q, a));
  },

  /**
   * 匹配评分：标题 > 标签 > 描述 > 作者
   * @param {string} q - 已小写的查询词
   * @param {object} art - 作品对象
   * @returns {number} 匹配分数
   */
  _matchScore(q, art) {
    let score = 0;
    if ((art.title || '').toLowerCase().includes(q)) score += 10;
    if ((art.tags || []).some(t => t.toLowerCase() === q)) score += 8;
    if ((art.tags || []).some(t => t.toLowerCase().includes(q))) score += 5;
    if ((art.description || '').toLowerCase().includes(q)) score += 3;
    if ((art.author || '').toLowerCase().includes(q)) score += 2;
    return score;
  },

  /**
   * 构建标签云数据：统计频率，取前 30，按热度映射字体大小
   * @param {Array} artworks - 作品列表
   * @returns {Array<{tag:string,count:number,size:number}>}
   */
  buildTagCloud(artworks) {
    const tagCount = {};
    artworks.forEach(art => {
      (art.tags || []).forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    });
    const sorted = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 30);
    return sorted.map(([tag, count]) => ({
      tag,
      count,
      size: Math.max(0.9, Math.min(1.12, 0.9 + (count / 20)))  // 收敛到 0.90~1.12em，避免 2em 大标题级突兀
    }));
  },

  /**
   * 渲染标签云到容器，绑定点击回调
   * @param {HTMLElement} container - 标签云容器
   * @param {Array} artworks - 作品列表
   * @param {function(string):void} onTagClick - 标签点击回调
   */
  renderTagCloud(container, artworks, onTagClick) {
    if (!container) return;
    const tags = this.buildTagCloud(artworks);
    container.innerHTML = tags.map(({ tag, size }) =>
      `<button class="tag-cloud-item" data-tag="${this._esc(tag)}" style="font-size:${size}em">${this._esc(tag)}</button>`
    ).join('');
    container.querySelectorAll('.tag-cloud-item').forEach(btn => {
      btn.addEventListener('click', () => {
        if (onTagClick) onTagClick(btn.dataset.tag);
      });
    });
  },

  /**
   * 渲染增强面板：标签云 + 分类下拉选项
   */
  _renderEnhancedPanel() {
    if (!this.allArtworks.length) return;
    const tagCloudEl = document.getElementById('search-tag-cloud');
    if (tagCloudEl && !this._tagCloudRendered) {
      this.renderTagCloud(tagCloudEl, this.allArtworks, (tag) => {
        const input = document.getElementById('search-input');
        if (input) input.value = tag;
        this._doSearch(tag);
      });
      this._tagCloudRendered = true;
    }
    // 填充分类下拉（自定义 dropdown — 避免原生 select option 白屏）
    const catSelect = document.getElementById('filter-category');
    const optsWrap = document.getElementById('filter-category-options');
    if (catSelect && optsWrap && optsWrap.children.length === 0) {
      const catLabels = window.Gallery ? Gallery.CATEGORY_LABELS : {};
      const cats = [...new Set(this.allArtworks.map(a => a.category))].filter(Boolean);
      // 先给原生 select 补 <option>（值同步用）
      cats.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = catLabels[cat] || cat;
        catSelect.appendChild(opt);
      });
      // 自定义 option div
      const allOption = document.createElement('div');
      allOption.className = 'custom-select-option is-selected';
      allOption.dataset.value = 'all';
      allOption.textContent = '全部';
      optsWrap.appendChild(allOption);
      cats.forEach(cat => {
        const opt = document.createElement('div');
        opt.className = 'custom-select-option';
        opt.dataset.value = cat;
        opt.textContent = catLabels[cat] || cat;
        optsWrap.appendChild(opt);
      });
    }
    this._syncCategorySelect();
  },

  /**
   * 绑定增强面板事件：分类下拉（自定义 dropdown）+ 评分输入
   */
  _setupEnhancedPanelHandlers() {
    // 自定义 dropdown：分类
    const wrap = document.getElementById('filter-category-wrap');
    const trigger = document.getElementById('filter-category-trigger');
    const optsWrap = document.getElementById('filter-category-options');
    const hiddenSelect = document.getElementById('filter-category');

    if (wrap && trigger && optsWrap && hiddenSelect && !wrap._bound) {
      wrap._bound = true;
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        // 关其他自定义下拉
        document.querySelectorAll('.custom-select.is-open').forEach(w => { if (w !== wrap) w.classList.remove('is-open'); });
        wrap.classList.toggle('is-open');
      });
      optsWrap.addEventListener('click', (e) => {
        const opt = e.target.closest('.custom-select-option');
        if (!opt) return;
        const val = opt.dataset.value;
        // 更新选中态
        optsWrap.querySelectorAll('.custom-select-option').forEach(o => o.classList.remove('is-selected'));
        opt.classList.add('is-selected');
        // 更新 trigger label（从原生 select option 取文本）
        const nativeOpt = hiddenSelect.querySelector(`option[value="${val}"]`);
        const catLabels = window.Gallery ? Gallery.CATEGORY_LABELS : {};
        const label = val === 'all' ? '全部' : (catLabels[val] || (nativeOpt?.textContent || val));
        trigger.querySelector('.custom-select-label').textContent = label;
        // 同步隐藏 select + 触发 change
        hiddenSelect.value = val;
        hiddenSelect.dispatchEvent(new Event('change'));
        wrap.classList.remove('is-open');
      });
      // 点外部关闭
      document.addEventListener('click', () => {
        wrap.classList.remove('is-open');
      });
      hiddenSelect.addEventListener('change', () => {
        this.currentCategory = hiddenSelect.value;
        if (this.currentResults.length) {
          this.renderSearchResults(this.currentResults, this.currentKeyword);
        }
      });
    }

    const scoreInput = document.getElementById('filter-min-score');
    if (scoreInput) {
      let scoreTimer = null;
      scoreInput.addEventListener('input', () => {
        clearTimeout(scoreTimer);
        const val = parseFloat(scoreInput.value);
        scoreTimer = setTimeout(() => {
          this.currentMinScore = (isNaN(val) || val < 0) ? 0 : Math.min(10, val);
          if (this.currentResults.length) {
            this.renderSearchResults(this.currentResults, this.currentKeyword);
          }
        }, 400);
      });
    }
  },

  /**
   * 同步分类下拉选中态（原生 select + 自定义 dropdown trigger + option 选中态）
   */
  _syncCategorySelect() {
    const val = this.currentCategory;
    const catSelect = document.getElementById('filter-category');
    if (catSelect) catSelect.value = val;
    // 同步自定义 dropdown
    const trigger = document.getElementById('filter-category-trigger');
    const optsWrap = document.getElementById('filter-category-options');
    if (trigger && optsWrap) {
      // label
      const catLabels = window.Gallery ? Gallery.CATEGORY_LABELS : {};
      const nativeOpt = catSelect?.querySelector(`option[value="${val}"]`);
      const label = val === 'all' ? '全部' : (catLabels[val] || (nativeOpt?.textContent || val));
      trigger.querySelector('.custom-select-label').textContent = label;
      // option 选中态
      optsWrap.querySelectorAll('.custom-select-option').forEach(o => {
        o.classList.toggle('is-selected', o.dataset.value === val);
      });
    }
  },

  /**
   * AI 评分最低分筛选：保留 totalScore >= minScore 的作品
   * 使用缓存避免重复查询
   * @param {Array} results - 作品列表
   * @param {number} minScore - 最低总分
   * @returns {Promise<Array>}
   */
  async _applyScoreFilter(results, minScore) {
    const kept = [];
    for (const art of results) {
      const total = await this._getArtworkTotalScore(art.id);
      if (total !== null && total >= minScore) kept.push(art);
    }
    return kept;
  },

  /**
   * 获取作品最新评分总分（带缓存）
   * @param {number} artworkId
   * @returns {Promise<number|null>}
   */
  async _getArtworkTotalScore(artworkId) {
    const id = Number(artworkId);
    if (this._scoresCache.has(id)) return this._scoresCache.get(id);
    let total = null;
    try {
      const records = await getAestheticScoresByArtwork(id);
      if (records && records.length > 0) {
        total = records[0].totalScore || 0;
      }
    } catch { total = null; }
    this._scoresCache.set(id, total);
    return total;
  },

  /**
   * 重置增强面板状态：清空缓存与输入
   */
  _resetEnhancedPanel() {
    this.currentMinScore = 0;
    this._scoresCache = new Map();
    this._tagCloudRendered = false;
    const scoreInput = document.getElementById('filter-min-score');
    if (scoreInput) scoreInput.value = '0';
    const catSelect = document.getElementById('filter-category');
    if (catSelect) catSelect.value = 'all';
    const tagCloudEl = document.getElementById('search-tag-cloud');
    if (tagCloudEl) tagCloudEl.innerHTML = '';
  },

  _renderEmptyState() {
    const container = document.getElementById('search-results');
    if (container) {
      container.innerHTML = '<div class="search-empty-hint">输入关键词，开始探索梦境艺术</div>';
    }
  },

  _close() {
    const overlay = document.getElementById('search-modal');
    if (overlay) overlay.classList.remove('open');
    this.isOpen = false;
    this._removeFocusTrap();
    if (window.ModalScrollLock) ModalScrollLock.unlock();
    if (typeof Sound !== 'undefined') Sound.playSound('close');
    if (this._triggerElement && document.body.contains(this._triggerElement)) {
      this._triggerElement.focus();
    }

    // 清空搜索输入和结果，重置状态
    const input = document.getElementById('search-input');
    if (input) input.value = '';
    this.currentKeyword = '';
    this.currentResults = [];
    this.currentSort = 'relevance';
    this.currentCategory = 'all';
    // M7: 清理增强面板资源
    this._resetEnhancedPanel();
    this._showSuggest();
    this._renderHistoryList();
  },

  _highlight(text, keyword) {
    const safe = this._esc(text || '');
    const kw = this._esc(keyword || '').trim();
    if (!kw) return safe;
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(escaped, 'gi'), m => `<mark class="hl">${m}</mark>`);
  },

  _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
};

window.Search = Search;
window.showSearchBar = () => Search.showSearchBar();

// M7: 挂载语义搜索增强到全局
window.SearchEnhanced = {
  semanticSearch: (q, arts) => Search.semanticSearch(q, arts),
  buildTagCloud: (arts) => Search.buildTagCloud(arts),
  renderTagCloud: (c, arts, cb) => Search.renderTagCloud(c, arts, cb)
};

// 解构语义搜索函数以便 export
const { semanticSearch, buildTagCloud, renderTagCloud } = Search;
const showSearchBar = window.showSearchBar;

// ES Module export
export default Search;
export { Search };
export { showSearchBar };
export { semanticSearch, buildTagCloud, renderTagCloud };
