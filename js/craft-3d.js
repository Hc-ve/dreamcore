// ============================================================
// js/craft-3d.js — 阶段C：3D 旋转实物预览（three.js 程序化建模）
// 职责：
//   1. three.js 懒加载（裸说明符 import('three')，与 particles.js 同源，
//      走 package exports → vendor-three chunk，防 HMR 双实例）
//   2. 22 种 form3d 形态程序化几何建模 + CanvasTexture 贴图
//      （贴图源 = #craft-preview-canvas 文创结果画布，生命周期长于本模块，
//       dispose 时必须显式释放纹理）
//   3. 浅色影棚查看器：浅米白渐变背景 + GridHelper 地面网格（可关）+
//      Ambient/Directional 双光源（柔光漫射，影棚质感）+ OrbitControls
//      damping + autoRotate（默认开）+ 滚轮缩放 + ResizeObserver 自适应
//   4. 资源管理：dispose() 全量释放（geometry/material/texture/renderer/
//      RAF/ResizeObserver），面板关闭或 chip 切走时由 ai-craft.js 调用
//   5. 导出：snapshot() 同一 tick render + toDataURL（不需
//      preserveDrawingBuffer）
// 依赖：three ^0.160（项目已有），无其他第三方库
// ============================================================

/** 22 种形态中文名（chip title / 导出文件名用） */
export const FORM3D_LABELS = {
  mug: '马克杯', tumbler: '保温杯', cushion: '抱枕', standee: '亚克力立牌',
  toteBag: '帆布袋', phoneCase: '手机壳', notebook: '笔记本', scroll: '挂轴',
  framedArt: '装饰画', fridgeMagnet: '冰箱贴', scarf: '丝巾织物', puzzle: '拼图',
  tshirt: 'T恤', badge: '徽章', keychain: '钥匙扣', nightLamp: '小夜灯',
  powerBank: '充电宝', umbrella: '雨伞', tapeRoll: '贴纸卷', mousePad: '鼠标垫',
  cardStack: '卡片堆', blindBox: '方盒'
};

/**
 * 22 形态独立 PBR 配置（metalness / roughness）
 * 方案依据：badge/fridgeMagnet 金属徽章感；cardStack/mousePad 纸/布质感；
 *         mug/tumbler 陶瓷/塑料；scarf 丝绸（sheen 独立在 builder 中用 MeshPhysicalMaterial）
 */
const FORM_PBR = {
  mug:          { roughness: .35, metalness: .02 },   // 陶瓷
  tumbler:      { roughness: .25, metalness: .15 },   // 金属保温杯
  cushion:      { roughness: .85, metalness: .02 },   // 棉麻抱枕
  standee:      { roughness: .45, metalness: .03 },   // 亚克力
  toteBag:      { roughness: .8,  metalness: .02 },   // 帆布
  phoneCase:    { roughness: .4,  metalness: .08 },   // 塑料/TPU
  notebook:       { roughness: .75, metalness: .02 },   // 纸本
  deskCalendar:   { roughness: .75, metalness: .02 },   // 台历（纸本质感 + 金属线圈单独处理）
  scroll:         { roughness: .7,  metalness: .02 },   // 挂轴纸
  framedArt:    { roughness: .5,  metalness: .03 },   // 装饰画
  fridgeMagnet: { roughness: .45, metalness: .75 },   // 金属磁力贴（亚光镍，不反光如镜）
  scarf:        { roughness: .55, metalness: .02 },   // 丝绸（builder 中用 MeshPhysicalMaterial sheen）
  puzzle:       { roughness: .65, metalness: .02 },   // 纸质拼图
  tshirt:       { roughness: .75, metalness: .02 },   // 棉T
  badge:        { roughness: .3,  metalness: .85 },   // 金属徽章
  keychain:     { roughness: .35, metalness: .6 },    // 金属钥匙扣
  nightLamp:    { roughness: .5,  metalness: .02 },   // 灯罩
  powerBank:    { roughness: .35, metalness: .1 },    // 充电宝外壳
  umbrella:     { roughness: .7,  metalness: .02 },   // 伞面
  tapeRoll:     { roughness: .6,  metalness: .02 },   // 贴纸
  mousePad:     { roughness: .85, metalness: .02 },   // 鼠标垫布
  cardStack:    { roughness: .85, metalness: .02 },   // 卡片纸
  blindBox:     { roughness: .55, metalness: .03 },   // 盲盒纸盒
  // 🎯 书签：市场头部 70% 是黄铜/白铜金属质感（即使 form3d=cardStack 纸品类，也用金属）
  // 产品 key 级别 → 覆盖 form3d 级别
  bookmark:     { roughness: .35, metalness: .85 },
  shuqian:      { roughness: .35, metalness: .85 }  // 产品 key 直接查也能命中
};

/** three + OrbitControls + RoomEnvironment + GLTFLoader + DRACOLoader 懒加载单例（Promise 缓存防重复 import） */
let _threePromise = null;
function _loadThree() {
  if (!_threePromise) {
    _threePromise = Promise.all([
      import('three'),
      import('three/addons/controls/OrbitControls.js'),
      import('three/addons/environments/RoomEnvironment.js'),
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/loaders/DRACOLoader.js')
    ]).then(([THREE, OrbitMod, RoomMod, GLTFMod, DracoMod]) => ({
      THREE,
      OrbitControls: OrbitMod.OrbitControls,
      RoomEnvironment: RoomMod.RoomEnvironment,
      GLTFLoader: GLTFMod.GLTFLoader,
      DRACOLoader: DracoMod.DRACOLoader
    }));
  }
  return _threePromise;
}

// ------------------------------------------------------------
// v11 新增：自定义 3D 模型支持（运营后台品类模型替换）
// ------------------------------------------------------------

/** 自定义模型内存 cache（productKey → { file, format, triCount, meta }） */
let _customModelCache = null;

/**
 * 从 IndexedDB 加载全部自定义模型到内存 cache（应用 initDB 后调用一次）
 * 返回 Map：productKey → { file(ArrayBuffer), format, triCount, meta }
 */
export async function loadCustomModelsCache() {
  if (typeof window === 'undefined' || !window.getAllCustom3dModels) {
    _customModelCache = new Map();
    return _customModelCache;
  }
  try {
    const list = await window.getAllCustom3dModels();
    const m = new Map();
    for (const rec of list) {
      if (rec.productKey && rec.file instanceof ArrayBuffer) {
        m.set(rec.productKey, {
          file: rec.file,
          format: rec.format || 'glb',
          triCount: Number(rec.triCount) || 0,
          meta: { id: rec.id, name: rec.name, previewImage: rec.previewImage, createdAt: rec.createdAt }
        });
      }
    }
    _customModelCache = m;
  } catch (err) {
    console.warn('[craft-3d] 加载自定义 3D 模型 cache 失败：', err);
    _customModelCache = new Map();
  }
  return _customModelCache;
}

/** 查询某品类是否有自定义模型（同步读 cache） */
export function getCachedCustomModel(productKey) {
  if (!_customModelCache) return null;
  return _customModelCache.get(String(productKey)) || null;
}

/** 清除 cache（运营后台删除/替换模型后调用） */
export function clearCustomModelCache() {
  _customModelCache = null;
}

/** 统计 group 内三角面数（校验 + 管理后台显示用） */
export function countTriangles(group) {
  let n = 0;
  group.traverse(obj => {
    if (obj.isMesh && obj.geometry && obj.geometry.index) {
      n += obj.geometry.index.count / 3;
    } else if (obj.isMesh && obj.geometry && obj.geometry.attributes && obj.geometry.attributes.position) {
      n += obj.geometry.attributes.position.count / 3;
    }
  });
  return Math.floor(n);
}

/** 查找 gltf group 内最适合注入 CanvasTexture 的材质
 *  —— 优先选"顶点数最多的 Mesh 上的 MeshStandardMaterial"，避免误选挂环/链条等小配件材质
 *  —— 必须有 map（原始 albedo 纹理存在 = 该面有正确的 UV 映射）
 */
function _findInjectableMaterial(root) {
  let bestMat = null;
  let bestVertCount = 0;
  root.traverse(obj => {
    if (!obj.isMesh || !obj.material) return;
    const verts = obj.geometry?.attributes?.position?.count || 0;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of mats) {
      if (!m || !(m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) continue;
      if (!m.map) continue; // 必须有原始 albedo = 有正确 UV
      // 选顶点数最多的 mesh 用的材质（主体 > 挂环/链条）
      if (verts > bestVertCount) {
        bestVertCount = verts;
        bestMat = m;
      }
    }
  });
  return bestMat;
}

