// ============================================================
// js/artist.js — 艺术家个人主页
// 功能: 艺术家信息展示、作品列表、关注/取消关注
// ============================================================

const Artist = {
  modalEl: null,
  currentArtist: null,
  currentArtworks: [],

  // ----------------------------------------------------------
  // 通过作者名打开艺术家主页（种子数据用）
  // 惰性为种子艺术家建立本地用户记录，使关注/粉丝数据真实落库
  // ----------------------------------------------------------
  async openByAuthorName(authorName) {
    const artworks = await getArtworksByAuthorName(authorName);
    const totalLikes = artworks.reduce((sum, a) => sum + (a.likes || 0), 0);

    // 惰性建立虚拟艺术家用户记录（幂等），关注/粉丝数据从此真实可查
    let artistUser = null;
    const ensureFn = (typeof ensureVirtualArtist === 'function')
      ? ensureVirtualArtist
      : (typeof window.ensureVirtualArtist === 'function' ? window.ensureVirtualArtist : null);
    if (ensureFn) {
      try { artistUser = await ensureFn(authorName); } catch (e) { /* 失败按无记录处理 */ }
    }

    // 真实粉丝/关注计数（来自 follows 表实际记录）
    let followersCount = 0, followingCount = 0;
    if (artistUser && artistUser.id != null) {
      try {
        [followersCount, followingCount] = await Promise.all([
          getFollowersCount(artistUser.id),
          getFollowingCount(artistUser.id)
        ]);
      } catch (e) { /* 忽略计数失败 */ }
    }

    this.currentArtist = {
      id: artistUser ? artistUser.id : null,
      name: authorName,
      username: authorName,
      nickname: (artistUser && artistUser.nickname) || '',
      avatar: (artistUser && artistUser.avatar) || null,
      bio: `梦境艺术家，专注于创造独特的视觉体验。`,
      worksCount: artworks.length,
      totalLikes: totalLikes,
      followersCount: followersCount,
      followingCount: followingCount,
      isVirtual: true,
      user: artistUser || null
    };
    this.currentArtworks = artworks;
    this._build();
    this._show();
  },

  // ----------------------------------------------------------
  // 通过用户 ID 打开艺术家主页（注册用户用）
  // ----------------------------------------------------------
  async openByUserId(userId) {
    const user = await getUserById(userId);
    if (!user) {
      // 不再静默 return 造成"点了没反应"的死胡同（Bug #3 的诱因之一）
      if (window.showToast) showToast('未找到该用户资料', 'warn');
      return;
    }

    const artworks = await getUserArtworks(userId);
    const totalLikes = await getUserTotalLikes(userId);

    // 实时从 follows 表统计粉丝/关注数（不依赖可能过期的用户字段）
    let followersCount = 0, followingCount = 0;
    try {
      [followersCount, followingCount] = await Promise.all([
        getFollowersCount(user.id),
        getFollowingCount(user.id)
      ]);
    } catch (e) { /* 忽略计数失败 */ }

    this.currentArtist = {
      id: user.id,
      name: user.nickname || user.username,
      username: user.username,
      nickname: user.nickname || '',
      avatar: user.avatar || null,
      email: user.email,
      bio: user.bio || '这个人很懒，什么都没留下…',
      worksCount: artworks.length,
      totalLikes: totalLikes,
      followersCount: followersCount,
      followingCount: followingCount,
      isVirtual: false,
      user: user
    };
    this.currentArtworks = artworks;
    this._build();
    this._show();
  },

  // ----------------------------------------------------------
  // 构建弹窗
  // ----------------------------------------------------------
  _build() {
    if (this.modalEl) this.modalEl.remove();

    const artist = this.currentArtist;
    const initial = (artist.name || '?').charAt(0).toUpperCase();
    const user = window.currentUser;
    const isSelf = user && !artist.isVirtual && user.id === artist.id;

    // 头像：读用户记录里的 avatar（自定义头像/系统头像），不再硬编码首字符色块（Bug #2）
    const avatarHtml = (window.Settings && typeof window.Settings.renderAvatarHtml === 'function')
      ? window.Settings.renderAvatarHtml(
          { avatar: artist.avatar || (artist.user && artist.user.avatar), username: artist.username || artist.name, nickname: artist.nickname },
          { sizeClass: 'xl artist-avatar' })
      : `<span class="avatar-circle xl artist-avatar">${initial}</span>`;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay artist-modal';
    overlay.id = 'artist-modal';
    overlay.innerHTML = `
      <div class="modal-box artist-box glass">
        <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>

        <div class="artist-head">
          <div class="artist-avatar-wrap">
            ${avatarHtml}
            <div class="artist-avatar-glow"></div>
          </div>
          <div class="artist-info">
            <h2 class="artist-name">${this._esc(artist.name)}
              ${artist.isVirtual ? '<span class="artist-badge">梦境艺术家</span>' : ''}
            </h2>
            <p class="artist-bio">${this._esc(artist.bio)}</p>
            <div class="artist-actions">
              ${isSelf
                ? '<button class="btn-ghost btn-sm" id="artist-edit-btn"><i class="fa-regular fa-pen-to-square"></i> 编辑资料</button>'
                : `<button class="btn-primary btn-sm" id="artist-follow-btn">
                     <i class="fa-solid fa-user-plus"></i>
                     <span id="artist-follow-text">关注</span>
                   </button>`
              }
            </div>
          </div>
        </div>

        <div class="artist-stats">
          <div class="stat-card"><div class="stat-num" id="artist-stat-works">${this._fmtNum(artist.worksCount)}</div><div class="stat-label">作品</div></div>
          <div class="stat-card"><div class="stat-num" id="artist-stat-likes">${this._fmtNum(artist.totalLikes)}</div><div class="stat-label">获赞</div></div>
          <div class="stat-card"><div class="stat-num" id="artist-stat-followers">${this._fmtNum(artist.followersCount)}</div><div class="stat-label">粉丝</div></div>
          <div class="stat-card"><div class="stat-num" id="artist-stat-following">${this._fmtNum(artist.followingCount)}</div><div class="stat-label">关注</div></div>
        </div>

        <div class="artist-tabs">
          <button class="artist-tab active" data-tab="works"><i class="fa-regular fa-images"></i> 作品</button>
          <button class="artist-tab" data-tab="crafts"><i class="fa-solid fa-gift"></i> 数字文创馆</button>
        </div>

        <div class="artist-content" id="artist-content">
          <div class="artist-grid" data-panel="works"></div>
          <div class="artist-crafts" data-panel="crafts" style="display:none"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.modalEl = overlay;

    // 关闭事件
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('[data-close]')) this._close();
    });

    // 非本人的头像 → 点击进入该用户的个人资料页（Bug #3：点击任意用户头像都可达资料页）
    if (!isSelf && artist.id != null) {
      const avWrap = overlay.querySelector('.artist-avatar-wrap');
      if (avWrap) {
        avWrap.style.cursor = 'pointer';
        avWrap.title = '查看个人资料页';
        avWrap.addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof Sound !== 'undefined') Sound.playSound('click');
          this._close();
          window.location.hash = `#/profile-${encodeURIComponent(artist.id)}`;
        });
      }
    }

    // 渲染作品
    this._renderWorks();

    // 绑定 Tab 切换
    this._bindTabs();

    // 绑定关注按钮
    if (!isSelf) {
      this._bindFollowButton();
    }
  },

  // ----------------------------------------------------------
  // 绑定 Tab 切换（作品 / 数字文创馆）
  // ----------------------------------------------------------
  _bindTabs() {
    const tabs = this.modalEl.querySelectorAll('.artist-tab');
    const panels = this.modalEl.querySelectorAll('[data-panel]');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        const target = tab.dataset.tab;
        tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === target));
        panels.forEach(p => {
          p.style.display = (p.dataset.panel === target) ? '' : 'none';
        });
        // 切换到文创馆时懒加载
        if (target === 'crafts') this._renderCrafts();
      });
    });
  },

  // ----------------------------------------------------------
  // 渲染数字文创馆（调用 getAiCraftsByUser）
  // ----------------------------------------------------------
  async _renderCrafts() {
    const container = this.modalEl.querySelector('[data-panel="crafts"]');
    if (!container) return;
    const artist = this.currentArtist;
    // 虚拟艺术家现在也有本地用户记录，统一按 userId 查询（无记录时如实显示空态）
    const userId = artist.id || (artist.user && artist.user.id);
    if (!userId) {
      container.innerHTML = '<p class="artist-empty">该艺术家暂无数字文创衍生品</p>';
      return;
    }
    container.innerHTML = '<p class="artist-empty"><i class="fa-solid fa-spinner fa-spin"></i> 加载中…</p>';
    try {
      const list = (typeof getAiCraftsByUser === 'function')
        ? await getAiCraftsByUser(userId)
        : (window.getAiCraftsByUser ? await window.getAiCraftsByUser(userId) : []);
      if (!list.length) {
        container.innerHTML = '<p class="artist-empty">暂无数字文创衍生品，可在作品灯箱中点击「AI文创」生成</p>';
        return;
      }
      container.innerHTML = '<div class="craft-gallery-grid"></div>';
      const grid = container.querySelector('.craft-gallery-grid');
      list.forEach(c => {
        const typeDef = (window.AICraft && window.AICraft.CRAFT_TYPES || []).find(t => t.key === c.craftType);
        const card = document.createElement('div');
        card.className = 'craft-gallery-card';
        card.innerHTML = `
          <div class="craft-gallery-thumb">
            ${c.imageData ? `<img src="${c.imageData}" alt="文创 ${c.id}" loading="lazy" />` : '<div class="craft-gallery-thumb-empty"><i class="fa-solid fa-gift"></i></div>'}
            <span class="craft-gallery-badge">✨ AI</span>
          </div>
          <div class="craft-gallery-info">
            <span class="craft-gallery-type">${typeDef ? typeDef.label : (c.craftType || '文创')}</span>
            <span class="craft-gallery-style">${c.styleTheme || ''}</span>
          </div>
        `;
        // 点击文创可重新打开工作台
        card.addEventListener('click', () => {
          if (typeof Sound !== 'undefined') Sound.playSound('click');
          this._close();
          window.location.hash = `#/craft?artworkId=${c.artworkId}`;
        });
        grid.appendChild(card);
      });
    } catch (err) {
      console.error('[Artist] 加载数字文创馆失败:', err);
      container.innerHTML = '<p class="artist-empty">加载失败，请重试</p>';
    }
  },

  // ----------------------------------------------------------
  // 绑定关注按钮
  // ----------------------------------------------------------
  async _bindFollowButton() {
    const btn = this.modalEl.querySelector('#artist-follow-btn');
    if (!btn) return;

    const user = window.currentUser;
    const artist = this.currentArtist;

    // 无本地用户记录的艺术家（记录创建失败）无法关注，如实提示
    if (artist.id == null) {
      btn.addEventListener('click', () => {
        if (!window.currentUser) {
          if (window.Auth) Auth.requireLogin();
          return;
        }
        if (window.showToast) showToast('该艺术家暂不支持关注', 'info');
      });
      return;
    }

    // 检查关注状态
    let following = false;
    if (user) {
      try {
        following = await isFollowing(user.id, artist.id);
      } catch (e) { /* 忽略 */ }
    }

    this._updateFollowButton(following);

    btn.addEventListener('click', async () => {
      if (!window.currentUser) {
        if (window.Auth) Auth.requireLogin();
        return;
      }
      try {
        const result = await toggleFollow(window.currentUser.id, artist.id);
        this._updateFollowButton(result);
        // 更新计数
        const newCount = await getFollowersCount(artist.id);
        const countEl = this.modalEl.querySelector('#artist-stat-followers');
        if (countEl) countEl.textContent = this._fmtNum(newCount);
        // 更新 currentUser
        if (window.Auth && window.currentUser) {
          const updatedFollowing = await getFollowingCount(window.currentUser.id);
          window.currentUser.followingCount = updatedFollowing;
        }
        if (typeof Sound !== 'undefined') Sound.playSound(result ? 'like' : 'click');
        if (window.showToast) {
          showToast(result ? '关注成功' : '已取消关注', result ? 'success' : 'info');
        }
      } catch (err) {
        console.error('关注操作失败:', err);
        if (window.showToast) showToast('操作失败，请重试', 'warn');
      }
    });
  },

  // ----------------------------------------------------------
  // 更新关注按钮状态
  // ----------------------------------------------------------
  _updateFollowButton(following) {
    const btn = this.modalEl.querySelector('#artist-follow-btn');
    const text = this.modalEl.querySelector('#artist-follow-text');
    const icon = btn.querySelector('i');
    if (following) {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-ghost');
      icon.className = 'fa-solid fa-check';
      if (text) text.textContent = '已关注';
    } else {
      btn.classList.add('btn-primary');
      btn.classList.remove('btn-ghost');
      icon.className = 'fa-solid fa-user-plus';
      if (text) text.textContent = '关注';
    }
  },

  // ----------------------------------------------------------
  // 渲染作品网格
  // ----------------------------------------------------------
  _renderWorks() {
    const content = this.modalEl.querySelector('#artist-content .artist-grid');
    if (!content) return;

    const list = this.currentArtworks;

    if (!list || list.length === 0) {
      content.innerHTML = `
        <div class="artist-empty">
          <i class="fa-regular fa-image"></i>
          <p>还没有发布作品</p>
        </div>`;
      return;
    }

    content.innerHTML = '';
    list.forEach(art => {
      const catLabel = (window.Gallery && Gallery.CATEGORY_LABELS[art.category]) || art.category;
      const card = document.createElement('div');
      card.className = 'artist-card';
      card.innerHTML = `
        <div class="artist-card-media">
          <img loading="lazy" src="${this._esc(art.imageUrl)}" alt="${this._esc(art.title)}" />
          <span class="artist-cat">${catLabel}</span>
        </div>
        <div class="artist-card-info">
          <h4>${this._esc(art.title)}</h4>
          <div class="artist-card-stats">
            <span><i class="fa-solid fa-heart"></i> ${this._fmtNum(art.likes)}</span>
            <span class="artist-no">#${art.id}</span>
          </div>
        </div>
      `;
      card.addEventListener('click', () => {
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        this._close();
        if (window.Gallery) Gallery.openLightbox(art.id);
      });
      content.appendChild(card);
    });
  },

  // ----------------------------------------------------------
  // 显示弹窗
  // ----------------------------------------------------------
  _show() {
    if (typeof Sound !== 'undefined') Sound.playSound('pop');
    if (window.ModalScrollLock) ModalScrollLock.lock();
    requestAnimationFrame(() => this.modalEl.classList.add('open'));
  },

  // ----------------------------------------------------------
  // 关闭弹窗
  // ----------------------------------------------------------
  _close() {
    if (!this.modalEl) return;
    this.modalEl.classList.remove('open');
    if (window.ModalScrollLock) ModalScrollLock.unlock();
    if (typeof Sound !== 'undefined') Sound.playSound('close');
    setTimeout(() => {
      if (this.modalEl) {
        this.modalEl.remove();
        this.modalEl = null;
      }
    }, 300);
  },

  // ----------------------------------------------------------
  // 工具函数
  // ----------------------------------------------------------
  _fmtNum(n) {
    n = Number(n) || 0;
    if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n;
  },

  _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
};

// 暴露为全局
window.Artist = Artist;
window.openArtistPage = (authorOrId) => {
  if (typeof authorOrId === 'number') {
    Artist.openByUserId(authorOrId);
  } else {
    Artist.openByAuthorName(authorOrId);
  }
};

// ES Module export
export default Artist;
export { Artist };
const openArtistPage = window.openArtistPage;
export { openArtistPage };
