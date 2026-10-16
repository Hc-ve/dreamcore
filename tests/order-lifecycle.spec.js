// ============================================================
// tests/order-lifecycle.spec.js — 订单闭环基础功能 端到端验证
// 覆盖：
//   ① 下单携带收货信息（收货人/电话/地址）与规格（材质/尺寸）随单落库 + 空收货拦截
//   ② 个人中心「我的订单」：列表 + 详情（订单号/商品/规格/价格/状态/收货地址 + 物流时间线）
//   ③ 管理后台「订单管理」：列表查看 + 物流状态推进（paid → producing）
//   ④ 全流程串联：下单 → 个人中心查单 → 管理后台改状态
// 说明：复用 p3-order.spec.js 的 AI 生成 mock + 下单弹窗模式；
//       个人中心/后台通过 page.evaluate 设置 window.currentUser 绕过真实登录。
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

async function openApp(page) {
  await page.goto('/');
  await page.waitForSelector('.artwork-card', { timeout: 20000 });
  try { await page.locator('#welcome-enter').click({ timeout: 4000 }); } catch (_) { /* 无弹窗则跳过 */ }
}

async function openCraft(page) {
  await page.goto('/');
  await page.waitForSelector('.artwork-card', { timeout: 20000 });
  try { await page.locator('#welcome-enter').click({ timeout: 4000 }); } catch (_) { /* 无弹窗则跳过 */ }
  const id = await page.locator('.artwork-card').first().getAttribute('data-id');
  await page.goto(`/#/craft?artworkId=${id}`);
  await page.waitForSelector('#craft-studio-generate', { timeout: 15000 });
}

async function runGenerate(page, idea) {
  await page.route('**/api/ai/text-generation', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ text: JSON.stringify(MOCK_PLAN), provider: 'self-trained' })
    });
  });
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

async function openMockupPanel(page) {
  await openCraft(page);
  await runGenerate(page, '敦煌飞天主题的明信片');
  await page.locator('#craft-mockup-btn').click();
  await page.locator('.craft-mockup-panel').waitFor({ timeout: 10000 });
}

/** 打开下单弹窗 */
async function openOrderModal(page) {
  await page.locator('#craft-mockup-order').click();
  const modal = page.locator('#craft-order-modal');
  await modal.waitFor({ timeout: 10000 });
  return modal;
}

async function setUser(page, id, username, isAdmin) {
  await page.evaluate(([uId, uName, adm]) => {
    window.currentUser = { id: uId, username: uName, email: uName + '@demo.com', isAdmin: !!adm, role: adm ? 'superadmin' : 'user' };
  }, [id, username, isAdmin]);
}

// ============================================================
// ① 下单携带收货信息与规格落库
// ============================================================
test.describe('订单闭环：下单', () => {
  test('① 下单填写收货信息 → 收货人/电话/地址/规格随单落库', async ({ page }) => {
    await clearStorage(page.context());
    await openMockupPanel(page);

    const modal = await openOrderModal(page);

    // 空收货提交拦截：不填收货信息直接提交 → 仍停留在 select 态，无成功态
    await modal.locator('#cm-submit-btn').click();
    await expect(modal.locator('.cm-order-success')).toHaveCount(0);

    // 填写收货信息
    await modal.locator('[data-field="receiver"]').fill('张伟');
    await modal.locator('[data-field="phone"]').fill('13800138000');
    await modal.locator('[data-field="address"]').fill('浙江省杭州市西湖区文一西路 100 号');

    // 选规格：宣纸 + 大号（69-10=59）
    await modal.locator('.cm-opt[data-group="material"][data-value="rice"]').click();
    await modal.locator('.cm-opt[data-group="size"][data-value="l"]').click();

    await modal.locator('#cm-submit-btn').click();
    await modal.locator('.cm-order-success').waitFor({ timeout: 10000 });
    const orderNo = (await modal.locator('.cm-order-no').textContent()).replace('订单号：', '');
    await modal.locator('#cm-done-btn').click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });

    const orders = await page.evaluate(() => window.getAllOrders());
    expect(orders.length).toBe(1);
    const o = orders[0];
    expect(o.orderNo).toBe(orderNo);
    expect(o.receiver).toBe('张伟');
    expect(o.phone).toBe('13800138000');
    expect(o.address).toBe('浙江省杭州市西湖区文一西路 100 号');
    expect(o.material).toBe('宣纸');
    expect(o.size).toBe('大号');
    expect(o.price).toBe(59);
    expect(o.status).toBe('paid');
  });
});

