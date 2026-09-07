import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import type { TerrainData, Section } from './loader';
import { sectionToGeometry } from './loader';
import { createAtmosphere, type SkyPalette } from './atmosphere';
import { patchNightWindows } from './windowLighting';
import { cutGeometry, type Bounds } from './localTerrain';

export type Mode = 'day' | 'sunset' | 'night';

interface ModeSpec extends SkyPalette {
  fog: number; sun: number; sunI: number; hemiSky: number; hemiGround: number;
  hemiI: number; sunDir: [number, number, number]; night: number; water: number; exposure: number;
}
const MODES: Record<Mode, ModeSpec> = {
  day: {
    zenith: 0x77a8d0, horizon: 0xdfe9ef, west: 0xeef0e9, glow: 0.15,
    fog: 0xdfe9ef, sun: 0xfff4e0, sunI: 2.6, hemiSky: 0xcfe0ee, hemiGround: 0xd8cfbf,
    hemiI: 1.1, sunDir: [0.55, 0.9, 0.35], night: 0, water: 0x2e6f8e, exposure: 1.0,
  },
  sunset: {
    zenith: 0x526e9b, horizon: 0xb6aab0, west: 0xf6b376, glow: 0.9,
    fog: 0xb6aab0, sun: 0xffb46f, sunI: 1.65, hemiSky: 0x889dc1, hemiGround: 0x867163,
    hemiI: 0.85, sunDir: [-1, 0.12, 0.12], night: 0.1, water: 0x304756, exposure: 0.95,
  },
  night: {
    zenith: 0x060d1b, horizon: 0x202936, west: 0x49413c, glow: 0.35,
    fog: 0x202936, sun: 0xc2d0e3, sunI: 0.22, hemiSky: 0x70809b, hemiGround: 0x393438,
    hemiI: 0.4, sunDir: [-0.3, 0.8, -0.5], night: 1, water: 0x101c29, exposure: 0.85,
  },
};

export interface City {
  renderer: THREE.WebGLRenderer; labelRenderer: CSS2DRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls;
  city: THREE.Group; tiles: THREE.Group; landmarks: THREE.Group;
  mats: { building: THREE.MeshLambertMaterial; road: THREE.MeshLambertMaterial; water: THREE.MeshPhongMaterial; terrain: THREE.MeshLambertMaterial };
  setMode(m: Mode): void; setExaggeration(k: number): void; addTerrain(t: TerrainData, hole?: Bounds): void; addWater(s: Section[]): void;
  resize(): void; render(dt: number, directed?: boolean): void; mode: Mode; exaggeration: number; mobile: boolean;
}

