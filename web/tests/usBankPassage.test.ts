import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildUsBankCampus} from '../src/usBankCampus.ts';
import {MICHIGAN_PASSAGE} from '../src/usBankPassage.ts';
import {createDrivingWorld} from '../src/drivingWorld.ts';
import {createDriveState} from '../src/drivingPhysics.ts';

test('Michigan Street has an open overhead Galleria and a continuous drivable surface in all three lanes',()=>{
  const groundAt=(x:number)=>6.0-(x-212)*.002;
  const campus=buildUsBankCampus(groundAt),world=createDrivingWorld(new THREE.Group(),campus);
  campus.updateMatrixWorld(true);
  const a=new THREE.Vector2(...MICHIGAN_PASSAGE.centerline[0]),b=new THREE.Vector2(...MICHIGAN_PASSAGE.centerline[2]);
  const direction=b.clone().sub(a).normalize(),normal=new THREE.Vector2(-direction.y,direction.x);
  const obstacles:THREE.Object3D[]=[];campus.traverse(o=>{if(o.userData.drivingSurface==='building')obstacles.push(o);});
  const ray=new THREE.Raycaster();
  for(const lane of [-3.2,0,3.2])for(let distance=5;distance<a.distanceTo(b)-5;distance+=1){
    const p=a.clone().addScaledVector(direction,distance).addScaledVector(normal,lane);
    const road=world.sampleRoad(p.x,p.y);assert.ok(road!==undefined,`missing road at ${distance}, lane ${lane}`);
    assert.ok(Math.abs(road-(groundAt(p.x)+.4))<.002,'surface must meet the cached road lift');
    ray.set(new THREE.Vector3(p.x,road+.1,p.y),new THREE.Vector3(0,1,0));
    const ceiling=ray.intersectObjects(obstacles,false)[0];assert.ok(ceiling,'overhead floor missing');
    assert.ok(ceiling.distance>4.7&&ceiling.distance<6,'passage filled down to street or raised excessively');
    for(const sign of [-1,1]){
      const state=createDriveState(p.x,road,p.y,Math.atan2(-direction.x*sign,-direction.y*sign));
      assert.equal(world.resolve(state,state).blocked,false,`invisible wall at ${distance}, lane ${lane}`);
    }
  }
  const road=campus.getObjectByName('us-bank-michigan-road') as THREE.Mesh;
  const normals=road.geometry.getAttribute('normal');
  assert.ok(Array.from({length:normals.count},(_,i)=>normals.getY(i)).every(y=>y>.99),'road faces must point upward');
});
