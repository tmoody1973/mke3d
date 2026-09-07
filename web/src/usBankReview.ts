// Development-only photographic-angle review using the production model factory.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildUsBankCampus } from './usBankCampus';
import { US_BANK_SITE as site } from './usBankSite';
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas')!,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xcfd9dc);
const camera=new THREE.PerspectiveCamera(42,1,1,1500);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
const sky=new THREE.HemisphereLight(0xcfe0ee,0xd8cfbf,1.1);
const sun=new THREE.DirectionalLight(0xfff4e0,2.6);sun.position.set(100,240,90);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-140,right:140,top:140,bottom:-140,near:1,far:550});sun.shadow.normalBias=.08;scene.add(sky,sun);
const groundAt=(_x:number,z:number)=>site.floor+Math.max(-2,Math.min(3,(site.z-z)*.05));
const model=buildUsBankCampus(groundAt);model.position.x=0;model.position.z=0;scene.add(model);
const groundGeometry=new THREE.PlaneGeometry(2000,2000,200,200);groundGeometry.rotateX(-Math.PI/2);
const groundPositions=groundGeometry.getAttribute('position');
for(let i=0;i<groundPositions.count;i++)groundPositions.setY(i,groundAt(groundPositions.getX(i)+site.x,groundPositions.getZ(i)+site.z)-.01);
groundGeometry.computeVertexNormals();
const ground=new THREE.Mesh(groundGeometry,new THREE.MeshStandardMaterial({color:0xb8bfbc,roughness:1}));
ground.receiveShadow=true;scene.add(ground);
const views:Record<string,{eye:[number,number,number],target:[number,number,number]}>= {
 east:{eye:[215,150,-260],target:[0,92,0]},commons:{eye:[90,32,-120],target:[0,16,-30]},
 crown:{eye:[95,215,-100],target:[0,179,0]},
 street:{eye:[-70,site.floor+3,-110],target:[0,88,0]},
 passage:{eye:[90,8,52],target:[0,8,61]},
 passageAerial:{eye:[105,40,100],target:[0,12,60]},
};
function view(key:string){camera.position.set(...views[key].eye);controls.target.set(...views[key].target);controls.update();}
view('east');
document.querySelectorAll<HTMLButtonElement>('[data-angle]').forEach(button=>button.onclick=()=>{
 document.querySelectorAll('[data-angle]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));view(button.dataset.angle!);
});
document.querySelector('select')!.onchange=event=>{
 const mode=(event.target as HTMLSelectElement).value.toLowerCase();model.userData.setLightingMode(mode);
 const night=mode==='night',sunset=mode==='sunset';sky.intensity=night?.25:1.1;sun.intensity=night?.14:2.6;
 sun.color.setHex(sunset?0xffb574:night?0xbccded:0xfff4e0);scene.background=new THREE.Color(night?0x152330:sunset?0xaaa1a0:0xcfd9dc);
};
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
if(import.meta.hot)import.meta.hot.dispose(()=>{renderer.setAnimationLoop(null);controls.dispose();renderer.dispose();});
