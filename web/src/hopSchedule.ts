import type { HopData, HopTrip } from './hopTypes.ts';

/** GTFS service seconds deliberately preserve 24:xx / 25:xx. */
export function parseHopTime(value: string): number | null {
  if (!/^\d{1,3}:\d{2}:\d{2}$/.test(value)) return null;
  const [h, m, s] = value.split(':').map(Number);
  return m < 60 && s < 60 ? h * 3600 + m * 60 + s : null;
}
export function chicagoServiceClock(date: Date): { date: string; time: number } {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(date);
  const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return { date: `${p.year}${p.month}${p.day}`, time: +p.hour * 3600 + +p.minute * 60 + +p.second };
}
export function activeHopServices(data: HopData, date: string): Set<string> {
  const normalized = date.replaceAll('-', '');
  const utc = new Date(`${normalized.slice(0, 4)}-${normalized.slice(4, 6)}-${normalized.slice(6, 8)}T12:00:00Z`);
  if (!Number.isFinite(utc.getTime())) return new Set();
  const weekday = (utc.getUTCDay() + 6) % 7;
  const active = new Set(data.calendars.filter(c => normalized >= c.start.replaceAll('-', '') && normalized <= c.end.replaceAll('-', '') && c.weekdays[weekday]).map(c => c.id));
  for (const e of data.exceptions) if (e.date.replaceAll('-', '') === normalized) {
    if (e.type === 1) active.add(e.serviceId); else active.delete(e.serviceId);
  }
  return active;
}
export function hopBlocksForDate(data: HopData, date: string): Map<string, HopTrip[]> {
  const services = activeHopServices(data, date);
  const blocks = new Map<string, HopTrip[]>();
  for (const trip of data.trips) {
    if (!services.has(trip.serviceId) || trip.stops.length < 2) continue;
    // Unusable source rows must never become NaN motion.
    if (trip.stops.some(s => ![s.arrival, s.departure, s.distance].every(Number.isFinite))) continue;
    if (trip.stops.some((s, i) => i > 0 && (s.distance < trip.stops[i - 1].distance || s.arrival < trip.stops[i - 1].departure))) continue;
    const blockId = trip.blockId || trip.id;
    const list = blocks.get(blockId) ?? [];
    list.push(trip); blocks.set(blockId, list);
  }
  for (const list of blocks.values()) list.sort((a, b) => a.stops[0].departure - b.stops[0].departure || a.id.localeCompare(b.id));
  return blocks;
}
export interface HopScheduleIssue { blockId: string; tripId: string; reason: string }
export function validateHopSchedule(data: HopData, date: string): HopScheduleIssue[] {
  const issues: HopScheduleIssue[] = [];
  for (const [blockId, trips] of hopBlocksForDate(data, date)) for (let i = 1; i < trips.length; i++) {
    const prior = trips[i - 1];
    if (trips[i].stops[0].departure < prior.stops.at(-1)!.arrival) issues.push({ blockId, tripId: trips[i].id, reason: 'Overlapping trips in one vehicle block' });
  }
  return issues;
}
