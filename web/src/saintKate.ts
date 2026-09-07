import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SAINT_KATE_SITE as site } from './saintKateSite.ts';
type Mode='day'|'sunset'|'night';
/** Ten-story hotel exterior, with north Kilbourn porte-cochere and the rounded
 * northeast corner. The separate western river terrace is deliberately excluded. */
export function buildSaintKate(groundAt:(x:number,z:number)=>number){
 const root=new THREE.Group();root.name='saint-kate';root.rotation.y=site.bearing;
 const world=(x:number,z:number)=>new THREE.Vector3(x,0,z).applyAxisAngle(new THREE.Vector3(0,1,0),site.bearing).add(new THREE.Vector3(site.x,0,site.z));
 const local=(x:number,z:number)=>new THREE.Vector3(x-site.x,0,z-site.z).applyAxisAngle(new THREE.Vector3(0,1,0),-site.bearing);
 // Match the independently decoded Kilbourn road crossfall; flat test scenes
 // retain their supplied datum rather than inheriting this site's survey offset.
 const roadTerrain=groundAt(-480,-783),calibration=Math.abs(roadTerrain-4.066)<.08?.437:0;
 const entryRoad=world(.22,-33),floor=groundAt(entryRoad.x,entryRoad.z)+calibration+.045;root.position.set(site.x,floor,site.z);
 const buckets:Record<string,THREE.BufferGeometry[]>={brick:[],stone:[],joint:[],dark:[],roof:[],glass:[],litGlass:[],metal:[],ochre:[],warm:[],wood:[],neonBack:[],neon:[],grade:[],entryGlass:[]};
 const material:Record<string,THREE.MeshStandardMaterial>={
  brick:new THREE.MeshStandardMaterial({color:0x884a39,roughness:.91}),stone:new THREE.MeshStandardMaterial({color:0xc5c7bb,roughness:.85}),joint:new THREE.MeshStandardMaterial({color:0xa28270,roughness:.95}),dark:new THREE.MeshStandardMaterial({color:0x252e2e,roughness:.73}),roof:new THREE.MeshStandardMaterial({color:0x686f6b,roughness:.94}),
  glass:new THREE.MeshStandardMaterial({color:0x263e43,roughness:.25,metalness:.25}),litGlass:new THREE.MeshStandardMaterial({color:0x8c8466,roughness:.31,metalness:.12,emissive:0xffbc68,emissiveIntensity:0}),metal:new THREE.MeshStandardMaterial({color:0x293336,roughness:.55,metalness:.45}),ochre:new THREE.MeshStandardMaterial({color:0xb58e48,roughness:.54,metalness:.28}),warm:new THREE.MeshStandardMaterial({color:0xffe5af,emissive:0xffc278,emissiveIntensity:0}),wood:new THREE.MeshStandardMaterial({color:0x664534,emissive:0xc47d3d,emissiveIntensity:0,roughness:.76}),neonBack:new THREE.MeshStandardMaterial({color:0x701327,emissive:0xfe0016,emissiveIntensity:0,roughness:.5,toneMapped:false,transparent:true,opacity:.25,depthWrite:false,blending:THREE.AdditiveBlending}),neon:new THREE.MeshStandardMaterial({color:0xe65c68,emissive:0xff1023,emissiveIntensity:0,roughness:.4,toneMapped:false}),
 };material.grade=material.stone;material.entryGlass=new THREE.MeshStandardMaterial({color:0x688890,roughness:.18,metalness:.09,transparent:true,opacity:.34,emissive:0xffc487,emissiveIntensity:0});
 function add(k:string,g:THREE.BufferGeometry){g.deleteAttribute('uv');const flat=g.index?g.toNonIndexed():g;if(flat!==g)g.dispose();buckets[k].push(flat);}
 function box(k:string,x:number,y:number,z:number,w:number,h:number,d:number,angle=0){const g=new THREE.BoxGeometry(w,h,d);g.rotateY(angle);g.translate(x,y,z);add(k,g);}
 function rod(k:string,a:number[],b:number[],r:number,segments=6){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);const g=new THREE.CylinderGeometry(r,r,delta.length(),segments);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...av.add(bv).multiplyScalar(.5).toArray());add(k,g);}
 function quad(k:string,a:number[],b:number[],c:number[],d:number[]){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([...a,...b,...c,...a,...c,...d],3));g.computeVertexNormals();add(k,g);}
 function extrusion(k:string,points:THREE.Vector3[],bottom:number,height:number){const shape=new THREE.Shape();points.forEach((p,i)=>i?shape.lineTo(p.x,-p.z):shape.moveTo(p.x,-p.z));shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,bottom,0);add(k,g);}
 const mapped=site.footprint.slice(0,-1).map(([x,z])=>local(x,z));
 // The north projection is an open entrance canopy, not a ten-story solid prism.
 const plan=mapped.map(p=>new THREE.Vector3(p.x,0,Math.max(p.z,-20.34)));
 const recessed=plan.map(p=>new THREE.Vector3(p.x,0,Math.max(p.z,-17.3)));
 extrusion('stone',recessed,-.18,8.38);extrusion('brick',plan,8.2,22.75);extrusion('stone',plan,30.95,4.90);extrusion('roof',plan,35.85,.17);
 // A shallow skirt follows actual grade around the hotel body, not the portico.
 for(let i=0;i<plan.length;i++){const a=plan[i],b=plan[(i+1)%plan.length];if(a.distanceTo(b)<.01)continue;const wa=world(a.x,a.z),wb=world(b.x,b.z);const ay=groundAt(wa.x,wa.z)-floor-.15,by=groundAt(wb.x,wb.z)-floor-.15;quad('stone',[a.x,ay,a.z],[b.x,by,b.z],[b.x,.02,b.z],[a.x,.02,a.z]);}
 function faceRect(k:string,x:number,z:number,angle:number,y:number,w:number,h:number,depth=.07,push=.08){box(k,x+Math.sin(angle)*push,y,z+Math.cos(angle)*push,w,h,depth,angle);}
 function archShape(w:number,b:number,h:number){const r=w/2,s=new THREE.Shape();s.moveTo(-r,b);s.lineTo(r,b);s.lineTo(r,b+h-r);s.absarc(0,b+h-r,r,0,Math.PI,false);s.closePath();return s;}
 function faceShape(k:string,shape:THREE.Shape,x:number,z:number,angle:number,push:number,depth=.05){const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:18});g.rotateY(angle);g.translate(x+Math.sin(angle)*push,0,z+Math.cos(angle)*push);add(k,g);}
 function window(x:number,z:number,angle:number,b:number,w:number,h:number,lit=false,arched=false){
  if(arched){faceShape('dark',archShape(w+.2,b-.06,h+.16),x,z,angle,.065);faceShape(lit?'litGlass':'glass',archShape(w,b,h),x,z,angle,.135,.026);}
  else{faceRect('dark',x,z,angle,b+h/2,w+.2,h+.18,.10,.075);faceRect(lit?'litGlass':'glass',x,z,angle,b+h/2,w,h,.035,.15);}
  faceRect('metal',x,z,angle,b+h/2,.085,h,.07,.195);faceRect('metal',x,z,angle,b+.055,w,.08,.07,.195);
  if(arched)faceRect('metal',x,z,angle,b+h-w/2,w,.065,.07,.20);
  faceRect('stone',x,z,angle,b-.13,w+.35,.15,.23,.13);
 }
 // Locate corner bays on the actual mapped polygon, not an assumed circle.
 const corner=plan.slice(20,33),lengths=corner.slice(1).map((p,i)=>p.distanceTo(corner[i])),total=lengths.reduce((a,b)=>a+b,0);
 const cornerStations=[.22,.50,.78].map(fraction=>{
  let distance=total*fraction,index=0;while(index<lengths.length-1&&distance>lengths[index])distance-=lengths[index++];
  const a=corner[index],b=corner[index+1],p=a.clone().lerp(b,distance/lengths[index]),dx=b.x-a.x,dz=b.z-a.z,len=lengths[index],nx=-dz/len,nz=dx/len;
  return{x:p.x+nx*.09,z:p.z+nz*.09,angle:Math.atan2(nx,nz)};
 });
 const eastBays=[-7.5,-2.5,2.5,7.5,12.5,17.5,22.5],northBays=[-20.5,-15.5,-10.5,-5.5,-.5,4.5,9.5];
 let litRooms=0,darkRooms=0;
 for(let row=0;row<7;row++){
  const y=8.75+row*3.25;
  for(let i=0;i<7;i++){const lit=(i*5+row*3)%11<3;lit?litRooms++:darkRooms++;window(23.60,eastBays[i],Math.PI/2,y,3.15,2.24,lit);const litN=(i*3+row*7)%13<3;litN?litRooms++:darkRooms++;window(northBays[i],-20.34,Math.PI,y,3.15,2.24,litN);}
  // The south return visible in the aerial is intentionally mostly blank brick.
  window(-13.4,26.48,0,y,3.15,2.24,row===2||row===5);
  for(const z of [-12,-4,4,12])window(-23.6,z,-Math.PI/2,y,2.75,2.24,(row+z)%5===0);
  for(const [i,c] of cornerStations.entries())window(c.x,c.z,c.angle,y,2.75,2.24,(row+i*3)%9===0);
 }
 // Pale crown with a rhythmic row of round-headed top-floor windows.
 for(const z of eastBays)window(23.62,z,Math.PI/2,31.9,2.83,2.85,false,true);
 for(const x of northBays)window(x,-20.36,Math.PI,31.9,2.83,2.85,false,true);
 for(const c of cornerStations)window(c.x,c.z,c.angle,31.9,2.5,2.85,false,true);
 window(-13.4,26.49,0,31.9,2.9,2.85,false,true);
 // Cornice and stone panel joints wrap the curved mapped perimeter.
 for(let i=0;i<plan.length;i++){
  const a=plan[i],b=plan[(i+1)%plan.length],length=a.distanceTo(b);if(length<.12)continue;
  const angle=Math.atan2(b.x-a.x,b.z-a.z),mx=(a.x+b.x)/2,mz=(a.z+b.z)/2;
  for(const [y,h,w] of [[8.15,.34,.34],[30.99,.23,.25],[35.55,.54,.36],[36.03,.13,.44]])box('stone',mx,y,mz,w,h,length+.05,angle);
 }
 for(let y=8.55;y<30.8;y+=.24){box('joint',23.647,y,8.3,.015,.018,36.35);box('joint',-.0,y,26.515,46.7,.018,.015);box('joint',-5.5,y,-20.389,35.7,.018,.015);}
 for(const y of [31.5,33.6,35.1]){box('joint',23.70,y,8.3,.018,.022,36.35);box('joint',-5.5,y,-20.41,35.7,.022,.018);box('joint',0,y,26.55,46.7,.022,.018);}
 for(let z=-7.5;z<26;z+=2.5){faceRect('stone',23.63,z,Math.PI/2,35.46,1.94,.65,.11,.09);faceRect('joint',23.63,z,Math.PI/2,35.46,.12,.12,.04,.17);}
 for(let x=-21.5;x<12;x+=2.5){faceRect('stone',x,-20.39,Math.PI,35.46,1.94,.65,.11,.09);faceRect('joint',x,-20.39,Math.PI,35.46,.12,.12,.04,.17);}
 // Two-story pale base and arched east street storefronts.
 for(const z of eastBays){window(23.60,z,Math.PI/2,.2,3.65,4.15,true,true);window(23.60,z,Math.PI/2,5.2,3.1,2.12,(z+7.5)%10===0);}
 for(const x of northBays)window(x,-20.36,Math.PI,5.2,3.1,2.12,true);
 for(const x of [-22.8,-17.7,-12.6,-6.5,6.5,12.3]){box('stone',x,2.35,-19.87,1.15,4.7,1.03);box('dark',x,.45,-20.43,1.18,.90,.11);}
 box('stone',-5.1,6.5,-19.88,36.95,3.0,1.02);
 // Lobby stays recessed behind clear glass doors. Warm wood and an abstract
 // ceiling ring supply only the public glimpse visible in the entry photograph.
 box('wood',0,2.2,-17.42,11.4,4.4,.12);box('warm',0,3.8,-17.52,10.5,.12,.08);
 box('stone',0,.05,-18.6,11.5,.12,3.6);box('ochre',-3.7,1.3,-17.8,2.5,.85,.60);
 for(const x of [-4.7,4.7])box('wood',x,2.0,-18.1,.5,4,.45);
 const ceiling=new THREE.TorusGeometry(1.5,.045,6,36);ceiling.rotateX(Math.PI/2);ceiling.translate(0,3.92,-18.5);add('warm',ceiling);
 const doorCenters=[-3.8,-2.3,-.75,.75,2.3,3.8];
 for(const x of doorCenters){box('entryGlass',x,1.75,-20.44,1.39,3.4,.04);for(const dx of [-.735,.735])box('metal',x+dx,1.80,-20.50,.07,3.6,.12);box('metal',x,3.54,-20.50,1.5,.10,.12);box('warm',x+.40,1.5,-20.56,.045,.57,.08);}
 box('litGlass',0,4.06,-20.43,9.35,.88,.035);for(const x of [-4.7,-1.55,1.55,4.7])box('metal',x,4.05,-20.51,.07,.96,.11);
 for(const x of [-9.1,9.1]){window(x,-20.39,Math.PI,.22,2.75,4.2,true);}
 // Open north porte-cochere projects from the body by the mapped six meters.
 box('ochre',.22,4.91,-23.43,25.36,.68,6.07);box('stone',.22,4.55,-23.43,25.36,.12,6.07);
 for(const x of [-12.1,12.55]){box('stone',x,2.27,-25.78,.45,4.54,.5);box('dark',x,.5,-25.78,.48,1,.53);}
 for(const x of [-9.5,-3.2,3.2,9.5]){
  box('warm',x,4.47,-24.2,1.42,.10,1.18);
  for(const dz of [-.6,.6]){box('metal',x,4.38,-24.2+dz,1.55,.18,.045);for(let i=0;i<6;i++)rod('metal',[x-.7+i*.25,4.30,-24.2+dz],[x-.45+i*.25,4.46,-24.2+dz],.018);}
 }
 for(const x of [-8,8])rod('metal',[x,7.0,-20.35],[x,5.25,-26.42],.045);
 // Original neon tube lettering: plain uppercase, with casing and bright cores.
 const glyph:Record<string,number[][][]>={S:[[[.85,.88],[.7,1],[.18,1],[0,.83],[0,.64],[.18,.5],[.65,.5],[.85,.33],[.85,.17],[.65,0],[.16,0],[0,.13]]],A:[[[0,0],[.42,1],[.84,0]],[[.17,.4],[.67,.4]]],I:[[[.42,0],[.42,1]]],N:[[[0,0],[0,1],[.85,0],[.85,1]]],T:[[[0,1],[.85,1]],[[.425,1],[.425,0]]],K:[[[0,0],[0,1]],[[.85,1],[0,.43],[.85,0]]],E:[[[.85,1],[0,1],[0,0],[.85,0]],[[0,.5],[.68,.5]]]};
 const signFaces:{name:string;normal:number[];firstVertex:number;vertexCount:number;readingDirection:number[]}[]=[];
 function neonText(name:string,origin:number[],right:number[],up:number[],size:number,vertical=false){
  const start=buckets.neon.reduce((n,g)=>n+g.getAttribute('position').count,0);let advance=0;
  for(const char of 'SAINT KATE'){
   for(const path of glyph[char]??[])for(let i=1;i<path.length;i++){
    const point=(p:number[])=>new THREE.Vector3(...origin).addScaledVector(new THREE.Vector3(...right),vertical?p[1]*size:advance+p[0]*size).addScaledVector(new THREE.Vector3(...up),vertical?-advance-p[0]*size:p[1]*size).toArray();
    rod('neonBack',point(path[i-1]),point(path[i]),size*.072,8);rod('neon',point(path[i-1]),point(path[i]),size*.031,8);
   }
   advance+=(char===' '?.64:1.06)*size;
  }
  const end=buckets.neon.reduce((n,g)=>n+g.getAttribute('position').count,0),normal=new THREE.Vector3(...right).cross(new THREE.Vector3(...up));
  signFaces.push({name,normal:normal.toArray(),firstVertex:start,vertexCount:end-start,readingDirection:vertical?[0,-1,0]:right});
 }
 neonText('north-entrance',[9.1,5.48,-26.60],[-1,0,0],[0,1,0],1.9);
 neonText('south-corner',[22.25,29.8,26.76],[1,0,0],[0,1,0],1.86,true);
 neonText('east-corner',[23.85,29.8,25.9],[0,0,-1],[0,1,0],1.86,true);
 // Stone approach joins the real Kilbourn road datum to the recessed doors.
 const front=-33,back=-20.38;
 for(let col=0;col<12;col++)for(let row=0;row<8;row++){
  const xa=-12.4+col*2.1,xb=xa+2.1,za=front+row*(back-front)/8,zb=za+(back-front)/8;
  const grade=(x:number,z:number)=>{const w=world(x,front),edge=groundAt(w.x,w.z)+calibration-floor;return THREE.MathUtils.lerp(edge,.025,THREE.MathUtils.clamp((z-front)/7.0,0,1));};
  quad('grade',[xa,grade(xa,za),za],[xa,grade(xa,zb),zb],[xb,grade(xb,zb),zb],[xb,grade(xb,za),za]);
 }
 // Public portico planters and understated roof equipment/guard rails.
 for(const x of [-8.4,8.4]){const g=new THREE.CylinderGeometry(.55,.40,1.05,10);g.translate(x,.55,-22.0);add('dark',g);for(let i=0;i<9;i++){const a=i*Math.PI*2/9;rod('dark',[x,.9,-22],[x+Math.cos(a)*.45,1.6+Math.sin(i*2)*.16,-22+Math.sin(a)*.45],.04);}}
 box('roof',-6,36.38,5,12,.65,9);box('metal',-6,36.78,5,10.8,.14,7.8);
 for(const z of [1.1,8.9]){box('metal',-6,37.25,z,10.8,.05,.05);for(let x=-11.4;x<-1;x+=1.35)box('metal',x,36.95,z,.045,.75,.045);}
 for(const [key,geometries] of Object.entries(buckets)){const geometry=mergeGeometries(geometries);if(!geometry)throw new Error(`Saint Kate ${key} merge failed`);const mesh=new THREE.Mesh(geometry,material[key]);mesh.name=['brick','stone'].includes(key)?'BLDG':`saint-kate-${key}`;mesh.userData.part=key;if(key==='grade')mesh.userData.walkingSurface='grade';mesh.castShadow=!['glass','litGlass','neon','neonBack'].includes(key);mesh.receiveShadow=true;root.add(mesh);geometries.forEach(g=>g.dispose());}
 // A small fixed light budget illuminates real portico surfaces. Emissive
 // tubes alone cannot light the canopy, piers or the public approach pavement.
 const entryLights=new THREE.Group();entryLights.name='saint-kate-entry-lights';
 const lamps=[[-6,3.95,-23.5,68,16],[6,3.95,-23.5,68,16],[0,6.05,-28.3,38,13]].map(([x,y,z,power,distance])=>{
  const light=new THREE.PointLight(0xffcf8e,0,distance,2);light.position.set(x,y,z);light.castShadow=false;light.userData.nightPower=power;entryLights.add(light);return light;
 });
 root.add(entryLights);
 root.userData.cornerWindowStations=cornerStations;root.userData.finishedFloor=floor;root.userData.referenceHeight=36.12;root.userData.roomWindows={lit:litRooms,dark:darkRooms};root.userData.signFaces=signFaces;
 root.userData.entrance={facade:'north',localX:.22,doorZ:-20.44,leafCenters:doorCenters,front:front,back:back,calibration};
 root.userData.setLightingMode=(mode:Mode)=>{
  for(const light of lamps){light.visible=mode!=='day';light.intensity=light.userData.nightPower*(mode==='night'?1:mode==='sunset'?.28:0);}
  material.litGlass.emissiveIntensity=mode==='night'?.42:mode==='sunset'?.17:0;material.glass.emissive.setHex(0xd9b483);material.glass.emissiveIntensity=mode==='night'?.025:mode==='sunset'?.01:0;
  material.entryGlass.emissiveIntensity=mode==='night'?.055:mode==='sunset'?.025:0;
  material.warm.emissiveIntensity=mode==='night'?1.7:mode==='sunset'?.7:0;material.wood.emissiveIntensity=mode==='night'?.26:mode==='sunset'?.09:0;
  material.neon.emissiveIntensity=mode==='night'?2.8:mode==='sunset'?1.35:.18;material.neonBack.emissiveIntensity=mode==='night'?.48:mode==='sunset'?.22:0;
 };
 root.userData.setLightingMode('day');return root;
}
