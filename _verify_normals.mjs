import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { processGlb } from './tools/uv-processor/index.mjs';
import fs from 'node:fs';

const raw = fs.readFileSync('文创设计参考/模型/马克杯 .glb');
const ab = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);

// 1. 走 BFF processGlb（与 HTTP 接口同一条逻辑）
const { buffer: outBuf } = await processGlb(ab, 'mug', { normalize: true });

// 2. 重新加载处理后的 GLB
const gltf = await new GLTFLoader().parseAsync(outBuf.slice(0), '');
const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
const e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
const fn = new THREE.Vector3();

function smoothness(geom) {
  const pos = geom.attributes.position;
  const nor = geom.attributes.normal;
  if (!pos || !nor) return { hasNormal: false };
  const idx = geom.index;
  const faceCount = idx ? idx.count / 3 : pos.count / 3;
  let sumAng = 0, n = 0, flatCount = 0;
  const step = Math.max(1, Math.floor(faceCount / 500));
  const tmp = new THREE.Vector3();
  for (let f = 0; f < faceCount; f += step) {
    const a = idx ? idx.getX(f * 3) : f * 3;
    const b = idx ? idx.getX(f * 3 + 1) : f * 3 + 1;
    const c = idx ? idx.getX(f * 3 + 2) : f * 3 + 2;
    v0.fromBufferAttribute(pos, a); v1.fromBufferAttribute(pos, b); v2.fromBufferAttribute(pos, c);
    fn.crossVectors(e1.subVectors(v1, v0), e2.subVectors(v2, v0)).normalize();
    const na = new THREE.Vector3(nor.getX(a), nor.getY(a), nor.getZ(a)).normalize();
    const ang = na.angleTo(fn) * 180 / Math.PI;
    sumAng += ang; n++;
    if (ang < 1.0) flatCount++; // 顶点法线≈面法线 → 平面平坦着色
  }
  return {
    hasNormal: true,
    vertexCount: pos.count,
    faceCount,
    indexed: !!idx,
    avgAngleToFaceNormal_deg: +(sumAng / n).toFixed(2),
    flatFacePct: +((flatCount / n) * 100).toFixed(1),
  };
}

gltf.scene.traverse(obj => {
  if (!obj.isMesh) return;
  const s = smoothness(obj.geometry);
  console.log(`mesh "${obj.name}" | verts=${s.vertexCount} indexed=${s.indexed} hasNormal=${s.hasNormal} avgAngleToFaceNorm=${s.avgAngleToFaceNormal_deg}deg flatPct=${s.flatFacePct}%`);
});