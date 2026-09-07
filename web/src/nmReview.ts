// Development-only photographic-angle review using the production model factory.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildNM } from './nmCampus';
import { NM_SITE as site } from './nmSite';
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas')!,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xcfd9dc);
const camera=new THREE.PerspectiveCamera(42,1,.15,1500);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
const sky=new THREE.HemisphereLight(0xcfe0ee,0xd8cfbf,1.1);
const sun=new THREE.DirectionalLight(0xfff4e0,2.6);sun.position.set(100,240,90);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-140,right:140,top:140,bottom:-140,near:1,far:550});sun.shadow.normalBias=.08;scene.add(sky,sun);
const model=buildNM(()=>site.floor);model.position.x=0;model.position.z=0;scene.add(model);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),new THREE.MeshStandardMaterial({color:0xb8bfbc,roughness:1}));
ground.rotation.x=-Math.PI/2;ground.position.y=site.floor-.01;ground.receiveShadow=true;scene.add(ground);
const views:Record<string,{eye:[number,number,number],target:[number,number,number]}>= {
 east:{eye:[245,125,165],target:[-25,95,0]},commons:{eye:[-170,75,165],target:[-100,32,0]},
 crown:{eye:[150,225,100],target:[0,165,0]},
 street:{eye:[100,site.floor+7,100],target:[0,75,0]},
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
