import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { TURNER_HALL_SITE, TURNER_HALL_SOURCE, removeTurnerHallPlaceholder } from '../src/turnerHallSite.ts';

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

test('full and LOD remove only the cached Turner Hall way and preserve all other packed data', () => {
  for (const [lod, expectedRemoved] of [[false, 91], [true, 16]] as const) {
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
      const turnerHall = vertices.every(v => [2.01, 16.71].some(y => Math.abs(p.getY(v) - y) < .16)
        && TURNER_HALL_SOURCE.nodes.some(([x, z]) => Math.hypot(p.getX(v) - x, p.getZ(v) - z) < .16))
        && vertices.some(v => p.getY(v) > 16.5);
      if (turnerHall) oracleRemoved++;
      else for (const v of vertices) {
        positions.push(p.getX(v), p.getY(v), p.getZ(v));
        colors.push(...c.array.slice(v * 3, v * 3 + 3));
      }
    }
    assert.equal(oracleRemoved, expectedRemoved);
    assert.equal(removeTurnerHallPlaceholder(group, {i: 0, j: 0}), 0);
    assert.equal(mesh.geometry, before);
    assert.equal(removeTurnerHallPlaceholder(group, {i: -1, j: 0}), expectedRemoved);
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('position').array), positions);
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('color').array), colors);
    for (const { child, geometry } of otherSections) assert.equal((child as THREE.Mesh).geometry, geometry);
    assert.equal(removeTurnerHallPlaceholder(group, {i: -1, j: 0}), 0);
  }
});

test('removal requires BLDG, exact source nodes, and a source roof face', () => {
  const [a, b, c] = TURNER_HALL_SOURCE.footprint;
  for (const name of ['BLDG', 'ROAD']) for (const y of [2.01, 13.21, 60]) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      a[0], y, a[1], b[0], y, b[1], c[0], y, c[1],
    ], 3));
    const mesh = new THREE.Mesh(geometry); mesh.name = name;
    const group = new THREE.Group(); group.add(mesh);
    assert.equal(removeTurnerHallPlaceholder(group, {i: -1, j: 0}), 0);
    assert.equal(mesh.geometry, geometry);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    a[0] + 1, 16.71, a[1], b[0] + 1, 16.71, b[1], c[0] + 1, 16.71, c[1],
  ], 3));
  const mesh = new THREE.Mesh(geometry); mesh.name = 'BLDG';
  const group = new THREE.Group(); group.add(mesh);
  assert.equal(removeTurnerHallPlaceholder(group, {i: -1, j: 0}), 0);
});

test('site contract is the mapped rotated rectangle and preserves the west-facing frontage', () => {
  assert.equal(TURNER_HALL_SITE.source.id, 69298480);
  assert.equal(TURNER_HALL_SITE.source.kind, 'way');
  assert.equal(TURNER_HALL_SITE.source.innerRings, 0);
  assert.equal(TURNER_HALL_SITE.footprint.length, 32);
  assert.deepEqual(TURNER_HALL_SITE.footprint[0], TURNER_HALL_SITE.footprint.at(-1));
  const metersPerLon = 111320 * Math.cos(43.035 * Math.PI / 180);
  assert.ok(Math.abs((TURNER_HALL_SITE.lon + 87.905) * metersPerLon - TURNER_HALL_SITE.x) < 1e-6);
  assert.ok(Math.abs(-(TURNER_HALL_SITE.lat - 43.035) * 110574 - TURNER_HALL_SITE.z) < 1e-6);
  const cos = Math.cos(TURNER_HALL_SITE.bearing), sin = Math.sin(TURNER_HALL_SITE.bearing);
  const local = TURNER_HALL_SITE.footprint.map(([x, z]) => {
    const dx = x - TURNER_HALL_SITE.x, dz = z - TURNER_HALL_SITE.z;
    return [cos * dx - sin * dz, sin * dx + cos * dz];
  });
  for (const [x, z] of local) {
    assert.ok(Math.abs(x) <= TURNER_HALL_SITE.width / 2 + .002);
    assert.ok(Math.abs(z) <= TURNER_HALL_SITE.depth / 2 + .002);
  }
  assert.ok(local[0][0] < -23); // Projecting central portal on the west street face.
  assert.ok(Math.abs(TURNER_HALL_SITE.bearing) < .02);
  assert.equal(TURNER_HALL_SITE.floor, TURNER_HALL_SITE.source.base + 1.5);
});
