import * as THREE from 'three';
import {buildNewMuseum} from './newMuseum.ts';
import {NEW_MUSEUM_SITE} from './newMuseumSite.ts';
import {districtGeometry} from './districtGeometry.ts';

export function buildNewMuseumCampus(groundAt:(x:number,z:number)=>number){
 const root=new THREE.Group();root.name='new-milwaukee-public-museum-campus';
 const s=NEW_MUSEUM_SITE;
 const museum=buildNewMuseum({width:s.buildingWidth,depth:s.buildingDepth,height:30.48});
 museum.position.set(s.x,s.floor,s.z);museum.rotation.y=s.bearing;root.add(museum);
 const b=districtGeometry(root);
 const stone=new THREE.MeshStandardMaterial({color:0xd8d1bb,roughness:.9});
 const cream=new THREE.MeshStandardMaterial({color:0xd9d5c7,roughness:.85});
 const glass=new THREE.MeshStandardMaterial({color:0x476970,roughness:.3,metalness:.15});
 const metal=new THREE.MeshStandardMaterial({color:0x727d7d,roughness:.65,metalness:.3});
 const leaves=new THREE.MeshStandardMaterial({color:0x607449,roughness:.96});
 const timber=new THREE.MeshStandardMaterial({color:0x6f5840,roughness:.95});
 const soil=new THREE.MeshStandardMaterial({color:0x808266,roughness:1});
 const streetlightMetal=new THREE.MeshStandardMaterial({color:0x3f4a4a,roughness:.5,metalness:.7});
 const streetlightGlow=new THREE.MeshStandardMaterial({color:0xffd19a,emissive:0xffa64d,emissiveIntensity:0,roughness:.38});
 // Interpreted finished landscape inside the mapped construction parcel.
 const north=s.z-30;
 const wingX=s.x+16,wingZ=north-23;
 b.box(wingX,s.floor+4.5,wingZ,32,9,39,cream,'museum-north-cafe-wing');
 b.box(wingX-16.04,s.floor+3,wingZ,.12,5.4,34,glass,'museum-garden-cafe-glazing');
 for(let z=wingZ-16;z<wingZ+17;z+=3)b.box(wingX-16.12,s.floor+3,z,.15,5.5,.12,metal,'museum-cafe-mullions');
 b.box(wingX,s.floor+9.2,wingZ,31,.4,38,soil,'museum-north-green-roof');
 const gardenX=s.x-22,gardenZ=north-25;
 b.box(gardenX,groundAt(gardenX,gardenZ)+.05,gardenZ,29,.12,43,stone,'museum-north-garden-paving');
 function plant(x:number,z:number,r:number){const y=groundAt(x,z);
  b.cylinder(x,y+.18,z,r,.3,soil,'museum-rain-garden-beds',16);
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const g=new THREE.IcosahedronGeometry(r*.28,0).scale(1,.65,1).translate(x+Math.cos(a)*r*.64,y+.55,z+Math.sin(a)*r*.64);b.add(g,leaves,'museum-native-planting');}
 }
 for(const [dx,dz,r] of [[-6,-11,4.2],[5,-15,3.5],[5,8,4],[-6,12,3.8],[-3,0,2.3]])plant(gardenX+dx,gardenZ+dz,r);
 for(const [x,z] of [[gardenX-6,gardenZ-11],[gardenX+5,gardenZ+8],[s.x-35,s.z+14],[s.x+24,s.z+33]]){
  const y=groundAt(x,z);b.cylinder(x,y+2.3,z,.2,4.6,timber,'museum-street-tree-trunks',8);
  b.add(new THREE.IcosahedronGeometry(2.9,1).scale(1,1.1,1).translate(x,y+5.3,z),leaves,'museum-street-tree-canopies');
 }
 for(const z of [gardenZ-7,gardenZ+7]){const y=groundAt(gardenX-1,z);b.box(gardenX-1,y+.55,z,3,.18,.7,timber,'museum-garden-benches');for(const dx of [-1,1])b.box(gardenX-1+dx,y+.25,z,.15,.5,.5,metal,'museum-bench-feet');}
 // Entry paving and a shallow foundation connect the sculpture to the street grade.
 b.box(s.x,s.floor-.18,s.z,s.buildingWidth,.36,s.buildingDepth,stone,'museum-foundation');
 b.box(s.x,groundAt(s.x,s.z+32)+.03,s.z+32,72,.12,5,stone,'museum-mckinley-entry-paving');

 // Six slim fixtures mark the public Sixth Street and McKinley edges. Their
 // bases are sampled independently so they remain grounded on the live terrain.
 const streetlightPositions:[number,number][]=[
  [-1097.0,-1460],[-1097.0,-1415],[-1097.0,-1370],
  [-1085,-1352],[-1055,-1352],[-1025,-1352],
 ];
 for(const [x,z] of streetlightPositions){
  const y=groundAt(x,z);
  b.cylinder(x,y+3.3,z,.105,6.6,streetlightMetal,'museum-streetlight-poles',8);
  b.box(x,y+6.65,z,.62,.14,.42,streetlightMetal,'museum-streetlight-fixture-arms');
  b.box(x,y+6.52,z,.38,.2,.28,streetlightGlow,'museum-streetlight-lamps');
 }
 b.finish();

 // A single additive pool mesh keeps the six warm pools cheap to render.
 const poolSize=24,rgba=new Uint8Array(poolSize*poolSize*4);
 for(let py=0;py<poolSize;py++)for(let px=0;px<poolSize;px++){
  const i=(py*poolSize+px)*4,r=Math.hypot((px+.5)/poolSize*2-1,(py+.5)/poolSize*2-1);
  rgba[i]=255;rgba[i+1]=194;rgba[i+2]=112;rgba[i+3]=Math.round(82*Math.max(0,1-r)**2);
 }
 const poolTexture=new THREE.DataTexture(rgba,poolSize,poolSize);poolTexture.needsUpdate=true;
 const poolMaterial=new THREE.MeshBasicMaterial({map:poolTexture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0});
 const pools=new THREE.InstancedMesh(new THREE.PlaneGeometry(4,4).rotateX(-Math.PI/2),poolMaterial,streetlightPositions.length);
 pools.name='museum-streetlight-ground-light-pools';
 streetlightPositions.forEach(([x,z],i)=>pools.setMatrixAt(i,new THREE.Matrix4().makeTranslation(x,groundAt(x,z)+.035,z)));
 pools.instanceMatrix.needsUpdate=true;root.add(pools);
 root.userData.streetlightPositions=streetlightPositions.map(([x,z])=>({x,z,y:groundAt(x,z)}));
 root.userData.lampPositions=root.userData.streetlightPositions;
 root.userData.setLightingMode=(mode:'day'|'sunset'|'night')=>museum.userData.setLightingMode?.(mode);
 const setLightingMode=root.userData.setLightingMode;
 root.userData.setLightingMode=(mode:'day'|'sunset'|'night')=>{
  const level=mode==='night'?1:mode==='sunset'?.35:0;
  streetlightGlow.emissiveIntensity=level*2.2;poolMaterial.opacity=level;pools.visible=level>0;
  setLightingMode(mode);root.userData.lightingMode=mode;
 };
 root.userData.setLightingMode('day');
 root.userData.visualization='future-completed-design';
 return root;
}
