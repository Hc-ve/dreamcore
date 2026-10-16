// ============================================================
// tests/craft-commerce.spec.js — 四阶段商业链路验收（批次4）
// 覆盖：① 自定义上传 + 整图生成（promptBuilder 结构断言）
//       ② 重生成计数上限（第 4 次拒绝，不再提交 I2I）
//       ③ 3D 实物预览贴图 = 整图设计稿（WebGL 快照）
//       ④ 下单 → 运营看板订单卡物流 5 态流转（演示快进驱动）
//       ⑤ 旧精修模式回归（版式/分镜入口不破坏）
// 说明：/api/ai/* 与生成图 URL 全部 page.route mock，不依赖真实模型服务；
//       物流状态机为本地 IndexedDB 演示级（paid→…→delivered）
// ============================================================
import { test, expect } from '@playwright/test';

const MOCK_PLAN = {
  title: '飞天神韵·大漠华章',
  subtitle: '反弹琵琶舞千年，壁上飞天落人间',
  craftType: 'postcard',
  style: 'dunhuang',
  stickers: ['🕌', '🏮']
};

// 1×1 PNG（上传素材与生成图 mock 内容）
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

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
  await page.goto('/');
  await page.waitForSelector('.artwork-card', { timeout: 20000 });
  try { await page.locator('#welcome-enter').click({ timeout: 4000 }); } catch (_) { /* 无弹窗则跳过 */ }
  const id = await page.locator('.artwork-card').first().getAttribute('data-id');
  await page.goto(`/#/craft?artworkId=${id}`);
  await page.waitForSelector('#craft-studio-generate', { timeout: 15000 });
}

async function waitStudioDone(page, timeout = 20000) {
  await page.waitForFunction(() => {
    const b = document.querySelector('#craft-studio-generate');
    return b && !b.disabled;
  }, null, { timeout });
}

async function runStudio(page, idea) {
  await page.locator('#craft-studio-idea').fill(idea);
  await page.locator('#craft-studio-generate').click();
}

function mockTextGeneration(page, providers) {
  return page.route('**/api/ai/text-generation', async (route) => {
    const body = route.request().postDataJSON();
    providers.push(body.provider);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ text: JSON.stringify(MOCK_PLAN), provider: body.provider })
    });
  });
}

function mockStudioI2I(page, submits, opts = {}) {
  const { imageUrl = '/mock-studio.png', fail } = opts;
  let queryCount = 0;
  return Promise.all([
    page.route('**/api/ai/image-repaint-submit', async (route) => {
      submits.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ taskId: 'studio-' + submits.length }) });
    }),
    page.route('**/api/ai/image-repaint-query**', async (route) => {
      queryCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(fail
          ? { status: 'failed', error: '整图生成失败' }
          : (queryCount === 1 ? { status: 'running' } : { status: 'succeeded', imageUrl, provider: 'dashscope' }))
      });
    }),
    page.route('**' + new URL(imageUrl, 'http://x/').pathname, async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1PX });
    })
  ]);
}

