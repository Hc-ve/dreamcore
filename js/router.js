import { getAllArtworks, getUserArtworks, getFavorites, getUserTotalLikes, getFollowing, getAllOrders, toggleFollow, getUserById, getFollowersCount, isFollowing } from './db.js';

// 路由 → 该路由自身所属浮层根节点的 id。
// handleRoute 每次都会清掉残留的 .modal-overlay（避免上个页面的弹层盖住新页面），
// 但"当前路由自己"的浮层必须保留：这类浮层的 openFromHash() 在浮层已存在时
// 只做状态重渲染、不会再补 .open 类，一旦被误清就会停在 visibility:hidden，
// 表现为"在景区列表点进景区/景点详情后整个面板消失"。
const ROUTE_OVERLAY_ID = {
  scenic: 'scenic-recommend-page',
  atlas: 'culture-atlas-page',
  footprint: 'culture-footprint-page',
};

const Router = {
  routes: {
    home: {
      // 必须接受 '#/'：全站「返回首页」入口统一使用 href="#/"，
      // 若此正则不接受 '#/'，点击后会落到 notFound → 标题变「页面未找到」且无任何跳转反应。
      path: /^#?\/?$/,
      title: 'Dreamcore · AI+文旅文创艺术共创社区',
      description: 'AI+文旅文创艺术共创社区：AI评分、AI修图、AI文创衍生品生成，与景区、博物馆、非遗传承人共创东方美学。',
      ogImage: '/og-image.png',
      canonical: '/'
    },
    gallery: {
      path: /^#\/?gallery$/,
      title: '文旅画廊 · Dreamcore',
      description: '浏览文旅摄影、非遗文创、国风绘画、AI数字艺术、博物文创与创意设计作品，发现传统文化与AI共创之美。',
      ogImage: '/og-image.png',
      canonical: '/#gallery'
    },
    artwork: {
      path: /^#\/?artwork-(\d+)$/,
      title: null,
      description: null,
      ogImage: null,
      canonical: null
    },
    search: {
      path: /^#\/?search(?:\?q=([^&]+))?$/,
      title: '搜索 · Dreamcore',
      description: '搜索作品名、艺术家或作品号，探索更多文旅文创艺术作品。',
      ogImage: '/og-image.png',
      canonical: '/#search'
    },
    profile: {
      // 支持 #/profile（本人）与 #/profile-<userId>（查看他人）。
      // userId 可能是云端 UUID 字符串，故用 [^?&/]+ 而非 \d+。
      path: /^#\/?profile(?:-([^?&/]+))?$/,
      title: '个人中心 · Dreamcore',
      description: '查看个人作品集、收藏和互动记录。',
      ogImage: '/og-image.png',
      canonical: '/#profile'
    },
    admin: {
      path: /^#\/?admin$/,
      title: '管理后台 · Dreamcore',
      description: '管理网站内容和用户数据。',
      ogImage: '/og-image.png',
      canonical: '/#admin'
    },
    edit: {
      path: /^#\/edit(?:\?.*)?$/,
      title: 'AI修图工作台 · Dreamcore',
      description: 'AI辅助修图调参：曝光/对比/饱和度锐化/HSL 实时调节 + 国风/非遗/电影感风格滤镜 + 版本管理',
      ogImage: '/og-image.png',
      canonical: '/#/edit'
    },
    craft: {
      path: /^#\/craft(?:\?.*)?$/,
      title: 'AI文创衍生品 · Dreamcore',
      description: 'AI辅助文创衍生品生成：壁纸/海报/藏品卡/明信片/模板 × 国风/非遗纹样/现代极简风格',
      ogImage: '/og-image.png',
      canonical: '/#/craft'
    },
    tutor: {
      path: /^#\/tutor(?:\?.*)?$/,
      title: 'AI陪练 · Dreamcore',
      description: 'AI摄影教学陪练：构图法则/作品改进建议/摄影史/非遗文化，会话记录持久化保存。',
      ogImage: '/og-image.png',
      canonical: '/#/tutor'
    },
    curate: {
      path: /^#\/curate(?:\?.*)?$/,
      title: 'AI智能策展 · Dreamcore',
      description: 'AI辅助智能策展：按非遗/地域/季节光影主题聚类作品生成主题展馆，草稿/发布管理',
      ogImage: '/og-image.png',
      canonical: '/#/curate'
    },
    partner: {
      path: /^#\/partner(?:\?.*)?$/,
      title: '合伙人申请 · Dreamcore',
      description: '景区/博物馆/非遗传承人合作意向申请，共建梦境数字艺术生态。',
      ogImage: '/og-image.png',
      canonical: '/#/partner'
    },
    leaderboard: {
      path: /^#\/?leaderboard(?:\?.*)?$/,
      title: '排行榜 · Dreamcore',
      description: 'Dreamcore 创作者排行榜：日榜、周榜、月榜、总榜，综合作品数量、质量与互动数据多维评分。',
      ogImage: '/og-image.png',
      canonical: '/#/leaderboard'
    },
    score: {
      path: /^#\/score(?:\?.*)?$/,
      title: 'AI智能评分 · Dreamcore',
      description: '上传照片或选择已发布作品，AI五维度美学评分与六等级定级分析。',
      ogImage: '/og-image.png',
      canonical: '/#/score'
    },
    scan: {
      path: /^#\/scan(?:\?.*)?$/,
      title: 'AI识文化 · Dreamcore',
      description: '拍下文物、建筑、纹样或非遗技艺，AI识别文化主体，基于文化知识库讲述背后的故事。',
      ogImage: '/og-image.png',
      canonical: '/#/scan'
    },
    atlas: {
      path: /^#\/atlas(?:\?.*)?$/,
      title: '文化故事图鉴 · Dreamcore',
      description: '十二个中华文化主题图鉴：历史源流、文化内涵、经典典故与文创创作建议，内容源自人工校对的文化知识库。',
      ogImage: '/og-image.png',
      canonical: '/#/atlas'
    },
    footprint: {
      path: /^#\/footprint(?:\?.*)?$/,
      title: '文化探索足迹 · Dreamcore',
      description: '读图鉴、创文创、AI识图三种行为点亮十二座文化地标，铜银金徽章记录你的中华文化探索之旅。',
      ogImage: '/og-image.png',
      canonical: '/#/footprint'
    },
    settings: {
      path: /^#\/settings(?:\?.*)?$/,
      title: '设置 · Dreamcore',
      description: '个人资料、外观主题、通用偏好、通知、隐私安全等设置。',
      ogImage: '/og-image.png',
      canonical: '/#/settings'
    },
    pricing: {
      path: /^#\/pricing(?:\?.*)?$/,
      title: '定价方案 · Dreamcore',
      description: 'Dreamcore AI 文创共创平台定价方案：免费体验、创作者订阅、团队版，含 AI 生成配额、存储、高级功能。',
      ogImage: '/og-image.png',
      canonical: '/#/pricing'
    },
    scenic: {
      path: /^#\/scenic(?:\?.*)?$/,
      title: '景区推荐 · Dreamcore',
      description: 'AI 驱动的文旅景区智能推荐：基于你的创作偏好与文化兴趣，发现适合游览与文创灵感的景区。',
      ogImage: '/og-image.png',
      canonical: '/#/scenic'
    },
    'ai-disclosure': {
      path: /^#\/ai-disclosure(?:\?.*)?$/,
      title: 'AI 生成披露 · Dreamcore',
      description: 'Dreamcore 平台 AI 生成内容标识办法：所有 AI 生成作品显式标注、提供来源与置信度、支持用户申诉。',
      ogImage: '/og-image.png',
      canonical: '/#/ai-disclosure'
    },
    // 法律文档站内路由：正文复用 public/terms.html、public/privacy.html（保持单一来源，
    // 静态页仍可直接访问并供搜索引擎收录），但渲染套用主站主题，不再"跳出本站 / 新开窗口"。
    terms: {
      path: /^#\/?terms(?:\?.*)?$/,
      title: '用户协议 · Dreamcore',
      description: 'Dreamcore 用户协议：服务条款、用户行为规范、知识产权、内容审核与责任限制。',
      ogImage: '/og-image.png',
      canonical: '/#/terms'
    },
    privacy: {
      path: /^#\/?privacy(?:\?.*)?$/,
      title: '隐私政策 · Dreamcore',
      description: 'Dreamcore 隐私政策：信息收集范围、信息用途、存储与安全、Cookie 使用与用户权利。',
      ogImage: '/og-image.png',
      canonical: '/#/privacy'
    },
    notFound: {
      path: null,
      title: '页面未找到 · Dreamcore',
      description: '您访问的页面不存在或已被移除。',
      ogImage: '/og-image.png',
      canonical: '/404'
    }
  },

  async init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    await this.handleRoute();
  },

  async handleRoute() {
    const hash = window.location.hash;
    let matchedRoute = null;
    let params = {};

    for (const [key, route] of Object.entries(this.routes)) {
      const match = hash.match(route.path);
      if (match) {
        matchedRoute = { key, ...route };
        params = this._extractParams(key, match);
        break;
      }
    }

    if (!matchedRoute) {
      matchedRoute = { key: 'notFound', ...this.routes.notFound };
      params = {};
      this._render404();
    } else {
      // 移除可能存在的 404 覆盖层
      document.getElementById('__notfound_host')?.remove();
      // 移除已渲染的法律页 host（每次只展示一个全屏页）
      const legal = document.getElementById('__legal_host');
      if (legal) { legal.remove(); document.body.style.overflow = ''; document.body.style.height = ''; }
      // 移除 inline display:none 覆盖（让各模块自己管理 visibility）
      ['__settings_host'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.style.display === 'none') el.style.display = '';
      });
      // 清掉上一个 profile 全屏 host 与 search 全屏 host（每次只展示一个全屏页）
      const oldProfile = document.getElementById('__profile_host');
      if (oldProfile) oldProfile.remove();
      const oldSearch = document.getElementById('__search_host');
      if (oldSearch) oldSearch.remove();
      // 清掉 search modal 弹层（如果正开着的话）
      const sm = document.getElementById('search-modal');
      if (sm) sm.remove();
      // 清掉残留的 Drawer 快捷面板 + 遮罩层
      // （否则 hash 跳转后 sc-overlay 盖住 cursor 元素 + 阻塞点击）
      document.querySelectorAll('.sc-overlay, .sc-drawer').forEach(el => {
        el.classList.remove('show');
        if (el.style) el.style.display = '';
      });
      // 清掉残留的 modal-overlay（score/craft/scan/tutor/atlas/footprint/scenic）
      // 例外：当前路由自身所属的浮层保留 .open，否则其 openFromHash 的"已打开"分支
      // 不会重新加 .open，整层会停留在 visibility:hidden（详见 ROUTE_OVERLAY_ID 注释）
      const keepOverlayId = ROUTE_OVERLAY_ID[matchedRoute.key];
      document.querySelectorAll('.modal-overlay.open, .modal-overlay.show').forEach(el => {
        if (keepOverlayId && el.id === keepOverlayId) return;
        el.classList.remove('open', 'show');
      });
      // 以上全屏 host 移除后统一解锁 body（pricing/ai-disclosure 会在需要时重新锁）
      document.body.style.overflow = '';
      document.body.style.height = '';

      // 分发需要独立渲染的路由
      switch (matchedRoute.key) {
        // 定价页 / AI 披露页由 js/pricing-page.js、js/ai-disclosure-page.js 自行以
        // .modal-overlay 渲染（含「一键下单」等交互，import 时自注册 hashchange）。
        // router 此前又用 _renderHost 渲染了一份静态版，两层叠加且静态层 z-index 更高，
        // 会把交互层整个盖住（点不到下单按钮）——故此处不再重复渲染，只负责锁 body 滚动。
        case 'pricing':
        case 'ai-disclosure':
          document.body.style.overflow = 'hidden';
          document.body.style.height = '100vh';
          break;
        case 'terms':
          await this._renderLegalDoc('terms');
          break;
        case 'privacy':
          await this._renderLegalDoc('privacy');
          break;
        case 'profile':
          await this._renderProfile(params);
          break;
        case 'search':
          await this._renderSearch(params);
          break;
        default:
          break;
      }
    }

    await this.updateMeta(matchedRoute, params);
  },

  /**
   * 通用全屏浮层渲染（定价 / AI 披露 / 法律文档共用）。
   *
   * 关键点：浮层使用 `position:fixed;inset:0` 铺满**整个视口**（含首页顶部导航所在的
   * 0~72px 区域）。此前使用 inset:72px 从导航下方铺开，导致全屏页仍能点到主站导航，
   * 与"全屏页是独立页面"的交互预期不符（用户反馈："更多设置页面怎么还能点导航上的功能"）。
   *
   * @param {string} title 页面标题（传空字符串则不渲染标题）
   * @param {string} bodyHTML 正文 HTML
   * @param {object} [opts] { maxWidth, padding, actions, dismissOnBackdrop }
   */
  _renderHost(title, bodyHTML, opts = {}) {
    const maxWidth = opts.maxWidth || 720;
    const padding = opts.padding || '40px 28px 80px';

    let host = document.getElementById('__legal_host');
    if (!host) {
      host = document.createElement('div');
      host.id = '__legal_host';
      document.body.appendChild(host);
    }
    // 每次渲染都重置为铺满视口（幂等）
    host.style.cssText = 'position:fixed;inset:0;z-index:9996;background:var(--bg-dark,#faf6ee);color:var(--text-primary,#1a1614);display:flex;flex-direction:column;overflow-y:auto;';

    // 锁 body 滚动（浮层移除时统一解锁）
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';

    const actions = opts.actions !== undefined
      ? opts.actions
      : `
          <div style="margin-top:48px;display:flex;gap:12px;">
            <a href="#/" style="padding:10px 24px;background:var(--accent,#a8261f);color:#fff;border-radius:4px;text-decoration:none;font-weight:600;box-shadow:0 1px 3px rgba(168,38,31,.25);">返回首页</a>
            <a href="#/gallery" style="padding:10px 24px;border:1px solid var(--border,#e6dccb);border-radius:4px;text-decoration:none;color:var(--text-primary);">浏览画廊</a>
          </div>`;

    host.innerHTML = `
      <div style="flex:1;overflow-y:auto;padding:${padding};">
        <div style="max-width:${maxWidth}px;margin:0 auto;">
          ${title ? `<div style="font-size:28px;font-weight:700;margin-bottom:24px;background:linear-gradient(135deg,var(--accent,#a8261f),var(--indigo-accent,#2d4a6b));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">${title}</div>` : ''}
          ${bodyHTML}
          ${actions}
        </div>
      </div>
    `;

    // 背景空白点击关闭：按实例保存 handler，支持 opts.dismissOnBackdrop === false 时解绑
    // （法律文档为长文阅读页，铺满视口后误触空白不应直接关掉）
    if (opts.dismissOnBackdrop === false) {
      if (host._backdropHandler) {
        host.removeEventListener('click', host._backdropHandler);
        host._backdropHandler = null;
      }
    } else if (!host._backdropHandler) {
      host._backdropHandler = (e) => {
        if (e.target.id === '__legal_host') {
          this._closeHost(host);
        }
      };
      host.addEventListener('click', host._backdropHandler);
    }
  },

  /** 关闭通用全屏浮层并解锁 body 滚动 */
  _closeHost(host) {
    if (!host) return;
    if (host._backdropHandler) {
      host.removeEventListener('click', host._backdropHandler);
      host._backdropHandler = null;
    }
    host.remove();
    document.body.style.overflow = '';
    document.body.style.height = '';
  },

  /**
   * 法律文档（用户协议 / 隐私政策）站内渲染。
   * 正文从 public/terms.html、public/privacy.html 抽取（单一来源，静态页继续保留供直接访问 / SEO），
   * 复用主站主题 + CSS 变量渲染，并提供隐私政策 / 用户协议 页内互链。
   * @param {'terms'|'privacy'} kind
   */
  async _renderLegalDoc(kind) {
    const isPrivacy = kind === 'privacy';
    const file = isPrivacy ? '/privacy.html' : '/terms.html';
    let body = '';

    try {
      const res = await fetch(file, { cache: 'force-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = new DOMParser().parseFromString(await res.text(), 'text/html');

      // 1) 搬用静态页的文档样式（.legal-page 等），但把为独立页预留的顶部留白去掉
      //    （站内浮层已自带 padding，否则会出现 ~100px 的空白）
      const styleEl = parsed.querySelector('style');
      if (styleEl) {
        let css = styleEl.textContent || '';
        css = css.replace(/padding:\s*100px 28px 80px\s*;/, 'padding:0 0 8px;');
        let holder = document.getElementById('__legal_page_style');
        if (!holder) {
          holder = document.createElement('style');
          holder.id = '__legal_page_style';
          document.head.appendChild(holder);
        }
        holder.textContent = css;
      }

      // 2) 只取正文（#main-content），去掉独立页的页内导航与 h1（标题由浮层统一渲染）
      const main = parsed.querySelector('#main-content');
      if (main) {
        const clone = main.cloneNode(true);
        clone.querySelectorAll('.legal-nav').forEach(n => n.remove());
        clone.querySelector('h1')?.remove();
        body = clone.innerHTML;
      }
      if (!body.trim()) throw new Error('正文为空');
    } catch (err) {
      body = `<p style="color:var(--text-secondary);line-height:1.8;">文档加载失败：${this._profileEsc(err.message || String(err))}。你可以直接访问 <a href="${file}" style="color:var(--accent,#a8261f);">${file}</a> 查看。</p>`;
    }

    // 页内互链（隐私政策 / 用户协议 一键切换）
    const tabStyle = (active) => `font-size:14px;padding:6px 14px;border-radius:100px;text-decoration:none;border:1px solid var(--border,#e6dccb);${active
      ? 'background:var(--accent,#a8261f);border-color:var(--accent,#a8261f);color:#fff;font-weight:600;'
      : 'color:var(--text-secondary,#666);'}`;
    const nav = `
      <nav style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:24px;" aria-label="法律文档导航">
        <a href="#/privacy" style="${tabStyle(isPrivacy)}">隐私政策</a>
        <a href="#/terms" style="${tabStyle(!isPrivacy)}">用户协议</a>
      </nav>`;

    this._renderHost(isPrivacy ? '隐私政策' : '用户协议',
      nav + `<div class="legal-page">${body}</div>`,
      { maxWidth: 800, padding: '32px 28px 80px', dismissOnBackdrop: false });
  },

  async _renderProfile(params) {
    // 复用 settings 全屏页 host 的写法
    let host = document.getElementById('__profile_host');
    if (!host) {
      host = document.createElement('div');
      host.id = '__profile_host';
      host.style.cssText = 'position:fixed;inset:0;z-index:9998;background:var(--bg-dark,#fafafa);color:var(--text-primary,#1a1a2e);overflow-y:auto;';
      document.body.appendChild(host);
    }
    // 锁 body 滚动（只在 host 存在期间锁）
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';

    const me = (window.Auth && typeof window.Auth.getCurrentUser === 'function')
      ? window.Auth.getCurrentUser()
      : (window.currentUser || null);

    // 目标用户：显式指定（#/profile-<userId>）优先，否则回退到本人
    const rawTargetId = (params && params.userId) ? String(params.userId) : null;
    const selfId = (me && me.id != null) ? String(me.id) : null;
    const targetId = rawTargetId || selfId;

    // ---- auth 守卫：未登录且未指定目标用户 → 显示登录引导 ----
    if (!targetId) {
      host.innerHTML = `
        <div style="max-width:680px;margin:0 auto;padding:48px 24px;">
          <div style="text-align:center;background:var(--bg-card,#fff);border:1px solid var(--border-subtle,#eee);border-radius:12px;padding:48px 36px;box-shadow:0 4px 24px rgba(0,0,0,.06);">
            <div style="width:72px;height:72px;margin:0 auto 16px;border-radius:50%;background:linear-gradient(135deg,var(--accent,#a8261f),var(--indigo-accent,#2d4a6b));display:flex;align-items:center;justify-content:center;color:#fff;font-size:32px;"><i class="fa-regular fa-circle-user"></i></div>
            <h2 style="font-size:22px;font-weight:700;margin-bottom:10px;">请先登录查看个人中心</h2>
            <p style="font-size:14px;color:var(--text-secondary,#666);margin-bottom:16px;line-height:1.7;">登录后你可以：查看自己发布的所有文旅文创作品与 AI 评分记录、管理收藏夹与点赞互动、关注喜欢的创作者、查看 AI 文创衍生品订单与物流状态，以及同步云端个人资料与偏好设置。</p>
            <p style="font-size:13px;color:var(--text-tertiary,#888);margin-bottom:28px;line-height:1.7;">Dreamcore 致力于打造 AI+文旅文创艺术共创社区，登录即表示同意我们的<a href="#/terms" style="color:var(--accent,#a8261f);text-decoration:underline;">用户协议</a>与<a href="#/privacy" style="color:var(--accent,#a8261f);text-decoration:underline;">隐私政策</a>，你的所有作品数据将安全存储于云端并支持多端同步访问。</p>
            <div style="display:flex;gap:12px;justify-content:center;margin-bottom:24px;">
              <button id="profile-go-login" style="padding:10px 28px;background:var(--accent,#a8261f);color:#fff;border:none;border-radius:4px;font-weight:600;cursor:pointer;">去登录</button>
              <button id="profile-go-register" style="padding:10px 28px;border:1px solid var(--accent,#a8261f);background:none;border-radius:4px;font-weight:600;cursor:pointer;color:var(--accent,#a8261f);">立即注册</button>
              <a href="#/" style="padding:10px 24px;border:1px solid var(--border,#e6dccb);border-radius:4px;text-decoration:none;color:var(--text-primary);font-size:14px;">回首页</a>
            </div>
            <p style="font-size:12px;color:var(--text-tertiary,#999);">登录即表示同意 Dreamcore 的用户协议与隐私政策，你的作品数据将安全存储于云端并可跨设备同步。</p>
          </div>
        </div>
      `;
      host.querySelector('#profile-go-login')?.addEventListener('click', () => {
        if (window.Auth) window.Auth.showAuthModal('login');
      });
      host.querySelector('#profile-go-register')?.addEventListener('click', () => {
        if (window.Auth) window.Auth.showAuthModal('register');
      });
      return;
    }

    const isSelf = !!(selfId && targetId === selfId);

    // 解析目标用户：本人直接用登录态；他人从 users 记录读取
    let user = null;
    if (isSelf) {
      user = me;
    } else {
      try { user = await getUserById(targetId); } catch (_) { user = null; }
    }

    // 目标用户不存在 → 友好提示（不再静默返回主界面，Bug #3）
    if (!user) {
      host.innerHTML = `
        <div style="max-width:680px;margin:0 auto;padding:48px 24px;">
          <div style="text-align:center;background:var(--bg-card,#fff);border:1px solid var(--border-subtle,#eee);border-radius:12px;padding:48px 36px;box-shadow:0 4px 24px rgba(0,0,0,.06);">
            <div style="width:72px;height:72px;margin:0 auto 16px;border-radius:50%;background:linear-gradient(135deg,var(--accent,#a8261f),var(--indigo-accent,#2d4a6b));display:flex;align-items:center;justify-content:center;color:#fff;font-size:32px;"><i class="fa-regular fa-circle-user"></i></div>
            <h2 style="font-size:22px;font-weight:700;margin-bottom:10px;">未找到该用户</h2>
            <p style="font-size:14px;color:var(--text-secondary,#666);margin-bottom:24px;line-height:1.7;">该用户可能已注销，或资料暂不可见。</p>
            <a href="#/" style="display:inline-block;padding:10px 24px;background:var(--accent,#a8261f);color:#fff;border-radius:4px;text-decoration:none;font-weight:600;">返回首页</a>
          </div>
        </div>`;
      return;
    }

    // ---- 展示资料：以 users 记录为准（自定义头像/昵称/简介在此生效，Bug #2/#4）----
    const displayName = ((user.nickname || '').trim()) || user.username || '用户';
    const bio = (user.bio || '').trim();
    let avatar = user.avatar || null;
    if (isSelf && (!avatar || !avatar.type) && window.Settings && typeof window.Settings.getSetting === 'function') {
      avatar = window.Settings.getSetting('avatar'); // 本人回退到账户级设置缓存
    }
    const avatarHtml = (window.Settings && typeof window.Settings.renderAvatarHtml === 'function')
      ? window.Settings.renderAvatarHtml({ avatar, username: user.username, nickname: user.nickname }, { sizeClass: 'xl' })
      : `<span class="avatar-circle xl">${this._profileEsc((user.username || '?').charAt(0).toUpperCase())}</span>`;
    const regDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '—';

    // Tab：本人可见私有内容（收藏/订单），他人仅公开内容 + 关注入口
    const tabBtnStyle = 'padding:10px 18px;background:none;border:none;font-size:14px;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;';
    const tabs = isSelf
      ? [['works', '作品'], ['favs', '收藏'], ['following', '关注'], ['orders', '订单']]
      : [['works', '作品'], ['following', '关注']];
    const tabsHtml = tabs.map(([k, label]) =>
      `<button data-tab="${k}" style="${tabBtnStyle}" class="profile-tab-btn">${label}</button>`).join('');

    // 统计卡：本人展示「收藏」，他人展示「粉丝」
    const statDefs = isSelf
      ? [['p-stat-works', '发布作品'], ['p-stat-favs', '收藏'], ['p-stat-likes', '获赞总数'], ['p-stat-following', '关注']]
      : [['p-stat-works', '作品'], ['p-stat-followers', '粉丝'], ['p-stat-likes', '获赞总数'], ['p-stat-following', '关注']];
    const statsHtml = statDefs.map(([id, label]) =>
      `<div style="text-align:center;padding:16px;background:var(--bg-card,#fff);border:1px solid var(--border-subtle,#eee);border-radius:8px;"><div id="${id}" style="font-size:22px;font-weight:700;color:var(--accent,#a8261f);">—</div><div style="font-size:12px;color:var(--text-secondary,#666);margin-top:2px;">${label}</div></div>`).join('');

    host.innerHTML = `
      <div style="max-width:880px;margin:0 auto;padding:32px 24px 64px;">
        <!-- 返回条 -->
        <div style="margin-bottom:20px;">
          <a href="#/" style="font-size:13px;color:var(--text-secondary,#666);text-decoration:none;"><i class="fa-solid fa-arrow-left"></i> 返回首页</a>
        </div>

        <!-- 顶部用户信息卡 -->
        <div style="display:flex;align-items:center;gap:20px;padding:24px;background:var(--bg-card,#fff);border:1px solid var(--border-subtle,#eee);border-radius:12px;margin-bottom:24px;flex-wrap:wrap;">
          ${avatarHtml}
          <div style="flex:1;min-width:200px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px;">
              <h1 style="font-size:22px;font-weight:700;margin:0;">${this._profileEsc(displayName)}</h1>
              ${user.isAdmin ? '<span style="font-size:11px;padding:2px 8px;background:linear-gradient(135deg,var(--accent,#a8261f),var(--indigo-accent,#2d4a6b));color:#fff;border-radius:10px;">管理员</span>' : ''}
            </div>
            ${bio ? `<p style="font-size:13px;color:var(--text-primary,#1a1a2e);margin:0 0 8px;line-height:1.6;">${this._profileEsc(bio)}</p>` : ''}
            <div style="font-size:13px;color:var(--text-secondary,#666);">
              ${isSelf ? `<span><i class="fa-regular fa-envelope"></i> ${this._profileEsc(user.email || '未设置邮箱')}</span>` : ''}
              <span style="${isSelf ? 'margin-left:12px;' : ''}"><i class="fa-regular fa-calendar"></i> 加入于 ${regDate}</span>
            </div>
          </div>
          ${isSelf
            ? '<a href="#/settings" style="padding:8px 18px;border:1px solid var(--border,#e6dccb);border-radius:4px;text-decoration:none;color:var(--text-primary);font-size:13px;">编辑资料</a>'
            : (me ? `<button id="profile-follow-btn" style="padding:8px 20px;background:var(--accent,#a8261f);color:#fff;border:none;border-radius:4px;font-size:13px;font-weight:600;cursor:pointer;"><i class="fa-solid fa-user-plus"></i> <span id="profile-follow-text">关注</span></button>` : '')}
        </div>

        <!-- 统计数字 -->
        <div id="profile-stats-bar" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
          ${statsHtml}
        </div>

        <!-- Tab 切换 -->
        <div id="profile-tabs" style="display:flex;gap:4px;border-bottom:1px solid var(--border,#e6dccb);margin-bottom:20px;">
          ${tabsHtml}
        </div>

        <!-- 内容容器 -->
        <div id="profile-tab-content"></div>
      </div>

      <style>
        .profile-tab-btn.active { color: var(--accent,#a8261f); border-bottom-color: var(--accent,#a8261f) !important; }
        .profile-card-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(180px, 1fr)); gap:12px; }
        .profile-card { border:1px solid var(--border-subtle,#eee); border-radius:8px; overflow:hidden; background:var(--bg-card,#fff); cursor:pointer; transition:transform .15s; }
        .profile-card:hover { transform:translateY(-2px); box-shadow:0 4px 12px rgba(0,0,0,.08); }
        .profile-card img, .profile-card video { width:100%; aspect-ratio:1/1; object-fit:cover; display:block; }
        .profile-card-info { padding:10px 12px; }
        .profile-card-info h4 { font-size:13px; margin:0 0 6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .profile-card-stats { font-size:12px; color:var(--text-secondary,#666); display:flex; justify-content:space-between; }
        .profile-empty { text-align:center; padding:60px 20px; color:var(--text-secondary,#666); }
        .profile-empty i { font-size:40px; opacity:.5; margin-bottom:12px; }
        .following-item { display:flex; align-items:center; gap:12px; padding:12px; border:1px solid var(--border-subtle,#eee); border-radius:8px; margin-bottom:8px; background:var(--bg-card,#fff); }
      </style>
    `;

    // Tab 按钮样式注入（CSS 变量）
    const inject = document.createElement('style');
    inject.textContent = `.profile-tab-btn.active { color: var(--accent,#a8261f); border-bottom-color: var(--accent,#a8261f) !important; }`;
    document.head.appendChild(inject);

    // 加载统计 + 默认 Tab 内容
    const activeTab = this.__profileActiveTab || 'works';
    const tabBtns = host.querySelectorAll('.profile-tab-btn');
    const safeActiveTab = tabs.some(([k]) => k === activeTab) ? activeTab : 'works';
    tabBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === safeActiveTab));

    // Tab 切换事件
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof Sound !== 'undefined') Sound.playSound('click');
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.__profileActiveTab = btn.dataset.tab;
        this._profileLoadTabContent(host, btn.dataset.tab, user);
      });
    });

    // 关注按钮（他人主页，需登录）
    if (!isSelf && me) {
      const btn = host.querySelector('#profile-follow-btn');
      const txt = host.querySelector('#profile-follow-text');
      if (btn) {
        isFollowing(me.id, user.id)
          .then(v => { if (v && txt) txt.textContent = '已关注'; })
          .catch(() => {});
        btn.addEventListener('click', async () => {
          if (typeof Sound !== 'undefined') Sound.playSound('click');
          btn.disabled = true;
          try {
            const nowFollowing = await toggleFollow(me.id, user.id);
            if (txt) txt.textContent = nowFollowing ? '已关注' : '关注';
          } catch (_) {
            if (window.showToast) showToast('操作失败，请稍后重试', 'warn');
          }
          btn.disabled = false;
        });
      }
    }

    // 并行拉统计数据（他人不查私有收藏，改查粉丝数）
    Promise.all([
      getUserArtworks(user.id).catch(() => []),
      isSelf ? getFavorites(user.id).catch(() => []) : Promise.resolve(null),
      getUserTotalLikes(user.id).catch(() => 0),
      getFollowing(user.id).catch(() => []),
      isSelf ? Promise.resolve(null) : getFollowersCount(user.id).catch(() => 0)
    ]).then(([works, favs, totalLikes, following, followers]) => {
      const set = (id, v) => { const el = host.querySelector('#' + id); if (el) el.textContent = this._profileFmtNum(v); };
      set('p-stat-works', works.length);
      if (isSelf) set('p-stat-favs', favs.length);
      else set('p-stat-followers', followers);
      set('p-stat-likes', totalLikes);
      set('p-stat-following', following.length);
    });

    this._profileLoadTabContent(host, safeActiveTab, user);

    // host 关闭：hash 回到 #/ 时解锁 body
    host.__cleanup = () => { document.body.style.overflow = ''; document.body.style.height = ''; };
  },

  async _profileLoadTabContent(host, tab, user) {
    const container = host.querySelector('#profile-tab-content');
    if (!container) return;

    try {
      if (tab === 'works') {
        const works = await getUserArtworks(user.id).catch(() => []);
        this._profileRenderGrid(container, works, true);
      } else if (tab === 'favs') {
        const favs = await getFavorites(user.id).catch(() => []);
        this._profileRenderGrid(container, favs, false);
      } else if (tab === 'following') {
        const following = await getFollowing(user.id).catch(() => []);
        this._profileRenderFollowing(container, following, user, host);
      } else if (tab === 'orders') {
        const orders = await getAllOrders().catch(() => []);
        const mine = orders.filter(o => String(o.userId) === String(user.id));
        this._profileRenderOrders(container, mine);
      }
    } catch (err) {
      container.innerHTML = `<div class="profile-empty">加载失败：${this._profileEsc(err.message || err)}</div>`;
    }
  },

  _profileRenderGrid(container, list, isWorks) {
    if (!list || list.length === 0) {
      container.innerHTML = `
        <div class="profile-empty">
          <i class="fa-regular fa-${isWorks ? 'image' : 'bookmark'}"></i>
          <p>${isWorks ? '还没有发布作品' : '还没有收藏作品'}</p>
          ${isWorks ? '<a href="#/gallery" style="display:inline-block;margin-top:12px;padding:8px 24px;background:var(--accent,#a8261f);color:#fff;border-radius:4px;text-decoration:none;font-size:14px;">去发布作品</a>' : ''}
        </div>`;
      return;
    }
    container.innerHTML = '<div class="profile-card-grid"></div>';
    const grid = container.querySelector('.profile-card-grid');
    list.forEach(art => {
      const isVideo = art.type === 'video';
      const card = document.createElement('div');
      card.className = 'profile-card';
      card.innerHTML = `
        ${isVideo
          ? `<video muted src="${this._profileEsc(art.imageUrl)}"></video>`
          : `<img loading="lazy" src="${this._profileEsc(art.imageUrl)}" alt="${this._profileEsc(art.title)}" />`}
        <div class="profile-card-info">
          <h4>${this._profileEsc(art.title)}</h4>
          <div class="profile-card-stats">
            <span><i class="fa-solid fa-heart"></i> ${this._profileFmtNum(art.likes)}</span>
            <span style="color:#999;">#${art.id}</span>
          </div>
        </div>
      `;
      card.addEventListener('click', () => {
        if (window.Gallery && typeof window.Gallery.openLightbox === 'function') {
          window.Gallery.openLightbox(art.id);
        }
      });
      grid.appendChild(card);
    });
  },

  _profileRenderFollowing(container, list, currentUser, host) {
    if (!list || list.length === 0) {
      container.innerHTML = `
        <div class="profile-empty">
          <i class="fa-regular fa-user-plus"></i>
          <p>还没有关注任何人</p>
          <p style="font-size:12px;margin-top:8px;opacity:.6;">去画廊发现有趣的艺术家吧～</p>
        </div>`;
      return;
    }
    container.innerHTML = '<div id="profile-following-list"></div>';
    const wrap = container.querySelector('#profile-following-list');
    list.forEach(u => {
      const displayName = (u.nickname || '').trim() || u.username || '用户';
      // 头像统一走 Settings.renderAvatarHtml（跟随被关注者账户的自定义头像）
      const avatarHtml = (window.Settings && typeof window.Settings.renderAvatarHtml === 'function')
        ? window.Settings.renderAvatarHtml(u, { sizeClass: '', style: 'width:40px;height:40px;font-size:15px;' })
        : `<span class="avatar-circle" style="width:40px;height:40px;font-size:15px;">${this._profileEsc((u.username || '?').charAt(0).toUpperCase())}</span>`;
      const item = document.createElement('div');
      item.className = 'following-item';
      item.innerHTML = `
        ${avatarHtml}
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:14px;">${this._profileEsc(displayName)}</div>
          <div style="font-size:12px;color:var(--text-secondary,#666);">
            <i class="fa-regular fa-images"></i> ${this._profileFmtNum(u.worksCount || 0)} 作品
            <span style="margin-left:8px;"><i class="fa-solid fa-heart"></i> ${this._profileFmtNum(u.followersCount || 0)} 粉丝</span>
          </div>
        </div>
        <button style="padding:4px 12px;border:1px solid var(--border,#e6dccb);background:none;border-radius:12px;font-size:12px;cursor:pointer;color:var(--text-secondary);">已关注</button>
      `;
      // 点击用户 → 进入该用户个人资料页（与作品详情页作者头像跳转保持一致）
      item.addEventListener('click', () => {
        window.location.hash = '#/profile-' + encodeURIComponent(u.id);
      });
      wrap.appendChild(item);
    });
  },

  _profileRenderOrders(container, list) {
    if (!list || list.length === 0) {
      container.innerHTML = `
        <div class="profile-empty">
          <i class="fa-solid fa-box"></i>
          <p>还没有订单</p>
          <p style="font-size:12px;margin-top:8px;opacity:.6;">去创作工坊把你的作品变成实物吧～</p>
        </div>`;
      return;
    }
    container.innerHTML = '<div style="display:flex;flex-direction:column;gap:12px;"></div>';
    const wrap = container.firstElementChild;
    list.forEach(o => {
      const statusLabel = ({ paid:'已支付', producing:'制作中', shipped:'已发货', in_transit:'运输中', delivered:'已签收' })[o.status] || o.status || '—';
      const product = o.product || o.craftType || '文创商品';
      const spec = [o.material, o.size].filter(Boolean).join(' · ') || (o.craftType || '—');
      wrap.insertAdjacentHTML('beforeend', `
        <div style="padding:14px 16px;border:1px solid var(--border-subtle,#eee);border-radius:8px;background:var(--bg-card,#fff);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-weight:700;font-size:.88rem;">订单号 ${this._profileEsc(o.orderNo || '—')}</span>
            <span style="font-size:.74rem;font-weight:600;padding:3px 10px;border-radius:999px;background:rgba(52,211,153,.16);color:#2bb58a;">${this._profileEsc(statusLabel)}</span>
          </div>
          <div style="font-size:.82rem;color:var(--text-primary);line-height:1.8;">
            <div>商品：${this._profileEsc(product)}</div>
            <div>规格：${this._profileEsc(spec)}</div>
            <div>价格：¥${Number(o.price) || 0}</div>
          </div>
        </div>
      `);
    });
  },

  _profileFmtNum(n) {
    n = Number(n) || 0;
    if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n;
  },
  _profileEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  },

  async _renderSearch(params) {
    // 复用 search.js 的 Search 模块：showSearchBar() + 样式升级
    let host = document.getElementById('__search_host');
    if (!host) {
      host = document.createElement('div');
      host.id = '__search_host';
      host.style.cssText = 'position:fixed;inset:0;z-index:9998;background:var(--bg-dark,#fafafa);color:var(--text-primary,#1a1a2e);overflow-y:auto;';
      document.body.appendChild(host);
    }
    // 锁 body 滚动
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';

    // 关闭之前可能已打开的 search modal（清理残留）
    const oldModal = document.getElementById('search-modal');
    if (oldModal) oldModal.remove();

    // 注入全屏样式覆盖（幂等）
    if (!document.getElementById('__router_search_fs_style')) {
      const fs = document.createElement('style');
      fs.id = '__router_search_fs_style';
      fs.textContent = `
        #search-modal {
          position: fixed !important;
          inset: 0 !important;
          background: transparent !important;
          display: block !important;
        }
        #search-modal .search-panel.glass {
          position: fixed !important;
          inset: 16px 16px 16px 16px !important;
          max-width: 960px !important;
          width: auto !important;
          margin: 0 auto !important;
          border-radius: 12px !important;
          box-shadow: 0 8px 40px rgba(0,0,0,.1) !important;
          display: flex !important;
          flex-direction: column !important;
          padding: 24px 28px !important;
        }
        #search-modal .modal-close { display: none !important; }
        #search-modal .search-header { margin-bottom: 16px; }
        #search-modal .search-enhanced-panel { margin-bottom: 16px; }
        #search-modal .search-results {
          flex: 1 !important;
          overflow-y: auto !important;
          padding-bottom: 40px !important;
        }
      `;
      document.head.appendChild(fs);
    }

    // 调用 Search 模块的 showSearchBar 来构建 modal DOM
    if (window.Search && typeof window.Search.showSearchBar === 'function') {
      await window.Search.showSearchBar();
    } else if (typeof window.showSearchBar === 'function') {
      await window.showSearchBar();
    } else {
      host.innerHTML = '<div style="padding:48px;text-align:center;color:var(--text-secondary);">搜索模块未加载</div>';
      return;
    }

    // 把构建好的 search modal 挂载到 host 下（替换 host 内容）
    const modal = document.getElementById('search-modal');
    if (modal) {
      // 把 modal 从 body 移到 host 里（保持 DOM 结构，只换 parent）
      host.appendChild(modal);

      // 如果有预填搜索词，触发搜索
      const q = (params && (params.query || params.q)) || '';
      if (q && window.Search && typeof window.Search._doSearch === 'function') {
        const input = modal.querySelector('#search-input');
        if (input) input.value = q;
        // 等 Search 模块数据加载完再触发
        if (!window.Search.allArtworks || window.Search.allArtworks.length === 0) {
          try { await getAllArtworks(); } catch (_) {}
        }
        window.Search._doSearch(q);
      }
    }

    host.__cleanup = () => { document.body.style.overflow = ''; document.body.style.height = ''; };
  },

  _render404() {
    let host = document.getElementById('__notfound_host');
    if (!host) {
      host = document.createElement('div');
      host.id = '__notfound_host';
      host.style.cssText = 'position:fixed;inset:0;z-index:9997;background:var(--bg-dark,#faf6ee);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;';
      document.body.appendChild(host);
    }
    host.innerHTML = `
      <div style="font-size:88px;font-weight:700;background:linear-gradient(135deg,var(--accent,#a8261f),var(--indigo-accent,#2d4a6b));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">404</div>
      <div style="font-size:20px;color:var(--text-secondary);">页面走丢了</div>
      <div style="font-size:14px;color:var(--text-tertiary);max-width:400px;text-align:center;">您访问的链接可能已失效或页面已被移除。试试回到首页继续探索吧～</div>
      <div style="display:flex;gap:12px;margin-top:12px;">
        <a href="#/" style="padding:10px 24px;background:var(--accent,#a8261f);color:#fff;border-radius:4px;text-decoration:none;font-weight:600;">返回首页</a>
        <a href="#/gallery" style="padding:10px 24px;border:1px solid var(--border,#e6dccb);border-radius:4px;text-decoration:none;color:var(--text-primary);">去画廊</a>
        <a href="#/scan" style="padding:10px 24px;border:1px solid var(--border,#e6dccb);border-radius:4px;text-decoration:none;color:var(--text-primary);">AI识文化</a>
      </div>
    `;
  },

  _extractParams(key, match) {
    const params = {};
    // 修复：_extractParams 内部使用 hash 但未声明，引用 handleRoute 中的外部变量会触发 ReferenceError
    const hash = window.location.hash;
    switch (key) {
      case 'artwork':
        params.id = match[1];
        break;
      case 'search':
        params.query = match[1] ? decodeURIComponent(match[1]) : '';
        break;
      case 'profile':
        params.userId = match[1] ? decodeURIComponent(match[1]) : null;
        break;
      case 'edit': {
        // 解析查询参数 ?artworkId=xxx&focus=xxx
        const qs = hash.split('?')[1] || '';
        qs.split('&').forEach(pair => {
          const [k, v] = pair.split('=');
          if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
        });
        break;
      }
      case 'craft': {
        // 解析查询参数 ?artworkId=xxx
        const qs = hash.split('?')[1] || '';
        qs.split('&').forEach(pair => {
          const [k, v] = pair.split('=');
          if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
        });
        break;
      }
      case 'tutor': {
        // 解析查询参数 ?type=composition|improvement|history|feiyi
        const qs = hash.split('?')[1] || '';
        qs.split('&').forEach(pair => {
          const [k, v] = pair.split('=');
          if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
        });
        break;
      }
      case 'curate': {
        // 解析查询参数 ?hallId=xxx
        const qs = hash.split('?')[1] || '';
        qs.split('&').forEach(pair => {
          const [k, v] = pair.split('=');
          if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
        });
        break;
      }
      case 'partner': {
        // 解析查询参数 ?orgType=scenic|museum|heritage|school|other
        const qs = hash.split('?')[1] || '';
        qs.split('&').forEach(pair => {
          const [k, v] = pair.split('=');
          if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
        });
        break;
      }
    }
    return params;
  },

  async updateMeta(route, params) {
    let title = route.title;
    let description = route.description;
    let ogImage = route.ogImage;
    let canonical = route.canonical;

    if (route.key === 'artwork' && params.id) {
      const artwork = await this._getArtworkById(params.id);
      if (artwork) {
        title = `${artwork.title} · ${artwork.author} · Dreamcore`;
        description = `${artwork.description || artwork.title} by ${artwork.author} · Dreamcore AI+文旅文创艺术共创社区`;
        ogImage = artwork.imageUrl;
        canonical = `/#artwork-${params.id}`;
      }
    } else if (route.key === 'search' && params.query) {
      title = `搜索 "${params.query}" · Dreamcore`;
      description = `搜索结果：${params.query} · Dreamcore梦境数字艺术社交平台`;
      canonical = `/#search?q=${encodeURIComponent(params.query)}`;
    }

    document.title = title;

    this._updateMetaTag('description', description);
    this._updateMetaTag('og:title', title);
    this._updateMetaTag('og:description', description);
    this._updateMetaTag('og:url', window.location.origin + canonical);
    this._updateMetaTag('twitter:title', title);
    this._updateMetaTag('twitter:description', description);

    if (ogImage) {
      this._updateMetaTag('og:image', ogImage);
      this._updateMetaTag('twitter:image', ogImage);
    }

    this._updateLinkTag('canonical', window.location.origin + canonical);

    if (window.Sentry) {
      Sentry.addBreadcrumb({ category: 'router', message: 'Route changed', data: { route: route.key, params } });
    }
  },

  _updateMetaTag(property, content) {
    const selector = property.startsWith('og:') || property.startsWith('twitter:')
      ? `meta[property="${property}"]`
      : `meta[name="${property}"]`;
    const el = document.querySelector(selector);
    if (el) {
      el.setAttribute('content', content);
    }
  },

  _updateLinkTag(rel, href) {
    const el = document.querySelector(`link[rel="${rel}"]`);
    if (el) {
      el.setAttribute('href', href);
    }
  },

  async _getArtworkById(id) {
    try {
      const allArtworks = await getAllArtworks();
      return allArtworks.find(art => art.id === Number(id));
    } catch {
      return null;
    }
  },

  navigate(path) {
    window.location.hash = path;
  },

  getCurrentRoute() {
    const hash = window.location.hash;
    for (const [key, route] of Object.entries(this.routes)) {
      if (route.path && route.path.test(hash)) {
        return key;
      }
    }
    return 'home';
  }
};

window.Router = Router;

export default Router;
export { Router };
