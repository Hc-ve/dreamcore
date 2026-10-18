// ============================================================
// js/notifications.js — 消息通知中心
// 功能: 通知铃铛、下拉列表、标记已读、全部已读
// 注意: 通知铃铛 HTML 由 auth.js 渲染，此处负责绑定事件和数据逻辑
// ============================================================

// 与 main.js 里的 _notifyEnabled 保持一致的轻量守卫
function _notifyEnabled() {
  try {
    const v = localStorage.getItem('dreamcore-notifyInApp');
    if (v === null) return true;
    let p; try { p = JSON.parse(v); } catch { p = v; }
    return p !== false;
  } catch { return true; }
}

const Notifications = {
  isOpen: false,
  currentUserId: null,
  _outsideHandler: null,

  init() {
    this._updateUserId();
    this._bindBellEvents();
    this.refreshBadge();

    const originalUpdate = window.Auth ? Auth.updateNavForUser.bind(Auth) : null;
    if (originalUpdate) {
      Auth.updateNavForUser = () => {
        originalUpdate();
        this._updateUserId();
        setTimeout(() => {
          this._bindBellEvents();
          this.refreshBadge();
        }, 0);
      };
    }
  },

  _updateUserId() {
    this.currentUserId = window.currentUser ? window.currentUser.id : null;
  },

  _bindBellEvents() {
    const bellBtn = document.getElementById('notification-bell');
    const markAllBtn = document.getElementById('notif-mark-all');
    const dropdown = document.getElementById('notification-dropdown');

    if (!bellBtn || !dropdown) return;

    bellBtn.onclick = (e) => {
      e.stopPropagation();
      if (typeof Sound !== 'undefined') Sound.playSound('click');
      this.toggleDropdown();
    };

    if (markAllBtn) {
      markAllBtn.onclick = async (e) => {
        e.stopPropagation();
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        await this.markAllRead();
      };
    }
  },

  toggleDropdown() {
    if (!window.currentUser) {
      if (window.Auth) Auth.requireLogin();
      return;
    }
    this._updateUserId();
    const dropdown = document.getElementById('notification-dropdown');
    if (!dropdown) return;

    this.isOpen = !this.isOpen;
    dropdown.classList.toggle('open', this.isOpen);

    if (this.isOpen) {
      this.loadNotifications();
      this._bindOutsideClick();
    } else {
      this._unbindOutsideClick();
    }
  },

  closeDropdown() {
    const dropdown = document.getElementById('notification-dropdown');
    if (dropdown) dropdown.classList.remove('open');
    this.isOpen = false;
    this._unbindOutsideClick();
  },

  _bindOutsideClick() {
    this._unbindOutsideClick();
    this._outsideHandler = (e) => {
      if (!e.target.closest('.notification-wrap')) {
        this.closeDropdown();
      }
    };
    setTimeout(() => document.addEventListener('click', this._outsideHandler), 0);
  },

  _unbindOutsideClick() {
    if (this._outsideHandler) {
      document.removeEventListener('click', this._outsideHandler);
      this._outsideHandler = null;
    }
  },

  async loadNotifications() {
    if (!this.currentUserId) return;

    const listEl = document.getElementById('notif-list');
    if (!listEl) return;

    listEl.innerHTML = '<div class="notif-loading"><div class="loader-orb-sm"></div><span>加载中…</span></div>';

    try {
      const notifications = await getUserNotifications(this.currentUserId);
      this._renderList(notifications);
    } catch (err) {
      console.error('加载通知失败:', err);
      listEl.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-triangle-exclamation empty-state-icon"></i>
          <p class="empty-state-text">加载失败，请重试</p>
          <button class="btn-primary btn-sm" onclick="Notifications.loadNotifications(); event.stopPropagation();">重试</button>
        </div>
      `;
    }
  },

  async _renderList(notifications) {
    const listEl = document.getElementById('notif-list');
    if (!listEl) return;

    if (!notifications || notifications.length === 0) {
      listEl.innerHTML = `
        <div class="notif-empty">
          <i class="fa-regular fa-bell"></i>
          <p>暂无新通知，快去探索作品吧~</p>
        </div>
      `;
      return;
    }

    const userCache = {};
    const artworkCache = {};

    const getUserData = async (userId) => {
      if (!userId) return null;
      if (userCache[userId]) return userCache[userId];
      try {
        const user = await getUserById(userId);
        userCache[userId] = user;
        return user;
      } catch { return null; }
    };

    const getArtworkData = async (artworkId) => {
      if (!artworkId) return null;
      if (artworkCache[artworkId]) return artworkCache[artworkId];
      try {
        const art = await getArtworkById(artworkId);
        artworkCache[artworkId] = art;
        return art;
      } catch { return null; }
    };

    const items = [];
    for (const notif of notifications) {
      const fromUser = await getUserData(notif.fromUserId);
      const artwork = await getArtworkData(notif.artworkId);

      let iconClass = '';
      let iconColor = '';
      let content = '';

      switch (notif.type) {
        case 'like':
          iconClass = 'fa-solid fa-heart';
          iconColor = 'var(--dream-pink)';
          content = `<strong>${this._esc(fromUser?.username || '匿名用户')}</strong> 赞了你的作品《${this._esc(artwork?.title || '未知作品')}》`;
          break;
        case 'comment':
          iconClass = 'fa-regular fa-comment';
          iconColor = 'var(--dream-blue)';
          content = `<strong>${this._esc(fromUser?.username || '匿名用户')}</strong> 评论了你的作品《${this._esc(artwork?.title || '未知作品')}》`;
          break;
        case 'follow':
          iconClass = 'fa-solid fa-user-plus';
          iconColor = 'var(--dream-mint)';
          content = `<strong>${this._esc(fromUser?.username || '匿名用户')}</strong> 关注了你`;
          break;
        default:
          iconClass = 'fa-regular fa-bell';
          iconColor = 'var(--dream-purple)';
          content = this._esc(notif.content || '有新通知');
      }

      const avatarText = (fromUser?.username || '?').charAt(0).toUpperCase();
      const timeText = this._fmtTime(notif.createdAt);
      const thumbHtml = artwork ? `<div class="notif-thumb"><img src="${this._esc(artwork.imageUrl)}" alt="" /></div>` : '';

      items.push(`
        <div class="notif-item ${notif.read ? 'is-read' : 'is-unread'}" data-id="${notif.id}" data-type="${notif.type}" data-artwork="${notif.artworkId || ''}" data-user="${notif.fromUserId || ''}">
          <div class="notif-avatar">
            <span class="avatar-circle sm">${this._esc(avatarText)}</span>
            <span class="notif-icon" style="color:${iconColor}"><i class="${iconClass}"></i></span>
          </div>
          <div class="notif-content">
            <p class="notif-text">${content}</p>
            <span class="notif-time">${timeText}</span>
          </div>
          ${thumbHtml}
          <button class="notif-mark-read" title="标记已读" aria-label="标记已读">
            <i class="fa-solid fa-check"></i>
          </button>
        </div>
      `);
    }

    listEl.innerHTML = items.join('');

    listEl.querySelectorAll('.notif-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        if (e.target.closest('.notif-mark-read')) return;
        const id = item.dataset.id;
        const type = item.dataset.type;
        const artworkId = item.dataset.artwork;
        const userId = item.dataset.user;

        await this.markRead(id);
        this.closeDropdown();

        if (artworkId && window.Gallery) {
          Gallery.openLightbox(artworkId);
        } else if (userId && type === 'follow' && window.Artist) {
          Artist.openByUserId(Number(userId));
        }
      });

      const markBtn = item.querySelector('.notif-mark-read');
      markBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = item.dataset.id;
        await this.markRead(id);
      });
    });
  },

  async markRead(id) {
    if (!this.currentUserId) return;
    try {
      await markNotificationRead(id);
      this.refreshBadge();
      const item = document.querySelector(`.notif-item[data-id="${id}"]`);
      if (item) {
        item.classList.remove('is-unread');
        item.classList.add('is-read');
      }
    } catch (err) {
      console.error('标记已读失败:', err);
    }
  },

  async markAllRead() {
    if (!this.currentUserId) return;
    try {
      await markAllNotificationsRead(this.currentUserId);
      this.refreshBadge();
      document.querySelectorAll('.notif-item').forEach(item => {
        item.classList.remove('is-unread');
        item.classList.add('is-read');
      });
      if (window.showToast) showToast('已全部标记为已读', 'success');
    } catch (err) {
      console.error('全部已读失败:', err);
    }
  },

  async refreshBadge() {
    const badge = document.getElementById('notification-badge');
    if (!badge) return;

    // 通知开关关闭时，强制隐藏徽标（不请求后端）
    if (!_notifyEnabled()) {
      badge.style.display = 'none';
      return;
    }

    this._updateUserId();

    if (!this.currentUserId) {
      badge.style.display = 'none';
      return;
    }

    try {
      const count = await getUnreadNotificationCount(this.currentUserId);
      if (count > 0) {
        badge.style.display = 'flex';
        badge.textContent = count > 99 ? '99+' : String(count);
      } else {
        badge.style.display = 'none';
      }
    } catch (err) {
      badge.style.display = 'none';
    }
  },

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

  _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
};

window.Notifications = Notifications;

// ES Module export
export default Notifications;
export { Notifications };
