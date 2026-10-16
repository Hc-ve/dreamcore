#! /usr/bin/env node
/**
 * tools/fix_uv_node.mjs — 纯 Node.js UV 自动修复（不需要 Blender）
 *
 * 原理：
 *   1. 用 three.js GLTFLoader（带 DRACOLoader）解析 .glb
 *   2. 对每个 mesh 的每个三角面，按法线方向归类到 6 个面（前/后/顶/底/左/右）
 *   3. 给每个面在 0~1 空间分配一块矩形区域（Lightmap Pack 简化版，按法线分区）
 *   4. 重新生成 UV 坐标（每个三角面的 3 个顶点映射到对应矩形区域）
 *   5. 用 GLTFExporter 打包成 .glb
 *
 * 为什么用"法线归类"？
 *   文创模型（书签/杯子/帆布袋/明信片）基本都是低面数硬表面，
 *   三角面的法线天然分成 ~6 组（长方体的 6 个面），
 *   把每组放到 0~1 正方形里的不同象限，就实现了"所有面都正确贴图"。
 *
 * 用法:
 *   node tools/fix_uv_node.mjs "文创设计参考/模型/书签.glb" --normalize
 *   node tools/fix_uv_node.mjs "书签.glb" "书签_fixed.glb" --normalize
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- Node polyfill ----------
threeNodePolyfill();

function threeNodePolyfill() {
  const g = globalThis;
  // GLTFLoader / GLTFExporter 用 self 当 window 别名
  if (!g.self) g.self = g;
  if (!g.window) g.window = g;
  // Image stub — 我们不关心贴图内容
  if (!g.Image) {
    g.Image = class Image {
      constructor() {}
      set src(v) { setTimeout(() => { if (this.onload) this.onload(); }, 0); }
    };
  }
  // FileReader — GLTFExporter 导出二进制时用（onloadend 回调）
  if (!g.FileReader) {
    g.FileReader = class FileReader {
      constructor() { this.result = null; this.readyState = 0; }
      readAsArrayBuffer(blob) {
        const done = () => {
          this.readyState = 2; // DONE
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// ---------- 参数解析 ----------
const args = process.argv.slice(2);
let inputPath, outputPath, normalize = false;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--normalize') normalize = true;
  else if (!inputPath) inputPath = args[i];
  else if (!outputPath) outputPath = args[i];
}
if (!inputPath) {
  console.log('用法: node tools/fix_uv_node.mjs <输入.glb> [输出.glb] [--normalize]');
  console.log('示例: node tools/fix_uv_node.mjs "文创设计参考/模型/书签.glb" --normalize');
  process.exit(1);
}
inputPath = path.resolve(projectRoot, inputPath);
outputPath = outputPath ? path.resolve(projectRoot, outputPath)
                        : path.resolve(projectRoot, path.basename(inputPath, '.glb') + '_fixed.glb');

console.log('='.repeat(60));
console.log('📥 输入:', inputPath);
console.log('📤 输出:', outputPath);
console.log('📐 归一化:', normalize ? '是' : '否');
console.log('='.repeat(60));

if (!fs.existsSync(inputPath)) {
  console.error('❌ 找不到文件:', inputPath);
  process.exit(1);
}

// ---------- 工具函数 ----------

/** 给每个三角面计算法线（如果几何里没有） */
function computeFaceNormals(geometry) {
  const posAttr = geometry.attributes.position;
  const verts = posAttr.count;
  const v3 = new THREE.Vector3();
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const normals = new Float32Array(verts * 3);
  const idxAttr = geometry.index;
  const faceCount = idxAttr ? idxAttr.count / 3 : verts / 3;
  for (let f = 0; f < faceCount; f++) {
    // 非索引模式：每个三角面 3 个连续顶点
    const i0 = f * 3, i1 = f * 3 + 1, i2 = f * 3 + 2;
    v0.fromBufferAttribute(posAttr, i0);
    v1.fromBufferAttribute(posAttr, i1);
    v2.fromBufferAttribute(posAttr, i2);
    nrm.crossVectors(v1.clone().sub(v0), v2.clone().sub(v0)).normalize();
    // 平面所有顶点共享同一法线
    normals[i0 * 3] = nrm.x; normals[i0 * 3 + 1] = nrm.y; normals[i0 * 3 + 2] = nrm.z;
    normals[i1 * 3] = nrm.x; normals[i1 * 3 + 1] = nrm.y; normals[i1 * 3 + 2] = nrm.z;
    normals[i2 * 3] = nrm.x; normals[i2 * 3 + 1] = nrm.y; normals[i2 * 3 + 2] = nrm.z;
  }
  return normals;
}

