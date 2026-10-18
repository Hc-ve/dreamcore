/**
 * Dreamcore Settings 模块
 * 负责：Drawer 快捷面板 + 全屏设置页 + 所有子设置的统一存储与实时生效
 * 子设置（≥6 个）：
 *   1. 个人资料（头像系统 + 昵称 + 邮箱）
 *   2. 外观（主题 + 字体大小 + 亮度 + 音效）
 *   3. 通用（渲染质量 + 默认导出格式）
 *   4. 通知（应用内通知开关）
 *   5. 隐私与安全（AI 训练同意 + 清除缓存）
 *   6. 关于（版本信息 + 反馈）
 *
 * 存储：全部走 localStorage（user 级别，无需 DB）
 * 事件：设置变更时 dispatch 'dreamcore:setting-changed' detail:{key, value}
 */
import { supabase, supabaseEnabled } from './api/supabase-client.js';

const LS_PREFIX = 'dreamcore-';
const LS_KEYS = {
  // 注意：theme 使用 'pref-theme' 而非 'theme'。
  // 历史遗留 key 'dreamcore-theme' 同时被 index.html 的 HEAD 防闪烁脚本与
  // particles.js 以「裸字符串」形式读写（非 JSON）。若此处仍用 'theme'，
  // 拼接后键名与遗留 key 完全相同，setSetting 的 JSON.stringify 会写入带引号的
  // `"dark"`，污染遗留 key 的读取结果，导致 data-theme 属性变成 6 字符的 `"dark"`
  // 而无法命中 CSS [data-theme="dark"] 选择器 —— 即深色主题失效且刷新后丢失。
  // 改用唯一 key 后，两套存储互不干扰（见 migrateLegacyThemeKey）。
  theme: 'pref-theme',         // 'light' | 'dark' | 'auto'
  particleTheme: 'particle-theme', // 'default' | 'guofeng' | 'feiyi' | 'minimal'（与 particles.js / index.html HEAD 脚本统一）
  sound: 'soundEnabled',       // boolean
  fontSize: 'fontSize',        // 'sm' | 'md' | 'lg'
  brightness: 'brightness',    // 0.7 - 1.2 (CSS filter 倍率)
  renderQuality: 'renderQuality', // 'high' | 'medium' | 'low'
  defaultExport: 'defaultExport', // 'glb' | 'fbx' | 'obj' | 'usdz'
  notifyInApp: 'notifyInApp',   // boolean
  notifyEmail: 'notifyEmail',   // boolean
  aiTraining: 'aiTraining',     // boolean 用户资产是否允许 AI 训练
  avatar: 'avatar',             // {type:'system'|'custom', id:number, dataURL:string}
  nickname: 'nickname',
};

// 遗留主题 key（index.html 防闪烁脚本 / particles.js 使用的裸字符串键）
const LS_LEGACY_THEME_KEY = 'dreamcore-theme';

/**
 * 迁移与同步遗留主题 key。
 * 目标：设置模块用独立 key（dreamcore-pref-theme）持久化，
 *       同时把去引号后的裸值回写到遗留 key，保证 index.html 的防闪烁脚本
 *       与 particles.js 能正确读取用户偏好。
 */
function _syncLegacyThemeKey(value) {
  try {
    const clean = String(value).replace(/^"|"$/g, '');
    if (clean === 'light' || clean === 'dark' || clean === 'auto') {
      localStorage.setItem(LS_LEGACY_THEME_KEY, clean);
    }
  } catch (_) { /* ignore */ }
}

/**
 * 首次启动迁移：若新 key 不存在但遗留 key 有值，则继承之。
 * 这保证老用户升级后不会丢失既有主题偏好。
 */
function _migrateLegacyThemeKey() {
  try {
    if (localStorage.getItem(LS_PREFIX + LS_KEYS.theme) !== null) return;
    const legacy = localStorage.getItem(LS_LEGACY_THEME_KEY);
    if (legacy === null) return;
    const clean = String(legacy).replace(/^"|"$/g, '');
    if (clean === 'light' || clean === 'dark' || clean === 'auto') {
      localStorage.setItem(LS_PREFIX + LS_KEYS.theme, JSON.stringify(clean));
    }
  } catch (_) { /* ignore */ }
}

/**
 * 首次启动迁移风格主题键（R2：老键 dreamcore-particleTheme 或用户侧可能带引号的脏数据 → 新键 dreamcore-particle-theme 裸值）
 */
function _migrateLegacyParticleThemeKey() {
  try {
    const newKey = LS_PREFIX + LS_KEYS.particleTheme;            // dreamcore-particle-theme
    if (localStorage.getItem(newKey) !== null) return;
    const legacy = localStorage.getItem(LS_PREFIX + 'particleTheme'); // 老键 dreamcore-particleTheme
    if (legacy === null) return;
    const clean = String(legacy).replace(/^"|"$/g, '');
    if (['default', 'guofeng', 'feiyi', 'minimal'].includes(clean)) {
      localStorage.setItem(newKey, clean);                        // 裸值写入
    }
  } catch (_) { /* ignore */ }
}

/**
 * 头像脏数据迁移（V2）：
 *   老版本 Canvas 裁剪绕过、CSS width:100% 导致 img 撑不出、或用户绕过保存直接塞了非正方形 dataURL
 *   → 统一重新中心裁剪到 200x200 覆盖 localStorage。
 *   已迁过的用户跳过（标记 dreamcore-avatar-migrated-v3）。
 */
async function _migrateLegacyAvatar() {
  const MARK = 'dreamcore-avatar-migrated-v3';
  try {
    if (localStorage.getItem(MARK)) return; // 迁过就不再跑
    const raw = localStorage.getItem(LS_PREFIX + LS_KEYS.avatar);
    if (!raw) { localStorage.setItem(MARK, '1'); return; }
    let parsed; try { parsed = JSON.parse(raw); } catch { parsed = null; }
    if (!parsed || parsed.type !== 'custom' || !parsed.dataURL) {
      localStorage.setItem(MARK, '1'); return; // 系统头像或无头像，不用迁
    }

    const fixed = await _ensureSquareAvatar(parsed.dataURL);
    // _ensureSquareAvatar 对已经是 200x200 的不会重绘，fixed 就是原图 dataURL
    if (fixed !== parsed.dataURL) {
      // 尺寸被修正了，覆盖写回 localStorage + 同步后端
      localStorage.setItem(LS_PREFIX + LS_KEYS.avatar, JSON.stringify({ type: 'custom', dataURL: fixed }));
      console.log('[Settings] 头像迁移：脏数据已重新裁剪为 200x200');
      try { await _syncProfileToBackend({ avatar: { type: 'custom', dataURL: fixed } }); } catch (_) {}
    }
    localStorage.setItem(MARK, '1');
  } catch (e) {
    console.warn('[Settings] _migrateLegacyAvatar 异常（不阻塞启动）:', e.message);
  }
}

/**
 * 同步风格主题到 <html data-style>（R3 兜底：不依赖 Particles 是否就绪）
 * default 移除 data-style（回到 :root 令牌组），其余主题挂对应属性。
 */
function _syncStyleAttr(value) {
  try {
    const clean = String(value).replace(/^"|"$/g, '');
    if (clean && clean !== 'default') document.documentElement.setAttribute('data-style', clean);
    else document.documentElement.removeAttribute('data-style');
  } catch (_) { /* ignore */ }
}

// 系统自带头像（内嵌 SVG，5 款 Q 版，国风/文创设计）
// 注意：必须先声明 SVG 函数（下面定义），这里存调用结果（字符串）
const SYSTEM_AVATARS = [];

// 系统默认值
const DEFAULTS = {
  theme: 'auto',
  particleTheme: 'default',
  sound: true,
  fontSize: 'md',
  brightness: 1.0,
  renderQuality: 'high',
  defaultExport: 'glb',
  notifyInApp: true,
  notifyEmail: false,
  aiTraining: false,
  avatar: { type: 'system', id: 1 },
  nickname: '',
};

