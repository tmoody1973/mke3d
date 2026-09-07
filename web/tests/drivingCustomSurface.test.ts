import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createDrivingWorld} from '../src/drivingWorld.ts';
import {createDriveState} from '../src/drivingPhysics.ts';

function quad(x0:number,x1:number,z0:number,z1:number,y:number){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([
    x0,y,z0,x1,y,z0,x1,y,z1,x0,y,z0,x1,y,z1,x0,y,z1
  ],3));
  return new THREE.Mesh(geometry);
}

function wall(x:number,z0:number,z1:number){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([
    x,0,z0,x,5,z0,x,5,z1,x,0,z0,x,5,z1,x,0,z1
  ],3));
  return new THREE.Mesh(geometry);
}

test('explicit custom road and building surfaces participate in driving',()=>{
  const tiles=new THREE.Group(),environment=new THREE.Group();
  const road=quad(-20,20,-20,20,2);road.name='campus-asphalt';road.userData.drivingSurface='road';
  const building=wall(3,-10,10);building.name='campus-wall';building.userData.drivingSurface='building';
  environment.add(road,building);
  const world=createDrivingWorld(tiles,environment);
  assert.equal(world.sampleRoad(0,0),2);
  const previous=createDriveState(0,2,0);
  assert.equal(world.resolve(previous,{...previous,x:2.5}).blocked,true);
});

test('custom surface transforms invalidate the cache and untagged models stay ignored',()=>{
  const tiles=new THREE.Group(),environment=new THREE.Group();
  const road=quad(-20,20,-20,20,1);road.userData.drivingSurface='road';
  const decoration=quad(-20,20,-20,20,9);decoration.name='model-road';
  environment.add(road,decoration);
  const world=createDrivingWorld(tiles,environment);
  assert.equal(world.sampleRoad(0,0),1,'untagged model geometry must not become a road');
  road.position.y=3;
  assert.equal(world.sampleRoad(0,0),4,'world transform changes must rebuild custom surfaces');
  road.userData.drivingSurface=undefined;
  assert.equal(world.sampleRoad(0,0),undefined,'removing the opt-in must remove the cached surface');
});
