import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MARCUS_GARAGE_SITE as s, MARCUS_CONNECTOR_SITE as bridge } from './marcusSite.ts';

/** Existing 1969 structure: vertical concrete screen and enclosed State Street skywalk. */
export function buildMarcusGarage(groundAt:(x:number,z:number)=>number){
 const root=new THREE.Group();root.name='marcus-garage';
 const mat={deck:new THREE.MeshStandardMaterial({color:0x6d706d,roughness:.96}),concrete:new THREE.MeshStandardMaterial({color:0xb5b0a0,roughness:.91}),edge:new THREE.MeshStandardMaterial({color:0xd1cbbb,roughness:.85}),shadow:new THREE.MeshStandardMaterial({color:0x343632,roughness:.95}),metal:new THREE.MeshStandardMaterial({color:0x65766e,metalness:.45,roughness:.58}),glass:new THREE.MeshStandardMaterial({color:0x314745,metalness:.25,roughness:.26}),lamp:new THREE.MeshStandardMaterial({color:0xffe3ac,emissive:0xffd593,emissiveIntensity:0}),car:new THREE.MeshStandardMaterial({color:0x677984,metalness:.25,roughness:.5}),line:new THREE.MeshStandardMaterial({color:0xd5cead,roughness:1})};
 type Key=keyof typeof mat;const buckets=Object.fromEntries(Object.keys(mat).map(k=>[k,[]])) as unknown as Record<Key,THREE.BufferGeometry[]>;
 const floor=Math.max(...[[-22,40],[22,40],[22,-40]].map(([x,z])=>groundAt(s.x+x,s.z+z)));
 const transform=new THREE.Matrix4().compose(new THREE.Vector3(s.x,floor,s.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),s.bearing),new THREE.Vector3(1,1,1));
 function add(k:Key,g:THREE.BufferGeometry,world=false){if(!world)g.applyMatrix4(transform);g.deleteAttribute('uv');const n=g.index?g.toNonIndexed():g;if(n!==g)g.dispose();buckets[k].push(n);}
 function box(k:Key,x:number,y:number,z:number,w:number,h:number,d:number,world=false){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(k,g,world);}
 function beam(a:THREE.Vector3,b:THREE.Vector3,r:number){const delta=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,delta.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());add('metal',g,true);}
 const w=s.width,d=s.depth,h=12,level=3.45;
 // Recessed core carries collision; screen fins and floor edges stay visibly separate.
 box('shadow',0,4.05,0,w-3.2,11.5,d-3.2);
 for(let i=0;i<4;i++){
  const y=i*level;box('concrete',0,y,0,w,.30,d);
  for(const side of [-1,1]){
   box('edge',side*(w/2-.20),y+.43,0,.38,.58,d);
   box('edge',0,y+.43,side*(d/2-.20),w,.58,.38);
   if(i<3){box('lamp',side*(w/2-.67),y+2.80,0,.07,.06,d-4);box('lamp',0,y+2.80,side*(d/2-.67),w-4,.06,.07);}
  }
 }
 // Closely spaced vertical fins are the defining street-facing feature in the supplied photographs.
 for(const side of [-1,1]){
  for(let z=-d/2+.8;z<d/2;z+=1.55)box('edge',side*(w/2+.04),h/2,z,.58,h,.27);
  for(let x=-w/2+.7;x<w/2;x+=1.55)box('edge',x,h/2,side*(d/2+.04),.27,h,.58);
  box('concrete',side*(w/2-.1),h,0,.65,.42,d+.65);
  box('concrete',0,h,side*(d/2-.1),w+.65,.42,.65);
 }
 // Stone stair volumes with narrow glazed vertical strips at the State Street corners.
 for(const x of [-w/2+4,w/2-4]){
  box('concrete',x,6.1,d/2+.15,5.5,12.2,3.5);
  box('glass',x+1.6,6.1,d/2+1.925,1.40,11.9,.07);
  for(let i=1;i<4;i++)box('metal',x+1.6,i*3.1,d/2+1.975,1.5,.10,.08);
 }
 // Open-air top deck, simple stall lines and small parked-car silhouettes.
 box('deck',0,10.54,0,w-1,.12,d-1);
 for(let z=-d/2+6;z<d/2-4;z+=2.8)for(const x of [-w/2+4,-9,9,w/2-4]){
  box('line',x,10.615,z,4.8,.015,.045);
  if(Math.sin(z*2.17+x)>-.10){box('car',x,11.04,z+1.3,3.9,.72,1.67);box('glass',x-.08,11.60,z+1.3,2.0,.49,1.49);}
 }
 // Enclosed truss skywalk follows its own mapped axis, with road clearance below.
 const start=new THREE.Vector3(bridge.x+Math.sin(bridge.bearing)*-25.9,0,bridge.z+Math.cos(bridge.bearing)*-25.9);
 const end=new THREE.Vector3(bridge.x+Math.sin(bridge.bearing)*25.9,0,bridge.z+Math.cos(bridge.bearing)*25.9);
 const bridgeFloor=Math.max(floor+4.95,groundAt(bridge.x,bridge.z)+5.25),length=start.distanceTo(end),width=bridge.width;
 const bm=new THREE.Matrix4().compose(new THREE.Vector3(bridge.x,bridgeFloor,bridge.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),bridge.bearing),new THREE.Vector3(1,1,1));
 function bridgeBox(k:Key,x:number,y:number,z:number,bw:number,bh:number,bd:number){const g=new THREE.BoxGeometry(bw,bh,bd);g.translate(x,y,z);g.applyMatrix4(bm);add(k,g,true);}
 bridgeBox('concrete',0,0,0,width+.40,.35,length);bridgeBox('concrete',0,2.9,0,width+.5,.35,length);
 for(const side of [-1,1]){
  bridgeBox('glass',side*(width/2),1.5,0,.05,2.65,length);
  for(let z=-length/2;z<length/2;z+=3.7){const toWorld=(x:number,y:number,dz:number)=>new THREE.Vector3(x,y,dz).applyMatrix4(bm);
   beam(toWorld(side*(width/2+.08),.23,z),toWorld(side*(width/2+.08),2.72,Math.min(length/2,z+3.7)),.065);
   beam(toWorld(side*(width/2+.08),2.72,z),toWorld(side*(width/2+.08),.23,Math.min(length/2,z+3.7)),.065);
  }
 }
 bridgeBox('lamp',0,2.62,0,.08,.06,length-.6);
 for(const z of [-18,18]){const point=new THREE.Vector3(0,0,z).applyMatrix4(bm),base=groundAt(point.x,point.z);box('concrete',point.x,(bridgeFloor+base)/2,point.z,.75,bridgeFloor-base,.85,true);}
 for(const [name,geometries] of Object.entries(buckets) as [Key,THREE.BufferGeometry[]][]){
  if(!geometries.length)continue;const g=mergeGeometries(geometries)!;const mesh=new THREE.Mesh(g,mat[name]);mesh.name=name==='shadow'?'BLDG':`marcus-garage-${name}`;mesh.castShadow=name!=='glass'&&name!=='lamp';mesh.receiveShadow=true;root.add(mesh);geometries.forEach(g=>g.dispose());
 }
 root.userData.finishedFloor=floor;root.userData.bridgeFloor=bridgeFloor;root.userData.deckCount=4;
 root.userData.setLightingMode=(mode:'day'|'sunset'|'night')=>{mat.lamp.emissiveIntensity=mode==='night'?2.2:mode==='sunset'?.7:0;mat.glass.emissive.setHex(0xffd99b);mat.glass.emissiveIntensity=mode==='night'?.18:mode==='sunset'?.06:0;};
 return root;
}
