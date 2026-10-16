// 直接读 glb 的 UV，按法线方向统计范围
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const glbPath = path.join(__dirname, '..', '书签_v7.glb');
const glbUrl = 'file:///' + glbPath.replace(/\\/g, '/');
const gltf = await loader.loadAsync(glbUrl);

gltf.scene.traverse(obj => {
  if (!obj.isMesh) return;
  const geom = obj.geometry;
  const posAttr = geom.attributes.position;
  const uvAttr = geom.attributes.uv;
  if (!uvAttr) { console.log('  ⚠️ NO UV'); return; }

  // 手动算法线
  geom.computeVertexNormals();
  const normAttr = geom.attributes.normal;

  const dirRanges = {};
  for (let i = 0; i < posAttr.count; i++) {
    const nx = normAttr.getX(i), ny = normAttr.getY(i), nz = normAttr.getZ(i);
    let dir;
    if (Math.abs(ny) >= Math.abs(nx) && Math.abs(ny) >= Math.abs(nz)) {
      dir = ny > 0 ? '+Y' : '-Y';
    } else if (Math.abs(nx) >= Math.abs(nz)) {
      dir = nx > 0 ? '+X' : '-X';
    } else {
      dir = nz > 0 ? '+Z' : '-Z';
    }
    const u = uvAttr.getX(i), v = uvAttr.getY(i);
    if (!dirRanges[dir]) dirRanges[dir] = { mnU: 2, mxU: -1, mnV: 2, mxV: -1, count: 0 };
    const r = dirRanges[dir];
    if (u < r.mnU) r.mnU = u; if (u > r.mxU) r.mxU = u;
    if (v < r.mnV) r.mnV = v; if (v > r.mxV) r.mxV = v;
    r.count++;
  }

  console.log(`\n=== Mesh "${obj.name}" UV by direction ===`);
  for (const [d, r] of Object.entries(dirRanges).sort()) {
    console.log(`  ${d}: U[${r.mnU.toFixed(2)},${r.mxU.toFixed(2)}] V[${r.mnV.toFixed(2)},${r.mxV.toFixed(2)}]  verts=${r.count}`);
  }
});
