// qa-output/scenic-e2e-verify.mjs
import { chromium } from 'playwright';
import fs from 'fs';

function log(...a) { console.log('[VERIFY]', ...a); }

async function dismissWelcome(page) {
  try {
    await page.locator('#welcome-enter').click({ timeout: 4000 });
    log('欢迎弹窗已关闭');
  } catch (_) {}
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function run() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // 清空状态
  await page.addInitScript(`
    try { localStorage.clear(); } catch(e){}
    try { indexedDB.databases().then(dbs => dbs.forEach(d => indexedDB.deleteDatabase(d.name))); } catch(e){}
  `);

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle', timeout: 20000 });
  await dismissWelcome(page);
  await sleep(500);

  // ========== 步骤 1：殷墟 CTA ==========
  log('--- 步骤 1：验证殷墟 CTA 显示 ---');
  await page.goto('http://localhost:5173/#/scenic?area=yinxu', { waitUntil: 'networkidle', timeout: 20000 });
  try { await page.waitForSelector('.sn-overlay', { timeout: 8000 }); }
  catch (e) { log('❌ 殷墟 overlay 未出现'); await page.screenshot({ path: 'qa-output/yinxu-overlay-fail.png', fullPage: true }); await browser.close(); return; }

  await page.screenshot({ path: 'qa-output/yinxu-cta-area.png', fullPage: true });

  const craftBtn = page.locator('#sn-craft-btn');
  const checkinBtn = page.locator('#sn-craft-checkin-btn');
  const ctaVisible = await craftBtn.count() > 0 && await craftBtn.first().isVisible().catch(() => false);
  const checkinVisible = await checkinBtn.count() > 0 && await checkinBtn.first().isVisible().catch(() => false);

  log(`#sn-craft-btn 可见: ${ctaVisible}`);
  log(`#sn-craft-checkin-btn 可见: ${checkinVisible}`);

  if (!ctaVisible && !checkinVisible) {
    log('❌ 失败：殷墟 themeId=null，但两个 CTA 都不可见！');
    await browser.close(); return;
  }
  log('✅ 殷墟 CTA 验证通过');

  // ========== 步骤 2：点击 CTA → 工作台 ==========
  log('--- 步骤 2：点击殷墟 CTA → 工作台 ---');
  const target = ctaVisible ? craftBtn.first() : checkinBtn.first();
  await target.click();
  await sleep(2000);

  try { await page.waitForFunction(() => (location.hash || '').includes('#/craft'), { timeout: 10000 }); }
  catch (e) { log('❌ 未跳转到 #/craft'); await browser.close(); return; }

  const hash = await page.evaluate(() => location.hash);
  log(`当前 hash: ${hash}`);

  const h = hash || '';
  const checks = {
    'artworkId': h.includes('artworkId='),
    'scenic=yinxu': h.includes('scenic=yinxu'),
    'style=': h.includes('style='),
    'category=': h.includes('category='),
  };
  for (const [k, v] of Object.entries(checks)) log(`  参数 ${k}: ${v ? '✅' : '❌'}`);
  if (!Object.values(checks).every(Boolean)) log('❌ 失败：URL 参数不全');
  else log('✅ URL 参数全部正确');

  // 匹配提示条
  try { await page.waitForSelector('#ai-craft-workbench', { timeout: 8000 }); log('✅ 工作台 DOM 出现'); }
  catch (_) { log('❌ 工作台未出现'); }

  const hint = page.locator('[data-scenic-match="true"]');
  const hintVisible = await hint.count() > 0 && await hint.first().isVisible().catch(() => false);
  log(`匹配提示条可见: ${hintVisible}`);
  if (hintVisible) {
    const hintText = await hint.first().innerText();
    log(`  提示条文案: ${hintText}`);
  }

  const activeStyle = page.locator('.craft-style-chip.active');
  const activeStyleText = await (activeStyle.count() > 0 ? activeStyle.first().innerText() : Promise.resolve('(无)'));
  log(`当前激活风格: ${activeStyleText}`);

  await page.screenshot({ path: 'qa-output/yinxu-craft-workbench.png', fullPage: true });

  // 关闭
  try { await page.locator('#craft-close').click(); } catch (_) {}
  await sleep(1000);

  // ========== 步骤 3：龙门石窟完整链路 ==========
  log('--- 步骤 3：验证龙门石窟完整链路 ---');
  await page.goto('http://localhost:5173/#/scenic?area=longmen', { waitUntil: 'networkidle', timeout: 20000 });
  await page.waitForSelector('.sn-overlay', { timeout: 8000 });

  const lmnBtn = page.locator('#sn-craft-btn');
  const lmnVisible = await lmnBtn.count() > 0 && await lmnBtn.first().isVisible().catch(() => false);
  log(`龙门 #sn-craft-btn 可见: ${lmnVisible}`);
  await page.screenshot({ path: 'qa-output/longmen-cta-area.png', fullPage: true });

  if (lmnVisible) {
    await lmnBtn.first().click();
    await sleep(2000);
    await page.waitForFunction(() => (location.hash || '').includes('#/craft'), { timeout: 10000 });
    const lmnHash = await page.evaluate(() => location.hash);
    log(`龙门跳转后 hash: ${lmnHash}`);

    await page.waitForSelector('#ai-craft-workbench', { timeout: 8000 });
    const lmnHint = page.locator('[data-scenic-match="true"]');
    const lmnHintVisible = await lmnHint.count() > 0 && await lmnHint.first().isVisible().catch(() => false);
    log(`龙门匹配提示条可见: ${lmnHintVisible}`);
    if (lmnHintVisible) log(`  文案: ${await lmnHint.first().innerText()}`);

    const lmnActive = page.locator('.craft-style-chip.active');
    log(`龙门当前激活风格: ${await (lmnActive.count() > 0 ? lmnActive.first().innerText() : Promise.resolve('(无)'))}`);

    await page.screenshot({ path: 'qa-output/longmen-craft-workbench.png', fullPage: true });
  }

  log('=== 验证全部完成 ===');
  await browser.close();
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
