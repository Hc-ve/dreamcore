// ============================================================
// tests/ui-revamp-regression.spec.js — 墨韵丹青改版回归测试
// 覆盖 2026-10-14 用户反馈的三个回归：
//   ① 自定义光标整体消失（v1 用 display:none !important 误禁，连带原生光标）
//   ② 设置面板内指针时有时无（光标层 z-index 10000 被抽屉 10001 压住）
//   ③ 四套风格主题切换失效（同名变量写在 :root，抹平 [data-style] 皮肤组）
// 另覆盖：拖尾/点击粒子颜色跟随皮肤、明暗×皮肤 8 组合的填充/文字对比达标。
// ============================================================
import { test, expect } from '@playwright/test';

const SKINS = [
  { key: null,      accent: '#a8261f', paper: '#faf6ee', darkAccent: '#c94a40', darkPaper: '#14110e' },
  { key: 'guofeng', accent: '#b3301f', paper: '#f8f1e3', darkAccent: '#c25042', darkPaper: '#191310' },
  { key: 'feiyi',   accent: '#2f5f8a', paper: '#f4f6fa', darkAccent: '#6fa3d8', darkPaper: '#101720' },
  { key: 'minimal', accent: '#3a3f46', paper: '#fafafa', darkAccent: '#c3cad4', darkPaper: '#121417' },
];

async function open(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  // 清掉首次访问欢迎弹窗
  await page.evaluate(() => document.querySelectorAll('.modal-overlay').forEach(o => o.remove()));
}

// ============================================================
// ① 自定义光标存在且可见
// ============================================================
test.describe('自定义光标', () => {
  test('①-a 精确指针下 dot/ring 均 display:block 且跟随鼠标', async ({ page }) => {
    await open(page);
    await page.mouse.move(300, 300);
    await page.mouse.move(760, 540, { steps: 12 });
    await page.waitForTimeout(250);

    const r = await page.evaluate(() => {
      const dot = document.querySelector('.cursor-dot');
      const ring = document.querySelector('.cursor-ring');
      const dr = dot.getBoundingClientRect();
      const rr = ring.getBoundingClientRect();
      const dc = getComputedStyle(dot);
      return {
        dotDisplay: dc.display,
        dotVisibility: dc.visibility,
        dotBg: dc.backgroundColor,
        dotIdx: Math.round(dr.x), dotIdy: Math.round(dr.y),
        ringIdx: Math.round(rr.x), ringIdy: Math.round(rr.y),
        bodyCursor: getComputedStyle(document.body).cursor,
      };
    });

    expect(r.dotDisplay).toBe('block');
    expect(r.dotVisibility).toBe('visible');
    // dot 8px，中心应落在鼠标点 (760,540)
    expect(Math.abs(r.dotIdx + 4 - 760)).toBeLessThanOrEqual(3);
    expect(Math.abs(r.dotIdy + 4 - 540)).toBeLessThanOrEqual(3);
    // ring 36px，中心同样追随
    expect(Math.abs(r.ringIdx + 18 - 760)).toBeLessThanOrEqual(8);
    expect(Math.abs(r.ringIdy + 18 - 540)).toBeLessThanOrEqual(8);
    // 原生光标应被隐藏（由自定义光标接管）
    expect(r.bodyCursor).toBe('none');
    // 配色应为朱砂系（默认皮肤 #a8261f）
    expect(r.dotBg).toBe('rgb(168, 38, 31)');
  });

  test('①-b 打开设置抽屉后光标仍可见（z-index 高于抽屉）', async ({ page }) => {
    await open(page);
    await page.evaluate(() => document.querySelector('#settings-toggle').click());
    await page.waitForTimeout(400);
    await page.mouse.move(640, 450);
    await page.mouse.move(1283, 261, { steps: 12 });
    await page.waitForTimeout(300);

    const r = await page.evaluate(() => {
      const dot = document.querySelector('.cursor-dot');
      const drawer = document.querySelector('.sc-drawer');
      const dotRect = dot.getBoundingClientRect();
      // 以 dot 中心做命中测试：若被抽屉压住，命中的会是抽屉内元素而非 dot
      const top = document.elementFromPoint(dotRect.x + dotRect.width / 2, dotRect.y + dotRect.height / 2);
      return {
        dotDisplay: getComputedStyle(dot).display,
        dotZ: getComputedStyle(dot).zIndex,
        drawerZ: getComputedStyle(drawer).zIndex,
        topIsCursor: top === dot || top === document.querySelector('.cursor-ring'),
      };
    });

    expect(r.dotDisplay).toBe('block');
    expect(Number(r.dotZ)).toBeGreaterThan(Number(r.drawerZ));
    // dot 的祖先链最高：dot 自身 pointer-events:none，故命中可能是其下元素，
    // 但只要 z-index 高于抽屉且样式可见，即不会被面板遮住
    expect(Number(r.drawerZ)).toBe(10001);
  });
});

