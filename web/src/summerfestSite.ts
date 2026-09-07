import * as THREE from 'three';
import type {TerrainData} from './loader.ts';
import {SUMMERFEST_BOUNDARY,SUMMERFEST_BUILDINGS} from './summerfestSiteData.ts';
import {bilinearTerrainHeight,terrainHeight} from './localTerrain.ts';
import {withinHoanHarbor} from './hoanSite.ts';

export const SUMMERFEST_FOCUS={x:543,z:433};
export const SUMMERFEST_VENUES=[
 {id:'amphitheater',name:'American Family Insurance Amphitheater',sourceId:6019180,x:594,z:851,width:145,depth:145,bearing:-Math.PI/6},
 {id:'bmo',name:'BMO Pavilion',sourceId:385057703,x:692,z:697,width:88,depth:64,bearing:-Math.PI/2},
 {id:'miller',name:'Miller Lite Oasis',sourceId:385065537,x:402,z:323,width:41,depth:22,bearing:Math.PI/2},
 {id:'generac',name:'Generac Power Stage',sourceId:385065538,x:422,z:439,width:35,depth:18,bearing:Math.PI/2},
 {id:'briggs',name:'Briggs & Stratton Big Backyard',sourceId:385065543,x:429,z:552,width:36,depth:24,bearing:Math.PI/2},
 {id:'tmobile',name:'T-Mobile Stage',sourceId:597941287,x:573,z:60,width:38,depth:26,bearing:-Math.PI/4},
 {id:'uline',name:'Uline Warehouse',sourceId:385057702,x:540,z:-36,width:32,depth:28,bearing:0},
 // Aurora's back faces the lake to the east; audience and entry are inland.
 {id:'aurora',name:'Aurora Pavilion',sourceId:385065526,x:542,z:165,width:35,depth:65,bearing:-Math.PI/2},
 {id:'south',name:'South Pavilion',sourceId:385057705,x:574,z:754,width:48,depth:38,bearing:Math.PI},
] as const;

export function withinSummerfest(x:number,z:number){
 let inside=false;for(let i=0,j=SUMMERFEST_BOUNDARY.length-1;i<SUMMERFEST_BOUNDARY.length;j=i++){
  const a=SUMMERFEST_BOUNDARY[i],b=SUMMERFEST_BOUNDARY[j];
  if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }return inside;
}
// Simplified cached OSM Lake Freeway deck centerlines 99456186,106608885,
// 123681034/1101016694 and Harbor exit19853977/451499709. These bound the
// contaminated DEM below the structure, not new street alignments.
const harborDeckCorridors:readonly (readonly (readonly [number,number])[])[]=[
 [[292.4,33.8],[295.7,42.7],[336.7,248.3],[377.9,470.6],[437,737],[489,1020]],
 [[224.5,-102.2],[346,-14.1],[390.7,76.4],[395.4,455.2],[408.8,535.5],[469.7,917.5]],
 [[475.7,-136],[429.6,84.2],[412,196.5],[405.2,279.1],[397.3,378.8],[395.4,455.2]],
];
function smooth(value:number){const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);}
/** Public so regression tests can enforce the exact additional correction
 * footprint. The 40m core removes deck returns;45m feather protects neighbors. */
export function summerfestApproachTerrainWeight(x:number,z:number){
 if(z<=-160||z>=1080||x<120||x>580||withinHoanHarbor(x,z))return 0;
 let distance=Infinity;
 for(const points of harborDeckCorridors)for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));
  distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));
 }
 return (1-smooth((distance-40)/45))*smooth((z+160)/120)*smooth((1080-z)/60);
}
/** Coarse DEM includes roof/deck returns. The2.2m festival apron and adjoining
 * ground beneath the freeway are interpreted bank grades, not survey data.
 * The northern road approach blends toward3.7m before meeting original DEM. */
