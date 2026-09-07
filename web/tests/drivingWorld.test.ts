import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createDrivingWorld} from '../src/drivingWorld.ts';
import {createDriveState,stepDrive} from '../src/drivingPhysics.ts';

function quad(name:string,x0:number,x1:number,z0:number,z1:number,y:number){
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([x0,y,z0,x1,y,z0,x1,y,z1,x0,y,z0,x1,y,z1,x0,y,z1],3));
 const m=new THREE.Mesh(g);m.name=name;return m;
}
function wall(x:number,z0:number,z1:number){
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([x,0,z0,x,5,z0,x,5,z1,x,0,z0,x,5,z1,x,0,z1],3));
 const m=new THREE.Mesh(g);m.name='BLDG';return m;
}
test('samples road triangles, choosing the deck nearest the prior height',()=>{
 const root=new THREE.Group();root.add(quad('ROAD',-20,20,-20,20,0),quad('ROAD',-5,5,-5,5,12));const world=createDrivingWorld(root);
 assert.equal(world.sampleRoad(0,0),0);assert.equal(world.sampleRoad(0,0,11),12);assert.equal(world.sampleRoad(0,0,1),0);assert.equal(world.sampleRoad(30,0),undefined);
});
test('resolve blocks gaps, abrupt deck jumps, and building walls',()=>{
 const root=new THREE.Group();root.add(quad('ROAD',-20,20,-20,4,0),quad('ROAD',-20,20,8,30,0),wall(3,-10,3));const world=createDrivingWorld(root);
 assert.equal(world.resolve(createDriveState(0,0,-2),createDriveState(0,0,-2)).blocked,false,'a separate collinear wall must not collide');
 const previous=createDriveState(0,0,0), gap={...previous,z:6};assert.equal(world.resolve(previous,gap).blocked,true);
 const wallMove={...previous,x:2.5};assert.equal(world.resolve(previous,wallMove).blocked,true);
 root.add(quad('ROAD',-20,20,-20,20,8));const stacked=createDrivingWorld(root);assert.equal(stacked.resolve(previous,{...previous,x:-5}).y,0);
});
test('cache notices world transform changes without rebuilding for every footprint sample',()=>{
 const root=new THREE.Group(),road=quad('ROAD',-20,20,-20,20,2);root.add(road);const world=createDrivingWorld(root);
 assert.equal(world.sampleRoad(0,0),2);root.scale.y=2;assert.equal(world.sampleRoad(0,0),4);
});
test('findSpawn stays within radius and camera stops before a facade',()=>{
 const root=new THREE.Group();root.add(quad('ROAD',-20,20,-30,30,0),wall(5,-20,20));const world=createDrivingWorld(root);
 const spawn=world.findSpawn(0,0);assert.ok(spawn);assert.ok(Math.hypot(spawn.x,spawn.z)<=1000);
 const camera=world.cameraPosition(new THREE.Vector3(0,2,0),new THREE.Vector3(10,2,0));assert.ok(camera.x>0&&camera.x<5);
});
test('spawn heading provides a straight drivable corridor rather than following a triangle diagonal',()=>{
 const root=new THREE.Group();root.add(quad('ROAD',-6,6,-60,60,0));const world=createDrivingWorld(root),spawn=world.findSpawn(0,0);assert.ok(spawn);
 const state=createDriveState(spawn.x,spawn.y,spawn.z,spawn.yaw);let blocked=0;
 for(let i=0;i<180;i++)stepDrive(state,{throttle:1,steer:0,brake:false},1/60,(previous,next)=>{const result=world.resolve(previous,next);if(result.blocked)blocked++;return result;});
 assert.equal(blocked,0);assert.ok(state.distance>20);
});

test('reverse escapes a tight wall while steering waits for body clearance',()=>{
 const root=new THREE.Group();root.add(quad('ROAD',-30,30,-30,40,0),wall(1.26,-12,2));
 const world=createDrivingWorld(root),state=createDriveState(0,0,0);
 state.speed=-3;state.steer=Math.PI*27/180;
 let safeStraightFallbacks=0;
 for(let i=0;i<240;i++){
   stepDrive(state,{throttle:-1,steer:1,brake:false},1/60,(previous,next)=>{
     const result=world.resolve(previous,next);
     if(next.yaw===previous.yaw&&!result.blocked)safeStraightFallbacks++;
     return result;
   });
   assert.equal(world.resolve(state,state).blocked,false,'recovery must not cross the wall or leave pavement');
 }
 assert.ok(safeStraightFallbacks>0,'tight corner should recover with checked straight movement');
 assert.ok(state.distance>8,'vehicle remains pinned against the wall');
 assert.ok(state.yaw>.1,'steering never resumes after clearing the wall');
});

