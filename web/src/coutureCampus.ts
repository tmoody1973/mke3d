import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCoutureTower } from './couture.ts';
import { COUTURE_SITE as SITE } from './coutureSite.ts';

type XZ = readonly [number, number];
type Part = THREE.BufferGeometry;
const local = ([x,z]: XZ): [number,number] => [x-SITE.x,z-SITE.z];
function slab(points: readonly XZ[], bottom: number, top: number): Part {
  const shape=new THREE.Shape();
  points.forEach((point,i)=>{const [x,z]=local(point);if(i)shape.lineTo(x,-z);else shape.moveTo(x,-z);});
  shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:top-bottom,bevelEnabled:false,steps:1});
  geometry.rotateX(-Math.PI/2);geometry.translate(0,bottom,0);return geometry;
}
function box(width:number,height:number,depth:number,x:number,y:number,z:number):Part {
  const g=new THREE.BoxGeometry(width,height,depth);g.translate(x-SITE.x,y,z-SITE.z);return g;
}
function edge(a:XZ,b:XZ,y:number,width:number,height:number):Part {
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  const g=new THREE.BoxGeometry(length,height,width);
  g.rotateY(-Math.atan2(b[1]-a[1],b[0]-a[0]));
  g.translate((a[0]+b[0])/2-SITE.x,y,(a[1]+b[1])/2-SITE.z);return g;
}
function segments(points:readonly XZ[],fn:(a:XZ,b:XZ)=>void){
  for(let i=0;i<points.length;i++){
    const a=points[i],b=points[(i+1)%points.length];
    if(Math.hypot(b[0]-a[0],b[1]-a[1])>.1)fn(a,b);
  }
}
function add(root:THREE.Group,parts:Part[],material:THREE.Material,name:string){
  if(!parts.length)return;
  const flat=parts.map(g=>{const p=g.index?g.toNonIndexed():g.clone();p.deleteAttribute('uv');return p;});
  const geometry=mergeGeometries(flat,false)!;
  geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  parts.forEach(g=>g.dispose());flat.forEach(g=>g.dispose());return mesh;
}

/** Mapped Couture building parts, with a real open L-Line concourse.
 * Podium floors, framing, roof garden and finishes are photographic estimates.
 * Ground-to-crown height160m is approximate; engineer537ft includes foundations.
 */
