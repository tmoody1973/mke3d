import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { DISCOVERY_SITE, DISCOVERY_SOURCE, removeDiscoveryPlaceholder } from '../src/discoverySite.ts';

function shippedBuildings(suffix: string) {
  const buffer = readFileSync(new URL(`../public/data/tiles/t_0_0${suffix}.bin`, import.meta.url));
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

test('Discovery World metadata retains actual OSM parts and explicit estimated height provenance', () => {
  const data = JSON.parse(readFileSync(new URL('../../data/discovery_site.json', import.meta.url), 'utf8'));
  assert.deepEqual(data.analysis.replacement_source_ids, [55205380]);
  assert.equal(data.areas.length, 14);
  const upperRound = data.areas.find((area: { id: number }) => area.id === 700564602);
  assert.equal(upperRound.height_m, 11.5824);
  assert.equal(upperRound.height_source, 'OSM height tag');
  assert.ok(upperRound.min_height_source.startsWith('estimated:'));
  assert.deepEqual(data.areas[0].outer_xz, DISCOVERY_SOURCE.footprint);
  assert.deepEqual(data.analysis.suggested_model_alignment.anchor_xz, [DISCOVERY_SITE.x, DISCOVERY_SITE.z]);
});

test('both shipped detail levels remove only the parent extrusion and preserve every unrelated vertex/color', () => {
  for (const suffix of ['', '.lod']) {
    const { mesh, group, positions, colors } = shippedBuildings(suffix);
    const expectedPositions: number[] = [], expectedColors: number[] = [];
    const [x0, z0, x1, z1] = DISCOVERY_SOURCE.bounds;
    for (let index = 0; index < positions.length; index += 9) {
      const within = [index, index + 3, index + 6].every(vertex => positions[vertex] >= x0 && positions[vertex] <= x1
        && positions[vertex + 2] >= z0 && positions[vertex + 2] <= z1);
      if (!within) {
        expectedPositions.push(...positions.slice(index, index + 9));
        expectedColors.push(...colors.slice(index, index + 9));
      }
    }
    assert.equal(removeDiscoveryPlaceholder(group, { i: 1, j: 0 }), 0);
    assert.equal(mesh.geometry.getAttribute('position').array, positions);
    assert.equal(removeDiscoveryPlaceholder(group, { i: 0, j: 0 }), suffix ? 67 : 265);
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('position').array), expectedPositions);
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('color').array), expectedColors);
    assert.equal(removeDiscoveryPlaceholder(group, { i: 0, j: 0 }), 0);
  }
});

test('an unrelated triangle inside the parent bounds with matching elevations is preserved', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([700, 8.2, -200, 705, 8.2, -200, 700, -4.9, -205], 3));
  geometry.setAttribute('color', new THREE.Uint8BufferAttribute([80, 90, 100, 80, 90, 100, 80, 90, 100], 3, true));
  const mesh = new THREE.Mesh(geometry); mesh.name = 'BLDG';
  const group = new THREE.Group(); group.add(mesh);
  assert.equal(removeDiscoveryPlaceholder(group, { i: 0, j: 0 }), 0);
  assert.equal(mesh.geometry, geometry);
});
