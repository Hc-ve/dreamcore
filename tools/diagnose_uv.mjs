// 深入分析原始 UV 质量 — 检查是否重叠/错乱/映射错误
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

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
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    if (!uv) { console.log('没有原始 UV！'); return; }
    
    const idxAttr = g.index;
    const faceCount = idxAttr ? idxAttr.count/3 : pos.count/3;
    
    console.log('=== 原始 UV 深度分析 ===');
    console.log(`UV 顶点数: ${uv.count}, 几何顶点数: ${pos.count}`);
    
    // 检查 UV 是否有重叠（同一 UV 坐标被多个不相连的三角面共用）
    const getVert = (attr, i) => [attr.getX(i), attr.getY(i), attr.getZ(i)];
    const norm = (a,b,c) => {
      const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2];
      const vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
      const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
      const l=Math.hypot(nx,ny,nz)||1;
      return [nx/l,ny/l,nz/l];
    };
    
    // UV 面积分析：每个三角面的 UV 面积 vs 物理面积
    let uvArea = 0, physArea = 0;
    let bigDistortion = 0; // UV面积 vs 物理面积比例差异很大的面
    const distortionSamples = [];
    
    for(let f=0;f<faceCount;f++){
      let i0,i1,i2;
      if(idxAttr){i0=idxAttr.getX(f*3);i1=idxAttr.getX(f*3+1);i2=idxAttr.getX(f*3+2);}
      else{i0=f*3;i1=f*3+1;i2=f*3+2;}
      
      const p0 = [pos.getX(i0), pos.getY(i0), pos.getZ(i0)];
      const p1 = [pos.getX(i1), pos.getY(i1), pos.getZ(i1)];
      const p2 = [pos.getX(i2), pos.getY(i2), pos.getZ(i2)];
      const u0 = [uv.getX(i0), uv.getY(i0)];
      const u1 = [uv.getX(i1), uv.getY(i1)];
      const u2 = [uv.getX(i2), uv.getY(i2)];
      
      const phys = Math.hypot(p1[0]-p0[0],p1[1]-p0[1],p1[2]-p0[2])
                 * Math.hypot(p2[0]-p0[0],p2[1]-p0[1],p2[2]-p0[2]) / 2;
      const uva = Math.abs((u1[0]-u0[0])*(u2[1]-u0[1])-(u2[0]-u0[0])*(u1[1]-u0[1])) / 2;
      
      physArea += phys;
      uvArea += uva;
      
      if (phys > 0.00001) {
        const ratio = uva / phys;
        if (ratio > 5 || ratio < 0.05) {
          bigDistortion++;
          if (distortionSamples.length < 5) {
            distortionSamples.push({ face: f, phys: phys.toFixed(5), uvArea: uva.toFixed(5), ratio: ratio.toFixed(2) });
          }
        }
      }
    }
    
    console.log(`总物理面积: ${physArea.toFixed(4)}`);
    console.log(`总 UV 面积: ${uvArea.toFixed(4)}`);
    console.log(`UV/物理 比例: ${(uvArea/physArea*100).toFixed(1)}%`);
    console.log(`严重失真面(比例异常): ${bigDistortion} / ${faceCount} (${(bigDistortion/faceCount*100).toFixed(2)}%)`);
    for (const s of distortionSamples) console.log('  ', JSON.stringify(s));
    
    // 检查 UV 三角形重叠（网格化统计）
    const gridSize = 32; // 32x32 网格
    const grid = new Int32Array(gridSize * gridSize);
    const faceGridHits = new Map(); // face -> Set<grid cells>
    
    for(let f=0;f<faceCount;f++){
      let i0,i1,i2;
      if(idxAttr){i0=idxAttr.getX(f*3);i1=idxAttr.getX(f*3+1);i2=idxAttr.getX(f*3+2);}
      else{i0=f*3;i1=f*3+1;i2=f*3+2;}
      
      const u0v0 = [uv.getX(i0), uv.getY(i0)];
      const u1v1 = [uv.getX(i1), uv.getY(i1)];
      const u2v2 = [uv.getX(i2), uv.getY(i2)];
      
      // 三角面的 UV bbox
      const mnU = Math.min(u0v0[0],u1v1[0],u2v2[0]);
      const mxU = Math.max(u0v0[0],u1v1[0],u2v2[0]);
      const mnV = Math.min(u0v0[1],u1v1[1],u2v2[1]);
      const mxV = Math.max(u0v0[1],u1v1[1],u2v2[1]);
      
      const g0 = Math.max(0, Math.min(gridSize-1, Math.floor(mnU*gridSize)));
      const g1 = Math.max(0, Math.min(gridSize-1, Math.floor(mxU*gridSize)));
      const v0 = Math.max(0, Math.min(gridSize-1, Math.floor(mnV*gridSize)));
      const v1 = Math.max(0, Math.min(gridSize-1, Math.floor(mxV*gridSize)));
      
      for(let gu=g0;gu<=g1;gu++){
        for(let gv=v0;gv<=v1;gv++){
          grid[gv*gridSize+gu]++;
        }
      }
    }
    
    let multiHitCells = 0;
    let maxHit = 0;
    for(let i=0;i<grid.length;i++){
      if(grid[i]>1) multiHitCells++;
      if(grid[i]>maxHit) maxHit = grid[i];
    }
    
    console.log(`\nUV 网格重叠检测(${gridSize}x${gridSize}):`);
    console.log(`  被 0 个三角面覆盖的格子: ${grid.filter(x=>x===0).length} (${(grid.filter(x=>x===0).length/grid.length*100).toFixed(1)}%)`);
    console.log(`  被 1 个三角面覆盖的格子: ${grid.filter(x=>x===1).length}`);
    console.log(`  被 2+ 三角面覆盖的格子: ${multiHitCells} (重叠区域！)`);
    console.log(`  单格最大命中: ${maxHit}`);
    
    // 打印一个简化的 UV 占用图（16x8）
    console.log('\nUV 占用热力图（16x8）:');
    const smallGridU = 16, smallGridV = 8;
    const sg = new Int32Array(smallGridU * smallGridV);
    for(let f=0;f<faceCount;f++){
      let i0,i1,i2;
      if(idxAttr){i0=idxAttr.getX(f*3);i1=idxAttr.getX(f*3+1);i2=idxAttr.getX(f*3+2);}
      else{i0=f*3;i1=f*3+1;i2=f*3+2;}
      const mnU = Math.min(uv.getX(i0),uv.getX(i1),uv.getX(i2));
      const mxU = Math.max(uv.getX(i0),uv.getX(i1),uv.getX(i2));
      const mnV = Math.min(uv.getY(i0),uv.getY(i1),uv.getY(i2));
      const mxV = Math.max(uv.getY(i0),uv.getY(i1),uv.getY(i2));
      for(let gu=Math.floor(mnU*smallGridU);gu<=Math.min(smallGridU-1,Math.floor(mxU*smallGridU));gu++){
        for(let gv=Math.floor(mnV*smallGridV);gv<=Math.min(smallGridV-1,Math.floor(mxV*smallGridV));gv++){
          sg[gv*smallGridU+gu]++;
        }
      }
    }
    const maxS = Math.max(...sg);
    const dots = ' .:-=+*#%@';
    for(let v=0;v<smallGridV;v++){
      let row = '';
      for(let u=0;u<smallGridU;u++){
        const n = sg[v*smallGridU+u];
        const ch = n === 0 ? '.' : dots[Math.min(dots.length-1, Math.floor(n/maxS*(dots.length-1)))];
        row += ch;
      }
      console.log(`  V=${((smallGridV-1-v)/smallGridV).toFixed(2)}: ${row}`);
    }
    console.log('  U=0                                    U=1');
    
    // === 同样分析 fixed 模型 ===
    const fixedPath = path.join(root, '书签_fixed.glb');
    if (fs.existsSync(fixedPath)) {
      console.log('\n\n========================================');
      console.log('=== 对比：修复后模型的 UV 分析 ===');
      const loader2 = new GLTFLoader();
      const draco2 = new DRACOLoader();
      draco2.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      loader2.setDRACOLoader(draco2);
      const buf2 = fs.readFileSync(fixedPath);
      loader2.parse(buf2.buffer.slice(buf2.byteOffset, buf2.byteOffset + buf2.byteLength), '', (g2) => {
        g2.scene.traverse(o => {
          if (!o.isMesh) return;
          const gg = o.geometry;
          const pos2 = gg.attributes.position;
          const uv2 = gg.attributes.uv;
          if (!uv2) { console.log('修复模型没有 UV！'); return; }
          const idx2 = gg.index;
          const fc2 = idx2 ? idx2.count/3 : pos2.count/3;
          console.log(`面数: ${fc2}, 原始面数: ${faceCount}`);
          
          let mn=[2,2],mx=[-2,-2];
          for(let i=0;i<uv2.count;i++){
            mn[0]=Math.min(mn[0],uv2.getX(i)); mn[1]=Math.min(mn[1],uv2.getY(i));
            mx[0]=Math.max(mx[0],uv2.getX(i)); mx[1]=Math.max(mx[1],uv2.getY(i));
          }
          console.log(`UV 范围: U[${mn[0].toFixed(3)},${mx[0].toFixed(3)}] V[${mn[1].toFixed(3)},${mx[1].toFixed(3)}]`);
          
          // 同一样的热力图
          const sg2 = new Int32Array(smallGridU * smallGridV);
          for(let f=0;f<fc2;f++){
            let i0,i1,i2;
            if(idx2){i0=idx2.getX(f*3);i1=idx2.getX(f*3+1);i2=idx2.getX(f*3+2);}
            else{i0=f*3;i1=f*3+1;i2=f*3+2;}
            const mnU = Math.min(uv2.getX(i0),uv2.getX(i1),uv2.getX(i2));
            const mxU = Math.max(uv2.getX(i0),uv2.getX(i1),uv2.getX(i2));
            const mnV = Math.min(uv2.getY(i0),uv2.getY(i1),uv2.getY(i2));
            const mxV = Math.max(uv2.getY(i0),uv2.getY(i1),uv2.getY(i2));
            for(let gu=Math.floor(mnU*smallGridU);gu<=Math.min(smallGridU-1,Math.floor(mxU*smallGridU));gu++){
              for(let gv=Math.floor(mnV*smallGridV);gv<=Math.min(smallGridV-1,Math.floor(mxV*smallGridV));gv++){
                sg2[gv*smallGridU+gu]++;
              }
            }
          }
          const maxS2 = Math.max(...sg2);
          console.log('\n修复后 UV 热力图（16x8）:');
          for(let v=0;v<smallGridV;v++){
            let row = '';
            for(let u=0;u<smallGridU;u++){
              const n = sg2[v*smallGridU+u];
              const ch = n === 0 ? '.' : dots[Math.min(dots.length-1, Math.floor(n/maxS2*(dots.length-1)))];
              row += ch;
            }
            console.log(`  V=${((smallGridV-1-v)/smallGridV).toFixed(2)}: ${row}`);
          }
          console.log('  U=0                                    U=1');
          process.exit(0);
        });
      });
    } else {
      console.log('\n(跳过 fixed 模型对比，文件不存在)');
    }
  });
});
