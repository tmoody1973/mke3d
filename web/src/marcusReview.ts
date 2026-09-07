import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildMarcusCampus} from './marcusCampus';
import {MARCUS_SITE as s} from './marcusSite';
import {parseTerrain} from './loader';
import {bilinearTerrainHeight} from './localTerrain';

const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas')!,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xc5d5de);
const camera=new THREE.PerspectiveCamera(43,1,.1,2000),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
const sky=new THREE.HemisphereLight(0xdaebff,0xb4a589,1.6),sun=new THREE.DirectionalLight(0xffeed8,3);
sun.position.set(100,150,90);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-180,right:180,top:180,bottom:-180,near:1,far:450});sun.shadow.normalBias=.035;scene.add(sky,sun);
const terrain=await fetch('/data/terrain.bin').then(r=>r.arrayBuffer()).then(parseTerrain);
const groundAt=(x:number,z:number)=>bilinearTerrainHeight(terrain,x,z);
const model=buildMarcusCampus(groundAt),centered=new THREE.Group();centered.position.set(-s.x,0,-s.z);centered.add(model);scene.add(centered);
// The review uses the shipped site's elevations, so it can expose ground-contact defects.
const ground=new THREE.PlaneGeometry(500,500,90,90);ground.rotateX(-Math.PI/2);const positions=ground.getAttribute('position');
for(let i=0;i<positions.count;i++)positions.setY(i,groundAt(positions.getX(i)+s.x,positions.getZ(i)+s.z)-.6);
ground.computeVertexNormals();const surface=new THREE.Mesh(ground,new THREE.MeshStandardMaterial({color:0xa5a59a,roughness:1}));surface.receiveShadow=true;scene.add(surface);
type View={eye:[number,number,number];target:[number,number,number]};
const views:Record<string,View>={
 campus:{eye:[200,170,185],target:[-3,9,-37]},
 water:{eye:[175,40,-12],target:[5,15,-18]},
 entry:{eye:[142,9,-8],target:[43,14,-8]},
 peck:{eye:[8,14,105],target:[-29,6,64]},
 lawn:{eye:[54,13,113],target:[-5,3,53]},
 garage:{eye:[115,43,-62],target:[-3,9,-108]},
 river:{eye:[-175,55,70],target:[-15,12,-25]},
 roof:{eye:[8,320,60],target:[-2,0,-40]},
};
function view(key:string){camera.position.set(...views[key].eye);controls.target.set(...views[key].target);controls.update();}view('campus');
document.querySelectorAll<HTMLButtonElement>('[data-angle]').forEach(button=>button.onclick=()=>{document.querySelectorAll('[data-angle]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));view(button.dataset.angle!);});
document.querySelector('select')!.onchange=event=>{const mode=(event.target as HTMLSelectElement).value.toLowerCase();model.userData.setLightingMode(mode);sky.intensity=mode==='night'?.28:1.6;sun.intensity=mode==='night'?.15:3;sun.color.setHex(mode==='sunset'?0xffad70:mode==='night'?0xcbdfff:0xffeed8);scene.background=new THREE.Color(mode==='night'?0x101a2a:mode==='sunset'?0xc3a9a0:0xc5d5de);};
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
if(import.meta.hot)import.meta.hot.dispose(()=>{removeEventListener('resize',resize);renderer.setAnimationLoop(null);controls.dispose();scene.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});renderer.dispose();});
