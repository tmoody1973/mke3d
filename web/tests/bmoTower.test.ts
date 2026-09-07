import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildBmoTower } from '../src/bmoTower.ts';
import { BMO_SITE as site } from '../src/bmoSite.ts';

test('BMO mapped split tower and podium are finite, bounded and efficiently merged', () => {
  const root = buildBmoTower(() => 0); root.updateMatrixWorld(true);
  assert.equal(root.name, 'bmo-tower'); assert.equal(root.rotation.y, site.bearing);
  let triangles = 0;
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const p = object.geometry.getAttribute('position'), n = object.geometry.getAttribute('normal');
    assert.equal(p.count, n.count); for (const v of p.array) assert.ok(Number.isFinite(v));
    triangles += object.geometry.index ? object.geometry.index.count / 3 : p.count / 3;
  });
  const bounds = new THREE.Box3().setFromObject(root);
  assert.ok(Math.abs(bounds.max.y - root.position.y - 99.9744) < .06);
  assert.ok(triangles < 70000, `${triangles} triangles`); assert.ok(root.children.length < 24);
  assert.equal(root.userData.officeFloors, 15); assert.equal(root.userData.parkingFloors, 8);
  // Eastern footprint continues at podium height, while offices end 18m west.
  const local = new THREE.Raycaster(new THREE.Vector3(35, 130, 0).applyMatrix4(root.matrixWorld), new THREE.Vector3(0, -1, 0));
  const east = local.intersectObject(root, true)[0]; assert.ok(east); assert.ok(east.point.y < root.position.y + 37);
  const north = new THREE.Raycaster(new THREE.Vector3(0, 130, -8).applyMatrix4(root.matrixWorld), new THREE.Vector3(0, -1, 0)).intersectObject(root, true)[0];
  const south = new THREE.Raycaster(new THREE.Vector3(0, 130, 11).applyMatrix4(root.matrixWorld), new THREE.Vector3(0, -1, 0)).intersectObject(root, true)[0];
  assert.ok(north.point.y - south.point.y > 3.5);
});

test('night facade lights are deterministic, selective and fully reset in day', () => {
  const root = buildBmoTower(() => 0);
  assert.ok(root.userData.panelCounts.dark > root.userData.panelCounts.lit * 3);
  const lit = (root.getObjectByName('bmo-litGlass') as THREE.Mesh).material as THREE.MeshStandardMaterial;
  root.userData.setLightingMode('night'); assert.equal(lit.emissiveIntensity, .5);
  root.userData.setLightingMode('sunset'); assert.equal(lit.emissiveIntensity, .19);
  root.userData.setLightingMode('day');
  root.traverse(o => { if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) assert.equal(o.material.emissiveIntensity, ['litGlass', 'entryGlass', 'warm', 'blue'].includes(o.userData.part) || o.name.startsWith('bmo-sign-') ? 0 : 1); });
  assert.equal(root.children.filter(o => o instanceof THREE.Light).length, 0);
});

test('crown logos face north and Water Street with left-to-right outward reading axes', () => {
  const root = buildBmoTower(() => 0);
  for (const name of ['north-crown', 'water-crown', 'water-entry']) {
    const sign = root.getObjectByName(`bmo-sign-${name}`) as THREE.Mesh;
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(sign.quaternion);
    assert.ok(name === 'north-crown' ? normal.z < -.99 : normal.x < -.95);
    const camera = new THREE.PerspectiveCamera(); camera.position.copy(sign.position).addScaledVector(normal, 10); camera.lookAt(sign.position); camera.updateMatrixWorld(true); sign.updateMatrix();
    const left = new THREE.Vector3(-1, 0, 0).applyMatrix4(sign.matrix).applyMatrix4(camera.matrixWorldInverse);
    const right = new THREE.Vector3(1, 0, 0).applyMatrix4(sign.matrix).applyMatrix4(camera.matrixWorldInverse);
    assert.ok(left.x < right.x); assert.equal((sign.material as THREE.Material).side, THREE.FrontSide);
  }
});

test('Water Street doors are ahead of opaque structure and floor follows the street slope', () => {
  const terrain = (x: number) => (x + 355) * .04 + 5;
  const root = buildBmoTower(terrain); root.updateMatrixWorld(true);
  assert.ok(root.position.y < 6, 'Lobby must use Water Street grade, not the eastern 9m terrain');
  const entrance = root.userData.entrance, normal = new THREE.Vector3(...entrance.normal).applyQuaternion(root.quaternion);
  for (const [x, z] of entrance.doorCenters) {
    const eye = new THREE.Vector3(x, entrance.floor + 2.3, z).applyMatrix4(root.matrixWorld).addScaledVector(normal, 7);
    const hits = new THREE.Raycaster(eye, normal.clone().negate()).intersectObject(root, true);
    assert.ok(hits.length > 0); assert.equal(hits[0].object.userData.part, 'entryGlass');
    const solid = hits.find(h => h.object.userData.part === 'dark'); assert.ok(solid); assert.ok(solid.distance > hits[0].distance + 2);
  }
});
