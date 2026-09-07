import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { COUTURE_SITE, COUTURE_SOURCE, removeCouturePlaceholder } from '../src/coutureSite.ts';
import { adaptHopPassages } from '../src/hopSite.ts';

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

test('full and LOD remove only the parent tower while preserving every other position/color', () => {
  for (const lod of [false, true]) {
    const group = cached(lod);
    const mesh = group.children.find(child => child.name === 'BLDG') as THREE.Mesh;
    const before = mesh.geometry;
    const p = before.getAttribute('position'), c = before.getAttribute('color');
    const positions: number[] = [], colors: number[] = [];
    let expectedRemoved = 0;
    // Independent oracle: Couture is the only 149.2m roof in this tight site box.
    for (let i = 0; i < p.count; i += 3) {
      const vertices = [i, i + 1, i + 2];
      const parent = vertices.every(v => p.getX(v) > 358.5 && p.getX(v) < 465
        && p.getZ(v) > -299.6 && p.getZ(v) < -192.9
        && [2.5, 149.2].some(y => Math.abs(p.getY(v) - y) < .16))
        && vertices.some(v => p.getY(v) > 149);
      if (parent) expectedRemoved++;
      else for (const v of vertices) {
        positions.push(p.getX(v), p.getY(v), p.getZ(v));
        colors.push(...c.array.slice(v * 3, v * 3 + 3));
      }
    }
    const otherSections = group.children.filter(child => child !== mesh).map(child => ({ child, geometry: (child as THREE.Mesh).geometry }));
    assert.equal(removeCouturePlaceholder(group, {i: 1, j: 0}), 0);
    assert.equal(mesh.geometry, before);
    assert.equal(expectedRemoved, lod ? 22 : 85);
    assert.equal(removeCouturePlaceholder(group, {i: 0, j: 0}), expectedRemoved);
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('position').array), positions);
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('color').array), colors);
    for (const {child, geometry} of otherSections) assert.equal((child as THREE.Mesh).geometry, geometry);
    assert.equal(removeCouturePlaceholder(group, {i: 0, j: 0}), 0);
  }
});

test('removal composes with passage correction in either order and retains Michigan passage', () => {
  const first = cached(false), second = cached(false);
  assert.equal(removeCouturePlaceholder(first, {i: 0, j: 0}), 85);
  assert.equal(adaptHopPassages(first, {i: 0, j: 0}), 10);
  assert.equal(adaptHopPassages(second, {i: 0, j: 0}), 18);
  assert.equal(removeCouturePlaceholder(second, {i: 0, j: 0}), 85);
  const a = first.children.find(c => c.name === 'BLDG') as THREE.Mesh;
  const b = second.children.find(c => c.name === 'BLDG') as THREE.Mesh;
  assert.deepEqual(a.geometry.getAttribute('position').array, b.geometry.getAttribute('position').array);
});

test('only exact source-node elevations match; interior and floor-only geometry remains', () => {
  for (const name of ['BLDG', 'ROAD']) {
    const [a, b, c] = COUTURE_SOURCE.footprint;
    const geometries = [
      [400, 149.2, -240, 401, 149.2, -240, 400, 2.5, -242],
      ...[2.5, 9.646, 180].map(y => [a[0], y, a[1], b[0], y, b[1], c[0], y, c[1]]),
    ];
    for (const points of geometries) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      const mesh = new THREE.Mesh(geometry); mesh.name = name;
      const group = new THREE.Group(); group.add(mesh);
      assert.equal(removeCouturePlaceholder(group, {i: 0, j: 0}), 0);
      assert.equal(mesh.geometry, geometry);
    }
  }
});

test('site contract places a slender mapped tower east of the open streetcar corridor', () => {
  assert.ok(COUTURE_SITE.towerWidth > 30 && COUTURE_SITE.towerWidth < 32);
  assert.ok(COUTURE_SITE.towerDepth > 42 && COUTURE_SITE.towerDepth < 44);
  assert.ok(COUTURE_SITE.transit.ceilingY - COUTURE_SITE.transit.northRailY >= 5);
  assert.ok(COUTURE_SITE.transit.clearWidth > 2.64 + 2);
  assert.equal(COUTURE_SITE.parts.concourseRoof.id, 1403766299);
  assert.equal(COUTURE_SITE.parts.garage.levels, 3);
  assert.ok(COUTURE_SITE.x - COUTURE_SITE.towerWidth / 2 > COUTURE_SITE.transit.north[0]);
});
