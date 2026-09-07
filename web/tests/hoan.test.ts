import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { buildHoan } from '../src/hoan.ts';
import type { HoanLightPath } from '../src/hoanLighting.ts';

const input = JSON.parse(readFileSync(new URL('../public/data/landmarks_geo.json', import.meta.url), 'utf8')).hoan;
// Uneven ground deliberately exposes accidental terrain-following through the span.
const groundAt = (x: number, z: number) => 5 + 4 * Math.sin(x / 70) + 3 * Math.cos(z / 90);
const bridge = buildHoan(input, groundAt);
bridge.updateMatrixWorld(true);
const { mainStart, mainEnd, mainSpanStart, mainSpanEnd, deckElevation, supportStations } = bridge.userData;
const start = new THREE.Vector3(...mainSpanStart);
const end = new THREE.Vector3(...mainSpanEnd);
const forward = end.clone().sub(start).normalize();
const side = new THREE.Vector3(-forward.z, 0, forward.x);
const roadway = bridge.getObjectByName('hoan-roadway')!;
const steel = bridge.getObjectByName('hoan-yellow-arches-hangers-braces')!;
const floorSystem = bridge.getObjectByName('hoan-bluegray-floor-system')!;

test('approach piers have open curved portals that flare toward the girder bearings', () => {
  const piers = bridge.getObjectByName('hoan-pier-bents')!;
  const portals = bridge.userData.approachPortals;
  assert.equal(portals.length + bridge.userData.lowClearanceBentCount, supportStations.length - 2,
    'every existing approach station retains a support, including shallow terrain clearances');
  assert.ok(portals.length > 0);
  for (const portal of portals) {
    const across = new THREE.Vector3(...portal.side);
    const along = new THREE.Vector3(across.z, 0, -across.x);
    const center = new THREE.Vector3(...portal.center);
    const hit = (lateral: number, y: number) => new THREE.Raycaster(
      center.clone().addScaledVector(across, lateral).addScaledVector(along, -2).setY(y), along, 0, 4,
    ).intersectObject(piers).length > 0;
    const height = portal.topY - portal.baseY;
    assert.equal(hit(0, portal.baseY + height * .5), false, 'portal center must remain see-through');
    assert.equal(hit(0, portal.baseY + .7), true, 'rounded opening must sit above the concrete base');
    for (const sign of [-1, 1]) {
      assert.equal(hit(sign * portal.halfWidth * .85, portal.topY - 1), true, 'flared head supports the outer deck');
      assert.equal(hit(sign * portal.halfWidth * .85, portal.baseY + height * .2), false, 'legs must narrow near ground');
      assert.equal(hit(sign * portal.halfWidth * .4, portal.baseY + 2), true, 'both concrete feet reach the base');
    }
  }
});

test('paired suspension rods leave a visible gap and main-pier portals stay open', () => {
  const station = bridge.userData.pairedHangerStations.reduce((nearest: number, value: number) =>
    Math.abs(value - (mainStart + mainEnd) / 2) < Math.abs(nearest - (mainStart + mainEnd) / 2) ? value : nearest);
  const center = start.clone().addScaledVector(forward, station - mainStart).setY(deckElevation + 8);
  const spacing = bridge.userData.hangerRodSpacingM;
  for (const sign of [-1, 1]) {
    for (const offset of [-spacing / 2, spacing / 2]) {
      const origin = center.clone().addScaledVector(forward, offset).addScaledVector(side, sign * 18);
      assert.ok(new THREE.Raycaster(origin, side.clone().multiplyScalar(-sign), 0, 5).intersectObject(steel).length,
        'both rods must exist as geometry on each arch');
    }
    const gap = center.clone().addScaledVector(side, sign * 18);
    assert.equal(new THREE.Raycaster(gap, side.clone().multiplyScalar(-sign), 0, 5).intersectObject(steel).length, 0,
      'daylight separates each rod pair');
  }
  for (const point of [start, end]) {
    const origin = point.clone().setY(24.95).addScaledVector(forward, -2);
    assert.equal(new THREE.Raycaster(origin, forward, 0, 4).intersectObject(steel).length, 0,
      'main pier has an open central portal instead of a diagonal X');
  }
});

