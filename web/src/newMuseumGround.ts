import * as THREE from 'three';
import {NEW_MUSEUM_SITE as site} from './newMuseumSite.ts';

/** A level occupied footprint, with a short graded apron back to city terrain.
 * This is interpreted site grading, not a surveyed finished-floor elevation. */
export function createNewMuseumGround(terrainAt:(x:number,z:number)=>number){
 const halfX=site.buildingWidth/2,halfZ=site.buildingDepth/2,apron=7;
 let floor=-Infinity;
 const nx=Math.ceil(site.buildingWidth/2),nz=Math.ceil(site.buildingDepth/2);
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
  floor=Math.max(floor,terrainAt(site.x-halfX+i*site.buildingWidth/nx,site.z-halfZ+j*site.buildingDepth/nz));
 }
 function heightAt(x:number,z:number){
  const terrain=terrainAt(x,z);
  const distance=Math.hypot(Math.max(0,Math.abs(x-site.x)-halfX),Math.max(0,Math.abs(z-site.z)-halfZ));
  if(distance>=apron)return terrain;
  const t=distance/apron,blend=t*t*(3-2*t);
  // Never bury the surrounding city terrain under the replacement surface.
  return Math.max(terrain,floor+(terrain-floor)*blend);
 }
 const width=site.buildingWidth+apron*2,depth=site.buildingDepth+apron*2;
 const geometry=new THREE.PlaneGeometry(width,depth,Math.ceil(width),Math.ceil(depth)).rotateX(-Math.PI/2).translate(site.x,0,site.z);
 const p=geometry.getAttribute('position');
 for(let i=0;i<p.count;i++)p.setY(i,heightAt(p.getX(i),p.getZ(i)));
 geometry.computeVertexNormals();
 // Close the edge below the city terrain (which renders 0.6m below road datum),
 // so no thin sheet or open underside is visible where the apron meets it.
 const flat=geometry.toNonIndexed(),vertices=Array.from(flat.getAttribute('position').array);
 const perimeter:[number,number][]=[];
 const left=site.x-width/2,right=site.x+width/2,north=site.z-depth/2,south=site.z+depth/2;
 for(let x=left;x<right;x++)perimeter.push([x,north]);
 for(let z=north;z<south;z++)perimeter.push([right,z]);
 for(let x=right;x>left;x--)perimeter.push([x,south]);
 for(let z=south;z>north;z--)perimeter.push([left,z]);
 for(let i=0;i<perimeter.length;i++){
  const [ax,az]=perimeter[i], [bx,bz]=perimeter[(i+1)%perimeter.length];
  const ay=heightAt(ax,az),by=heightAt(bx,bz),ab=terrainAt(ax,az)-.7,bb=terrainAt(bx,bz)-.7;
  vertices.push(ax,ay,az,bx,by,bz,bx,bb,bz,ax,ay,az,bx,bb,bz,ax,ab,az);
 }
 const solid=new THREE.BufferGeometry();solid.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));solid.computeVertexNormals();
 geometry.dispose();flat.dispose();
 return {floor,heightAt,geometry:solid,apron};
}
