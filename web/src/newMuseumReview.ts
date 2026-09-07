import * as THREE from 'three';
import {createCity,type Mode} from './scene';
import {fetchBuffer,parseTerrain,parseSections,sectionToGeometry} from './loader';
import {bilinearTerrainHeight} from './localTerrain';
import {buildNewMuseumCampus} from './newMuseumCampus';
import {NEW_MUSEUM_SITE as site} from './newMuseumSite';
const city=createCity(document.querySelector('canvas')!,document.querySelector('#labels')!,false);
// Architectural review needs a pedestrian eye below the facade's target point.
city.controls.maxPolarAngle=Math.PI*.72;
city.controls.minDistance=15;
city.camera.fov=50;city.camera.updateProjectionMatrix();
const terrain=parseTerrain(await fetchBuffer('/data/terrain.bin'));
const groundAt=(x:number,z:number)=>bilinearTerrainHeight(terrain,x,z);
city.addTerrain(terrain);
const model=buildNewMuseumCampus(groundAt);city.landmarks.add(model);
for(const section of parseSections(await fetchBuffer('/data/tiles/t_-1_0.bin'))){
 if(!['ROAD','HWAY','BLDG'].includes(section.name))continue;
 const mesh=new THREE.Mesh(sectionToGeometry(section),section.name==='BLDG'?city.mats.building:city.mats.road);mesh.castShadow=section.name==='BLDG';mesh.receiveShadow=true;city.tiles.add(mesh);
}
const views:Record<string,{eye:[number,number,number];target:[number,number,number]}>= {
 corner:{eye:[-55,5,65],target:[0,15,0]},
 entry:{eye:[0,2.5,84],target:[0,14,5]},
 sixth:{eye:[-85,3,-62],target:[0,14,0]},
 aerial:{eye:[-115,90,-135],target:[0,14,-25]},
 garden:{eye:[-70,20,-100],target:[-15,8,-45]},
};
function view(key:string){const v=views[key];const damping=city.controls.enableDamping;city.controls.enableDamping=false;city.controls.update();city.camera.position.set(site.x+v.eye[0],model.userData.finishedFloor+v.eye[1],site.z+v.eye[2]);city.controls.target.set(site.x+v.target[0],model.userData.finishedFloor+v.target[1],site.z+v.target[2]);city.controls.update();city.controls.enableDamping=damping;document.querySelectorAll<HTMLButtonElement>('[data-angle]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.angle===key)));}
document.querySelectorAll<HTMLButtonElement>('[data-angle]').forEach(b=>b.onclick=()=>view(b.dataset.angle!));
document.querySelector('select')!.onchange=e=>{const mode=(e.target as HTMLSelectElement).value.toLowerCase() as Mode;city.setMode(mode);model.userData.setLightingMode(mode);};
view('corner');city.resize();addEventListener('resize',()=>city.resize());
let previous=performance.now();city.renderer.setAnimationLoop(now=>{city.render(Math.min(.05,(now-previous)/1000));previous=now;});
if(import.meta.hot)import.meta.hot.dispose(()=>{city.renderer.setAnimationLoop(null);city.controls.dispose();city.renderer.dispose();});
