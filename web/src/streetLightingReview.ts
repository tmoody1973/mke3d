import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {createStreetLighting, type StreetLightingSite} from './streetLighting';
const kinds:StreetLightingSite['kind'][]=['downtownMast','thirdWardHeritage','thirdWardRiverwalk','stadiumCampus','plazaEvent'];
const sites:StreetLightingSite[]=kinds.map((kind,i)=>({id:`preview-${i}`,x:(i-2)*18,y:0,z:0,heading:0,kind,district:'preview',pool:true,source:'derived-road',sourceId:0}));
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas')!,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xc5d5de);
const camera=new THREE.PerspectiveCamera(44,1,.1,1500),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
const sky=new THREE.HemisphereLight(0xdaebff,0xb4a589,1.6),sun=new THREE.DirectionalLight(0xffeed8,3);sun.position.set(30,70,-30);scene.add(sky,sun);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(300,180).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({color:0x696d70,roughness:.96}));floor.position.y=-.015;scene.add(floor);
const pavement=new THREE.Mesh(new THREE.BoxGeometry(130,.10,7),new THREE.MeshStandardMaterial({color:0xb6b6ad,roughness:1}));pavement.position.set(0,-.08,-1);scene.add(pavement);
const lighting=createStreetLighting(sites,()=>0);scene.add(lighting.root);
function view(value:string){if(value==='all'){camera.position.set(0,20,73);controls.target.set(0,5,0);}else{const i=Number(value),height=[9.5,5.7,1.05,14,6.8][i],distance=Math.max(7,height*2.1);camera.position.set(sites[i].x+distance*.5,height*.7,distance);controls.target.set(sites[i].x,height*.43,0);}controls.update();}
view('all');
document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-view]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));view(button.dataset.view!);});
document.querySelector('select')!.onchange=event=>{const mode=(event.target as HTMLSelectElement).value.toLowerCase() as 'day'|'sunset'|'night';lighting.setMode(mode);sky.intensity=mode==='night'?.23:mode==='sunset'?.7:1.6;sun.intensity=mode==='night'?.12:mode==='sunset'?1.3:3;sun.color.setHex(mode==='sunset'?0xffad70:mode==='night'?0xcbdfff:0xffeed8);scene.background=new THREE.Color(mode==='night'?0x101a2a:mode==='sunset'?0xb9a2a0:0xc5d5de);};
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();renderer.setAnimationLoop(()=>{controls.update();lighting.update(camera.position);renderer.render(scene,camera);});
if(import.meta.hot)import.meta.hot.dispose(()=>{removeEventListener('resize',resize);renderer.setAnimationLoop(null);lighting.dispose();controls.dispose();floor.geometry.dispose();(floor.material as THREE.Material).dispose();pavement.geometry.dispose();(pavement.material as THREE.Material).dispose();renderer.dispose();});
