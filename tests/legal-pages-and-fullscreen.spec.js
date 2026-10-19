// ============================================================
// tests/legal-pages-and-fullscreen.spec.js
// 覆盖两项修复：
//   ① 服务条款 / 隐私政策 改为站内 hash 路由（#/terms、#/privacy）：
//      不再新开窗口"跳出本站"，正文复用静态页文案但套用站点主题
//   ② 所有全屏页（设置 / 个人中心 / 搜索 / 法律页 / 404）浮层统一换成 inset:0，
//      铺满视口并盖住顶部主导航——全屏页不应允许点击下层页面元素
// ============================================================
import { test, expect } from '@playwright/test';

const USER_A = {
  id: 'legal-uuid-aaaa-0001',
  username: 'admin',
  email: 'legal@test.app',
  isAdmin: false,
  role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z'
};

/** 清空 localStorage + IndexedDB，保证每个用例从零开始 */
async function clearStorage(context) {
  await context.clearCookies();
  await context.addInitScript(() => {
    try {
      localStorage.clear();
      indexedDB.databases().then(dbs => {
        dbs.forEach(db => indexedDB.deleteDatabase(db.name));
      });
    } catch (_) { /* 忽略 */ }
  });
}

/** 关闭首次访问欢迎引导弹窗（会拦截底层元素点击） */
async function dismissWelcome(page) {
  const btn = page.locator('#welcome-enter');
  try { await btn.click({ timeout: 4000 }); } catch (_) { /* 无弹窗则跳过 */ }
}

/**
 * 断言某个全屏浮层已铺满视口并盖住顶部导航：
 *  1) 几何：浮层覆盖整个 viewport（top/left ≤ 0，宽高 ≥ viewport）
 *  2) 层叠：导航中心点的最上层可交互元素落在浮层内，且不在导航栏内
 *  3) 行为：点击导航中心不会把焦点交给导航内的控件
 */
async function expectNavCoveredByFullscreen(page, hostId) {
  const geo = await page.evaluate((hid) => {
    const host = document.getElementById(hid);
    if (!host) return null;
    const r = host.getBoundingClientRect();
    return {
      top: Math.round(r.top), left: Math.round(r.left),
      w: Math.round(r.width), h: Math.round(r.height),
      vw: window.innerWidth, vh: window.innerHeight
    };
  }, hostId);
  expect(geo, `未找到全屏浮层 #${hostId}`).not.toBeNull();
  expect(geo.top).toBeLessThanOrEqual(0);
  expect(geo.left).toBeLessThanOrEqual(0);
  expect(geo.w).toBeGreaterThanOrEqual(geo.vw - 1);
  expect(geo.h).toBeGreaterThanOrEqual(geo.vh - 1);

  const stack = await page.evaluate((hid) => {
    const nav = document.getElementById('navbar');
    const r = nav.getBoundingClientRect();
    const x = Math.round(r.left + r.width / 2);
    const y = Math.round(r.top + r.height / 2);
    let el = document.elementFromPoint(x, y);
    // 跳过 pointer-events:none 的纯装饰层（如自定义光标），取真正可交互的最上层元素
    const seen = new Set();
    while (el && el.parentElement && !seen.has(el) && getComputedStyle(el).pointerEvents === 'none') {
      seen.add(el); el = el.parentElement;
    }
    const host = document.getElementById(hid);
    return {
      hitInsideHost: !!(el && host && (el === host || host.contains(el))),
      hitInNav: !!(el && el.closest && el.closest('#navbar'))
    };
  }, hostId);
  expect(stack.hitInsideHost, '导航中心点的最上层元素应属于全屏浮层').toBe(true);
  expect(stack.hitInNav, '导航栏不应仍处于最上层').toBe(false);

  const navBox = await page.locator('#navbar').boundingBox();
  if (navBox) {
    await page.mouse.click(navBox.x + navBox.width / 2, navBox.y + navBox.height / 2);
    const focusInNav = await page.evaluate(() => {
      const a = document.activeElement;
      return !!(a && a.closest && a.closest('#navbar'));
    });
    expect(focusInNav, '点击导航中心不应把焦点交给导航内控件').toBe(false);
  }
}

test.beforeEach(async ({ page }) => {
  await clearStorage(page.context());
  await page.goto('/');
  await page.waitForSelector('.artwork-card', { timeout: 25000 });
  await dismissWelcome(page);
});

