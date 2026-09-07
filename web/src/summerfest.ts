import * as THREE from 'three';
import {buildSkyglider,distanceToSkygliderRoute} from './skyglider.ts';
import {districtGeometry} from './districtGeometry.ts';
import {buildSummerfestVenue} from './summerfestVenues.ts';
import {SUMMERFEST_VENUES,withinSummerfest} from './summerfestSite.ts';
import {SUMMERFEST_BOUNDARY,SUMMERFEST_BUILDINGS,SUMMERFEST_PATHS,SUMMERFEST_GREEN_AREAS} from './summerfestSiteData.ts';
type Point=readonly [number,number];

export function buildSummerfest(groundAt:(x:number,z:number)=>number){
 const root=new THREE.Group();root.name='summerfest-grounds';
 const skyglider=buildSkyglider(groundAt);root.add(skyglider);
 root.userData.update=(dt:number,reducedMotion=false)=>skyglider.userData.update(dt,reducedMotion);
 root.userData.dispose=()=>skyglider.userData.dispose();
 const b=districtGeometry(root);
 const material=(color:number)=>new THREE.MeshStandardMaterial({color,roughness:.86});
 const paving=material(0xbab7a8),brick=material(0x926849),roof=material(0x67716e),metal=material(0x485353),wood=material(0x886444),grass=material(0x6f8051),leaf=material(0x59733e),glass=material(0x263b40),red=material(0xaf5444),cream=material(0xdedbd0);
 const glow=new THREE.MeshStandardMaterial({color:0xffd79c,emissive:0xffb958,emissiveIntensity:0,roughness:.65});
 const counterGlow=new THREE.MeshStandardMaterial({color:0x746957,emissive:0xffb65e,emissiveIntensity:0});
 const venues=SUMMERFEST_VENUES.map(s=>{
  const venue=buildSummerfestVenue(s.id,s.width,s.depth);venue.name=`summerfest-${s.id}`;venue.userData.label=s.name;
  venue.position.set(s.x,groundAt(s.x,s.z)+.16,s.z);venue.rotation.y=s.bearing;root.add(venue);return venue;
 });
 const replaced=new Set<number>(SUMMERFEST_VENUES.map(s=>s.sourceId));
 const gates=new Set([597941292,597941293,597941295]);
 function polygon(points:readonly Point[],y:number|((x:number,z:number)=>number),m:THREE.Material,name:string){
  const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z)));
  const geo=new THREE.ShapeGeometry(shape);geo.rotateX(-Math.PI/2);
  const p=geo.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,typeof y==='number'?y:y(p.getX(i),p.getZ(i)));
  geo.computeVertexNormals();b.add(geo,m,name);
 }
 function solid(points:readonly Point[],floor:number,height:number,m:THREE.Material,name:string){
  const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z)));
  const geo=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false});geo.rotateX(-Math.PI/2);geo.translate(0,floor,0);b.add(geo,m,name);
 }
 // Keep mapped concession/restroom footprints, replacing featureless extrusions
 // with low service counters, cornices, awnings and open-sided shelter frames.
 for(const s of SUMMERFEST_BUILDINGS){
  if(replaced.has(s.id)||gates.has(s.id))continue;
  const [x,z]=s.center,floor=groundAt(x,z)+.1;
  const height=Math.max(3,Math.min(9,s.height-1.5));
  if(s.roof){
   polygon(s.footprint,floor+height,roof,'festival-shelter-roofs');
   for(const [px,pz] of s.footprint.filter((_,i)=>i%2===0))b.cylinder(px,floor+height/2,pz,.15,height,metal,'shelter-columns',6);
  }else{
   solid(s.footprint,floor,height,s.id%3?brick:cream,'mapped-festival-service-buildings');
   polygon(s.footprint,floor+height+.08,roof,'festival-service-roofs');
   const winding=Math.sign(s.footprint.reduce((sum,p,i)=>{const q=s.footprint[(i+1)%s.footprint.length];return sum+p[0]*q[1]-q[0]*p[1];},0))||1;
   // Counter bays on long straight walls, inset at corners.
   for(let i=1;i<s.footprint.length;i++){
    const a=s.footprint[i-1],c=s.footprint[i],dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz);
    if(length<6||length>65)continue;
    const nx=dz/length*winding,nz=-dx/length*winding;
    for(let d=3;d<length-1.5;d+=5){
     const px=a[0]+dx*d/length,pz=a[1]+dz*d/length;
     const g=new THREE.BoxGeometry(2.5,1.65,.1);g.rotateY(-Math.atan2(dz,dx));g.translate(px+nx*.09,floor+2.05,pz+nz*.09);b.add(g,s.id%3?counterGlow:glass,'concession-counter-windows');
     const awning=new THREE.BoxGeometry(3.2,.2,1.35);awning.rotateY(-Math.atan2(dz,dx));awning.translate(px+nx*.55,floor+3.1,pz+nz*.55);b.add(awning,roof,'concession-awnings');
    }
   }
  }
 }
 function path(points:readonly Point[],width:number,m=paving){
  for(let k=1;k<points.length;k++){
   const a=points[k-1],c=points[k],dx=c[0]-a[0],dz=c[1]-a[1],length=Math.hypot(dx,dz);if(length<.1)continue;
   const nx=dz/length*width/2,nz=-dx/length*width/2,steps=Math.ceil(length/8);
   for(let j=0;j<steps;j++){
    const p=[a[0]+dx*j/steps,a[1]+dz*j/steps],q=[a[0]+dx*(j+1)/steps,a[1]+dz*(j+1)/steps];
    polygon([[p[0]+nx,p[1]+nz],[p[0]-nx,p[1]-nz],[q[0]-nx,q[1]-nz],[q[0]+nx,q[1]+nz]],(x,z)=>groundAt(x,z)+.15,m,'festival-promenades');
   }
  }
 }
 for(const p of SUMMERFEST_PATHS)path(p.points,p.width);
 // East edge follows the park boundary; its inset is the public lake walk.
 function shoreX(z:number){
  const xs:number[]=[];
  for(let i=1;i<SUMMERFEST_BOUNDARY.length;i++){
   const a=SUMMERFEST_BOUNDARY[i-1],c=SUMMERFEST_BOUNDARY[i];if((a[1]>z)!==(c[1]>z))xs.push(a[0]+(c[0]-a[0])*(z-a[1])/(c[1]-a[1]));
  }return Math.max(...xs);
 }
 const lakeside:Point[]=[];for(let z=-32;z<=635;z+=14)lakeside.push([shoreX(z)-7,z]);path(lakeside,5.5);
 const blocked=(x:number,z:number,margin=2)=>SUMMERFEST_BUILDINGS.some(s=>{
  const xs=s.footprint.map(p=>p[0]),zs=s.footprint.map(p=>p[1]);return x>Math.min(...xs)-margin&&x<Math.max(...xs)+margin&&z>Math.min(...zs)-margin&&z<Math.max(...zs)+margin;
 });
 let trees=0;
 function tree(x:number,z:number){
  if(!withinSummerfest(x,z)||blocked(x,z,4)||distanceToSkygliderRoute(x,z)<6)return;
  const y=groundAt(x,z);b.cylinder(x,y+2.2,z,.22,4.4,wood,'festival-tree-trunks',7);
  b.add(new THREE.IcosahedronGeometry(3.7,1).scale(1,1.15,1).translate(x,y+5.5,z),leaf,'festival-tree-canopies');trees++;
 }
 for(const area of SUMMERFEST_GREEN_AREAS){
  if(area.name.includes('Sports')||area.name.includes('Fountain'))continue;
  polygon(area.footprint,(x,z)=>groundAt(x,z)+.13,grass,'festival-lawns');
  const pts=area.footprint,cx=pts.reduce((s,p)=>s+p[0],0)/pts.length,cz=pts.reduce((s,p)=>s+p[1],0)/pts.length;
  if(cz>760)continue;
  tree(cx,cz);if(pts.length>8){tree(cx-5,cz+4);tree(cx+5,cz-4);}
 }
 for(let z=0;z<630;z+=28)tree(shoreX(z)-17,z);
 function bench(x:number,z:number){const y=groundAt(x,z);b.box(x,y+.52,z,2.6,.15,.65,wood,'festival-benches');b.box(x,y+.95,z-.33,2.6,.65,.12,wood,'festival-bench-backs');for(const dx of [-.95,.95])b.box(x+dx,y+.23,z,.15,.45,.55,metal,'bench-supports');}
 for(let z=0;z<620;z+=28){const x=shoreX(z)-11;bench(x,z);}
 function table(x:number,z:number){const y=groundAt(x,z);b.box(x,y+.78,z,2.4,.12,1.1,wood,'picnic-tables');for(const dz of [-.85,.85]){b.box(x,y+.48,z+dz,2.4,.12,.3,red,'picnic-seats');for(const dx of [-.8,.8])b.box(x+dx,y+.24,z+dz,.12,.45,.3,metal,'table-feet');}}
 for(const [x,z] of [[567,205],[587,400],[545,585],[506,235],[579,112],[594,624]])for(let k=0;k<4;k++){const px=x+(k%2)*5,pz=z+Math.floor(k/2)*5;if(!blocked(px,pz,1)&&withinSummerfest(px,pz))table(px,pz);}
 // Community park: low colorful play structures among existing mapped shelters.
 const playBlue=material(0x478792),playGold=material(0xddb858);
 for(const [x,z,r] of [[520,284,4],[530,301,3.6],[511,312,3]]){
  const y=groundAt(x,z);b.cylinder(x,y+.12,z,r+2,.15,playBlue,'playground-rubber-surfacing',18);
  for(const dx of [-1.4,1.4])for(const dz of [-1.4,1.4])b.cylinder(x+dx,y+1.5,z+dz,.1,3,metal,'play-tower-columns',6);
  b.box(x,y+1.5,z,3,.25,3,playGold,'play-platforms');
  b.add(new THREE.ConeGeometry(2.7,1.4,4).rotateY(Math.PI/4).translate(x,y+3.5,z),playBlue,'play-tower-roofs');
  b.beam(new THREE.Vector3(x+1.3,y+1.5,z),new THREE.Vector3(x+5,y+.2,z),1.1,playGold,'playground-slides');
 }
 // Three public entrances, each with an open structural portal.
 for(const [x,z,w,angle] of [[523,-57,36,0],[462,211,25,Math.PI/2],[398,654,24,Math.PI/2]]){
  const gate=new THREE.Group();gate.name='summerfest-entry-gate';gate.position.set(x,groundAt(x,z),z);gate.rotation.y=angle;const g=districtGeometry(gate);
  for(const dx of [-w/2,w/2])g.box(dx,3.5,0,1.4,7,1.4,brick,'entry-piers');g.box(0,6.6,0,w+3,.8,3.5,metal,'entry-canopy');
  for(let dx=-w/2+3;dx<w/2;dx+=3)g.cylinder(dx,.6,0,.12,1.2,metal,'entry-bollards',6);
  g.box(0,6.1,-1.8,w-2,.1,.1,glow,'entry-light-strip');g.finish();root.add(gate);
 }
 const lampPoints:Point[]=[];
 function lamp(x:number,z:number){
  if(!withinSummerfest(x,z)||blocked(x,z,1)||lampPoints.some(p=>Math.hypot(p[0]-x,p[1]-z)<16))return;
  const y=groundAt(x,z);b.cylinder(x,y+3.7,z,.12,7.4,metal,'promenade-light-poles',6);b.box(x,y+7.5,z,.8,.18,.8,metal,'promenade-lamp-caps');b.box(x,y+7.35,z,.65,.18,.65,glow,'promenade-lamp-lenses');lampPoints.push([x,z]);
 }
 for(let z=-20;z<645;z+=30)lamp(shoreX(z)-4,z);
 for(const p of SUMMERFEST_PATHS){let length=0;for(let k=1;k<p.points.length;k++){const a=p.points[k-1],c=p.points[k],d=Math.hypot(c[0]-a[0],c[1]-a[1]);length+=d;if(length>35){lamp(c[0]+2,c[1]);length=0;}}}
 // Small string lights in a few gathering spaces, with a gentle catenary sag.
 for(const [x,z] of [[566,208],[550,580],[513,230]]){
  for(const dx of [0,24])b.cylinder(x+dx,groundAt(x+dx,z)+4.2,z,.09,8.4,metal,'string-light-poles',6);
  for(let k=0;k<24;k++){
   const y=(u:number)=>groundAt(x+u,z)+8.3-1.15*Math.sin(u/24*Math.PI);
   b.beam(new THREE.Vector3(x+k,y(k),z),new THREE.Vector3(x+k+1,y(k+1),z),.025,metal,'string-light-cables');
   if(k%2===0)b.add(new THREE.SphereGeometry(.11,6,4).translate(x+k,y(k)-.14,z),glow,'string-light-bulbs');
  }
 }
 b.finish();
 // Batched radial light pools provide local path illumination without adding
 // dozens of dynamic lights to every building shader in the city.
 const size=32,rgba=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,r=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1);rgba[i]=255;rgba[i+1]=205;rgba[i+2]=128;rgba[i+3]=Math.round(90*Math.max(0,1-r)**2);}
 const texture=new THREE.DataTexture(rgba,size,size);texture.needsUpdate=true;
 const poolMat=new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0});
 const pools=new THREE.InstancedMesh(new THREE.PlaneGeometry(17,17).rotateX(-Math.PI/2),poolMat,lampPoints.length);pools.name='warm-walkway-light-pools';
 lampPoints.forEach(([x,z],i)=>pools.setMatrixAt(i,new THREE.Matrix4().makeTranslation(x,groundAt(x,z)+.24,z)));root.add(pools);
 root.userData.setLightingMode=(mode:'day'|'sunset'|'night')=>{
  const level=mode==='night'?1:mode==='sunset'?.45:0;
  glow.emissiveIntensity=level*2.5;counterGlow.emissiveIntensity=level*1.15;poolMat.opacity=level; pools.visible=level>0;
  skyglider.userData.setLightingMode(mode);
  venues.forEach(v=>v.userData.setLightingMode(mode));root.userData.lightingMode=mode;
 };
 root.userData.setLightingMode('day');
 root.userData.stats={skyglider:skyglider.userData.stats,venues:venues.length,mappedBuildings:SUMMERFEST_BUILDINGS.length,paths:SUMMERFEST_PATHS.length,trees,lamps:lampPoints.length};
 return root;
}
