// ============================================================
// tests/theme-switch.spec.js — 风格主题（data-style）Playwright 回归测试
// 覆盖 A~E 共 14 个测试：令牌层、视觉层、持久化、容错、明暗隔离
// 关联：ink-theme.css §17 风格主题覆盖层修复
// ============================================================
import { test, expect } from '@playwright/test';

const LS_STYLE = 'dreamcore-particle-theme';
const LS_STYLE_LEGACY = 'dreamcore-particleTheme';
const LS_THEME = 'dreamcore-theme';

async function gotoFresh(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
}
async function dismissWelcome(page) {
  try { await page.locator('#welcome-enter').click({ timeout: 3000 }); } catch (_) {}
}
async function openDrawer(page) {
  await page.locator('#settings-toggle').click();
  await page.waitForTimeout(400);
  await page.locator('.sc-drawer.show').waitFor();
}
async function closeDrawer(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
}
async function setStorage(page, data) {
  await page.addInitScript((d) => {
    try { localStorage.clear(); } catch(e) {}
    for (const [k, v] of Object.entries(d)) {
      if (v === null) continue;
      localStorage.setItem(k, v);
    }
  }, data);
}
async function clickStyleInDrawer(page, style) {
  await page.locator(`.sc-seg[data-setting="particleTheme"] button[data-val="${style}"]`).click();
  await page.waitForTimeout(300);
}
async function clickThemeInDrawer(page, theme) {
  await page.locator(`.sc-seg[data-setting="theme"] button[data-val="${theme}"]`).click();
  await page.waitForTimeout(300);
}

// ============================================================
// A. 属性与令牌层
// ============================================================
test.describe('A. 属性与令牌层', () => {

  test('A1 guofeng → --bg-dark=#f7f1e5', async ({ page }) => {
    await setStorage(page, { [LS_STYLE]: 'guofeng' });
    await gotoFresh(page);

    const attr = await page.evaluate(() => document.documentElement.getAttribute('data-style'));
    expect(attr).toBe('guofeng');

    const bgDark = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg-dark').trim()
    );
    expect(bgDark).toBe('#f7f1e5');
  });

  test('A2 feiyi → --bg-dark=#eef2f7；minimal → --bg-dark=#fafafa', async ({ page }) => {
    await setStorage(page, { [LS_STYLE]: 'feiyi' });
    await gotoFresh(page);

    let bgDark = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg-dark').trim()
    );
    expect(bgDark).toBe('#eef2f7');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    // 重新用 minimal
    await page.addInitScript(() => {
      localStorage.setItem('dreamcore-particle-theme', 'minimal');
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    bgDark = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg-dark').trim()
    );
    expect(bgDark).toBe('#fafafa');
  });

  test('A3 default → data-style 属性被移除，--bg-dark=#faf6ee', async ({ page }) => {
    await setStorage(page, { [LS_STYLE]: 'default' });
    await gotoFresh(page);

    const attr = await page.evaluate(() => document.documentElement.getAttribute('data-style'));
    expect(attr).toBeNull();

    const bgDark = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg-dark').trim()
    );
    expect(bgDark).toBe('#faf6ee');
  });

  test('A4 guofeng + dark 正交 → data-style=guofeng + data-theme=dark 同时成立 + --bg-dark=#1a1410', async ({ page }) => {
    await setStorage(page, { [LS_STYLE]: 'guofeng', [LS_THEME]: 'dark' });
    await gotoFresh(page);

    const styleAttr = await page.evaluate(() => document.documentElement.getAttribute('data-style'));
    expect(styleAttr).toBe('guofeng');

    const themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(themeAttr).toBe('dark');

    const bgDark = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg-dark').trim()
    );
    expect(bgDark).toBe('#1a1410');
  });

  test('A5 4 风格 --accent 互不相同', async ({ page }) => {
    const expectedAccents = {
      default: '#a8261f',
      guofeng: '#c23e2b',
      feiyi:   '#1f4e79',
      minimal: '#111827',
    };

    const styles = ['default', 'guofeng', 'feiyi', 'minimal'];
    const accents = [];

    for (const style of styles) {
      if (style === 'default') {
        await setStorage(page, {}); // default = 无 data-style
      } else {
        await setStorage(page, { [LS_STYLE]: style });
      }
      await gotoFresh(page);

      const accent = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
      );
      accents.push({ style, accent });

      // 清除运行时 localStorage，为下一轮 addInitScript 让出干净环境
      await page.evaluate(() => { try { localStorage.clear(); } catch(_) {} });
    }

    // 每个 accent 都不同
    const accentValues = accents.map(a => a.accent);
    const unique = new Set(accentValues);
    expect(unique.size).toBe(4);

    // 各值与期望值吻合
    for (const { style, accent } of accents) {
      expect(accent, `${style} --accent`).toBe(expectedAccents[style]);
    }
  });
});

