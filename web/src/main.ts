import { createStreetLighting } from './streetLighting';
import { STREET_LIGHT_SITES } from './streetLightSites';
import { RAVE_SITE, removeRavePlaceholder } from './raveSite';
import { SAINT_KATE_SITE, removeSaintKatePlaceholder } from './saintKateSite';
import { MARCUS_SITE, PECK_SITE, removeMarcusPlaceholders } from './marcusSite';
import { PABST_SITE, RIVERSIDE_SITE, removeTheaterPlaceholders } from './theaterSites';
import { TURNER_HALL_SITE, removeTurnerHallPlaceholder } from './turnerHallSite';
import {cityData,DataLoadError} from './dataFetch';
import {SUMMERFEST_FOCUS,prepareSummerfestTerrain,adaptSummerfestTile} from './summerfestSite';
import {NEW_MUSEUM_SITE} from './newMuseumSite';
import {prepareJonesIslandWater} from './jonesIslandWater';
import {detailJonesIslandBuildings} from './jonesIslandBuildings';
import {PORT_FOCUS} from './portMilwaukee';
import {removePortPlaceholders} from './portPlaceholder';
import { terrainHeight, bilinearTerrainHeight, prepareLocalTerrain, contains, LIGHTHOUSE_BOUNDS, adaptLighthouseTile } from './localTerrain';
import { removeAmFamPlaceholder } from './amfamSite';
import { removeMuseumPlaceholder } from './museumSite';
import { removeDiscoveryPlaceholder } from './discoverySite';
import { removePublicMarketPlaceholder } from './publicMarketSite';
import { removeDomesPlaceholder, DOMES_SITE } from './domesSite';
import { removeCityHallPlaceholder } from './cityHallSite';
import * as THREE from 'three';
import './style.css';
import type { Manifest } from './geo';
import { lonLatToLocal } from './geo';
import { createCity, type Mode } from './scene';
import { createDrivingMode } from './driving';
import { createWalkingMode } from './walking';
import { TileManager, fetchBuffer, parseTerrain, parseSections, type TerrainData } from './loader';
import { LANDMARKS, buildInterpretive, makeLabel, type Landmark, type LandmarkGeo } from './landmarks';
import { Director } from './tour';
import { BuildingSigns } from './buildingSigns';
import { BUILDING_SIGNS } from './signLocations';
import { loadHop, type HopFeature } from './hop';
import { adaptHopPassages } from './hopSite';
import { COUTURE_SITE, removeCouturePlaceholder } from './coutureSite';
import { NM_SITE, removeNmPlaceholder } from './nmSite';
import { US_BANK_SITE, removeUsBankPlaceholder } from './usBankSite';
import { FISERV_SITE, removeFiservPlaceholder } from './fiservSite';
import { removeDeerDistrictBuildingPlaceholders } from './deerDistrictBuildings';
import { prepareHoanTerrain, prepareHoanWater, buildHoanContext, adaptHoanContextTile } from './hoanSite';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const DATA = `${import.meta.env.BASE_URL}data`.replace(/\/\/+/g, '/');
const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 720 || ((navigator as { deviceMemory?: number }).deviceMemory ?? 8) <= 4;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = $<HTMLCanvasElement>('#c');
const city = createCity(canvas, $('#labels'), mobile);
const loading = $('#loading'), bar = $('#bar'), loadText = $('#load-text'), errorBox = $('#error'), errorText = $('#error-text');
const panel = $('#panel'), panelTitle = $('#panel-title'), panelBody = $('#panel-body'), panelOsm = $<HTMLAnchorElement>('#panel-osm');
const tourBtn = $<HTMLButtonElement>('#tour'), tourStatus = $('#tour-status');
const tourLabel = $('#tour-label'), tourStop = $<HTMLButtonElement>('#tour-stop');
const tourType = $<HTMLSelectElement>('#tour-type');
const landmarkList = $('#landmark-list'), landmarkSearch = $<HTMLInputElement>('#landmark-search');
const drawerToggle = $<HTMLButtonElement>('#drawer-toggle'), about = $<HTMLDialogElement>('#about');
const destinationBoard = $<HTMLElement>('#destination-board');

