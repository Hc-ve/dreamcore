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
    const displayName = (user.nickname || '').trim() || user.username || '用户';
    // 头像：读用户记录 / 账户级设置（Bug #2：自定义头像此前在个人中心不生效）
    const avatar = user.avatar || (window.Settings && typeof window.Settings.getSetting === 'function' ? window.Settings.getSetting('avatar') : null);
    const avatarHtml = (window.Settings && typeof window.Settings.renderAvatarHtml === 'function')
      ? window.Settings.renderAvatarHtml({ avatar, username: user.username, nickname: user.nickname }, { sizeClass: 'xl' })
      : `<span class="avatar-circle xl">${(user.username || '?').charAt(0).toUpperCase()}</span>`;
    const regDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '—';

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay profile-modal';
    overlay.id = 'profile-modal';
    overlay.innerHTML = `
      <div class="modal-box profile-box glass">
        <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
        <div class="profile-head">
          <div class="profile-avatar-wrap">
            ${avatarHtml}
            <div class="profile-avatar-glow"></div>
          </div>
          <div class="profile-info">
            <h2 class="profile-name">${this._esc(displayName)}
              ${user.isAdmin ? '<span class="profile-badge">管理员</span>' : ''}
            </h2>
            ${user.bio ? `<p style="font-size:.85rem;color:var(--text-secondary);margin:2px 0 6px;line-height:1.5;">${this._esc(user.bio)}</p>` : ''}
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

        <button class="profile-lb-entry" id="profile-lb-btn"><span><i class="fa-solid fa-trophy" aria-hidden="true"></i> 我的排行榜排名</span><i class="fa-solid fa-chevron-right" aria-hidden="true"></i></button>

        <div class="profile-tabs">
          <button class="profile-tab active" data-tab="works"><i class="fa-regular fa-images"></i> 我的作品</button>
          <button class="profile-tab" data-tab="favs"><i class="fa-regular fa-bookmark"></i> 我的收藏</button>
          <button class="profile-tab" data-tab="following"><i class="fa-regular fa-user-plus"></i> 我的关注</button>
          <button class="profile-tab" data-tab="orders"><i class="fa-solid fa-box"></i> 我的订单</button>
        </div>

        <div class="profile-content" id="profile-content"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.modalEl = overlay;

    overlay.addEventListener('click', (e) => {
      if (e.target.closest('#profile-lb-btn')) {
        this._close();
        location.hash = '#/leaderboard';
        return;
      }
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
    } else if (this.currentTab === 'orders') {
      const orders = await getAllOrders();
      this._renderOrders(orders.filter(o => String(o.userId) === String(user.id)));
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
      const avatarHtml = (window.Settings && typeof window.Settings.renderAvatarHtml === 'function')
        ? window.Settings.renderAvatarHtml(user, { sizeClass: '' })
        : `<span class="avatar-circle">${(user.username || '?').charAt(0).toUpperCase()}</span>`;
      const displayName = (user.nickname || '').trim() || user.username || '用户';
      const item = document.createElement('div');
      item.className = 'following-item';
      item.innerHTML = `
        ${avatarHtml}
        <div class="following-item-info">
          <div class="following-item-name">${this._esc(displayName)}</div>
          <div class="following-item-meta">
            <span><i class="fa-regular fa-images"></i> ${this._fmtNum(user.worksCount || 0)} 作品</span>
            <span><i class="fa-solid fa-heart"></i> ${this._fmtNum(user.followersCount || 0)} 粉丝</span>
          </div>
        </div>
        <button class="following-unfollow-btn" data-userid="${user.id}">
          <i class="fa-solid fa-check"></i> 已关注
        </button>
      `;
      // 点击用户 → 进入该用户的个人资料页（统一路由：#/profile-<id>）
      item.addEventListener('click', (e) => {
        if (e.target.closest('.following-unfollow-btn')) return;
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        this._close();
        window.location.hash = `#/profile-${encodeURIComponent(user.id)}`;
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

  // ----------------------------------------------------------
  // 渲染我的订单（列表 + 点击展开物流时间线详情）
  // ----------------------------------------------------------
  _statusLabel(status) {
    const labels = (window.ORDER_STATE_LABELS) || { paid: '已支付', producing: '制作中', shipped: '已发货', in_transit: '运输中', delivered: '已签收' };
    return labels[status] || status || '—';
  },

  _renderOrders(list) {
    const content = this.modalEl.querySelector('#profile-content');
    if (!list || list.length === 0) {
      content.innerHTML = `
        <div class="profile-empty">
          <i class="fa-solid fa-box"></i>
          <p>还没有订单</p>
          <p style="font-size:12px;margin-top:8px;opacity:0.6;">去创作工坊把你的作品变成实物吧～</p>
        </div>`;
      return;
    }
    content.innerHTML = '<div class="profile-orders"></div>';
    const wrap = content.querySelector('.profile-orders');
    list.forEach(o => {
      const card = document.createElement('div');
      card.className = 'profile-order-card';
      const spec = [o.material, o.size].filter(Boolean).join(' · ') || (o.craftType || '—');
      const product = o.product || o.craftType || '文创商品';
      const timeline = Array.isArray(o.timeline) && o.timeline.length
        ? o.timeline.map(t => {
            const ts = t.ts ? new Date(t.ts).toLocaleString('zh-CN', { hour12: false }) : '';
            return `<li class="po-tl-item"><span class="po-tl-state">${this._esc(this._statusLabel(t.state))}</span><span class="po-tl-note">${this._esc(t.note || '')}</span><span class="po-tl-ts">${this._esc(ts)}</span></li>`;
          }).join('')
        : `<li class="po-tl-item"><span class="po-tl-state">${this._esc(this._statusLabel(o.status))}</span></li>`;
      card.innerHTML = `
        <div class="po-head">
          <span class="po-no">订单号 ${this._esc(o.orderNo || '—')}</span>
          <span class="po-status po-status-${this._esc(o.status)}">${this._esc(this._statusLabel(o.status))}</span>
        </div>
        <div class="po-body">
          <div class="po-row"><span class="po-k">商品</span><span>${this._esc(product)}</span></div>
          <div class="po-row"><span class="po-k">规格</span><span>${this._esc(spec)}</span></div>
          <div class="po-row"><span class="po-k">价格</span><span>¥${Number(o.price) || 0}</span></div>
          <div class="po-row"><span class="po-k">收货人</span><span>${this._esc(o.receiver || '—')}（${this._esc(o.phone || '—')}）</span></div>
          <div class="po-row"><span class="po-k">收货地址</span><span>${this._esc(o.address || '—')}</span></div>
          ${o.trackingNo ? `<div class="po-row"><span class="po-k">物流单号</span><span>${this._esc(o.trackingNo)}</span></div>` : ''}
        </div>
        <button class="po-toggle" type="button">物流详情 <i class="fa-solid fa-chevron-down"></i></button>
        <ol class="po-timeline" hidden>${timeline}</ol>
      `;
      const toggle = card.querySelector('.po-toggle');
      const tl = card.querySelector('.po-timeline');
      toggle.addEventListener('click', () => {
        const open = tl.hasAttribute('hidden');
        tl.hidden = !open;
        toggle.classList.toggle('open', open);
      });
      wrap.appendChild(card);
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

// 我的订单卡片样式（幂等注入）
(function _injectProfileOrderStyle() {
  if (document.getElementById('profile-order-style')) return;
  const style = document.createElement('style');
  style.id = 'profile-order-style';
  style.textContent = `
    .profile-orders { display: flex; flex-direction: column; gap: 12px; }
    .profile-order-card { padding: 14px 16px; border: 1px solid var(--glass-border); border-radius: var(--radius-sm); background: var(--glass-bg); }
    .po-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; }
    .po-no { font-weight: 700; font-size: .88rem; color: var(--text-primary); }
    .po-status { padding: 3px 10px; border-radius: 999px; font-size: .74rem; font-weight: 600; white-space: nowrap; }
    .po-status-paid { background: rgba(52,211,153,.16); color: #2bb58a; }
    .po-status-producing { background: rgba(245,158,11,.16); color: #d97706; }
    .po-status-shipped { background: rgba(96,165,250,.16); color: #3b82f6; }
    .po-status-in_transit { background: rgba(168,85,247,.16); color: #9333ea; }
    .po-status-delivered { background: rgba(52,211,153,.22); color: #159a6b; }
    .po-body .po-row { display: flex; gap: 10px; font-size: .82rem; margin: 4px 0; color: var(--text-primary); }
    .po-body .po-row .po-k { flex: 0 0 58px; color: var(--text-secondary); }
    .po-toggle { margin-top: 8px; padding: 0; border: none; background: none; color: var(--text-secondary); font-size: .78rem; cursor: pointer; }
    .po-toggle i { transition: transform .2s; }
    .po-toggle.open i { transform: rotate(180deg); }
    .po-timeline { margin: 10px 0 0; padding: 0 0 0 6px; list-style: none; border-left: 2px dashed var(--glass-border); }
    .po-timeline[hidden] { display: none; }
    .po-tl-item { display: flex; flex-direction: column; gap: 2px; padding: 4px 0 4px 12px; font-size: .78rem; }
    .po-tl-state { font-weight: 600; color: var(--text-primary); }
    .po-tl-note { color: var(--text-secondary); }
    .po-tl-ts { font-size: .7rem; color: var(--text-secondary); opacity: .7; }
  `;
  document.head.appendChild(style);
})();

// 暴露为全局
window.Profile = Profile;
window.showProfile = () => Profile.showProfile();

// ES Module export
export default Profile;
export { Profile };
const showProfile = window.showProfile;
export { showProfile };
