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
import { Admin, showAdminPanel } from './admin.js';
import { AI } from './ai-assistant.js';
import { Router } from './router.js';

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

  // 初始化数据库
  try {
    await initDB();
  } catch (e) {
    console.error('数据库初始化失败:', e);
    showToast('数据加载失败，请刷新重试', 'warn');
  }

  // 检查登录状态 & 更新导航
  if (window.Auth) {
    await Auth.checkAuthState();
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
  if (typeof bindCustomCursor === 'function') bindCustomCursor();
  if (typeof initGSAPAnimations === 'function') initGSAPAnimations();

  // 首次用户交互恢复音频上下文（浏览器策略）
  const resumeAudio = () => {
    if (window.Sound) Sound.ensureContext();
    document.removeEventListener('pointerdown', resumeAudio);
  };
  document.addEventListener('pointerdown', resumeAudio);

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
function bindNavigation() {
  // 发布按钮
  const bindPublish = () => { if (window.Publish) Publish.showPublishModal(); };
  document.getElementById('btn-publish')?.addEventListener('click', bindPublish);
  document.getElementById('hero-publish')?.addEventListener('click', bindPublish);
  document.getElementById('footer-publish')?.addEventListener('click', (e) => { e.preventDefault(); bindPublish(); });

  // 搜索
  const bindSearch = () => { if (window.Search) Search.showSearchBar(); };
  document.getElementById('btn-search')?.addEventListener('click', bindSearch);
  document.getElementById('footer-search')?.addEventListener('click', (e) => { e.preventDefault(); bindSearch(); });

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

  // Hero 探索按钮 → 滚动到画廊
  document.getElementById('hero-explore')?.addEventListener('click', () => {
    if (window.Sound) Sound.playSound('click');
    document.getElementById('gallery').scrollIntoView({ behavior: 'smooth' });
  });

  // Logo 点击 → 回到顶部
  document.getElementById('logo-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    if (window.Sound) Sound.playSound('click');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // 音效开关
  const soundToggle = document.getElementById('sound-toggle');
  if (soundToggle) {
    const updateIcon = () => {
      const on = window.Sound ? Sound.enabled : true;
      soundToggle.innerHTML = `<i class="fa-solid fa-volume-${on ? 'high' : 'xmark'}"></i>`;
    };
    updateIcon();
    soundToggle.addEventListener('click', () => {
      const on = !(window.Sound && Sound.enabled);
      if (window.Sound) { Sound.setEnabled(on); if (on) Sound.playSound('click'); }
      updateIcon();
      showToast(on ? '音效已开启' : '音效已关闭', 'info');
    });
  }

  // 主题切换（亮色/暗色）
  const themeToggle = document.getElementById('theme-toggle');
  const getEffectiveTheme = () => {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr) return attr;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };
  const updateThemeIcon = () => {
    const isDark = getEffectiveTheme() === 'dark';
    const icon = isDark ? 'fa-sun' : 'fa-moon';
    const label = isDark ? '切换到亮色模式' : '切换到暗色模式';
    if (themeToggle) {
      themeToggle.innerHTML = `<i class="fa-solid ${icon}" aria-hidden="true"></i>`;
      themeToggle.setAttribute('aria-pressed', String(isDark));
      themeToggle.setAttribute('title', label);
    }
    // 同步移动端菜单图标
    const mmTheme = document.getElementById('mobile-menu')?.querySelector('[data-mm="theme"] i');
    if (mmTheme) mmTheme.className = `fa-solid ${icon} aria-hidden="true"`.replace(' aria-hidden="true"', '');
    if (mmTheme) mmTheme.setAttribute('aria-hidden', 'true');
  };
  const toggleTheme = () => {
    const current = getEffectiveTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('dreamcore-theme', next);
    if (window.Sound) Sound.playSound('click');
    updateThemeIcon();
    showToast(next === 'dark' ? '已切换到暗色模式' : '已切换到亮色模式', 'info');
  };
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
    updateThemeIcon();
  }
  // 监听系统主题变化（仅当用户未显式选择时跟随）
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!localStorage.getItem('dreamcore-theme')) {
      updateThemeIcon();
    }
  });

  // 登录入口（页脚）
  document.getElementById('footer-login')?.addEventListener('click', (e) => {
    e.preventDefault();
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
      if (action === 'sound') soundToggle?.click();
      if (action === 'theme') themeToggle?.click();
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

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  // ============================================================
  // 预设初始状态（避免动画前布局抖动）
  // ============================================================
  gsap.set('.hero-tag, .hero-title, .hero-sub, .hero-cta .btn-primary, .hero-cta .btn-ghost, .hero-scroll', { y: 30, opacity: 0 });
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