export function prepareSummerfestTerrain(base:TerrainData):TerrainData{
 const result={...base,heights:base.heights.slice()};
 for(let j=0;j<base.ny;j++)for(let i=0;i<base.nx;i++){
  const x=base.x0+i*base.step,z=-base.y0-j*base.step;
  const index=j*base.nx+i,approach=summerfestApproachTerrainWeight(x,z);
  if(approach){
   const grade=2.2+1.5*Math.max(0,Math.min(1,-z/140));
   result.heights[index]=base.heights[index]+(Math.min(base.heights[index],grade)-base.heights[index])*approach;
  }
  if(x<320||x>800||z< -90||z>1000||!withinSummerfest(x,z))continue;
  let distance=Infinity;
  for(let k=1;k<SUMMERFEST_BOUNDARY.length;k++){
   const a=SUMMERFEST_BOUNDARY[k-1],b=SUMMERFEST_BOUNDARY[k],dx=b[0]-a[0],dz=b[1]-a[1];
   const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
   distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));
  }
  const t=Math.min(1,distance/12),blend=t*t*(3-2*t);
  result.heights[index]+=(2.2-result.heights[index])*blend;
 }return result;
}

/** Exact cached footprint-node and elevation matching; roads and neighboring
 * buildings cannot be swallowed by a broad bounding-box removal. */
export function adaptSummerfestTile(group:THREE.Group,tile:{i:number;j:number},groundAt:(x:number,z:number)=>number,rawTerrain?:TerrainData,renderedTerrain?:TerrainData){
 if(tile.i!==0||![0,-1].includes(tile.j))return 0;
 // ROAD includes elevated deck surfaces; HWAY contains their structural
 // details. Identify ground triangles against the untouched source DEM before
 // correcting any heights. This also covers the full existing Hoan correction
 // region, so its older vertex-only adapter must not apply the delta twice.
 if(rawTerrain&&renderedTerrain&&!group.userData.summerfestRoadsAdapted){
  group.traverse(o=>{if(o instanceof THREE.Mesh&&o.name==='ROAD')groundFestivalRoad(o,rawTerrain,renderedTerrain,groundAt);});
  group.userData.summerfestRoadsAdapted=true;
  if(tile.j===-1)group.userData.hoanGrounded=true;
 }
 let removed=0;
 group.traverse(o=>{
  if(!(o instanceof THREE.Mesh))return;
  const original=o.geometry,p=original.getAttribute('position');if(!p||original.index)return;
  if(o.name==='ROAD')return;
  if(o.name!=='BLDG')return;
  const keep:number[]=[];
  for(let i=0;i<p.count;i+=3){
   const match=SUMMERFEST_BUILDINGS.some(s=>[0,1,2].every(offset=>{
    const v=i+offset;return s.elevations.some(y=>Math.abs(y-p.getY(v))<.17)&&s.sourceNodes.some(([x,z])=>Math.hypot(x-p.getX(v),z-p.getZ(v))<.17);
   }));
   if(match)removed++;else keep.push(i,i+1,i+2);
  }
  if(keep.length===p.count)return;
  const geometry=new THREE.BufferGeometry();
  for(const [name,a] of Object.entries(original.attributes)){
   if(!(a instanceof THREE.BufferAttribute))continue;
   const array=a.array.slice(0,keep.length*a.itemSize);
   keep.forEach((v,k)=>{for(let c=0;c<a.itemSize;c++)array[k*a.itemSize+c]=a.array[v*a.itemSize+c];});
   geometry.setAttribute(name,new THREE.BufferAttribute(array,a.itemSize,a.normalized));
  }
  geometry.computeBoundingBox();geometry.computeBoundingSphere();o.geometry=geometry;original.dispose();
 });return removed;
}

/** Preserve mapped plan geometry and widths while fitting only proven surface
 * roads to the corrected ground. Cell/diagonal cuts make every road triangle
 * lie over a single planar terrain face, preventing buried triangle interiors.
 */
