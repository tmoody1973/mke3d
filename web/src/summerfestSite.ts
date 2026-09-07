import * as THREE from 'three';
import type {TerrainData} from './loader.ts';
import {SUMMERFEST_BOUNDARY,SUMMERFEST_BUILDINGS} from './summerfestSiteData.ts';

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
/** Coarse DEM includes roof/deck returns. A gently blended 2.2 m festival
 * apron is an interpreted grade, not survey elevation. Never alters the lake,
 * Hoan or Harbor Drive outside the mapped park polygon. */
export function prepareSummerfestTerrain(base:TerrainData):TerrainData{
 const result={...base,heights:base.heights.slice()};
 for(let j=0;j<base.ny;j++)for(let i=0;i<base.nx;i++){
  const x=base.x0+i*base.step,z=-base.y0-j*base.step;
  if(x<320||x>800||z< -90||z>1000||!withinSummerfest(x,z))continue;
  let distance=Infinity;
  for(let k=1;k<SUMMERFEST_BOUNDARY.length;k++){
   const a=SUMMERFEST_BOUNDARY[k-1],b=SUMMERFEST_BOUNDARY[k],dx=b[0]-a[0],dz=b[1]-a[1];
   const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
   distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));
  }
  const t=Math.min(1,distance/12),blend=t*t*(3-2*t),index=j*base.nx+i;
  result.heights[index]=base.heights[index]+(2.2-base.heights[index])*blend;
 }return result;
}

/** Exact cached footprint-node and elevation matching; roads and neighboring
 * buildings cannot be swallowed by a broad bounding-box removal. */
export function adaptSummerfestTile(group:THREE.Group,tile:{i:number;j:number},groundAt:(x:number,z:number)=>number){
 if(tile.i!==0||![0,-1].includes(tile.j))return 0;
 let removed=0;
 group.traverse(o=>{
  if(!(o instanceof THREE.Mesh))return;
  const original=o.geometry,p=original.getAttribute('position');if(!p||original.index)return;
  if(o.name==='ROAD'){
   for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i);if(withinSummerfest(x,z))p.setY(i,groundAt(x,z)+.09);}
   p.needsUpdate=true;original.computeVertexNormals();original.computeBoundingSphere();return;
  }
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