/** 对材质材质克隆并注入 CanvasTexture（清 PBR 辅助贴图，只留创意图案）
 *  @param pbrOpts { roughness, metalness } 可选；不传则 fallback 到通用 0.55/0.06
 */
function _cloneAndInject(mat, THREE, canvasTexture, pbrOpts) {
  if (!mat) return mat;
  if (!(mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial)) return mat;
  const newMat = mat.clone();
  newMat.map = canvasTexture;
  newMat.normalMap = null;
  newMat.roughnessMap = null;
  newMat.metalnessMap = null;
  newMat.emissiveMap = null;
  newMat.aoMap = null;
  // 🎯 品类独立 PBR：FORM_PBR 字典查表，书签/钥匙扣金属感；帆布袋纸感
  // 不传 pbrOpts → fallback 通用 0.55/0.06
  const rough = pbrOpts?.roughness ?? 0.55;
  const metal = pbrOpts?.metalness ?? 0.06;
  newMat.roughness = rough;
  newMat.metalness = metal;
  newMat.envMapIntensity = 0.4;
  newMat.wireframe = false;
  newMat.flatShading = false;
  if (newMat.isMeshPhysicalMaterial) {
    // MeshPhysicalMaterial 额外清理 clearcoat/sheen 等高级参数，避免干扰纹理显示
    if ('clearcoat' in newMat) newMat.clearcoat = 0;
    if ('clearcoatRoughness' in newMat) newMat.clearcoatRoughness = 0.4;
    if ('sheen' in newMat) newMat.sheen = 0;
  }
  if (newMat.map) {
    // BFF 已给所有 mesh 重映射 UV 到 [0,1] 区间，不再有 UV 在 [0,1] 外的问题
    // sentinel UV (0.9999, 0.9999) 需要 ClampToEdge 命中 canvas 右上角米白像素（零面积面素色）
    // RepeatWrapping 会把 0.9999 wrap 到 0.0 → 命中 canvas 左上角设计图 → 杯口/杯底显示图案
    newMat.map.wrapS = THREE.ClampToEdgeWrapping;
    newMat.map.wrapT = THREE.ClampToEdgeWrapping;
    newMat.map.colorSpace = THREE.SRGBColorSpace;
  }
  newMat.side = THREE.DoubleSide;
  newMat.needsUpdate = true;
  return newMat;
}

/** 将 CanvasTexture 注入 gltf model 所有 MeshStandardMaterial（全材质覆盖）
 *  —— 混元书签是多材质数组（mesh#0 有 31 groups + 31 个材质对象）
 *     必须对所有可注入材质都贴创意图案，才能消除"部分面原始材质、部分面创意图案"的错位
 *  —— 挂环/链条/小配件跳过：保留独立金属材质（黄铜金色），避免被 canvas 纹理染绿
 */
function _injectCanvasTextureToModel(root, THREE, canvasTexture, opts = {}) {
  const PAPER_COLOR = 0xfaf7f2;  // 米白 —— 和 BFF 注入的 paperMat 同色
  const PAPER_ROUGH = 0.85;

  const isMetalRing = (mesh) => {
    // 启发式识别挂环/链条/小配件：名称关键词 + 尺寸（normalize 后总长 ≈ 1，小配件 < 0.08）
    const name = (mesh.name || '').toLowerCase();
    const nameHit = /ring|loop|chain|hole|jump|hook|clasp|connector|link|bead|ball|tassel|流苏|挂环|挂链/i.test(name);
    let smallBySize = false;
    try {
      mesh.geometry.computeBoundingSphere();
      const r = mesh.geometry.boundingSphere?.radius || 0;
      // normalize 后主 mesh 半径 ≈ 0.5~0.65，挂环一般 < 0.08
      smallBySize = r > 0 && r < 0.08;
    } catch (_) {}
    return nameHit || smallBySize;
  };

  // 判断 mesh 的一个 group（或整个 mesh 如果没 groups）是否"全 sentinel UV"
  // sentinel UV = 全部顶点 UV ≈ (0.9999, 0.9999) 或全 (0,0)（旧策略残留）
  const _isSentinelUVRange = (uvAttr, start, count) => {
    if (!uvAttr || uvAttr.count === 0) return false;
    let sentCount = 0;
    for (let i = start; i < start + count; i++) {
      const u = uvAttr.getX(i), v = uvAttr.getY(i);
      // ⚠️ 只认 (0.9999, 0.9999) 标记 —— BFF cylindrical 专属 sentinel
      // (0,0) 是 toteBag 等 planar 策略的正常 layout，不算 sentinel！
      if (u >= 0.9998 && v >= 0.9998) sentCount++;
    }
    return sentCount / count >= 0.95;
  };

  const GOLD_COLOR = 0xd4af37; // 黄铜金色 —— 市场头部金属书签主流
  let injectedCount = 0;
  let ringCount = 0;
  let paperCount = 0;
  root.traverse(obj => {
    if (!obj.isMesh || !obj.material) return;

    // 🎯 挂环/链条跳过注入 —— 给独立金属材质
    if (isMetalRing(obj)) {
      obj.material = new THREE.MeshStandardMaterial({
        color: GOLD_COLOR,
        roughness: 0.35,
        metalness: 0.9,
        envMapIntensity: 0.6,
        side: THREE.DoubleSide,
      });
      ringCount++;
      return;
    }

    const geom = obj.geometry;
    const uvAttr = geom.attributes?.uv;

    // ===== 关键修复：按 UV 内容分材质 =====
    // 如果 mesh 有 groups（如 CylinderGeometry 的侧面/顶面/底面），按 group 判断
    // 如果没有 groups，判断整个 mesh 的 UV 是否全 sentinel
    const groups = geom.groups && geom.groups.length > 0 ? geom.groups : null;

    if (groups && uvAttr) {
      // 有 groups → 按 group 逐个处理
      const newMats = groups.map((g, idx) => {
        const isPaper = _isSentinelUVRange(uvAttr, g.start, g.count);
        if (isPaper) {
          paperCount++;
          return new THREE.MeshStandardMaterial({
            color: PAPER_COLOR, roughness: PAPER_ROUGH, metalness: 0.02, side: THREE.DoubleSide
          });
        }
        // 非 sentinel group → 注入 CanvasTexture
        const origMat = Array.isArray(obj.material) ? (obj.material[idx] || obj.material[0]) : obj.material;
        const nm = _cloneAndInject(origMat, THREE, canvasTexture, opts.pbr);
        injectedCount++;
        return nm;
      });
      obj.material = newMats;
    } else if (uvAttr && _isSentinelUVRange(uvAttr, 0, uvAttr.count)) {
      // 整个 mesh 全 sentinel → 直接给 paperMat
      paperCount++;
      obj.material = new THREE.MeshStandardMaterial({
        color: PAPER_COLOR, roughness: PAPER_ROUGH, metalness: 0.02, side: THREE.DoubleSide
      });
    } else if (Array.isArray(obj.material)) {
      // Material 数组但没 groups → 每个材质都注入
      const newMats = obj.material.map(m => {
        const nm = _cloneAndInject(m, THREE, canvasTexture, opts.pbr);
        if (nm !== m) injectedCount++;
        return nm;
      });
      obj.material = newMats;
    } else {
      // 普通单一材质 → 注入
      const nm = _cloneAndInject(obj.material, THREE, canvasTexture, opts.pbr);
      if (nm !== obj.material) injectedCount++;
      obj.material = nm;
    }
  });
  if (ringCount > 0) console.log(`[Craft3D] 挂环保护: ${ringCount} 个小 mesh 已跳过 canvas 注入（金属质感）`);
  if (paperCount > 0) console.log(`[Craft3D] Sentinel UV 保护: ${paperCount} 个材质面已跳过 canvas 注入（米白纸质感）`);
  return injectedCount > 0 || paperCount > 0;
}

// ------------------------------------------------------------
// 内部工具
// ------------------------------------------------------------

