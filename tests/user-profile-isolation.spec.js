// ============================================================
// tests/user-profile-isolation.spec.js — 用户资料隔离与个人资料页跳转 回归测试
// 覆盖四大系统 Bug 的修复效果：
//   ① 账户头像数据隔离：A 上传自定义头像后切到 B，B 不得继承 A 的头像
//   ② 自定义头像生效：他人视角（作品详情页作者行 / 个人资料页 / 艺术家主页）显示真实头像
//   ③ 个人资料页跳转：点击作品详情页作者头像 → 进入 #/profile-<userId> 而非返回主界面
//   ④ 昵称/简介跨用户端同步：写入后持久化到 users 记录，其他用户端可见且按账户隔离
// ============================================================
import { test, expect } from '@playwright/test';

// 两个隔离账户（模拟 Supabase 云端登录态：id 为 UUID 字符串）
const USER_A = {
  id: 'iso-uuid-aaaa-0001',
  username: 'admin',
  email: 'admin@test.app',
  isAdmin: true,
  role: 'admin',
  createdAt: '2026-01-01T00:00:00.000Z'
};
const USER_B = {
  id: 'iso-uuid-bbbb-0002',
  username: 'h.c',
  email: 'hc@test.app',
  isAdmin: false,
  role: 'user',
  createdAt: '2026-02-01T00:00:00.000Z'
};

const AVATAR_A = 'data:image/png;base64,AAAA-AVATAR-A';
const AVATAR_B = 'data:image/png;base64,BBBB-AVATAR-B';
const NICK_A = '管理员小A';
const BIO_A = '热爱敦煌，想用 AI 复刻莫高窟壁画。';

/** 清空 localStorage + IndexedDB，保证每个用例从零开始，避免历史脏数据干扰 */
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
 * 模拟登录：注入 currentUser → 建/取本地 users 记录 → 走真实回灌逻辑
 * （等价于 Auth._ensureLocalUser 登录路径，避免测试绕过被测代码）
 */
async function loginAs(page, user) {
  await page.evaluate(async (u) => {
    window.currentUser = u;
    if (typeof window.ensureLocalUserForCloudUser === 'function') {
      try { await window.ensureLocalUserForCloudUser(u); } catch (_) { /* 忽略 */ }
    }
    if (window.Settings && typeof window.Settings.hydrateUserProfile === 'function') {
      await window.Settings.hydrateUserProfile(window.currentUser);
    }
    if (window.Auth && typeof window.Auth.updateNavForUser === 'function') {
      window.Auth.updateNavForUser();
    }
  }, user);
}

/** 模拟登出（与 Auth.handleLogout 一致：清空登录态，不动账户级键——它们本就按 userId 隔离） */
async function logout(page) {
  await page.evaluate(() => {
    window.currentUser = null;
    try { localStorage.removeItem('currentUser'); } catch (_) { /* 忽略 */ }
    if (window.Auth && typeof window.Auth.updateNavForUser === 'function') {
      window.Auth.updateNavForUser();
    }
  });
}

/** 读取当前账户级设置（走真实 getSetting，验证隔离键生效） */
function readSetting(page, key) {
  return page.evaluate((k) => (window.Settings ? window.Settings.getSetting(k) : null), key);
}

test.beforeEach(async ({ page }) => {
  await clearStorage(page.context());
  await page.goto('/');
  await page.waitForSelector('.artwork-card', { timeout: 25000 });
  await dismissWelcome(page);
});

