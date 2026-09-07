import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildClarifierDetails,buildIndustrialRoofDetails,buildKaszubesPark} from '../src/jonesIslandAssets.ts';

const assets=[
  ['clarifier',()=>buildClarifierDetails({radius:14}),8,10000],
  ['roof',()=>buildIndustrialRoofDetails({width:54,depth:28}),8,10000],
  ['park',()=>buildKaszubesPark({width:30,depth:22}),8,10000],
] as const;

for(const [name,make,maxDraws,maxTriangles] of assets)test(`${name} is finite, grade-zero and within detail budgets`,()=>{
  const asset=make(),bounds=new THREE.Box3().setFromObject(asset);
  assert.ok([bounds.min.x,bounds.min.y,bounds.min.z,bounds.max.x,bounds.max.y,bounds.max.z,...Object.values(asset.userData.dimensions)].every(Number.isFinite));
  assert.ok(Math.abs(bounds.min.y)<.01,`minimum y was ${bounds.min.y}`);
  assert.ok(asset.userData.drawCalls<=maxDraws);assert.ok(asset.userData.triangles<maxTriangles);
});

test('clarifier ring leaves open water away from its narrow access bridge',()=>{
  const clarifier=buildClarifierDetails({radius:12,waterY:.6});
  const ring=clarifier.getObjectByName('clarifier-concrete-ring-and-hub') as THREE.Mesh;
  const openWaterRay=new THREE.Raycaster(new THREE.Vector3(0,4,6),new THREE.Vector3(0,-1,0));
  assert.equal(openWaterRay.intersectObject(ring).length,0);
  assert.equal(clarifier.userData.dimensions.innerDiameter,22.4);
});

test('custom dimensions are retained for parent placement',()=>{
  assert.equal(buildIndustrialRoofDetails({width:80,depth:35}).userData.dimensions.width,80);
  assert.equal(buildKaszubesPark({width:42,depth:26}).userData.dimensions.depth,26);
  assert.equal(buildClarifierDetails({radius:18}).userData.dimensions.outerDiameter,36);
});
