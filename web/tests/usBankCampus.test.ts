import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {buildUsBankCampus} from '../src/usBankCampus.ts';
import {US_BANK_SITE as site} from '../src/usBankSite.ts';
test('mapped Galleria is grounded on a sloping site while shaft retains physical height',()=>{
 const root=buildUsBankCampus((_x,z)=>site.floor+Math.max(-2,Math.min(3,(site.z-z)*.05)));
 assert.deepEqual(root.position.toArray(),[site.x,site.floor,site.z]);assert.equal(root.rotation.y,site.bearing);
 root.position.set(0,0,0);root.rotation.y=0;
 assert.ok(Math.abs(new THREE.Box3().setFromObject(root).max.y-183.2)<.001);
 const base=root.getObjectByName('us-bank-galleria-travertine')!;
 assert.ok(new THREE.Box3().setFromObject(base).min.y<-2,'south podium is not grounded');
 for(const name of ['us-bank-galleria-roofs','us-bank-galleria-glass','us-bank-galleria-mullions'])assert.ok(root.getObjectByName(name));
 let meshes=0;root.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;const p=o.geometry.getAttribute('position');assert.ok(Array.from(p.array).every(Number.isFinite),o.name);}});assert.ok(meshes<=24);
 const glass=(root.getObjectByName('us-bank-galleria-glass') as THREE.Mesh).material as THREE.MeshPhongMaterial;
 root.userData.setLightingMode('night');assert.ok(glass.emissiveIntensity>0&&glass.emissiveIntensity<.25);
 root.userData.setLightingMode('day');assert.equal(glass.emissiveIntensity,0);
});