function showError(msg: string, retry?: () => void) {
  errorText.textContent = msg; errorBox.hidden = false;
  const b = $<HTMLButtonElement>('#retry'); b.hidden = !retry; b.onclick = () => { errorBox.hidden = true; retry?.(); };
}

let terrainData: TerrainData | undefined;
let rawTerrainData: TerrainData | undefined;
let lighthouseTerrain: TerrainData | undefined;
function groundAt(x: number, z: number): number {
  if (lighthouseTerrain && contains(LIGHTHOUSE_BOUNDS, x, z)) return terrainHeight(lighthouseTerrain, x, z);
  return terrainData ? bilinearTerrainHeight(terrainData, x, z) : 0;
}

let booting=false;
async function boot() {
  if(booting)return;
  booting=true;
  errorBox.hidden=true; loading.hidden=false; loading.classList.remove('fade');
  let manifest: Manifest;
  try {
    loadText.textContent = 'Loading city index…';
    manifest = await cityData.json<Manifest>(`${DATA}/manifest.json`);
    const [terrainBuf, waterBuf, geo, lighthouseBuf] = await Promise.all([
      fetchBuffer(`${DATA}/terrain.bin`), fetchBuffer(`${DATA}/water.bin`), cityData.json<LandmarkGeo>(`${DATA}/landmarks_geo.json`), fetchBuffer(`${DATA}/lighthouse-terrain.bin`)]);
    rawTerrainData = parseTerrain(terrainBuf);
    terrainData = prepareSummerfestTerrain(prepareHoanTerrain(rawTerrainData));
    lighthouseTerrain = prepareLocalTerrain(terrainData, parseTerrain(lighthouseBuf));
    city.addTerrain(terrainData, LIGHTHOUSE_BOUNDS); city.addTerrain(lighthouseTerrain); city.addWater(prepareJonesIslandWater(prepareHoanWater(parseSections(waterBuf))));
    start(manifest, geo);
  } catch (e) {
    console.error('City initialization failed', e);
    loading.hidden = true;
    const message=e instanceof DataLoadError ? `Could not load ${e.message}. Try again, or reload the page if this tab has been open during updates.` : `The city could not start: ${(e as Error).message}. Reload the page to try again.`;
    showError(message, e instanceof DataLoadError ? () => { void boot(); } : () => location.reload());
  } finally {
    booting=false;
  }
}