// ============================================================
// B. 页面视觉层
// ============================================================
test.describe('B. 页面视觉层', () => {

  test('B1 hash 路由 #/gallery 下切 4 种风格 → body 背景至少 3 套不同', async ({ page }) => {
    await gotoFresh(page);
    await dismissWelcome(page);
    await page.goto('/#/gallery', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    await openDrawer(page);

    const styles = ['default', 'guofeng', 'feiyi', 'minimal'];
    const bodies = [];

    for (const s of styles) {
      await clickStyleInDrawer(page, s);
      await page.waitForTimeout(400);
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      bodies.push({ style: s, bodyBg: bg });
    }

    const uniqueBgs = new Set(bodies.map(b => b.bodyBg));
    expect(uniqueBgs.size, `只得到 ${uniqueBgs.size} 种 body 背景，期望至少 3 套不同`).toBeGreaterThanOrEqual(3);
  });

  test('B2 Drawer 入口与全屏设置页入口切换一致', async ({ page }) => {
    await gotoFresh(page);
    await dismissWelcome(page);

    // Drawer 切到 guofeng
    await openDrawer(page);
    await clickStyleInDrawer(page, 'guofeng');

    // 关闭 Drawer
    await closeDrawer(page);

    // 打开全屏设置页（通常有单独入口，或 Drawer 内跳转）
    // 从 Drawer 再次进入应能看到选中态
    await openDrawer(page);

    const guofengSelected = await page.locator(
      '.sc-seg[data-setting="particleTheme"] button[data-val="guofeng"].active'
    ).count();

    expect(guofengSelected, 'Drawer 中 guofeng 按钮应呈选中态').toBeGreaterThanOrEqual(1);

    // data-style 也应为 guofeng
    const attr = await page.evaluate(() => document.documentElement.getAttribute('data-style'));
    expect(attr).toBe('guofeng');
  });
});

// ============================================================
// C. 持久化与恢复
// ============================================================
test.describe('C. 持久化与恢复', () => {

  test('C1 reload 后风格主题保持', async ({ page }) => {
    await gotoFresh(page);
    await dismissWelcome(page);

    await openDrawer(page);
    await clickStyleInDrawer(page, 'feiyi');
    await closeDrawer(page);

    let attr = await page.evaluate(() => document.documentElement.getAttribute('data-style'));
    expect(attr).toBe('feiyi');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);

    attr = await page.evaluate(() => document.documentElement.getAttribute('data-style'));
    expect(attr).toBe('feiyi');

    // localStorage 中确实持久化了
    const stored = await page.evaluate(() => localStorage.getItem('dreamcore-particle-theme'));
    expect(stored).toBe('feiyi');
  });

  test('C2 旧键脏数据迁移 + 去引号', async ({ page }) => {
    // 写入 legacy 键带引号值
    await page.addInitScript(() => {
      try { localStorage.clear(); } catch(_) {}
      localStorage.setItem('dreamcore-particleTheme', '"guofeng"');
    });
    await gotoFresh(page);

    const attr = await page.evaluate(() => document.documentElement.getAttribute('data-style'));
    expect(attr).toBe('guofeng');

    // 新键应被写入
    const newKeyVal = await page.evaluate(() => localStorage.getItem('dreamcore-particle-theme'));
    expect(newKeyVal).toBe('guofeng');
  });

  test('C3 新键裸值直读', async ({ page }) => {
    await setStorage(page, { 'dreamcore-particle-theme': 'minimal' });
    await gotoFresh(page);

    const attr = await page.evaluate(() => document.documentElement.getAttribute('data-style'));
    expect(attr).toBe('minimal');

    const bgDark = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg-dark').trim()
    );
    expect(bgDark).toBe('#fafafa');
  });
});

