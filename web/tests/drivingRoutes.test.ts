import test from 'node:test';
import assert from 'node:assert/strict';
import { CAR_TOURS } from '../src/drivingRoutes.ts';

const distance = (a: number[], b: number[]) => Math.hypot(b[0] - a[0], b[1] - a[1]);

test('three distinct street tours retain source attribution and useful lengths', () => {
  assert.equal(CAR_TOURS.length, 3);
  assert.equal(new Set(CAR_TOURS.map(tour => tour.id)).size, CAR_TOURS.length);
  for (const tour of CAR_TOURS) {
    assert.ok(tour.name.length > 6 && tour.description.length > 30);
    assert.ok(tour.osmWayIds.length > 5);
    assert.equal(new Set(tour.osmWayIds).size, tour.osmWayIds.length);
    assert.ok(tour.osmWayIds.every(id => Number.isSafeInteger(id) && id > 0));
    const length = tour.points.slice(1).reduce((sum, point, i) => sum + distance(tour.points[i], point), 0);
    assert.ok(length > 1000 && length < 3000, `${tour.id}: ${length} meters`);
  }
});

test('street traces have finite world coordinates without repeated vertices or distant jumps', () => {
  for (const tour of CAR_TOURS) {
    assert.ok(tour.points.length > 60);
    for (const [i, point] of tour.points.entries()) {
      assert.equal(point.length, 2);
      assert.ok(point.every(Number.isFinite));
      assert.ok(point[0] > -1000 && point[0] < 2000 && point[1] > -2500 && point[1] < 1000);
      if (i > 0) {
        const gap = distance(tour.points[i - 1], point);
        assert.ok(gap > .001 && gap <= 18.01, `${tour.id}, vertex ${i}: ${gap} meter gap`);
        if (i + 1 < tour.points.length) {
          const a = tour.points[i - 1], b = tour.points[i + 1];
          const cosine = ((point[0] - a[0]) * (b[0] - point[0]) + (point[1] - a[1]) * (b[1] - point[1])) / (gap * distance(point, b));
          assert.ok(cosine > -.95, `${tour.id}, vertex ${i}: immediate reversal`);
        }
      }
    }
  }
});

test('lakefront heads north while the downtown and Third Ward circuits close on their street starts', () => {
  const lakefront = CAR_TOURS.find(tour => tour.id === 'lakefront')!;
  assert.ok(lakefront.streets.includes('North Lincoln Memorial Drive'));
  assert.ok(lakefront.points.at(-1)![1] < lakefront.points[0][1] - 1500);
  for (const id of ['downtown', 'third-ward']) {
    const tour = CAR_TOURS.find(tour => tour.id === id)!;
    assert.deepEqual(tour.points.at(-1), tour.points[0]);
  }
  assert.ok(CAR_TOURS.find(tour => tour.id === 'downtown')!.streets.includes('East Wisconsin Avenue'));
  assert.ok(CAR_TOURS.find(tour => tour.id === 'third-ward')!.streets.includes('North Broadway'));
});
