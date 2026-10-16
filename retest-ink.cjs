// retest-ink.cjs — 用户水墨风提示词端到端复测（真实链路，非 mock）
// 四点验收：① 提示词智能直通 ② 负面提示词合并 ③ 235 产品选择器 ④ 3D 旋转
// 运行前提：dev server 127.0.0.1:5173 在线 + ollama v6 在线 + DashScope key 有效
const { chromium } = require('@playwright/test');

const INK_IDEA = '水墨画风格，淡雅留白，宣纸质感，笔触晕染，黑白灰主色调，远山如黛意境悠远';
const INK_NEGATIVE = '照片写实，强烈阴影，噪点';
const BASE = 'http://127.0.0.1:5173';

function ts() { return new Date().toLocaleTimeString('zh-CN', { hour12: false }); }
const log = (m) => console.log(`[${ts()}] ${m}`);
const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  log(`${ok ? 'PASS' : 'FAIL'} — ${name}${detail ? ' | ' + detail : ''}`);
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(60000);

  const submits = []; // 捕获真实重绘提交（不 mock，只旁听）
  page.on('request', req => {
    if (req.url().includes('/api/ai/image-repaint-submit')) {
      try { submits.push(req.postDataJSON()); } catch (_) { /* ignore */ }
    }
  });

  await page.goto(BASE);
  await page.waitForSelector('.artwork-card', { timeout: 20000 });
  try { await page.locator('#welcome-enter').click({ timeout: 4000 }); } catch (_) { /* ignore */ }
  const id = await page.locator('.artwork-card').first().getAttribute('data-id');
  await page.goto(`${BASE}/#/craft?artworkId=${id}`);
  await page.waitForSelector('#craft-idea-generate', { timeout: 15000 });

  // AI 灵感生成（真实 v6 自研模型）—— 先生成，AI 推荐产品会覆盖选择
  await page.locator('#craft-idea-input').fill(INK_IDEA);
  await page.locator('#craft-idea-generate').click();
  await page.waitForFunction(() => {
    const b = document.querySelector('#craft-idea-generate');
    return b && !b.disabled;
  }, null, { timeout: 60000 });
  const modelBadge = await page.locator('#craft-model-badge').textContent().catch(() => '');
  check('自研模型主链（v6）', /自研/.test(modelBadge), modelBadge.trim());
  const aiProduct = await page.locator('#craft-product-badge').textContent().catch(() => '');
  log(`AI 推荐落地产品：${aiProduct.trim()}`);

  // ③ 235 产品选择器：生成后再人工改选明信片（带 form3d，用户真实操作路径）
  await page.locator('.craft-category-chip', { hasText: '文具类' }).click();
  const productCount = await page.locator('.craft-product-card').count();
  check('③ 产品网格（文具类 31 种）', productCount >= 30, `count=${productCount}`);
  await page.locator('.craft-product-card[data-name="明信片"]').click();
  const badge = await page.locator('#craft-product-badge').textContent().catch(() => '');
  check('③ 产品徽标', /明信片/.test(badge), badge.trim());

  // 版式：圆窗雅集（1 分镜槽位）
  await page.locator('.craft-layout-chip', { hasText: '圆窗雅集' }).click();
  await page.waitForFunction(() => {
    const h = document.querySelector('#craft-repaint-hint');
    return h && /1 个分镜槽位/.test(h.textContent);
  }, null, { timeout: 10000 });

  // 重绘前画布中心区域采样（画风变化对比基线）
  const hashBefore = await page.evaluate(() => {
    const c = document.querySelector('#craft-preview-canvas');
    const w = Math.floor(c.width * 0.3), h = Math.floor(c.height * 0.3);
    const x = Math.floor((c.width - w) / 2), y = Math.floor((c.height - h) / 2);
    const d = c.getContext('2d').getImageData(x, y, w, h).data;
    let s = 0; for (let i = 0; i < d.length; i += 97) s = (s * 31 + d[i]) >>> 0;
    return s;
  });

  // ② 负面提示词 + ① 直通：真实提交重绘
  await page.locator('#craft-negative-input').fill(INK_NEGATIVE);
  await page.locator('#craft-repaint-btn').click();
  log('已提交 AI 重绘分镜（真实 qwen-image-3.0，约 95-150s）…');
  // 注意：静态提示文案本身含"失败自动回退原取景"，必须等完成态文案（已重绘 N/N / 失败已回退）
  await page.waitForFunction(() => {
    const h = document.querySelector('#craft-repaint-hint');
    return h && (/已重绘 \d+\/\d+ 分镜/.test(h.textContent) || /AI 重绘失败已回退原取景/.test(h.textContent));
  }, null, { timeout: 200000 });
  const repaintHint = await page.locator('#craft-repaint-hint').textContent();
  check('重绘完成（画风真实生成）', /已重绘 1\/1/.test(repaintHint), repaintHint.trim());

  // ① 提示词直通断言（捕获的真实提交 payload）
  const payload = submits[0] || {};
  const prompt = String(payload.prompt || '');
  const neg = String(payload.negativePrompt || payload.negative_prompt || '');
  check('① 艺术指导最高优先级前置', prompt.startsWith('用户艺术指导（最高优先级，逐字严格执行）'), prompt.slice(0, 40) + '…');
  check('① 水墨指导逐字透传', prompt.includes(INK_IDEA), '');
  check('① 风格锁降为辅助基调', /辅助基调/.test(prompt), '');
  check('② 负面词合并透传', neg.includes('噪点') && neg.includes('照片写实感'), neg);

  // 画布内容变化（中心区域哈希）
  const hashAfter = await page.evaluate(() => {
    const c = document.querySelector('#craft-preview-canvas');
    const w = Math.floor(c.width * 0.3), h = Math.floor(c.height * 0.3);
    const x = Math.floor((c.width - w) / 2), y = Math.floor((c.height - h) / 2);
    const d = c.getContext('2d').getImageData(x, y, w, h).data;
    let s = 0; for (let i = 0; i < d.length; i += 97) s = (s * 31 + d[i]) >>> 0;
    return s;
  });
  check('① 画风真实变化（画布内容改变）', hashBefore !== hashAfter, `hash ${hashBefore} → ${hashAfter}`);

  // ④ 3D 旋转：实物预览面板 → 3D chip → WebGL 挂载 + 快照导出
  await page.locator('#craft-mockup-btn').click();
  await page.locator('.craft-mockup-panel').waitFor({ timeout: 10000 });
  await page.locator('.craft-mockup-chip-3d').click();
  await page.waitForSelector('#craft-3d-view canvas', { timeout: 30000 });
  const snap = await page.evaluate(async () => {
    const m = await import('/js/craft-3d.js');
    return m.snapshot().length;
  });
  check('④ 3D 查看器挂载 + 快照导出', snap > 10000, `snapshot ${Math.round(snap / 1024)}KB`);

  await browser.close();

  const fail = results.filter(r => !r.ok);
  console.log(`\n===== 复测结论：${results.length - fail.length}/${results.length} PASS =====`);
  fail.forEach(f => console.log(`FAIL: ${f.name} | ${f.detail}`));
  process.exit(fail.length ? 1 : 0);
})().catch(e => { console.error('FATAL:', e.message); process.exit(2); });
