// ============================================================
// tests/culture-features.spec.js — 文化功能（分级知识库 + TTS + 智慧导览）回归测试
// 覆盖：
//   ① 文化图鉴 #/atlas：大厅 12 核心 + 36 扩展两级渲染；
//      核心详情=事实卡精讲（零幻觉）；扩展详情=骨架屏 → 联网讲解（mock）+ AI 标注
//   ② 探索足迹 #/footprint：进度格式「X / 48（核心 a/12 · 地标 b/36）」；
//      读图鉴点亮 view 足迹 → 徽章卡去灰、行为标签 done
//   ③ 智慧导览 #/scenic（热门景点模块 v2）：26 景区列表（搜索/河南筛选/当前徽标）
//      → 景区详情（讲解 + 景点 + 路线 + 打卡进度）→ 景点详情
//      （AI 语音讲解 + 高德导航深链 + 浏览即打卡）
//   ④ TTS 播放器：.tts-btn 存在性与 data-tts-text；点击状态机
//      loading → playing → 再点停止；hashchange 全局停止
// 说明：联网讲解与 TTS 均通过 page.route mock 云函数，
//      测试不依赖外部 API 密钥与网络状况。
// ============================================================
import { test, expect } from '@playwright/test';

// ---------------- 基础工具 ----------------

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

/** mock /api/ai/culture-story（扩展地标 / 景区 / 景点联网讲解） */
function mockCultureStory(page, body, status = 200) {
  return page.route('**/api/ai/culture-story', async (route) => {
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
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

// ============================================================
// ① 文化图鉴 #/atlas
// ============================================================
test.describe('文化图鉴 #/atlas', () => {
  test('大厅两级渲染：12 核心主题 + 36 扩展文化地标', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);

    await page.goto('/#/atlas');
    const overlay = page.locator('#culture-atlas-page');
    await overlay.waitFor({ timeout: 10000 });

    // 核心 12：无 ext 修饰的 .ca-card
    await expect(overlay.locator('.ca-grid > .ca-card:not(.ext)')).toHaveCount(12);
    // 扩展 36：.ca-card.ext
    await expect(overlay.locator('.ca-card.ext')).toHaveCount(36);
    // 扩展分区标题带 AI 生成标注
    await expect(overlay.locator('.ca-section-title')).toContainText('扩展文化地标');
  });

  test('核心主题详情（敦煌）：事实卡精讲 + 知识库溯源标注 + TTS 按钮', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);

    await page.goto('/#/atlas?theme=dunhuang');
    const overlay = page.locator('#culture-atlas-page');
    await overlay.locator('.ca-detail-name').waitFor({ timeout: 10000 });
    await expect(overlay.locator('.ca-detail-name')).toHaveText('敦煌壁画');

    // 事实卡渲染：历史源流 facts 列表非空
    const factsCount = await overlay.locator('.ca-facts li').count();
    expect(factsCount).toBeGreaterThan(0);
    // 经典典故区块
    await expect(overlay.locator('.ca-legend-box').first()).toBeVisible();
    // TTS 按钮携带非空讲解文本
    const ttsBtn = overlay.locator('.tts-btn[data-tts-text]').first();
    await expect(ttsBtn).toBeVisible();
    expect((await ttsBtn.getAttribute('data-tts-text')).length).toBeGreaterThan(10);
    // 核心主题显示知识库溯源（非 AI 标注）
    await expect(overlay.locator('.ca-source-note')).toContainText('人工校对');
    // 首次打开点亮「读图鉴」足迹提示
    await expect(overlay.locator('.ca-lit-toast')).toContainText('读图鉴');
  });

  test('扩展主题详情（黄山）：骨架屏 → 联网讲解（mock）+ AI 仅供参考标注', async ({ page }) => {
    await clearStorage(page.context());
    await mockCultureStory(page, {
      name: '黄山',
      era: '形成于亿年地质演化',
      connotation: '黄山以奇松、怪石、云海、温泉四绝著称。\n迎客松是黄山标志性景观。',
      legend: '相传黄帝曾在黄山炼丹，因而得名。',
      creationTip: '以迎客松与云海为元素设计明信片。',
      knowledgeBase: false
    });
    await openApp(page);

    await page.goto('/#/atlas?theme=huangshan');
    const overlay = page.locator('#culture-atlas-page');
    await overlay.locator('.ca-detail-name').waitFor({ timeout: 10000 });
    await expect(overlay.locator('.ca-detail-name')).toHaveText('黄山');

    // 讲解结果渲染 + AI 联网生成标注
    await overlay.locator('.ca-ai-note').waitFor({ timeout: 10000 });
    await expect(overlay.locator('.ca-ai-note')).toContainText('AI 联网搜索生成');
    await expect(overlay.locator('.ca-story p').first()).toContainText('奇松');
    // 扩展主题 TTS 按钮（联网讲解文本）
    await expect(overlay.locator('.tts-btn[data-tts-text]').first()).toBeVisible();
    // 扩展主题显示联网来源说明
    await expect(overlay.locator('.ca-source-note')).toContainText('扩展文化地标');
  });

  test('扩展主题讲解失败：错误盒 + 重试按钮', async ({ page }) => {
    await clearStorage(page.context());
    await mockCultureStory(page, { error: 'mock 服务不可用' }, 500);
    await openApp(page);

    await page.goto('/#/atlas?theme=taishan');
    const overlay = page.locator('#culture-atlas-page');
    await overlay.locator('.ca-error-box').waitFor({ timeout: 10000 });
    await expect(overlay.locator('.ca-error-box')).toContainText('讲解生成失败');
    await expect(overlay.locator('#ca-retry-btn')).toBeVisible();
  });
});

