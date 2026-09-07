import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CAMPUS_CONTEXT } from '../src/campusContextData.ts';
import { buildMuseumLandscape, museumLandscapeClearance } from '../src/museumLandscape.ts';

test('new museum lawns follow terrain and extend north without resurfacing the existing campus', () => {
  const ground = (x: number, z: number) => 3 + x * .014 - z * .009;
  const root = buildMuseumLandscape(ground);
  const lawn = root.getObjectByName('museum-northern-lawns') as THREE.Mesh;
  const positions = lawn.geometry.getAttribute('position');
  assert.ok(positions.count > 1000);
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
    assert.ok(z <= -609.99 && z >= -1030.01, 'ground lawns remain north of the museum/garage roof');
    assert.ok(Math.abs(y - ground(x, z) - .14) < .0001, 'all lawn vertices follow local grade');
  }
  // Test triangle centroids against the old ground coverage: new infill must not duplicate it.
  for (let i = 0; i < positions.count; i += 3) {
    const x = (positions.getX(i) + positions.getX(i + 1) + positions.getX(i + 2)) / 3;
    const z = (positions.getZ(i) + positions.getZ(i + 1) + positions.getZ(i + 2)) / 3;
    for (const patch of CAMPUS_CONTEXT.grass) {
      if (patch.raised) continue;
      const [a, b, c] = patch.points;
      const sign = (p: number[], q: number[]) => (x - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (z - q[1]);
      const d = [sign(a, b), sign(b, c), sign(c, a)];
      assert.ok(!(d.every(v => v > .0001) || d.every(v => v < -.0001)), 'infill excludes pre-existing campus grass');
    }
  }
});

test('ground trees preserve mapped road/path clearance, with dense woodland and sparse lawn trees', () => {
  const ground = (x: number, z: number) => 5 + x * .001 + z * .002;
  const root = buildMuseumLandscape(ground);
  const trees = root.userData.treeSites;
  assert.ok(trees.length >= 150 && trees.length < 280);
  let woodland = 0, lawns = 0;
  for (const tree of trees) {
    assert.equal(tree.base, ground(tree.x, tree.z));
    assert.ok(tree.z <= -622 && tree.z >= -1030, 'trees never use the raised park deck');
    assert.ok(museumLandscapeClearance(tree.x, tree.z) >= tree.radius + .69);
    if ([401668061, 401668062, 401668067].includes(tree.source)) woodland++;
    if ([401317687, 401317688, 401668071].includes(tree.source)) lawns++;
  }
  assert.ok(woodland > 40 && lawns > 0 && lawns < 12);
  assert.ok(root.children.length <= 7, 'vegetation stays in merged material batches');
});

test('formal garden paths and hedges sit at grade and leave four central water-channel openings', () => {
  const root = buildMuseumLandscape(() => 4);
  const paths = root.getObjectByName('museum-garden-paths') as THREE.Mesh;
  const positions = paths.geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) assert.ok(Math.abs(positions.getY(i) - 4.22) < .0001);
  const hedges = root.getObjectByName('museum-garden-hedges') as THREE.Mesh;
  hedges.geometry.computeBoundingBox();
  assert.ok(Math.abs(hedges.geometry.boundingBox!.min.y - 4) < .0001);
  assert.ok(Math.abs(hedges.geometry.boundingBox!.max.y - 7) < .0001);
  assert.ok(root.userData.hedgeSites.length > 50);
  // A downward ray through each central opening must not intersect the tall hedge geometry.
  for (const [x, z] of [[581.15, -449.9], [583.3, -420.7], [585.4, -391.4], [587.5, -362.1]]) {
    const ray = new THREE.Raycaster(new THREE.Vector3(x, 20, z + 2.1), new THREE.Vector3(0, -1, 0));
    assert.equal(ray.intersectObject(hedges).length, 0);
  }
});
