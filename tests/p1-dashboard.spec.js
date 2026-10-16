// ============================================================
// tests/p1-dashboard.spec.js — P1-2 B 端景区运营数据看板 #/dashboard 测试
// 覆盖：
//   ① 看板打开：标题 / 副标题 / 4 张 KPI 卡 / 数据说明脚注（商业化钩子）
//   ② 空状态：本地无数据时友好空状态 + 「去智慧导览打卡」入口 +
//      图表 canvas 占位渲染，不白屏不报错
//   ③ 数据态：种 6 次打卡（覆盖 5 景区）+ 3 件文创 → KPI 本地聚合
//      真实数字（6 / 6 / 3 / 5），空状态与演示角标均不出现
//   ④ 数据不足（<3 条）：KPI 仍显真实数字，图表叠加「含演示数据」
//      角标，Canvas 元素存在且非零尺寸
//   ⑤ 会员页「查看运营看板演示」链接（href="#/dashboard"）存在且可跳转
// 说明：main.js 尚未接线，测试先动态 import 模块（模块内自注册
//      hashchange 监听 + import 时幂等 openFromHash），与正式接入行为一致。
// ============================================================
import { test, expect } from '@playwright/test';

// ---------------- 基础工具（沿 p1-digital-guide.spec.js 模式） ----------------

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

/** 页面内动态 import 看板模块（自初始化 + 幂等；hash 导航不冲掉） */
async function loadDashboardModule(page) {
  await page.evaluate(() => import('/js/dashboard-page.js'));
}

/** 导航到 #/dashboard 并等待 overlay 渲染 */
async function openDashboard(page) {
  await page.goto('/#/dashboard');
  const overlay = page.locator('#dashboard-page');
  await overlay.waitFor({ timeout: 10000 });
  return overlay;
}

/** 收集页面未捕获异常（pageerror），断言不白屏不报错 */
function collectErrors(page) {
  const errors = [];
  page.on('pageerror', err => errors.push(String(err)));
  return errors;
}

/** 种子数据：景点打卡（spot: 前缀足迹，action='visit'） */
async function seedVisits(page, spotIds) {
  await page.evaluate(async (ids) => {
    const uid = (window.currentUser && window.currentUser.id) != null ? window.currentUser.id : 0;
    for (const id of ids) {
      await window.recordFootprint(uid, 'spot:' + id, 'visit');
    }
  }, spotIds);
}

/** 种子数据：AI 文创衍生品（ai_crafts 表） */
async function seedCrafts(page, count) {
  await page.evaluate(async (n) => {
    const uid = (window.currentUser && window.currentUser.id) != null ? window.currentUser.id : 0;
    for (let i = 0; i < n; i++) {
      await window.addAiCraft({ artworkId: 1 + i, userId: uid, craftType: 'postcard', styleTheme: '国风' });
    }
  }, count);
}

/** 断言看板内 3 张图表 canvas 均存在且属性位图 / 渲染尺寸非零 */
async function assertCanvasesNonZero(overlay) {
  const canvases = overlay.locator('canvas.dbp-canvas');
  await expect(canvases).toHaveCount(3);
  const dims = await canvases.evaluateAll(cs => cs.map(c => ({
    w: c.width,
    h: c.height,
    rw: Math.round(c.getBoundingClientRect().width),
    rh: Math.round(c.getBoundingClientRect().height)
  })));
  expect(dims.length).toBe(3);
  for (const d of dims) {
    expect(d.w).toBeGreaterThan(0);
    expect(d.h).toBeGreaterThan(0);
    expect(d.rw).toBeGreaterThan(0);
    expect(d.rh).toBeGreaterThan(0);
  }
}

