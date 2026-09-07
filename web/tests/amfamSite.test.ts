import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { buildAmFam } from '../src/amfam.ts';
import { AMFAM_FOOTPRINT, AMFAM_INTERIOR_SOURCE_NODES, AMFAM_SITE, AMFAM_SOURCE,
  AMFAM_SOURCE_NODES, groundAmFamFoundation, removeAmFamPlaceholder } from '../src/amfamSite.ts';

function cached(lod:boolean) {
  const bytes=readFileSync(new URL(`../public/data/tiles/t_-3_-1${lod?'.lod':''}.bin`,import.meta.url));
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),group=new THREE.Group();let offset=12;
  for(let section=0;section<view.getUint32(8,true);section++) {
    const name=bytes.subarray(offset,offset+4).toString().trim();offset+=4;const count=view.getUint32(offset,true);offset+=4;
    const origin=[0,4,8].map(i=>view.getFloat32(offset+i,true));const scale=view.getFloat32(offset+12,true);offset+=16;
    const positions=new Float32Array(count*3);for(let i=0;i<positions.length;i++)positions[i]=view.getInt16(offset+i*2,true)*scale+origin[i%3];
    offset=Math.ceil((offset+count*6)/4)*4;const colors=new Uint8Array(bytes.subarray(offset,offset+count*3));offset=Math.ceil((offset+count*3)/4)*4;
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3,true));
    const mesh=new THREE.Mesh(geometry);mesh.name=name;group.add(mesh);
  } return group;
}

test('exact source nodes remove the stadium at both detail levels and preserve all packed data',()=>{
  for(const [lod,expected] of [[false,549],[true,222]] as const) {
    const group=cached(lod),mesh=group.children.find(o=>o.name==='BLDG') as THREE.Mesh;const before=mesh.geometry,p=before.getAttribute('position'),c=before.getAttribute('color');
    const positions:number[]=[],colors:number[]=[];let oracle=0;
    for(let i=0;i<p.count;i+=3) { const vertices=[i,i+1,i+2];
      const source=vertices.every(v=>[AMFAM_SOURCE.base,AMFAM_SOURCE.roof].some(y=>Math.abs(p.getY(v)-y)<.12)
        && AMFAM_SOURCE_NODES.some(([x,z])=>Math.hypot(p.getX(v)-x,p.getZ(v)-z)<.12))
        && vertices.some(v=>Math.abs(p.getY(v)-AMFAM_SOURCE.roof)<.12);
      if(source)oracle++;else for(const v of vertices){positions.push(p.getX(v),p.getY(v),p.getZ(v));colors.push(...c.array.slice(v*3,v*3+3));}
    }
    assert.equal(oracle,expected);const others=group.children.filter(o=>o!==mesh).map(o=>({o,g:(o as THREE.Mesh).geometry}));
    assert.equal(removeAmFamPlaceholder(group,{i:0,j:0}),0);assert.equal(mesh.geometry,before);
    assert.equal(removeAmFamPlaceholder(group,AMFAM_SOURCE.tile),expected);
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('position').array),positions);assert.deepEqual(Array.from(mesh.geometry.getAttribute('color').array),colors);
    for(const {o,g} of others)assert.equal((o as THREE.Mesh).geometry,g);assert.equal(removeAmFamPlaceholder(group,AMFAM_SOURCE.tile),0);
  }
});

test('source contract distinguishes mapped boundary from cached interior triangulation nodes',()=>{
  assert.equal(AMFAM_SOURCE.id,5747956);assert.equal(AMFAM_SOURCE.pitchId,1209147114);
  assert.equal(AMFAM_FOOTPRINT.length,143);assert.equal(AMFAM_INTERIOR_SOURCE_NODES.length,41);assert.equal(AMFAM_SOURCE_NODES.length,184);
  assert.equal(AMFAM_SITE.footprint,AMFAM_FOOTPRINT);const xs=AMFAM_FOOTPRINT.map(([x])=>x),zs=AMFAM_FOOTPRINT.map(([,z])=>z);
  assert.ok(Math.max(...xs)-Math.min(...xs)>245);assert.ok(Math.max(...zs)-Math.min(...zs)>252);
});

test('mapped foundation replaces the ellipse in place and reaches sampled terrain',()=>{
  const model=buildAmFam();model.position.set(AMFAM_SITE.x,AMFAM_SITE.floor,AMFAM_SITE.z);model.rotation.y=AMFAM_SITE.bearing;
  const old=model.getObjectByName('approximate-stadium-foundation') as THREE.Mesh,oldGeometry=old.geometry;
  const ground=(x:number,z:number)=>9.2+Math.sin(x/31)*.7+Math.cos(z/27)*.5;const foundation=groundAmFamFoundation(model,ground);
  assert.equal(foundation,old);assert.notEqual(foundation.geometry,oldGeometry);assert.deepEqual(foundation.position.toArray(),[0,0,0]);assert.deepEqual(foundation.scale.toArray(),[1,1,1]);
  model.updateMatrixWorld(true);const box=new THREE.Box3().expandByObject(foundation,true);const xs=AMFAM_FOOTPRINT.map(([x])=>x),zs=AMFAM_FOOTPRINT.map(([,z])=>z);
  assert.ok(Math.abs(box.min.x-Math.min(...xs))<.002&&Math.abs(box.max.x-Math.max(...xs))<.002);assert.ok(Math.abs(box.min.z-Math.min(...zs))<.002&&Math.abs(box.max.z-Math.max(...zs))<.002);
  const lowest=Math.min(...AMFAM_FOOTPRINT.map(([x,z])=>ground(x,z)));assert.ok(box.min.y<=lowest-.09);assert.ok(Math.abs(box.max.y-AMFAM_SITE.floor)<.002);
});

test('non-finite terrain falls back to a finite shallow mapped foundation',()=>{
  const model=buildAmFam();model.position.set(AMFAM_SITE.x,AMFAM_SITE.floor,AMFAM_SITE.z);model.rotation.y=AMFAM_SITE.bearing;
  const foundation=groundAmFamFoundation(model,()=>NaN),p=foundation.geometry.getAttribute('position');assert.ok(Array.from(p.array).every(Number.isFinite));assert.equal(foundation.userData.terrainBottom,-.6);
});