// ============================================================
// ② 个人中心「我的订单」
// ============================================================
test.describe('订单闭环：个人中心查单', () => {
  test('② 我的订单列表 + 详情（订单号/商品/规格/价格/状态/地址/时间线）', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);
    await setUser(page, 7, 'demo');

    // 预置一单属于当前用户
    await page.evaluate(async () => {
      await window.addOrder({
        userId: 7, artworkId: '1', craftType: 'postcard', product: '明信片', scene: 'desk',
        price: 59, status: 'paid', orderNo: 'DC202610020007',
        material: '宣纸', size: '大号', receiver: '李四', phone: '13900001111',
        address: '北京市朝阳区建国路 88 号', timeline: [{ state: 'paid', ts: new Date().toISOString(), note: '已支付' }]
      });
    });

    // 打开个人中心 → 我的订单 Tab
    await page.evaluate(() => window.showProfile());
    const profile = page.locator('#profile-modal');
    await profile.waitFor({ timeout: 10000 });
    await profile.locator('.profile-tab[data-tab="orders"]').click();
    await profile.locator('.profile-order-card').waitFor({ timeout: 10000 });

    const card = profile.locator('.profile-order-card').first();
    await expect(card.locator('.po-no')).toContainText('DC202610020007');
    await expect(card).toContainText('明信片');
    await expect(card).toContainText('宣纸 · 大号');
    await expect(card).toContainText('¥59');
    await expect(card.locator('.po-status')).toContainText('已支付');
    await expect(card).toContainText('李四');
    await expect(card).toContainText('北京市朝阳区建国路 88 号');

    // 展开物流时间线
    await card.locator('.po-toggle').click();
    await expect(card.locator('.po-timeline')).toBeVisible();
    await expect(card.locator('.po-timeline')).toContainText('已支付');
  });

  test('②b 我的订单空态：无订单提示', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);
    await setUser(page, 8, 'newbie');

    await page.evaluate(() => window.showProfile());
    const profile = page.locator('#profile-modal');
    await profile.waitFor({ timeout: 10000 });
    await profile.locator('.profile-tab[data-tab="orders"]').click();
    await expect(profile.locator('.profile-empty')).toContainText('还没有订单');
  });
});

// ============================================================
// ③ 管理后台「订单管理」
// ============================================================
test.describe('订单闭环：管理后台改状态', () => {
  test('③ 订单管理：列表查看 + 物流状态推进 paid→producing', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);
    await setUser(page, 1, 'admin', true);

    await page.evaluate(async () => {
      await window.addOrder({
        userId: 'guest', artworkId: '1', craftType: 'poster', product: '海报', scene: 'frame',
        price: 74, status: 'paid', orderNo: 'DC202610020088',
        material: '亚克力', size: '中号', receiver: '王五', phone: '13700002222', address: '上海市浦东新区'
      });
    });

    await page.goto('/#/admin');
    const modal = page.locator('#admin-modal');
    await modal.waitFor({ timeout: 15000 });

    await modal.locator('.admin-tab[data-tab="orders"]').click();
    await modal.locator('#admin-order-tbody tr').first().waitFor({ timeout: 10000 });

    const row = modal.locator('#admin-order-tbody tr').first();
    await expect(row).toContainText('DC202610020088');
    await expect(row.locator('.admin-order-status')).toContainText('已支付');
    await expect(row).toContainText('王五 / 13700002222');
    await expect(row).toContainText('上海市浦东新区');

    // 推进物流：paid → producing
    await row.locator('[data-advance]').click();
    await modal.locator('.admin-order-status.st-producing').waitFor({ timeout: 10000 });
    await expect(modal.locator('.admin-order-status').first()).toContainText('制作中');

    // 落库校验：状态已变更 + 时间线追加节点
    const orders = await page.evaluate(() => window.getAllOrders());
    const o = orders[0];
    expect(o.status).toBe('producing');
    expect(o.timeline.length).toBe(2);
    expect(o.timeline[1].state).toBe('producing');
  });
});

