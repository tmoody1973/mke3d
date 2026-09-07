import test from 'node:test';
import assert from 'node:assert/strict';
import { driveCameraPose } from '../src/drivingCamera.ts';

const car={x:30,y:4,z:-20,yaw:0};
test('free look can see above buildings without moving the chase collision anchor',()=>{
 const normal=driveCameraPose(car,0,0),up=driveCameraPose(car,0,1.25);
 assert.deepEqual(up.eye,normal.eye);assert.deepEqual(up.target,normal.target);
 assert.ok(up.lookAt[1]>up.eye[1]+30,'camera cannot look above the horizon');
 assert.ok(normal.lookAt[1]<normal.eye[1]);
});
test('look-behind and orbit remain centered on the moving vehicle',()=>{
 const normal=driveCameraPose(car,0,0),back=driveCameraPose(car,0,0,true);
 assert.ok(normal.eye[2]>car.z && back.eye[2]<car.z);
 const moved=driveCameraPose({...car,x:car.x+100},Math.PI/2,0);
 assert.ok(Math.abs(moved.eye[0]-(car.x+114))<1e-8);
 assert.deepEqual(moved.lookAt,[car.x+100,car.y+1.9,car.z]);
});