// ============================================================
// ① 自定义上传素材 + 整图生成：promptBuilder 结构断言
// ============================================================
test.describe('四阶段商业链路·craft-commerce', () => {
  test('① 自定义上传素材 + 整图生成（prompt 画风前置/整图指令/文字模式/负面词合并）', async ({ page }) => {
    await clearStorage(page.context());
    const providers = [];
    const submits = [];
    await mockTextGeneration(page, providers);
    await mockStudioI2I(page, submits);
    await openCraft(page);

    // 上传自定义素材图（阶段①：素材双来源之二）
    await page.locator('#craft-studio-file').setInputFiles({
      name: 'my-photo.png', mimeType: 'image/png', buffer: PNG_1PX
    });
    await expect(page.locator('#craft-studio-image-slot')).toHaveClass(/has-img/);
    await expect(page.locator('#craft-studio-reset-btn')).toBeVisible();

    // 负面提示词（与基础压制词叠加）
    await page.locator('#craft-studio-negative').fill('噪点，强烈阴影');

    await runStudio(page, '敦煌飞天主题的明信片');
    await waitStudioDone(page);

    // I2I 已提交且成功上屏
    expect(submits.length).toBe(1);
    await expect(page.locator('#craft-studio-actions')).toBeVisible();
    await expect(page.locator('#craft-studio-status')).toContainText('整图设计稿已生成');

    // promptBuilder 结构断言（阶段②：v6 策划 + 确定性扩写）
    const { prompt, negativePrompt } = submits[0];
    expect(prompt).toContain('敦煌');                       // 画风前置（v6 style=dunhuang）
    expect(prompt).toContain('完整重新绘制整幅画面');          // 整图重绘强指令
    expect(prompt).toContain('不出现任何文字');                // 默认 canvas 文字模式（P0-1：零错字）
    expect(prompt).toContain('4K 高清');                     // 质感收尾
    expect(negativePrompt).toContain('照片写实感');            // 基础压制词
    expect(negativePrompt).toContain('噪点');                 // 用户自定义负面词叠加
    expect(negativePrompt).toContain('文字,字母');             // canvas 模式追加压制文字
  });

  // ============================================================
  // ② 重生成计数上限：连续 3 次后第 4 次拒绝（不再提交 I2I）
  // ============================================================
  test('② 重生成 ≤3 次：第 4 次复用生成被拒（无新 I2I 提交）', async ({ page }) => {
    await clearStorage(page.context());
    const providers = [];
    const submits = [];
    await mockTextGeneration(page, providers);
    await mockStudioI2I(page, submits);
    await openCraft(page);

    await runStudio(page, '水墨山水做成文创');
    await waitStudioDone(page);
    expect(submits.length).toBe(1);

    // 连续重生成 3 次（想法未变 → 复用 prompt，不重新策划）
    for (let i = 0; i < 3; i++) {
      await page.locator('#craft-studio-regen').click();
      await waitStudioDone(page);
    }
    expect(submits.length).toBe(4);
    expect(providers.length).toBe(1); // 复用 prompt：全程仅首轮策划一次
    await expect(page.locator('#craft-studio-status')).toContainText('3/3 次');

    // 第 4 次：toast 拒绝，无新提交，计数不变
    await page.locator('#craft-studio-regen').click();
    await page.waitForTimeout(600);
    expect(submits.length).toBe(4);
    await expect(page.locator('#craft-studio-status')).toContainText('3/3 次');
  });

  // ============================================================
  // ③ 3D 实物预览：贴图源 = 整图设计稿（WebGL 快照）
  // ============================================================
  test('③ 3D 实物预览：整图设计稿作为贴图上模（明信片形态）', async ({ page }) => {
    await clearStorage(page.context());
    const providers = [];
    const submits = [];
    await mockTextGeneration(page, providers);
    await mockStudioI2I(page, submits);
    await openCraft(page);

    await runStudio(page, '敦煌飞天主题的明信片');
    await waitStudioDone(page);

    // v6 策划落地产品 = 明信片（applyCraftPlan → selectProductByName 联动）
    await expect(page.locator('#craft-product-badge')).toContainText('明信片');

    // 打开实物预览 → 切 3D 旋转
    await page.locator('#craft-mockup-btn').click();
    await expect(page.locator('#craft-mockup-panel')).toBeVisible();
    const chip3d = page.locator('.craft-mockup-chip-3d');
    await expect(chip3d).toBeEnabled();
    await chip3d.click();

    // 3D 视图接管：3d 容器显示 + 内含 WebGL canvas；2D canvas 隐藏
    await expect(page.locator('#craft-3d-view')).not.toHaveAttribute('hidden', '');
    const glCanvas = page.locator('#craft-3d-view canvas');
    await expect(glCanvas).toHaveCount(1);
    // 回退兜底未触发（3D chip 保持激活态，2D canvas 处于隐藏）
    await expect(chip3d).toHaveClass(/active/);
    await expect(page.locator('#craft-mockup-canvas')).toBeHidden();

    // WebGL 快照：截图非空（贴图已上模的实物渲染）
    await page.waitForTimeout(800); // 等待首帧渲染
    const shot = await glCanvas.screenshot();
    expect(shot.length).toBeGreaterThan(300);
  });

  // ============================================================
  // ④ 下单 → 物流 5 态流转（批次3验收：paid→…→delivered 快进驱动）
  // ============================================================
  test('④ 下单 → 运营看板订单卡物流 5 态完整流转', async ({ page }) => {
    await clearStorage(page.context());
    await openCraft(page);

    // 阶段③：选明信片品类 → 实物预览 → 下单（阶段④）
    await page.locator('.craft-product-card[data-name="明信片"]').click();
    await expect(page.locator('#craft-product-badge')).toContainText('明信片');
    await page.locator('#craft-mockup-btn').click();
    await expect(page.locator('#craft-mockup-panel')).toBeVisible();
    await page.locator('#craft-mockup-order').click();

    // 下单弹窗：默认材质/尺寸 → 提交 → 模拟支付成功
    const modal = page.locator('#craft-order-modal');
    await expect(modal).toBeVisible();
    await page.locator('#cm-submit-btn').click();
    await expect(modal.locator('.cm-order-success')).toBeVisible({ timeout: 10000 });
    const orderNo = (await modal.locator('.cm-order-no').textContent()).replace('订单号：', '').trim();
    expect(orderNo).toMatch(/^DC\d{12}$/);
    await page.locator('#cm-done-btn').click();
    await expect(modal).toBeHidden();

    // 运营看板：订单卡 + 5 态时间线
    await page.evaluate(() => { window.location.hash = '#/dashboard'; });
    const dash = page.locator('#dashboard-page');
    await expect(dash).toBeVisible({ timeout: 10000 });

    const card = dash.locator('.dbp-order-card').first();
    await expect(dash.locator('.dbp-order-card')).toHaveCount(1);
    await expect(card.locator('.dbp-order-product')).toHaveText('明信片');
    await expect(card.locator('.dbp-order-no')).toHaveText(orderNo);
    await expect(card.locator('.dbp-track-node')).toHaveCount(5);
    await expect(card.locator('.dbp-order-status')).toContainText('已支付');

    const ffBtn = card.locator('.dbp-ff-btn');
    await expect(ffBtn).toBeEnabled();

    // 演示快进 ×4：制作中 → 已发货（生成物流单号）→ 运输中 → 已签收（终态置灰）
    await ffBtn.click();
    await expect(card.locator('.dbp-order-status')).toContainText('制作中');
    await ffBtn.click();
    await expect(card.locator('.dbp-order-status')).toContainText('已发货');
    await expect(card.locator('.dbp-order-meta')).toContainText(/SF\d{13}/);
    await ffBtn.click();
    await expect(card.locator('.dbp-order-status')).toContainText('运输中');
    await ffBtn.click();
    await expect(card.locator('.dbp-order-status')).toContainText('已签收');
    await expect(ffBtn).toBeDisabled();

    // 5 态时间线：全部节点点亮 + 签收节点有时间戳
    const nodes = card.locator('.dbp-track-node');
    await expect(nodes.nth(4)).toHaveClass(/done/);
    const lastTime = await nodes.nth(4).locator('.dbp-track-time').textContent();
    expect(lastTime.trim()).toMatch(/\d{2}-\d{2} \d{2}:\d{2}/);
  });

  // ============================================================
  // P0-3 复现：跨页导航后订单卡仍存在（排除"看板 0 单"为脚本时序 bug）
  // ============================================================
  test('P0-3 跨页导航：下单后 page.goto 新页打开看板，订单卡仍存在', async ({ page }) => {
    await clearStorage(page.context());
    await openCraft(page);

    // 选品类 → 预览 → 下单（同 ④ 的前半段，无需 runStudio）
    await page.locator('.craft-product-card[data-name="明信片"]').click();
    await expect(page.locator('#craft-product-badge')).toContainText('明信片');
    await page.locator('#craft-mockup-btn').click();
    await expect(page.locator('#craft-mockup-panel')).toBeVisible();
    await page.locator('#craft-mockup-order').click();
    const modal = page.locator('#craft-order-modal');
    await expect(modal).toBeVisible();
    await page.locator('#cm-submit-btn').click();
    await expect(modal.locator('.cm-order-success')).toBeVisible({ timeout: 10000 });
    const orderNo = (await modal.locator('.cm-order-no').textContent()).replace('订单号：', '').trim();
    await page.locator('#cm-done-btn').click();

    // 关键：page.goto 新页导航（而非同页 hash）
    await page.goto('/#/dashboard');
    await expect(page.locator('#dashboard-page')).toBeVisible({ timeout: 10000 });

    // expect.poll 等待数据加载
    await expect.poll(
      () => page.locator('.dbp-order-card').count(),
      { timeout: 8000 }
    ).toBeGreaterThan(0);
    await expect(page.locator('.dbp-order-card').first().locator('.dbp-order-no')).toHaveText(orderNo);
  });

  // ============================================================
  // ⑤ 旧精修模式回归：折叠面板 + 版式构图 + 分镜重绘入口不破坏
  // ============================================================
  test('⑤ 旧精修模式回归：版式构图 / 分镜重绘入口完好', async ({ page }) => {
    await clearStorage(page.context());
    await openCraft(page);

    // 精修面板折叠展开
    const refine = page.locator('#craft-refine');
    await expect(refine).not.toHaveAttribute('open', '');
    await refine.locator('> summary').click();
    await expect(refine).toHaveAttribute('open', '');

    // 版式构图网格 populated（层1 纯 Canvas 版式引擎）
    const layoutGrid = page.locator('#craft-layout-grid');
    await expect(layoutGrid.locator('.craft-layout-chip').first()).toBeVisible();
    expect(await layoutGrid.locator('.craft-layout-chip').count()).toBeGreaterThanOrEqual(2);

    // 分镜重绘入口 + 负面词输入存在（层2 图生图）
    await expect(page.locator('#craft-repaint-btn')).toBeVisible();
    await expect(page.locator('#craft-negative-input')).toBeVisible();

    // 文案标题（v6 策划回填目标）
    await expect(page.locator('#craft-title-input')).toBeVisible();
    await expect(page.locator('#craft-subtitle-input')).toBeVisible();
  });
});
