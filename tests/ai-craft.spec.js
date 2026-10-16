// ============================================================
// tests/ai-craft.spec.js — AI文创 端到端验证（四阶段商业链路版）
// 覆盖：
//   M10 自研微调模型接入（v6 幕后策划，嵌入整图创作链路）：
//     ① 自研主路径：provider:'self-trained' → 方案应用 + 徽标"自研微调模型"
//     ② 自研不可达自动降级：self-trained 502 → dashscope 成功 → 徽标"云端大模型"
//     ③ 全链失败本地兜底：徽标隐藏 + 标题贴题降级
//   四阶段·阶段①②（AI 整图创作单窗口）：
//     ① 整图创作成功：promptBuilder 结构 + I2I 轮询上屏
//     ② canvas 文字模式：图上无字 + 负面词压制文字
//     ③ 迭代优化：重生成 ≤3 次，编辑想法重置计数
//     ④ 自定义上传素材图 + 恢复作品图
//     ⑤ 整图模式与分镜重绘互斥
//   融合改造层2（精修模式内 AI 重绘分镜，图生图提交/查询分离）：
//     ① 成功路径 ② 任务失败回退
// 说明：/api/ai/* 与生成图 URL 全部 page.route mock，不依赖真实模型服务
// ============================================================
import { test, expect } from '@playwright/test';

const MOCK_PLAN = {
  title: '飞天神韵·大漠华章',
  subtitle: '反弹琵琶舞千年，壁上飞天落人间',
  craftType: 'postcard',
  style: 'dunhuang',
  stickers: ['🕌', '🏮']
};

// 1×1 PNG（生成图 mock 内容）
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

/** 等待整图创作流程结束（生成按钮从 busy 态恢复） */
async function waitStudioDone(page, timeout = 20000) {
  await page.waitForFunction(() => {
    const b = document.querySelector('#craft-studio-generate');
    return b && !b.disabled;
  }, null, { timeout });
}

/** 填想法并点击开始创作 */
async function runStudio(page, idea) {
  await page.locator('#craft-studio-idea').fill(idea);
  await page.locator('#craft-studio-generate').click();
}

/** mock v6 策划（text-generation）：返回 MOCK_PLAN，记录 providers */
function mockTextGeneration(page, providers, opts = {}) {
  const { failAll, failSelfTrained } = opts;
  return page.route('**/api/ai/text-generation', async (route) => {
    const body = route.request().postDataJSON();
    providers.push(body.provider);
    if (failAll || (failSelfTrained && body.provider === 'self-trained')) {
      await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'connect ECONNREFUSED' }) });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: JSON.stringify(MOCK_PLAN), provider: body.provider })
      });
    }
  });
}

/** mock vision 识别（image-understanding）
 *  opts.delayMs: 模拟接口耗时（默认 0，用于测 8s 超时边界）
 *  opts.fail: true 时返回 502
 *  opts.text: 返回的识别文本
 */
function mockImageUnderstanding(page, opts = {}) {
  const { delayMs = 0, fail = false, text = '画面主体是一只青花瓷瓶，瓶身绘有山水纹样，背景留白。' } = opts;
  return page.route('**/api/ai/image-understanding', async (route) => {
    if (delayMs) await new Promise(r => setTimeout(r, delayMs));
    if (fail) {
      await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'timeout' }) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text }) });
    }
  });
}

