/**
 * tools/uv-processor/index.mjs
 *
 * 可复用 GLB UV 修复库 —— 支持按 form3d 自动选择 FACE_LAYOUT 策略
 * 从 tools/fix_uv_node.mjs 重构而来
 *
 * 用法：
 *   import { processGlb } from './tools/uv-processor/index.mjs';
 *   const fixedBuffer = await processGlb(inputArrayBuffer, 'shuqian', { normalize: true });
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { UV_STRATEGIES, detectStrategy, hasStrategy, VALID_FORM3DS, STRATEGIES_VERSION } from './form3d-strategies.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- Node polyfill ----------
function threeNodePolyfill() {
  const g = globalThis;
  if (!g.self) g.self = g;
  if (!g.window) g.window = g;
  if (!g.Image) {
    g.Image = class Image {
      constructor() {}
      set src(v) { setTimeout(() => { if (this.onload) this.onload(); }, 0); }
    };
  }
  if (!g.FileReader) {
    g.FileReader = class FileReader {
      constructor() { this.result = null; this.readyState = 0; }
      readAsArrayBuffer(blob) {
        const done = () => {
          this.readyState = 2;
          try { if (this.onload) this.onload({ target: this }); } catch(e) {}
          try { if (this.onloadend) this.onloadend({ target: this }); } catch(e) {}
        };
        if (blob && typeof blob.arrayBuffer === 'function') {
          blob.arrayBuffer().then(buf => { this.result = buf; done(); }).catch(e => {
            try { if (this.onerror) this.onerror(e); } catch(_) {} done();
          });
        } else if (Buffer.isBuffer(blob)) {
          this.result = blob.buffer.slice(blob.byteOffset, blob.byteOffset + blob.byteLength);
          done();
        } else {
          setTimeout(done, 0);
        }
      }
    };
  }
}
threeNodePolyfill();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..', '..');

// ---------- 工具函数（从 fix_uv_node.mjs 提取） ----------

function computeFaceNormals(geometry) {
  const posAttr = geometry.attributes.position;
  const verts = posAttr.count;
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const normals = new Float32Array(verts * 3);
  const faceCount = verts / 3;
  for (let f = 0; f < faceCount; f++) {
    const i0 = f * 3, i1 = f * 3 + 1, i2 = f * 3 + 2;
    v0.fromBufferAttribute(posAttr, i0);
    v1.fromBufferAttribute(posAttr, i1);
    v2.fromBufferAttribute(posAttr, i2);
    nrm.crossVectors(v1.clone().sub(v0), v2.clone().sub(v0)).normalize();
    normals[i0*3] = nrm.x; normals[i0*3+1] = nrm.y; normals[i0*3+2] = nrm.z;
    normals[i1*3] = nrm.x; normals[i1*3+1] = nrm.y; normals[i1*3+2] = nrm.z;
    normals[i2*3] = nrm.x; normals[i2*3+1] = nrm.y; normals[i2*3+2] = nrm.z;
  }
  return normals;
}

function classifyFace(nx, ny, nz) {
  // 纯绝对值最大方向归类 —— 简单稳定
  const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
  if (ax >= ay && ax >= az) return nx > 0 ? '+X' : '-X';
  if (ay >= ax && ay >= az) return ny > 0 ? '+Y' : '-Y';
  return nz > 0 ? '+Z' : '-Z';
}

function manualToNonIndexed(geometry) {
  if (!geometry.index) return;
  const idx = geometry.index;
  const faceCount = idx.count / 3;
  const newVerts = faceCount * 3;
  for (const [name, attr] of Object.entries(geometry.attributes)) {
    if (!attr.isBufferAttribute) continue;
    const itemSize = attr.itemSize;
    const TypedArray = attr.array.constructor;
    const newArr = new TypedArray(newVerts * itemSize);
    for (let i = 0; i < newVerts; i++) {
      const srcIdx = idx.getX(i);
      for (let j = 0; j < itemSize; j++) {
        newArr[i * itemSize + j] = attr.array[srcIdx * itemSize + j];
      }
    }
    geometry.deleteAttribute(name);
    geometry.setAttribute(name, new THREE.BufferAttribute(newArr, itemSize, attr.normalized));
  }
  geometry.index = null;
}

/**
 * 核心：按法线归类 remap UV —— 参数化 FACE_LAYOUT
 */
