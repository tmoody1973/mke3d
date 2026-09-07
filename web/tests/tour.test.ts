import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { Director } from '../src/tour.ts';
import type { Landmark } from '../src/landmarks.ts';

const stop = (id: string, x: number): Landmark => ({ id, name: id, lat: 0, lon: x, osm: '', blurb: '', view: [220, 110, 25], labelHeight: 60 });
const stops = [stop('one', 500), stop('two', -500)];
function setup(reduced = false, list = stops) {
  const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 180, 700);
  const controls = { target: new THREE.Vector3(), enabled: true };
  const director = new Director(camera, controls as never, list, l => ({ x: l.lon, y: 5, z: 0 }), reduced);
  return { camera, controls, director };
}
function run(d: Director, ms: number, frame: number, start = 0) { d.update(start); for (let t = frame; t < ms; t += frame) d.update(start + t); d.update(start + ms); }

test('flight is frame-rate independent', () => {
  const a = setup(), b = setup(), pos = new THREE.Vector3(800, 260, -300), target = new THREE.Vector3(500, 70, 0);
  a.director.flyTo(pos, target, 5); b.director.flyTo(pos, target, 5); run(a.director, 3000, 1000 / 60); run(b.director, 3000, 100);
  assert.ok(a.camera.position.distanceTo(b.camera.position) < 0.001); assert.ok(a.controls.target.distanceTo(b.controls.target) < 0.001);
});

test('tour has no teleport at flight and dwell boundaries', () => {
  const { camera, director } = setup(); director.startTour(); director.update(0); let previous = camera.position.clone(), largest = 0;
  for (let t = 50; t <= 30000; t += 50) { director.update(t); largest = Math.max(largest, camera.position.distanceTo(previous)); previous = camera.position.clone(); }
  assert.ok(largest < 18, `largest 50ms movement was ${largest}`); assert.equal(director.tour.index, 1);
});

test('pause freezes and manual movement rejoins the same stop smoothly', () => {
  const { camera, controls, director } = setup(); director.startTour(); run(director, 2000, 50); const index = director.tour.index;
  director.togglePause(); const frozen = camera.position.clone(); run(director, 5000, 50, 2000); assert.ok(camera.position.equals(frozen));
  camera.position.add(new THREE.Vector3(80, 20, -40)); controls.target.x += 20; director.togglePause(); const manual = camera.position.clone(); director.update(7000); director.update(7050);
  assert.ok(camera.position.distanceTo(manual) < 2); assert.equal(director.tour.index, index);
});

test('stop cancels without completion or advance', () => {
  const { director, controls } = setup(); let steps = 0; director.onTourStep = l => { if (l) steps++; };
  director.startTour(); run(director, 1000, 50); director.stopTour(); run(director, 30000, 50, 1000);
  assert.equal(steps, 1); assert.equal(director.isAnimating, false); assert.equal(controls.enabled, true);
});

test('manual movement during a landmark sweep rejoins without a jump', () => {
  const { camera, controls, director } = setup();
  director.startTour(); run(director, 16000, 50);
  assert.ok(director.tour.dwellUntil > 0);
  const index = director.tour.index;
  director.togglePause(); assert.equal(director.isAnimating, false);
  camera.position.add(new THREE.Vector3(60, 15, -40)); controls.target.x += 30;
  const manual = camera.position.clone(); director.togglePause(); director.update(16000);
  assert.ok(camera.position.distanceTo(manual) < 0.001);
  let previous = camera.position.clone(), largest = 0;
  for (let t = 16050; t <= 20500; t += 50) {
    director.update(t); largest = Math.max(largest, camera.position.distanceTo(previous)); previous.copy(camera.position);
  }
  assert.ok(largest < 8, `rejoin jumped ${largest} m in 50ms`);
  assert.equal(director.tour.index, index);
});

