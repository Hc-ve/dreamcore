import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

const logs = [];
page.on('console', msg => logs.push({ t: msg.type(), text: msg.text().slice(0, 300) }));
page.on('pageerror', err => logs.push({ t: 'pageerror', text: err.message }));

async function evalScript() {
  return page.evaluate(() => {
    // 看日志里 Craft3D 相关的
    const results = [];
    const origWarn = console.warn;
    // 没法直接拿历史，但可以看 DOM 里的 .log 元素
    document.querySelectorAll('.log').forEach(el => results.push(el.textContent));
    return results;
  });
}

async function takeScreenshot(filename) {
  await page.screenshot({ path: filename });
  console.log(`📸 ${filename}`);
}

try {
  console.log('1. 打开独立测试页...');
  await page.goto('http://localhost:5173/test-mug-uv.html', { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(4000);
  
  // 等渲染完成
  await page.waitForFunction(() => {
    const divs = document.querySelectorAll('.log.ok, .log');
    return Array.from(divs).some(d => d.textContent?.includes('渲染完成'));
  }, { timeout: 10000 }).catch(() => console.log('  等待渲染完成超时'));
  
  // 看侧边栏日志
  const sideLogs = await page.evaluate(() => 
    Array.from(document.querySelectorAll('.log')).map(el => el.textContent)
  );
  console.log('\n=== 侧边栏日志 ===');
  sideLogs.forEach(l => console.log('  ' + l.slice(0, 200)));
  
  // 截图 1: 正面
  console.log('\n2. 截图 1: 正面');
  await page.mouse.move(700, 500);
  await takeScreenshot('mug-front.png');
  
  // 截图 2: 旋转到底面 (拖鼠标)
  console.log('3. 拖鼠标旋转到底面...');
  await page.mouse.move(700, 500);
  await page.mouse.down();
  await page.mouse.move(700, 200, { steps: 20 }); // 向上拖 = 看底部
  await page.mouse.up();
  await page.waitForTimeout(300);
  await takeScreenshot('mug-bottom.png');
  
  // 截图 3: 侧面
  console.log('4. 拖鼠标旋转到侧面...');
  await page.mouse.move(700, 350);
  await page.mouse.down();
  await page.mouse.move(1000, 350, { steps: 20 }); // 向右拖
  await page.mouse.up();
  await page.waitForTimeout(300);
  await takeScreenshot('mug-side.png');
  
  // 截图 4: 顶面 (看杯口内壁)
  console.log('5. 拖鼠标旋转到顶面...');
  await page.mouse.move(700, 500);
  await page.mouse.down();
  await page.mouse.move(700, 800, { steps: 20 }); // 向下拖 = 看顶部
  await page.mouse.up();
  await page.waitForTimeout(300);
  await takeScreenshot('mug-top.png');
  
  console.log('\n✅ 4 个视角截图完成！');
  console.log('   mug-front.png   - 正面');
  console.log('   mug-bottom.png  - 底部');
  console.log('   mug-side.png    - 侧面');
  console.log('   mug-top.png     - 顶面(杯口内壁)');
  
  console.log('\n=== 浏览器 console 日志 ===');
  logs.forEach(l => console.log(`[${l.t}] ${l.text}`));
  
} catch(err) {
  console.error('❌', err.message);
  await page.screenshot({ path: 'mug-error.png' });
} finally {
  await browser.close();
}