export function buildCouture(groundAt:(x:number,z:number)=>number):THREE.Group {
  const root=new THREE.Group();root.name='the-couture';root.position.set(SITE.x,SITE.floor,SITE.z);
  const tower=buildCoutureTower({width:SITE.towerWidth,depth:SITE.towerDepth,height:160});
  tower.rotation.y=SITE.bearing;root.add(tower);
  const stone=new THREE.MeshStandardMaterial({color:0xc7cdca,roughness:.79});
  const metal=new THREE.MeshStandardMaterial({color:0x8b999c,metalness:.45,roughness:.4});
  const glass=new THREE.MeshStandardMaterial({color:0x41616c,metalness:.25,roughness:.3});
  const shade=new THREE.MeshStandardMaterial({color:0x202c30,roughness:.85});
  const paving=new THREE.MeshStandardMaterial({color:0x8c9291,roughness:.98});
  const planted=new THREE.MeshStandardMaterial({color:0x59674c,roughness:1});
  const lit=new THREE.MeshStandardMaterial({color:0xc8cbb7,emissive:0xffe6be,emissiveIntensity:0,roughness:.7});
  const concrete:Part[]=[],frames:Part[]=[],windows:Part[]=[],dark:Part[]=[],floor:Part[]=[],greens:Part[]=[],lamps:Part[]=[];
  const {garage,eastPodium,southTerrace,lowTerrace,concourseRoof,westCore}=SITE.parts;

  // Keep each mapped part at its own height; never extrude the full parent to tower height.
  for(const [part,height] of [[eastPodium,10.1],[southTerrace,13.5],[lowTerrace,6.8],[westCore,13.0]] as const){
    windows.push(slab(part.footprint,.08,height));
    concrete.push(slab(part.footprint,height,height+.3));
    const bottom=Math.min(0,...part.footprint.map(([x,z])=>groundAt(x,z)-SITE.floor))-.12;
    concrete.push(slab(part.footprint,bottom,.08));
    segments(part.footprint,(a,b)=>{
      const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      const n=Math.max(1,Math.ceil(length/2.3));
      for(let i=0;i<n;i++){
        const t=i/n,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
        frames.push(box(.11,height,.11,x,height/2,z));
      }
      for(let y=3.35;y<height;y+=3.35)frames.push(edge(a,b,y,.15,.18));
      concrete.push(edge(a,b,.32,.22,.35));
    });
  }

  // Three open parking levels west of the tram hall, with horizontal screen rails.
  const garageBottom=Math.min(0,...garage.footprint.map(([x,z])=>groundAt(x,z)-SITE.floor))-.12;
  concrete.push(slab(garage.footprint,garageBottom,.06));
  for(const y of [3.3,6.6,9.9])concrete.push(slab(garage.footprint,y,y+.28));
  segments(garage.footprint,(a,b)=>{
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(length/9));
    for(let i=0;i<n;i++){
      const t=i/n,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
      concrete.push(box(.55,10.1,.55,x,5.05,z));
    }
    for(const y of [.3,3.6,6.9]){
      dark.push(edge(a,b,y+.48,.14,.9));
      for(let dy=.12;dy<.9;dy+=.19)frames.push(edge(a,b,y+dy,.18,.045));
    }
    frames.push(edge(a,b,10.65,.08,.07));
  });

  // The overhead slab spans the mapped hall but has no ground-level end walls.
  const ceiling=SITE.transit.ceilingY-SITE.floor+.6;
  concrete.push(slab(concourseRoof.footprint,ceiling,ceiling+.65));
  const north=SITE.transit.north,south=SITE.transit.south;
  const dx=south[0]-north[0],dz=south[1]-north[1],length=Math.hypot(dx,dz),nx=dz/length,nz=-dx/length;
  const onRoute=(t:number,offset:number):XZ=>[north[0]+dx*t+nx*offset,north[1]+dz*t+nz*offset];
  for(let t=.1;t<.96;t+=.16){
    const a=onRoute(t,-5.7),b=onRoute(t,5.7);
    concrete.push(edge(a,b,ceiling-.25,.34,.5));
    lamps.push(edge(onRoute(t,-1.8),onRoute(t,1.8),ceiling-.53,.10,.06));
  }
  // Follow the same sampled rail gradient; paving stays below the railhead.
  for(let i=0;i<18;i++){
    const t=i/18,u=(i+1)/18,a=onRoute(t,-4.9),b=onRoute(t,4.9),c=onRoute(u,4.9),d=onRoute(u,-4.9);
    const ya=SITE.transit.northRailY+(SITE.transit.southRailY-SITE.transit.northRailY)*t-SITE.floor-.11;
    const yb=SITE.transit.northRailY+(SITE.transit.southRailY-SITE.transit.northRailY)*u-SITE.floor-.11;
    const p=(point:XZ,y:number)=>{const [x,z]=local(point);return [x,y,z];};
    const vertices=[...p(a,ya),...p(c,yb),...p(b,ya),...p(a,ya),...p(d,yb),...p(c,yb)];
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();floor.push(g);
  }
  // Roof-terrace planters sit on the lower podium, outside the rail passage.
  for(const [x,z] of [[429,-211],[435,-213],[439,-218]]){
    concrete.push(box(3,.5,2,x,14.05,z));greens.push(box(2.65,.22,1.65,x,14.4,z));
  }
  add(root,concrete,stone,'couture-podium-slabs-columns');
  add(root,frames,metal,'couture-podium-mullions-garage-screens');
  add(root,windows,glass,'couture-podium-glazed-volumes');
  add(root,dark,shade,'couture-garage-open-bays');
  add(root,floor,paving,'couture-concourse-paving');
  add(root,greens,planted,'couture-roof-terrace-planting');
  const fixtures=add(root,lamps,lit,'couture-concourse-ceiling-light-strips');
  if(fixtures)fixtures.castShadow=false;
  root.userData.setLightingMode=(mode:'day'|'sunset'|'night')=>{
    tower.userData.setMode(mode);lit.emissiveIntensity=mode==='night'?.55:mode==='sunset'?.22:0;
    glass.emissive.setHex(mode==='night'?0x1c302b:0x000000);glass.emissiveIntensity=mode==='night'?.12:0;
  };
  root.userData.setLightingMode('day');
  root.userData.source='Mapped OSM building parts and supplied Couture photographs';
  return root;
}
