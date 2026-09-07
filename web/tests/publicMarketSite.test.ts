import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { PUBLIC_MARKET_SITE, PUBLIC_MARKET_SOURCE, removePublicMarketPlaceholder } from '../src/publicMarketSite.ts';

function shippedBuildings(suffix: string) {
  const buffer = readFileSync(new URL(`../public/data/tiles/t_-1_0${suffix}.bin`, import.meta.url));
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  assert.equal(buffer.subarray(12, 16).toString(), 'BLDG');
  const count = view.getUint32(16, true), scale = view.getFloat32(32, true);
  const origin = [20, 24, 28].map(index => view.getFloat32(index, true));
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < positions.length; index++) positions[index] = view.getInt16(36 + index * 2, true) * scale + origin[index % 3];
  const colorOffset = Math.ceil((36 + count * 6) / 4) * 4;
  const colors = new Uint8Array(buffer.subarray(colorOffset, colorOffset + count * 3));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, true));
  const mesh = new THREE.Mesh(geometry); mesh.name = 'BLDG';
  const group = new THREE.Group(); group.add(mesh);
  return { mesh, group, positions, colors };
}

test('metadata records parent and attached canopy IDs with explicit height provenance', () => {
  const data = JSON.parse(readFileSync(new URL('../../data/public_market_site.json', import.meta.url), 'utf8'));
  assert.equal(data.areas.length, 11);
  assert.deepEqual(data.analysis.replacement_source_ids, data.areas.map((area: { id: number }) => area.id));
  assert.deepEqual(data.analysis.preserve_adjacent_ids, [584794007, 584794107]);
  assert.equal(data.areas[0].height_estimated, true);
  assert.equal(data.areas[0].height_m, 6.6);
  assert.deepEqual(data.areas[0].outer_xz, PUBLIC_MARKET_SOURCE.footprint);
  assert.deepEqual(data.analysis.suggested_model_alignment.anchor_xz, [PUBLIC_MARKET_SITE.x, PUBLIC_MARKET_SITE.z]);
});

test('both detail levels remove market and attached canopies and preserve every unrelated vertex/color', () => {
  const data = JSON.parse(readFileSync(new URL('../../data/public_market_site.json', import.meta.url), 'utf8'));
  const signatures = data.areas.map((area: { bounds_xz: number[]; shipped_base_m?: number; shipped_roof_m?: number }) => ({
    bounds: area.bounds_xz, base: area.shipped_base_m ?? PUBLIC_MARKET_SOURCE.base, roof: area.shipped_roof_m ?? PUBLIC_MARKET_SOURCE.roof,
  }));
  for (const suffix of ['', '.lod']) {
    const { mesh, group, positions, colors } = shippedBuildings(suffix);
    const expectedPositions: number[] = [], expectedColors: number[] = [];
    for (let index = 0; index < positions.length; index += 9) {
      // Independent shipped-data oracle uses each source's tight bounds and height.
      const within = signatures.some(({ bounds: [x0, z0, x1, z1], base, roof }: { bounds: number[]; base: number; roof: number }) =>
        [index, index + 3, index + 6].every(vertex => positions[vertex] >= x0 - .16 && positions[vertex] <= x1 + .16
          && positions[vertex + 2] >= z0 - .16 && positions[vertex + 2] <= z1 + .16
          && Math.min(Math.abs(positions[vertex + 1] - base), Math.abs(positions[vertex + 1] - roof)) < .16));
      if (!within) {
        expectedPositions.push(...positions.slice(index, index + 9));
        expectedColors.push(...colors.slice(index, index + 9));
      }
    }
    assert.equal(removePublicMarketPlaceholder(group, { i: 1, j: 0 }), 0);
    assert.equal(mesh.geometry.getAttribute('position').array, positions);
    assert.equal(removePublicMarketPlaceholder(group, { i: -1, j: 0 }), suffix ? 78 : 353);
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('position').array), expectedPositions);
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('color').array), expectedColors);
    assert.equal(removePublicMarketPlaceholder(group, { i: -1, j: 0 }), 0);
  }
});

test('unrelated interior triangles, other heights and base-only triangles are preserved', () => {
  const [a, b, c] = PUBLIC_MARKET_SOURCE.footprint;
  const candidates = [
    [-250, 12.21, -25, -245, 12.21, -25, -250, 4.11, -30],
    ...[PUBLIC_MARKET_SOURCE.base, 25].map(height => [a[0], height, a[1], b[0], height, b[1], c[0], height, c[1]]),
  ];
  for (const positions of candidates) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Uint8BufferAttribute(new Uint8Array(9).fill(100), 3, true));
    const mesh = new THREE.Mesh(geometry); mesh.name = 'BLDG';
    const group = new THREE.Group(); group.add(mesh);
    assert.equal(removePublicMarketPlaceholder(group, { i: -1, j: 0 }), 0);
    assert.equal(mesh.geometry, geometry);
  }
});
