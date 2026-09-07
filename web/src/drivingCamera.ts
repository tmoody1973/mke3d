import type { DriveState } from './drivingPhysics';

type Point = [number,number,number];
export function driveCameraPose(state:Pick<DriveState,'x'|'y'|'z'|'yaw'>,orbit:number,pitch:number,lookBehind=false) {
  const yaw=state.yaw+orbit+(lookBehind?Math.PI:0);
  const target:Point=[state.x,state.y+1.9,state.z];
  const eye:Point=[state.x+Math.sin(yaw)*14,state.y+6.2,state.z+Math.cos(yaw)*14];
  // Pitch changes the viewing direction, not the car's height or the chase
  // camera collision anchor. Positive pitch can look well above the horizon.
  const lookAt:Point=[...target];
  lookAt[1]+=14*Math.tan(Math.max(-.75,Math.min(1.25,pitch)));
  return {target,eye,lookAt};
}
