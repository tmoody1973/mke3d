import * as THREE from 'three';
import {createCity,type Mode} from './scene';
import {fetchBuffer,parseTerrain,parseSections,sectionToGeometry} from './loader';
import {bilinearTerrainHeight} from './localTerrain';
import {prepareHoanTerrain,prepareHoanWater,adaptHoanContextTile} from './hoanSite';
import {prepareSummerfestTerrain,adaptSummerfestTile} from './summerfestSite';
import {buildSummerfest} from './summerfest';
const city=createCity(document.querySelector('canvas')!,document.querySelector('#labels')!,false);
const rawTerrain=parseTerrain(await fetchBuffer('/data/terrain.bin'));
const terrain=prepareSummerfestTerrain(prepareHoanTerrain(rawTerrain));
const groundAt=(x:number,z:number)=>bilinearTerrainHeight(terrain,x,z);
city.addTerrain(terrain);city.addWater(prepareHoanWater(parseSections(await fetchBuffer('/data/water.bin'))));
const model=buildSummerfest(groundAt);city.landmarks.add(model);
for(const [i,j] of [[0,0],[0,-1],[-1,0],[-1,-1]]){
 const g=new THREE.Group();
 for(const section of parseSections(await fetchBuffer(`/data/tiles/t_${i}_${j}.bin`))){
  if(!['ROAD','HWAY','BLDG'].includes(section.name))continue;
  const mesh=new THREE.Mesh(sectionToGeometry(section),section.name==='BLDG'?city.mats.building:city.mats.road);mesh.name=section.name;mesh.castShadow=section.name==='BLDG';mesh.receiveShadow=true;g.add(mesh);
 }
 adaptSummerfestTile(g,{i,j},groundAt,rawTerrain,terrain);
 adaptHoanContextTile(g,{i,j},rawTerrain,groundAt);city.tiles.add(g);
}
const views:Record<string,{eye:[number,number,number];target:[number,number,number]}>= {
 harbor:{eye:[215,95,390],target:[405,5,350]},
 gateway:{eye:[155,125,-135],target:[400,5,-25]},
 erie:{eye:[290,55,1045],target:[505,4,970]},
 aurora:{eye:[465,19,205],target:[538,9,165]},
 auroraInterior:{eye:[514,6,165],target:[564,5,165]},
 aerial:{eye:[1150,580,1100],target:[540,5,430]},
 south:{eye:[930,180,1000],target:[605,10,790]},
 central:{eye:[720,100,490],target:[460,9,350]},
 north:{eye:[700,95,-170],target:[540,7,35]},
 promenade:{eye:[670,17,350],target:[566,8,285]},
};
function view(key:string){const v=views[key];city.camera.position.fromArray(v.eye);city.controls.target.fromArray(v.target);city.controls.update();document.querySelectorAll<HTMLButtonElement>('[data-angle]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.angle===key)));}
document.querySelectorAll<HTMLButtonElement>('[data-angle]').forEach(b=>b.onclick=()=>view(b.dataset.angle!));
document.querySelector('select')!.onchange=e=>{const mode=(e.target as HTMLSelectElement).value.toLowerCase() as Mode;city.setMode(mode);model.userData.setLightingMode(mode);};
view('aerial');city.resize();addEventListener('resize',()=>city.resize());
let previous=performance.now();city.renderer.setAnimationLoop(now=>{city.render(Math.min(.05,(now-previous)/1000));previous=now;});
if(import.meta.hot)import.meta.hot.dispose(()=>{city.renderer.setAnimationLoop(null);city.controls.dispose();city.renderer.dispose();});
