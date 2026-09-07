import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface ClarifierDetailOptions {radius:number;waterY?:number}
export interface IndustrialRoofDetailOptions {width:number;depth:number}
export interface KaszubesParkOptions {width:number;depth:number}

function box(x:number,y:number,z:number,w:number,h:number,d:number){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);return g;}
function beam(a:THREE.Vector3,b:THREE.Vector3,w:number,d=w){const v=b.clone().sub(a),g=new THREE.BoxGeometry(w,v.length(),d);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());return g;}
function merge(root:THREE.Group,name:string,parts:THREE.BufferGeometry[],material:THREE.Material){
  if(!parts.length)return;const flat=parts.map(p=>{const g=p.index?p.toNonIndexed():p.clone();g.deleteAttribute('uv');return g;});const geometry=mergeGeometries(flat,false)!;
  parts.forEach(p=>p.dispose());flat.forEach(p=>p.dispose());const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
}
function finish(root:THREE.Group,dimensions:Record<string,number>){let drawCalls=0,triangles=0;root.traverse(o=>{if(o instanceof THREE.Mesh){drawCalls++;const p=o.geometry.getAttribute('position');triangles+=(o.geometry.index?.count??p.count)/3;}});root.userData.dimensions=dimensions;root.userData.drawCalls=drawCalls;root.userData.triangles=triangles;return root;}

const concrete=new THREE.MeshStandardMaterial({color:0xaaa79d,roughness:.94});
const steel=new THREE.MeshStandardMaterial({color:0x737c7c,roughness:.55,metalness:.5});
const dark=new THREE.MeshStandardMaterial({color:0x353b3a,roughness:.65,metalness:.35});
const pale=new THREE.MeshStandardMaterial({color:0xc0c3bf,roughness:.77,metalness:.18});
const glass=new THREE.MeshStandardMaterial({color:0x78909a,roughness:.25,metalness:.14});
const grass=new THREE.MeshStandardMaterial({color:0x587548,roughness:1});
const wood=new THREE.MeshStandardMaterial({color:0x704635,roughness:.92});
const foliage=new THREE.MeshStandardMaterial({color:0x41643d,roughness:1});
const stone=new THREE.MeshStandardMaterial({color:0x77756d,roughness:1});

function annulus(radius:number,inner:number,height:number){
  const shape=new THREE.Shape();shape.absarc(0,0,radius,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,inner,0,Math.PI*2,true);shape.holes.push(hole);
  const g=new THREE.ExtrudeGeometry(shape,{depth:height,bevelEnabled:false,curveSegments:40});g.rotateX(Math.PI/2);g.translate(0,height,0);return g;
}

/** Exterior clarifier trim that leaves the existing water and most of the basin center unobstructed. */
export function buildClarifierDetails(options:ClarifierDetailOptions):THREE.Group{
  const radius=Math.max(3,options.radius),waterY=options.waterY??.72,root=new THREE.Group();root.name='jones-island-clarifier-details';
  const structure:THREE.BufferGeometry[]=[annulus(radius,radius-.8,1.3),new THREE.CylinderGeometry(1.05,1.25,1.05,18).translate(0,waterY+.15,0)];
  const access:THREE.BufferGeometry[]=[box(-radius/2,waterY+.24,0,radius-1.15,.22,1.05)];
  const rails:THREE.BufferGeometry[]=[];
  for(const z of [-.58,.58]){rails.push(beam(new THREE.Vector3(-radius+.7,waterY+.35,z),new THREE.Vector3(-.15,waterY+.35,z),.08));for(let x=-radius+.8;x<0;x+=2.4)rails.push(beam(new THREE.Vector3(x,waterY+.3,z),new THREE.Vector3(x,waterY+1.25,z),.07));rails.push(beam(new THREE.Vector3(-radius+.7,waterY+1.22,z),new THREE.Vector3(-.15,waterY+1.22,z),.07));}
  merge(root,'clarifier-concrete-ring-and-hub',structure,concrete);merge(root,'clarifier-radial-access-walkway',access,steel);merge(root,'clarifier-walkway-rails',rails,dark);
  return finish(root,{radius,outerDiameter:radius*2,innerDiameter:(radius-.8)*2,ringHeight:1.3,waterY});
}

