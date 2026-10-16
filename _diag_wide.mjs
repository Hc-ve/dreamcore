import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'node:fs';

const g=globalThis;
if(!g.self)g.self=g; if(!g.window)g.window=g;
if(!g.Image)g.Image=class{constructor(){}set src(v){setTimeout(()=>{if(this.onload)this.onload();},0);}};
if(!g.FileReader)g.FileReader=class{constructor(){this.result=null;}readAsArrayBuffer(b){if(b&&typeof b.arrayBuffer==='function')b.arrayBuffer().then(x=>{this.result=x;if(this.onload)this.onload({target:this});});}};

const raw=fs.readFileSync('文创设计参考/模型/马克杯 .glb');
const ab=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);
const gltf=await new GLTFLoader().parseAsync(ab,'');

function computeFaceNormals(geom){
  const pos=geom.attributes.position, verts=pos.count;
  const v0=new THREE.Vector3(),v1=new THREE.Vector3(),v2=new THREE.Vector3(),n=new THREE.Vector3();
  const out=new Float32Array(verts*3);
  for(let f=0;f<verts/3;f++){
    const i0=f*3,i1=f*3+1,i2=f*3+2;
    v0.fromBufferAttribute(pos,i0);v1.fromBufferAttribute(pos,i1);v2.fromBufferAttribute(pos,i2);
    n.crossVectors(v1.clone().sub(v0),v2.clone().sub(v0)).normalize();
    out[i0*3]=n.x;out[i0*3+1]=n.y;out[i0*3+2]=n.z;
    out[i1*3]=n.x;out[i1*3+1]=n.y;out[i1*3+2]=n.z;
    out[i2*3]=n.x;out[i2*3+1]=n.y;out[i2*3+2]=n.z;
  }
  return out;
}
function manualToNonIndexed(geom){
  if(!geom.index)return;
  const idx=geom.index, fc=idx.count/3, nv=fc*3;
  for(const [name,attr] of Object.entries(geom.attributes)){
    if(!attr.isBufferAttribute)continue;
    const is=attr.itemSize, TA=attr.array.constructor, na=new TA(nv*is);
    for(let i=0;i<nv;i++){const s=idx.getX(i);for(let j=0;j<is;j++)na[i*is+j]=attr.array[s*is+j];}
    geom.deleteAttribute(name); geom.setAttribute(name,new THREE.BufferAttribute(na,is,attr.normalized));
  }
  geom.index=null;
}

let FC=[];
gltf.scene.traverse(obj=>{
  if(!obj.isMesh||!obj.geometry)return;
  const geom=obj.geometry; manualToNonIndexed(geom);
  const pos=geom.attributes.position; const fn=computeFaceNormals(geom);
  for(let f=0;f<pos.count/3;f++){
    const i0=f*3,i1=f*3+1,i2=f*3+2;
    FC.push({
      x:(pos.getX(i0)+pos.getX(i1)+pos.getX(i2))/3,
      y:(pos.getY(i0)+pos.getY(i1)+pos.getY(i2))/3,
      z:(pos.getZ(i0)+pos.getZ(i1)+pos.getZ(i2))/3,
      nx:fn[f*9],ny:fn[f*9+1],nz:fn[f*9+2],
    });
  }
});

let gxMin=Infinity,gxMax=-Infinity,gyMin=Infinity,gyMax=-Infinity,gzMin=Infinity,gzMax=-Infinity;
for(const f of FC){if(f.x<gxMin)gxMin=f.x;if(f.x>gxMax)gxMax=f.x;if(f.y<gyMin)gyMin=f.y;if(f.y>gyMax)gyMax=f.y;if(f.z<gzMin)gzMin=f.z;if(f.z>gzMax)gzMax=f.z;}
const yRange=gyMax-gyMin||1;
let ax=(gxMin+gxMax)/2, az=(gzMin+gzMax)/2;
for(let k=0;k<5;k++){
  let SAA=0,SAB=0,SBB=0,SAC=0,SBC=0,n=0;
  for(const f of FC){
    if(Math.abs(f.ny)>0.55)continue;
    const dx=f.x-ax,dz=f.z-az,r=Math.hypot(dx,dz);
    const dot=(f.nx*dx+f.nz*dz)/Math.max(r,1e-6);
    if(dot<=0.6)continue;
    const A=f.nz,B=-f.nx,C=f.z*f.nx-f.x*f.nz,w=1-Math.abs(f.ny);
    SAA+=w*A*A;SAB+=w*A*B;SBB+=w*B*B;SAC+=w*A*C;SBC+=w*B*C;n++;
  }
  const det=SAA*SBB-SAB*SAB; if(Math.abs(det)<=1e-9||n<50)break;
  const nx=(-SAC*SBB+SAB*SBC)/det, nz=(-SAA*SBC+SAB*SAC)/det;
  if(Math.hypot(nx-ax,nz-az)<0.0005)break; ax=nx;az=nz;
}
let rMax=0; for(const f of FC){const r=Math.hypot(f.x-ax,f.z-az);if(r>rMax)rMax=r;}

