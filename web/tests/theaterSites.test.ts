import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { PABST_SITE, RIVERSIDE_SITE, THEATER_SOURCES, THEATER_PLACEHOLDER_SOURCES, RIVERSIDE_CANOPY_SOURCE, removeTheaterPlaceholders } from '../src/theaterSites.ts';

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

test('cached full and LOD remove exactly both buildings and the separate marquee roof and preserve all surrounding data', () => {
  // Independently recorded source ranges in the existing cached BLDG stream.
  // This oracle deliberately does not reproduce the node/elevation predicate.
  for (const [lod, spans] of [
    [false, [[9331, 9457], [9621, 9714], [31537, 31573]]],
    [true, [[2465, 2501], [2502, 2529]]],
  ] as const) {
    const group = cached(lod);
    const mesh = group.children.find(child => child.name === 'BLDG') as THREE.Mesh;
    const before = mesh.geometry;
    const others = group.children.filter(child => child !== mesh)
      .map(child => ({ child, geometry: (child as THREE.Mesh).geometry }));
    const p = before.getAttribute('position'), c = before.getAttribute('color');
    const positions: number[] = [], colors: number[] = [];
    let expectedRemoved = 0;
    for (let triangle = 0; triangle < p.count / 3; triangle++) {
      if (spans.some(([start, end]) => triangle >= start && triangle <= end)) {
        expectedRemoved++;
        continue;
      }
      for (let v = triangle * 3; v < triangle * 3 + 3; v++) {
        positions.push(p.getX(v), p.getY(v), p.getZ(v));
        colors.push(...c.array.slice(v * 3, v * 3 + 3));
      }
    }
    assert.equal(expectedRemoved, lod ? 65 : 258);
    assert.equal(removeTheaterPlaceholders(group, { i: 0, j: 0 }), 0);
    assert.equal(mesh.geometry, before);
    assert.equal(removeTheaterPlaceholders(group, { i: -1, j: 0 }), expectedRemoved);
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('position').array), positions);
    assert.deepEqual(Array.from(mesh.geometry.getAttribute('color').array), colors);
    for (const { child, geometry } of others) assert.equal((child as THREE.Mesh).geometry, geometry);
    assert.equal(removeTheaterPlaceholders(group, { i: -1, j: 0 }), 0);
  }
});

test('nearby roofs, ground, roads, and shifted nodes cannot match theater sources', () => {
  for (const site of THEATER_PLACEHOLDER_SOURCES) {
    const [a, b, c] = site.footprint;
    for (const [name, y, dx] of [
      ['ROAD', site.source.roof, 0],
      ['BLDG', site.source.base, 0],
      ['BLDG', site.source.roof + .2, 0], // Pabst neighbor has roof 14.31, just 0.20 m higher.
      ['BLDG', site.source.roof, 1],
    ] as const) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute([
        a[0] + dx, y, a[1], b[0] + dx, y, b[1], c[0] + dx, y, c[1],
      ], 3));
      const mesh = new THREE.Mesh(geometry); mesh.name = name;
      const group = new THREE.Group(); group.add(mesh);
      assert.equal(removeTheaterPlaceholders(group, { i: -1, j: 0 }), 0);
      assert.equal(mesh.geometry, geometry);
    }
  }
});

test('mapped anchors and rotated bounds preserve both full building footprints', () => {
  assert.equal(PABST_SITE.source.id, 68649538);
  assert.equal(RIVERSIDE_SITE.source.id, 68641417);
  assert.equal(RIVERSIDE_SITE.source.name, 'Empire Building');
  assert.equal(RIVERSIDE_SITE.source.mappedLevels, 13);
  assert.equal(PABST_SITE.footprint.length, 33);
  assert.equal(RIVERSIDE_SITE.footprint.length, 44);
  for (const site of THEATER_SOURCES) {
    assert.equal(site.source.kind, 'way');
    assert.equal(site.source.innerRings, 0);
    assert.deepEqual(site.footprint[0], site.footprint.at(-1));
    const metersPerLon = 111320 * Math.cos(43.035 * Math.PI / 180);
    assert.ok(Math.abs((site.lon + 87.905) * metersPerLon - site.x) < 1e-6);
    assert.ok(Math.abs(-(site.lat - 43.035) * 110574 - site.z) < 1e-6);
    const cos = Math.cos(site.bearing), sin = Math.sin(site.bearing);
    const local = site.footprint.map(([x, z]) => {
      const dx = x - site.x, dz = z - site.z;
      return [cos * dx - sin * dz, sin * dx + cos * dz];
    });
    for (const [x, z] of local) {
      assert.ok(Math.abs(x) <= site.width / 2 + .002);
      assert.ok(Math.abs(z) <= site.depth / 2 + .002);
    }
    assert.ok(Math.abs(site.floor - site.source.base - 1.5) < 1e-9);
  }
});


test('the separately mapped Riverside canopy cannot leave a wall across the theater entrance', () => {
  assert.equal(RIVERSIDE_CANOPY_SOURCE.source.id, 397489770);
  assert.equal(RIVERSIDE_CANOPY_SOURCE.source.building, 'roof');
  assert.equal(RIVERSIDE_CANOPY_SOURCE.source.layer, 1);
  for (const lod of [false, true]) {
    const group = cached(lod);
    const mesh = group.children.find(child => child.name === 'BLDG') as THREE.Mesh;
    mesh.material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    group.updateMatrixWorld(true);
    const rays = [-486, -483, -480].map(x => new THREE.Raycaster(
      new THREE.Vector3(x, 3.6, -410), new THREE.Vector3(0, 0, -1), 0, 21,
    ));
    // Existing full-detail data has an erroneous 5 m tall canopy prism.
    // LOD still has the Empire extrusion across the same entrance.
    for (const ray of rays) {
      const hit = ray.intersectObject(mesh)[0];
      assert.ok(hit, `expected original entry obstruction (LOD=${lod})`);
      assert.ok(hit.point.z > -427 && hit.point.z < -425);
    }
    removeTheaterPlaceholders(group, { i: -1, j: 0 });
    for (const ray of rays) assert.equal(ray.intersectObject(mesh).length, 0,
      `entry must stay open at x=${ray.ray.origin.x} (LOD=${lod})`);
  }
});
