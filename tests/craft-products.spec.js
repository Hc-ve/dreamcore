// ============================================================
// tests/craft-products.spec.js — 文创优化第一批（T1-T4）验证
// 覆盖：
//   ① T1 全品类知识库：10 大类 / 233 产品 / API 查询 / canvasType 映射
//   ② T2 贴题修复：prompt 注入作品上下文 + 硬性贴题要求 + productName 字段
//   ③ T2 落地产品：AI 推荐 productName → 徽标展示 + 画布随产品形态切换
//   ④ T2 本地兜底贴题：全链失败 → 标题含主题词（不再"·AI共创"凭空创作）
//   ⑤ T3 版式库 6→14：各类型版式网格扩充 + LAYOUTS 总数
//   ⑥ T3 variant 参数化：同种子稳定、异种子差异化
//   ⑦ T4 融合渲染：新版式 + 变体下画布正常渲染不白屏
// 说明：/api/ai/text-generation 用 page.route mock，不依赖真实模型服务
// ============================================================
import { test, expect } from '@playwright/test';

const MOCK_PLAN = {
  title: '秦淮灯影·金陵夜画',
  subtitle: '桨声灯影里的六朝烟水',
  productName: '冰箱贴',
  craftType: 'postcard',
  style: 'guofeng',
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

async function openCraft(page) {
  // 四阶段链路适配：mock I2I 提交失败，让「开始创作」在 v6 策划后快速恢复
  // （本组用例断言的是策划/产品/版式/本地渲染行为，不依赖整图重绘成功）
  await page.route('**/api/ai/image-repaint-submit', async (route) => {
    await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'mock i2i down' }) });
  });
  await page.goto('/');
  await page.waitForSelector('.artwork-card', { timeout: 20000 });
  try { await page.locator('#welcome-enter').click({ timeout: 4000 }); } catch (_) { /* 无弹窗则跳过 */ }
  const id = await page.locator('.artwork-card').first().getAttribute('data-id');
  await page.goto(`/#/craft?artworkId=${id}`);
  await page.waitForSelector('#craft-studio-generate', { timeout: 15000 });
}

async function runGenerate(page, idea) {
  await page.locator('#craft-studio-idea').fill(idea);
  await page.locator('#craft-studio-generate').click();
  await page.waitForFunction(() => {
    const b = document.querySelector('#craft-studio-generate');
    return b && !b.disabled;
  }, null, { timeout: 15000 });
}

test.describe('T1 全品类知识库（data/craft-products.js）', () => {
  test('① 10 大类 233 产品 + 查询 API', async ({ page }) => {
    await page.goto('/');
    const kb = await page.evaluate(async () => {
      const m = await import('/data/craft-products.js');
      return {
        categories: m.CRAFT_CATEGORIES.length,
        products: m.CRAFT_PRODUCTS.length,
        hot: m.hotProducts().length,
        fridge: m.getProductByName('冰箱贴'),
        badge: m.getProductByName('徽章'),
        search: m.searchProducts('丝巾').map(p => p.name),
        catLabel: (m.getCategory('textile') || {}).label
      };
    });
    expect(kb.categories).toBe(10);
    expect(kb.products).toBe(235);
    expect(kb.hot).toBeGreaterThanOrEqual(20);
    // canvasType 映射到 5 种设计画布
    expect(kb.fridge.canvasType).toBe('card');
    expect(kb.fridge.hot).toBe(true);
    expect(kb.badge.canvasType).toBe('card');
    expect(kb.search).toContain('丝巾');
    expect(kb.catLabel).toBeTruthy();
  });
});

