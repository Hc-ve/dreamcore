// ============================================================
// tests/p3-disclosure.spec.js — P3 B2「合规页双备案」验证
// 覆盖：
//   ① 「算法备案与合规规划」章节渲染：双备案路径卡片
//      （深度合成服务算法备案 / 生成式人工智能服务备案）
//   ② 章节位置：三级标注体系（ad-grid）之后、版权说明（ad-license）之前
//   ③ 对标先例（同程「程心 AI」双备案）与校园竞赛演示阶段说明
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
  const btn = page.locator('#welcome-enter');
  try { await btn.click({ timeout: 4000 }); } catch (_) { /* 无弹窗则跳过 */ }
}

test.describe('P3 B2 合规页双备案', () => {
  test('算法备案与合规规划章节：双备案卡片 + 法规要素 + 责任边界', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);

    await page.goto('/#/ai-disclosure');
    const overlay = page.locator('#ai-disclosure-page');
    await overlay.locator('.ad-grid').waitFor({ timeout: 10000 });

    // 章节标题
    await expect(overlay.locator('.ad-filing-title')).toContainText('算法备案与合规规划');

    // 双备案路径卡片
    const steps = overlay.locator('.ad-filing-step');
    await expect(steps).toHaveCount(2);
    await expect(steps.nth(0).locator('.ad-name')).toContainText('深度合成服务算法备案');
    await expect(steps.nth(1).locator('.ad-name')).toContainText('生成式人工智能服务备案');

    // ① 法规与受理部门与时限要素
    const step1 = await steps.nth(0).locator('.ad-desc').textContent();
    expect(step1).toContain('互联网信息服务深度合成管理规定');
    expect(step1).toContain('网信部门');
    expect(step1).toContain('10 个工作日');
    // ② 法规要素 + 与阿里云百炼的责任边界划分
    const step2 = await steps.nth(1).locator('.ad-desc').textContent();
    expect(step2).toContain('生成式人工智能服务管理暂行办法');
    expect(step2).toContain('阿里云百炼');
    expect(step2).toContain('责任');

    // 对标先例：同程「程心 AI」双备案
    await expect(overlay.locator('.ad-filing-bench')).toContainText('程心 AI');
    await expect(overlay.locator('.ad-filing-bench')).toContainText('双备案');

    // 演示阶段说明：正式商用前完成双备案
    await expect(overlay.locator('.ad-filing-note')).toContainText('校园竞赛演示阶段');
    await expect(overlay.locator('.ad-filing-note')).toContainText('正式商用前');
  });

  test('章节位置：三级标注之后、版权说明之前（沿用排版顺序）', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);

    await page.goto('/#/ai-disclosure');
    const overlay = page.locator('#ai-disclosure-page');
    await overlay.locator('.ad-filing').waitFor({ timeout: 10000 });

    // DOM 顺序：ad-grid → ad-filing → ad-license
    const order = await overlay.evaluate((root) => {
      const seq = ['.ad-grid', '.ad-filing', '.ad-license']
        .map(sel => {
          const el = root.querySelector(sel);
          return el ? Array.from(root.querySelectorAll('*')).indexOf(el) : -1;
        });
      return seq;
    });
    expect(order[0]).toBeGreaterThan(-1);
    expect(order[1]).toBeGreaterThan(order[0]);
    expect(order[2]).toBeGreaterThan(order[1]);

    // 三级标注体系仍在（①②③ 卡未受影响）
    await expect(overlay.locator('.ad-grid .ad-card')).toHaveCount(3);
  });
});
