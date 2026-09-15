const { test, expect } = require('@playwright/test');

const VIEWPORTS = [
  { name: 'Desktop', width: 1440, height: 900 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Mobile', width: 375, height: 812 },
];

async function clearStorage(context) {
  await context.clearCookies();
  await context.addInitScript(() => {
    localStorage.clear();
    indexedDB.databases().then(dbs => {
      dbs.forEach(db => indexedDB.deleteDatabase(db.name));
    });
  });
}

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    localStorage.setItem('dreamcore-theme', t);
    document.documentElement.setAttribute('data-theme', t);
  }, theme);
}

test.describe('模块1：首页与3D粒子背景', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page.context());
    await page.goto('/');
  });

  test('1.1 页面正常加载', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveTitle(/Dreamcore/);
    await expect(page.locator('#hero')).toBeVisible();
    await expect(page.locator('#gallery')).toBeVisible();
  });

  test('1.2 3D粒子背景', async ({ page }) => {
    const canvas = page.locator('#particle-canvas');
    await expect(canvas).toBeVisible();
    const isVisible = await canvas.evaluate(el => el.style.display !== 'none');
    expect(isVisible).toBe(true);
  });

  test('1.3 响应式适配', async ({ page }) => {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize(vp);
      const canvas = page.locator('#particle-canvas');
      await expect(canvas).toBeVisible();
      const rect = await canvas.boundingBox();
      expect(rect.width).toBe(vp.width);
      expect(rect.height).toBeGreaterThan(0);
    }
  });

  test('1.5 暗色模式粒子', async ({ page }) => {
    await setTheme(page, 'dark');
    await page.reload();
    const canvas = page.locator('#particle-canvas');
    await expect(canvas).toBeVisible();
    await setTheme(page, 'light');
    await page.reload();
    await expect(canvas).toBeVisible();
  });

  test('1.6 欢迎弹窗', async ({ page }) => {
    const modal = page.locator('.welcome-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.welcome-title')).toHaveText('梦境已开启');
    await modal.locator('#welcome-enter').click();
    await expect(modal).toBeHidden();
  });

  test('1.7 欢迎弹窗焦点', async ({ page }) => {
    const modal = page.locator('.welcome-modal');
    await expect(modal).toBeVisible();
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement.tagName);
    expect(['BUTTON', 'DIV']).toContain(focused);
  });

  test('1.8 欢迎弹窗ESC', async ({ page }) => {
    const modal = page.locator('.welcome-modal');
    await expect(modal).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  });

  test('1.9 Hero文字动画', async ({ page }) => {
    const title = page.locator('.hero-title');
    await expect(title).toBeVisible();
    await expect(title).toHaveText(/在梦境深处/);
  });

  test('1.10 Hero CTA按钮', async ({ page }) => {
    await page.locator('#hero-explore').click();
    await expect(page.locator('#gallery')).toBeInViewport();
  });

  test('1.11 滚动指示器', async ({ page }) => {
    const indicator = page.locator('.hero-scroll');
    await expect(indicator).toBeVisible();
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(500);
    const isVisible = await indicator.isVisible();
    expect(isVisible).toBe(false);
  });
});

test.describe('模块2：导航栏', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page.context());
    await page.goto('/');
    await page.locator('.welcome-modal #welcome-enter').click();
  });

  test('2.1 导航栏固定', async ({ page }) => {
    const navbar = page.locator('#navbar');
    await expect(navbar).toBeVisible();
    await page.evaluate(() => window.scrollBy(0, 500));
    const position = await navbar.evaluate(el => getComputedStyle(el).position);
    expect(position).toBe('fixed');
  });

  test('2.2 Logo点击', async ({ page }) => {
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.locator('#logo-link').click();
    await page.waitForTimeout(500);
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);
  });

  test('2.3 顶部搜索框', async ({ page }) => {
    const searchInput = page.locator('#nav-search-input');
    await searchInput.fill('test');
    await searchInput.press('Enter');
    const searchModal = page.locator('.search-modal');
    await expect(searchModal).toBeVisible();
  });

  test('2.4 发布按钮', async ({ page }) => {
    await page.locator('#btn-publish').click();
    const loginModal = page.locator('#auth-modal');
    await expect(loginModal).toBeVisible();
  });

  test('2.5 主题切换', async ({ page }) => {
    const themeToggle = page.locator('#theme-toggle');
    await themeToggle.click();
    const theme = await page.evaluate(() => localStorage.getItem('dreamcore-theme'));
    expect(theme).toBe('dark');
    await themeToggle.click();
    const themeLight = await page.evaluate(() => localStorage.getItem('dreamcore-theme'));
    expect(themeLight).toBe('light');
  });

  test('2.6 主题持久化', async ({ page }) => {
    const themeToggle = page.locator('#theme-toggle');
    await themeToggle.click();
    await page.reload();
    const theme = await page.evaluate(() => localStorage.getItem('dreamcore-theme'));
    expect(theme).toBe('dark');
  });

  test('2.7 音效开关', async ({ page }) => {
    const soundToggle = page.locator('#sound-toggle');
    const initialPressed = await soundToggle.getAttribute('aria-pressed');
    await soundToggle.click();
    const pressed = await soundToggle.getAttribute('aria-pressed');
    expect(pressed).toBe(initialPressed === 'true' ? 'false' : 'true');
  });

  test('2.8 登录按钮', async ({ page }) => {
    await page.locator('#btn-login').click();
    const loginModal = page.locator('#auth-modal');
    await expect(loginModal).toBeVisible();
    await expect(loginModal.locator('.auth-title')).toHaveText('欢迎回到梦境');
  });

  test('2.9 已登录状态', async ({ page }) => {
    await page.locator('#btn-login').click();
    await page.locator('#auth-username').fill('admin');
    await page.locator('#auth-password').fill('admin123');
    await page.locator('#auth-submit').click();
    await page.waitForTimeout(500);
    const userArea = page.locator('#nav-user-area');
    await expect(userArea.locator('.user-avatar-btn')).toBeVisible();
    await expect(page.locator('#btn-login').count()).toBe(0);
  });

  test('2.10 通知中心', async ({ page }) => {
    await page.locator('#btn-login').click();
    await page.locator('#auth-username').fill('admin');
    await page.locator('#auth-password').fill('admin123');
    await page.locator('#auth-submit').click();
    await page.waitForTimeout(500);
    await page.locator('#notification-bell').click();
    const dropdown = page.locator('#notification-dropdown');
    await expect(dropdown).toBeVisible();
  });
});

