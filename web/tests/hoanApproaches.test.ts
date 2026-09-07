import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import { buildHoan } from '../src/hoan.ts';
import { hoanNorthboundJunctions, hoanSouthboundSource } from '../src/hoanApproachData.ts';

const input = JSON.parse(readFileSync(new URL('../public/data/landmarks_geo.json', import.meta.url), 'utf8')).hoan;
// Terrain changes under Summerfest must not alter fixed source junction heights.
const bridge = buildHoan(input, () => 0);
bridge.updateMatrixWorld(true);
const approaches = bridge.getObjectByName('hoan-southbound-approaches')!;
const southbound = bridge.getObjectByName('hoan-southbound-roadway')!;
const northbound = bridge.getObjectByName('hoan-roadway')!;
const cast = (object: THREE.Object3D, x: number, z: number) => new THREE.Raycaster(
  new THREE.Vector3(x, 100, z), new THREE.Vector3(0, -1, 0),
).intersectObject(object);
const tileRoads = new Map<string, THREE.Object3D>();
function tileAt(x: number, z: number) {
  const key = `${Math.floor(x / 2000)}_${Math.floor(-z / 2000)}`;
  if (tileRoads.has(key)) return tileRoads.get(key)!;
  const b = readFileSync(new URL(`../public/data/tiles/t_${key}.bin`, import.meta.url));
  const group = new THREE.Group(); let offset = 12;
  for (let i = 0; i < b.readUInt32LE(8); i++) {
    const name = b.toString('ascii', offset, offset + 4), n = b.readUInt32LE(offset + 4);
    const origin = [8, 12, 16].map(k => b.readFloatLE(offset + k)), scale = b.readFloatLE(offset + 20);
    offset += 24;
    if (name === 'ROAD') {
      const p = new Float32Array(n * 3);
      for (let k = 0; k < p.length; k++) p[k] = origin[k % 3] + b.readInt16LE(offset + k * 2) * scale;
      group.add(new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(p, 3)),
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
    }
    offset = Math.ceil((offset + n * 6) / 4) * 4;
    offset = Math.ceil((offset + n * 3) / 4) * 4;
  }
  group.updateMatrixWorld(true); tileRoads.set(key, group); return group;
}

test('restored source junctions meet actual shipped ramp surfaces after terrain correction', () => {
  assert.deepEqual(approaches.userData.sourceWayIds, [123680910, 99456188, 99456186, 123681034]);
  for (const way of hoanSouthboundSource) {
    const [x, expected, z] = way.points[0];
    const next = way.points[1];
    const direction = new THREE.Vector2(next[0] - x, next[2] - z).normalize().multiplyScalar(.05);
    const hit = cast(southbound, x + direction.x, z + direction.y)[0];
    assert.ok(hit, `missing mapped source way ${way.wayId}`);
    assert.ok(Math.abs(hit.point.y - expected) < .015, `source junction ${way.wayId} height changed`);
    const sourceHeights = [0, -.08, .08].flatMap(dx => [0, -.08, .08].flatMap(dz =>
      cast(tileAt(x, z), x + dx, z + dz).map(h => h.point.y)));
    assert.ok(sourceHeights.some(y => Math.abs(y - expected) < .15), `source tile does not meet restored way ${way.wayId}`);
  }
});

test('northbound custom profile passes through each real ramp height', () => {
  for (const [x, z, expected] of hoanNorthboundJunctions) {
    const hit = cast(northbound, x, z)[0];
    assert.ok(hit && Math.abs(hit.point.y - expected) < .015, `northbound ramp at ${x},${z} disconnected`);
    const sourceHeights = [0, -.08, .08].flatMap(dx => [0, -.08, .08].flatMap(dz =>
      cast(tileAt(x, z), x + dx, z + dz).map(h => h.point.y)));
    assert.ok(sourceHeights.some(y => Math.abs(y - expected) < .15), `quantized source tile does not meet northbound ramp ${x},${z}`);
  }
});

test('full southbound tie-in width lands on the custom deck at the same elevation', () => {
  for (const [x, y, z] of [approaches.userData.tieIn, ...approaches.userData.tieInEdges]) {
    const hit = cast(northbound, x, z)[0];
    assert.ok(hit, `tie-in edge misses the custom deck at ${x},${z}`);
    assert.ok(Math.abs(hit.point.y - y) < .04, `tie-in has a ${hit.point.y - y}m vertical gap`);
  }
  const road = southbound as THREE.Mesh;
  road.geometry.computeBoundingBox();
  assert.ok(road.geometry.boundingBox!.max.z < 960, 'restored low road must stop before the harbor span');
});

test('north approaches remain separate and the source curve has no internal gaps', () => {
  const mesh = southbound as THREE.Mesh;
  const normals = mesh.geometry.getAttribute('normal');
  assert.equal((mesh.material as THREE.Material).side, THREE.FrontSide);
  for (let i = 0; i < normals.count; i++) assert.ok(normals.getY(i) > .95, 'asphalt must face upward');
  const bend = hoanSouthboundSource[2].points[0];
  assert.equal(cast(northbound, bend[0], bend[2]).length, 0);
  for (const way of hoanSouthboundSource.slice(0, 3)) for (let i = 1; i < way.points.length; i++) {
    const a = way.points[i - 1], b = way.points[i];
    for (let j = 1; j < 10; j++) {
      const t = j / 10, x = THREE.MathUtils.lerp(a[0], b[0], t), z = THREE.MathUtils.lerp(a[2], b[2], t);
      const hit = cast(southbound, x, z)[0];
      assert.ok(hit, `missing source route at ${x},${z}`);
      assert.ok(Math.abs(hit.point.y - THREE.MathUtils.lerp(a[1], b[1], t)) < .025);
    }
  }
});
