// ============================================================
// tests/scenic-craft-p0.spec.js — 「热门景区 → AI 文创」一键生成 P0 验收
// 覆盖：
//   ① 无 themeId 但有 scenic-craft-map 映射的景区也能显示「一键做 3D 文创」CTA
//      （殷墟 / 清明上河园 / 老君山）
//   ② 点击 CTA → URL 带上 style + category + scenic 参数 → 打开 #/craft 工作台
//   ③ 工作台顶部出现「已为您匹配【XX】XX 风格」提示条
//   ④ 降级逻辑：matchArtworksByTheme 匹配不到主题作品时
//      → 用兜底作品 id 继续进入 #/craft（不走 Gallery 选择器）
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
    } catch (_) { /* ignore */ }
  });
}

async function dismissWelcome(page) {
  try { await page.locator('#welcome-enter').click({ timeout: 4000 }); } catch (_) { /* skip */ }
}

async function openApp(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForSelector('.artwork-card', { timeout: 20000 });
  await dismissWelcome(page);
}

// 打开景区模块并导航到指定 area
async function openScenicArea(page, areaId) {
  await page.goto(`/#/scenic?area=${areaId}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
  // scenic-recommend 实际容器是 #scenic-recommend-page (modal-overlay)，而非 .sn-overlay
  await page.waitForSelector('#scenic-recommend-page', { timeout: 10000 });
}

// mock /api/ai/culture-story，给景区讲解一个合法返回
function mockCultureStory(page, connotation = '测试讲解') {
  return page.route('**/api/ai/culture-story', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ name: '测试', connotation, knowledgeBase: true })
    });
  });
}

// ============================================================
// ① 无 themeId 但有映射的景区（殷墟）也能显示 CTA
// ============================================================
test('CTA：殷墟(themeId=null 但有映射) 应显示「用文创创作」按钮', async ({ page }) => {
  await clearStorage(page.context());
  await openApp(page);
  await mockCultureStory(page, '殷墟青铜文明');
  await openScenicArea(page, 'yinxu');
  // _renderCta 当前仅在 theme 存在时显示，殷墟 themeId=null
  // 本用例要让它也显示 CTA
  const btn = page.locator('#sn-craft-btn');
  await expect(btn).toBeVisible({ timeout: 5000 });
  await expect(btn).toContainText('文创');
});

// ============================================================
// ② 点击 CTA → URL 带 style/category/scenic → 打开工作台
// ============================================================
test('点击 CTA → URL 携带 style/category/scenic → 工作台打开', async ({ page }) => {
  await clearStorage(page.context());
  await openApp(page);
  await mockCultureStory(page, '龙门石窟石刻');
  await openScenicArea(page, 'longmen');

  await page.locator('#sn-craft-btn').click();
  // 等待 hash 跳转完成
  await page.waitForFunction(() => {
    const h = location.hash || '';
    return h.includes('#/craft') && h.includes('style=');
  }, { timeout: 10000 });

  const hash = page.url();
  expect(hash).toMatch(/#\/craft\?/);
  expect(hash).toContain('artworkId=');
  expect(hash).toContain('style=');

  // 工作台 DOM 出现
  await expect(page.locator('#ai-craft-workbench')).toBeVisible({ timeout: 8000 });
});

// ============================================================
// ③ 工作台顶部出现匹配提示条
// ============================================================
test('工作台顶部显示「已为您匹配【龙门石窟】水墨风格」提示条', async ({ page }) => {
  await clearStorage(page.context());
  await openApp(page);
  await mockCultureStory(page);
  await openScenicArea(page, 'longmen');

  await page.locator('#sn-craft-btn').click();
  await page.waitForSelector('#ai-craft-workbench', { timeout: 10000 });

  // 匹配提示条 DOM
  const matchHint = page.locator('[data-scenic-match="true"], .craft-scenic-match-hint');
  await expect(matchHint).toBeVisible({ timeout: 5000 });
  const text = await matchHint.textContent();
  expect(text).toContain('匹配');
  expect(text).toContain('水墨');
});

// ============================================================
// ④ 降级逻辑：主题作品匹配不到时用兜底作品继续 craft 而非 gallery
// ============================================================
test('降级：matchArtworksByTheme 无结果 → 兜底第一幅作品进入 #/craft（不走 Gallery）', async ({ page }) => {
  await clearStorage(page.context());
  await openApp(page);

  // 拦截 matchArtworksByTheme，让它始终返回空数组
  await page.addInitScript(() => {
    const orig = window.matchArtworksByTheme;
    if (typeof orig === 'function') {
      window.matchArtworksByTheme = () => [];
    }
  });

  await mockCultureStory(page);
  await openScenicArea(page, 'longmen');

  // 监听 hash 变化——期望它跳到 #/craft?artworkId=xxx，而不是 #gallery
  let targetHash = null;
  page.on('hashchange', () => { targetHash = location.hash; });

  await page.locator('#sn-craft-btn').click();
  await page.waitForTimeout(1500);

  // 应该进入 craft，而不是 gallery
  expect(targetHash || page.url()).toMatch(/#\/craft\?/);
  expect(targetHash || page.url()).not.toMatch(/#gallery/);
  await expect(page.locator('#ai-craft-workbench')).toBeVisible({ timeout: 8000 });
});
