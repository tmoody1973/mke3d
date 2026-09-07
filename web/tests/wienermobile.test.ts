import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { buildWienermobile } from '../src/wienermobile.ts';

test('Wienermobile is finite, grounded, correctly oriented, and within its reference envelope', () => {
  const car=buildWienermobile(); car.updateMatrixWorld(true); const box=new THREE.Box3().setFromObject(car), size=box.getSize(new THREE.Vector3());
  assert.ok(Math.abs(box.min.y)<.015, `road contact ${box.min.y}`);
  assert.ok(Math.abs(size.z-8.2296)<.04, `length ${size.z}`); assert.ok(Math.abs(size.x-2.4384)<.04, `width ${size.x}`);
  assert.ok(Math.abs(size.y-3.3528)<.08, `height ${size.y}`); assert.equal(car.userData.forwardAxis,'-Z');
  let meshes=0, triangles=0; car.traverse(o=>{assert.ok(o.position.toArray().every(Number.isFinite)); if(o instanceof THREE.Mesh){meshes++; const p=o.geometry.getAttribute('position'); assert.ok(Array.from(p.array).every(Number.isFinite)); triangles+=(o.geometry.index?.count??p.count)/3;}});
  assert.ok(meshes<65,`meshes ${meshes}`); assert.ok(triangles<35000,`triangles ${triangles}`);
});

test('wheels roll and front pivots steer independently',()=>{
  const car=buildWienermobile(), wheel=car.getObjectByName('wienermobile-wheel-front--1')!, pivot=car.getObjectByName('wienermobile-front-steer--1')!;
  const before=wheel.rotation.x; car.userData.animateWheels(2,-.31); assert.ok(wheel.rotation.x<before); assert.equal(pivot.rotation.y,.31);
  assert.equal(car.getObjectByName('wienermobile-rear-wheel-mount--1')!.rotation.y,0);
});

test('broad yellow end fairings physically back every lamp and grille',()=>{
  const car=buildWienermobile(); car.updateMatrixWorld(true);
  for(const [name,direction] of [['wienermobile-headlamp--1',1],['wienermobile-headlamp-1',1],['wienermobile-taillamp--1',-1],['wienermobile-taillamp-1',-1]] as const){
    const lamp=car.getObjectByName(name)!; const origin=lamp.getWorldPosition(new THREE.Vector3()); origin.z+=direction*.04;
    const hit=new THREE.Raycaster(origin,new THREE.Vector3(0,0,direction),0,.5).intersectObject(car,true).find(v=>v.object.name.endsWith('fairing'));
    assert.ok(hit,`${name} must contact a body fairing`);
  }
  const grille=car.getObjectByName('wienermobile-front-grille')!;
  assert.ok(new THREE.Box3().setFromObject(car.getObjectByName('wienermobile-front-fairing')!).containsPoint(grille.getWorldPosition(new THREE.Vector3())));
});

test('lighting modes and braking drive emissive vehicle surfaces',()=>{
  const car=buildWienermobile(), head=car.getObjectByName('wienermobile-headlamp--1') as THREE.Mesh, tail=car.getObjectByName('wienermobile-taillamp--1') as THREE.Mesh;
  car.userData.setMode('night'); assert.ok((head.material as THREE.MeshStandardMaterial).emissiveIntensity>1); const running=(tail.material as THREE.MeshStandardMaterial).emissiveIntensity;
  car.userData.setMode('night',true); assert.ok((tail.material as THREE.MeshStandardMaterial).emissiveIntensity>running);
  car.userData.setMode('day'); assert.equal((head.material as THREE.MeshStandardMaterial).emissiveIntensity,0); assert.equal(car.userData.mode,'day');
  const badge=car.getObjectByName('oscar-mayer-white-label') as THREE.Mesh; car.userData.setMode('night',true);
  assert.equal((badge.material as THREE.MeshStandardMaterial).emissiveIntensity,0,'branding does not glow with lamps');
});
