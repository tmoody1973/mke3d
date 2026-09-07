import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { buildNM } from '../src/nmCampus.ts';
import { NM_SITE } from '../src/nmSite.ts';

test('Commons remains low beside the full-height tower and foundations reach ground', () => {
  const campus=buildNM(()=>10);campus.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(campus);
  assert.ok(Math.abs(bounds.max.y-(NM_SITE.floor+169))<.5);
  assert.ok(bounds.min.y<10 && bounds.min.y>9.5);
  // West-central five-story Commons, formerly inside the whole-campus 182m slab.
  const hits=new THREE.Raycaster(new THREE.Vector3(271,220,-550),new THREE.Vector3(0,-1,0)).intersectObject(campus,true);
  assert.ok(hits.length);assert.ok(hits[0].point.y<35 && hits[0].point.y>29);
  const westernExtent=bounds.min.x;assert.ok(westernExtent<184 && westernExtent>180);
  assert.ok(campus.userData.commonsParts.every((p:{top:number})=>p.top<=23));
});

test('night mode updates both assemblies with bounded geometry and no scene lights', () => {
  const campus=buildNM(()=>13);
  let meshes=0;
  campus.traverse(object=>{
    assert.ok(!(object instanceof THREE.Light));
    if(object instanceof THREE.Mesh){
      meshes++;const p=object.geometry.getAttribute('position');
      for(const n of p.array)assert.ok(Number.isFinite(n));
      if(object.name!=='nm-occupied-office-suites')assert.ok(object.castShadow && object.receiveShadow);
    }
  });
  assert.ok(meshes<=13);
  const bays=campus.getObjectByName('nm-commons-occupied-bays') as THREE.Mesh;
  assert.equal(bays.visible,false);
  campus.userData.setLightingMode('sunset');const sunset=(bays.material as THREE.MeshBasicMaterial).opacity;
  campus.userData.setLightingMode('night');assert.ok((bays.material as THREE.MeshBasicMaterial).opacity>sunset);
  campus.userData.setLightingMode('day');assert.equal(bays.visible,false);
});
