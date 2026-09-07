import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { buildDeerDistrict } from '../src/deerDistrict.ts';

test('plaza paving follows terrain above the cached pedestrian ribbon without excessive draw calls',()=>{
  const ground=(x:number,z:number)=>4+.003*(x+890)+.00006*(z+1100)**2;
  const root=buildDeerDistrict(ground);let drawCalls=0,triangles=0;
  root.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;drawCalls++;
    const p=o.geometry.getAttribute('position');
    assert.ok(Array.from(p.array).every(Number.isFinite),o.name);
    triangles+=(o.geometry.index?.count??p.count)/3;
    if(o.name==='district-hardscape'||o.name==='district-patterned-paving')for(let i=0;i<p.count;i++){
      const clearance=p.getY(i)-ground(p.getX(i),p.getZ(i));
      assert.ok(clearance>=.429&&clearance<.45,`${o.name}: surface intersects old pedestrian ROAD`);
    }
  });
  assert.ok(drawCalls<=17,`${drawCalls} draw calls`);
  assert.ok(triangles<80000,`${triangles} triangles`);
  assert.equal(root.getObjectsByProperty('isLight',true).length,0);
});

test('Beer Garden keeps a full-height central walking aisle and plaza has the referenced amenities',()=>{
  const root=buildDeerDistrict(()=>4);root.updateMatrixWorld(true);
  for(const z of [-1111,-1109.5,-1108]){
    const hits=new THREE.Raycaster(new THREE.Vector3(-865,5.7,z),new THREE.Vector3(1,0,0),0,84).intersectObject(root,true);
    assert.equal(hits.length,0,`Beer Garden aisle obstructed at z=${z}`);
  }
  const features=root.userData.features as {type:string}[];
  assert.equal(features.filter(f=>f.type==='fountain').length,3);
  assert.ok(features.filter(f=>f.type==='tree').length>=10);
  assert.ok(features.filter(f=>f.type==='bench').length>=10);
});

test('quiet district lighting switches off in day and restores without per-prop lights',()=>{
  const root=buildDeerDistrict(()=>4),lenses=root.getObjectByName('district-lamp-lenses')!;
  assert.equal(lenses.visible,false);root.userData.setLightingMode('sunset');assert.equal(lenses.visible,true);
  root.userData.setLightingMode('night');assert.equal(lenses.visible,true);
  root.userData.setLightingMode('day');assert.equal(lenses.visible,false);
});