test.describe('① 账户头像数据隔离', () => {
  test('A 设置自定义头像后切换到 B，B 不继承 A 的头像（Bug #1）', async ({ page }) => {
    await loginAs(page, USER_A);
    await page.evaluate((url) => {
      window.Settings.setSetting('avatar', { type: 'custom', dataURL: url });
    }, AVATAR_A);

    // A 的导航栏头像应为自定义头像
    await expect(page.locator('#user-avatar-btn img.avatar-img')).toHaveAttribute('src', AVATAR_A);

    await logout(page);
    await loginAs(page, USER_B);

    // B 的导航栏不得出现 A 的 dataURL
    const bHtml = await page.locator('#user-avatar-btn').innerHTML();
    expect(bHtml).not.toContain(AVATAR_A);
    expect(bHtml).not.toContain('AAAA-AVATAR-A');

    // 账户级存储键按 userId 隔离，各存各的
    const store = await page.evaluate(({ idA, idB }) => ({
      a: localStorage.getItem(`dreamcore-avatar-u-${idA}`),
      b: localStorage.getItem(`dreamcore-avatar-u-${idB}`),
      legacy: localStorage.getItem('dreamcore-avatar')
    }), { idA: USER_A.id, idB: USER_B.id });
    expect(store.a).toContain('AAAA-AVATAR-A');
    expect(store.b || '').not.toContain('AAAA-AVATAR-A');
    // 历史全局键已被清理，不再作为共享存储位
    expect(store.legacy).toBeNull();
  });

  test('bio/tags 键独立：不同账户读写互不覆盖（Bug #4）', async ({ page }) => {
    await loginAs(page, USER_A);
    await page.evaluate(async ({ id, bio, tags }) => {
      await window.updateUser(id, { bio, tags });
      await window.Settings.hydrateUserProfile(window.currentUser);
    }, { id: USER_A.id, bio: 'A 的简介', tags: ['敦煌'] });

    await logout(page);
    await loginAs(page, USER_B);
    await page.evaluate(async ({ id, bio }) => {
      await window.updateUser(id, { bio });
      await window.Settings.hydrateUserProfile(window.currentUser);
    }, { id: USER_B.id, bio: 'B 的简介' });

    expect(await readSetting(page, 'bio')).toBe('B 的简介');

    // 切回 A：读到的是 A 自己的简介，未被 B 覆盖
    await logout(page);
    await loginAs(page, USER_A);
    expect(await readSetting(page, 'bio')).toBe('A 的简介');
    expect(await readSetting(page, 'tags')).toEqual(['敦煌']);
    // bio 与 tags 不再共用 dreamcore-undefined 脏键
    const polluted = await page.evaluate(() => localStorage.getItem('dreamcore-undefined'));
    expect(polluted).toBeNull();
  });
});

test.describe('② 自定义头像在他人端生效', () => {
  test('他人打开 A 的作品详情页，作者行显示 A 的自定义头像与昵称（Bug #2）', async ({ page }) => {
    // A 建作品 + 设置自定义资料（直接落 users 记录，等价于设置页的 _syncProfileToBackend）
    const artId = await page.evaluate(async ({ u, url, nick, bio }) => {
      await window.ensureLocalUserForCloudUser(u);
      await window.updateUser(u.id, { avatar: { type: 'custom', dataURL: url }, nickname: nick, bio });
      const art = await window.addArtwork({
        title: '回归·绿野',
        author: u.username,
        userId: u.id,
        category: 'photography',
        imageUrl: 'data:image/png;base64,ZZZZ',
        description: '隔离测试作品',
        tags: []
      });
      return art.id;
    }, { u: USER_A, url: AVATAR_A, nick: NICK_A, bio: BIO_A });

    // B 登录后查看 A 的作品
    await loginAs(page, USER_B);
    await page.evaluate((id) => window.Gallery.openLightbox(id), artId);
    await page.waitForSelector('.lb-author', { timeout: 10000 });

    // 作者行头像为真实自定义头像（而非首字符色块）
    await expect(page.locator('.lb-author .avatar-circle.avatar-img')).toHaveAttribute('src', AVATAR_A);
    // 作者名显示 A 的昵称
    await expect(page.locator('.lb-author-name')).toHaveText(NICK_A);
  });

  test('个人资料页与艺术家主页渲染真实头像（Bug #2）', async ({ page }) => {
    await page.evaluate(async ({ u, url, nick, bio }) => {
      await window.ensureLocalUserForCloudUser(u);
      await window.updateUser(u.id, { avatar: { type: 'custom', dataURL: url }, nickname: nick, bio });
    }, { u: USER_A, url: AVATAR_A, nick: NICK_A, bio: BIO_A });

    await loginAs(page, USER_B);

    // 艺术家主页弹窗
    await page.evaluate((id) => window.Artist.openByUserId(id), USER_A.id);
    await page.waitForSelector('#artist-modal .artist-avatar-wrap', { timeout: 10000 });
    await expect(page.locator('#artist-modal .artist-avatar-wrap .avatar-img')).toHaveAttribute('src', AVATAR_A);
    await page.evaluate(() => window.Artist._close && window.Artist._close());
  });
});

