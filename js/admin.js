// ============================================================
// js/admin.js — 管理员后台
// 作品管理: 列表展示、删除作品、编辑分类
// 用户管理: 用户列表、用户信息
// 仅管理员可访问
// ============================================================

const Admin = {
  modalEl: null,
  currentTab: 'artworks',
  artworksCache: [],
  usersCache: [],

  // ----------------------------------------------------------
  // 显示管理面板（需管理员）
  // ----------------------------------------------------------
  showAdminPanel() {
    const user = window.currentUser;
    if (!user) {
      if (window.Auth) Auth.requireLogin();
      return;
    }
    if (!user.isAdmin) {
      if (window.showToast) showToast('仅管理员可访问后台', 'warn');
      return;
    }
    this.currentTab = 'artworks';
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
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay admin-modal';
    overlay.id = 'admin-modal';
    overlay.innerHTML = `
      <div class="modal-box admin-box glass">
        <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
        <div class="admin-head">
          <h2><i class="fa-solid fa-shield-halved"></i> 管理后台</h2>
          <p class="admin-sub">梦境守护者控制台</p>
        </div>
        <div class="admin-tabs">
          <button class="admin-tab active" data-tab="artworks"><i class="fa-regular fa-images"></i> 作品管理</button>
          <button class="admin-tab" data-tab="users"><i class="fa-regular fa-users"></i> 用户管理</button>
        </div>
        <div class="admin-content" id="admin-content"></div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.modalEl = overlay;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('[data-close]')) this._close();
    });
    overlay.querySelectorAll('.admin-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        overlay.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentTab = tab.dataset.tab;
        this._loadContent();
      });
    });
  },

  // ----------------------------------------------------------
  // 加载当前 Tab 内容
  // ----------------------------------------------------------
  async _loadContent() {
    const content = this.modalEl.querySelector('#admin-content');
    if (this.currentTab === 'artworks') {
      this.artworksCache = await getAllArtworks();
      this._renderArtworks(content);
    } else {
      this.usersCache = await getAllUsers();
      this._renderUsers(content);
    }
  },

  // ----------------------------------------------------------
  // 渲染作品管理列表
  // ----------------------------------------------------------
  _renderArtworks(content) {
    const total = this.artworksCache.length;
    content.innerHTML = `
      <div class="admin-toolbar">
        <div class="admin-count">共 <strong>${total}</strong> 件作品</div>
        <div class="admin-search-mini">
          <input type="text" id="admin-art-filter" placeholder="筛选作品名/作者…" />
        </div>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>#</th><th>缩略</th><th>标题</th><th>作者</th><th>分类</th><th>点赞</th><th>操作</th></tr>
          </thead>
          <tbody id="admin-art-tbody"></tbody>
        </table>
      </div>
    `;
    this._fillArtRows(this.artworksCache);
    const filter = content.querySelector('#admin-art-filter');
    if (filter) {
      filter.addEventListener('input', (e) => {
        const kw = e.target.value.trim().toLowerCase();
        const list = this.artworksCache.filter(a =>
          (a.title || '').toLowerCase().includes(kw) ||
          (a.author || '').toLowerCase().includes(kw)
        );
        this._fillArtRows(list);
      });
    }
  },

  _fillArtRows(list) {
    const tbody = this.modalEl.querySelector('#admin-art-tbody');
    if (!tbody) return;
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="admin-empty">无匹配作品</td></tr>';
      return;
    }
    tbody.innerHTML = list.slice(0, 200).map(a => `
      <tr data-id="${a.id}">
        <td class="col-id">${a.id}</td>
        <td class="col-thumb"><img loading="lazy" src="${this._esc(a.imageUrl)}" alt="" /></td>
        <td class="col-title">${this._esc(a.title)}</td>
        <td>${this._esc(a.author)}</td>
        <td><span class="admin-cat-select" data-id="${a.id}">${this._catLabel(a.category)}</span></td>
        <td>${this._fmtNum(a.likes)}</td>
        <td class="col-actions">
          <button class="admin-btn edit" data-edit="${a.id}" title="编辑分类"><i class="fa-solid fa-pen"></i></button>
          <button class="admin-btn del" data-del="${a.id}" title="删除"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `).join('');

    // 编辑分类
    tbody.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => this._editCategory(Number(btn.dataset.edit)));
    });
    // 删除
    tbody.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => this._deleteArtwork(Number(btn.dataset.del)));
    });
  },

  // ----------------------------------------------------------
  // 编辑分类
  // ----------------------------------------------------------
  _editCategory(artworkId) {
    const art = this.artworksCache.find(a => a.id === artworkId);
    if (!art) return;
    const cats = ['digital-art', 'photography', 'illustration', 'abstract', '3d-art'];
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay confirm-modal';
    overlay.innerHTML = `
      <div class="modal-box confirm-box glass">
        <h3>编辑分类</h3>
        <p>为「${this._esc(art.title)}」选择新分类</p>
        <div class="admin-cat-picker">
          ${cats.map(c => `<button class="pub-cat ${c === art.category ? 'active' : ''}" data-cat="${c}">${this._catLabel(c)}</button>`).join('')}
        </div>
        <div class="confirm-actions">
          <button class="btn-ghost" data-cancel>取消</button>
          <button class="btn-primary" data-ok>确定</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    let selected = art.category;
    overlay.querySelectorAll('[data-cat]').forEach(b => {
      b.addEventListener('click', () => {
        overlay.querySelectorAll('[data-cat]').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        selected = b.dataset.cat;
      });
    });
    overlay.addEventListener('click', async (e) => {
      if (e.target === overlay || e.target.closest('[data-cancel]')) {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 300);
      }
      if (e.target.closest('[data-ok]')) {
        await updateArtwork(artworkId, { category: selected });
        if (window.showToast) showToast('分类已更新', 'success');
        if (typeof Sound !== 'undefined') Sound.playSound('success');
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 300);
        this._loadContent();
      }
    });
  },

  // ----------------------------------------------------------
  // 删除作品
  // ----------------------------------------------------------
  _deleteArtwork(artworkId) {
    const art = this.artworksCache.find(a => a.id === artworkId);
    if (!art) return;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay confirm-modal';
    overlay.innerHTML = `
      <div class="modal-box confirm-box glass">
        <h3><i class="fa-solid fa-triangle-exclamation"></i> 删除作品</h3>
        <p>确定删除「${this._esc(art.title)}」吗？此操作不可撤销。</p>
        <div class="confirm-actions">
          <button class="btn-ghost" data-cancel>取消</button>
          <button class="btn-primary danger" data-ok>确认删除</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));
    overlay.addEventListener('click', async (e) => {
      if (e.target === overlay || e.target.closest('[data-cancel]')) {
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 300);
      }
      if (e.target.closest('[data-ok]')) {
        await deleteArtwork(artworkId);
        if (window.showToast) showToast('作品已删除', 'success');
        if (typeof Sound !== 'undefined') Sound.playSound('close');
        overlay.classList.remove('open');
        setTimeout(() => overlay.remove(), 300);
        this._loadContent();
        if (window.Gallery) Gallery.refreshGallery();
      }
    });
  },

  // ----------------------------------------------------------
  // 渲染用户管理列表
  // ----------------------------------------------------------
  _renderUsers(content) {
    const total = this.usersCache.length;
    content.innerHTML = `
      <div class="admin-toolbar">
        <div class="admin-count">共 <strong>${total}</strong> 位用户</div>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr><th>ID</th><th>头像</th><th>用户名</th><th>邮箱</th><th>角色</th><th>注册时间</th></tr>
          </thead>
          <tbody>
            ${this.usersCache.map(u => {
              const initial = (u.username || '?').charAt(0).toUpperCase();
              const reg = u.createdAt ? new Date(u.createdAt).toLocaleDateString('zh-CN') : '—';
              return `
                <tr>
                  <td class="col-id">${u.id}</td>
                  <td><span class="avatar-circle sm">${initial}</span></td>
                  <td>${this._esc(u.username)}</td>
                  <td class="col-email">${this._esc(u.email || '—')}</td>
                  <td>${u.isAdmin ? '<span class="role-admin">管理员</span>' : '<span class="role-user">用户</span>'}</td>
                  <td>${reg}</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  _close() {
    if (!this.modalEl) return;
    this.modalEl.classList.remove('open');
    if (window.ModalScrollLock) ModalScrollLock.unlock();
    if (typeof Sound !== 'undefined') Sound.playSound('close');
    setTimeout(() => { if (this.modalEl) { this.modalEl.remove(); this.modalEl = null; } }, 300);
  },

  _catLabel(c) {
    const map = { 'digital-art': '数字艺术', 'photography': '摄影', 'illustration': '插画', 'abstract': '抽象', '3d-art': '3D艺术' };
    return map[c] || c;
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
window.Admin = Admin;
window.showAdminPanel = () => Admin.showAdminPanel();

// ES Module export
export default Admin;
export { Admin };
const showAdminPanel = window.showAdminPanel;
export { showAdminPanel };
