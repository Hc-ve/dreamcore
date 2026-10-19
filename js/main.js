// ============================================================
// js/main.js — 主入口总入口
// Vite ES Module 入口文件
// 负责：按需import各模块、GSAP导入、页面初始化流程
// ============================================================

// --- 第三方库 ES Module 导入 ---
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// --- 性能监控 ---
import { onLCP, onCLS, onFCP, onTTFB, onINP } from 'web-vitals';

// 光标能力检测：首次鼠标移动时确认是精确指针设备
(function() {
  const check = (e) => {
    if (e.pointerType === 'mouse' || e.pointerType === undefined) {
      document.documentElement.classList.add('has-fine-pointer');
      window.removeEventListener('pointermove', check);
    }
  };
  window.addEventListener('pointermove', check, { once: false });
})();

// ============================================================
// ============================================================
// Web Vitals 性能监控
// ============================================================
function sendToAnalytics(metric) {
  const report = {
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    id: metric.id,
    url: window.location.href,
    timestamp: Date.now()
  };
  console.log('[Web Vitals]', report.name, report.value, report.rating);
}

onLCP(sendToAnalytics);
onCLS(sendToAnalytics);
onFCP(sendToAnalytics);
onTTFB(sendToAnalytics);
onINP(sendToAnalytics);

// --- 业务模块 ES Module 导入 ---
// 核心数据层
import {
  initDB, getAllArtworks, getArtworkById, addArtwork, deleteArtwork, updateArtwork,
  getUserArtworks, getArtworksByAuthorName, getArtworksByTag,
  getAllUsers, getUserById, getUserByUsername, registerUser, loginUser, updateUser,
  addComment, getComments,
  toggleLike, getLikes, hasUserLiked,
  toggleFavorite, getFavorites, hasUserFavorited, getUserTotalLikes,
  toggleFollow, isFollowing, getFollowersCount, getFollowingCount, getFollowers, getFollowing,
  addNotification, getUserNotifications, markNotificationRead, markAllNotificationsRead, getUnreadNotificationCount,
  saveMemory, getMemories, getMemoriesByType, clearMemories, deleteMemory, getMemoryCount,
  hashPassword, migrateExistingData, seedIfEmpty
} from './db.js';

// 种子数据
import { ARTWORKS_SEED_DATA } from '../data/artworks.js';
// 文化知识库（首页"今日文化画语"）
import { CULTURE_THEMES } from '../data/culture-knowledge.js';
import { CULTURE_BADGES } from '../data/culture-badges.js';
// 文化 SVG 图标库（替换 UI 层 emoji）
import { fromEmoji, iconHtml } from './icons.js';

// 功能模块
import { Auth, currentUser } from './auth.js';
import { Sound } from './sound.js';
import { Particles } from './particles.js';
import { Gallery } from './gallery.js';
import { Artist, openArtistPage } from './artist.js';
import { handleLike, handleFavorite, handleComment, renderComments } from './interactions.js';
import { Publish, showPublishModal } from './publish.js';
import { Search, showSearchBar } from './search.js';
import { Notifications } from './notifications.js';
import { Share } from './share.js';
import { Profile, showProfile } from './profile.js';
import { Admin, showAdminPanel, openFromHash as _openFromHashAdmin } from './admin.js';
import { AI } from './ai-assistant.js';
// M1 AI评分定级模块：确保 window.AIAesthetic 全局可用，并纳入打包
import './ai-aesthetic.js';
// M2 AI修图工作台：导出 window.AIEdit + hashchange 监听
import { openEdit as _openEdit, closeEdit as _closeEdit, openFromHash as _openFromHash } from './ai-edit.js';
// M3 AI文创衍生品：导出 window.AICraft + hashchange 监听
import { openCraft as _openCraft, closeCraft as _closeCraft, openFromHash as _openFromHashCraft } from './ai-craft.js';
// M4 AI智能策展：导出 window.AICurate + hashchange 监听
import { openCurate as _openCurate, closeCurate as _closeCurate, openFromHash as _openFromHashCurate } from './ai-curate.js';
// M5 AI陪练：导出 window.AITutor + hashchange 监听
import { openTutor as _openTutor, closeTutor as _closeTutor, openFromHash as _openFromHashTutor } from './ai-tutor.js';
// M6 合伙人申请：导出 window.AIPartner + hashchange 监听
import { openPartner as _openPartner, closePartner as _closePartner, openFromHash as _openFromHashPartner } from './ai-partner.js';
// M7 数据可视化看板：导出 window.AIDashboard（仅 Admin Tab 内触发，无独立 hash 路由）
import { openDashboard as _openDashboard, closeDashboard as _closeDashboard, renderPanel as _renderDashboardPanel } from './ai-dashboard.js';
import { Router } from './router.js';
import { Settings } from './settings.js';
// M8 排行榜：导出 window.Leaderboard + hashchange 监听
import { closeLeaderboard as _closeLeaderboard, openFromHash as _openFromHashLeaderboard } from './leaderboard.js';
// M9 AI评分独立页（M6a-3）：导出 window.AIScorePage + hashchange 监听
import { openScore as _openScore, closeScore as _closeScore, openFromHash as _openFromHashScore } from './ai-score-page.js';
// 文化功能（v7）：AI 文化识图页，导出 window.CultureScan + hashchange 监听
import { openFromHash as _openFromHashScan, closeScan as _closeScan } from './culture-scan.js';
// 云端 TTS 语音讲解（CosyVoice）：全局委托接管 .tts-btn，仅需引入即生效
import './tts-player.js';
// P0-3 商业模式演示页（#/pricing）：导出 window.PricingPage + hashchange 自注册
import './pricing-page.js';
// P1-4 AI 内容合规声明页（#/ai-disclosure）：导出 window.AIDisclosurePage + hashchange 自注册
import './ai-disclosure-page.js';
// P1-3 数字人讲解员「小梦」：监听 tts-state 事件，随 TTS 讲解出现的三态挂件
import './digital-guide.js';
// P1-2 B端景区运营看板（#/dashboard）：导出 window.DashboardPage + hashchange 自注册
import './dashboard-page.js';
import { CloudMigrate } from './api/migrate-to-cloud.js';

