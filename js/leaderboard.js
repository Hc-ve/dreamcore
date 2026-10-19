// ============================================================
// js/leaderboard.js — M8 排行榜体系
// 综合评分 = 作品数×10 + 总点赞×2 + 总浏览×0.05 + 质量等级加权和×5
// 榜单分类: 日榜(近1天) / 周榜(近7天) / 月榜(近30天) / 总榜
// 趋势: 与上次打开快照对比(localStorage)，展示 ↑ ↓ → 新
// 入口: #/leaderboard 路由 / 首页 Hero 按钮 / 移动端菜单 / 个人中心
// ============================================================

import { getPublicArtworks, getAestheticScoresByArtwork } from './db.js';

// 等级元数据（与全站评级规范一致：SSS/SS/S 金 / A 粉紫 / B 天蓝 / C 灰白）
const GRADE_META = {
  sss: { label: 'SSS', w: 6, color: '#ffd700' },
  ss: { label: 'SS', w: 5, color: '#ffd700' },
  s: { label: 'S', w: 4, color: '#ffd700' },
  a: { label: 'A', w: 3, color: '#c084fc' },
  b: { label: 'B', w: 2, color: '#38bdf8' },
  c: { label: 'C', w: 1, color: '#cbd5e1' }
};
const GRADE_ORDER = ['sss', 'ss', 's', 'a', 'b', 'c'];

const PERIODS = [
  { key: 'day', label: '日榜', days: 1 },
  { key: 'week', label: '周榜', days: 7 },
  { key: 'month', label: '月榜', days: 30 },
  { key: 'all', label: '总榜', days: 0 }
];

