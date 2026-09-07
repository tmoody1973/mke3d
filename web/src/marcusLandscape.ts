import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MARCUS_SITE, PECK_SITE } from './marcusSite.ts';

type Mode='day'|'sunset'|'night';
/** Current GRAEF grounds: at-grade lawn, two dozen honeylocusts, accessible
 * perimeter paths, native beds and the Water/Kilbourn memorial. Images are
 * geometry references only; all surfaces and screen graphics are procedural. */
export function buildMarcusLandscape(groundAt:(x:number,z:number)=>number) {
 const root=new THREE.Group();root.name='marcus-landscape';
 const materials:Record<string,THREE.MeshStandardMaterial>={
  structure:new THREE.MeshStandardMaterial({color:0xc5c2ae,roughness:.9}),
  paving:new THREE.MeshStandardMaterial({color:0xb9b9ac,roughness:.95,side:THREE.DoubleSide}),
  gravel:new THREE.MeshStandardMaterial({color:0x777e77,roughness:1,side:THREE.DoubleSide}),
  grass:new THREE.MeshStandardMaterial({color:0x617d3d,roughness:1,side:THREE.DoubleSide}),
  soil:new THREE.MeshStandardMaterial({color:0x635044,roughness:1,side:THREE.DoubleSide}),
  frame:new THREE.MeshStandardMaterial({color:0x8e9b96,metalness:.6,roughness:.5}),
  roof:new THREE.MeshStandardMaterial({color:0x424948,roughness:.86}),
  timber:new THREE.MeshStandardMaterial({color:0x97734a,roughness:.84}),
  black:new THREE.MeshStandardMaterial({color:0x202827,roughness:.68}),
  leaf:new THREE.MeshStandardMaterial({color:0x759149,roughness:1}),
  leafLight:new THREE.MeshStandardMaterial({color:0x97a65e,roughness:1}),
  trunk:new THREE.MeshStandardMaterial({color:0x625949,roughness:1}),
  memorial:new THREE.MeshStandardMaterial({color:0x686977,roughness:.8,side:THREE.DoubleSide}),
  bronze:new THREE.MeshStandardMaterial({color:0xa49864,roughness:.55,metalness:.4}),
  lamp:new THREE.MeshStandardMaterial({color:0xf4f0ce,emissive:0xffdda2,emissiveIntensity:0,roughness:.35}),
  screen:new THREE.MeshStandardMaterial({color:0x1d454c,emissive:0x367781,emissiveIntensity:.1,roughness:.5}),
 };
 const buckets:Record<string,THREE.BufferGeometry[]>=Object.fromEntries(Object.keys(materials).map(k=>[k,[]]));
 const add=(key:string,g:THREE.BufferGeometry)=>{g.deleteAttribute('uv');const out=g.index?g.toNonIndexed():g;if(out!==g)g.dispose();buckets[key].push(out);};
 function box(k:string,x:number,y:number,z:number,w:number,h:number,d:number,bearing=0){const g=new THREE.BoxGeometry(w,h,d);g.rotateY(bearing);g.translate(x,y,z);add(k,g);}
 function rod(k:string,a:THREE.Vector3,b:THREE.Vector3,r:number){const delta=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,delta.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());add(k,g);}
 function sphere(k:string,x:number,y:number,z:number,r:number,sx=1,sy=1,sz=1){const g=new THREE.IcosahedronGeometry(r,1);g.scale(sx,sy,sz);g.translate(x,y,z);add(k,g);}
 const point=(x:number,z:number,bearing:number)=>new THREE.Vector3(PECK_SITE.x+x*Math.cos(bearing)+z*Math.sin(bearing),0,PECK_SITE.z-x*Math.sin(bearing)+z*Math.cos(bearing));
 const P=(x:number,z:number)=>point(x,z,PECK_SITE.bearing),L=(x:number,z:number)=>point(x,z,MARCUS_SITE.bearing);
 const base=groundAt(PECK_SITE.x,PECK_SITE.z);
 const pv=(x:number,y:number,z:number)=>{const p=P(x,z);p.y=base+y;return p;};
 function pbox(k:string,x:number,y:number,z:number,w:number,h:number,d:number){const p=P(x,z);box(k,p.x,base+y,p.z,w,h,d,PECK_SITE.bearing);}
 function patch(k:string,cx:number,cz:number,w:number,d:number,bearing:number,offset=.025){
  const positions:number[]=[],nx=Math.ceil(w/2),nz=Math.ceil(d/2);
  const at=(i:number,j:number)=>{const p=point(cx-w/2+i*w/nx,cz-d/2+j*d/nz,bearing);return[p.x,groundAt(p.x,p.z)+offset,p.z];};
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){const a=at(i,j),b=at(i+1,j),c=at(i+1,j+1),d0=at(i,j+1);positions.push(...a,...c,...b,...a,...d0,...c);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();add(k,g);
 }
 // Peck is an open pavilion, not the former opaque cached retail prism.
 const roofWidth=27.9,roofDepth=32.0;
 pbox('roof',0,7.43,0,roofWidth,.22,roofDepth);
 pbox('timber',0,7.295,0,roofWidth-.2,.06,roofDepth-.2);
 for(let z=-15.7;z<=15.8;z+=1.3)pbox('timber',0,7.25,z,roofWidth-.3,.045,.075);
 // Two-level triangulated space frame around every roof edge and under the deck.
 for(let z=-15.4;z<=15.5;z+=5.13){
  rod('frame',pv(-13.6,7.18,z),pv(13.6,7.18,z),.08);
  rod('frame',pv(-13.6,5.75,z),pv(13.6,5.75,z),.075);
  for(let x=-13.6;x<13.5;x+=3.4){rod('frame',pv(x,5.75,z),pv(x+1.7,7.18,z),.06);rod('frame',pv(x+1.7,7.18,z),pv(x+3.4,5.75,z),.06);}
 }
 for(let x=-13.6;x<=13.7;x+=3.4){
  rod('frame',pv(x,7.18,-15.4),pv(x,7.18,15.4),.075);
  for(let z=-15.4;z<15;z+=5.13){rod('frame',pv(x,5.75,z),pv(x,7.18,z+5.13),.055);rod('frame',pv(x,7.18,z),pv(x,5.75,z+5.13),.055);}
 }
 for(const x of [-10.4,10.4])for(const z of [-12.4,12.4]){
  const p=P(x,z),foot=groundAt(p.x,p.z)-.15,top=base+3.9;
  box('structure',p.x,(foot+top)/2,p.z,.64,top-foot,.64,PECK_SITE.bearing);
  for(const dx of [-1.7,1.7])for(const dz of [-1.7,1.7])rod('frame',pv(x,3.9,z),pv(x+dx,5.75,z+dz),.10);
 }
 // West stage, concrete side walls and original neutral stage curtain.
 const stageBottom=Math.min(...[-13.5,-6.5].flatMap(x=>[-10.25,10.25].map(z=>{const p=P(x,z);return groundAt(p.x,p.z)-base;})))-.15;
 pbox('structure',-10.0,(stageBottom+.65)/2,0,7.0,.65-stageBottom,20.5);
 pbox('black',-10.0,.675,0,7.1,.075,20.6);
 pbox('structure',-13.15,2.25,0,.55,4.5,21.0);
 pbox('black',-12.81,2.45,0,.10,3.65,16.4);
 for(const z of [-10.15,10.15])pbox('structure',-11.6,1.75,z,3.4,3.5,.35);
 for(let i=0;i<4;i++)pbox('structure',-6.42+i*.30,.55-i*.14,10.8,.30,.24,1.2);
 // 390 simple seats plus six open wheelchair positions = official 396 capacity.
 const seatCenters:number[][]=[];
 for(let row=0;row<13;row++)for(let col=0;col<30;col++){
  const x=-4.5+row*.87,z=(col-14.5)*.60+(col<15?-.55:.55),p=P(x,z),y=groundAt(p.x,p.z)+.04;
  box('black',p.x,y+.46,p.z,.44,.065,.49,PECK_SITE.bearing);
  const back=P(x+.23,z);box('black',back.x,y+.72,back.z,.055,.47,.49,PECK_SITE.bearing);
  for(const side of [-1,1]){const leg=P(x,z+side*.20);box('frame',leg.x,y+.23,leg.z,.055,.45,.035,PECK_SITE.bearing);}
  seatCenters.push([p.x,y,p.z]);
 }
 patch('paving',0,0,27.2,31.4,PECK_SITE.bearing,.035);
 // Lighting bars and compact downlights, with no production/event imagery.
 for(const x of [-5,3]){
  rod('black',pv(x,5.52,-10),pv(x,5.52,10),.075);
  for(let z=-9;z<=9;z+=2.25){pbox('black',x,5.35,z,.30,.33,.36);pbox('lamp',x,5.16,z,.22,.05,.25);}
 }
 const screenPoint=P(16,-8);
 box('black',screenPoint.x,base+4.0,screenPoint.z,.25,2.7,4.7,PECK_SITE.bearing);
 const screenFace=P(16.15,-8);box('screen',screenFace.x,base+4.0,screenFace.z,.035,2.36,4.35,PECK_SITE.bearing);
 for(const z of [-9.3,-6.7]){const p=P(16,z),g=groundAt(p.x,p.z);box('structure',p.x,(g+base+2.7)/2,p.z,.25,base+2.7-g,.25);}
 // Terrain-following current lawn and crushed-stone cafe borders.
 patch('grass',50.5,0,55,16,MARCUS_SITE.bearing,.035);
 for(const z of [-10,10])patch('gravel',50.5,z,55,3.7,MARCUS_SITE.bearing,.025);
 for(const z of [-13.2,13.2])patch('paving',50.5,z,60,2.7,MARCUS_SITE.bearing,.04);
 for(const x of [20.8,80.2])patch('paving',x,0,3.0,29.1,MARCUS_SITE.bearing,.04);
 patch('paving',17,0,8,7,MARCUS_SITE.bearing,.04);
 // Slender young honeylocusts: irregular branching and airy separated leaf masses.
 const treeCenters:number[][]=[];
 for(const z of [-9.6,9.6])for(let i=0;i<12;i++){
  const p=L(24+i*4.8,z),y=groundAt(p.x,p.z),h=4.3+.35*Math.sin(i*2.3+z);
  rod('trunk',new THREE.Vector3(p.x,y-.10,p.z),new THREE.Vector3(p.x+.10,y+h,p.z),.09);
  for(let j=0;j<5;j++){
   const a=j*2.4+i*.7,r=1.0+.2*Math.sin(j*3+i),end=new THREE.Vector3(p.x+Math.cos(a)*r,y+h+.7+(j%2)*.5,p.z+Math.sin(a)*r);
   rod('trunk',new THREE.Vector3(p.x+.1,y+h*.58,p.z),end,.032);
   sphere(j%2?'leaf':'leafLight',end.x,end.y,end.z,.84,1.2,.75,1.05);
  }
  treeCenters.push([p.x,y,p.z]);
 }
 function bench(x:number,z:number,bearing:number){const y=groundAt(x,z);box('timber',x,y+.46,z,2,.10,.48,bearing);for(const s of [-1,1]){const dx=Math.cos(bearing)*s*.78,dz=-Math.sin(bearing)*s*.78;box('black',x+dx,y+.23,z+dz,.10,.45,.45,bearing);}}
 function cafe(x:number,z:number){
  const p=L(x,z),y=groundAt(p.x,p.z),g=new THREE.CylinderGeometry(.48,.48,.045,16);g.translate(p.x,y+.73,p.z);add('frame',g);
  for(const s of [-1,1])rod('frame',new THREE.Vector3(p.x-.28,y+.05,p.z+s*.22),new THREE.Vector3(p.x+.28,y+.71,p.z-s*.22),.025);
  for(const dx of [-.85,.85]){const q=L(x+dx,z);box('frame',q.x,y+.42,q.z,.39,.045,.39,MARCUS_SITE.bearing);const b=L(x+dx+(dx<0?-.2:.2),z);box('frame',b.x,y+.68,b.z,.045,.44,.39,MARCUS_SITE.bearing);for(const zz of [-.15,.15]){const leg=L(x+dx,z+zz);rod('frame',new THREE.Vector3(leg.x-.16,y+.03,leg.z),new THREE.Vector3(leg.x+.16,y+.43,leg.z),.023);}}
 }
 for(const z of [-10.4,10.4])for(const x of [28,38,48,58,68,75])cafe(x,z);
 // Rain gardens remain within the campus and above its underlying terrain;
 // dense low planting conveys the biofiltration borders without a raised slab.
 for(const [x,zCenter,bedWidth,bedDepth] of [[30,17,14,3],[50,16.5,14,2.8],[68,15.5,12,1.4]]){
  patch('soil',x,zCenter,bedWidth,bedDepth,MARCUS_SITE.bearing,.012);
  for(let i=0;i<25;i++){
   const p=L(x-bedWidth*.42+(i%9)*bedWidth*.105,zCenter-bedDepth*.32+Math.floor(i/9)*bedDepth*.32),y=groundAt(p.x,p.z);
   sphere(i%3?'leaf':'leafLight',p.x,y+.20,p.z,.20,1,.75,1);
   for(let j=0;j<3;j++)rod('leafLight',new THREE.Vector3(p.x,y+.02,p.z),new THREE.Vector3(p.x+.18*Math.sin(i+j),y+.45+.12*(i%3),p.z+.15*Math.cos(i+j)),.018);
  }
 }
 // Stone light piers and paired globe luminaires match the public-ground photos.
 for(const z of [-13.1,13.1])for(const x of [22,34,46,58,70,80]){
  const p=L(x,z),y=groundAt(p.x,p.z);box('structure',p.x,y+1.8,p.z,.42,3.6,.42,MARCUS_SITE.bearing);
  for(const dx of [-.40,.40]){const q=L(x+dx,z);rod('frame',new THREE.Vector3(p.x,y+3.03,p.z),new THREE.Vector3(q.x,y+3.03,q.z),.045);sphere('lamp',q.x,y+3.03,q.z,.23);}
 }
 // Public riverwalk at the pavilion's west edge: terrain-following paving/rail.
 patch('paving',-16.4,0,2.2,35,PECK_SITE.bearing,.045);
 for(let i=0;i<18;i++){
  const a=P(-17.45,-17+i*2),b=P(-17.45,-15+i*2),ya=groundAt(a.x,a.z),yb=groundAt(b.x,b.z);
  rod('frame',new THREE.Vector3(a.x,ya,a.z),new THREE.Vector3(a.x,ya+1.04,a.z),.035);
  for(const h of [.34,.68,1.03])rod('frame',new THREE.Vector3(a.x,ya+h,a.z),new THREE.Vector3(b.x,yb+h,b.z),.028);
 }
 // Original circular memorial paving, radial joints, two poles and open bench gaps.
 const memorial=L(92,-4),radius=5.8,disc:number[]=[];
 patch('paving',86,-4,13,3.2,MARCUS_SITE.bearing,.04);
 const mpoint=(r:number,a:number)=>{const x=memorial.x+r*Math.cos(a),z=memorial.z+r*Math.sin(a);return[x,groundAt(x,z)+.055,z];};
 for(let i=0;i<64;i++){const a=i*Math.PI/32,b=(i+1)*Math.PI/32;disc.push(...mpoint(0,0),...mpoint(radius,b),...mpoint(radius,a));}
 const mg=new THREE.BufferGeometry();mg.setAttribute('position',new THREE.Float32BufferAttribute(disc,3));mg.computeVertexNormals();add('memorial',mg);
 for(const r of [1.55,1.72,5.55])for(let i=0;i<64;i++)rod('bronze',new THREE.Vector3(...mpoint(r,i*Math.PI/32)),new THREE.Vector3(...mpoint(r,(i+1)*Math.PI/32)),.018);
 for(let i=0;i<16;i++)rod('black',new THREE.Vector3(...mpoint(1.75,i*Math.PI/8)),new THREE.Vector3(...mpoint(5.75,i*Math.PI/8)),.012);
 for(const dx of [-3.5,3.5]){const x=memorial.x+dx,z=memorial.z-2.8,y=groundAt(x,z);rod('frame',new THREE.Vector3(x,y,z),new THREE.Vector3(x,y+7.2,z),.05);sphere('bronze',x,y+7.25,z,.07);}
 for(const a of [.2,2.3,3.45])bench(memorial.x+Math.cos(a)*6.2,memorial.z+Math.sin(a)*6.2,-a+Math.PI/2);
 for(const [key,geometries] of Object.entries(buckets)){
  if(!geometries.length)continue;const geometry=mergeGeometries(geometries);if(!geometry)throw new Error(`Marcus landscape merge failed: ${key}`);
  const mesh=new THREE.Mesh(geometry,materials[key]);mesh.name=`marcus-landscape-${key}`;mesh.castShadow=!['paving','grass','gravel','soil','memorial','lamp'].includes(key);mesh.receiveShadow=true;
  if(['paving','memorial'].includes(key))mesh.userData.walkingSurface='grade';
  root.add(mesh);geometries.forEach(g=>g.dispose());
 }
 root.userData.treeCenters=treeCenters;root.userData.seatCenters=seatCenters;root.userData.wheelchairPositions=6;
 root.userData.memorial={x:memorial.x,z:memorial.z,radius};root.userData.pavilion={x:PECK_SITE.x,z:PECK_SITE.z,bearing:PECK_SITE.bearing,roofHeight:7.54,stageFaces:'east'};
 root.userData.setLightingMode=(mode:Mode)=>{materials.lamp.emissiveIntensity=mode==='night'?2.2:mode==='sunset'?1.15:0;materials.screen.emissiveIntensity=mode==='night'?.8:mode==='sunset'?.35:.1;};
 root.userData.setLightingMode('day');return root;
}
