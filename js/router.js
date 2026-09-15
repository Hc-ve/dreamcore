import { getAllArtworks } from './db.js';

const Router = {
  routes: {
    home: {
      path: /^#?$/,
      title: 'Dreamcore · 梦境数字艺术社交平台',
      description: '探索梦境美学的数字艺术世界，浏览200+件梦幻艺术作品，发布创作，与艺术家共鸣。',
      ogImage: '/og-image.png',
      canonical: '/'
    },
    gallery: {
      path: /^#gallery$/,
      title: '梦境画廊 · Dreamcore',
      description: '浏览数字艺术、摄影、插画、抽象、3D艺术作品，发现梦幻美学创作。',
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
      description: '搜索作品名、艺术家或作品号，探索更多梦幻艺术作品。',
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
      matchedRoute = this.routes.home;
      params = {};
    }

    await this.updateMeta(matchedRoute, params);
  },

  _extractParams(key, match) {
    const params = {};
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
        description = `${artwork.description || artwork.title} by ${artwork.author} · Dreamcore梦境数字艺术社交平台`;
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
