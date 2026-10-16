// ============================================================
// tests/p0-mockup.spec.js — P0-1「文创实物场景预览」+ P0-2 挂载点②端到端验证
// 覆盖：
//   ① UI 主链路：实物预览面板 → 5 场景 chips → 切换场景重绘 → 导出场景图 → 关闭
//   ② 分享海报挂载点②：SharePoster.downloadPoster 契约（image/title/author/badge/footerCta）
//   ③ 分享海报兜底：SharePoster 未加载时 toast 提示稍后再试
//   ④ 模块级兜底：import('/js/craft-mockup.js') → 5 场景全部出图 + 类型映射
// 说明：/api/ai/text-generation 沿用 ai-craft.spec.js 的 page.route mock 模式
// ============================================================
import { test, expect } from '@playwright/test';

const MOCK_PLAN = {
  title: '飞天神韵·大漠华章',
  subtitle: '反弹琵琶舞千年，壁上飞天落人间',
  craftType: 'postcard',
  style: 'dunhuang',
  stickers: []
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

/** 打开文创工作台（沿用 tests/ai-craft.spec.js 模式） */
async function openCraft(page) {
  await page.goto('/');
  await page.waitForSelector('.artwork-card', { timeout: 20000 });
  try { await page.locator('#welcome-enter').click({ timeout: 4000 }); } catch (_) { /* 无弹窗则跳过 */ }
  const id = await page.locator('.artwork-card').first().getAttribute('data-id');
  await page.goto(`/#/craft?artworkId=${id}`);
  await page.waitForSelector('#craft-studio-generate', { timeout: 15000 });
}

/** mock 生成一张结果（postcard → 默认场景 desk） */
async function runGenerate(page, idea) {
  await page.route('**/api/ai/text-generation', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ text: JSON.stringify(MOCK_PLAN), provider: 'self-trained' })
    });
  });
  // 四阶段链路适配：mock I2I 提交失败，生成在策划后快速恢复（本组用例断言 2D 场景合成，不依赖整图重绘）
  await page.route('**/api/ai/image-repaint-submit', async (route) => {
    await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'mock i2i down' }) });
  });
  await page.locator('#craft-studio-idea').fill(idea);
  await page.locator('#craft-studio-generate').click();
  await page.waitForFunction(() => {
    const b = document.querySelector('#craft-studio-generate');
    return b && !b.disabled;
  }, null, { timeout: 15000 });
}

/** 读取实物预览面板 canvas 状态（dataURL 读取失败时回退 scene 标识） */
async function readMockCanvas(page) {
  return page.evaluate(() => {
    const c = document.querySelector('#craft-mockup-canvas');
    if (!c) return null;
    let url = '';
    try { url = c.toDataURL(); } catch (_) { url = ''; }
    return { scene: c.dataset.scene || '', w: c.width, h: c.height, url };
  });
}

