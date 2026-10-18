// ============================================================
// js/auth.js — 用户认证系统
// 全局状态: currentUser
// 功能: 注册/登录弹窗(毛玻璃风格)、登录态持久化、首次访问欢迎引导
// ============================================================

import { supabase, supabaseEnabled } from './api/supabase-client.js';

// 全局当前用户状态（null 表示未登录）
let currentUser = null;

// ----------------------------------------------------------
// Supabase Auth 辅助：用户名合成登录邮箱（项目用用户名登录，
// Supabase 用邮箱；合成规则 username@dreamcore.app，稳定可复现）
// ----------------------------------------------------------
function _authEmailFor(username) {
  const u = String(username || '').trim().toLowerCase();
  if (u.includes('@')) return u;
  const cleaned = u.replace(/[^a-z0-9_.-]/g, '');
  if (cleaned) return cleaned + '@dreamcore.app';
  // M6e: 全中文等非 ASCII 用户名清洗后为空 → 用同步确定性哈希生成邮箱本地部分
  // djb2 哈希 + base36：同一用户名注册/登录永远合成同一邮箱，可复现且无冲突风险
  let h = 5381;
  for (let i = 0; i < u.length; i++) h = ((h << 5) + h + u.charCodeAt(i)) >>> 0;
  return 'u' + h.toString(36) + '@dreamcore.app';
}

// 云端 auth.users + profiles → 统一 currentUser 结构
async function _cloudProfileToUser() {
  if (!supabase) return null; // M5 防御：客户端未初始化时短路（P8）
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  let profile = null;
  try {
    const r = await supabase.from('profiles').select('*').eq('id', user.id).single();
    profile = r.data;
  } catch (_) { /* profile 查询失败时用 metadata 兜底 */ }
  const meta = user.user_metadata || {};
  return {
    id: user.id,
    username: (profile && profile.username) || meta.username || '用户',
    email: meta.email || user.email || '',
    isAdmin: !!((profile && profile.role === 'admin') || meta.isAdmin),
    role: meta.role === 'superadmin' ? 'superadmin' : (((profile && profile.role === 'admin') || meta.isAdmin) ? 'admin' : 'user'),
    createdAt: (profile && profile.created_at) || user.created_at || ''
  };
}

// 云端用户在本地 IndexedDB users 表建立记录（幂等），
// 使艺术家主页/关注/粉丝/作品归属等本地数据能力对云端用户同样可用
async function _ensureLocalUser() {
  if (!currentUser) return;
  const fn = window.ensureLocalUserForCloudUser;
  if (typeof fn !== 'function') return;
  try { await fn(currentUser); } catch (_) { /* 本地同步失败不阻塞登录 */ }
}