// ============================================================
// 路由兜底修复：同 hash 链接重复点击无响应
// 背景：overlay 类功能页的页内返回/关闭按钮只移除浮层、不清 hash，
// 回到首页后地址栏仍停在 #/xxx；此时再点击指向同一路由的锚点
// （href === location.hash），hash 无变化 → 不触发 hashchange → 无响应。
// 修复：全局点击委托，目标 hash 与当前一致时拦截默认行为并手动派发
// hashchange，让各路由监听器重新执行 openFromHash（幂等，先关再开）。
// ============================================================
(function bindSameHashClickFix() {
  document.addEventListener('click', (e) => {
    const el = e.target instanceof Element ? e.target : null;
    const a = el && el.closest ? el.closest('a[href^="#/"]') : null;
    if (!a) return;
    const href = a.getAttribute('href');
    if (href && href === window.location.hash) {
      e.preventDefault();
      window.dispatchEvent(new Event('hashchange'));
    }
  });
})();

// ============================================================
// M2 AI修图路由监听：hash 变化自动开启/关闭工作台
// ============================================================
(function bindEditRoute() {
  const isEditHash = () => /^#\/edit(?:\?.*)?$/.test(window.location.hash || '');
  const onHash = () => {
    if (isEditHash()) _openFromHash();
    else _closeEdit();
  };
  window.addEventListener('hashchange', onHash);
  // 页面初始化时如果 hash 已经是 edit，自动打开
  if (isEditHash()) setTimeout(() => _openFromHash(), 800);
})();

// ============================================================
// M3 AI文创衍生品路由监听：hash 变化自动开启/关闭工作台
// ============================================================
(function bindCraftRoute() {
  const isCraftHash = () => /^#\/craft(?:\?.*)?$/.test(window.location.hash || '');
  const onHash = () => {
    if (isCraftHash()) _openFromHashCraft();
    else _closeCraft();
  };
  window.addEventListener('hashchange', onHash);
  // 页面初始化时如果 hash 已经是 craft，自动打开
  if (isCraftHash()) setTimeout(() => _openFromHashCraft(), 800);
})();

// ============================================================
// M4 AI智能策展路由监听：hash 变化自动开启/关闭策展页面
// ============================================================
(function bindCurateRoute() {
  const isCurateHash = () => /^#\/curate(?:\?.*)?$/.test(window.location.hash || '');
  const onHash = () => {
    if (isCurateHash()) _openFromHashCurate();
    else _closeCurate();
  };
  window.addEventListener('hashchange', onHash);
  // 页面初始化时如果 hash 已经是 curate，自动打开
  if (isCurateHash()) setTimeout(() => _openFromHashCurate(), 800);
})();

// ============================================================
// M5 AI陪练路由监听：hash 变化自动开启/关闭陪练页面
// ============================================================
(function bindTutorRoute() {
  const isTutorHash = () => /^#\/tutor(?:\?.*)?$/.test(window.location.hash || '');
  const onHash = () => {
    if (isTutorHash()) _openFromHashTutor();
    else _closeTutor();
  };
  window.addEventListener('hashchange', onHash);
  // 页面初始化时如果 hash 已经是 tutor，自动打开
  if (isTutorHash()) setTimeout(() => _openFromHashTutor(), 800);
})();

// ============================================================
// M6 合伙人申请路由监听：hash 变化自动开启/关闭申请页面
// ============================================================
(function bindPartnerRoute() {
  const isPartnerHash = () => /^#\/partner(?:\?.*)?$/.test(window.location.hash || '');
  const onHash = () => {
    if (isPartnerHash()) _openFromHashPartner();
    else _closePartner();
  };
  window.addEventListener('hashchange', onHash);
  // 页面初始化时如果 hash 已经是 partner，自动打开
  if (isPartnerHash()) setTimeout(() => _openFromHashPartner(), 800);
})();

// ============================================================
// M8 排行榜路由监听：hash 变化自动开启/关闭排行榜
// ============================================================
(function bindLeaderboardRoute() {
  const isLbHash = () => /^#\/leaderboard(?:\?.*)?$/.test(window.location.hash || '');
  const onHash = () => {
    if (isLbHash()) _openFromHashLeaderboard();
    else _closeLeaderboard();
  };
  window.addEventListener('hashchange', onHash);
  // 页面初始化时如果 hash 已经是 leaderboard，自动打开
  if (isLbHash()) setTimeout(() => _openFromHashLeaderboard(), 800);
})();