// ============================================================
// ④ 全流程串联：下单 → 个人中心查单 → 管理后台改状态
// ============================================================
test.describe('订单闭环：全流程', () => {
  test('④ 下单→查单→改状态，同一订单跨端一致', async ({ page }) => {
    await clearStorage(page.context());
    await openMockupPanel(page);
    await setUser(page, 66, 'flowuser');

    // 下单（登录态 user id=66）
    const modal = await openOrderModal(page);
    await modal.locator('[data-field="receiver"]').fill('赵六');
    await modal.locator('[data-field="phone"]').fill('13600006666');
    await modal.locator('[data-field="address"]').fill('广东省广州市天河区体育西路 1 号');
    await modal.locator('#cm-submit-btn').click();
    await modal.locator('.cm-order-success').waitFor({ timeout: 10000 });
    const orderNo = (await modal.locator('.cm-order-no').textContent()).replace('订单号：', '');
    await modal.locator('#cm-done-btn').click();
    await modal.waitFor({ state: 'hidden', timeout: 5000 });

    // 离开创作工坊（关闭全屏 workbench，避免其 canvas 覆盖个人中心）
    await page.evaluate(() => { if (window.AICraft && window.AICraft.closeCraft) window.AICraft.closeCraft(); });
    await page.waitForTimeout(450);

    // 查单：个人中心我的订单可见该单（userId 归属 66）
    await page.evaluate(() => window.showProfile());
    const profile = page.locator('#profile-modal');
    await profile.waitFor({ timeout: 10000 });
    await profile.locator('.profile-tab[data-tab="orders"]').click();
    const card = profile.locator('.profile-order-card').first();
    await card.waitFor({ timeout: 10000 });
    await expect(card.locator('.po-no')).toContainText(orderNo);
    await expect(card).toContainText('赵六');
    await expect(card).toContainText('广东省广州市天河区体育西路 1 号');

    // 关闭个人中心
    await profile.locator('[data-close]').click();
    await profile.waitFor({ state: 'hidden', timeout: 5000 });

    // 改状态：切换管理员，订单管理推进物流
    await setUser(page, 1, 'admin', true);
    await page.goto('/#/admin');
    const adminModal = page.locator('#admin-modal');
    await adminModal.waitFor({ timeout: 15000 });
    await adminModal.locator('.admin-tab[data-tab="orders"]').click();
    await adminModal.locator('#admin-order-tbody tr').first().waitFor({ timeout: 10000 });
    const aRow = adminModal.locator('#admin-order-tbody tr').first();
    // 推进两次：paid → producing → shipped
    await aRow.locator('[data-advance]').click();
    await adminModal.locator('.admin-order-status.st-producing').waitFor({ timeout: 10000 });
    const nowRow = adminModal.locator('#admin-order-tbody tr').first();
    await nowRow.locator('[data-advance]').click();
    await adminModal.locator('.admin-order-status.st-shipped').waitFor({ timeout: 10000 });

    // 最终校验：状态 shipped + 自动生成物流单号 SF 开头
    const orders = await page.evaluate(() => window.getAllOrders());
    const mine = orders.find(x => x.orderNo === orderNo);
    expect(mine).toBeTruthy();
    expect(mine.status).toBe('shipped');
    expect(mine.trackingNo).toMatch(/^SF\d+/);
    expect(mine.timeline.map(t => t.state)).toEqual(['paid', 'producing', 'shipped']);
  });
});