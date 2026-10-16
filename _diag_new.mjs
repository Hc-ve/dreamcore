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
const faceCount=FC.length;

// ===== 精确复现 index.mjs 当前代码 =====
let gxMin=Infinity,gxMax=-Infinity,gyMin=Infinity,gyMax=-Infinity,gzMin=Infinity,gzMax=-Infinity;
for(const f of FC){if(f.x<gxMin)gxMin=f.x;if(f.x>gxMax)gxMax=f.x;if(f.y<gyMin)gyMin=f.y;if(f.y>gyMax)gyMax=f.y;if(f.z<gzMin)gzMin=f.z;if(f.z>gzMax)gzMax=f.z;}
const yRange=gyMax-gyMin||1;
let gxMid=(gxMin+gxMax)/2, gzMid=(gzMin+gzMax)/2;

// 迭代外壁拟合（和 index.mjs 完全一致）
for(let k=0;k<5;k++){
  let SAA=0,SAB=0,SBB=0,SAC=0,SBC=0,nUsed=0;
  for(const f of FC){
    if(Math.abs(f.ny)>0.55)continue;
    if(k>0){
      const dx=f.x-gxMid,dz=f.z-gzMid,r=Math.hypot(dx,dz);
      const dot=(f.nx*dx+f.nz*dz)/Math.max(r,1e-6);
      if(dot<=0.6)continue;
    }
    const A=f.nz,B=-f.nx,C=f.z*f.nx-f.x*f.nz,w=1-Math.abs(f.ny);
    SAA+=w*A*A;SAB+=w*A*B;SBB+=w*B*B;SAC+=w*A*C;SBC+=w*B*C;nUsed++;
  }
  const det=SAA*SBB-SAB*SAB;
  if(Math.abs(det)<=1e-9||nUsed<50)break;
  const nx=(-SAC*SBB+SAB*SBC)/det, nz_=(-SAA*SBC+SAB*SAC)/det;
  if(Math.hypot(nx-gxMid,nz_-gzMid)<0.0005){gxMid=nx;gzMid=nz_;break;}
  gxMid=nx;gzMid=nz_;
}
console.log(`index.mjs 对齐轴: gxMid=${gxMid.toFixed(4)} gzMid=${gzMid.toFixed(4)}`);

let rMax=0; for(const f of FC){const r=Math.hypot(f.x-gxMid,f.z-gzMid);if(r>rMax)rMax=r;}
console.log(`rMax=${rMax.toFixed(4)} 外壁阈值=${(rMax*0.35).toFixed(4)}`);

// ===== 精确复现 index.mjs 分类 =====
let wrap=0,sent=0,fY=0,fRadial=0,fFaceR=0,fAy=0,fIn=0;
const sec=new Map();
const reason={};
for(let s=-6;s<=5;s++)sec.set(s,{w:0,s:0});
for(const f of FC){
  const faceR=Math.hypot(f.x-gxMid,f.z-gzMid);
  const ay=Math.abs(f.ny);
  const rd=Math.max(faceR,1e-6);
  const radialDot=(f.nx*(f.x-gxMid)+f.nz*(f.z-gzMid))/rd;
  const yPct=(f.y-gyMin)/yRange;
  const theta=Math.atan2(f.z-gzMid,f.x-gxMid);
  const s=Math.max(-6, Math.min(5, Math.round(theta/(Math.PI/6))));
  
  let w=false, src='';
  
  else if(ay > 0.93){ fY++; src='cap'; }
  else if(radialDot > -0.3 && faceR > rMax*0.35){ w=true; src='外壁'; }
  else {
    if(radialDot <= -0.3 && ay <= 0.93){ fRadial++; src='radialDot<=-.3'; }
    else if(faceR <= rMax*0.35){ fFaceR++; src='faceR<=.35rMax'; }
    else { fAy++; src='ay>=.70'; }
  }
  
  if(!reason[src])reason[src]=0; reason[src]++;
  if(w){wrap++;sec.get(s).w++;}else{sent++;sec.get(s).s++;}
}
console.log(`\nwrap=${wrap}(${(wrap/faceCount*100).toFixed(1)}%) sent=${sent}`);
console.log(`失败分布: 内壁=${fIn} 杯口/底=${fY} radialDot≤-0.3=${fRadial} faceR≤.35rMax=${fFaceR} ay≥.70=${fAy}`);
console.log(`失败原因:`, reason);
console.log('\n扇区(30°):');
for(let s=-6;s<=5;s++){const e=sec.get(s);console.log(`  s${s}(${s*30+15}°): wrap=${e.w} sent=${e.s} wrap%=${(e.w/(e.w+e.s)*100).toFixed(1)}`);}

