import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { buildLighthouseSite, lighthouseLandCoverAt, LIGHTHOUSE_SITE_BOUNDS } from '../src/lighthouseSite.ts';
import { LIGHTHOUSE_SITE_DATA } from '../src/lighthouseSiteData.ts';

const bridgeCenters = [[2749.6, -3333.6], [2800.9, -3393.9]] as const;
const terrain = (x: number, z: number) => {
  let height = 34 + (x - 2750) * .006 - (z + 3380) * .003;
  for (const [cx, cz] of bridgeCenters) height -= 13 * Math.exp(-(Math.pow(x - cx, 2) + Math.pow(z - cz, 2)) / 65);
  return height;
};
const site = buildLighthouseSite(terrain);
site.updateMatrixWorld(true);

test('source roads are clipped to the lighthouse ROI and retain mapped anchors', () => {
  assert.ok(LIGHTHOUSE_SITE_DATA.ways.length > 90);
  const ids = new Set(LIGHTHOUSE_SITE_DATA.ways.map(way => way.id));
  for (const id of [403217014, 45806683, 403345565, 403345566, 403345567, 403991565, 403991569, 403385113, 403666568]) assert.ok(ids.has(id), `missing OSM way ${id}`);
  for (const way of LIGHTHOUSE_SITE_DATA.ways) for (const path of way.paths) for (const [x, z] of path) {
    assert.ok(x >= LIGHTHOUSE_SITE_BOUNDS.minX && x <= LIGHTHOUSE_SITE_BOUNDS.maxX, `${way.id} x=${x}`);
    assert.ok(z >= LIGHTHOUSE_SITE_BOUNDS.minZ && z <= LIGHTHOUSE_SITE_BOUNDS.maxZ, `${way.id} z=${z}`);
  }
  const wahl = LIGHTHOUSE_SITE_DATA.ways.find(way => way.id === 403217014)!;
  assert.ok(wahl.paths.flat().some(([x, z]) => Math.hypot(x - 2618.9, z + 3377.5) < .2));
  assert.ok(!ids.has(18989099), 'East Ravine Road lies north of the exact replacement bounds');
  assert.equal(site.userData.eastRavineRoadClass, 'motor-vehicle-free paved park path');
});

test('rendered road geometry stays finite and inside the exact replacement patch', () => {
  let triangles = 0;
  for (const object of site.children) {
    if (!(object instanceof THREE.Mesh) || !object.name.startsWith('lighthouse-roads-')) continue;
    const position = object.geometry.getAttribute('position');
    for (let index = 0; index < position.count; index++) {
      const x = position.getX(index), y = position.getY(index), z = position.getZ(index);
      assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z));
      assert.ok(x >= LIGHTHOUSE_SITE_BOUNDS.minX && x <= LIGHTHOUSE_SITE_BOUNDS.maxX, `${object.name} x=${x}`);
      assert.ok(z >= LIGHTHOUSE_SITE_BOUNDS.minZ && z <= LIGHTHOUSE_SITE_BOUNDS.maxZ, `${object.name} z=${z}`);
    }
    triangles += position.count / 3;
  }
  assert.ok(triangles > 2_000, `${triangles} road triangles`);
  assert.ok(triangles < 30_000, `${triangles} road triangles`);
});

test('road edges independently follow cross-slope terrain', () => {
  const crossSlope = (x: number, z: number) => x * .17 + z * .09;
  const sloped = buildLighthouseSite(crossSlope);
  let sampled = 0;
  for (const object of sloped.children) {
    if (!(object instanceof THREE.Mesh) || !object.name.startsWith('lighthouse-roads-') || object.name.endsWith('-steps')) continue;
    const position = object.geometry.getAttribute('position');
    for (let index = 0; index < position.count; index += 17) {
      const x = position.getX(index), y = position.getY(index), z = position.getZ(index);
      const bridgeApproachLift = y - (crossSlope(x, z) - .3);
      assert.ok(bridgeApproachLift >= -2e-4 && bridgeApproachLift <= .801, `${object.name} edge offset ${bridgeApproachLift}`);
      sampled++;
    }
  }
  assert.ok(sampled > 1_000);
});

