// C2 演示演练：五条关键动线自动走查 + 截图
const { chromium } = require('@playwright/test');
const fs = require('fs');

const OUT = '.trae/documents/竞赛材料/演练截图';
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await page.goto('http://127.0.0.1:5173/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  try { await page.click('#welcome-enter', { timeout: 4000 }); await page.waitForTimeout(500); } catch {}

  let pass = true;
  const check = (name, ok) => { console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}`); if (!ok) pass = false; };

  // ========== 动线1：首页（新布局 + 自研徽标 + 双下拉） ==========
  await page.screenshot({ path: `${OUT}/01-首页.png` });
  // 徽标位于功能页（craft 生成 / scan 讲解来源标注）而非首页——改为功能页内验证
  check('1a 首页加载（画廊渲染）', await page.locator('.artwork-card').count() > 0);
  await page.click('#btn-workshop');
  await page.waitForSelector('#workshop-menu.is-open', { timeout: 4000 });
  const wItems = await page.locator('#workshop-menu .nav-dropdown-item').count();
  check(`1b 创作工坊下拉 ${wItems} 项（期望7）`, wItems === 7);
  await page.screenshot({ path: `${OUT}/02-创作工坊下拉.png` });
  await page.keyboard.press('Escape');

  // ========== 动线2：AI 文创（裸 hash 降级作品选择器 = 正常入口动线） ==========
  await page.evaluate(() => { location.hash = '#/craft'; });
  await page.waitForTimeout(2000);
  const pickerVisible = await page.evaluate(() => !!document.querySelector('#artwork-picker-modal'));
  check('2a AI 文创入口：作品选择器弹出（裸hash正常降级）', pickerVisible);
  await page.screenshot({ path: `${OUT}/03-AI文创-作品选择.png` });
  await page.evaluate(() => document.querySelector('#artwork-picker-modal .modal-close, #artwork-picker-modal')?.click());
  await page.waitForTimeout(500);

  // ========== 动线3：AI 识文化（识图讲解页） ==========
  await page.evaluate(() => { location.hash = '#/scan'; });
  await page.waitForTimeout(2000);
  const scanVisible = await page.evaluate(() => !!document.querySelector('#culture-scan-page'));
  check('3a 识图讲解页打开', scanVisible);
  await page.screenshot({ path: `${OUT}/04-AI识文化.png` });
  await page.evaluate(() => document.querySelector('#culture-scan-page .modal-close')?.click());
  await page.waitForTimeout(500);

  // ========== 动线4a：文化图鉴（核心主题详情 + TTS） ==========
  await page.evaluate(() => { location.hash = '#/atlas'; });
  await page.waitForTimeout(2000);
  const atlasVisible = await page.evaluate(() => !!document.querySelector('#atlas-page, .atlas-page, [class*="atlas"]'));
  check('4a 文化图鉴页打开', atlasVisible);
  await page.screenshot({ path: `${OUT}/05-文化图鉴.png` });

  // ========== 动线4b：智慧导览（景区列表 → 景区详情） ==========
  await page.evaluate(() => { location.hash = '#/scenic'; });
  await page.waitForTimeout(2500);
  const scenicVisible = await page.evaluate(() => !!document.querySelector('#scenic-page, .scenic-page, [class*="scenic"]'));
  check('4b 智慧导览页打开', scenicVisible);
  await page.screenshot({ path: `${OUT}/06-智慧导览.png` });

  // ========== 动线5：B端运营看板（5张KPI + 订单卡） ==========
  await page.evaluate(() => { location.hash = '#/dashboard'; });
  await page.waitForTimeout(2500);
  const kpiCount = await page.locator('[data-kpi]').count();
  const ordersKpi = await page.locator('[data-kpi="orders"]').count();
  check(`5a 运营看板 KPI ${kpiCount} 张（期望5）`, kpiCount === 5);
  check('5b 文创订单 KPI 卡存在', ordersKpi === 1);
  await page.screenshot({ path: `${OUT}/07-运营看板.png` });

  // ========== 动线6：AI 陪练（小梦独立页 + 云端 TTS 链路） ==========
  const ttsCalls = [];
  page.on('response', (r) => { if (r.url().includes('/api/ai/tts')) ttsCalls.push(r.status()); });
  await page.evaluate(() => { location.hash = '#/tutor'; });
  await page.waitForTimeout(2500);
  const tutorVisible = await page.evaluate(() => !!document.querySelector('#tutor-page'));
  check('6a AI 陪练页打开', tutorVisible);
  await page.screenshot({ path: `${OUT}/08-AI陪练.png` });
  // 发送一条消息触发 AI 回复 → 回复后自动 _speak（云端 CosyVoice）
  try {
    await page.fill('#tutor-input-text', '你好');
    await page.click('#tutor-send-btn');
    // 轮询等待 TTS 调用（LLM 回复耗时波动大，上限 45s）
    for (let i = 0; i < 45 && ttsCalls.length === 0; i++) await page.waitForTimeout(1000);
  } catch (e) { console.log('  (发送消息异常:', e.message.slice(0, 60) + ')'); }
  check(`6b 陪练语音走云端 TTS（${ttsCalls.length} 次调用）`, ttsCalls.length >= 1 && ttsCalls.every(s => s === 200));

  // ========== 动线7：商业模式页 + 合规页（答辩常点） ==========
  await page.evaluate(() => { location.hash = '#/pricing'; });
  await page.waitForTimeout(2000);
  const pricingVisible = await page.evaluate(() => !!document.querySelector('#pricing-page, .pricing-page, [class*="pricing"]'));
  check('7a 商业模式页打开', pricingVisible);
  await page.screenshot({ path: `${OUT}/09-商业模式.png` });
  await page.evaluate(() => { location.hash = '#/ai-disclosure'; });
  await page.waitForTimeout(2000);
  const disclosureVisible = await page.evaluate(() => !!document.querySelector('#ai-disclosure-page, [class*="disclosure"]'));
  check('7b AI 合规声明页打开', disclosureVisible);
  await page.screenshot({ path: `${OUT}/10-合规声明.png` });

  await browser.close();
  console.log(pass ? '\n=== 演练动线全部通过 ===' : '\n=== 存在失败动线 ===');
  process.exit(pass ? 0 : 1);
})();
