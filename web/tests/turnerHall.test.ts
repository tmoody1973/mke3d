import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildTurnerHall } from '../src/turnerHall.ts';
import { TURNER_HALL_SITE as site } from '../src/turnerHallSite.ts';

test('all exterior materials merge, including mixed roof primitives',()=>{
 const errors:unknown[]=[];const original=console.error;console.error=(...args)=>errors.push(args);
 let model:THREE.Group;try{model=buildTurnerHall(()=>3.5);}finally{console.error=original;}
 assert.deepEqual(errors,[]);assert.equal(model!.children.length,8);
 const roof=model!.getObjectByName('turner-roof') as THREE.Mesh;
 assert.ok(roof);roof.geometry.computeBoundingBox();assert.ok(roof.geometry.boundingBox!.max.y>29);
 for(const mesh of model!.children as THREE.Mesh[])for(const value of mesh.geometry.getAttribute('position').array)assert.ok(Number.isFinite(value));
});
test('street foundation reaches terrain and west facade remains west after placement',()=>{
 const model=buildTurnerHall(()=>4.2);model.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(model);
 assert.ok(bounds.min.y<4.2);assert.ok(bounds.max.y>32);
 assert.ok(Math.abs(bounds.getCenter(new THREE.Vector3()).x-site.x)<3);
 const front=new THREE.Vector3(-25,5,0).applyMatrix4(model.matrixWorld);
 assert.ok(front.x<site.x-24);assert.ok(Math.abs(front.z-site.z)<4);
});
test('night windows and lamps reset cleanly to daylight',()=>{
 const model=buildTurnerHall(()=>0),glass=(model.getObjectByName('turner-glass') as THREE.Mesh).material as THREE.MeshStandardMaterial;
 model.userData.setLightingMode('night');assert.ok(glass.emissiveIntensity>.2);
 model.userData.setLightingMode('sunset');assert.ok(glass.emissiveIntensity>0&&glass.emissiveIntensity<.2);
 model.userData.setLightingMode('day');assert.equal(glass.emissiveIntensity,0);
});