// ============================================================
// M9 AI评分独立页路由监听（M6a-3）：#/score 双 Tab 评分
// ============================================================
(function bindScoreRoute() {
  const isScoreHash = () => /^#\/score(?:\?.*)?$/.test(window.location.hash || '');
    const onHash = () => {
    if (isScoreHash()) _openFromHashScore();
    else _closeScore();
  };
  window.addEventListener('hashchange', onHash);
  if (isScoreHash()) setTimeout(() => _openFromHashScore(), 800);
})();

// 文化功能（v7）：AI 识文化页路由
(function bindScanRoute() {
  const isScanHash = () => /^#\/scan(?:\?.*)?$/.test(window.location.hash || '');
  const onHash = () => {
    if (isScanHash()) _openFromHashScan();
    else _closeScan();
  };
  window.addEventListener('hashchange', onHash);
  if (isScanHash()) setTimeout(() => _openFromHashScan(), 800);
})();

// 文化功能（v7）：文化故事图鉴页 + 文化探索足迹页路由
import { openFromHash as _openFromHashAtlas, closeAtlas as _closeAtlas } from './culture-atlas.js';
import { openFromHash as _openFromHashFootprint, closeFootprint as _closeFootprint } from './culture-footprint.js';
// 文化功能（v8）：景区文化推荐页，导出 window.ScenicRecommend + hashchange 监听
import { openFromHash as _openFromHashScenic, closeScenic as _closeScenic } from './scenic-recommend.js';
(function bindScenicRoute() {
  const isScenicHash = () => /^#\/scenic(?:\?.*)?$/.test(window.location.hash || '');
  const onHash = () => {
    if (isScenicHash()) _openFromHashScenic();
    else _closeScenic();
  };
  window.addEventListener('hashchange', onHash);
  if (isScenicHash()) setTimeout(() => _openFromHashScenic(), 800);
})();
(function bindAtlasRoute() {
  const isAtlasHash = () => /^#\/atlas(?:\?.*)?$/.test(window.location.hash || '');
  const onHash = () => {
    if (isAtlasHash()) _openFromHashAtlas();
    else _closeAtlas();
  };
  window.addEventListener('hashchange', onHash);
  if (isAtlasHash()) setTimeout(() => _openFromHashAtlas(), 800);
})();
(function bindFootprintRoute() {
  const isFpHash = () => /^#\/footprint(?:\?.*)?$/.test(window.location.hash || '');
  const onHash = () => {
    if (isFpHash()) _openFromHashFootprint();
    else _closeFootprint();
  };
  window.addEventListener('hashchange', onHash);
  if (isFpHash()) setTimeout(() => _openFromHashFootprint(), 800);
})();

// P0 修复：管理后台 #/admin / #admin 深链直达
(function bindAdminRoute() {
  const isAdminHash = () => /^#\/?admin(?:\?.*)?$/.test(window.location.hash || '');
  const onHash = () => {
    if (isAdminHash()) _openFromHashAdmin();
  };
  window.addEventListener('hashchange', onHash);
  if (isAdminHash()) setTimeout(() => _openFromHashAdmin(), 800);
})();

// --- 将 GSAP 暴露到全局（向后兼容，部分模块可能通过 window.gsap 访问）---
window.gsap = gsap;
window.ScrollTrigger = ScrollTrigger;

// ============================================================
// 主入口：页面加载流程
// initDB → checkAuthState → loadArtworks → 初始化粒子/音效/AI助手
// ============================================================
document.addEventListener('DOMContentLoaded', async function () {
  // 音效系统最先初始化（绑定全局事件）
  if (window.Sound) Sound.init();

  // 设置模块：Drawer 快捷面板 + 全屏页 + 实时生效（主题/字体/亮度）
  // 注意：Settings.init() 现在是 async —— 内部先 await Auth.checkAuthState()
  // 再渲染 profile tab，保证登录态已恢复。
  await Settings.init();

  // 应用存储的音效偏好
  if (window.Sound) Sound.setEnabled(Settings.getSetting('sound'));

  // 初始化数据库
  try {
    await initDB();
  } catch (e) {
    console.error('数据库初始化失败:', e);
    showToast('数据加载失败，请刷新重试', 'warn');
  }

  // v11：加载自定义 3D 模型 cache（品类切换时优先加载运营上传的自定义 glb，无绑定 fallback 程序化模板）
  // 不 await：仅预热 cache，失败/未就绪时品类切换会走程序化 fallback，不应阻塞首屏
  import('../js/craft-3d.js')
    .then(({ loadCustomModelsCache }) => loadCustomModelsCache())
    .catch(() => { /* 不阻塞启动，cache 失败则全 fallback 程序化 builder */ });

  // M4 应用站点设置（管理后台可配置：站点名称/公告）
  try {
    if (window.getAllSiteSettings) {
      const _settings = await getAllSiteSettings();
      if (window.Admin && typeof Admin.applySiteSettings === 'function') {
        Admin.applySiteSettings(_settings);
      }
    }
  } catch (e) { /* 设置应用失败不阻塞启动 */ }

  // 检查登录状态 & 更新导航
  // 注意：登录态已在 Settings.init() 内 await Auth.checkAuthState() 恢复（见 settings.js init），
  // 此处不再重复请求云端（原重复调用每次额外 2 次 Supabase 往返 ≈1.5s，是首屏变慢的主因之一）
  if (window.Auth) {
    Auth.updateNavForUser();
    Auth.showWelcomeIfFirstVisit();
  }

  // 初始化 3D 粒子背景
  if (window.Particles) Particles.init();

  // 加载画廊作品
  if (window.Gallery) {
    await Gallery.init();
  }

  // 初始化路由系统
  if (window.Router) {
    await Router.init();
  }

  // 初始化搜索系统
  if (window.Search) Search.init();

  // 初始化通知中心
  if (window.Notifications) Notifications.init();

  // 初始化弹窗管理器
  if (window.ModalManager) ModalManager.init();

  // 初始化 AI 助手
  if (window.AI) {
    AI.init();
    // 如果已登录，恢复AI记忆
    const user = Auth.getCurrentUser();
    if (user) AI.onUserLogin(user);
  }

  // 绑定导航与功能按钮
  if (typeof bindNavigation === 'function') bindNavigation();
  if (typeof renderHeroDaily === 'function') renderHeroDaily();
  if (typeof bindCustomCursor === 'function') bindCustomCursor();
  if (typeof initGSAPAnimations === 'function') initGSAPAnimations();

  // 注：AudioContext 解锁已由 sound.js init() 中的首次交互监听处理，
  // 这里不再重复绑定 pointerdown resumeAudio。

  // ============================================================
  // 离线状态提示 & Service Worker 更新检查
  // ============================================================
  const handleOnlineStatus = () => {
    if (!navigator.onLine && window.showToast) {
      showToast('您当前处于离线模式，部分功能可能不可用', 'warn');
    } else if (window.showToast) {
      showToast('网络已恢复', 'success');
    }
  };
  window.addEventListener('online', handleOnlineStatus);
  window.addEventListener('offline', handleOnlineStatus);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (window.showToast) {
        showToast('发现新版本，刷新页面获取更新', 'info');
      }
    });
  }

  if (!navigator.onLine && window.showToast) {
    setTimeout(() => showToast('离线模式：已加载缓存内容', 'info'), 2000);
  }
});