// ============================================================
// ② 探索足迹 #/footprint
// ============================================================
test.describe('探索足迹 #/footprint', () => {
  test('初始状态：0/48 进度 + 全部徽章未点亮', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);

    await page.goto('/#/footprint');
    const overlay = page.locator('#culture-footprint-page');
    await overlay.locator('.fp-summary').waitFor({ timeout: 10000 });

    // 进度格式：X / 48（核心 a/12 · 地标 b/36）
    await expect(overlay.locator('.fp-summary')).toContainText('0 / 48');
    await expect(overlay.locator('.fp-summary')).toContainText('核心 0/12');
    await expect(overlay.locator('.fp-summary')).toContainText('地标 0/36');
    // 徽章墙存在且全部未点亮
    const badges = overlay.locator('.fp-badge');
    expect(await badges.count()).toBeGreaterThanOrEqual(12);
    await expect(overlay.locator('.fp-badge.unlit')).toHaveCount(await badges.count());
    // 分享卡按钮
    await expect(overlay.locator('#fp-share-btn')).toBeVisible();
  });

  test('读图鉴点亮：atlas 详情阅读后徽章去灰、view 行为 done', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);

    // 打开敦煌图鉴详情（完整阅读 = view 足迹）
    await page.goto('/#/atlas?theme=dunhuang');
    await page.locator('#culture-atlas-page .ca-detail-name').waitFor({ timeout: 10000 });

    // 切到足迹页（hashchange 自动关 atlas 开 footprint）
    await page.goto('/#/footprint');
    const overlay = page.locator('#culture-footprint-page');
    await overlay.locator('.fp-summary').waitFor({ timeout: 10000 });

    // 进度 1/48，核心 1/12
    await expect(overlay.locator('.fp-summary')).toContainText('1 / 48');
    await expect(overlay.locator('.fp-summary')).toContainText('核心 1/12');
    // 敦煌徽章点亮（去灰）+ view 行为 done
    const badge = overlay.locator('.fp-badge[data-theme="dunhuang"]');
    await expect(badge).toBeVisible();
    await expect(badge).not.toHaveClass(/unlit/);
    await expect(badge.locator('.fp-act.done')).toHaveCount(1);
  });

  test('徽章卡点击跳转图鉴详情', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);

    await page.goto('/#/footprint');
    const overlay = page.locator('#culture-footprint-page');
    await overlay.locator('.fp-badge[data-theme="dunhuang"]').waitFor({ timeout: 10000 });
    await overlay.locator('.fp-badge[data-theme="dunhuang"]').click();

    await page.locator('#culture-atlas-page .ca-detail-name').waitFor({ timeout: 10000 });
    await expect(page.locator('#culture-atlas-page .ca-detail-name')).toHaveText('敦煌壁画');
  });
});

