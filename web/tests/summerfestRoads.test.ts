import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {adaptSummerfestTile,prepareSummerfestTerrain,summerfestApproachTerrainWeight,withinSummerfest} from '../src/summerfestSite.ts';
import {prepareHoanTerrain,adaptHoanContextTile} from '../src/hoanSite.ts';
import {bilinearTerrainHeight,terrainHeight} from '../src/localTerrain.ts';
import type {TerrainData} from '../src/loader.ts';

function loadTerrain():TerrainData{
 const b=readFileSync(new URL('../public/data/terrain.bin',import.meta.url)),d=new DataView(b.buffer,b.byteOffset,b.byteLength),nx=d.getUint32(4,true),ny=d.getUint32(8,true);
 return {nx,ny,x0:d.getFloat32(12,true),y0:d.getFloat32(16,true),step:d.getFloat32(20,true),heights:new Float32Array(b.buffer.slice(b.byteOffset+24,b.byteOffset+24+nx*ny*4)),colors:new Uint8Array(nx*ny*3)};
}
function road(j:number){
 const b=readFileSync(new URL(`../public/data/tiles/t_0_${j}.bin`,import.meta.url)),d=new DataView(b.buffer,b.byteOffset,b.byteLength);let offset=12;
 for(let s=0;s<d.getUint32(8,true);s++){
  const name=b.toString('ascii',offset,offset+4),count=d.getUint32(offset+4,true),origin=[8,12,16].map(k=>d.getFloat32(offset+k,true)),scale=d.getFloat32(offset+20,true);offset+=24;
  const positions=new Float32Array(count*3);for(let k=0;k<positions.length;k++)positions[k]=d.getInt16(offset+k*2,true)*scale+origin[k%3];
  offset=Math.ceil((offset+count*6)/4)*4;const colors=new Uint8Array(b.slice(offset,offset+count*3));offset=Math.ceil((offset+count*3)/4)*4;
  if(name!=='ROAD')continue;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3,true));
  const mesh=new THREE.Mesh(geometry);mesh.name='ROAD';const group=new THREE.Group();group.add(mesh);return {group,mesh};
 }throw new Error('ROAD missing');
}
const raw=loadTerrain(),corrected=prepareSummerfestTerrain(prepareHoanTerrain(raw)),groundAt=(x:number,z:number)=>bilinearTerrainHeight(corrected,x,z);
const original=road(-1),before=original.mesh.geometry.getAttribute('position').array.slice(),beforeColors=original.mesh.geometry.getAttribute('color').array.slice();
const started=performance.now();adaptSummerfestTile(original.group,{i:0,j:-1},groundAt,raw,corrected);const elapsed=performance.now()-started;
const after=original.mesh.geometry.getAttribute('position'),afterColors=original.mesh.geometry.getAttribute('color');
const triangleKey=(p:ArrayLike<number>,i:number)=>Array.from({length:9},(_,k)=>p[i+k]).join(',');
const afterTriangles=new Set<string>();for(let i=0;i<after.array.length;i+=9)afterTriangles.add(triangleKey(after.array,i));

test('festival terrain repair preserves complete elevated ROAD triangles, including Lake Freeway ramps',()=>{
 let decks=0;
 for(let i=0;i<before.length;i+=9){
  if(![0,3,6].some(k=>before[i+k]>80&&before[i+k]<880&&before[i+k+2]>-200&&before[i+k+2]<1660))continue;
  if(![0,3,6].some(k=>Math.abs(before[i+k+1]-bilinearTerrainHeight(raw,before[i+k],before[i+k+2])-.4)>1))continue;
  assert.ok(afterTriangles.has(triangleKey(before,i)),'elevated surface triangle was moved or cut');decks++;
 }
 assert.ok(decks>100);
 const rampHeights:number[]=[];for(let i=0;i<after.count;i++)if(Math.abs(after.getX(i)-400.05649)<.02&&Math.abs(after.getZ(i)-455.38852)<.02)rampHeights.push(after.getY(i));
 assert.ok(rampHeights.some(y=>y>32),'ramp surface must remain above its elevated supports');
});