function remapUVsByNormal(geometry, strategy) {
  const layout = strategy.layout;
  const flipUMap = strategy.flipU || {};
  const flipVMap = strategy.flipV || {};
  const mainAxis = strategy.mainAxis || null;
  const cylindricalWrap = strategy.cylindricalWrap === true;

  if (geometry.index) manualToNonIndexed(geometry);
  if (geometry.attributes.uv) geometry.deleteAttribute('uv');

  const posAttr = geometry.attributes.position;
  const verts = posAttr.count;
  const faceCount = verts / 3;
  const faceNormals = computeFaceNormals(geometry);

  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  const faceData = [];

  // ===== 包围盒（取 Y 范围）+ 圆柱轴拟合（关键修正）=====
  // 用包围盒中心当圆柱轴是错的：杯把向外延伸 + 模型原点偏离几何中心，
  // 都会让 (gxMid,gzMid) ≠ 真实圆柱轴 → radialDot/atan2 全偏 → 外壁被误判 sentinel。
  // 这里用“壁面辐射线最小二乘”拟合真实轴，再据此算半径。
  let gxMin = Infinity, gxMax = -Infinity, gyMin = Infinity, gyMax = -Infinity, gzMin = Infinity, gzMax = -Infinity;
  for (let i = 0; i < verts; i++) {
    const x = posAttr.getX(i), y = posAttr.getY(i), z = posAttr.getZ(i);
    if (x < gxMin) gxMin = x; if (x > gxMax) gxMax = x;
    if (y < gyMin) gyMin = y; if (y > gyMax) gyMax = y;
    if (z < gzMin) gzMin = z; if (z > gzMax) gzMax = z;
  }
  const yRange = gyMax - gyMin || 1;

  let gxMid = (gxMin + gxMax) / 2, gzMid = (gzMin + gzMax) / 2;
  // 迭代外壁最小二乘拟合圆柱轴（和诊断脚本 _diag5.mjs 完全对齐）
  // 第 1 轮用 |ny|<0.5 过滤掉 cap，后续每轮只保留 radialDot>0.6 的外壁面，
  // 排除杯把切向面/内壁噪声，收敛到真实圆柱轴。
  {
    let prevGx = 999, prevGz = 999;
    for (let k = 0; k < 5; k++) {
      let SAA = 0, SAB = 0, SBB = 0, SAC = 0, SBC = 0, nUsed = 0;
      for (let f = 0; f < faceCount; f++) {
        const nx = faceNormals[f*9], ny = faceNormals[f*9+1], nz = faceNormals[f*9+2];
        if (Math.abs(ny) > 0.55) continue;  // 舍弃顶/底 cap
        const i0 = f*3, i1 = f*3+1, i2 = f*3+2;
        const cx = (posAttr.getX(i0)+posAttr.getX(i1)+posAttr.getX(i2))/3;
        const cz = (posAttr.getZ(i0)+posAttr.getZ(i1)+posAttr.getZ(i2))/3;
        // 后续迭代只用外壁面（radialDot>0.6），排除内壁/杯把
        if (k > 0) {
          const dx = cx - gxMid, dz = cz - gzMid;
          const r = Math.sqrt(dx*dx + dz*dz);
          const rd = Math.max(r, 1e-6);
          const dot = (nx*dx + nz*dz) / rd;
          if (dot <= 0.6) continue;
        }
        // 辐射线约束：A*ax + B*az + C ≈ 0, 其中 A=nz, B=-nx, C=cz*nx - cx*nz
        const A = nz, B = -nx, C = cz*nx - cx*nz;
        const w = 1 - Math.abs(ny);
        SAA += w*A*A; SAB += w*A*B; SBB += w*B*B; SAC += w*A*C; SBC += w*B*C;
        nUsed++;
      }
      const det = SAA*SBB - SAB*SAB;
      if (Math.abs(det) <= 1e-9 || nUsed < 50) break;
      const nx = (-SAC*SBB + SAB*SBC) / det;
      const nz_ = (-SAA*SBC + SAB*SAC) / det;
      if (Math.hypot(nx - gxMid, nz_ - gzMid) < 0.0005) { gxMid = nx; gzMid = nz_; break; }
      prevGx = gxMid; prevGz = gzMid;
      gxMid = nx; gzMid = nz_;
    }
    // det 退化则回退包围盒中心（原逻辑）
  }

  // 外壁参考半径 rMax：距拟合轴的最远顶点半径（含杯把），用于 faceR 阈值
  let rMax = 0;
  for (let i = 0; i < verts; i++) {
    const dx = posAttr.getX(i) - gxMid, dz = posAttr.getZ(i) - gzMid;
    const r = Math.sqrt(dx*dx + dz*dz);
    if (r > rMax) rMax = r;
  }

  // 分类计数器（faceData 构建循环 + UV 写入循环都要用，声明在最前避免 TDZ）
  let _wrapFaceCount = 0, _sentFaceCount = 0;
  let _innerWall = 0, _cap = 0, _outerWrap = 0, _fallbackSent = 0;

  for (let f = 0; f < faceCount; f++) {
    const i0 = f*3, i1 = f*3+1, i2 = f*3+2;
    v0.fromBufferAttribute(posAttr, i0);
    v1.fromBufferAttribute(posAttr, i1);
    v2.fromBufferAttribute(posAttr, i2);
    const fx=(v0.x+v1.x+v2.x)/3, fy=(v0.y+v1.y+v2.y)/3, fz=(v0.z+v1.z+v2.z)/3;
    const nx=faceNormals[i0*3], ny=faceNormals[i0*3+1], nz=faceNormals[i0*3+2];
    let dir = classifyFace(nx, ny, nz);

    // ===== cylindricalWrap 模式：精准区域分类 =====
    // 优先级：内壁 → 杯口/杯底 sentinel → 外壁 wrap → 兜底 sentinel
    let forceSentinel = false;
    let forceWrap = false;
    if (cylindricalWrap) {
      const faceR = Math.sqrt((fx - gxMid) ** 2 + (fz - gzMid) ** 2);
      const ay = Math.abs(ny);
      const rd = Math.max(faceR, 1e-6);
      const radialDot = nx * (fx - gxMid) / rd + nz * (fz - gzMid) / rd;
      const yPct = (fy - gyMin) / yRange;

      // ★★★ 硬切逻辑：位置 > 法线。先按 yPct 切，再按法线分 ★★★
      //
      // 0. 杯口/杯底 cap（最高优先级！）
      //    只要 yPct < 0.15 或 > 0.85 → 不管法线朝哪，一律 sentinel！
      //    原因：杯底过渡弧法线几乎水平 (ay≈0.05)，和杯身一样，靠法线区分不了
      if (yPct < 0.15 || yPct > 0.85) {
        forceSentinel = true; _cap++;
      }
      // 1. 内壁 → sentinel
      else if (radialDot < -0.3 && faceR > 0.15) {
        forceSentinel = true; _innerWall++;
      }
      // 2. 双面建模内壁：位置辅助判定
      else if (faceR > 0.15 && faceR < rMax * 0.82 && yPct > 0.1 && yPct < 0.9 && ay < 0.4 && radialDot < 0.6) {
        forceSentinel = true; _innerWall++;
      }
      // 3. 外壁 wrap：位置在中间 + 法线朝外 + ay 小（杯身外壁法线 ≈ 0）
      else if (radialDot > -0.3 && faceR > rMax * 0.35 && ay < 0.3) {
        forceWrap = true; _outerWrap++;
      }
      // 4. 兜底 sentinel：杯把 / 过渡弧 / 半径太小
      else {
        forceSentinel = true; _fallbackSent++;
      }
    }

    // 圆柱参数化：外壁 ±X/±Z 方向的 face → 用 atan2 算圆周角
    let u0,u1,w0,w1;
    if (dir==='+Z'||dir==='-Z') {
      u0=Math.min(v0.x,v1.x,v2.x); u1=Math.max(v0.x,v1.x,v2.x);
      w0=Math.min(v0.y,v1.y,v2.y); w1=Math.max(v0.y,v1.y,v2.y);
    } else if (dir==='+X'||dir==='-X') {
      u0=Math.min(v0.z,v1.z,v2.z); u1=Math.max(v0.z,v1.z,v2.z);
      w0=Math.min(v0.y,v1.y,v2.y); w1=Math.max(v0.y,v1.y,v2.y);
    } else {
      u0=Math.min(v0.x,v1.x,v2.x); u1=Math.max(v0.x,v1.x,v2.x);
      w0=Math.min(v0.z,v1.z,v2.z); w1=Math.max(v0.z,v1.z,v2.z);
    }
    faceData.push({ dir, i0, i1, i2, u0, u1, w0, w1, forceSentinel, forceWrap });
  }

  // ===== dirRanges：每个方向独立 min/max =====
  const dirRanges = {};
  for (const d of ['+X','-X','+Y','-Y','+Z','-Z']) {
    const dirFaces = faceData.filter(f => f.dir === d);
    if (dirFaces.length === 0) continue;
    let mn_u=Infinity,mx_u=-Infinity,mn_w=Infinity,mx_w=-Infinity;
    for (const f of dirFaces) {
      if (!isFinite(f.u0)||!isFinite(f.w0)) continue;
      mn_u=Math.min(mn_u,f.u0); mx_u=Math.max(mx_u,f.u1);
      mn_w=Math.min(mn_w,f.w0); mx_w=Math.max(mx_w,f.w1);
    }
    dirRanges[d] = { mn_u,mx_u,mn_w,mx_w };
  }

  // ===== cylindricalWrap：圆柱类用 atan2 参数化 → 真正一圈连续 wrap =====
  // mug/搪瓷杯/保温杯等圆柱外壁：
  //   U = (atan2(z, x) + π) / 2π  → 圆周角 0→1 连续
  //   V = 1 - (y - yMin) / (yMax - yMin)  → 高度方向
  // 杯口/杯底 (±Y) 还是走 layout 零面积逻辑 → sentinel UV
  const isWrapDir = (dir) => ['+X','-X','+Z','-Z'].includes(dir);

  // ===== 关键：先全量初始化为 sentinel，然后 wrap face 覆盖 =====
  // 原因：马克杯 mesh 有 index buffer，顶点被多个 face 共享。
  // ─────────────────────────────────────────────────────────────────────────
  // UV 初始化策略（按品类隔离，mug 改动不影响其他文创）：
  //
  //   cylindricalWrap=true  (mug/杯类):
  //     先写 sentinel (0.9999) → 只给 wrap face 写正确 UV → sentinel face 保持 paper 色
  //     这样内壁/杯口/杯底/杯柄自动是 paper 色，不需要额外材质。
  //
  //   cylindricalWrap=false (书签/冰箱贴/笔记本/海报卡...):
  //     正常写所有 face 的 UV（按 dir 投影 + layout 归一化）
  //     不涉及 sentinel 机制 → 完全不受 mug 改动影响。
  // ─────────────────────────────────────────────────────────────────────────
  const uv = new Float32Array(verts*2);
  if (cylindricalWrap) {
    // mug: sentinel 预填 → wrap face 后写覆盖
    for (let i=0;i<verts;i++) { uv[i*2] = 0.9999; uv[i*2+1] = 0.9999; }
  } else {
    // 非 mug: 初始值不重要，循环里会写满所有 face
  }

  function getProjected(v3, dir) {
    if (dir==='+Z'||dir==='-Z') return { u:v3.x, w:v3.y };
    if (dir==='+X'||dir==='-X') return { u:v3.z, w:v3.y };
    return { u:v3.x, w:v3.z };
  }

  for (const f of faceData) {
    if (!dirRanges[f.dir]) continue;

    // ── 分类判定（按品类隔离） ──
    let wrapThisFace;

    if (cylindricalWrap) {
      // mug: 走 forceSentinel/forceWrap 分类 + dir 过滤
      if (f.forceSentinel) {
        wrapThisFace = false; _sentFaceCount++;
      } else if (f.forceWrap) {
        wrapThisFace = true; _wrapFaceCount++;
      } else {
        const box = layout[f.dir] || [0,0,1,1];
        const boxArea = Math.abs((box[2]-box[0])*(box[3]-box[1]));
        const isWrapDir2 = ['+X','-X','+Z','-Z'].includes(f.dir);
        wrapThisFace = isWrapDir2 && boxArea > 1e-6;
        if (wrapThisFace) _wrapFaceCount++; else _sentFaceCount++;
      }
    } else {
      // 非 mug: 不分类 → layout 有 boxArea 就 wrap
      const box = layout[f.dir] || [0,0,1,1];
      const boxArea = Math.abs((box[2]-box[0])*(box[3]-box[1]));
      wrapThisFace = boxArea > 1e-6;
      if (wrapThisFace) _wrapFaceCount++; else _sentFaceCount++;
    }

    if (!wrapThisFace) continue;  // sentinel face 在 mug 模式下已预填 0.9999，跳过

    // UV box（按品类隔离）
    const box = (cylindricalWrap && f.forceWrap) ? [0,0,1,1] : (layout[f.dir] || [0,0,1,1]);

    for (const vi of [f.i0, f.i1, f.i2]) {
      v0.fromBufferAttribute(posAttr, vi);

      let nu, nw;

      if (cylindricalWrap) {
        // mug: 圆柱参数化 atan2（沿 XZ 平面展开 → 只覆盖杯身中间 75% 高度）
        const dx = v0.x - gxMid, dz = v0.z - gzMid;
        const theta = Math.atan2(dz, dx);
        nu = (theta + Math.PI) / (2 * Math.PI);

        // ── V 轴：归一化到 wrap 三角形的实际 Y 范围 ──
        // sentinel 分类阈值是 yPct∈[0,15)∪(85,1] → sentinel
        // 所以 wrap 三角形的 Y ∈ [gyMin+0.15*yRange, gyMax-0.15*yRange]
        // V 归一化到这个范围 → pattern 完整覆盖杯身外壁
        const wYBot = gyMin + yRange * 0.15;
        const wYTop = gyMax - yRange * 0.15;
        nw = (v0.y - wYBot) / (wYTop - wYBot);
        nw = 1 - nw;  // Three.js V=0 是图片底部 ↔ 模型 y 大是顶部 → 翻转
      } else {
        // 非 mug: 平面投影
        const p = getProjected(v0, f.dir);
        const range = dirRanges[f.dir];
        const uSpan = range.mx_u - range.mn_u || 1;
        const wSpan = range.mx_w - range.mn_w || 1;
        nu = (p.u - range.mn_u) / uSpan;
        nw = (p.w - range.mn_w) / wSpan;
        nw = 1 - nw;  // Three.js V=0 是底部 ↔ 模型 y 大是顶部 → 翻转
      }

      if (flipUMap[f.dir]) nu = 1 - nu;
      if (flipVMap[f.dir]) nw = 1 - nw;

      const U = box[0] + nu*(box[2]-box[0]);
      const V = box[1] + nw*(box[3]-box[1]);
      uv[vi*2] = U; uv[vi*2+1] = V;
    }
  }

  if (cylindricalWrap) {
    console.log(`[UV-V16] face-level: wrap=${_wrapFaceCount} sent=${_sentFaceCount} total=${_wrapFaceCount+_sentFaceCount} wrap_pct=${(_wrapFaceCount/(_wrapFaceCount+_sentFaceCount)*100).toFixed(1)}%`);
    console.log(`[UV-V16]   细分: innerWall=${_innerWall} cap=${_cap} outerWrap=${_outerWrap} fallbackSent=${_fallbackSent}`);
  } else {
    console.log(`[UV-V20] planar mode: wrap=${_wrapFaceCount} total=${faceCount}`);
  }

  if (geometry.attributes.uv) geometry.deleteAttribute('uv');
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.attributes.uv.needsUpdate = true;
  // 保留原始平滑法线（源 GLB 已带 NORMAL）；仅在缺失时才重算，避免非索引重算导致"棱角/faceted"
  if (!geometry.attributes.normal) geometry.computeVertexNormals();

  // ⭐ BFF 只负责 UV 输出正确的 sentinel 值，不做 groups！
  // groups 由前端加载后扫描三角形 UV 自动创建。
  // 这样 GLB 保持单 mesh + 单 material，GLTFLoader 只加载 1 个 mesh，不会产生 1492 个 mesh。

  return faceData;
}