// ============================================================
// ③ 智慧导览 #/scenic（热门景点模块 v2）
// ============================================================
test.describe('智慧导览 #/scenic', () => {
  test('景区列表：26 卡网格 + 无横向溢出', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);

    await page.goto('/#/scenic');
    const overlay = page.locator('#scenic-recommend-page');
    await overlay.locator('.sn-grid').waitFor({ timeout: 10000 });

    await expect(overlay.locator('.sn-card')).toHaveCount(26);
    // 副标题含景区/景点总数
    await expect(overlay.locator('.sn-sub')).toContainText('26');
    // 无横向滚动（页面 + 弹层容器）
    const ok = await page.evaluate(() => {
      const doc = document.documentElement.scrollWidth <= window.innerWidth + 1;
      const box = document.querySelector('.scenic-page-box');
      const modal = !box || box.scrollWidth <= box.clientWidth + 1;
      return doc && modal;
    });
    expect(ok).toBeTruthy();
  });

  test('地区筛选：全部 26 → 河南 6 → 全国 20', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);

    await page.goto('/#/scenic');
    const overlay = page.locator('#scenic-recommend-page');
    await overlay.locator('.sn-grid').waitFor({ timeout: 10000 });

    await overlay.locator('.sn-chip[data-region="henan"]').click();
    await expect(overlay.locator('.sn-card')).toHaveCount(6);
    await expect(overlay.locator('.sn-card-name').first()).toContainText('龙门石窟');

    await overlay.locator('.sn-chip[data-region="national"]').click();
    await expect(overlay.locator('.sn-card')).toHaveCount(20);

    await overlay.locator('.sn-chip[data-region="all"]').click();
    await expect(overlay.locator('.sn-card')).toHaveCount(26);
  });

  test('搜索过滤：景区名 / 城市 / 景点名均可命中，无匹配显示空态', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);

    await page.goto('/#/scenic');
    const overlay = page.locator('#scenic-recommend-page');
    await overlay.locator('#sn-search-input').waitFor({ timeout: 10000 });

    // 景点名搜索（黄山景区的「迎客松」）
    await overlay.locator('#sn-search-input').fill('迎客松');
    await expect(overlay.locator('.sn-card')).toHaveCount(1);
    await expect(overlay.locator('.sn-card-name').first()).toContainText('黄山');

    // 城市搜索
    await overlay.locator('#sn-search-input').fill('洛阳');
    expect(await overlay.locator('.sn-card').count()).toBeGreaterThanOrEqual(2);

    // 无匹配 → 空态
    await overlay.locator('#sn-search-input').fill('不存在的关键词xyz');
    await expect(overlay.locator('.sn-card')).toHaveCount(0);
    await expect(overlay.locator('.sn-empty')).toBeVisible();
  });

  test('核心景区详情（兵马俑）：事实精讲 + 知识库徽标 + 景点/路线/打卡进度 + CTA', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);

    await page.goto('/#/scenic');
    const overlay = page.locator('#scenic-recommend-page');
    await overlay.locator('.sn-card[data-area="bingmayong"]').waitFor({ timeout: 10000 });
    await overlay.locator('.sn-card[data-area="bingmayong"]').click();

    await overlay.locator('.sn-detail-name').waitFor({ timeout: 10000 });
    await expect(overlay.locator('.sn-detail-name')).toContainText('秦始皇帝陵博物院');
    // 景区讲解（事实）非空 + 知识库徽标
    expect(await overlay.locator('.sn-fact').count()).toBeGreaterThan(0);
    await expect(overlay.locator('.sn-source-badge.kb')).toContainText('平台知识库');
    // 打卡进度 0/5
    await expect(overlay.locator('.sn-checkin-bar')).toContainText('0');
    // 热门景点卡 + 主题路线
    expect(await overlay.locator('.sn-spot-card').count()).toBeGreaterThanOrEqual(4);
    expect(await overlay.locator('.sn-route-card').count()).toBeGreaterThanOrEqual(1);
    // TTS + 双 CTA
    await expect(overlay.locator('.tts-btn[data-tts-text]').first()).toBeVisible();
    await expect(overlay.locator('#sn-craft-btn')).toBeVisible();
    await expect(overlay.locator('#sn-atlas-btn')).toBeVisible();
    // 返回列表
    await overlay.locator('#sn-back-btn').click();
    await overlay.locator('.sn-grid').waitFor({ timeout: 10000 });
    await expect(overlay.locator('.sn-card')).toHaveCount(26);
    // 进入过的景区标记「当前」
    await expect(overlay.locator('.sn-card[data-area="bingmayong"]')).toHaveClass(/current/);
    await expect(overlay.locator('.sn-card[data-area="bingmayong"] .sn-cur-badge')).toContainText('当前');
  });

  test('扩展景区详情（黄山）：骨架屏 → 联网讲解（mock）+ AI 徽标', async ({ page }) => {
    await clearStorage(page.context());
    await mockCultureStory(page, {
      name: '黄山',
      connotation: '黄山四绝：奇松、怪石、云海、温泉。',
      legend: '黄帝炼丹传说。',
      creationTip: '迎客松明信片。',
      knowledgeBase: false
    });
    await openApp(page);

    await page.goto('/#/scenic');
    const overlay = page.locator('#scenic-recommend-page');
    await overlay.locator('.sn-card[data-area="huangshan"]').waitFor({ timeout: 10000 });
    await overlay.locator('.sn-card[data-area="huangshan"]').click();

    await overlay.locator('.sn-detail-name').waitFor({ timeout: 10000 });
    await expect(overlay.locator('.sn-detail-name')).toContainText('黄山');
    // 讲解渲染 + AI 徽标
    await overlay.locator('.sn-source-badge.ai').waitFor({ timeout: 10000 });
    await expect(overlay.locator('.sn-source-badge.ai')).toContainText('AI 联网搜索生成');
    await expect(overlay.locator('.sn-fact').first()).toContainText('奇松');
    await expect(overlay.locator('.tts-btn[data-tts-text]').first()).toBeVisible();
  });

  test('景区联网讲解失败：错误盒 + 重试按钮', async ({ page }) => {
    await clearStorage(page.context());
    await mockCultureStory(page, { error: 'mock 服务不可用' }, 500);
    await openApp(page);

    await page.goto('/#/scenic');
    const overlay = page.locator('#scenic-recommend-page');
    await overlay.locator('.sn-card[data-area="badaling"]').waitFor({ timeout: 10000 });
    await overlay.locator('.sn-card[data-area="badaling"]').click();

    await overlay.locator('.sn-error-box').waitFor({ timeout: 10000 });
    await expect(overlay.locator('.sn-error-box')).toContainText('联网讲解生成失败');
    await expect(overlay.locator('#sn-retry-btn')).toBeVisible();
  });

  test('景点详情（龙门石窟·奉先寺）：AI 讲解 + 语音按钮 + 高德导航深链 + 浏览即打卡', async ({ page }) => {
    await clearStorage(page.context());
    await mockCultureStory(page, {
      name: '奉先寺卢舍那大佛',
      connotation: '卢舍那大佛是龙门石窟的灵魂，通高17.14米。',
      legend: '相传以武则天容貌为蓝本。',
      knowledgeBase: false
    });
    await openApp(page);

    await page.goto('/#/scenic');
    const overlay = page.locator('#scenic-recommend-page');
    await overlay.locator('.sn-card[data-area="longmen"]').waitFor({ timeout: 10000 });
    await overlay.locator('.sn-card[data-area="longmen"]').click();

    // 景区详情 → 点击奉先寺景点卡
    await overlay.locator('.sn-spot-card[data-spot="fengxiansi"]').waitFor({ timeout: 10000 });
    await overlay.locator('.sn-spot-card[data-spot="fengxiansi"]').click();

    // 景点详情三要素
    await overlay.locator('.sn-spot-page-name').waitFor({ timeout: 10000 });
    await expect(overlay.locator('.sn-spot-page-name')).toContainText('奉先寺');
    await expect(overlay.locator('.sn-voice-note')).toContainText('本讲解由 AI 生成');
    // 导航深链：高德 URI + 步行模式 + 景点名
    const navHref = await overlay.locator('#sn-nav-btn').getAttribute('href');
    expect(navHref).toContain('uri.amap.com/navigation');
    expect(navHref).toContain('mode=walk');
    expect(decodeURIComponent(navHref)).toContain('奉先寺');
    // 步行指引
    await expect(overlay.locator('.sn-walk-box')).toContainText('步行指引');
    // AI 深度讲解渲染（mock 命中）
    await overlay.locator('#sn-spot-story .sn-fact').waitFor({ timeout: 10000 });
    await expect(overlay.locator('#sn-spot-story')).toContainText('卢舍那');
    // 语音文本补全（基础介绍 + AI 讲解）
    const ttsText = await overlay.locator('#sn-voice-btn').getAttribute('data-tts-text');
    expect(ttsText).toContain('卢舍那');
    // 游客点评
    expect(await overlay.locator('.sn-review').count()).toBeGreaterThanOrEqual(2);

    // 打卡成功提示
    await overlay.locator('#sn-checkin-toast').waitFor({ timeout: 10000 });
    await expect(overlay.locator('#sn-checkin-toast')).toContainText('打卡成功');
    await expect(overlay.locator('#sn-checkin-toast')).toContainText('1/5');

    // 返回景区详情 → 景点卡已打卡 + 进度条更新
    await overlay.locator('#sn-back-btn').click();
    await overlay.locator('.sn-checkin-bar').waitFor({ timeout: 10000 });
    await expect(overlay.locator('.sn-checkin-bar')).toContainText('1');
    await expect(overlay.locator('.sn-spot-card[data-spot="fengxiansi"] .sn-visited-pill')).toContainText('已打卡');

    // 返回列表 → 景区卡显示已打卡 1/5
    await overlay.locator('#sn-back-btn').click();
    await overlay.locator('.sn-grid').waitFor({ timeout: 10000 });
    await expect(overlay.locator('.sn-card[data-area="longmen"]')).toContainText('1/5');
  });

  test('景点站内路线规划：AMap.Walking 画线 + 分步指引（stub，不跳出站外）', async ({ page }) => {
    await clearStorage(page.context());
    // 页面加载前注入 AMap 桩：_loadAMap 直接命中 window.AMap，不加载真实脚本
    await page.addInitScript(() => {
      class FakeMap {
        constructor() { this.objs = []; this.center = null; }
        add(o) { this.objs.push(o); }
        destroy() {}
        setFitView() {}
      }
      class FakeMarker { constructor(o) { this.o = o; } }
      window.__fakeMapInstances = [];
      window.AMap = {
        Map: class extends FakeMap { constructor(id, opt) { super(); this.id = id; this.opt = opt || {}; window.__fakeMapInstances.push(this); } },
        Marker: FakeMarker,
        plugin: (names, cb) => cb(),
        Walking: class {
          constructor(o) { this.o = o; }
          search(origin, dest, cb) {
            cb('Complete', {
              routes: [{
                distance: 420, time: 360,
                steps: [
                  { instruction: '沿景区主路向东步行200米后右转', distance: 200 },
                  { instruction: '继续前行220米，到达目的地', distance: 220 }
                ]
              }]
            });
          }
        }
      };
    });
    await openApp(page);

    // 直达景点详情 → 点击「规划步行路线」
    await page.goto('/#/scenic?area=longmen&spot=fengxiansi');
    const overlay = page.locator('#scenic-recommend-page');
    await overlay.locator('.sn-spot-page-name').waitFor({ timeout: 10000 });
    await overlay.locator('#sn-plan-btn').click();

    // 汇总条：420 米 · 6 分钟
    await overlay.locator('.sn-plan-summary').waitFor({ timeout: 10000 });
    await expect(overlay.locator('.sn-plan-summary')).toContainText('420');
    await expect(overlay.locator('.sn-plan-summary')).toContainText('6');
    await expect(overlay.locator('.sn-plan-summary')).toContainText('奉先寺');
    // 分步指引 2 条
    await expect(overlay.locator('.sn-plan-steps-list li')).toHaveCount(2);
    await expect(overlay.locator('.sn-plan-steps-list li').first()).toContainText('沿景区主路');
    // 站内地图容器已渲染，且路线画在 FakeMap 上（walking 传入 map）
    expect(await overlay.locator('#sn-plan-map').count()).toBe(1);
    expect(await page.evaluate(() => window.__fakeMapInstances.length)).toBeGreaterThanOrEqual(1);
    // 底部 CTA：站内规划为主按钮，高德外链为次按钮（仍可用）
    await expect(overlay.locator('#sn-plan-cta')).toBeVisible();
    const navHref = await overlay.locator('#sn-nav-btn').getAttribute('href');
    expect(navHref).toContain('uri.amap.com/navigation');
    // 规划完成按钮恢复为「重新规划」
    await expect(overlay.locator('#sn-plan-btn')).toContainText('重新规划');
  });

  test('站内规划降级：路网无结果 → 直线示意路线（虚线 + 方位指引）', async ({ page }) => {
    await clearStorage(page.context());
    // Walking.search 回调 'error'（模拟山岳景区无步行路网），须降级为站内示意路线
    await page.addInitScript(() => {
      class FakeMap {
        constructor() { this.objs = []; }
        add(o) { this.objs.push(o); }
        destroy() {}
        setFitView() {}
      }
      window.__fakeMapInstances = [];
      window.__fakePolylines = [];
      window.AMap = {
        Map: class extends FakeMap { constructor(id, opt) { super(); window.__fakeMapInstances.push(this); } },
        Marker: class { constructor(o) { this.o = o; } },
        Polyline: class { constructor(o) { window.__fakePolylines.push(o); } },
        plugin: (names, cb) => cb(),
        Walking: class {
          constructor(o) { this.o = o; }
          search(origin, dest, cb) { cb('error', null); }
        }
      };
    });
    await openApp(page);

    await page.goto('/#/scenic?area=longmen&spot=fengxiansi');
    const overlay = page.locator('#scenic-recommend-page');
    await overlay.locator('.sn-spot-page-name').waitFor({ timeout: 10000 });
    await overlay.locator('#sn-plan-btn').click();

    // 不显示错误盒，而是示意路线汇总条（含"示意"与直线距离）
    await overlay.locator('.sn-plan-summary').waitFor({ timeout: 10000 });
    await expect(overlay.locator('.sn-plan-error')).toHaveCount(0);
    await expect(overlay.locator('.sn-plan-summary')).toContainText('示意路线');
    await expect(overlay.locator('.sn-plan-summary')).toContainText('奉先寺');
    // 两段方位指引（出发段 + 到达段）
    await expect(overlay.locator('.sn-plan-steps-list li')).toHaveCount(2);
    await expect(overlay.locator('.sn-plan-steps-list li').first()).toContainText('龙门石窟');
    await expect(overlay.locator('.sn-plan-steps-list li').last()).toContainText('奉先寺');
    // 站内地图画了虚线（FakePolyline 落在 FakeMap 上）
    expect(await page.evaluate(() => window.__fakePolylines.length)).toBeGreaterThanOrEqual(1);
    expect(await page.evaluate(() => window.__fakeMapInstances.length)).toBeGreaterThanOrEqual(1);
    await expect(overlay.locator('#sn-plan-btn')).toContainText('重新规划');
  });

  test('无关联主题景区（殷墟）：无创作 CTA，讲解走 AI 联网（mock）', async ({ page }) => {
    await clearStorage(page.context());
    await mockCultureStory(page, {
      name: '殷墟',
      connotation: '殷墟是商代晚期都城遗址，甲骨文在此出土。',
      knowledgeBase: false
    });
    await openApp(page);

    await page.goto('/#/scenic');
    const overlay = page.locator('#scenic-recommend-page');
    await overlay.locator('.sn-card[data-area="yinxu"]').waitFor({ timeout: 10000 });
    await overlay.locator('.sn-card[data-area="yinxu"]').click();

    await overlay.locator('.sn-detail-name').waitFor({ timeout: 10000 });
    await expect(overlay.locator('.sn-detail-name')).toContainText('殷墟');
    await overlay.locator('.sn-source-badge.ai').waitFor({ timeout: 10000 });
    await expect(overlay.locator('#sn-craft-btn')).toHaveCount(0);
    await expect(overlay.locator('#sn-atlas-btn')).toHaveCount(0);
  });

  test('「去图鉴深入了解」CTA 跳转图鉴详情', async ({ page }) => {
    await clearStorage(page.context());
    await openApp(page);

    await page.goto('/#/scenic');
    const overlay = page.locator('#scenic-recommend-page');
    await overlay.locator('.sn-card[data-area="jingdezhen"]').waitFor({ timeout: 10000 });
    await overlay.locator('.sn-card[data-area="jingdezhen"]').click();
    await overlay.locator('#sn-atlas-btn').waitFor({ timeout: 10000 });
    await overlay.locator('#sn-atlas-btn').click();

    // scenic 关闭 → atlas 打开对应主题详情（景德镇 → 青花瓷）
    await page.locator('#culture-atlas-page .ca-detail-name').waitFor({ timeout: 10000 });
    await expect(page.locator('#culture-atlas-page .ca-detail-name')).toHaveText('青花瓷');
  });
});

