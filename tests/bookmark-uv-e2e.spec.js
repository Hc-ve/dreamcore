/**
 * tests/bookmark-uv-e2e.spec.js — 最终完整路径
 * 1. Admin 上传 书签_fixed.glb
 * 2. /#/craft → 选热门作品 "故宫雪夜生成"
 * 3. 确认书签已选中
 * 4. 点顶部"实物预览"按钮
 * 5. 3D旋转模式截图正面 → 鼠标拖拽旋转 → 截图背面
 * 6. 对比 UV 是否正确
 */
import { test } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const FIXED_GLB = path.resolve(process.cwd(), '书签_fixed.glb');
const SD = path.resolve(process.cwd(), 'qa-output', 'bookmark-uv');
if (!fs.existsSync(SD)) fs.mkdirSync(SD, { recursive: true });

const URL = 'http://localhost:5173';

test.setTimeout(120000);

async function ss(page, name) {
  const p = path.join(SD, `${name}.png`);
  await page.screenshot({ path: p });
  console.log(`  📸 ${path.basename(p)}`);
}

test('书签 UV 修复 E2E — 完整路径', async ({ page, context }) => {
  console.log('=== 0. 初始化 ===');
  await context.clearCookies();
  await page.goto(URL);
  await page.waitForSelector('.artwork-card, .gallery-card', { timeout: 20000 });
  await page.evaluate(() => { window.currentUser = { id: 1, username: 'admin', isAdmin: true, role: 'superadmin' }; });
  console.log('  ✅ 主站已加载');

  // 关闭欢迎弹窗（Escape 或找 close 按钮）
  for (const key of ['Escape']) {
    try { await page.keyboard.press(key, { timeout: 2000 }); } catch (_) {}
  }

  // === 1. Admin 上传 ===
  console.log('\n=== 1. Admin → 上传修复模型 ===');
  await page.goto(`${URL}/#/admin`);
  await page.waitForSelector('#admin-modal', { timeout: 10000 });

  await page.getByText('3D模型管理').click();
  await page.waitForSelector('#c3d-product', { timeout: 5000 });

  await page.selectOption('#c3d-product', 'shuqian');
  await page.fill('#c3d-name', '书签_UV修复_v3');
  await page.setInputFiles('#c3d-file', FIXED_GLB);
  
  // 找上传按钮——admin-c3d-upload 里的最后一个 button
  const uploadBtn = page.locator('#admin-modal button').filter({ hasText: /上传并绑定/ }).first();
  await uploadBtn.click({ timeout: 10000 });
  console.log('  ✅ 上传中...');
  
  // 等成功提示
  await page.waitForTimeout(2500);
  await ss(page, 'admin-uploaded-v3');
  console.log('  ✅ 上传完成');
  
  // 关 admin
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // === 2. /#/craft → 选热门作品 ===
  console.log('\n=== 2. 进入 /#/craft 选作品 ===');
  await page.goto(`${URL}/#/craft`);
  await page.waitForTimeout(3000);

  // 选择作品弹窗出现了——找"热门作品" tab
  console.log('  找"热门作品" tab...');
  let hotTab = page.getByRole('button', { name: /热门作品/ });
  if (!(await hotTab.isVisible({ timeout: 3000 }))) {
    // 兜底：点击任何文字含"热门"的元素
    hotTab = page.getByText('热门作品').first();
  }
  await hotTab.click({ timeout: 8000 });
  console.log('  ✅ 切到热门作品');
  await page.waitForTimeout(2500);
  await ss(page, 'craft-hotworks');

  // 找弹窗里的作品缩略图——弹窗 class 里应该有 artwork-picker 之类
  // 热门作品 tab 下的网格里找"故宫"文字或第三排第四张
  console.log('  找弹窗里的作品缩略图...');
  
  // 方法1：直接找带"故宫"文字的缩略图
  let cardToClick;
  const gugongThumb = page.locator('[class*="artwork-picker"], [class*="ArtworkPicker"], [class*="modal"]').filter({ hasText: /故宫/ }).first();
  try {
    await gugongThumb.waitFor({ state: 'visible', timeout: 4000 });
    // 在这个容器里点 img 或第一张
    const img = gugongThumb.locator('img').first();
    if (await img.isVisible({ timeout: 1000 })) {
      cardToClick = img;
    } else {
      cardToClick = gugongThumb.first();
    }
    console.log('  找到弹窗里的"故宫雪夜生成"');
  } catch {
    // 方法2：直接用 getByText + 父级查找
    const gugong = page.getByText('故宫雪夜生成').first();
    const parent = gugong.locator('xpath=ancestor::*[self::div or self::button or self::a][1]');
    cardToClick = parent.first();
    console.log('  兜底：通过祖先节点点击');
  }
  
  await cardToClick.click({ timeout: 10000, force: true });
  console.log('  ✅ 弹窗作品已点击');
  await page.waitForTimeout(2500);
  await ss(page, 'workbench-opened');

  // === 3. 确认书签已选 ===
  console.log('\n=== 3. 确认书签选中 ===');
  // 文创产品区在右侧，底部有"书签" chip
  // 看用户截图底部：书签 / 手账本 / 明信片 / 贺卡
  const bookmarkChip = page.getByRole('button').filter({ hasText: /书签/ }).first();
  if (await bookmarkChip.isVisible({ timeout: 3000 })) {
    await bookmarkChip.click({ force: true });
    console.log('  ✅ 书签 chip 已点击');
  }
  await page.waitForTimeout(800);
  await ss(page, 'bookmark-confirmed');

  // === 4. 点"实物预览"按钮 ===
  console.log('\n=== 4. 实物预览 → 切 3D旋转 ===');
  const previewBtn = page.getByRole('button', { name: /实物预览/ }).first();
  await previewBtn.waitFor({ state: 'visible', timeout: 10000 });
  await previewBtn.click();
  console.log('  ✅ 点击实物预览');
  
  // 等预览面板出现
  await page.waitForTimeout(1500);
  
  // 切到"3D旋转" tab
  console.log('  切"3D旋转" tab...');
  // 用角色或文字找
  let tab3d = page.getByRole('button', { name: /3D旋转|3d旋转|3D 旋转|3d 旋转/i });
  if (!(await tab3d.isVisible({ timeout: 3000 }).catch(() => false))) {
    // 兜底：getByText
    tab3d = page.getByText(/3D旋转|3d旋转/i).first();
  }
  await tab3d.click({ timeout: 8000, force: true });
  console.log('  ✅ 切到 3D旋转');
  
  // 等 3D canvas 出现
  await page.waitForSelector('canvas', { timeout: 15000 });
  await page.waitForTimeout(3000); // 等模型加载 + 贴图

  // 🧪 读 craft-3d.js 写的 UV 诊断
  const uvDiag = await page.evaluate(() => window.__diagUV);
  console.log('\n  🔍 browser-side UV diag:', JSON.stringify(uvDiag, null, 2));
  await ss(page, '3d-front');
  console.log('  📸 正面已截图');

  // === 5. 用 Craft3D._camera 精确切视角 ===
  console.log('\n=== 5. JS API 精确切换视角 ===');
  
  const perspectives = [
    { name: 'front',      pos: [0, 0.5, 2.2], tgt: [0, 0.5, 0] },
    { name: 'back',       pos: [0, 0.5, -2.2], tgt: [0, 0.5, 0] },
    { name: 'top',        pos: [0, 2.2, 0.01], tgt: [0, 0.5, 0] },
    { name: 'bottom',     pos: [0, -1.2, 0.01], tgt: [0, 0.5, 0] },
    { name: 'side-right', pos: [2.2, 0.5, 0],   tgt: [0, 0.5, 0] },
    { name: 'side-left',  pos: [-2.2, 0.5, 0],  tgt: [0, 0.5, 0] },
    { name: 'iso',        pos: [1.8, 1.6, 1.8], tgt: [0, 0.5, 0] },
  ];
  
  for (const p of perspectives) {
    const ok = await page.evaluate(({ pos, tgt }) => {
      const c3d = window.Craft3D;
      if (!c3d) return { error: 'no Craft3D' };
      const cam = c3d._camera;
      const ctrl = c3d._controls;
      if (!cam || !ctrl) return { error: `no cam/ctrl: cam=${!!cam} ctrl=${!!ctrl}`, keys: Object.keys(c3d) };
      // 停自动旋转
      ctrl.autoRotate = false;
      cam.position.set(pos[0], pos[1], pos[2]);
      ctrl.target.set(tgt[0], tgt[1], tgt[2]);
      ctrl.update();
      return { ok: true, camPos: [cam.position.x, cam.position.y, cam.position.z] };
    }, { pos: p.pos, tgt: p.tgt });
    
    await page.waitForTimeout(600);
    await ss(page, `3d-${p.name}`);
    console.log(`  ${p.name}:`, ok?.ok ? '✅' : (ok?.error || '❌'));
  }

  // === 6. dump 材质诊断 ===
  console.log('\n=== 6. 材质诊断 ===');
  const diag = await page.evaluate(() => {
    const c3d = window.Craft3D;
    const cam = c3d?._camera;
    const meshInfo = [];
    
    // 从 camera 反查 scene (camera.parent.parent.parent 应该是 scene)
    let scene = null;
    let p = cam;
    for (let i = 0; i < 10 && p; i++) {
      if (p.isScene) { scene = p; break; }
      p = p.parent;
    }
    
    // 兜底：从 renderCustom 里找 window.__craft3dState
    if (!scene && window.__craft3dState?.scene) scene = window.__craft3dState.scene;
    
    const walk = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      if (obj.isMesh) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        meshInfo.push({
          name: obj.name,
          verts: obj.geometry?.attributes?.position?.count,
          mats: mats.map(m => ({
            type: m?.type,
            hasMap: !!m?.map,
            side: m?.side,
            color: m?.color?.getHexString?.() || null,
            roughness: m?.roughness,
            metalness: m?.metalness,
          })),
          uvRange: (() => {
            const uv = obj.geometry?.attributes?.uv;
            if (!uv) return 'NO_UV';
            let mnU=2,mxU=-1,mnV=2,mxV=-1;
            for (let i=0;i<uv.count;i++) {
              const u=uv.getX(i),v=uv.getY(i);
              if(u<mnU)mnU=u; if(u>mxU)mxU=u;
              if(v<mnV)mnV=v; if(v>mxV)mxV=v;
            }
            return `U[${mnU.toFixed(2)},${mxU.toFixed(2)}] V[${mnV.toFixed(2)},${mxV.toFixed(2)}]`;
          })(),
        });
      }
      obj.children?.forEach?.(walk);
    };
    walk(scene);
    return {
      sceneFound: !!scene,
      camPos: cam ? [cam.position.x, cam.position.y, cam.position.z] : null,
      c3dKeys: Object.keys(c3d || {}),
      meshCount: meshInfo.length,
      meshInfo
    };
  });
  console.log(JSON.stringify(diag, null, 2));
  
  await ss(page, 'final-state');
  console.log('\n=== ✅ 完成 ===');
});
