import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { MUSEUM_SITE, removeMuseumPlaceholder } from '../src/museumSite.ts';
import { buildReimanBridge } from '../src/reimanBridge.ts';

test('museum axis aligns its entrance with the actual Reiman endpoint', () => {
  const entry = new THREE.Vector3(-40, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), MUSEUM_SITE.bearing)
    .add(new THREE.Vector3(MUSEUM_SITE.x, MUSEUM_SITE.floor, MUSEUM_SITE.z));
  const bridge = buildReimanBridge(() => 8);
  assert.ok(entry.distanceTo(new THREE.Vector3(...bridge.userData.end)) < .03);
  const lakeward = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), MUSEUM_SITE.bearing);
  assert.ok(lakeward.x > .99 && lakeward.z < 0, 'hall must point east and slightly north, not along the north gallery');
});

test('both shipped detail levels remove the three campus extrusions without changing unrelated buildings', () => {
  for (const suffix of ['', '.lod']) {
    const buffer = readFileSync(new URL(`../public/data/tiles/t_0_0${suffix}.bin`, import.meta.url));
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    assert.equal(buffer.subarray(12, 16).toString(), 'BLDG');
    const count = view.getUint32(16, true), scale = view.getFloat32(32, true);
    const origin = [20, 24, 28].map(i => view.getFloat32(i, true));
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < positions.length; i++) positions[i] = view.getInt16(36 + i * 2, true) * scale + origin[i % 3];
    const colorOffset = Math.ceil((36 + count * 6) / 4) * 4;
    const colors = new Uint8Array(buffer.subarray(colorOffset, colorOffset + count * 3));
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, true));
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(geometry); mesh.name = 'BLDG'; group.add(mesh);
    const original = Array.from(mesh.geometry.getAttribute('position').array);
    const removed = removeMuseumPlaceholder(group, { i: 0, j: 0 });
    assert.equal(removed, suffix ? 99 : 396, 'all three shipped campus placeholders must be removed');
    const after = mesh.geometry.getAttribute('position');
    assert.equal(after.count, original.length / 3 - removed * 3);
    // Everything outside the three tightly bounded source footprints is unchanged.
    const unrelated = (a: ArrayLike<number>) => {
      const out: number[] = [];
      for (let i = 0; i < a.length; i += 9) {
        const x=(a[i]+a[i+3]+a[i+6])/3, z=(a[i+2]+a[i+5]+a[i+8])/3;
        const campus=x>=596.3&&x<=725.2&&z>=-648.2&&z<=-420.5;
        if (!campus) for (let k = i; k < i + 9; k++) out.push(a[k]);
      }
      return out;
    };
    assert.deepEqual(unrelated(after.array), unrelated(original));
    assert.equal(removeMuseumPlaceholder(group, { i: 0, j: 0 }), 0, 'filter must be idempotent');
  }
});
