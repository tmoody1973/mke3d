import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { FISERV_INNER_RINGS, FISERV_SITE, FISERV_SOURCE, removeFiservPlaceholder } from '../src/fiservSite.ts';

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

test('full and LOD remove only the cached Fiserv relation and preserve all other packed data', () => {
  for (const [lod, expectedRemoved] of [[false, 294], [true, 141]] as const) {
    const group = cached(lod);
    const mesh = group.children.find(child => child.name === 'BLDG') as THREE.Mesh;
    const before = mesh.geometry;
    const otherSections = group.children.filter(child => child !== mesh)
      .map(child => ({ child, geometry: (child as THREE.Mesh).geometry }));
    const p = before.getAttribute('position'), c = before.getAttribute('color');
    const positions: number[] = [], colors: number[] = [];
    let oracleRemoved = 0;
    for (let i = 0; i < p.count; i += 3) {
      const vertices = [i, i + 1, i + 2];
      const fiserv = vertices.every(v => [3.41, 29.91].some(y => Math.abs(p.getY(v) - y) < .16)
        && FISERV_SOURCE.nodes.some(([x, z]) => Math.hypot(p.getX(v) - x, p.getZ(v) - z) < .16))
        && vertices.some(v => p.getY(v) > 29.7);
      if (fiserv) oracleRemoved++;
      else for (const v of vertices) {
        positions.push(p.getX(v), p.getY(v), p.getZ(v));
        colors.push(...c.array.slice(v * 3, v * 3 + 3));
      }
    }
    assert.equal(oracleRemoved, expectedRemoved);
    assert.equal(removeFiservPlaceholder(group, {i: 0, j: 0}), 0);
    assert.equal(mesh.geometry, before);
    assert.equal(removeFiservPlaceholder(group, {i: -1, j: 0}), expectedRemoved);
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('position').array), positions);
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('color').array), colors);
    for (const { child, geometry } of otherSections) assert.equal((child as THREE.Mesh).geometry, geometry);
    assert.equal(removeFiservPlaceholder(group, {i: -1, j: 0}), 0);
  }
});

test('removal requires BLDG, exact source nodes, and a source roof face', () => {
  const [a, b, c] = FISERV_SOURCE.footprint;
  for (const name of ['BLDG', 'ROAD']) for (const y of [3.41, 13.21, 60]) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      a[0], y, a[1], b[0], y, b[1], c[0], y, c[1],
    ], 3));
    const mesh = new THREE.Mesh(geometry); mesh.name = name;
    const group = new THREE.Group(); group.add(mesh);
    assert.equal(removeFiservPlaceholder(group, {i: -1, j: 0}), 0);
    assert.equal(mesh.geometry, geometry);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    a[0] + 1, 29.91, a[1], b[0] + 1, 29.91, b[1], c[0] + 1, 29.91, c[1],
  ], 3));
  const mesh = new THREE.Mesh(geometry); mesh.name = 'BLDG';
  const group = new THREE.Group(); group.add(mesh);
  assert.equal(removeFiservPlaceholder(group, {i: -1, j: 0}), 0);
});

test('site contract follows the mapped arena while leaving the east plaza outside its footprint', () => {
  assert.equal(FISERV_SITE.source.id, 10689047);
  assert.equal(FISERV_SITE.source.kind, 'relation');
  assert.equal(FISERV_SITE.source.mappedParts, false);
  assert.equal(FISERV_SITE.source.innerRings, 7);
  assert.equal(FISERV_INNER_RINGS.length, 7);
  assert.equal(FISERV_SOURCE.nodes.length, FISERV_SITE.footprint.length + 36);
  assert.ok(FISERV_SITE.width > 205 && FISERV_SITE.width < 207);
  assert.ok(FISERV_SITE.length > 125 && FISERV_SITE.length < 127);
  assert.ok(Math.abs(FISERV_SITE.bearing) < .02);
  assert.deepEqual(FISERV_SITE.footprint[0], FISERV_SITE.footprint.at(-1));
  assert.ok(Math.max(...FISERV_SITE.footprint.map(([x]) => x)) < -909);
});
