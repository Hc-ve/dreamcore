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

// 多 mesh 汇总
let allPos=[], allNorm=[];
gltf.scene.traverse(obj=>{
  if(!obj.isMesh||!obj.geometry)return;
  const geom=obj.geometry;
  manualToNonIndexed(geom);
  const pos=geom.attributes.position;
  const fn=computeFaceNormals(geom);
  for(let f=0;f<pos.count/3;f++){
    const i0=f*3,i1=f*3+1,i2=f*3+2;
    const cx=(pos.getX(i0)+pos.getX(i1)+pos.getX(i2))/3;
    const cy=(pos.getY(i0)+pos.getY(i1)+pos.getY(i2))/3;
    const cz=(pos.getZ(i0)+pos.getZ(i1)+pos.getZ(i2))/3;
    allPos.push([cx,cy,cz]);
    allNorm.push([fn[f*9],fn[f*9+1],fn[f*9+2]]);
  }
});
console.log('total faces', allPos.length, 'meshes merged');

// 轴拟合（当前逻辑）
let gxMin=Infinity,gxMax=-Infinity,gyMin=Infinity,gyMax=-Infinity,gzMin=Infinity,gzMax=-Infinity;
for(const [x,y,z] of allPos){if(x<gxMin)gxMin=x;if(x>gxMax)gxMax=x;if(y<gyMin)gyMin=y;if(y>gyMax)gyMax=y;if(z<gzMin)gzMin=z;if(z>gzMax)gzMax=z;}
const yRange=gyMax-gyMin||1;
let gxMid=(gxMin+gxMax)/2, gzMid=(gzMin+gzMax)/2;
let SAA=0,SAB=0,SBB=0,SAC=0,SBC=0;
for(let f=0;f<allPos.length;f++){
  const [cx,,cz]=allPos[f], [nx,ny,nz]=allNorm[f];
  if(Math.abs(ny)>0.5)continue;
  const A=nz,B=-nx,C=cz*nx-cx*nz,w=1-Math.abs(ny);
  SAA+=w*A*A;SAB+=w*A*B;SBB+=w*B*B;SAC+=w*A*C;SBC+=w*B*C;
}
const det=SAA*SBB-SAB*SAB;
if(Math.abs(det)>1e-9){gxMid=(-SAC*SBB+SAB*SBC)/det; gzMid=(-SAA*SBC+SAB*SAC)/det;}
console.log('fitted axis', gxMid.toFixed(3), gzMid.toFixed(3));

// 分析 gap 扇区 (-105°~-45°)
function secStats(){
  const gap=[], body=[];
  for(let f=0;f<allPos.length;f++){
    const [cx,cy,cz]=allPos[f], [nx,ny,nz]=allNorm[f];
    const dx=cx-gxMid, dz=cz-gzMid, r=Math.hypot(dx,dz);
    const radialDot=(nx*dx+nz*dz)/Math.max(r,1e-6);
    const theta=Math.atan2(dz,dx)*180/Math.PI;
    const yPct=(cy-gyMin)/yRange;
    const o={r,radialDot,ny,theta,yPct};
    if(theta>=-105&&theta<=-45) gap.push(o); else body.push(o);
  }
  return {gap,body};
}
const {gap,body}=secStats();
console.log('\n=== GAP 扇区 -105°~-45° (共 '+gap.length+' faces) ===');
console.log('半径分布:');
const grh={};
for(const o of gap){const b=Math.floor(o.r*20)/20,k=b.toFixed(2);grh[k]=(grh[k]||0)+1;}
for(const [k,v] of Object.entries(grh).sort((a,b)=>+a[0]-+b[0])) console.log(`  r≈${k}: ${v} ${'█'.repeat(Math.min(60,Math.round(v/50)))}`);
console.log('radialDot 分布:');
const grd={};
for(const o of gap){const b=Math.round(o.radialDot*10)/10,k=b.toFixed(1);grd[k]=(grd[k]||0)+1;}
for(const [k,v] of Object.entries(grd).sort((a,b)=>+a[0]-+b[0])) console.log(`  dot≈${k}: ${v}`);
console.log('ny(|ny|) 分布:');
const gny={};
for(const o of gap){const b=Math.round(Math.abs(o.ny)*10)/10,k=b.toFixed(1);gny[k]=(gny[k]||0)+1;}
for(const [k,v] of Object.entries(gny).sort((a,b)=>+a[0]-+b[0])) console.log(`  |ny|≈${k}: ${v}`);
console.log('gap 里 radialDot>0.1 且 r>0.286 且 |ny|<0.55 的(本可 wrap):',
  gap.filter(o=>o.radialDot>0.1&&o.r>0.286&&Math.abs(o.ny)<0.55).length);

// 对比：body 扇区里同样的 "本可 wrap" 数量 vs 实际
console.log('\n=== BODY 扇区统计 ===');
console.log('total body faces', body.length);
const bw=body.filter(o=>o.radialDot>0.1&&o.r>0.286&&Math.abs(o.ny)<0.55).length;
console.log('body 本可 wrap (radialDot>0.1 && r>0.286 && |ny|<0.55):', bw);

// 关键：外层壁（径向向外）在所有角度是否连续？
console.log('\n=== 外层壁候选(radialDot>0.5) 按 30° 扇区分布 ===');
const sec=new Map();
for(let f=0;f<allPos.length;f++){
  const [cx,,cz]=allPos[f],[nx,ny,nz]=allNorm[f];
  const dx=cx-gxMid,dz=cz-gzMid,r=Math.hypot(dx,dz);
  const radialDot=(nx*dx+nz*dz)/Math.max(r,1e-6);
  if(radialDot>0.5&&Math.abs(ny)<0.5){
    const theta=Math.atan2(dz,dx), s=Math.round(theta/(Math.PI/6));
    if(!sec.has(s))sec.set(s,{outer:0,handle:0});
    // r>0.5 认为是杯把延伸
    if(r>0.45) sec.get(s).handle++; else sec.get(s).outer++;
  }
}
for(let s=-6;s<=5;s++){const e=sec.get(s)||{outer:0,handle:0};console.log(`  s${s}(${s*30+15}°): outerWall=${e.outer} handle=$e.handle`);}