/** mock 整图 I2I（提交/查询分离，第 1 次查询 running、第 2 次 succeeded） */
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
// M10 自研微调模型接入（v6 幕后策划，嵌入整图创作链路）
// ============================================================
test.describe('M10 AI文创·自研微调模型接入（整图链路）', () => {
  test('① 自研模型主路径：provider 自研 + 方案应用 + 徽标展示', async ({ page }) => {
    await clearStorage(page.context());
    const providers = [];
    const submits = [];
    await mockTextGeneration(page, providers);
    await mockStudioI2I(page, submits);
    await openCraft(page);

    await runStudio(page, '敦煌飞天主题的明信片');
    await waitStudioDone(page);

    // 请求确实以 self-trained 为主 provider 发出
    expect(providers.length).toBeGreaterThanOrEqual(1);
    expect(providers[0]).toBe('self-trained');
    // v6 方案应用成功：标题回填（精修面板内文案输入框）
    await expect(page.locator('#craft-title-input')).toHaveValue(MOCK_PLAN.title);
    // 徽标显示自研模型
    await expect(page.locator('#craft-model-badge')).toBeVisible();
    await expect(page.locator('#craft-model-badge')).toContainText('自研微调模型');
    // 整图 I2I 已提交且成功上屏（状态条 ok + 操作区出现）
    expect(submits.length).toBe(1);
    await expect(page.locator('#craft-studio-actions')).toBeVisible();
    await expect(page.locator('#craft-studio-status')).toContainText('整图设计稿已生成');
  });

  test('② 自研不可达：自动降级云端 + 徽标切换', async ({ page }) => {
    await clearStorage(page.context());
    const providers = [];
    const submits = [];
    await mockTextGeneration(page, providers, { failSelfTrained: true });
    await mockStudioI2I(page, submits);
    await openCraft(page);

    await runStudio(page, '把水墨山水做成宣传海报');
    await waitStudioDone(page);

    // 降级链生效：先 self-trained 再 dashscope
    expect(providers[0]).toBe('self-trained');
    expect(providers[1]).toBe('dashscope');
    // 方案仍然成功应用
    await expect(page.locator('#craft-title-input')).toHaveValue(MOCK_PLAN.title);
    // 徽标显示云端模型
    await expect(page.locator('#craft-model-badge')).toBeVisible();
    await expect(page.locator('#craft-model-badge')).toContainText('云端大模型');
  });

  test('③ 策划全链失败：本地兜底方案 + 徽标隐藏', async ({ page }) => {
    await clearStorage(page.context());
    const providers = [];
    const submits = [];
    await mockTextGeneration(page, providers, { failAll: true });
    await mockStudioI2I(page, submits);
    await openCraft(page);

    const consoleWarns = [];
    page.on('console', msg => { if (msg.type() === 'warning') consoleWarns.push(msg.text()); });

    await runStudio(page, '敦煌飞天主题的明信片');
    await waitStudioDone(page);

    // 本地兜底贴题（T2 优化后）：标题含想法关键词
    await expect(page.locator('#craft-title-input')).toHaveValue(/敦煌/);
    // 徽标隐藏（本地方案无模型来源）
    await expect(page.locator('#craft-model-badge')).toBeHidden();
    expect(consoleWarns.length).toBeGreaterThan(0);
    // 兜底方案仍驱动整图创作（链路不中断）
    expect(submits.length).toBe(1);
  });
});

