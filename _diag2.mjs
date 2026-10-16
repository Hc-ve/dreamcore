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

gltf.scene.traverse(obj => {
  if (!obj.isMesh || !obj.geometry) return;
  const geom = obj.geometry;
  const pos = geom.attributes.position;
  const idx = geom.index;
  const faceCount = idx ? idx.count/3 : pos.count/3;

  // 复现代码中的包围盒计算
  let gxMin=Infinity,gxMax=-Infinity,gzMin=Infinity,gzMax=-Infinity,gyMin=Infinity,gyMax=-Infinity;
  for (let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    if(x<gxMin)gxMin=x; if(x>gxMax)gxMax=x;
    if(y<gyMin)gyMin=y; if(y>gyMax)gyMax=y;
    if(z<gzMin)gzMin=z; if(z>gzMax)gzMax=z;
  }
  const gxMid=(gxMin+gxMax)/2, gzMid=(gzMin+gzMax)/2;
  const yRange=gyMax-gyMin||1;
  const rMax=Math.max(
    Math.hypot(gxMax-gxMid, gzMax-gzMid),
    Math.hypot(gxMax-gxMid, gzMin-gzMid),
    Math.hypot(gxMin-gxMid, gzMax-gzMid),
    Math.hypot(gxMin-gxMid, gzMin-gzMid),
  );
  console.log(`gxMid=${gxMid.toFixed(3)} gzMid=${gzMid.toFixed(3)} yMin=${gyMin.toFixed(3)} yMax=${gyMax.toFixed(3)}`);
  console.log(`rMax=${rMax.toFixed(3)} 阈值 rMax*0.5=${(rMax*0.5).toFixed(3)}`);

  // 估算真实轴：外壁面质心（radialDot>0 且 |ny|<0.5）
  const v0=new THREE.Vector3(),v1=new THREE.Vector3(),v2=new THREE.Vector3();
  const e1=new THREE.Vector3(),e2=new THREE.Vector3(),fn=new THREE.Vector3();

  // 按角度扇区统计 wrap / sentinel
  const sectors = new Map(); // sector -> {wrap, sent}
  let wrapTotal=0, sentTotal=0;
  let failRadial=0, failFaceR=0, failAy=0, failY=0;

  for (let f=0; f<faceCount; f++){
    const a=idx?idx.getX(f*3):f*3, b=idx?idx.getX(f*3+1):f*3+1, c=idx?idx.getX(f*3+2):f*3+2;
    v0.fromBufferAttribute(pos,a); v1.fromBufferAttribute(pos,b); v2.fromBufferAttribute(pos,c);
    fn.crossVectors(e1.subVectors(v1,v0), e2.subVectors(v2,v0)).normalize();
    const fx=(v0.x+v1.x+v2.x)/3, fy=(v0.y+v1.y+v2.y)/3, fz=(v0.z+v1.z+v2.z)/3;
    const nx=fn.x, ny=fn.y, nz=fn.z;
    const faceR=Math.hypot(fx-gxMid, fz-gzMid);
    const rd=Math.max(faceR,1e-6);
    const radialDot=(nx*(fx-gxMid) + nz*(fz-gzMid))/rd;
    const ay=Math.abs(ny);
    const yPct=(fy-gyMin)/yRange;

    // 代码逻辑
    let forceSentinel=false, forceWrap=false;
    if(yPct>0.90 || yPct<0.10){ forceSentinel=true; failY++; }
    else if(radialDot>0.1 && faceR>rMax*0.50 && ay<0.55){ forceWrap=true; }
    else {
      forceSentinel=true;
      if(radialDot<=0.1) failRadial++;
      else if(faceR<=rMax*0.50) failFaceR++;
      else failAy++;
    }

    const theta=Math.atan2(fz-gzMid, fx-gxMid);
    const sector=Math.round(theta/(Math.PI/6)); // 12 扇区
    if(!sectors.has(sector)) sectors.set(sector,{wrap:0,sent:0});
    const s=sectors.get(sector);
    if(forceWrap){ s.wrap++; wrapTotal++; } else { s.sent++; sentTotal++; }
  }

  console.log(`\nwrap=${wrapTotal} sentinel=${sentTotal} (${(wrapTotal/faceCount*100).toFixed(1)}% wrap)`);
  console.log(`条件失败统计: failY(杯口/底)=${failY} failRadial(radialDot<=0.1)=${failRadial} failFaceR(faceR<=rMax*0.5)=${failFaceR} failAy(ay>=0.55)=${failAy}`);
  console.log(`\n按角度扇区 (θ=atan2(z-gzMid,x-gxMid), 每30°, -180..180):`);
  for(let s=-6;s<=5;s++){
    const d=sectors.get(s) || {wrap:0,sent:0};
    const mid=((s*30+15));
    console.log(`  扇区${s} (约${mid}°): wrap=${d.wrap} sent=${d.sent}`);
  }
});