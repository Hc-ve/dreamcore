import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import fs from 'node:fs';

// Node polyfill
globalThis.self = globalThis;
globalThis.window = globalThis;
globalThis.Image = class Image {
  constructor() {}
  set src(v) { setTimeout(() => { if (this.onload) this.onload(); }, 0); }
};

function parseGLB(filepath) {
  return new Promise((resolve, reject) => {
    const buffer = fs.readFileSync(filepath);
    const gltfBuf = new Uint8Array(buffer).buffer.slice(0);
    const draco = new DRACOLoader();
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    loader.parse(gltfBuf, '', g => resolve(g), e => reject(e));
  });
}

for (const label of ['原始', '修复后']) {
  const filepath = label === '原始' 
    ? '文创设计参考/模型/书签.glb' 
    : '书签_fixed.glb';
  console.log('\n' + '='.repeat(60));
  console.log(`📦 ${label}: ${filepath}`);
  console.log('='.repeat(60));
  
  try {
    const gltf = await parseGLB(filepath);
    const group = gltf.scene || gltf.scenes[0];
    let meshIdx = 0;
    
    group.traverse(obj => {
      if (!obj.isMesh) return;
      const geom = obj.geometry;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      const matNames = mats.map(m => {
        if (!m) return 'null';
        let n = m.type;
        if (m.name) n += ` "${m.name}"`;
        n += ` color=${m.color?.getHexString?.() || '?'}`;
        n += ` map=${m.map ? '✅' : '❌'}`;
        if (m.map?.name) n += ` ("${m.map.name}")`;
        n += ` DoubleSide=${m.side === 2 ? '是' : '否'}`;
        return n;
      }).join(' | ');
      
      const uvAttr = geom.attributes?.uv;
      let uvRange = 'NO_UV';
      if (uvAttr) {
        let mnU=1,mxU=0,mnV=1,mxV=0;
        for (let i=0;i<uvAttr.count;i++) {
          const u=uvAttr.getX(i),v=uvAttr.getY(i);
          if(u<mnU)mnU=u; if(u>mxU)mxU=u;
          if(v<mnV)mnV=v; if(v>mxV)mxV=v;
        }
        uvRange = `U[${mnU.toFixed(2)},${mxU.toFixed(2)}] V[${mnV.toFixed(2)},${mxV.toFixed(2)}]`;
      }
      
      const idxCount = geom.index ? geom.index.count / 3 : geom.attributes.position.count / 3;
      console.log(`  🧊 Mesh#${meshIdx++} "${obj.name || '(unnamed)'}"`);
      console.log(`     三角面: ${idxCount}, 顶点: ${geom.attributes.position?.count || '?'}`);
      console.log(`     材质数: ${mats.length}`);
      console.log(`     ${matNames}`);
      console.log(`     UV: ${uvRange}`);
    });
  } catch(e) {
    console.log('❌ 解析失败:', e.message?.substring(0,100));
  }
}
