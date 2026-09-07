import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  AMFAM_LOCAL_BOUNDS,
  BASE_PATH_M,
  buildAmFam,
  CENTER_FIELD_M,
  ROOF_PEAK_M,
  ROOF_SPAN_M,
} from '../src/amfam.ts';

function bounds(object:THREE.Object3D) {
  object.updateMatrixWorld(true); return new THREE.Box3().setFromObject(object);
}

test('model uses the measured local frame and official baseball dimensions',()=>{
  const model=buildAmFam();
  assert.equal(model.name,'american-family-field');
  assert.deepEqual(model.userData.homePlate,[0,0,0]);
  assert.deepEqual(model.userData.centerField,[0,0,-CENTER_FIELD_M]);
  assert.equal(model.userData.roofSpan,ROOF_SPAN_M);
  assert.equal(model.userData.roofPeak,ROOF_PEAK_M);
  assert.equal(model.userData.basePathM,BASE_PATH_M);
  const bases=Object.values(model.userData.bases) as number[][];
  assert.equal(bases.length,4);
  for(const [a,b] of [[bases[0],bases[1]],[bases[1],bases[2]],[bases[2],bases[3]],[bases[3],bases[0]]] as const)
    assert.ok(Math.abs(new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b))-BASE_PATH_M)<1e-9);
  const footprint=bounds(model.getObjectByName('approximate-stadium-foundation')!);
  assert.ok(Math.abs(footprint.min.x-AMFAM_LOCAL_BOUNDS.min[0])<.002);
  assert.ok(Math.abs(footprint.max.x-AMFAM_LOCAL_BOUNDS.max[0])<.002);
  assert.ok(Math.abs(footprint.min.z-AMFAM_LOCAL_BOUNDS.min[2])<.002);
  assert.ok(Math.abs(footprint.max.z-AMFAM_LOCAL_BOUNDS.max[2])<.002);
});

test('open fan roof has seven panels with five visibly stacked movable panels',()=>{
  const model=buildAmFam();
  const panels=model.children.filter(child=>child.userData.roofPanel) as THREE.Mesh[];
  assert.equal(panels.length,7);
  const info=panels.map(panel=>panel.userData.roofPanel);
  assert.equal(info.filter(panel=>panel.kind==='fixed').length,2);
  assert.equal(info.filter(panel=>panel.moved).length,5);
  assert.equal(info.filter(panel=>panel.stackSide==='left').length,3);
  assert.equal(info.filter(panel=>panel.stackSide==='right').length,2);
  assert.equal(new Set(info.filter(panel=>panel.stackSide==='left').map(panel=>panel.stackOffsetM)).size,3);
  assert.equal(new Set(info.filter(panel=>panel.stackSide==='right').map(panel=>panel.stackOffsetM)).size,2);
  assert.ok(Math.max(...panels.map(panel=>bounds(panel).max.y))>64);
  assert.ok(Math.max(...panels.map(panel=>bounds(panel).max.y))<67);
  const fixed=info.filter(panel=>panel.kind==='fixed');
  assert.deepEqual(fixed.map(panel=>[panel.angleStartDeg,panel.angleEndDeg]),[[-55,-31],[31,55]]);
  // A vertical sightline above the central field must stay open to the sky.
  const ray=new THREE.Raycaster(new THREE.Vector3(0,.3,-60),new THREE.Vector3(0,1,0),0,150);
  assert.equal(ray.intersectObjects(panels,false).length,0,'central roof wedge is occluded');
});

test('broad fixed wings terminate in tall curved glazed clerestories',()=>{
  const model=buildAmFam();
  const glass=model.getObjectByName('curved-outer-roof-clerestory-glazing') as THREE.Mesh;
  const glazingBounds=bounds(glass);
  assert.ok(glazingBounds.max.x>148 && glazingBounds.min.x<-148,'clerestories do not reach broad outer wings');
  assert.ok(Math.abs(glazingBounds.min.y-32)<.01,'clerestory does not meet the facade cornice');
  assert.ok(glazingBounds.max.y>59,'clerestory does not follow the curved roof crown');
  assert.equal(glass.geometry.getAttribute('position').count/3,64,'expected two sixteen-bay glazed walls');
  const track=bounds(model.getObjectByName('semicircular-outfield-retractable-roof-track')!);
  assert.ok(track.max.x>150 && track.min.x<-150,'roof track was not widened with the fixed panels');
});