// ------------------------------------------------------------
// 全局弹窗滚动锁（引用计数，支持多弹窗嵌套）
// ------------------------------------------------------------
const ModalScrollLock = {
  _count: 0,
  lock() { this._count++; document.body.style.overflow = 'hidden'; },
  unlock() { this._count = Math.max(0, this._count - 1); if (this._count === 0) document.body.style.overflow = ''; }
};
window.ModalScrollLock = ModalScrollLock;

// ------------------------------------------------------------
// 全局 toast 提示（增强版）
// 类型: success / error / warn / info
// 支持: 顶部滑入动画、自动消失、手动关闭、图标
// ------------------------------------------------------------
// 直接读 localStorage 的轻量守卫（避免 Settings 还没 init 时调用 getSetting）
function _notifyEnabled() {
  try {
    const v = localStorage.getItem('dreamcore-notifyInApp');
    if (v === null) return true; // DEFAULTS.notifyInApp = true
    let p; try { p = JSON.parse(v); } catch { p = v; }
    return p !== false;
  } catch { return true; }
}

const ToastManager = {
  container: null,
  _ensureContainer() {
    if (this.container) return this.container;
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
    return this.container;
  },
  _getIcon(type) {
    const icons = {
      success: 'fa-solid fa-circle-check',
      error: 'fa-solid fa-circle-xmark',
      warn: 'fa-solid fa-triangle-exclamation',
      info: 'fa-solid fa-circle-info'
    };
    return icons[type] || icons.info;
  },
  show(msg, type = 'info', duration = 3000) {
    if (!_notifyEnabled()) return null;
    const container = this._ensureContainer();
    const t = document.createElement('div');
    t.className = `toast toast-${type} glass`;
    t.innerHTML = `
      <span class="toast-icon"><i class="${this._getIcon(type)}"></i></span>
      <span class="toast-message"></span>
      <button class="toast-close" aria-label="关闭"><i class="fa-solid fa-xmark"></i></button>
    `;
    t.querySelector('.toast-message').textContent = msg;
    container.appendChild(t);

    const closeFn = () => {
      t.classList.add('leaving');
      setTimeout(() => t.remove(), 300);
    };

    t.querySelector('.toast-close').addEventListener('click', (e) => {
      e.stopPropagation();
      closeFn();
    });

    if (duration > 0) {
      setTimeout(closeFn, duration);
    }

    return { close: closeFn };
  }
};

function showToast(msg, type = 'info', duration) {
  return ToastManager.show(msg, type, duration);
}
window.showToast = showToast;
window.ToastManager = ToastManager;