test.describe('① 法律文档站内路由渲染', () => {
  test('#/terms 与 #/privacy：站内浮层渲染、标题正确、不再是 404', async ({ page }) => {
    await page.evaluate(() => { location.hash = '#/terms'; });
    const legal = page.locator('#__legal_host');
    await expect(legal).toBeVisible({ timeout: 8000 });
    await expect(legal).toContainText('用户协议');
    await expect(legal).toContainText('服务条款');           // 静态页正文小节标题
    await expect(page.locator('#__notfound_host')).toHaveCount(0);
    await expect.poll(() => page.title(), { timeout: 8000 }).toContain('用户协议');

    // 页内导航切到隐私政策（同一浮层内切换，不重新加载）
    await legal.getByRole('link', { name: '隐私政策' }).click();
    await expect.poll(() => page.evaluate(() => location.hash), { timeout: 8000 }).toBe('#/privacy');
    await expect(legal).toContainText('我们收集哪些信息');
    await expect.poll(() => page.title(), { timeout: 8000 }).toContain('隐私政策');
  });

  test('设置页「关于」点击服务条款 / 隐私政策：站内切换、不新开窗口', async ({ page }) => {
    const pageCount = page.context().pages().length;

    await page.evaluate(() => { location.hash = '#/settings?tab=about'; });
    const settings = page.locator('#__settings_host');
    await expect(settings).toBeVisible({ timeout: 8000 });
    await expect(settings).toContainText('帮助与反馈');

    await settings.getByRole('link', { name: '服务条款' }).click();
    await expect.poll(() => page.evaluate(() => location.hash), { timeout: 8000 }).toBe('#/terms');
    await expect(page.locator('#__legal_host')).toContainText('用户协议');
    // 既没有新开窗口/标签，也没有整页跳到 .html 文件
    expect(page.context().pages().length).toBe(pageCount);
    expect(page.url()).not.toContain('terms.html');
    await expect(settings).toBeHidden({ timeout: 8000 });

    // 再走一次隐私政策入口
    await page.evaluate(() => { location.hash = '#/settings?tab=about'; });
    await expect(settings).toBeVisible({ timeout: 8000 });
    await settings.getByRole('link', { name: '隐私政策' }).click();
    await expect.poll(() => page.evaluate(() => location.hash), { timeout: 8000 }).toBe('#/privacy');
    await expect(page.locator('#__legal_host')).toContainText('隐私政策');
    expect(page.context().pages().length).toBe(pageCount);
    expect(page.url()).not.toContain('privacy.html');
  });

  test('页脚法律链接同样指向站内路由（不再指向静态 .html）', async ({ page }) => {
    await expect(page.locator('.footer-links a', { hasText: '隐私政策' })).toHaveAttribute('href', '#/privacy');
    await expect(page.locator('.footer-links a', { hasText: '用户协议' })).toHaveAttribute('href', '#/terms');
  });
});

test.describe('② 全屏页统一覆盖顶部导航', () => {
  test('设置页覆盖导航，导航不再可点', async ({ page }) => {
    await page.evaluate(() => { location.hash = '#/settings'; });
    await expect(page.locator('#__settings_host')).toBeVisible({ timeout: 8000 });
    await expectNavCoveredByFullscreen(page, '__settings_host');
  });

  test('法律页覆盖导航', async ({ page }) => {
    await page.evaluate(() => { location.hash = '#/privacy'; });
    await expect(page.locator('#__legal_host')).toBeVisible({ timeout: 8000 });
    await expectNavCoveredByFullscreen(page, '__legal_host');
  });

  test('个人中心（本人 / 不存在用户）覆盖导航', async ({ page }) => {
    await page.evaluate(async (u) => {
      window.currentUser = u;
      if (typeof window.ensureLocalUserForCloudUser === 'function') {
        try { await window.ensureLocalUserForCloudUser(u); } catch (_) { /* 忽略 */ }
      }
      if (window.Auth && typeof window.Auth.updateNavForUser === 'function') window.Auth.updateNavForUser();
      location.hash = '#/profile';
    }, USER_A);
    await expect(page.locator('#__profile_host')).toBeVisible({ timeout: 8000 });
    await expectNavCoveredByFullscreen(page, '__profile_host');

    await page.evaluate(() => { location.hash = '#/profile-no-such-user-xyz'; });
    await expect(page.locator('#__profile_host')).toContainText('未找到该用户', { timeout: 8000 });
    await expectNavCoveredByFullscreen(page, '__profile_host');
  });

  test('未知路由 404 覆盖导航', async ({ page }) => {
    await page.evaluate(() => { location.hash = '#/definitely-not-a-route-777'; });
    await expect(page.locator('#__notfound_host')).toBeVisible({ timeout: 8000 });
    await expectNavCoveredByFullscreen(page, '__notfound_host');
  });
});
