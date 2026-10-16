import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import fs from 'node:fs';

globalThis.self = globalThis;
globalThis.window = globalThis;
globalThis.Image = class Image {
  constructor() {}
  set src(v) { setTimeout(() => { if (this.onload) this.onload(); }, 0); }
};

function parseGLB(filepath) {
  return new Promise((resolve, reject) => {
    const buffer = fs.readFileSync(filepath);
    const draco = new DRACOLoader();
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    loader.parse(new Uint8Array(buffer).buffer.slice(0), '', g => resolve(g), e => reject(e));
  });
}

const gltf = await parseGLB('书签_fixed.glb');
const group = gltf.scene || gltf.scenes[0];

group.traverse(obj => {
  if (!obj.isMesh) return;
  const geom = obj.geometry;
  const posAttr = geom.attributes.position;
  const uvAttr = geom.attributes.uv;
  
  const faceCount = posAttr.count / 3;
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
  const n = new THREE.Vector3();
  
  // 按法线方向分组，统计每组的 UV 范围
  const dirData = {};
  
  for (let f = 0; f < faceCount; f++) {
    const i0 = f * 3, i1 = f * 3 + 1, i2 = f * 3 + 2;
    v0.fromBufferAttribute(posAttr, i0);
    v1.fromBufferAttribute(posAttr, i1);
    v2.fromBufferAttribute(posAttr, i2);
    n.crossVectors(v1.clone().sub(v0), v2.clone().sub(v0)).normalize();
    
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    let dir;
    if (ax >= ay && ax >= az) dir = n.x > 0 ? '+X' : '-X';
    else if (ay >= ax && ay >= az) dir = n.y > 0 ? '+Y' : '-Y';
    else dir = n.z > 0 ? '+Z' : '-Z';
    
    if (!dirData[dir]) dirData[dir] = { uvs: [], count: 0 };
    dirData[dir].count++;
    
    // 收集每个三角形的 3 个顶点的 UV
    for (const vi of [i0, i1, i2]) {
      const u = uvAttr.getX(vi), v = uvAttr.getY(vi);
      dirData[dir].uvs.push(u, v);
    }
  }
  
  console.log('='.repeat(60));
  console.log('Mesh node_0 各方向 UV 诊断:');
  console.log('='.repeat(60));
  
  for (const dir of ['+Z前', '-Z后', '+X右', '-X左', '+Y顶', '-Y底']) {
    const key = dir.substring(0, 2);
    const d = dirData[key];
    if (!d) continue;
    
    // 计算 UV 范围
    let minU = 2, maxU = -1, minV = 2, maxV = -1;
    for (let i = 0; i < d.uvs.length; i += 2) {
      const u = d.uvs[i], v = d.uvs[i + 1];
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    
    // 检查是否有 NaN 或超范围值
    let nanCount = 0, outOfRange = 0;
    for (let i = 0; i < d.uvs.length; i++) {
      if (!isFinite(d.uvs[i])) nanCount++;
      if (d.uvs[i] < -0.1 || d.uvs[i] > 1.1) outOfRange++;
    }
    
    // 预期 UV 区域（来自 fix_uv_node.mjs 的 FACE_LAYOUT）
    const expected = {
      '+Y': [0.50, 0.67, 1.00, 1.00],
      '-Y': [0.50, 0.00, 1.00, 0.33],
      '+X': [0.25, 0.67, 0.50, 1.00],
      '-X': [0.00, 0.67, 0.25, 1.00],
      '+Z': [0.00, 0.33, 0.50, 0.67],
      '-Z': [0.50, 0.33, 1.00, 0.67],
    }[key];
    
    console.log(`\n  ${dir}: ${d.count} 三角面`);
    console.log(`    实际 UV:  U[${minU.toFixed(3)}, ${maxU.toFixed(3)}]  V[${minV.toFixed(3)}, ${maxV.toFixed(3)}]`);
    console.log(`    预期 UV:  U[${expected[0]}, ${expected[2]}]  V[${expected[1]}, ${expected[3]}]`);
    console.log(`    NaN: ${nanCount}, 超范围: ${outOfRange}`);
    
    // 取前 6 个 UV 样本
    const samples = [];
    for (let i = 0; i < Math.min(12, d.uvs.length); i += 2) {
      samples.push(`(${d.uvs[i].toFixed(3)},${d.uvs[i+1].toFixed(3)})`);
    }
    console.log(`    样本: ${samples.join(' ')}`);
  }
});
