// ============================================================
// tests/save-publish-flow.spec.js — M8「保存与发布引导」端到端验证
// 覆盖：
//   ① 保存作品：高清导出触发浏览器下载 + 成功引导卡片出现
//   ② 发布引导：点击「发布作品」→ 关闭工作台 → 发布弹窗带入修图结果预览
//   ③ 自动暂存：参数变更后自动保存临时版本 + 指示标签出现
//   ④ 草稿箱：存草稿 / 计数 / 列表 / 恢复 / 删除
//   ⑤ 全程无控制台错误
// ============================================================
import { test, expect } from '@playwright/test';

const TEST_USER = {
  id: 'save-flow-uuid-0001',
  username: '保存流程测试用户',
  email: 'saveflow@test.app',
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

async function loginAs(page, user = TEST_USER) {
  await page.evaluate(async (u) => {
    window.currentUser = u;
    if (typeof window.ensureLocalUserForCloudUser === 'function') {
      await window.ensureLocalUserForCloudUser(u);
    }
  }, user);
}

async function getFirstArtworkId(page) {
  await page.waitForSelector('.artwork-card', { timeout: 20000 });
  return page.locator('.artwork-card').first().getAttribute('data-id');
}

async function openWorkbench(page, id) {
  await page.goto(`/#/edit?artworkId=${id}`);
  await page.waitForSelector('#ai-edit-workbench', { timeout: 15000 });
  // 等待画布真实渲染（非空白），保证导出/统计有效
  await page.waitForFunction(() => {
    const c = document.querySelector('#edit-preview-canvas');
    if (!c || !c.width) return false;
    try {
      const d = c.getContext('2d').getImageData(0, 0, c.width, 1).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 0) return true;
    } catch (_) { /* tainted */ }
    return false;
  }, null, { timeout: 20000 });
}

async function dismissWelcome(page) {
  const btn = page.locator('#welcome-enter');
  try { await btn.click({ timeout: 4000 }); } catch (_) { /* 无弹窗则跳过 */ }
}

test.describe('M8 修图工作台·保存与发布引导', () => {
  test('① 保存作品：高清导出下载 + 成功引导卡片', async ({ page }) => {
    await clearStorage(page.context());
    await page.goto('/');
    const id = await getFirstArtworkId(page);
    await dismissWelcome(page);
    await openWorkbench(page, id);

    // 触发高清保存：应产生浏览器下载事件
    const dlPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.locator('#edit-save-hd').click();
    const dl = await dlPromise;
    // 文件名：作品名-修图-日期时间.jpg
    expect(dl.suggestedFilename()).toMatch(/-修图-\d{8}_\d{6}\.jpg$/);

    // 成功引导卡片出现，提供「发布作品」选项
    await expect(page.locator('#edit-save-card')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#edit-save-card-title')).toContainText('已保存');
    await expect(page.locator('#edit-save-card-publish')).toBeVisible();
  });

  test('② 发布引导：带入修图结果跳转发布弹窗', async ({ page }) => {
    await clearStorage(page.context());
    await page.goto('/');
    const id = await getFirstArtworkId(page);
    await dismissWelcome(page);
    await loginAs(page); // 发布弹窗需登录
    await openWorkbench(page, id);

    const dlPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.locator('#edit-save-hd').click();
    await dlPromise;
    await expect(page.locator('#edit-save-card')).toBeVisible({ timeout: 5000 });

    // 点击「发布作品」→ 关闭工作台 → 打开发布弹窗
    await page.locator('#edit-save-card-publish').click();
    await expect(page.locator('#ai-edit-workbench')).toHaveCount(0, { timeout: 8000 });
    await expect(page.locator('#publish-modal')).toHaveClass(/open/, { timeout: 8000 });

    // 修图结果已带入上传预览（无需手动上传）
    await expect(page.locator('#pub-preview')).toBeVisible();
    await expect(page.locator('#pub-preview img')).toBeVisible({ timeout: 5000 });
  });

  test('③ 自动暂存：参数变更后自动保存临时版本', async ({ page }) => {
    await clearStorage(page.context());
    await page.goto('/');
    const id = await getFirstArtworkId(page);
    await dismissWelcome(page);
    await loginAs(page); // 自动暂存需登录（与保存版本策略一致）
    await openWorkbench(page, id);

    // 触发参数变更：调节第一个滑杆（曝光）
    const slider = page.locator('#edit-slider-group input[type="range"]').first();
    await slider.waitFor({ timeout: 5000 });
    await slider.evaluate(el => {
      el.value = '20';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // 防抖 6s 后自动暂存：指示标签出现
    await expect(page.locator('#edit-autosave-tag')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#edit-autosave-tag')).toContainText('已自动暂存');

    // 历史版本列表出现「自动」暂存版本
    await expect(
      page.locator('.edit-version-type').filter({ hasText: '自动' }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('④ 草稿箱：暂存/计数/恢复/删除', async ({ page }) => {
    await clearStorage(page.context());
    await page.goto('/');
    await page.waitForSelector('.artwork-card', { timeout: 20000 });
    await dismissWelcome(page);
    await loginAs(page);

    // 打开发布弹窗
    await page.evaluate(() => window.Publish.showPublishModal());
    await expect(page.locator('#publish-modal')).toHaveClass(/open/, { timeout: 8000 });

    // 草稿箱初始为空（计数 0）
    await expect(page.locator('#pub-draft-count')).toHaveText('0', { timeout: 8000 });

    // 填写标题/描述后存入草稿箱
    await page.locator('#pub-title-input').fill('测试草稿标题');
    await page.locator('#pub-desc-input').fill('测试草稿描述内容，用于验证暂存功能');
    await page.locator('#pub-draft-save').click();
    await expect(page.locator('#pub-draft-count')).toHaveText('1', { timeout: 8000 });

    // 展开草稿箱：出现条目且标题正确
    await page.locator('#pub-draft-toggle').click();
    await expect(page.locator('.pub-draft-item')).toHaveCount(1, { timeout: 8000 });
    await expect(page.locator('.pub-draft-title')).toContainText('测试草稿标题');

    // 清空表单 → 恢复草稿：表单回填
    await page.locator('#pub-title-input').fill('');
    await page.locator('.pub-draft-restore').click();
    await expect(page.locator('#pub-title-input')).toHaveValue('测试草稿标题', { timeout: 5000 });
    await expect(page.locator('#pub-desc-input')).toHaveValue(/测试草稿描述/);

    // 删除草稿（确认弹窗自动接受）
    page.on('dialog', d => d.accept());
    await page.locator('#pub-draft-toggle').click();
    await page.locator('.pub-draft-delete').click();
    await expect(page.locator('#pub-draft-count')).toHaveText('0', { timeout: 8000 });
  });

  test('⑤ 全流程无控制台错误', async ({ page }) => {
    await clearStorage(page.context());
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(String(err)));

    await page.goto('/');
    const id = await getFirstArtworkId(page);
    await dismissWelcome(page);
    await loginAs(page);
    await openWorkbench(page, id);

    const dlPromise = page.waitForEvent('download', { timeout: 15000 });
    await page.locator('#edit-save-hd').click();
    await dlPromise;
    await page.locator('#edit-save-card-publish').click();
    await expect(page.locator('#publish-modal')).toHaveClass(/open/, { timeout: 8000 });

    // 存入草稿箱再删除，覆盖草稿读写路径
    await page.locator('#pub-title-input').fill('控制台测试');
    await page.locator('#pub-draft-save').click();
    await expect(page.locator('#pub-draft-count')).toHaveText('1', { timeout: 8000 });

    expect(errors).toEqual([]);
  });
});