// 方案 A: 完全不检查 radialDot，只靠几何位置
const A={radialDot:-100, faceR:0.30, ay:0.70, yTop:0.95, yBot:0.05, name:'A 无radialDot约束'};
// 方案 B: 把内壁单独排除（radialDot<-0.5 且 r>0.3 → 内壁），其余 r>0.25 都算
// 方案 C: 按 theta 扇区动态阈值
// 方案 D: 用 rMax * 0.35 作为外壁半径阈值，不考虑 radialDot 方向，只排除明显内壁（radialDot<-0.3）

const tests=[
  A,
  {radialDot:-0.5, faceR:0.35, ay:0.70, yTop:0.94, yBot:0.06, name:'D 排除内壁'},
  {radialDot:-0.3, faceR:0.35, ay:0.70, yTop:0.93, yBot:0.07, name:'E 较宽松'},
  {radialDot:-0.2, faceR:0.32, ay:0.68, yTop:0.93, yBot:0.07, name:'F 极宽松+低R'},
  {radialDot:-1.0, faceR:0.30, ay:0.70, yTop:0.94, yBot:0.06, name:'G 几乎无约束'},
];

for(const t of tests){
  let wrap=0,sent=0,fY=0,fRadial=0,fFaceR=0,fAy=0,innerWall=0;
  const secW=new Map();
  for(const f of FC){
    const dx=f.x-ax,dz=f.z-az,r=Math.hypot(dx,dz),rd=Math.max(r,1e-6);
    const radialDot=(f.nx*dx+f.nz*dz)/rd, ay=Math.abs(f.ny), yPct=(f.y-gyMin)/yRange;
    const theta=Math.atan2(dz,dx);
    const s=Math.round(theta/(Math.PI/6));
    
    // 检测内壁（法线朝内 + 半径大于杯子内径）
    if(radialDot < -0.3 && r > 0.15){ innerWall++; continue; }
    
    let w=false;
    if(yPct>t.yTop||yPct<t.yBot)fY++;
    else if(radialDot>t.radialDot && r>rMax*t.faceR && ay<t.ay)w=true;
    else{if(radialDot<=t.radialDot)fRadial++;else if(r<=rMax*t.faceR)fFaceR++;else fAy++;}
    if(!secW.has(s))secW.set(s,0);
    if(w){wrap++;secW.set(s,secW.get(s)+1);}else sent++;
  }
  console.log(`\n${t.name}: wrap=${wrap}(${(wrap/FC.length*100).toFixed(1)}%) sent=${sent} 内壁=${innerWall}`);
  console.log(`  fY=${fY} radial=${fRadial} faceR=${fFaceR} ay=${fAy}`);
  let gaps=[];
  for(let s=-6;s<=5;s++){const n=secW.get(s)||0;if(n<50)gaps.push(`s${s}`);}
  if(gaps.length)console.log(`  gap( wrap<50): ${gaps.join(', ')}`); else console.log(`  无 gap`);
  // 顶面/底面外壁误判（radialDot应该朝内但判成wrap）
}

// 额外：看内壁面分布
console.log('\n=== 内壁(radialDot<-0.3, r>0.15) 按theta分布 ===');
const inS=new Map();
for(const f of FC){
  const dx=f.x-ax,dz=f.z-az,r=Math.hypot(dx,dz);
  if(r<=0.15)continue;
  const rd=Math.max(r,1e-6);
  const radialDot=(f.nx*dx+f.nz*dz)/rd;
  if(radialDot<-0.3){
    const theta=Math.atan2(dz,dx), s=Math.round(theta/(Math.PI/6));
    inS.set(s,(inS.get(s)||0)+1);
  }
}
for(let s=-6;s<=5;s++){console.log(`  s${s}(${s*30+15}°): ${inS.get(s)||0}`);}

// 杯把检测：远离圆柱轴且|ny|小且 radialDot 低
console.log('\n=== 杯把区域(r>0.5, |ny|<0.5) 按theta分布 ===');
const hS=new Map();
for(const f of FC){
  const dx=f.x-ax,dz=f.z-az,r=Math.hypot(dx,dz);
  if(r<=0.5||Math.abs(f.ny)>=0.5)continue;
  const theta=Math.atan2(dz,dx), s=Math.round(theta/(Math.PI/6));
  const rd=Math.max(r,1e-6);
  const radialDot=(f.nx*dx+f.nz*dz)/rd;
  hS.set(s,(hS.get(s)||0)+1);
  // console sample
  if(!hS.get('_sample_'+s)){
    hS.set('_sample_'+s,1);
    console.log(`  s${s}: radialDot=${radialDot.toFixed(2)} r=${r.toFixed(3)}`);
  }
}
for(let s=-6;s<=5;s++){console.log(`  s${s}(${s*30+15}°): ${hS.get(s)||0}`);}