test('mapped Lincoln Memorial and Chicago approaches lose false freeway-deck terrain returns',()=>{
 for(const [x,z] of [[362.6,278.9],[376.6,213.6],[379.8,133.8],[325.7,395.1]]){
  assert.ok(bilinearTerrainHeight(raw,x,z)>4.9,'source should reproduce the former terrain hump');
  assert.ok(groundAt(x,z)<3.2,`ground approach is still raised at${x},${z}`);
 }
 const base=prepareHoanTerrain(raw),fixed=prepareSummerfestTerrain(base);
 for(let row=0;row<base.ny;row++)for(let col=0;col<base.nx;col++){
  const i=row*base.nx+col,x=base.x0+col*base.step,z=-base.y0-row*base.step;
  if(withinSummerfest(x,z))continue;
  assert.ok(fixed.heights[i]<=base.heights[i],'outside the festival, low ground and water must never be raised');
  if(!summerfestApproachTerrainWeight(x,z))assert.equal(fixed.heights[i],base.heights[i],'unrelated city terrain changed');
 }
});

test('Erie Street and Harbor approaches follow corrected ground without changing mapped XZ or widths',()=>{
 const sample={x:475.95649,z:1001.38853};
 const heights:number[]=[];for(let i=0;i<after.count;i++)if(Math.abs(after.getX(i)-sample.x)<.02&&Math.abs(after.getZ(i)-sample.z)<.02)heights.push(after.getY(i));
 assert.ok(heights.some(y=>Math.abs(y-(groundAt(sample.x,sample.z)+.4))<.03),'raw DEM bridge return must no longer lift the surface road to32m');
 let outside=0;
 for(let i=0;i<before.length;i+=9)if([0,3,6].every(k=>before[i+k]<80||before[i+k]>880||before[i+k+2]<-200||before[i+k+2]>1660)){
  assert.ok(afterTriangles.has(triangleKey(before,i)));outside++;
 }
 assert.ok(outside>1000);
 // Source colors are normalized bytes. Rebuilding must not round their
 // normalized 0–1 accessors into black when copying the other tile streets.
 const originalColorValues=new Set(beforeColors);for(const value of afterColors.array)assert.ok(originalColorValues.has(value));
});

test('repaired road triangle interiors stay above the actual rendered terrain',t=>{
 let checked=0;
 for(let i=0;i<after.count;i+=3){
  const ps=[0,1,2].map(k=>[after.getX(i+k),after.getY(i+k),after.getZ(i+k)]);
  if(!ps.every(([x,y,z])=>x>80&&x<880&&z>-200&&z<1660&&Math.abs(y-groundAt(x,z)-.4)<1.1))continue;
  if(!ps.some(([x,,z])=>Math.abs(groundAt(x,z)-bilinearTerrainHeight(raw,x,z))>1))continue;
  for(const weights of [[1/3,1/3,1/3],[.6,.2,.2],[.2,.6,.2],[.2,.2,.6]]){
   const [x,y,z]=[0,1,2].map(axis=>ps.reduce((sum,p,k)=>sum+p[axis]*weights[k],0));
   assert.ok(y>=terrainHeight(corrected,x,z)-.6+.10,`road intersects terrain at${x},${z}`);
  }checked++;
 }
 assert.ok(checked>100);
 const stats=original.mesh.userData.summerfestRoads;
 assert.ok(stats.groundedTriangles>100);assert.ok(stats.vertices<stats.sourceVertices*1.5,JSON.stringify(stats));
 assert.ok(elapsed<5000,`road adaptation took${elapsed}ms`);
 t.diagnostic(`${JSON.stringify(stats)}; adaptation ${Math.round(elapsed)}ms; ${checked} terrain-clear triangles sampled`);
});

test('road correction is idempotent and cannot receive the Hoan height delta twice',()=>{
 const positions=after.array.slice();
 adaptSummerfestTile(original.group,{i:0,j:-1},groundAt,raw,corrected);
 adaptHoanContextTile(original.group,{i:0,j:-1},raw,groundAt);
 assert.deepEqual(original.mesh.geometry.getAttribute('position').array,positions);
 const other=road(-1),unchanged=other.mesh.geometry.getAttribute('position').array.slice();
 adaptSummerfestTile(other.group,{i:1,j:-1},groundAt,raw,corrected);
 assert.deepEqual(other.mesh.geometry.getAttribute('position').array,unchanged);
});
