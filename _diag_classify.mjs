import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'node:fs';

const g = globalThis;
if (!g.self) g.self = g;
if (!g.window) g.window = g;
if (!g.Image) { g.Image = class { constructor(){} set src(v){ setTimeout(()=>{ if(this.onload)this.onload(); },0); } }; }
if (!g.FileReader) { g.FileReader = class { constructor(){this.result=null;} readAsArrayBuffer(blob){ if(blob&&typeof blob.arrayBuffer==='function'){ blob.arrayBuffer().then(b=>{this.result=b; if(this.onload)this.onload({target:this});}); } } }; }

const raw = fs.readFileSync('文创设计参考/模型/马克杯 .glb');
const ab = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
const gltf = await new GLTFLoader().parseAsync(ab, '');

gltf.scene.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(gltf.scene);
const size = box.getSize(new THREE.Vector3());
const center = box.getCenter(new THREE.Vector3());
console.log('包围盒 size:', size.toArray().map(v=>+v.toFixed(3)), ' center:', center.toArray().map(v=>+v.toFixed(3)));

gltf.scene.traverse(obj => {
  if (!obj.isMesh || !obj.geometry) return;
  const geom = obj.geometry;
  const pos = geom.attributes.position;
  const idx = geom.index;
  const faceCount = idx ? idx.count / 3 : pos.count / 3;

  const v0=new THREE.Vector3(),v1=new THREE.Vector3(),v2=new THREE.Vector3();
  const e1=new THREE.Vector3(),e2=new THREE.Vector3(),fn=new THREE.Vector3();

  // 用包围盒中心近似轴（先观察偏移）
  const cx = center.x, cz = center.z;
  // 统计每类 face 数量 + 面积
  let counts = { outerWall:0, innerWall:0, bottom:0, rim:0, handle:0, other:0 };
  let areas = { outerWall:0, innerWall:0, bottom:0, rim:0, handle:0, other:0 };

  // 累计所有 face 的位置加权质心，用于估算真实圆柱轴（外壁为主）
  let wallCx=0, wallCz=0, wallN=0, wallCount=0;

  // 先粗扫一遍，把近似外壁的 face 收集起来（法线接近水平且半径近最大）
  const faces = [];
  for (let f=0; f<faceCount; f++){
    const a = idx?idx.getX(f*3):f*3, b=idx?idx.getX(f*3+1):f*3+1, c=idx?idx.getX(f*3+2):f*3+2;
    v0.fromBufferAttribute(pos,a); v1.fromBufferAttribute(pos,b); v2.fromBufferAttribute(pos,c);
    fn.crossVectors(e1.subVectors(v1,v0), e2.subVectors(v2,v0));
    const area = fn.length()/2; fn.normalize();
    const fx=(v0.x+v1.x+v2.x)/3, fy=(v0.y+v1.y+v2.y)/3, fz=(v0.z+v1.z+v2.z)/3;
    faces.push({fx,fy,fz,nx:fn.x,ny:fn.y,nz:fn.z,area});
  }

  // y 范围
  let yMin=Infinity,yMax=-Infinity;
  for(const f of faces){ if(f.fy<yMin)yMin=f.fy; if(f.fy>yMax)yMax=f.fy; }
  const yRange=yMax-yMin||1;

  // 估算轴：取法线接近水平(|ny|<0.3) 且最靠外的 face，用其径向中心反推轴
  // 用 RANSAC 简化：所有 |ny|<0.5 的 face，其质心水平投影应落在一个圆上，圆心=轴
  // 简单法：对 |ny|<0.5 的 face，收集 (fx, fz, nx, nz)，轴 ≈ 质心
  let sx=0, sz=0, sn=0;
  for(const f of faces){
    if(Math.abs(f.ny) < 0.5){
      sx+=f.fx; sz+=f.fz; sn++;
    }
  }
  const axisX = sx/sn, axisZ = sz/sn;
  console.log('估算轴(含杯柄噪声) axisX=',axisX.toFixed(3),'axisZ=',axisZ.toFixed(3));

  // 重新以估算轴分类
  for(const f of faces){
    const fy=f.fy, fx=f.fx, fz=f.fz;
    const dx=fx-axisX, dz=fz-axisZ;
    const faceR=Math.sqrt(dx*dx+dz*dz);
    const rd=Math.max(faceR,1e-6);
    const radialDot=(f.nx*dx + f.nz*dz)/rd;
    const ay=Math.abs(f.ny);
    const yPct=(fy-yMin)/yRange;

    let cls;
    if(yPct>0.90 || yPct<0.10) cls='rim';  // 杯口/杯底边缘带
    else if(radialDot>0.1 && faceR>0.50 && ay<0.55) cls='outerWall';
    else if(radialDot < -0.1) cls='innerWall';
    else if(ay > 0.8) cls='bottom';
    else cls='handle';

    // 归一化 faceR 需用真实最大半径——这里用 0.50 绝对阈值不合理，先统计原始分布
  }

  // 输出半径/法线分布直方图（帮助理解几何）
  let rHist = {};
  for(const f of faces){
    const dx=f.fx-axisX, dz=f.fz-axisZ;
    const faceR=Math.sqrt(dx*dx+dz*dz);
    const bin=Math.floor(faceR*20)/20;
    const key=bin.toFixed(2);
    rHist[key]=(rHist[key]||0)+1;
  }
  console.log('\n半径分布直方图 (bin=0.05, 相对估算轴):');
  Object.entries(rHist).sort((a,b)=>+a[0]-+b[0]).forEach(([k,v])=>{
    console.log(`  r≈${k}: ${v} faces ${'█'.repeat(Math.min(60, Math.round(v/200)))}`);
  });

  // 法线 Y 分布
  let ayHist={};
  for(const f of faces){
    const bin=Math.floor(Math.abs(f.ny)*20)/20;
    const key=bin.toFixed(2);
    ayHist[key]=(ayHist[key]||0)+1;
  }
  console.log('\n|normal.y| 分布直方图:');
  Object.entries(ayHist).sort((a,b)=>+a[0]-+b[0]).forEach(([k,v])=>{
    console.log(`  |ny|≈${k}: ${v} faces`);
  });

  console.log('\n总 face 数:', faceCount);
});