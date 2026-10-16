// ============================================================
// tests/p1-digital-guide.spec.js — P1-3 数字人讲解员「小梦」测试
// 覆盖：
//   ① TTS 播放驱动：点击 .tts-btn → #digital-guide 挂件出现
//      （带 .dg-loading/.dg-playing 形态类 + 「小梦」文案）；
//      再点停止 → 1.2s 停留 + 0.45s 淡出，~2s 内回归隐藏
//   ② tts-state 事件广播不破坏原按钮状态机：
//      .tts-loading/.tts-playing 仍正常切换、按钮文案复位、广播序列正确
// 说明：沿 culture-features.spec.js 的 clearStorage/openApp/mockTtsRoute/stubAudio
//      模式；TTS 云函数走 page.route mock，不依赖外部 API。
//      Audio 桩须在页面加载后注入（hash 导航不重载文档，桩得以保留）。
//      digital-guide.js 经页面内动态 import 注入（主控尚未在 main.js 挂载；
//      模块顶层自初始化 + window 标记幂等，与正式接入方式行为一致）。
// ============================================================
import { test, expect } from '@playwright/test';

// ---------------- 基础工具（沿 culture-features.spec.js 模式） ----------------

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

/** mock /api/ai/tts（仅注册路由；Audio 桩须在页面加载后注入，否则被导航冲掉） */
async function mockTtsRoute(page) {
  await page.route('**/api/ai/tts', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ audioUrl: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=' })
    });
  });
}

/** 桩化 window.Audio（避免真实音频解码失败），pause 计数用于断言 stop 行为 */
async function stubAudio(page) {
  await page.evaluate(() => {
    window.__ttsPaused = 0;
    window.Audio = class {
      constructor(src) { this.src = src; }
      play() { return Promise.resolve(); }
      pause() { window.__ttsPaused = (window.__ttsPaused || 0) + 1; }
    };
  });
}

/** 页面内动态 import 数字人模块（自初始化 + 幂等；hash 导航不冲掉） */
async function loadDigitalGuide(page) {
  await page.evaluate(async () => { await import('/js/digital-guide.js'); });
}

// ============================================================
// P1-3 数字人讲解员「小梦」
// ============================================================
test.describe('P1-3 数字人讲解员「小梦」', () => {
  test('TTS 播放驱动：挂件出现带形态类与「小梦」文案，停止后 ~2s 内淡出隐藏', async ({ page }) => {
    await clearStorage(page.context());
    await mockTtsRoute(page);
    await openApp(page);

    // Audio 桩须在页面加载后注入；数字人模块动态 import（自初始化挂载，默认隐藏）
    await stubAudio(page);
    await loadDigitalGuide(page);

    // 敦煌图鉴详情（核心主题：事实卡 + TTS 按钮）
    await page.goto('/#/atlas?theme=dunhuang');
    const overlay = page.locator('#culture-atlas-page');
    await overlay.locator('.ca-detail-name').waitFor({ timeout: 10000 });
    const btn = overlay.locator('.tts-btn[data-tts-text]').first();
    await btn.waitFor({ timeout: 10000 });

    // 初始：挂件已挂载但隐藏（display:none）
    const dg = page.locator('#digital-guide');
    await expect(dg).toHaveCount(1);
    await expect(dg).toBeHidden();

    // 点击 TTS → 挂件出现：淡入上滑 + loading/playing 形态类 + 「小梦」标签
    await btn.click();
    await expect(dg).toBeVisible({ timeout: 5000 });
    await expect(dg).toHaveClass(/dg-(loading|playing)/, { timeout: 5000 });
    await expect(dg).toContainText('小梦');

    // mock 路由即回 → Audio.play() 成功后切 playing 形态，标签变「AI 讲解中」
    await expect(dg).toHaveClass(/dg-playing/, { timeout: 5000 });
    await expect(dg).toContainText('AI 讲解中');

    // 再点同一按钮 = 停止 → dg-stopped 停留 1.2s → 淡出 0.45s → 回归隐藏
    await btn.click();
    await expect(dg).toBeHidden({ timeout: 5000 });
    expect(await page.evaluate(() => window.__ttsPaused)).toBeGreaterThanOrEqual(1);
  });

  test('tts-state 事件广播不破坏原按钮状态机（.tts-playing 仍正常切换）', async ({ page }) => {
    await clearStorage(page.context());
    await mockTtsRoute(page);
    await openApp(page);

    await stubAudio(page);
    // 记录广播序列与文本（hash 导航前注册，同文档内持续有效）
    await page.evaluate(() => {
      window.__ttsStates = [];
      window.__ttsTexts = [];
      document.addEventListener('tts-state', (e) => {
        window.__ttsStates.push((e.detail && e.detail.state) || '?');
        window.__ttsTexts.push((e.detail && e.detail.text) || '');
      });
    });

    await page.goto('/#/atlas?theme=dunhuang');
    const overlay = page.locator('#culture-atlas-page');
    await overlay.locator('.ca-detail-name').waitFor({ timeout: 10000 });
    const btn = overlay.locator('.tts-btn[data-tts-text]').first();
    await btn.waitFor({ timeout: 10000 });

    // 点击 → 原按钮状态机不受广播影响：loading → playing 类与文案正常
    await btn.click();
    await expect(btn).toHaveClass(/tts-playing/, { timeout: 5000 });
    await expect(btn).not.toHaveClass(/tts-loading/);
    await expect(btn).toContainText('播放中');

    // 广播序列同步正确：loading → playing，事件携带讲解文本
    await expect.poll(() => page.evaluate(() => window.__ttsStates.join(',')), { timeout: 5000 })
      .toBe('loading,playing');
    expect(await page.evaluate(() => (window.__ttsTexts[0] || '').length)).toBeGreaterThan(10);

    // 再点停止 → 按钮类与文案复位 + 末次广播 stopped
    await btn.click();
    await expect(btn).not.toHaveClass(/tts-playing/);
    await expect(btn).toContainText('语音讲解');
    await expect.poll(() => page.evaluate(() => window.__ttsStates[window.__ttsStates.length - 1]), { timeout: 5000 })
      .toBe('stopped');
    expect(await page.evaluate(() => window.__ttsPaused)).toBeGreaterThanOrEqual(1);
  });
});
