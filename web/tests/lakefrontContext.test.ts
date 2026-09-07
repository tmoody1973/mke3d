import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { buildLakefrontContext, PARK_DECK_Y } from '../src/lakefrontContext.ts';
import { buildReimanBridge } from '../src/reimanBridge.ts';

const terrain = (x: number, z: number) => 3 + x * .001 + z * .0005;

test('lakefront context produces finite, valid merged geometry within its draw budget', () => {
  const context = buildLakefrontContext(terrain);
  let meshes = 0, triangles = 0;
  context.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    meshes++;
    const positions = object.geometry.getAttribute('position');
    const normals = object.geometry.getAttribute('normal');
    assert.ok(positions && positions.count > 0);
    assert.equal(normals?.count, positions.count);
    assert.ok(Array.from(positions.array).every(Number.isFinite));
    object.geometry.computeBoundingBox();
    assert.ok(object.geometry.boundingBox && !object.geometry.boundingBox.isEmpty());
    triangles += (object.geometry.index?.count ?? positions.count) / 3;
  });
  assert.ok(meshes >= 4 && meshes <= 8, `${meshes} merged meshes`);
  assert.ok(triangles > 1_000 && triangles < 75_000, `${triangles} triangles`);
});

test('raised park roof meets the Reiman Bridge walking deck at the mapped landing', () => {
  const context = buildLakefrontContext(terrain);
  const bridge = buildReimanBridge(terrain);
  assert.equal(context.userData.parkRoofHeight, PARK_DECK_Y);
  assert.deepEqual(context.userData.bridgeLanding, bridge.userData.start);
  assert.equal(bridge.userData.start[1], PARK_DECK_Y);
});

test('garage facade exposes parking bays between its structural floor edges', () => {
  const context = buildLakefrontContext(terrain);
  context.updateMatrixWorld(true);
  const garage = context.getObjectByName('museum-center-park-garage')!;
  const towardGarage = new THREE.Vector3(-1, 0, 0);
  const slabHits = new THREE.Raycaster(new THREE.Vector3(540, 7.25, -515), towardGarage, 0, 30)
    .intersectObject(garage, true);
  const bayHits = new THREE.Raycaster(new THREE.Vector3(540, 6.1, -515), towardGarage, 0, 30)
    .intersectObject(garage, true);
  assert.ok(slabHits.length > 0, 'structural floor edge should be visible from the open side');
  assert.equal(bayHits.length, 0, 'space between structural levels should remain open');
});