test.describe('T2 文案贴题修复', () => {
  test('② prompt 注入作品上下文 + productName 字段', async ({ page }) => {
    await clearStorage(page.context());
    const prompts = [];
    await page.route('**/api/ai/text-generation', async (route) => {
      prompts.push(route.request().postDataJSON().prompt);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: JSON.stringify(MOCK_PLAN), provider: 'self-trained' })
      });
    });
    await openCraft(page);

    await runGenerate(page, '秦淮河夜游主题的文创');

    // 上下文注入：作品标题 + 硬性贴题要求 + productName 字段
    expect(prompts.length).toBeGreaterThanOrEqual(1);
    expect(prompts[0]).toContain('正在为作品《');
    expect(prompts[0]).toContain('用户想法：「秦淮河夜游主题的文创」');
    expect(prompts[0]).toContain('硬性要求');
    expect(prompts[0]).toContain('禁止脱离作品主题');
    expect(prompts[0]).toContain('productName：');
    expect(prompts[0]).toContain('书签'); // 热门产品候选（prompt 内置爆款清单）
  });

  test('③ AI 推荐 productName → 徽标 + 画布随产品形态切换', async ({ page }) => {
    await clearStorage(page.context());
    await page.route('**/api/ai/text-generation', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: JSON.stringify(MOCK_PLAN), provider: 'self-trained' })
      });
    });
    await openCraft(page);

    await runGenerate(page, '秦淮河夜游主题的文创');

    // 推荐落地产品徽标可见
    await expect(page.locator('#craft-product-badge')).toBeVisible();
    await expect(page.locator('#craft-product-badge')).toContainText('推荐落地产品：冰箱贴');
    // 冰箱贴 canvasType=card → 两级选择器联动选中（AI plan 的 postcard 被产品形态覆盖）
    const activeCard = page.locator('.craft-product-card.active');
    await expect(activeCard).toContainText('冰箱贴');
    await expect(activeCard).toContainText('藏品卡');
    // 标题回填（贴题方案）
    await expect(page.locator('#craft-title-input')).toHaveValue(MOCK_PLAN.title);
  });

  test('③b 选中产品后仍可手动切换大类（不被拉回产品大类）', async ({ page }) => {
    await clearStorage(page.context());
    await page.route('**/api/ai/text-generation', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: JSON.stringify(MOCK_PLAN), provider: 'self-trained' })
      });
    });
    await openCraft(page);
    await runGenerate(page, '秦淮河夜游主题的文创');

    // AI 推荐冰箱贴后，选择器自动联动到冰箱贴所在大类
    const activeChip = page.locator('.craft-category-chip.active');
    await expect(activeChip).toContainText(/类/);
    const fridgeCat = await activeChip.textContent();

    // 手动点「文具类」→ 网格必须切到文具类（regression：曾被"产品大类优先"逻辑拉回）
    await page.locator('.craft-category-chip', { hasText: '文具类' }).click();
    await expect(page.locator('.craft-category-chip.active')).toContainText('文具类');
    const firstCard = await page.locator('.craft-product-card').first().getAttribute('data-name');
    expect(firstCard).toBeTruthy();
    // 文具类 31 种产品全部暴露
    await expect(page.locator('.craft-product-card')).toHaveCount(31);
    // 选中产品徽标不受切大类影响（冰箱贴仍是当前产品）
    await expect(page.locator('#craft-product-badge')).toContainText('冰箱贴');
    expect(fridgeCat).toContain('类');

    // 在文具类下改选明信片 → 大类与产品重新对齐
    await page.locator('.craft-product-card[data-name="明信片"]').click();
    await expect(page.locator('.craft-product-card.active')).toContainText('明信片');
    await expect(page.locator('#craft-product-badge')).toContainText('明信片');
  });

  test('④ 本地兜底贴题：标题含想法关键词，不凭空创作', async ({ page }) => {
    await clearStorage(page.context());
    await page.route('**/api/ai/text-generation', async (route) => {
      await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: '全部不可用' }) });
    });
    await openCraft(page);

    await runGenerate(page, '做一个秦淮灯会的冰箱贴');

    // 标题包含想法关键词（贴题），不再是与主题无关的"·AI共创"
    const title = await page.locator('#craft-title-input').inputValue();
    expect(title).toContain('秦淮');
    expect(title).not.toMatch(/·AI共创$/);
    // 想法显式提到"冰箱贴" → 本地产品映射生效
    await expect(page.locator('#craft-product-badge')).toBeVisible();
    await expect(page.locator('#craft-product-badge')).toContainText('冰箱贴');
  });
});