function start(manifest: Manifest, geo: LandmarkGeo) {
  let hop: HopFeature | undefined;
  const landmarkButtons = new Map<string, HTMLButtonElement>();
  const locate = (l: Landmark) => {
    const [x, z] = l.id === 'rave' ? [RAVE_SITE.x,RAVE_SITE.z] : l.id === 'saintkate' ? [SAINT_KATE_SITE.x,SAINT_KATE_SITE.z] : l.id === 'marcus' ? [MARCUS_SITE.x,MARCUS_SITE.z] : l.id === 'peck' ? [PECK_SITE.x,PECK_SITE.z] : l.id === 'pabst' ? [PABST_SITE.x,PABST_SITE.z] : l.id === 'riverside' ? [RIVERSIDE_SITE.x,RIVERSIDE_SITE.z] : l.id === 'turnerhall' ? [TURNER_HALL_SITE.x,TURNER_HALL_SITE.z] : l.id === 'summerfest' ? [SUMMERFEST_FOCUS.x,SUMMERFEST_FOCUS.z] : l.id === 'newmuseum' ? [NEW_MUSEUM_SITE.x,NEW_MUSEUM_SITE.z] : l.id === 'port' ? [PORT_FOCUS.x,PORT_FOCUS.z] : l.id === 'usbank' ? [US_BANK_SITE.x, US_BANK_SITE.z] : l.id === 'fiserv' ? [FISERV_SITE.x, FISERV_SITE.z] : l.id === 'nm' ? [NM_SITE.x, NM_SITE.z] : l.id === 'couture' ? [COUTURE_SITE.x, COUTURE_SITE.z] : l.id === 'domes' ? [DOMES_SITE.x, DOMES_SITE.z] : l.id === 'hoan' && geo.hoan
      ? geo.hoan.archCenter : lonLatToLocal(manifest, l.lon, l.lat);
    return { x, y: groundAt(x, z), z };
  };
  // landmarks: interpretive geometry + clickable labels
  city.landmarks.add(buildInterpretive(manifest, geo, groundAt));
  city.landmarks.add(buildHoanContext(groundAt));
  const streetLighting=createStreetLighting(STREET_LIGHT_SITES,groundAt,{mobile});
  city.landmarks.add(streetLighting.root);streetLighting.setMode(city.mode);
  const museum = city.landmarks.getObjectByName('milwaukee-art-museum-campus');
  const lightMuseum = () => museum?.userData.setMuseumMode?.(city.mode);
  lightMuseum();
  const summerfest=city.landmarks.getObjectByName('summerfest-grounds');
  const lightSummerfest=()=>summerfest?.userData.setLightingMode?.(city.mode);lightSummerfest();
  const newMuseum=city.landmarks.getObjectByName('new-milwaukee-public-museum-campus');
  const lightNewMuseum=()=>newMuseum?.userData.setLightingMode?.(city.mode);lightNewMuseum();
  const discovery = city.landmarks.getObjectByName('discovery-world');
  const lightDiscovery = () => discovery?.userData.setLightingMode?.(city.mode);
  lightDiscovery();
  const market = city.landmarks.getObjectByName('milwaukee-public-market');
  const lightMarket = () => market?.userData.setLightingMode?.(city.mode);
  lightMarket();
  const lighthouse = city.landmarks.getObjectByName('north-point-lighthouse');
  const lightLighthouse = () => lighthouse?.userData.setLightingMode?.(city.mode);
  lightLighthouse();
  const amfam = city.landmarks.getObjectByName('american-family-field');
  const lightAmFam = () => amfam?.userData.setLightingMode?.(city.mode);
  lightAmFam();
  const roofControl=document.createElement('button');
  roofControl.type='button';roofControl.className='landmark-roof-control';roofControl.hidden=true;
  const syncRoofControl=()=>{roofControl.textContent=amfam?.userData.roofOpenness===0?'Open roof':'Close roof';};
  syncRoofControl();panel.append(roofControl);
  roofControl.onclick=()=>{amfam?.userData.setRoofOpenness?.(amfam.userData.roofOpenness===0?1:0);syncRoofControl();};
  const hoan = city.landmarks.getObjectByName('hoan-bridge');
  const lightHoan = () => hoan?.userData.setLightingMode?.(city.mode);
  lightHoan();
  const port=city.landmarks.getObjectByName('port-milwaukee');
  const lightPort=()=>port?.userData.setLightingMode?.(city.mode);lightPort();
  const domes = city.landmarks.getObjectByName('mitchell-park-domes');
  const lightDomes = () => domes?.userData.setLightingMode?.(city.mode);
  lightDomes();
  const couture = city.landmarks.getObjectByName('the-couture');
  const lightCouture = () => couture?.userData.setLightingMode?.(city.mode);
  lightCouture();
  const usBank=city.landmarks.getObjectByName('us-bank-center');
  const lightUsBank=()=>usBank?.userData.setLightingMode?.(city.mode);lightUsBank();
  const nm = city.landmarks.getObjectByName('northwestern-mutual');
  const lightNM = () => nm?.userData.setLightingMode?.(city.mode);
  lightNM();
  const fiserv = city.landmarks.getObjectByName('fiserv-forum');
  const deerDistrict = city.landmarks.getObjectByName('deer-district');
  const districtBuildings = city.landmarks.getObjectByName('deer-district-buildings');
  const turnerHall = city.landmarks.getObjectByName('turner-hall-ballroom');
  const theaters = ['pabst-theater','riverside-theater','marcus-campus','saint-kate','the-rave'].map(name=>city.landmarks.getObjectByName(name));
  const lightTheaters=()=>theaters.forEach(model=>model?.userData.setLightingMode?.(city.mode));
  lightTheaters();
  const lightFiserv = () => {
    turnerHall?.userData.setLightingMode?.(city.mode);
    fiserv?.userData.setLightingMode?.(city.mode);
    deerDistrict?.userData.setLightingMode?.(city.mode);
    districtBuildings?.userData.setLightingMode?.(city.mode);
  };
  lightFiserv();
  const labelElements = new Map<string, HTMLElement>();
  let selectedLabelId: string | undefined;
  const focusLabels = (id?: string) => {
    selectedLabelId = id;
    for (const [key, element] of labelElements) element.hidden = id !== undefined && key !== id;
  };
  const showLandmark = (l: Landmark) => {
    hop?.close();
    focusLabels(l.id); panelTitle.textContent = l.name; panelBody.textContent = l.blurb;
    panelOsm.href = `https://www.openstreetmap.org/${l.osm}`; panel.hidden = false;
    roofControl.hidden=l.id!=='amfam';syncRoofControl();
    landmarkButtons.forEach((button, id) => button.setAttribute('aria-current', String(id === l.id)));
    closeDrawer();
  };
  for (const l of LANDMARKS) {
    const p = locate(l);
    const label = makeLabel(l, p.x, p.y + l.labelHeight, p.z, lm => {
      director.stopTour(); syncTourBtn(); director.flyToLandmark(lm); showLandmark(lm);
    });
    labelElements.set(l.id, label.element); city.landmarks.add(label);
  }

  // initial framing: downtown + lakefront from the south-east over the lake
  const home = { pos: new THREE.Vector3(1900, 820, 1500), target: new THREE.Vector3(250, 30, -350) };
  city.camera.position.copy(home.pos); city.controls.target.copy(home.target);
  const b = manifest.bounds; const clamp = () => { const t = city.controls.target; t.x = THREE.MathUtils.clamp(t.x, b.x0, b.x1); t.z = THREE.MathUtils.clamp(t.z, b.z0, b.z1); };

  // A geographic circuit keeps the tour from repeatedly crossing the city.
  const tourOrder = ['usbank', 'couture', 'mam', 'warmemorial', 'nm', 'lighthouse', 'fiserv', 'turnerhall', 'newmuseum', 'cityhall', 'marcus', 'peck', 'saintkate', 'pabst', 'bmo', 'riverside', 'market', 'thirdward', 'marquette', 'rave', 'domes', 'amfam', 'basilica', 'hoan', 'port', 'summerfest', 'discovery'];
  const tourStops = [...LANDMARKS].sort((a, b) => {
    const rank = (id: string) => { const i = tourOrder.indexOf(id); return i < 0 ? tourOrder.length : i; };
    return rank(a.id) - rank(b.id);
  });
  const director = new Director(city.camera, city.controls, tourStops, locate, reduceMotion,
    { groundAt, exaggeration: () => city.exaggeration });
  const tiles = new TileManager(manifest, city.tiles, { building: city.mats.building, road: city.mats.road }, DATA,
    mobile ? 1800 : 3200, mobile ? 7000 : 16000, mobile ? 4 : 6);
  const signs = new BuildingSigns(BUILDING_SIGNS, manifest.tileSize, `${import.meta.env.BASE_URL}signs`);
  signs.setMode(city.mode);
  tiles.onTileReady = (group, tile, lod) => { adaptSummerfestTile(group,tile,groundAt,rawTerrainData!,terrainData!); removePortPlaceholders(group,tile); detailJonesIslandBuildings(group,tile); removeMuseumPlaceholder(group, tile); removeDiscoveryPlaceholder(group, tile); removePublicMarketPlaceholder(group, tile); removeCityHallPlaceholder(group, tile); removeDomesPlaceholder(group, tile); removeAmFamPlaceholder(group, tile); removeCouturePlaceholder(group, tile); removeNmPlaceholder(group, tile); removeUsBankPlaceholder(group, tile); removeFiservPlaceholder(group, tile); removeDeerDistrictBuildingPlaceholders(group, tile); removeTurnerHallPlaceholder(group, tile); removeTheaterPlaceholders(group, tile); removeMarcusPlaceholders(group, tile); removeSaintKatePlaceholder(group, tile); removeRavePlaceholder(group, tile); adaptHopPassages(group, tile); adaptLighthouseTile(group, tile, terrainData!, groundAt); adaptHoanContextTile(group, tile, rawTerrainData!, groundAt); signs.attach(group, tile, lod); };
  let firstLoad = true;
  tiles.onProgress = (done, total) => {
    const pct = total ? Math.round(100 * done / total) : 100; bar.style.width = `${pct}%`;
    loadText.textContent = `Building the city… ${pct}%`;
    if (firstLoad && (pct >= 100 || (done >= 6 && pct >= 40))) { firstLoad = false; loading.classList.add('fade'); setTimeout(() => { loading.hidden = true; }, 600); }
    $('#tilecount').textContent = `${tiles.loadedCount} tiles`;
  };
  tiles.onError = showError;
  const refocus = () => { clamp(); tiles.update(city.controls.target.x, city.controls.target.z); };
  refocus();
  director.onFlightStart = (t) => tiles.update(t.x, t.z);   // prefetch the destination while flying
  let settle: number | undefined; city.controls.addEventListener('change', () => { clearTimeout(settle); settle = setTimeout(refocus, 250); });
  let driving: ReturnType<typeof createDrivingMode> | undefined;
  let walking: ReturnType<typeof createWalkingMode> | undefined;
  const interruptNavigation = () => {
    if(driving?.active||walking?.active)return;
    if (director.tour.active) {
      if (!director.tour.paused) director.togglePause();
      syncTourBtn();
    } else director.cancelFlight();
  };
  city.controls.addEventListener('start', interruptNavigation);
  // Keep keyboard navigation local to the focused map, away from search and selects.
  canvas.addEventListener('keydown', event => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) interruptNavigation();
  });
  city.controls.listenToKeyEvents(canvas);
  canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));

  const panButton = $<HTMLButtonElement>('#pan-control');
  panButton.addEventListener('click', () => {
    const pan = panButton.getAttribute('aria-pressed') !== 'true';
    panButton.setAttribute('aria-pressed', String(pan));
    panButton.title = pan ? 'Drag to pan. Turn Pan off to rotate.' : 'Enable drag to pan. Arrow keys also pan when the map is focused.';
    canvas.dataset.navigation = pan ? 'pan' : 'rotate';
    city.controls.mouseButtons.LEFT = pan ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
    city.controls.mouseButtons.RIGHT = pan ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
    city.controls.touches.ONE = pan ? THREE.TOUCH.PAN : THREE.TOUCH.ROTATE;
    canvas.focus({ preventScroll: true });
  });

  // UI wiring
  document.querySelectorAll<HTMLButtonElement>('button[data-mode]').forEach(btn => btn.addEventListener('click', () => {
    city.setMode(btn.dataset.mode as Mode); streetLighting.setMode(city.mode); signs.setMode(city.mode); lightMuseum(); lightSummerfest(); lightNewMuseum(); lightDiscovery(); lightMarket(); lightHoan(); lightPort(); lightDomes(); lightAmFam(); lightLighthouse(); lightCouture(); lightNM(); lightUsBank(); lightFiserv(); lightTheaters();
    hop?.setMode(city.mode);
    document.querySelectorAll('button[data-mode]').forEach(x => x.setAttribute('aria-pressed', String(x === btn))); }));
  document.querySelectorAll<HTMLButtonElement>('button[data-tour-speed]').forEach(btn => btn.addEventListener('click', () => {
    director.setSpeed(Number(btn.dataset.tourSpeed)); document.querySelectorAll('button[data-tour-speed]').forEach(x => x.setAttribute('aria-pressed', String(x === btn))); }));
  $('#reset').addEventListener('click', () => { director.stopTour(); syncTourBtn(); director.flyTo(home.pos, home.target, 2); panel.hidden = true; focusLabels(); landmarkButtons.forEach(b => b.setAttribute('aria-current', 'false')); });
  for (const l of LANDMARKS) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'landmark-button';
    button.setAttribute('aria-current', 'false'); button.innerHTML = `<span class="landmark-name"></span>`; button.querySelector('.landmark-name')!.textContent = l.name;
    button.addEventListener('click', () => { director.stopTour(); syncTourBtn(); director.flyToLandmark(l); showLandmark(l); });
    landmarkButtons.set(l.id, button); landmarkList.append(button);
  }
  const filterLandmarks = () => {
    const query = landmarkSearch.value.trim().toLocaleLowerCase(); let visible = 0;
    for (const l of LANDMARKS) { const match = l.name.toLocaleLowerCase().includes(query); landmarkButtons.get(l.id)!.hidden = !match; if (match) visible++; }
    $('#landmark-count').textContent = `${visible}/${LANDMARKS.length}`; $('#landmark-empty').hidden = visible !== 0;
  };
  landmarkSearch.addEventListener('input', filterLandmarks); filterLandmarks();
  const syncTourBtn = () => {
    if (tourType.value !== 'landmarks') {
      const ride = hop?.tour, active = ride?.active ?? false, paused = ride?.paused ?? false;
      tourLabel.textContent = active ? paused ? 'Resume ride' : 'Pause ride' : 'Start ride';
      tourBtn.setAttribute('aria-pressed', String(active && !paused)); tourStop.disabled = !active;
      tourBtn.disabled = !hop;
      tourStatus.textContent = active ? `${paused ? 'Paused' : 'Riding'} · ${ride!.label} · scheduled preview` : 'Follow a streetcar along its route';
      return;
    }
    tourBtn.disabled = false;
    const t = director.tour; tourLabel.textContent = !t.active ? 'Start tour' : t.paused ? 'Resume tour' : 'Pause tour';
    tourBtn.setAttribute('aria-pressed', String(t.active && !t.paused)); tourStop.disabled = !t.active;
    if (!t.active) tourStatus.textContent = `Tour ready · ${tourStops.length} stops`;
    else if (t.paused) tourStatus.textContent = `Paused · stop ${t.index + 1} of ${tourStops.length}`;
  };
  tourType.addEventListener('change', () => { hop?.tour.stop(); director.stopTour(); syncTourBtn(); });
  tourBtn.addEventListener('click', () => {
    if (tourType.value !== 'landmarks') {
      if (hop?.tour.active) hop.tour.togglePause();
      else if (hop && !hop.startTour(tourType.value)) { tourStatus.textContent = 'No streetcar available on this line in the preview.'; return; }
    } else { hop?.tour.stop(); if (!director.tour.active) director.startTour(); else director.togglePause(); }
    syncTourBtn();
  });
  tourStop.addEventListener('click', () => { hop?.tour.stop(); director.stopTour(); syncTourBtn(); });
  director.onTourStep = (l) => { if (l) { showLandmark(l); tourStatus.textContent = `Touring ${l.name} · ${director.tour.index + 1} of ${tourStops.length}`; } else { panel.hidden = true; focusLabels(); landmarkButtons.forEach(b => b.setAttribute('aria-current', 'false')); } };
  $('#panel-close').addEventListener('click', () => { panel.hidden = true; focusLabels(); landmarkButtons.forEach(b => b.setAttribute('aria-current', 'false')); });
  $('#about-btn').addEventListener('click', () => { fillAbout(manifest); about.showModal(); });
  $('#about-close').addEventListener('click', () => about.close());
  about.addEventListener('click', e => { if (e.target === about) about.close(); });
  const isDrawerLayout = () => matchMedia('(max-width: 760px)').matches;
  const syncDrawerToggle = (open: boolean) => {
    drawerToggle.setAttribute('aria-label', open ? 'Close landmarks' : 'Landmarks');
    drawerToggle.querySelector('span')!.textContent = open ? 'Close landmarks' : 'Landmarks';
    drawerToggle.querySelector('path')!.setAttribute('d', open ? 'm7 7 10 10M17 7 7 17' : 'M4 6h16M4 12h16M4 18h16');
  };
  const closeDrawer = (returnFocus = false) => {
    const wasOpen = document.body.classList.contains('drawer-open'); document.body.classList.remove('drawer-open');
    drawerToggle.setAttribute('aria-expanded', 'false'); syncDrawerToggle(false); if (isDrawerLayout()) destinationBoard.inert = true;
    if (returnFocus && wasOpen) drawerToggle.focus();
  };
  const syncDrawerLayout = () => { destinationBoard.inert = isDrawerLayout() && !document.body.classList.contains('drawer-open'); };
  syncDrawerLayout(); addEventListener('resize', syncDrawerLayout);
  drawerToggle.addEventListener('click', () => {
    const open = !document.body.classList.contains('drawer-open');
    if (!open) { closeDrawer(true); return; }
    document.body.classList.add('drawer-open'); destinationBoard.inert = false; drawerToggle.setAttribute('aria-expanded', 'true'); syncDrawerToggle(true); landmarkSearch.focus();
  });
  document.addEventListener('pointerdown', e => { if (document.body.classList.contains('drawer-open') && !destinationBoard.contains(e.target as Node) && !drawerToggle.contains(e.target as Node)) closeDrawer(true); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') { panel.hidden = true; focusLabels(); closeDrawer(true); } if (!driving?.active && !walking?.active && e.key === ' ' && document.activeElement === document.body) { e.preventDefault(); tourBtn.click(); } });
  syncTourBtn();
  void loadHop({ city, director, dataUrl: `${DATA}/hop/network.json`, reducedMotion: reduceMotion,
    onFocus: (dismissDrawer) => { panel.hidden = true; focusLabels('__hop__'); syncTourBtn(); landmarkButtons.forEach(b => b.setAttribute('aria-current', 'false')); if (dismissDrawer) closeDrawer(); }
  }).then(feature => { hop = feature; if (hop) tourType.querySelectorAll<HTMLOptionElement>('option').forEach(option => { option.disabled = false; }); syncTourBtn(); }).catch(() => {
    $('#hop-status').textContent = 'Streetcar preview unavailable. Reload to try again.';
    $<HTMLButtonElement>('#hop-toggle').disabled = true;
  });
  driving=createDrivingMode({city,canvas,
    onEnter(){walking?.stop();hop?.close();director.stopTour();syncTourBtn();panel.hidden=true;closeDrawer();},
    onExit(){syncDrawerLayout();refocus();},
    prefetch(x,z){tiles.update(x,z);}
  });
  // Start beside landmarks, then let the walking world's dry-ground and
  // collision checks find the nearest supported foot position.
  const walkOffsets:Record<string,[number,number]>={
    rave:[0,-61],saintkate:[-12,-43],marcus:[72,-8],peck:[30,15],pabst:[10,30],riverside:[7,36],turnerhall:[-32,0],fiserv:[132,15],thirdward:[20,20],market:[-35,25],mam:[-65,50],
    newmuseum:[-45,40],amfam:[-155,-130],usbank:[-70,50],couture:[-45,45],
    nm:[-60,60],warmemorial:[-45,0],discovery:[-65,0],lighthouse:[20,25],
  };
  const walkPlaces=LANDMARKS.map(landmark=>{
    const p=locate(landmark),angle=landmark.view[1]*Math.PI/180;
    const distance=Math.max(35,Math.min(160,landmark.view[0]*.32));
    const [dx,dz]=walkOffsets[landmark.id]??[Math.sin(angle)*distance,-Math.cos(angle)*distance];
    return{id:landmark.id,name:landmark.name,x:p.x+dx,z:p.z+dz,lookX:p.x,lookZ:p.z};
  });
  walking=createWalkingMode({city,canvas,places:walkPlaces,
    preferredPlace:()=>selectedLabelId,
    onEnter(){driving?.stop();hop?.close();director.stopTour();director.cancelFlight();syncTourBtn();panel.hidden=true;closeDrawer();},
    onExit(){syncDrawerLayout();refocus();},
    prefetch(x,z){tiles.update(x,z);},
    setLighting(mode){document.querySelector<HTMLButtonElement>(`button[data-mode="${mode}"]`)?.click();},
  });
  $('#landmark-walk').addEventListener('click',()=>walking?.start(selectedLabelId));
  import.meta.hot?.dispose(() => {hop?.dispose();driving?.dispose();walking?.dispose();streetLighting.dispose();});
  (window as unknown as { __MKE3D_STATE__: object }).__MKE3D_STATE__ = { city, director, landmarks: LANDMARKS, landmarkButtons, streetLighting };

  // render loop
  const clock = new THREE.Clock();
  let lastFlightTiles = 0;
  let lastRideState = '';
  let lastCollisionCheck = 0;
  const lastTileFocus = city.controls.target.clone();
  const labelPriority = new Map(['usbank', 'mam', 'cityhall', 'fiserv', 'bmo', 'hoan', 'domes'].map((id, index) => [id, index]));
  const resolveLabelCollisions = () => {
    const entries = [...labelElements].filter(([, element]) => !element.hidden);
    for (const [, element] of entries) element.style.visibility = '';
    entries.sort(([a], [b]) => (a === selectedLabelId ? -1 : b === selectedLabelId ? 1 : (labelPriority.get(a) ?? 100) - (labelPriority.get(b) ?? 100) || a.localeCompare(b)));
    const accepted: DOMRect[] = [];
    for (const [, element] of entries) {
      const rect = element.getBoundingClientRect(); if (!rect.width || !rect.height) continue;
      const overlaps = accepted.some(other => rect.left < other.right + 6 && rect.right + 6 > other.left && rect.top < other.bottom + 4 && rect.bottom + 4 > other.top);
      element.style.visibility = overlaps ? 'hidden' : 'visible'; if (!overlaps) accepted.push(rect);
    }
  };
  const loop = () => {
    const dt = clock.getDelta(), now = performance.now();
    hoan?.userData.updateLighting?.(now / 1000, reduceMotion);
    hop?.update(dt);
    if(!driving?.active&&!walking?.active)director.update(now);
    driving?.update(dt);
    walking?.update(dt);
    const rideState = `${tourType.value}:${hop?.tour.active}:${hop?.tour.paused}:${hop?.tour.label}`;
    if (rideState !== lastRideState) { lastRideState = rideState; syncTourBtn(); }
    // Flights now take time: stream the neighborhoods along the route too.
    if (director.isAnimating && now - lastFlightTiles > 1000 && lastTileFocus.distanceTo(city.controls.target) > 350) {
      refocus(); lastTileFocus.copy(city.controls.target); lastFlightTiles = now;
    }
    streetLighting.update(city.camera.position);
    city.render(dt, !!driving?.active || !!walking?.active || director.isAnimating);
    if (now - lastCollisionCheck >= 100) { resolveLabelCollisions(); lastCollisionCheck = now; }
    requestAnimationFrame(loop);
  };
  city.resize(); addEventListener('resize', () => city.resize()); loop();
}

function fillAbout(m: Manifest) {
  const s = m.stats; const hs = s.height_source;
  $('#about-stats').innerHTML = `<tr><td>Buildings rendered</td><td>${s.buildings.toLocaleString()} (${s.buildings_in_city_limits.toLocaleString()} inside city limits)</td></tr>` +
    Object.entries(hs).map(([k, v]) => `<tr><td>Height from ${k === 'height' ? 'OSM height tag' : k === 'levels' ? 'OSM floor count' : k === 'landmark' ? 'interpretive model' : 'documented estimate'}</td><td>${v.count.toLocaleString()} (${v.pct}%)</td></tr>`).join('') +
    `<tr><td>Street light fixtures</td><td>${STREET_LIGHT_SITES.length.toLocaleString()}</td></tr><tr><td>Data generated</td><td>${s.generated}</td></tr><tr><td>Lake polygon</td><td>${s.lake_area_km2 ?? '—'} km²</td></tr>`;
}

boot();
