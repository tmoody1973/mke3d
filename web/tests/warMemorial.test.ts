import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { buildWarMemorial, WAR_MEMORIAL_SITE } from '../src/warMemorial.ts';

const terrain=(x:number,z:number)=>3.05+(x-627)*.006+(z+608)*.004;
const model=buildWarMemorial(terrain);
model.updateMatrixWorld(true);

function bounds(object:THREE.Object3D){object.updateMatrixWorld(true);return new THREE.Box3().setFromObject(object);}

test('unequal cruciform preserves the measured extent and open outer corners',()=>{
  const upper=model.getObjectByName('war-memorial-unequal-cruciform-upper') as THREE.Mesh;
  const local=upper.geometry.boundingBox??(upper.geometry.computeBoundingBox(),upper.geometry.boundingBox!);
  assert.ok(Math.abs((local.max.x-local.min.x)-63)<.001);
  assert.ok(Math.abs((local.max.z-local.min.z)-64)<.001);
  for(const [x,z] of [[-29,-29],[29,-29],[-29,29],[29,29]] as [number,number][]) {
    const origin=new THREE.Vector3(x,40,z).applyMatrix4(model.matrixWorld);
    const hits=new THREE.Raycaster(origin,new THREE.Vector3(0,-1,0),0,30).intersectObject(upper);
    assert.equal(hits.length,0,`old perimeter-ring corner remains filled at ${x},${z}`);
  }
});

test('raised Court of Honor and pool remain open to the sky',()=>{
  const metadata=model.userData.openCourt;
  const center=new THREE.Vector3(...metadata.center);
  const up=new THREE.Raycaster(center,new THREE.Vector3(0,1,0),0,100).intersectObject(model,true);
  assert.equal(up.length,0,'pool center is covered');
  const down=new THREE.Raycaster(center,new THREE.Vector3(0,-1,0),0,2).intersectObject(model,true);
  assert.equal(down[0]?.object.name,'court-of-honor-pool');
  assert.ok(Math.abs(center.y-WAR_MEMORIAL_SITE.courtY)<.1);
  const pool=model.getObjectByName('court-of-honor-pool') as THREE.Mesh;
  pool.geometry.computeBoundingBox(); const poolBounds=pool.geometry.boundingBox!;
  assert.ok(Math.abs((poolBounds.max.x-poolBounds.min.x)-7)<.02);
  assert.ok(Math.abs((poolBounds.max.z-poolBounds.min.z)-7)<.02);
  const flame=model.getObjectByName('war-memorial-eternal-flame-brazier')!;
  const flameWorld=new THREE.Vector3();flame.getWorldPosition(flameWorld);
  const poolCenter=new THREE.Vector3(...metadata.poolCenter);
  assert.ok(Math.hypot(flameWorld.x-poolCenter.x,flameWorld.z-poolCenter.z)<.001,'brazier is not centered in pool');
  assert.ok(center.distanceTo(poolCenter)>2,'clear-sky sample should be off-center from flame');
});

test('splayed polygon piers have finite outward faces and contact podium and upper work',()=>{
  const piers=model.getObjectByName('war-memorial-splayed-piers') as THREE.Mesh;
  const positions=piers.geometry.getAttribute('position');
  const normals=piers.geometry.getAttribute('normal');
  assert.ok(Array.from(positions.array).every(Number.isFinite));
  assert.ok(Array.from(normals.array).every(Number.isFinite));
  let outwardFaces=0;
  for(let i=0;i<positions.count;i+=3){
    const a=new THREE.Vector3().fromBufferAttribute(positions,i);
    const n=new THREE.Vector3().fromBufferAttribute(normals,i);
    if(Math.abs(n.y)<.75&&new THREE.Vector2(a.x,a.z).dot(new THREE.Vector2(n.x,n.z))>0)outwardFaces++;
  }
  assert.ok(outwardFaces>40,`${outwardFaces} outward pier faces`);
  const bb=bounds(piers);
  assert.ok(Math.abs(bb.min.y-WAR_MEMORIAL_SITE.courtY)<.001,'supports float above podium');
  assert.ok(Math.abs(bb.max.y-WAR_MEMORIAL_SITE.upperBottomY)<.001,'supports miss upper work');
  assert.equal(piers.geometry.getAttribute('position').count/(16*3),38,'piers are not batched eight-sided splayed forms');
  const base=model.getObjectByName('war-memorial-rubble-stone-pedestal') as THREE.Mesh;
  for(const [x,z] of [[-5,-22.85],[16,22.85],[22.35,-15],[-22.35,15]] as [number,number][]){
    const origin=new THREE.Vector3(x,WAR_MEMORIAL_SITE.courtY+.01,z).applyMatrix4(model.matrixWorld);
    const hit=new THREE.Raycaster(origin,new THREE.Vector3(0,-1,0),0,.1).intersectObject(base)[0];
    assert.ok(hit&&hit.distance<.02,`support cap missing at ${x},${z}`);
  }
});