/** 幂等注入查看器样式（暗色容器 + 工具条，玻璃质感与梦核主题一致） */
function _injectStyle() {
  if (document.getElementById('craft-3d-style')) return;
  const style = document.createElement('style');
  style.id = 'craft-3d-style';
  style.textContent = `
    .craft-3d-view { position: relative; width: 100%; height: 100%; min-height: 220px; border-radius: var(--radius-sm, 10px); overflow: hidden;
      background: linear-gradient(180deg, #f5f2ec 0%, #e8e2d8 55%, #d4cdc2 100%); }
    .craft-3d-view[hidden] { display: none !important; }
    .craft-3d-view canvas { display: block; width: 100% !important; height: 100% !important; outline: none; background: #f5f2ec; }
    .craft-3d-view[hidden] canvas, .craft-3d-view[hidden] { pointer-events: none !important; }
    .craft-3d-toolbar { position: absolute; top: 10px; right: 10px; z-index: 5; display: flex; gap: 6px; }
    .craft-3d-tool { padding: 5px 11px; border-radius: 999px; border: 1px solid rgba(0,0,0,.12); background: rgba(255,255,255,.78);
      color: #4a4a4a; font-size: 12px; font-family: inherit; cursor: pointer; backdrop-filter: blur(8px); transition: all .2s; }
    .craft-3d-tool:hover { border-color: #6b5b95; color: #2b2540; }
    .craft-3d-tool.on { border-color: #6b5b95; color: #6b5b95; background: rgba(107,91,149,.12); }
    .craft-3d-hint { position: absolute; left: 12px; bottom: 10px; z-index: 5; margin: 0; font-size: 12px;
      color: rgba(74,74,74,.55); pointer-events: none; user-select: none; }
  `;
  document.head.appendChild(style);
}

/**
 * 在 canvas 物理右上角画 paper 色像素块 —— sentinel UV (0.9999, 0.9999)
 * 通过 CanvasTexture 默认 flipY=true 映射到 V≈0 → 物理顶部；U≈1 → 物理右边
 * 用 8x8 比 4x4 更抗插值，ClampToEdgeWrapping 时更稳
 * 必须在每次设计图画完后都调一次（drawImage 会覆盖 paper 像素）
 */
function _paintSentinelCorner(canvas) {
  try {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#faf7f2';  // paperMat 米白
    ctx.fillRect(Math.max(0, W - 8), 0, 8, 8);
  } catch (e) { /* canvas 可能没 ctx */ }
}

/**
 * 由结果画布生成贴图材质（CanvasTexture，SRGB 色彩空间）
 * 默认 PBR：roughness .55 / metalness .06；各 form3d builder 可通过 opts 覆盖
 * 统一 anisotropy = 8（提升斜视角清晰度）
 */
function _makeMaterial(THREE, canvas, opts = {}) {
  _paintSentinelCorner(canvas);

  const tex = new THREE.CanvasTexture(canvas);
  if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const baseRough = typeof opts.roughness === 'number' ? opts.roughness : .55;
  const baseMetal = typeof opts.metalness === 'number' ? opts.metalness : .06;
  const matOpts = Object.assign({
    map: tex, roughness: baseRough, metalness: baseMetal, side: THREE.DoubleSide
  }, opts);
  delete matOpts.roughness; delete matOpts.metalness; // 已映射到默认值或 THREE 字段
  return {
    texture: tex,
    material: new THREE.MeshStandardMaterial(matOpts)
  };
}

/**
 * 专用：MeshPhysicalMaterial（sheen 丝绸光泽等特殊效果）
 */
function _makePhysical(THREE, canvas, opts = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if ('colorSpace' in tex && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return new THREE.MeshPhysicalMaterial(Object.assign({
    map: tex, roughness: .55, metalness: .02, side: THREE.DoubleSide,
    sheen: .6, sheenColor: new THREE.Color(0xffffff), sheenRoughness: .35
  }, opts));
}

/** 素色材质（把手/边框/底座等结构件） */
function _plainMaterial(THREE, color = 0xe9e4f0, roughness = .6) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: .05 });
}

// ------------------------------------------------------------
// 22 形态程序化建模（每个 builder 返回 THREE.Group，底部落在 y=0 地面）
// 参数：T = THREE 命名空间，art = { material, texture } 主贴图材质
// ------------------------------------------------------------