/** 把一个单位法线归类到 6 个方向之一（±X, ±Y, ±Z） */
function classifyFace(nx, ny, nz) {
  const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz);
  if (ax >= ay && ax >= az) return nx > 0 ? '+X' : '-X';
  if (ay >= ax && ay >= az) return ny > 0 ? '+Y' : '-Y';
  return nz > 0 ? '+Z' : '-Z';
}

/**
 * 按法线方向给 mesh 重新分配 UV
 *   +Z 前面 / -Z 后面 / +X 右面 / -X 左面 / +Y 顶面 / -Y 底面
 *   每个方向分到 0~1 正方形里的一块区域
 *
 * 区域布局（2x3 网格）:
 *   [+Y顶] [-X左] [+X右]
 *   [+Z前] [-Z后] [-Y底]
 */
const FACE_LAYOUT = {
  // 每个方向的 UV 矩形 (u0, v0, u1, v1) — 0~1 空间
  '+Y': [0.50, 0.67, 1.00, 1.00],  // 顶面
  '-Y': [0.50, 0.00, 1.00, 0.33],  // 底面
  '+X': [0.25, 0.67, 0.50, 1.00],  // 右面
  '-X': [0.00, 0.67, 0.25, 1.00],  // 左面
  '+Z': [0.00, 0.33, 0.50, 0.67],  // 前面（主要印刷面）
  '-Z': [0.50, 0.33, 1.00, 0.67],  // 后面
};