// ------------------------------------------------------------
// 全局弹窗焦点管理
// ------------------------------------------------------------
const FocusTrap = {
  _lastFocused: null,
  _trapHandler: null,
  _currentModal: null,

  saveFocus() {
    this._lastFocused = document.activeElement;
  },

  restoreFocus() {
    if (this._lastFocused && this._lastFocused.focus) {
      this._lastFocused.focus();
    }
    this._lastFocused = null;
  },

  trapFocus(modal) {
    if (!modal) return;
    this._currentModal = modal;

    const focusableSelectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(',');

    const focusableElements = modal.querySelectorAll(focusableSelectors);
    const visibleElements = Array.from(focusableElements).filter(el => {
      return el.offsetParent !== null || el.getClientRects().length > 0;
    });

    if (visibleElements.length === 0) return;

    const firstElement = visibleElements[0];
    const lastElement = visibleElements[visibleElements.length - 1];

    setTimeout(() => {
      firstElement.focus();
    }, 100);

    this._trapHandler = (e) => {
      if (e.key !== 'Tab') return;

      const activeEl = document.activeElement;

      if (e.shiftKey) {
        if (activeEl === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (activeEl === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    modal.addEventListener('keydown', this._trapHandler);
  },

  releaseFocus(modal) {
    if (modal && this._trapHandler) {
      modal.removeEventListener('keydown', this._trapHandler);
    }
    this._trapHandler = null;
    this._currentModal = null;
    this.restoreFocus();
  }
};
window.FocusTrap = FocusTrap;

// ------------------------------------------------------------
// 全局弹窗交互增强
// - ESC 键关闭最上层弹窗
// - 点击遮罩层关闭
// - 打开时禁止背景滚动（已在各弹窗中实现，此处统一管理）
// - 焦点陷阱（无障碍）
// ------------------------------------------------------------
const ModalManager = {
  _getOpenModals() {
    const overlays = document.querySelectorAll('.modal-overlay.open');
    return Array.from(overlays).filter(o => {
      const style = getComputedStyle(o);
      return style.visibility !== 'hidden' && style.opacity !== '0';
    });
  },

  _closeTopModal() {
    const modals = this._getOpenModals();
    if (modals.length === 0) return false;

    const topModal = modals[modals.length - 1];
    const modalId = topModal.id;

    if (modalId === 'lightbox-modal' && window.Gallery && typeof Gallery.closeLightbox === 'function') {
      Gallery.closeLightbox();
      return true;
    }
    if (modalId === 'search-modal' && window.Search && typeof Search._close === 'function') {
      Search._close();
      return true;
    }
    if (modalId === 'auth-modal' && window.Auth && typeof Auth._closeModal === 'function') {
      Auth._closeModal();
      return true;
    }
    if (modalId === 'publish-modal' && window.Publish && typeof Publish.closePublishModal === 'function') {
      Publish.closePublishModal();
      return true;
    }
    if (modalId === 'profile-modal' && window.Profile && typeof Profile.closeProfile === 'function') {
      Profile.closeProfile();
      return true;
    }
    if (modalId === 'artist-modal' && window.Artist && typeof Artist.closeArtist === 'function') {
      Artist.closeArtist();
      return true;
    }
    if (modalId === 'admin-modal' && window.Admin && typeof Admin.closeAdminPanel === 'function') {
      Admin.closeAdminPanel();
      return true;
    }

    // 通用关闭方式：移除 open 类 + 解锁滚动 + 延迟移除
    topModal.classList.remove('open');
    if (window.ModalScrollLock) ModalScrollLock.unlock();
    if (typeof Sound !== 'undefined') Sound.playSound('close');
    setTimeout(() => {
      if (topModal && topModal.parentNode) topModal.remove();
    }, 350);
    return true;
  },

  init() {
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;

      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      if (window.Share && Share.currentMenu) {
        Share._closeExistingMenu();
        return;
      }

      if (window.Notifications && Notifications.isOpen) {
        Notifications.closeDropdown();
        return;
      }

      this._closeTopModal();
    });

    document.addEventListener('click', (e) => {
      if (e.target.closest('#lb-share-btn')) return;
      if (window.Share && Share.currentMenu && !e.target.closest('.share-menu') && !e.target.closest('#lb-share-btn')) {
        Share._closeExistingMenu();
      }
    });
  }
};
window.ModalManager = ModalManager;

// ------------------------------------------------------------
// 绑定导航与功能按钮
// ------------------------------------------------------------
// ------------------------------------------------------------
// 今日文化画语（对标云游敦煌"今日画语"开屏）
// 按一年中的第几天确定性轮换 12 个文化主题，每日一条 facts 知识
// ------------------------------------------------------------
function renderHeroDaily() {
  const box = document.getElementById('hero-daily');
  if (!box || !Array.isArray(CULTURE_THEMES) || CULTURE_THEMES.length === 0) return;
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  const t = CULTURE_THEMES[dayOfYear % CULTURE_THEMES.length];
  const badge = CULTURE_BADGES[t.themeId];
  const fact = (t.facts && t.facts[0]) || '';
  box.innerHTML = `
    <a class="hero-daily-card" href="#/atlas?theme=${encodeURIComponent(t.themeId)}" aria-label="在文化图鉴中了解${t.name}">
      <span class="hero-daily-icon" aria-hidden="true">${badge ? (fromEmoji(badge.icon) || badge.icon) : iconHtml('paper')}</span>
      <span class="hero-daily-body">
        <span class="hero-daily-label">今日文化画语 · ${t.name}</span>
        <span class="hero-daily-text">${fact}</span>
      </span>
      <span class="hero-daily-more">去了解<i class="fa-solid fa-arrow-right" aria-hidden="true"></i></span>
    </a>`;
}

function bindNavigation() {
  // 发布按钮
  const bindPublish = () => { if (window.Publish) Publish.showPublishModal(); };
  document.getElementById('btn-publish')?.addEventListener('click', bindPublish);
  document.getElementById('hero-publish')?.addEventListener('click', bindPublish);
  document.getElementById('footer-publish')?.addEventListener('click', bindPublish);

  // 搜索
  const bindSearch = () => { if (window.Search) Search.showSearchBar(); };
  document.getElementById('btn-search')?.addEventListener('click', bindSearch);
  document.getElementById('footer-search')?.addEventListener('click', bindSearch);

  // 顶部搜索框回车
  const navInput = document.getElementById('nav-search-input');
  if (navInput) {
    navInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const v = navInput.value.trim();
        if (v && window.Search) {
          Search.showSearchBar().then(() => {
            const inp = document.getElementById('search-input');
            if (inp) { inp.value = v; Search.handleSearch(v); }
          });
        }
      }
    });
  }

  // Hero 探索按钮 → 滚动到画廊区（功能瓷贴区已移除，功能入口唯一化到顶导航双下拉）
  document.getElementById('hero-explore')?.addEventListener('click', () => {
    if (window.Sound) Sound.playSound('click');
    const target = document.getElementById('gallery');
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  });
  document.getElementById('hero-leaderboard')?.addEventListener('click', () => {
    if (window.Sound) Sound.playSound('click');
    location.hash = '#/leaderboard';
  });

  // Logo 点击 → 回到顶部
  document.getElementById('logo-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (window.Sound) Sound.playSound('click');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // 音效开关 & 主题切换已迁移到 Settings 模块（js/settings.js）
  // 入口在导航栏齿轮图标（#settings-toggle），打开 Drawer 快捷面板

  // 登录入口（页脚）
  document.getElementById('footer-login')?.addEventListener('click', () => {
    if (window.Auth) Auth.showAuthModal('login');
  });

  // 导航栏滚动效果
  window.addEventListener('scroll', () => {
    const nav = document.getElementById('navbar');
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 40);
    // 滚动时隐藏Hero滚动指示器
    const heroScroll = document.querySelector('.hero-scroll');
    if (heroScroll) {
      heroScroll.style.opacity = window.scrollY > 100 ? '0' : '1';
      heroScroll.style.pointerEvents = window.scrollY > 100 ? 'none' : 'auto';
    }
  }, { passive: true });

  // 移动端汉堡菜单
  const menuToggle = document.getElementById('menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileOverlay = document.getElementById('mobile-menu-overlay');
  const closeMobile = () => {
    mobileMenu?.classList.remove('open');
    mobileOverlay?.classList.remove('open');
  };
  menuToggle?.addEventListener('click', () => {
    if (window.Sound) Sound.playSound('click');
    mobileMenu?.classList.toggle('open');
    mobileOverlay?.classList.toggle('open');
  });
  mobileOverlay?.addEventListener('click', closeMobile);
  mobileMenu?.querySelectorAll('[data-mm]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.Sound) Sound.playSound('click');
      closeMobile();
      const action = btn.dataset.mm;
      if (action === 'search') bindSearch();
      if (action === 'publish') bindPublish();
      if (action === 'profile') { if (window.showProfile) showProfile(); }
      if (action === 'admin') { if (window.showAdminPanel) showAdminPanel(); }
      if (action === 'settings') { window.location.hash = '#/settings'; }
    });
  });
}

