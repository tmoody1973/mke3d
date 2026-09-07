import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildHopRoute, locateHopPlatform, scheduledHopPlatforms } from '../src/hopRoute.ts';
import type { HopData } from '../src/hopTypes.ts';
const path = { id: 'p', routeId: 'TL-7', name: 'M-Line', color: '3A81DE', points: [[0, 5, 0], [0, 5, 100]] as [number, number, number][], distances: [0, 100], length: 100 };
const data: HopData = { version: 1, defaultDate: '20260908', defaultTime: 43200, paths: [path],
  stops: [{ id: 's', name: 'Test platform', position: [2, 5, 50] }],
  physicalTracks: [{ id: 'a', routeIds: ['TL-7'], points: path.points }, { id: 'shared', routeIds: ['TL-4'], points: path.points }],
  trips: [{ id: 't', pathId: 'p', routeId: 'TL-7', blockId: 'b', serviceId: 'c', stops: [{ stopId: 's', distance: 50, arrival: 43200, departure: 43200 }] }], calendars: [], exceptions: [], provenance: {} };

test('physical rails use the mapped gauge and shared track is emitted only once', () => {
  const route = buildHopRoute(data);
  const rails = route.group.getObjectByName('embedded-tram-rails')!.children[0] as THREE.Mesh;
  const p = rails.geometry.getAttribute('position'); assert.equal(p.count, 12);
  const positive = Array.from({ length: p.count }, (_, i) => p.getX(i)).filter(x => x > 0);
  assert.ok(Math.abs((Math.max(...positive) + Math.min(...positive)) / 2 - .7175) < 1e-6);
  route.dispose();
});

test('directed stop attachment wins over a closer opposite-direction track', () => {
  const loop = { ...path, points: [[0, 5, 0], [0, 5, 100], [4, 5, 100], [4, 5, 0], [0, 5, 0]] as [number, number, number][], distances: [0, 100, 104, 204, 208], length: 208 };
  const fixture = { ...data, paths: [loop], stops: [{ ...data.stops[0], position: [1, 5, 50] as [number, number, number] }],
    trips: [{ ...data.trips[0], stops: [{ ...data.trips[0].stops[0], distance: 154 }] }] };
  const pose = scheduledHopPlatforms(fixture).get('p:s')!;
  assert.deepEqual(pose.point, [4, 5, 50]);
  assert.equal(Math.abs(pose.yaw), Math.PI);
  assert.equal(pose.side, 'right');
});

test('platform side follows the stop offset and height exaggeration preserves platform size', () => {
  assert.equal(locateHopPlatform(data.stops[0], [path]).side, 'right');
  const route = buildHopRoute(data), deck = route.platforms.getObjectByName('hop-platform-decks') as THREE.InstancedMesh;
  const a = new THREE.Matrix4(), b = new THREE.Matrix4(); deck.getMatrixAt(0, a); route.setHeightScale(4); deck.getMatrixAt(0, b);
  assert.ok(Math.abs(b.elements[13] - a.elements[13] - 15) < 1e-5);
  assert.deepEqual(a.elements.slice(0, 12), b.elements.slice(0, 12));
  route.setOverlay(true, new Set(['TL-7'])); assert.equal(route.overlays.get('TL-7')!.visible, true);
  route.setOverlay(true, new Set()); assert.equal(route.overlays.get('TL-7')!.visible, false);
  route.dispose();
});
