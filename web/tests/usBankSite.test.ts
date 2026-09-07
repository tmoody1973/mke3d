import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { US_BANK_SITE, US_BANK_SOURCE, US_BANK_PARTS, removeUsBankPlaceholder } from '../src/usBankSite.ts';

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

test('full and LOD remove the parent only, preserving every surviving attribute', () => {
  for (const lod of [false, true]) {
    const group = cached(lod);
    const mesh = group.children.find(child => child.name === 'BLDG') as THREE.Mesh;
    mesh.geometry.computeVertexNormals();
    const before = mesh.geometry;
    const position = before.getAttribute('position');
    // An independent oracle uses the unique 190.5m roof inside this tight site
    // envelope. It does not use the production source-node signature.
    const keep: number[] = [];
    let expectedRemoved = 0;
    for (let i = 0; i < position.count; i += 3) {
      const vertices = [i, i + 1, i + 2];
      const parent = vertices.every(v => position.getX(v) > 192 && position.getX(v) < 281
        && position.getZ(v) > -431 && position.getZ(v) < -273
        && [5.8335, 190.5183].some(y => Math.abs(position.getY(v) - y) < .16))
        && vertices.some(v => position.getY(v) > 190);
      if (parent) expectedRemoved++;
      else keep.push(...vertices);
    }
    assert.equal(expectedRemoved, lod ? 37 : 169);
    const otherSections = group.children.filter(child => child !== mesh)
      .map(child => ({child, geometry: (child as THREE.Mesh).geometry}));
    assert.equal(removeUsBankPlaceholder(group, {i: 1, j: 0}), 0);
    assert.equal(mesh.geometry, before);
    assert.equal(removeUsBankPlaceholder(group, {i: 0, j: 0}), expectedRemoved);
    for (const [name, attribute] of Object.entries(before.attributes)) {
      const expected = keep.flatMap(v => Array.from(attribute.array.slice(v * attribute.itemSize, (v + 1) * attribute.itemSize)));
      const actual = mesh.geometry.getAttribute(name);
      assert.deepEqual(Array.from(actual.array), expected, name);
      assert.equal(actual.normalized, attribute.normalized);
      assert.equal(actual.array.constructor, attribute.array.constructor);
    }
    for (const {child, geometry} of otherSections) assert.equal((child as THREE.Mesh).geometry, geometry);
    assert.equal(removeUsBankPlaceholder(group, {i: 0, j: 0}), 0);
  }
});

test('source-node matching preserves interior, wrong-height, floor-only, and other sections', () => {
  const [a, b, c] = US_BANK_SOURCE.footprint;
  for (const name of ['BLDG', 'ROAD']) {
    const geometries = [
      [230, 190.5183, -360, 231, 190.5183, -360, 230, 5.8335, -362],
      ...[5.8335, 7.3335, 200].map(y => [a[0], y, a[1], b[0], y, b[1], c[0], y, c[1]]),
    ];
    if (name === 'ROAD') geometries.push([a[0], 190.5183, a[1], b[0], 190.5183, b[1], c[0], 5.8335, c[1]]);
    for (const points of geometries) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      const mesh = new THREE.Mesh(geometry); mesh.name = name;
      const group = new THREE.Group(); group.add(mesh);
      assert.equal(removeUsBankPlaceholder(group, {i: 0, j: 0}), 0);
      assert.equal(mesh.geometry, geometry);
    }
  }
});

test('mapped shaft frame encloses its source nodes and excludes neighboring buildings', () => {
  const site = US_BANK_SITE, cos = Math.cos(site.bearing), sin = Math.sin(site.bearing);
  for (const [x, z] of site.shaftFootprint) {
    const localX = (x - site.x) * cos - (z - site.z) * sin;
    const localZ = (x - site.x) * sin + (z - site.z) * cos;
    assert.ok(Math.abs(localX) <= site.width / 2 + .002);
    assert.ok(Math.abs(localZ) <= site.depth / 2 + .002);
  }
  assert.equal(site.height, 183.2);
  assert.equal(site.shaftId, 434845088);
  assert.equal(US_BANK_SOURCE.id, 34901930);
  assert.deepEqual(Object.values(US_BANK_PARTS).map(part => part.id),
    [434845089, 434845087, 700370375, 700370376, 700370371, 434845090]);
  assert.equal(US_BANK_PARTS.northGalleria.height, 7.62);
});