test('mapped steps have discrete treads and vertical risers', () => {
  const steps = site.getObjectByName('lighthouse-roads-steps') as THREE.Mesh;
  const position = steps.geometry.getAttribute('position');
  const heightsByPlan = new Map<string, Set<number>>();
  for (let index = 0; index < position.count; index++) {
    const key = `${position.getX(index).toFixed(3)},${position.getZ(index).toFixed(3)}`;
    const heights = heightsByPlan.get(key) ?? new Set<number>(); heights.add(Number(position.getY(index).toFixed(3))); heightsByPlan.set(key, heights);
  }
  assert.ok([...heightsByPlan.values()].some(heights => heights.size > 1), 'expected a vertical stair riser');
});

test('land cover is exposed for terrain coloring without overlay meshes', () => {
  assert.equal(lighthouseLandCoverAt(2650, -3400), 'grass');
  assert.equal(lighthouseLandCoverAt(2750, -3450), 'wood');
  assert.equal(lighthouseLandCoverAt(2400, -3400), undefined);
  assert.equal(site.getObjectByName('lighthouse-ground-grass'), undefined);
  assert.equal(site.getObjectByName('lighthouse-ground-wood'), undefined);
  assert.ok(site.getObjectByName('lighthouse-ground-pedestrian'));
});

test('Lion Bridge decks use endpoint terrain and span above each ravine', () => {
  assert.deepEqual(site.userData.bridges.map((bridge: { id: number }) => bridge.id).sort(), [403385113, 403666568]);
  for (const bridge of site.userData.bridges as Array<{ endpoints: [[number, number, number], [number, number, number]]; midpoint: [number, number, number] }>) {
    for (const [x, y, z] of bridge.endpoints) assert.ok(Math.abs(y - (terrain(x, z) + .5)) < 1e-6, `endpoint ${x},${z}`);
    const [x, y, z] = bridge.midpoint;
    assert.ok(y - terrain(x, z) > 5, `deck should span the ravine: clearance=${y - terrain(x, z)}`);
  }
});

test('woodland instances are deterministic, bounded, and leave the lighthouse view open', () => {
  const second = buildLighthouseSite(terrain);
  assert.equal(site.userData.treeCount, second.userData.treeCount);
  assert.ok(site.userData.treeCount > 50 && site.userData.treeCount <= 480, `${site.userData.treeCount} trees`);
  assert.deepEqual(site.userData.treePositions, second.userData.treePositions);
  for (const [x, z] of site.userData.treePositions as Array<[number, number]>) {
    assert.ok(x >= LIGHTHOUSE_SITE_BOUNDS.minX && x <= LIGHTHOUSE_SITE_BOUNDS.maxX);
    assert.ok(z >= LIGHTHOUSE_SITE_BOUNDS.minZ && z <= LIGHTHOUSE_SITE_BOUNDS.maxZ);
    assert.ok(!(x >= 2728 && x <= 2925 && Math.abs(z + 3380) < 18 + (x - 2728) * .08), `tree in lakeward view corridor at ${x},${z}`);
  }
});

test('site meshes stay economical and contain finite geometry', () => {
  let drawCalls = 0, triangles = 0;
  site.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    drawCalls++;
    const positions = object.geometry.getAttribute('position');
    assert.ok(Array.from(positions.array).every(Number.isFinite), object.name);
    triangles += (object.geometry.index?.count ?? positions.count) / 3 * (object instanceof THREE.InstancedMesh ? object.count : 1);
  });
  assert.ok(drawCalls <= 18, `${drawCalls} draw calls`);
  assert.ok(triangles < 150_000, `${triangles} triangles`);
});
