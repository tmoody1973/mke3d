import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildNewMuseumCampus} from '../src/newMuseumCampus.ts';
import {NEW_MUSEUM_SITE,NEW_MUSEUM_PARCEL} from '../src/newMuseumSite.ts';

test('completed museum campus fits the mapped construction parcel without entering adjoining streets',()=>{
 const campus=buildNewMuseumCampus(()=>NEW_MUSEUM_SITE.floor);campus.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(campus),parcel=NEW_MUSEUM_PARCEL.bounds;
 assert.ok(bounds.min.x>=parcel.xMin);assert.ok(bounds.max.x<=parcel.xMax);
 assert.ok(bounds.min.z>=parcel.zMin);assert.ok(bounds.max.z<=parcel.zMax);
 assert.ok(bounds.min.y>=NEW_MUSEUM_SITE.floor-.5);
 assert.equal(campus.userData.visualization,'future-completed-design');
 const shell=campus.getObjectByName('future-milwaukee-public-museum')!;
 assert.deepEqual(shell.position.toArray(),[NEW_MUSEUM_SITE.x,NEW_MUSEUM_SITE.floor,NEW_MUSEUM_SITE.z]);
 campus.userData.setLightingMode('night');assert.ok(shell.children.some(o=>o.name==='new-museum-canyon-interior-light'&&o.visible));
 campus.userData.setLightingMode('day');assert.ok(shell.children.every(o=>o.name!=='new-museum-canyon-interior-light'||!o.visible));
});

test('museum perimeter streetlights are grounded, bounded, and clear of the museum mass',()=>{
 const campus=buildNewMuseumCampus((x,z)=>NEW_MUSEUM_SITE.floor+.01*Math.sin(x+z));campus.updateMatrixWorld(true);
 const positions=campus.userData.streetlightPositions as {x:number,z:number,y:number}[];
 assert.equal(positions.length,6);
 const parcel=NEW_MUSEUM_PARCEL.bounds;
 for(const p of positions){
  assert.ok(p.x>=parcel.xMin&&p.x<=parcel.xMax&&p.z>=parcel.zMin&&p.z<=parcel.zMax);
  assert.ok(Math.abs(p.y-(NEW_MUSEUM_SITE.floor+.01*Math.sin(p.x+p.z)))<1e-8);
 }
 const pools=campus.getObjectByName('museum-streetlight-ground-light-pools') as THREE.InstancedMesh;
 assert.equal(pools.count,6);
 const museum=campus.getObjectByName('future-milwaukee-public-museum')!;
 const museumBounds=new THREE.Box3().setFromObject(museum);
 for(const p of positions)assert.ok(!museumBounds.containsPoint(new THREE.Vector3(p.x,p.y+3,p.z)));
});

test('museum perimeter streetlights follow day, sunset, and night lighting modes',()=>{
 const campus=buildNewMuseumCampus(()=>NEW_MUSEUM_SITE.floor);
 const pools=campus.getObjectByName('museum-streetlight-ground-light-pools') as THREE.InstancedMesh;
 const lamps=campus.getObjectByName('museum-streetlight-lamps') as THREE.Mesh;
 const glow=lamps.material as THREE.MeshStandardMaterial;
 campus.userData.setLightingMode('day');assert.equal(campus.userData.lightingMode,'day');assert.equal(pools.visible,false);assert.equal(glow.emissiveIntensity,0);
 campus.userData.setLightingMode('sunset');const sunsetOpacity=(pools.material as THREE.MeshBasicMaterial).opacity;assert.equal(pools.visible,true);assert.ok(sunsetOpacity>0);assert.ok(glow.emissiveIntensity>0);
 campus.userData.setLightingMode('night');assert.equal(campus.userData.lightingMode,'night');assert.equal(pools.visible,true);assert.ok((pools.material as THREE.MeshBasicMaterial).opacity>sunsetOpacity);assert.ok(glow.emissiveIntensity>1);
});