// M6a-2 密保答案哈希：sha256(username:answer)，与云函数 auth-reset.mjs 保持一致
async function _hashSecAnswer(username, answer) {
  const text = String(username).trim().toLowerCase() + ':' + String(answer).trim().toLowerCase();
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Supabase 认证错误 → 用户可读文案
function _mapAuthError(err) {
  const m = String((err && err.message) || '');
  if (/already registered|already exists/i.test(m)) return '该用户名已被注册';
  if (/invalid login credentials/i.test(m)) return '用户名或密码错误';
  if (/email not confirmed/i.test(m)) return '账号已注册，请直接登录';
  if (/failed to fetch|networkerror/i.test(m)) return '网络连接失败，请检查网络后重试';
  return m || '认证失败，请重试';
}

const Auth = {
  modalEl: null,

  // ----------------------------------------------------------
  // 检查登录状态（从 localStorage 恢复）
  // ----------------------------------------------------------
  async checkAuthState() {
    // 标准 Supabase Auth：云端 JWT 会话为唯一事实源
    if (supabaseEnabled) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        currentUser = session ? await _cloudProfileToUser() : null;
      } catch (_) {
        currentUser = null; // 云端异常按未登录处理，不走本地缓存旁路
      }
      window.currentUser = currentUser;
      if (currentUser) localStorage.setItem('currentUser', JSON.stringify(currentUser));
      else localStorage.removeItem('currentUser');
      if (currentUser) await _ensureLocalUser();
      return currentUser;
    }
    // 本地降级：仅在未配置 Supabase 的本地开发环境生效
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
      // 已登录：只显示用户头像菜单（通知铃铛已移至设置页）
      const initial = (currentUser.username || '?').charAt(0).toUpperCase();
      const isAdmin = currentUser.isAdmin;

      // 优先用 Settings 里的头像
      let avatarHtml = `<span class="avatar-circle">${initial}</span>`;
      try {
        if (window.Settings?.getSetting) {
          const av = window.Settings.getSetting('avatar');
          if (av && av.type === 'custom' && av.dataURL) {
            avatarHtml = `<img src="${av.dataURL}" class="avatar-circle avatar-img" width="30" height="30" alt="头像">`;
          } else if (av && av.type === 'system') {
            // 系统头像：从 Settings 模块的 SYSTEM_AVATARS 取
            // 直接读 svg 字符串比较稳——Settings 暴露的 Settings.SYSTEM_AVATARS
            const SA = window.Settings.SYSTEM_AVATARS || [];
            const found = SA.find(a => a.id === av.id);
            if (found && found.svg) {
              avatarHtml = `<span class="avatar-circle avatar-svg-wrap">${found.svg}</span>`;
            }
          }
        }
      } catch (e) { /* 忽略，fallback 到 initial */ }

      area.innerHTML = `
        <div class="user-menu" id="user-menu">
          <button class="user-avatar-btn" id="user-avatar-btn" aria-label="用户菜单">
            ${avatarHtml}
          </button>
          <div class="user-dropdown" id="user-dropdown">
            <div class="dropdown-header">
              <div class="user-avatar-btn lg">${avatarHtml.replace('class="avatar-circle', 'class="avatar-circle lg').replace('width="30" height="30"', 'width="44" height="44"')}</div>
              <div>
                <div class="dd-name">${this._esc(currentUser.username)}</div>
                <div class="dd-email">${this._esc(currentUser.email || '共创伙伴')}</div>
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
          <h2 class="auth-title">${isLogin ? '欢迎回到 Dreamcore' : '开启文旅共创之旅'}</h2>
          <p class="auth-sub">${isLogin ? '登录以继续探索与创作' : '注册账号，发布属于你的文创作品'}</p>
          <form id="auth-form" class="auth-form" novalidate>
            <div class="field">
              <i class="fa-regular fa-user"></i>
              <input type="text" id="auth-username" placeholder="用户名" autocomplete="username" required />
            </div>
            ${!isLogin ? `
            <div class="field">
              <i class="fa-regular fa-envelope"></i>
              <input type="email" id="auth-email" placeholder="邮箱（选填）" autocomplete="email" />
            </div>
            <div class="field">
              <i class="fa-solid fa-shield-halved"></i>
              <select id="auth-secq" style="width:100%;padding:10px 2px;background:transparent;border:none;color:var(--text,#1f2937);outline:none;font-size:0.95rem;" aria-label="密保问题">
                <option value="">选择密保问题（用于找回密码）</option>
                <option value="您的母亲的名字是？">您的母亲的名字是？</option>
                <option value="您的出生城市是？">您的出生城市是？</option>
                <option value="您第一只宠物的名字是？">您第一只宠物的名字是？</option>
                <option value="您小学班主任的姓氏是？">您小学班主任的姓氏是？</option>
                <option value="您最喜欢的电影是？">您最喜欢的电影是？</option>
                <option value="__custom__">自定义问题…</option>
              </select>
            </div>
            <div class="field" id="auth-secq-custom-wrap" style="display:none;">
              <i class="fa-solid fa-circle-question"></i>
              <input type="text" id="auth-secq-custom" placeholder="输入自定义密保问题" maxlength="40" />
            </div>
            <div class="field">
              <i class="fa-solid fa-key"></i>
              <input type="text" id="auth-seca" placeholder="密保答案" maxlength="40" autocomplete="off" />
            </div>` : ''}
            <div class="field">
              <i class="fa-solid fa-lock"></i>
              <input type="password" id="auth-password" placeholder="密码" autocomplete="${isLogin ? 'current-password' : 'new-password'}" required />
            </div>
            <div class="field" style="display:flex;flex-direction:row;align-items:center;gap:10px;">
              <canvas id="auth-captcha" width="120" height="44" title="点击刷新验证码" style="border-radius:8px;cursor:pointer;flex:none;"></canvas>
              <input type="text" id="auth-captcha-input" placeholder="图形验证码" maxlength="4" autocomplete="off" style="flex:1;" />
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
          ${isLogin ? `<div style="margin-top:6px;"><a href="#" id="auth-forgot-link" style="font-size:0.85rem;opacity:.85;">忘记密码？</a></div>` : ''}
          ${isLogin ? '' : ''}
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
      // M6a-2 图形验证码校验（不区分大小写）+ 演示模式 bypass
      const captchaBypass = localStorage.getItem('dreamcore-demo-bypass') === 'true';
      const captchaInput = overlay.querySelector('#auth-captcha-input');
      if (!captchaBypass && (!captchaInput || captchaInput.value.trim().toUpperCase() !== captchaCode)) {
        errEl.textContent = '图形验证码不正确，请重新输入';
        if (captchaInput) captchaInput.value = '';
        drawCaptcha();
        if (typeof Sound !== 'undefined') Sound.playSound('close');
        if (window.showToast) showToast('图形验证码不正确，已自动刷新', 'error');
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = '处理中...';

      try {
        if (isLogin) {
          await this.handleLogin(username, password);
        } else {
          // M6a-2 收集密保问题与答案
          const secqSel2 = overlay.querySelector('#auth-secq');
          const secqCustom = overlay.querySelector('#auth-secq-custom');
          const secaInput = overlay.querySelector('#auth-seca');
          let secQuestion = '';
          if (secqSel2) {
            secQuestion = secqSel2.value === '__custom__' ? (secqCustom ? secqCustom.value.trim() : '') : secqSel2.value;
          }
          const secAnswer = secaInput ? secaInput.value.trim() : '';
          await this.handleRegister(username, email, password, secQuestion, secAnswer);
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

    // M6a-2 图形验证码：Canvas 绘制 4 位随机码（去除易混淆 0O1I），点击刷新
    const captchaCanvas = overlay.querySelector('#auth-captcha');
    let captchaCode = '';
    const drawCaptcha = () => {
      if (!captchaCanvas) return;
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      captchaCode = '';
      for (let i = 0; i < 4; i++) captchaCode += chars.charAt(Math.floor(Math.random() * chars.length));
      const c2d = captchaCanvas.getContext('2d');
      c2d.fillStyle = '#f0eaff';
      c2d.fillRect(0, 0, 120, 44);
      for (let i = 0; i < 4; i++) {
        c2d.strokeStyle = 'rgba(124,58,237,' + (0.2 + Math.random() * 0.25).toFixed(2) + ')';
        c2d.beginPath();
        c2d.moveTo(Math.random() * 120, Math.random() * 44);
        c2d.lineTo(Math.random() * 120, Math.random() * 44);
        c2d.stroke();
      }
      const capColors = ['#7c3aed', '#c026d3', '#2563eb', '#059669'];
      for (let i = 0; i < 4; i++) {
        c2d.save();
        c2d.font = (19 + Math.floor(Math.random() * 6)) + 'px bold sans-serif';
        c2d.fillStyle = capColors[i];
        c2d.translate(17 + i * 29, 30 + (Math.random() * 6 - 3));
        c2d.rotate((Math.random() - 0.5) * 0.45);
        c2d.fillText(captchaCode.charAt(i), 0, 0);
        c2d.restore();
      }
    };
    drawCaptcha();
    if (captchaCanvas) captchaCanvas.addEventListener('click', drawCaptcha);
    // M6a-2 自定义密保问题切换
    const secqSel = overlay.querySelector('#auth-secq');
    const secqCustomWrap = overlay.querySelector('#auth-secq-custom-wrap');
    if (secqSel && secqCustomWrap) {
      secqSel.addEventListener('change', () => {
        secqCustomWrap.style.display = secqSel.value === '__custom__' ? '' : 'none';
      });
    }
    // M6a-2 忘记密码入口
    const forgotLink = overlay.querySelector('#auth-forgot-link');
    if (forgotLink) forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      this._showForgotPanel();
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
  // M6a-2 忘记密码面板：用户名 → 密保问题 → 答案验证 → 重置密码
  // 走云函数 /api/auth（auth-reset.mjs，需 SUPABASE_SERVICE_ROLE_KEY）
  // ----------------------------------------------------------
  _showForgotPanel() {
    if (this.modalEl) { this.modalEl.remove(); this.modalEl = null; }
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay auth-modal';
    overlay.id = 'auth-modal';
    overlay.innerHTML = `
      <div class="modal-box auth-box glass">
        <button class="modal-close" data-close aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
        <div class="auth-body" style="margin:0 auto;">
          <h2 class="auth-title">找回密码</h2>
          <p class="auth-sub">通过注册时设置的密保问题重置密码</p>
          <form id="forgot-form" class="auth-form" novalidate>
            <div class="field">
              <i class="fa-regular fa-user"></i>
              <input type="text" id="fg-username" placeholder="用户名" autocomplete="username" required />
            </div>
            <button type="button" class="btn-ghost btn-block" id="fg-fetch-q" style="margin-bottom:12px;">获取密保问题</button>
            <div class="field" id="fg-question-wrap" style="display:none;">
              <i class="fa-solid fa-shield-halved"></i>
              <input type="text" id="fg-question" readonly />
            </div>
            <div class="field" id="fg-answer-wrap" style="display:none;">
              <i class="fa-solid fa-key"></i>
              <input type="text" id="fg-answer" placeholder="密保答案" maxlength="40" autocomplete="off" />
            </div>
            <div class="field" id="fg-newpwd-wrap" style="display:none;">
              <i class="fa-solid fa-lock"></i>
              <input type="password" id="fg-newpwd" placeholder="新密码（至少6位）" autocomplete="new-password" />
            </div>
            <div class="auth-error" id="fg-error"></div>
            <button type="submit" class="btn-primary btn-block" id="fg-submit" style="display:none;">重置密码</button>
          </form>
          <div class="auth-switch">想起来了？<a href="#" data-switch="login">去登录</a></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    this.modalEl = overlay;
    if (window.ModalScrollLock) ModalScrollLock.lock();
    requestAnimationFrame(() => overlay.classList.add('open'));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('[data-close]')) this._closeModal();
    });
    overlay.querySelectorAll('[data-switch]').forEach(a => a.addEventListener('click', (e) => {
      e.preventDefault();
      this.showAuthModal(a.dataset.switch);
    }));
    const errEl = overlay.querySelector('#fg-error');
    let fetched = false;
    overlay.querySelector('#fg-fetch-q').addEventListener('click', async () => {
      const username = overlay.querySelector('#fg-username').value.trim();
      errEl.textContent = '';
      if (!username) { errEl.textContent = '请输入用户名'; return; }
      const fetchBtn = overlay.querySelector('#fg-fetch-q');
      fetchBtn.disabled = true; fetchBtn.textContent = '查询中...';
      try {
        const res = await fetch('/api/auth?action=question&username=' + encodeURIComponent(username));
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || '获取密保问题失败');
        overlay.querySelector('#fg-question').value = data.question || '（未获取到密保问题）';
        ['#fg-question-wrap', '#fg-answer-wrap', '#fg-newpwd-wrap', '#fg-submit'].forEach(s => { overlay.querySelector(s).style.display = ''; });
        fetched = true;
      } catch (err) {
        errEl.textContent = err.message;
      } finally {
        fetchBtn.disabled = false; fetchBtn.textContent = '获取密保问题';
      }
    });
    overlay.querySelector('#forgot-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!fetched) { errEl.textContent = '请先获取密保问题'; return; }
      const username = overlay.querySelector('#fg-username').value.trim();
      const answer = overlay.querySelector('#fg-answer').value.trim();
      const newPwd = overlay.querySelector('#fg-newpwd').value;
      errEl.textContent = '';
      if (!answer) { errEl.textContent = '请输入密保答案'; return; }
      if (!newPwd || newPwd.length < 6) { errEl.textContent = '新密码至少 6 位'; return; }
      const btn = overlay.querySelector('#fg-submit');
      btn.disabled = true; btn.textContent = '重置中...';
      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, answer, newPassword: newPwd })
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || '重置失败');
        if (typeof Sound !== 'undefined') Sound.playSound('success');
        this._toast('密码重置成功，请使用新密码登录', 'success');
        this.showAuthModal('login');
      } catch (err) {
        errEl.textContent = err.message;
        btn.disabled = false; btn.textContent = '重置密码';
      }
    });
  },

  // ----------------------------------------------------------
  // 处理注册
  // ----------------------------------------------------------
  async handleRegister(username, email, password, secQuestion = '', secAnswer = '') {
    if (!username || username.length < 2) throw new Error('用户名至少 2 个字符');
    if (!password || password.length < 6) throw new Error('密码至少 6 位');
    // M6a-2 密保问题必填（用于找回密码）
    if (!secQuestion || secQuestion.length < 4) throw new Error('请选择或输入密保问题（至少 4 个字）');
    if (!secAnswer || secAnswer.length < 2) throw new Error('请输入密保答案（至少 2 个字）');
    if (!supabaseEnabled) throw new Error('云端认证未配置（检查 .env 的 VITE_SUPABASE_*）');
    // M4 系统设置：注册开关（管理后台可配置）
    if (window.getSiteSetting) {
      let _allowReg = true;
      try { _allowReg = await getSiteSetting('allow_registration', true); } catch (_) {}
      if (_allowReg === false) throw new Error('平台已关闭新用户注册，请联系管理员');
    }
    if (window.Sentry) Sentry.addBreadcrumb({ category: 'auth', message: 'User registration attempt', data: { username } });

    const { data, error } = await supabase.auth.signUp({
      email: _authEmailFor(username),
      password,
      options: { data: { username, email: email || '', avatar: '', bio: '', secQuestion, secAnswerHash: await _hashSecAnswer(username, secAnswer) } }
    });
    if (error) throw new Error(_mapAuthError(error));

    // 邮箱确认已关闭：signUp 直接返回 session，注册即登录
    if (data.session) {
      currentUser = await _cloudProfileToUser();
      window.currentUser = currentUser;
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
      await _ensureLocalUser();
      this.updateNavForUser();
      if (typeof AI !== 'undefined') AI.onUserLogin(currentUser);
      this._toast(`欢迎加入，${currentUser.username}！`, 'success');
      if (typeof Sound !== 'undefined') Sound.playSound('success');
      return currentUser;
    }
    // 防御分支：若将来重新开启邮箱确认，session 为空时不自动登录
    this._toast('注册成功，请使用用户名登录', 'success');
    return null;
  },

  // ----------------------------------------------------------
  // 处理登录
  // ----------------------------------------------------------
  async handleLogin(username, password) {
    if (!username || !password) throw new Error('请输入用户名和密码');
    if (!supabaseEnabled) throw new Error('云端认证未配置（检查 .env 的 VITE_SUPABASE_*）');
    if (window.Sentry) Sentry.addBreadcrumb({ category: 'auth', message: 'User login attempt', data: { username } });

    const { error } = await supabase.auth.signInWithPassword({
      email: _authEmailFor(username),
      password
    });
    if (error) throw new Error(_mapAuthError(error));

    const user = await _cloudProfileToUser();
    currentUser = user;
    window.currentUser = currentUser;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    await _ensureLocalUser();
    this.updateNavForUser();
    if (typeof AI !== 'undefined') AI.onUserLogin(currentUser);
    this._toast(`欢迎回来，${currentUser.username}！`, 'success');
    if (typeof Sound !== 'undefined') Sound.playSound('success');
    return currentUser;
  },

  // ----------------------------------------------------------
  // 登出
  // ----------------------------------------------------------
  async handleLogout() {
    // 云端登出（清除 JWT 会话）
    if (supabaseEnabled) {
      try { await supabase.auth.signOut(); } catch (_) { /* 云端登出失败不阻塞本地清理 */ }
    }
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
        <h2 class="welcome-title">共创之旅已开启</h2>
        <p class="welcome-text">
          欢迎来到 <span class="grad-text">Dreamcore</span> AI+文旅文创艺术共创社区。<br/>
          AI 为你的作品评分定级、智能修图、生成文创衍生品，<br/>
          与万千创作者一起共绘东方美学。
        </p>
        <div class="welcome-tips">
          <div class="tip"><i class="fa-solid fa-palette"></i> 浏览文旅画廊</div>
          <div class="tip"><i class="fa-solid fa-cloud-arrow-up"></i> AI 创作工坊</div>
          <div class="tip"><i class="fa-solid fa-heart"></i> 点赞收藏互动</div>
        </div>
        <button class="btn-primary btn-block" id="welcome-enter">进入社区</button>
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

// 监听 Settings 头像变化 → 刷新导航栏头像
window.addEventListener('dreamcore:avatar-changed', () => {
  console.log('[Auth] dreamcore:avatar-changed → 刷新导航栏');
  Auth.updateNavForUser();
});

// S-04 演示模式 bypass：连按 5 次 Esc 启用/关闭（竞赛演示快速登录）
(function() {
  let escCount = 0;
  let escTimer = null;
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // 如果登录弹窗正开着，Esc 优先关弹窗（走原有逻辑），不触发 bypass
    if (document.querySelector('#auth-overlay[open], #auth-overlay.show')) return;
    escCount++;
    clearTimeout(escTimer);
    escTimer = setTimeout(() => { escCount = 0; }, 1500);
    if (escCount >= 5) {
      const on = localStorage.getItem('dreamcore-demo-bypass') !== 'true';
      localStorage.setItem('dreamcore-demo-bypass', on ? 'true' : 'false');
      escCount = 0;
      if (window.showToast) {
        showToast(on ? '🔓 演示模式已开启（跳过验证码）—— 打开登录弹窗直接登' : '🔒 演示模式已关闭', 'info');
      } else {
        console.log('[Auth] 演示模式 bypass =', on);
      }
    }
  });
})();

// ES Module export
export default Auth;
export { Auth, currentUser };
