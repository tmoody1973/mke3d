import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
function parseTerrain(b:ArrayBuffer){const d=new DataView(b),nx=d.getUint32(4,true),ny=d.getUint32(8,true);return{nx,ny,x0:d.getFloat32(12,true),y0:d.getFloat32(16,true),step:d.getFloat32(20,true),heights:new Float32Array(b.slice(24,24+nx*ny*4)),colors:new Uint8Array(b.slice(24+nx*ny*4))};}
function parseSections(b:ArrayBuffer){
 const d=new DataView(b),result:{name:string;positions:Float32Array;colors:Uint8Array}[]=[];let off=12;
 for(let i=0;i<d.getUint32(8,true);i++){
  const name=String.fromCharCode(...new Uint8Array(b,off,4)).trim(),n=d.getUint32(off+4,true);off+=8;
  const origins=[0,4,8].map(k=>d.getFloat32(off+k,true)),scale=d.getFloat32(off+12,true);off+=16;
  const positions=new Float32Array(n*3);for(let j=0;j<n*3;j++)positions[j]=d.getInt16(off+j*2,true)*scale+origins[j%3];
  off=Math.ceil((off+n*6)/4)*4;const colors=new Uint8Array(b.slice(off,off+n*3));off=Math.ceil((off+n*3)/4)*4;
  result.push({name,positions,colors});
 }return result;
}
function sectionToGeometry(s:{positions:Float32Array;colors:Uint8Array}){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(s.positions,3));g.setAttribute('color',new THREE.BufferAttribute(s.colors,3,true));return g;}

import { bilinearTerrainHeight } from '../src/localTerrain.ts';
import { prepareHoanTerrain,prepareHoanWater,buildHoanContext,adaptHoanContextTile,hoanCorrectionWeight,withinHoanHarbor } from '../src/hoanSite.ts';
const read=(path:string)=>{const b=readFileSync(new URL(path,import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength) as ArrayBuffer;};
const base=parseTerrain(read('../public/data/terrain.bin')),before=base.heights.slice(),corrected=prepareHoanTerrain(base),ground=(x:number,z:number)=>bilinearTerrainHeight(corrected,x,z);
test('bridge DEM returns removed at both harbor springings without touching distant terrain',()=>{
 assert.ok(bilinearTerrainHeight(base,484.95,1001.81)>20);assert.ok(bilinearTerrainHeight(base,518.25,1181.64)>17);
 assert.ok(ground(484.95,1001.81)<3);assert.ok(ground(518.25,1181.64)<3);
 for(let j=0;j<base.ny;j++)for(let i=0;i<base.nx;i++){
  const k=j*base.nx+i,x=base.x0+i*base.step,z=-base.y0-j*base.step;
  assert.ok(Number.isFinite(corrected.heights[k]));assert.equal(base.heights[k],before[k]);
  if(!hoanCorrectionWeight(x,z)&&!withinHoanHarbor(x,z))assert.equal(corrected.heights[k],base.heights[k]);
  if(withinHoanHarbor(x,z))assert.ok(corrected.heights[k]<=-2);
 }
});
test('river surface flattened without moving mapped shoreline vertices or mutating sources',()=>{
 const source=parseSections(read('../public/data/water.bin')),fixed=prepareHoanWater(source);let changed=0;
 for(let s=0;s<source.length;s++)for(let i=0;i<source[s].positions.length;i+=3){const a=source[s].positions,b=fixed[s].positions;
  assert.equal(a[i],b[i]);assert.equal(a[i+2],b[i+2]);assert.ok(Number.isFinite(b[i+1]));
  if(withinHoanHarbor(a[i],a[i+2]))assert.ok(b[i+1]<=0);
  if(a[i+1]!==b[i+1])changed++;
 }
 assert.ok(changed>10);
});
test('quays remain at their shores with a completely open navigation channel',()=>{
 const group=buildHoanContext(ground);assert.equal(group.children.length,4);let triangles=0;
 for(const child of group.children as THREE.Mesh[]){const p=child.geometry.getAttribute('position');triangles+=p.count/3;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i);assert.ok(Number.isFinite(x+y+z));
   assert.ok(!(x>320&&x<750&&z>1040&&z<1100),'context must not cross navigation channel');
   assert.ok(y<7,'quays and railings cannot inherit bridge-height terrain');
  }
 }
 assert.ok(triangles<20000);
});
test('tile correction touches proven surface roads only and preserves upper decks and buildings',()=>{
 const group=new THREE.Group();const x=480,z=960,raw=bilinearTerrainHeight(base,x,z);
 for(const [name,y]of[['ROAD',raw+.4],['ROAD',raw+14.4],['HSTR',raw+.4],['BLDG',raw+.4]]as const){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([x,y,z,x+1,y,z,x,y,z+1],3));const mesh=new THREE.Mesh(g);mesh.name=name;group.add(mesh);}
 const values=group.children.map(c=>(c as THREE.Mesh).geometry.getAttribute('position').getY(0));
 adaptHoanContextTile(group,{i:0,j:-1},base,ground);
 assert.ok((group.children[0]as THREE.Mesh).geometry.getAttribute('position').getY(0)<values[0]-10);
 for(let i=1;i<4;i++)assert.equal((group.children[i]as THREE.Mesh).geometry.getAttribute('position').getY(0),values[i]);
});
test('both shipped detail levels retain non-road bytes under adaptation',()=>{
 for(const suffix of['','.lod']){const group=new THREE.Group();for(const section of parseSections(read(`../public/data/tiles/t_0_-1${suffix}.bin`))){const mesh=new THREE.Mesh(sectionToGeometry(section));mesh.name=section.name;group.add(mesh);}
 const snapshots=group.children.filter(c=>c.name!=='ROAD').map(c=>({mesh:c as THREE.Mesh,p:Array.from((c as THREE.Mesh).geometry.getAttribute('position').array)}));
 adaptHoanContextTile(group,{i:0,j:-1},base,ground);
 for(const {mesh,p}of snapshots)assert.deepEqual(Array.from(mesh.geometry.getAttribute('position').array),p);
 }
});
test('entire triangles across the central navigation channel stay at water level',()=>{
 const fixed=prepareHoanWater(parseSections(read('../public/data/water.bin')));let checked=0,max=0;
 for(const section of fixed){const p=section.positions;for(let i=0;i<p.length;i+=9){
  for(const weights of [[1/3,1/3,1/3],[.6,.2,.2],[.2,.6,.2],[.2,.2,.6]]){
   const x=weights.reduce((sum,w,k)=>sum+w*p[i+k*3],0),z=weights.reduce((sum,w,k)=>sum+w*p[i+k*3+2],0);
   if(x>320&&x<750&&z>1035&&z<1150&&withinHoanHarbor(x,z)){
    const y=weights.reduce((sum,w,k)=>sum+w*p[i+k*3+1],0);max=Math.max(max,y);checked++;
   }
  }
 }}
 assert.ok(checked>0);assert.ok(max<.1,`residual harbor water slope ${max}m`);
});