// ============================================================
// 四阶段商业链路 · 阶段①②：AI 整图创作（单窗口）
// ============================================================
test.describe('四阶段·AI 整图创作（单窗口主入口）', () => {
  test('① 整图创作成功：promptBuilder 结构 + I2I 上屏', async ({ page }) => {
    await clearStorage(page.context());
    const providers = [];
    const submits = [];
    await mockTextGeneration(page, providers);
    await mockStudioI2I(page, submits);
    await openCraft(page);

    // 显式切换到「AI 绘制」模式（默认已是 canvas，此处保留 model 模式行为覆盖）
    await page.locator('.craft-textmode-opt[data-textmode="model"]').click();
    await runStudio(page, '敦煌飞天主题的明信片');
    await waitStudioDone(page);

    // 提交 payload：画风前置 + 整图重绘强指令 + 原图 base64 + model 文字指令
    expect(submits.length).toBe(1);
    expect(submits[0].prompt).toContain('敦煌壁画风格'); // v6 style=dunhuang 的画风库
    expect(submits[0].prompt).toContain('完整重新绘制整幅画面');
    expect(submits[0].prompt).toContain('手写风格英文标题'); // model 文字模式
    expect(submits[0].prompt).toContain('4K 高清'); // 质感收尾
    expect(submits[0].image).toMatch(/^data:image\/jpeg;base64,/);
    // model 模式负面词：压制写实感但绝不单独压制「文字」字段（变形文字≠独立文字词条）
    expect(submits[0].negativePrompt).toContain('照片写实感');
    expect(submits[0].negativePrompt).not.toMatch(/(?:^|,)文字(?:,|$)/); // 精确匹配独立「文字」词条
    // 用户自定义负面词叠加
    // （本用例未填写自定义负面词，基础压制词即可）

    // 状态条成功 + 重新生成操作区出现
    await expect(page.locator('#craft-studio-status')).toContainText('整图设计稿已生成');
    await expect(page.locator('#craft-studio-actions')).toBeVisible();
    await expect(page.locator('#craft-studio-regen')).toBeVisible();
  });

  test('② canvas 文字模式：图上无字 + 负面词压制文字', async ({ page }) => {
    await clearStorage(page.context());
    const providers = [];
    const submits = [];
    await mockTextGeneration(page, providers);
    await mockStudioI2I(page, submits);
    await openCraft(page);

    // 切换到「后期排版」模式
    await page.locator('.craft-textmode-opt[data-textmode="canvas"]').click();
    // 填写自定义负面词（验证叠加）
    await page.locator('#craft-studio-negative').fill('强烈阴影,噪点');
    await runStudio(page, '敦煌飞天主题的明信片');
    await waitStudioDone(page);

    expect(submits.length).toBe(1);
    expect(submits[0].prompt).toContain('不出现任何文字'); // canvas 文字指令
    expect(submits[0].negativePrompt).toContain('照片写实感');
    expect(submits[0].negativePrompt).toContain('文字,字母'); // canvas 模式追加压制
    expect(submits[0].negativePrompt).toContain('强烈阴影'); // 用户自定义叠加
    await expect(page.locator('#craft-studio-status')).toContainText('整图设计稿已生成');
  });

  test('③ 迭代优化：重生成 ≤3 次，编辑想法重置计数', async ({ page }) => {
    await clearStorage(page.context());
    const providers = [];
    const submits = [];
    await mockTextGeneration(page, providers);
    await mockStudioI2I(page, submits, { imageUrl: '/mock-studio.png' });
    await openCraft(page);

    await runStudio(page, '水墨风山水');
    await waitStudioDone(page);
    expect(submits.length).toBe(1);

    // 连续重生成 3 次（想法未变 → 复用 prompt，不重复策划）
    const planCallsBefore = providers.length;
    for (let i = 1; i <= 3; i++) {
      await page.locator('#craft-studio-regen').click();
      await waitStudioDone(page);
      expect(submits.length).toBe(1 + i);
    }
    expect(providers.length).toBe(planCallsBefore); // 重生成不重复调用策划
    await expect(page.locator('#craft-studio-status')).toContainText('3/3');

    // 第 4 次重生成被拒绝（不产生新提交）
    await page.locator('#craft-studio-regen').click();
    await page.waitForTimeout(800);
    expect(submits.length).toBe(4);

    // 编辑想法 → 计数重置，可再次创作
    await page.locator('#craft-studio-idea').fill('水墨风山水，大面积留白，纸纹质感');
    await page.locator('#craft-studio-generate').click();
    await waitStudioDone(page);
    expect(submits.length).toBe(5);
    expect(providers.length).toBe(planCallsBefore + 1); // 新一轮重新策划
  });

  test('③b 整图提交 502 自动重试：首次失败、二次成功，创作完成', async ({ page }) => {
    await clearStorage(page.context());
    const providers = [];
    const submits = [];
    let submitAttempts = 0;
    await mockTextGeneration(page, providers);
    await page.route('**/api/ai/image-repaint-submit', async (route) => {
      submitAttempts++;
      submits.push(route.request().postDataJSON());
      if (submitAttempts === 1) {
        await route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'Bad Gateway' }) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ taskId: 'studio-retry-' + submitAttempts }) });
      }
    });
    let queryCount = 0;
    await page.route('**/api/ai/image-repaint-query**', async (route) => {
      queryCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(queryCount === 1 ? { status: 'running' } : { status: 'succeeded', imageUrl: '/mock-studio.png', provider: 'dashscope' })
      });
    });
    await page.route('**/mock-studio.png', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1PX });
    });
    await openCraft(page);

    await runStudio(page, '敦煌飞天主题的明信片');
    await waitStudioDone(page, 25000);

    // 502 触发 1 次自动重试，共提交 2 次
    expect(submitAttempts).toBe(2);
    expect(submits.length).toBe(2);
    // 重试成功后整图创作完成
    await expect(page.locator('#craft-studio-status')).toContainText('整图设计稿已生成');
    await expect(page.locator('#craft-studio-actions')).toBeVisible();
  });

  test('④ 自定义上传素材图 + 恢复作品图', async ({ page }) => {
    await clearStorage(page.context());
    await openCraft(page);

    // 初始：素材槽显示作品原图、恢复按钮隐藏
    await expect(page.locator('#craft-studio-image-slot')).toHaveClass(/has-img/);
    await expect(page.locator('#craft-studio-reset-btn')).toBeHidden();

    // 上传自定义图片
    await page.locator('#craft-studio-file').setInputFiles({
      name: 'my-photo.png', mimeType: 'image/png', buffer: PNG_1PX
    });
    await expect(page.locator('#craft-studio-reset-btn')).toBeVisible({ timeout: 5000 });

    // 恢复作品图
    await page.locator('#craft-studio-reset-btn').click();
    await expect(page.locator('#craft-studio-reset-btn')).toBeHidden();
    await expect(page.locator('#craft-studio-image-slot')).toHaveClass(/has-img/);
  });

  test('⑤ 整图模式与分镜重绘互斥', async ({ page }) => {
    await clearStorage(page.context());
    const providers = [];
    const submits = [];
    await mockTextGeneration(page, providers);
    await mockStudioI2I(page, submits);
    await openCraft(page);

    // 先完成一次整图创作
    await runStudio(page, '水墨风山水');
    await waitStudioDone(page);
    expect(submits.length).toBe(1);

    // 展开精修模式，选择明信片 + 圆窗雅集版式，点分镜重绘
    await page.locator('#craft-refine > summary').click();
    await page.locator('.craft-category-chip', { hasText: '文具类' }).click();
    await page.locator('.craft-product-card[data-name="明信片"]').click();
    await page.locator('.craft-layout-chip', { hasText: '圆窗雅集' }).click();
    await page.locator('#craft-repaint-btn').click();

    // 互斥生效：无新提交、重绘浮层不出现
    await page.waitForTimeout(800);
    expect(submits.length).toBe(1);
    await expect(page.locator('#craft-repaint-overlay')).toBeHidden();
  });

  test('⑥ 自定义上传素材：vision 超时 8s 内仍注入识别内容，且主题权重降级', async ({ page }) => {
    await clearStorage(page.context());
    const providers = [];
    const submits = [];
    const capturedPrompts = [];

    // 模拟 vision 真实耗时 3.5s（低于 8s 阈值，应成功注入）
    await mockImageUnderstanding(page, { delayMs: 3500, text: '画面主体是敦煌飞天壁画，人物反弹琵琶，飘带飞扬，背景为石窟祥云。' });
    await page.route('**/api/ai/text-generation', async (route) => {
      const body = route.request().postDataJSON();
      providers.push(body.provider);
      capturedPrompts.push(body.prompt);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: JSON.stringify({ ...MOCK_PLAN, title: '敦煌飞天·丝路华章' }), provider: body.provider })
      });
    });
    await mockStudioI2I(page, submits);
    await openCraft(page);

    // 上传自定义图片
    await page.locator('#craft-studio-file').setInputFiles({
      name: 'my-photo.png', mimeType: 'image/png', buffer: PNG_1PX
    });
    await expect(page.locator('#craft-studio-reset-btn')).toBeVisible({ timeout: 5000 });

    await runStudio(page, '敦煌飞天主题的明信片');
    await waitStudioDone(page, 30000);

    // 1. prompt 必须包含 vision 识别文本（贴题性主依据）
    expect(capturedPrompts.some(p => p.includes('用户上传的素材图内容识别'))).toBe(true);
    expect(capturedPrompts.some(p => p.includes('敦煌飞天壁画'))).toBe(true);
    // 2. 上传自定义素材时，主题事实应降级为"仅供参考"
    expect(capturedPrompts.some(p => p.includes('作品原文化主题（仅供参考，非强制）'))).toBe(true);
    // 3. 硬性要求应切换为"紧扣用户想法和素材图实际内容"
    expect(capturedPrompts.some(p => p.includes('必须紧扣用户想法和素材图实际内容'))).toBe(true);
    expect(capturedPrompts.some(p => p.includes('禁止强行套用原文化主题'))).toBe(true);
    // 4. 方案仍被应用，链路不中断
    await expect(page.locator('#craft-title-input')).toHaveValue('敦煌飞天·丝路华章');
    expect(submits.length).toBe(1);
  });

  test('⑦ vision 识别超时/失败：静默降级不影响主流程', async ({ page }) => {
    await clearStorage(page.context());
    const providers = [];
    const submits = [];
    const capturedPrompts = [];

    await mockImageUnderstanding(page, { delayMs: 9000 }); // 超过 8s，触发超时降级
    await page.route('**/api/ai/text-generation', async (route) => {
      const body = route.request().postDataJSON();
      providers.push(body.provider);
      capturedPrompts.push(body.prompt);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: JSON.stringify(MOCK_PLAN), provider: body.provider })
      });
    });
    await mockStudioI2I(page, submits);
    await openCraft(page);

    // 上传自定义图片
    await page.locator('#craft-studio-file').setInputFiles({
      name: 'my-photo.png', mimeType: 'image/png', buffer: PNG_1PX
    });
    await runStudio(page, '敦煌飞天主题的明信片');
    await waitStudioDone(page);

    // 超时后 vision 描述未注入，但主流程仍成功
    expect(capturedPrompts.some(p => p.includes('用户上传的素材图内容识别'))).toBe(false);
    expect(capturedPrompts.some(p => p.includes('仅供参考，非强制'))).toBe(true); // 上传时仍降级主题
    expect(submits.length).toBe(1);
  });
});

