// ============================================================
// tests/p3-order.spec.js — P3 B3「演示级一键下单」端到端验证
// 覆盖：
//   ① orders 表随 DB v9 建库（initDB 后 window.getAllOrders 可用）
//   ② 下单状态机：预览弹窗「一键定制下单」→ 选材质/尺寸 → 提交
//      → loading(1.2s) → 成功态订单号（DC+年月日+4位）→ 落库可查
//   ③ 重复下单允许：关闭后再开第二单
//   ④ 运营看板 #/dashboard：文创订单 KPI 卡（单量 + 今日单数 + 累计销售额）
// 说明：AI 灵感生成沿用 p0-mockup.spec.js 的 page.route mock 模式。
// ============================================================
import { test, expect } from '@playwright/test';

const MOCK_PLAN = {
  title: '飞天神韵·大漠华章',
  subtitle: '反弹琵琶舞千年，壁上飞天落人间',
  craftType: 'postcard', // 尺寸微调 -10：小19/中39/大59
  style: 'dunhuang',
  stickers: []
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

/** 打开文创工作台（沿用 tests/p0-mockup.spec.js 模式） */
async function openCraft(page) {
  await page.goto('/');
  await page.waitForSelector('.artwork-card', { timeout: 20000 });
  try { await page.locator('#welcome-enter').click({ timeout: 4000 }); } catch (_) { /* 无弹窗则跳过 */ }
  const id = await page.locator('.artwork-card').first().getAttribute('data-id');
  await page.goto(`/#/craft?artworkId=${id}`);
  await page.waitForSelector('#craft-studio-generate', { timeout: 15000 });
}

/** mock 生成一张结果（postcard → 默认场景 desk） */
async function runGenerate(page, idea) {
  await page.route('**/api/ai/text-generation', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ text: JSON.stringify(MOCK_PLAN), provider: 'self-trained' })
    });
  });
  // 四阶段链路适配：mock I2I 提交失败，生成在策划后快速恢复（下单用例不依赖整图重绘）
  await page.route('**/api/ai/image-repaint-submit', async (route) => {
    await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'mock i2i down' }) });
  });
  await page.locator('#craft-studio-idea').fill(idea);
  await page.locator('#craft-studio-generate').click();
  await page.waitForFunction(() => {
    const b = document.querySelector('#craft-studio-generate');
    return b && !b.disabled;
  }, null, { timeout: 15000 });
}

/** 生成结果并打开实物预览面板 */
async function openMockupPanel(page) {
  await openCraft(page);
  await runGenerate(page, '敦煌飞天主题的明信片');
  await page.locator('#craft-mockup-btn').click();
  await page.locator('.craft-mockup-panel').waitFor({ timeout: 10000 });
}

