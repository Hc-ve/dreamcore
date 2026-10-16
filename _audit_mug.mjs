import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'node:fs';
const buf = fs.readFileSync('mug_v13_fixed.glb');
const arr = Buffer.isBuffer(buf)
  ? buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  : buf;
const gltf = await new Promise((res, rej) => new GLTFLoader().parse(arr, '', res, rej));
const group = gltf.scene || gltf.scenes[0];
let totalMesh = 0;
group.traverse(obj => {
  if (!obj.isMesh) return;
  totalMesh++;
  const uv = obj.geometry.attributes?.uv;
  const pos = obj.geometry.attributes.position;
  let sent=0, zero=0, mixed=0;
  if (uv) {
    for (let i=0;i<uv.count;i++) {
      const u=uv.getX(i),v=uv.getY(i);
      if (u>=0.9998&&v>=0.9998) sent++;
      else if (Math.abs(u)<0.001&&Math.abs(v)<0.001) zero++;
      else mixed++;
    }
  }
  const mcol = obj.material?.color ? '0x'+obj.material.color.getHexString() : 'none';
  const rough = obj.material?.roughness ?? '?';
  console.log('Mesh[' + totalMesh + '] name=' + obj.name);
  console.log('  verts=' + pos.count + ' tri=' + (pos.count/3));
  console.log('  sentinel=' + sent + ' zero=' + zero + ' mixed(外壁wrap)=' + mixed);
  console.log('  sentPct=' + ((sent+zero)/uv.count*100).toFixed(1) + '%');
  console.log('  mat color=' + mcol + ' roughness=' + rough + ' paperMat=' + (obj.userData._paperMat || false));
});
console.log('');
console.log('=== 总 mesh 数: ' + totalMesh + ' ===');
