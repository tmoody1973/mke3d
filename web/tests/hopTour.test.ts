import test from 'node:test';
import assert from 'node:assert/strict';
import { StreetcarTour } from '../src/hopTour.ts';

function fixture(playing = true) {
  const playback = { playing, setPlaying(value: boolean) { this.playing = value; } };
  const camera = { following: false, start() { this.following = true; }, stop() { this.following = false; }, isFollowing() { return this.following; } };
  return { playback, camera, tour: new StreetcarTour(playback, camera) };
}

test('a ride explicitly starts a paused preview, pauses and resumes, then restores its prior state', () => {
  const { tour, playback, camera } = fixture(false);
  tour.start('M-Line'); assert.equal(playback.playing, true); assert.equal(camera.following, true);
  tour.togglePause(); assert.equal(tour.paused, true); assert.equal(playback.playing, false);
  tour.togglePause(); assert.equal(tour.paused, false);
  tour.stop(); assert.equal(tour.active, false); assert.equal(camera.following, false); assert.equal(playback.playing, false);
});

test('manual orbit or a different camera flight ends the ride and restores running preview', () => {
  const { tour, playback, camera } = fixture();
  tour.start('L-Line'); tour.togglePause();
  camera.following = false; tour.update();
  assert.equal(tour.active, false); assert.equal(playback.playing, true);
  tour.stop(); assert.equal(playback.playing, true);
});

test('changing a running ride does not overwrite the original playback preference', () => {
  const { tour, playback } = fixture(false);
  tour.start('M-Line'); tour.start('L-Line'); tour.stop();
  assert.equal(playback.playing, false); assert.equal(tour.label, 'L-Line');
});
