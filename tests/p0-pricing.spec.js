// ============================================================
// tests/p0-pricing.spec.js — P0-3 商业模式演示页 #/pricing 回归测试
// 覆盖：
//   ① 三档会员卡渲染（¥0 / ¥259 最受欢迎 / ¥5,980 B 端 + 看板链接）
//      与底部成本测算卡（0 元/次 vs 7.2 元/次）
//   ② 创作会员「定制实物」mock 下单三步状态机：
//      选规格（尺寸/材质单选）→ 提交（loading 1s）→ 成功态（DC-2026-XXXX）
//   ③ 关闭按钮清除 hash 并移除 overlay
// 说明：main.js 尚未接线，测试先动态 import 模块（模块内自注册
//      hashchange 监听），再导航到 #/pricing。
// ============================================================
import { test, expect } from '@playwright/test';

// ---------------- 基础工具 ----------------

// 关闭首次访问欢迎引导弹窗（会拦截底层元素点击）
async function dismissWelcome(page) {
  const btn = page.locator('#welcome-enter');
  try { await btn.click({ timeout: 4000 }); } catch (_) { /* 无弹窗则跳过 */ }
}

// 打开会员权益页：加载首页 → 动态 import 模块 → 导航 #/pricing
async function openPricing(page) {
  await page.goto('/');
  await page.waitForSelector('.artwork-card', { timeout: 20000 });
  await dismissWelcome(page);
  await page.evaluate(() => import('/js/pricing-page.js'));
  await page.goto('/#/pricing');
  const overlay = page.locator('#pricing-page');
  await overlay.waitFor({ timeout: 10000 });
  return overlay;
}

// ============================================================
// ① 三档会员卡 + 成本测算卡
// ============================================================
test.describe('P0-3 商业模式演示页 #/pricing', () => {
  test('三档会员卡与成本测算卡渲染', async ({ page }) => {
    const overlay = await openPricing(page);

    // 标题区
    await expect(overlay.locator('.pp-title')).toContainText('Dreamcore 会员权益');
    await expect(overlay.locator('.pp-sub')).toContainText('让每一份传统文化灵感，都被看见、被创作、被带进生活');

    // 三档卡片：免费版 ¥0 / 创作会员 ¥259（最受欢迎）/ 景区定制 ¥5,980
    const cards = overlay.locator('.pp-card');
    await expect(cards).toHaveCount(3);
    await expect(cards.nth(0)).toContainText('免费版');
    await expect(cards.nth(0)).toContainText('¥0');
    await expect(cards.nth(0)).toContainText('每日 3 次 AI 生成');
    await expect(cards.nth(1)).toContainText('创作会员');
    await expect(cards.nth(1)).toContainText('¥259');
    await expect(cards.nth(1)).toContainText('无限 AI 生成');
    await expect(cards.nth(1)).toContainText('专属足迹徽章');
    await expect(cards.nth(1).locator('.pp-pop-badge')).toContainText('最受欢迎');
    await expect(cards.nth(2)).toContainText('景区定制');
    await expect(cards.nth(2)).toContainText('¥5,980');
    await expect(cards.nth(2)).toContainText('AI 讲解 API 接入');
    // 景区定制卡内运营看板演示链接
    await expect(cards.nth(2).locator('a[href="#/dashboard"]')).toContainText('查看运营看板演示');
    // 每档均有「定制实物」按钮
    await expect(overlay.locator('.pp-order-btn')).toHaveCount(3);

    // 底部成本测算卡：自研 0 边际成本 vs 行业参考 7.2 元/次
    const cost = overlay.locator('.pp-cost');
    await expect(cost).toContainText('自研模型本地推理');
    await expect(cost).toContainText('0 元/次');
    await expect(cost).toContainText('DreamCraft-1.5B');
    await expect(cost).toContainText('行业参考');
    await expect(cost).toContainText('7.2 元/次');
    await expect(cost).toContainText('驴迹科技');
  });

  // ============================================================
  // ② 创作会员 mock 下单三步状态机
  // ============================================================
  test('创作会员「定制实物」mock 下单全流程', async ({ page }) => {
    const overlay = await openPricing(page);

    // 点创作会员卡「定制实物」→ 下单弹窗出现（规格选择步骤）
    await overlay.locator('.pp-card').nth(1).locator('.pp-order-btn').click();
    const modal = page.locator('#pp-order-modal');
    await modal.waitFor({ timeout: 5000 });
    await expect(modal.locator('.pp-step-select')).toBeVisible();
    await expect(modal.locator('.pp-order-sub')).toContainText('创作会员');

    // 选规格：尺寸 + 材质单选
    await modal.locator('.pp-opt[data-group="size"][data-value="a3"]').click();
    await modal.locator('.pp-opt[data-group="material"][data-value="canvas"]').click();
    await expect(modal.locator('.pp-opt[data-group="size"][data-value="a3"]')).toHaveClass(/sel/);
    await expect(modal.locator('.pp-opt[data-group="material"][data-value="canvas"]')).toHaveClass(/sel/);
    await expect(modal.locator('.pp-order-summary')).toContainText('A3');
    await expect(modal.locator('.pp-order-summary')).toContainText('帆布');

    // 提交 → loading 1s → 成功态含 DC-2026- 订单号 + 演示声明灰字
    await modal.locator('#pp-submit-btn').click();
    const success = modal.locator('.pp-order-success');
    await success.waitFor({ timeout: 10000 });
    await expect(success).toContainText('订单号：DC-2026-');
    await expect(success.locator('.pp-order-no')).toContainText(/DC-2026-\d{4}/);
    await expect(success).toContainText('演示环境·不产生真实订单');

    // 完成按钮关闭下单弹窗，会员页仍在
    await modal.locator('#pp-done-btn').click();
    await modal.waitFor({ state: 'detached', timeout: 5000 });
    await expect(page.locator('#pricing-page')).toBeVisible();
  });

  // ============================================================
  // ③ 关闭：清除 hash + overlay 移除
  // ============================================================
  test('关闭按钮清除 hash 并移除 overlay', async ({ page }) => {
    const overlay = await openPricing(page);
    await overlay.locator('.modal-close').click();
    await page.locator('#pricing-page').waitFor({ state: 'detached', timeout: 5000 });
    expect(page.url()).not.toContain('#/pricing');
    // 再次进入可重新打开（单例已复位）
    await page.goto('/#/pricing');
    await page.locator('#pricing-page').waitFor({ timeout: 10000 });
    await expect(page.locator('#pricing-page')).toBeVisible();
  });
});
