import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildPabstTheater } from '../src/pabstTheater.ts';
import { PABST_SITE as site } from '../src/theaterSites.ts';

test('Pabst exterior merges every material including mixed custom roof geometry', () => {
 const errors:unknown[]=[];const old=console.error;console.error=(...args)=>errors.push(args);
 let model:THREE.Group;try {model=buildPabstTheater(()=>4.21);}finally {console.error=old;}
 assert.deepEqual(errors,[]);assert.equal(model!.name,'pabst-theater');assert.equal(model!.children.length,9);
 let triangles=0;
 for(const child of model!.children as THREE.Mesh[]){
  const position=child.geometry.getAttribute('position');const normal=child.geometry.getAttribute('normal');
  assert.ok(position.count>0);assert.equal(normal.count,position.count);
  for(const value of position.array)assert.ok(Number.isFinite(value));
  for(const value of normal.array)assert.ok(Number.isFinite(value));
  triangles+=position.count/3;
 }
 assert.ok(triangles<110000,`Exterior triangle budget exceeded: ${triangles}`);
 assert.ok(model!.children.filter(child=>child.name==='BLDG').length>=2);
 const roof=model!.getObjectByName('pabst-roof') as THREE.Mesh;
 assert.ok(roof);assert.equal((roof.material as THREE.MeshStandardMaterial).side,THREE.FrontSide);
 roof.geometry.computeBoundingBox();assert.ok(roof.geometry.boundingBox!.max.y>22.5);
});

test('sloping slate roofs have upward normals, not inverted or hidden undersides',()=>{
 const roof=buildPabstTheater(()=>0).getObjectByName('pabst-roof') as THREE.Mesh;
 const position=roof.geometry.getAttribute('position'),normal=roof.geometry.getAttribute('normal');let slopedVertices=0;
 for(let i=0;i<position.count;i++){
  const ny=normal.getY(i);
  // Box roofs have horizontal tops/bottoms and vertical sides; custom sloped faces do not.
  if(Math.abs(ny)>.01&&Math.abs(ny)<.99){assert.ok(ny>0,`Inverted slate face at vertex ${i}`);slopedVertices++;}
 }
 assert.ok(slopedVertices>=96);
});

test('Pabst keeps historic body dimensions, terrain contact and Wells-facing placement',()=>{
 const elevation=4.7,model=buildPabstTheater(()=>elevation);model.updateMatrixWorld(true);
 assert.ok(Math.abs(model.scale.x*37-45.11)<.001);assert.ok(Math.abs(model.scale.z*30-24.38)<.001);
 assert.ok(Math.abs(model.rotation.y-site.bearing)<.0001);
 const bounds=new THREE.Box3().setFromObject(model);assert.ok(bounds.min.y<elevation);assert.ok(bounds.max.y>elevation+27);
 const front=new THREE.Vector3(0,0,15).applyMatrix4(model.matrixWorld);
 assert.ok(front.z>site.z+8);assert.equal(model.userData.facade,'south');
 assert.ok(Math.abs(model.position.x-site.x)<4);assert.ok(Math.abs(model.position.z-site.z)<4);
});

test('Pabst night lighting resets on windows and cabinet letters',()=>{
 const model=buildPabstTheater(()=>0);
 const glass=(model.getObjectByName('pabst-glass') as THREE.Mesh).material as THREE.MeshStandardMaterial;
 const letters=(model.getObjectByName('pabst-light') as THREE.Mesh).material as THREE.MeshStandardMaterial;
 model.userData.setLightingMode('night');assert.ok(glass.emissiveIntensity>.4);assert.ok(letters.emissiveIntensity>2);
 model.userData.setLightingMode('sunset');assert.ok(glass.emissiveIntensity>0&&glass.emissiveIntensity<.2);
 model.userData.setLightingMode('day');assert.equal(glass.emissiveIntensity,0);assert.equal(letters.emissiveIntensity,0);
});

test('both outward cabinet faces render the P stem at screen left, with its bowl on the right',()=>{
 const model=buildPabstTheater(()=>0),light=model.getObjectByName('pabst-light') as THREE.Mesh;
 const position=light.geometry.getAttribute('position');
 const faces=model.userData.signFaces as {side:number;center:number[];letters:{char:string;firstVertex:number;vertexCount:number;baseY:number;height:number}[]}[];
 assert.equal(faces.length,4);
 for(const face of faces){
  assert.equal(face.letters.map(letter=>letter.char).join(''),'PABST');
  const p=face.letters[0],camera=new THREE.PerspectiveCamera();
  const target=new THREE.Vector3(face.center[0],p.baseY+p.height/2,face.center[2]);
  camera.position.copy(target).add(new THREE.Vector3(face.side*4,0,0));camera.lookAt(target);camera.updateMatrixWorld(true);
  const bottomX:number[]=[],topX:number[]=[];
  for(let i=p.firstVertex;i<p.firstVertex+p.vertexCount;i++){
   const vertex=new THREE.Vector3().fromBufferAttribute(position,i),screen=vertex.clone().applyMatrix4(camera.matrixWorldInverse);
   if(vertex.y<p.baseY+p.height*.3)bottomX.push(screen.x);
   if(vertex.y>p.baseY+p.height*.55)topX.push(screen.x);
  }
  assert.ok(bottomX.length>0&&topX.length>0);
  assert.ok(Math.max(...bottomX)<0,'P lower stem must be on the viewer’s left');
  assert.ok(Math.max(...topX)>.22,'P bowl must extend to the viewer’s right');
  assert.ok(Math.max(...topX)-Math.max(...bottomX)>.45,'P bowl must not mirror into the left stem');
 }
});

test('blade cabinets have stepped shoulders and rounded caps instead of rectangular boards',()=>{
 const model=buildPabstTheater(()=>0);model.position.set(0,0,0);model.rotation.set(0,0,0);model.scale.set(1,1,1);model.updateMatrixWorld(true);
 const gold=model.getObjectByName('pabst-gold') as THREE.Mesh;
 for(const x of [-12.4,18.68])for(const side of [-1,1]){
  const occupied=(y:number,z:number)=>new THREE.Raycaster(new THREE.Vector3(x+side*2,y,z),new THREE.Vector3(-side,0,0)).intersectObject(gold).some(hit=>Math.abs(hit.point.x-x)<.18);
  assert.ok(occupied(16.80,16.28+.78),'stepped shoulder projects past the stem');
  assert.ok(!occupied(14.3,16.28+.78),'middle cabinet is narrower than shoulder');
  assert.ok(occupied(17.90,16.28),'rounded crest reaches above shoulder');
  assert.ok(!occupied(17.90,16.28+.40),'top corners recede along the round crest');
  assert.ok(occupied(10.70,16.28),'lower rounded medallion remains present');
  assert.ok(!occupied(10.70,16.28+.40),'bottom corners recede along the round medallion');
 }
});
