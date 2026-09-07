import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { BMO_SITE, BMO_NEIGHBOR, BMO_PUBLIC_DATUM, removeBmoPlaceholder } from '../src/bmoSite.ts';

function cached(lod: boolean) {
  const bytes = readFileSync(new URL(`../public/data/tiles/t_-1_0${lod ? '.lod' : ''}.bin`, import.meta.url));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const group = new THREE.Group();
  let offset = 12;
  for (let section = 0; section < view.getUint32(8, true); section++) {
    const name = bytes.subarray(offset, offset + 4).toString().trim(); offset += 4;
    const count = view.getUint32(offset, true); offset += 4;
    const origin = [0, 4, 8].map(i => view.getFloat32(offset + i, true));
    const scale = view.getFloat32(offset + 12, true); offset += 16;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < positions.length; i++) positions[i] = view.getInt16(offset + i * 2, true) * scale + origin[i % 3];
    offset = Math.ceil((offset + count * 6) / 4) * 4;
    const colors = new Uint8Array(bytes.subarray(offset, offset + count * 3));
    offset = Math.ceil((offset + count * 3) / 4) * 4;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, true));
    const mesh = new THREE.Mesh(geometry); mesh.name = name; group.add(mesh);
  }
  return group;
}

test('only the new BMO Tower chunks disappear; the older bank and every non-BMO vertex remain', () => {
  // Independent packed source ranges, not a repeat of the geometric predicate.
  for (const [lod,start,end,total] of [[false,53371,53455,85],[true,10613,10631,19]] as const) {
    const group=cached(lod);
    const mesh=group.children.find(child=>child.name==='BLDG') as THREE.Mesh;
    const before=mesh.geometry;
    const other=group.children.filter(child=>child!==mesh).map(child=>({child:child as THREE.Mesh,geometry:(child as THREE.Mesh).geometry}));
    const p=before.getAttribute('position'),c=before.getAttribute('color');
    const positions:number[]=[],colors:number[]=[];
    for(let t=0;t<p.count/3;t++) {
      if(t>=start&&t<=end)continue;
      for(let v=t*3;v<t*3+3;v++) {
        positions.push(p.getX(v),p.getY(v),p.getZ(v));
        colors.push(...c.array.slice(v*3,v*3+3));
      }
    }
    assert.equal(removeBmoPlaceholder(group,{i:0,j:0}),0);
    assert.equal(mesh.geometry,before);
    assert.equal(removeBmoPlaceholder(group,{i:-1,j:0}),total);
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('position').array),positions);
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('color').array),colors);
    for(const {child,geometry} of other)assert.equal(child.geometry,geometry);
    assert.equal(removeBmoPlaceholder(group,{i:-1,j:0}),0);
  }
});

test('shared footprint nodes cannot remove the older bank, ground, roads or offset structures', () => {
  const [a,b,c]=BMO_SITE.footprint;
  for(const [name,y,dx]of [
    ['BLDG',BMO_NEIGHBOR.roof,0],
    ['BLDG',BMO_NEIGHBOR.base,0],
    ['BLDG',BMO_SITE.source.base,0],
    ['ROAD',BMO_SITE.source.roof,0],
    ['BLDG',BMO_SITE.source.roof,1],
  ] as const) {
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute([
      a[0]+dx,y,a[1],b[0]+dx,y,b[1],c[0]+dx,y,c[1],
    ],3));
    const mesh=new THREE.Mesh(geometry);mesh.name=name;
    const group=new THREE.Group();group.add(mesh);
    assert.equal(removeBmoPlaceholder(group,{i:-1,j:0}),0);
    assert.equal(mesh.geometry,geometry);
  }
});

test('placement retains the full mapped footprint and its angled western corners', () => {
  const site=BMO_SITE;
  assert.equal(site.source.id,592527373);
  assert.equal(site.source.mappedLevels,25);
  assert.equal(site.footprint.length,30);
  assert.deepEqual(site.footprint[0],site.footprint.at(-1));
  assert.ok(site.width>86&&site.width<87);
  assert.ok(site.depth>35&&site.depth<36);
  const cos=Math.cos(site.bearing),sin=Math.sin(site.bearing);
  site.footprint.forEach(([x,z],i)=>{
    const dx=x-site.x,dz=z-site.z;
    const localX=cos*dx-sin*dz,localZ=sin*dx+cos*dz;
    assert.ok(Math.abs(localX)<=site.width/2+.002);
    assert.ok(Math.abs(localZ)<=site.depth/2+.002);
    assert.ok(Math.abs(localX-site.localFootprint[i][0])<.002);
    assert.ok(Math.abs(localZ-site.localFootprint[i][1])<.002);
  });
  assert.ok(site.localFootprint[0][0]<site.localFootprint[1][0]-5);
});

test('public approach datums retain the measured west-to-east terrain slope', () => {
  const bytes=readFileSync(new URL('../public/data/terrain.bin',import.meta.url));
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const nx=view.getUint32(4,true),ny=view.getUint32(8,true),x0=view.getFloat32(12,true),y0=view.getFloat32(16,true),step=view.getFloat32(20,true);
  const terrain=(x:number,z:number)=>{
    const fx=(x-x0)/step,fy=(-z-y0)/step;
    const i=Math.max(0,Math.min(nx-2,Math.floor(fx))),j=Math.max(0,Math.min(ny-2,Math.floor(fy)));
    const u=fx-i,v=fy-j;
    const [a,b,c,d]=[j*nx+i,j*nx+i+1,(j+1)*nx+i,(j+1)*nx+i+1].map(k=>view.getFloat32(24+k*4,true));
    return v>=u?a*(1-v)+c*(v-u)+d*u:a*(1-u)+b*(u-v)+d*v;
  };
  for(const sample of Object.values(BMO_PUBLIC_DATUM))
    assert.ok(Math.abs(terrain(sample.x,sample.z)-sample.terrain)<.001);
  assert.ok(BMO_PUBLIC_DATUM.eastSide.terrain-BMO_PUBLIC_DATUM.waterEntrance.terrain>3.5);
});
