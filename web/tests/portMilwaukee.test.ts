import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {buildPortMilwaukee} from '../src/portMilwaukee.ts';
import {PORT_REPLACED_IDS} from '../src/portPlaceholder.ts';
import {PORT_FERRY_PLACEMENT,PORT_FREIGHTER_PLACEMENT} from '../src/portDockEdges.ts';
// Independent fixture decoder: no runtime TileManager or browser dependencies.
function parseSections(buffer:ArrayBuffer){
 const bytes=new Uint8Array(buffer),view=new DataView(buffer),sections:{name:string;positions:Float32Array}[]=[];let offset=12;
 for(let s=0;s<view.getUint32(8,true);s++){
  const name=new TextDecoder().decode(bytes.slice(offset,offset+4)).trim();offset+=4;
  const count=view.getUint32(offset,true);offset+=4;
  const origin=[0,4,8].map(i=>view.getFloat32(offset+i,true)),scale=view.getFloat32(offset+12,true);offset+=16;
  const positions=new Float32Array(count*3);for(let i=0;i<positions.length;i++)positions[i]=view.getInt16(offset+i*2,true)*scale+origin[i%3];
  offset=Math.ceil((offset+count*6)/4)*4;offset=Math.ceil((offset+count*3)/4)*4;sections.push({name,positions});
 }return sections;
}

test('port composition replaces exactly its selected buildings and keeps scene cost bounded',()=>{
 const port=buildPortMilwaukee(()=>2),features=port.userData.features as {id:string;position:number[]}[];
 assert.deepEqual(features.filter(f=>f.id.startsWith('way/')).map(f=>Number(f.id.slice(4))).sort((a,b)=>a-b),[...PORT_REPLACED_IDS].sort((a,b)=>a-b));
 assert.equal(features.filter(f=>f.id.startsWith('port-dock-crane-')).length,4);
 assert.equal(port.userData.dockEdgeCount,12);
 for(const id of ['port-freighter','port-ferry','port-wind-turbine'])assert.ok(features.some(f=>f.id===id&&f.position.every(Number.isFinite)&&f.position[0]>100));
 let draws=0;port.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments){draws++;const p=o.geometry.getAttribute('position');for(const value of p.array)assert.ok(Number.isFinite(value));}});
 assert.ok(draws<70,`expected merged geometry, got ${draws} draw calls`);
 const rails=port.getObjectByName('port-milwaukee-railways')!;
 assert.equal(rails.userData.pathCount,81);assert.ok(rails.userData.railLengthM>29000);
 const glow=port.getObjectByName('port-yard-light-fixtures') as THREE.Mesh;
 port.userData.setLightingMode('day');assert.equal((glow.material as THREE.MeshBasicMaterial).opacity,0);
 port.userData.setLightingMode('night');assert.equal((glow.material as THREE.MeshBasicMaterial).opacity,.9);
});

test('both complete vessel envelopes stay within the shipped water geometry',()=>{
 const bytes=readFileSync(new URL('../public/data/water.bin',import.meta.url));
 const sections=parseSections(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 const triangles:{p:number[];minX:number;maxX:number;minZ:number;maxZ:number}[]=[];
 for(const s of sections)if(s.name==='WATR')for(let i=0;i<s.positions.length;i+=9){
  const p=[s.positions[i],s.positions[i+2],s.positions[i+3],s.positions[i+5],s.positions[i+6],s.positions[i+8]];
  triangles.push({p,minX:Math.min(p[0],p[2],p[4]),maxX:Math.max(p[0],p[2],p[4]),minZ:Math.min(p[1],p[3],p[5]),maxZ:Math.max(p[1],p[3],p[5])});
 }
 function inWater(x:number,z:number){return triangles.some(({p,minX,maxX,minZ,maxZ})=>{
  if(x<minX||x>maxX||z<minZ||z>maxZ)return false;
  const cross=(ax:number,az:number,bx:number,bz:number)=>(x-bx)*(az-bz)-(ax-bx)*(z-bz);
  const a=cross(p[0],p[1],p[2],p[3]),b=cross(p[2],p[3],p[4],p[5]),c=cross(p[4],p[5],p[0],p[1]);
  return !(Math.min(a,b,c)<-1e-6&&Math.max(a,b,c)>1e-6);
 });}
 for(const [p,length,beam] of [[PORT_FREIGHTER_PLACEMENT,180,22],[PORT_FERRY_PLACEMENT,58,18]] as const){
  for(let u=-length/2;u<=length/2;u+=length/30)for(let v=-beam/2;v<=beam/2;v+=beam/6){
   const x=p.x+u*Math.cos(p.bearing)+v*Math.sin(p.bearing),z=p.z-u*Math.sin(p.bearing)+v*Math.cos(p.bearing);
   assert.ok(inWater(x,z),`vessel overlaps land at ${x},${z}`);
  }
 }
});
