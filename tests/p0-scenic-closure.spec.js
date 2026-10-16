// ============================================================
// tests/p0-scenic-closure.spec.js — 智慧导览三合一闭环收尾
// 覆盖：
//   ① P1-1 智能行程定制：偏好 chips + 时长单选 → 纯规则引擎时间轴
//      （含跨午午餐槽）→「从第一站开始导览」跳景点详情
//   ② P1-5 游客攻略共创（降级版）：空状态 → <10 字拦截 toast →
//      合法提交即展示（标题/正文/作者/时间 + 待审核黄角标）
//   ③ P0-4 景点打卡分享：打卡条出现「分享打卡」→ stub SharePoster
//      断言 downloadPoster 契约参数（title/themeTag/badge/footerCta/Canvas）
//   ④ P0-4 兜底：SharePoster 未加载时点击 → toast 提示稍后再试
// 说明：SharePoster stub 模式参照 p0-mockup.spec.js；
//      联网讲解 mock / clearStorage 惯例参照 culture-features.spec.js
//      （每用例新 context + addInitScript 删库，隔离 scenic_guides /
//      culture_footprints 跨用例状态污染）。
// ============================================================
import { test, expect } from '@playwright/test';

// ---------------- 基础工具（沿用现有 helper 惯例） ----------------

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

// 关闭首次访问欢迎引导弹窗（会拦截底层元素点击）
async function dismissWelcome(page) {
  const btn = page.locator('#welcome-enter');
  try { await btn.click({ timeout: 4000 }); } catch (_) { /* 无弹窗则跳过 */ }
}

async function openApp(page) {
  await page.goto('/');
  await page.waitForSelector('.artwork-card', { timeout: 20000 });
  await dismissWelcome(page);
}

