import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildDeerDistrictBuildings, DEER_DISTRICT_BUILDING_SITES, removeDeerDistrictBuildingPlaceholders } from '../src/deerDistrictBuildings.ts';

test('district buildings follow mapped sites and preserve the real Beer Garden promenade',()=>{
  const model=buildDeerDistrictBuildings(()=>3.4);
  assert.equal(model.userData.drawCalls,5);
  assert.ok(model.getObjectByName('BLDG'));
  const passage=DEER_DISTRICT_BUILDING_SITES.promenade.bounds;
  const ray=new THREE.Raycaster(new THREE.Vector3(-865.8,4,(passage.z0+passage.z1)/2),new THREE.Vector3(1,0,0));
  const solid=model.getObjectByName('BLDG') as THREE.Mesh;
  assert.equal(ray.intersectObject(solid).length,0);
  assert.equal(model.userData.detail.promenadeCenterZ,-1109.5);
});

test('placeholder removal is restricted to exact cached source vertices and tile',()=>{
  const site=DEER_DISTRICT_BUILDING_SITES.tradeHotel;
  const [a,b,c]=site.footprint;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([...a.slice(0,1),site.source.roof,a[1],...b.slice(0,1),site.source.roof,b[1],...c.slice(0,1),site.source.roof,c[1]],3));
  const mesh=new THREE.Mesh(geometry);mesh.name='BLDG';const group=new THREE.Group();group.add(mesh);
  assert.equal(removeDeerDistrictBuildingPlaceholders(group,{i:0,j:0}),0);
  assert.equal(removeDeerDistrictBuildingPlaceholders(group,{i:-1,j:0}),1);
  assert.equal(mesh.geometry.getAttribute('position').count,0);
});

test('district glazing and reveal lights respond to scene lighting',()=>{
  const model=buildDeerDistrictBuildings(()=>3.4);
  const lights=model.getObjectByName('deer-district-interior-and-reveal-lighting') as THREE.Mesh;
  assert.equal(lights.visible,false);
  model.userData.setLightingMode('night');
  assert.equal(lights.visible,true);
  assert.ok((lights.material as THREE.MeshBasicMaterial).opacity>.4);
  model.userData.setLightingMode('day');
  assert.equal(lights.visible,false);
});
