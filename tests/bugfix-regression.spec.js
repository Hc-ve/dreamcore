// ============================================================
// tests/bugfix-regression.spec.js — 四大功能异常修复回归测试
// 覆盖：
//   ① 新注册用户在 AI修图/AI评分/AI文创 的「我的作品」不得显示全局作品
//   ② 列表卡片与灯箱详情点赞数一致；点赞后两处同步
//   ③ 登录状态下关注艺术家不提示"未登录"，关注成功且计数落库
//   ④ 个人主页/艺术家主页数据真实（无随机数），模块间数据互通
// ============================================================
import { test, expect } from '@playwright/test';

// 测试用云端风格用户（UUID id，模拟 Supabase 登录后的 currentUser）
const TEST_USER = {
  id: 'reg-test-uuid-0001',
  username: '回归测试用户',
  email: 'reg@test.app',
  isAdmin: false,
  role: 'user',
  createdAt: new Date().toISOString()
};

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

// 模拟已登录：等待应用初始化完成后注入 currentUser 并同步本地用户记录
async function loginAs(page, user = TEST_USER) {
  await page.evaluate(async (u) => {
    window.currentUser = u;
    if (typeof window.ensureLocalUserForCloudUser === 'function') {
      await window.ensureLocalUserForCloudUser(u);
    }
  }, user);
}

// 关闭首次访问欢迎引导弹窗（会拦截底层元素点击）
async function dismissWelcome(page) {
  const btn = page.locator('#welcome-enter');
  try { await btn.click({ timeout: 4000 }); } catch (_) { /* 无弹窗则跳过 */ }
}