export function createCity(canvas: HTMLCanvasElement, labelsEl: HTMLElement, mobile: boolean): City {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
  renderer.shadowMap.enabled = !mobile; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace;
  const labelRenderer = new CSS2DRenderer({ element: labelsEl });

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(48, 1, 4, 80000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.screenSpacePanning = false;
  controls.maxPolarAngle = Math.PI * 0.47; controls.minDistance = 60; controls.maxDistance = 30000; controls.zoomSpeed = 1.1;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

  const city = new THREE.Group(); const tiles = new THREE.Group(); const landmarks = new THREE.Group();
  city.add(tiles, landmarks); scene.add(city);

  const uniforms = { uNight: { value: 0 } };
  const building = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x000000 }); patchNightWindows(building, uniforms);
  const road = new THREE.MeshLambertMaterial({ color: 0xbfc2c5, vertexColors: true, emissive: 0x000000 });
  const water = new THREE.MeshPhongMaterial({ color: MODES.day.water, shininess: 55, specular: 0x627786, vertexColors: false });
  const terrain = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mats = { building, road, water, terrain };

  const hemi = new THREE.HemisphereLight(0xcfe0ee, 0xd8cfbf, 1.1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.6); scene.add(sun); scene.add(sun.target);
  if (!mobile) {
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0008; sun.shadow.normalBias = 1.5;
    const c = sun.shadow.camera; c.near = 100; c.far = 12000; c.left = -2200; c.right = 2200; c.top = 2200; c.bottom = -2200;
  }
  scene.fog = new THREE.Fog(MODES.day.fog, 6000, 26000); scene.background = new THREE.Color(MODES.day.horizon);
  const atmosphere = createAtmosphere(scene, water);

  // ground far beyond the terrain so the horizon never shows the void
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200000, 200000), new THREE.MeshLambertMaterial({ color: 0xe3ded1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -6; ground.receiveShadow = true; city.add(ground);

  const api: City = {
    renderer, labelRenderer, scene, camera, controls, city, tiles, landmarks, mats, mode: 'day', exaggeration: 1, mobile,
    setMode(m) {
      const s = MODES[m]; api.mode = m;
      atmosphere.setPalette(s);
      (scene.background as THREE.Color).set(s.horizon); (scene.fog as THREE.Fog).color.set(s.fog);
      sun.color.set(s.sun); sun.intensity = s.sunI; hemi.color.set(s.hemiSky); hemi.groundColor.set(s.hemiGround); hemi.intensity = s.hemiI;
      sunDir.set(...s.sunDir).normalize(); uniforms.uNight.value = s.night;
      water.color.set(s.water); water.emissive.set(0x000000);
      // Asphalt and unlit facades do not emit light. Windows supply the night accents.
      road.emissive.set(0x000000); building.emissive.set(0x000000);
      (ground.material as THREE.MeshLambertMaterial).color.set(0xe3ded1);
      renderer.toneMappingExposure = s.exposure;
      document.documentElement.dataset.mode = m;
    },
    setExaggeration(k) { api.exaggeration = k; city.scale.y = k; },
    addTerrain(t, hole) {
      let geo: THREE.BufferGeometry = new THREE.PlaneGeometry((t.nx - 1) * t.step, (t.ny - 1) * t.step, t.nx - 1, t.ny - 1);
      const pos = geo.attributes.position as THREE.BufferAttribute; const col = new Float32Array(t.nx * t.ny * 3);
      // PlaneGeometry rows go top (+y) to bottom; our grid rows go south (y0) to north. Map row r -> grid row (ny-1-r).
      for (let r = 0; r < t.ny; r++) for (let c = 0; c < t.nx; c++) {
        const gi = (t.ny - 1 - r) * t.nx + c, vi = r * t.nx + c;
        pos.setXYZ(vi, t.x0 + c * t.step, t.heights[gi], -(t.y0 + (t.ny - 1 - r) * t.step));
        col[vi * 3] = t.colors[gi * 3] / 255; col[vi * 3 + 1] = t.colors[gi * 3 + 1] / 255; col[vi * 3 + 2] = t.colors[gi * 3 + 2] / 255;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
      if (hole) { const original = geo; geo = cutGeometry(original, hole); original.dispose(); }
      const mesh = new THREE.Mesh(geo, terrain); mesh.name = 'TERRAIN'; mesh.receiveShadow = true; mesh.position.y = -0.6; city.add(mesh);
    },
    addWater(secs) {
      for (const s of secs) { const m = new THREE.Mesh(sectionToGeometry(s), water); m.name = 'WATER'; m.receiveShadow = true; m.renderOrder = 1; city.add(m); }
    },
    resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      renderer.setSize(w, h, false); labelRenderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    },
    render(dt, directed = false) {
      // The director owns the pose during a flight. Orbit damping must not move it again.
      if (directed) camera.lookAt(controls.target);
      else controls.update(dt);
      atmosphere.update(camera, dt);
      // Tighten the shadow coverage for close landmark views; retain city coverage at a distance.
      if (!mobile) {
        const extent = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target) * 1.25, 300, 4400);
        const shadowCamera = sun.shadow.camera;
        if (Math.abs(shadowCamera.right - extent) > 20) {
          shadowCamera.left = shadowCamera.bottom = -extent;
          shadowCamera.right = shadowCamera.top = extent;
          shadowCamera.updateProjectionMatrix();
        }
        sun.shadow.normalBias = Math.max(0.12, extent / 3000);
      }
      // Sun follows the focus so the shadow frustum stays over what you're looking at.
      sun.target.position.copy(controls.target); sun.position.copy(controls.target).addScaledVector(sunDir, 6000);
      renderer.render(scene, camera); labelRenderer.render(scene, camera);
    },
  };
  const sunDir = new THREE.Vector3(...MODES.day.sunDir).normalize();
  api.setMode('day');
  return api;
}
