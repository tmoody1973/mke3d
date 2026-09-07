import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildPublicMarket, PUBLIC_MARKET_FOOTPRINT, publicMarketRoofHeight } from '../src/publicMarket.ts';
import { PUBLIC_MARKET_SITE, PUBLIC_MARKET_SOURCE } from '../src/publicMarketSite.ts';

const terrain = (x: number, z: number) => 3.4 + .009 * (x + 250) + .018 * (z + 25);
const objectMesh = (model: THREE.Group, name: string) => model.getObjectByName(name) as THREE.Mesh;

test('market preserves the exact OSM footprint in world metres with no building enlargement', () => {
  const model = buildPublicMarket(terrain);
  assert.equal(model.name, 'milwaukee-public-market');
  assert.equal(model.position.x, PUBLIC_MARKET_SITE.x);
  assert.equal(model.position.z, PUBLIC_MARKET_SITE.z);
  assert.equal(model.position.y, PUBLIC_MARKET_SITE.floor);
  assert.equal(model.rotation.y, PUBLIC_MARKET_SITE.bearing);
  assert.deepEqual(model.scale.toArray(), [1, 1, 1]);
  model.updateMatrixWorld(true);
  const foundation = objectMesh(model, 'mapped-footprint-terrain-foundation');
  const positions = foundation.geometry.getAttribute('position');
  const points = Array.from({ length: positions.count }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(foundation.matrixWorld));
  for (const [x, z] of PUBLIC_MARKET_SOURCE.footprint)
    assert.ok(points.some(p => Math.hypot(p.x - x, p.z - z) < .00001), `Missing mapped corner ${x}, ${z}`);
  for (const point of points) assert.ok(PUBLIC_MARKET_SOURCE.footprint.some(([x, z]) =>
    Math.hypot(point.x - x, point.z - z) < .00001), 'Foundation invented an expanded footprint');
});

test('foundation reaches the terrain at every mapped corner under a level market floor', () => {
  const model = buildPublicMarket(terrain); model.updateMatrixWorld(true);
  const foundation = objectMesh(model, 'mapped-footprint-terrain-foundation');
  const positions = foundation.geometry.getAttribute('position');
  const points = Array.from({ length: positions.count }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(foundation.matrixWorld));
  for (const [x, z] of PUBLIC_MARKET_SOURCE.footprint) {
    const atCorner = points.filter(p => Math.hypot(p.x - x, p.z - z) < .00001);
    assert.ok(Math.abs(Math.min(...atCorner.map(p => p.y)) - (terrain(x, z) - .08)) < .00001);
    assert.ok(Math.abs(Math.max(...atCorner.map(p => p.y)) - (PUBLIC_MARKET_SITE.floor + .22)) < .00001);
  }
});

test('shallow roof remains inside the mapped footprint with upward top normals', () => {
  const model = buildPublicMarket(terrain);
  const geometry = objectMesh(model, 'shallow-sloping-mapped-roof').geometry;
  const p = geometry.getAttribute('position'), n = geometry.getAttribute('normal');
  let topTriangles = 0;
  for (let i = 0; i < p.count; i += 3) {
    for (let j = i; j < i + 3; j++) assert.ok(PUBLIC_MARKET_FOOTPRINT.some(([x, z]) =>
      Math.hypot(x - p.getX(j), z - p.getZ(j)) < .00001));
    if ([i, i + 1, i + 2].every(j => Math.abs(p.getY(j) - publicMarketRoofHeight(p.getZ(j)) - .19) < .00001)) {
      topTriangles++;
      assert.ok(n.getY(i) > .99, 'Roof top must face sky');
    }
  }
  assert.ok(topTriangles > 15);
  geometry.computeBoundingBox();
  assert.ok(geometry.boundingBox!.max.y - geometry.boundingBox!.min.y < 1.5, 'No invented steep roof');
});

test('market includes clear glazing, facade structure, thin canopies and an open rooftop louver array', () => {
  const model = buildPublicMarket(terrain);
  for (const name of ['two-level-curtain-wall-glazing', 'cream-brick-facade-piers',
    'gray-metal-service-and-east-end-panels', 'exposed-steel-frame-mullions-and-sign-supports',
    'open-white-rooftop-louver-blades', 'cantilevered-canopy-triangular-steel-brackets',
    'west-upper-facade-horizontal-sunshades',
    'street-level-glazed-double-doors', 'mapped-thin-entrance-canopies']) assert.ok(objectMesh(model, name), name);
  const canopies = objectMesh(model, 'mapped-thin-entrance-canopies').geometry;
  canopies.computeBoundingBox();
  assert.ok(Math.abs(canopies.boundingBox!.max.y - canopies.boundingBox!.min.y - .19) < .000001);
  const blades = objectMesh(model, 'open-white-rooftop-louver-blades').geometry.getAttribute('position');
  assert.ok(blades.count >= 90 * 36, 'Louver strip retains repeated individual blades');
});

