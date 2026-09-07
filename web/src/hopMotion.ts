import type { HopData, HopPath, HopPoint, HopTrip } from './hopTypes.ts';
import { hopBlocksForDate } from './hopSchedule.ts';

const STEP = 1 / 60;
const ACCELERATION = 0.8;
const BRAKING = 1.2;
const MAX_SPEED = 11;
const DWELL = 20; // Illustrative budget: source GTFS has identical arrival/departure.
const norm = (p: HopPoint): HopPoint => { const n = Math.hypot(...p) || 1; return [p[0] / n, p[1] / n, p[2] / n]; };
const gap = (a: HopPoint, b: HopPoint) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const plus = (a: HopPoint, b: HopPoint, scale: number): HopPoint => [a[0] + b[0] * scale, a[1] + b[1] * scale, a[2] + b[2] * scale];
const delta = (a: HopPoint, b: HopPoint): HopPoint => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

export function sampleHopPath(path: HopPath, distance: number): { position: HopPoint; tangent: HopPoint } {
  if (path.points.length < 2 || !(path.length > 0)) return { position: [...(path.points[0] ?? [0, 0, 0])] as HopPoint, tangent: [0, 0, 1] };
  const closed = gap(path.points[0], path.points.at(-1)!) < 0.1;
  const d = closed ? ((distance % path.length) + path.length) % path.length : Math.max(0, Math.min(path.length, distance));
  let lo = 0, hi = path.distances.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (path.distances[m] <= d) lo = m; else hi = m; }
  const a = path.points[lo], b = path.points[hi];
  const fraction = (d - path.distances[lo]) / (path.distances[hi] - path.distances[lo] || 1);
  return { position: plus(a, delta(b, a), fraction), tangent: norm(delta(b, a)) };
}
export interface HopSectionPose { position: HopPoint; yaw: number; pitch: number }
export interface HopPose { sections: [HopSectionPose, HopSectionPose, HopSectionPose]; bogies: [HopPoint, HopPoint]; hinges: [HopPoint, HopPoint] }
/** Three rigid sections; cab centres are rail contacts, joined through 0.6 m bellows. */
export function solveHopPose(path: HopPath, distance: number, heightScale = 1): HopPose {
  const sample = (d: number): HopPoint => { const p = sampleHopPath(path, d).position; return [p[0], p[1] * heightScale, p[2]]; };
  const center = sample(distance);
  const centerAxis = norm(delta(sample(distance + 2.8), sample(distance - 2.8)));
  const frontHinge = plus(center, centerAxis, 3.1), rearHinge = plus(center, centerAxis, -3.1);
  const end = (hinge: HopPoint, sign: number): HopPoint => {
    let lo = 3.1, hi = 16;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (gap(sample(distance + sign * m), hinge) < 3.7) lo = m; else hi = m; }
    return sample(distance + sign * (lo + hi) / 2);
  };
  const front = end(frontHinge, 1), rear = end(rearHinge, -1);
  const pose = (position: HopPoint, axis: HopPoint): HopSectionPose => ({ position, yaw: Math.atan2(axis[0], axis[2]), pitch: Math.atan2(axis[1], Math.hypot(axis[0], axis[2])) });
  return { sections: [pose(front, delta(front, frontHinge)), pose(center, centerAxis), pose(rear, delta(rearHinge, rear))], bogies: [front, rear], hinges: [frontHinge, rearHinge] };
}
/** Horizontal body envelopes also protect merging curves where centre tangents differ. */
function posesOverlap(a: HopPose, b: HopPose): boolean {
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    const sa = a.sections[i], sb = b.sections[j];
    if (Math.abs(sa.position[1] - sb.position[1]) > 3.8) continue;
    const aa = [[Math.sin(sa.yaw), Math.cos(sa.yaw)], [Math.cos(sa.yaw), -Math.sin(sa.yaw)]];
    const bb = [[Math.sin(sb.yaw), Math.cos(sb.yaw)], [Math.cos(sb.yaw), -Math.sin(sb.yaw)]];
    const dx = sb.position[0] - sa.position[0], dz = sb.position[2] - sa.position[2];
    let separated = false;
    for (const axis of [...aa, ...bb]) {
      const dot = (u: number[]) => Math.abs(u[0] * axis[0] + u[1] * axis[1]);
      const extent = (i === 1 ? 2.8 : 3.4) * dot(aa[0]) + 1.42 * dot(aa[1]) + (j === 1 ? 2.8 : 3.4) * dot(bb[0]) + 1.42 * dot(bb[1]);
      if (Math.abs(dx * axis[0] + dz * axis[1]) >= extent) { separated = true; break; }
    }
    if (!separated) return true;
  }
  return false;
}
export interface HopVehicleState {
  id: string; blockId: string; tripId: string; pathId: string; routeId: string;
  distance: number; speed: number; phase: 'travel' | 'dwell' | 'layover'; doors: number;
  nextStopId: string; platformSide: 'left' | 'right';
}
interface Crossing { a: string; b: string; da: number; db: number }
interface Run { state: HopVehicleState; trips: HopTrip[]; index: number; next: number; dwellUntil: number; arrived: number; handoffDistance?: number }
export class HopSimulation {
  readonly date: string;
  time: number;
  playing: boolean;
  private accumulator = 0;
  private _playbackRate = 1;
  private paths: Map<string, HopPath>;
  private crossings: Crossing[] = [];
  private sides: Map<string, 'left' | 'right'>;
  private runs: Run[] = [];
  private pending: [string, HopTrip[]][] = [];
  get vehicles(): HopVehicleState[] { return this.runs.map(r => r.state); }
  get playbackRate(): number { return this._playbackRate; }
  constructor(data: HopData, options: { reducedMotion?: boolean; date?: string; time?: number } = {}) {
    this.date = options.date ?? data.defaultDate ?? '20260908'; this.time = options.time ?? data.defaultTime ?? 43200;
    this.playing = !options.reducedMotion;
    this.paths = new Map(data.paths.map(p => [p.id, p]));
    this.sides = new Map(data.stops.map(s => [s.id, s.platformSide ?? 'right']));
    for (let pi = 0; pi < data.paths.length; pi++) for (let pj = pi; pj < data.paths.length; pj++) {
      const a = data.paths[pi], b = data.paths[pj];
      for (let i = 1; i < a.points.length; i++) for (let j = pi === pj ? i + 2 : 1; j < b.points.length; j++) {
        const u = delta(a.points[i], a.points[i - 1]), v = delta(b.points[j], b.points[j - 1]);
        const det = u[0] * v[2] - u[2] * v[0];
        const horizontal = Math.hypot(u[0], u[2]) * Math.hypot(v[0], v[2]);
        if (Math.abs(det) < 1e-6 || !horizontal || Math.abs((u[0] * v[0] + u[2] * v[2]) / horizontal) > 0.8) continue;
        const w = delta(b.points[j - 1], a.points[i - 1]);
        const ta = (w[0] * v[2] - w[2] * v[0]) / det, tb = (w[0] * u[2] - w[2] * u[0]) / det;
        if (ta < 0 || ta > 1 || tb < 0 || tb > 1) continue;
        if (Math.abs(a.points[i - 1][1] + ta * u[1] - b.points[j - 1][1] - tb * v[1]) > 2) continue;
        this.crossings.push({ a: a.id, b: b.id, da: a.distances[i - 1] + ta * (a.distances[i] - a.distances[i - 1]), db: b.distances[j - 1] + tb * (b.distances[j] - b.distances[j - 1]) });
      }
    }
    for (const [id, trips] of hopBlocksForDate(data, this.date)) {
      if (trips.some(t => !this.paths.has(t.pathId))) continue;
      const recent = trips.findLastIndex(t => t.stops[0].arrival <= this.time);
      if (recent < 0) this.pending.push([id, trips]);
      else if (this.time > trips[recent].stops.at(-1)!.arrival + 120 && (trips[recent + 1]?.stops[0].arrival ?? Infinity) > this.time + 120) {
        if (trips[recent + 1]) this.pending.push([id, trips.slice(recent + 1)]);
      } else this.seed(id, trips);
    }
  }
  /** Sets simulated time speed. Unsupported values safely fall back to 1x. */
  setPlaybackRate(value: number): void {
    this._playbackRate = value === 0.5 || value === 1 || value === 2 || value === 4 ? value : 1;
  }
  private seed(id: string, trips: HopTrip[]) {
    let index = trips.findLastIndex(t => t.stops[0].departure <= this.time); if (index < 0) index = 0;
    const trip = trips[index], stops = trip.stops;
    if (index === trips.length - 1 && this.time > stops.at(-1)!.arrival + 120) return;
    let next = stops.findIndex(s => s.arrival > this.time); if (next < 0) next = stops.length;
    const state: HopVehicleState = { id: `hop-${id}`, blockId: id, tripId: trip.id, pathId: trip.pathId, routeId: trip.routeId, distance: stops[0].distance, speed: 0, phase: 'travel', doors: 0, nextStopId: stops[Math.min(next, stops.length - 1)].stopId, platformSide: 'right' };
    let arrived = this.time, dwellUntil = this.time;
    if (next >= stops.length) { state.distance = stops.at(-1)!.distance; state.phase = 'layover'; }
    else if (next === 0) { state.phase = 'dwell'; dwellUntil = stops[0].departure; }
    else {
      const a = stops[next - 1], b = stops[next];
      const departure = a.departure + Math.min(DWELL, Math.max(0, (b.arrival - a.departure) * 0.22));
      if (this.time < departure) { state.distance = a.distance; state.phase = 'dwell'; state.nextStopId = a.stopId; arrived = a.arrival; dwellUntil = departure; }
      else { const f = Math.max(0, Math.min(1, (this.time - departure) / Math.max(1, b.arrival - departure))); state.distance = a.distance + (b.distance - a.distance) * f; state.speed = Math.min(MAX_SPEED, (b.distance - a.distance) / Math.max(1, b.arrival - departure)); }
    }
    state.platformSide = this.sides.get(state.nextStopId) ?? 'right';
    this.runs.push({ state, trips, index, next, arrived, dwellUntil });
  }
  setPlaying(playing: boolean) { this.playing = playing; this.accumulator = 0; }
  update(dtSeconds: number) {
    if (!this.playing || !Number.isFinite(dtSeconds) || dtSeconds <= 0) return;
    // A suspended tab is not an instruction to simulate minutes of catch-up.
    this.accumulator += Math.min(dtSeconds, 0.5) * this._playbackRate;
    while (this.accumulator + 1e-10 >= STEP) { this.step(STEP); this.accumulator -= STEP; }
  }
  private step(dt: number) {
    this.time += dt;
    for (let i = this.pending.length - 1; i >= 0; i--) if (this.pending[i][1][0].stops[0].arrival <= this.time) { this.seed(...this.pending[i]); this.pending.splice(i, 1); }
    const snapshot = this.runs.map(r => ({ ...r.state, ...sampleHopPath(this.paths.get(r.state.pathId)!, r.state.distance) }));
    for (const run of this.runs) {
      const s = run.state, trip = run.trips[run.index], path = this.paths.get(s.pathId)!;
      if (s.phase === 'dwell') {
        s.speed = 0;
        const opening = Math.min(1, Math.max(0, (this.time - run.arrived) / 1.3));
        s.doors = Math.min(opening, Math.min(1, Math.max(0, (run.dwellUntil - this.time - 0.5) / 1.3)));
        if (this.time >= run.dwellUntil) { s.phase = run.next >= trip.stops.length ? 'layover' : 'travel'; s.doors = 0; }
        continue;
      }
      if (s.phase === 'layover') {
        s.speed = 0; s.doors = 0;
        const next = run.trips[run.index + 1];
        if (!next || this.time < next.stops[0].departure) continue;
        const nextPath = this.paths.get(next.pathId)!;
        const target = sampleHopPath(nextPath, next.stops[0].distance).position;
        if (gap(sampleHopPath(path, s.distance).position, target) <= 0.75) {
          run.index++; run.next = 1; run.handoffDistance = undefined;
          s.tripId = next.id; s.pathId = next.pathId; s.routeId = next.routeId; s.distance = next.stops[0].distance; s.nextStopId = next.stops[1].stopId; s.phase = 'travel';
        } else if (path.id === nextPath.id) { run.handoffDistance = s.distance + ((next.stops[0].distance - s.distance) % path.length + path.length) % path.length; s.phase = 'travel'; }
        // Different, disconnected paths stay at the terminal; never teleport a car.
        continue;
      }
      const stop = trip.stops[run.next];
      const targetDistance = run.handoffDistance ?? stop?.distance;
      if (targetDistance === undefined) { s.phase = 'layover'; continue; }
      const remaining = Math.max(0, targetDistance - s.distance);
      let limit = Math.min(MAX_SPEED, Math.sqrt(2 * BRAKING * remaining));
      // Look ahead for angular changes, brake before corners instead of after them.
      for (let ahead = -10; ahead <= 70; ahead += 2) {
        const a = sampleHopPath(path, s.distance + ahead - 2).tangent, b = sampleHopPath(path, s.distance + ahead + 2).tangent;
        const angle = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
        const curveLimit = angle > 0.35 ? 3 : angle > 0.12 ? 5 : MAX_SPEED;
        limit = Math.min(limit, Math.sqrt(curveLimit ** 2 + 2 * BRAKING * Math.max(0, ahead - 10)));
      }
      if (stop && run.handoffDistance === undefined) {
        const secondsLeft = stop.arrival - this.time;
        if (secondsLeft > 1) limit = Math.min(limit, Math.max(1.5, remaining / secondsLeft));
      }
      let clearTravel = Infinity;
      const here = sampleHopPath(path, s.distance);
      for (const other of snapshot) {
        if (other.id === s.id) continue;
        const offset = delta(other.position, here.position);
        const along = offset[0] * here.tangent[0] + offset[2] * here.tangent[2];
        const lateral = Math.abs(offset[0] * here.tangent[2] - offset[2] * here.tangent[0]);
        const aligned = other.tangent[0] * here.tangent[0] + other.tangent[2] * here.tangent[2] > 0.5;
        if (aligned && along > 0 && lateral < 2.5 && Math.abs(offset[1]) < 2) {
          limit = Math.min(limit, Math.sqrt(2 * BRAKING * Math.max(0, along - 25)));
          clearTravel = Math.min(clearTravel, Math.max(0, along - 22.4));
        }
      }
      const toCrossing = (p: HopPath, at: number, crossing: number) => {
        let d = crossing - at;
        if (gap(p.points[0], p.points.at(-1)!) < 0.1) { d = ((d % p.length) + p.length) % p.length; if (d > p.length - 14) d -= p.length; }
        return d;
      };
      // Crossing reservations are independent of route visibility and use stable block IDs.
      for (const crossing of this.crossings) for (const flip of [false, true]) {
        const ownPath = flip ? crossing.b : crossing.a, otherPath = flip ? crossing.a : crossing.b;
        if (ownPath !== s.pathId) continue;
        const da = toCrossing(path, s.distance, flip ? crossing.db : crossing.da);
        if (da < -14 || da > 75) continue;
        for (const other of snapshot) {
          if (other.id === s.id || other.pathId !== otherPath) continue;
          const db = toCrossing(this.paths.get(other.pathId)!, other.distance, flip ? crossing.da : crossing.db);
          if (db < -14 || db > 75 || (other.phase !== 'travel' && db > 14)) continue;
          const oursInside = Math.abs(da) < 14, theirsInside = Math.abs(db) < 14;
          const theirPriority = theirsInside && !oursInside || (theirsInside === oursInside && (db < da - 0.1 || Math.abs(da - db) <= 0.1 && other.id < s.id));
          if (!theirPriority || da < 0) continue;
          const clear = Math.max(0, da - 14);
          const crossingLimit = Math.sqrt(2 * BRAKING * clear);
          limit = Math.min(limit, crossingLimit);
          clearTravel = Math.min(clearTravel, clear);
        }
      }
      s.speed = Math.max(0, s.speed + Math.max(-BRAKING * dt, Math.min(ACCELERATION * dt, limit - s.speed)));
      const requestedMove = s.speed * dt;
      let move = Math.min(remaining, requestedMove, clearTravel);
      if (move > 0) {
        for (const otherRun of this.runs) {
          if (otherRun === run) continue;
          const other = otherRun.state, otherPath = this.paths.get(other.pathId)!;
          if (gap(here.position, sampleHopPath(otherPath, other.distance).position) > 25) continue;
          if (posesOverlap(solveHopPose(path, s.distance + move), solveHopPose(otherPath, other.distance))) { move = 0; s.speed = 0; break; }
        }
      }
      if (move < requestedMove && clearTravel < remaining) s.speed = Math.min(s.speed, move / dt);
      s.distance += move;
      if (remaining <= move + 0.015) {
        s.distance = targetDistance; s.speed = 0;
        if (run.handoffDistance !== undefined) { s.phase = 'layover'; run.handoffDistance = undefined; }
        else {
          s.phase = 'dwell'; s.nextStopId = stop.stopId; s.platformSide = this.sides.get(stop.stopId) ?? 'right';
          run.arrived = this.time; run.dwellUntil = Math.max(this.time + DWELL, stop.departure); run.next++;
        }
      } else if (stop) { s.nextStopId = stop.stopId; s.platformSide = this.sides.get(stop.stopId) ?? 'right'; }
    }
  }
}
