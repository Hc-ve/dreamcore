// ============================================================
// tests/p0-poster.spec.js — P0-2 通用分享海报（画廊灯箱挂载点）
// 覆盖：
//   打开首页 → 点开第一张作品灯箱 → 点「分享卡」按钮
//   → 断言 #share-poster-modal 弹窗出现且内含 img[src^="data:image/png"]
//   → 断言弹窗内下载入口（a[download="dreamcore-share.png"]）
//   → 断言灯箱原有按钮（点赞/收藏/分享）仍存在
//   → 关闭弹窗后灯箱仍正常（清理无残留）
// 说明：不 mock 灯箱本身，真实走种子数据 + Canvas 合成 + qrcode 动态加载。
// ============================================================
import { test, expect } from '@playwright/test';

// ---------------- 基础工具 ----------------

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

// ============================================================
// P0-2 作品分享海报（画廊灯箱）
// ============================================================
test.describe('P0-2 作品分享海报', () => {
  test('灯箱「分享卡」：生成海报预览弹窗（PNG dataURL）+ 灯箱操作不回退', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);

    // 打开第一张作品灯箱
    await page.locator('.artwork-card').first().click();
    const lb = page.locator('#lightbox-modal');
    await lb.locator('.lb-title').waitFor({ timeout: 10000 });

    // 灯箱原有操作按钮存在（生成前基线）
    await expect(lb.locator('#lb-like-btn')).toBeVisible();
    await expect(lb.locator('#lb-fav-btn')).toBeVisible();
    await expect(lb.locator('#lb-share-btn')).toBeVisible();

    // 点「分享卡」→ 海报弹窗出现且内含 PNG dataURL 图片
    const posterBtn = lb.locator('#lb-poster-btn');
    await expect(posterBtn).toBeVisible();
    await posterBtn.click();

    const modal = page.locator('#share-poster-modal');
    await modal.waitFor({ timeout: 20000 });
    await modal.locator('img[src^="data:image/png"]').waitFor({ timeout: 10000 });
    await expect(modal.locator('.sp-poster-img')).toBeVisible();

    // 弹窗内下载入口：<a download="dreamcore-share.png"> 指向同一张 PNG
    const download = modal.locator('a[download="dreamcore-share.png"]');
    await expect(download).toBeVisible();
    await expect(download).toHaveAttribute('href', /^data:image\/png/);

    // 海报弹窗叠加在灯箱之上：灯箱原有按钮（点赞/收藏）仍存在
    await expect(lb.locator('#lb-like-btn')).toHaveCount(1);
    await expect(lb.locator('#lb-fav-btn')).toHaveCount(1);

    // 关闭海报弹窗 → DOM 清理干净，灯箱仍正常展示
    await modal.locator('[data-close]').click();
    await expect(modal).toHaveCount(0);
    await expect(lb.locator('.lb-title')).toBeVisible();
    await expect(lb.locator('#lb-poster-btn')).toBeVisible();
  });
});