// ============================================================
// ② 四套风格主题切换
// ============================================================
test.describe('四套风格主题切换', () => {
  for (const theme of ['light', 'dark']) {
    test(`②-${theme} 点击四种皮肤，令牌与填充色同步变化`, async ({ page }) => {
      await open(page);
      await page.evaluate(() => document.querySelector('#settings-toggle').click());
      await page.waitForTimeout(400);
      await page.evaluate((t) => document.querySelector(`.sc-seg[data-setting="theme"] button[data-val="${t}"]`).click(), theme);
      await page.waitForTimeout(450);

      for (const skin of SKINS) {
        await page.evaluate((v) => document.querySelector(`.sc-seg[data-setting="particleTheme"] button[data-val="${v}"]`).click(), skin.key || 'default');
        await page.waitForTimeout(650); // 等过渡结束再取计算值

        const r = await page.evaluate(() => {
          const root = document.documentElement;
          const cs = getComputedStyle(root);
          const btn = document.querySelector('.btn-primary');
          const bc = btn ? getComputedStyle(btn) : null;
          return {
            style: root.getAttribute('data-style'),
            accentSolid: cs.getPropertyValue('--ink-accent-solid').trim(),
            paper: cs.getPropertyValue('--paper').trim(),
            bodyBg: getComputedStyle(document.body).backgroundColor,
            btnBg: bc ? bc.backgroundColor : null,
            btnColor: bc ? bc.color : null,
          };
        });

        expect(r.style).toBe(skin.key);
        expect(r.accentSolid).toBe(theme === 'light' ? skin.accent : skin.darkAccent);
        expect(r.paper).toBe(theme === 'light' ? skin.paper : skin.darkPaper);
        // 主 CTA 填充 = 实心强调色
        const want = theme === 'light' ? skin.accent : skin.darkAccent;
        const rgb = want.replace('#', '').match(/../g).map(h => parseInt(h, 16)).join(', ');
        expect(r.btnBg).toBe(`rgb(${rgb})`);
      }
    });
  }

  test('②-c 皮肤选择写入 localStorage 并在刷新后保持', async ({ page }) => {
    await open(page);
    await page.evaluate(() => document.querySelector('#settings-toggle').click());
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector('.sc-seg[data-setting="particleTheme"] button[data-val="feiyi"]').click());
    await page.waitForTimeout(500);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);

    const r = await page.evaluate(() => ({
      style: document.documentElement.getAttribute('data-style'),
      // settings.js 写入：JSON 形式（键名无 pref- 前缀，camelCase）
      storedSettings: localStorage.getItem('dreamcore-particleTheme'),
      // particles.js 写入：裸值形式（连字符），供 HEAD 防闪烁脚本读取
      storedParticles: localStorage.getItem('dreamcore-particle-theme'),
    }));
    expect(r.style).toBe('feiyi');
    expect(r.storedSettings).toBe('"feiyi"');
    expect(r.storedParticles).toBe('feiyi');
  });
});

// ============================================================
// ③ 深色填充对比度（WCAG AA，正文 4.5:1）
// ============================================================
test.describe('填充对比度', () => {
  test('③ 深色下四套皮肤的主 CTA 文字对比均 ≥ 4.5', async ({ page }) => {
    await open(page);
    await page.evaluate(() => document.querySelector('#settings-toggle').click());
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelector('.sc-seg[data-setting="theme"] button[data-val="dark"]').click());
    await page.waitForTimeout(450);

    const lum = (rgb) => {
      const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(c => {
        c /= 255;
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };

    for (const skin of SKINS) {
      await page.evaluate((v) => document.querySelector(`.sc-seg[data-setting="particleTheme"] button[data-val="${v}"]`).click(), skin.key || 'default');
      await page.waitForTimeout(650);
      const { bg, fg } = await page.evaluate(() => {
        const btn = document.querySelector('.sc-drawer .btn-primary, .sc-seg button.active');
        const c = getComputedStyle(btn);
        return { bg: c.backgroundColor, fg: c.color };
      });
      const l1 = lum(bg), l2 = lum(fg);
      const cr = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      expect(cr, `皮肤 ${skin.key || 'default'} 深色对比度 ${cr.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