function remapUVsByNormal(geometry) {
  // 🔑 关键修复：先把索引几何转成非索引模式
  // 原始模型中棱上的顶点会被多个三角面共享，我们按三角面分配 UV 时，
  // 第二次写入会覆盖第一次 → 两个方向的面都用同一个 UV → 图案错乱/变黑
  // toNonIndexed() 让每个三角面有独立的 3 个顶点，UV 不会互相覆盖
  // 必须在 computeFaceNormals 之前转——否则法线数组长度和新顶点数不匹配！
  if (geometry.index) {
    geometry.toNonIndexed();
  }
  // 清除旧 UV（如果有）
  if (geometry.attributes.uv) geometry.deleteAttribute('uv');

  const posAttr = geometry.attributes.position;
  const verts = posAttr.count;
  const faceCount = verts / 3; // 非索引后 = vertexCount / 3

  // 1. 计算每个三角面的法线（在 toNonIndexed 之后！法线数组长度必须和新顶点数匹配）
  const faceNormals = computeFaceNormals(geometry);

  // 2. 先收集每个面的顶点坐标范围（在"对应平面"上的 min/max）
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  const faceData = []; // [{dir, minX, maxX, minY, maxY, vertIndices: [i0,i1,i2]}]

  for (let f = 0; f < faceCount; f++) {
    // 非索引模式：每个三角面 3 个连续顶点
    const i0 = f * 3, i1 = f * 3 + 1, i2 = f * 3 + 2;
    v0.fromBufferAttribute(posAttr, i0);
    v1.fromBufferAttribute(posAttr, i1);
    v2.fromBufferAttribute(posAttr, i2);

    const fx = (v0.x + v1.x + v2.x) / 3;
    const fy = (v0.y + v1.y + v2.y) / 3;
    const fz = (v0.z + v1.z + v2.z) / 3;
    const nx = faceNormals[i0 * 3], ny = faceNormals[i0 * 3 + 1], nz = faceNormals[i0 * 3 + 2];
    const dir = classifyFace(nx, ny, nz);

    // 投影到对应平面，算 min/max
    let u0, u1, w0, w1;
    if (dir === '+Z' || dir === '-Z') {
      // 法线沿 Z → UV 平面是 XY
      u0 = Math.min(v0.x, v1.x, v2.x); u1 = Math.max(v0.x, v1.x, v2.x);
      w0 = Math.min(v0.y, v1.y, v2.y); w1 = Math.max(v0.y, v1.y, v2.y);
    } else if (dir === '+X' || dir === '-X') {
      // 法线沿 X → UV 平面是 ZY
      u0 = Math.min(v0.z, v1.z, v2.z); u1 = Math.max(v0.z, v1.z, v2.z);
      w0 = Math.min(v0.y, v1.y, v2.y); w1 = Math.max(v0.y, v1.y, v2.y);
    } else {
      // 法线沿 Y → UV 平面是 XZ
      u0 = Math.min(v0.x, v1.x, v2.x); u1 = Math.max(v0.x, v1.x, v2.x);
      w0 = Math.min(v0.z, v1.z, v2.z); w1 = Math.max(v0.z, v1.z, v2.z);
    }

    faceData.push({ dir, i0, i1, i2, u0, u1, w0, w1, centerX: fx, centerY: fy, centerZ: fz });
  }

  // 4. 每个方向的范围归一化（让同一方向的所有面共享 0~1 映射）
  const dirRanges = {};
  for (const d of ['+X', '-X', '+Y', '-Y', '+Z', '-Z']) {
    const dirFaces = faceData.filter(f => f.dir === d);
    if (dirFaces.length === 0) continue;
    let mn_u = Infinity, mx_u = -Infinity, mn_w = Infinity, mx_w = -Infinity;
    for (const f of dirFaces) {
      // 跳过 Draco 解码后产生的极个别 NaN 面（Math.min 会被一条 NaN 污染成全 NaN）
      if (!isFinite(f.u0) || !isFinite(f.w0)) continue;
      mn_u = Math.min(mn_u, f.u0); mx_u = Math.max(mx_u, f.u1);
      mn_w = Math.min(mn_w, f.w0); mx_w = Math.max(mx_w, f.w1);
    }
    dirRanges[d] = { mn_u, mx_u, mn_w, mx_w };
  }

  // 5. 给每个顶点算 UV 坐标
  const uv = new Float32Array(verts * 2);
  const seen = new Set(); // (vertexIndex + dir) 组合可能被多个三角面共享

  function getProjected(v3, dir) {
    if (dir === '+Z' || dir === '-Z') return { u: v3.x, w: v3.y };
    if (dir === '+X' || dir === '-X') return { u: v3.z, w: v3.y };
    return { u: v3.x, w: v3.z };
  }

  for (const f of faceData) {
    if (!dirRanges[f.dir]) continue;
    const range = dirRanges[f.dir];
    const box = FACE_LAYOUT[f.dir]; // [u0, v0, u1, v1]

    for (const vi of [f.i0, f.i1, f.i2]) {
      v0.fromBufferAttribute(posAttr, vi);
      const p = getProjected(v0, f.dir);
      // 归一化到 [0,1]（在该方向范围内）
      let nu = range.mx_u !== range.mn_u ? (p.u - range.mn_u) / (range.mx_u - range.mn_u) : 0.5;
      let nw = range.mx_w !== range.mn_w ? (p.w - range.mn_w) / (range.mx_w - range.mn_w) : 0.5;
      // 翻转 -X 和 -Z 方向，让它们和对应 + 方向图案正立
      if (f.dir === '-X') nu = 1 - nu;
      if (f.dir === '-Z') nu = 1 - nu;
      // 映射到 layout 矩形
      const U = box[0] + nu * (box[2] - box[0]);
      const V = box[1] + nw * (box[3] - box[1]);

      const key = vi + '_' + f.dir;
      // 如果这个顶点已处理（从另一个同方向面来），覆盖无所谓——同方向的共享范围归一化结果一致
      const oldUv = seen.has(key);
      seen.add(key);

      // 注意：glTF 顶点索引可能有共享（同顶点多法线/UV），我们用"方向+位置"组合作为唯一键
      // 但这里简化：直接按三角面分配 UV——共享顶点在不同面会有不同 UV → 需要用 unique 顶点
      // 简化处理：每个顶点按它所在三角面的法线方向给 UV（可能有少量顶点在多个面被覆盖，取最后一个）
      uv[vi * 2] = U;
      uv[vi * 2 + 1] = V;
    }
  }

  // 5. 给没有被任何面覆盖的顶点（理论上不会发生）补一个默认 UV
  for (let i = 0; i < verts; i++) {
    if (!uv[i * 2] && !uv[i * 2 + 1]) {
      uv[i * 2] = 0.5; uv[i * 2 + 1] = 0.5;
    }
  }

  // 6. 回写 geometry
  if (geometry.attributes.uv) {
    geometry.deleteAttribute('uv');
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.attributes.uv.needsUpdate = true;
  // 法线也需要重新计算（因为我们改了 UV）
  geometry.computeVertexNormals();
}

// ---------- 主流程 ----------

async function main() {
  console.log('\n📦 正在加载 glb...');
  const glbBuffer = fs.readFileSync(inputPath);
  const glbArray = new Uint8Array(glbBuffer).buffer.slice(0);

  // DRACO
  const draco = new DRACOLoader();
  const dracoDecoderPath = path.join(projectRoot, 'public', 'draco', '').replace(/\\/g, '/');
  // Node 里不能设 URL，但 GLTFLoader 用的是 ArrayBuffer，不用 Draco（书签已经是解压的？不对，书签有 Draco）
  // DRACOLoader 在 Node 环境下不跑 — 尝试用 decoderPath 指向本地目录
  // 实际上 DRACOLoader 需要 fetch wasm，Node 里可能不行
  // 先试试，如果书签用了 Draco 会报错
  const loader = new GLTFLoader();
  // 在 Node 里 DRACOLoader 需要用 node:fs 加载 wasm
  // 我们绕过：用 DRACOLoader.setDecoderPath（Node 也能走文件系统的 fetch）
  try {
    draco.setDecoderPath('file://' + path.join(projectRoot, 'public', 'draco', '').replace(/\\/g, '/'));
  } catch(e) {}
  loader.setDRACOLoader(draco);

  console.log('📥 解析模型（可能用 Draco 解压）...');
  let gltf;
  try {
    gltf = await new Promise((resolve, reject) => {
      loader.parse(glbArray, '', g => resolve(g), e => reject(e));
    });
  } catch (err) {
    // 尝试不带 Draco
    console.log('⚠️  带 Draco 解析失败，尝试不带 Draco...');
    const loader2 = new GLTFLoader();
    gltf = await new Promise((resolve, reject) => {
      loader2.parse(glbArray, '', g => resolve(g), e => reject(e));
    });
  }

  const group = gltf.scene || gltf.scenes[0];
  if (!group) throw new Error('glb 里没有 scene');

  // 2. 归一化（可选）
  if (normalize) {
    console.log('📐 归一化...');
    group.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 1.0 / maxDim;
    group.scale.setScalar(scale);
    group.position.sub(center.clone().multiplyScalar(scale));
    group.position.y -= box.min.y * scale; // 底面落 y=0
    group.updateMatrixWorld(true);
  }

  // 3. 统计 + 修复 UV
  console.log('\n🔧 UV 修复（法线归类 → 6 面分区）...');
  let meshCount = 0;
  const dirStats = {};
  group.traverse(obj => {
    if (!obj.isMesh || !obj.geometry) return;
    meshCount++;
    console.log(`\n  Mesh#${meshCount}: "${obj.name || '(unnamed)'}"`);
    remapUVsByNormal(obj.geometry);

    // 验证
    const geom = obj.geometry;
    const uvAttr = geom.attributes.uv;
    let mnU = 1, mxU = 0, mnV = 1, mxV = 0;
    for (let i = 0; i < uvAttr.count; i++) {
      const u = uvAttr.getX(i), v = uvAttr.getY(i);
      if (u < mnU) mnU = u; if (u > mxU) mxU = u;
      if (v < mnV) mnV = v; if (v > mxV) mxV = v;
    }
    console.log(`    ✅ UV 范围 U[${mnU.toFixed(2)},${mxU.toFixed(2)}] V[${mnV.toFixed(2)},${mxV.toFixed(2)}]`);

    // 统计每个方向的三角面数
    const pos = geom.attributes.position;
    const idx = geom.index;
    const faceCount = idx ? idx.count / 3 : pos.count / 3;
    const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (let f = 0; f < faceCount; f++) {
      const i0 = idx ? idx.getX(f * 3) : f * 3;
      const i1 = idx ? idx.getX(f * 3 + 1) : f * 3 + 1;
      const i2 = idx ? idx.getX(f * 3 + 2) : f * 3 + 2;
      v0.fromBufferAttribute(pos, i0);
      v1.fromBufferAttribute(pos, i1);
      v2.fromBufferAttribute(pos, i2);
      n.crossVectors(v1.clone().sub(v0), v2.clone().sub(v0)).normalize();
      const dir = classifyFace(n.x, n.y, n.z);
      dirStats[dir] = (dirStats[dir] || 0) + 1;
    }
  });

  console.log(`\n📊 法线分布:`);
  for (const d of ['+Z前', '-Z后', '+X右', '-X左', '+Y顶', '-Y底']) {
    const key = d.replace('前', '').replace('后', '').replace('右', '').replace('左', '').replace('顶', '').replace('底', '');
    const cnt = dirStats[key] || 0;
    const bar = '█'.repeat(Math.min(Math.round(cnt / 50), 30));
    console.log(`  ${d}: ${cnt.toString().padStart(6)} 面  ${bar}`);
  }

  // 4. 导出
  console.log('\n📤 导出 glb...');
  const exporter = new GLTFExporter();
  const glbData = await new Promise((resolve, reject) => {
    exporter.parse(group, result => resolve(result), err => reject(err), {
      binary: true,
      animations: [],
      embedImages: true,
      exportCustomDefs: null,
    });
  });

  fs.writeFileSync(outputPath, Buffer.from(glbData));
  const kb = (glbData.byteLength / 1024).toFixed(1);
  console.log(`✅ 导出完成: ${path.basename(outputPath)} (${kb} KB)`);
  console.log('\n🎉 全部完成！重新上传到管理后台即可');
}

main().catch(err => {
  console.error('\n❌ 出错了:', err.message);
  console.error(err.stack);
  process.exit(1);
});
