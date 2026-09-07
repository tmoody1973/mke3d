import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { NM_SITE, NM_PARTS, NM_SOURCE, removeNmPlaceholder } from '../src/nmSite.ts';

function cached(lod: boolean) {
  const bytes = readFileSync(new URL(`../public/data/tiles/t_0_0${lod ? '.lod' : ''}.bin`, import.meta.url));
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

test('full and LOD remove the erroneous campus-height parent and preserve every other vertex/color', () => {
  for (const lod of [false, true]) {
    const group = cached(lod);
    const mesh = group.children.find(child => child.name === 'BLDG') as THREE.Mesh;
    const before = mesh.geometry;
    const p = before.getAttribute('position'), c = before.getAttribute('color');
    const positions: number[] = [], colors: number[] = [];
    let expectedRemoved = 0;
    // Independent cached-tile oracle: only this campus has a 182.25m roof
    // within this tight box. Historic HQ and North Office have different roofs.
    for (let i = 0; i < p.count; i += 3) {
      const vertices = [i, i + 1, i + 2];
      const parent = vertices.every(v => p.getX(v) > 182 && p.getX(v) < 433
        && p.getZ(v) > -580 && p.getZ(v) < -524
        && [13.109, 182.249].some(y => Math.abs(p.getY(v) - y) < .16))
        && vertices.some(v => p.getY(v) > 182);
      if (parent) expectedRemoved++;
      else for (const v of vertices) {
        positions.push(p.getX(v), p.getY(v), p.getZ(v));
        colors.push(...c.array.slice(v * 3, v * 3 + 3));
      }
    }
    const otherSections = group.children.filter(child => child !== mesh).map(child => ({ child, geometry: (child as THREE.Mesh).geometry }));
    assert.equal(removeNmPlaceholder(group, {i: 1, j: 0}), 0);
    assert.equal(mesh.geometry, before);
    assert.equal(expectedRemoved, lod ? 109 : 391);
    assert.equal(removeNmPlaceholder(group, {i: 0, j: 0}), expectedRemoved);
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('position').array), positions);
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('color').array), colors);
    for (const {child, geometry} of otherSections) assert.equal((child as THREE.Mesh).geometry, geometry);
    assert.equal(removeNmPlaceholder(group, {i: 0, j: 0}), 0);
  }
});

test('only exact source nodes and elevations match; low parts, unrelated interior and roads remain', () => {
  for (const name of ['BLDG', 'ROAD']) {
    const [a, b, c] = NM_SOURCE.footprint;
    const geometries = [
      [384, 182.249, -552, 385, 182.249, -552, 384, 13.109, -553],
      ...[NM_SOURCE.base, 31, 40, 180].map(y => [a[0], y, a[1], b[0], y, b[1], c[0], y, c[1]]),
    ];
    if (name === 'ROAD') geometries.push([a[0], NM_SOURCE.roof, a[1], b[0], NM_SOURCE.roof, b[1], c[0], NM_SOURCE.base, c[1]]);
    for (const points of geometries) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      const mesh = new THREE.Mesh(geometry); mesh.name = name;
      const group = new THREE.Group(); group.add(mesh);
      assert.equal(removeNmPlaceholder(group, {i: 0, j: 0}), 0);
      assert.equal(mesh.geometry, geometry);
    }
  }
});

test('mapped tower is east of Commons with preserved 1976 connector and no historic HQ replacement', () => {
  assert.equal(NM_SOURCE.id, 392821857);
  assert.ok(NM_SITE.towerWidth > 73 && NM_SITE.towerWidth < 75);
  assert.ok(NM_SITE.towerDepth > 51 && NM_SITE.towerDepth < 53);
  assert.equal(NM_SITE.referenceHeight, 169);
  const tower = Object.values(NM_PARTS).filter(p => p.levels > 20);
  assert.ok(tower.length > 8);
  assert.ok(tower.every(p => p.footprint.every(([x]) => x > 350)));
  assert.equal(NM_PARTS['701698822'].levels, 6);
  assert.equal(NM_PARTS['701698826'].levels, 5);
  assert.ok(!Object.values(NM_PARTS).some(p => Number(p.id) === 51865521 || Number(p.id) === 51865503));
  for (const part of Object.values(NM_PARTS)) assert.deepEqual(part.footprint[0], part.footprint.at(-1));
});