test.describe('模块3：移动端菜单', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page.context());
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.locator('.welcome-modal #welcome-enter').click();
  });

  test('3.1 汉堡菜单', async ({ page }) => {
    await page.locator('#menu-toggle').click();
    const menu = page.locator('#mobile-menu');
    await expect(menu).toBeVisible();
    const overlay = page.locator('#mobile-menu-overlay');
    await expect(overlay).toBeVisible();
  });

  test('3.2 菜单关闭', async ({ page }) => {
    await page.locator('#menu-toggle').click();
    await page.locator('#mobile-menu-overlay').click();
    const menu = page.locator('#mobile-menu');
    await expect(menu).toBeHidden();
  });

  test('3.3 菜单项功能', async ({ page }) => {
    await page.locator('#menu-toggle').click();
    const searchBtn = page.locator('[data-mm="search"]');
    await searchBtn.click();
    const searchModal = page.locator('.search-modal');
    await expect(searchModal).toBeVisible();
  });

  test('3.4 菜单主题同步', async ({ page }) => {
    await page.locator('#menu-toggle').click();
    await page.locator('[data-mm="theme"]').click();
    const theme = await page.evaluate(() => localStorage.getItem('dreamcore-theme'));
    expect(theme).toBe('dark');
  });
});

test.describe('模块4：画廊与作品卡片', () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page.context());
    await page.goto('/');
    await page.locator('.welcome-modal #welcome-enter').click();
  });

  test('4.1 画廊加载', async ({ page }) => {
    const gallery = page.locator('#gallery');
    await expect(gallery).toBeVisible();
    const cards = page.locator('.art-card');
    await expect(cards.first()).toBeVisible();
  });

  test('4.2 作品数量显示', async ({ page }) => {
    const count = page.locator('#gallery-count');
    await expect(count).toBeVisible();
    const text = await count.textContent();
    expect(parseInt(text)).toBeGreaterThan(0);
  });

  test('4.3 卡片图片加载', async ({ page }) => {
    const card = page.locator('.art-card').first();
    await expect(card).toBeVisible();
    const img = card.locator('img');
    await expect(img).toBeVisible();
    const src = await img.getAttribute('src');
    expect(src).toBeTruthy();
  });

  test('4.4 卡片悬停效果', async ({ page }) => {
    const card = page.locator('.art-card').first();
    await card.hover();
    const viewBtn = card.locator('.art-view-btn');
    await expect(viewBtn).toBeVisible();
  });

  test('4.5 卡片信息完整', async ({ page }) => {
    const card = page.locator('.art-card').first();
    await expect(card.locator('.art-title')).toBeVisible();
    await expect(card.locator('.art-author')).toBeVisible();
    await expect(card.locator('.art-likes')).toBeVisible();
  });

  test('4.7 排序功能', async ({ page }) => {
    const sortSelect = page.locator('#sort-select');
    await sortSelect.selectOption('popular');
    await page.waitForTimeout(500);
    const cards = page.locator('.art-card');
    await expect(cards.first()).toBeVisible();
  });

  test('4.8 分类筛选', async ({ page }) => {
    const digitalChip = page.locator('[data-category="digital-art"]');
    await digitalChip.click();
    await page.waitForTimeout(500);
    const cards = page.locator('.art-card');
    await expect(cards.count()).toBeGreaterThan(0);
  });

  test('4.9 标签筛选', async ({ page }) => {
    const card = page.locator('.art-card').first();
    const tags = card.locator('.art-tags .tag-chip');
    if ((await tags.count()) > 0) {
      await tags.first().click();
      const tagFilter = page.locator('#tag-filter-bar');
      await expect(tagFilter).toBeVisible();
    }
  });

  test('4.10 清除筛选', async ({ page }) => {
    const digitalChip = page.locator('[data-category="digital-art"]');
    await digitalChip.click();
    await page.waitForTimeout(500);
    await page.locator('[data-category="all"]').click();
    const allChip = page.locator('[data-category="all"]');
    await expect(allChip).toHaveClass(/active/);
  });

  test('4.13 暗色模式卡片', async ({ page }) => {
    await page.locator('#theme-toggle').click();
    await page.waitForTimeout(300);
    const card = page.locator('.art-card').first();
    await expect(card).toBeVisible();
  });

  test('4.14 响应式布局', async ({ page }) => {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize(vp);
      await page.waitForTimeout(300);
      const cards = page.locator('.art-card');
      await expect(cards.count()).toBeGreaterThan(0);
    }
  });

  test('4.15 图片srcset', async ({ page }) => {
    const img = page.locator('.art-card img').first();
    await expect(img).toBeVisible();
    const srcset = await img.getAttribute('srcset');
    expect(srcset).toBeTruthy();
  });
});
