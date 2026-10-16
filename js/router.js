import { getAllArtworks } from './db.js';

const Router = {
  routes: {
    home: {
      path: /^#?$/,
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
      path: /^#artwork-(\d+)$/,
      title: null,
      description: null,
      ogImage: null,
      canonical: null
    },
    search: {
      path: /^#search(?:\?q=([^&]+))?$/,
      title: '搜索 · Dreamcore',
      description: '搜索作品名、艺术家或作品号，探索更多文旅文创艺术作品。',
      ogImage: '/og-image.png',
      canonical: '/#search'
    },
    profile: {
      path: /^#profile(?:-(\d+))?$/,
      title: '个人中心 · Dreamcore',
      description: '查看个人作品集、收藏和互动记录。',
      ogImage: '/og-image.png',
      canonical: '/#profile'
    },
    admin: {
      path: /^#admin$/,
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
    }

    await this.updateMeta(matchedRoute, params);
  },

  _render404() {
    let host = document.getElementById('__notfound_host');
    if (!host) {
      host = document.createElement('div');
      host.id = '__notfound_host';
      host.style.cssText = 'position:fixed;inset:72px 0 0 0;z-index:9997;background:var(--bg,#fafafa);display:flex;align-items:center;justify-content:center;flex-direction:column;gap:16px;';
      document.body.appendChild(host);
    }
    host.innerHTML = `
      <div style="font-size:88px;font-weight:700;background:linear-gradient(135deg,#7c3aed,#2563eb);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;">404</div>
      <div style="font-size:20px;color:var(--text-secondary);">页面走丢了</div>
      <div style="font-size:14px;color:var(--text-tertiary);max-width:400px;text-align:center;">您访问的链接可能已失效或页面已被移除。试试回到首页继续探索吧～</div>
      <div style="display:flex;gap:12px;margin-top:8px;">
        <a href="#/" style="padding:10px 24px;background:var(--grad-dream);color:#241b3a;border-radius:100px;text-decoration:none;font-weight:600;">返回首页</a>
        <a href="#/gallery" style="padding:10px 24px;border:1px solid var(--glass-border);border-radius:100px;text-decoration:none;color:var(--text-primary);">去画廊</a>
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
        params.userId = match[1];
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
      if (route.path.test(hash)) {
        return key;
      }
    }
    return 'home';
  }
};

window.Router = Router;

export default Router;
export { Router };
