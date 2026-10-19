// ============================================================
// tests/artwork-visibility.spec.js — 作品状态可见性回归
// 缺陷背景：后台把作品「下架」（status=rejected）后，画廊不再显示，
//   但「作品搜索」与「个人中心」仍然能看到 —— 读取侧各自为政、无统一收口。
// 修复：db.js 建立可见性单一事实来源
//   · getPublicArtworks()  仅 published（+ 历史无 status 存量）对外可见
//   · getUserArtworks()    排除 rejected / deleted（保留 pending，作者可见"审核中"）
// 覆盖：
//   ① 数据层：可见性判定语义正确（含历史存量无 status 的兼容）
//   ② 三视图一致：画廊 / 搜索 / 个人中心对外一致（published 可见，rejected 不可见）
//   ③ 可恢复：下架 → 三处不可见；恢复发布 → 三处重新可见
// ============================================================
import { test, expect } from '@playwright/test';

// 1x1 透明 PNG
const IMG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const UID = 'vis-uuid-0001';
const T_PUB = '星河入梦';   // published → 处处可见
const T_REJ = '暮染雪峰';   // rejected  → 仅后台可见
const T_PEND = '青竹听雨';  // pending   → 个人中心可见 / 公开不可见

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

async function openApp(page) {
  await page.goto('/');
  await page.waitForSelector('.artwork-card', { timeout: 25000 });
  try { await page.locator('#welcome-enter').click({ timeout: 4000 }); } catch (_) { /* 无弹窗则跳过 */ }
}

/** 注入登录态（等价 Auth._ensureLocalUser 登录路径），并落作品 */
async function loginAndSeed(page, specs) {
  return page.evaluate(async ({ uid, img, specs }) => {
    window.currentUser = { id: uid, username: 'vis-tester', role: 'user', isAdmin: false, createdAt: '2026-01-01T00:00:00.000Z' };
    if (typeof window.ensureLocalUserForCloudUser === 'function') {
      try { await window.ensureLocalUserForCloudUser(window.currentUser); } catch (_) { /* 忽略 */ }
    }
    const out = {};
    for (const [key, s] of Object.entries(specs)) {
      const a = await window.addArtwork({
        title: s.title, author: 'vis-tester', userId: uid, category: 'scenic-photo',
        imageUrl: img, description: s.title, tags: [], status: s.status
      });
      out[key] = a.id;
    }
    return out;
  }, { uid: UID, img: IMG, specs });
}

/** 断言三视图可见性：gallery / search / profile */
async function expectVisibleInAll(page, title, expectVisible) {
  // 画廊
  await page.evaluate(() => window.Gallery.refreshGallery());
  const cardLoc = page.locator('.artwork-card .card-title', { hasText: title });
  if (expectVisible) await expect(cardLoc.first()).toBeVisible({ timeout: 10000 });
  else await expect(cardLoc).toHaveCount(0, { timeout: 10000 });

  // 搜索
  await page.evaluate(() => window.Search.showSearchBar());
  await page.fill('#search-input', title);
  const results = page.locator('#search-results');
  if (expectVisible) await expect(results).toContainText(title, { timeout: 8000 });
  else await expect(results).not.toContainText(title, { timeout: 8000 });
  await page.evaluate(() => window.Search._close && window.Search._close());

  // 个人中心（路由 host 只在路由切换时重建：先回首页清掉 host，再进 profile 取最新数据）
  await page.evaluate(() => { location.hash = '#/'; });
  await expect(page.locator('#__profile_host')).toHaveCount(0, { timeout: 8000 });
  await page.evaluate(() => { location.hash = '#/profile'; });
  const host = page.locator('#__profile_host');
  await expect(host).toBeVisible({ timeout: 10000 });
  if (expectVisible) await expect(host).toContainText(title, { timeout: 8000 });
  else await expect(host).not.toContainText(title, { timeout: 8000 });
}