// 复刻前端 _fmtNum 格式化（≥10000 → x.xw，≥1000 → x.xk）
function fmtNum(n) {
  n = Number(n) || 0;
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

test.describe('回归① 新注册用户「我的作品」数据一致性', () => {
  for (const route of ['#/score', '#/edit', '#/craft']) {
    test(`无作品用户在 ${route} 选择器看到空态而非全局作品`, async ({ page }) => {
      await clearStorage(page.context());
      await page.goto('/');
      await page.waitForSelector('.artwork-card', { timeout: 20000 });
      await loginAs(page);

      await page.goto('/' + route);
      // #/score 页需切到「已发布作品」Tab 并点击「选择已发布作品」；#/edit、#/craft 路由自动弹出
      const mineTab = page.locator('.sp-tab[data-tab="mine"]');
      if (await mineTab.count()) await mineTab.first().click();
      const pickBtn = page.locator('#sp-pick-btn');
      if (await pickBtn.count()) await pickBtn.first().click();
      const picker = page.locator('#artwork-picker-modal');
      await expect(picker).toBeVisible({ timeout: 10000 });

      // 「我的作品」tab 处于选中状态
      const apMineTab = picker.locator('.ap-tab[data-tab="mine"]');
      await expect(apMineTab).toHaveClass(/active/);

      // 网格应为空态提示，不渲染任何作品卡
      await expect(picker.locator('.ap-empty')).toBeVisible({ timeout: 10000 });
      const cardCount = await picker.locator('.ap-card').count();
      expect(cardCount).toBe(0);
    });
  }

  test('未登录时「我的作品」提示登录而非展示作品', async ({ page }) => {
    await clearStorage(page.context());
    await page.goto('/');
    await page.waitForSelector('.artwork-card', { timeout: 20000 });

    await page.goto('/#/score');
    const scoreMineTab = page.locator('.sp-tab[data-tab="mine"]');
    if (await scoreMineTab.count()) await scoreMineTab.first().click();
    const pickBtn = page.locator('#sp-pick-btn');
    if (await pickBtn.count()) await pickBtn.first().click();
    const picker = page.locator('#artwork-picker-modal');
    await expect(picker).toBeVisible({ timeout: 10000 });
    await expect(picker.locator('.ap-empty')).toContainText('登录', { timeout: 10000 });
    const cardCount = await picker.locator('.ap-card').count();
    expect(cardCount).toBe(0);
  });
});

test.describe('回归② 点赞数据一致性（列表 vs 详情）', () => {
  test('卡片与灯箱点赞数一致，点赞后两处同步更新', async ({ page }) => {
    await clearStorage(page.context());
    await page.goto('/');
    await page.waitForSelector('.artwork-card', { timeout: 20000 });
    await dismissWelcome(page);

    // 选取第一张有点赞数的卡片
    const card = page.locator('.artwork-card').first();
    await card.waitFor();
    const cardInfo = await card.evaluate(el => ({
      id: parseInt(el.dataset.id, 10),
      likes: parseInt(el.dataset.likes || '0', 10) || 0
    }));
    const artId = cardInfo.id;
    const before = cardInfo.likes;
    expect(before).toBeGreaterThan(0); // 种子作品应带初始热度

    // 打开灯箱，详情页点赞数应与列表一致（此前 bug：列表946/详情0）
    await card.click();
    const lb = page.locator('#lightbox-modal');
    await expect(lb).toBeVisible({ timeout: 10000 });
    await expect(lb.locator('.lb-like-count')).toHaveText(fmtNum(before), { timeout: 10000 });

    // 登录并点赞：详情页 +1，且数据实时写入 IndexedDB
    await loginAs(page);
    await lb.locator('#lb-like-btn').click();
    await expect(lb.locator('.lb-like-count')).toHaveText(fmtNum(before + 1), { timeout: 10000 });

    // 数据库层校验：作品记录 likes = 基线 + 记录数；点赞记录存在
    const dbState = await page.evaluate(async ([id, uid]) => {
      const art = await window.getArtworkById(id);
      const recCount = await window.getLikes(id);
      const liked = await window.hasUserLiked(id, uid);
      return { likes: art.likes, baseLikes: art.baseLikes, recCount, liked };
    }, [artId, TEST_USER.id]);
    expect(dbState.liked).toBe(true);
    expect(dbState.recCount).toBe(1);
    expect(dbState.likes).toBe(dbState.baseLikes + 1);
    expect(dbState.likes).toBe(before + 1);

    // 关闭灯箱回到列表：卡片同步为新计数
    await lb.locator('[data-lb-close]').click();
    await page.waitForTimeout(400);
    const cardAfter = await page.evaluate((id) => {
      const el = document.querySelector(`.artwork-card[data-id="${id}"]`);
      return parseInt(el.dataset.likes || '0', 10);
    }, artId);
    expect(cardAfter).toBe(before + 1);
  });
});

test.describe('回归③ 登录状态下的关注功能', () => {
  test('登录用户关注虚拟艺术家成功，不再提示登录', async ({ page }) => {
    await clearStorage(page.context());
    await page.goto('/');
    await page.waitForSelector('.artwork-card', { timeout: 20000 });
    await loginAs(page);

    // 打开种子艺术家主页（此前 bug：点击关注弹出"登录后可以关注注册艺术家哦"）
    await page.evaluate(() => window.Artist.openByAuthorName('陈墨白'));
    const modal = page.locator('#artist-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    // 关注前粉丝数（真实数据，应为 follows 表实际计数）
    const followersBefore = await modal.locator('#artist-stat-followers').innerText();

    await modal.locator('#artist-follow-btn').click();
    await expect(modal.locator('#artist-follow-text')).toHaveText('已关注', { timeout: 10000 });
    await expect(modal.locator('#artist-stat-followers')).not.toHaveText(followersBefore, { timeout: 10000 });

    // 不出现登录误导提示
    const toastText = await page.evaluate(() => {
      const t = document.querySelector('.toast, .toast-msg, [class*="toast"]');
      return t ? t.innerText : '';
    });
    expect(toastText).not.toContain('登录');

    // 数据库层校验：follows 记录真实落库
    const followState = await page.evaluate(async (uid) => {
      const artistUser = await window.getUserByUsername('陈墨白');
      const following = await window.isFollowing(uid, artistUser.id);
      const followers = await window.getFollowersCount(artistUser.id);
      return { following, followers, artistId: artistUser.id };
    }, TEST_USER.id);
    expect(followState.following).toBe(true);
    expect(followState.followers).toBeGreaterThan(0);
  });

  test('已登录用户自己的关注列表（个人主页）包含刚关注的艺术家', async ({ page }) => {
    await clearStorage(page.context());
    await page.goto('/');
    await page.waitForSelector('.artwork-card', { timeout: 20000 });
    await loginAs(page);

    // 关注后再打开个人主页，关注数与列表互通
    await page.evaluate(async (u) => {
      const artistUser = await window.ensureVirtualArtist('陈墨白');
      await window.toggleFollow(u.id, artistUser.id);
    }, TEST_USER);

    await page.evaluate(() => window.showProfile());
    const profile = page.locator('#profile-modal');
    await expect(profile).toBeVisible({ timeout: 10000 });
    // 关注统计 = 1（真实记录计数）
    await expect(profile.locator('#stat-following')).toHaveText('1', { timeout: 10000 });
  });
});

test.describe('回归④ 个人主页数据真实性', () => {
  test('无作品用户个人主页全部统计为0且展示空态', async ({ page }) => {
    await clearStorage(page.context());
    await page.goto('/');
    await page.waitForSelector('.artwork-card', { timeout: 20000 });
    await loginAs(page);

    await page.evaluate(() => window.showProfile());
    const profile = page.locator('#profile-modal');
    await expect(profile).toBeVisible({ timeout: 10000 });

    // 无作品用户：作品0 / 收藏0 / 获赞0 / 关注0（与截图1一致，且不再有假数据）
    await expect(profile.locator('#stat-works')).toHaveText('0', { timeout: 10000 });
    await expect(profile.locator('#stat-favs')).toHaveText('0');
    await expect(profile.locator('#stat-likes')).toHaveText('0');
    await expect(profile.locator('#stat-following')).toHaveText('0');
    await expect(profile.locator('.profile-empty')).toContainText('还没有发布作品');
  });

  test('虚拟艺术家主页数据为真实统计（无随机数）且可复现', async ({ page }) => {
    await clearStorage(page.context());
    await page.goto('/');
    await page.waitForSelector('.artwork-card', { timeout: 20000 });

    await page.evaluate(() => window.Artist.openByAuthorName('陈墨白'));
    const modal = page.locator('#artist-modal');
    await expect(modal).toBeVisible({ timeout: 10000 });

    const stats1 = await modal.evaluate((el) => ({
      works: el.querySelector('#artist-stat-works').innerText,
      likes: el.querySelector('#artist-stat-likes').innerText,
      followers: el.querySelector('#artist-stat-followers').innerText,
      following: el.querySelector('#artist-stat-following').innerText
    }));

    // 与真实数据源对账：作品数 = 该作者名下作品总数；获赞 = 作品点赞总和（同格式化）
    const expected = await page.evaluate(async () => {
      const arts = await window.getArtworksByAuthorName('陈墨白');
      return {
        works: arts.length,
        likes: arts.reduce((s, a) => s + (a.likes || 0), 0)
      };
    });
    expect(stats1.works).toBe(fmtNum(expected.works));
    expect(stats1.likes).toBe(fmtNum(expected.likes));
    // 新建虚拟艺术家记录：粉丝/关注为真实空数据（此前为随机数 3.7k 等）
    expect(stats1.followers).toBe('0');
    expect(stats1.following).toBe('0');

    // 再次打开：数据可复现（无随机性）
    await modal.locator('[data-close]').click();
    await page.waitForTimeout(400);
    await page.evaluate(() => window.Artist.openByAuthorName('陈墨白'));
    await expect(page.locator('#artist-modal')).toBeVisible({ timeout: 10000 });
    const stats2 = await page.locator('#artist-modal').evaluate((el) => ({
      works: el.querySelector('#artist-stat-works').innerText,
      followers: el.querySelector('#artist-stat-followers').innerText
    }));
    expect(stats2.works).toBe(stats1.works);
    expect(stats2.followers).toBe(stats1.followers);
  });

  test('云端用户本地记录同步：ensureLocalUserForCloudUser 幂等可查', async ({ page }) => {
    await clearStorage(page.context());
    await page.goto('/');
    await page.waitForSelector('.artwork-card', { timeout: 20000 });

    const state = await page.evaluate(async (u) => {
      await window.ensureLocalUserForCloudUser(u);
      const rec = await window.getUserById(u.id);
      // 幂等：再次执行不报错不重复
      await window.ensureLocalUserForCloudUser(u);
      const rec2 = await window.getUserById(u.id);
      return { exists: !!rec, username: rec && rec.username, stable: !!rec2 && rec2.id === rec.id };
    }, TEST_USER);
    expect(state.exists).toBe(true);
    expect(state.username).toBe(TEST_USER.username);
    expect(state.stable).toBe(true);
  });
});
