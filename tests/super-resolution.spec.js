// ============================================================
// tests/super-resolution.spec.js — M9「AI超清 + 布局重构」端到端验证
// 覆盖：
//   ① 布局重构：重置/前后对比/保存版本为画布下方小按钮（#edit-canvas-tools），
//      头部不再包含次级按钮，仅保留 AI智能优化/AI超清/保存作品/关闭
//   ② AI超清全流程：醒图式浮层（进度%/阶段文案/取消按钮）→ 完成 → 量化报告
//   ③ 清晰度提升可量化：画布 Laplacian 边缘能量提升 ≥ 15%
//   ④ 取消超清：浮层消失、对比按钮保持禁用
//   ⑤ 超清后前后对比可用（对比层/滑杆）
//   ⑥ 全程无控制台错误
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

// 打开首页取第一张作品 id（种子作品为本地图片，像素级处理可用）
async function getFirstArtworkId(page) {
  await clearStorage(page.context());
  await page.goto('/');
  await page.waitForSelector('.artwork-card', { timeout: 20000 });
  const id = await page.locator('.artwork-card').first().getAttribute('data-id');
  expect(id).toBeTruthy();
  return id;
}

// 打开工作台并等待画布真实渲染
async function openWorkbench(page, id) {
  await page.goto(`/#/edit?artworkId=${id}`);
  await expect(page.locator('#ai-edit-workbench')).toBeVisible({ timeout: 15000 });
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

// 计算预览画布的 Laplacian 边缘能量（清晰度客观指标）
async function canvasSharpness(page) {
  return page.evaluate(() => {
    const c = document.querySelector('#edit-preview-canvas');
    const ctx = c.getContext('2d');
    const { width: w, height: h } = c;
    const d = ctx.getImageData(0, 0, w, h).data;
    const gray = new Float32Array(w * h);
    for (let p = 0, i = 0; p < w * h; p++, i += 4) {
      gray[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    }
    let sum = 0, cnt = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const p = y * w + x;
        sum += Math.abs(4 * gray[p] - gray[p - 1] - gray[p + 1] - gray[p - w] - gray[p + w]);
        cnt++;
      }
    }
    return cnt ? sum / cnt : 0;
  });
}

// 触发 AI超清 并等待完成（浮层出现→消失）
async function srAndWait(page) {
  await page.locator('#edit-sr').click();
  await expect(page.locator('#edit-ai-overlay')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('#edit-ai-overlay')).toBeHidden({ timeout: 60000 });
}

test.describe('M9 AI修图工作台·AI超清与布局重构', () => {
  test('① 布局重构：次级功能为画布下方小按钮', async ({ page }) => {
    const id = await getFirstArtworkId(page);
    await openWorkbench(page, id);

    // 次级按钮位于画布下方工具行内
    const tools = page.locator('#edit-canvas-tools');
    await expect(tools).toBeVisible();
    await expect(tools.locator('#edit-reset')).toBeVisible();
    await expect(tools.locator('#edit-compare')).toBeVisible();
    await expect(tools.locator('#edit-save')).toBeVisible();

    // 头部不再包含次级按钮
    await expect(page.locator('.edit-header-actions #edit-reset')).toHaveCount(0);
    await expect(page.locator('.edit-header-actions #edit-compare')).toHaveCount(0);
    await expect(page.locator('.edit-header-actions #edit-save')).toHaveCount(0);

    // 头部仅保留主操作：AI智能优化 / AI超清 / 保存作品 / 关闭
    await expect(page.locator('.edit-header-actions #edit-ai-recommend')).toBeVisible();
    await expect(page.locator('.edit-header-actions #edit-sr')).toBeVisible();
    await expect(page.locator('.edit-header-actions #edit-save-hd')).toBeVisible();
    await expect(page.locator('.edit-header-actions #edit-close')).toBeVisible();

    // 工具行位于画布容器之后、AI提示条之前（DOM 顺序验证）
    const order = await page.evaluate(() => {
      const wrap = document.querySelector('.edit-canvas-wrap');
      const tools = document.querySelector('#edit-canvas-tools');
      return !!(wrap && tools && wrap.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(order).toBe(true);
  });

  test('② AI超清全流程：浮层进度 + 完成量化报告', async ({ page }) => {
    const id = await getFirstArtworkId(page);
    await openWorkbench(page, id);

    // 触发超清 → 浮层展示进度百分比、阶段文案、取消按钮
    await page.locator('#edit-sr').click();
    await expect(page.locator('#edit-ai-overlay')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#edit-ai-progress-pct')).toHaveText(/\d+%/);
    await expect(page.locator('#edit-ai-stage')).not.toBeEmpty();
    await expect(page.locator('#edit-ai-cancel')).toBeVisible();

    // 完成：浮层消失、按钮恢复、提示出现、对比可用
    await expect(page.locator('#edit-ai-overlay')).toBeHidden({ timeout: 60000 });
    await expect(page.locator('#edit-sr')).toBeEnabled();
    await expect(page.locator('#edit-ai-tips')).toBeVisible();
    await expect(page.locator('#edit-compare')).toBeEnabled();
  });

  test('③ 清晰度提升可量化：Laplacian 边缘能量提升 ≥ 15%', async ({ page }) => {
    const id = await getFirstArtworkId(page);
    await openWorkbench(page, id);

    const before = await canvasSharpness(page);
    expect(before).toBeGreaterThan(0);

    await srAndWait(page);
    // 等待预览画布重绘
    await page.waitForTimeout(500);
    const after = await canvasSharpness(page);

    expect(after / before).toBeGreaterThanOrEqual(1.15);
  });

  test('④ 取消超清：浮层消失、不产生超清结果', async ({ page }) => {
    const id = await getFirstArtworkId(page);
    await openWorkbench(page, id);

    await page.locator('#edit-sr').click();
    await expect(page.locator('#edit-ai-overlay')).toBeVisible({ timeout: 5000 });
    await page.locator('#edit-ai-cancel').click();

    // 浮层消失，按钮恢复，对比保持禁用（未产生优化结果）
    await expect(page.locator('#edit-ai-overlay')).toBeHidden({ timeout: 10000 });
    await expect(page.locator('#edit-sr')).toBeEnabled();
    await expect(page.locator('#edit-compare')).toBeDisabled();
    await expect(page.locator('#edit-ai-tips')).toBeHidden();
  });

  test('⑤ 超清后前后对比可用', async ({ page }) => {
    const id = await getFirstArtworkId(page);
    await openWorkbench(page, id);

    await srAndWait(page);

    // 对比按钮启用，点击进入对比模式
    await page.locator('#edit-compare').click();
    await expect(page.locator('#edit-compare-layer')).toBeVisible();
    await expect(page.locator('#edit-compare-original')).toBeVisible();
    await expect(page.locator('#edit-compare-range')).toBeVisible();

    // 退出对比
    await page.locator('#edit-compare').click();
    await expect(page.locator('#edit-compare-layer')).toBeHidden();
  });

  test('⑥ 全程无控制台错误', async ({ page }) => {
    const errors = [];
    // 过滤环境网络噪音（离线/云端拒绝连接的资源加载错误，与功能无关）
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(String(err)));

    const id = await getFirstArtworkId(page);
    await openWorkbench(page, id);
    await srAndWait(page);
    await page.locator('#edit-compare').click();
    await expect(page.locator('#edit-compare-layer')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