// ------------------------------------------------------------
// 自定义光标（含拖尾 + 点击效果）
// ------------------------------------------------------------
function bindCustomCursor() {
  const dot = document.getElementById('cursor-dot');
  const ring = document.getElementById('cursor-ring');
  if (!dot || !ring) return;

  // 检测是否为精确指针设备（支持鼠标移动）
  // 直接添加class，如果用户有鼠标就会触发mousemove
  document.documentElement.classList.add('has-fine-pointer');

  let mx = 0, my = 0, rx = 0, ry = 0;
  let trailTimer = 0;

  // 鼠标移动 - 更新位置 + 拖尾
  document.addEventListener('mousemove', (e) => {
    mx = e.clientX; my = e.clientY;
    dot.style.left = mx + 'px';
    dot.style.top = my + 'px';

    // 拖尾粒子（每隔15ms产生一个）
    const now = Date.now();
    if (now - trailTimer > 15) {
      trailTimer = now;
      createTrailParticle(mx, my);
    }
  });

  // 平滑跟随环
  const loop = () => {
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    ring.style.left = rx + 'px';
    ring.style.top = ry + 'px';
    requestAnimationFrame(loop);
  };
  loop();

  // 悬停可交互元素时光标放大
  document.addEventListener('mouseover', (e) => {
    if (e.target.closest('a, button, .clickable, .artwork-card, .filter-chip, .ai-fab, .ai-chip, [role="button"]')) {
      ring.classList.add('hover');
    }
  });
  document.addEventListener('mouseout', (e) => {
    if (e.target.closest('a, button, .clickable, .artwork-card, .filter-chip, .ai-fab, .ai-chip, [role="button"]')) {
      ring.classList.remove('hover');
    }
  });

  // 点击效果 - 涟漪 + 粒子
  document.addEventListener('mousedown', (e) => {
    createClickRipple(e.clientX, e.clientY);
    createClickParticles(e.clientX, e.clientY);
  });

  // Bug 2+3 修复：window 焦点丢失/恢复时 cursor 的显示/隐藏
  // — 防止 Alt+Tab 切走后 cursor 停在旧位置（用户感觉"偏移/消失"）
  window.addEventListener('blur', () => {
    document.body.classList.add('cursor-blurred');
  });
  window.addEventListener('focus', () => {
    document.body.classList.remove('cursor-blurred');
    // 重置 cursor 位置到 viewport 中心（等待用户第一次 mousemove 即可）
    // 同时清理所有残留的 trail/ripple/particle
    document.querySelectorAll('.cursor-trail, .cursor-click-ripple, .cursor-click-particle').forEach(el => el.remove());
  });
  // 页面刚加载无 mousemove 时，cursor 停在 viewport 中心等待首次移动
  if (mx === 0 && my === 0) {
    mx = window.innerWidth / 2;
    my = window.innerHeight / 2;
    dot.style.left = mx + 'px'; dot.style.top = my + 'px';
    rx = mx; ry = my;
  }
}

