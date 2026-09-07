import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { removeCityHallPlaceholder } from '../src/cityHallSite.ts';

test('only the City Hall extrusion is removed at both tile detail levels', () => {
  for (const suffix of ['', '.lod']) {
    const b = readFileSync(new URL(`../public/data/tiles/t_-1_0${suffix}.bin`, import.meta.url));
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    assert.equal(b.subarray(12, 16).toString(), 'BLDG');
    const count = v.getUint32(16, true), scale = v.getFloat32(32, true);
    const origin = [20,24,28].map(i => v.getFloat32(i,true));
    const p = new Float32Array(count*3);
    for (let i=0; i<p.length; i++) p[i] = v.getInt16(36+i*2,true)*scale+origin[i%3];
    const offset = Math.ceil((36+count*6)/4)*4;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(p,3));
    g.setAttribute('color',new THREE.BufferAttribute(new Uint8Array(b.subarray(offset,offset+count*3)),3,true));
    const group = new THREE.Group(), mesh = new THREE.Mesh(g); mesh.name='BLDG'; group.add(mesh);
    const removed = removeCityHallPlaceholder(group,{i:-1,j:0});
    assert.equal(removed, suffix ? 22 : 151);
    assert.equal(mesh.geometry.getAttribute('position').count,count-removed*3);
    assert.equal(removeCityHallPlaceholder(group,{i:-1,j:0}),0);
  }
});