function isMetalRingMesh(obj) {
  if (!obj.geometry) return false;
  const posAttr = obj.geometry.attributes.position;
  if (!posAttr || posAttr.count < 20) return true;  // 极小 mesh → 认为是挂环
  // 名称里带 ring/chain/hook 也是
  const n = (obj.name || '').toLowerCase();
  return /ring|chain|hook|attach|loop|bail/i.test(n);
}

// ---------- 归一化 + 厚度强制 ----------

function normalizeGroup(group, minThickness) {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 1.0 / maxDim;
  group.scale.setScalar(scale);
  group.position.sub(center.clone().multiplyScalar(scale));
  group.position.y -= box.min.y * scale;
  group.updateMatrixWorld(true);

  group.updateMatrixWorld(true);
  const box2 = new THREE.Box3().setFromObject(group);
  const sz2 = box2.getSize(new THREE.Vector3());
  const enforcement = { before: sz2.z };
  if (sz2.z < minThickness && sz2.z > 0) {
    const zScale = minThickness / sz2.z;
    group.scale.z *= zScale;
    group.updateMatrixWorld(true);
    const box3 = new THREE.Box3().setFromObject(group);
    group.position.y -= box3.min.y;
    enforcement.after = box3.getSize(new THREE.Vector3()).z;
    enforcement.scaleZ = zScale;
  } else {
    enforcement.after = sz2.z;
  }
  return enforcement;
}