// 创建拖尾粒子
function createTrailParticle(x, y) {
  const p = document.createElement('div');
  p.className = 'cursor-trail';
  p.style.left = x + 'px';
  p.style.top = y + 'px';
  // 随机颜色：粉/紫/蓝
  const colors = ['#ffd1e8', '#c9b6ff', '#a8d8ff'];
  p.style.background = colors[Math.floor(Math.random() * colors.length)];
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 900);
}

// 创建点击涟漪
function createClickRipple(x, y) {
  const r = document.createElement('div');
  r.className = 'cursor-click-ripple';
  r.style.left = x + 'px';
  r.style.top = y + 'px';
  document.body.appendChild(r);
  setTimeout(() => r.remove(), 500);
}

// 创建点击粒子（8个方向散射）
function createClickParticles(x, y) {
  const colors = ['#ffd1e8', '#c9b6ff', '#a8d8ff', '#b8f0d4'];
  for (let i = 0; i < 8; i++) {
    const p = document.createElement('div');
    p.className = 'cursor-click-particle';
    p.style.left = x + 'px';
    p.style.top = y + 'px';
    const angle = (Math.PI * 2 / 8) * i + Math.random() * 0.5;
    const dx = Math.cos(angle) * 8;
    const dy = Math.sin(angle) * 8;
    p.style.setProperty('--dx', dx + 'px');
    p.style.setProperty('--dy', dy + 'px');
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 600);
  }
}

// ------------------------------------------------------------
// GSAP 滚动动画（优化版）
// ------------------------------------------------------------
function initGSAPAnimations() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  // 渐进增强：GSAP 初始化后标记 body，让 ink-theme.css §8 的兜底关闭
  // — 否则 gsap.set(opacity:0) 会被 !important 覆盖导致入场动画失效
  document.body.classList.add('gsap-ready');

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  // ============================================================
  // 预设初始状态（避免动画前布局抖动）
  // ============================================================
  gsap.set('.hero-tag, .hero-title, .hero-sub, .hero-cta .btn-primary, .hero-cta .btn-ghost, .hero-scroll, .hero-daily', { y: 30, opacity: 0 });
  gsap.set('.gallery-head', { y: 40, opacity: 0 });
  gsap.set('.filter-bar .filter-chip', { y: 20, opacity: 0 });
  gsap.set('.footer-inner > *', { y: 30, opacity: 0 });
  const gsapAnimatedSets = [
    { selector: '.fade-in-up', from: { y: 40, opacity: 0 } },
    { selector: '.fade-in-down', from: { y: -40, opacity: 0 } },
    { selector: '.fade-in-left', from: { x: -40, opacity: 0 } },
    { selector: '.fade-in-right', from: { x: 40, opacity: 0 } },
    { selector: '.scale-in', from: { scale: 0.9, opacity: 0 } },
    { selector: '.blur-in', from: { filter: 'blur(20px)', opacity: 0 } }
  ];

  gsapAnimatedSets.forEach(({ selector, from }) => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      gsap.set(elements, from);
    }
  });

  // ============================================================
  // Hero 入场动画（使用单个timeline）
  // ============================================================
  const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  heroTl.to('.hero-tag', { y: 0, opacity: 1, duration: 0.7 })
    .to('.hero-title', { y: 0, opacity: 1, duration: 0.9 }, '-=0.3')
    .to('.hero-sub', { y: 0, opacity: 1, duration: 0.7 }, '-=0.5')
    .to('.hero-cta .btn-primary, .hero-cta .btn-ghost', { y: 0, opacity: 1, duration: 0.6, stagger: 0.12 }, '-=0.4')
    .to('.hero-daily', { y: 0, opacity: 1, duration: 0.7 }, '-=0.3')
    .to('.hero-scroll', { opacity: 1, duration: 0.8 }, '-=0.2');

  // ============================================================
  // Hero 漂浮光斑增强动画（使用timeline批量管理）
  // ============================================================
  const orbTl = gsap.timeline({ repeat: -1, defaults: { ease: 'sine.inOut', yoyo: true } });
  orbTl.to('.hero-orb.o1', { y: -20, x: 15, duration: 6 }, 0)
    .to('.hero-orb.o2', { y: 25, x: -20, duration: 8 }, 1)
    .to('.hero-orb.o3', { y: -15, x: 25, duration: 7 }, 2);

  // ============================================================
  // 滚动触发动画（使用ScrollTrigger）
  // ============================================================
  gsap.to('.gallery-head', {
    scrollTrigger: { trigger: '#gallery', start: 'top 75%', once: true },
    y: 0, opacity: 1, duration: 0.9, ease: 'power3.out'
  });

  gsap.to('.filter-bar .filter-chip', {
    scrollTrigger: { trigger: '.filter-bar', start: 'top 85%', once: true },
    y: 0, opacity: 1, duration: 0.5, stagger: 0.06, ease: 'power2.out'
  });

  // ============================================================
  // 作品卡片滚动入场（优化：使用batch模式，减少单独tween数量）
  // ============================================================
  function animateGalleryCards() {
    const cards = document.querySelectorAll('.artwork-card:not(.animated)');
    if (cards.length === 0) return;

    gsap.set(cards, { y: 40, opacity: 0, scale: 0.96 });
    cards.forEach(card => card.classList.add('animated'));

    gsap.to(cards, {
      scrollTrigger: { trigger: '#gallery', start: 'top 90%', once: true },
      y: 0, opacity: 1, scale: 1,
      duration: 0.7,
      stagger: { amount: 0.8, from: 'start', ease: 'power3.out' }
    });
  }

  setTimeout(animateGalleryCards, 100);

  const galleryObserver = new MutationObserver(() => {
    animateGalleryCards();
  });
  const galleryGrid = document.getElementById('gallery-grid');
  if (galleryGrid) {
    galleryObserver.observe(galleryGrid, { childList: true, subtree: true });
  }

  // ============================================================
  // 页脚动画
  // ============================================================
  gsap.to('.footer-inner > *', {
    scrollTrigger: { trigger: 'footer', start: 'top 90%', once: true },
    y: 0, opacity: 1, duration: 0.7, stagger: 0.1, ease: 'power2.out'
  });

  // ============================================================
  // 通用滚动动画（批量处理）
  // ============================================================
  const animationClasses = [
    { selector: '.fade-in-up', props: { y: 40, opacity: 0 } },
    { selector: '.fade-in-down', props: { y: -40, opacity: 0 } },
    { selector: '.fade-in-left', props: { x: -40, opacity: 0 } },
    { selector: '.fade-in-right', props: { x: 40, opacity: 0 } },
    { selector: '.scale-in', props: { scale: 0.9, opacity: 0 } },
    { selector: '.blur-in', props: { filter: 'blur(20px)', opacity: 0 } }
  ];

  animationClasses.forEach(({ selector, props }) => {
    const elements = document.querySelectorAll(selector);
    if (elements.length === 0) return;

    const targetProps = {};
    if ('y' in props) targetProps.y = 0;
    if ('x' in props) targetProps.x = 0;
    if ('scale' in props) targetProps.scale = 1;
    if ('opacity' in props) targetProps.opacity = 1;
    if ('filter' in props) targetProps.filter = 'blur(0px)';

    gsap.to(elements, {
      scrollTrigger: {
        trigger: elements[0],
        start: 'top 85%',
        once: true,
        onEnter: () => elements.forEach(el => el.classList.add('visible'))
      },
      ...targetProps,
      duration: 0.7,
      stagger: 0.08,
      ease: 'power3.out'
    });
  });
}


