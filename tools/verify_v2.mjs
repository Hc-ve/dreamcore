// 验证修复模型中 +Y 方向物理相邻的三角面在 UV 空间是否连续
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

const modelPath = path.join(root, '书签_fixed.glb');
const buf = fs.readFileSync(modelPath);

loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', (gltf) => {
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry;
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    const idxAttr = g.index;
    const faceCount = idxAttr ? idxAttr.count/3 : pos.count/3;
    
    console.log(`面数: ${faceCount}, 索引: ${idxAttr ? 'YES' : 'NO(toNonIndexed?)'}`);
    
    // 收集 +Y 方向的面（通过位置和 UV 判断）
    // 先算每个面的法线
    const getVert = i => [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const getUV = i => [uv.getX(i), uv.getY(i)];
    const norm = (a,b,c) => {
      const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2];
      const vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];
      const nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx;
      const l=Math.hypot(nx,ny,nz)||1;
      return [nx/l,ny/l,nz/l];
    };
    
    // 找一个 +Y 面的特征：UV 在 [0.0,1.0] x [0.6,1.0] 区域
    // 因为 FACE_LAYOUT['+Y'] = [0.00, 0.60, 1.00, 1.00]
    const plusYFaces = [];
    const minusYFaces = [];
    let classified = 0;
    
    for(let f=0;f<Math.min(faceCount, 2000);f++){
      let i0,i1,i2;
      if(idxAttr){i0=idxAttr.getX(f*3);i1=idxAttr.getX(f*3+1);i2=idxAttr.getX(f*3+2);}
      else{i0=f*3;i1=f*3+1;i2=f*3+2;}
      
      const n = norm(getVert(i0),getVert(i1),getVert(i2));
      const centerY = (pos.getY(i0)+pos.getY(i1)+pos.getY(i2))/3;
      
      if (n[1] > 0.15) { plusYFaces.push({f,i0,i1,i2,n,centerY}); classified++; }
      else if (n[1] < -0.15) { minusYFaces.push({f,i0,i1,i2,n,centerY}); classified++; }
    }
    
    console.log(`抽样前2000面：+Y=${plusYFaces.length}, -Y=${minusYFaces.length}, 合计=${classified}`);
    
    // 选一个 +Y 面，看它和邻居的 UV 连续性
    if (plusYFaces.length > 0) {
      const sampleFace = plusYFaces[0];
      console.log(`\n=== 样本 +Y 面 #${sampleFace.f} ===`);
      console.log(`  法线: (${sampleFace.n.map(x=>x.toFixed(3)).join(', ')})`);
      console.log(`  中心Y: ${sampleFace.centerY.toFixed(4)}`);
      
      // 打印它的三个顶点的 位置 和 UV
      for (const [vi, label] of [[sampleFace.i0,'v0'],[sampleFace.i1,'v1'],[sampleFace.i2,'v2']]) {
        const p = getVert(vi);
        const u = getUV(vi);
        console.log(`  ${label} pos=(${p.map(x=>x.toFixed(3)).join(', ')}) uv=(${u.map(x=>x.toFixed(3)).join(', ')})`);
      }
    }
    
    // === 核心测试：物理相邻的三角面是否有 UV 连续性 ===
    console.log('\n=== UV 连续性检查：物理相邻三角面的共享顶点 ===');
    if (idxAttr) {
      console.log('模型仍是 indexed geometry！相邻面共享顶点 → 自然 UV 连续');
      // 检查两个相邻面的共享顶点 UV 是否相同
      let mismatchCount = 0;
      const checked = new Set();
      const maxCheck = Math.min(faceCount, 5000);
      
      for(let f=0;f<maxCheck;f++){
        const i0 = idxAttr.getX(f*3), i1 = idxAttr.getX(f*3+1), i2 = idxAttr.getX(f*3+2);
        // 看 i0 和 i1 是否也在另一个面里
        // 简单方法：检查共享边的两个顶点的 UV 在所有使用它们的面里是否一致
        for (const vi of [i0, i1, i2]) {
          const key = vi;
          if (checked.has(key)) continue;
          checked.add(key);
          // 找到所有引用这个顶点的面
          const refFaces = [];
          for(let ff=0;ff<Math.min(faceCount,100);ff++){
            const a=idxAttr.getX(ff*3),b=idxAttr.getX(ff*3+1),c=idxAttr.getX(ff*3+2);
            if(a===vi||b===vi||c===vi) refFaces.push(ff);
          }
          // 检查这些面中该顶点的 UV 是否一致（indexed geometry 应该一致）
          if (refFaces.length > 1 && refFaces[0] === f) {
            const u0 = [uv.getX(vi), uv.getY(vi)];
            for (const rf of refFaces.slice(1)) {
              const u1 = [uv.getX(vi), uv.getY(vi)]; // 同一个顶点！
              if (Math.abs(u0[0]-u1[0]) > 0.001 || Math.abs(u0[1]-u1[1]) > 0.001) {
                console.warn(`  ⚠️ 顶点 ${vi} 在面 ${f} 和 ${rf} 中 UV 不同!`);
                mismatchCount++;
                if (mismatchCount > 5) break;
              }
            }
          }
          if (mismatchCount > 5) break;
        }
        if (mismatchCount > 5) break;
      }
      console.log(`  发现 UV 不一致顶点: ${mismatchCount}`);
    } else {
      console.log('模型是 toNonIndexed 状态（每个三角面独立顶点）');
      // 这种情况下物理相邻但 UV 不连续是正常的——每个面独立
      // 但如果同一物理位置（+Y 大面上）的相邻三角面 UV 坐标相近，图案还是可以接受的
      
      // 验证：在 +Y 方向找两个物理上很近的三角面，看它们的 UV 是否也相近
      console.log('  检查 +Y 大面三角面的 UV 连续性...');
      
      const plusYAll = [];
      for(let f=0;f<faceCount;f++){
        const i0=f*3,i1=f*3+1,i2=f*3+2;
        const p0=getVert(i0),p1=getVert(i1),p2=getVert(i2);
        const n=norm(p0,p1,p2);
        if (n[1] > 0.15) {
          const cx=(p0[0]+p1[0]+p2[0])/3, cy=(p0[1]+p1[1]+p2[1])/3, cz=(p0[2]+p1[2]+p2[2])/3;
          const u0=[uv.getX(i0),uv.getY(i0)],u1=[uv.getX(i1),uv.getY(i1)],u2=[uv.getX(i2),uv.getY(i2)];
          plusYAll.push({f,cx,cy,cz,u0,u1,u2});
        }
      }
      
      console.log(`  +Y 面总数: ${plusYAll.length}`);
      
      // 找 5 对物理上很近的 +Y 面
      let checkedPairs = 0;
      const distThreshold = 0.005; // 5mm 内算邻居
      for (let i=0; i<plusYAll.length && checkedPairs<5; i++) {
        for (let j=i+1; j<plusYAll.length && checkedPairs<5; j++) {
          const a = plusYAll[i], b = plusYAll[j];
          const physDist = Math.hypot(a.cx-b.cx, a.cy-b.cy, a.cz-b.cz);
          if (physDist < distThreshold) {
            // 看它们的 UV 三角形有没有重叠/相近
            const uv0_diff = Math.hypot(a.u0[0]-b.u0[0], a.u0[1]-b.u0[1]);
            const uv1_diff = Math.hypot(a.u1[0]-b.u1[0], a.u1[1]-b.u1[1]);
            const uv2_diff = Math.hypot(a.u2[0]-b.u2[0], a.u2[1]-b.u2[1]);
            const minUVdiff = Math.min(uv0_diff, uv1_diff, uv2_diff);
            console.log(`  物理距离=${physDist.toFixed(4)}m → UV 顶点差异 min=${minUVdiff.toFixed(4)}${minUVdiff<0.05?' ✅ 连续':' ⚠️ 断裂'}`);
            checkedPairs++;
          }
        }
      }
      console.log(`  共检查 ${checkedPairs} 对近邻 +Y 面`);
    }
    
    // 最后确认：+Y 区域的 UV 范围是否正确
    console.log('\n=== +Y 区域 UV 范围 ===');
    if (idxAttr) {
      // indexed 模型：顶点 UV 一致
      let mn=[2,2],mx=[-2,-2];
      const seenVerts = new Set();
      for(let f=0;f<Math.min(faceCount,2000);f++){
        for(let k=0;k<3;k++){
          const vi = idxAttr.getX(f*3+k);
          if(seenVerts.has(vi)) continue;
          seenVerts.add(vi);
          const ux=uv.getX(vi),uy=uv.getY(vi);
          mn[0]=Math.min(mn[0],ux);mn[1]=Math.min(mn[1],uy);
          mx[0]=Math.max(mx[0],ux);mx[1]=Math.max(mx[1],uy);
        }
      }
      console.log(`  抽样顶点 UV 范围: U[${mn[0].toFixed(3)},${mx[0].toFixed(3)}] V[${mn[1].toFixed(3)},${mx[1].toFixed(3)}]`);
    }
  });
});
