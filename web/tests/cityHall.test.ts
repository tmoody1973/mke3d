import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildCityHall } from '../src/cityHall.ts';

function bounds(object: THREE.Object3D) { object.updateMatrixWorld(true); return new THREE.Box3().setFromObject(object); }

test('City Hall geometry is finite and stays within the documented local height', () => {
  const hall = buildCityHall(), b = bounds(hall);
  assert.ok(Number.isFinite(b.min.x + b.min.y + b.min.z + b.max.x + b.max.y + b.max.z));
  assert.ok(b.min.y >= -0.01);
  assert.ok(b.max.y > 119 && b.max.y <= 119.8);
});

test('the office body remains low while the south tower dominates it', () => {
  const hall = buildCityHall();
  const brick = hall.getObjectByName('brick-masonry')!;
  const roof = hall.getObjectByName('curved-copper-spire')!;
  assert.ok(bounds(brick).max.y < 96);
  assert.ok(bounds(roof).max.y > 107);
  assert.ok(bounds(brick).max.z > 40, 'south entrance reaches the positive-Z end');
});

test('the pitched roof runs continuously across the long tapered body', () => {
  const roof = buildCityHall().getObjectByName('copper-roofs') as THREE.Mesh;
  const p = roof.geometry.getAttribute('position');
  const roofZ: number[] = [];
  for (let i = 0; i < p.count; i++) if (p.getY(i) >= 35.9 && p.getY(i) <= 47.1) roofZ.push(p.getZ(i));
  assert.ok(Math.min(...roofZ) <= -46 && Math.max(...roofZ) >= 34);
  roof.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  for (const z of [-40, -20, 0, 20, 28]) {
    ray.set(new THREE.Vector3(0, 50, z), new THREE.Vector3(0, -1, 0));
    assert.ok(ray.intersectObject(roof).some((hit) => hit.point.y >= 36), `roof covers body near Z=${z}`);
  }
  for (const x of [-11.9, 11.9]) {
    ray.set(new THREE.Vector3(x, 55, 20), new THREE.Vector3(0, -1, 0));
    assert.ok(ray.intersectObject(roof).some(hit => hit.point.y >= 36), 'Roof covers the wider wall shoulder');
  }
});

test('side window bays remain on the body rather than floating beyond its ends', () => {
  const windows = buildCityHall().getObjectByName('window-bays') as THREE.Mesh;
  const b = bounds(windows);
  assert.ok(b.min.z >= -46.3 && b.max.z <= 51);
});

test('clock stage has four separate outward faces and meshes have valid triangles', () => {
  const hall = buildCityHall();
  const clock = hall.getObjectByName('clock-faces') as THREE.Mesh;
  const pos = clock.geometry.getAttribute('position');
  assert.ok(pos.count > 200);
  hall.traverse((o) => { if (!(o instanceof THREE.Mesh)) return; const p = o.geometry.getAttribute('position');
    assert.equal(p.count % 3, 0); for (let i = 0; i < p.count; i++) assert.ok(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i))); });
});


test('clock faces are exposed on all four sides rather than buried in the tower', () => {
  const hall = buildCityHall(); hall.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const out = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    ray.set(new THREE.Vector3(0, 83.2, 42).addScaledVector(out, 30), out.negate());
    const hits = ray.intersectObject(hall, true);
    assert.ok(hits.length > 0);
    assert.ok(['clock-hands', 'clock-faces'].includes(hits[0].object.name),
      `Clock is occluded by ${hits[0].object.name} at angle ${angle}`);
  }
});

test('roofline contains raised Flemish gables and a secondary north lantern', () => {
  const hall = buildCityHall();
  const gables = bounds(hall.getObjectByName('flemish-roof-gables')!);
  const north = bounds(hall.getObjectByName('north-roof-lantern')!);
  assert.ok(gables.min.z < -30 && gables.max.z > 20);
  assert.ok(gables.max.y > 46 && gables.max.y < 50);
  assert.ok(north.max.z < -30 && north.max.y > 60 && north.max.y < 70);
});

test('all City Hall surfaces are non-degenerate within the geometry budget', () => {
  const hall = buildCityHall(); let triangles = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  hall.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return;
    const p = o.geometry.getAttribute('position'); triangles += p.count / 3;
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
      assert.ok(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-12, `${o.name} has a degenerate triangle`);
    }
  });
  assert.ok(triangles < 40_000, `Triangle count: ${triangles}`);
});
