// 诊断模型几何特征 — 纯 ESM
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// Polyfills for Node.js Three.js
globalThis.self = globalThis;
class Image {} globalThis.Image = Image;
class FileReader { readAsArrayBuffer(){} addEventListener(){} }
globalThis.FileReader = FileReader;

const _dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(_dir, '..');

const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
loader.setDRACOLoader(draco);

const modelPath = path.join(root, '文创设计参考/模型/书签.glb');
const buf = fs.readFileSync(modelPath);
loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (gltf) => {
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry;
    g.computeBoundingBox();
    const b = g.boundingBox;
    const dx = b.max.x - b.min.x;
    const dy = b.max.y - b.min.y;
    const dz = b.max.z - b.min.z;
    console.log('=== 书签几何特征 ===');
    console.log(`尺寸: ${dx.toFixed(4)} x ${dy.toFixed(4)} x ${dz.toFixed(4)}`);
    const sides = [[dx,'X'],[dy,'Y'],[dz,'Z']].sort((a,b)=>b[0]-a[0]);
    console.log(`主轴从大到小: ${sides.map(s=>s[1]+'='+s[0].toFixed(4)).join(' > ')}`);
    const thick = sides[2][0];
    const long = sides[0][0];
    console.log(`厚度/长边比: ${(thick/long*100).toFixed(1)}%  ${thick/long<0.1?'✅ 典型薄板':'⚠️ 非薄板'}`);
    
    const faceCount = g.index ? g.index.count/3 : g.attributes.position.count/3;
    console.log(`面数: ${faceCount}, 顶点数: ${g.attributes.position.count}`);
    
    if (g.attributes.uv) {
      const uv = g.attributes.uv;
      let mn=[2,2],mx=[-2,-2];
      for(let i=0;i<uv.count;i++){
        mn[0]=Math.min(mn[0],uv.getX(i)); mn[1]=Math.min(mn[1],uv.getY(i));
        mx[0]=Math.max(mx[0],uv.getX(i)); mx[1]=Math.max(mx[1],uv.getY(i));
      }
      console.log(`原始 UV 范围: U[${mn[0].toFixed(3)},${mx[0].toFixed(3)}] V[${mn[1].toFixed(3)},${mx[1].toFixed(3)}]`);
    } else {
      console.log('⚠️ 模型没有原始 UV');
    }
    
    const pos = g.attributes.position;
    const idxAttr = g.index;
    const getVert = i => [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const norm = (a,b,c) => {
      const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2];
      const vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
      const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
      const l=Math.hypot(nx,ny,nz)||1;
      return [nx/l,ny/l,nz/l];
    };
    
    const strict = { '+X':0,'-X':0,'+Y':0,'-Y':0,'+Z':0,'-Z':0,'blend':0 };
    const loose  = { '+X':0,'-X':0,'+Y':0,'-Y':0,'+Z':0,'-Z':0 };
    const angleBins = {};
    const sampleSize = Math.min(faceCount, 15000);
    const step = faceCount > sampleSize ? faceCount/sampleSize : 1;
    
    let boundaryCount = 0;
    let boundaryExamples = [];
    
    for(let f=0;f<faceCount;f+=step){
      const fi = Math.floor(f);
      let i0,i1,i2;
      if(idxAttr){i0=idxAttr.getX(fi*3);i1=idxAttr.getX(fi*3+1);i2=idxAttr.getX(fi*3+2);}
      else{i0=fi*3;i1=fi*3+1;i2=fi*3+2;}
      const n = norm(getVert(i0),getVert(i1),getVert(i2));
      const ax=Math.abs(n[0]),ay=Math.abs(n[1]),az=Math.abs(n[2]);
      
      if (ax>0.95) strict[n[0]>0?'+X':'-X']++;
      else if (ay>0.95) strict[n[1]>0?'+Y':'-Y']++;
      else if (az>0.95) strict[n[2]>0?'+Z':'-Z']++;
      else strict['blend']++;
      
      if (ax>=ay&&ax>=az) loose[n[0]>0?'+X':'-X']++;
      else if (ay>=ax&&ay>=az) loose[n[1]>0?'+Y':'-Y']++;
      else loose[n[2]>0?'+Z':'-Z']++;
      
      const angY = Math.acos(Math.max(-1,Math.min(1,n[1]))) * 180/Math.PI;
      const bin = Math.round(angY/15)*15;
      angleBins[bin] = (angleBins[bin]||0)+1;
      
      const sorted = [ax,ay,az].sort((a,b)=>b-a);
      const gap = sorted[0] - sorted[1];
      if (gap < 0.15) {
        boundaryCount++;
        if (boundaryExamples.length < 3) {
          boundaryExamples.push({ face: fi, normal: [n[0].toFixed(3),n[1].toFixed(3),n[2].toFixed(3)] });
        }
      }
    }
    
    console.log('\n=== 法线分类对比 ===');
    console.log('严格(单主轴>0.95) — 真正属于某一平面的面:');
    for(const [k,v] of Object.entries(strict)) console.log(`  ${k}: ${v} (${(v/sampleSize*100).toFixed(1)}%)`);
    console.log('宽松(argmax,当前脚本用的) — 强制每个面归类:');
    for(const [k,v] of Object.entries(loose)) console.log(`  ${k}: ${v} (${(v/sampleSize*100).toFixed(1)}%)`);
    
    console.log('\n=== 法线-Y轴角度分布 ===');
    for(const [k,v] of Object.entries(angleBins).sort((a,b)=>+a[0]-+b[0])) {
      const pct = v/sampleSize*100;
      const bar = '█'.repeat(Math.max(1, Math.round(pct/2)));
      console.log(`  ${k}°: ${bar} ${v} (${pct.toFixed(1)}%)`);
    }
    
    console.log(`\n=== 边界/圆角面 ===`);
    console.log(`两主轴差距<0.15 的边界面: ${boundaryCount} / ${sampleSize} (${(boundaryCount/sampleSize*100).toFixed(1)}%)`);
    for (const ex of boundaryExamples) console.log('  ', JSON.stringify(ex));
  });
});