test('a head-on collision stops fully and reverse engages on the next step',()=>{
 const root=new THREE.Group(),front=wall(0,-20,20);front.rotation.y=Math.PI/2;front.position.z=-6;
 root.add(quad('ROAD',-30,30,-30,40,0),front);
 const world=createDrivingWorld(root),state=createDriveState(0,0,0);
 for(let i=0;i<180;i++)stepDrive(state,{throttle:1,steer:0,brake:false},1/60,world.resolve);
 assert.equal(state.speed,0);assert.ok(state.z>=-1.85);
 const impactZ=state.z;
 stepDrive(state,{throttle:-1,steer:0,brake:false},1/60,world.resolve);
 assert.ok(state.speed<0);assert.ok(state.z>impactZ,'reverse is still pushing into the wall');
});

function terrainWorld(){
 const tiles=new THREE.Group(),tile=new THREE.Group(),environment=new THREE.Group();
 tile.add(quad('ROAD',-20,-5,-25,25,0),quad('ROAD',5,20,-25,25,0));tiles.add(tile);environment.add(tiles);
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([-100,0,-100,100,0,-100,100,0,100,-100,0,100],3));
 geometry.setIndex([0,1,2,0,2,3]);
 const ground=new THREE.Mesh(geometry);ground.name='TERRAIN';ground.position.y=-.6;environment.add(ground);
 return{tiles,tile,environment,ground,world:createDrivingWorld(tiles,environment)};
}

test('loaded dry terrain supports road gaps and off-road movement at rendered indexed heights',()=>{
 const {tiles,world,ground}=terrainWorld(),previous=createDriveState(-7,0,0),next={...previous,x:0};
 const result=world.resolve(previous,next);
 assert.equal(result.blocked,false);assert.equal(result.y,-.6);
 assert.equal(world.sampleRoad(0,0),undefined,'terrain must not become a road or spawn surface');
 assert.equal(createDrivingWorld(tiles).resolve(previous,next).blocked,true,'strict road-only mode is retained');
 ground.position.y=-.3;
 assert.equal(world.resolve({...next,y:-.6},next).y,-.3,'terrain world transforms invalidate the cache');
});

test('water blocks terrain beneath any footprint sample while a road deck stays supported',()=>{
 const {world,environment}=terrainWorld(),previous=createDriveState(0,-.6,0);
 assert.equal(world.resolve(previous,previous).blocked,false);
 const water=quad('WATER',1,4,-10,10,0);environment.add(water);
 assert.equal(world.resolve(previous,previous).blocked,true,'a wet outside corner must block the full vehicle');
 const onRoad=createDriveState(10,0,0);environment.add(quad('WATER',5,20,-25,25,-.1));
 assert.equal(world.resolve(onRoad,onRoad).blocked,false,'roads above water remain drivable');
 water.position.y=-1;
 assert.equal(world.resolve(previous,previous).blocked,false,'water below rendered terrain is not a flooded surface');
});

test('terrain fallback cannot cross unloaded tile gaps or continue after a tile unloads',()=>{
 const {tiles,tile,world}=terrainWorld(),previous=createDriveState(0,-.6,0);
 assert.equal(world.resolve(previous,{...previous,x:25}).blocked,true);
 const distantTile=new THREE.Group();distantTile.add(quad('ROAD',40,60,-25,25,0));tiles.add(distantTile);
 assert.equal(world.resolve(previous,{...previous,x:30}).blocked,true,'separate tile bounds must not bridge unloaded neighborhoods');
 assert.equal(world.resolve(previous,{...previous,x:19.5}).blocked,true,'the entire footprint must stay inside loaded coverage');
 tiles.remove(tile);
 assert.equal(world.resolve(previous,previous).blocked,true,'cached terrain must respect tile unloading');
});

test('terrain fallback retains bridge drop and building collision checks',()=>{
 const {tile,world}=terrainWorld();tile.add(quad('HWAY',-4,4,-25,25,12));
 const bridge=createDriveState(0,12,0);
 assert.equal(world.resolve(bridge,bridge).blocked,false);
 assert.equal(world.resolve(bridge,{...bridge,x:3}).blocked,true,'partial bridge support cannot drop one side to terrain');
 assert.equal(world.resolve(bridge,{...bridge,x:8}).blocked,true,'whole-vehicle deck drops remain blocked');
 tile.add(wall(-2,-15,15));
 const onTerrain=createDriveState(-3.5,-.6,0);
 assert.equal(world.resolve(onTerrain,{...onTerrain,x:-2.5}).blocked,true,'off-road fallback must not loosen building collision');
});
