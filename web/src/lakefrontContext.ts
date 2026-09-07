import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAMPUS_CONTEXT } from './campusContextData.ts';

export const PARK_DECK_Y = 10.7;
type XZ = number[];

/** The garage is missing from building-tag geometry: its roof is mapped as Museum Center Park. */
export function buildLakefrontContext(groundAt: (x:number,z:number)=>number) {
  const root=new THREE.Group();root.name='museum-lakefront-context';
  const concrete=new THREE.MeshLambertMaterial({color:0xcac9c0});
  const paving=new THREE.MeshLambertMaterial({color:0xb2aba0});
  const lawn=new THREE.MeshLambertMaterial({color:0x67805c});
  const asphalt=new THREE.MeshLambertMaterial({color:0x595e5c});
  const metal=new THREE.MeshLambertMaterial({color:0x46534f});
  const white=new THREE.MeshLambertMaterial({color:0xe2ddd0});
  const trunk=new THREE.MeshLambertMaterial({color:0x6d6556});
  const parts=new Map<THREE.Material,THREE.BufferGeometry[]>();
  function add(g:THREE.BufferGeometry,m:THREE.Material){g.deleteAttribute('uv');const list=parts.get(m)||[];list.push(g.index?g.toNonIndexed():g);if(g.index)g.dispose();parts.set(m,list);}
  function box(x:number,y:number,z:number,w:number,h:number,d:number,m=concrete){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,m);}
  function polygon(points:XZ[],y:number,depth:number,m:THREE.Material) {
    const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z)));
    const g=depth>0?new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false}):new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI/2);g.translate(0,y,0);add(g,m);
  }
  function strip(a:XZ,b:XZ,width:number,y:number,m:THREE.Material) {
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.01)return;
    const g=new THREE.BoxGeometry(length,.06,width);g.rotateY(-Math.atan2(dz,dx));g.translate((a[0]+b[0])/2,y,(a[1]+b[1])/2);add(g,m);
  }
  // Two open parking levels beneath the mapped raised park; western portions disappear into the bluff.
  const garage=new THREE.Group();garage.name='museum-center-park-garage';root.add(garage);
  for(const y of [4.0,7.25,PARK_DECK_Y-.35])polygon(CAMPUS_CONTEXT.park,y,.35,concrete);
  polygon(CAMPUS_CONTEXT.park,PARK_DECK_Y,.08,paving);
  const edge=[[523.2,-588.3],[526.2,-540],[531.7,-480],[537,-465],[532,-448],[533,-425],[527,-393],[518,-367],[506,-344],[489,-312]];
  for(let i=0;i<edge.length-1;i++){
    const a=edge[i],b=edge[i+1],length=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.ceil(length/7.5);
    for(let j=0;j<n;j++){
      const x=a[0]+(b[0]-a[0])*j/n,z=a[1]+(b[1]-a[1])*j/n;
      const base=Math.min(groundAt(x,z)-.4,4);box(x,(base+PARK_DECK_Y)/2,z,.75,PARK_DECK_Y-base,.85);
    }
    // A low continuous fascia and finer dark rails expose the long open parking slots.
    for(const y of [4.5,7.75,10.92])strip(a,b,.35,y,concrete);
    for(const y of [5.05,8.3])strip(a,b,.10,y,metal);
    if(i!==2&&i!==3)strip(a,b,.1,11.48,metal);
  }
  for(const z of [-561,-515,-410,-375]){
    const x=z< -450?520:523;
    // Short flights lead from the lower sidewalk toward an upper parking landing.
    for(let step=0;step<15;step++)box(x+4,4+step*.23,z+step*.5,2.4,.23,.52,concrete);
    box(x+4,7.32,z+7.6,3,.24,3,concrete);
  }
  // Source paths are lifted with the rooftop rather than left buried in its solid terrain surface.
  for(const path of CAMPUS_CONTEXT.paths)for(let i=0;i<path.length-1;i++)strip(path[i],path[i+1],2.25,PARK_DECK_Y+.14,white);
  const greens:number[]=[];
  for(const patch of CAMPUS_CONTEXT.grass){
    const tri=patch.points.map(([x,z])=>[x,patch.raised?PARK_DECK_Y+.19:groundAt(x,z)+.13,z]);
    // Source rings use northing; reverse when mapped to the scene's south-positive Z.
    greens.push(...tri[0],...tri[2],...tri[1]);
  }
  const greenGeometry=new THREE.BufferGeometry();greenGeometry.setAttribute('position',new THREE.Float32BufferAttribute(greens,3));greenGeometry.computeVertexNormals();
  lawn.side=THREE.DoubleSide;add(greenGeometry,lawn);

  // The north surface lot follows the visible footprint in the supplied aerial; stall counts are interpretive.
  const lotY=groundAt(679,-708)+.16;
  polygon([[618,-657],[727,-657],[730,-762],[670,-777],[646,-757],[630,-717]],lotY,0,asphalt);
  for(const z of [-675,-701,-728,-752])for(let x=653;x<=714;x+=2.8){
    if(z===-752&&x<675)continue;
    strip([x,z],[x,z+5.1],.13,lotY+.09,white);
  }
  for(const [x,z] of [[657,-675],[671,-675],[693,-675],[708,-675],[665,-701],[685,-701],[702,-701],[657,-728],[680,-728],[713,-728],[696,-752],[710,-752]]) {
    box(x+1.4,lotY+.65,z+2.6,1.8,1.15,4.15,metal);
    box(x+1.4,lotY+1.42,z+2.8,1.52,.5,2.05,asphalt);
  }
  for(const z of [-678,-720,-753])box(683,lotY+.12,z,45,.20,1.6,lawn);
  // A paved lakeside promenade and the formal lawn edges visibly connect the museum generations.
  for(const [a,b] of [[[713,-780],[739,-646]],[[739,-646],[718,-580]],[[718,-580],[697,-483]],[[697,-483],[685,-424]]] as [XZ,XZ][])
    strip(a,b,4.5,groundAt((a[0]+b[0])/2,(a[1]+b[1])/2)+.14,paving);

  for(const [x,z,raised,height] of CAMPUS_CONTEXT.trees){
    const xx=Number(x),zz=Number(z),h=Number(height),floor=raised?PARK_DECK_Y+.15:groundAt(xx,zz);
    const stem=new THREE.CylinderGeometry(.17,.25,h*.65,5);stem.translate(xx,floor+h*.325,zz);add(stem,trunk);
    const crown=new THREE.IcosahedronGeometry(h*.40,1);crown.scale(1,.9,1);crown.translate(xx,floor+h*.7,zz);add(crown,lawn);
  }
  // Repeated small lamps provide scale along the plaza without covering the skyline.
  for(const z of [-565,-525,-489,-430,-385]){
    box(535,7,z,.16,6,.16,metal);box(535,10.1,z,1,.18,.45,white);
  }
  for(const [material,geometries]of parts){
    const merged=mergeGeometries(geometries);if(!merged)throw new Error('Lakefront geometry merge failed');
    const mesh=new THREE.Mesh(merged,material);mesh.name=material===lawn?'campus-lawns-and-trees':material===concrete?'garage-slabs-and-columns':'campus-site-details';
    mesh.castShadow=material!==asphalt&&material!==paving;mesh.receiveShadow=true;(material===concrete?garage:root).add(mesh);geometries.forEach(g=>g.dispose());
  }
  root.userData.parkRoofHeight=PARK_DECK_Y;root.userData.bridgeLanding=[522.772,PARK_DECK_Y,-464.3];
  root.userData.parkingStructureSource='OSM Museum Center Park 55206404 plus supplied street-view facade references';
  return root;
}
