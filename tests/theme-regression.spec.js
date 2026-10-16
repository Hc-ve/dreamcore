// ============================================================
// tests/theme-regression.spec.js — 深色/浅色主题 + 粒子特效 回归测试
// 覆盖：
//   ① 硬刷新：dark / light / auto 三种 localStorage 值 → data-theme 正确
//   ② Watchdog：启动 3 秒内 data-theme 不被篡改（Vite HMR 注入对抗）
//   ③ Drawer 运行时切换：深↔浅↔跟随 三次循环
//   ④ Particles ResizeObserver：interval 自限后不再触发 _onResize
//   ⑤ CSS 变量：[data-theme="dark"] 下 --bg-dark 正确覆盖
//   ⑥ localStorage 引号污染防御：JSON.stringify 值能正确解析
//   ⑦ matchMedia 跟随系统：auto 模式下系统变化触发主题切换
// ============================================================
import { test, expect } from '@playwright/test';

const LS_KEY = 'dreamcore-theme';
const LS_PREFIX = 'dreamcore-';

async function gotoFresh(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // 等应用初始化
  await page.waitForTimeout(800);
}

async function dismissWelcome(page) {
  try {
    await page.locator('#welcome-enter').click({ timeout: 3000 });
  } catch (_) { /* 无弹窗则跳过 */ }
}

async function setThemeLS(page, raw) {
  await page.addInitScript((v) => {
    try { localStorage.clear(); } catch(e) {}
    if (v !== null && v !== undefined) {
      localStorage.setItem('dreamcore-theme', JSON.stringify(v));
    }
  }, raw);
}

// ============================================================
// ① 硬刷新：dark / light / auto 三种 localStorage 值
// ============================================================
test.describe('硬刷新主题初始化', () => {
  test('①-a localStorage=dark → data-theme=dark + body 深色', async ({ page }) => {
    await setThemeLS(page, 'dark');
    await gotoFresh(page);

    // 立刻看 HEAD 脚本应该已经设好
    const attr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(attr).toBe('dark');

    // body 背景色应为夜读墨 #14110e = rgb(20,17,14)
    // （2026-10 墨韵丹青改版：原 #0a0612 粉紫深底 → 暖墨深底，见 css/ink-theme.css）
    await page.waitForTimeout(400); // 等 body 背景过渡结束
    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bodyBg).toBe('rgb(20, 17, 14)');
  });

  test('①-b localStorage=light → data-theme=light + body 浅色', async ({ page }) => {
    await setThemeLS(page, 'light');
    await gotoFresh(page);

    const attr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(attr).toBe('light');

    // 2026-10 墨韵丹青改版：原 #f5f3fa 粉紫浅底 → 宣纸 #faf6ee
    await page.waitForTimeout(400);
    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bodyBg).toBe('rgb(250, 246, 238)');
  });

  test('①-c localStorage=auto（系统浅）→ data-theme=light', async ({ page }) => {
    // 确保 matchMedia dark=false（默认）
    await page.emulateMedia({ colorScheme: 'light' });
    await setThemeLS(page, 'auto');
    await gotoFresh(page);

    const attr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(attr).toBe('light');
  });

  test('①-d localStorage=auto（系统深）→ data-theme=dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await setThemeLS(page, 'auto');
    await gotoFresh(page);

    const attr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(attr).toBe('dark');
  });

  test('①-e localStorage 空（首次访问）→ 默认 auto → 跟随系统', async ({ page }) => {
    await setThemeLS(page, null); // 清空
    await page.emulateMedia({ colorScheme: 'dark' });
    await gotoFresh(page);

    const attr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    // 默认 auto → 系统 dark → 最终 dark
    expect(attr).toBe('dark');
  });
});

// ============================================================
// ② Watchdog 3 秒稳定期：data-theme 不应被 HMR 或其他脚本篡改
// ============================================================
test.describe('Watchdog 3 秒稳定期', () => {
  test('② data-theme 在启动后 3 秒内不被篡改为 light（当 localStorage=dark）', async ({ page }) => {
    await setThemeLS(page, 'dark');
    await gotoFresh(page);

    // 在 3 秒内每 250ms 测一次
    const samples = await page.evaluate(async () => {
      const results = [];
      for (let i = 0; i < 12; i++) {
        results.push({
          t: i * 250,
          theme: document.documentElement.getAttribute('data-theme')
        });
        await new Promise(r => setTimeout(r, 250));
      }
      return results;
    });

    // 所有采样都应该是 dark
    for (const s of samples) {
      expect(s.theme, `t=${s.t}ms 时 theme 被篡改为 ${s.theme}`).toBe('dark');
    }
  });
});

