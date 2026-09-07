import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { RAVE_SITE, RAVE_PUBLIC_DATUM, RAVE_FRONT_SIDEWALK, removeRavePlaceholder } from '../src/raveSite.ts';

function cached(lod: boolean) {
  const bytes = readFileSync(new URL(`../public/data/tiles/t_-2_0${lod ? '.lod' : ''}.bin`, import.meta.url));
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

test('only the Rave full and LOD source chunks disappear; neighbors and roads retain their exact packed data', () => {
  // Independent cached BLDG source spans, not the geometric removal predicate.
  for(const [lod,start,end,total]of [[false,2666,2834,169],[true,947,980,34]] as const) {
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
    assert.equal(removeRavePlaceholder(group,{i:-1,j:0}),0);
    assert.equal(mesh.geometry,before);
    assert.equal(removeRavePlaceholder(group,{i:-2,j:0}),total);
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('position').array),positions);
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('color').array),colors);
    for(const {child,geometry}of other)assert.equal(child.geometry,geometry);
    assert.equal(removeRavePlaceholder(group,{i:-2,j:0}),0);
  }
});

test('ground, roads, shifted nodes and unrelated roof elevations cannot match the Rave source', () => {
  const [a,b,c]=RAVE_SITE.footprint;
  for(const [name,y,dx]of [
    ['BLDG',RAVE_SITE.source.base,0],['ROAD',RAVE_SITE.source.roof,0],
    ['BLDG',RAVE_SITE.source.roof+.3,0],['BLDG',RAVE_SITE.source.roof,1],
  ] as const) {
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute([
      a[0]+dx,y,a[1],b[0]+dx,y,b[1],c[0]+dx,y,c[1],
    ],3));
    const mesh=new THREE.Mesh(geometry);mesh.name=name;
    const group=new THREE.Group();group.add(mesh);
    assert.equal(removeRavePlaceholder(group,{i:-2,j:0}),0);
    assert.equal(mesh.geometry,geometry);
  }
});

test('the five-story source footprint and north projecting entry remain within mapped bounds', () => {
  const site=RAVE_SITE;
  assert.equal(site.source.id,567330938);
  assert.equal(site.source.mappedLevels,5);
  assert.equal(site.footprint.length,58);
  assert.deepEqual(site.footprint[0],site.footprint.at(-1));
  const metersPerLon=111320*Math.cos(43.035*Math.PI/180);
  assert.ok(Math.abs((site.lon+87.905)*metersPerLon-site.x)<1e-6);
  assert.ok(Math.abs(-(site.lat-43.035)*110574-site.z)<1e-6);
  const cos=Math.cos(site.bearing),sin=Math.sin(site.bearing);
  for(const [x,z]of site.footprint) {
    const dx=x-site.x,dz=z-site.z;
    assert.ok(Math.abs(cos*dx-sin*dz)<=site.width/2+.002);
    assert.ok(Math.abs(sin*dx+cos*dz)<=site.depth/2+.002);
  }
  assert.ok(Math.abs(site.floor-site.source.base-1.5)<1e-9);
  assert.equal(site.entrance.facade,'north');
  assert.ok(site.entrance.localPavilionZ<site.entrance.localFacadeZ);
  assert.ok(RAVE_FRONT_SIDEWALK.points.every(([,z])=>z<Math.min(...site.footprint.map(([,pz])=>pz))-30));
  assert.ok(RAVE_PUBLIC_DATUM.frontCenter.terrain-RAVE_PUBLIC_DATUM.rear.terrain>3);
  assert.ok(site.entrance.suggestedFloor>RAVE_PUBLIC_DATUM.frontEast.terrain);
});

test('public ground datums reproduce actual cached terrain and street surfaces', () => {
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
  const road=cached(false).children.find(child=>child.name==='ROAD') as THREE.Mesh;
  road.material=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});road.updateMatrixWorld(true);
  for(const sample of Object.values(RAVE_PUBLIC_DATUM)) {
    assert.ok(Math.abs(terrain(sample.x,sample.z)-sample.terrain)<.001);
    if('road' in sample) {
      const ray=new THREE.Raycaster(new THREE.Vector3(sample.x,60,sample.z),new THREE.Vector3(0,-1,0));
      const hit=ray.intersectObject(road)[0];
      assert.ok(hit && Math.abs(hit.point.y-sample.road)<.002);
    }
  }
});