test('terrain-following stone pedestal is grounded at independently sampled corners',()=>{
  const base=model.getObjectByName('war-memorial-rubble-stone-pedestal') as THREE.Mesh;
  const p=base.geometry.getAttribute('position');
  let grounded=0;
  for(let i=0;i<p.count;i++){
    const local=new THREE.Vector3().fromBufferAttribute(p,i);
    if(local.y>=WAR_MEMORIAL_SITE.courtY-.23)continue;
    const world=local.clone().applyMatrix4(model.matrixWorld);
    if(Math.abs(world.y-terrain(world.x,world.z))<1e-4)grounded++;
  }
  assert.ok(grounded>=20,`${grounded} grounded base vertices`);
});

test('facades are restrained, identifiable, and lighting is reversible',()=>{
  const mural=model.getObjectByName('war-memorial-west-five-panel-mural') as THREE.Mesh;
  assert.ok(mural.geometry.getAttribute('position').count/3>=160,'mural lacks tessera-scale geometric fields');
  assert.ok(model.getObjectByName('war-memorial-mural-vertical-window-strips'));
  assert.ok(model.getObjectByName('war-memorial-mural-date-strokes'));
  assert.ok(model.userData.courtStairs.openFlights);
  const stair=bounds(model.getObjectByName('court-stair-pavilion-glazing')!);
  assert.ok(Math.abs(stair.min.y-WAR_MEMORIAL_SITE.upperBottomY)<.001);
  assert.ok(Math.abs(stair.max.y-WAR_MEMORIAL_SITE.upperTopY)<.001,'glazed projection must span both upper floors');
  const glazing=model.getObjectByName('war-memorial-end-glazing') as THREE.Mesh;
  const material=glazing.material as THREE.MeshPhongMaterial;
  assert.ok(material.transparent&&material.opacity<.85);
  const p=glazing.geometry.getAttribute('position');
  const directions=[
    {triangle:0,expected:new THREE.Vector3(0,0,-1)},
    {triangle:24,expected:new THREE.Vector3(0,0,1)},
    {triangle:48,expected:new THREE.Vector3(1,0,0)},
  ];
  for(const {triangle,expected} of directions){
    const i=triangle*3,a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);
    const normal=b.sub(a).cross(c.sub(a)).normalize();
    assert.ok(normal.dot(expected)>.99,`end glazing triangle ${triangle} faces inward`);
  }
  model.userData.setLightingMode('night'); const night=material.emissive.getHex(); assert.ok(night>0);
  model.userData.setLightingMode('sunset'); const sunset=material.emissive.getHex(); assert.ok(sunset>0&&sunset!==night);
  model.userData.setLightingMode('day'); assert.equal(material.emissive.getHex(),0);
});

test('reference facade has physical recess depth and court-facing window normals',()=>{
  const frame=model.getObjectByName('war-memorial-west-recess-frame') as THREE.Mesh;
  const mural=model.getObjectByName('war-memorial-west-five-panel-mural') as THREE.Mesh;
  frame.geometry.computeBoundingBox();mural.geometry.computeBoundingBox();
  assert.ok(mural.geometry.boundingBox!.min.x-frame.geometry.boundingBox!.min.x>1.4,'mural hood has no physical depth');
  const slots=model.getObjectByName('war-memorial-court-slot-windows') as THREE.Mesh;
  const p=slots.geometry.getAttribute('position'),n=slots.geometry.getAttribute('normal');
  for(let i=0;i<p.count;i+=3){
    const x=p.getX(i),z=p.getZ(i),nx=n.getX(i),nz=n.getZ(i);
    if(Math.abs(x+4.77)<.001)assert.ok(nx>.99);
    else if(Math.abs(x-16.97)<.001)assert.ok(nx<-.99);
    else if(Math.abs(z+18.47)<.001)assert.ok(nz>.99);
    else if(Math.abs(z-18.47)<.001)assert.ok(nz<-.99);
  }
});

test('model stays finite and below the standalone draw and triangle budgets',()=>{
  let meshes=0,triangles=0;
  model.traverse(object=>{if(!(object instanceof THREE.Mesh))return;meshes++;
    const p=object.geometry.getAttribute('position');
    assert.ok(p&&Array.from(p.array).every(Number.isFinite),`${object.name} has invalid vertices`);
    triangles+=(object.geometry.index?.count??p.count)/3;
  });
  assert.ok(meshes<60,`${meshes} meshes`);
  assert.ok(triangles<12_000,`${triangles} triangles`);
});