test.describe('① 数据层：可见性单一事实来源', () => {
  test('isPublicArtwork / isOwnerVisibleArtwork 语义正确，历史存量无 status 兼容', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);
    await loginAndSeed(page, {
      pub: { title: T_PUB, status: 'published' },
      rej: { title: T_REJ, status: 'rejected' },
      pend: { title: T_PEND, status: 'pending' }
    });

    const r = await page.evaluate(async ({ uid, T_PUB, T_REJ, T_PEND }) => {
      const pub = await window.getPublicArtworks();
      const mine = await window.getUserArtworks(uid);
      const db = await import('/js/db.js');
      return {
        pubTitles: pub.map(a => a.title),
        mineTitles: mine.map(a => a.title),
        // 纯函数：历史存量记录（无 status 字段）应视为公开可见
        legacyPublic: db.isPublicArtwork({ title: 'legacy' }),
        legacyOwner: db.isOwnerVisibleArtwork({ title: 'legacy' }),
        rejectedPublic: db.isPublicArtwork({ status: 'rejected' })
      };
    }, { uid: UID, T_PUB, T_REJ, T_PEND });

    // 对外公开：仅 published
    expect(r.pubTitles).toContain(T_PUB);
    expect(r.pubTitles).not.toContain(T_REJ);
    expect(r.pubTitles).not.toContain(T_PEND);

    // 作者本人可见：排除 rejected，保留 pending（作者能看到"审核中"）
    expect(r.mineTitles).toContain(T_PUB);
    expect(r.mineTitles).toContain(T_PEND);
    expect(r.mineTitles).not.toContain(T_REJ);

    // 历史存量无 status → 公开可见；rejected → 公开不可见
    expect(r.legacyPublic).toBe(true);
    expect(r.legacyOwner).toBe(true);
    expect(r.rejectedPublic).toBe(false);
  });
});

test.describe('② 三视图一致：后台下架后全站同步', () => {
  test('已发布处处可见；下架作品画廊/搜索/个人中心三处均不可见；待审核仅个人中心可见', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);
    await loginAndSeed(page, {
      pub: { title: T_PUB, status: 'published' },
      rej: { title: T_REJ, status: 'rejected' },
      pend: { title: T_PEND, status: 'pending' }
    });

    // 已发布：三处可见
    await expectVisibleInAll(page, T_PUB, true);
    // 已下架：三处均不可见（本次缺陷的核心断言）
    await expectVisibleInAll(page, T_REJ, false);
    // 待审核：对外不可见（不在画廊/搜索），但作者本人在个人中心可见
    await page.evaluate(() => window.Gallery.refreshGallery());
    await expect(page.locator('.artwork-card .card-title', { hasText: T_PEND })).toHaveCount(0, { timeout: 10000 });
    await page.evaluate(() => { location.hash = '#/'; });
    await expect(page.locator('#__profile_host')).toHaveCount(0, { timeout: 8000 });
    await page.evaluate(() => { location.hash = '#/profile'; });
    const host2 = page.locator('#__profile_host');
    await expect(host2).toContainText(T_PEND, { timeout: 10000 });
  });
});

test.describe('③ 可恢复：下架 → 恢复发布', () => {
  test('下架后三处不可见，恢复发布后三处重新可见', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);
    const ids = await loginAndSeed(page, { pub: { title: T_PUB, status: 'published' } });

    // 初始可见
    await expectVisibleInAll(page, T_PUB, true);

    // 下架（等价后台 _setArtStatus(id, 'rejected') 的本地写）
    await page.evaluate((id) => window.updateArtwork(id, { status: 'rejected' }), ids.pub);
    await expectVisibleInAll(page, T_PUB, false);

    // 恢复发布
    await page.evaluate((id) => window.updateArtwork(id, { status: 'published' }), ids.pub);
    await expectVisibleInAll(page, T_PUB, true);
  });
});