test('rooftop sign rack spans the west facade and supports lettering above the roof', () => {
  const model = buildPublicMarket(terrain);
  const rack = objectMesh(model, 'full-width-west-neon-sign-support-rack');
  assert.ok(rack, 'West neon sign needs its own support rack');
  rack.geometry.computeBoundingBox();
  const bounds = rack.geometry.boundingBox!;
  assert.ok(bounds.max.z - bounds.min.z >= 28, 'Rack should span almost the entire west facade');
  assert.ok(bounds.min.z < -13 && bounds.max.z > 12, 'Rack should reach both ends of the facade');
  assert.ok(bounds.max.x < -35, 'Sign supports must stay at the west elevation');
  assert.ok(bounds.max.y > 11.8, 'Rack must support the rooftop lettering at its full height');
});

test('north end of the west facade has a substantial opaque masonry bay', () => {
  const model = buildPublicMarket(terrain);
  const bay = objectMesh(model, 'west-north-solid-masonry-bay');
  assert.ok(bay, 'North-west service bay must not appear as uninterrupted glazing');
  bay.geometry.computeBoundingBox();
  const bounds = bay.geometry.boundingBox!;
  assert.ok(bounds.max.z < -10 && bounds.min.z < -17, 'Masonry bay belongs at the north end');
  assert.ok(bounds.max.z - bounds.min.z >= 6 && bounds.max.y - bounds.min.y >= 7,
    'Masonry must cover a full facade bay rather than a narrow pier');
  assert.ok(bounds.max.x < -37.5, 'Bay should cover the west facade');
  assert.equal((bay.material as THREE.MeshStandardMaterial).transparent, false);
});

test('west upper sunshades preserve visible glazing at the south corner', () => {
  const model = buildPublicMarket(terrain);
  const shades = objectMesh(model, 'west-upper-facade-horizontal-sunshades');
  shades.geometry.computeBoundingBox();
  const shadeBounds = shades.geometry.boundingBox!;
  const glass = objectMesh(model, 'two-level-curtain-wall-glazing').geometry.getAttribute('position');
  const westUpperZ: number[] = [];
  for (let i = 0; i < glass.count; i++) {
    if (glass.getX(i) < -37 && glass.getY(i) > 4.2) westUpperZ.push(glass.getZ(i));
  }
  assert.ok(westUpperZ.length > 0, 'Upper west facade must retain glazing');
  const southGlassEdge = Math.max(...westUpperZ);
  assert.ok(southGlassEdge > 14, 'Glazing must reach the south-west corner');
  assert.ok(southGlassEdge - shadeBounds.max.z >= 1,
    'Sunshades must leave a visible strip of corner glazing');
  assert.ok(shadeBounds.max.z - shadeBounds.min.z >= 20,
    'Sunshades should still cover most of the upper glazed elevation');
});

test('night mode softly warms glazing only and day mode fully resets it', () => {
  const model = buildPublicMarket(terrain);
  for (const mode of ['night', 'sunset', 'day']) {
    model.userData.setLightingMode(mode);
    model.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const material = object.material as THREE.MeshStandardMaterial;
      const isGlass = ['two-level-curtain-wall-glazing', 'street-level-glazed-double-doors'].includes(object.name);
      if (mode !== 'day' && isGlass) {
        assert.ok(material.emissiveIntensity > 0 && material.emissiveIntensity <= .4);
        assert.equal(material.emissive.getHex(), 0xffc17b);
      } else assert.equal(material.emissive.getHex(), 0, `${object.name} should not glow`);
    });
  }
});

test('all triangles are finite and non-degenerate within the mobile-friendly geometry budget', () => {
  const model = buildPublicMarket(terrain);
  let meshes = 0, triangles = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    meshes++;
    const p = object.geometry.getAttribute('position');
    assert.ok(Array.from(p.array).every(Number.isFinite), object.name);
    assert.equal(object.geometry.index, null);
    triangles += p.count / 3;
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
      assert.ok(b.sub(a).cross(c.sub(a)).lengthSq() > 1e-12, `${object.name} triangle ${i / 3}`);
    }
  });
  assert.ok(meshes < 80, `Meshes: ${meshes}`);
  assert.ok(triangles < 18_000, `Triangles: ${triangles}`);
});