// ============================================================
// P1-2 B 端景区运营数据看板 #/dashboard
// ============================================================
test.describe('P1-2 B 端景区运营数据看板 #/dashboard', () => {

  // ============================================================
  // ① 打开：标题 / 副标题 / KPI 卡 / 脚注
  // ============================================================
  test('看板打开：标题 / 副标题 / 5 张 KPI 卡 / 数据说明脚注', async ({ page }) => {
    await clearStorage(page.context());
    const errors = collectErrors(page);
    await openApp(page);
    await loadDashboardModule(page);
    const overlay = await openDashboard(page);

    // 标题区
    await expect(overlay.locator('.dbp-title')).toContainText('景区运营看板');
    await expect(overlay.locator('.dbp-sub')).toContainText('B 端数据演示 · 本地聚合');
    await expect(overlay.locator('.dbp-view-badge')).toContainText('景区运营视角 · 演示数据');

    // 5 张 KPI 卡（累计打卡 / 今日打卡 / AI 文创生成 / 覆盖景区 / 文创订单，P3 B3 新增）
    const kpis = overlay.locator('.dbp-kpi');
    await expect(kpis).toHaveCount(5);
    await expect(kpis.nth(0)).toContainText('累计打卡数');
    await expect(kpis.nth(1)).toContainText('今日打卡');
    await expect(kpis.nth(2)).toContainText('AI 文创生成数');
    await expect(kpis.nth(3)).toContainText('覆盖景区数');
    await expect(kpis.nth(4)).toContainText('文创订单');
    // KPI 数字为本地聚合的真实数字（异步刷新后为数字而非占位符）
    await expect(overlay.locator('.dbp-kpi[data-kpi="total"] .dbp-kpi-num')).toHaveText(/\d+/);

    // 数据说明脚注（商业化钩子）
    await expect(overlay.locator('.dbp-footnote')).toContainText('演示数据为本机本地聚合（IndexedDB）');
    await expect(overlay.locator('.dbp-footnote')).toContainText('景区票务/闸机系统');

    expect(errors).toEqual([]);
  });

  // ============================================================
  // ② 空状态：本地无数据（清库后）
  // ============================================================
  test('空状态：友好空状态 + 去智慧导览打卡入口 + 图表占位不白屏不报错', async ({ page }) => {
    await clearStorage(page.context());
    const errors = collectErrors(page);
    await openApp(page);
    await loadDashboardModule(page);
    const overlay = await openDashboard(page);

    // 友好空状态可见 + CTA 指向智慧导览
    const empty = overlay.locator('.dbp-empty');
    await expect(empty).toBeVisible();
    await expect(empty).toContainText('本机暂无运营数据');
    const cta = empty.locator('a[href="#/scenic"]');
    await expect(cta).toContainText('去智慧导览打卡');

    // KPI 仍显示真实数字（全 0）
    await expect(overlay.locator('.dbp-kpi[data-kpi="total"] .dbp-kpi-num')).toHaveText('0');
    await expect(overlay.locator('.dbp-kpi[data-kpi="crafts"] .dbp-kpi-num')).toHaveText('0');
    await expect(overlay.locator('.dbp-kpi[data-kpi="areas"] .dbp-kpi-num')).toHaveText('0');

    // 图表 canvas 占位渲染（存在且非零尺寸，不白屏）
    await assertCanvasesNonZero(overlay);

    expect(errors).toEqual([]);
  });

  // ============================================================
  // ③ 数据态：KPI 本地聚合真实数字，空状态 / 演示角标不出现
  // ============================================================
  test('数据态：6 次打卡覆盖 5 景区 + 3 件文创 → KPI 真实数字', async ({ page }) => {
    await clearStorage(page.context());
    const errors = collectErrors(page);
    await openApp(page);

    // 6 次景点打卡：龙门×2 / 少林 / 老君山 / 清明上河园 / 故宫（覆盖 5 景区）
    await seedVisits(page, ['fengxiansi', 'wanfodong', 'talin', 'jinding', 'hongqiao', 'taihedian']);
    await seedCrafts(page, 3);

    await loadDashboardModule(page);
    const overlay = await openDashboard(page);

    // KPI：累计打卡 6 / 今日打卡 6（种子即今日写入）/ AI 文创 3 / 覆盖景区 5
    await expect(overlay.locator('.dbp-kpi[data-kpi="total"] .dbp-kpi-num')).toHaveText('6');
    await expect(overlay.locator('.dbp-kpi[data-kpi="today"] .dbp-kpi-num')).toHaveText('6');
    await expect(overlay.locator('.dbp-kpi[data-kpi="crafts"] .dbp-kpi-num')).toHaveText('3');
    await expect(overlay.locator('.dbp-kpi[data-kpi="areas"] .dbp-kpi-num')).toHaveText('5');

    // 数据充足（≥3 条）：空状态不出现、无「含演示数据」角标
    await expect(overlay.locator('.dbp-empty')).toBeHidden();
    await expect(overlay.locator('.dbp-demo-badge').first()).toBeHidden();

    // 图表 canvas 非零尺寸
    await assertCanvasesNonZero(overlay);

    expect(errors).toEqual([]);
  });

  // ============================================================
  // ④ 数据不足（<3 条）：KPI 真实数字 + 图表叠加「含演示数据」角标
  // ============================================================
  test('数据不足（<3 条）：KPI 真实数字 + 「含演示数据」角标 + Canvas 非零尺寸', async ({ page }) => {
    await clearStorage(page.context());
    const errors = collectErrors(page);
    await openApp(page);

    // 仅 2 条数据（1 次打卡 + 1 件文创）→ 图表叠加演示种子
    await seedVisits(page, ['fengxiansi']);
    await seedCrafts(page, 1);

    await loadDashboardModule(page);
    const overlay = await openDashboard(page);

    // KPI 仍显示真实数字（不为演示种子 inflated）
    await expect(overlay.locator('.dbp-kpi[data-kpi="total"] .dbp-kpi-num')).toHaveText('1');
    await expect(overlay.locator('.dbp-kpi[data-kpi="today"] .dbp-kpi-num')).toHaveText('1');
    await expect(overlay.locator('.dbp-kpi[data-kpi="crafts"] .dbp-kpi-num')).toHaveText('1');
    await expect(overlay.locator('.dbp-kpi[data-kpi="areas"] .dbp-kpi-num')).toHaveText('1');

    // 空状态不出现（有数据）；每张图表卡带「含演示数据」角标
    await expect(overlay.locator('.dbp-empty')).toBeHidden();
    const badges = overlay.locator('.dbp-demo-badge');
    await expect(badges).toHaveCount(3);
    await expect(badges.first()).toBeVisible();
    await expect(badges.first()).toContainText('含演示数据');

    // 图表 canvas 存在且非零尺寸
    await assertCanvasesNonZero(overlay);

    expect(errors).toEqual([]);
  });

  // ============================================================
  // ⑤ 会员页「查看运营看板演示」链接存在且可跳转看板
  // ============================================================
  test('会员页「查看运营看板演示」链接可跳转看板', async ({ page }) => {
    await clearStorage(page.context());
    const errors = collectErrors(page);
    await openApp(page);

    // 动态 import 会员页 + 看板模块（main.js 未接线，与正式接入行为一致）
    await page.evaluate(() => import('/js/pricing-page.js'));
    await loadDashboardModule(page);

    await page.goto('/#/pricing');
    const pricing = page.locator('#pricing-page');
    await pricing.waitFor({ timeout: 10000 });

    // 景区定制档卡内运营看板演示链接（href="#/dashboard"）
    const link = pricing.locator('a[href="#/dashboard"]');
    await expect(link).toBeVisible();
    await expect(link).toContainText('查看运营看板演示');

    // 点击跳转：会员页关闭、看板打开
    await link.click();
    expect(page.url()).toContain('#/dashboard');
    const dash = page.locator('#dashboard-page');
    await dash.waitFor({ timeout: 10000 });
    await expect(dash.locator('.dbp-title')).toContainText('景区运营看板');
    await expect(dash.locator('.dbp-kpi-num').first()).toHaveText(/\d+/);

    expect(errors).toEqual([]);
  });
});
