import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { MARCUS_SITE, PECK_SITE, MARCUS_GARAGE_SITE, MARCUS_CONNECTOR_SITE, MARCUS_CANOPY_SITE,
  MARCUS_SITES, MARCUS_SKYWALK_SOURCE, MARCUS_PUBLIC_DATUM, removeMarcusPlaceholders } from '../src/marcusSite.ts';

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

test('full and LOD remove only the five campus sources and exact elevated connector ribbon', () => {
  // Independent source spans in the cached streams; no geometric removal predicate reused here.
  for (const [lod, buildingSpans, roadSpan, total] of [
    [false, [[7289,7376],[9908,10157],[10262,10301],[53989,54004],[54005,54053]], [6153,6162], 453],
    [true, [[1986,1995],[2558,2654],[10715,10736]], [2979,2988], 139],
  ] as const) {
    const group = cached(lod);
    const original = group.children.map(child => ({ child: child as THREE.Mesh, geometry: (child as THREE.Mesh).geometry }));
    const expected = new Map<string, { positions: number[]; colors: number[] }>();
    for (const { child, geometry } of original) {
      const p = geometry.getAttribute('position'), c = geometry.getAttribute('color');
      const spans = child.name === 'BLDG' ? buildingSpans : child.name === 'ROAD' ? [roadSpan] : [];
      const positions: number[] = [], colors: number[] = [];
      for (let t = 0; t < p.count / 3; t++) {
        if (spans.some(([start, end]) => t >= start && t <= end)) continue;
        for (let v = t * 3; v < t * 3 + 3; v++) {
          positions.push(p.getX(v), p.getY(v), p.getZ(v));
          colors.push(...c.array.slice(v * 3, v * 3 + 3));
        }
      }
      expected.set(child.name, { positions, colors });
    }
    assert.equal(removeMarcusPlaceholders(group, { i: 0, j: 0 }), 0);
    for (const { child, geometry } of original) assert.equal(child.geometry, geometry);
    assert.equal(removeMarcusPlaceholders(group, { i: -1, j: 0 }), total);
    for (const { child, geometry } of original) {
      const e = expected.get(child.name)!;
      assert.deepEqual(Array.from(child.geometry.getAttribute('position').array), e.positions);
      assert.deepEqual(Array.from(child.geometry.getAttribute('color').array), e.colors);
      if (!['BLDG', 'ROAD'].includes(child.name)) assert.equal(child.geometry, geometry);
    }
    assert.equal(removeMarcusPlaceholders(group, { i: -1, j: 0 }), 0);
  }
});

test('street below the exaggerated skywalk remains after elevated ribbon removal', () => {
  for (const lod of [false, true]) {
    const group = cached(lod);
    const road = group.children.find(child => child.name === 'ROAD') as THREE.Mesh;
    road.material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    group.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(-515.5, 30, -922), new THREE.Vector3(0,-1,0));
    const before = ray.intersectObject(road);
    assert.ok(before.some(hit => hit.point.y > 16 && hit.point.y < 17));
    const streetBefore = before.find(hit => hit.point.y < 10)!;
    assert.ok(streetBefore && streetBefore.point.y > 4 && streetBefore.point.y < 5);
    removeMarcusPlaceholders(group, { i: -1, j: 0 });
    const after = ray.intersectObject(road);
    assert.ok(after.length > 0);
    assert.ok(after.every(hit => hit.point.y < 10));
    assert.ok(Math.abs(after[0].point.y - streetBefore.point.y) < 1e-6);
  }
});

test('ground, nearby elevations, non-building sections and shifted nodes remain intact', () => {
  for (const site of MARCUS_SITES) {
    const [a,b,c] = site.footprint;
    for (const [name,y,dx] of [['ROAD',site.source.roof,0],['BLDG',site.source.base,0],
      ['BLDG',site.source.roof+.3,0],['BLDG',site.source.roof,1]] as const) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([
        a[0]+dx,y,a[1],b[0]+dx,y,b[1],c[0]+dx,y,c[1],
      ],3));
      const mesh = new THREE.Mesh(geometry); mesh.name=name;
      const group=new THREE.Group(); group.add(mesh);
      assert.equal(removeMarcusPlaceholders(group,{i:-1,j:0}),0);
      assert.equal(mesh.geometry,geometry);
    }
  }
  // Same skywalk nodes at street grade are deliberately retained.
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(MARCUS_SKYWALK_SOURCE.nodes.slice(0,3).flatMap(([x,,z])=>[x,4.4,z]),3));
  const mesh=new THREE.Mesh(geometry);mesh.name='ROAD';const group=new THREE.Group();group.add(mesh);
  assert.equal(removeMarcusPlaceholders(group,{i:-1,j:0}),0);
});

test('mapped sites retain the five exact campus objects and rotated rectangle bounds', () => {
  assert.deepEqual(MARCUS_SITES.map(site=>site.source.id),[68762980,599981655,66719111,68798760,599981653]);
  assert.equal(MARCUS_SITE.footprint.length,85);
  assert.equal(PECK_SITE.footprint.length,18);
  assert.equal(MARCUS_GARAGE_SITE.source.building,'parking');
  assert.equal(MARCUS_CONNECTOR_SITE.source.building,'bridge');
  assert.equal(MARCUS_CANOPY_SITE.source.building,'roof');
  for(const site of MARCUS_SITES) {
    assert.deepEqual(site.footprint[0],site.footprint.at(-1));
    const metersPerLon=111320*Math.cos(43.035*Math.PI/180);
    assert.ok(Math.abs((site.lon+87.905)*metersPerLon-site.x)<1e-6);
    assert.ok(Math.abs(-(site.lat-43.035)*110574-site.z)<1e-6);
    const cos=Math.cos(site.bearing),sin=Math.sin(site.bearing);
    for(const [x,z] of site.footprint) {
      const dx=x-site.x,dz=z-site.z;
      assert.ok(Math.abs(cos*dx-sin*dz)<=site.width/2+.002);
      assert.ok(Math.abs(sin*dx+cos*dz)<=site.depth/2+.002);
    }
    assert.ok(Math.abs(site.floor-site.source.base-1.5)<1e-9);
  }
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
  for(const sample of Object.values(MARCUS_PUBLIC_DATUM)) {
    assert.ok(Math.abs(terrain(sample.x,sample.z)-sample.terrain)<.001);
    if('road' in sample) {
      const ray=new THREE.Raycaster(new THREE.Vector3(sample.x,10,sample.z),new THREE.Vector3(0,-1,0));
      const hit=ray.intersectObject(road)[0];
      assert.ok(hit && Math.abs(hit.point.y-sample.road)<.002);
    }
  }
});
