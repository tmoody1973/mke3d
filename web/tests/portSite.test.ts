import assert from 'node:assert/strict';
import test from 'node:test';
import {PORT_ANCHORS, PORT_BUILDINGS, PORT_QUAYS, PORT_RAILS, PORT_SITE} from '../src/portSite.ts';

const finitePoint = (point: readonly number[]) => point.length === 2 && point.every(Number.isFinite);

test('port data uses finite projected coordinates inside its declared bounds', () => {
  const {xMin, xMax, zMin, zMax} = PORT_SITE.bounds;
  const inside = ([x, z]: readonly number[]) => x >= xMin - .01 && x <= xMax + .01 && z >= zMin - .01 && z <= zMax + .01;
  for (const rail of PORT_RAILS) for (const point of rail.points) assert.ok(finitePoint(point) && inside(point), `rail ${rail.id}`);
  for (const quay of PORT_QUAYS) for (const point of quay.points) assert.ok(finitePoint(point) && inside(point), `quay ${quay.id}`);
  for (const building of PORT_BUILDINGS) for (const point of building.footprint) assert.ok(finitePoint(point) && inside(point), `building ${building.id}`);
  for (const anchor of PORT_ANCHORS) assert.ok(finitePoint(anchor.position) && inside(anchor.position), `anchor ${anchor.id}`);
});

test('mapped rail paths are usable connected polylines', () => {
  assert.ok(PORT_RAILS.length >= 40, 'expected the Jones Island spur network');
  for (const rail of PORT_RAILS) {
    assert.ok(rail.points.length >= 2, `rail ${rail.id} has too few points`);
    for (let index = 1; index < rail.points.length; index++) {
      assert.ok(Math.hypot(rail.points[index][0] - rail.points[index - 1][0], rail.points[index][1] - rail.points[index - 1][1]) > .01,
        `rail ${rail.id} has a collapsed segment`);
    }
  }
  const terminals = new Map<string, number>();
  for (const rail of PORT_RAILS) for (const point of [rail.points[0], rail.points.at(-1)!]) {
    const key = `${Math.round(point[0] * 10)},${Math.round(point[1] * 10)}`;
    terminals.set(key, (terminals.get(key) ?? 0) + 1);
  }
  assert.ok([...terminals.values()].some(count => count >= 3), 'expected mapped rail junctions');
});

test('significant footprints and oriented bounds remain bounded and finite', () => {
  assert.ok(PORT_BUILDINGS.length >= 100);
  for (const building of PORT_BUILDINGS) {
    assert.ok(building.footprint.length >= 3, `building ${building.id}`);
    assert.ok(Number.isFinite(building.height) && building.height > 0, `building ${building.id} height`);
    assert.ok(Object.values(building.bounds).every(Number.isFinite), `building ${building.id} bounds`);
    assert.ok(building.bounds.width > 0 && building.bounds.depth > 0, `building ${building.id} dimensions`);
  }
});

test('public-facing port anchors are mapped source features', () => {
  const kinds = new Set(PORT_ANCHORS.map(anchor => anchor.kind));
  assert.ok(kinds.has('administration'));
  assert.ok(kinds.has('turbine'));
  assert.ok(kinds.has('ferry_terminal'));
  assert.ok(PORT_ANCHORS.every(anchor => /^(node|way)\/\d+$/.test(anchor.id)));
});
