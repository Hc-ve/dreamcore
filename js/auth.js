// ============================================================
// js/auth.js — 用户认证系统
// 全局状态: currentUser
// 功能: 注册/登录弹窗(毛玻璃风格)、登录态持久化、首次访问欢迎引导
// ============================================================

// 全局当前用户状态（null 表示未登录）
let currentUser = null;

const Auth = {
  modalEl: null,

  // ----------------------------------------------------------
  // 检查登录状态（从 localStorage 恢复）
  // ----------------------------------------------------------
  async checkAuthState() {
    const saved = localStorage.getItem('currentUser');
    if (!saved) return null;
    try {
      currentUser = JSON.parse(saved);
    } catch (e) {
      currentUser = null;
    }
    window.currentUser = currentUser;
    return currentUser;
  },

  // 获取当前用户（供其他模块读取最新状态）
  getCurrentUser() {
    return currentUser;
  },

  // ----------------------------------------------------------
  // 更新导航栏用户状态
  // ----------------------------------------------------------
  updateNavForUser() {
    const area = document.getElementById('nav-user-area');
    if (!area) return;

    if (currentUser) {
      // 已登录：显示通知铃铛 + 头像 + 下拉菜单触发
      const initial = (currentUser.username || '?').charAt(0).toUpperCase();
      const isAdmin = currentUser.isAdmin;
      area.innerHTML = `
        <div class="notification-wrap" id="notification-wrap">
          <button class="notification-bell" id="notification-bell" aria-label="通知">
            <i class="fa-regular fa-bell"></i>
            <span class="notification-badge" id="notification-badge" style="display:none;">0</span>
          </button>
          <div class="notification-dropdown" id="notification-dropdown">
            <div class="notif-header">
              <span class="notif-title">消息通知</span>
              <button class="notif-mark-all" id="notif-mark-all">全部已读</button>
            </div>
            <div class="notif-list" id="notif-list">
              <div class="notif-empty">
                <i class="fa-regular fa-bell"></i>
                <p>暂无新通知，快去探索作品吧~</p>
              </div>
            </div>
          </div>
        </div>
        <div class="user-menu" id="user-menu">
          <button class="user-avatar-btn" id="user-avatar-btn" aria-label="用户菜单">
            <span class="avatar-circle">${initial}</span>
          </button>
          <div class="user-dropdown" id="user-dropdown">
            <div class="dropdown-header">
              <span class="avatar-circle lg">${initial}</span>
              <div>
                <div class="dd-name">${this._esc(currentUser.username)}</div>
                <div class="dd-email">${this._esc(currentUser.email || '梦境居民')}</div>
              </div>
            </div>
            <button class="dropdown-item" data-action="profile">
              <i class="fa-regular fa-user"></i> 个人中心
            </button>
            ${isAdmin ? `<button class="dropdown-item" data-action="admin">
              <i class="fa-solid fa-shield-halved"></i> 管理后台
            </button>` : ''}
            <button class="dropdown-item danger" data-action="logout">
              <i class="fa-solid fa-arrow-right-from-bracket"></i> 退出登录
            </button>
          </div>
        </div>
      `;

      // 下拉菜单事件
      const btn = document.getElementById('user-avatar-btn');
      const dd = document.getElementById('user-dropdown');
      // 外部点击关闭监听器（每次打开时绑定，关闭时移除）
      let outsideClickHandler = null;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dd.classList.toggle('open');
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        if (isOpen) {
          // 打开时绑定外部点击关闭
          outsideClickHandler = (ev) => {
            if (!dd.contains(ev.target) && ev.target !== btn) {
              dd.classList.remove('open');
              document.removeEventListener('click', outsideClickHandler);
              outsideClickHandler = null;
            }
          };
          setTimeout(() => document.addEventListener('click', outsideClickHandler), 0);
        } else if (outsideClickHandler) {
          document.removeEventListener('click', outsideClickHandler);
          outsideClickHandler = null;
        }
      });

      area.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
          dd.classList.remove('open');
          if (outsideClickHandler) {
            document.removeEventListener('click', outsideClickHandler);
            outsideClickHandler = null;
          }
          const action = item.dataset.action;
          if (action === 'profile' && typeof showProfile === 'function') showProfile();
          if (action === 'admin' && typeof showAdminPanel === 'function') showAdminPanel();
          if (action === 'logout') this.handleLogout();
        });
      });
    } else {
      // 未登录：显示登录按钮
      area.innerHTML = `
        <button class="btn-ghost" id="btn-login">
          <i class="fa-regular fa-circle-user"></i>
          <span>登录</span>
        </button>
      `;
      document.getElementById('btn-login').addEventListener('click', () => {
        if (typeof Sound !== 'undefined') Sound.playSound('pop');
        this.showAuthModal('login');
      });
    }

    // 发布按钮始终可见（未登录点击时会提示登录）
  },

  // ----------------------------------------------------------
  // 显示注册/登录弹窗
  // mode: 'login' | 'register'
  // ----------------------------------------------------------
  showAuthModal(mode = 'login') {
    const wasSwitching = !!this.modalEl; // 模式切换时不再重复锁定/播放音效
    this._buildModal(mode);
    if (!wasSwitching) {
      if (typeof Sound !== 'undefined') Sound.playSound('pop');
      if (window.ModalScrollLock) ModalScrollLock.lock();
    }
    requestAnimationFrame(() => this.modalEl.classList.add('open'));
  },

  // ----------------------------------------------------------
  // 构建弹窗 DOM
  // ----------------------------------------------------------
  _buildModal(mode) {
    // 若已存在则移除重建
    if (this.modalEl) this.modalEl.remove();

    const isLogin = mode === 'login';
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay auth-modal';
    overlay.id = 'auth-modal';
    overlay.innerHTML = `
      <div class="modal-box auth-box glass">
        <button class="modal-close" data-close aria-label="关闭">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <div class="auth-visual">
          <div class="auth-orb"></div>
          <div class="auth-orb orb2"></div>
        </div>
        <div class="auth-body">
          <h2 class="auth-title">${isLogin ? '欢迎回到梦境' : '开启你的梦境之旅'}</h2>
          <p class="auth-sub">${isLogin ? '登录以继续探索与创作' : '注册账号，发布属于你的艺术作品'}</p>
          <form id="auth-form" class="auth-form" novalidate>
            <div class="field">
              <i class="fa-regular fa-user"></i>
              <input type="text" id="auth-username" placeholder="用户名" autocomplete="username" required />
            </div>
            ${!isLogin ? `
            <div class="field">
              <i class="fa-regular fa-envelope"></i>
              <input type="email" id="auth-email" placeholder="邮箱（选填）" autocomplete="email" />
            </div>` : ''}
            <div class="field">
              <i class="fa-solid fa-lock"></i>
              <input type="password" id="auth-password" placeholder="密码" autocomplete="${isLogin ? 'current-password' : 'new-password'}" required />
            </div>
            <div class="auth-error" id="auth-error"></div>
            <button type="submit" class="btn-primary btn-block" id="auth-submit">
              ${isLogin ? '登录' : '注册'}
            </button>
          </form>
          <div class="auth-switch">
            ${isLogin ? '还没有账号？' : '已有账号？'}
            <a href="#" data-switch="${isLogin ? 'register' : 'login'}">
              ${isLogin ? '立即注册' : '去登录'}
            </a>
          </div>
          ${isLogin ? `<div class="auth-hint">体验账号：admin / admin123</div>` : ''}
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.modalEl = overlay;

    // 关闭事件
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('[data-close]')) this._closeModal();
    });
    // 切换登录/注册
    overlay.querySelectorAll('[data-switch]').forEach(a => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        this.showAuthModal(a.dataset.switch);
      });
    });
    // 表单提交
    const form = overlay.querySelector('#auth-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = overlay.querySelector('#auth-username').value.trim();
      const password = overlay.querySelector('#auth-password').value;
      const emailInput = overlay.querySelector('#auth-email');
      const email = emailInput ? emailInput.value.trim() : '';
      const errEl = overlay.querySelector('#auth-error');
      errEl.textContent = '';
      const submitBtn = overlay.querySelector('#auth-submit');
      submitBtn.disabled = true;
      submitBtn.textContent = '处理中...';

      try {
        if (isLogin) {
          await this.handleLogin(username, password);
        } else {
          await this.handleRegister(username, email, password);
        }
        this._closeModal();
      } catch (err) {
        errEl.textContent = err.message || '操作失败，请重试';
        if (typeof Sound !== 'undefined') Sound.playSound('close');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isLogin ? '登录' : '注册';
      }
    });

    // 自动聚焦
    setTimeout(() => overlay.querySelector('#auth-username').focus(), 200);
  },

  _closeModal() {
    if (!this.modalEl) return;
    this.modalEl.classList.remove('open');
    if (window.ModalScrollLock) ModalScrollLock.unlock();
    if (typeof Sound !== 'undefined') Sound.playSound('close');
    setTimeout(() => {
      if (this.modalEl) { this.modalEl.remove(); this.modalEl = null; }
    }, 300);
  },

  // ----------------------------------------------------------
  // 处理注册
  // ----------------------------------------------------------
  async handleRegister(username, email, password) {
    if (!username || username.length < 2) throw new Error('用户名至少 2 个字符');
    if (!password || password.length < 6) throw new Error('密码至少 6 位');
    if (window.Sentry) Sentry.addBreadcrumb({ category: 'auth', message: 'User registration attempt', data: { username, email } });
    const user = await registerUser({ username, email, password });
    // 注册成功直接登录
    currentUser = { id: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin, createdAt: user.createdAt };
    window.currentUser = currentUser;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    this.updateNavForUser();
    if (typeof AI !== 'undefined') AI.onUserLogin(currentUser);
    this._toast(`欢迎加入，${user.username}！`, 'success');
    if (typeof Sound !== 'undefined') Sound.playSound('success');
    return user;
  },

  // ----------------------------------------------------------
  // 处理登录
  // ----------------------------------------------------------
  async handleLogin(username, password) {
    if (!username || !password) throw new Error('请输入用户名和密码');
    if (window.Sentry) Sentry.addBreadcrumb({ category: 'auth', message: 'User login attempt', data: { username } });
    const user = await loginUser(username, password);
    currentUser = { id: user.id, username: user.username, email: user.email, isAdmin: user.isAdmin, createdAt: user.createdAt };
    window.currentUser = currentUser;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    this.updateNavForUser();
    if (typeof AI !== 'undefined') AI.onUserLogin(currentUser);
    this._toast(`欢迎回来，${user.username}！`, 'success');
    if (typeof Sound !== 'undefined') Sound.playSound('success');
    return user;
  },

  // ----------------------------------------------------------
  // 登出
  // ----------------------------------------------------------
  handleLogout() {
    currentUser = null;
    window.currentUser = null;
    localStorage.removeItem('currentUser');
    this.updateNavForUser();
    if (typeof AI !== 'undefined') AI.onUserLogout();
    this._toast('已退出登录', 'info');
    if (typeof Sound !== 'undefined') Sound.playSound('close');
  },

  // ----------------------------------------------------------
  // 检查是否登录，未登录则弹窗。返回是否已登录
  // ----------------------------------------------------------
  requireLogin() {
    if (currentUser) return true;
    this.showAuthModal('login');
    this._toast('请先登录后再操作', 'warn');
    return false;
  },

  // ----------------------------------------------------------
  // 首次访问欢迎引导
  // ----------------------------------------------------------
  showWelcomeIfFirstVisit() {
    if (localStorage.getItem('hasVisited')) return;
    localStorage.setItem('hasVisited', '1');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay welcome-modal';
    overlay.innerHTML = `
      <div class="modal-box welcome-box glass">
        <div class="welcome-orbs">
          <span></span><span></span><span></span>
        </div>
        <h2 class="welcome-title">梦境已开启</h2>
        <p class="welcome-text">
          欢迎来到 <span class="grad-text">Dreamcore</span> 数字艺术社交平台。<br/>
          在这里浏览 200+ 件梦幻艺术作品，发布你的创作，<br/>
          与艺术家们用点赞、收藏与评论交流。
        </p>
        <div class="welcome-tips">
          <div class="tip"><i class="fa-solid fa-palette"></i> 浏览与发现</div>
          <div class="tip"><i class="fa-solid fa-cloud-arrow-up"></i> 发布作品</div>
          <div class="tip"><i class="fa-solid fa-heart"></i> 互动收藏</div>
        </div>
        <button class="btn-primary btn-block" id="welcome-enter">进入梦境</button>
        <div class="welcome-hint">体验管理员账号：admin / admin123</div>
      </div>
    `;
    document.body.appendChild(overlay);
    if (window.ModalScrollLock) ModalScrollLock.lock();
    requestAnimationFrame(() => overlay.classList.add('open'));
    if (typeof Sound !== 'undefined') Sound.playSound('pop');
    const close = () => {
      overlay.classList.remove('open');
      if (window.ModalScrollLock) ModalScrollLock.unlock();
      if (typeof Sound !== 'undefined') Sound.playSound('close');
      setTimeout(() => overlay.remove(), 350);
    };
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('#welcome-enter')) close();
    });
  },

  // ----------------------------------------------------------
  // 轻量提示 toast
  // ----------------------------------------------------------
  _toast(msg, type = 'info') {
    if (typeof showToast === 'function') return showToast(msg, type);
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2500);
  },

  // ----------------------------------------------------------
  // HTML 转义
  // ----------------------------------------------------------
  _esc(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
};

// 暴露为全局
window.Auth = Auth;
window.currentUser = currentUser;

// ES Module export
export default Auth;
export { Auth, currentUser };