/** Sparse equipment set placed by the caller on an existing flat industrial roof. */
export function buildIndustrialRoofDetails(options:IndustrialRoofDetailOptions):THREE.Group{
  const width=Math.max(6,options.width),depth=Math.max(5,options.depth),root=new THREE.Group();root.name='jones-island-industrial-roof-details';
  const curbs:THREE.BufferGeometry[]=[],equipment:THREE.BufferGeometry[]=[],caps:THREE.BufferGeometry[]=[],skylights:THREE.BufferGeometry[]=[];
  const vents=Math.max(2,Math.min(8,Math.floor(width/14)));
  for(let i=0;i<vents;i++){const x=-width*.38+i*(width*.76/Math.max(1,vents-1)),z=(i%2-.5)*depth*.42;curbs.push(box(x,.13,z,1.8,.26,1.8));equipment.push(new THREE.CylinderGeometry(.45,.55,1.7,10).translate(x,1.1,z));caps.push(new THREE.CylinderGeometry(.72,.5,.22,10).translate(x,2.02,z));}
  for(const x of [-width*.24,width*.18]){const g=new THREE.BoxGeometry(Math.min(6,width*.14),.64,Math.min(3.2,depth*.18));g.rotateX(-.08);g.translate(x,.5,-depth*.18);skylights.push(g);}
  equipment.push(box(width*.31,.65,depth*.18,Math.min(5,width*.12),1.3,Math.min(4,depth*.22)));
  merge(root,'industrial-roof-equipment-curbs',curbs,concrete);merge(root,'industrial-roof-vents-and-air-handler',equipment,pale);merge(root,'industrial-roof-weather-caps',caps,dark);merge(root,'industrial-roof-skylights',skylights,glass);
  return finish(root,{width,depth,height:2.13});
}

function arrowSign(width:number,x:number,z:number){const shape=new THREE.Shape();shape.moveTo(-width/2,-1);shape.lineTo(width*.22,-1);shape.lineTo(width/2,0);shape.lineTo(width*.22,1);shape.lineTo(-width/2,1);shape.closePath();const g=new THREE.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:true,bevelSize:.05,bevelThickness:.04,bevelSegments:1});g.translate(x+.25,3.4,z-.09);return g;}

/** Small public park vignette based on the sign, lawn, chained timber posts and shaded seating. */
export function buildKaszubesPark(options:KaszubesParkOptions):THREE.Group{
  const width=Math.max(12,options.width),depth=Math.max(10,options.depth),root=new THREE.Group();root.name='kaszubes-park';
  const ground:THREE.BufferGeometry[]=[box(0,.04,0,width,.08,depth)],timber:THREE.BufferGeometry[]=[],metal:THREE.BufferGeometry[]=[],sign:THREE.BufferGeometry[]=[],rocks:THREE.BufferGeometry[]=[],trunks:THREE.BufferGeometry[]=[],crowns:THREE.BufferGeometry[]=[];
  const edgeZ=depth*.34,postCount=6;
  for(let i=0;i<postCount;i++){const x=-width*.4+i*width*.8/(postCount-1);timber.push(new THREE.CylinderGeometry(.22,.27,1.35,9).translate(x,.675,edgeZ));if(i<postCount-1){const nx=-width*.4+(i+1)*width*.8/(postCount-1);const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(x,1,edgeZ),new THREE.Vector3((x+nx)/2,.55,edgeZ),new THREE.Vector3(nx,1,edgeZ)]);metal.push(new THREE.TubeGeometry(curve,6,.055,5,false));}}
  const signX=-width*.22,signZ=-depth*.12;sign.push(box(signX,2.15,signZ,.34,4.3,.34),arrowSign(Math.min(5,width*.28),signX,signZ));
  for(const z of [-depth*.12,depth*.1]){timber.push(box(width*.17,.72,z,3.4,.18,1),box(width*.17,.38,z,3.4,.16,.75));for(const x of [width*.17-1.4,width*.17+1.4])metal.push(box(x,.36,z,.14,.72,.72));}
  const boulder=new THREE.DodecahedronGeometry(1.15,1);boulder.scale(1.2,.75,.9);boulder.translate(-width*.03,.87,-depth*.1);rocks.push(boulder);
  const trees:[number,number,number][]=[[-.34,-.30,1],[.34,-.28,.88],[-.12,.27,.78]];
  for(const [tx,tz,s] of trees){const x=tx*width,z=tz*depth;trunks.push(new THREE.CylinderGeometry(.22*s,.32*s,3.4*s,8).translate(x,1.7*s,z));const crown=new THREE.IcosahedronGeometry(2.15*s,1);crown.scale(1,1.25,.9);crown.translate(x,4.15*s,z);crowns.push(crown);}
  merge(root,'kaszubes-lawn',ground,grass);merge(root,'kaszubes-posts-sign-benches',timber,wood);merge(root,'kaszubes-chains-bench-frames',metal,dark);merge(root,'kaszubes-arrow-park-sign',sign,wood);merge(root,'kaszubes-boulder-marker',rocks,stone);merge(root,'kaszubes-tree-trunks',trunks,wood);merge(root,'kaszubes-tree-canopies',crowns,foliage);
  return finish(root,{width,depth,height:6.9});
}
