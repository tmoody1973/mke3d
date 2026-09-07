// Development-only photographic-angle review using the production model factory.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildFiserv } from './fiserv';
import { buildDeerDistrict } from './deerDistrict';
import { buildDeerDistrictBuildings } from './deerDistrictBuildings';
import { FISERV_SITE as site } from './fiservSite';
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas')!,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xcfd9dc);
const camera=new THREE.PerspectiveCamera(42,1,.15,1500);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
const sky=new THREE.HemisphereLight(0xcfe0ee,0xd8cfbf,1.1);
const sun=new THREE.DirectionalLight(0xfff4e0,2.6);sun.position.set(100,240,90);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-140,right:140,top:140,bottom:-140,near:1,far:550});sun.shadow.normalBias=.08;scene.add(sky,sun);
const model=buildFiserv(()=>site.floor);model.position.x=0;model.position.z=0;scene.add(model);
const district=buildDeerDistrict(()=>site.floor),buildings=buildDeerDistrictBuildings(()=>site.floor);
for(const part of [district,buildings]){part.position.set(-site.x,0,-site.z);scene.add(part);}
const ground=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),new THREE.MeshStandardMaterial({color:0xb8bfbc,roughness:1}));
ground.rotation.x=-Math.PI/2;ground.position.y=site.floor-.01;ground.receiveShadow=true;scene.add(ground);
const views:Record<string,{eye:[number,number,number],target:[number,number,number]}>= {
 district:{eye:[310,160,235],target:[70,13,-5]},
 plaza:{eye:[100,8,85],target:[145,9,-25]},
 garden:{eye:[140,7,-1.8],target:[208,7,-1.8]},
 east:{eye:[240,85,-180],target:[0,18,0]},commons:{eye:[210,12,-75],target:[35,20,0]},
 crown:{eye:[-145,105,-185],target:[0,18,0]},
 sign:{eye:[134,36,59],target:[79,32.4,33]},
 street:{eye:[170,65,185],target:[0,17,0]},
};
function view(key:string){camera.position.set(...views[key].eye);controls.target.set(...views[key].target);controls.update();}
view('district');
document.querySelectorAll<HTMLButtonElement>('[data-angle]').forEach(button=>button.onclick=()=>{
 document.querySelectorAll('[data-angle]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));view(button.dataset.angle!);
});
document.querySelector('select')!.onchange=event=>{
 const mode=(event.target as HTMLSelectElement).value.toLowerCase();model.userData.setLightingMode(mode);district.userData.setLightingMode(mode);buildings.userData.setLightingMode(mode);
 const night=mode==='night',sunset=mode==='sunset';sky.intensity=night?.25:1.1;sun.intensity=night?.14:2.6;
 sun.color.setHex(sunset?0xffb574:night?0xbccded:0xfff4e0);scene.background=new THREE.Color(night?0x152330:sunset?0xaaa1a0:0xcfd9dc);
};
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}
addEventListener('resize',resize);resize();renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
if(import.meta.hot)import.meta.hot.dispose(()=>{renderer.setAnimationLoop(null);controls.dispose();renderer.dispose();});
