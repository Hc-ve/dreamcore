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
  // ----------------------------------------------------------
  async openByAuthorName(authorName) {
    const artworks = await getArtworksByAuthorName(authorName);
    const totalLikes = artworks.reduce((sum, a) => sum + (a.likes || 0), 0);

    this.currentArtist = {
      name: authorName,
      bio: `梦境艺术家，专注于创造独特的视觉体验。`,
      worksCount: artworks.length,
      totalLikes: totalLikes,
      followersCount: Math.floor(Math.random() * 5000) + 100,
      followingCount: Math.floor(Math.random() * 200) + 10,
      isVirtual: true
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
    if (!user) return;

    const artworks = await getUserArtworks(userId);
    const totalLikes = await getUserTotalLikes(userId);

    this.currentArtist = {
      id: user.id,
      name: user.username,
      email: user.email,
      bio: user.bio || '这个人很懒，什么都没留下…',
      worksCount: user.worksCount || artworks.length,
      totalLikes: totalLikes,
      followersCount: user.followersCount || 0,
      followingCount: user.followingCount || 0,
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

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay artist-modal';
    overlay.id = 'artist-modal';
    overlay.innerHTML = `
      <div class="modal-box artist-box glass">
        <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>

        <div class="artist-head">
          <div class="artist-avatar-wrap">
            <span class="avatar-circle xl artist-avatar">${initial}</span>
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
        </div>

        <div class="artist-content" id="artist-content">
          <div class="artist-grid"></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.modalEl = overlay;

    // 关闭事件
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('[data-close]')) this._close();
    });

    // 渲染作品
    this._renderWorks();

    // 绑定关注按钮
    if (!isSelf) {
      this._bindFollowButton();
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

    // 虚拟艺术家无法关注（因为没有userId）
    if (artist.isVirtual) {
      btn.addEventListener('click', () => {
        if (window.showToast) {
          showToast('登录后可以关注注册艺术家哦', 'info');
        }
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
