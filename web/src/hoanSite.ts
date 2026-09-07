import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Section, TerrainData } from './loader.ts';
import { bilinearTerrainHeight } from './localTerrain.ts';

type XZ = readonly [number, number];
// OSM relation 16271476 outer way 698128024, clipped at mapped vertices to
// the harbor approaches. Metres in the existing city projection, not lat/lon.
const bridgeOutline: readonly XZ[] = [[436.07,844.94],[437.08,850.79],[463.34,1004.53],[464.11,1009.07],[466.4,1022.47],[474.73,1071.22],[560.76,1547.18],[590.22,1518.78],[502.24,1020.69],[501.93,1018.88],[499.09,1002.84],[498.32,998.47],[483.72,915.8],[471.54,850.97],[470.85,846.72]];
// Harbor boundary from river multipolygon 5900827. The southern straight
// quay is Jones Island; the northern edge is Erie Street / Summerfest.
export const HOAN_HARBOR: readonly XZ[] = [[295.89,1200.72],[796.62,1112.26],[840.28,1108.99],[818.5,1056.94],[791.16,1004.49],[744.74,1007.15],[646.72,1012.68],[608.25,1015.56],[527.65,1019.58],[502.24,1020.69],[466.4,1022.47],[285.91,1031.27],[251.28,1031],[235.14,1019.76]];
export const HOAN_NORTH_QUAY: readonly XZ[] = [[285.91,1031.27],[466.4,1022.47],[502.24,1020.69],[527.65,1019.58],[608.25,1015.56],[646.72,1012.68],[744.74,1007.15],[791.16,1004.49]];
export const HOAN_SOUTH_QUAY: readonly XZ[] = [[295.89,1200.72],[796.62,1112.26]];
export const HOAN_SITE_BOUNDS = { minX: 250, maxX: 840, minZ: 720, maxZ: 1620 };

function segmentDistance(p: XZ, a: XZ, b: XZ) {
  const dx=b[0]-a[0], dz=b[1]-a[1], d=dx*dx+dz*dz;
  const u=d?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/d)):0;
  return Math.hypot(p[0]-a[0]-dx*u,p[1]-a[1]-dz*u);
}
export function withinHoanHarbor(x:number,z:number) {
  let inside=false;
  for(let i=0,j=HOAN_HARBOR.length-1;i<HOAN_HARBOR.length;j=i++) {
    const a=HOAN_HARBOR[i],b=HOAN_HARBOR[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}
function outlineDistance(x:number,z:number) {
  let d=Infinity,inside=false;
  for(let i=0,j=bridgeOutline.length-1;i<bridgeOutline.length;j=i++) {
    const a=bridgeOutline[i],b=bridgeOutline[j];d=Math.min(d,segmentDistance([x,z],a,b));
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside?0:d;
}
function smooth(t:number) { const u=Math.max(0,Math.min(1,t));return u*u*(3-2*u); }
export function hoanCorrectionWeight(x:number,z:number) {
  const b=HOAN_SITE_BOUNDS;
  if(x<=b.minX||x>=b.maxX||z<=b.minZ||z>=b.maxZ)return 0;
  const edge=Math.min(x-b.minX,b.maxX-x,z-b.minZ,b.maxZ-z);
  return smooth(edge/70)*(1-smooth((outlineDistance(x,z)-45)/70));
}

/** Remove bridge deck returns from the coarse DEM. Original arrays remain untouched.
 * Bank cap 2.2m and channel bed -2m are documented local estimates, not survey.
 */
export function prepareHoanTerrain(base:TerrainData):TerrainData {
  const result={...base,heights:base.heights.slice(),colors:base.colors.slice()};
  for(let j=0;j<result.ny;j++)for(let i=0;i<result.nx;i++) {
    const k=j*result.nx+i,x=result.x0+i*result.step,z=-result.y0-j*result.step;
    const weight=hoanCorrectionWeight(x,z),water=withinHoanHarbor(x,z);
    if(!weight&&!water)continue;
    const old=base.heights[k];
    // Never raise unrelated low areas or erase the source shoreline shape.
    const target=water?Math.min(old,-2):Math.min(old,2.2);
    result.heights[k]=water?target:old+(target-old)*weight;
  }
  return result;
}

/** The old river mesh inherited the same bridge return, reaching 21m above
 * water. Preserve every source XZ and face while flattening harbor water only.
 * Treatment basins inside the narrow bridge mask receive the same 2.2m cap.
 */
export function prepareHoanWater(sections:Section[]):Section[] {
  return sections.map(section=>{
    if(section.name!=='WATR')return section;
    const positions=section.positions.slice();
    for(let i=0;i<positions.length;i+=3) {
      const x=positions[i],z=positions[i+2],old=positions[i+1];
      const boundary=HOAN_HARBOR.some((p,j)=>segmentDistance([x,z],p,HOAN_HARBOR[(j+1)%HOAN_HARBOR.length])<.3);
      if(withinHoanHarbor(x,z)||boundary)positions[i+1]=Math.min(old,0);
      else {const w=hoanCorrectionWeight(x,z);positions[i+1]=old+(Math.min(old,2.2)-old)*w;}
    }
    return {...section,positions};
  });
}

/** Ground only proven surface-road vertices. Elevated road sections are left
 * intact: their +14.4m deck offset cannot pass the raw-terrain +0.4m gate.
 */
export function adaptHoanContextTile(group:THREE.Group,tile:{i:number;j:number},rawTerrain:TerrainData,groundAt:(x:number,z:number)=>number) {
  if(tile.i!==0||tile.j!==-1||group.userData.hoanGrounded)return;
  group.userData.hoanGrounded=true;
  for(const child of group.children) {
    if(!(child instanceof THREE.Mesh)||child.name!=='ROAD')continue;
    const pos=child.geometry.getAttribute('position');let count=0;
    for(let i=0;i<pos.count;i++) {
      const x=pos.getX(i),z=pos.getZ(i),y=pos.getY(i);
      if(!hoanCorrectionWeight(x,z)||withinHoanHarbor(x,z))continue;
      const raw=bilinearTerrainHeight(rawTerrain,x,z);
      if(Math.abs(y-(raw+.4))>1.0)continue;
      const corrected=groundAt(x,z),delta=corrected-raw;
      if(delta>=-0.001)continue;
      pos.setY(i,y+delta);count++;
    }
    if(count){pos.needsUpdate=true;child.geometry.computeVertexNormals();child.geometry.computeBoundingSphere();}
    child.userData.hoanGroundedVertices=count;
  }
}

function planBox(a:XZ,b:XZ,y:number,height:number,width:number) {
  const dx=b[0]-a[0],dz=b[1]-a[1];return new THREE.BoxGeometry(Math.hypot(dx,dz),height,width).rotateY(-Math.atan2(dz,dx)).translate((a[0]+b[0])/2,y,(a[1]+b[1])/2);
}

function boxBetween(a:THREE.Vector3,b:THREE.Vector3,width:number,depth:number) {
  const direction=b.clone().sub(a),geometry=new THREE.BoxGeometry(width,direction.length(),depth);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()));
  geometry.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);return geometry;
}

