import test from 'node:test';
import assert from 'node:assert/strict';
import {createDriveState,stepDrive} from '../src/drivingPhysics.ts';

const free=(_previous:ReturnType<typeof createDriveState>,next:ReturnType<typeof createDriveState>)=>({x:next.x,y:next.y,z:next.z,blocked:false});
function run(fps:number,seconds:number,input={throttle:1,steer:0,brake:false}){const s=createDriveState(0,0,0,0);for(let i=0;i<fps*seconds;i++)stepDrive(s,input,1/fps,free);return s;}

test('forward speed is conservative and frame-rate independent',()=>{
 const a=run(30,8),b=run(60,8);
 assert.ok(a.speed<=16&&a.speed>15);assert.ok(Math.abs(a.speed-b.speed)<.02);assert.ok(Math.abs(a.z-b.z)<.15);assert.ok(a.z<0);
});
test('positive yaw is a left turn for local forward -Z and reverse steering swaps direction',()=>{
 const left=run(60,3,{throttle:1,steer:-1,brake:false});assert.ok(left.yaw>0);assert.ok(left.x<0);
 const reverse=run(60,3,{throttle:-1,steer:-1,brake:false});assert.ok(reverse.speed>=-4);assert.ok(reverse.yaw<0);
});
test('opposite throttle brakes to zero before reversing and collisions retain pose',()=>{
 const s=run(60,1);stepDrive(s,{throttle:-1,steer:0,brake:false},1/60,free);assert.ok(s.speed>=0);
 const before={...s};stepDrive(s,{throttle:1,steer:0,brake:false},1/60,(p)=>({x:p.x,y:p.y,z:p.z,blocked:true}));
 assert.equal(s.x,before.x);assert.equal(s.z,before.z);assert.ok(s.speed<before.speed);
});
test('render stalls are capped to 100ms',()=>{
 const a=createDriveState(0,0,0),b=createDriveState(0,0,0);stepDrive(a,{throttle:1,steer:0,brake:false},10,free);stepDrive(b,{throttle:1,steer:0,brake:false},.1,free);
 assert.deepEqual(a,b);
});