const FORM_BUILDERS = {

  /** 马克杯：圆柱杯身 + Torus 把手
   *  body 用 Material 数组 —— 侧面贴设计图，顶面/底面素白 paperMat
   *  CylinderGeometry groups: [侧面, 顶面, 底面] → materialIndex [0, 1, 2]
   */
  mug(T, art) {
    const g = new T.Group();
    const paperMat = _plainMaterial(T, 0xfaf7f2, .85);
    const body = new T.Mesh(
      new T.CylinderGeometry(.42, .38, .72, 48, 1, false),
      [art.material, paperMat, paperMat]   // 侧面=设计图, 顶面=素白, 底面=素白
    );
    body.position.y = .36; g.add(body);
    const rim = new T.Mesh(new T.CylinderGeometry(.43, .43, .04, 48), _plainMaterial(T, 0xf3eef7));
    rim.position.y = .72; g.add(rim);
    const handle = new T.Mesh(new T.TorusGeometry(.19, .05, 16, 40), _plainMaterial(T, 0xd8d2e2));
    handle.position.set(.44, .38, 0); handle.rotation.y = Math.PI / 2; g.add(handle);
    return g;
  },

  /** 保温杯：高圆柱 + 顶盖 */
  tumbler(T, art) {
    const g = new T.Group();
    const paperMat = _plainMaterial(T, 0xfaf7f2, .85);
    const body = new T.Mesh(
      new T.CylinderGeometry(.34, .32, 1.05, 48),
      [art.material, paperMat, paperMat]   // 侧面=设计图, 顶面=素白, 底面=素白
    );
    body.position.y = .525; g.add(body);
    const lid = new T.Mesh(new T.CylinderGeometry(.37, .37, .1, 48), _plainMaterial(T, 0x4a4460));
    lid.position.y = 1.1; g.add(lid);
    const cap = new T.Mesh(new T.CylinderGeometry(.14, .14, .07, 32), _plainMaterial(T, 0x6b6580));
    cap.position.y = 1.18; g.add(cap);
    return g;
  },

  /** 抱枕：圆角 Box（厚垫） */
  cushion(T, art) {
    const g = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(1.06, .36, 1.06, 4, 2, 4), art.material);
    body.position.y = .18; body.rotation.y = .12; g.add(body);
    const seam = new T.Mesh(new T.BoxGeometry(1.1, .028, 1.1), _plainMaterial(T, 0xcfc6dd, .8));
    seam.position.y = .18; seam.rotation.y = .12; g.add(seam);
    return g;
  },

  /** 亚克力立牌：薄片 + 底座 */
  standee(T, art) {
    const g = new T.Group();
    const base = new T.Mesh(new T.BoxGeometry(.52, .07, .32), _plainMaterial(T, 0xf3eef7));
    base.position.y = .035; g.add(base);
    const plate = new T.Mesh(new T.BoxGeometry(.72, .92, .045), art.material);
    plate.position.set(0, .53, 0); g.add(plate);
    return g;
  },

  /** 帆布袋：Box 袋身 + 双 Torus 提带 */
  toteBag(T, art) {
    const g = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(.86, .82, .3), art.material);
    body.position.y = .41; g.add(body);
    [-.22, .22].forEach(x => {
      const handle = new T.Mesh(new T.TorusGeometry(.17, .028, 12, 32, Math.PI), _plainMaterial(T, 0xd8d2e2));
      handle.position.set(x, .82, 0); g.add(handle);
    });
    return g;
  },

  /** 手机壳：薄壳 + 摄像头凸台 */
  phoneCase(T, art) {
    const g = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(.54, 1.06, .07), art.material);
    body.position.y = .53; g.add(body);
    const cam = new T.Mesh(new T.CylinderGeometry(.07, .07, .04, 24), _plainMaterial(T, 0x3a3550));
    cam.rotation.x = Math.PI / 2; cam.position.set(-.15, .95, .05); g.add(cam);
    return g;
  },

  /** 笔记本：Box + 封面贴图 + 书脊 */
  notebook(T, art) {
    const g = new T.Group();
    const cover = new T.Mesh(new T.BoxGeometry(.84, 1.04, .07), art.material);
    cover.position.y = .52; cover.rotation.x = -0.28; g.add(cover);
    const pages = new T.Mesh(new T.BoxGeometry(.8, 1.0, .22), _plainMaterial(T, 0xf7f4fa, .85));
    pages.position.set(0, .44, -.13); pages.rotation.x = -0.28; g.add(pages);
    const spine = new T.Mesh(new T.CylinderGeometry(.05, .05, 1.04, 24), _plainMaterial(T, 0x8b7fb0));
    spine.rotation.z = Math.PI / 2; spine.position.set(0, .5, -.04); spine.rotation.x = -0.28; g.add(spine);
    return g;
  },

  /** 台历：立式薄板 + 顶部金属双线圈装订，微后仰（A 形支架站立感） */
  deskCalendar(T, art) {
    const g = new T.Group();
    // 主体：薄板（主面 +Y 贴 art.material）
    const body = new T.Mesh(new T.BoxGeometry(.78, 1.02, .10), art.material);
    body.position.set(0, .51, 0); body.rotation.x = -0.10; g.add(body);
    // 背面支撑纸板（稍窄，贴后面，素色）
    const backMat = _plainMaterial(T, 0xf2eee7, .88);
    const back = new T.Mesh(new T.BoxGeometry(.76, .98, .012), backMat);
    back.position.set(0, .48, -.056); back.rotation.x = -0.10; g.add(back);
    // 顶部金属双线圈（Torus × 2，金色 metalness）
    const coilMat = new T.MeshStandardMaterial({ color: 0xd4af37, roughness: .35, metalness: 1.0 });
    [-.14, .14].forEach(x => {
      const coil = new T.Mesh(new T.TorusGeometry(.045, .014, 10, 28), coilMat);
      coil.rotation.y = Math.PI / 2;
      coil.position.set(x, 1.04, -.005);
      g.add(coil);
    });
    // 底部小卡槽 / 防滑垫（4 个角点）
    const footMat = _plainMaterial(T, 0xa89a8a, .7);
    [[-.32, -.04], [.32, -.04], [-.32, .04], [.32, .04]].forEach(([x, z]) => {
      const f = new T.Mesh(new T.BoxGeometry(.06, .015, .06), footMat);
      f.position.set(x, .008, z);
      g.add(f);
    });
    return g;
  },

  /** 挂轴：微卷曲 Plane + 上下卷杆 */
  scroll(T, art) {
    const g = new T.Group();
    const plane = new T.Mesh(new T.PlaneGeometry(.92, 1.24, 1, 24), art.material);
    const pos = plane.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      pos.setZ(i, Math.sin((y / 1.24 + .5) * Math.PI) * .09);
    }
    pos.needsUpdate = true; plane.geometry.computeVertexNormals();
    plane.position.y = .72; g.add(plane);
    [.08, 1.36].forEach(y => {
      const rod = new T.Mesh(new T.CylinderGeometry(.035, .035, 1.04, 20), _plainMaterial(T, 0x6b5b45));
      rod.rotation.z = Math.PI / 2; rod.position.y = y; g.add(rod);
    });
    return g;
  },

  /** 装饰画：薄板 + 四边框，微后仰 */
  framedArt(T, art) {
    const g = new T.Group();
    const board = new T.Mesh(new T.BoxGeometry(.98, .74, .05), art.material);
    board.position.y = .44; board.rotation.x = -0.08; g.add(board);
    const fm = _plainMaterial(T, 0x4a3b2f, .45);
    const bar = (w, h, x, y) => {
      const m = new T.Mesh(new T.BoxGeometry(w, h, .08), fm);
      m.position.set(x, y, .005); m.rotation.x = -0.08; g.add(m);
    };
    bar(1.08, .07, 0, .83); bar(1.08, .07, 0, .05);
    bar(.07, .78, -.535, .44); bar(.07, .78, .535, .44);
    return g;
  },

  /** 冰箱贴：薄圆柱 */
  fridgeMagnet(T, art) {
    const g = new T.Group();
    const disc = new T.Mesh(new T.CylinderGeometry(.42, .42, .06, 48), art.material);
    disc.position.y = .03; g.add(disc);
    // 磁铁：移到背面偏移 z=-.05（与盘面分离，旋转时可见）
    const magMat = new T.MeshStandardMaterial({ color: 0x2a2a2a, roughness: .4, metalness: .3 });
    const mag = new T.Mesh(new T.BoxGeometry(.3, .02, .18), magMat);
    mag.position.set(0, .03, -.05); g.add(mag);
    return g;
  },

  /** 丝巾织物：MeshPhysicalMaterial sheen 丝绸光泽 + 斜挂垂坠造型 + 流苏 */
  scarf(T, art, textureCanvas) {
    const g = new T.Group();
    // MeshPhysicalMaterial：丝绸光泽
    const silkMat = _makePhysical(T, textureCanvas, { roughness: .5, metalness: .0, sheen: .7, sheenRoughness: .3 });
    // 垂坠 Plane：顶边固定 + 低频噪声褶皱 + 边缘卷曲
    const plane = new T.Mesh(new T.PlaneGeometry(1.34, 1.34, 28, 28), silkMat);
    const pos = plane.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      // 顶边（y=+0.67）固定不动；越往下垂坠越多
      const droop = (0.67 - y) / 1.34;
      const z = Math.sin(x * 3.1 + y * 2.4) * .06 * droop  // 低频噪声褶皱
              - droop * droop * .12                        // 整体下垂弧线
              + Math.sin(x * 6.3) * .03 * droop;           // 边缘卷曲
      pos.setZ(i, z);
      // 边缘 Y 方向小幅扰动（模拟流苏轻微飘动）
      if (Math.abs(x) > .55) pos.setY(i, y + Math.sin(y * 4.8 + x * 3) * .015 * droop);
    }
    pos.needsUpdate = true; plane.geometry.computeVertexNormals();
    plane.rotation.x = -Math.PI / 2.15; plane.rotation.z = .32;
    plane.position.y = .42; plane.position.z = -.08;
    g.add(plane);
    // 流苏：底沿两条束带（Cylinder 模拟丝穗）
    const fringeMat = new T.MeshStandardMaterial({ color: 0x8a7d6e, roughness: .85 });
    for (let side = 0; side < 2; side++) {
      const fringe = new T.Mesh(new T.CylinderGeometry(.008, .01, .22, 6, 1, false), fringeMat);
      fringe.position.set(side === 0 ? -.6 : .6, .28, -.08 + Math.sin(side) * .04);
      fringe.rotation.z = side === 0 ? .25 : -.25;
      g.add(fringe);
    }
    return g;
  },

  /** 拼图：薄 Box + 表面网格切线 */
  puzzle(T, art) {
    const g = new T.Group();
    const board = new T.Mesh(new T.BoxGeometry(1.02, .72, .05), art.material);
    board.position.y = .045; g.add(board);
    const lm = _plainMaterial(T, 0x2e2a3c, .8);
    const line = (w, d, x) => {
      const m = new T.Mesh(new T.BoxGeometry(w, .012, d), lm);
      m.position.set(x, .078, 0); g.add(m);
    };
    line(.014, .73, -.17); line(.014, .73, .17); line(.014, .73, 0);
    const hz = new T.Mesh(new T.BoxGeometry(1.03, .012, .014), lm);
    hz.position.set(0, .078, 0); g.add(hz);
    return g;
  },

  /** T恤：躯干 Box + 双袖 Box */
  tshirt(T, art) {
    const g = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(.94, .92, .13), art.material);
    body.position.y = .5; g.add(body);
    [-.63, .63].forEach(x => {
      const sleeve = new T.Mesh(new T.BoxGeometry(.36, .18, .15), art.material);
      sleeve.position.set(x, .82, 0); g.add(sleeve);
    });
    const neck = new T.Mesh(new T.TorusGeometry(.12, .035, 12, 28, Math.PI), _plainMaterial(T, 0xd8d2e2));
    neck.position.y = .97; neck.rotation.z = Math.PI; g.add(neck);
    return g;
  },

  /** 徽章：金属圆盘 + 背面可见别针（从盘体偏移，旋转时可见真实结构） */
  badge(T, art) {
    const g = new T.Group();
    const disc = new T.Mesh(new T.CylinderGeometry(.32, .32, .05, 48), art.material);
    disc.position.y = .025; g.add(disc);
    // 别针：移到背面偏移 z=-.04（与盘体分离，旋转时可见）
    const pinMat = new T.MeshStandardMaterial({ color: 0xc0b8d0, roughness: .35, metalness: .7 });
    const pin = new T.Mesh(new T.BoxGeometry(.34, .02, .02), pinMat);
    pin.position.set(0, .025, -.04); pin.rotation.y = .6; g.add(pin);
    // 别针底座（小圆片）
    const pinBase = new T.Mesh(new T.CylinderGeometry(.04, .04, .015, 20), pinMat);
    pinBase.position.set(0, .025, -.045); g.add(pinBase);
    return g;
  },

  /** 钥匙扣：小圆柱 + 连接环 */
  keychain(T, art) {
    const g = new T.Group();
    const disc = new T.Mesh(new T.CylinderGeometry(.27, .27, .06, 40), art.material);
    disc.position.y = .03; g.add(disc);
    const link = new T.Mesh(new T.TorusGeometry(.05, .018, 10, 24), _plainMaterial(T, 0xb8b2c8, .3));
    link.position.y = .1; g.add(link);
    const ring = new T.Mesh(new T.TorusGeometry(.13, .022, 10, 36), _plainMaterial(T, 0xb8b2c8, .3));
    ring.position.y = .24; g.add(ring);
    return g;
  },

  /** 小夜灯：发光球 + 底座 */
  nightLamp(T, art) {
    const g = new T.Group();
    const sphere = new T.Mesh(new T.SphereGeometry(.5, 40, 32),
      new T.MeshStandardMaterial({ map: art.texture, roughness: .4, metalness: 0, side: T.DoubleSide,
        emissive: 0x776655, emissiveIntensity: .35 }));
    sphere.position.y = .58; g.add(sphere);
    const base = new T.Mesh(new T.CylinderGeometry(.17, .2, .09, 32), _plainMaterial(T, 0x4a4460));
    base.position.y = .045; g.add(base);
    return g;
  },

  /** 充电宝盒：厚板 Box */
  powerBank(T, art) {
    const g = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(.74, 1.32, .3), art.material);
    body.position.y = .66; g.add(body);
    const port = new T.Mesh(new T.BoxGeometry(.3, .06, .02), _plainMaterial(T, 0x2e2a3c, .3));
    port.position.set(0, .12, .16); g.add(port);
    return g;
  },

  /** 折叠伞：圆台伞面（CylinderGeometry，顶大底小，扁平不尖锐）+ 伞杆 + 伞柄
   *  多材质分离：侧面（创意图案 DoubleSide）/ 顶面+底面（素色纸，避免底面拉伸奇点）
   */
  umbrella(T, art) {
    const g = new T.Group();
    const paperMat = _plainMaterial(T, 0xfaf7f2, .85); // 素色纸（顶面/底面）
    // 侧面：基于 art 材质克隆，保持创意图案贴图 + DoubleSide
    const sideMat = art.material.clone();
    sideMat.side = T.DoubleSide;
    sideMat.map = art.texture;
    // CylinderGeometry(radiusTop, radiusBottom, height, thetaSegments, heightSegments, openTop, openBottom)
    // 圆台：顶大(0.9)底小(0.15)，扁平高度(0.35) → 更像折叠伞展开形态
    // 多材质数组：[side(侧面), top(顶面), bottom(底面)]
    const canopy = new T.Mesh(
      new T.CylinderGeometry(.9, .15, .35, 40, 1, false, false),
      [sideMat, paperMat, paperMat]
    );
    canopy.position.y = 1.35; g.add(canopy);
    const shaft = new T.Mesh(new T.CylinderGeometry(.028, .028, 1.18, 16), _plainMaterial(T, 0x8b7fb0, .3));
    shaft.position.y = .56; g.add(shaft);
    const handle = new T.Mesh(new T.TorusGeometry(.07, .02, 10, 24, Math.PI * 1.4), _plainMaterial(T, 0x4a3b2f));
    handle.position.set(0, .03, .05); g.add(handle);
    return g;
  },

  /** 贴纸卷：圆柱卷体 + 白色卷芯 */
  tapeRoll(T, art) {
    const g = new T.Group();
    const roll = new T.Mesh(new T.CylinderGeometry(.42, .42, .36, 48), art.material);
    roll.position.y = .18; g.add(roll);
    const core = new T.Mesh(new T.CylinderGeometry(.17, .17, .38, 32), _plainMaterial(T, 0xf7f4fa, .85));
    core.position.y = .18; g.add(core);
    return g;
  },

  /** 垫子：薄 Box 平铺 */
  mousePad(T, art) {
    const g = new T.Group();
    const pad = new T.Mesh(new T.BoxGeometry(1.32, .9, .035), art.material);
    pad.position.y = .018; g.add(pad);
    return g;
  },

  /** 卡片堆：每层正面（+z）贴创意图案，其余五面素色纸（符合物理实物） */
  cardStack(T, art) {
    const g = new T.Group();
    const paperMat = _plainMaterial(T, 0xfaf7f2, .85); // 素色纸（背面/侧面/底面/顶面/右面/左面）
    const base = new T.Mesh(new T.BoxGeometry(1.04, .7, .016), paperMat);
    base.position.y = .008; base.rotation.y = .08; g.add(base);
    for (let i = 0; i < 4; i++) {
      // 多材质数组：[right, left, top, bottom, front, back]
      // 仅 front(+z) 用创意图案，其余五面素色纸
      const cardMats = [paperMat, paperMat, paperMat, paperMat, art.material, paperMat];
      const card = new T.Mesh(new T.BoxGeometry(1.0, .68, .012), cardMats);
      card.position.set(i * .035, .024 + i * .015, i * .028);
      card.rotation.y = .12 - i * .07; g.add(card);
    }
    return g;
  },

  /** 方盒（盲盒/收纳盒）：盒身 + 盒盖 */
  blindBox(T, art) {
    const g = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(.8, .78, .8), art.material);
    body.position.y = .39; g.add(body);
    const lid = new T.Mesh(new T.BoxGeometry(.86, .12, .86), _plainMaterial(T, 0xcfc6dd));
    lid.position.y = .84; g.add(lid);
    return g;
  }
};

