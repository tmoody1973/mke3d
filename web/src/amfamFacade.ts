import * as THREE from 'three';
import { AMFAM_FOOTPRINT, AMFAM_SITE } from './amfamSite.ts';

type Point = [number,number,number];
const inverse=new THREE.Matrix4().makeRotationY(-AMFAM_SITE.bearing);
/** Original mapped relation, transformed to the stadium's home-plate frame. */
export const AMFAM_LOCAL_FOOTPRINT=AMFAM_FOOTPRINT.map(([x,z])=>{
  const p=new THREE.Vector3(x-AMFAM_SITE.x,0,z-AMFAM_SITE.z).applyMatrix4(inverse);
  return [p.x,p.z] as const;
});
const center=[4.685,-16.73] as const;
const cross=(ax:number,az:number,bx:number,bz:number)=>ax*bz-az*bx;

function boundaryPoint(angle:number):THREE.Vector3{
  const dx=Math.sin(angle),dz=Math.cos(angle);let distance=-Infinity;
  for(let i=0;i<AMFAM_LOCAL_FOOTPRINT.length;i++){
    const a=AMFAM_LOCAL_FOOTPRINT[i],b=AMFAM_LOCAL_FOOTPRINT[(i+1)%AMFAM_LOCAL_FOOTPRINT.length];
    const ex=b[0]-a[0],ez=b[1]-a[1],den=cross(dx,dz,ex,ez);
    if(Math.abs(den)<1e-10)continue;
    const ax=a[0]-center[0],az=a[1]-center[1];
    const t=cross(ax,az,ex,ez)/den,u=cross(ax,az,dx,dz)/den;
    // Concave service recesses can intersect a ray more than once. The outer
    // intersection is the exterior envelope, never the old bounding ellipse.
    if(t>=0&&u>=-1e-8&&u<=1+1e-8)distance=Math.max(distance,t);
  }
  if(!Number.isFinite(distance))throw new Error('Stadium facade ray missed its mapped footprint');
  return new THREE.Vector3(center[0]+dx*distance,0,center[1]+dz*distance);
}

/** A finite surface basis; angle is radians, increasing clockwise in local X/Z. */
export function facadeFrame(angle:number){
  const origin=boundaryPoint(angle);
  // A short angular stencil avoids an unstable derivative at mapped corners.
  const tangent=boundaryPoint(angle+.004).sub(boundaryPoint(angle-.004)).normalize();
  const normal=new THREE.Vector3(-tangent.z,0,tangent.x).normalize();
  if(normal.dot(origin.clone().sub(new THREE.Vector3(center[0],0,center[1])))<0)normal.negate();
  return {origin,tangent,normal};
}

/** Facade coordinates on the actual building envelope, with metre outward offset. */
export function facadePoint(angle:number,y:number,offset=0):Point{
  const f=facadeFrame(angle),p=f.origin.addScaledVector(f.normal,offset);
  return [p.x,y,p.z];
}
