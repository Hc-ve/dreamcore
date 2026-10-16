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

let FC=[]; // [{x,y,z,nx,ny,nz}]
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
console.log('faces', FC.length);

let gxMin=Infinity,gxMax=-Infinity,gyMin=Infinity,gyMax=-Infinity,gzMin=Infinity,gzMax=-Infinity;
for(const f of FC){if(f.x<gxMin)gxMin=f.x;if(f.x>gxMax)gxMax=f.x;if(f.y<gyMin)gyMin=f.y;if(f.y>gyMax)gyMax=f.y;if(f.z<gzMin)gzMin=f.z;if(f.z>gzMax)gzMax=f.z;}
const yRange=gyMax-gyMin||1;
let ax=(gxMin+gxMax)/2, az=(gzMin+gzMax)/2;
console.log('bbox center', ax.toFixed(3), az.toFixed(3));

function fitAxis(selFn){
  let SAA=0,SAB=0,SBB=0,SAC=0,SBC=0,n=0;
  for(const f of FC){
    if(!selFn(f))continue;
    const A=f.nz,B=-f.nx,C=f.z*f.nx-f.x*f.nz,w=1-Math.abs(f.ny);
    SAA+=w*A*A;SAB+=w*A*B;SBB+=w*B*B;SAC+=w*A*C;SBC+=w*B*C;n++;
  }
  const det=SAA*SBB-SAB*SAB;
  if(Math.abs(det)<=1e-9||n<50)return null;
  return {x:(-SAC*SBB+SAB*SBC)/det, z:(-SAA*SBC+SAB*SAC)/det, n};
}

// 迭代拟合：先用 |ny|<0.5 拟合，再用 radialDot>0.6 的外壁重新拟合
let iter=fitAxis(f=>Math.abs(f.ny)<0.5);
if(iter){ax=iter.x;az=iter.z;}
console.log('iter0 (|ny|<0.5):', ax.toFixed(3), az.toFixed(3), 'n=',iter?.n);

for(let k=1;k<=4;k++){
  const cur={x:ax,z:az};
  const it=fitAxis(f=>{
    if(Math.abs(f.ny)>0.55)return false;
    const dx=f.x-cur.x,dz=f.z-cur.z,r=Math.hypot(dx,dz);
    const dot=(f.nx*dx+f.nz*dz)/Math.max(r,1e-6);
    return dot>0.6;
  });
  if(!it){console.log('iter'+k,' 退化');break;}
  ax=it.x;az=it.z;
  console.log('iter'+k+' (radialDot>0.6 外壁):', ax.toFixed(3), az.toFixed(3), 'n=',it.n);
}
console.log('\n最终轴', ax.toFixed(3), az.toFixed(3));

// 用最终轴算分类
let rMax=0; for(const f of FC){const r=Math.hypot(f.x-ax,f.z-az);if(r>rMax)rMax=r;}
console.log('rMax', rMax.toFixed(3));

let wrap=0,sent=0,fY=0,fRadial=0,fFaceR=0,fAy=0;
const sec=new Map();
for(const f of FC){
  const faceR=Math.hypot(f.x-ax,f.z-az), rd=Math.max(faceR,1e-6);
  const radialDot=(f.nx*(f.x-ax)+f.nz*(f.z-az))/rd, ay=Math.abs(f.ny), yPct=(f.y-gyMin)/yRange;
  let w=false;
  if(yPct>0.90||yPct<0.10)fY++;
  else if(radialDot>0.1&&faceR>rMax*0.5&&ay<0.55)w=true;
  else{if(radialDot<=0.1)fRadial++;else if(faceR<=rMax*0.5)fFaceR++;else fAy++;}
  const theta=Math.atan2(f.z-az,f.x-ax),s=Math.round(theta/(Math.PI/6));
  if(!sec.has(s))sec.set(s,{w:0,s:0});const e=sec.get(s);
  if(w){wrap++;e.w++;}else{sent++;e.s++;}
}
console.log(`wrap=${wrap}(${(wrap/FC.length*100).toFixed(1)}%) sent=${sent}`);
console.log(`失败 fY=${fY} radial=${fRadial} faceR=${fFaceR} ay=${fAy}`);
console.log('扇区:');
for(let s=-6;s<=5;s++){const e=sec.get(s)||{w:0,s:0};console.log(`  s${s}(${s*30+15}°): wrap=${e.w} sent=${e.s}`);}

// 外壁一圈半径是否均匀（相对最终轴）
console.log('\n外壁(radialDot>0.5,|ny|<0.5) 每扇区平均半径:');
const sr=new Map();
for(const f of FC){
  if(Math.abs(f.ny)>0.5)continue;
  const dx=f.x-ax,dz=f.z-az,r=Math.hypot(dx,dz);
  const dot=(f.nx*dx+f.nz*dz)/Math.max(r,1e-6);
  if(dot>0.5){const theta=Math.atan2(dz,dx),s=Math.round(theta/(Math.PI/6));if(!sr.has(s))sr.set(s,{sum:0,n:0});const e=sr.get(s);e.sum+=r;e.n++;}
}
for(let s=-6;s<=5;s++){const e=sr.get(s);console.log(`  s${s}(${s*30+15}°): n=${e?e.n:0} avgR=${e?(e.sum/e.n).toFixed(3):'-'}`);}