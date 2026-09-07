import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { buildMuseumCampus } from '../src/museumCampus.ts';

const terrain = (x: number, z: number) => 2.7 + (x - 600) * .004 + (z + 640) * .002;
const campus = buildMuseumCampus(terrain);
campus.updateMatrixWorld(true);

test('campus preserves pavilion identity and aligns the two source footprints', () => {
  const museum = campus.getObjectByName('quadracci-pavilion')!;
  const position = new THREE.Vector3();
  museum.getWorldPosition(position);
  assert.ok(position.distanceTo(new THREE.Vector3(650, 10.7, -473.4)) < .01);
  assert.deepEqual(campus.userData.footprintIds, [403894584, 403895414, 446874803]);
  const kahler = campus.getObjectByName('kahler-lakeward-building') as THREE.Mesh;
  kahler.geometry.computeBoundingBox();
  assert.ok(kahler.position.x + kahler.geometry.boundingBox!.max.x <= 725);
  assert.ok(kahler.position.x + kahler.geometry.boundingBox!.min.x >= 654);
});

test('Court of Honor remains open to the sky above its raised museum base', () => {
  const metadata = campus.getObjectByName('war-memorial-center')!.userData.openCourt;
  const origin = new THREE.Vector3(...metadata.center);
  assert.ok(origin.y > terrain(origin.x, origin.z) + 5, 'court belongs at city level above the lakefront base');
  const upwardHits = new THREE.Raycaster(origin, new THREE.Vector3(0, 1, 0), 0, 100).intersectObjects(campus.children, true);
  assert.equal(upwardHits.length, 0, 'court center must have an unobstructed upward ray');
  const downHits = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0), 0, 2).intersectObjects(campus.children, true);
  assert.equal(downHits[0]?.object.name, 'court-of-honor-pool');
});

test('campus geometry remains finite and economical', () => {
  let meshes = 0, triangles = 0;
  campus.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    meshes++;
    const positions = object.geometry.getAttribute('position');
    assert.ok(Array.from(positions.array).every(Number.isFinite));
    triangles += (object.geometry.index?.count ?? positions.count) / 3;
  });
  assert.ok(meshes < 120, `${meshes} meshes`);
  assert.ok(triangles < 20_000, `${triangles} triangles`);
});