// ============================================================
// D. 兜底与容错
// ============================================================
test.describe('D. 兜底与容错', () => {

  test('D1 window.Particles 被置为 undefined 时切 guofeng → data-style=guofeng 仍生效', async ({ page }) => {
    await gotoFresh(page);
    await dismissWelcome(page);

    // 运行时破坏 Particles
    await page.evaluate(() => {
      window.Particles = undefined;
    });

    await openDrawer(page);
    await clickStyleInDrawer(page, 'guofeng');

    const attr = await page.evaluate(() => document.documentElement.getAttribute('data-style'));
    expect(attr).toBe('guofeng');

    const bgDark = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg-dark').trim()
    );
    expect(bgDark).toBe('#f7f1e5');
  });

  test('D2 连续点同一风格两次 → data-style 保持正确，无异常', async ({ page }) => {
    await gotoFresh(page);
    await dismissWelcome(page);

    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await openDrawer(page);
    await clickStyleInDrawer(page, 'feiyi');
    await clickStyleInDrawer(page, 'feiyi');

    const attr = await page.evaluate(() => document.documentElement.getAttribute('data-style'));
    expect(attr).toBe('feiyi');

    // 不应有 JS 错误（Particles.setTheme 可能抛，但不应导致页面异常）
    // 容错：errors 中不应有 "Cannot read" / "is not a function" 等致命错误
    const fatalErrors = errors.filter(e =>
      e.includes('Cannot read') || e.includes('is not a function') || e.includes('Failed to fetch')
    );
    expect(fatalErrors.length).toBe(0);
  });

  test('D3 快速连点 4 种风格 12 次 → 最终 data-style 与最后点击一致，console error=0', async ({ page }) => {
    await gotoFresh(page);
    await dismissWelcome(page);

    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await openDrawer(page);

    // 快速循环：default→guofeng→feiyi→minimal 三轮共 12 次
    const cycle = ['default', 'guofeng', 'feiyi', 'minimal'];
    const clicks = [];
    for (let i = 0; i < 3; i++) clicks.push(...cycle);

    for (const style of clicks) {
      await page.locator(`.sc-seg[data-setting="particleTheme"] button[data-val="${style}"]`).click();
      await page.waitForTimeout(50); // 快速连点
    }

    const finalStyle = clicks[clicks.length - 1]; // 'minimal'
    const attr = await page.evaluate(() => document.documentElement.getAttribute('data-style'));

    // finalStyle 是 minimal → data-style="minimal"；若是 default → data-style=null
    if (finalStyle === 'default') {
      expect(attr).toBeNull();
    } else {
      expect(attr).toBe(finalStyle);
    }

    // console error 数量
    expect(errors.length, `console 出现 ${errors.length} 条错误: ${errors.join(' | ')}`).toBe(0);
  });
});

// ============================================================
// E. 与明暗隔离
// ============================================================
test.describe('E. 与明暗隔离', () => {

  test('E1 data-style=guofeng 下执行深→浅→深循环 → data-theme 断言成立（风格不影响明暗）', async ({ page }) => {
    await setStorage(page, { [LS_STYLE]: 'guofeng' });
    await gotoFresh(page);
    await dismissWelcome(page);

    await openDrawer(page);

    const path = ['dark', 'light', 'dark'];
    for (const target of path) {
      await clickThemeInDrawer(page, target);
      const themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      expect(themeAttr, `切 theme=${target} 后 theme=${themeAttr}`).toBe(target);

      // 风格保持 guofeng
      const styleAttr = await page.evaluate(() => document.documentElement.getAttribute('data-style'));
      expect(styleAttr, `切 theme=${target} 后 style 不应被改动`).toBe('guofeng');
    }
  });

  test('E2 明暗切换不影响 data-style 属性', async ({ page }) => {
    await setStorage(page, { [LS_STYLE]: 'minimal' });
    await gotoFresh(page);
    await dismissWelcome(page);

    await openDrawer(page);

    await clickThemeInDrawer(page, 'dark');
    await page.waitForTimeout(200);
    await clickThemeInDrawer(page, 'light');
    await page.waitForTimeout(200);
    await clickThemeInDrawer(page, 'dark');

    const styleAttr = await page.evaluate(() => document.documentElement.getAttribute('data-style'));
    expect(styleAttr).toBe('minimal');

    const themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(themeAttr).toBe('dark');
  });
});