// ============================================================
// ① DB v9 建表
// ============================================================
test.describe('P3 B3 演示级一键下单', () => {
  test('① orders 表随 DB v9 创建：getAllOrders 可用且初始为空', async ({ page }) => {
    await clearStorage(page.context());
    await page.goto('/');
    await page.waitForSelector('.artwork-card', { timeout: 20000 });

    // initDB 已完成 → orders 表存在且 API 挂载
    const orders = await page.evaluate(async () => {
      const dbs = await indexedDB.databases();
      const has = dbs.some(d => d.name === 'DreamcoreArtDB' && d.version >= 9);
      return { hasV9: has, list: await window.getAllOrders() };
    });
    expect(orders.hasV9).toBe(true);
    expect(Array.isArray(orders.list)).toBe(true);
    expect(orders.list.length).toBe(0);
  });

  // ============================================================
  // ② 下单状态机全流程 + 落库
  // ============================================================
  test('② 一键下单：选材质尺寸 → 提交 → 订单号 → 落库（guest/paid）', async ({ page }) => {
    await clearStorage(page.context());
    await openMockupPanel(page);

    // 主按钮打开下单弹窗
    await page.locator('#craft-mockup-order').click();
    const modal = page.locator('#craft-order-modal');
    await modal.waitFor({ timeout: 10000 });
    await expect(modal.locator('.cm-order-title')).toContainText('一键定制下单');

    // 默认：绒布 · 中号（postcard 微调后 ¥39）
    await expect(modal.locator('.cm-order-summary')).toContainText('绒布');
    await expect(modal.locator('.cm-order-summary')).toContainText('¥39');

    // 切换：宣纸 + 大号（69-10=59）
    await modal.locator('.cm-opt[data-group="material"][data-value="rice"]').click();
    await modal.locator('.cm-opt[data-group="size"][data-value="l"]').click();
    await expect(modal.locator('.cm-order-summary')).toContainText('宣纸');
    await expect(modal.locator('.cm-order-summary')).toContainText('大号');
    await expect(modal.locator('.cm-order-summary')).toContainText('¥59');

    // 提交 → loading → 成功态
    await modal.locator('#cm-submit-btn').click();
    await modal.locator('.cm-order-loading').waitFor({ timeout: 5000 });
    await modal.locator('.cm-order-success').waitFor({ timeout: 10000 });
    await expect(modal.locator('.cm-order-no')).toContainText(/DC\d{12}/);
    await expect(modal.locator('.cm-order-summary')).toContainText('¥59');
    await expect(modal.locator('.cm-order-done')).toContainText('演示环境订单，仅存本地');
    const orderNo = (await modal.locator('.cm-order-no').textContent()).replace('订单号：', '');

    // 完成 → 弹窗关闭
    await modal.locator('#cm-done-btn').click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });

    // 落库校验：guest 订单，status paid，金额/类型/场景正确
    const orders = await page.evaluate(() => window.getAllOrders());
    expect(orders.length).toBe(1);
    const o = orders[0];
    expect(o.orderNo).toBe(orderNo);
    expect(o.userId).toBe('guest');
    expect(o.status).toBe('paid');
    expect(o.craftType).toBe('postcard');
    expect(o.price).toBe(59);
    expect(o.scene).toBeTruthy();
  });

  // ============================================================
  // ③ 重复下单允许
  // ============================================================
  test('③ 重复下单：关闭后可再次下单，订单累计 2 条', async ({ page }) => {
    await clearStorage(page.context());
    await openMockupPanel(page);

    // 第一单（默认选项直接提交）
    await page.locator('#craft-mockup-order').click();
    let modal = page.locator('#craft-order-modal');
    await modal.waitFor({ timeout: 10000 });
    await modal.locator('#cm-submit-btn').click();
    await modal.locator('.cm-order-success').waitFor({ timeout: 10000 });
    await modal.locator('#cm-done-btn').click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });

    // 第二单（可重复下单）
    await page.locator('#craft-mockup-order').click();
    modal = page.locator('#craft-order-modal');
    await modal.waitFor({ timeout: 10000 });
    await modal.locator('#cm-submit-btn').click();
    await modal.locator('.cm-order-success').waitFor({ timeout: 10000 });
    await modal.locator('#cm-done-btn').click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });

    const orders = await page.evaluate(() => window.getAllOrders());
    expect(orders.length).toBe(2);
    // 两次订单号互不相同
    expect(orders[0].orderNo).not.toBe(orders[1].orderNo);
  });

  // ============================================================
  // ④ 运营看板：文创订单 KPI 卡
  // ============================================================
  test('④ 运营看板 #/dashboard：文创订单卡（单量 + 今日 + 累计销售额）', async ({ page }) => {
    await clearStorage(page.context());
    await page.goto('/');
    await page.waitForSelector('.artwork-card', { timeout: 20000 });
    try { await page.locator('#welcome-enter').click({ timeout: 4000 }); } catch (_) { /* 无弹窗则跳过 */ }

    // 直接落两单（今日订单，金额 39 + 74 = 113）
    await page.evaluate(async () => {
      await window.addOrder({ userId: 'guest', artworkId: '1', craftType: 'postcard', scene: 'desk', price: 39, status: 'paid', orderNo: 'DC202609280001' });
      await window.addOrder({ userId: 'guest', artworkId: '2', craftType: 'poster', scene: 'frame', price: 74, status: 'paid', orderNo: 'DC202609280002' });
    });

    // 打开运营看板
    await page.goto('/#/dashboard');
    const overlay = page.locator('#dashboard-page');
    await overlay.locator('.dbp-kpi').first().waitFor({ timeout: 15000 });

    // 文创订单卡：KPI 五卡之一，数字=2，副标题=今日 2 单 · 累计销售额 ¥113
    const ordersCard = overlay.locator('.dbp-kpi[data-kpi="orders"]');
    await expect(ordersCard).toBeVisible();
    await expect(ordersCard.locator('.dbp-kpi-label')).toContainText('文创订单');
    await expect(ordersCard.locator('.dbp-kpi-num')).toHaveText('2');
    await expect(ordersCard.locator('.dbp-kpi-sub')).toContainText('今日 2 单');
    await expect(ordersCard.locator('.dbp-kpi-sub')).toContainText('¥113');
  });
});
