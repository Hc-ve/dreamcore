// ============================================================
// js/search.js — 搜索系统增强版
// 功能: 模糊匹配 / 历史记录 / 热门搜索 / 排序筛选 / 空状态
// ============================================================

const Search = {
  debounceTimer: null,
  isOpen: false,
  allArtworks: [],
  currentResults: [],
  currentKeyword: '',
  currentSort: 'relevance',
  currentCategory: 'all',
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
          this.allArtworks = await getAllArtworks();
        }
      });
    }
  },

  async showSearchBar() {
    if (typeof Sound !== 'undefined') Sound.playSound('pop');
    if (this.allArtworks.length === 0) {
      this.allArtworks = await getAllArtworks();
    }
    const overlay = document.getElementById('search-modal');
    if (overlay) {
      if (!this.isOpen) {
        overlay.classList.add('open');
        this.isOpen = true;
        if (window.ModalScrollLock) ModalScrollLock.lock();
        // 重新打开时刷新历史记录列表和焦点陷阱
        this._renderHistoryList();
        this._setupFocusTrap(overlay);
      }
      setTimeout(() => {
        const input = overlay.querySelector('#search-input');
        if (input) input.focus();
      }, 200);
      return;
    }
    this._buildModal();
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

    return this.allArtworks.filter(a => {
      if (isIdSearch && a.id === idVal) return true;
      if (a.title && a.title.toLowerCase().includes(kw)) return true;
      if (a.author && a.author.toLowerCase().includes(kw)) return true;
      if (a.tags && a.tags.some(t => t.toLowerCase().includes(kw))) return true;
      if (a.description && a.description.toLowerCase().includes(kw)) return true;
      return false;
    });
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

  renderSearchResults(results, keyword) {
    const container = document.getElementById('search-results');
    if (!container) return;

    const filtered = this.currentCategory === 'all'
      ? results
      : results.filter(a => a.category === this.currentCategory);

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

// ES Module export
export default Search;
export { Search };
const showSearchBar = window.showSearchBar;
export { showSearchBar };
