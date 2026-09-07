import test from 'node:test';
import assert from 'node:assert/strict';
import { HopSimulation } from '../src/hopMotion.ts';
import type { HopData } from '../src/hopTypes.ts';

const fixture = (): HopData => ({
  version: 1,
  defaultDate: '20260908',
  defaultTime: 0,
  paths: [{ id: 'p', routeId: 'M', name: 'straight', color: '#abc', points: [[0, 0, 0], [0, 0, 500]], distances: [0, 500], length: 500 }],
  stops: [{ id: 'a', name: 'a', position: [0, 0, 0] }, { id: 'b', name: 'b', position: [0, 0, 500] }],
  trips: [{ id: 't', blockId: 'one', routeId: 'M', serviceId: 'weekday', pathId: 'p', stops: [{ stopId: 'a', arrival: 0, departure: 0, distance: 0 }, { stopId: 'b', arrival: 120, departure: 120, distance: 500 }] }],
  calendars: [{ id: 'weekday', start: '20260101', end: '20261231', weekdays: [true, true, true, true, true, false, false] }],
  exceptions: [],
  provenance: {},
});

function tick(sim: HopSimulation, realSeconds: number, fps: number): void {
  for (let frame = 0; frame < realSeconds * fps; frame++) sim.update(1 / fps);
}

function close(actual: number, expected: number, epsilon = 1e-8): void {
  assert.ok(Math.abs(actual - expected) < epsilon, `${actual} != ${expected}`);
}

test('playback rates advance proportional simulated time and motion at 30 and 60 FPS', () => {
  for (const fps of [30, 60]) for (const rate of [0.5, 1, 2, 4]) {
    const rated = new HopSimulation(fixture());
    const reference = new HopSimulation(fixture());
    rated.setPlaybackRate(rate);
    tick(rated, 6, fps);
    tick(reference, 6 * rate, 60);
    assert.equal(rated.playbackRate, rate);
    close(rated.time, reference.time);
    close(rated.vehicles[0].distance, reference.vehicles[0].distance);
    close(rated.vehicles[0].speed, reference.vehicles[0].speed);
  }
});

test('unsupported playback rates fall back to 1x', () => {
  const sim = new HopSimulation(fixture());
  assert.equal(sim.playbackRate, 1);
  for (const invalid of [0, -1, 0.75, 3, Infinity, NaN]) {
    sim.setPlaybackRate(2);
    sim.setPlaybackRate(invalid);
    assert.equal(sim.playbackRate, 1);
  }
});

test('changing playback rate does not jump the clock, reset a vehicle, or discard partial time', () => {
  const sim = new HopSimulation(fixture());
  sim.update(1 / 120);
  const car = sim.vehicles[0];
  const before = { time: sim.time, distance: car.distance, speed: car.speed };
  sim.setPlaybackRate(4);
  assert.equal(sim.time, before.time);
  assert.equal(sim.vehicles[0], car);
  assert.deepEqual({ time: sim.time, distance: car.distance, speed: car.speed }, before);
  sim.update(1 / 480);
  close(sim.time, 1 / 60);
});

test('pause and reduced motion remain static at every playback rate', () => {
  for (const rate of [0.5, 1, 2, 4]) {
    const paused = new HopSimulation(fixture());
    paused.setPlaybackRate(rate);
    paused.setPlaying(false);
    paused.update(10);
    assert.equal(paused.time, 0);
    assert.equal(paused.vehicles[0].distance, 0);

    const reduced = new HopSimulation(fixture(), { reducedMotion: true });
    reduced.setPlaybackRate(rate);
    reduced.update(10);
    assert.equal(reduced.time, 0);
    assert.equal(reduced.vehicles[0].distance, 0);
  }
});

test('stalled real frame is capped before playback rate is applied', () => {
  for (const rate of [0.5, 1, 2, 4]) {
    const sim = new HopSimulation(fixture());
    sim.setPlaybackRate(rate);
    sim.update(30);
    close(sim.time, 0.5 * rate);
  }
});
