import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  buildLighthouse, LIGHTHOUSE_HOUSE_FOOTPRINT, LIGHTHOUSE_SITE,
  LIGHTHOUSE_TOWER_FOOTPRINT, LIGHTHOUSE_TOWER_HEIGHT_M,
} from '../src/lighthouse.ts';

const groundAt = (x: number, z: number) => 18 + Math.sin(x / 83) * 2 + Math.cos(z / 71) * 3;

function bounds(object: THREE.Object3D) {
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object);
}

test('model is world-positioned on terrain at the mapped lighthouse site', () => {
  const model = buildLighthouse(groundAt);
  assert.equal(model.name, 'north-point-lighthouse');
  assert.equal(model.position.x, LIGHTHOUSE_SITE.x);
  assert.equal(model.position.z, LIGHTHOUSE_SITE.z);
  assert.equal(model.position.y, groundAt(LIGHTHOUSE_SITE.x, LIGHTHOUSE_SITE.z));
  assert.ok(Math.abs(LIGHTHOUSE_SITE.x - 2734.588038467133) < 1e-9);
  assert.ok(Math.abs(LIGHTHOUSE_SITE.z + 3380.667361200293) < 1e-9);
});

test('tower uses the actual projected octagonal footprint and 74-foot total height', () => {
  const model = buildLighthouse(() => 0);
  const plinth = model.getObjectByName('mapped-octagonal-tower-plinth')!;
  const footprintBounds = bounds(plinth);
  const expectedX = LIGHTHOUSE_TOWER_FOOTPRINT.map(([x]) => x);
  const expectedZ = LIGHTHOUSE_TOWER_FOOTPRINT.map(([, z]) => z);
  assert.ok(Math.abs(footprintBounds.min.x - Math.min(...expectedX)) < .001);
  assert.ok(Math.abs(footprintBounds.max.x - Math.max(...expectedX)) < .001);
  assert.ok(Math.abs(footprintBounds.min.z - Math.min(...expectedZ)) < .001);
  assert.ok(Math.abs(footprintBounds.max.z - Math.max(...expectedZ)) < .001);
  const all = bounds(model);
  assert.ok(Math.abs(all.min.y) < 1e-6);
  assert.ok(Math.abs(all.max.y - LIGHTHOUSE_TOWER_HEIGHT_M) < .001);
  assert.ok(Math.abs(LIGHTHOUSE_TOWER_HEIGHT_M - 22.5552) < 1e-9);
  const lower = bounds(model.getObjectByName('1912-steel-lower-octagonal-tower')!);
  assert.ok(lower.max.x - lower.min.x < (footprintBounds.max.x - footprintBounds.min.x) * .86,
    'HABS shaft must step inward from its mapped plinth');
});

test('keeper house preserves its mapped footprint north of the connected tower', () => {
  const model = buildLighthouse(() => 0);
  const foundation = bounds(model.getObjectByName('mapped-keeper-house-footprint')!);
  const expectedX = LIGHTHOUSE_HOUSE_FOOTPRINT.map(([x]) => x);
  const expectedZ = LIGHTHOUSE_HOUSE_FOOTPRINT.map(([, z]) => z);
  assert.ok(Math.abs(foundation.min.x - Math.min(...expectedX)) < .001);
  assert.ok(Math.abs(foundation.max.x - Math.max(...expectedX)) < .001);
  assert.ok(Math.abs(foundation.min.z - Math.min(...expectedZ)) < .001);
  assert.ok(Math.abs(foundation.max.z - Math.max(...expectedZ)) < .001);
  assert.ok(foundation.max.z <= Math.max(...LIGHTHOUSE_TOWER_FOOTPRINT.map(([, z]) => z)));
  assert.ok(model.getObjectByName('white-clapboard-keeper-house-and-tower-corridor'));
  assert.ok(model.getObjectByName('red-intersecting-gable-and-porch-roofs'));
  assert.ok(model.getObjectByName('white-porch-columns-rails-window-trim-and-steps'));
  assert.ok(bounds(model.getObjectByName('red-intersecting-gable-and-porch-roofs')!).max.y > 9.7);
  assert.ok(bounds(model.getObjectByName('red-intersecting-gable-and-porch-roofs')!).max.y < 10.0);
});

test('tower separates historic stages and uses a black flat lantern assembly', () => {
  const model = buildLighthouse(() => 0);
  assert.ok(model.getObjectByName('1912-steel-lower-octagonal-tower'));
  assert.ok(model.getObjectByName('1888-cast-iron-upper-octagonal-tower'));
  assert.ok(model.getObjectByName('1912-steel-riveted-panel-seams'));
  assert.ok(model.getObjectByName('white-flared-gallery-cornice'));
  assert.ok(model.getObjectByName('tower-porthole-dark-glazing'));
  assert.ok(model.getObjectByName('tower-narrow-square-window-glazing'));
  assert.ok(model.getObjectByName('black-octagonal-gallery-deck'));
  assert.ok(model.getObjectByName('black-gallery-railings'));
  assert.ok(model.getObjectByName('black-lantern-frames-shallow-cap-and-finial'));
  assert.equal(model.getObjectByName('rotating-beacon'), undefined);
  const cap = model.getObjectByName('black-lantern-frames-shallow-cap-and-finial') as THREE.Mesh;
  assert.equal((cap.material as THREE.MeshLambertMaterial).color.getHex(), 0x171b1c);
  const gallery = bounds(model.getObjectByName('black-octagonal-gallery-deck')!);
  assert.ok(gallery.max.x - gallery.min.x > 5.4 && gallery.max.x - gallery.min.x < 5.7);
});

test('lighting modes illuminate glazing reversibly without creating a beacon', () => {
  const model = buildLighthouse(() => 0);
  const glass = model.getObjectByName('lantern-room-glazing') as THREE.Mesh;
  const material = glass.material as THREE.MeshPhongMaterial;
  model.userData.setLightingMode('night');
  assert.ok(material.emissive.getHex() > 0 && material.emissiveIntensity > 1);
  model.userData.setLightingMode('sunset');
  assert.ok(material.emissive.getHex() > 0 && material.emissiveIntensity < 1);
  model.userData.setLightingMode('day');
  assert.equal(material.emissive.getHex(), 0);
  assert.equal(material.emissiveIntensity, 0);
});

test('all geometry is finite and the detailed landmark stays economical', () => {
  const model = buildLighthouse(() => 0);
  let drawables = 0, triangles = 0;
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    drawables++;
    const positions = object.geometry.getAttribute('position');
    assert.ok(positions && Array.from(positions.array).every(Number.isFinite), `${object.name} is not finite`);
    triangles += object.geometry.index ? object.geometry.index.count / 3 : positions.count / 3;
  });
  assert.ok(drawables <= 22, `drawables ${drawables}`);
  assert.ok(triangles < 12_000, `triangles ${triangles}`);
});

test('tower wall normals face outward so the shaft is opaque and lights correctly', () => {
  const model = buildLighthouse(() => 0);
  for (const name of ['1912-steel-lower-octagonal-tower', '1888-cast-iron-upper-octagonal-tower']) {
    const geometry = (model.getObjectByName(name) as THREE.Mesh).geometry;
    const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
    for (let i = 0; i < p.count; i++) if (Math.abs(n.getY(i)) < .8)
      assert.ok(p.getX(i) * n.getX(i) + p.getZ(i) * n.getZ(i) > 0, name);
  }
});
