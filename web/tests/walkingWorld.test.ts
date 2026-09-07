import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createWalkingWorld } from '../src/walkingWorld.ts';

function quad(name: string, x0: number, x1: number, z0: number, z1: number, y: number) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([x0,y,z0,x1,y,z0,x1,y,z1,x0,y,z0,x1,y,z1,x0,y,z1], 3));
  const mesh = new THREE.Mesh(geometry); mesh.name = name; return mesh;
}
function wall(x: number, z0 = -10, z1 = 10) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([x,0,z0,x,5,z0,x,5,z1,x,0,z0,x,5,z1,x,0,z1], 3));
  const mesh = new THREE.Mesh(geometry); mesh.name = 'BLDG'; return mesh;
}
function scene() {
  const tiles = new THREE.Group(), environment = new THREE.Group(), tile = new THREE.Group();
  tile.add(quad('ROAD', -20, -10, -20, 20, 0), quad('ROAD', 10, 20, -20, 20, 0));
  tiles.add(tile); environment.add(tiles, quad('TERRAIN', -500, 500, -500, 500, -.6));
  return { tiles, tile, environment, world: createWalkingWorld(tiles, environment) };
}

test('pedestrian footprint walks a narrow .8m passage and crosses terrain/road offset', () => {
  const { tile, world } = scene(); tile.add(wall(-.4), wall(.4));
  const start = { x: 0, y: -.6, z: -4 };
  const result = world.resolve(start, { ...start, z: 4 });
  assert.equal(result.blocked, false); assert.ok(Math.abs(result.z - 4) < 1e-6);
  const crossing = world.resolve({ x: -10.2, y: 0, z: 15 }, { x: -9.8, y: 0, z: 15 });
  assert.equal(crossing.blocked, false); assert.ok(Math.abs(crossing.y + .6) < 1e-6);
  const uphill = world.resolve(crossing, { x: -10.2, y: -.6, z: 15 });
  assert.equal(uphill.blocked, false); assert.equal(uphill.y, 0);
});

test('thin walls prevent tunneling, allow sliding and immediately allow retreat', () => {
  const { tile, world } = scene(); tile.add(wall(1));
  const start = { x: 0, y: -.6, z: 0 }, collision = world.resolve(start, { x: 3, y: -.6, z: 2 });
  assert.equal(collision.blocked, true); assert.ok(collision.x <= .7); assert.ok(collision.z > 1.8);
  const retreat = world.resolve(collision, { ...collision, x: collision.x - .15 });
  assert.equal(retreat.blocked, false); assert.ok(retreat.x < collision.x);
});

test('water at the edge of the body blocks terrain; an elevated dry road remains supported', () => {
  const { tile, environment, world } = scene(); environment.add(quad('WATER', .2, 5, -10, 10, -.1));
  const start = { x: 0, y: -.6, z: 0 };
  assert.equal(world.resolve(start, start).blocked, true);
  tile.add(quad('ROAD', -2, 5, -10, 10, 0));
  assert.equal(world.resolve({ ...start, y: 0 }, { ...start, y: 0 }).blocked, false);
});

test('ground walkers stay beneath overhead highways and bridge walkers cannot step off', () => {
  const { tile, world } = scene(); tile.add(quad('HWAY', -2, 2, -15, 15, 12));
  const start = { x: 0, y: -.6, z: 0 };
  assert.ok(Math.abs(world.resolve(start, { ...start, z: 1 }).y + .6) < 1e-6);
  const bridge = world.resolve({ x: 0, y: 12, z: 0 }, { x: 4, y: 12, z: 0 });
  assert.equal(bridge.blocked, true); assert.equal(bridge.y, 12); assert.ok(bridge.x <= 1.7);
});

test('large steps and steep ramps cannot be climbed', () => {
  const { tile, environment, world } = scene();
  environment.remove(environment.children.find(child => child.name === 'TERRAIN')!);
  tile.add(quad('ROAD', -5, 0, -5, 5, 0), quad('ROAD', 0, 5, -5, 5, 1.2));
  assert.equal(world.resolve({ x: -1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }).blocked, true);
  const ramp = quad('ROAD', -5, 5, 8, 12, 0), positions = ramp.geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) positions.setY(i, positions.getX(i) * 2);
  tile.add(ramp);
  assert.equal(world.resolve({ x: 0, y: 0, z: 10 }, { x: .1, y: 0, z: 10 }).blocked, true);
});

