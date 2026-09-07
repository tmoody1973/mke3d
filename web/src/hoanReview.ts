// Development-only study: the production factory at unexaggerated physical scale.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildHoan } from './hoan';

const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('canvas')!, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfd9dc);
const camera = new THREE.PerspectiveCamera(42, 1, .1, 6000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
const sky = new THREE.HemisphereLight(0xcfe0ee, 0xd8cfbf, 1.1);
const sun = new THREE.DirectionalLight(0xfff4e0, 2.6);
sun.position.set(-70, 180, 120); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -220, right: 220, top: 140, bottom: -140, near: 1, far: 600 });
sun.shadow.normalBias = .08; scene.add(sky, sun);
const data = await (await fetch('/data/landmarks_geo.json')).json();
const bridge = buildHoan(data.hoan, () => 2);
const a = new THREE.Vector3(...bridge.userData.mainSpanStart);
const b = new THREE.Vector3(...bridge.userData.mainSpanEnd);
const center = a.clone().add(b).multiplyScalar(.5).setY(0);
const axis = b.clone().sub(a).normalize();
bridge.position.copy(center).negate();
const study = new THREE.Group();
study.rotation.y = Math.atan2(axis.z, axis.x);
study.add(bridge); scene.add(study);
const surface = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ color: 0x467984, roughness: .65 }));
surface.rotation.x = -Math.PI / 2; surface.position.y = 1.8; surface.receiveShadow = true; scene.add(surface);
const views: Record<string, { eye: [number, number, number]; target: [number, number, number] }> = {
  profile: { eye: [0, 22, 410], target: [0, 29, 0] },
  waterfront: { eye: [-135, 14, 235], target: [0, 29, 0] },
  underside: { eye: [-135, 7, 43], target: [35, 24, 0] },
  roadway: { eye: [-78, 41, 7], target: [85, 44, 4] },
  approach: { eye: [245, 9, 65], target: [185, 16, 0] },
};
function view(key: string) { camera.position.set(...views[key].eye); controls.target.set(...views[key].target); controls.update(); }
view('profile');
document.querySelectorAll<HTMLButtonElement>('[data-angle]').forEach(button => button.onclick = () => {
  document.querySelectorAll('[data-angle]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
  view(button.dataset.angle!);
});
document.querySelector('select')!.onchange = event => {
  const mode = (event.target as HTMLSelectElement).value.toLowerCase();
  bridge.userData.setLightingMode(mode);
  const night = mode === 'night', sunset = mode === 'sunset';
  sky.intensity = night ? .25 : 1.1; sun.intensity = night ? .14 : 2.6;
  sun.position.set(-70, sunset ? 38 : 180, 120);
  sun.color.setHex(sunset ? 0xffb574 : night ? 0xbccded : 0xfff4e0);
  scene.background = new THREE.Color(night ? 0x152330 : sunset ? 0xaaa1a0 : 0xcfd9dc);
};
function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
renderer.setAnimationLoop(time => { bridge.userData.updateLighting(time/1000,reducedMotion); controls.update(); renderer.render(scene, camera); });
if (import.meta.hot) import.meta.hot.dispose(() => { renderer.setAnimationLoop(null); controls.dispose(); renderer.dispose(); });
