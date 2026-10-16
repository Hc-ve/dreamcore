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
  const det=SAA*SBB-SAB*SAB;
  if(Math.abs(det)<=1e-9||n<50)break;
  const nx=(-SAC*SBB+SAB*SBC)/det, nz=(-SAA*SBC+SAB*SAC)/det;
  if(Math.hypot(nx-ax,nz-az)<0.0005)break;
  ax=nx;az=nz;
}
let rMax=0; for(const f of FC){const r=Math.hypot(f.x-ax,f.z-az);if(r>rMax)rMax=r;}
console.log(`axis(${ax.toFixed(4)},${az.toFixed(4)}) rMax=${rMax.toFixed(3)} yRange=[${gyMin.toFixed(2)},${gyMax.toFixed(2)}]`);

// 枚举阈值组合
const tests=[
  {radialDot:0.1, faceR:0.50, ay:0.55, yTop:0.90, yBot:0.10, name:'当前(旧)'},
  {radialDot:0.0, faceR:0.40, ay:0.60, yTop:0.92, yBot:0.08, name:'T1 宽松'},
  {radialDot:-0.1, faceR:0.35, ay:0.65, yTop:0.93, yBot:0.07, name:'T2 更宽松'},
  {radialDot:-0.2, faceR:0.30, ay:0.70, yTop:0.94, yBot:0.06, name:'T3 极宽松'},
  {radialDot:0.05, faceR:0.42, ay:0.58, yTop:0.91, yBot:0.09, name:'T4 折中'},
  {radialDot:0.0, faceR:0.38, ay:0.62, yTop:0.92, yBot:0.08, name:'T5 半宽松'},
];

for(const t of tests){
  let wrap=0,sent=0,fY=0,fRadial=0,fFaceR=0,fAy=0;
  let wrapSector=new Map();
  for(const f of FC){
    const dx=f.x-ax,dz=f.z-az,r=Math.hypot(dx,dz),rd=Math.max(r,1e-6);
    const radialDot=(f.nx*dx+f.nz*dz)/rd, ay=Math.abs(f.ny), yPct=(f.y-gyMin)/yRange;
    let w=false;
    if(yPct>t.yTop||yPct<t.yBot)fY++;
    else if(radialDot>t.radialDot && r>rMax*t.faceR && ay<t.ay)w=true;
    else{if(radialDot<=t.radialDot)fRadial++;else if(r<=rMax*t.faceR)fFaceR++;else fAy++;}
    const theta=Math.atan2(dz,dx),s=Math.round(theta/(Math.PI/6));
    if(!wrapSector.has(s))wrapSector.set(s,0);
    if(w){wrap++;wrapSector.set(s,wrapSector.get(s)+1);}else sent++;
  }
  console.log(`\n${t.name}: wrap=${wrap}(${(wrap/FC.length*100).toFixed(1)}%) sent=${sent} 阈值dot>${t.radialDot} r>${(rMax*t.faceR).toFixed(3)} ay<${t.ay} Y<${t.yBot}|Y>${t.yTop}`);
  console.log(`  失败: fY=${fY} radial=${fRadial} faceR=${fFaceR} ay=${fAy}`);
  let gaps=[];
  for(let s=-6;s<=5;s++){const n=wrapSector.get(s)||0;if(n<50)gaps.push(`s${s}`);}
  if(gaps.length)console.log(`  ⚠ gap扇区( wrap<50): ${gaps.join(', ')}`); else console.log(`  ✓ 无 gap 扇区`);
}