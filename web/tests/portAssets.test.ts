import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildPortCrane,buildPortDome,buildPortWarehouse,buildPortSilos,buildPortTurbine} from '../src/portAssets.ts';

const factories=[
  ['crane',()=>buildPortCrane(),25000,8],['dome',()=>buildPortDome(),10000,8],['warehouse',()=>buildPortWarehouse(),10000,8],
  ['silos',()=>buildPortSilos(),10000,8],['turbine',()=>buildPortTurbine(),10000,8],
] as const;

for(const [name,make,maxTriangles,maxDraws] of factories)test(`${name} is finite, grade-zero, and within render budgets`,()=>{
  const model=make(),box=new THREE.Box3().setFromObject(model),size=new THREE.Vector3();box.getSize(size);
  assert.ok([box.min.x,box.min.y,box.min.z,box.max.x,box.max.y,box.max.z,...Object.values(model.userData.dimensions)].every(Number.isFinite));
  assert.ok(Math.abs(box.min.y)<.01,`minimum y was ${box.min.y}`);assert.ok(size.x>0&&size.y>0&&size.z>0);
  assert.ok(model.userData.drawCalls<=maxDraws);assert.ok(model.userData.triangles<maxTriangles);
  assert.equal(typeof model.userData.setLightingMode,'function');model.userData.setLightingMode('night');model.userData.setLightingMode('day');
});

test('factory options scale useful placement dimensions',()=>{
  assert.equal(buildPortWarehouse({width:80,depth:31,height:15}).userData.dimensions.width,80);
  assert.equal(buildPortCrane({height:50,boomLength:61,baseWidth:12}).userData.dimensions.boomLength,61);
  assert.equal(buildPortDome({radius:22,height:19}).userData.dimensions.radius,22);
  assert.equal(buildPortSilos({count:6}).userData.dimensions.count,6);
  assert.equal(buildPortTurbine({height:44,rotorRadius:13}).userData.dimensions.hubHeight,44);
});

test('warehouse roof rises to a central ridge with outward opposing slope normals',()=>{
  const warehouse=buildPortWarehouse({width:40,depth:20,height:12});
  const roof=warehouse.getObjectByName('port-warehouse-pitched-roof') as THREE.Mesh;
  const hit=(x:number)=>new THREE.Raycaster(new THREE.Vector3(x,30,0),new THREE.Vector3(0,-1,0)).intersectObject(roof)[0];
  const left=hit(-18),nearRidgeLeft=hit(-.5),nearRidgeRight=hit(.5),right=hit(18);
  assert.ok(left&&nearRidgeLeft&&nearRidgeRight&&right);
  assert.ok(nearRidgeLeft.point.y>left.point.y+1.5);assert.ok(nearRidgeRight.point.y>right.point.y+1.5);
  assert.ok(left.face!.normal.x<0);assert.ok(right.face!.normal.x>0);
  assert.ok(left.face!.normal.y>.8&&right.face!.normal.y>.8);
});
