// ============================================================
// tests/craft-3d.spec.js — 阶段C「3D 旋转实物预览」端到端验证
// 覆盖：
//   ① 主路径：选中带 form3d 的产品 → 3D chip 可点 → three.js 查看器挂载
//      （canvas + 工具条 + 贴图来自结果画布）
//   ② 无 form3d 产品：3D chip 置灰不可点，2D 场景不受影响
//   ③ 产品切换联动：3D 模式下切到无 form3d 产品 → 自动回退 2D 场景
//   ④ 关闭面板：3D 资源释放（canvas 从 DOM 移除）
// 说明：three 走 vite vendor-three chunk；WebGL 由 headless SwiftShader 提供
// ============================================================
import { test, expect } from '@playwright/test';

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

/** 选产品：文具类 → 指定产品名（data-name 精确匹配，避开画布子标签同名） */
async function selectStationeryProduct(page, name) {
  await page.locator('.craft-category-chip', { hasText: '文具类' }).click();
  await page.locator(`.craft-product-card[data-name="${name}"]`).click();
}

/** 打开实物预览面板 */
async function openMockup(page) {
  await page.locator('#craft-mockup-btn').click();
  await page.locator('.craft-mockup-panel').waitFor({ timeout: 10000 });
}

test.describe('阶段C 3D 旋转实物预览', () => {
  test('① 主路径：3D chip 可点 → three.js 查看器挂载 → 切回 2D 释放', async ({ page }) => {
    await clearStorage(page.context());
    await openCraft(page);

    // 明信片带 form3d=cardStack
    await selectStationeryProduct(page, '明信片');
    await openMockup(page);

    // 3D chip 可点（首位，非 disabled）
    const chip3d = page.locator('.craft-mockup-chip-3d');
    await expect(chip3d).toBeEnabled();
    await chip3d.click();

    // three.js 查看器挂载：容器可见 + 内含 WebGL canvas + 工具条
    const view = page.locator('#craft-3d-view');
    await expect(view).toBeVisible();
    await expect(view.locator('canvas')).toHaveCount(1, { timeout: 30000 });
    await expect(view.locator('.craft-3d-toolbar')).toHaveCount(1);
    await expect(view.locator('.craft-3d-tool')).toHaveCount(4); // 网格/旋转/复位/坐标轴
    await expect(chip3d).toHaveClass(/active/);

    // WebGL 真实出图验证：canvas 有非零尺寸
    const size = await view.locator('canvas').evaluate(c => ({ w: c.width, h: c.height }));
    expect(size.w).toBeGreaterThan(0);
    expect(size.h).toBeGreaterThan(0);

    // 切回 2D 场景 chip → 3D canvas 从 DOM 移除（dispose 生效）
    await page.locator('.craft-mockup-chip:not(.craft-mockup-chip-3d)').first().click();
    await expect(view.locator('canvas')).toHaveCount(0);
    await expect(view).toBeHidden();
  });

  test('② 无 form3d 产品：3D chip 置灰，2D 场景正常', async ({ page }) => {
    await clearStorage(page.context());
    await openCraft(page);

    // 尺子无 form3d 字段
    await selectStationeryProduct(page, '尺子');
    await openMockup(page);

    const chip3d = page.locator('.craft-mockup-chip-3d');
    await expect(chip3d).toBeDisabled();

    // 默认 2D 场景不受影响
    await expect(page.locator('.craft-mockup-chip.active')).toHaveText(/桌面|相框|手机|卡册|社交/);
    await expect(page.locator('#craft-3d-view')).toBeHidden();
  });

  test('③ 3D 模式下切到无 form3d 产品 → 自动回退 2D 场景', async ({ page }) => {
    await clearStorage(page.context());
    await openCraft(page);

    await selectStationeryProduct(page, '明信片');
    await openMockup(page);
    await page.locator('.craft-mockup-chip-3d').click();
    await expect(page.locator('#craft-3d-view canvas')).toHaveCount(1, { timeout: 30000 });

    // 面板开着，直接切到无 form3d 产品（尺子）
    await selectStationeryProduct(page, '尺子');

    // 自动回退：3D 释放 + active chip 变为 2D 场景
    await expect(page.locator('#craft-3d-view canvas')).toHaveCount(0);
    await expect(page.locator('.craft-mockup-chip-3d')).not.toHaveClass(/active/);
    await expect(page.locator('.craft-mockup-chip.active')).toHaveText(/桌面|相框|手机|卡册|社交/);
  });

  test('④ 关闭面板释放 3D 资源', async ({ page }) => {
    await clearStorage(page.context());
    await openCraft(page);

    await selectStationeryProduct(page, '笔记本'); // form3d=notebook
    await openMockup(page);
    await page.locator('.craft-mockup-chip-3d').click();
    await expect(page.locator('#craft-3d-view canvas')).toHaveCount(1, { timeout: 30000 });

    await page.locator('#craft-mockup-close').click();
    await expect(page.locator('.craft-mockup-panel')).toBeHidden();
    await expect(page.locator('#craft-3d-view canvas')).toHaveCount(0);
  });

  test('⑤ 产品切换 → 3D 形态联动（明信片 cardStack ↔ 徽章 badge）', async ({ page }) => {
    await clearStorage(page.context());
    await openCraft(page);

    // 初始选明信片
    await selectStationeryProduct(page, '明信片');
    await openMockup(page);
    await page.locator('.craft-mockup-chip-3d').click();
    await expect(page.locator('#craft-3d-view canvas')).toHaveCount(1, { timeout: 30000 });

    // 切换为饰品类 → 徽章
    await page.locator('.craft-category-chip', { hasText: '饰品类' }).click();
    await page.locator('.craft-product-card[data-name="徽章"]').click();

    // 3D 应重建为 badge 形态：提示文案显示当前产品名"徽章"
    await expect(page.locator('.craft-3d-hint')).toContainText('徽章 3D 实物预览');
    await expect(page.locator('#craft-3d-view canvas')).toHaveCount(1);

    // 再切回文具类 → 明信片
    await page.locator('.craft-category-chip', { hasText: '文具类' }).click();
    await page.locator('.craft-product-card[data-name="明信片"]').click();
    // 切回明信片后 hint 显示产品名
    await expect(page.locator('.craft-3d-hint')).toContainText('明信片 3D 实物预览');
    await expect(page.locator('#craft-3d-view canvas')).toHaveCount(1);
  });

  test('⑥ 3D 查看器背景为米白渐变，不为 mockup 场景紫色', async ({ page }) => {
    await clearStorage(page.context());
    await openCraft(page);

    await selectStationeryProduct(page, '明信片');
    await openMockup(page);
    await page.locator('.craft-mockup-chip-3d').click();
    const view = page.locator('#craft-3d-view');
    await expect(view.locator('canvas')).toHaveCount(1, { timeout: 30000 });

    // 容器背景应为米白渐变（Chrome 把 hex 规范化为 rgb），不能是 mockup album/social 的紫色系
    const bg = await view.evaluate(el => getComputedStyle(el).backgroundImage);
    expect(bg).toMatch(/rgb\(245,\s*242,\s*236\)|#f5f2ec/i);
    expect(bg).not.toContain('201, 182, 255');
    expect(bg).not.toContain('255, 209, 232');
  });

  // ======= P0 修复专项测试 =======

  test('⑦ 品类切换恢复：3D → 无 form3d → 有 form3d，chip 从 enabled→disabled→enabled', async ({ page }) => {
    await clearStorage(page.context());
    await openCraft(page);

    // 初始：徽章（form3d=badge）进入 3D
    await page.locator('.craft-category-chip', { hasText: '饰品类' }).click();
    await page.locator('.craft-product-card[data-name="徽章"]').click();
    await openMockup(page);
    await page.locator('.craft-mockup-chip-3d').click();
    await expect(page.locator('#craft-3d-view canvas')).toHaveCount(1, { timeout: 30000 });

    // 场景 1 → 尺子（无 form3d）：fallback + chip disabled
    await selectStationeryProduct(page, '尺子');
    await expect(page.locator('#craft-3d-view canvas')).toHaveCount(0);
    await expect(page.locator('.craft-mockup-chip-3d')).toBeDisabled();

    // 场景 2 → 切到有 form3d 的徽章（P0 修复核心！修复前 chip 会保持 disabled）
    await page.locator('.craft-category-chip', { hasText: '饰品类' }).click();
    await page.locator('.craft-product-card[data-name="徽章"]').click();
    const chip3d = page.locator('.craft-mockup-chip-3d');
    await expect(chip3d).toBeEnabled();

    // 手动点 chip 应能正常进入 3D（修复前因 chip disabled 点不了 → 卡死）
    await chip3d.click();
    await expect(page.locator('#craft-3d-view canvas')).toHaveCount(1, { timeout: 30000 });
    await expect(page.locator('.craft-3d-hint')).toContainText('徽章 3D 实物预览');
  });

  test('⑧ 日历 3D 形态：应为 scroll 挂轴而非 framedArt 相框（无四边框）', async ({ page }) => {
    await clearStorage(page.context());
    await openCraft(page);

    // 日历在办公类
    await page.locator('.craft-category-chip', { hasText: '办公类' }).click();
    await page.locator('.craft-product-card[data-name="日历"]').click();
    await openMockup(page);
    const chip3d = page.locator('.craft-mockup-chip-3d');
    await expect(chip3d).toBeEnabled();
    await chip3d.click();
    await expect(page.locator('#craft-3d-view canvas')).toHaveCount(1, { timeout: 30000 });

    // hint 显示产品名而非旧 form3d label
    await expect(page.locator('.craft-3d-hint')).toContainText('日历 3D 实物预览');

    // 几何结构验证：scroll builder 有上下两个 CylinderGeometry 卷杆（y≈0.08 和 y≈1.36）
    // framedArt builder 有四边框 CylinderGeometry + 一个大面板 BoxGeometry
    const geomInfo = await page.evaluate(() => {
      const st = window.__craft3dState;
      if (!st || !st.scene) return { err: 'no state' };
      const meshes = [];
      st.scene.traverse(obj => { if (obj.isMesh) meshes.push({ geom: obj.geometry.type, pos: [obj.position.x, obj.position.y, obj.position.z] }); });
      const cylinders = meshes.filter(m => m.geom === 'CylinderGeometry');
      // scroll 有 2 个 Cylinder（上下卷杆） + framedArt 有 4 个 Cylinder（四边框）
      // 另 scroll 的 PlaneGeometry 带 position.z 微卷曲，framedArt 的面板是 BoxGeometry
      const planes = meshes.filter(m => m.geom === 'PlaneGeometry');
      const boxes = meshes.filter(m => m.geom === 'BoxGeometry');
      return { cylinders: cylinders.length, planes: planes.length, boxes: boxes.length };
    });

    // scroll 预期：2 个 Cylinder（上下卷杆）+ 1 个 Plane（微卷曲挂面）+ 1 个 Box（地面阴影接收面）
    // framedArt 预期：4 个 Cylinder（四边框）+ 1 个 Box（画板）+ 1 个 Box（地面）+ 1 个 Plane（地面）
    // scroll 的 cylinders=2 明显少于 framedArt 的 cylinders=4
    expect(geomInfo.cylinders).toBe(2); // 挂轴上下卷杆
    expect(geomInfo.planes).toBeGreaterThanOrEqual(1); // 微卷曲挂面
  });

  test('⑨ cardStack 多材质：明信片背面 -z 方向为素色纸而非创意图案', async ({ page }) => {
    await clearStorage(page.context());
    await openCraft(page);

    await selectStationeryProduct(page, '明信片');
    await openMockup(page);
    await page.locator('.craft-mockup-chip-3d').click();
    await expect(page.locator('#craft-3d-view canvas')).toHaveCount(1, { timeout: 30000 });

    // 用多材质 BoxGeometry 验证：卡片堆每张卡的 6 个面材质数组
    const matInfo = await page.evaluate(() => {
      const st = window.__craft3dState;
      if (!st || !st.scene) return { err: 'no state' };
      // 找到 cardStack 内的卡片 mesh（非 base 的那几张）
      const cardMats = [];
      st.scene.traverse(obj => {
        if (obj.isMesh && Array.isArray(obj.material)) {
          // 多材质数组：[right,left,top,bottom,front,back]
          // front(index 4) 有 texture（创意图案），其他 5 个无 texture（素色纸）
          const hasTex = obj.material.map(m => !!(m && m.map && m.map.isTexture));
          cardMats.push({ geom: obj.geometry.type, hasTex });
        }
      });
      return cardMats;
    });

    // cardStack 的每张卡都是多材质数组，只有 front(index 4) 有创意图案
    expect(matInfo.length).toBeGreaterThanOrEqual(1);
    // 每张卡应恰好只有 1 个面带创意图案（front），其余 5 个面素色
    for (const card of matInfo) {
      expect(card.hasTex.filter(Boolean).length).toBe(1);
      expect(card.hasTex[4]).toBe(true); // front(+z) 贴创意图案
      expect(card.hasTex[5]).toBe(false); // back(-z) 素色纸（修复前这里也是创意图案）
    }
  });

  test('⑩ 扇子 standee 形态验证（薄平板+底座，而非 scroll 挂轴）', async ({ page }) => {
    await clearStorage(page.context());
    await openCraft(page);

    // 扇子在生活类
    await page.locator('.craft-category-chip', { hasText: '生活类' }).click();
    await page.locator('.craft-product-card[data-name="扇子"]').click();
    await openMockup(page);
    const chip3d = page.locator('.craft-mockup-chip-3d');
    await expect(chip3d).toBeEnabled();
    await chip3d.click();
    await expect(page.locator('#craft-3d-view canvas')).toHaveCount(1, { timeout: 30000 });

    // hint 显示产品名
    await expect(page.locator('.craft-3d-hint')).toContainText('扇子 3D 实物预览');

    // 几何结构验证：standee builder = BoxGeometry 平板 + BoxGeometry 底座
    // scroll builder = PlaneGeometry + CylinderGeometry 上下卷杆
    const geomInfo = await page.evaluate(() => {
      const st = window.__craft3dState;
      if (!st || !st.scene) return { err: 'no state' };
      const geoms = [];
      st.scene.traverse(obj => { if (obj.isMesh) geoms.push(obj.geometry.type); });
      const counts = {};
      geoms.forEach(g => counts[g] = (counts[g] || 0) + 1);
      return counts;
    });

    // standee 预期：2 个 BoxGeometry（平板 + 底座）+ 1 个 PlaneGeometry（地面阴影）
    // scroll 预期：1 个 PlaneGeometry + 2 个 CylinderGeometry（卷杆）+ 1 个 PlaneGeometry（地面）
    expect(geomInfo.BoxGeometry).toBe(2);  // 平板 + 底座
    expect(geomInfo.CylinderGeometry || 0).toBe(0); // 无挂轴卷杆
  });

  test('⑪ umbrella 圆台多材质验证（CylinderGeometry 3 材质数组）', async ({ page }) => {
    await clearStorage(page.context());
    await openCraft(page);

    await page.locator('.craft-category-chip', { hasText: '生活类' }).click();
    await page.locator('.craft-product-card[data-name="折叠伞"]').click();
    await openMockup(page);
    await page.locator('.craft-mockup-chip-3d').click();
    await expect(page.locator('#craft-3d-view canvas')).toHaveCount(1, { timeout: 30000 });

    // hint 显示产品名
    await expect(page.locator('.craft-3d-hint')).toContainText('折叠伞 3D 实物预览');

    // 多材质验证：umbrella canopy 是 CylinderGeometry + 3 材质数组 [side, top, bottom]
    // 其中 side 有创意图案（texture），top/bottom 素色无 texture
    const matInfo = await page.evaluate(() => {
      const st = window.__craft3dState;
      if (!st || !st.scene) return { err: 'no state' };
      const finds = [];
      st.scene.traverse(obj => {
        if (obj.isMesh && obj.geometry.type === 'CylinderGeometry' && Array.isArray(obj.material)) {
          const hasTex = obj.material.map(m => !!(m && m.map && m.map.isTexture));
          finds.push({ geom: obj.geometry.type, hasTex });
        }
      });
      return finds;
    });

    // 应有 1 个 CylinderGeometry 多材质 mesh（伞面）
    const canopy = matInfo.find(m => m.geom === 'CylinderGeometry' && m.hasTex.length === 3);
    expect(canopy).toBeTruthy();
    // 3 材质：[0]=side 有创意图案，[1]=top 素色无贴图，[2]=bottom 素色无贴图
    expect(canopy.hasTex[0]).toBe(true);  // side 侧面有图案
    expect(canopy.hasTex[1]).toBe(false); // top 顶面素色
    expect(canopy.hasTex[2]).toBe(false); // bottom 底面素色（避免拉伸奇点）
  });

  test('⑫ 玻璃杯 tumbler 无把手验证（直筒无 Torus handle）', async ({ page }) => {
    await clearStorage(page.context());
    await openCraft(page);

    await page.locator('.craft-category-chip', { hasText: '生活类' }).click();
    await page.locator('.craft-product-card[data-name="玻璃杯"]').click();
    await openMockup(page);
    const chip3d = page.locator('.craft-mockup-chip-3d');
    await expect(chip3d).toBeEnabled();
    await chip3d.click();
    await expect(page.locator('#craft-3d-view canvas')).toHaveCount(1, { timeout: 30000 });

    // 几何结构验证：tumbler = 2 个 CylinderGeometry（杯身 + 顶盖 + 顶帽）
    // mug = 2 个 CylinderGeometry + 1 个 TorusGeometry（把手）
    const geomInfo = await page.evaluate(() => {
      const st = window.__craft3dState;
      if (!st || !st.scene) return { err: 'no state' };
      const geoms = [];
      st.scene.traverse(obj => { if (obj.isMesh) geoms.push(obj.geometry.type); });
      const counts = {};
      geoms.forEach(g => counts[g] = (counts[g] || 0) + 1);
      return counts;
    });

    expect(geomInfo.CylinderGeometry || 0).toBeGreaterThanOrEqual(3); // 杯身 + 顶盖 + 顶帽
    expect(geomInfo.TorusGeometry || 0).toBe(0); // tumbler 无把手（修复前 mug 有 1 个 Torus）
  });
});