test.describe('③ 个人资料页跳转', () => {
  test('点击作品详情页作者头像 → 进入该用户个人资料页；不存在则友好提示（Bug #3）', async ({ page }) => {
    const artId = await page.evaluate(async ({ u, url, nick, bio }) => {
      await window.ensureLocalUserForCloudUser(u);
      await window.updateUser(u.id, { avatar: { type: 'custom', dataURL: url }, nickname: nick, bio });
      const art = await window.addArtwork({
        title: '回归·跳转',
        author: u.username,
        userId: u.id,
        category: 'photography',
        imageUrl: 'data:image/png;base64,ZZZZ',
        description: '跳转测试作品',
        tags: []
      });
      return art.id;
    }, { u: USER_A, url: AVATAR_A, nick: NICK_A, bio: BIO_A });

    await loginAs(page, USER_B);
    await page.evaluate((id) => window.Gallery.openLightbox(id), artId);
    await page.waitForSelector('.lb-author', { timeout: 10000 });

    await page.locator('.lb-author').click();

    // 路由切换到 #/profile-<A id>，且渲染的是 A 的资料（而不是"回到主界面"）
    await expect.poll(
      () => page.evaluate(() => location.hash),
      { timeout: 8000 }
    ).toBe(`#/profile-${encodeURIComponent(USER_A.id)}`);

    const host = page.locator('#__profile_host');
    await expect(host).toBeVisible({ timeout: 8000 });
    await expect(host.locator('h1')).toHaveText(NICK_A);
    await expect(host).toContainText(BIO_A);
    await expect(host.locator('.avatar-circle.avatar-img')).toHaveAttribute('src', AVATAR_A);
    // 他人主页不显示邮箱/编辑资料入口（隐私与权限）
    await expect(host).not.toContainText('编辑资料');

    // 目标用户不存在 → 明确提示，不静默跳回首页
    await page.evaluate(() => { location.hash = '#/profile-no-such-user-999'; });
    await expect(host).toContainText('未找到该用户', { timeout: 8000 });
  });

  test('本人 #/profile 仍渲染个人中心并保留管理入口', async ({ page }) => {
    await page.evaluate(async ({ u }) => {
      await window.ensureLocalUserForCloudUser(u);
    }, { u: USER_A });
    await loginAs(page, USER_A);
    await page.evaluate(() => { location.hash = '#/profile'; });

    const host = page.locator('#__profile_host');
    await expect(host).toBeVisible({ timeout: 8000 });
    await expect(host).toContainText('编辑资料');
    await expect(host).toContainText('admin');
  });
});

test.describe('④ 昵称/个人简介跨用户端同步', () => {
  test('A 修改昵称/简介后，B 端打开 A 个人资料页可见新值（Bug #4）', async ({ page }) => {
    await page.evaluate(async ({ u }) => {
      await window.ensureLocalUserForCloudUser(u);
    }, { u: USER_A });

    // A 登录并修改昵称/简介（等价于设置页 → setSetting + _syncProfileToBackend）
    await loginAs(page, USER_A);
    await page.evaluate(async ({ id, nick, bio }) => {
      window.Settings.setSetting('nickname', nick);
      window.Settings.setSetting('bio', bio);
      await window.updateUser(id, { nickname: nick, bio });
    }, { id: USER_A.id, nick: '云艺·A', bio: '更新后的简介：非遗数字化创作者' });

    // B 端查看 A 的个人资料页 → 应看到 A 的新昵称/简介
    await logout(page);
    await loginAs(page, USER_B);
    await page.evaluate((id) => { location.hash = `#/profile-${encodeURIComponent(id)}`; }, USER_A.id);

    const host = page.locator('#__profile_host');
    await expect(host.locator('h1')).toHaveText('云艺·A', { timeout: 8000 });
    await expect(host).toContainText('更新后的简介：非遗数字化创作者');

    // B 自己的设置值不受影响（隔离）
    expect(await readSetting(page, 'nickname')).not.toBe('云艺·A');
  });
});