test('arch LEDs sit outside both steel faces rather than being buried or floating', () => {
  const paths = (bridge.userData.lightPaths as HoanLightPath[]).filter(path => path.kind === 'arch');
  assert.deepEqual(paths.map(path => path.side), [-1, 1]);
  const heights = paths.flatMap(path => path.points.map(point => point[1]));
  assert.ok(Math.min(...heights) <= bridge.userData.archSpringY + .1, 'lighting follows the below-deck arch legs');
  assert.ok(Math.max(...heights) >= bridge.userData.archCrownY - .1, 'lighting reaches the arch crown');
  for (const path of paths) {
    assert.ok(path.points[0][1] < deckElevation && path.points.at(-1)![1] < deckElevation,
      'lighting includes the underdeck side-span framing');
  }
  const underdeckColumns = (bridge.userData.lightPaths as HoanLightPath[]).filter(path =>
    path.kind === 'hanger' && Math.max(...path.points.map(point => point[1])) < deckElevation);
  assert.ok(underdeckColumns.length >= 16, 'gold fixture paths include both side-span frames');
  for (const path of paths) {
    const outward = side.clone().multiplyScalar(path.side);
    for (let i = 1; i < path.points.length; i++) {
      const point = new THREE.Vector3(...path.points[i - 1]).lerp(new THREE.Vector3(...path.points[i]), 0.5);
      const hits = new THREE.Raycaster(point, outward.clone().negate(), 0, 0.5).intersectObject(steel);
      assert.ok(hits.length && hits[0].distance > 0.05, `LED is not mounted outside arch side ${path.side}, segment ${i}`);
    }
  }
  const lights = bridge.getObjectByName('hoan-architectural-lighting')!;
  bridge.userData.setLightingMode('night');
  assert.equal(lights.visible, true);
  bridge.userData.setLightingMode('day');
  assert.equal(lights.visible, false);
});

test('road is continuous and level directly beneath the entire arch span', () => {
  assert.ok(Math.abs(start.distanceTo(end) - 182.88) < 0.01);
  for (let i = 0; i <= 100; i++) {
    const p = start.clone().lerp(end, i / 100);
    // Sample both carriageways, including the exact arch endpoints.
    for (const offset of [-7, 0, 7]) {
      const origin = p.clone().addScaledVector(side, offset).setY(100);
      const hits = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0)).intersectObject(roadway);
      assert.ok(hits.length, `road missing at span sample ${i}, offset ${offset}`);
      assert.ok(Math.abs(hits[0].point.y - (deckElevation + 0.3)) < 0.01, 'road and arch elevations diverged');
    }
  }
});

test('thin slab exposes deep longitudinal girders, floor beams, and underside bracing', () => {
  assert.ok(bridge.userData.slabThickness < .8);
  const slab = bridge.getObjectByName('hoan-thin-concrete-deck')!;
  const center = start.clone().lerp(end, .5);
  for (const offset of [-9.3, 9.3]) {
    const p = center.clone().addScaledVector(side, offset).setY(deckElevation - 8);
    const hits = new THREE.Raycaster(p, new THREE.Vector3(0, 1, 0)).intersectObject(floorSystem);
    assert.ok(hits.length, `missing longitudinal girder at ${offset}`);
    assert.ok(hits[0].point.y < deckElevation - .3 && hits[0].point.y > deckElevation - 3.2);
  }
  const slabHit = new THREE.Raycaster(
    center.clone().addScaledVector(side, 8.7).setY(deckElevation - 3), new THREE.Vector3(0, 1, 0), 0, 4,
  ).intersectObject(slab)[0];
  assert.ok(slabHit && Math.abs(slabHit.point.y - (deckElevation - bridge.userData.slabThickness)) < .03);
  assert.ok((floorSystem as THREE.Mesh).geometry.getAttribute('position').count > (slab as THREE.Mesh).geometry.getAttribute('position').count);
});

