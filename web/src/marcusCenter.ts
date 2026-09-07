import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MARCUS_SITE as site, MARCUS_CANOPY_SITE } from './marcusSite.ts';
type Mode='day'|'sunset'|'night';
/** Photo-proportioned public exterior. +X faces Water Street, +Z faces the lawn.
 * Original materials and geometry; the historic aerial informs masses only. */
export function buildMarcusCenter(groundAt:(x:number,z:number)=>number){
 const root=new THREE.Group();root.name='marcus-center';root.rotation.y=site.bearing;
 const rotate=(x:number,z:number)=>new THREE.Vector3(x,0,z).applyAxisAngle(new THREE.Vector3(0,1,0),site.bearing);
 const entry=rotate(59,0),floor=Math.max(4.72,groundAt(site.x+entry.x,site.z+entry.z)+.12);root.position.set(site.x,floor,site.z);
 const buckets:Record<string,THREE.BufferGeometry[]>={stone:[],washCool:[],washRed:[],washWhite:[],roof:[],recess:[],glass:[],metal:[],warm:[],letters:[],threshold:[]};
 const materials:Record<string,THREE.MeshStandardMaterial>={
  stone:new THREE.MeshStandardMaterial({color:0xd9d6ca,roughness:.91,vertexColors:true}),washCool:new THREE.MeshStandardMaterial({color:0xdfdcd3,roughness:.87,vertexColors:true}),washRed:new THREE.MeshStandardMaterial({color:0xe1dcd0,roughness:.88,vertexColors:true}),washWhite:new THREE.MeshStandardMaterial({color:0xe0ddd3,roughness:.87,vertexColors:true}),
  roof:new THREE.MeshStandardMaterial({color:0x757d7b,roughness:.94,vertexColors:true}),recess:new THREE.MeshStandardMaterial({color:0x656a66,roughness:.95,vertexColors:true}),glass:new THREE.MeshStandardMaterial({color:0x41646a,roughness:.23,metalness:.24,transparent:true,opacity:.79,vertexColors:true}),metal:new THREE.MeshStandardMaterial({color:0x535959,roughness:.54,metalness:.52,vertexColors:true}),warm:new THREE.MeshStandardMaterial({color:0xffd995,emissive:0xffaf45,emissiveIntensity:0,roughness:.6,vertexColors:true}),letters:new THREE.MeshStandardMaterial({color:0xf5f0dd,emissive:0xffeaca,emissiveIntensity:0,roughness:.6,vertexColors:true}),
 };
 materials.threshold=materials.stone;
 let piece=0;
 function add(k:string,g:THREE.BufferGeometry){g.deleteAttribute('uv');const geometry=g.index?g.toNonIndexed():g;if(geometry!==g)g.dispose();const colors=new Float32Array(geometry.getAttribute('position').count*3);colors.fill(.967+Math.sin(++piece*7.13)*.023);geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));buckets[k].push(geometry);}
 function box(k:string,x:number,y:number,z:number,w:number,h:number,d:number){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(k,g);}
 function beam(k:string,a:number[],b:number[],width:number,depth=width){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av);const g=new THREE.BoxGeometry(width,delta.length(),depth);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...av.add(bv).multiplyScalar(.5).toArray());add(k,g);}
 function quad(k:string,a:number[],b:number[],c:number[],d:number[]){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([...a,...b,...c,...a,...c,...d],3));g.computeVertexNormals();add(k,g);}
 const localPoint=(x:number,z:number)=>new THREE.Vector3(x-site.x,0,z-site.z).applyAxisAngle(new THREE.Vector3(0,1,0),-site.bearing);
 // Individual perimeter bottom vertices follow terrain rather than a floating slab.
 const footprint=site.footprint.slice(0,-1).map(([x,z])=>localPoint(x,z));
 for(let i=0;i<footprint.length;i++){const a=footprint[i],b=footprint[(i+1)%footprint.length],aw=rotate(a.x,a.z),bw=rotate(b.x,b.z);const ay=groundAt(site.x+aw.x,site.z+aw.z)-floor-.22,by=groundAt(site.x+bw.x,site.z+bw.z)-floor-.22;quad('stone',[a.x,ay,a.z],[b.x,by,b.z],[b.x,.08,b.z],[a.x,.08,a.z]);}
 // Low hall wings, west fly tower and stepped auditorium are separate masses.
 box('stone',-7,6.9,0,98,14,48);box('roof',-7,14.03,0,98.6,.22,48.6);
 box('stone',-14,25.9,-1,24,24,30);box('roof',-14,38.04,-1,24.5,.22,30.5);
 box('stone',17,21.35,-1,41,14.8,40);box('roof',17,28.84,-1,41.4,.2,40.4);
 box('stone',33,17.2,0,17,7.4,43);box('roof',33,20.97,0,17.4,.18,43.4);
 box('stone',-36,8.2,-17,42,16.5,17);box('roof',-36,16.57,-17,42.4,.20,17.4);
 box('stone',-27,7.9,21,62,15.9,13);box('roof',-27,15.92,21,62.6,.20,13.5);
 // Actual relief joints and subtle per-panel tone variations read in daylight.
 function panels(k:string,axis:'x'|'z',fixed:number,from:number,to:number,b:number,t:number,pw=1.8,ph=2){const cols=Math.ceil((to-from)/pw),rows=Math.ceil((t-b)/ph),w=(to-from)/cols,h=(t-b)/rows;for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const p=from+(col+.5)*w,y=b+(row+.5)*h;if(axis==='x')box(k,fixed,y,p,.075,h-.028,w-.025);else box(k,p,y,fixed,w-.025,h-.028,.075);}}
 for(const x of [-26.045,-1.955])panels('stone','x',x,-16,14,14.1,37.93,1.9,2.1);for(const z of [-16.045,14.045])panels('stone','z',z,-26,-2,14.1,37.93,1.9,2.1);
 panels('washRed','x',37.56,-16.5,14.5,21.2,28.70,1.9,1.9);panels('washCool','x',37.57,-21,-16.5,21.2,28.7);panels('washCool','x',37.57,14.5,19,21.2,28.7);
 for(const z of [-21.05,19.05])panels('stone','z',z,-3.5,37.5,16.1,28.65);panels('stone','x',-56.05,-24,24,.1,13.93);panels('stone','z',-24.06,-55,41,.1,13.9);
 // Paired front fins and taller outer fins, washed by visible roof light bars.
 const finSpecs=[{z:-25.8,x:48.5,w:5.4,d:4.2,h:28.8},{z:25.8,x:48.5,w:5.4,d:4.2,h:28.8},{z:-19.7,x:54,w:5.2,d:5.1,h:22.1},{z:19.7,x:54,w:5.2,d:5.1,h:22.1}];
 for(const f of finSpecs){box('stone',f.x,f.h/2,f.z,f.w,f.h,f.d);panels('washWhite','x',f.x+f.w/2+.045,f.z-f.d/2,f.z+f.d/2,.12,f.h-.08,1.5,1.85);for(const sz of [-1,1])panels('washRed','z',f.z+sz*(f.d/2+.045),f.x-f.w/2,f.x+f.w/2,.12,f.h-.08,1.6,1.85);box('metal',f.x+f.w/2+.72,f.h+.58,f.z,.20,.15,f.d+1.8);for(let z=f.z-f.d/2-.5;z<=f.z+f.d/2+.5;z+=.65){box('letters',f.x+f.w/2+.76,f.h+.46,z,.16,.1,.22);beam('metal',[f.x+f.w/2-.3,f.h+.08,z],[f.x+f.w/2+.75,f.h+.57,z],.065);}}
 // Gently bowed glass entry; facade quads face outward +X.
 const facadeX=(z:number)=>59-.012*z*z;
 for(let i=0;i<20;i++){const za=-18+i*1.8,zb=za+1.8,xa=facadeX(za),xb=facadeX(zb);quad('glass',[xa,.1,za],[xa,18.5,za],[xb,18.5,zb],[xb,.1,zb]);beam('metal',[xa,.1,za],[xa,18.7,za],.14);quad('metal',[xa,18.5,za],[xa,19.55,za],[xb,19.55,zb],[xb,18.5,zb]);for(const y of [4.9,8.3,13.3,18.5])beam('metal',[xa+.03,y,za],[xb+.03,y,zb],.12,.14);if(i%3===0)beam('metal',[xa-.18,8.4,za],[xa-.18,18.4,za-1.65],.095);}
 beam('metal',[facadeX(18),.1,18],[facadeX(18),18.7,18],.14);
 box('recess',46,8.8,0,.25,17.4,36);box('stone',51,8.3,0,14,.3,36);for(const y of [4.35,8.55,15.9])box('warm',49,y,0,.09,.13,35);for(const z of [-15,-9,-3,3,9,15])box('warm',49,11.7,z,.13,6.1,.13);for(const z of [-12,-4,4,12])box('stone',51.5,9.2,z,.3,1.6,.3);
 // Plain original stroke lettering, oriented to read outward on each elevation.
 const strokes:Record<string,number[][][]>={
 A:[[[0,0],[.4,1],[.8,0]],[[.16,.4],[.64,.4]]],C:[[[.8,.88],[.63,1],[.18,1],[0,.8],[0,.2],[.18,0],[.63,0],[.8,.12]]],E:[[[.8,1],[0,1],[0,0],[.8,0]],[[0,.5],[.65,.5]]],F:[[[.8,1],[0,1],[0,0]],[[0,.5],[.65,.5]]],G:[[[.8,.85],[.6,1],[.18,1],[0,.8],[0,.2],[.18,0],[.8,0],[.8,.46],[.45,.46]]],H:[[[0,0],[0,1]],[[.8,0],[.8,1]],[[0,.5],[.8,.5]]],I:[[[.4,0],[.4,1]]],L:[[[0,1],[0,0],[.8,0]]],M:[[[0,0],[0,1],[.4,.45],[.8,1],[.8,0]]],N:[[[0,0],[0,1],[.8,0],[.8,1]]],O:[[[.15,0],[0,.2],[0,.8],[.15,1],[.65,1],[.8,.8],[.8,.2],[.65,0],[.15,0]]],P:[[[0,0],[0,1],[.6,1],[.8,.8],[.8,.65],[.6,.5],[0,.5]]],R:[[[0,0],[0,1],[.6,1],[.8,.8],[.8,.65],[.6,.5],[0,.5]],[[.4,.5],[.8,0]]],S:[[[.8,.9],[.65,1],[.15,1],[0,.85],[0,.65],[.15,.5],[.65,.5],[.8,.35],[.8,.15],[.65,0],[.15,0],[0,.1]]],T:[[[0,1],[.8,1]],[[.4,1],[.4,0]]],U:[[[0,1],[0,.2],[.2,0],[.6,0],[.8,.2],[.8,1]]],V:[[[0,1],[.4,0],[.8,1]]],W:[[[0,1],[.15,0],[.4,.5],[.65,0],[.8,1]]],D:[[[0,0],[0,1],[.55,1],[.8,.75],[.8,.25],[.55,0],[0,0]]],
 };
 function label(text:string,x:number,y:number,z:number,size:number,face:'east'|'south'){let offset=0;for(const char of text){for(const path of strokes[char]??[])for(let i=1;i<path.length;i++){const point=(p:number[])=>face==='east'?[facadeX(z-offset-p[0]*size)+.13,y+p[1]*size,z-offset-p[0]*size]:[x+offset+p[0]*size,y+p[1]*size,z];beam('letters',point(path[i-1]),point(path[i]),size*.07);}offset+=(char===' '?.60:1.03)*size;}}
 label('MARCUS CENTER FOR THE PERFORMING ARTS',55.63,18.72,15.4,.88,'east');
 // Door threshold is just above the measured Water Street public road elevation.
 for(let i=0;i<8;i++){const z=-5.6+i*1.6;box('glass',59.15,2.05,z,.06,3.9,1.47);for(const dz of [-.79,.79])box('metal',59.23,2.1,z+dz,.1,4.1,.1);box('metal',59.23,4.13,z,.1,.12,1.6);box('letters',59.32,1.86,z-.43,.1,.52,.055);}
 box('threshold',59.5,.04,0,2,.12,15);box('metal',60.6,5.65,0,4.5,.2,25);for(let z=-12;z<=12;z+=1.85){beam('stone',[58.25,6.45,z],[63.15,5.55,z],.17,.3);box('warm',61.65,5.48,z,1.9,.08,.1);}for(const z of [-11,11])beam('metal',[56.2,10,z],[63,5.68,z],.095);
 // A short public approach joins the shipped sidewalk grade to the threshold.
 // This is a walking surface, not another closed building collision volume.
 for(let column=0;column<6;column++)for(let row=0;row<4;row++){
  const za=-7.5+column*2.5,zb=za+2.5,xa=65-row*1.125,xb=xa-1.125;
  const grade=(x:number,z:number)=>{const outer=rotate(65,z),y=groundAt(site.x+outer.x,site.z+outer.z)-floor+.02;return THREE.MathUtils.lerp(y,.10,(65-x)/4.5);};
  quad('threshold',[xa,grade(xa,za),za],[xb,grade(xb,za),za],[xb,grade(xb,zb),zb],[xa,grade(xa,zb),zb]);
 }
 // South hall: recessed glazing, broad overhang, repeated tall fins, clerestory.
 box('recess',-26,4.6,27.54,62,8,.14);box('glass',-26,4.5,27.65,61.5,7.8,.05);for(let x=-55;x<5;x+=3.1){box('stone',x,5.1,28.15,.43,10.2,1);box('metal',x+1.3,4.5,27.75,.08,8,.07);}box('stone',-26,11.8,28,63,3.5,2.5);for(let x=-55;x<5;x+=1.55){box('glass',x,13.76,27.69,.83,1.1,.05);box('stone',x+.6,13.9,27.9,.19,1.5,.54);}
 // Shallow curved Vogel/Todd Wehr public glazing, based on reference 03.
 for(let i=0;i<22;i++){const xa=-46+i*2.15,xb=xa+2.15,za=28.5+2*Math.sin((xa+46)/47.3*Math.PI),zb=28.5+2*Math.sin((xb+46)/47.3*Math.PI);quad('glass',[xa,.15,za],[xb,.15,zb],[xb,6,zb],[xa,6,za]);beam('metal',[xa,.15,za],[xa,6.45,za],.09);beam('stone',[xa,6,za],[xb,6,zb],.17,.2);beam('metal',[xa,3.1,za],[xb,3.1,zb],.065);}
 label('VOGEL HALL',-52.5,3.8,28.76,.56,'south');label('TODD WEHR THEATER',-34,4.6,30.55,.52,'south');for(const x of [-50,-30,-27]){box('metal',x,1.75,28,2.1,3.5,.12);box('glass',x,1.75,28.1,1.84,3.19,.04);}
 // Southwest L-shaped entry canopy preserves the independently mapped footprint.
 const canopy=MARCUS_CANOPY_SITE.footprint.slice(0,-1).map(([x,z])=>localPoint(x,z)),shape=new THREE.Shape();canopy.forEach((v,i)=>i?shape.lineTo(v.x,-v.z):shape.moveTo(v.x,-v.z));shape.closePath();const canopyGeometry=new THREE.ExtrudeGeometry(shape,{depth:.24,bevelEnabled:false});canopyGeometry.rotateX(-Math.PI/2);canopyGeometry.translate(0,4.05,0);add('stone',canopyGeometry);for(const index of [0,1,2,4]){const p=canopy[index],w=rotate(p.x,p.z),bottom=groundAt(site.x+w.x,site.z+w.z)-floor;box('stone',p.x,(4.05+bottom)/2,p.z,.28,4.05-bottom,.28);}
 for(const [x,z,w,d,h] of [[-12,-2,9,9,38.25],[-35,-17,7,6,16.9],[13,-3,8,6,29.1]]){box('roof',x,h,z,w,.55,d);for(let i=0;i<5;i++)box('metal',x-w/2+.7+i*w/5,h+.35,z,.09,.22,d-.35);}
 // Continuous color/intensity falloff is carried by vertices, so no extra lights
 // or per-panel draw calls are needed. White fin centers fade into blue edges.
 const daylightColors=Object.fromEntries(Object.entries(materials).map(([key,material])=>[key,material.color.clone()]));
 for(const [key,geometries] of Object.entries(buckets)){
  const geometry=mergeGeometries(geometries);if(!geometry)throw new Error(`Marcus ${key} merge failed`);
  if(key.startsWith('wash')){
   const position=geometry.getAttribute('position'),wash=new Float32Array(position.count*3);
   for(let i=0;i<position.count;i++){
    const x=position.getX(i),y=position.getY(i),z=position.getZ(i);
    const fin=finSpecs.reduce((closest,f)=>Math.abs(z-f.z)<Math.abs(z-closest.z)?f:closest,finSpecs[0]);
    let r=1,g=1,b=1,strength=1;
    if(key==='washWhite'){
     const u=Math.min(1,Math.abs(z-fin.z)/(fin.d/2)),v=THREE.MathUtils.clamp(y/fin.h,0,1);
     const center=Math.exp(-Math.pow(u/.72,4));
     r=.14+.86*center;g=.20+.80*center;b=1;
     strength=(.20+.91*Math.pow(v,.65))*(.96+.04*Math.cos(y*1.05));
    }else if(key==='washRed'){
     const v=x<42?THREE.MathUtils.clamp((y-21.2)/7.5,0,1):THREE.MathUtils.clamp(y/fin.h,0,1);
     strength=x<42?.55+.45*Math.pow(v,.65):.13+.80*Math.pow(v,.72);
     strength*=.95+.05*Math.cos(z*1.9);
    }else{
     const v=THREE.MathUtils.clamp((y-21.2)/7.5,0,1);strength=.32+.76*Math.pow(v,.7);
    }
    wash.set([r*strength,g*strength,b*strength],i*3);
   }
   geometry.setAttribute('facadeWash',new THREE.BufferAttribute(wash,3));
   materials[key].onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 facadeWash;\nvarying vec3 vFacadeWash;').replace('#include <begin_vertex>','#include <begin_vertex>\nvFacadeWash = facadeWash;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vFacadeWash;').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vFacadeWash;');
   };
   materials[key].customProgramCacheKey=()=> 'marcus-facade-wash-v1';
  }
  const mesh=new THREE.Mesh(geometry,materials[key]);mesh.name=['stone','washCool','washRed','washWhite'].includes(key)?'BLDG':`marcus-${key}`;mesh.userData.part=key;if(key==='threshold'){mesh.name='marcus-entrance-threshold';mesh.userData.walkingSurface='grade';}mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);geometries.forEach(g=>g.dispose());
 }
 root.userData.finishedFloor=floor;root.userData.facade='east';root.userData.entryLocal=[59,0,0];root.userData.facadeLighting=['washCool','washRed','washWhite'];
 root.userData.setLightingMode=(mode:Mode)=>{
  for(const key of ['washCool','washRed','washWhite']){
   const material=materials[key],toneMapped=mode!=='night';
   material.color.copy(mode==='night'?new THREE.Color(0x252529):daylightColors[key]);
   if(material.toneMapped!==toneMapped){material.toneMapped=toneMapped;material.needsUpdate=true;}
  }
  materials.washCool.emissive.setHex(mode==='sunset'?0x8968bd:0x263dff);materials.washCool.emissiveIntensity=mode==='night'?1.08:mode==='sunset'?.25:0;
  materials.washRed.emissive.setHex(mode==='sunset'?0xff582c:0xff0003);materials.washRed.emissiveIntensity=mode==='night'?1.40:mode==='sunset'?.33:0;
  materials.washWhite.emissive.setHex(mode==='sunset'?0xffc680:0xffffff);materials.washWhite.emissiveIntensity=mode==='night'?1:mode==='sunset'?.28:0;
  // Glass stays transparent enough to distinguish warm foyer rails and light bands.
  materials.glass.color.copy(mode==='night'?new THREE.Color(0x182c33):daylightColors.glass);materials.glass.opacity=mode==='night'?.51:.79;
  materials.glass.emissive.setHex(0xffb655);materials.glass.emissiveIntensity=mode==='night'?.08:mode==='sunset'?.07:0;
  materials.recess.emissive.setHex(0xffa64d);materials.recess.emissiveIntensity=mode==='night'?.17:mode==='sunset'?.065:0;
  materials.warm.emissiveIntensity=mode==='night'?2.2:mode==='sunset'?.9:0;materials.letters.emissiveIntensity=mode==='night'?1:mode==='sunset'?.3:0;
 };
 root.userData.setLightingMode('day');return root;
}