// ============================================================
// ④ TTS 语音讲解播放器（tts-player.js）
// ============================================================
test.describe('TTS 语音讲解播放器', () => {
  test('点击状态机：loading → playing → 再点停止；hashchange 全局停止', async ({ page }) => {
    await clearStorage(page.context());
    await mockTtsRoute(page);
    await openApp(page);

    // 核心景区详情页的 TTS 按钮（Audio 桩须在页面加载后注入）
    await stubAudio(page);
    await page.goto('/#/scenic');
    const overlay = page.locator('#scenic-recommend-page');
    await overlay.locator('.sn-card[data-area="bingmayong"]').waitFor({ timeout: 10000 });
    await overlay.locator('.sn-card[data-area="bingmayong"]').click();
    const btn = overlay.locator('.tts-btn[data-tts-text]').first();
    await btn.waitFor({ timeout: 10000 });

    // 初始为默认讲解文案
    await expect(btn).toContainText('语音讲解');

    // 点击 → loading → playing
    await btn.click();
    await expect(btn).toHaveClass(/tts-playing/, { timeout: 5000 });
    await expect(btn).toContainText('播放中');

    // 再次点击同一按钮 = 停止（pause 被调），按钮复位
    await btn.click();
    await expect(btn).not.toHaveClass(/tts-playing/);
    await expect(btn).toContainText('语音讲解');
    expect(await page.evaluate(() => window.__ttsPaused)).toBeGreaterThanOrEqual(1);

    // 重新播放后切换页面 hash → 全局停止（overlay 会被移除，用 pause 计数断言）
    await btn.click();
    await expect(btn).toHaveClass(/tts-playing/, { timeout: 5000 });
    const pausedBefore = await page.evaluate(() => window.__ttsPaused);
    await page.goto('/#/atlas');
    await page.locator('#culture-atlas-page .ca-title').waitFor({ timeout: 10000 });
    expect(await page.evaluate(() => window.__ttsPaused)).toBeGreaterThan(pausedBefore);
  });
});
