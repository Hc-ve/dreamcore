// ============================================================
// js/profile.js — 用户个人中心
// 显示: 头像、昵称、邮箱、注册时间
// 统计: 发布作品数、收藏数、获赞总数
// Tab: 我的作品 / 我的收藏
// ============================================================

const Profile = {
  modalEl: null,
  currentTab: 'works',

  // ----------------------------------------------------------
  // 显示个人中心（需登录）
  // ----------------------------------------------------------
  showProfile() {
    if (!window.currentUser) {
      if (window.Auth) Auth.requireLogin();
      return;
    }
    this.currentTab = 'works';
    this._build();
    if (typeof Sound !== 'undefined') Sound.playSound('pop');
    if (window.ModalScrollLock) ModalScrollLock.lock();
    requestAnimationFrame(() => this.modalEl.classList.add('open'));
    this._loadContent();
  },

  // ----------------------------------------------------------
  // 构建弹窗骨架
  // ----------------------------------------------------------
  _build() {
    if (this.modalEl) this.modalEl.remove();
    const user = window.currentUser;
    const initial = (user.username || '?').charAt(0).toUpperCase();
    const regDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '—';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay profile-modal';
    overlay.id = 'profile-modal';
    overlay.innerHTML = `
      <div class="modal-box profile-box glass">
        <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
        <div class="profile-head">
          <div class="profile-avatar-wrap">
            <span class="avatar-circle xl">${initial}</span>
            <div class="profile-avatar-glow"></div>
          </div>
          <div class="profile-info">
            <h2 class="profile-name">${this._esc(user.username)}
              ${user.isAdmin ? '<span class="profile-badge">管理员</span>' : ''}
            </h2>
            <p class="profile-email"><i class="fa-regular fa-envelope"></i> ${this._esc(user.email || '未设置邮箱')}</p>
            <p class="profile-reg"><i class="fa-regular fa-calendar"></i> 加入于 ${regDate}</p>
          </div>
        </div>

        <div class="profile-stats" id="profile-stats">
          <div class="stat-card"><div class="stat-num" id="stat-works">—</div><div class="stat-label">发布作品</div></div>
          <div class="stat-card"><div class="stat-num" id="stat-favs">—</div><div class="stat-label">收藏</div></div>
          <div class="stat-card"><div class="stat-num" id="stat-likes">—</div><div class="stat-label">获赞总数</div></div>
          <div class="stat-card"><div class="stat-num" id="stat-following">—</div><div class="stat-label">关注</div></div>
        </div>

        <div class="profile-tabs">
          <button class="profile-tab active" data-tab="works"><i class="fa-regular fa-images"></i> 我的作品</button>
          <button class="profile-tab" data-tab="favs"><i class="fa-regular fa-bookmark"></i> 我的收藏</button>
          <button class="profile-tab" data-tab="following"><i class="fa-regular fa-user-plus"></i> 我的关注</button>
        </div>

        <div class="profile-content" id="profile-content"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.modalEl = overlay;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('[data-close]')) this._close();
    });
    // Tab 切换
    overlay.querySelectorAll('.profile-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        overlay.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentTab = tab.dataset.tab;
        this._loadContent();
      });
    });
  },

  // ----------------------------------------------------------
  // 加载统计数据与当前 Tab 内容
  // ----------------------------------------------------------
  async _loadContent() {
    const user = window.currentUser;
    // 统计
    const [works, favs, totalLikes, following] = await Promise.all([
      getUserArtworks(user.id),
      getFavorites(user.id),
      getUserTotalLikes(user.id),
      getFollowing(user.id)
    ]);
    const setNum = (id, v) => {
      const el = this.modalEl.querySelector('#' + id);
      if (el) el.textContent = this._fmtNum(v);
    };
    setNum('stat-works', works.length);
    setNum('stat-favs', favs.length);
    setNum('stat-likes', totalLikes);
    setNum('stat-following', following.length);

    // 内容
    if (this.currentTab === 'works') {
      this._renderGrid(works, true);
    } else if (this.currentTab === 'favs') {
      this._renderGrid(favs, false);
    } else if (this.currentTab === 'following') {
      this._renderFollowing(following);
    }
  },

  // ----------------------------------------------------------
  // 渲染作品网格
  // ----------------------------------------------------------
  _renderGrid(list, isWorks) {
    const content = this.modalEl.querySelector('#profile-content');
    if (!list || list.length === 0) {
      content.innerHTML = `
        <div class="profile-empty">
          <i class="fa-regular fa-${isWorks ? 'image' : 'bookmark'}"></i>
          <p>${isWorks ? '还没有发布作品' : '还没有收藏作品'}</p>
          ${isWorks ? '<button class="btn-primary btn-sm" id="profile-go-publish"><i class="fa-solid fa-cloud-arrow-up"></i> 去发布</button>' : ''}
        </div>`;
      const goPub = content.querySelector('#profile-go-publish');
      if (goPub) {
        goPub.addEventListener('click', () => {
          this._close();
          if (window.Publish) Publish.showPublishModal();
        });
      }
      return;
    }
    content.innerHTML = '<div class="profile-grid"></div>';
    const grid = content.querySelector('.profile-grid');
    list.forEach(art => {
      const isVideo = art.type === 'video';
      const catLabel = (window.Gallery && Gallery.CATEGORY_LABELS[art.category]) || art.category;
      const card = document.createElement('div');
      card.className = 'profile-card';
      card.innerHTML = `
        <div class="profile-card-media">
          ${isVideo
            ? `<video muted src="${this._esc(art.imageUrl)}"></video>`
            : `<img loading="lazy" src="${this._esc(art.imageUrl)}" alt="${this._esc(art.title)}" />`}
          <span class="profile-cat">${catLabel}</span>
        </div>
        <div class="profile-card-info">
          <h4>${this._esc(art.title)}</h4>
          <div class="profile-card-stats">
            <span><i class="fa-solid fa-heart"></i> ${this._fmtNum(art.likes)}</span>
            <span class="profile-no">#${art.id}</span>
          </div>
        </div>
      `;
      card.addEventListener('click', () => {
        this._close();
        if (window.Gallery) Gallery.openLightbox(art.id);
      });
      grid.appendChild(card);
    });
  },

  // ----------------------------------------------------------
  // 渲染关注列表
  // ----------------------------------------------------------
  _renderFollowing(followingList) {
    const content = this.modalEl.querySelector('#profile-content');
    if (!followingList || followingList.length === 0) {
      content.innerHTML = `
        <div class="profile-empty">
          <i class="fa-regular fa-user-plus"></i>
          <p>还没有关注任何人</p>
          <p style="font-size:12px;margin-top:8px;opacity:0.6;">去画廊发现有趣的艺术家吧～</p>
        </div>`;
      return;
    }
    content.innerHTML = '<div class="profile-following-list"></div>';
    const list = content.querySelector('.profile-following-list');
    followingList.forEach(user => {
      const initial = (user.username || '?').charAt(0).toUpperCase();
      const item = document.createElement('div');
      item.className = 'following-item';
      item.innerHTML = `
        <span class="avatar-circle">${initial}</span>
        <div class="following-item-info">
          <div class="following-item-name">${this._esc(user.username)}</div>
          <div class="following-item-meta">
            <span><i class="fa-regular fa-images"></i> ${this._fmtNum(user.worksCount || 0)} 作品</span>
            <span><i class="fa-solid fa-heart"></i> ${this._fmtNum(user.followersCount || 0)} 粉丝</span>
          </div>
        </div>
        <button class="following-unfollow-btn" data-userid="${user.id}">
          <i class="fa-solid fa-check"></i> 已关注
        </button>
      `;
      // 点击用户打开艺术家主页
      item.addEventListener('click', (e) => {
        if (e.target.closest('.following-unfollow-btn')) return;
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        this._close();
        if (window.Artist) Artist.openByUserId(user.id);
      });
      // 取消关注按钮
      const unfollowBtn = item.querySelector('.following-unfollow-btn');
      if (unfollowBtn) {
        unfollowBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (typeof Sound !== 'undefined') Sound.playSound('click');
          try {
            await toggleFollow(window.currentUser.id, user.id);
            // 刷新列表
            const updated = await getFollowing(window.currentUser.id);
            this._renderFollowing(updated);
            // 更新统计
            const statEl = this.modalEl.querySelector('#stat-following');
            if (statEl) statEl.textContent = this._fmtNum(updated.length);
            // 更新 currentUser
            if (window.currentUser) {
              window.currentUser.followingCount = updated.length;
            }
            if (window.showToast) showToast('已取消关注', 'info');
          } catch (err) {
            console.error('取消关注失败:', err);
          }
        });
      }
      list.appendChild(item);
    });
  },

  _close() {
    if (!this.modalEl) return;
    this.modalEl.classList.remove('open');
    if (window.ModalScrollLock) ModalScrollLock.unlock();
    if (typeof Sound !== 'undefined') Sound.playSound('close');
    setTimeout(() => { if (this.modalEl) { this.modalEl.remove(); this.modalEl = null; } }, 300);
  },

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
window.Profile = Profile;
window.showProfile = () => Profile.showProfile();

// ES Module export
export default Profile;
export { Profile };
const showProfile = window.showProfile;
export { showProfile };