test('empty and reduced-motion tours never animate', () => {
  const empty = setup(false, []); empty.director.startTour(); assert.equal(empty.director.tour.active, false);
  const reduced = setup(true); reduced.director.startTour(); assert.equal(reduced.director.isAnimating, false); const at = reduced.camera.position.clone();
  run(reduced.director, 2500, 100); assert.equal(reduced.director.tour.index, 1); assert.equal(reduced.director.isAnimating, false); assert.ok(!reduced.camera.position.equals(at));
});

test('reduced motion flyTo snaps and pose respects terrain exaggeration', () => {
  const reduced = setup(true), destination = new THREE.Vector3(4, 5, 6); let done = 0;
  reduced.director.flyTo(destination, new THREE.Vector3(1, 2, 3), undefined, () => done++); assert.ok(reduced.camera.position.equals(destination)); assert.equal(done, 1);
  const tall = { ...stops[0], focusHeight: 200, view: [200, 0, 1] as [number, number, number] };
  const d = new Director(new THREE.PerspectiveCamera(), { target: new THREE.Vector3(), enabled: true } as never, [tall], () => ({ x: 10, y: 3, z: 20 }), false, { groundAt: () => 7, exaggeration: () => 2 });
  const pose = d.poseFor(tall); assert.equal(pose.target.y, 414); assert.ok(pose.pos.y > pose.target.y);
});

for (const speed of [2, 4]) {
  test(`${speed}× speeds up both drone flights and landmark orbits`, () => {
    const normal = setup(), fast = setup();
    fast.director.setSpeed(speed);
    normal.director.startTour(); fast.director.startTour();
    // Equal simulated frame steps also exercise the flight-to-orbit boundary.
    run(normal.director, 16000, 40);
    run(fast.director, 16000 / speed, 40 / speed);
    assert.ok(normal.director.tour.dwellUntil > 0);
    assert.equal(fast.director.tour.index, normal.director.tour.index);
    assert.ok(normal.camera.position.distanceTo(fast.camera.position) < 0.001);
    assert.ok(normal.controls.target.distanceTo(fast.controls.target) < 0.001);
    assert.equal(fast.director.tour.dwellUntil, normal.director.tour.dwellUntil);
  });
}

test('live speed changes preserve the camera pose and pause state', () => {
  const normal = setup(), fast = setup();
  normal.director.startTour(); fast.director.startTour();
  run(normal.director, 2000, 50); run(fast.director, 2000, 50);
  const before = fast.camera.position.clone();
  fast.director.setSpeed(4);
  assert.ok(fast.camera.position.equals(before));
  run(normal.director, 2000, 40, 2000); run(fast.director, 500, 10, 2000);
  assert.ok(normal.camera.position.distanceTo(fast.camera.position) < 0.001);
  fast.director.togglePause();
  const paused = fast.camera.position.clone();
  fast.director.setSpeed(2); run(fast.director, 2000, 50, 2500);
  assert.ok(fast.director.tour.paused);
  assert.ok(fast.camera.position.equals(paused));
  fast.director.togglePause(); run(fast.director, 500, 50, 4500);
  assert.ok(fast.camera.position.distanceTo(paused) > 1);
  fast.director.stopTour(); fast.director.startTour();
  assert.equal(fast.director.speed, 2);
});

test('drone speed does not change manual navigation or vehicle following', () => {
  const normal = setup(), fast = setup(); fast.director.setSpeed(4);
  const pos = new THREE.Vector3(500, 200, -400), target = new THREE.Vector3(500, 30, 0);
  normal.director.flyTo(pos, target, 5); fast.director.flyTo(pos, target, 5);
  run(normal.director, 2000, 50); run(fast.director, 2000, 50);
  assert.ok(normal.camera.position.equals(fast.camera.position));
  const follow = () => ({ position: pos, tangent: new THREE.Vector3(1, 0, 0) });
  normal.director.startFollow(follow); fast.director.startFollow(follow);
  run(normal.director, 1000, 50); run(fast.director, 1000, 50);
  assert.ok(normal.camera.position.equals(fast.camera.position));
});
