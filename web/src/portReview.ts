import {prepareJonesIslandWater} from './jonesIslandWater';
import {detailJonesIslandBuildings} from './jonesIslandBuildings';
import * as THREE from 'three';
import {createCity,type Mode} from './scene';
import {fetchBuffer,parseTerrain,parseSections,sectionToGeometry} from './loader';
import {prepareHoanTerrain,prepareHoanWater,adaptHoanContextTile} from './hoanSite';
import {bilinearTerrainHeight} from './localTerrain';
import {buildPortMilwaukee} from './portMilwaukee';
import {removePortPlaceholders} from './portPlaceholder';
import {buildHoan} from './hoan';
const city=createCity(document.querySelector('canvas')!,document.querySelector('#labels')!,false);
const raw=parseTerrain(await fetchBuffer('/data/terrain.bin'));
const terrain=prepareHoanTerrain(raw),groundAt=(x:number,z:number)=>bilinearTerrainHeight(terrain,x,z);
city.addTerrain(terrain);city.addWater(prepareJonesIslandWater(prepareHoanWater(parseSections(await fetchBuffer('/data/water.bin')))));
const port=buildPortMilwaukee(groundAt);city.landmarks.add(port);
const geo=await(await fetch('/data/landmarks_geo.json')).json();
const bridge=buildHoan(geo.hoan,groundAt);city.landmarks.add(bridge);
for(const j of [-1,-2]){
 const tile=new THREE.Group();
 for(const section of parseSections(await fetchBuffer(`/data/tiles/t_0_${j}.bin`))){
  if(!['ROAD','HWAY','BLDG'].includes(section.name))continue;
  const mesh=new THREE.Mesh(sectionToGeometry(section),section.name==='BLDG'?city.mats.building:city.mats.road);
  mesh.name=section.name;mesh.castShadow=section.name==='BLDG';mesh.receiveShadow=true;tile.add(mesh);
 }
 removePortPlaceholders(tile,{i:0,j});detailJonesIslandBuildings(tile,{i:0,j});adaptHoanContextTile(tile,{i:0,j},raw,groundAt);city.tiles.add(tile);
}
const views:Record<string,{eye:[number,number,number];target:[number,number,number]}>= {
 plant:{eye:[1010,270,1690],target:[535,12,1380]},
 park:{eye:[421,23,2010],target:[386,3,1976]},
 docks:{eye:[1450,360,2060],target:[785,12,1790]},
 rail:{eye:[652,22,2435],target:[557,3,2280]},
 bulk:{eye:[180,100,2480],target:[495,12,2370]},
 ferry:{eye:[1740,80,3610],target:[1450,12,3480]},
 overview:{eye:[2150,1300,3580],target:[700,10,2380]},
};
function view(key:string){city.camera.position.set(...views[key].eye);city.controls.target.set(...views[key].target);city.controls.update();document.querySelectorAll<HTMLButtonElement>('[data-angle]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.angle===key)));}
document.querySelectorAll<HTMLButtonElement>('[data-angle]').forEach(b=>b.onclick=()=>view(b.dataset.angle!));
document.querySelector('select')!.onchange=e=>{const mode=(e.target as HTMLSelectElement).value.toLowerCase() as Mode;city.setMode(mode);port.userData.setLightingMode(mode);bridge.userData.setLightingMode(mode);};
view('docks');city.resize();addEventListener('resize',()=>city.resize());
let previous=performance.now();city.renderer.setAnimationLoop(now=>{const dt=Math.min(.05,(now-previous)/1000);previous=now;bridge.userData.updateLighting(now/1000,matchMedia('(prefers-reduced-motion: reduce)').matches);city.render(dt);});
if(import.meta.hot)import.meta.hot.dispose(()=>{city.renderer.setAnimationLoop(null);city.controls.dispose();city.renderer.dispose();});
