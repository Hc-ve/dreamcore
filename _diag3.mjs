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

gltf.scene.traverse(obj=>{
  if(!obj.isMesh||!obj.geometry)return;
  const geom=obj.geometry;
  manualToNonIndexed(geom);
  const pos=geom.attributes.position, verts=pos.count, faceCount=verts/3;
  const faceNormals=computeFaceNormals(geom);

  let gxMin=Infinity,gxMax=-Infinity,gyMin=Infinity,gyMax=-Infinity,gzMin=Infinity,gzMax=-Infinity;
  for(let i=0;i<verts;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);if(x<gxMin)gxMin=x;if(x>gxMax)gxMax=x;if(y<gyMin)gyMin=y;if(y>gyMax)gyMax=y;if(z<gzMin)gzMin=z;if(z>gzMax)gzMax=z;}
  const yRange=gyMax-gyMin||1;
  let gxMid=(gxMin+gxMax)/2, gzMid=(gzMin+gzMax)/2;
  console.log(`包围盒中心 gxMid=${gxMid.toFixed(3)} gzMid=${gzMid.toFixed(3)} yRange=[${gyMin.toFixed(2)},${gyMax.toFixed(2)}]`);

  // 轴拟合
  let SAA=0,SAB=0,SBB=0,SAC=0,SBC=0;
  for(let f=0;f<faceCount;f++){
    const nx=faceNormals[f*9],ny=faceNormals[f*9+1],nz=faceNormals[f*9+2];
    if(Math.abs(ny)>0.5)continue;
    const i0=f*3,i1=f*3+1,i2=f*3+2;
    const cx=(pos.getX(i0)+pos.getX(i1)+pos.getX(i2))/3, cz=(pos.getZ(i0)+pos.getZ(i1)+pos.getZ(i2))/3;
    const A=nz,B=-nx,C=cz*nx-cx*nz, w=1-Math.abs(ny);
    SAA+=w*A*A;SAB+=w*A*B;SBB+=w*B*B;SAC+=w*A*C;SBC+=w*B*C;
  }
  const det=SAA*SBB-SAB*SAB;
  if(Math.abs(det)>1e-9){gxMid=(-SAC*SBB+SAB*SBC)/det; gzMid=(-SAA*SBC+SAB*SAC)/det;}
  console.log(`拟合轴 gxMid=${gxMid.toFixed(3)} gzMid=${gzMid.toFixed(3)}`);

  let rMax=0;
  for(let i=0;i<verts;i++){const dx=pos.getX(i)-gxMid,dz=pos.getZ(i)-gzMid,r=Math.hypot(dx,dz);if(r>rMax)rMax=r;}
  console.log(`rMax=${rMax.toFixed(3)} 阈值0.5*rMax=${(rMax*0.5).toFixed(3)}`);

  // 半径直方图（相对拟合轴）
  const rh={};
  for(let i=0;i<verts;i++){const r=Math.hypot(pos.getX(i)-gxMid,pos.getZ(i)-gzMid);const b=Math.floor(r*20)/20,key=b.toFixed(2);rh[key]=(rh[key]||0)+1;}
  console.log('\n顶点半径直方图(相对拟合轴):');
  Object.entries(rh).sort((a,b)=>+a[0]-+b[0]).forEach(([k,v])=>console.log(`  r≈${k}: ${v} ${'█'.repeat(Math.min(50,Math.round(v/3000)))}`));

  // 分类 + 扇区
  const sectors=new Map(); let wrap=0,sent=0,fRadial=0,fFaceR=0,fAy=0,fY=0;
  for(let f=0;f<faceCount;f++){
    const i0=f*3,i1=f*3+1,i2=f*3+2;
    const fx=(pos.getX(i0)+pos.getX(i1)+pos.getX(i2))/3, fy=(pos.getY(i0)+pos.getY(i1)+pos.getY(i2))/3, fz=(pos.getZ(i0)+pos.getZ(i1)+pos.getZ(i2))/3;
    const nx=faceNormals[f*9],ny=faceNormals[f*9+1],nz=faceNormals[f*9+2];
    const faceR=Math.hypot(fx-gxMid,fz-gzMid), rd=Math.max(faceR,1e-6);
    const radialDot=(nx*(fx-gxMid)+nz*(fz-gzMid))/rd, ay=Math.abs(ny), yPct=(fy-gyMin)/yRange;
    let w=false;
    if(yPct>0.90||yPct<0.10){fY++;}
    else if(radialDot>0.1&&faceR>rMax*0.5&&ay<0.55){w=true;}
    else { if(radialDot<=0.1)fRadial++; else if(faceR<=rMax*0.5)fFaceR++; else fAy++; }
    const theta=Math.atan2(fz-gzMid,fx-gxMid), s=Math.round(theta/(Math.PI/6));
    if(!sectors.has(s))sectors.set(s,{wrap:0,sent:0});
    const e=sectors.get(s);
    if(w){wrap++;e.wrap++;}else{sent++;e.sent++;}
  }
  console.log(`\nwrap=${wrap}(${(wrap/faceCount*100).toFixed(1)}%) sent=${sent}`);
  console.log(`失败: fY=${fY} radial=${fRadial} faceR=${fFaceR} ay=${fAy}`);
  console.log('扇区分布:');
  for(let s=-6;s<=5;s++){const e=sectors.get(s)||{wrap:0,sent:0};console.log(`  s${s}(${s*30+15}°): wrap=${e.wrap} sent=${e.sent}`);}
});