function groundFestivalRoad(mesh:THREE.Mesh,raw:TerrainData,terrain:TerrainData,groundAt:(x:number,z:number)=>number){
 const source=mesh.geometry,p=source.getAttribute('position');if(!p||source.index)return;
 const attributes=Object.entries(source.attributes).filter((entry):entry is [string,THREE.BufferAttribute]=>entry[1] instanceof THREE.BufferAttribute);
 const offsets:number[]=[];let size=0;for(const [,a] of attributes){offsets.push(size);size+=a.itemSize;}
 const positionOffset=offsets[attributes.findIndex(([name])=>name==='position')];
 const vertex=(i:number)=>attributes.flatMap(([,a])=>Array.from({length:a.itemSize},(_,c)=>a.array[i*a.itemSize+c]));
 const output:number[][]=attributes.map(()=>[]);
 const emit=(vertices:number[][])=>{
  for(let k=1;k<vertices.length-1;k++)for(const v of [vertices[0],vertices[k],vertices[k+1]])
   attributes.forEach(([,a],i)=>{for(let c=0;c<a.itemSize;c++)output[i].push(v[offsets[i]+c]);});
 };
 const clip=(vertices:number[][],distance:(v:number[])=>number)=>{
  const result:number[][]=[];
  for(let i=0;i<vertices.length;i++){
   const a=vertices[i],b=vertices[(i+1)%vertices.length],da=distance(a),db=distance(b),inside=da>=-1e-7,nextInside=db>=-1e-7;
   if(inside)result.push(a);
   if(inside!==nextInside){const t=da/(da-db);result.push(a.map((n,c)=>n+(b[c]-n)*t));}
  }return result;
 };
 const x=(v:number[])=>v[positionOffset],z=(v:number[])=>v[positionOffset+2];
 let grounded=0,retainedElevated=0;
 for(let i=0;i<p.count;i+=3){
  const tri=[vertex(i),vertex(i+1),vertex(i+2)],xs=tri.map(x),zs=tri.map(z),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  // Both terrain corrections are zero beyond these source-grid support bounds.
  if(maxX<80||minX>880||maxZ< -200||minZ>1660){emit(tri);continue;}
  if(tri.some(v=>Math.abs(v[positionOffset+1]-bilinearTerrainHeight(raw,x(v),z(v))-.4)>1)){
   retainedElevated++;emit(tri);continue;
  }
  const changed=tri.some(v=>Math.abs(groundAt(x(v),z(v))-bilinearTerrainHeight(raw,x(v),z(v)))>.001);
  if(!changed||tri.some(v=>withinHoanHarbor(x(v),z(v)))){emit(tri);continue;}
  grounded++;
  const i0=Math.max(0,Math.floor((minX-terrain.x0)/terrain.step)),i1=Math.min(terrain.nx-2,Math.floor((maxX-terrain.x0)/terrain.step));
  const j0=Math.max(0,Math.floor((-maxZ-terrain.y0)/terrain.step)),j1=Math.min(terrain.ny-2,Math.floor((-minZ-terrain.y0)/terrain.step));
  for(let row=j0;row<=j1;row++)for(let col=i0;col<=i1;col++){
   const west=terrain.x0+col*terrain.step,east=west+terrain.step,south=-terrain.y0-row*terrain.step,north=south-terrain.step;
   let cell=tri;for(const f of [(v:number[])=>x(v)-west,(v:number[])=>east-x(v),(v:number[])=>z(v)-north,(v:number[])=>south-z(v)])cell=clip(cell,f);
   if(cell.length<3)continue;
   for(const sign of [1,-1]){
    const face=clip(cell,v=>sign*(west+south-x(v)-z(v)));if(face.length<3)continue;
    const raised=face.map(v=>{
     const copy=v.slice();
     // Match the ordinary road datum at the boundary. The terrain mesh itself
     // is translated down 0.6 m in scene.ts. A small clearance floor is needed
     // where bilinear DEM sampling differs from its rendered triangle.
     copy[positionOffset+1]=Math.max(groundAt(x(v),z(v))+.4,terrainHeight(terrain,x(v),z(v))-.6+.12);
     return copy;
    });
    emit(raised);
   }
  }
 }
 if(!grounded)return;
 const geometry=new THREE.BufferGeometry();attributes.forEach(([name,a],i)=>{
  const array=new (a.array.constructor as {new(length:number):typeof a.array})(output[i].length);array.set(output[i]);
  geometry.setAttribute(name,new THREE.BufferAttribute(array,a.itemSize,a.normalized));
 });
 geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;source.dispose();
 mesh.userData.summerfestRoads={groundedTriangles:grounded,preservedElevatedTriangles:retainedElevated,sourceVertices:p.count,vertices:geometry.getAttribute('position').count};
}