/** 形态是否受支持 */
export function isForm3dSupported(form3d) {
  return !!(form3d && FORM_BUILDERS[form3d]);
}

/** 当前查看器状态（单例：同一时刻只渲染一个 3D 场景） */
let st = null;

/** 渲染序号（并发 render 去重：后发者胜，先发者在 await 后自行退出） */
let _renderSeq = 0;

/** 查看器是否处于活动状态 */
export function isActive() {
  return !!(st && st.renderer);
}

// ------------------------------------------------------------
// 渲染 / 刷新 / 快照 / 释放
// ------------------------------------------------------------

/**
 * 渲染 3D 实物预览（重复调用自动先 dispose 旧场景）
 * @param {HTMLElement} container   容器（.craft-3d-view，需已可见）
 * @param {string} form3d           形态 key（craft-products.js form3d 字段）
 * @param {HTMLCanvasElement} textureCanvas  贴图源（文创结果画布）
 * @returns {Promise<void>}
 */
export async function render(container, form3d, textureCanvas, productName, productKey) {
  if (!container || !textureCanvas) throw new Error('missing container or texture canvas');
  if (!isForm3dSupported(form3d)) throw new Error('unsupported form3d: ' + form3d);
  dispose();
  const seq = ++_renderSeq;
  const { THREE, OrbitControls, RoomEnvironment } = await _loadThree();
  if (seq !== _renderSeq || !container.isConnected) return; // 等待期间已被重渲染或面板已关闭

  _injectStyle();

  // 查表 PBR：各形态独立 rough/metal（三重查表，和 renderCustom 一致）
  let pbr = null;
  if (productKey) pbr = FORM_PBR[productKey];       // 1) 产品 key 优先（如 shuqian→金属）
  if (!pbr && form3d) pbr = FORM_PBR[form3d];        // 2) form3d 次选（如 cardStack→纸感）
  pbr = pbr || { roughness: .55, metalness: .06 };    // 3) fallback
  console.warn('[Craft3D] render() PBR lookup:', productKey || '(无 productKey)', '->', JSON.stringify(pbr));
  const art = _makeMaterial(THREE, textureCanvas, pbr);
  const group = FORM_BUILDERS[form3d](THREE, art, textureCanvas);

  const scene = new THREE.Scene();
  scene.add(group);

  // 地面网格（默认开）+ 方位轴
  const grid = new THREE.GridHelper(4, 20, 0xb8b0a5, 0xd4cdc2);
  grid.material.transparent = true; grid.material.opacity = .45;
  scene.add(grid);
  const axes = new THREE.AxesHelper(.6);
  axes.visible = false; // 默认收起，工具条可开
  scene.add(axes);

  // 地面阴影接收面（影棚底衬）
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.ShadowMaterial({ opacity: .18 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -.01;
  ground.receiveShadow = true;
  scene.add(ground);

  // 光源：影棚柔光漫射——环境光提亮暗部 + 主光暖白（投影）+ 补光冷色柔化
    scene.background = new THREE.Color(0xfaf6f0); // 暖米白底 — 产品摄影柔光箱感
  scene.add(new THREE.AmbientLight(0xffffff, .88));
  scene.add(new THREE.HemisphereLight(0xfff5e6, 0xd4c9b8, 0.4)); // 暖顶冷底天光：金属/塑料都有柔和体积感
  const key = new THREE.DirectionalLight(0xfff8f0, 1.05);
  key.position.set(2.2, 3.2, 2.4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = .5; key.shadow.camera.far = 10;
  key.shadow.camera.left = -3; key.shadow.camera.right = 3;
  key.shadow.camera.top = 3; key.shadow.camera.bottom = -3;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe8e4f0, .28); fill.position.set(-2.4, 1.2, -1.6); scene.add(fill);

  // 相机：按包围盒自动取景
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const d = Math.max(size.x, size.y, size.z) * 1.85 + .35;
  const camera = new THREE.PerspectiveCamera(35, 1, .05, 60);
  camera.position.set(d * .82, d * .62, d);

  // P2.1：alpha=false + clearColor，强制米白背景，不被 2D mockup 场景底色污染
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xf5f2ec, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // PMREM 环境贴图（RoomEnvironment 零资源影棚反射）
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  _resize(renderer, camera, container);
  container.appendChild(renderer.domElement);

  // 让 group 中所有 Mesh 投射阴影
  group.traverse(obj => { if (obj.isMesh) obj.castShadow = true; });

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(center);
  controls.enableDamping = true; controls.dampingFactor = .08;
  controls.autoRotate = true; controls.autoRotateSpeed = 1.6;
  controls.enableZoom = true; controls.minDistance = .4; controls.maxDistance = 24;
  controls.update();

  // 🧪 调试挂载：让外部能访问 camera/controls 做自动化测试
  if (typeof Craft3D !== 'undefined') {
    Craft3D._controls = controls;
    Craft3D._camera = camera;
  }
  const toolbar = document.createElement('div');
  toolbar.className = 'craft-3d-toolbar';
  const mkTool = (label, on, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'craft-3d-tool' + (on ? ' on' : '');
    b.textContent = label;
    b.addEventListener('click', onClick);
    toolbar.appendChild(b);
    return b;
  };
  const gridBtn = mkTool('网格', true, () => {
    grid.visible = !grid.visible;
    gridBtn.classList.toggle('on', grid.visible);
  });
  const rotBtn = mkTool('旋转', true, () => {
    controls.autoRotate = !controls.autoRotate;
    rotBtn.classList.toggle('on', controls.autoRotate);
  });
  mkTool('复位', false, () => {
    camera.position.set(d * .82, d * .62, d);
    controls.target.copy(center);
    controls.update();
  });
  const axesBtn = mkTool('坐标轴', false, () => {
    axes.visible = !axes.visible;
    axesBtn.classList.toggle('on', axes.visible);
  });
  container.appendChild(toolbar);

  const hint = document.createElement('p');
  hint.className = 'craft-3d-hint';
  hint.textContent = `拖拽旋转 · 滚轮缩放 · ${productName || FORM3D_LABELS[form3d] || form3d} 3D 实物预览`;
  container.appendChild(hint);

  // 渲染循环
  let rafId = 0;
  const loop = () => {
    if (!st || st.rafId !== rafId) return;
    controls.update();
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(loop);
    st.rafId = rafId;
  };

  // 容器尺寸自适应
  const ro = new ResizeObserver(() => {
    if (st && st.renderer === renderer) _resize(renderer, camera, container);
  });
  ro.observe(container);

  st = {
    container, form3d, scene, camera, renderer, controls,
    grid, axes, texture: art.texture, rafId: 0, ro, toolbar, hint,
    pmrem, envTex
  };
  rafId = requestAnimationFrame(loop);
  st.rafId = rafId;
  // 测试辅助：暴露到 window 供 e2e 断言几何结构/材质数组
  if (typeof window !== 'undefined') window.__craft3dState = st;
}

/**
 * BFF UV 预处理 —— 把混元 3D 输出的 GLB 发给 server/index.mjs
 * 后端按 form3d 自动选 FACE_LAYOUT 策略，返回 fixed GLB
 *
 * 前端零依赖，BFF 不可用时静默 fallback（原始模型 → 图案错位但不报错）
 */
async function _callBffUvProcess(glbArrayBuffer, form3d, productKey) {
  if (!form3d || !glbArrayBuffer) return null;
  const base64 = _arrayBufferToBase64(glbArrayBuffer);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const resp = await fetch('/api/uv/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ form3d, productKey: productKey || '', glbBase64: base64 }),
      signal: ctrl.signal,
    });
    if (!resp.ok) throw new Error('BFF HTTP ' + resp.status);
    const j = await resp.json();
    if (!j || !j.ok || !j.glbBase64) throw new Error('BFF invalid response');
    return {
      buffer: _base64ToArrayBuffer(j.glbBase64),
      strategy: j.strategy,
      triangles: j.triangles,
      ms: j.ms,
    };
  } finally { clearTimeout(timer); }
}

