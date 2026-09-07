import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TURNER_HALL_SITE as site } from './turnerHallSite.ts';

type Mode='day'|'sunset'|'night';
/** Photo-proportioned exterior; local -X faces Vel R. Phillips, +Z is south. */
export function buildTurnerHall(groundAt:(x:number,z:number)=>number){
 const root=new THREE.Group();root.name='turner-hall-ballroom';
 const buckets:Record<string,THREE.BufferGeometry[]>={brick:[],stone:[],red:[],roof:[],glass:[],metal:[],mortar:[],glow:[]};
 const materials:Record<string,THREE.MeshStandardMaterial>={
  brick:new THREE.MeshStandardMaterial({color:0xbba477,roughness:.92}),stone:new THREE.MeshStandardMaterial({color:0xc0b49a,roughness:.95}),
  red:new THREE.MeshStandardMaterial({color:0x71372f,roughness:.9}),roof:new THREE.MeshStandardMaterial({color:0x373b38,roughness:.9,side:THREE.DoubleSide}),
  glass:new THREE.MeshStandardMaterial({color:0x243b40,roughness:.34,metalness:.18}),metal:new THREE.MeshStandardMaterial({color:0x262c2b,roughness:.7}),
  mortar:new THREE.MeshStandardMaterial({color:0x8d8066,roughness:1}),glow:new THREE.MeshStandardMaterial({color:0xffe1a0,emissive:0xffcd73,emissiveIntensity:0}),
 };
 const add=(key:string,g:THREE.BufferGeometry)=>{g.deleteAttribute('uv');buckets[key].push(g.index?g.toNonIndexed():g);};
 function box(k:string,x:number,y:number,z:number,w:number,h:number,d:number){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(k,g);}
 function beam(k:string,a:THREE.Vector3,b:THREE.Vector3,r:number){const delta=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,delta.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());add(k,g);}
 // Extrude a facade shape whose horizontal coordinate runs north-south.
 function panel(k:string,shape:THREE.Shape,x:number,z:number,depth=.08){const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:16});g.rotateY(-Math.PI/2);g.translate(x+depth,0,z);add(k,g);}
 function archShape(w:number,bottom:number,h:number){const r=w/2,s=new THREE.Shape();s.moveTo(-r,bottom);s.lineTo(r,bottom);s.lineTo(r,bottom+h-r);s.absarc(0,bottom+h-r,r,0,Math.PI,false);s.lineTo(-r,bottom);return s;}
 function archBand(k:string,x:number,z:number,cy:number,r:number,t:number){const s=new THREE.Shape();s.absarc(0,cy,r+t,0,Math.PI,false);s.absarc(0,cy,r,Math.PI,0,true);s.closePath();panel(k,s,x,z,.10);}
 function window(x:number,z:number,b:number,h:number,w:number,arched=true){
  if(arched){panel('stone',archShape(w+.28,b-.10,h+.24),x,z,.10);panel('glass',archShape(w,b,h),x-.115,z,.025);archBand('red',x-.03,z,b+h-w/2,w/2+.32,.06);}
  else {box('stone',x-.05,b+h/2,z,.13,h+.28,w+.3);box('glass',x-.13,b+h/2,z,.05,h,w);box('stone',x-.14,b+h+.2,z,.22,.22,w+.5);}
  for(const y of [b+.08,b+h*.49,b+h-(arched?w/2:.08)])box('stone',x-.18,y,z,.09,.065,w);
  box('stone',x-.18,b-.10,z,.3,.15,w+.42);
 }
 function gable(z:number,width:number,bottom:number,top:number,x:number,depth:number){const s=new THREE.Shape();s.moveTo(-width/2,bottom);s.lineTo(width/2,bottom);s.lineTo(0,top);s.closePath();panel('brick',s,x,z,depth);for(const sign of [-1,1]){const p=[[x,top+.025,z],[x+depth,top+.025,z],[x+depth,bottom+.025,z+sign*width/2],[x,bottom+.025,z+sign*width/2]];const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([p[0],p[1],p[2],p[0],p[2],p[3]].flat(),3));g.computeVertexNormals();add('roof',g);}for(const sign of [-1,1])beam('red',new THREE.Vector3(x-.14,bottom,z+sign*width/2),new THREE.Vector3(x-.14,top,z),.13);}
 function hip(x:number,z:number,w:number,d:number,bottom:number,top:number,inset:number){
  const a=[x-w/2,bottom,z-d/2],b=[x+w/2,bottom,z-d/2],c=[x+w/2,bottom,z+d/2],e=[x-w/2,bottom,z+d/2];
  const A=[x-w/2+inset,top,z-d/2+inset],B=[x+w/2-inset,top,z-d/2+inset],C=[x+w/2-inset,top,z+d/2-inset],E=[x-w/2+inset,top,z+d/2-inset];
  const points=[a,b,B,a,B,A,b,c,C,b,C,B,c,e,E,c,E,C,e,a,A,e,A,E,A,B,C,A,C,E];
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flatMap((_,i)=>i%3===0?[points[i],points[i+2],points[i+1]].flat():[]),3));g.computeVertexNormals();add('roof',g);
 }
 // Basement is embedded below the sidewalk, not a floating presentation plinth.
 box('stone',0,.8,0,45.72,3,30.48);box('brick',0,10.3,0,45.72,17,30.48);
 box('stone',0,.8,-18,45.72,3,5.52);box('brick',0,6.55,-18,45.72,9.5,5.52);
 hip(0,0,46.2,30.95,18.8,21.3,4.4);box('roof',0,11.4,-18,46,.28,5.6);
 const front=-22.86;
 for(const z of [-10,10]){box('stone',front-.30,.8,z,.62,3,5.6);box('brick',front-.30,10.25,z,.62,17,5.6);gable(z,6,18.7,22.7,front-.66,5.6);window(front-.8,z-.58,19.1,1.1,.6,false);window(front-.8,z+.58,19.1,1.1,.6,false);}
 box('stone',front-.58,.8,0,1.2,3,6.2);box('brick',front-.58,10.2,0,1.2,17.4,6.2);box('stone',front-.9,18.9,0,1.9,.40,6.8);
 // Central roof tower and its four dormers.
 box('brick',front+2.05,22,0,5.5,6.2,5.3);box('red',front+2.05,25.08,0,5.9,.52,5.75);
 hip(front+2.05,0,6.0,5.8,25.36,29.2,2.7);
 for(const z of [-1.65,0,1.65])window(front-.76,z,20.5,3.5,.94,false);
 for(const z of [-2.65,2.65]){box('brick',front-.15,19.85,z,1.45,1.4,1.0);hip(front-.15,z,1.65,1.2,20.55,21.35,.53);}
 box('brick',front-.5,26.35,0,.9,1.8,1.5);window(front-1,0,25.75,1.2,.96,false);gable(0,1.9,27.2,27.9,front-1.05,.95);
 for(const s of [-1,1]){box('brick',front+2.05,26.35,s*2.1,1.45,1.75,.9);box('glass',front+2.05,26.3,s*2.58,.94,1.15,.04);}
 beam('red',new THREE.Vector3(front+2.05,29.1,0),new THREE.Vector3(front+2.05,29.7,0),.07);
 // Horizontal masonry courses follow the stepped west facade.
 function faceX(z:number){return Math.abs(z)<3.1?front-1.2:Math.abs(Math.abs(z)-10)<2.8?front-.63:front-.025;}
 for(let y=2.1;y<18.6;y+=.16){for(const [z,w] of [[-14,2.4],[-10,5.6],[-5,3.8],[0,6.2],[5,3.8],[10,5.6],[14,2.4]])box('mortar',faceX(z)-.01,y,z,.016,.018,w);}
 for(const y of [3.0,6.65,7.2,11.1,11.45,15.75,16.2,18.3]){
  for(const [z,w] of [[-14,2.4],[-10,5.6],[-5,3.8],[0,6.2],[5,3.8],[10,5.6],[14,2.4]])box(y===7.2?'stone':'red',faceX(z)-.035,y,z,.11,y===7.2?.23:.08,w);
 }
 for(const z of [-13.9,-11,-9,-5.5,5.5,9,11,13.9]){const x=faceX(z)-.035;window(x,z,3.05,3.75,1.18);window(x,z,7.85,2.65,1.2,false);window(x,z,11.8,4.05,1.2);}
 for(const z of [-1.7,0,1.7])for(const y of [11.5,13.0,14.5])window(front-1.24,z,y,1.30,1.08,false);
 window(front-.07,-18,3.0,3.7,1.32);window(front-.07,-18,7.8,2.7,1.32,false);
 for(let y=2.2;y<11.1;y+=.16)box('mortar',front-.06,y,-18,.016,.018,5.52);
 // Portal: shallow arched porch with a separate triangular pediment.
 box('brick',front-1.3,4.5,-2.65,1.9,9.0,.82);box('brick',front-1.3,4.5,2.65,1.9,9.0,.82);
 panel('glass',archShape(4.6,.55,7.35),front-2.28,0,.035);
 archBand('brick',front-2.1,0,5.6,2.3,.62);archBand('red',front-2.24,0,5.6,2.65,.10);
 gable(0,6.7,8.3,11.6,front-2.24,1.9);
 for(const z of [-2.65,2.65]){box('stone',front-2.04,2.5,z,.65,4.4,.72);box('stone',front-2.05,5.2,z,.8,.35,1);}
 for(const z of [-1.15,0,1.15])box('red',front-2.34,3.2,z,.11,5.2,.09);
 for(const y of [.6,3.75,5.5])box('red',front-2.34,y,0,.12,.14,4.6);
 for(let i=0;i<4;i++)box('stone',front-2.1-i*.3,.07+(3-i)*.12,0,.6,.14+(3-i)*.24,4.7);
 // Limestone block joints at pedestrian height, including long side walls.
 for(let y=-.4;y<2;y+=.48){for(let z=-15;z<15;z+=1.35)box('mortar',front-.06,y,z,.025,.022,1.27);for(const s of [-1,1])for(let x=-22;x<22;x+=1.4)box('mortar',x,y,s*15.25,1.34,.025,.025);}
 // Utilitarian south/north brick elevations and asymmetric service windows.
 for(const side of [-1,1]){
  const z=side===1?15.26:-20.77;
  for(let y=2.3;y<(side===1?18.5:11.1);y+=.18)box('mortar',0,y,z,45.7,.018,.015);
  for(let j=0;j<11;j++){const x=-18+j*3.65;for(const y of (side===1?[2.9,8.2,12.6]:[3,7.8])){
   const h=y===12.6?2.7:2.5;box('stone',x,y+h/2,z+side*.06,1.40,h+.20,.1);box('glass',x,y+h/2,z+side*.12,1.15,h,.035);
   box('stone',x,y+h*.5,z+side*.15,1.17,.07,.06);box('stone',x,y+h/2,z+side*.15,.06,h,.06);
  }}
 }
 for(const z of [-12,-8,-3,3,8,12])for(const y of [3,8,13]){box('stone',22.9,y+1.2,z,.10,2.55,1.5);box('glass',22.97,y+1.2,z,.035,2.3,1.2);}
 // Steel escape landings, rails, and flights on the south wall.
 for(const x of [-1,13]){
  for(const y of [6.5,11.3]){box('metal',x,y,16.3,5,.13,2.1);for(let p=-2.4;p<=2.5;p+=.65)box('metal',x+p,y+.52,17.3,.045,1.05,.045);for(const h of [.3,.65,1])box('metal',x,y+h,17.3,5,.045,.045);}
  for(let i=0;i<18;i++)box('metal',x+2.6+i*.27,11.3-i*.267,16.65,.30,.07,1.05);
  beam('metal',new THREE.Vector3(x+2.6,12.3,17.2),new THREE.Vector3(x+7.2,7.7,17.2),.04);
 }
 for(const z of [-13,13]){box('metal',front-3.3,2.6,z,.10,5.2,.10);box('metal',front-3.3,5.3,z,.52,.12,.52);box('glow',front-3.3,5.02,z,.28,.44,.28);}
 // Unbranded, replaceable vertical venue sign frame (label supplies the venue name).
 box('red',front-1.2,10.4,-12.7,1.5,5.8,.28);box('stone',front-1.22,10.4,-12.87,1.30,5.6,.045);
 box('red',front-1.23,10.4,-12.90,1.12,5.4,.025);
 for(const [name,geometries] of Object.entries(buckets)){
  if(!geometries.length)continue;const geometry=mergeGeometries(geometries);if(!geometry)continue;
  const mesh=new THREE.Mesh(geometry,materials[name]);mesh.name=name==='brick'||name==='stone'?'BLDG':`turner-${name}`;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);geometries.forEach(g=>g.dispose());
 }
 // Main mass+1899 addition fit the cached mapped outline, without stretching height.
 root.scale.set(site.width/45.72,1,site.depth/36.0);
 root.rotation.y=site.bearing;
 const floor=groundAt(site.x,site.z);root.position.set(site.x,floor,site.z+2.35);
 root.userData.finishedFloor=floor;root.userData.facade='west';root.userData.referenceHeight=29.7;
 root.userData.setLightingMode=(mode:Mode)=>{materials.glass.emissive.setHex(0xe8aa59);materials.glass.emissiveIntensity=mode==='night'?.38:mode==='sunset'?.14:0;materials.glow.emissiveIntensity=mode==='day'?0:2.5;};
 root.userData.setLightingMode('day');return root;
}
