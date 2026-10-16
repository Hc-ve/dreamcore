// ============================================================
// tests/scenic-craft-p1-poster.spec.js — P1 分享海报串联验收
// 验证点：
//   ① 景区 → craft 打开时匹配提示条可见（P0 已有，确认不回归）
//   ② 点「分享海报」按钮 → SharePoster.downloadPoster 被调用，
//      且 themeTag 包含景区名 + 风格（如 "#龙门石窟 #水墨风格"）
// ============================================================
import { test, expect } from '@playwright/test';

async function dismissWelcome(page) {
  try { await page.locator('#welcome-enter').click({ timeout: 4000 }); } catch (_) {}
}
async function openApp(page) {
  await page.goto('/');
  await page.waitForSelector('.artwork-card', { timeout: 20000 });
  await dismissWelcome(page);
}
function mockCultureStory(page) {
  return page.route('**/api/ai/culture-story', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ name: '测试', connotation: 'ok', knowledgeBase: true }) });
  });
}

test.describe('P1 分享海报串联（景区→文创→海报）', () => {

  test('点分享海报 → SharePoster.downloadPoster 被调用，themeTag 含景区名+风格', async ({ page }) => {
    await openApp(page);
    await mockCultureStory(page);

    // 跳龙门石窟 → 进 craft → 打开 mockup 让 canvas 有内容（否则 SharePoster 会 skip）
    await page.goto('/#/scenic?area=longmen', { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForSelector('#sn-craft-btn', { timeout: 8000 });
    await page.locator('#sn-craft-btn').click();

    await page.waitForSelector('#ai-craft-workbench', { timeout: 10000 });
    // 确认匹配提示条可见
    await expect(page.locator('[data-scenic-match="true"]')).toBeVisible();

    // 触发一次 AI 整图生成 / 或至少让 canvas 有内容
    await page.locator('#craft-studio-generate').click();
    await page.waitForTimeout(1500);

    // 拦截 SharePoster.downloadPoster
    const posterCalls = [];
    await page.evaluate(() => {
      const orig = window.SharePoster && window.SharePoster.downloadPoster;
      if (orig) {
        window.__p1_poster_stub = (opts) => {
          console.log('[P1-STUB] downloadPoster called with:', opts);
          (window.__p1_poster_logs ||= []).push({ themeTag: opts.themeTag, title: opts.title, footerCta: opts.footerCta });
          return Promise.resolve({ ok: true });
        };
        window.SharePoster.downloadPoster = window.__p1_poster_stub;
      }
    });

    // 点分享海报
    await page.locator('#craft-poster-btn').click();
    await page.waitForTimeout(1500);

    const logs = await page.evaluate(() => window.__p1_poster_logs || []);
    console.log('[P1-TEST] poster calls:', logs.length, logs);
    expect(logs.length).toBeGreaterThan(0);

    const latest = logs[logs.length - 1];
    expect(latest.themeTag).toBeTruthy();
    expect(String(latest.themeTag)).toMatch(/龙门石窟/);
    expect(String(latest.themeTag)).toMatch(/水墨/);
  });

});