test.describe('P0-1 文创实物场景预览', () => {
  test('① 实物预览面板：打开 → 切场景 → 导出 → 关闭', async ({ page }) => {
    await clearStorage(page.context());
    await openCraft(page);
    await runGenerate(page, '敦煌飞天主题的明信片');

    // 打开实物预览面板
    await page.locator('#craft-mockup-btn').click();
    const panel = page.locator('.craft-mockup-panel');
    await expect(panel).toBeVisible();

    // 场景 chips：阶段C 首位新增"3D 旋转"chip（未选产品时置灰）+ 5 个 2D 场景 = 6 个
    const chips = page.locator('.craft-mockup-chip');
    await expect(chips).toHaveCount(6);

    // 默认场景按 craftType=postcard 映射到桌面明信片
    await expect(page.locator('.craft-mockup-chip.active')).toHaveText(/桌面/);

    // 面板 canvas 已绘制（1200×900）
    const before = await readMockCanvas(page);
    expect(before).not.toBeNull();
    expect(before.w).toBe(1200);
    expect(before.h).toBe(900);
    expect(before.scene).toBe('desk');

    // 点第二个 2D 场景 chip（nth(2)，nth(0)=3D、nth(1)=桌面）→ 预览 canvas 更换
    await chips.nth(2).click();
    const after = await readMockCanvas(page);
    expect(after.scene).not.toBe(before.scene);
    if (before.url && after.url) {
      expect(after.url).not.toBe(before.url);
    }

    // 导出场景图（stub <a>.click 收集下载文件名，不落盘）
    await page.evaluate(() => {
      window.__downloads = [];
      HTMLAnchorElement.prototype.click = function () {
        if (this.download) window.__downloads.push(this.download);
      };
    });
    await page.locator('#craft-mockup-export').click();
    await expect.poll(() => page.evaluate(() => window.__downloads.length), { timeout: 10000 }).toBeGreaterThanOrEqual(1);
    const name = await page.evaluate(() => window.__downloads[0]);
    expect(name).toContain('dreamcore-mockup-');

    // 关闭面板，结果画布不受影响
    await page.locator('#craft-mockup-close').click();
    await expect(panel).toBeHidden();
    const previewW = await page.evaluate(() => document.querySelector('#craft-preview-canvas').width);
    expect(previewW).toBeGreaterThan(0);
  });

  test('② 分享海报挂载点②：SharePoster.downloadPoster 契约', async ({ page }) => {
    await clearStorage(page.context());
    await openCraft(page);
    await runGenerate(page, '敦煌飞天主题的明信片');

    // 强制注入 SharePoster stub（并行模块加载与否均走同一断言路径）
    await page.evaluate(() => {
      window.__posterCalls = [];
      window.SharePoster = window.SharePoster || {};
      window.SharePoster.downloadPoster = function (opts) {
        window.__posterCalls.push({
          title: opts.title,
          author: opts.author,
          badge: opts.badge,
          footerCta: opts.footerCta,
          slogan: opts.slogan,
          isCanvas: !!(opts.image && opts.image.tagName === 'CANVAS')
        });
        return Promise.resolve();
      };
    });
    await page.locator('#craft-poster-btn').click();
    await expect.poll(() => page.evaluate(() => window.__posterCalls.length), { timeout: 10000 }).toBeGreaterThanOrEqual(1);

    const opts = await page.evaluate(() => window.__posterCalls[0]);
    expect(opts.isCanvas).toBe(true);            // 主体图 = 当前结果 canvas
    expect(opts.title).toContain('飞天');          // 当前文创名/主题名
    expect(opts.author).toBeTruthy();            // 用户名 / 作者 / 兜底
    expect(opts.badge).toBe('明信片');            // craftType 中文 label
    expect(opts.footerCta).toBe('AI 一键生成你的文化文创');
  });

  test('③ 分享海报兜底：SharePoster 未加载时 toast 提示', async ({ page }) => {
    await clearStorage(page.context());
    await openCraft(page);

    // 模拟并行模块未就绪
    await page.evaluate(() => { delete window.SharePoster; });
    await page.locator('#craft-poster-btn').click();
    await expect(
      page.locator('.toast-message').filter({ hasText: '分享海报模块加载中' }).first()
    ).toBeVisible();
  });

  test('④ 模块级：CraftMockup 5 场景全部出图 + 类型映射', async ({ page }) => {
    await page.goto('/');
    const result = await page.evaluate(async () => {
      await import('/js/craft-mockup.js');
      const CM = window.CraftMockup;
      if (!CM) return { error: 'window.CraftMockup 未挂载' };
      // 传入页面上新建的任意 canvas
      const src = document.createElement('canvas');
      src.width = 480; src.height = 300;
      const c = src.getContext('2d');
      c.fillStyle = '#c9b6ff'; c.fillRect(0, 0, 480, 150);
      c.fillStyle = '#ffd1e8'; c.fillRect(0, 150, 480, 150);
      const scenes = {};
      (CM.SCENES || []).forEach(s => {
        const m = CM.buildMockupCanvas(src, s.key);
        let nonBlank = false;
        try {
          const d = m.getContext('2d').getImageData(m.width / 2, m.height / 2, 1, 1).data;
          nonBlank = d[3] > 0;
        } catch (_) { /* 跨域污染时忽略 */ }
        scenes[s.key] = { w: m.width, h: m.height, nonBlank };
      });
      return { scenes, map: CM.TYPE_SCENE_MAP || null, count: (CM.SCENES || []).length };
    });

    expect(result.error).toBeUndefined();
    expect(result.count).toBe(5);
    const keys = Object.keys(result.scenes);
    expect(keys.length).toBe(5);
    for (const k of keys) {
      expect(result.scenes[k].w).toBe(1200);
      expect(result.scenes[k].h).toBe(900);
      expect(result.scenes[k].nonBlank).toBe(true);
    }
    // craftType → 默认场景映射
    expect(result.map.postcard).toBe('desk');
    expect(result.map.poster).toBe('frame');
    expect(result.map.wallpaper).toBe('phone');
    expect(result.map.card).toBe('album');
    expect(result.map.template).toBe('social');
  });
});
