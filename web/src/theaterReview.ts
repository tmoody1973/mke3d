import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildPabstTheater } from './pabstTheater';
import { buildRiversideTheater } from './riversideTheater';
import { PABST_SITE, RIVERSIDE_SITE } from './theaterSites';

const riverside=document.body.dataset.theater==='riverside',site=riverside?RIVERSIDE_SITE:PABST_SITE;
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas')!,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xc5d5de);
const camera=new THREE.PerspectiveCamera(43,1,.1,1500),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
const sky=new THREE.HemisphereLight(0xdaebff,0xb4a589,1.6),sun=new THREE.DirectionalLight(0xffeed8,3);
sun.position.set(45,100,80);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-80,right:80,top:80,bottom:-80,near:1,far:300});sun.shadow.normalBias=.035;scene.add(sky,sun);
const model=(riverside?buildRiversideTheater:buildPabstTheater)(()=>0),centered=new THREE.Group();
centered.position.set(-site.x,0,-site.z);centered.add(model);scene.add(centered);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),new THREE.MeshStandardMaterial({color:0xa1a29a,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.02;ground.receiveShadow=true;scene.add(ground);
type View={eye:[number,number,number];target:[number,number,number]};
const views:Record<string,View>=riverside?{
 front:{eye:[8,22,115],target:[6,21,2]},corner:{eye:[-76,35,95],target:[0,21,0]},side:{eye:[95,32,-15],target:[0,22,-6]},rear:{eye:[-20,38,-125],target:[0,20,-10]},roof:{eye:[60,95,95],target:[0,15,0]},street:{eye:[6.7,1.7,37],target:[6.7,3.6,21]},marquee:{eye:[-4,3.2,42],target:[6.7,3.5,21]},
}:{
 front:{eye:[32,16,90],target:[0,12,0]},corner:{eye:[73,25,72],target:[0,12,0]},side:{eye:[90,20,-20],target:[0,11,0]},rear:{eye:[-35,30,-85],target:[0,12,0]},roof:{eye:[50,72,75],target:[0,11,0]},street:{eye:[15,1.7,33],target:[8,10,12]},marquee:{eye:[25,5,37],target:[8,6,13]},
};
if(!riverside){
 scene.updateMatrixWorld(true);
 const target=new THREE.Vector3(18.68,14.3,16.28).applyMatrix4(model.matrixWorld);
 for(const [key,side] of [['signEast',1],['signWest',-1]] as const){
  const eye=new THREE.Vector3(18.68+side*12,14.7,22.28).applyMatrix4(model.matrixWorld);
  views[key]={eye:eye.toArray() as [number,number,number],target:target.toArray() as [number,number,number]};
 }
}
function view(key:string){camera.position.set(...views[key].eye);controls.target.set(...views[key].target);controls.update();}view('corner');
document.querySelectorAll<HTMLButtonElement>('[data-angle]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-angle]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));view(button.dataset.angle!);});
document.querySelector('select')!.onchange=event=>{
 const mode=(event.target as HTMLSelectElement).value.toLowerCase();model.userData.setLightingMode(mode);
 sky.intensity=mode==='night'?.28:1.6;sun.intensity=mode==='night'?.18:3;
 sun.color.setHex(mode==='sunset'?0xffad70:mode==='night'?0xcbdfff:0xffeed8);scene.background=new THREE.Color(mode==='night'?0x111c2e:mode==='sunset'?0xc3a9a0:0xc5d5de);
};
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
if(import.meta.hot)import.meta.hot.dispose(()=>{removeEventListener('resize',resize);renderer.setAnimationLoop(null);controls.dispose();scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});renderer.dispose();});
