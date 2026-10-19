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

  // ============================================================
  // 修复回归（2026-10-18）：「语音讲解」缺暂停/关闭入口 + 「小梦」挂件不可点击
  // ============================================================
  test('合成中可取消：加载态按钮可点击，再点即取消且不进入播放', async ({ page }) => {
    await clearStorage(page.context());
    // 延迟响应，制造「语音合成中…」窗口，验证此时可取消
    await page.route('**/api/ai/tts', async (route) => {
      await new Promise(r => setTimeout(r, 3000));
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ audioUrl: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=' })
      });
    });
    await openApp(page);
    await stubAudio(page);
    await loadDigitalGuide(page);

    await page.goto('/#/atlas?theme=dunhuang');
    const overlay = page.locator('#culture-atlas-page');
    await overlay.locator('.ca-detail-name').waitFor({ timeout: 10000 });
    const btn = overlay.locator('.tts-btn[data-tts-text]').first();
    await btn.waitFor({ timeout: 10000 });

    // 点击 → 进入加载态，按钮文案提示「点击取消」
    await btn.click();
    await expect(btn).toHaveClass(/tts-loading/, { timeout: 3000 });
    await expect(btn).toContainText('点击取消');

    // 再点同一按钮 → 立即取消，按钮复位
    await btn.click();
    await expect(btn).not.toHaveClass(/tts-loading/, { timeout: 3000 });
    await expect(btn).toContainText('语音讲解');

    // 原请求返回后不得进入播放，挂件应已淡出
    await page.waitForTimeout(3600);
    await expect(btn).not.toHaveClass(/tts-playing/);
    await expect(page.locator('#digital-guide')).toBeHidden({ timeout: 4000 });
  });

  test('关闭图鉴浮层即停止讲解（不依赖 hashchange）', async ({ page }) => {
    await clearStorage(page.context());
    await mockTtsRoute(page);
    await openApp(page);
    await stubAudio(page);
    await loadDigitalGuide(page);

    await page.goto('/#/atlas?theme=dunhuang');
    const overlay = page.locator('#culture-atlas-page');
    await overlay.locator('.ca-detail-name').waitFor({ timeout: 10000 });
    const btn = overlay.locator('.tts-btn[data-tts-text]').first();
    await btn.waitFor({ timeout: 10000 });

    await btn.click();
    await expect(btn).toHaveClass(/tts-playing/, { timeout: 5000 });

    // 关闭浮层：hash 不变（无 hashchange），必须由 closeAtlas 主动停讲解
    await overlay.locator('[data-close]').first().click();
    expect(await page.evaluate(() => window.__ttsPaused)).toBeGreaterThanOrEqual(1);
    await expect(page.locator('#digital-guide')).toBeHidden({ timeout: 5000 });
  });

  test('讲解中点击「小梦」挂件：可停止讲解（挂件不再是无反应的装饰）', async ({ page }) => {
    await clearStorage(page.context());
    await mockTtsRoute(page);
    await openApp(page);
    await stubAudio(page);
    await loadDigitalGuide(page);

    await page.goto('/#/atlas?theme=dunhuang');
    const overlay = page.locator('#culture-atlas-page');
    await overlay.locator('.ca-detail-name').waitFor({ timeout: 10000 });
    const btn = overlay.locator('.tts-btn[data-tts-text]').first();
    await btn.waitFor({ timeout: 10000 });

    await btn.click();
    const dg = page.locator('#digital-guide');
    await expect(dg).toHaveClass(/dg-playing/, { timeout: 5000 });
    await expect(dg).toHaveAttribute('title', /点击停止/);

    // 直接点击挂件本体 → 停止讲解
    await dg.locator('.dg-body').click();
    expect(await page.evaluate(() => window.__ttsPaused)).toBeGreaterThanOrEqual(1);
    await expect(dg).toBeHidden({ timeout: 5000 });
  });

  test('合成超时兜底按文本长度放宽（长讲解不再被 20s 误杀）', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);

    // tts-player 暴露 getTimeoutMs 便于回归断言：长文本超时必须显著大于旧的 20s 固定阈值，
    // 否则云端耗时 30s+ 的正常讲解会被 abort 成「signal is aborted without reason」
    const t = await page.evaluate(() => {
      const f = window.TTSPlayer && window.TTSPlayer.getTimeoutMs;
      if (typeof f !== 'function') return null;
      return { short: f('短句'), long: f('文'.repeat(2000)) };
    });
    expect(t).not.toBeNull();
    // 短文本走下限保护（30s），不会因文本极短而瞬间超时
    expect(t.short).toBeGreaterThanOrEqual(30000);
    // 2000 字（云函数文本上限量级）封顶在 180s，避免请求彻底挂死时无限等待
    expect(t.long).toBeLessThanOrEqual(180000);
    expect(t.long).toBeGreaterThan(t.short);
    // 实测敦煌讲解约 313 字、云端同步合成约 34s → 超时必须放宽到 60s 以上
    const dunhuang = await page.evaluate(() => window.TTSPlayer.getTimeoutMs('敦煌'.repeat(157)));
    expect(dunhuang).toBeGreaterThan(60000);
  });
});