// ---------- 主入口 ----------

/**
 * @param {ArrayBuffer|Uint8Array} inputBuf  原始 GLB 数据
 * @param {string} form3d                     craft-products.js 的 form3d 字段（'cardStack','mug','shuqian' 等）
 * @param {object} [options]
 *   - normalize: boolean   默认 true —— 归一化 + 强制厚度
 *   - skipSmallMeshes: boolean 默认 true —— 跳过挂环/链条小 mesh
 * @returns {Promise<{ buffer: ArrayBuffer, stats: object }>}
 */
export async function processGlb(inputBuf, form3d, options = {}) {
  const {
    normalize = true,
  } = options;

  const strategy = UV_STRATEGIES[form3d] || UV_STRATEGIES.cardStack;
  const effectiveForm3d = hasStrategy(form3d) ? form3d : detectStrategy({});

  // 解析
  let glbArray = inputBuf;
  if (Buffer.isBuffer(inputBuf)) {
    glbArray = inputBuf.buffer.slice(inputBuf.byteOffset, inputBuf.byteOffset + inputBuf.byteLength);
  }

  const draco = new DRACOLoader();
  try { draco.setDecoderPath('file://' + path.join(projectRoot, 'public', 'draco', '').replace(/\\/g, '/')); } catch {}

  let gltf;
  try {
    gltf = await new Promise((resolve, reject) => {
      const l = new GLTFLoader();
      l.setDRACOLoader(draco);
      l.parse(glbArray, '', g => resolve(g), e => reject(e));
    });
  } catch (err) {
    // 不带 Draco 重试
    gltf = await new Promise((resolve, reject) => {
      new GLTFLoader().parse(glbArray, '', g => resolve(g), e => reject(e));
    });
  }

  const group = gltf.scene || gltf.scenes[0];
  if (!group) throw new Error('glb 无 scene');

  // 统计法线分布（用于 fallback 推断）
  const normalBuckets = { '+X':0,'-X':0,'+Y':0,'-Y':0,'+Z':0,'-Z':0 };
  let meshCount = 0, totalTriangles = 0;

  // 归一化
  let thicknessEnforcement = null;
  if (normalize) {
    thicknessEnforcement = normalizeGroup(group, strategy.minThickness ?? 0.05);
  }

  // 遍历 mesh —— 挂环/链条跳过
  group.updateMatrixWorld(true);
  group.traverse(obj => {
    if (!obj.isMesh || !obj.geometry) return;
    meshCount++;
    const geom = obj.geometry;

    // 极小 mesh / name 含 ring/chain → 跳过（这些用金属材质，不贴图）
    if (strategy.skipSmallMeshes !== false && isMetalRingMesh(obj)) return;

    const posAttr = geom.attributes.position;
    const faceCount = posAttr.count / 3;
    totalTriangles += faceCount;

    const faceData = remapUVsByNormal(geom, strategy);
    obj.userData._faceData = faceData;  // ← 保存 face 分类，给 split 用

    // 统计法线方向
    const n = new THREE.Vector3();
    const v0=new THREE.Vector3(),v1=new THREE.Vector3(),v2=new THREE.Vector3();
    for (let f=0;f<Math.min(faceCount, 1000);f++) {  // 采样避免太重
      const i0=f*3,i1=f*3+1,i2=f*3+2;
      v0.fromBufferAttribute(posAttr,i0);
      v1.fromBufferAttribute(posAttr,i1);
      v2.fromBufferAttribute(posAttr,i2);
      n.crossVectors(v1.clone().sub(v0), v2.clone().sub(v0)).normalize();
      const dir = classifyFace(n.x,n.y,n.z);
      normalBuckets[dir]++;
    }
  });

  // fallback —— 如果原 form3d 无策略，用推断策略重新跑
  if (!hasStrategy(form3d)) {
    const detected = detectStrategy(normalBuckets);
    // 重跑一次 UV 修复（第一次是默认 cardStack 推断的，现在有真实法线分布）
    const realStrategy = UV_STRATEGIES[detected];
    group.traverse(obj => {
      if (!obj.isMesh || !obj.geometry) return;
      if (realStrategy.skipSmallMeshes !== false && isMetalRingMesh(obj)) return;
      const faceData = remapUVsByNormal(obj.geometry, realStrategy);
      obj.userData._faceData = faceData;
    });
  }

  // ====== 暂时禁用 mesh 拆分（v16 hotfix）======
  // 拆分导致：
  //  1. 子 mesh 边界处各自保留独立法线 → 光照断裂/接缝/棱角
  //  2. 杯把/锥形过渡区域作为 forceSentinel triangle 被拆到 sentinel mesh → 几何体脱离主 mesh
  //  3. 共享顶点被复制 → UV 在边界断开
  //
  // 正确方案：单一 mesh 里保留两种 UV 值——
  //  wrap face 用圆柱 atan2 参数化 → 命中 canvas 设计图区域
  //  sentinel face 用 (0.9999, 0.9999) → 命中 canvas 右上角 paper 色（ClampToEdge）
  // craft-3d.js 自然会把单一 CanvasTexture 注入，sentinel 顶点自动显示 paper 色
  // return group;  // ← 注释掉 split 和强制 paper-mat 覆盖，但保留后面的 export 逻辑

  // ===== mesh 拆分：混合 sentinel + normal UV 的 mesh 拆成两个 =====
  // 马克杯 GLB 通常一个 mesh 里有：外壁(normal UV) + 杯底/杯口/内壁/杯把(sentinel UV)
  // 拆出来 sentinel 部分 → 独立 mesh → paperMat → 前端不需要 CanvasTexture 角落像素
  // 只对 cylindricalWrap 品类做（mug/tumbler/搪瓷杯等）
  // [v16 DISABLED] 拆分破坏边界法线连续性和杯把几何体位置，改用单一 mesh + sentinel UV 方案
  if (false && (strategy?.cylindricalWrap || strategy?.name === 'mug')) {
    const meshesToProcess = [];
    group.traverse(obj => {
      if (!obj.isMesh || !obj.geometry?.attributes?.uv) return;
      if (isMetalRingMesh(obj)) return;
      meshesToProcess.push(obj);
    });
    for (const mesh of meshesToProcess) {
      const geom = mesh.geometry;
      const uvAttr = geom.attributes.uv;
      const posAttr = geom.attributes.position;
      const normAttr = geom.attributes.normal;
      const idxAttr = geom.index;

      // ===== mesh 名带 _sentinel → 全强制 sentinel =====
      // 原因：原始 GLB 可能已经被之前的 split 处理过，
      // node_0_sentinel 这种 mesh 本质上是 sentinel mesh，
      // 里面可能混了 forceWrap triangle（拆分残留），
      // 但它们应该全部归 paperMat，不应该再参与 split。
      const isPreSplitSentinelMesh = (mesh.name || '').endsWith('_sentinel');

      // ===== 根本修复：直接用 faceData 的 forceSentinel 标志！ =====
      // 问题：indexed mesh 里顶点被多个 face 共享，用 UV 值判断 triangle 类型会被共享顶点污染——
      // 比如混合 triangle（1 个 wrap 顶点 UV 正确 + 2 个 sentinel-only 顶点 UV=0.9999），
      // 如果用 UV 值 sentCnt 检查，会因为 sentCnt=2 归 sentinel，但里面那个 wrap 顶点会被米白覆盖！
      // 反过来，如果 triangle 是纯 sentinel 但三个顶点都被 wrap face 共享过（UV 都被写了正确值），
      // sentCnt=0 会被错归 normal，导致 sentinel 顶点出现在 node_0 里显示大面积米白 gap！
      //
      // faceData 是 remapUVsByNormal 构建的、按 index buffer triangle 顺序排列的分类结果，
      // 它基于法线方向+区域位置判定，不依赖 UV 值——所以绝对准确！
      const faceData = mesh.userData._faceData;
      const faceCount = idxAttr ? idxAttr.count / 3 : posAttr.count / 3;
      const sentinelIdx = [];
      const normalIdx = [];
      const sentinelVertSet = new Set();

      for (let f = 0; f < faceCount; f++) {
        const fd = faceData ? faceData[f] : null;
        // 预拆分 sentinel mesh 强制全 sentinel，否则按 faceData 分类
        const isSentTri = isPreSplitSentinelMesh || (fd ? fd.forceSentinel : false);
        const vi = f * 3;
        if (isSentTri) {
          for (let k = 0; k < 3; k++) {
            const i = idxAttr ? idxAttr.getX(vi + k) : vi + k;
            sentinelIdx.push(idxAttr ? i : vi + k);
            sentinelVertSet.add(i);
          }
        } else {
          for (let k = 0; k < 3; k++) {
            const i = idxAttr ? idxAttr.getX(vi + k) : vi + k;
            normalIdx.push(idxAttr ? i : vi + k);
          }
        }
      }

      // 如果 sentinel triangle 有一定比例（>5%），拆分
      const totalTriangles = faceCount;
      const sentTriangleCount = sentinelIdx.length / 3;
      if (sentTriangleCount > totalTriangles * 0.05 && sentTriangleCount > 0) {
        // 构建 sentinel 子几何体
        const sentGeom = new THREE.BufferGeometry();
        // 收集 sentinel 顶点的 position / normal / uv
        const sentPos = [], sentNorm = [], sentUv = [];
        const sentVertMap = new Map();  // 原顶点 index → 新顶点 index
        let newIdx = 0;
        for (const origIdx of sentinelVertSet) {
          sentVertMap.set(origIdx, newIdx);
          sentPos.push(posAttr.getX(origIdx), posAttr.getY(origIdx), posAttr.getZ(origIdx));
          if (normAttr) sentNorm.push(normAttr.getX(origIdx), normAttr.getY(origIdx), normAttr.getZ(origIdx));
          sentUv.push(uvAttr.getX(origIdx), uvAttr.getY(origIdx));
          newIdx++;
        }
        // 构建新的 index buffer（用映射后的新 index）
        const sentNewIdx = [];
        for (let i = 0; i < sentinelIdx.length; i++) {
          sentNewIdx.push(sentVertMap.get(sentinelIdx[i]));
        }

        sentGeom.setAttribute('position', new THREE.Float32BufferAttribute(sentPos, 3));
        if (normAttr) sentGeom.setAttribute('normal', new THREE.Float32BufferAttribute(sentNorm, 3));
        sentGeom.setAttribute('uv', new THREE.Float32BufferAttribute(sentUv, 2));
        sentGeom.setIndex(sentNewIdx);
        if (!normAttr) sentGeom.computeVertexNormals(); // 保留原始平滑法线，避免拆分后接缝“碎裂”

        // 创建 sentinel mesh，放到原 mesh 的父 group 里
        const sentMesh = new THREE.Mesh(sentGeom, _splitPaperMat.clone());
        sentMesh.name = (mesh.name || 'mug') + '_sentinel';
        sentMesh.userData._paperMat = true;
        sentMesh.userData._splitFrom = mesh.name;
        mesh.parent.add(sentMesh);

        // 原 mesh 也裁掉 sentinel triangle（保留 normal triangle）
        // 简化：直接用 normalIdx 重建 index
        if (normalIdx.length > 0) {
          // normal 部分也可能引用 sentinel triangle 的顶点 → 重建
          const normGeom = new THREE.BufferGeometry();
          const normVertSet = new Set();
          for (let i = 0; i < normalIdx.length; i++) normVertSet.add(normalIdx[i]);
          const normPos = [], normNorm = [], normUv = [];
          const normVertMap = new Map();
          let nIdx = 0;
          for (const origIdx of normVertSet) {
            normVertMap.set(origIdx, nIdx);
            normPos.push(posAttr.getX(origIdx), posAttr.getY(origIdx), posAttr.getZ(origIdx));
            if (normAttr) normNorm.push(normAttr.getX(origIdx), normAttr.getY(origIdx), normAttr.getZ(origIdx));
            normUv.push(uvAttr.getX(origIdx), uvAttr.getY(origIdx));
            nIdx++;
          }
          const normNewIdx = normalIdx.map(i => normVertMap.get(i));
          normGeom.setAttribute('position', new THREE.Float32BufferAttribute(normPos, 3));
          if (normAttr) normGeom.setAttribute('normal', new THREE.Float32BufferAttribute(normNorm, 3));
          normGeom.setAttribute('uv', new THREE.Float32BufferAttribute(normUv, 2));
          normGeom.setIndex(normNewIdx);
          if (!normAttr) normGeom.computeVertexNormals(); // 保留原始平滑法线
          mesh.geometry = normGeom;
          mesh.geometry.computeBoundingSphere();
          mesh.geometry.computeBoundingBox();
        } else {
          // 全 sentinel → 把原 mesh 也换成 paperMat
          mesh.material = _splitPaperMat.clone();
          mesh.userData._paperMat = true;
        }

        console.warn(`[UV-Processor] 拆分 mesh "${mesh.name}": ${sentTriangleCount} sentinel triangles → paperMat, ${totalTriangles - sentTriangleCount} normal triangles → canvasMat`);
      }
    }
  }

  // ===== Paper-mat 色覆盖：零面积 UV / sentinel UV 的 mesh 强制换米白纸材质 =====
  // deskCalendar notebook 等品类 ±X/-Z 面 layout=[0,0,0,0]，UV 会被赋 (0,0)
  // mug 等品类 sentinel UV = (0.9999, 0.9999) —— 杯口/杯底/内壁/杯把
  // 混元 GLB 原色常是深棕/深灰，视觉上像脏纸 —— 统一换成米白纸本质感
  const PAPER_COLOR = 0xfaf7f2;     // 米白纸（Hobonichi/Moleskine 同款色）
  const PAPER_ROUGH = 0.85;         // 纸质粗糙感
  const paperMat = new THREE.MeshStandardMaterial({
    color: PAPER_COLOR, roughness: PAPER_ROUGH, metalness: 0.02, side: THREE.DoubleSide
  });
  group.traverse(obj => {
    if (!obj.isMesh || !obj.geometry?.attributes?.uv) return;
    // 跳过金属小 mesh（线圈/挂环）
    if (isMetalRingMesh(obj)) return;
    const uvAttr = obj.geometry.attributes.uv;
    let allZero = true, allSentinel = true;
    for (let i = 0; i < uvAttr.count; i++) {
      const u = uvAttr.getX(i), v = uvAttr.getY(i);
      if (u !== 0 || v !== 0) allZero = false;
      if (!(u >= 0.9998 && v >= 0.9998)) allSentinel = false;
    }
    if (allZero || allSentinel) {
      // 这个 mesh 全部顶点 UV=(0,0) 或 全是 sentinel → 纸边/纯色边/杯底
      obj.material = paperMat;
      obj.userData._paperMat = true;
    }
  });

  // ===== 冰箱贴追加圆形软磁铁子 mesh =====
  // appendMagnet: true 时，在主 mesh 背面（-Y）中心嵌入一块黑色圆形软磁铁
  if (strategy.appendMagnet) {
    let mainMesh = null;
    group.traverse(obj => {
      if (obj.isMesh && !isMetalRingMesh(obj)) mainMesh = obj;
    });
    if (mainMesh) {
      const box = new THREE.Box3().setFromObject(mainMesh);
      const size = new THREE.Vector3(); box.getSize(size);
      const center = new THREE.Vector3(); box.getCenter(center);
      const radius = Math.max(Math.min(size.x, size.z) * 0.45, 0.08);  // 磁铁半径 = 直径 45%（至少 0.08）
      const magnetH = 0.012;                                             // 磁铁厚度 1.2mm
      const magnet = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, magnetH, 32),
        new THREE.MeshStandardMaterial({
          color: 0x2a2a2a,    // 深灰软磁铁（钕铁硼涂层常见色）
          roughness: 0.95,    // 亚光不反光
          metalness: 0.0,     // 橡胶感
        })
      );
      // CylinderGeometry 默认高度沿 Y 轴 → 盘面法线就是 Y 方向
      // 直接放在主 mesh 背面，嵌入 0.0005 防止 z-fighting
      magnet.position.set(center.x, box.min.y + magnetH / 2 - 0.0005, center.z);
      magnet.userData._magnet = true;
      group.add(magnet);
      console.log(`[BFF UV] +magnet r=${radius.toFixed(3)} h=${magnetH} at y=${magnet.position.y.toFixed(3)} (box.min.y=${box.min.y.toFixed(3)})`);
    }
  }

  // 导出（单 mesh + 单 material，前端加载后再按 UV 分 groups）
  const exporter = new GLTFExporter();
  const out = await new Promise((resolve, reject) => {
    exporter.parse(group, r => resolve(r), e => reject(e), { binary: true });
  });

  return {
    buffer: out,
    stats: {
      form3d,
      effectiveForm3d,
      strategy: hasStrategy(form3d) ? form3d : detectStrategy(normalBuckets),
      meshCount,
      triangles: totalTriangles,
      thicknessEnforced: !!thicknessEnforcement?.scaleZ,
      thicknessScale: thicknessEnforcement?.scaleZ || 1,
      inputBytes: glbArray.byteLength,
      outputBytes: out.byteLength,
      strategyVersion: STRATEGIES_VERSION,
    }
  };
}

// 导出工具供外部使用
export { hasStrategy, VALID_FORM3DS, UV_STRATEGIES };