test('roof closes the field with five angular panels while fixed wings stay put',()=>{
  const model=buildAmFam();
  const panels=model.children.filter(child=>child.userData.roofPanel) as THREE.Mesh[];
  const fixed=panels.filter(p=>p.userData.roofPanel.kind==='fixed');
  const original=fixed.map(p=>Array.from(p.geometry.getAttribute('position').array));
  model.userData.setRoofOpenness(0);model.updateMatrixWorld(true);
  assert.equal(model.userData.roofState,'closed');
  for(const [x,z] of [[0,-60],[-35,-55],[35,-55],[0,-100]] as const) {
    const ray=new THREE.Raycaster(new THREE.Vector3(x,130,z),new THREE.Vector3(0,-1,0));
    assert.ok(ray.intersectObjects(panels).length,`closed roof leaves an opening at ${x},${z}`);
  }
  fixed.forEach((p,i)=>assert.deepEqual(Array.from(p.geometry.getAttribute('position').array),original[i]));
  const moving=model.userData.roofPanels.filter((p:{kind:string})=>p.kind==='movable');
  for(let i=1;i<moving.length;i++)assert.ok(Math.abs(moving[i].angleStartDeg-moving[i-1].angleEndDeg)<1e-8);
  model.userData.setRoofOpenness(1);model.updateMatrixWorld(true);
  assert.equal(model.userData.roofState,'open');
  const ray=new THREE.Raycaster(new THREE.Vector3(0,130,-60),new THREE.Vector3(0,-1,0));
  assert.equal(ray.intersectObjects(panels).length,0);
});

test('backstop seating completes the bowl behind home plate without blocking the diamond',()=>{
  const model=buildAmFam();model.updateMatrixWorld(true);
  const stands=model.children.filter(o=>o.name.startsWith('terraced-dark-green-bowl-tier-'));
  const back=new THREE.Raycaster(new THREE.Vector3(0,80,35),new THREE.Vector3(0,-1,0));
  assert.ok(back.intersectObjects(stands).length,'no seats behind home plate');
  const diamond=new THREE.Raycaster(new THREE.Vector3(0,80,-20),new THREE.Vector3(0,-1,0));
  assert.equal(diamond.intersectObjects(stands).length,0);
});

test('the three-tier bowl remains entirely outside playable fair territory',()=>{
  const model=buildAmFam();
  const grass=model.getObjectByName('baseball-turf-lf344-rf345-cf400') as THREE.Mesh;
  const stands=model.children.filter(child=>child.name.startsWith('terraced-dark-green-bowl-tier-')||child.name==='outfield-corner-bleachers') as THREE.Mesh[];
  for(const [x,z] of [[0,-75],[-30,-60],[30,-60],[0,-110]] as const){
    const ray=new THREE.Raycaster(new THREE.Vector3(x,80,z),new THREE.Vector3(0,-1,0),0,100);
    assert.ok(ray.intersectObject(grass,false).length,`grass missing at ${x},${z}`);
    assert.equal(ray.intersectObjects(stands,false).length,0,`stands intrude on fair territory at ${x},${z}`);
  }
});

test('radial roof structure uses deep curved chords and triangulated webs',()=>{
  const model=buildAmFam();
  const truss=model.getObjectByName('radial-curved-steel-trusses-with-triangulated-webs') as THREE.Mesh;
  const p=truss.geometry.getAttribute('position');
  assert.ok(p.count>10_000,'truss web is too sparse to read structurally');
  truss.geometry.computeBoundingBox();
  assert.ok(truss.geometry.boundingBox!.max.y>=ROOF_PEAK_M-.5);
  assert.ok(truss.geometry.boundingBox!.max.y<=ROOF_PEAK_M+.6);
  assert.ok(Array.from({length:p.count},(_,i)=>Math.hypot(p.getX(i),p.getZ(i)-55)).some(r=>Math.abs(r-ROOF_SPAN_M)<.1),'open trusses must reach their angular stations on the outfield track');
  assert.ok(model.getObjectByName('semicircular-outfield-retractable-roof-track'));
});

