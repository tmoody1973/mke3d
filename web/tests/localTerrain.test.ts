import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {terrainHeight,prepareLocalTerrain,cutGeometry,LIGHTHOUSE_BOUNDS,adaptLighthouseTile} from '../src/localTerrain.ts';
// Decode fixtures independently of TileManager's non-erasable TypeScript constructor.
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
const read=(path:string)=>{const b=readFileSync(new URL(path,import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
const base=parseTerrain(read('../public/data/terrain.bin'));
const source=parseTerrain(read('../public/data/lighthouse-terrain.bin'));
const patch=prepareLocalTerrain(base,source);
test('local elevations retain measured bluff and lakefront relief and match the surrounding perimeter',()=>{
 assert.equal(source.step,5);assert.equal(source.nx,125);assert.equal(source.ny,121);
 assert.ok(terrainHeight(patch,2734,-3380)>24);
 assert.ok(terrainHeight(patch,2925,-3392)<5);
 for(let j=0;j<patch.ny;j++)for(let i=0;i<patch.nx;i++){
  const x=patch.x0+i*5,z=-patch.y0-j*5,h=patch.heights[j*patch.nx+i];assert.ok(Number.isFinite(h));
  if(i===0||j===0||i===patch.nx-1||j===patch.ny-1)assert.ok(Math.abs(h-terrainHeight(base,x,z))<1e-5);
 }
 assert.ok(terrainHeight(patch,3030,-3380)<0,'lake bed must remain under water');
});
test('rectangle clipping preserves outside area without triangles covering a cutout',()=>{
 const g=new THREE.PlaneGeometry(20,20,2,2);g.rotateX(-Math.PI/2);
 const cut=cutGeometry(g,{minX:-3,maxX:3,minZ:-3,maxZ:3}),p=cut.getAttribute('position'),idx=cut.index!;
 let area=0;
 for(let i=0;i<idx.count;i+=3){
  const [a,b,c]=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,idx.getX(i+k)));
  area+=new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).length()/2;
  const center=a.clone().add(b).add(c).divideScalar(3);assert.ok(Math.abs(center.x)>=3-1e-6||Math.abs(center.z)>=3-1e-6);
 }
 assert.ok(Math.abs(area-364)<1e-4);assert.ok(cut.index,'keep terrain indexed for memory efficiency');
});
test('both streamed detail levels remove lighthouse placeholders and old streets inside the terrain patch',()=>{
 for(const suffix of['','.lod']){
  const group=new THREE.Group();
  for(const s of parseSections(read(`../public/data/tiles/t_1_1${suffix}.bin`))){const mesh=new THREE.Mesh(sectionToGeometry(s));mesh.name=s.name;group.add(mesh);}
  adaptLighthouseTile(group,{i:1,j:1},base,(x,z)=>terrainHeight(patch,x,z));
  for(const child of group.children as THREE.Mesh[]){
   const g=child.geometry,p=g.getAttribute('position'),idx=g.index!;
   for(let i=0;i<idx.count;i+=3){
    const ids=[0,1,2].map(k=>idx.getX(i+k)),x=ids.reduce((s,k)=>s+p.getX(k),0)/3,z=ids.reduce((s,k)=>s+p.getZ(k),0)/3;
    const b=child.name==='BLDG'?{minX:2721,maxX:2745,minZ:-3402,maxZ:-3374}:LIGHTHOUSE_BOUNDS;
    assert.ok(x<=b.minX+1e-3||x>=b.maxX-1e-3||z<=b.minZ+1e-3||z>=b.maxZ-1e-3);
   }
  }
 }
});
