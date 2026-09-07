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
 assert.ok(bounds.min.y>=NEW_MUSEUM_SITE.floor-.71);
 assert.equal(campus.userData.visualization,'future-completed-design');
 const shell=campus.getObjectByName('future-milwaukee-public-museum')!;
 assert.equal(shell.position.x,NEW_MUSEUM_SITE.x);assert.equal(shell.position.z,NEW_MUSEUM_SITE.z);
 assert.ok(Math.abs(new THREE.Box3().setFromObject(shell.getObjectByName('BLDG')!).min.y-NEW_MUSEUM_SITE.floor)<.001);
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
  assert.ok(Math.abs(p.y-campus.userData.groundAt(p.x,p.z))<1e-8);
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


test('published site-plan landscape connects Vliet to McKinley and renders upward on varying terrain',()=>{
 const ground=(x:number,z:number)=>NEW_MUSEUM_SITE.floor+.005*(x+1100)+.003*(z+1480);
 const campus=buildNewMuseumCampus(ground);
 const path=campus.userData.gardenPath as [number,number][];
 assert.ok(path[0]![1]<-1475,'north path reaches the Vliet edge');
 assert.ok(path.at(-1)![1]>-1355,'south path reaches McKinley');
 for(let i=1;i<path.length;i++)assert.ok(Math.hypot(path[i]![0]-path[i-1]![0],path[i]![1]-path[i-1]![1])<3,'walk has no disconnected sections');
 const paths=campus.getObjectByName('museum-connected-garden-paths') as THREE.Mesh;
 assert.ok(paths);
 const positions=paths.geometry.getAttribute('position'),normals=paths.geometry.getAttribute('normal');
 for(let i=0;i<positions.count;i++){
  assert.ok(normals.getY(i)>.9,'walk paving faces the sky');
  assert.ok(Math.abs(positions.getY(i)-campus.userData.groundAt(positions.getX(i),positions.getZ(i))-.09)<.02,'paving follows local terrain');
 }
 assert.ok(campus.userData.plantCount>100,'source plan has substantial perimeter planting');
 assert.ok(campus.userData.treePositions.length>=20,'landscape includes street rows and garden trees');
});

test('north garage and garden boardwalk occupy distinct areas clear of the main museum',()=>{
 const campus=buildNewMuseumCampus(()=>NEW_MUSEUM_SITE.floor);
 const garage=campus.userData.garage as {x:number,z:number,width:number,depth:number,height:number};
 const boardwalk=campus.userData.boardwalk as [number,number][];
 assert.ok(garage.z+garage.depth/2<NEW_MUSEUM_SITE.z-NEW_MUSEUM_SITE.buildingDepth/2);
 assert.ok(garage.height>8&&garage.height<15,'garage remains subordinate to the museum with three open parking levels');
 assert.ok(campus.getObjectByName('museum-parking-garden-screen'));
 assert.ok(campus.getObjectByName('museum-parking-vliet-banners'));
 assert.equal(campus.getObjectByName('museum-north-cafe-wing'),undefined);
 for(const [x,z] of boardwalk){assert.ok(x<garage.x-garage.width/2);assert.ok(z<NEW_MUSEUM_SITE.z-NEW_MUSEUM_SITE.buildingDepth/2);}
 assert.ok(campus.getObjectByName('museum-rain-garden-basin'));
});