test('the central arch springs below deck, crowns modestly above it, and leaves navigation open', () => {
  const bounds = new THREE.Box3().setFromObject(steel);
  assert.ok(bounds.min.y <= bridge.userData.archSpringY);
  assert.ok(bounds.min.y < deckElevation - 25);
  assert.ok(Math.abs(bridge.userData.archCrownY - (deckElevation + 23)) < .01);
  assert.ok(bounds.max.y > deckElevation + 22 && bounds.max.y < deckElevation + 25);
  assert.ok(supportStations.includes(mainStart) && supportStations.includes(mainEnd));
  assert.ok(supportStations.every((s: number) => s <= mainStart || s >= mainEnd));
  assert.ok(supportStations.every((s: number) => s === mainStart || s === mainEnd || s <= mainStart - bridge.userData.sideFrameExtent || s >= mainEnd + bridge.userData.sideFrameExtent), 'extra approach columns must not interrupt the framed side spans');
  const piers = bridge.getObjectByName('hoan-pier-bents')!;
  for (const endpoint of [start, end]) for (const lateral of [-15.3, 15.3]) {
    const p = endpoint.clone().addScaledVector(side, lateral).setY(100);
    const hits = new THREE.Raycaster(p, new THREE.Vector3(0, -1, 0)).intersectObject(piers);
    assert.ok(hits.length, 'main arch spring has no concrete bearing');
    assert.ok(hits[0].point.y <= bridge.userData.archSpringY + .1,
      'main-span concrete must stop at the low arch spring');
  }
});

test('the three-span structure is 36 m wide and centered between the mapped carriageways', () => {
  assert.equal(bridge.userData.deckWidthM, 36);
  assert.equal(bridge.userData.approachDeckWidthM, 24);
  assert.deepEqual(bridge.userData.centerCorrectionM, [-8, 0]);
  const slab = bridge.getObjectByName('hoan-thin-concrete-deck')!;
  const center = start.clone().lerp(end, .5);
  for (const lateral of [-17.8, 17.8]) {
    assert.ok(new THREE.Raycaster(center.clone().addScaledVector(side, lateral).setY(80),
      new THREE.Vector3(0, -1, 0)).intersectObject(slab).length, '36 m deck edge is missing');
  }
  for (const lateral of [-18.3, 18.3]) {
    assert.equal(new THREE.Raycaster(center.clone().addScaledVector(side, lateral).setY(80),
      new THREE.Vector3(0, -1, 0)).intersectObject(slab).length, 0, 'deck exceeds mapped outline');
  }
});

test('roadway reads as six lanes with a median, safety fencing, and unlit Y-poles', () => {
  const markings = bridge.getObjectByName('hoan-six-lane-markings')!;
  const center = start.clone().lerp(end, .5);
  for (const offset of [-7.86, -4.2, 4.2, 7.86]) {
    const hits = new THREE.Raycaster(center.clone().addScaledVector(side, offset).setY(50),
      new THREE.Vector3(0, -1, 0)).intersectObject(markings);
    assert.ok(hits.length, `missing lane divider at offset ${offset}`);
  }
  const median = bridge.getObjectByName('hoan-parapets-median')!;
  assert.ok(new THREE.Raycaster(center.clone().setY(50), new THREE.Vector3(0, -1, 0)).intersectObject(median).length);
  const safety = bridge.getObjectByName('hoan-safety-fence-light-poles')!;
  assert.ok(new THREE.Box3().setFromObject(safety).max.y > deckElevation + 9);
  bridge.traverse(object => assert.ok(!(object instanceof THREE.Light)));
  assert.ok(bridge.userData.structuralDrawCalls <= 8);
});

test('photo-derived structural proportions are explicitly marked as estimates', () => {
  assert.deepEqual(bridge.userData.structureEstimates, {
    archSpringY: 'photo-estimated 12 m scene elevation',
    crownRiseAboveDeckM: 'photo-estimated 23 m',
    slabThicknessM: 'photo-estimated 0.65 m',
    girderDepthM: 'photo-estimated 2.4 m',
  });
});

test('mesh coordinates are finite and endpoint roads match the existing elevated network', () => {
  bridge.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    assert.ok(Array.from(object.geometry.attributes.position.array).every(Number.isFinite));
    assert.ok(object.castShadow && object.receiveShadow);
  });
  for (const index of [0, input.centerline.length - 1]) {
    const [x, z] = input.centerline[index];
    const neighbor = input.centerline[index === 0 ? 1 : index - 1];
    // Stay 5 cm inside the cap: float32 vertex rounding makes an exact edge ray ambiguous.
    const inward = new THREE.Vector3(neighbor[0] - x, 0, neighbor[1] - z).normalize().multiplyScalar(0.05);
    const origin = new THREE.Vector3(x, 100, z).add(inward);
    const hits = new THREE.Raycaster(origin, new THREE.Vector3(0, -1, 0)).intersectObject(roadway);
    assert.ok(hits.length, 'missing endpoint roadway');
    assert.ok(Math.abs(hits[0].point.y - (groundAt(x, z) + 14.4)) < 0.02);
  }
});
