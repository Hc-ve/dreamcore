// ============================================================
// tests/admin-p0.spec.js — P0 修复回归：admin 深链 + 文创衍生品 KPI
// 覆盖：
//   ① #/admin / #admin 深链直达管理后台浮层
//   ② Admin「数据看板」Tab 中文创衍生品 KPI 从 orders 表聚合
// 说明：通过 page.evaluate 设置管理员态，不依赖真实登录接口。
// ============================================================
import { test, expect } from '@playwright/test';

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
  await page.waitForSelector('.artwork-card', { timeout: 20000 });
  try { await page.locator('#welcome-enter').click({ timeout: 4000 }); } catch (_) { /* 无弹窗则跳过 */ }
}

/** 在页面内设置当前用户为管理员（绕过登录） */
async function setAdminUser(page) {
  await page.evaluate(() => {
    window.currentUser = { id: 1, username: 'admin', isAdmin: true, role: 'superadmin' };
  });
}

// ============================================================
// ① #/admin 深链直达
// ============================================================
test.describe('P0 admin hash 直链浮层', () => {
  test('#/admin 深链自动打开管理后台浮层', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);
    await setAdminUser(page);

    await page.goto('/#/admin');
    const modal = page.locator('#admin-modal');
    await modal.waitFor({ timeout: 15000 });
    await expect(modal).toBeVisible();
    await expect(modal.locator('.admin-head h2')).toContainText('管理后台');
    // 默认打开数据看板 Tab
    await expect(modal.locator('.admin-tab.active')).toContainText('数据看板');
  });

  test('#admin（无斜杠）兼容打开管理后台', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);
    await setAdminUser(page);

    await page.goto('/#admin');
    const modal = page.locator('#admin-modal');
    await modal.waitFor({ timeout: 15000 });
    await expect(modal).toBeVisible();
  });
});

// ============================================================
// ② 数据看板文创衍生品 KPI 从 orders 聚合
// ============================================================
test.describe('P0 admin 数据看板文创衍生品 KPI', () => {
  test('下单后数据看板文创衍生品 KPI 显示订单数量', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);
    await setAdminUser(page);

    // 直接落 3 单（覆盖 postcard / poster / card）
    await page.evaluate(async () => {
      await window.addOrder({ userId: 'guest', artworkId: '1', craftType: 'postcard', product: '明信片', scene: 'desk', price: 39, status: 'paid', orderNo: 'DC202610020001' });
      await window.addOrder({ userId: 'guest', artworkId: '2', craftType: 'poster', product: '海报', scene: 'frame', price: 74, status: 'paid', orderNo: 'DC202610020002' });
      await window.addOrder({ userId: 'guest', artworkId: '3', craftType: 'card', product: '藏品卡', scene: 'album', price: 66, status: 'paid', orderNo: 'DC202610020003' });
    });

    await page.goto('/#/admin');
    const modal = page.locator('#admin-modal');
    await modal.waitFor({ timeout: 15000 });

    // 文创衍生品 KPI 卡：数字 = 3（按 orders 表聚合，而非 ai_crafts）
    const kpiCard = modal.locator('.kpi-card').filter({ hasText: '文创衍生品' });
    await expect(kpiCard).toBeVisible();
    await expect(kpiCard.locator('.kpi-num')).toHaveText('3');
  });

  test('orders 为空时文创衍生品 KPI 显示 0', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);
    await setAdminUser(page);

    await page.goto('/#/admin');
    const modal = page.locator('#admin-modal');
    await modal.waitFor({ timeout: 15000 });

    const kpiCard = modal.locator('.kpi-card').filter({ hasText: '文创衍生品' });
    await expect(kpiCard).toBeVisible();
    await expect(kpiCard.locator('.kpi-num')).toHaveText('0');
  });
});
