import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildMarcusGarage} from '../src/marcusGarage.ts';
import {MARCUS_GARAGE_SITE as s,MARCUS_CONNECTOR_SITE as bridge} from '../src/marcusSite.ts';

test('garage has finite merged geometry, screened deck edges, and mapped placement',()=>{
 const root=buildMarcusGarage(()=>4.3);root.updateMatrixWorld(true);
 assert.equal(root.userData.deckCount,4);assert.equal(root.userData.finishedFloor,4.3);
 let triangles=0;root.traverse(o=>{if(o instanceof THREE.Mesh){const p=o.geometry.getAttribute('position');triangles+=p.count/3;for(const n of p.array)assert.ok(Number.isFinite(n));}});
 assert.ok(triangles>5000&&triangles<80000);
 const bounds=new THREE.Box3().setFromObject(root.getObjectByName('BLDG')!);
 assert.ok(Math.abs(bounds.getCenter(new THREE.Vector3()).x-s.x)<.01);
 assert.ok(Math.abs(bounds.getCenter(new THREE.Vector3()).z-s.z)<.01);
 const probe=(z:number)=>{
  const p=new THREE.Vector3(s.width/2+3,6,z).applyAxisAngle(new THREE.Vector3(0,1,0),s.bearing).add(new THREE.Vector3(s.x,4.3,s.z));
  const dir=new THREE.Vector3(-1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0),s.bearing);
  return new THREE.Raycaster(p,dir).intersectObject(root,true)[0];
 };
 const fin=probe(-s.depth/2+.8+31),gap=probe(-s.depth/2+1.5+31);
 assert.equal(fin.object.name,'marcus-garage-edge');
 assert.ok(gap.distance>fin.distance+1,'deep open recess is visible between concrete fins');
});

test('State Street stays open underneath an elevated skywalk',()=>{
 const root=buildMarcusGarage(()=>4.3);root.updateMatrixWorld(true);
 const from=new THREE.Vector3(bridge.x,4.3+1.7,bridge.z);
 for(const direction of [new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0)]){
  const ray=new THREE.Raycaster(from,direction,0,12);assert.equal(ray.intersectObject(root,true).length,0);
 }
 const upward=new THREE.Raycaster(from,new THREE.Vector3(0,1,0));
 assert.ok(upward.intersectObject(root,true)[0].point.y>9,'street clearance below enclosed skywalk');
});

test('garage deck and connector lighting respond to night and reset in day',()=>{
 const root=buildMarcusGarage(()=>0),lamp=(root.getObjectByName('marcus-garage-lamp') as THREE.Mesh).material as THREE.MeshStandardMaterial;
 root.userData.setLightingMode('sunset');const dusk=lamp.emissiveIntensity;root.userData.setLightingMode('night');assert.ok(lamp.emissiveIntensity>dusk&&dusk>0);root.userData.setLightingMode('day');assert.equal(lamp.emissiveIntensity,0);
});
