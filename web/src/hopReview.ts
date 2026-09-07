// Development review page: uses the same vehicle factory as the city.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createHopVehicle, type HopVehicleMode } from './hopVehicle';

const renderer = new THREE.WebGLRenderer({ canvas: document.querySelector('canvas')!, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfd9dc);
const camera = new THREE.PerspectiveCamera(36, 1, .1, 250);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.6, 0);
controls.enableDamping = true;
const sky = new THREE.HemisphereLight(0xcfe0ee, 0xd8cfbf, 1.1);
const sun = new THREE.DirectionalLight(0xfff4e0, 2.6);
sun.position.set(-15, 25, 15); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 18, bottom: -18, near: 1, far: 70 });
sun.shadow.normalBias = .025;
scene.add(sky, sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.MeshStandardMaterial({color:0xaeb6b6,roughness:1}));
ground.rotation.x = -Math.PI/2; ground.position.y = -.025; ground.receiveShadow = true; scene.add(ground);
const car = createHopVehicle('M-Line'); scene.add(car.group);
for(const x of [-.7175,.7175]){
 const rail = new THREE.Mesh(new THREE.BoxGeometry(.055,.04,44),new THREE.MeshStandardMaterial({color:0x666e70,metalness:.65,roughness:.4}));
 rail.position.set(x,-.02,0);scene.add(rail);
}
const angles:Record<string,[number,number,number]>={quarter:[20,6,22],side:[25,3.2,0],front:[0,3,19],roof:[17,22,18]};
function view(angle:string){camera.position.set(...angles[angle]);controls.target.set(0,1.6,0);controls.update();}
view('quarter');
document.querySelectorAll<HTMLButtonElement>('[data-angle]').forEach(button=>button.onclick=()=>{
 document.querySelectorAll('[data-angle]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
 view(button.dataset.angle!);
});
let doorsOpen=false;
document.querySelector<HTMLButtonElement>('#doors')!.onclick=()=>{
 doorsOpen=!doorsOpen; car.setDoors(Number(doorsOpen),'left');car.setDoors(Number(doorsOpen),'right');
 const button=document.querySelector<HTMLButtonElement>('#doors')!;button.textContent=doorsOpen?'Close doors':'Open doors';button.setAttribute('aria-pressed',String(doorsOpen));
};
document.querySelector('select')!.onchange=event=>{
 const mode=(event.target as HTMLSelectElement).value.toLowerCase() as HopVehicleMode;car.setMode(mode);
 const night=mode==='night',sunset=mode==='sunset';
 sky.intensity=night?.5:1.1;sun.intensity=night?.18:sunset?2:2.6;
 sun.color.setHex(sunset?0xffb574:night?0xbccded:0xfff6e6);
 scene.background=new THREE.Color(night?0x152330:sunset?0xaaa1a0:0xcfd9dc);
};
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
if(import.meta.hot)import.meta.hot.dispose(()=>{renderer.setAnimationLoop(null);controls.dispose();car.dispose();renderer.dispose();});