test('brick arcade faces outward and includes repeated arch glazing and cream piers',()=>{
  const model=buildAmFam();
  const facade=model.getObjectByName('warm-brick-exterior-arcade') as THREE.Mesh;
  const p=facade.geometry.getAttribute('position');
  // First 36 quads are the curved public facade; sample one triangle per segment.
  for(let segment=0;segment<36;segment+=5){
    const i=segment*6;
    const a=new THREE.Vector3().fromBufferAttribute(p,i);
    const b=new THREE.Vector3().fromBufferAttribute(p,i+1);
    const c=new THREE.Vector3().fromBufferAttribute(p,i+2);
    const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const radial=a.clone().add(b).add(c).multiplyScalar(1/3).sub(new THREE.Vector3(4.685,0,-16.73)); radial.y=0;
    // The mapped perimeter contains angled entry recesses, unlike the former
    // ellipse. Outwardness is a positive dot product, not a 60-degree limit.
    assert.ok(normal.dot(radial.normalize())>0,`facade segment ${segment} faces inward`);
  }
  const windows=model.getObjectByName('eleven-large-arched-glazed-bays') as THREE.Mesh;
  assert.equal(windows.geometry.getAttribute('position').count/3,11*11);
  assert.ok(model.getObjectByName('cream-cornices-and-buttress-piers'));
  assert.deepEqual(model.userData.entranceSign,{position:[4.685,38,94],widthM:34,facing:'+Z'});
});

test('stadium geometry is finite and economical',()=>{
  const model=buildAmFam(); let meshes=0,triangles=0;
  model.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    meshes++;
    const p=object.geometry.getAttribute('position');
    assert.ok(p&&Array.from(p.array).every(Number.isFinite),`${object.name} contains invalid coordinates`);
    triangles+=object.geometry.index?object.geometry.index.count/3:p.count/3;
  });
  assert.ok(meshes<=44,`drawables ${meshes}`);
  assert.ok(triangles<100_000,`triangles ${triangles}`);
});

test('lighting modes reversibly illuminate glazing, scoreboard, and flood meshes',()=>{
  const model=buildAmFam();
  const glass=(model.getObjectByName('eleven-large-arched-glazed-bays') as THREE.Mesh).material as THREE.MeshPhongMaterial;
  const floods=(model.getObjectByName('stadium-floodlight-arrays') as THREE.Mesh).material as THREE.MeshPhongMaterial;
  const turf=(model.getObjectByName('baseball-turf-lf344-rf345-cf400') as THREE.Mesh).material as THREE.MeshLambertMaterial;
  model.userData.setLightingMode('night');
  assert.ok(glass.emissive.getHex()>0 && floods.emissiveIntensity>3);
  assert.ok(turf.emissiveIntensity > .5, 'field remains legible under stadium floodlights');
  model.userData.setLightingMode('sunset');
  assert.ok(glass.emissive.getHex()>0 && floods.emissiveIntensity>0 && floods.emissiveIntensity<1);
  model.userData.setLightingMode('day');
  assert.equal(glass.emissive.getHex(),0); assert.equal(floods.emissiveIntensity,0);
  assert.equal(turf.emissiveIntensity,0);
});


test('outfield roof bearings reach grade and scoreboard stays behind center field',()=>{
  const model=buildAmFam();
  const track=bounds(model.getObjectByName('semicircular-outfield-retractable-roof-track')!);
  assert.ok(track.min.y<.01,'roof track supports float above grade');
  const screen=bounds(model.getObjectByName('large-black-center-field-scoreboard')!);
  assert.ok(screen.max.z < -CENTER_FIELD_M,'scoreboard intrudes into the field');
  const legs=bounds(model.getObjectByName('scoreboard-steel-supports')!);
  assert.ok(legs.min.y<.01 && legs.max.z < -CENTER_FIELD_M);
});
