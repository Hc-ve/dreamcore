// ============================================================
// tests/p3-trace-card.spec.js — P3 B1「讲解溯源卡片」三消费点验证
// 覆盖：
//   ① AI 识图 #/scan：上传图片 → 识图+讲解（mock）→ 核心主题蓝色
//      「📋 平台知识库」卡（facts 摘要 2 条 + 知识卡深链）
//   ② 文化图鉴扩展主题 #/atlas?theme=huangshan：联网讲解（mock 带
//      themeId）→ 橙色「🌐 AI 联网生成」卡 + 仅供参考尾注
//   ③ 智慧导览景点详情 #/scenic（龙门·奉先寺）：深度讲解（mock 带
//      themeId）→ 橙色 AI 卡 + 知识卡深链
// 说明：识图与讲解均 page.route mock 云函数，不依赖外部 API。
// ============================================================
import { test, expect } from '@playwright/test';

// 1×1 像素最小合法 PNG（上传识图用）
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
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

async function dismissWelcome(page) {
  const btn = page.locator('#welcome-enter');
  try { await btn.click({ timeout: 4000 }); } catch (_) { /* 无弹窗则跳过 */ }
}

async function openApp(page) {
  await page.goto('/');
  await page.waitForSelector('.artwork-card', { timeout: 20000 });
  await dismissWelcome(page);
}