test('landmark collision follows its triangles, preserving open passages and rejecting solid interiors', () => {
  const { environment, world } = scene();
  const landmark = new THREE.Group();
  const roof = quad('canopy', -5, 5, -5, 5, 4); roof.userData.drivingSurface = 'building';
  const column = new THREE.Mesh(new THREE.BoxGeometry(.4, 4, .4)); column.position.set(3, 2, 0); column.name = 'BLDG';
  const solid = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 2)); solid.position.set(-3, 3, 0); solid.userData.drivingSurface = 'building';
  landmark.add(roof, column, solid); environment.add(landmark);
  const start = { x: 0, y: -.6, z: 0 };
  assert.equal(world.resolve(start, { ...start, z: 2 }).blocked, false, 'canopy must not create a bounding-box wall');
  assert.equal(world.resolve(start, { ...start, x: 3 }).blocked, true);
  const interior = { x: -3, y: -.6, z: 0 };
  assert.equal(world.resolve(interior, interior).blocked, true);
});

function openBottomBox(x: number, width = 4) {
  const source = new THREE.BoxGeometry(width, 6, 4).toNonIndexed().getAttribute('position'), values: number[] = [];
  for (let i = 0; i < source.count; i += 3) {
    if ([0, 1, 2].every(offset => source.getY(i + offset) === -3)) continue;
    for (let offset = 0; offset < 3; offset++) values.push(source.getX(i + offset) + x, source.getY(i + offset) + 3, source.getZ(i + offset));
  }
  return values;
}

test('packed roof-and-wall buildings reject interior spawn without requiring a bottom cap', () => {
  const { tile, world } = scene(), geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(openBottomBox(0), 3));
  const mesh = new THREE.Mesh(geometry); mesh.name = 'BLDG'; tile.add(mesh);
  const interior = { x: 0, y: -.6, z: 0 };
  assert.equal(world.resolve(interior, interior).blocked, true);
  const spawn = world.findSpawn(0, 0); assert.ok(spawn);
  assert.ok(Math.abs(spawn.x) >= 2.3 || Math.abs(spawn.z) >= 2.3, 'spawn must leave the open-bottom shell');
});

test('merged adjacent building shells preserve the covered passage between them', () => {
  const { tile, world } = scene(), geometry = new THREE.BufferGeometry();
  const canopy = quad('roof', -5, 5, -2, 2, 4).geometry.getAttribute('position');
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([...openBottomBox(-3), ...openBottomBox(3), ...Array.from(canopy.array)], 3));
  const mesh = new THREE.Mesh(geometry); mesh.name = 'BLDG'; tile.add(mesh);
  const passage = { x: 0, y: -.6, z: 0 };
  assert.equal(world.resolve(passage, passage).blocked, false, 'two wall crossings through a neighboring building do not enclose the passage');
  assert.equal(world.resolve(passage, { ...passage, z: 4 }).blocked, false);
  const interior = { ...passage, x: -3 };
  assert.equal(world.resolve(interior, interior).blocked, true, 'an extra overlapping canopy does not cancel a building interior');
});

test('spawns stay near focus, dry and outside solids; missing coverage never invents land', () => {
  const { tile, tiles, environment, world } = scene();
  environment.add(quad('WATER', -1, 1, -1, 1, 0));
  const spawn = world.findSpawn(0, 0); assert.ok(spawn); assert.ok(Math.hypot(spawn.x, spawn.z) <= 6);
  assert.equal(world.resolve(spawn, spawn).blocked, false);
  assert.equal(world.findSpawn(300, 0), undefined);
  tiles.remove(tile); assert.equal(world.findSpawn(0, 0), undefined);
});

test('loaded tile gaps block movement and transform changes invalidate cached geometry', () => {
  const { world, tiles, tile, environment } = scene();
  const start = { x: 0, y: -.6, z: 0 };
  const other = new THREE.Group(); other.add(quad('ROAD', 40, 60, -20, 20, 0)); tiles.add(other);
  assert.equal(world.resolve(start, { ...start, x: 30 }).blocked, true);
  const ground = environment.children.find(child => child.name === 'TERRAIN')!; ground.position.y = .2;
  assert.ok(Math.abs(world.resolve(start, start).y - -.4) < 1e-6);
  tile.position.x = 100;
  assert.equal(world.resolve(start, start).blocked, true);
});
