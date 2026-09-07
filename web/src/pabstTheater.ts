import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PABST_SITE as site } from './theaterSites.ts';

type LightingMode = 'day' | 'sunset' | 'night';
/** Procedural exterior based on the supplied Wells Street facade photograph.
 * Local X is east, +Z is Wells Street. The City Hall tower visible behind the
 * reference is deliberately not part of this building. No reference images ship.
 */
export function buildPabstTheater(groundAt: (x: number, z: number) => number) {
 const root = new THREE.Group(); root.name = 'pabst-theater';
 const buckets: Record<string, THREE.BufferGeometry[]> = {brick:[], stone:[], relief:[], shadow:[], roof:[], glass:[], iron:[], gold:[], light:[]};
 const materials: Record<string, THREE.MeshStandardMaterial> = {
  brick:new THREE.MeshStandardMaterial({color:0xb89c78,roughness:.94}),
  stone:new THREE.MeshStandardMaterial({color:0xc5bca5,roughness:.94}),
  relief:new THREE.MeshStandardMaterial({color:0x9b8063,roughness:.88}),
  shadow:new THREE.MeshStandardMaterial({color:0x685c4a,roughness:.97}),
  roof:new THREE.MeshStandardMaterial({color:0x454d4b,roughness:.85}),
  glass:new THREE.MeshStandardMaterial({color:0x273d40,roughness:.32,metalness:.16}),
  iron:new THREE.MeshStandardMaterial({color:0x202e2c,roughness:.63,metalness:.4}),
  gold:new THREE.MeshStandardMaterial({color:0xb29347,roughness:.54,metalness:.4}),
  light:new THREE.MeshStandardMaterial({color:0xffedbf,emissive:0xffc578,emissiveIntensity:0}),
 };
 function add(key:string,g:THREE.BufferGeometry) {g.deleteAttribute('uv');const flat=g.index?g.toNonIndexed():g;if(flat!==g)g.dispose();buckets[key].push(flat);}
 function box(k:string,x:number,y:number,z:number,w:number,h:number,d:number) {const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(k,g);}
 function rod(k:string,a:number[],b:number[],r:number,segments=7) {const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);const g=new THREE.CylinderGeometry(r,r,delta.length(),segments);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...av.add(bv).multiplyScalar(.5).toArray());add(k,g);}
 function panel(k:string,s:THREE.Shape,x:number,z:number,d=.07) {const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false,curveSegments:18});g.translate(x,0,z);add(k,g);}
 function arch(w:number,b:number,h:number) {const r=w/2,s=new THREE.Shape();s.moveTo(-r,b);s.lineTo(r,b);s.lineTo(r,b+h-r);s.absarc(0,b+h-r,r,0,Math.PI,false);s.closePath();return s;}
 function archBand(k:string,x:number,z:number,cy:number,r:number,t:number) {const s=new THREE.Shape();s.absarc(0,cy,r+t,0,Math.PI,false);s.absarc(0,cy,r,Math.PI,0,true);s.closePath();panel(k,s,x,z,.11);}
 function ring(k:string,x:number,y:number,z:number,r:number,t:number,sx=1,sy=1) {const g=new THREE.TorusGeometry(r,t,5,24);g.scale(sx,sy,1);g.translate(x,y,z);add(k,g);}
 function cornice(x:number,y:number,z:number,w:number) {for(const [dy,depth,h] of [[0,.30,.16],[.17,.48,.16],[.38,.70,.23]])box('relief',x,y+dy,z+depth/2,w+depth,h,depth);for(let p=-w/2+.28;p<w/2;p+=.48)box('relief',x+p,y-.16,z+.19,.19,.28,.3);}
 function pilaster(x:number,z:number,b:number,h:number,w=.5) {box('relief',x,b+h/2,z+.12,w,h,.24);for(const p of [-.13,0,.13])box('brick',x+p,b+h/2,z+.26,.045,h-.55,.05);box('relief',x,b+.15,z+.19,w+.24,.3,.40);box('relief',x,b+h-.08,z+.22,w+.34,.28,.46);}
 function window(x:number,z:number,b:number,h:number,w:number,round=false) {
  if(round){panel('shadow',arch(w+.3,b-.12,h+.27),x,z);panel('glass',arch(w,b,h),x,z+.085,.025);archBand('relief',x,z+.11,b+h-w/2,w/2+.08,.17);}
  else {box('relief',x,b+h/2,z+.08,w+.28,h+.25,.16);box('glass',x,b+h/2,z+.18,w,h,.04);}
  for(const dy of [.04,h*.48])box('stone',x,b+dy,z+.23,w,.065,.07);
  box('stone',x,b+h/2,z+.23,.065,h,.07);box('stone',x,b-.13,z+.19,w+.43,.15,.34);
 }
 function pediment(x:number,z:number,w:number,b:number,top:number) {const s=new THREE.Shape();s.moveTo(-w/2,b);s.lineTo(w/2,b);s.lineTo(0,top);s.closePath();panel('brick',s,x,z,.32);for(const sign of [-1,1])rod('relief',[x+sign*w/2,b,z+.4],[x,top,z+.4],.16);cornice(x,b-.30,z,w+.3);}
 // Normals face upward: roof is not double sided, so a winding error is visible.
 function hip(x:number,z:number,w:number,d:number,b:number,t:number,inset:number) {const a=[x-w/2,b,z-d/2],c=[x+w/2,b,z-d/2],e=[x+w/2,b,z+d/2],f=[x-w/2,b,z+d/2];const A=[x-w/2+inset,t,z-d/2+inset],C=[x+w/2-inset,t,z-d/2+inset],E=[x+w/2-inset,t,z+d/2-inset],F=[x-w/2+inset,t,z+d/2-inset];const triangles=[a,A,C,a,C,c,c,C,E,c,E,e,e,E,F,e,F,f,f,F,A,f,A,a,A,F,E,A,E,C];const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(triangles.flat(),3));g.computeVertexNormals();add('roof',g);}
 function urn(x:number,y:number,z:number) {box('relief',x,y,z,.6,.28,.55);rod('relief',[x,y,z],[x,y+.8,z],.15);const g=new THREE.SphereGeometry(.28,8,6);g.scale(1,1.4,1);g.translate(x,y+.65,z);add('stone',g);rod('relief',[x,y+.94,z],[x,y+1.18,z],.065);}
 // Ordinary stroke lettering made from geometry; no trademark artwork or fonts.
 const glyph:Record<string,number[][][]>={
  P:[[[0,0],[0,1],[.7,1],[.85,.82],[.85,.60],[.7,.5],[0,.5]]],
  A:[[[0,0],[.42,1],[.84,0]],[[.18,.4],[.66,.4]]],
  B:[[[0,0],[0,1],[.62,1],[.8,.82],[.8,.67],[.62,.5],[0,.5]],[[.62,.5],[.85,.33],[.85,.17],[.62,0],[0,0]]],
  S:[[[.83,.88],[.66,1],[.15,1],[0,.82],[0,.63],[.18,.5],[.64,.5],[.82,.36],[.82,.16],[.65,0],[.15,0],[0,.13]]],
  T:[[[0,1],[.85,1]],[[.425,1],[.425,0]]],
  H:[[[0,0],[0,1]],[[.85,0],[.85,1]],[[0,.5],[.85,.5]]],
  E:[[[.85,1],[0,1],[0,0],[.85,0]],[[0,.5],[.7,.5]]],
  R:[[[0,0],[0,1],[.65,1],[.85,.8],[.85,.65],[.65,.5],[0,.5]],[[.4,.5],[.85,0]]],
 };
 function letter(char:string,x:number,y:number,z:number,size:number,side=0,k='light') {for(const path of glyph[char]??[])for(let j=1;j<path.length;j++){const p=path[j-1],q=path[j];const pos=(v:number[])=>side?[x,y+v[1]*size,z-v[0]*size*side]:[x+v[0]*size,y+v[1]*size,z];rod(k,pos(p),pos(q),size*(side?.085:.048),7);}}
 function textLabel(value:string,x:number,y:number,z:number,size:number) {for(const c of value){if(c!==' ')letter(c,x,y,z,size,0,'stone');x+=size*1.12;}}
 // Recessed auditorium and foundation meet terrain, including grade changes.
 box('stone',0,.8,0,37,3.6,30);box('brick',0,10.5,-.15,37,19,29.7);
 box('brick',0,17,-3.8,31,8,22);box('roof',0,21.05,-3.8,31.4,.3,22.4);
 // West pavilion has a low slate hip; east pavilion has the raised title pediment.
 box('brick',-14,10.5,12.1,9,19,6.2);
 // Broken convex mansard slope and ridge cresting over the west stage pavilion.
 hip(-14,8.6,9.5,14,20.1,21.85,.62);hip(-14,8.6,8.26,12.76,21.85,22.60,1.32);
 for(let x=-16.7;x<-11.1;x+=.43){rod('iron',[x,22.62,13.65],[x,23.03,13.65],.028);ring('iron',x,22.90,13.65,.11,.019);}
 rod('iron',[-16.8,22.77,13.65],[-11.2,22.77,13.65],.025);
 // Shallow broken roof above the auditorium, largely screened by the parapet.
 hip(1.3,-2.3,22.5,22.9,20.2,21.5,1.25);hip(1.3,-2.3,20,20.4,21.5,22.25,2.2);
 box('brick',13.5,11.8,11.2,10,22,8);box('roof',13.5,22.8,10.4,10.2,.22,7.3);
 box('brick',-.5,10.9,13.2,18,19.8,4.0);
 for(const [x,w,y] of [[-14,9,19.7],[-.5,18,20.3],[13.5,10,22.2]])cornice(x,y,15.22,w);
 // Parapet balustrade of center wing, with tiny stone coping blocks.
 box('brick',-.5,20.9,15.02,18,.8,.45);box('stone',-.5,21.37,15.14,18.3,.17,.72);
 for(let x=-9;x<8.4;x+=.46)box('shadow',x,20.95,15.26,.17,.45,.035);
 // East gable sits above a rectangular inscribed entablature.
 box('brick',13.5,23.3,15.07,10.15,1.5,.55);box('relief',13.5,23.28,15.41,9.05,1.08,.16);
 box('shadow',13.5,23.28,15.51,8.65,.78,.05);textLabel('PABST THEATER',9.28,23.02,15.56,.60);
 pediment(13.5,15.02,10.5,24.1,26.1);ring('relief',13.5,24.98,15.49,.40,.11,1.4,.65);
 for(const x of [8.35,13.5,18.65])urn(x,x===13.5?26.1:24.15,15.28);
 // Street face: limestone arches beneath richly modeled upper masonry.
 for(const x of [-16.3,-12,-7.6,-3.2,1.2,5.6,10.8,15.2]){
  panel('shadow',arch(3.0,.28,4.65),x,15.09);panel('stone',arch(2.68,.27,4.40),x,15.18);
  archBand('relief',x,15.27,3.43,1.42,.20);box('relief',x,4.86,15.45,.35,.44,.23);
 }
 for(const x of [10.8,15.2]){window(x,15.30,.27,3.28,2.4);for(const dx of [-.78,.0,.78])box('iron',x+dx,1.95,15.58,.075,3.2,.1);box('gold',x,1.55,15.67,.35,.07,.05);}
 for(const x of [-17.9,-10.1,-8.9,-4.9,3.9,8.9,12.0,15.0,18.1])pilaster(x,15.2,6.05,12.2,x>8?.40:.58);
 for(const y of [5.55,6.1,10.6,14.9,18.65])box('relief',0,y,15.26,37.3,y===6.1?.34:.18,.33);
 for(const x of [-17,-14,-11,-6.5,-.5,5.5]){
  // Blind arched recesses in the auditorium facade are masonry, not invented glass.
  panel('relief',arch(2.75,10.98,7.0),x,15.26);panel('brick',arch(2.31,11.17,6.48),x,15.35);
  archBand('relief',x,15.47,16.50,1.22,.20);box('relief',x,17.8,15.65,.28,.42,.18);
  box('relief',x,13.18,15.49,1.05,2.32,.13);box('brick',x,13.18,15.58,.76,2.04,.06);
  box('relief',x,8.3,15.36,1.5,3.15,.18);box('brick',x,8.3,15.46,1.20,2.8,.05);
 }
 for(const x of [10.25,13.45,16.65]){
  window(x,15.29,11.15,3.4,1.4);window(x,15.29,7.05,2.7,1.4);
  ring('relief',x,10.20,15.56,.32,.07);box('relief',x,14.85,15.45,1.95,.19,.34);
 }
 // Pediment, oculi and central cartouche over the east pavilion windows.
 pediment(13.5,15.32,7.3,17.7,18.95);
 for(const x of [10.9,16.1]){ring('relief',x,18.20,15.58,.44,.15,.83,1.18);const g=new THREE.CircleGeometry(.35,20);g.scale(.83,1.18,1);g.translate(x,18.20,15.54);add('shadow',g);}
 ring('relief',13.5,17.8,15.67,.64,.17,.78,1.30);ring('gold',13.5,17.8,15.87,.30,.06,.78,1.35);
 for(const sign of [-1,1])for(let i=0;i<4;i++)ring('relief',13.5+sign*(.9+i*.29),17.44+i*.12,15.62,.14,.055);
 // Projecting center balcony and its arched ornamental panel.
 box('stone',-.5,14.63,16.0,4.0,.24,1.25);box('iron',-.5,15.35,16.56,4,.06,.07);
 for(let x=-2.3;x<1.5;x+=.35){box('iron',x,15.0,16.56,.045,.68,.045);ring('gold',x,15.08,16.61,.12,.024);}
 for(const x of [-1.8,.8])rod('relief',[x,13.8,15.5],[x,14.55,16.5],.17);
 ring('relief',-.5,17.24,15.62,.59,.14,.86,1.05);
 // Entire street canopy and return on east side, with individual iron brackets.
 box('iron',0,5.15,16.55,38.7,.27,3.55);box('roof',0,5.32,16.55,39,.13,3.75);
 for(const y of [5.04,5.37])box('iron',0,y,18.37,39,.10,.13);
 for(let x=-18.6;x<=18.7;x+=4.65){
  rod('iron',[x,.03,18.1],[x,5.07,18.1],.075);box('iron',x,.2,18.1,.25,.4,.25);box('iron',x,4.93,18.1,.4,.18,.28);
  for(const sign of [-1,1]){rod('iron',[x,4.04,18.1],[x+sign*.94,5.03,18.1],.045);ring('iron',x+sign*.42,4.70,18.1,.21,.03);}
  box('light',x,4.94,16.7,.28,.09,.40);
 }
 for(let x=-19;x<19;x+=.34){box('iron',x,5.88,18.33,.035,1.04,.035);if(Math.round((x+19)/.34)%3===0)ring('gold',x,5.86,18.36,.16,.024);}
 for(const y of [5.50,6.37])box('iron',0,y,18.33,38.7,.06,.07);
 box('iron',19.07,5.17,12.7,1.45,.24,8);for(let z=9;z<16.5;z+=.35)box('iron',19.76,5.9,z,.035,1.1,.035);
 for(const y of [5.45,6.45])box('iron',19.76,y,12.7,.07,.07,8);
 // Two outward faces use their own reading direction: +X faces read toward -Z.
 // The stepped shoulders and curved end caps follow the reference's silhouette.
 const signFaces: {cabinetX:number; side:number; center:number[]; letters:{char:string;firstVertex:number;vertexCount:number;baseY:number;height:number}[]}[]=[];
 function cabinetShape() {
  const s=new THREE.Shape();s.moveTo(.65,3.0);s.absarc(0,3.0,.65,0,Math.PI,false);
  s.lineTo(-.65,2.69);s.lineTo(-.83,2.69);s.lineTo(-.83,2.20);s.lineTo(-.73,2.20);
  s.lineTo(-.73,-2.25);s.lineTo(-.83,-2.25);s.lineTo(-.83,-2.73);s.lineTo(-.65,-2.73);
  s.lineTo(-.65,-3.0);s.absarc(0,-3.0,.65,Math.PI,2*Math.PI,false);
  s.lineTo(.65,-2.73);s.lineTo(.83,-2.73);s.lineTo(.83,-2.25);s.lineTo(.73,-2.25);
  s.lineTo(.73,2.20);s.lineTo(.83,2.20);s.lineTo(.83,2.69);s.lineTo(.65,2.69);s.closePath();return s;
 }
 function signRing(x:number,y:number,z:number,r:number,t:number) {const g=new THREE.TorusGeometry(r,t,6,20);g.rotateY(Math.PI/2);g.translate(x,y,z);add('gold',g);}
 for(const x of [-12.4,18.68]){
  // Successive silhouettes form the double gold edge and dark recessed center.
  for(const [key,sw,sh,d] of [['gold',1,1,.26],['iron',.92,.976,.29],['gold',.84,.954,.32],['iron',.77,.930,.35]] as const){
   const g=new THREE.ExtrudeGeometry(cabinetShape(),{depth:d,bevelEnabled:false,curveSegments:24});g.scale(sw,sh,1);g.rotateY(Math.PI/2);g.translate(x-d/2,14.3,16.28);add(key,g);
  }
  for(const side of [-1,1]){
   const face={cabinetX:x,side,center:[x+side*.22,14.3,16.28],letters:[] as {char:string;firstVertex:number;vertexCount:number;baseY:number;height:number}[]};
   for(let i=0;i<5;i++){
    const firstVertex=buckets.light.reduce((n,g)=>n+g.getAttribute('position').count,0),baseY=16.35-i*.97,height=.70;
    letter('PABST'[i],x+side*.23,baseY,16.28+side*.85*height/2,height,side);
    const end=buckets.light.reduce((n,g)=>n+g.getAttribute('position').count,0);
    face.letters.push({char:'PABST'[i],firstVertex,vertexCount:end-firstVertex,baseY,height});
   }
   // Small secondary line is ordinary venue text, not a raster logo.
   for(let i=0;i<7;i++)letter('THEATER'[i],x+side*.23,11.86,16.28+side*(.52-i*.157),.14,side);
   for(const y of [17.34,11.32]){
    signRing(x+side*.215,y,16.28,.255,.031);
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;signRing(x+side*.22,y+Math.sin(a)*.135,16.28+Math.cos(a)*.135,.079,.019);}
    signRing(x+side*.22,y,16.28,.047,.022);
   }
   // Fine rim studs reinforce the shallow sign depth and lit-edge detail.
   for(const sz of [-1,1])for(let y=12.05;y<16.6;y+=.20){const g=new THREE.SphereGeometry(.017,5,4);g.translate(x+side*.19,y,16.28+sz*.59);add('light',g);}
   signFaces.push(face);
  }
  for(const y of [11.6,16.85])box('gold',x,y,15.5,.17,.14,1.25);
 }
 root.userData.signFaces=signFaces;
 // A subordinate glazed east annex fills the additional mapped envelope.
 box('stone',21.5,.6,-1.3,6,2.8,27.4);box('iron',21.5,3.25,-1.3,6,5.3,27.4);box('roof',21.5,5.97,-1.3,6.3,.2,27.7);
 for(let z=-13;z<11;z+=2.4){box('glass',24.53,3.15,z,.05,4.5,2.15);box('stone',24.60,3.1,z+1.15,.16,5.3,.14);}
 // East return continues the paired arched upper bays; rear is plain service brick.
 for(let z=-11;z<13;z+=4.4){
  // Turn XY arch ornament onto the YZ wall.
  const s=arch(2.15,10.9,6.8),g=new THREE.ExtrudeGeometry(s,{depth:.10,bevelEnabled:false,curveSegments:16});g.rotateY(Math.PI/2);g.translate(18.5,0,z);add('relief',g);
  const inset=arch(1.82,11.10,6.39),gi=new THREE.ExtrudeGeometry(inset,{depth:.035,bevelEnabled:false,curveSegments:16});gi.rotateY(Math.PI/2);gi.translate(18.63,0,z);add('brick',gi);
  for(const y of [7.0,11.4]){box('relief',18.58,y+1.3,z,.14,2.85,1.52);box('glass',18.67,y+1.3,z,.05,2.56,1.20);box('stone',18.73,y+1.3,z,.05,.07,1.22);}
 }
 // Shallow joints emphasize scale without introducing photo textures.
 for(let y=.2;y<5;y+=.52)box('shadow',0,y,15.22,37,.016,.02);
 for(let y=6.5;y<19.5;y+=.23){box('relief',-14,y,15.22,8.9,.014,.014);box('relief',0,y,-15.04,36.8,.014,.014);}
 for(const x of [-13,-5,5,13])box('iron',x,1.6,-15.08,2.3,3.2,.08);
 box('roof',-5,21.42,-6,3.8,.65,2.7);box('roof',5,21.38,-9,2.9,.55,2.2);
 for(const [key,geometries] of Object.entries(buckets)){
  if(!geometries.length)continue;const geometry=mergeGeometries(geometries);if(!geometry)throw new Error(`Pabst ${key} geometry did not merge`);
  const mesh=new THREE.Mesh(geometry,materials[key]);mesh.name=['brick','stone','relief'].includes(key)?'BLDG':`pabst-${key}`;mesh.userData.part=key;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);geometries.forEach(g=>g.dispose());
 }
 root.scale.set(45.11/37,1,24.38/30);root.rotation.y=site.bearing;
 // Historic dimensions stay independent of the larger modern OSM envelope.
 const offset=new THREE.Vector3(-2.5,0,-1.4).applyAxisAngle(new THREE.Vector3(0,1,0),site.bearing);
 const floor=groundAt(site.x+offset.x,site.z+offset.z);root.position.set(site.x+offset.x,floor,site.z+offset.z);
 root.userData.finishedFloor=floor;root.userData.facade='south';root.userData.referenceHeight=27.28;
 root.userData.setLightingMode=(mode:LightingMode)=>{materials.glass.emissive.setHex(0xf4c489);materials.glass.emissiveIntensity=mode==='night'?.48:mode==='sunset'?.16:0;materials.light.emissiveIntensity=mode==='night'?2.2:mode==='sunset'?.8:0;};
 root.userData.setLightingMode('day');return root;
}
