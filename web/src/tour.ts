import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Landmark } from './landmarks';

const UP = new THREE.Vector3(0, 1, 0);
const clamp01 = (t: number) => THREE.MathUtils.clamp(t, 0, 1);
const smoother = (t: number) => { t = clamp01(t); return t * t * t * (t * (t * 6 - 15) + 10); };
const shortestAngle = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
interface DirectorOptions { groundAt?: (x: number, z: number) => number; exaggeration?: () => number; now?: () => number }
interface Flight { p0: THREE.Vector3; p1: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3; elapsed: number; duration: number; lift: number; done?: () => void }

export class Director {
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private stops: Landmark[];
  private locate: (l: Landmark) => { x: number; y: number; z: number };
  private reduceMotion: boolean;
  private options: DirectorOptions;
  private flight?: Flight;
  private lastNow?: number;
  private dwellElapsed = 0;
  private playbackSpeed = 1;
  private dwellStart?: THREE.Vector3;
  private pausedPose?: { pos: THREE.Vector3; target: THREE.Vector3 };
  private followTarget?: () => { position: THREE.Vector3; tangent: THREE.Vector3; cameraPosition?: THREE.Vector3 } | undefined;
  tour = { active: false, paused: false, index: -1, dwellUntil: 0 };
  onTourStep?: (l: Landmark | null) => void;
  onFlightStart?: (target: THREE.Vector3) => void;

  constructor(camera: THREE.PerspectiveCamera, controls: OrbitControls, stops: Landmark[], locate: (l: Landmark) => { x: number; y: number; z: number }, reduceMotion: boolean, options: DirectorOptions = {}) {
    this.camera = camera; this.controls = controls; this.stops = stops; this.locate = locate; this.reduceMotion = reduceMotion; this.options = options;
  }
  get isAnimating() { return !!this.followTarget || (!this.tour.paused && (!!this.flight || (!this.reduceMotion && this.tour.active && !!this.dwellStart))); }
  get speed() { return this.playbackSpeed; }
  setSpeed(speed: number) {
    if (![1, 2, 4].includes(speed)) return;
    // Keep elapsed time and the current pose intact when changing playback rate.
    this.playbackSpeed = speed;
  }
  get isFollowing() { return !!this.followTarget; }
  startFollow(target: () => { position: THREE.Vector3; tangent: THREE.Vector3; cameraPosition?: THREE.Vector3 } | undefined) {
    this.stopTour(); this.followTarget = target; this.lastNow = undefined;
  }
  stopFollow() { this.followTarget = undefined; }

