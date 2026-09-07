import test from 'node:test';
import assert from 'node:assert/strict';
import { activeHopServices, chicagoServiceClock, hopBlocksForDate, parseHopTime, validateHopSchedule } from '../src/hopSchedule.ts';
import type { HopData } from '../src/hopTypes.ts';
const fixture = (): HopData => ({ version: 1, defaultDate: '20260908', defaultTime: 43200, paths: [], stops: [], trips: [], calendars: [{ id: 'weekday', start: '20260101', end: '20261231', weekdays: [true,true,true,true,true,false,false] }], exceptions: [], provenance: {} });
test('Monday-first calendars, inclusive ranges and overrides apply to service date', () => {
  const data = fixture();
  assert.deepEqual([...activeHopServices(data, '20260908')], ['weekday']);
  assert.equal(activeHopServices(data, '20260906').size, 0);
  data.exceptions = [{ serviceId: 'weekday', date: '20260908', type: 2 }, { serviceId: 'special', date: '20260908', type: 1 }];
  assert.deepEqual([...activeHopServices(data, '2026-09-08')], ['special']);
});
test('extended GTFS hours survive parsing, missing/invalid times do not become midnight', () => {
  assert.equal(parseHopTime('25:12:30'), 90750); assert.equal(parseHopTime(''), null); assert.equal(parseHopTime('03:72:00'), null);
  assert.deepEqual(chicagoServiceClock(new Date('2026-09-08T17:00:00Z')), { date: '20260908', time: 43200 });
  assert.deepEqual(chicagoServiceClock(new Date('2026-01-08T18:00:00Z')), { date: '20260108', time: 43200 });
});
test('block identity groups trips, rejects unresolved times, and diagnoses conflicting departures', () => {
  const data = fixture();
  const base = { routeId:'M', serviceId:'weekday', blockId:'one', pathId:'p' };
  data.trips = [{ ...base, id:'a', stops:[{stopId:'x',arrival:0,departure:0,distance:0},{stopId:'y',arrival:100,departure:100,distance:100}] }, { ...base,id:'b',stops:[{stopId:'y',arrival:90,departure:90,distance:100},{stopId:'z',arrival:200,departure:200,distance:200}] }, { ...base,id:'bad',stops:[{stopId:'a',arrival:NaN,departure:NaN,distance:0},{stopId:'b',arrival:300,departure:300,distance:100}] }];
  assert.equal(hopBlocksForDate(data,'20260908').get('one')!.length,2);
  assert.equal(validateHopSchedule(data,'20260908').length,1);
});