// ============================================================
// ③ Drawer 运行时切换：深↔浅↔跟随
// ============================================================
test.describe('Drawer 运行时主题切换', () => {
  test('③-a 点 Drawer "深" → data-theme=dark', async ({ page }) => {
    await setThemeLS(page, 'light');
    await gotoFresh(page);
    await dismissWelcome(page);

    // 打开 Drawer
    await page.locator('#settings-toggle').click();
    await page.waitForTimeout(300);
    await page.locator('.sc-drawer.show').waitFor();

    // 点"深"按钮
    await page.locator('.sc-seg[data-setting="theme"] button[data-val="dark"]').click();
    await page.waitForTimeout(300);

    const attr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(attr).toBe('dark');

    await page.waitForTimeout(400); // 等背景过渡
    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bodyBg).toBe('rgb(20, 17, 14)');
  });

  test('③-b 深→浅→深 三次循环均正确', async ({ page }) => {
    await setThemeLS(page, 'light');
    await gotoFresh(page);
    await dismissWelcome(page);

    await page.locator('#settings-toggle').click();
    await page.waitForTimeout(300);

    const path = ['dark', 'light', 'dark'];
    for (const target of path) {
      await page.locator(`.sc-seg[data-setting="theme"] button[data-val="${target}"]`).click();
      await page.waitForTimeout(200);
      const attr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      expect(attr, `切到 ${target} 后 theme=${attr}`).toBe(target);
    }
  });
});

// ============================================================
// ④ Particles ResizeObserver：interval 自限后不再触发 _onResize
// ============================================================
test.describe('Particles ResizeObserver 隔离', () => {
  test('④ Watchdog interval 自限后不再触发 particles._onResize', async ({ page }) => {
    await setThemeLS(page, 'dark');
    await gotoFresh(page);
    await page.waitForTimeout(3500); // 等 Watchdog interval 自限完成（6 tick × 500ms = 3s）

    // 安装 spy：监控 _onResize 调用次数
    const { beforeCount, afterCount } = await page.evaluate(async () => {
      if (!window.Particles || typeof window.Particles._onResize !== 'function') {
        return { beforeCount: -1, afterCount: -1 }; // Particles 未初始化，跳过
      }

      let callCount = 0;
      const orig = window.Particles._onResize.bind(window.Particles);
      window.Particles._onResize = function(...args) {
        callCount++;
        return orig(...args);
      };

      const beforeCount = callCount;

      // 500ms 内手动触发 5 次 setAttribute（模拟被篡改的场景）
      for (let i = 0; i < 5; i++) {
        document.documentElement.setAttribute('data-theme', 'light');
        document.documentElement.setAttribute('data-theme', 'dark');
        await new Promise(r => setTimeout(r, 50));
      }

      // 再等 1 秒让 ResizeObserver debounce 触发
      await new Promise(r => setTimeout(r, 1200));

      return { beforeCount, afterCount: callCount };
    });

    if (beforeCount === -1) {
      test.skip('Particles 未初始化');
      return;
    }

    // _onResize 调用次数不应因为 setAttribute 而异常增多
    // 可能会触发 1-2 次 debounce 后的 resize，但不应该超过 10 次
    expect(afterCount - beforeCount, '_onResize 被 setAttribute 异常触发').toBeLessThan(10);
  });
});

// ============================================================
// ⑤ CSS 变量：[data-theme="dark"] 下 --bg-dark 正确覆盖
// ============================================================
test.describe('CSS 变量层叠', () => {
  test('⑤ data-theme=dark 时 --bg-dark=#0a0612', async ({ page }) => {
    await setThemeLS(page, 'dark');
    await gotoFresh(page);

    const bgDark = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--bg-dark').trim();
    });
    expect(bgDark).toBe('#14110e'); // 墨韵丹青改版后的夜读墨
  });

  test('⑤-b data-theme=light 时 --bg-dark=#f5f3fa', async ({ page }) => {
    await setThemeLS(page, 'light');
    await gotoFresh(page);

    const bgDark = await page.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--bg-dark').trim();
    });
    expect(bgDark).toBe('#faf6ee'); // 墨韵丹青改版后的宣纸底
  });
});

// ============================================================
// ⑥ localStorage 引号污染防御
// ============================================================
test.describe('引号污染防御', () => {
  test('⑥ 手动写入带引号的 "dark" 能正确解析', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem('dreamcore-theme', '"dark"'); // 模拟旧版 bug：双引号包裹
    });
    await gotoFresh(page);

    const attr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(attr).toBe('dark');
  });

  test('⑥-b 手动写入不带引号的 dark 能正确解析', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem('dreamcore-theme', 'dark'); // 无引号
    });
    await gotoFresh(page);

    const attr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(attr).toBe('dark');
  });
});

// ============================================================
// ⑦ matchMedia 跟随系统
// ============================================================
test.describe('matchMedia 跟随系统（auto 模式）', () => {
  test('⑦ auto 模式 + 系统深色 → 页面 dark；切系统浅 → 页面 light', async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Playwright webkit 不支持 emulateMedia colorScheme 切换');

    await page.emulateMedia({ colorScheme: 'dark' });
    await setThemeLS(page, 'auto');
    await gotoFresh(page);

    const attr1 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(attr1).toBe('dark');

    // 切换系统主题
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForTimeout(300);

    const attr2 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(attr2).toBe('light');
  });
});