// 风格主题元数据（与 particles.js PARTICLE_THEMES 同步）
const PARTICLE_THEME_OPTIONS = [
  { key: 'default', label: '墨韵',  icon: 'fa-circle',    desc: '墨韵丹青 · 东方美学' },
  { key: 'guofeng', label: '国风',  icon: 'fa-feather',   desc: '青绿山水 · 东方美学' },
  { key: 'feiyi',   label: '非遗',  icon: 'fa-scroll',    desc: '朱红描金 · 传统工艺' },
  { key: 'minimal', label: '极简',  icon: 'fa-diamond',   desc: '黑白灰 · 现代简约' },
];

// ============================================================
// 存储层
// ============================================================

function getSetting(key) {
  // 统一单一 key 存储：值写 JSON.parse/stringify 处理，避免旧版双写带来的引号污染
  const lsKey = LS_PREFIX + LS_KEYS[key];
  const stored = localStorage.getItem(lsKey);
  if (stored === null) return DEFAULTS[key];
  let v;
  try { v = JSON.parse(stored); } catch { v = stored; }
  // 防御：旧版 theme/particleTheme/sound 可能有带引号的脏数据
  if (typeof v === 'string') v = v.replace(/^"|"$/g, '');
  return v;
}

function setSetting(key, value) {
  const lsKey = LS_PREFIX + LS_KEYS[key];
  // particle-theme 与 particles.js / HEAD 脚本共用，必须写「无引号裸值」避免 JSON.stringify 污染
  localStorage.setItem(lsKey, key === 'particleTheme' ? String(value) : JSON.stringify(value));
  // theme 是 index.html 防闪烁脚本 / particles.js 共用的遗留裸键，
  // 必须额外以「无引号裸值」形式同步，否则 HEAD 脚本读取到 `"dark"` 会判定失败。
  if (key === 'theme') _syncLegacyThemeKey(value);
  if (key === 'particleTheme') {
    _syncStyleAttr(value);                     // ★ 先无条件落地 data-style（R3 兜底：不依赖 Particles 是否就绪）
    try {
      if (window.Particles?.setTheme) window.Particles.setTheme(value);
    } catch (e) { console.warn('[Settings] Particles.setTheme 调用失败:', e.message); }
  }
  const ev = new CustomEvent('dreamcore:setting-changed', { detail: { key, value } });
  window.dispatchEvent(ev);
  if (key === 'avatar') {
    window.dispatchEvent(new CustomEvent('dreamcore:avatar-changed', { detail: value }));
  }
  if (window.DEBUG_SETTINGS) console.log('[Settings] setSetting', key, '=', value);
  return value;
}

/**
 * 把本地变更同步到后端（db.js IndexedDB + Supabase）
 * 注意：头像 dataURL 体积大，只同步 IndexedDB；Supabase 存不了大 blob。
 *       昵称/bio 纯文本，两边都同步。
 */
async function _syncProfileToBackend(data) {
  try {
    const user = (typeof window.currentUser !== 'undefined' && window.currentUser) ||
                 (window.Auth && window.Auth.getCurrentUser && window.Auth.getCurrentUser()) || null;
    if (!user?.id) { console.warn('[Settings] _syncProfileToBackend: 未登录，跳过'); return; }

    // 1. 同步到 IndexedDB（db.js updateUser 全局函数）
    try {
      const { updateUser } = window;
      if (typeof updateUser === 'function') {
        // avatar 字段直接存 dataURL（IndexedDB 支持大字符串）
        const dbPayload = {};
        if (data.avatar) dbPayload.avatar = data.avatar;        // {type, dataURL} 完整对象
        if (data.nickname !== undefined) dbPayload.nickname = data.nickname;
        if (data.bio !== undefined) dbPayload.bio = data.bio;
        if (data.tags !== undefined) dbPayload.tags = data.tags;
        await updateUser(user.id, dbPayload);
        console.log('[Settings] → db.users 已同步:', Object.keys(dbPayload).join(', '));
      }
    } catch (e) {
      console.warn('[Settings] db.users 同步失败（不阻塞本地保存）:', e.message);
    }

    // 2. Supabase：只同步昵称/bio（头像 dataURL 太大，auth.metadata 有大小限制）
    if (supabaseEnabled && (data.nickname !== undefined || data.bio !== undefined)) {
      try {
        const { data: userData, error } = await supabase.auth.updateUser({
          data: {
            nickname: data.nickname ?? undefined,
            bio: data.bio ?? undefined,
          }
        });
        if (error) console.warn('[Settings] Supabase metadata 同步失败:', error.message);
        else console.log('[Settings] → Supabase auth metadata 已同步');
      } catch (e) {
        console.warn('[Settings] Supabase 同步异常:', e.message);
      }
    }
  } catch (e) {
    console.error('[Settings] _syncProfileToBackend 崩溃:', e);
  }
}

/**
 * 强制校验头像 dataURL 是否为正方形 —— 如果不是就重新裁剪
 * 防绕过：无论哪个路径写进来的头像（Canvas 裁剪 / 可能的其他路径），都保证最终是正方形
 */
function _ensureSquareAvatar(dataURL) {
  return new Promise((resolve) => {
    if (!dataURL) { resolve(dataURL); return; }
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth === img.naturalHeight && img.naturalWidth === 200) {
        resolve(dataURL); // 已经是 200x200，直接返回
        return;
      }
      // 重新中心裁剪到 200x200
      const c = document.createElement('canvas');
      c.width = 200; c.height = 200;
      const ctx = c.getContext('2d');
      const size = Math.min(img.naturalWidth, img.naturalHeight);
      const sx = (img.naturalWidth - size) / 2;
      const sy = (img.naturalHeight - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataURL);
    img.src = dataURL;
  });
}

// ============================================================
// 实时生效层（订阅 setting-changed → 应用到 DOM）
// ============================================================

function applyTheme() {
  const theme = getSetting('theme');
  let resolved = theme;
  if (theme === 'auto') {
    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', resolved);
}

function applyFontSize() {
  const size = getSetting('fontSize');
  document.documentElement.setAttribute('data-font-size', size);
  // html root font-size 变化 → rem 单位元素自动全局缩放
  const base = { sm: 14, md: 16, lg: 18 };
  document.documentElement.style.fontSize = base[size] + 'px';
}

function applyBrightness() {
  const b = getSetting('brightness');
  // 用 filter: brightness() 替换 overlay —— 同时支持变暗（b<1.0）和变亮（b>1.0）
  // overlay 方案 rgba(255,255,255,1-b) 在 b>1.0 时 alpha 变负 = 透明 = 无效果
  document.documentElement.style.setProperty('--screen-brightness', b);
  document.body.style.filter = b === 1.0 ? '' : `brightness(${b})`;
  // 清理旧 overlay（如果存在）
  const old = document.getElementById('__brightness_overlay');
  if (old) old.remove();
}

function initRealtimeApply() {
  try {
    applyTheme();
    applyFontSize();
    applyBrightness();
    _syncStyleAttr(getSetting('particleTheme'));   // ★ 冷启动即对齐 data-style（R3 兜底）
    console.log('[Settings] applyTheme →', document.documentElement.getAttribute('data-theme'));
    console.log('[Settings] applyBrightness overlay:', !!document.getElementById('__brightness_overlay'));
    console.log('[Settings] applyStyle →', document.documentElement.getAttribute('data-style'));

    window.addEventListener('dreamcore:setting-changed', (e) => {
      const { key } = e.detail;
      console.log('[Settings] dreamcore:setting-changed →', key, '=', e.detail.value);
      switch (key) {
        case 'theme': applyTheme(); break;
        case 'particleTheme': _syncStyleAttr(e.detail.value); break; // ★ 风格主题变化也同步
        case 'fontSize': applyFontSize(); break;
        case 'brightness': applyBrightness(); break;
        case 'sound':
          if (window.Sound) Sound.setEnabled(getSetting('sound'));
          break;
        case 'notifyInApp':
          if (window.Notifications?.refreshBadge) Notifications.refreshBadge();
          break;
      }
    });

    // 跟随系统主题变化（当用户选 auto 时）
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (getSetting('theme') === 'auto') applyTheme();
    });
  } catch (e) {
    console.error('[Settings] initRealtimeApply 崩溃:', e);
  }
}

