import * as THREE from 'three';
import type { City, Mode } from './scene';
import type { Director } from './tour';
import type { HopData } from './hopTypes';
import { HopSimulation, solveHopPose } from './hopMotion.ts';
import { createHopVehicle } from './hopVehicle.ts';
import { buildHopRoute, scheduledHopPlatforms } from './hopRoute.ts';
import { StreetcarTour } from './hopTour.ts';
import { hopCameraPose, type HopCameraView } from './hopCamera.ts';
import { createDrivingWorld } from './drivingWorld.ts';

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
export interface HopFeature {
  readonly tour: StreetcarTour;
  startTour(routeId: string): boolean;
  update(dt: number): void; setMode(mode: Mode): void; close(): void; dispose(): void;
}
interface Options { city: City; director: Director; dataUrl: string; reducedMotion: boolean; onFocus(closeDrawer?: boolean): void }

export async function loadHop(options: Options): Promise<HopFeature | undefined> {
  const { city, director } = options;
  const status = el('hop-status');
  let data: HopData;
  try {
    const response = await fetch(options.dataUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    data = await response.json();
    if (data.version !== 1 || !data.paths?.length || !data.trips?.length || !data.calendars?.length) throw new Error('Invalid streetcar data');
    for (const path of data.paths) if (path.points.length !== path.distances.length || path.points.length < 2 || !(path.length > 0)
      || path.points.some(p => p.length !== 3 || !p.every(Number.isFinite))) throw new Error('Invalid streetcar path');
  } catch {
    status.textContent = 'Streetcar preview unavailable. Reload to try again.';
    el<HTMLButtonElement>('hop-toggle').disabled = true;
    return undefined;
  }
  const simulation = new HopSimulation(data, { reducedMotion: options.reducedMotion });
  const route = buildHopRoute(data); city.city.add(route.group);
  city.scene.add(route.platforms);
  const vehicles = new THREE.Group(); vehicles.name = 'hop-vehicles-at-physical-scale'; city.scene.add(vehicles);
  const models = new Map<string, ReturnType<typeof createHopVehicle>>();
  const paths = new Map(data.paths.map(p => [p.id, p]));
  const stops = new Map(data.stops.map(s => [s.id, s]));
  const platformSides = new Map<string, 'left' | 'right'>();
  scheduledHopPlatforms(data).forEach((pose, key) => platformSides.set(key, pose.side));
  const visibleLines = new Set(data.paths.map(p => p.routeId));
  const toggle = el<HTMLButtonElement>('hop-toggle'), controls = el('hop-controls');
  const carSelect = el<HTMLSelectElement>('hop-car'), play = el<HTMLButtonElement>('hop-play');
  const follow = el<HTMLButtonElement>('hop-follow'), overlay = el<HTMLInputElement>('hop-overlay');
  let selected = '', expanded = false, skipFrame = true, lastStatus = -1, mode = city.mode, heightScale = 0;
  const listeners: (() => void)[] = [];
  function listen(target: EventTarget, event: string, handler: EventListener) {
    target.addEventListener(event, handler); listeners.push(() => target.removeEventListener(event, handler));
  }
  const state = () => simulation.vehicles.find(v => v.id === selected && visibleLines.has(v.routeId));
  const viewSelect=el<HTMLSelectElement>('hop-view');
  const followView=el<HTMLSelectElement>('hop-follow-view'), followBar=el('hop-follow-bar');
  let cameraView:HopCameraView='aerial', savedNear:number|undefined;
  const cameraWorld=createDrivingWorld(city.tiles);
  const syncCameraClip=()=>{
    const close=cameraView==='third-person'&&director.isFollowing;
    if(close&&savedNear===undefined){savedNear=city.camera.near;city.camera.near=.25;city.camera.updateProjectionMatrix();}
    else if(!close&&savedNear!==undefined){city.camera.near=savedNear;savedNear=undefined;city.camera.updateProjectionMatrix();}
  };
  const followPose = () => {
    const car=state();if(!car)return;
    const pose=hopCameraPose(paths.get(car.pathId)!,car.distance,city.exaggeration,cameraView);
    if(cameraView==='third-person') {
      const target=pose.position.clone().addScaledVector(pose.tangent,4).add(new THREE.Vector3(0,2,0));
      pose.cameraPosition.copy(cameraWorld.cameraPosition(target,pose.cameraPosition));
    }
    return pose;
  };
  const ride = new StreetcarTour(simulation, {
    start: () => director.startFollow(followPose), stop: () => director.stopFollow(), isFollowing: () => director.isFollowing,
  });
  const syncOverlay = () => route.setOverlay(expanded && overlay.checked, visibleLines);
  const focusCar = () => {
    const pose = followPose(); if (!pose) return;
    director.stopTour(); options.onFocus();
    director.flyTo(pose.cameraPosition, pose.position.clone().add(new THREE.Vector3(0, 2, 0)), 3);
  };
  const refreshCars = () => {
    const active = simulation.vehicles.filter(v => visibleLines.has(v.routeId));
    if (!active.some(v => v.id === selected)) selected = active[0]?.id ?? '';
    const currentIds = Array.from(carSelect.options).map(o => o.value).join('|');
    if (active.map(v => v.id).join('|') !== currentIds) {
      carSelect.replaceChildren();
      active.forEach(car => {
        const option = document.createElement('option'); option.value = car.id;
        option.textContent = `${paths.get(car.pathId)?.name.replace(' THE HOP', '')} · Car ${simulation.vehicles.findIndex(v => v.id === car.id) + 1}`; carSelect.add(option);
      });
    }
    carSelect.value = selected; carSelect.disabled = !active.length || ride.active; follow.disabled = !active.length;
  };
  listen(toggle, 'click', () => {
    expanded = !expanded; controls.hidden = !expanded; toggle.setAttribute('aria-expanded', String(expanded)); syncOverlay();
    if (expanded) { refreshCars(); if (!ride.active) focusCar(); }
  });
  listen(carSelect, 'change', () => { selected = carSelect.value; if (!director.isFollowing) focusCar(); });
  for(const select of [viewSelect,followView])listen(select,'change',()=>{
    cameraView=select.value==='third-person'?'third-person':'aerial';
    viewSelect.value=followView.value=cameraView;
    if(state()&&!director.isFollowing){director.startFollow(followPose);options.onFocus(true);}
    syncCameraClip();lastStatus=-1;
  });
  listen(el('hop-follow-stop'),'click',()=>{
    if(ride.active)ride.stop();else director.stopFollow();
    syncCameraClip();followBar.hidden=true;lastStatus=-1;
  });
  document.querySelectorAll<HTMLButtonElement>('[data-hop-speed]').forEach(button=>{
    listen(button,'click',()=>{
      simulation.setPlaybackRate(Number(button.dataset.hopSpeed));
      document.querySelectorAll<HTMLButtonElement>('[data-hop-speed]').forEach(choice=>choice.setAttribute('aria-pressed',String(Number(choice.dataset.hopSpeed)===simulation.playbackRate)));
      lastStatus=-1;
    });
  });
  listen(play, 'click', () => { simulation.setPlaying(!simulation.playing); lastStatus = -1; });
  listen(follow, 'click', () => {
    if (ride.active) ride.stop();
    else if (director.isFollowing) director.stopFollow(); else { director.startFollow(followPose); options.onFocus(true); }
    lastStatus = -1;
  });
  listen(overlay, 'change', syncOverlay);
  for (const path of data.paths) {
    const checkbox = el<HTMLInputElement>(path.routeId === 'TL-7' ? 'hop-m' : 'hop-l');
    listen(checkbox, 'change', () => {
      if (checkbox.checked) visibleLines.add(path.routeId); else visibleLines.delete(path.routeId);
      director.stopFollow(); refreshCars(); syncOverlay(); lastStatus = -1;
    });
  }
  listen(el('hop-overview'), 'click', () => {
    const box = new THREE.Box3(); data.paths.filter(p => visibleLines.has(p.routeId)).forEach(p => p.points.forEach(v => box.expandByPoint(new THREE.Vector3(...v))));
    if (box.isEmpty()) return;
    const center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    center.y *= city.exaggeration; director.stopTour(); options.onFocus(true);
    const vertical = THREE.MathUtils.degToRad(city.camera.fov);
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * city.camera.aspect);
    const distance = size.length() * .5 / Math.sin(Math.min(vertical, horizontal) / 2) * 1.25;
    director.flyTo(center.clone().add(new THREE.Vector3(.12, 1, .22).normalize().multiplyScalar(distance)), center, 4);
  });
  listen(document, 'visibilitychange', () => { skipFrame = true; });
  toggle.disabled = false;
  refreshCars();
  const update = (dt: number) => {
    if (document.hidden) { skipFrame = true; return; }
    ride.update();
    syncCameraClip();
    followBar.hidden=!director.isFollowing||!state();
    route.setGuideVisible(city.camera.position.distanceTo(city.controls.target) > 300);
    if (heightScale !== city.exaggeration) { heightScale = city.exaggeration; route.setHeightScale(heightScale); }
    if (skipFrame) skipFrame = false; else simulation.update(Math.min(dt, .1));
    const activeIds = new Set<string>();
    for (const car of simulation.vehicles) {
      activeIds.add(car.id); const path = paths.get(car.pathId); if (!path) continue;
      let model = models.get(car.id);
      if (!model) { model = createHopVehicle(path.name.replace(' THE HOP', '')); model.setMode(mode); models.set(car.id, model); vehicles.add(model.group); }
      model.group.visible = visibleLines.has(car.routeId);
      model.applyPose(solveHopPose(path, car.distance, city.exaggeration));
      const side = platformSides.get(`${path.id}:${car.nextStopId}`) ?? car.platformSide;
      model.setDoors(car.doors, side);
    }
    models.forEach((model, id) => { if (!activeIds.has(id)) { model.group.removeFromParent(); model.dispose(); models.delete(id); } });
    if (Math.floor(simulation.time) !== lastStatus || play.getAttribute('aria-pressed') !== String(simulation.playing) || follow.getAttribute('aria-pressed') !== String(director.isFollowing)) {
      lastStatus = Math.floor(simulation.time); refreshCars();
      const h = Math.floor(simulation.time / 3600) % 24, m = Math.floor(simulation.time / 60) % 60;
      status.textContent = `Scheduled preview · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} · ${simulation.playing ? 'Playing' : 'Paused'} · ${simulation.playbackRate}×`;
      const car = state();
      el('hop-next').textContent = car ? `${car.phase === 'dwell' ? 'At' : car.phase === 'layover' ? 'Waiting at' : 'Next'}: ${stops.get(car.nextStopId)?.name ?? 'Terminal'}` : 'Enable a line to see its streetcars.';
      play.textContent = simulation.playing ? 'Pause' : 'Play'; play.setAttribute('aria-pressed', String(simulation.playing));
      follow.textContent = director.isFollowing ? 'Stop following' : 'Follow car'; follow.setAttribute('aria-pressed', String(director.isFollowing));
    }
  };
  update(0);
  return { tour: ride, startTour(routeId) {
      const car = simulation.vehicles.find(v => v.routeId === routeId);
      if (!car) return false;
      visibleLines.add(routeId);
      el<HTMLInputElement>(routeId === 'TL-7' ? 'hop-m' : 'hop-l').checked = true;
      selected = car.id; refreshCars();
      expanded = false; controls.hidden = true; toggle.setAttribute('aria-expanded', 'false'); syncOverlay();
      ride.start(paths.get(car.pathId)?.name.replace(' THE HOP', '') ?? 'Streetcar');
      options.onFocus(true); lastStatus = -1;
      return true;
    }, update, setMode(value) { mode = value; models.forEach(m => m.setMode(value)); },
    close() { ride.stop(); expanded = false; controls.hidden = true; toggle.setAttribute('aria-expanded', 'false'); syncOverlay(); director.stopFollow(); syncCameraClip(); followBar.hidden=true; },
    dispose() { ride.stop(); director.stopFollow(); syncCameraClip(); followBar.hidden=true; listeners.forEach(fn => fn()); route.dispose(); models.forEach(m => m.dispose()); models.clear(); vehicles.removeFromParent(); },
  };
}