/** mock /api/ai/culture-story（body 可指定主题命中，控制 kb/ai 分支） */
function mockCultureStory(page, body, status = 200) {
  return page.route('**/api/ai/culture-story', async (route) => {
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

// ============================================================
// ① AI 识图 #/scan → 核心主题蓝色知识库卡
// ============================================================
test.describe('B1 讲解溯源卡片', () => {
  test('① 识图讲解：核心主题（敦煌）→ 蓝色「平台知识库」卡 + facts 摘要 + 深链', async ({ page }) => {
    await clearStorage(page.context());
    // 识图返回命中核心主题 dunhuang
    await page.route('**/api/ai/vision-recognize', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          subject: '敦煌飞天壁画',
          category: '壁画',
          themeId: 'dunhuang',
          themeName: '敦煌壁画',
          era: '十六国至元代',
          description: '敦煌莫高窟飞天壁画，反弹琵琶的经典意象。'
        })
      });
    });
    // 讲解返回携带 themeId/knowledgeBase（B1 契约字段）
    await mockCultureStory(page, {
      name: '敦煌壁画',
      era: '十六国至元代',
      connotation: '敦煌壁画是丝绸之路上的艺术宝库。\n飞天形象贯穿历代洞窟。',
      legend: '反弹琵琶源自伎乐天形象。',
      creationTip: '以飞天飘带设计明信片。',
      provider: 'self-trained',
      knowledgeBase: true,
      themeId: 'dunhuang',
      themeName: '敦煌壁画'
    });
    await openApp(page);

    await page.goto('/#/scan');
    const overlay = page.locator('#culture-scan-page');
    await overlay.locator('#cs-dropzone').waitFor({ timeout: 10000 });

    // 上传图片 → 识别（等按钮可用后 dispatchEvent，规避上传后布局变化导致的点击不稳定）
    await page.setInputFiles('#cs-file', { name: 'feitian.png', mimeType: 'image/png', buffer: TINY_PNG });
    await page.waitForFunction(() => {
      const b = document.querySelector('#cs-recognize-btn');
      return b && !b.disabled;
    }, null, { timeout: 10000 });
    await page.locator('#cs-recognize-btn').dispatchEvent('click');

    // 蓝色知识库卡渲染（核心主题命中 facts）
    const kbCard = overlay.locator('#cs-story-result .trace-card.kb');
    await kbCard.waitFor({ timeout: 15000 });
    await expect(kbCard.locator('.trace-badge')).toContainText('平台知识库');
    await expect(kbCard.locator('.trace-theme')).toContainText('敦煌壁画');
    // 朝代/地区徽章（era 有值）
    expect(await kbCard.locator('.trace-chip').count()).toBeGreaterThanOrEqual(1);
    // facts 摘要 2 条（取知识库前 2 条，非讲解正文）
    expect(await kbCard.locator('.trace-facts li').count()).toBe(2);
    // 深链直达图鉴详情
    await expect(kbCard.locator('.trace-link')).toHaveAttribute('href', '#/atlas?theme=dunhuang');
    // 核心主题卡不带「仅供参考」尾注
    expect(await kbCard.locator('.trace-note').count()).toBe(0);
  });

  // ============================================================
  // ② 图鉴扩展主题 → 橙色「AI 联网生成」卡
  // ============================================================
  test('② 图鉴扩展主题（黄山）：讲解（mock 带 themeId）→ 橙色「AI 联网生成」卡 + 尾注', async ({ page }) => {
    await clearStorage(page.context());
    await mockCultureStory(page, {
      name: '黄山',
      era: '形成于亿年地质演化',
      connotation: '黄山以奇松、怪石、云海、温泉四绝著称。\n迎客松是黄山标志性景观。\n光明顶可观云海日出。',
      legend: '相传黄帝曾在黄山炼丹，因而得名。',
      creationTip: '以迎客松与云海为元素设计明信片。',
      knowledgeBase: false,
      themeId: 'huangshan',
      themeName: '黄山'
    });
    await openApp(page);

    await page.goto('/#/atlas?theme=huangshan');
    const overlay = page.locator('#culture-atlas-page');
    await overlay.locator('.ca-detail-name').waitFor({ timeout: 10000 });
    await overlay.locator('.ca-ai-note').waitFor({ timeout: 10000 });

    // 橙色 AI 联网生成卡（扩展主题无 facts）
    const aiCard = overlay.locator('.trace-card.ai');
    await aiCard.waitFor({ timeout: 10000 });
    await expect(aiCard.locator('.trace-badge')).toContainText('AI 联网生成');
    await expect(aiCard.locator('.trace-theme')).toContainText('黄山');
    // 摘要取讲解正文前 2 段
    expect(await aiCard.locator('.trace-facts li').count()).toBe(2);
    // 尾注：AI 联网搜索生成，仅供参考
    await expect(aiCard.locator('.trace-note')).toContainText('AI 联网搜索生成，仅供参考');
    // 深链
    await expect(aiCard.locator('.trace-link')).toHaveAttribute('href', '#/atlas?theme=huangshan');
  });

  // ============================================================
  // ③ 智慧导览景点详情 → 橙色 AI 卡（含主题徽章与深链）
  // ============================================================
  test('③ 景点深度讲解（龙门·奉先寺）：mock 带 themeId → 溯源卡 + 知识卡深链', async ({ page }) => {
    await clearStorage(page.context());
    await mockCultureStory(page, {
      name: '奉先寺卢舍那大佛',
      connotation: '卢舍那大佛是龙门石窟的灵魂，通高17.14米。',
      legend: '相传以武则天容貌为蓝本。',
      knowledgeBase: false,
      themeId: 'longmen',
      themeName: '龙门石窟'
    });
    await openApp(page);

    await page.goto('/#/scenic');
    const overlay = page.locator('#scenic-recommend-page');
    await overlay.locator('.sn-card[data-area="longmen"]').waitFor({ timeout: 10000 });
    await overlay.locator('.sn-card[data-area="longmen"]').click();
    await overlay.locator('.sn-spot-card[data-spot="fengxiansi"]').waitFor({ timeout: 10000 });
    await overlay.locator('.sn-spot-card[data-spot="fengxiansi"]').click();
    await overlay.locator('.sn-spot-page-name').waitFor({ timeout: 10000 });

    // 景点讲解区内溯源卡（longmen 为扩展主题 → 橙色 AI 卡）
    const card = overlay.locator('#sn-spot-story .trace-card.ai');
    await card.waitFor({ timeout: 15000 });
    await expect(card.locator('.trace-badge')).toContainText('AI 联网生成');
    await expect(card.locator('.trace-theme')).toContainText('龙门石窟');
    // 徽章两条：朝代（第 1）+ 地区（第 2，河南洛阳）
    expect(await card.locator('.trace-chip').count()).toBe(2);
    await expect(card.locator('.trace-chip').nth(1)).toContainText('河南洛阳');
    await expect(card.locator('.trace-link')).toHaveAttribute('href', '#/atlas?theme=longmen');
  });
});