// ===== 顶部板块下拉菜单通用交互（创作工坊 / 文化探索） =====
function setupNavDropdown(dropdownId, triggerId, menuId) {
  var dropdown = document.getElementById(dropdownId);
  if (!dropdown) return null;
  var trigger = document.getElementById(triggerId);
  var menu = document.getElementById(menuId);
  if (!trigger || !menu) return null;

  var hoverTimer = null;

  function openMenu() {
    menu.hidden = false;
    requestAnimationFrame(function() { menu.classList.add('is-open'); });
    trigger.setAttribute('aria-expanded', 'true');
  }
  function closeMenu() {
    menu.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
    setTimeout(function() { if (!menu.classList.contains('is-open')) menu.hidden = true; }, 250);
  }

  // 点击触发
  trigger.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    if (menu.classList.contains('is-open')) closeMenu(); else openMenu();
  });

  // 悬停展开
  dropdown.addEventListener('mouseenter', function() {
    clearTimeout(hoverTimer);
    openMenu();
  });
  dropdown.addEventListener('mouseleave', function() {
    hoverTimer = setTimeout(closeMenu, 200);
  });

  // 点击外部关闭
  document.addEventListener('click', function(e) {
    if (!dropdown.contains(e.target)) closeMenu();
  });

  // ESC关闭
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeMenu();
  });

  return { open: openMenu, close: closeMenu, trigger: trigger, menu: menu };
}

// hash 跳转工具：目标与当前 hash 相同时手动派发 hashchange（同 hash 二次进入修复）
function _navToHash(hash) {
  if (window.location.hash === hash) window.dispatchEvent(new Event('hashchange'));
  else window.location.hash = hash;
}

document.addEventListener('DOMContentLoaded', function() {
  // 创作工坊下拉：菜单项路由
  var workshop = setupNavDropdown('workshop-dropdown', 'btn-workshop', 'workshop-menu');
  if (workshop) {
    var routes = { score: '#/score', edit: '#/edit', craft: '#/craft', tutor: '#/tutor', curate: '#/curate', partner: '#/partner', scan: '#/scan' };
    workshop.menu.querySelectorAll('.nav-dropdown-item').forEach(function(item) {
      item.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        workshop.close();
        var ai = item.dataset.ai;
        if (routes[ai]) _navToHash(routes[ai]);
      });
    });
  }

  // 文化探索下拉：菜单项为原生锚点，点击后收起菜单即可
  var explore = setupNavDropdown('explore-dropdown', 'btn-explore', 'explore-menu');
  if (explore) {
    explore.menu.querySelectorAll('.nav-dropdown-item').forEach(function(item) {
      item.addEventListener('click', function() { explore.close(); });
    });
  }

  // 移动端菜单按钮
  document.querySelectorAll('[data-mm="score"], [data-mm="edit"], [data-mm="craft"], [data-mm="tutor"], [data-mm="curate"], [data-mm="partner"], [data-mm="leaderboard"], [data-mm="scan"], [data-mm="atlas"], [data-mm="footprint"], [data-mm="scenic"]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var mm = btn.dataset.mm;
      // M6a-3：AI评分统一走 #/score 路由
      _navToHash('#/' + mm);
    });
  });
});
