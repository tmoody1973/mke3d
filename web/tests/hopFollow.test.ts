import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Director } from '../src/tour.ts';

const create = () => {
  const camera = new THREE.PerspectiveCamera(); camera.position.set(200, 100, 100);
  const controls = { target: new THREE.Vector3(), enabled: true };
  const director = new Director(camera, controls as never, [], () => ({ x: 0, y: 0, z: 0 }), false);
  return { director, camera, controls };
};
const pose = () => ({ position: new THREE.Vector3(0, 4, 0), tangent: new THREE.Vector3(0, 0, 1), cameraPosition: new THREE.Vector3(0, 36, -34) });

test('streetcar follow eases into a track-aligned camera without a first-frame jump', () => {
  const a = create(), b = create();
  for (const { director, camera } of [a, b]) {
    const initial = camera.position.clone(); director.startFollow(pose); director.update(0);
    assert.ok(camera.position.equals(initial)); assert.equal(director.isFollowing, true);
  }
  for (let i = 1; i <= 180; i++) a.director.update(i * 1000 / 60);
  for (let i = 1; i <= 90; i++) b.director.update(i * 1000 / 30);
  assert.ok(a.camera.position.distanceTo(b.camera.position) < 1e-6);
  assert.ok(a.camera.position.distanceTo(pose().cameraPosition) < 2);
});

test('manual cancellation and a new flight release follow camera ownership', () => {
  const { director, camera } = create(); director.startFollow(pose); director.update(0); director.update(100);
  director.cancelFlight(); const parked = camera.position.clone(); director.update(200);
  assert.equal(director.isFollowing, false); assert.ok(camera.position.equals(parked));
  director.startFollow(pose); director.flyTo(new THREE.Vector3(20, 30, 40), new THREE.Vector3(), 1);
  assert.equal(director.isFollowing, false); assert.equal(director.isAnimating, true);
});
