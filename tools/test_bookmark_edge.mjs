// Edge 浏览器测试：书签金属质感 3D 预览
// 跑法: node.exe tools/test_bookmark_edge.mjs
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = 'http://localhost:5173';
const OUT = path.resolve('test-screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: EDGE_PATH, headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // 收集 console
  const consoleLogs = [];
  page.on('console', msg => {
    consoleLogs.push({ type: msg.type(), text: msg.text() });
    if (msg.type() === 'error' || msg.text().includes('ERR') || msg.text().includes('✓') || msg.text().includes('❌') || msg.text().includes('✅')) {
      console.log(`[${msg.type()}] ${msg.text().substring(0, 200)}`);
    }
  });
  page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`));

  // 1. 直接跳到 AI 文创页（hash 路由）
  console.log('\n=== 1. 打开 AI 文创页 ===');
  await page.goto(BASE + '/#/craft', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(3500);  // main.js 有 setTimeout 800ms 才调 openCraft，多等一下
  console.log('URL:', page.url());
  
  // ---- 关 welcome modal ----
  const welcomeClose = page.locator('.welcome-modal .modal-close').first();
  if (await welcomeClose.count() > 0) {
    await welcomeClose.click().catch(() => page.keyboard.press('Escape'));
    console.log('✅ 关闭 welcome modal');
    await page.waitForTimeout(500);
  }
  
  // ---- 选热门作品 ----
  const hotWorksTab = page.locator('button:has-text("热门作品"), [role="tab"]:has-text("热门")').first();
  if (await hotWorksTab.count() > 0) {
    await hotWorksTab.click();
    await page.waitForTimeout(800);
    console.log('✅ 切换到热门作品 tab');
  }
  // 选第一个作品卡片
  const firstWork = page.locator('.artwork-card, .work-item, .hot-item, [class*="artwork"], [class*="work"]').first();
  if (await firstWork.count() > 0) {
    await firstWork.click();
    console.log('✅ 点击第一个热门作品');
    await page.waitForTimeout(2500);
  } else {
    // 试点 modal 里的任意可点击项
    const clickables = page.locator('#artwork-picker-modal button, #artwork-picker-modal [role="button"]').all();
    console.log('artwork-picker 按钮数:', (await clickables).length);
  }
  
  await page.screenshot({ path: path.join(OUT, '01-after-pick.png'), fullPage: true });
  console.log('✅ 作品选择后截图');

  // 2. 选择书签品类
  console.log('\n=== 2. 选择书签品类 ===');
  // 可能是标签页、下拉、或网格卡片
  const bookmarkBtn = page.locator('[data-product-key="shuqian"], button:has-text("书签"), .product-card:has-text("书签"), [data-key="shuqian"]').first();
  const hasBookmark = await bookmarkBtn.count();
  if (hasBookmark > 0) {
    await bookmarkBtn.click();
    await page.waitForTimeout(800);
    console.log('✅ 选中书签品类');
  } else {
    console.log('⚠️ 没找到书签按钮，尝试找任意品类选择器');
    // 打印页面上所有可点击元素的文本
    const allBtns = await page.locator('button, [role="tab"], .product-item, .craft-card').allTextContents();
    console.log('页面按钮:', allBtns.slice(0, 20));
  }
  await page.screenshot({ path: path.join(OUT, '03-bookmark-selected.png'), fullPage: true });

  // 4. 输入文案 + 生成
  console.log('\n=== 4. 输入文案 + 生成 ===');
  const textarea = page.locator('textarea, input[type="text"][placeholder*="文案"], input[type="text"][placeholder*="主题"], [contenteditable="true"]').first();
  if (await textarea.count() > 0) {
    await textarea.fill('千里江山图 金属书签');
    console.log('✅ 文案已填');
  }
  const genBtn = page.locator('button:has-text("生成"), button:has-text("开始"), button:has-text("立即")').first();
  if (await genBtn.count() > 0) {
    await genBtn.click();
    console.log('✅ 点击生成，等待 10s...');
    await page.waitForTimeout(10000);
  }
  await page.screenshot({ path: path.join(OUT, '04-generated.png'), fullPage: true });

  // 5. 找 3D 预览区
  console.log('\n=== 5. 检查 3D 预览 ===');
  const threeArea = page.locator('#three3dView, .three-3d-view, [data-3d], canvas').first();
  const hasThree = await threeArea.count();
  console.log(`3D 元素数量: ${hasThree}`);
  
  if (hasThree > 0) {
    // 切换到 3D 标签（如果有的话）
    const tab3d = page.locator('[role="tab"]:has-text("3D"), button:has-text("3D预览"), .tab:has-text("3D")').first();
    if (await tab3d.count() > 0) {
      await tab3d.click();
      await page.waitForTimeout(2000);
      console.log('✅ 切换到 3D 预览标签');
    }
    
    // 等 Three.js 渲染
    await page.waitForTimeout(3000);
    
    // 截图 3D 区域
    const threeBox = await threeArea.boundingBox();
    if (threeBox) {
      await page.screenshot({ path: path.join(OUT, '05-3d-bookmark.png'), clip: threeBox });
      console.log('✅ 3D 区域已截图');
    }
    
    // 检查 canvas 是否有渲染（非空）
    const canvasCount = await page.locator('canvas').count();
    console.log(`页面 canvas 总数: ${canvasCount}`);
  }

  // 6. Console 报告
  console.log('\n=== 6. Console 关键日志 ===');
  const craftLogs = consoleLogs.filter(l => l.text.includes('Craft3D') || l.text.includes('PBR') || l.text.includes('FORM_PBR') || l.text.includes('shuqian') || l.text.includes('renderCustom'));
  craftLogs.forEach(l => console.log(`  [${l.type}] ${l.text.substring(0, 300)}`));
  
  const errors = consoleLogs.filter(l => l.type === 'error' || l.text.includes('❌') || l.text.includes('fail') || l.text.includes('ERR'));
  console.log(`\n错误日志数: ${errors.length}`);
  errors.forEach(l => console.log(`  ❌ ${l.text.substring(0, 200)}`));

  await page.screenshot({ path: path.join(OUT, '06-final-full.png'), fullPage: true });
  
  console.log('\n=== 测试完成，截图在 test-screenshots/ ===');
  await browser.close();
})().catch(e => { console.error('TEST FAILED:', e); process.exit(1); });
