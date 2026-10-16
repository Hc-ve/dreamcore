// ============================================================
// tests/p1-disclosure.spec.js — P1-4 内容合规声明页 #/ai-disclosure 回归测试
// 覆盖：
//   ① 三级标注体系卡片：人工校对事实卡（青绿）/ AI 联网生成·仅供参考（黄）
//      / AI 图像创作（雾紫），各卡含说明与产品内出现位置
//   ② 底部版权与使用范围说明（版权归作者 / AI 标注要求 / 演示数据声明）
//   ③ 关闭按钮清除 hash 并移除 overlay
// 说明：main.js 尚未接线，测试先动态 import 模块（模块内自注册
//      hashchange 监听），再导航到 #/ai-disclosure。
// ============================================================
import { test, expect } from '@playwright/test';

// ---------------- 基础工具 ----------------

// 关闭首次访问欢迎引导弹窗（会拦截底层元素点击）
async function dismissWelcome(page) {
  const btn = page.locator('#welcome-enter');
  try { await btn.click({ timeout: 4000 }); } catch (_) { /* 无弹窗则跳过 */ }
}

// 打开合规声明页：加载首页 → 动态 import 模块 → 导航 #/ai-disclosure
async function openDisclosure(page) {
  await page.goto('/');
  await page.waitForSelector('.artwork-card', { timeout: 20000 });
  await dismissWelcome(page);
  await page.evaluate(() => import('/js/ai-disclosure-page.js'));
  await page.goto('/#/ai-disclosure');
  const overlay = page.locator('#ai-disclosure-page');
  await overlay.waitFor({ timeout: 10000 });
  return overlay;
}

// ============================================================
// ① 三级标注体系卡片
// ============================================================
test.describe('P1-4 内容合规声明页 #/ai-disclosure', () => {
  test('三级标注体系卡片渲染（名称 / 说明 / 出现位置）', async ({ page }) => {
    const overlay = await openDisclosure(page);

    await expect(overlay.locator('.ad-title')).toContainText('AI 内容说明');

    const cards = overlay.locator('.ad-card');
    await expect(cards).toHaveCount(3);

    // ① 人工校对事实卡（青绿）：12 核心主题 + 溯源 + 出现位置
    await expect(cards.nth(0).locator('.ad-name')).toContainText('人工校对事实卡');
    await expect(cards.nth(0).locator('.ad-desc')).toContainText('12 核心文化主题知识库');
    await expect(cards.nth(0).locator('.ad-desc')).toContainText('人工校对溯源');
    await expect(cards.nth(0)).toContainText('文化图鉴核心主题详情');
    await expect(cards.nth(0)).toContainText('AI 识图讲解');
    await expect(cards.nth(0)).toHaveCSS('border-left-color', 'rgb(52, 211, 153)');

    // ② AI 联网生成 · 仅供参考（黄）
    await expect(cards.nth(1).locator('.ad-name')).toContainText('AI 联网生成');
    await expect(cards.nth(1).locator('.ad-name')).toContainText('仅供参考');
    await expect(cards.nth(1).locator('.ad-desc')).toContainText('可能存在误差');
    await expect(cards.nth(1)).toContainText('图鉴扩展主题');
    await expect(cards.nth(1)).toContainText('智慧导览讲解区');
    await expect(cards.nth(1)).toHaveCSS('border-left-color', 'rgb(251, 191, 36)');

    // ③ AI 图像创作（雾紫）
    await expect(cards.nth(2).locator('.ad-name')).toContainText('AI 图像创作');
    await expect(cards.nth(2).locator('.ad-desc')).toContainText('生成式模型产出');
    await expect(cards.nth(2)).toContainText('AI 文创结果页');
    await expect(cards.nth(2)).toContainText('AI 修图工作台');
  });

  // ============================================================
  // ② 版权与使用范围说明
  // ============================================================
  test('版权与使用范围说明', async ({ page }) => {
    const overlay = await openDisclosure(page);
    const license = overlay.locator('.ad-license');
    await expect(license).toContainText('版权与使用范围');
    await expect(license).toContainText('版权归原作者');
    await expect(license).toContainText('AI 生成内容');
    await expect(license).toContainText('演示数据');
  });

  // ============================================================
  // ③ 关闭：清除 hash + overlay 移除
  // ============================================================
  test('关闭按钮清除 hash 并移除 overlay', async ({ page }) => {
    const overlay = await openDisclosure(page);
    await overlay.locator('.modal-close').click();
    await page.locator('#ai-disclosure-page').waitFor({ state: 'detached', timeout: 5000 });
    expect(page.url()).not.toContain('#/ai-disclosure');
    // 再次进入可重新打开（单例已复位）
    await page.goto('/#/ai-disclosure');
    await page.locator('#ai-disclosure-page').waitFor({ timeout: 10000 });
    await expect(page.locator('#ai-disclosure-page')).toBeVisible();
  });
});