  poseFor(l: Landmark) {
    const p = this.locate(l), exag = Math.max(0.01, this.options.exaggeration?.() ?? 1);
    const ground = (this.options.groundAt?.(p.x, p.z) ?? p.y) * exag;
    const focus = (l.focusHeight ?? l.labelHeight * 0.35) * exag;
    const [dist, az, givenElevation] = l.view;
    const minimum = THREE.MathUtils.radToDeg(Math.atan2(Math.max(0, focus - 25), dist)) * 0.38;
    const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(Math.max(givenElevation, minimum));
    const target = new THREE.Vector3(p.x, ground + focus, p.z);
    const horizontal = Math.cos(e) * dist;
    const pos = new THREE.Vector3(p.x + Math.sin(a) * horizontal, Math.max(ground + Math.sin(e) * dist + 10, ground + 12, target.y + horizontal * Math.tan(THREE.MathUtils.degToRad(8))), p.z - Math.cos(a) * horizontal);
    return { pos, target };
  }
  flyTo(pos: THREE.Vector3, target: THREE.Vector3, dur?: number, done?: () => void) { this.beginFlight(pos, target, dur, done, false); }
  flyToLandmark(l: Landmark, done?: () => void) { const { pos, target } = this.poseFor(l); this.beginFlight(pos, target, undefined, done, false); }
  cancelFlight() { this.flight = undefined; this.followTarget = undefined; this.lastNow = undefined; this.controls.enabled = true; }
  startTour() { if (!this.stops.length) { this.stopTour(); return; } this.tour.active = true; this.tour.paused = false; this.tour.index = -1; this.dwellStart = undefined; this.next(); }
  stopTour() { const hadTour = this.tour.active; this.tour.active = false; this.tour.paused = false; this.tour.index = -1; this.tour.dwellUntil = 0; this.dwellStart = undefined; this.pausedPose = undefined; this.cancelFlight(); if (hadTour) this.onTourStep?.(null); }
  togglePause() {
    if (!this.tour.active) return;
    if (!this.tour.paused) { this.tour.paused = true; this.pausedPose = { pos: this.camera.position.clone(), target: this.controls.target.clone() }; this.lastNow = undefined; return; }
    this.tour.paused = false;
    const moved = !!this.pausedPose && (this.camera.position.distanceTo(this.pausedPose.pos) > 0.01 || this.controls.target.distanceTo(this.pausedPose.target) > 0.01);
    this.pausedPose = undefined;
    if (moved && this.flight) { const f = this.flight; this.beginFlight(f.p1, f.t1, Math.max(4, f.duration - f.elapsed), f.done, true); }
    else if (moved && this.dwellStart) {
      const l = this.stops[this.tour.index], pose = this.poseFor(l);
      this.dwellStart = undefined;
      this.beginFlight(pose.pos, pose.target, 4, () => { this.dwellElapsed = 0; this.dwellStart = this.camera.position.clone(); }, true);
    }
    this.lastNow = undefined;
  }
  update(now = this.options.now?.() ?? performance.now()) {
    const dt = this.lastNow === undefined ? 0 : THREE.MathUtils.clamp(now - this.lastNow, 0, 100); this.lastNow = now;
    if (this.followTarget) {
      const pose = this.followTarget();
      if (!pose) { this.stopFollow(); return; }
      const direction = pose.tangent.clone().setY(0).normalize();
      const target = pose.position.clone().addScaledVector(direction, 4).add(new THREE.Vector3(0, 2, 0));
      const position = pose.cameraPosition ?? pose.position.clone().addScaledVector(direction, -34).add(new THREE.Vector3(0, 32, 0));
      const amount = 1 - Math.exp(-dt / 1000 * 1.8);
      this.camera.position.lerp(position, amount); this.controls.target.lerp(target, amount); this.camera.up.copy(UP);
      return;
    }
    if (this.tour.paused) return;
    // Only advance the drone tour faster; vehicle following and manual fly-to
    // navigation retain their own timing.
    const elapsed = dt / 1000 * (this.tour.active ? this.playbackSpeed : 1);
    if (this.flight) {
      const f = this.flight; f.elapsed = Math.min(f.duration, f.elapsed + elapsed); const raw = f.duration ? f.elapsed / f.duration : 1, k = smoother(raw);
      const target = this.controls.target.lerpVectors(f.t0, f.t1, k), from = f.p0.clone().sub(f.t0), to = f.p1.clone().sub(f.t1);
      const r0 = Math.max(0.001, Math.hypot(from.x, from.z)), r1 = Math.max(0.001, Math.hypot(to.x, to.z));
      const yaw0 = Math.atan2(from.x, from.z), yaw = yaw0 + shortestAngle(yaw0, Math.atan2(to.x, to.z)) * k;
      const radius = THREE.MathUtils.lerp(r0, r1, k), y = THREE.MathUtils.lerp(from.y, to.y, k) + f.lift * Math.sin(Math.PI * k);
      this.camera.position.set(target.x + Math.sin(yaw) * radius, target.y + y, target.z + Math.cos(yaw) * radius); this.camera.up.copy(UP);
      if (raw >= 1) { this.camera.position.copy(f.p1); this.controls.target.copy(f.t1); this.flight = undefined; f.done?.(); }
      return;
    }
    if (this.tour.active && this.dwellStart) {
      const dwellDuration = this.reduceMotion ? 2.5 : 12;
      this.dwellElapsed = Math.min(dwellDuration, this.dwellElapsed + elapsed);
      if (!this.reduceMotion) {
        const angle = THREE.MathUtils.degToRad(23) * smoother(this.dwellElapsed / dwellDuration);
        const offset = this.dwellStart.clone().sub(this.controls.target).applyAxisAngle(UP, angle);
        this.camera.position.copy(this.controls.target).add(offset); this.camera.up.copy(UP);
      }
      this.tour.dwellUntil = Math.max(0, dwellDuration - this.dwellElapsed) * 1000;
      if (this.dwellElapsed >= dwellDuration) { this.dwellStart = undefined; this.tour.dwellUntil = 0; this.next(); }
    }
  }
  private flushControls() {
    const c = this.controls as OrbitControls & { enableDamping?: boolean; update?: (deltaTime?: number) => boolean };
    if (!c.update) return;
    const damping = c.enableDamping; c.enableDamping = false; c.update(); c.enableDamping = damping ?? false;
  }
  private beginFlight(pos: THREE.Vector3, target: THREE.Vector3, requested: number | undefined, done: (() => void) | undefined, rejoin: boolean) {
    this.stopFollow();
    this.flushControls(); this.onFlightStart?.(target);
    if (this.reduceMotion) { this.flight = undefined; this.camera.position.copy(pos); this.controls.target.copy(target); this.camera.up.copy(UP); done?.(); return; }
    const distance = this.camera.position.distanceTo(pos), scenic = this.tour.active && !rejoin;
    const duration = requested ?? (scenic ? THREE.MathUtils.clamp(7 + distance / 260, 7, 24) : THREE.MathUtils.clamp(4 + distance / 650, 4, 8));
    this.flight = { p0: this.camera.position.clone(), p1: pos.clone(), t0: this.controls.target.clone(), t1: target.clone(), elapsed: 0, duration: Math.max(0.001, duration), lift: scenic ? THREE.MathUtils.clamp(distance * 0.09, 18, 150) : THREE.MathUtils.clamp(distance * 0.035, 0, 45), done };
    this.lastNow = undefined; this.controls.enabled = true;
  }
  private next() {
    if (!this.tour.active || this.tour.paused || !this.stops.length) return;
    this.tour.index = (this.tour.index + 1) % this.stops.length; const l = this.stops[this.tour.index]; this.onTourStep?.(l);
    const { pos, target } = this.poseFor(l);
    this.beginFlight(pos, target, undefined, () => { if (!this.tour.active) return; this.dwellElapsed = 0; this.dwellStart = this.camera.position.clone(); this.tour.dwellUntil = this.reduceMotion ? 2500 : 12000; }, false);
  }
}