// ============================================================
// 融合改造层2（精修模式内）：AI 重绘分镜（图生图提交/查询分离）
// ============================================================
test.describe('层2 AI重绘分镜（图生图管线，精修模式内）', () => {
  // 选择明信片类型 + 圆窗雅集版式（1 个分镜槽位）——先展开精修折叠面板
  async function selectPostcardCircleLayout(page) {
    await page.locator('#craft-refine > summary').click();
    await page.locator('.craft-category-chip', { hasText: '文具类' }).click();
    await page.locator('.craft-product-card[data-name="明信片"]').click();
    await page.locator('.craft-layout-chip', { hasText: '圆窗雅集' }).click();
    await expect(page.locator('#craft-repaint-hint')).toContainText('1 个分镜槽位');
  }

  test('① 成功路径：风格锁提交 + 轮询出图上屏', async ({ page }) => {
    await clearStorage(page.context());
    const submits = [];
    await page.route('**/api/ai/image-repaint-submit', async (route) => {
      submits.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ taskId: 'task-1', provider: 'dashscope', model: 'qwen-image-3.0' }) });
    });
    let queryCount = 0;
    await page.route('**/api/ai/image-repaint-query**', async (route) => {
      queryCount++;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(queryCount === 1
          ? { status: 'running' }
          : { status: 'succeeded', imageUrl: '/mock-scene.png', provider: 'dashscope' })
      });
    });
    await page.route('**/mock-scene.png', async (route) => {
      await route.fulfill({ status: 200, contentType: 'image/png', body: PNG_1PX });
    });

    await openCraft(page);
    await selectPostcardCircleLayout(page);
    await page.locator('#craft-repaint-btn').click();

    // 提交 payload：风格锁提示词 + 原图 base64 + 负向词
    await expect
      .poll(() => submits.length, { timeout: 10000 })
      .toBeGreaterThanOrEqual(1);
    expect(submits[0].prompt).toContain('国风工笔画'); // 默认风格 guofeng 的风格锁
    expect(submits[0].image).toMatch(/^data:image\/jpeg;base64,/);
    expect(submits[0].negativePrompt).toBeTruthy();

    // 浮层出现 → 轮询完成 → 浮层消失、按钮恢复、分镜上屏
    await expect(page.locator('#craft-repaint-overlay')).toBeVisible();
    await expect(page.locator('#craft-repaint-overlay')).toBeHidden({ timeout: 15000 });
    await expect(page.locator('#craft-repaint-hint')).toContainText('已重绘 1/1 分镜', { timeout: 5000 });
    await expect(page.locator('#craft-repaint-btn')).not.toBeDisabled();
    await expect(page.locator('#craft-repaint-btn')).toContainText('AI 重绘分镜');
    expect(queryCount).toBeGreaterThanOrEqual(2);
  });

  test('② 任务失败：回退层1 取景，画布不白屏', async ({ page }) => {
    await clearStorage(page.context());
    await page.route('**/api/ai/image-repaint-submit', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ taskId: 'task-fail' }) });
    });
    await page.route('**/api/ai/image-repaint-query**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'failed', error: '图生图任务超时 (>90s)' }) });
    });

    await openCraft(page);
    await selectPostcardCircleLayout(page);
    await page.locator('#craft-repaint-btn').click();

    // 浮层出现 → 失败回退 → 浮层消失、按钮恢复、提示回退取景
    await expect(page.locator('#craft-repaint-overlay')).toBeVisible();
    await expect(page.locator('#craft-repaint-overlay')).toBeHidden({ timeout: 15000 });
    await expect(page.locator('#craft-repaint-hint')).toContainText('回退原取景');
    await expect(page.locator('#craft-repaint-btn')).not.toBeDisabled();
    // 画布仍正常渲染（非白屏：宽度为物理分辨率 2x）
    const w = await page.evaluate(() => document.querySelector('#craft-preview-canvas').width);
    expect(w).toBeGreaterThan(0);
  });
});