/** Sparse quay context, tied to source shorelines. No guessed highway ramps,
 * roads, trees or public park are added to industrial Jones Island.
 */
export function buildHoanContext(groundAt:(x:number,z:number)=>number) {
  const root=new THREE.Group();root.name='hoan-harbor-context';
  const wall:THREE.BufferGeometry[]=[],rail:THREE.BufferGeometry[]=[],dark:THREE.BufferGeometry[]=[],grass:THREE.BufferGeometry[]=[];
  const addBank=(points:readonly XZ[],north:boolean)=>{
    for(let i=1;i<points.length;i++) {
      const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),sign=north?1:-1;
      const inward=new THREE.Vector3(sign*dz/length,0,-sign*dx/length);
      const y=2.15;
      wall.push(planBox([a[0]+inward.x*.22,a[1]+inward.z*.22],[b[0]+inward.x*.22,b[1]+inward.z*.22],.35,3.6,.44));
      // A shallow landward cap closes the coarse-grid bank at its actual edge.
      const cap=planBox([a[0]+inward.x*2,a[1]+inward.z*2],[b[0]+inward.x*2,b[1]+inward.z*2],y-.12,.24,4);
      wall.push(cap);
      if(north) {
        for(const height of [.48,.95])rail.push(boxBetween(new THREE.Vector3(a[0],y+height,a[1]).addScaledVector(inward,.7),new THREE.Vector3(b[0],y+height,b[1]).addScaledVector(inward,.7),.09,.09));
        for(let distance=2;distance<length;distance+=5){const t=distance/length;const p=new THREE.Vector3(a[0]+dx*t,y,a[1]+dz*t).addScaledVector(inward,.7);rail.push(boxBetween(p,p.clone().add(new THREE.Vector3(0,1.04,0)),.09,.09));}
      }
      for(let distance=12;distance<length;distance+=32){const t=distance/length,p=new THREE.Vector3(a[0]+dx*t,y,a[1]+dz*t).addScaledVector(inward,1.2);dark.push(new THREE.CylinderGeometry(.17,.22,.48,6).translate(p.x,p.y+.24,p.z));}
    }
  };
  addBank(HOAN_NORTH_QUAY,true);addBank(HOAN_SOUTH_QUAY,false);
  // The supplied waterfront photo shows a narrow grass verge landward of
  // the north quay. Bound it to the source wall segment under the bridge.
  for(let x=430;x<480;x+=5){const z=1022.47+(x-466.4)*(1020.69-1022.47)/(502.24-466.4)-6;const y=Math.max(2.15,groundAt(x,z));grass.push(new THREE.BoxGeometry(5,.06,1.6).translate(x,y+.03,z));}
  for(const [name,geometries,color] of [['quays',wall,0xa49d8f],['red-waterfront-railing',rail,0x792d30],['mooring-bollards',dark,0x343c3c],['north-bank-verge',grass,0x7d865e]] as const) {
    const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());if(!geometry)continue;
    const mesh=new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({color}));mesh.name=`hoan-${name}`;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  }
  root.userData.sourceWays=[404612840,691820277,698128022,573819672,699102910];
  root.userData.sourceRiver=5900827;root.userData.bankElevationEstimated=true;return root;
}