// ============================================================
// Drawer 快捷面板
// ============================================================

let drawerEl = null;
let drawerOverlay = null;

function openDrawer() {
  if (!drawerEl) buildDrawer();
  refreshDrawer();
  drawerOverlay.classList.add('show');
  drawerEl.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeDrawer() {
  drawerOverlay?.classList.remove('show');
  drawerEl?.classList.remove('show');
  document.body.style.overflow = '';
}

function buildDrawer() {
  drawerOverlay = document.createElement('div');
  drawerOverlay.className = 'sc-overlay';
  drawerOverlay.addEventListener('click', closeDrawer);

  drawerEl = document.createElement('aside');
  drawerEl.className = 'sc-drawer';
  drawerEl.setAttribute('role', 'dialog');
  drawerEl.setAttribute('aria-label', '快捷设置');

  drawerEl.innerHTML = `
    <div class="sc-drawer-head">
      <h3>快捷设置</h3>
      <button class="sc-close" aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
    </div>
    <div class="sc-drawer-body">
      <!-- 外观 Section -->
      <div class="sc-section">
        <div class="sc-section-title"><i class="fa-solid fa-palette"></i> 外观</div>
        <div class="sc-item">
          <div class="sc-item-label">界面明暗</div>
          <div class="sc-seg" data-setting="theme">
            <button data-val="light"><i class="fa-solid fa-sun"></i> 浅</button>
            <button data-val="dark"><i class="fa-solid fa-moon"></i> 深</button>
            <button data-val="auto"><i class="fa-solid fa-desktop"></i> 跟随</button>
          </div>
        </div>
        <div class="sc-item">
          <div class="sc-item-label">风格主题</div>
          <div class="sc-seg sc-seg-sm" data-setting="particleTheme">
            <button data-val="default">默认</button>
            <button data-val="guofeng">国风</button>
            <button data-val="feiyi">非遗</button>
            <button data-val="minimal">极简</button>
          </div>
        </div>
        <div class="sc-item">
          <div class="sc-item-label">字体大小</div>
          <div class="sc-seg" data-setting="fontSize">
            <button data-val="sm">A-</button>
            <button data-val="md">A</button>
            <button data-val="lg">A+</button>
          </div>
        </div>
        <div class="sc-item">
          <div class="sc-item-label">亮度</div>
          <div class="sc-slider-row">
            <input type="range" min="0.7" max="1.2" step="0.05" data-slider="brightness" class="sc-slider">
            <span class="sc-slider-val" data-slider-val="brightness">100%</span>
          </div>
        </div>
      </div>
      <!-- 音效 Section -->
      <div class="sc-section">
        <div class="sc-section-title"><i class="fa-solid fa-volume-high"></i> 音效</div>
        <label class="sc-switch">
          <input type="checkbox" data-toggle="sound">
          <span class="sc-switch-track"><span class="sc-switch-thumb"></span></span>
          <span class="sc-switch-label" data-toggle-label="sound">已开启</span>
        </label>
      </div>
      <div class="sc-drawer-foot">
        <button class="sc-btn-primary" id="sc-goto-full"><i class="fa-solid fa-gear"></i> 更多设置</button>
      </div>
    </div>
  `;

  drawerEl.querySelector('.sc-close').addEventListener('click', closeDrawer);
  drawerEl.querySelector('#sc-goto-full').addEventListener('click', () => {
    closeDrawer();
    window.location.hash = '#/settings';
  });

  // 事件委托：segmented / toggle / slider
  drawerEl.addEventListener('click', (e) => {
    const segBtn = e.target.closest('.sc-seg button');
    if (segBtn) {
      const seg = segBtn.parentElement;
      const key = seg.dataset.setting;
      const val = segBtn.dataset.val;
      setSetting(key, val);
      refreshDrawer();
      toastSaved();
      return;
    }
  });
  drawerEl.addEventListener('change', (e) => {
    const togg = e.target.dataset.toggle;
    if (togg) {
      setSetting(togg, e.target.checked);
      refreshDrawer();
      if (togg === 'sound' && window.Sound && e.target.checked) Sound.playSound('click');
      toastSaved();
      return;
    }
    const slider = e.target.dataset.slider;
    if (slider) {
      setSetting(slider, parseFloat(e.target.value));
      refreshDrawer();
      return;
    }
  });

  document.body.appendChild(drawerOverlay);
  document.body.appendChild(drawerEl);
}

function refreshDrawer() {
  if (!drawerEl) return;
  // segmented
  drawerEl.querySelectorAll('.sc-seg').forEach(seg => {
    const cur = String(getSetting(seg.dataset.setting));
    seg.querySelectorAll('button').forEach(b => {
      b.classList.toggle('active', b.dataset.val === cur);
    });
  });
  // toggle
  drawerEl.querySelectorAll('[data-toggle]').forEach(inp => {
    inp.checked = !!getSetting(inp.dataset.toggle);
    const lbl = drawerEl.querySelector(`[data-toggle-label="${inp.dataset.toggle}"]`);
    if (lbl) lbl.textContent = inp.checked ? '已开启' : '已关闭';
  });
  // slider
  drawerEl.querySelectorAll('[data-slider]').forEach(inp => {
    inp.value = getSetting(inp.dataset.slider);
  });
  drawerEl.querySelectorAll('[data-slider-val]').forEach(s => {
    const v = Math.round(getSetting(s.dataset.sliderVal) * 100);
    s.textContent = v + '%';
  });
}

// ============================================================
// 全屏设置页（#/settings 路由渲染）
// ============================================================

const TABS = [
  { id: 'profile',  icon: 'fa-user',          label: '个人资料' },
  { id: 'appearance', icon: 'fa-palette',     label: '外观' },
  { id: 'general',  icon: 'fa-sliders',      label: '通用' },
  { id: 'notify',   icon: 'fa-bell',         label: '通知' },
  { id: 'privacy',  icon: 'fa-shield-halved', label: '隐私与安全' },
  { id: 'about',    icon: 'fa-circle-info',   label: '关于' },
];

function renderFullSettings(container) {
  try {
    const user = (typeof window.currentUser !== 'undefined' && window.currentUser) ||
                 (window.Auth && window.Auth.getCurrentUser && window.Auth.getCurrentUser()) || null;
    const loggedIn = !!user;
    // 未登录时过滤掉"个人资料"入口
    const visibleTabs = loggedIn ? TABS : TABS.filter(t => t.id !== 'profile');
    // 未登录时 URL 里的 ?tab=profile 强制重定向到 appearance（防止手动访问绕过）
    let tab = new URLSearchParams(window.location.hash.split('?')[1] || '').get('tab') || 'profile';
    if (!loggedIn && tab === 'profile') {
      tab = 'appearance';
      history.replaceState(null, '', '#/settings?tab=appearance');
    }
    container.innerHTML = `
      <div class="sp-page">
        <aside class="sp-tabs">
          <div class="sp-tabs-head">
            <button class="sp-back-btn" id="sp-back" title="返回上一页" aria-label="返回">
              <i class="fa-solid fa-arrow-left"></i>
            </button>
            <span>设置</span>
          </div>
          ${visibleTabs.map(t => `
            <button class="sp-tab ${t.id === tab ? 'active' : ''}" data-tab="${t.id}">
              <i class="fa-solid ${t.icon}"></i><span>${t.label}</span>
            </button>
          `).join('')}
        </aside>
        <main class="sp-content" id="sp-content"></main>
      </div>
    `;
    // 返回按钮
    container.querySelector('#sp-back')?.addEventListener('click', () => {
      // 如果有 history 记录先返回，否则回到首页
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.hash = '#/';
      }
    });
    const content = container.querySelector('#sp-content');
    renderTab(content, tab);
    container.querySelectorAll('.sp-tab').forEach(b => {
      b.addEventListener('click', () => {
        container.querySelectorAll('.sp-tab').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        const id = b.dataset.tab;
        history.replaceState(null, '', '#/settings?tab=' + id);
        renderTab(content, id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  } catch (e) {
    console.error('[Settings] renderFullSettings 崩溃:', e);
    container.innerHTML = `<div style="padding:40px;text-align:center;color:#999;">设置页面加载失败，请 <a href="#/" style="color:var(--accent);">返回首页</a></div>`;
  }
}

function renderTab(content, id) {
  try {
    switch (id) {
      case 'profile':
        {
          const _u2 = (typeof window.currentUser !== 'undefined' && window.currentUser) ||
                      (window.Auth && window.Auth.getCurrentUser && window.Auth.getCurrentUser()) || null;
          if (!_u2) {
            content.innerHTML = '';
            const parent = content.parentElement;
            if (parent) { const b = parent.querySelector('.sp-tab[data-tab="appearance"]'); if (b) b.click(); }
            return;
          }
        }
        content.innerHTML = tabProfile();
        initProfileTab(content);
        break;
      case 'appearance':content.innerHTML = tabAppearance();initAppearanceTab(content);break;
      case 'general':   content.innerHTML = tabGeneral();    initGeneralTab(content);   break;
      case 'notify':    content.innerHTML = tabNotify();     initNotifyTab(content);    break;
      case 'privacy':   content.innerHTML = tabPrivacy();   initPrivacyTab(content);   break;
      case 'about':     content.innerHTML = tabAbout();      initAboutTab(content);     break;
      default:          content.innerHTML = '<p>未知页面</p>';
    }
  } catch (e) {
    console.error('[Settings] renderTab 崩溃 (' + id + '):', e);
    content.innerHTML = `<p style="color:#e53e3e;">页面加载出错：${e.message}</p>`;
  }
}

// ---- Tab 内容 ----

function tabProfile() {
    const _u = (typeof window.currentUser !== 'undefined' && window.currentUser) ||
             (window.Auth && window.Auth.getCurrentUser && window.Auth.getCurrentUser()) || null;
  if (!_u) {
    return `<div class="sp-page-title">个人资料</div>
      <div class="sp-auth-locked sp-auth-locked-full">
        <div class="sp-auth-locked-icon"><i class="fa-solid fa-user-lock"></i></div>
        <div class="sp-auth-locked-text">
          <div class="sp-auth-locked-title">需要登录</div>
          <div class="sp-auth-locked-desc">头像、昵称、个人简介、兴趣标签等个人资料编辑功能需要登录后才能使用。请先登录你的账户。</div>
        </div>
        <div class="sp-auth-locked-actions">
          <button class="sp-btn sp-btn-primary" id="sp-goto-login-full">立即登录</button>
          <button class="sp-btn" id="sp-goto-home">回到首页</button>
        </div>
      </div>`;
  }
// 容错：avatar 可能是脏数据
  let cur = getSetting('avatar');
  if (!cur || typeof cur !== 'object' || (cur.type !== 'system' && cur.type !== 'custom')) {
    cur = { type: 'system', id: 1 };
    setSetting('avatar', cur);
  }
  const isCustom = cur.type === 'custom';
  const safeSvg = SYSTEM_AVATARS.find(a => a.id === cur.id)?.svg || SYSTEM_AVATARS[0]?.svg || '';
  return `
    <div class="sp-page-title">个人资料</div>

    <section class="sp-card">
      <h3>头像</h3>
      <p class="sp-hint">系统内置 5 款 Q 版国风头像，也可上传自定义头像。</p>
      <div class="avatar-current">
        ${isCustom && cur.dataURL
          ? `<img src="${cur.dataURL}" class="avatar-preview" alt="自定义头像">`
          : safeSvg}
        <div class="avatar-type-label">${isCustom ? '自定义头像' : '系统头像'}</div>
      </div>

      <div class="avatar-picker">
        ${SYSTEM_AVATARS.map(a => `
          <label class="avatar-option ${!isCustom && cur.id === a.id ? 'selected' : ''}">
            <input type="radio" name="avatar-system" value="${a.id}" ${!isCustom && cur.id === a.id ? 'checked' : ''}>
            ${a.svg}
            <span class="avatar-option-name">${a.name}</span>
          </label>
        `).join('')}
        <label class="avatar-option custom-upload">
          <input type="file" accept="image/png,image/jpeg,image/webp" id="avatar-upload">
          <div class="avatar-upload-box">
            <i class="fa-solid fa-cloud-arrow-up"></i>
            <span>自定义上传</span>
            <small>PNG/JPG ≤ 2MB</small>
          </div>
        </label>
      </div>

      <div id="avatar-crop-wrap" class="avatar-crop-wrap" hidden>
        <h4>裁剪预览</h4>
        <canvas id="avatar-crop-canvas" width="200" height="200"></canvas>
        <div class="avatar-crop-actions">
          <button class="sp-btn" id="avatar-cancel">取消</button>
          <button class="sp-btn sp-btn-primary" id="avatar-confirm">确认使用</button>
        </div>
      </div>
    </section>

    <section class="sp-card">
      <h3>昵称</h3>
      <input class="sp-input" id="sp-nickname" value="${getSetting('nickname') || ''}" placeholder="给自己起个昵称">
    </section>

    <section class="sp-card">
      <h3>个人简介</h3>
      <textarea class="sp-input" id="sp-bio" rows="3" placeholder="一句话介绍你自己…（如：热爱敦煌，想 AI 复刻莫高窟壁画）">${getSetting('bio') || ''}</textarea>
    </section>

    <section class="sp-card">
      <h3>兴趣标签</h3>
      <p class="sp-hint">选择你感兴趣的文化方向，帮助首页推荐更精准。</p>
      <div class="sp-tag-row" id="sp-tags">
        ${['敦煌','故宫','陶瓷','书法','戏曲','非遗','古建筑','民族服饰','传统工艺'].map(t => `
          <label class="sp-tag ${(getSetting('tags')||'').includes(t)?'active':''}">
            <input type="checkbox" data-tag="${t}" ${(getSetting('tags')||'').includes(t)?'checked':''}> ${t}
          </label>
        `).join('')}
      </div>
    </section>

    <section class="sp-card">
      <h3>账号安全</h3>
      ${(() => {
        const user = (typeof window.currentUser !== 'undefined' && window.currentUser) ||
                     (window.Auth && window.Auth.getCurrentUser && window.Auth.getCurrentUser()) || null;
        const hasBackend = !!supabaseEnabled;
        if (!user) {
          // 未登录态：引导卡
          return `
            <div class="sp-auth-locked">
              <div class="sp-auth-locked-icon"><i class="fa-solid fa-lock"></i></div>
              <div class="sp-auth-locked-text">
                <div class="sp-auth-locked-title">请先登录</div>
                <div class="sp-auth-locked-desc">账号安全操作（修改密码、绑定邮箱）需登录后才能使用，以保护你的账户安全。</div>
              </div>
              <button class="sp-btn sp-btn-primary" id="sp-goto-login">去登录</button>
            </div>
          `;
        }
        // 已登录态
        const email = getSetting('email') || user.email || '未绑定';
        const hint = hasBackend
          ? '安全操作已接入 Supabase：修改密码需验证旧密码，绑定/更换邮箱将发送确认邮件到新地址。'
          : '本地开发模式：未检测到 Supabase 配置，安全操作暂时关闭。请在 .env 设置 VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY。';
        const btnDisabled = hasBackend ? '' : 'disabled';
        const btnDisabledTitle = hasBackend ? '' : '本地开发模式下暂不支持，请生产部署对接后端后使用';
        return `
          <p class="sp-hint">${hint}</p>
          <div class="sp-security-row">
            <div class="sp-security-item">
              <div class="sp-security-label">已绑定邮箱</div>
              <div class="sp-security-value">${email}</div>
            </div>
            <button class="sp-btn sp-btn-sm" id="sp-change-email" ${btnDisabled} title="${btnDisabledTitle}">绑定/更换</button>
          </div>
          <div class="sp-security-row">
            <div class="sp-security-item">
              <div class="sp-security-label">登录密码</div>
              <div class="sp-security-value">••••••••</div>
            </div>
            <button class="sp-btn sp-btn-sm" id="sp-change-password" ${btnDisabled} title="${btnDisabledTitle}">修改密码</button>
          </div>
        `;
      })()}
    </section>
  `;
}

function initProfileTab(content) {
    const _loginBtn = content.querySelector('#sp-goto-login, #sp-goto-login-full');
  if (_loginBtn) { _loginBtn.addEventListener('click', () => { if (window.Auth && window.Auth.openLogin) window.Auth.openLogin(); else window.location.hash = '#/login'; }); }
  const _homeBtn = content.querySelector('#sp-goto-home');
  if (_homeBtn) { _homeBtn.addEventListener('click', () => { window.location.hash = '#/'; }); }
  if (!content.querySelector('.avatar-picker')) return;
// 系统头像选择
  content.querySelectorAll('input[name="avatar-system"]').forEach(r => {
    r.addEventListener('change', () => {
      const id = parseInt(r.value);
      setSetting('avatar', { type: 'system', id });
      renderTab(content, 'profile');
      toastSaved();
    });
  });

  // 自定义上传
  const upload = content.querySelector('#avatar-upload');
  const cropWrap = content.querySelector('#avatar-crop-wrap');
  const cropCanvas = content.querySelector('#avatar-crop-canvas');
  let pendingDataURL = null;

  upload?.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { toast('仅支持 PNG / JPG / WebP', 'error'); return; }
    if (f.size > 2 * 1024 * 1024) { toast('图片不能超过 2MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // 居中裁剪成正方形
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        const ctx = cropCanvas.getContext('2d');
        ctx.clearRect(0, 0, 200, 200);
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 200, 200);
        pendingDataURL = cropCanvas.toDataURL('image/png');
        cropWrap.hidden = false;
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(f);
  });

  content.querySelector('#avatar-cancel')?.addEventListener('click', () => {
    cropWrap.hidden = true;
    pendingDataURL = null;
    upload.value = '';
  });
  content.querySelector('#avatar-confirm')?.addEventListener('click', async () => {
    if (pendingDataURL) {
      // 强制校验：无论 Canvas 裁剪是否成功，最终 dataURL 必须是 200x200 正方形
      const guaranteedSquare = await _ensureSquareAvatar(pendingDataURL);
      setSetting('avatar', { type: 'custom', dataURL: guaranteedSquare });
      await _syncProfileToBackend({ avatar: { type: 'custom', dataURL: guaranteedSquare } });
      renderTab(content, 'profile');
      toastSaved();
    }
  });

  // 昵称
  const nick = content.querySelector('#sp-nickname');
  nick?.addEventListener('change', async () => {
    const val = nick.value.trim();
    setSetting('nickname', val);
    await _syncProfileToBackend({ nickname: val });
    toastSaved();
  });

  // Bio — 实时输入 + debounce 保存
  const bio = content.querySelector('#sp-bio');
  let bioTimer = null;
  bio?.addEventListener('input', async () => {
    clearTimeout(bioTimer);
    bioTimer = setTimeout(async () => {
      const val = bio.value.trim();
      setSetting('bio', val);
      await _syncProfileToBackend({ bio: val });
      toast('已自动保存', 'success');
    }, 800);
  });

  // 兴趣标签 — 多选联动保存
  const tagRow = content.querySelector('#sp-tags');
  tagRow?.addEventListener('change', () => {
    const selected = Array.from(tagRow.querySelectorAll('input[type="checkbox"]:checked'))
      .map(cb => cb.dataset.tag);
    setSetting('tags', selected);
    // 切换 active class 视觉反馈
    tagRow.querySelectorAll('label.sp-tag').forEach(label => {
      const cb = label.querySelector('input');
      label.classList.toggle('active', cb?.checked);
    });
  });

  // 账号安全 — 去登录（未登录态）
  content.querySelector('#sp-goto-login')?.addEventListener('click', () => {
    if (window.Auth && typeof Auth.openModal === 'function') {
      Auth.openModal('login');
    } else if (window.Auth && typeof Auth.openAuthModal === 'function') {
      Auth.openAuthModal('login');
    } else {
      toast('登录功能暂未就绪', 'error');
    }
  });

  // 账号安全 — 绑定邮箱（Supabase auth.updateUser → 自动发确认邮件到新地址）
  content.querySelector('#sp-change-email')?.addEventListener('click', async (e) => {
    if (!supabase) { toast('Supabase 未连接，无法操作', 'error'); return; }
    const user = supabase.auth.getUser ? (await supabase.auth.getUser()).data?.user : null;
    if (!user) { toast('未登录，请先登录', 'error'); return; }

    const newEmail = prompt('请输入要绑定/更换的新邮箱：', user.email || '');
    if (!newEmail) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { toast('邮箱格式不正确', 'error'); return; }
    if (newEmail === user.email) { toast('新邮箱与当前相同', 'info'); return; }

    try {
      toast('正在发送确认邮件到新邮箱…', 'info');
      const { data, error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      // Supabase auth.updateUser 会自动向新邮箱发送确认邮件；用户点击后邮箱正式生效
      toast('确认邮件已发送到 ' + newEmail + '，请查收并点击确认', 'success');
    } catch (err) {
      console.error('[Settings] updateUser email 失败:', err);
      toast('邮箱更新失败：' + (err.message || err), 'error');
    }
  });

  // 账号安全 — 修改密码（三步验证：旧密码 → 新密码 → 确认新密码）
  content.querySelector('#sp-change-password')?.addEventListener('click', async () => {
    if (!supabase) { toast('Supabase 未连接，无法操作', 'error'); return; }
    const user = supabase.auth.getUser ? (await supabase.auth.getUser()).data?.user : null;
    if (!user) { toast('未登录，请先登录', 'error'); return; }

    // Step 1: 验证旧密码（通过 signInWithPassword 验证，成功后恢复原 session）
    const oldPassword = prompt('请输入当前密码（用于验证身份）：', '');
    if (oldPassword === null) return;
    if (!oldPassword) { toast('旧密码不能为空', 'error'); return; }

    const emailForVerify = user.email || getSetting('email') ||
      (window.Auth && typeof Auth._authEmailFor === 'function' ? Auth._authEmailFor() : null);
    if (!emailForVerify) { toast('无法获取登录邮箱，请重新登录', 'error'); return; }

    let tempSession = null;
    try {
      // 用旧密码做一次临时登录验证；当前持久化 session（persistSession:true）不会被覆盖
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: emailForVerify, password: oldPassword
      });
      if (signInErr) {
        const msg = String(signInErr.message || '').toLowerCase();
        if (msg.includes('invalid login') || msg.includes('password') || msg.includes('not found')) {
          toast('旧密码不正确', 'error');
        } else {
          toast('验证失败：' + signInErr.message, 'error');
        }
        return;
      }
      tempSession = signInData.session;
    } catch (err) {
      toast('身份验证失败：' + (err.message || err), 'error');
      return;
    }

    // Step 2 & 3: 新密码 + 确认新密码
    const newPassword = prompt('请输入新密码（至少 8 位）：', '');
    if (!newPassword) return;
    if (newPassword.length < 8) { toast('新密码至少 8 位', 'error'); return; }
    const confirmPassword = prompt('请再次输入新密码确认：', '');
    if (confirmPassword === null) return;
    if (newPassword !== confirmPassword) { toast('两次输入的新密码不一致', 'error'); return; }
    if (newPassword === oldPassword) { toast('新密码不能与旧密码相同', 'error'); return; }

    try {
      toast('正在更新密码…', 'info');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast('密码修改成功！即将重新登录…', 'success');

      // 安全收尾：强制重新登录，确保所有本地 session 被刷新
      await supabase.auth.signOut();
      // 清理缓存
      try { localStorage.clear(); } catch {}
      // 触发 Auth 重新初始化
      if (window.Auth && typeof Auth.checkAuthState === 'function') {
        try { await Auth.checkAuthState(); } catch {}
      }
      // 重新打开登录窗
      setTimeout(() => {
        if (window.Auth && typeof Auth.openModal === 'function') Auth.openModal('login');
        else if (window.Auth && typeof Auth.openAuthModal === 'function') Auth.openAuthModal('login');
        location.hash = '#/settings'; // 回到设置页
      }, 800);
    } catch (err) {
      console.error('[Settings] updateUser password 失败:', err);
      toast('密码修改失败：' + (err.message || err), 'error');
      // 恢复之前的 session（如果 signInWithPassword 覆盖了持久化 session）
      if (tempSession) {
        try { await supabase.auth.setSession(tempSession); } catch {}
      }
    }
  });
}

function tabAppearance() {
  const theme = getSetting('theme');
  const pTheme = getSetting('particleTheme');
  const fs = getSetting('fontSize');
  const b = Math.round(getSetting('brightness') * 100);
  const soundOn = getSetting('sound');
  return `
    <div class="sp-page-title">外观</div>

    <!-- ========================================== -->
    <!-- Section 1：界面明暗（浅色/深色/跟随系统） -->
    <!-- ========================================== -->
    <section class="sp-card">
      <h3><i class="fa-regular fa-sun"></i> 界面明暗</h3>
      <p class="sp-hint">切换整体界面的明暗色调。</p>
      <div class="sp-seg sp-seg-theme">
        <button data-set="theme" data-val="light" class="${theme==='light'?'active':''}">
          <i class="fa-solid fa-sun"></i> 浅色
        </button>
        <button data-set="theme" data-val="dark"  class="${theme==='dark'?'active':''}">
          <i class="fa-solid fa-moon"></i> 深色
        </button>
        <button data-set="theme" data-val="auto"  class="${theme==='auto'?'active':''}">
          <i class="fa-solid fa-desktop"></i> 跟随系统
        </button>
      </div>
    </section>

    <!-- ========================================== -->
    <!-- Section 2：风格主题（默认/国风/非遗/极简） -->
    <!-- ========================================== -->
    <section class="sp-card">
      <h3><i class="fa-solid fa-palette"></i> 风格主题</h3>
      <p class="sp-hint">切换粒子背景与全站视觉风格。</p>
      <div class="sp-theme-grid">
        ${PARTICLE_THEME_OPTIONS.map(opt => `
          <button class="sp-theme-card ${pTheme===opt.key?'active':''}" data-set="particleTheme" data-val="${opt.key}">
            <div class="sp-theme-card-preview sp-theme-preview-${opt.key}">
              <i class="fa-solid ${opt.icon}"></i>
            </div>
            <div class="sp-theme-card-info">
              <div class="sp-theme-card-name">${opt.label}</div>
              <div class="sp-theme-card-desc">${opt.desc}</div>
            </div>
            ${pTheme===opt.key ? '<i class="sp-theme-check fa-solid fa-check"></i>' : ''}
          </button>
        `).join('')}
      </div>
    </section>

    <!-- ========================================== -->
    <!-- Section 3：字体大小 + 屏幕亮度 -->
    <!-- ========================================== -->
    <section class="sp-card">
      <h3><i class="fa-solid fa-text-height"></i> 字体大小</h3>
      <div class="sp-seg">
        <button data-set="fontSize" data-val="sm" class="${fs==='sm'?'active':''}">A- 小</button>
        <button data-set="fontSize" data-val="md" class="${fs==='md'?'active':''}">A 正常</button>
        <button data-set="fontSize" data-val="lg" class="${fs==='lg'?'active':''}">A+ 大</button>
      </div>
      <p class="sp-hint">仅影响 Dreamcore 界面文字，不改变系统设置。</p>
    </section>

    <section class="sp-card">
      <h3><i class="fa-solid fa-circle-half-stroke"></i> 屏幕亮度</h3>
      <div class="sp-row">
        <input type="range" min="70" max="120" step="5" value="${b}" id="sp-brightness" class="sp-slider">
        <span id="sp-brightness-val" class="sp-slider-val">${b}%</span>
      </div>
      <p class="sp-hint">仅影响 Dreamcore 网页显示，不改变显示器硬件亮度。</p>
    </section>

    <!-- ========================================== -->
    <!-- Section 4：音效 -->
    <!-- ========================================== -->
    <section class="sp-card">
      <h3><i class="fa-solid fa-volume-high"></i> 音效</h3>
      <label class="sp-switch sp-switch-row">
        <input type="checkbox" id="sp-sound" ${soundOn ? 'checked' : ''}>
        <span class="sp-switch-track"><span class="sp-switch-thumb"></span></span>
        <span class="sp-switch-text">按钮点击、成功提示等轻量音效</span>
      </label>
    </section>
  `;
}

function initAppearanceTab(c) {
  c.querySelectorAll('[data-set]').forEach(btn => {
    btn.addEventListener('click', () => {
      setSetting(btn.dataset.set, btn.dataset.val);
      renderTab(c, 'appearance');
      toastSaved();
    });
  });
  const b = c.querySelector('#sp-brightness');
  const bv = c.querySelector('#sp-brightness-val');
  b?.addEventListener('input', () => {
    bv.textContent = b.value + '%';
    setSetting('brightness', parseInt(b.value) / 100);
  });
  c.querySelector('#sp-sound')?.addEventListener('change', (e) => {
    setSetting('sound', e.target.checked);
    if (window.Sound && e.target.checked) Sound.playSound('click');
    toastSaved();
  });
}

function tabGeneral() {
  const rq = getSetting('renderQuality');
  const de = getSetting('defaultExport');
  return `
    <div class="sp-page-title">通用</div>
    <section class="sp-card">
      <h3>3D 渲染质量</h3>
      <div class="sp-seg">
        <button data-set="renderQuality" data-val="high"   class="${rq==='high'?'active':''}">高 · PBR</button>
        <button data-set="renderQuality" data-val="medium" class="${rq==='medium'?'active':''}">中</button>
        <button data-set="renderQuality" data-val="low"    class="${rq==='low'?'active':''}">低 · 性能</button>
      </div>
      <p class="sp-hint">影响画廊 3D 预览、上传缩略图渲染等场景的默认画质。</p>
    </section>
    <section class="sp-card">
      <h3>默认导出格式</h3>
      <select class="sp-select" id="sp-default-export">
        <option value="glb" ${de==='glb'?'selected':''}>GLB（通用，含贴图，单文件）</option>
        <option value="fbx" ${de==='fbx'?'selected':''}>FBX（Blender / Maya 主流）</option>
        <option value="obj" ${de==='obj'?'selected':''}>OBJ（最通用，无贴图）</option>
        <option value="usdz" ${de==='usdz'?'selected':''}>USDZ（iOS AR 预览）</option>
      </select>
    </section>
  `;
}

function initGeneralTab(c) {
  c.querySelectorAll('[data-set]').forEach(btn => {
    btn.addEventListener('click', () => { setSetting(btn.dataset.set, btn.dataset.val); renderTab(c, 'general'); toastSaved(); });
  });
  c.querySelector('#sp-default-export')?.addEventListener('change', (e) => {
    setSetting('defaultExport', e.target.value); toastSaved();
  });
}

function tabNotify() {
  const ia = getSetting('notifyInApp');
  const em = getSetting('notifyEmail');
  return `
    <div class="sp-page-title">通知</div>
    <section class="sp-card">
      <h3>接收方式</h3>
      <p class="sp-hint">选择在哪些场景下接收 Dreamcore 的通知。</p>
      <label class="sp-switch">
        <input type="checkbox" id="sp-notify-inapp" ${ia?'checked':''}>
        <span class="sp-switch-track"><span class="sp-switch-thumb"></span></span>
        <span>应用内通知（右上角角标 / Toast）</span>
      </label>
      <label class="sp-switch">
        <input type="checkbox" id="sp-notify-email" ${em?'checked':''}>
        <span class="sp-switch-track"><span class="sp-switch-thumb"></span></span>
        <span>邮件通知（每日摘要）</span>
      </label>
    </section>
    <section class="sp-card">
      <h3>通知场景</h3>
      <p class="sp-hint">当以下事件发生时，你会收到通知。</p>
      <label class="sp-switch">
        <input type="checkbox" id="sp-nf-like" checked>
        <span class="sp-switch-track"><span class="sp-switch-thumb"></span></span>
        <span>我的作品收到点赞 / 评论</span>
      </label>
      <label class="sp-switch">
        <input type="checkbox" id="sp-nf-follow" checked>
        <span class="sp-switch-track"><span class="sp-switch-thumb"></span></span>
        <span>有人关注我</span>
      </label>
      <label class="sp-switch">
        <input type="checkbox" id="sp-nf-activity">
        <span class="sp-switch-track"><span class="sp-switch-thumb"></span></span>
        <span>平台活动 / 新功能上线</span>
      </label>
    </section>
  `;
}
function initNotifyTab(c) {
  c.querySelector('#sp-notify-inapp')?.addEventListener('change', e => { setSetting('notifyInApp', e.target.checked); toastSaved(); });
  c.querySelector('#sp-notify-email')?.addEventListener('change', e => { setSetting('notifyEmail', e.target.checked); toastSaved(); });
  // 通知场景开关（暂存到 localStorage 供后续扩展使用）
  ['like','follow','activity'].forEach(scn => {
    const key = 'nf_' + scn;
    const input = c.querySelector('#sp-nf-' + scn);
    if (input) {
      try {
        const v = localStorage.getItem('dreamcore-' + key);
        if (v !== null) input.checked = v === '1';
      } catch {}
      input.addEventListener('change', e => {
        try { localStorage.setItem('dreamcore-' + key, e.target.checked ? '1' : '0'); } catch {}
      });
    }
  });
}

function tabPrivacy() {
  const at = getSetting('aiTraining');
  return `
    <div class="sp-page-title">隐私与安全</div>
    <section class="sp-card">
      <h3>AI 训练同意</h3>
      <label class="sp-switch">
        <input type="checkbox" id="sp-ai-training" ${at?'checked':''}>
        <span class="sp-switch-track"><span class="sp-switch-thumb"></span></span>
        <span>允许平台使用我的上传资产进行 AI 模型训练</span>
      </label>
      <p class="sp-hint off">关闭后，你的上传资产将被标记为"不可训练"，仅用于渲染展示。</p>
    </section>
    <section class="sp-card sp-card-danger">
      <h3>清除缓存</h3>
      <p class="sp-hint">将清除浏览器存储的所有 Dreamcore 本地数据（含登录态、偏好设置、IndexedDB 作品）。不可恢复。</p>
      <button class="sp-btn sp-btn-danger" id="sp-clear-cache"><i class="fa-solid fa-trash-can"></i> 清除全部本地数据</button>
    </section>
  `;
}
function initPrivacyTab(c) {
  c.querySelector('#sp-ai-training')?.addEventListener('change', e => { setSetting('aiTraining', e.target.checked); toastSaved(); });
  c.querySelector('#sp-clear-cache')?.addEventListener('click', async () => {
    if (!confirm('确认清除？这会删除你浏览器里所有 Dreamcore 本地数据，包括登录状态、设置、3D 模型。')) return;
    localStorage.clear();
    try {
      const dbs = await indexedDB.databases();
      for (const db of dbs) { if (db.name) indexedDB.deleteDatabase(db.name); }
    } catch {}
    alert('已清除全部本地数据，页面即将刷新');
    location.reload();
  });
}

function tabAbout() {
  return `
    <div class="sp-page-title">关于</div>
    <section class="sp-card">
      <h3>Dreamcore</h3>
      <p>AI + 文旅文创艺术共创社区。让传统美学数字新生。</p>
      <dl class="sp-meta">
        <dt>版本</dt><dd>v1.1.0 · <a class="sp-link" href="#" id="sp-check-update">检查更新</a></dd>
        <dt>构建时间</dt><dd>${new Date().toLocaleDateString()}</dd>
        <dt>官方邮箱</dt><dd>hello@dreamcore.art</dd>
      </dl>
    </section>
    <section class="sp-card">
      <h3>技术栈</h3>
      <p class="sp-hint">本站基于以下开源技术构建：</p>
      <div class="sp-tag-row">
        ${['Vite 5','Vanilla JS','Tailwind','Font Awesome','Google Fonts','Service Worker','IndexedDB','WebGL / Three.js'].map(t => `<span class="sp-tag">${t}</span>`).join('')}
      </div>
    </section>
    <section class="sp-card">
      <h3>帮助与反馈</h3>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <a class="sp-link" href="/terms.html" target="_blank"><i class="fa-solid fa-file-lines" style="margin-right:6px;"></i>服务条款</a>
        <a class="sp-link" href="/privacy.html" target="_blank"><i class="fa-solid fa-shield-halved" style="margin-right:6px;"></i>隐私政策</a>
        <a class="sp-link" href="#" id="sp-feedback"><i class="fa-solid fa-comment-dots" style="margin-right:6px;"></i>提交反馈</a>
      </div>
    </section>
  `;
}
function initAboutTab(c) {
  // tabAbout 渲染完成后自动绑定（因为 renderTab 会覆盖 content.innerHTML）
  setTimeout(() => {
    document.querySelector('#sp-check-update')?.addEventListener('click', e => {
      e.preventDefault(); toast('已是最新版本 v1.1.0', 'info');
    });
    document.querySelector('#sp-feedback')?.addEventListener('click', e => {
      e.preventDefault(); toast('反馈功能即将上线', 'info');
    });
  }, 0);
}

// ============================================================
// Toast 小工具
// ============================================================

function toastSaved() { toast('已保存', 'success'); }
function toast(msg, type = 'info') {
  if (window.showToast) { window.showToast(msg, type); return; }
  // 兜底：如果 main.js 还没 init
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `position:fixed;bottom:40px;left:50%;transform:translateX(-50%);background:#222;color:#fff;padding:10px 20px;border-radius:20px;z-index:9999;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,.3);transition:opacity .3s;opacity:0;`;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.style.opacity = '1');
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 2000);
}

// ============================================================
// 导出
// ============================================================

export const Settings = {
  VERSION: '2.0.0',
  async init() {
    try {
      // 先等 Auth 登录态恢复（localStorage 或 Supabase），再渲染 profile tab ——
      // 否则 tabProfile 模板里读 window.currentUser 还是 null，导致未登录态误渲染
      if (window.Auth && typeof window.Auth.checkAuthState === 'function') {
        try { await window.Auth.checkAuthState(); } catch(_) {}
      }
      console.log('[Settings] init v2.0.0 — 加载中...');
      // 主题键迁移：老用户从 legacy key 平滑继承偏好（必须在 applyTheme 之前）
      _migrateLegacyThemeKey();
      _migrateLegacyParticleThemeKey();
      await _migrateLegacyAvatar(); // V2 头像脏数据迁移（有自定义头像的老用户自动修复）
      initRealtimeApply();
      // 齿轮入口（事件委托，防止 HTML 动态替换失效）
      document.addEventListener('click', (e) => {
        if (e.target.closest('#settings-toggle')) { e.preventDefault(); openDrawer(); if (window.Sound) Sound.playSound('click'); }
      });
      // Esc 关闭 Drawer
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
      // 全屏设置页 hash 路由渲染
      window.addEventListener('hashchange', () => this._tryRenderPage());
      this._tryRenderPage();
      console.log('[Settings] init 完成 ✅');
    } catch (e) {
      console.error('[Settings] init 崩溃:', e);
    }
  },
  _tryRenderPage() {
    try {
      let host = document.getElementById('__settings_host');
      const isSettings = /^#\/settings(?:\?.*)?$/.test(window.location.hash);
      if (!isSettings) { if (host) host.hidden = true; return; }
      if (!host) {
        host = document.createElement('div');
        host.id = '__settings_host';
        host.style.cssText = 'position:fixed;inset:72px 0 0 0;z-index:9998;background:var(--bg-dark, #fafafa);color:var(--text-primary, #1a1a2e);overflow-y:auto;';
        document.body.appendChild(host);
      }
      host.hidden = false;
      renderFullSettings(host);
    } catch (e) {
      console.error('[Settings] _tryRenderPage 崩溃:', e);
    }
  },
  // 给 main.js 用
  getSetting, setSetting,
  SYSTEM_AVATARS, // 暴露给 auth.js 读导航栏头像渲染
};
window.Settings = Settings;

// ============================================================
// 5 款 Q 版系统头像（内嵌 SVG，国风 / 文创风）
// ============================================================

function avatarSVG_landscape() {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="avatar-svg">
    <circle cx="50" cy="50" r="48" fill="#e8dcc4"/>
    <circle cx="50" cy="50" r="48" fill="none" stroke="#8b6914" stroke-width="2"/>
    <!-- 远山 -->
    <path d="M10 75 L30 45 L45 65 L60 40 L80 70 L92 55 L92 90 L10 90 Z" fill="#6b7a5a" opacity=".7"/>
    <path d="M10 80 L30 60 L50 72 L70 55 L92 72 L92 90 L10 90 Z" fill="#4a5a3a" opacity=".9"/>
    <!-- 太阳 -->
    <circle cx="65" cy="30" r="10" fill="#e8a838" opacity=".85"/>
    <!-- 小屋 -->
    <rect x="35" y="68" width="14" height="12" fill="#c9a55a"/>
    <path d="M33 68 L42 58 L51 68 Z" fill="#8b5a2b"/>
    <!-- 云 -->
    <ellipse cx="25" cy="28" rx="12" ry="5" fill="#fff" opacity=".7"/>
    <ellipse cx="78" cy="40" rx="8" ry="3" fill="#fff" opacity=".7"/>
  </svg>`;
}

function avatarSVG_porcelain() {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="avatar-svg">
    <circle cx="50" cy="50" r="48" fill="#f0ebe0"/>
    <!-- 瓶身 -->
    <ellipse cx="50" cy="55" rx="22" ry="28" fill="#b0c4de" stroke="#4682b4" stroke-width="1.5"/>
    <path d="M40 28 Q50 22 60 28 L58 36 L42 36 Z" fill="#b0c4de" stroke="#4682b4" stroke-width="1.5"/>
    <!-- 青花纹 -->
    <circle cx="50" cy="55" r="12" fill="none" stroke="#1e3a5f" stroke-width="1.2"/>
    <path d="M44 55 Q50 48 56 55 Q50 62 44 55" fill="none" stroke="#1e3a5f" stroke-width="1"/>
    <path d="M32 48 Q38 46 44 50" fill="none" stroke="#1e3a5f" stroke-width="1"/>
    <path d="M56 50 Q62 46 68 48" fill="none" stroke="#1e3a5f" stroke-width="1"/>
    <path d="M32 62 Q38 64 44 60" fill="none" stroke="#1e3a5f" stroke-width="1"/>
    <path d="M56 60 Q62 64 68 62" fill="none" stroke="#1e3a5f" stroke-width="1"/>
    <!-- 瓶口 -->
    <ellipse cx="50" cy="28" rx="10" ry="3" fill="#4682b4"/>
  </svg>`;
}

function avatarSVG_lion() {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="avatar-svg">
    <circle cx="50" cy="50" r="48" fill="#f5e6d3"/>
    <!-- 狮头 -->
    <circle cx="50" cy="52" r="26" fill="#d4956a"/>
    <!-- 鬃毛 -->
    ${[0,45,90,135,180,225,270,315].map(a=>{
      const r = a * Math.PI / 180;
      const x = 50 + Math.cos(r) * 32, y = 52 + Math.sin(r) * 32;
      return `<ellipse cx="${x}" cy="${y}" rx="8" ry="5" fill="#b87333" transform="rotate(${a+20} ${x} ${y})"/>`;
    }).join('')}
    <!-- 脸 -->
    <circle cx="50" cy="54" r="18" fill="#e8b888"/>
    <!-- 眼睛 -->
    <circle cx="42" cy="50" r="3" fill="#2a2a2a"/>
    <circle cx="58" cy="50" r="3" fill="#2a2a2a"/>
    <circle cx="43" cy="49" r="1" fill="#fff"/>
    <circle cx="59" cy="49" r="1" fill="#fff"/>
    <!-- 鼻子 -->
    <ellipse cx="50" cy="58" rx="3" ry="2" fill="#3a3a3a"/>
    <!-- 嘴 -->
    <path d="M50 60 Q45 64 42 62" fill="none" stroke="#3a3a3a" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M50 60 Q55 64 58 62" fill="none" stroke="#3a3a3a" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
}

function avatarSVG_fish() {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="avatar-svg">
    <circle cx="50" cy="50" r="48" fill="#e0f0e8"/>
    <!-- 水纹 -->
    <path d="M5 30 Q25 25 45 30 T85 30" fill="none" stroke="#7ec4a8" stroke-width="1.5" opacity=".5"/>
    <path d="M5 70 Q25 65 45 70 T85 70" fill="none" stroke="#7ec4a8" stroke-width="1.5" opacity=".5"/>
    <!-- 锦鲤身体 -->
    <ellipse cx="48" cy="50" rx="24" ry="14" fill="#f26a3c"/>
    <!-- 鱼尾 -->
    <path d="M25 50 Q10 38 5 50 Q10 62 25 50" fill="#e55a2c"/>
    <!-- 条纹 -->
    <path d="M38 40 L34 60" stroke="#3a2418" stroke-width="2" stroke-linecap="round"/>
    <path d="M48 38 L44 62" stroke="#3a2418" stroke-width="2" stroke-linecap="round"/>
    <path d="M58 40 L54 60" stroke="#3a2418" stroke-width="2" stroke-linecap="round"/>
    <!-- 眼睛 -->
    <circle cx="62" cy="47" r="3.5" fill="#fff"/>
    <circle cx="62.5" cy="47" r="2" fill="#1a1a1a"/>
    <circle cx="63" cy="46.5" r="0.7" fill="#fff"/>
    <!-- 鱼鳞高光 -->
    <ellipse cx="46" cy="48" rx="6" ry="2" fill="#ffb59a" opacity=".6"/>
  </svg>`;
}

function avatarSVG_calligrapher() {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" class="avatar-svg">
    <circle cx="50" cy="50" r="48" fill="#f5f0e5"/>
    <!-- 宣纸背景 -->
    <rect x="15" y="20" width="70" height="60" fill="#fff9ec" stroke="#8b6914" stroke-width="1" rx="2"/>
    <!-- 墨字：文 -->
    <g font-family="'KaiTi','STKaiti',serif" text-anchor="middle" fill="#1a1a1a">
      <text x="50" y="48" font-size="28" font-weight="bold">文</text>
      <text x="50" y="72" font-size="10" opacity=".6">Dreamcore</text>
    </g>
    <!-- 印章 -->
    <rect x="72" y="70" width="14" height="14" fill="#c0392b" rx="1"/>
    <text x="79" y="81" font-family="'KaiTi',serif" font-size="9" fill="#fff" text-anchor="middle">创</text>
    <!-- 毛笔 -->
    <path d="M12 82 Q16 78 20 72 L24 76 Q18 84 12 86 Z" fill="#5a3a1a"/>
    <path d="M18 86 Q22 82 24 76 L26 78 Q22 88 16 90 Z" fill="#1a1a1a"/>
  </svg>`;
}

// ============================================================
// SYSTEM_AVATARS 初始化（必须在所有 SVG 函数之后）
// ============================================================
SYSTEM_AVATARS.push(
  { id: 1, name: '山水墨客', svg: avatarSVG_landscape() },
  { id: 2, name: '青瓷少女', svg: avatarSVG_porcelain() },
  { id: 3, name: '瑞兽少年', svg: avatarSVG_lion() },
  { id: 4, name: '锦鲤游商', svg: avatarSVG_fish() },
  { id: 5, name: '笔墨学者', svg: avatarSVG_calligrapher() },
);