const Leaderboard = {
  overlayEl: null,
  contentEl: null,
  currentPeriod: 'all',
  _itemsCache: null,
  _escHandler: null,

  // ----------------------------------------------------------
  // 打开排行榜（period: day/week/month/all）
  // ----------------------------------------------------------
  async open(period) {
    const p = PERIODS.some(x => x.key === period) ? period : 'all';
    this.currentPeriod = p;
    this._build();
    requestAnimationFrame(() => this.overlayEl && this.overlayEl.classList.add('open'));
    await this._render();
  },

  close() {
    if (!this.overlayEl) return;
    const el = this.overlayEl;
    el.classList.remove('open');
    if (this._escHandler) {
      window.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
    document.body.classList.remove('lb-body-lock');
    if (window.ModalScrollLock) { try { ModalScrollLock.unlock(); } catch (_) {} }
    setTimeout(() => el.remove(), 250);
    this.overlayEl = null;
    this.contentEl = null;
    // 若当前 hash 是排行榜，回到画廊，避免关闭后残留路由
    if (/^#\/leaderboard(?:\?.*)?$/.test(window.location.hash || '')) {
      window.location.hash = '#gallery';
    }
  },

  // 路由入口：#/leaderboard?period=week
  async openFromHash() {
    const qs = (window.location.hash || '').split('?')[1] || '';
    let period = 'all';
    qs.split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      if (k === 'period' && v) period = decodeURIComponent(v);
    });
    await this.open(period);
  },

  // ----------------------------------------------------------
  // DOM 构建（全屏 overlay）
  // ----------------------------------------------------------
  _build() {
    if (this.overlayEl) this.overlayEl.remove();
    const overlay = document.createElement('div');
    overlay.className = 'lb-overlay';
    overlay.id = 'leaderboard-overlay';
    overlay.innerHTML = `
      <div class="lb-panel glass" role="dialog" aria-modal="true" aria-label="创作者排行榜">
        <button class="modal-close" data-lb-close aria-label="关闭排行榜"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        <div class="lb-head">
          <h2 class="lb-title"><i class="fa-solid fa-trophy" aria-hidden="true"></i> 创作者排行榜</h2>
          <p class="lb-sub">综合 作品数量 · 作品质量 · 互动数据 多维评分，实时更新</p>
        </div>
        <div class="lb-tabs" id="lb-tabs" role="tablist">
          ${PERIODS.map(p => `<button class="lb-tab${p.key === this.currentPeriod ? ' active' : ''}" data-period="${p.key}" role="tab">${p.label}</button>`).join('')}
        </div>
        <div class="lb-body" id="lb-body">
          <div class="lb-loading"><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> 正在统计排行榜数据…</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.overlayEl = overlay;
    this.contentEl = overlay.querySelector('#lb-body');

    if (window.ModalScrollLock) { try { ModalScrollLock.lock(); } catch (_) { document.body.classList.add('lb-body-lock'); } }
    else document.body.classList.add('lb-body-lock');

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('[data-lb-close]')) {
        if (window.Sound) Sound.playSound('click');
        this.close();
      }
      const row = e.target.closest('.lb-row') || e.target.closest('.lb-podium-item');
      if (row) this._onRowClick(row.dataset.key);
    });

    overlay.querySelectorAll('.lb-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        if (window.Sound) Sound.playSound('click');
        overlay.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentPeriod = tab.dataset.period;
        this._render();
      });
    });

    this._escHandler = (e) => { if (e.key === 'Escape') this.close(); };
    window.addEventListener('keydown', this._escHandler);
  },

  // ----------------------------------------------------------
  // 数据采集：作品 + 最新评级（无评级时按互动量估算）
  // ----------------------------------------------------------
  async _collect() {
    if (this._itemsCache) return this._itemsCache;
    // 榜单为对外展示：仅统计公开可见作品（下架/逻辑删除/待审核不参与排名）
    const artworks = (await getPublicArtworks()) || [];
    const lists = await Promise.all(artworks.map(a =>
      getAestheticScoresByArtwork(a.id).catch(() => [])
    ));
    const items = artworks.map((a, i) => {
      const s = lists[i] && lists[i][0];
      let grade = s ? this._normGrade(s.grade, s.totalScore) : null;
      let score = s ? (Number(s.totalScore) || 0) : 0;
      if (!grade) {
        const q = (Number(a.likes) || 0) * 0.4 + (Number(a.views) || 0) * 0.001;
        grade = q > 18 ? 'ss' : q > 10 ? 's' : q > 5 ? 'a' : q > 2 ? 'b' : 'c';
        score = { ss: 9.0, s: 8.6, a: 8.0, b: 7.0, c: 6.0 }[grade];
      }
      return { ...a, _grade: grade, _score: score };
    });
    this._itemsCache = items;
    return items;
  },

  _normGrade(g, score) {
    const s = String(g || '').toLowerCase();
    if (GRADE_META[s]) return s;
    if (s.indexOf('sss') > -1) return 'sss';
    if (s.indexOf('ss') > -1) return 'ss';
    if (s === 's' || s.indexOf('优秀') > -1) return 's';
    if (s === 'a' || s.indexOf('良好') > -1) return 'a';
    if (s === 'b' || s.indexOf('合格') > -1) return 'b';
    const t = Number(score) || 0;
    if (t >= 9.5) return 'sss';
    if (t >= 9.0) return 'ss';
    if (t >= 8.5) return 's';
    if (t >= 7.5) return 'a';
    if (t >= 6.5) return 'b';
    return 'c';
  },

  // ----------------------------------------------------------
  // 按周期过滤（周期内无作品时回退总榜数据，保证演示效果）
  // ----------------------------------------------------------
  _filterByPeriod(items, periodKey) {
    const p = PERIODS.find(x => x.key === periodKey);
    if (!p || !p.days) return { items, fallback: false };
    const since = Date.now() - p.days * 86400000;
    const filtered = items.filter(a => {
      const t = new Date(a.createdAt).getTime();
      return Number.isFinite(t) && t >= since;
    });
    if (!filtered.length) return { items, fallback: true };
    return { items: filtered, fallback: false };
  },

  // ----------------------------------------------------------
  // 聚合计算：按作者分组 → 综合分 → 排名
  // ----------------------------------------------------------
  _compute(items) {
    const groups = new Map();
    for (const a of items) {
      const key = a.userId ? 'u' + a.userId : 'n:' + (a.author || '匿名');
      let g = groups.get(key);
      if (!g) {
        g = {
          key,
          name: a.author || '匿名艺术家',
          userId: a.userId || null,
          works: 0, likes: 0, views: 0,
          gradeW: 0, scoreSum: 0,
          gradeCounts: {}, best: null
        };
        groups.set(key, g);
      }
      g.works += 1;
      g.likes += Number(a.likes) || 0;
      g.views += Number(a.views) || 0;
      g.gradeW += GRADE_META[a._grade].w;
      g.scoreSum += a._score;
      g.gradeCounts[a._grade] = (g.gradeCounts[a._grade] || 0) + 1;
      if (!g.best || a._score > g.best._score) g.best = a;
    }
    const rows = Array.from(groups.values()).map(g => {
      const topGrade = GRADE_ORDER.find(k => g.gradeCounts[k]) || 'c';
      return {
        ...g,
        avgScore: g.works ? Math.round((g.scoreSum / g.works) * 10) / 10 : 0,
        topGrade,
        composite: Math.round((g.works * 10 + g.likes * 2 + g.views * 0.05 + g.gradeW * 5) * 10) / 10
      };
    });
    rows.sort((x, y) => y.composite - x.composite);
    rows.forEach((r, i) => { r.rank = i + 1; });
    return rows;
  },

  // ----------------------------------------------------------
  // 趋势：与上一次快照对比
  // ----------------------------------------------------------
  _applyTrend(periodKey, rows) {
    const storeKey = 'lb_snap_v1_' + periodKey;
    let prev = null;
    try { prev = JSON.parse(localStorage.getItem(storeKey) || 'null'); } catch (_) { prev = null; }
    rows.forEach(r => {
      if (!prev || !(r.key in prev)) r.trend = 'new';
      else {
        const d = prev[r.key] - r.rank; // 正数 = 上升
        r.trend = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
        r.trendDelta = Math.abs(d);
      }
    });
    try {
      const snap = {};
      rows.forEach(r => { snap[r.key] = r.rank; });
      localStorage.setItem(storeKey, JSON.stringify(snap));
    } catch (_) { /* 存储失败不影响展示 */ }
  },

  // ----------------------------------------------------------
  // 渲染
  // ----------------------------------------------------------
  async _render() {
    if (!this.contentEl) return;
    this.contentEl.innerHTML = '<div class="lb-loading"><i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> 正在统计排行榜数据…</div>';
    const all = await this._collect();
    const { items, fallback } = this._filterByPeriod(all, this.currentPeriod);
    const rows = this._compute(items);
    this._applyTrend(this.currentPeriod, rows);

    if (!rows.length) {
      this.contentEl.innerHTML = `
        <div class="lb-empty">
          <i class="fa-solid fa-trophy" aria-hidden="true"></i>
          <p>暂无上榜数据，发布第一件作品即可登顶！</p>
        </div>`;
      return;
    }

    const me = this._findMyRow(rows);

    // 头像：一次性读 users 表，按 userId 关联到每行（云端 UUID 亦支持）；
    // 无 userId 的虚拟艺术家回退首字母。避免逐行 getUserById 造成 N 次查询。
    if (window.Settings && typeof window.Settings.buildUserMap === 'function') {
      const userMap = await window.Settings.buildUserMap();
      rows.forEach(r => { r.user = (r.userId != null) ? (userMap.get(String(r.userId)) || null) : null; });
    }

    const podium = rows.slice(0, 3);
    const rest = rows.slice(3, 50);

    this.contentEl.innerHTML = `
      ${fallback ? '<div class="lb-fallback"><i class="fa-regular fa-circle-info" aria-hidden="true"></i> 当前周期暂无新作品，已展示总榜数据</div>' : ''}
      ${me ? `
      <div class="lb-me">
        <span class="lb-me-label"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> 我的排名</span>
        <span class="lb-me-rank">第 <b>${me.rank}</b> 名</span>
        <span class="lb-me-score">综合分 ${me.composite}</span>
        <span class="lb-me-works">${me.works} 件作品 · ${me.likes} 获赞</span>
      </div>` : (window.currentUser ? `
      <div class="lb-me">
        <span class="lb-me-label"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> 我的排名</span>
        <span class="lb-me-rank">暂未上榜</span>
        <span class="lb-me-works">发布作品即可冲榜</span>
      </div>` : '')}
      <div class="lb-podium">
        ${podium.length > 1 ? this._podiumItem(podium[1], 2) : ''}
        ${podium.length > 0 ? this._podiumItem(podium[0], 1) : ''}
        ${podium.length > 2 ? this._podiumItem(podium[2], 3) : ''}
      </div>
      <div class="lb-list">
        ${rest.map(r => this._listRow(r)).join('')}
      </div>
      ${rows.length > 50 ? `<div class="lb-more">仅展示前 50 名，共 ${rows.length} 位创作者上榜</div>` : ''}
    `;
  },

  _podiumItem(r, place) {
    const initial = (r.name || '?').charAt(0).toUpperCase();
    // 头像统一走 Settings.renderAvatarHtml（有 users 记录则显示其自定义头像）
    const avatarHtml = (window.Settings && typeof window.Settings.renderAvatarHtml === 'function')
      ? window.Settings.renderAvatarHtml(r.user || { username: r.name }, { sizeClass: '' })
      : `<span class="avatar-circle">${this._esc(initial)}</span>`;
    // 印章：一/二/三（替代 emoji 奖牌，accessibility 读屏为汉字）
    const medal = { 1: '一', 2: '二', 3: '三' }[place];
    const medalAria = { 1: '冠军', 2: '亚军', 3: '季军' }[place];
    return `
      <div class="lb-podium-item p${place}" data-key="${this._esc(r.key)}" role="button" tabindex="0" aria-label="查看 ${this._esc(r.name)} 主页">
        <div class="lb-podium-medal" role="img" aria-label="${medalAria}">${medal}</div>
        <div class="lb-podium-avatar">${avatarHtml}</div>
        <div class="lb-podium-name">${this._esc(r.name)}${this._isMe(r) ? ' <em class="lb-me-tag">我</em>' : ''}</div>
        <div class="lb-podium-grade" style="--grade-color:${GRADE_META[r.topGrade].color}">${GRADE_META[r.topGrade].label}</div>
        <div class="lb-podium-stats">${r.works} 作品 · ${this._fmt(r.likes)} 获赞</div>
        <div class="lb-podium-score">${r.composite}<small>分</small></div>
      </div>
    `;
  },

  _listRow(r) {
    const initial = (r.name || '?').charAt(0).toUpperCase();
    // 头像统一走 Settings.renderAvatarHtml（有 users 记录则显示其自定义头像）
    const avatarHtml = (window.Settings && typeof window.Settings.renderAvatarHtml === 'function')
      ? window.Settings.renderAvatarHtml(r.user || { username: r.name }, { sizeClass: '' })
      : `<span class="avatar-circle">${this._esc(initial)}</span>`;
    const trend = r.trend === 'up'
      ? `<span class="lb-trend up"><i class="fa-solid fa-caret-up" aria-hidden="true"></i>${r.trendDelta || ''}</span>`
      : r.trend === 'down'
        ? `<span class="lb-trend down"><i class="fa-solid fa-caret-down" aria-hidden="true"></i>${r.trendDelta || ''}</span>`
        : r.trend === 'flat'
          ? `<span class="lb-trend flat"><i class="fa-solid fa-minus" aria-hidden="true"></i></span>`
          : `<span class="lb-trend new">新</span>`;
    return `
      <div class="lb-row${this._isMe(r) ? ' me' : ''}" data-key="${this._esc(r.key)}" role="button" tabindex="0" aria-label="查看 ${this._esc(r.name)} 主页">
        <span class="lb-rank">${r.rank}</span>
        <span class="lb-avatar">${avatarHtml}</span>
        <span class="lb-name">${this._esc(r.name)}${this._isMe(r) ? ' <em class="lb-me-tag">我</em>' : ''}</span>
        <span class="lb-cell lb-c-works" title="作品数"><i class="fa-regular fa-images" aria-hidden="true"></i> ${r.works}</span>
        <span class="lb-cell lb-c-likes" title="获赞数"><i class="fa-solid fa-heart" aria-hidden="true"></i> ${this._fmt(r.likes)}</span>
        <span class="lb-cell lb-c-avg" title="平均分"><i class="fa-solid fa-star" aria-hidden="true"></i> ${r.avgScore}</span>
        <span class="lb-grade" style="--grade-color:${GRADE_META[r.topGrade].color}">${GRADE_META[r.topGrade].label}</span>
        ${trend}
        <span class="lb-score">${r.composite}<small>分</small></span>
      </div>
    `;
  },

  _onRowClick(key) {
    const all = this._itemsCache || [];
    // 从缓存反查作者身份。userId 可能是云端 UUID 字符串，必须全程按字符串处理
    //（旧实现用 Number(key.slice(1)) 会把 UUID 变成 NaN，导致云端用户主页打不开）
    let userId = null, name = null;
    const matched = all.find(x =>
      (key && key.charAt(0) === 'u' && ('u' + (x.userId || '')) === key) ||
      (key && key.indexOf('n:') === 0 && ('n:' + (x.author || '匿名')) === key)
    );
    if (matched) {
      userId = matched.userId != null ? matched.userId : null;
      name = matched.author || null;
    } else if (key && key.indexOf('n:') === 0) {
      name = decodeURIComponent(key.slice(2));
    } else if (key && key.charAt(0) === 'u') {
      userId = key.slice(1); // 兜底：键去掉 'u' 前缀即为 userId（含 UUID）
    }
    this.close();
    setTimeout(() => {
      // 有 userId → 进入其个人资料页；仅虚拟艺术家 → 打开艺术家主页
      if (userId != null && userId !== '') {
        window.location.hash = '#/profile-' + encodeURIComponent(userId);
      } else if (window.openArtistPage) {
        window.openArtistPage(name || '未知');
      }
    }, 260);
  },

  _findMyRow(rows) {
    const u = window.currentUser;
    if (!u) return null;
    return rows.find(r => this._rowIsUser(r, u)) || null;
  },

  _isMe(r) {
    const u = window.currentUser;
    if (!u) return false;
    return this._rowIsUser(r, u);
  },

  // userId 与 currentUser.id 统一按字符串比较（兼容本地数字 id 与云端 UUID）
  _rowIsUser(r, u) {
    if (r.userId != null && r.userId !== '') return String(r.userId) === String(u.id);
    return r.name === u.username;
  },

  _fmt(n) {
    const v = Number(n) || 0;
    return v >= 10000 ? (v / 10000).toFixed(1) + 'w' : String(v);
  },

  _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  // 刷新缓存（发布新作品后可调用）
  invalidate() { this._itemsCache = null; }
};

// 全局导出
window.Leaderboard = Leaderboard;

// ES Module 导出（main.js 路由监听使用）
export function openLeaderboard(period) { return Leaderboard.open(period); }
export function closeLeaderboard() { return Leaderboard.close(); }
export function openFromHash() { return Leaderboard.openFromHash(); }
export default Leaderboard;