test.describe('⑤ 他人个人资料页「返回首页」（Bug #5）', () => {
  test('从 #/profile-<他人> 点击「返回首页」回到 #/ 并正常渲染首页', async ({ page }) => {
    await page.evaluate(async ({ u }) => {
      await window.ensureLocalUserForCloudUser(u);
    }, { u: USER_A });
    await loginAs(page, USER_B);
    await page.evaluate((id) => { location.hash = `#/profile-${encodeURIComponent(id)}`; }, USER_A.id);

    const host = page.locator('#__profile_host');
    await expect(host).toBeVisible({ timeout: 8000 });
    await expect(host).toContainText('返回首页');

    await host.getByRole('link', { name: '返回首页' }).first().click();

    // 回到首页路由（此前会落到 notFound：标题变「页面未找到」且无任何反应）
    await expect.poll(() => page.evaluate(() => location.hash), { timeout: 8000 }).toBe('#/');
    await expect.poll(() => page.title(), { timeout: 8000 }).not.toContain('页面未找到');
    // 个人资料页 host 被移除，首页作品墙重新可见
    await expect(page.locator('#__profile_host')).toHaveCount(0);
    await expect(page.locator('.artwork-card').first()).toBeVisible({ timeout: 8000 });
  });

  test('其他入口（未找到该用户卡片）的「返回首页」同样可用', async ({ page }) => {
    await loginAs(page, USER_B);
    await page.evaluate(() => { location.hash = '#/profile-no-such-user-777'; });
    const host = page.locator('#__profile_host');
    await expect(host).toContainText('未找到该用户', { timeout: 8000 });

    const backLink = host.getByRole('link', { name: '返回首页' }).first();
    await backLink.scrollIntoViewIfNeeded();
    await backLink.click();

    // 回到首页路由，且不再落到 notFound（此前会变「页面未找到」）
    await expect.poll(() => page.evaluate(() => location.hash), { timeout: 8000 }).toBe('#/');
    await expect.poll(() => page.title(), { timeout: 8000 }).not.toContain('页面未找到');
    // 先等个人资料浮层（z-index 9998 全屏层）确定被移除，再断言首页恢复，
    // 避免 hashchange 与 DOM 清理之间的渲染时序竞争（该用例曾在 Desktop 首次偶发失败）
    await expect(host).toHaveCount(0, { timeout: 8000 });
    await expect(page.locator('.artwork-card').first()).toBeVisible({ timeout: 8000 });
  });
});

test.describe('⑥ 评论区/排行榜头像按账户统一渲染', () => {
  test('评论者设置自定义头像后，他人端评论区显示其真实头像', async ({ page }) => {
    const artId = await page.evaluate(async ({ u, url }) => {
      await window.ensureLocalUserForCloudUser(u);
      const art = await window.addArtwork({
        title: '回归·评论头像',
        author: u.username,
        userId: u.id,
        category: 'photography',
        imageUrl: 'data:image/png;base64,ZZZZ',
        description: '评论头像测试',
        tags: []
      });
      await window.updateUser(u.id, { avatar: { type: 'custom', dataURL: url } });
      await window.addComment(art.id, u.id, u.username, '敦煌配色真美');
      return art.id;
    }, { u: USER_A, url: AVATAR_A });

    await loginAs(page, USER_B);
    await page.evaluate((id) => window.Gallery.openLightbox(id), artId);

    // 评论区首条评论的头像为 A 的自定义头像（此前恒为首字符色块）
    await expect(page.locator('#lb-comment-list .comment-item .avatar-circle.avatar-img'))
      .toHaveAttribute('src', AVATAR_A, { timeout: 10000 });
    await expect(page.locator('#lb-comment-list .comment-user').first()).toHaveText(USER_A.username);
  });

  test('排行榜按 userId（含云端 UUID）关联真实头像并识别「我」', async ({ page }) => {
    await page.evaluate(async ({ u, url }) => {
      await window.ensureLocalUserForCloudUser(u);
      await window.updateUser(u.id, { avatar: { type: 'custom', dataURL: url } });
      await window.addArtwork({
        title: '回归·榜单头像',
        author: u.username,
        userId: u.id,
        category: 'photography',
        imageUrl: 'data:image/png;base64,ZZZZ',
        description: '排行榜头像测试',
        tags: []
      });
    }, { u: USER_A, url: AVATAR_A });

    await loginAs(page, USER_A);
    await page.evaluate(() => { window.location.hash = '#/leaderboard'; });
    await page.waitForSelector('#lb-body .lb-row, #lb-body .lb-podium-item', { timeout: 20000 });

    // 榜单中出现 A 的自定义头像
    const hasCustomAvatar = await page.evaluate((src) =>
      Array.from(document.querySelectorAll('#lb-body img')).some(i => i.src === src), AVATAR_A);
    expect(hasCustomAvatar).toBe(true);

    // UUID 账户需被正确识别为「我」（旧实现用 Number(uuid) 比较 → NaN，永远识别不到）
    await expect(page.locator('#lb-body')).toContainText('我的排名');
  });
});
