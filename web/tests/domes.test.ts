import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { buildDomes, DOME_DIAMETER_M, DOME_HEIGHT_M, DOMES_CENTERS, OCULUS_DIAMETER_M } from '../src/domes.ts';

function bounds(object: THREE.Object3D) { object.updateMatrixWorld(true); return new THREE.Box3().setFromObject(object); }

test('three measured conoidal domes are full scale, separated, and grounded', () => {
  const model=buildDomes(), all=bounds(model);
  assert.equal(DOME_DIAMETER_M,42.672); assert.equal(DOME_HEIGHT_M,25.908); assert.equal(OCULUS_DIAMETER_M,11.2776);
  assert.ok(Math.abs(all.max.y-DOME_HEIGHT_M)<.002,`height ${all.max.y}`);
  assert.ok(all.min.y<0 && all.min.y>-.5,`foundation minimum ${all.min.y}`);
  for(let i=0;i<DOMES_CENTERS.length;i++)for(let j=i+1;j<DOMES_CENTERS.length;j++){
    const a=DOMES_CENTERS[i],b=DOMES_CENTERS[j];
    assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>DOME_DIAMETER_M,`${a.name} overlaps ${b.name}`);
  }
  for(const center of DOMES_CENTERS){
    const base=model.getObjectByName(`${center.name}-patterned-base`) as THREE.Mesh;
    const cap=model.getObjectByName(`${center.name}-oculus-cap`) as THREE.Mesh;
    const bb=bounds(base),cb=bounds(cap);
    assert.ok(bb.min.y<0 && bb.max.y>0,'foundation does not straddle floor');
    assert.ok(Math.abs((cb.max.x-cb.min.x)-OCULUS_DIAMETER_M)<.03,'oculus misses measured diameter');
  }
});

test('glazing is faceted, transparent, varied, and distinct from the structural lattice', () => {
  const model=buildDomes();
  const glass=model.getObjectByName('domes-blue-gray-glazing') as THREE.Mesh;
  const material=glass.material as THREE.MeshPhongMaterial;
  assert.ok(material.transparent && material.opacity>.85 && material.depthWrite && material.side===THREE.FrontSide);
  assert.ok(glass.geometry.getAttribute('color').count===glass.geometry.getAttribute('position').count);
  assert.equal(glass.geometry.getAttribute('position').count/3/3,1_920,'expected 1,920 triangular panes per dome');
  assert.ok((model.getObjectByName('domes-aluminum-diagonal-lattice') as THREE.Mesh).geometry.getAttribute('position').count>20_000);
  assert.ok(model.getObjectByName('domes-primary-structural-ribs'));
  assert.equal(glass.castShadow,false,'transparent shell should not cast an opaque blob');
});

test('glazing triangles face outward from each dome axis', () => {
  const glass=buildDomes().getObjectByName('domes-blue-gray-glazing') as THREE.Mesh;
  const p=glass.geometry.getAttribute('position');
  const trianglesPerDome=20*48*2;
  for(let dome=0;dome<DOMES_CENTERS.length;dome++){
    const first=dome*trianglesPerDome*3;
    const a=new THREE.Vector3().fromBufferAttribute(p,first);
    const b=new THREE.Vector3().fromBufferAttribute(p,first+1);
    const c=new THREE.Vector3().fromBufferAttribute(p,first+2);
    const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const center=DOMES_CENTERS[dome];
    const radial=new THREE.Vector3(a.x-center.x,0,a.z-center.z).normalize();
    assert.ok(normal.dot(radial)>.5,`${center.name} glazing normal points inward`);
  }
});

test('model geometry is finite and economical', () => {
  const model=buildDomes(); let drawables=0,triangles=0;
  model.traverse(object=>{if(!(object instanceof THREE.Mesh))return; drawables++;
    const p=object.geometry.getAttribute('position'); assert.ok(Array.from(p.array).every(Number.isFinite),`${object.name} has invalid vertices`);
    triangles+=object.geometry.index?object.geometry.index.count/3:p.count/3;
  });
  assert.ok(drawables<20,`drawables ${drawables}`); assert.ok(triangles<180_000,`triangles ${triangles}`);
});

test('west lobby remains low, presents repeated arches, and lighting mode is reversible', () => {
  const model=buildDomes(), lobby=model.getObjectByName('low-connecting-lobby')!, arches=model.getObjectByName('west-entrance-nine-scalloped-arches')!;
  assert.ok(bounds(lobby).max.y<5); assert.ok(bounds(arches).min.x<bounds(lobby).min.x);
  assert.ok(bounds(arches).max.y>5.9 && bounds(arches).max.y<6.3,'entrance misses six-metre proportion');
  const plants=model.getObjectByName('desert-dome-northwest-interior-planting') as THREE.Mesh;
  const material=plants.material as THREE.MeshLambertMaterial;
  model.userData.setLightingMode('night'); assert.ok(material.emissive.getHex()>0);
  model.userData.setLightingMode('day'); assert.equal(material.emissive.getHex(),0);
});

test('oculus roofs close the crown and entrance vaults have continuous shelter and tall glazing', () => {
  const model=buildDomes(); model.updateMatrixWorld(true);
  const roofs=model.getObjectByName('domes-closed-oculus-roofs')!;
  for(const center of DOMES_CENTERS){
    const ray=new THREE.Raycaster(new THREE.Vector3(center.x+1,30,center.z+.7),new THREE.Vector3(0,-1,0));
    const hit=ray.intersectObject(roofs)[0];
    assert.ok(hit && hit.point.y>25.8 && hit.point.y<=DOME_HEIGHT_M,'crown still has an open hole');
  }
  const vaults=model.getObjectByName('west-entrance-nine-scalloped-arches')!;
  for(const x of [-29.6,-28.3,-26.6]){
    const ray=new THREE.Raycaster(new THREE.Vector3(x,8,.3),new THREE.Vector3(0,-1,0));
    assert.ok(ray.intersectObject(vaults).some(hit=>hit.point.y>5.5),'entrance has exposed ribs without a roof shell');
  }
  const glazing=model.getObjectByName('west-entrance-recessed-glazing')!;
  const glassRay=new THREE.Raycaster(new THREE.Vector3(-35,5.1,.1),new THREE.Vector3(1,0,0));
  assert.ok(glassRay.intersectObject(glazing).length,'recessed glazing fails to fill the arched head');
  assert.ok(bounds(glazing).max.x<bounds(model.getObjectByName('low-connecting-lobby')!).min.x,'lobby wall hides the glazing');
});

test('triangular plinth faces outward and its visible frames are included in the final mesh', () => {
  const model=buildDomes(); model.updateMatrixWorld(true);
  const center=DOMES_CENTERS[0], angle=Math.PI/48;
  const direction=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle));
  const origin=new THREE.Vector3(center.x,1,center.z).addScaledVector(direction,24);
  const ray=new THREE.Raycaster(origin,direction.negate());
  assert.ok(ray.intersectObject(model.getObjectByName('domes-triangular-ventilated-plinth')!).length,'plinth faces inward or is missing');
  const frames=model.getObjectByName('domes-primary-structural-ribs') as THREE.Mesh;
  assert.ok(frames.geometry.getAttribute('position').count>3*12*20*36,'base frame geometry was added after the mesh was built');
});