function _arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function _base64ToArrayBuffer(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/**
 * 使用运营上传的自定义 3D 模型渲染预览
 * 复用 render() 的查看器骨架，只换 group 加载方式（GLTFLoader.parse）
 * @param {HTMLElement} container   容器
 * @param {object} customModel      cache 里的模型记录（{ file(ArrayBuffer), format, meta }）
 * @param {HTMLCanvasElement} textureCanvas 贴图源
 * @param {string} productName      品类名（hint 显示）
 * @returns {Promise<void>}
 */
export async function renderCustom(container, customModel, textureCanvas, productName, form3d, productKey) {
  if (!container || !customModel || !customModel.file || !(customModel.file instanceof ArrayBuffer)) {
    throw new Error('renderCustom: missing container or custom model file');
  }

  // ====== BFF UV 预处理（混元 3D 输出的 GLB → 自动按 form3d 定制 UV） ======
  // 策略版本号 —— 前端独立计数器（与后端 form3d-strategies.mjs 的 STRATEGIES_VERSION 是两套编号，勿混用）
  // 后端策略表发生"结构性变化"（layout / 新增策略 / 厚度 / sentinel 规则）时，必须同步把本常量 +1，
  // 前端据此判定缓存过期并强制重新预处理。
  // v16: 禁用 mesh 拆分（破坏边界法线连续性 + 杯把几何脱落），改用单一 mesh + sentinel UV + canvas 右上角 paper 色
  // v18: 修复非 mug 模型白模 —— wrapThisFace 条件 cylindricalWrap=false 时也要正常 wrap
  // v17: mug cap 判定 ay>0.5+yPct极端 + 双面建模内壁位置辅助判定
  const BFF_STRATEGY_VERSION = 26;
  // 缓存开关：false = 首次处理后把结果写回 customModel（file / uvProcessed / _bffVersion），
  // 同一会话内再次预览直接复用，不再把 MB 级 GLB 反复上传给 BFF 重算（单次处理约 300-450ms + 上传耗时）。
  // 仅当 customModel.uvProcessed !== true 或 _bffVersion !== BFF_STRATEGY_VERSION 时才重新处理。
  const FORCE_REPROCESS = false;
  const needReprocess = FORCE_REPROCESS ||
    customModel.uvProcessed !== true ||
    customModel._bffVersion !== BFF_STRATEGY_VERSION;

  if (needReprocess && form3d) {
    if (FORCE_REPROCESS) {
      console.warn(`[Craft3D] 🚨 强制 BFF UV 预处理 form3d=${form3d} model=${customModel.meta?.name || '(unnamed)'}`);
    } else if (customModel.uvProcessed && customModel._bffVersion !== BFF_STRATEGY_VERSION) {
      console.warn(`[Craft3D] 策略版本变更 ${customModel._bffVersion}→${BFF_STRATEGY_VERSION}，重新 UV 预处理 form3d=${form3d}`);
    } else {
      console.warn(`[Craft3D] BFF UV 预处理中 form3d=${form3d} model=${customModel.meta?.name || '(unnamed)'}`);
    }
    try {
      const fixed = await _callBffUvProcess(customModel.file, form3d, productKey);
      if (fixed) {
        console.warn(`[Craft3D] BFF UV 预处理成功 ✅ strategy=${fixed.strategy} v${fixed.strategyVersion||'?'} triangles=${fixed.triangles} ${fixed.ms}ms`);
        customModel.file = fixed.buffer;
        customModel.uvProcessed = true;
        customModel._bffStrategy = fixed.strategy;
        customModel._bffMs = fixed.ms;
        customModel._bffVersion = fixed.strategyVersion || BFF_STRATEGY_VERSION;
      }
    } catch (bffErr) {
      console.warn('[Craft3D] BFF UV 预处理失败，用原始模型继续渲染（不阻断）:', bffErr.message);
    }
  } else if (!form3d) {
    console.warn('[Craft3D] renderCustom 缺 form3d，跳过 BFF UV 预处理');
  } else {
    console.warn(`[Craft3D] 命中 BFF 缓存 v${customModel._bffVersion}，跳过（form3d=${form3d}）`);
  }
  // =======================================================================

  dispose();
  const seq = ++_renderSeq;
  const { THREE, OrbitControls, RoomEnvironment, GLTFLoader, DRACOLoader } = await _loadThree();
  if (seq !== _renderSeq || !container.isConnected) return;

  _injectStyle();

  // 解析 glb（fbx/usdz 暂不支持，管理后台上传时已校验）
  if (customModel.format === 'fbx' || customModel.format === 'usdz') {
    throw new Error(`自定义模型格式 ${customModel.format} 暂不支持实时预览，请转换为 glb`);
  }
  // 配置 DRACOLoader → 支持 Draco 压缩 glb（书签.glb 17.2MB 就是这种）
  console.warn('[Craft3D] 自定义模型 byteLength=', customModel.file.byteLength, 'format=', customModel.format, 'name=', customModel.meta?.name);
  const draco = new DRACOLoader();
  draco.setDecoderPath('/draco/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  let gltf;
  try {
    gltf = await new Promise((resolve, reject) => {
      loader.parse(customModel.file, '', (g) => resolve(g), (e) => reject(e));
    });
  } catch (err) {
    throw new Error('自定义模型解析失败：' + (err && err.message || String(err)));
  }

  const group = gltf.scene || gltf.scenes[0];
  if (!group) throw new Error('自定义 glb 无 scene');

  // [诊断] 打印模型 UV 范围，用于判断单面/双面展开
  {
    let meshIdx = 0;
    const rows = [];
    const diag = { byteLen: customModel.file.byteLength, meshes: [] };
    group.traverse(obj => {
      if (!obj.isMesh) return;
      const geom = obj.geometry;
      // 🔍 关键诊断：所有 UV attribute！
      const allUvAttrs = Object.entries(geom.attributes || {}).filter(([name]) => /^uv/i.test(name));
      rows.push(`  mesh#${meshIdx++} verts=${geom.attributes?.position?.count} UV_ATTRS=[${allUvAttrs.map(([n,a])=>`${n}:${a.count}`).join(',')}]`);
      console.warn('[Craft3D] ALL UV attributes:', allUvAttrs.map(([n,a])=>`${n} count=${a.count}`).join(', '));
      const uvAttr = geom.attributes && geom.attributes.uv;
      let range = 'NO_UV';
      let byDir = {};
      if (uvAttr) {
        let minU = 1, maxU = 0, minV = 1, maxV = 0;
        for (let i = 0; i < uvAttr.count; i++) {
          const u = uvAttr.getX(i), v = uvAttr.getY(i);
          if (u < minU) minU = u; if (u > maxU) maxU = u;
          if (v < minV) minV = v; if (v > maxV) maxV = v;
        }
        range = `U[${minU.toFixed(2)},${maxU.toFixed(2)}] V[${minV.toFixed(2)},${maxV.toFixed(2)}]`;
        // 按法线方向分 UV 范围！
        if (geom.attributes.normal) {
          const nAttr = geom.attributes.normal;
          for (let i = 0; i < uvAttr.count; i++) {
            const nx = nAttr.getX(i), ny = nAttr.getY(i), nz = nAttr.getZ(i);
            let dir;
            if (Math.abs(ny) >= Math.abs(nx) && Math.abs(ny) >= Math.abs(nz)) dir = ny > 0 ? '+Y' : '-Y';
            else if (Math.abs(nx) >= Math.abs(nz)) dir = nx > 0 ? '+X' : '-X';
            else dir = nz > 0 ? '+Z' : '-Z';
            const u = uvAttr.getX(i), v = uvAttr.getY(i);
            if (!byDir[dir]) byDir[dir] = { mnU: 2, mxU: -1, mnV: 2, mxV: -1 };
            const s = byDir[dir];
            if (u < s.mnU) s.mnU = u; if (u > s.mxU) s.mxU = u;
            if (v < s.mnV) s.mnV = v; if (v > s.mxV) s.mxV = v;
          }
          for (const d of Object.keys(byDir)) {
            const s = byDir[d];
            rows.push(`    ${d}: U[${s.mnU.toFixed(2)},${s.mxU.toFixed(2)}] V[${s.mnV.toFixed(2)},${s.mxV.toFixed(2)}]`);
          }
        }
      }
      const matCnt = Array.isArray(obj.material) ? obj.material.length : 1;
      rows.push(`  mesh#${meshIdx++} verts=${geom.attributes?.position?.count || '?'} range=${range} mats=${matCnt}`);
      diag.meshes.push({ verts: geom.attributes?.position?.count, range, byDir });
    });
    console.warn('[Craft3D] 模型 UV 诊断 (byteLen=' + customModel.file.byteLength + '):\n' + rows.join('\n'));
    window.__diagUV = diag;
  }

  // 归一化：居中 + 缩放到单位 1（保证相机/光源距离一致）
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 1.0 / maxDim;
  group.scale.setScalar(scale);
  // 重新计算归一化后的包围盒
  const box2 = new THREE.Box3().setFromObject(group);
  const size2 = box2.getSize(new THREE.Vector3());
  const center2 = box2.getCenter(new THREE.Vector3());
  // 把中心移到 y=size.y/2（让模型站在地面上）
  group.position.sub(center2.clone().setY(0));
  group.position.y -= center2.y;
  if (box2.min.y < 0) group.position.y += Math.abs(box2.min.y);

  // 注入 CanvasTexture（创意图案）—— 全材质覆盖（多材质数组场景必须全换）
  // 🎯 品类独立 PBR：三重查表（优先级从高到低）
  //   1) productKey 直接查 FORM_PBR（产品级覆盖，如 shuqian→金属 覆盖 cardStack→纸感）
  //   2) form3d 参数直接查 FORM_PBR（form3d key 如 cardStack/keychain）
  //   3) 都没命中 → fallback 通用 .55/.06
  let customPbr = null;
  if (productKey) customPbr = FORM_PBR[productKey];      // 1) 产品 key 优先
  if (!customPbr && form3d) customPbr = FORM_PBR[form3d]; // 2) form3d 次选
  customPbr = customPbr || { roughness: .55, metalness: .06 };
  const art = _makeMaterial(THREE, textureCanvas, customPbr);

  // ⭐ 关键：加载后扫描 mesh 的每个三角形，按 UV 自动创建 geometry.groups
  // sentinel UV 的三角形 → materialIndex=1（paperMat 米白）
  // 正常 UV 的三角形 → materialIndex=0（CanvasTexture 图案）
  // 这样 BFF 只需输出正确 UV，前端自动分材质区域 ✅
  function _buildGroupsFromUV(mesh) {
    const geom = mesh.geometry;
    if (!geom) return;
    const uvAttr = geom.attributes?.uv;
    if (!uvAttr) return;
    const idx = geom.index;
    const vertsPerFace = 3;
    const totalVerts = uvAttr.count;
    const totalFaces = idx ? idx.count / vertsPerFace : totalVerts / vertsPerFace;

    const _isSentinelTri = (faceStart) => {
      for (let k = 0; k < 3; k++) {
        const vi = idx ? idx.getX(faceStart + k) : faceStart + k;
        const u = uvAttr.getX(vi), v = uvAttr.getY(vi);
        // ⚠️ 只认 (0.9999, 0.9999) 标记 —— 这是 BFF cylindrical 模式专属的 sentinel
        // (0,0) 是 toteBag 等 planar 策略的正常 layout 起点，不能算 sentinel！
        const isSent = (u >= 0.9998 && v >= 0.9998);
        if (!isSent) return false;
      }
      return true;
    };

    const newGroups = [];
    let i = 0;
    while (i < totalFaces) {
      const faceStart = i * vertsPerFace;
      const isSent = _isSentinelTri(faceStart);
      let j = i;
      while (j < totalFaces && _isSentinelTri(j * vertsPerFace) === isSent) j++;
      newGroups.push({
        start: faceStart,
        count: (j - i) * vertsPerFace,
        materialIndex: isSent ? 1 : 0,
      });
      i = j;
    }

    if (newGroups.length > 1) {
      geom.groups = newGroups;
      if (!Array.isArray(mesh.material)) {
        const orig = mesh.material;
        mesh.material = [orig.clone(), orig.clone()];
      }
      const wrapG = newGroups.filter(g => g.materialIndex === 0).length;
      const sentG = newGroups.filter(g => g.materialIndex === 1).length;
      console.log(`[Craft3D] mesh "${mesh.name}" auto groups: ${newGroups.length} (wrap=${wrapG}, sent=${sentG})`);
    }
  }
  group.traverse(obj => { if (obj.isMesh) _buildGroupsFromUV(obj); });

  const injected = _injectCanvasTextureToModel(group, THREE, art.texture, { pbr: customPbr });
  console.warn('[Craft3D] 创意图案注入结果:', injected ? '✅ 成功（全材质覆盖）' : '❌ 未找到 MeshStandardMaterial');
  // 如果没找到可注入材质，至少让所有 Mesh 投阴影 + 启用 castShadow
  group.traverse(obj => { if (obj.isMesh) obj.castShadow = true; });

  const scene = new THREE.Scene();
  scene.add(group);

  const grid = new THREE.GridHelper(4, 20, 0xb8b0a5, 0xd4cdc2);
  grid.material.transparent = true; grid.material.opacity = .45;
  scene.add(grid);
  const axes = new THREE.AxesHelper(.6);
  axes.visible = false;
  scene.add(axes);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.ShadowMaterial({ opacity: .18 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -.01;
  ground.receiveShadow = true;
  scene.add(ground);

    scene.background = new THREE.Color(0xfaf6f0); // 暖米白底 — 产品摄影柔光箱感
  scene.add(new THREE.AmbientLight(0xffffff, .88));
  scene.add(new THREE.HemisphereLight(0xfff5e6, 0xd4c9b8, 0.4)); // 暖顶冷底天光：金属/塑料都有柔和体积感
  const key = new THREE.DirectionalLight(0xfff8f0, 1.05);
  key.position.set(2.2, 3.2, 2.4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = .5; key.shadow.camera.far = 10;
  key.shadow.camera.left = -3; key.shadow.camera.right = 3;
  key.shadow.camera.top = 3; key.shadow.camera.bottom = -3;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe8e4f0, .28); fill.position.set(-2.4, 1.2, -1.6); scene.add(fill);

  const finalBox = new THREE.Box3().setFromObject(group);
  const finalSize = finalBox.getSize(new THREE.Vector3());
  const finalCenter = finalBox.getCenter(new THREE.Vector3());
  const d = Math.max(finalSize.x, finalSize.y, finalSize.z) * 1.85 + .35;
  const camera = new THREE.PerspectiveCamera(35, 1, .05, 60);
  camera.position.set(d * .82, d * .62, d);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xf5f2ec, 1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  _resize(renderer, camera, container);
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(finalCenter);
  controls.enableDamping = true; controls.dampingFactor = .08;
  controls.autoRotate = true; controls.autoRotateSpeed = 1.6;
  controls.enableZoom = true; controls.minDistance = .4; controls.maxDistance = 24;
  controls.update();

  // 🧪 调试挂载
  if (typeof Craft3D !== 'undefined') {
    Craft3D._controls = controls;
    Craft3D._camera = camera;
  }

  // 工具条（与 render() 完全一致）
  const toolbar = document.createElement('div');
  toolbar.className = 'craft-3d-toolbar';
  const mkTool = (label, on, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'craft-3d-tool' + (on ? ' on' : '');
    b.textContent = label;
    b.addEventListener('click', onClick);
    toolbar.appendChild(b);
    return b;
  };
  const gridBtn = mkTool('网格', true, () => { grid.visible = !grid.visible; gridBtn.classList.toggle('on', grid.visible); });
  const rotBtn = mkTool('旋转', true, () => { controls.autoRotate = !controls.autoRotate; rotBtn.classList.toggle('on', controls.autoRotate); });
  mkTool('复位', false, () => { camera.position.set(d * .82, d * .62, d); controls.target.copy(finalCenter); controls.update(); });
  const axesBtn = mkTool('坐标轴', false, () => { axes.visible = !axes.visible; axesBtn.classList.toggle('on', axes.visible); });
  container.appendChild(toolbar);

  const hint = document.createElement('p');
  hint.className = 'craft-3d-hint';
  const triNow = countTriangles(group);
  hint.textContent = `自定义模型 · ${productName || ''} · ${customModel.format.toUpperCase()} · ${triNow}面 · ${injected ? '已注入创意图案' : '请为模型添加纹理通道'} · 拖拽旋转 · 滚轮缩放`;
  container.appendChild(hint);

  let rafId = 0;
  const loop = () => {
    if (!st || st.rafId !== rafId) return;
    controls.update();
    renderer.render(scene, camera);
    rafId = requestAnimationFrame(loop);
    st.rafId = rafId;
  };

  const ro = new ResizeObserver(() => {
    if (st && st.renderer === renderer) _resize(renderer, camera, container);
  });
  ro.observe(container);

  st = {
    container, form3d: null, scene, camera, renderer, controls,
    grid, axes, texture: art.texture, rafId: 0, ro, toolbar, hint,
    pmrem, envTex, customModel: true,
    _origTextureInjected: injected  // 标记贴图注入状态（测试断言用）
  };
  rafId = requestAnimationFrame(loop);
  st.rafId = rafId;
  if (typeof window !== 'undefined') window.__craft3dState = st;
}

/** 容器尺寸同步（renderer + camera.aspect） */
function _resize(renderer, camera, container) {
  const w = Math.max(container.clientWidth, 1);
  const h = Math.max(container.clientHeight, 1);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

/**
 * 贴图刷新（预览画布内容变化时，重画 sentinel paper 色 + 置 needsUpdate）
 * 注意：外层 drawImage 会把 paper 色像素覆盖掉 —— 必须每次 refresh 都重画
 */
export function refresh(textureCanvas) {
  if (!st || !st.texture) return;
  if (textureCanvas && st.texture.image !== textureCanvas) return; // 换源需重渲染
  // 先重画 paper 色（外层 drawImage 设计图时会覆盖掉）
  if (textureCanvas) _paintSentinelCorner(textureCanvas);
  st.texture.needsUpdate = true;
}

/**
 * 导出当前 3D 视图（同一 tick render + toDataURL，不需 preserveDrawingBuffer）
 * @returns {string} dataURL（PNG），未激活返回 ''
 */
export function snapshot() {
  if (!st || !st.renderer) return '';
  st.renderer.render(st.scene, st.camera);
  return st.renderer.domElement.toDataURL('image/png');
}

/**
 * 全量释放 3D 资源（面板关闭 / chip 切走 / 工作台关闭时调用）
 * 覆盖：RAF / ResizeObserver / geometry / material / CanvasTexture / renderer
 */
export function dispose() {
  _renderSeq++; // 使 pending 中的 render 自行失效
  if (!st) return;
  const s = st; st = null;
  if (typeof window !== 'undefined') window.__craft3dState = null;
  if (s.rafId) cancelAnimationFrame(s.rafId);
  if (s.ro) { try { s.ro.disconnect(); } catch (_) { /* ignore */ } }
  if (s.scene) {
    s.scene.traverse(obj => {
      if (!obj.isMesh) return;
      if (obj.geometry) obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => {
        if (!m) return;
        if (m.map && m.map.dispose) m.map.dispose(); // CanvasTexture 显式释放
        if (m.dispose) m.dispose();
      });
    });
  }
  if (s.controls) { try { s.controls.dispose(); } catch (_) { /* ignore */ } }
  if (s.envTex) { try { s.envTex.dispose(); } catch (_) { /* ignore */ } }
  if (s.pmrem) { try { s.pmrem.dispose(); } catch (_) { /* ignore */ } }
  if (s.renderer) { try { s.renderer.dispose(); } catch (_) { /* ignore */ } }
  if (s.container) {
    if (s.renderer && s.renderer.domElement && s.renderer.domElement.parentNode) s.renderer.domElement.remove();
    if (s.toolbar && s.toolbar.parentNode) s.toolbar.remove();
    if (s.hint && s.hint.parentNode) s.hint.remove();
  }
}

export default {
  FORM3D_LABELS, isForm3dSupported, isActive,
  render, renderCustom, refresh, snapshot, dispose,
  loadCustomModelsCache, getCachedCustomModel, clearCustomModelCache, countTriangles
};

// 暴露到 window：让 admin.js 跨 tab 也能调（clearCustomModelCache / loadCustomModelsCache）
if (typeof window !== 'undefined') {
  window.Craft3D = {
    loadCustomModelsCache, getCachedCustomModel, clearCustomModelCache, renderCustom,
    render, countTriangles, dispose, isActive
  };
}

