import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { mountOnFacade, type BuildingSign } from '../src/buildingSigns.ts';
import { BUILDING_SIGNS } from '../src/signLocations.ts';

test('sign mounting finds each facade and keeps its outward face above the wall', () => {
  const tower = new THREE.Mesh(new THREE.BoxGeometry(40, 180, 60), new THREE.MeshLambertMaterial());
  tower.position.set(100, 95, -200);
  tower.updateMatrixWorld(true);
  for (const face of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
    const spec: BuildingSign = { name: 'test', center: [100, -200], face, logo: 'test.svg', width: 20, height: 6, belowRoof: 8 };
    const mount = mountOnFacade(tower, spec);
    assert.ok(mount, 'facade not found');
    assert.equal(mount.position.y, 177);
    assert.ok(mount.normal.dot(new THREE.Vector3(face[0], 0, face[1])) > 0.99);
    const distance = Math.abs(face[0] ? mount.position.x - 100 : mount.position.z + 200);
    assert.ok(Math.abs(distance - (face[0] ? 20.18 : 30.18)) < 0.001);
  }
});

test('a logo wider than its wall is skipped instead of floating past the corners', () => {
  const tower = new THREE.Mesh(new THREE.BoxGeometry(20, 50, 20), new THREE.MeshLambertMaterial());
  tower.position.y = 25;
  tower.updateMatrixWorld(true);
  assert.equal(mountOnFacade(tower, {
    name: 'too-wide', center: [0, 0], face: [1, 0], logo: 'test.svg', width: 30, height: 5, belowRoof: 8,
  }), null);
});

test('every configured sign fits its facade in the shipped city tiles', () => {
  const tiles = new Map<string, THREE.Mesh>();
  for (const sign of BUILDING_SIGNS) {
    const key = `${Math.floor(sign.center[0] / 2000)}_${Math.floor(-sign.center[1] / 2000)}`;
    if (!tiles.has(key)) {
      const data = readFileSync(new URL(`../public/data/tiles/t_${key}.bin`, import.meta.url));
      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
      // BLDG is the first section in the shipped v2 fixture; decode its positions.
      assert.equal(data.subarray(12, 16).toString(), 'BLDG');
      const count = view.getUint32(16, true);
      const origin = [20, 24, 28].map(offset => view.getFloat32(offset, true));
      const scale = view.getFloat32(32, true);
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < positions.length; i++) positions[i] = view.getInt16(36 + i * 2, true) * scale + origin[i % 3];
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.computeVertexNormals();
      tiles.set(key, new THREE.Mesh(geometry, new THREE.MeshLambertMaterial()));
    }
    assert.ok(mountOnFacade(tiles.get(key)!, sign), `${sign.name} has no matching wall`);
  }
});
