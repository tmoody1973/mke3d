import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { adaptHopPassages, HOP_PASSAGE_OPENINGS } from '../src/hopSite.ts';

function cachedBuilding(lod = false) {
  const bytes = readFileSync(new URL(`../public/data/tiles/t_0_0${lod ? '.lod' : ''}.bin`, import.meta.url));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sections = view.getUint32(8, true);
  let offset = 12;
  for (let section = 0; section < sections; section++) {
    const name = String.fromCharCode(...Array.from({ length: 4 }, (_, i) => view.getUint8(offset + i))).trim();
    offset += 4;
    const count = view.getUint32(offset, true); offset += 4;
    const cx = view.getFloat32(offset, true), cy = view.getFloat32(offset + 4, true);
    const cz = view.getFloat32(offset + 8, true), scale = view.getFloat32(offset + 12, true); offset += 16;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = view.getInt16(offset + i * 6, true) * scale + cx;
      positions[i * 3 + 1] = view.getInt16(offset + i * 6 + 2, true) * scale + cy;
      positions[i * 3 + 2] = view.getInt16(offset + i * 6 + 4, true) * scale + cz;
    }
    offset += count * 6; offset += (4 - offset % 4) % 4;
    offset += count * 3; offset += (4 - offset % 4) % 4;
    if (name !== 'BLDG') continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    mesh.name = 'BLDG';
    const group = new THREE.Group(); group.add(mesh); group.updateMatrixWorld(true);
    return { group, mesh };
  }
  throw new Error('cached tile has no BLDG section');
}

function corridorHits(mesh: THREE.Mesh, point: [number, number], inside: [number, number], railY: number) {
  mesh.updateMatrixWorld(true);
  const direction = new THREE.Vector3(inside[0] - point[0], 0, inside[1] - point[1]).normalize();
  const side = new THREE.Vector3(-direction.z, 0, direction.x);
  let hits = 0;
  for (const lateral of [-1.3, 0, 1.3]) for (const rise of [.15, 1.8, 3.6]) {
    const origin = new THREE.Vector3(point[0], railY + rise, point[1])
      .addScaledVector(direction, -3).addScaledVector(side, lateral);
    const ray = new THREE.Raycaster(origin, direction, 0, 6);
    if (ray.intersectObject(mesh).length) hits++;
  }
  return hits;
}

test('cached source facades are corrected only at the mapped passage edges', () => {
  const { group, mesh } = cachedBuilding();
  const position = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
  const before = new Float32Array(position.array as Float32Array);
  const roofsBefore = Array.from(before).filter((_, i) => i % 3 === 1 && before[i] > 100);

  assert.equal(adaptHopPassages(group, { i: 0, j: 0 }), 18);
  assert.equal(adaptHopPassages(group, { i: 0, j: 0 }), 0, 'adapter is idempotent');

  let changed = 0;
  for (let i = 0; i < before.length; i++) {
    const after = (position.array as Float32Array)[i];
    if (after === before[i]) continue;
    changed++;
    assert.equal(i % 3, 1, 'only elevation may change');
    assert.ok(HOP_PASSAGE_OPENINGS.some(passage => Math.abs(after - passage.clearanceY) < 1e-5));
  }
  assert.equal(changed, 27, 'three duplicated low vertices on each of nine wall quads');
  const roofsAfter = Array.from(position.array as Float32Array).filter((_, i) => i % 3 === 1 && position.getY((i - 1) / 3) > 100);
  assert.equal(roofsAfter.length, roofsBefore.length, 'tower roofs and upper walls remain');
});

test('the corrected Couture facade clears the full streetcar height across its swept width', () => {
  const { group, mesh } = cachedBuilding();
  const before = corridorHits(mesh, [420.843, -283.821], [413.300, -243.274], 4.646);
  assert.ok(before > 0, 'fixture must expose the original facade collision');
  adaptHopPassages(group, { i: 0, j: 0 });
  assert.equal(corridorHits(mesh, [420.843, -283.821], [413.300, -243.274], 4.646), 0);

  const direction = new THREE.Vector3(413.300 - 420.843, 0, -243.274 + 283.821).normalize();
  const upperRay = new THREE.Raycaster(
    new THREE.Vector3(420.843, HOP_PASSAGE_OPENINGS[0].clearanceY + .5, -283.821).addScaledVector(direction, -3),
    direction, 0, 6,
  );
  assert.ok(upperRay.intersectObject(mesh).length, 'facade above the opening remains');
});

test('both Michigan Street passage faces clear the streetcar envelope', () => {
  const { group, mesh } = cachedBuilding();
  const west: [number, number] = [211.410, -305.881];
  const east: [number, number] = [272.143, -310.392];
  assert.ok(corridorHits(mesh, west, east, 6.413) > 0);
  assert.ok(corridorHits(mesh, east, west, 6.313) > 0);
  adaptHopPassages(group, { i: 0, j: 0 });
  assert.equal(corridorHits(mesh, west, east, 6.413), 0);
  assert.equal(corridorHits(mesh, east, west, 6.313), 0);
});

test('unrelated tiles and simplified distant geometry remain byte-for-byte unchanged', () => {
  for (const [lod, tile] of [[false, { i: 1, j: 0 }], [true, { i: 0, j: 0 }]] as const) {
    const { group, mesh } = cachedBuilding(lod);
    const position = mesh.geometry.getAttribute('position');
    const before = new Uint8Array(position.array.buffer.slice(0));
    assert.equal(adaptHopPassages(group, tile), 0);
    assert.deepEqual(new Uint8Array(position.array.buffer), before);
  }
});