test.describe('T3 版式库 6→14 + variant 参数化', () => {
  test('⑤ LAYOUTS 总数 14 + 各类型版式扩充', async ({ page }) => {
    await page.goto('/');
    const info = await page.evaluate(async () => {
      const m = await import('/js/craft-layout.js');
      const byType = {};
      for (const l of Object.values(m.LAYOUTS)) {
        for (const t of l.craftTypes) byType[t] = (byType[t] || 0) + 1;
      }
      return { total: Object.keys(m.LAYOUTS).length, byType };
    });
    expect(info.total).toBe(14);
    expect(info.byType.poster).toBe(4);      // 分镜叠压/对称双图/曲水回环/画中画
    expect(info.byType.postcard).toBe(3);    // 圆窗雅集/撕纸拼贴/双重呈现
    expect(info.byType.card).toBe(3);        // 上下分层/拱窗撷景/四方图谱
    expect(info.byType.wallpaper).toBe(2);   // 大面留白/通幅出血
    expect(info.byType.template).toBe(2);    // 圆心聚焦/拼贴格子
  });

  test('⑥ 版式网格展示新版式（海报 4 选项）', async ({ page }) => {
    await clearStorage(page.context());
    await openCraft(page);
    await page.locator('.craft-category-chip', { hasText: '创意类' }).click();
    await page.locator('.craft-product-card', { hasText: '艺术装饰画' }).click();
    // 批次1b 后版式网格位于折叠精修面板内，先展开再断言可见性
    await page.locator('#craft-refine > summary').click();
    await page.waitForSelector('.craft-layout-chip');
    const labels = await page.evaluate(() =>
      [...document.querySelectorAll('.craft-layout-chip')].map(c => c.textContent.trim())
    );
    // 经典版式 + 4 种海报版式
    expect(labels.join('|')).toContain('曲水回环');
    expect(labels.join('|')).toContain('画中画');
    expect(labels.length).toBe(5);
  });

  test('⑥b variant：同种子稳定、异种子差异化', async ({ page }) => {
    await page.goto('/');
    const r = await page.evaluate(async () => {
      const m = await import('/js/craft-layout.js');
      const base = m.LAYOUTS['poster-hero'];
      const a1 = m.makeLayoutVariant(base, 2, 'seed-A');
      const a2 = m.makeLayoutVariant(base, 2, 'seed-A');
      const b = m.makeLayoutVariant(base, 2, 'seed-B');
      const v0 = m.makeLayoutVariant(base, 0, 'seed-A');
      return {
        stable: JSON.stringify(a1.slots) === JSON.stringify(a2.slots),
        diff: JSON.stringify(a1.slots) !== JSON.stringify(b.slots),
        variant0IsBase: v0 === base,
        originUntouched: base.slots[0].x === 0.27
      };
    });
    expect(r.stable).toBe(true);
    expect(r.diff).toBe(true);
    expect(r.variant0IsBase).toBe(true);
    expect(r.originUntouched).toBe(true);
  });

  test('⑦ 新版式渲染不白屏（曲水回环 + 变体）', async ({ page }) => {
    await clearStorage(page.context());
    await page.route('**/api/ai/text-generation', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: JSON.stringify(MOCK_PLAN), provider: 'self-trained' })
      });
    });
    await openCraft(page);

    // 切换到海报 + 新版式曲水回环（wave 形状 + T4 融合增强管线）
    await page.locator('.craft-category-chip', { hasText: '创意类' }).click();
    await page.locator('.craft-product-card', { hasText: '艺术装饰画' }).click();
    // 批次1b 后版式网格位于折叠精修面板内，先展开再点击版式
    await page.locator('#craft-refine > summary').click();
    await page.locator('.craft-layout-chip', { hasText: '曲水回环' }).click();
    await page.waitForTimeout(800);
    const canvasInfo = await page.evaluate(() => {
      const c = document.querySelector('#craft-preview-canvas');
      if (!c) return { w: 0 };
      const ctx = c.getContext('2d');
      const d = ctx.getImageData(0, 0, Math.min(c.width, 200), Math.min(c.height, 200)).data;
      let nonBlank = 0;
      for (let i = 0; i < d.length; i += 40) {
        if (d[i] !== 0 || d[i + 1] !== 0 || d[i + 2] !== 0) nonBlank++;
      }
      return { w: c.width, h: c.height, nonBlank };
    });
    expect(canvasInfo.w).toBeGreaterThan(0);
    expect(canvasInfo.nonBlank).toBeGreaterThan(10);

    // AI 生成（含 variant 档位）后仍正常渲染
    await runGenerate(page, '秦淮河夜游主题的文创');
    await page.waitForTimeout(600);
    const w2 = await page.evaluate(() => document.querySelector('#craft-preview-canvas').width);
    expect(w2).toBeGreaterThan(0);
  });
});
