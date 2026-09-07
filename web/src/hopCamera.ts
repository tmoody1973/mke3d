import * as THREE from 'three';
import type { HopPath } from './hopTypes';
import { sampleHopPath } from './hopMotion.ts';

export type HopCameraView = 'aerial' | 'third-person';

/** Follow the actual rail alignment around turns, extending beyond the path start
 * so a car leaving its first stop never contains its own chase camera. */
export function hopCameraPose(path:HopPath,distance:number,heightScale:number,view:HopCameraView) {
  const current=sampleHopPath(path,distance);
  const trailingDistance=view==='third-person'?25:34;
  const closed=new THREE.Vector3(...path.points[0]).distanceTo(new THREE.Vector3(...path.points.at(-1)!))<.1;
  const behind=sampleHopPath(path,closed?distance-trailingDistance:Math.max(0,distance-trailingDistance));
  const trailing=new THREE.Vector3(...behind.position);
  if(!closed&&distance<trailingDistance) {
    const first=sampleHopPath(path,0);
    trailing.addScaledVector(new THREE.Vector3(...first.tangent),distance-trailingDistance);
  }
  trailing.y*=heightScale;
  const tangent=new THREE.Vector3(...current.tangent).setY(0).normalize();
  const position=new THREE.Vector3(current.position[0],current.position[1]*heightScale,current.position[2]);
  const cameraPosition=trailing.add(new THREE.Vector3(tangent.z*(view==='aerial'?5:1.5),view==='aerial'?26:7,-tangent.x*(view==='aerial'?5:1.5)));
  return {position,tangent,cameraPosition};
}