/** mock /api/ai/culture-story（景区/景点联网讲解） */
function mockCultureStory(page, body, status = 200) {
  return page.route('**/api/ai/culture-story', async (route) => {
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

// ============================================================
// ① P1-1 智能行程定制（规则引擎）
// ============================================================
test.describe('智慧导览三合一闭环（P0-4 / P1-1 / P1-5）', () => {
  test('① P1-1 智能行程定制：偏好+时长生成时间轴 → 从第一站开始导览', async ({ page }) => {
    await clearStorage(page.context());
    await mockCultureStory(page, {
      name: '奉先寺卢舍那大佛',
      connotation: '卢舍那大佛是龙门石窟的灵魂。',
      knowledgeBase: false
    });
    await openApp(page);

    await page.goto('/#/scenic?area=longmen');
    const overlay = page.locator('#scenic-recommend-page');
    await overlay.locator('#sn-trip-section').waitFor({ timeout: 10000 });

    // 偏好 chips 来自 routes.theme 聚合（龙门石窟两条主题路线）
    const themeChips = overlay.locator('#sn-trip-theme-chips .sn-chip');
    await expect(themeChips.first()).toBeVisible();
    expect(await themeChips.count()).toBeGreaterThanOrEqual(2);
    // 选第一个偏好（石刻艺术深度游 → 西山精华线）
    await themeChips.first().click();
    // 时长单选：一日 6 小时
    await overlay.locator('#sn-trip-hour-chips .sn-chip[data-hours="6"]').click();
    await overlay.locator('#sn-trip-generate-btn').click();

    // 时间轴行程单：站点含首站宾阳三洞与奉先寺
    await overlay.locator('.sn-trip-plan').waitFor({ timeout: 10000 });
    expect(await overlay.locator('.sn-trip-item').count()).toBeGreaterThanOrEqual(3);
    await expect(overlay.locator('.sn-trip-plan')).toContainText('宾阳三洞');
    await expect(overlay.locator('.sn-trip-plan')).toContainText('奉先寺');
    // 时间槽格式 HH:MM–HH:MM + 每站估算时长
    await expect(overlay.locator('.sn-trip-time').first()).toHaveText(/\d{2}:\d{2}–\d{2}:\d{2}/);
    await expect(overlay.locator('.sn-trip-dur').first()).toContainText('分钟');
    // 一日 6h 跨午 → 自动插入 1 小时午餐槽
    await expect(overlay.locator('.sn-trip-item.lunch')).toHaveCount(1);
    await expect(overlay.locator('.sn-trip-item.lunch')).toContainText('午餐');

    // 「从第一站开始导览」→ 跳转该景点详情（复用现有景点跳转）
    await overlay.locator('#sn-trip-start-btn').click();
    await overlay.locator('.sn-spot-page-name').waitFor({ timeout: 10000 });
    await expect(overlay.locator('.sn-spot-page-name')).toContainText('宾阳三洞');
  });

  test('①-补 P1-1 半日 3h 无偏好：默认推荐景区第一条路线，不空转', async ({ page }) => {
    await clearStorage(page.context());
    await mockCultureStory(page, { name: '龙门石窟', connotation: '龙门石窟是石刻艺术宝库。', knowledgeBase: false });
    await openApp(page);

    await page.goto('/#/scenic?area=longmen');
    const overlay = page.locator('#scenic-recommend-page');
    await overlay.locator('#sn-trip-generate-btn').waitFor({ timeout: 10000 });

    // 不选偏好直接生成 → 默认经典路线（西山精华线：宾阳三洞起步）
    await overlay.locator('#sn-trip-generate-btn').click();
    await overlay.locator('.sn-trip-plan').waitFor({ timeout: 10000 });
    await expect(overlay.locator('.sn-trip-plan')).toContainText('经典路线');
    await expect(overlay.locator('.sn-trip-plan')).toContainText('宾阳三洞');
    // 半日 3h 不跨午 → 无午餐槽
    await expect(overlay.locator('.sn-trip-item.lunch')).toHaveCount(0);
    await expect(overlay.locator('#sn-trip-start-btn')).toBeVisible();
  });

  // ============================================================
  // ② P1-5 游客攻略共创（降级版）
  // ============================================================
  test('② P1-5 攻略共创：提交即展示 + 待审核角标；正文 <10 字被拦截', async ({ page }) => {
    await clearStorage(page.context());
    await mockCultureStory(page, { name: '龙门石窟', connotation: '龙门石窟是石刻艺术宝库。', knowledgeBase: false });
    await openApp(page);

    await page.goto('/#/scenic?area=longmen');
    const overlay = page.locator('#scenic-recommend-page');
    await overlay.locator('#sn-guides-section').waitFor({ timeout: 10000 });

    // 初始空状态
    await overlay.locator('.sn-guide-empty').waitFor({ timeout: 10000 });
    await expect(overlay.locator('.sn-guide-empty')).toContainText('还没有攻略');

    // 正文不足 10 字 → 拦截 toast，列表不新增
    await overlay.locator('#sn-guide-title').fill('龙门半日精华攻略');
    await overlay.locator('#sn-guide-content').fill('太短了');
    await overlay.locator('#sn-guide-submit-btn').click();
    await page.locator('.toast-message').filter({ hasText: '至少写 10 字' }).first().waitFor({ timeout: 5000 });
    await expect(overlay.locator('.sn-guide-item')).toHaveCount(0);

    // 合法提交 → 立即出现在列表（标题 + 待审核黄角标 + 署名/时间）
    await overlay.locator('#sn-guide-content').fill('西山石窟三大必看洞窟一网打尽，下午顺路再逛白园，超值路线分享。');
    await overlay.locator('#sn-guide-submit-btn').click();
    await overlay.locator('.sn-guide-item').waitFor({ timeout: 10000 });
    const item = overlay.locator('.sn-guide-item').first();
    await expect(item).toContainText('龙门半日精华攻略');
    await expect(item).toContainText('西山石窟三大必看洞窟');
    await expect(item.locator('.sn-guide-pending')).toContainText('待审核');
    await expect(item.locator('.sn-guide-item-meta')).toContainText('游客'); // 未登录署名兜底
    await expect(item.locator('.sn-guide-item-meta')).toContainText(/\d{4}-\d{2}-\d{2}/);
    // 仅一条，表单已清空
    await expect(overlay.locator('.sn-guide-item')).toHaveCount(1);
    await expect(overlay.locator('#sn-guide-title')).toHaveValue('');
  });

  // ============================================================
  // ③ / ④ P0-4 景点打卡分享
  // ============================================================
  test('③ P0-4 打卡分享：打卡条「分享打卡」→ SharePoster.downloadPoster 契约参数', async ({ page }) => {
    await clearStorage(page.context());
    await mockCultureStory(page, {
      name: '奉先寺卢舍那大佛',
      connotation: '卢舍那大佛通高17.14米。',
      knowledgeBase: false
    });
    await openApp(page);

    await page.goto('/#/scenic?area=longmen&spot=fengxiansi');
    const overlay = page.locator('#scenic-recommend-page');
    await overlay.locator('.sn-spot-page-name').waitFor({ timeout: 10000 });

    // 浏览即打卡成功 → 打卡条更新且出现「分享打卡」按钮
    await overlay.locator('#sn-checkin-toast').waitFor({ timeout: 10000 });
    await expect(overlay.locator('#sn-checkin-toast')).toContainText('打卡成功');
    const shareBtn = overlay.locator('#sn-share-checkin-btn');
    await expect(shareBtn).toBeVisible();
    await expect(shareBtn).toContainText('分享打卡');

    // 强制注入 SharePoster stub（并行模块加载与否均走同一断言路径）
    await page.evaluate(() => {
      window.__posterCalls = [];
      window.SharePoster = window.SharePoster || {};
      window.SharePoster.downloadPoster = function (opts) {
        window.__posterCalls.push({
          title: opts.title,
          themeTag: opts.themeTag,
          badge: opts.badge,
          footerCta: opts.footerCta,
          isCanvas: !!(opts.image && opts.image.tagName === 'CANVAS')
        });
        return Promise.resolve();
      };
    });
    await shareBtn.click();
    await expect.poll(() => page.evaluate(() => window.__posterCalls.length), { timeout: 10000 }).toBeGreaterThanOrEqual(1);

    const opts = await page.evaluate(() => window.__posterCalls[0]);
    expect(opts.isCanvas).toBe(true);                       // 图片源 = Canvas 打卡卡（景点库无图片字段）
    expect(opts.title).toContain('奉先寺');                  // 景点名
    expect(opts.themeTag).toContain('龙门石窟');              // 所属景区名
    expect(opts.badge).toBe('智慧导览打卡');
    expect(opts.footerCta).toBe('来 Dreamcore 和我一起云游文化中国');
  });

  test('④ P0-4 兜底：SharePoster 未加载时点击 → toast 提示稍后再试', async ({ page }) => {
    await clearStorage(page.context());
    await mockCultureStory(page, { name: '奉先寺卢舍那大佛', connotation: '卢舍那大佛。', knowledgeBase: false });
    await openApp(page);

    await page.goto('/#/scenic?area=longmen&spot=fengxiansi');
    const overlay = page.locator('#scenic-recommend-page');
    await overlay.locator('#sn-share-checkin-btn').waitFor({ timeout: 10000 });

    // 模拟分享海报模块未就绪
    await page.evaluate(() => { delete window.SharePoster; });
    await overlay.locator('#sn-share-checkin-btn').click();
    await page.locator('.toast-message').filter({ hasText: '分享海报模块加载中' }).first().waitFor({ timeout: 5000 });
  });
});
