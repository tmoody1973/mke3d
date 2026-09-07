import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { buildSaintKate } from '../src/saintKate.ts';
import { SAINT_KATE_SITE as site, removeSaintKatePlaceholder } from '../src/saintKateSite.ts';
import { bilinearTerrainHeight } from '../src/localTerrain.ts';
import { createWalkingWorld } from '../src/walkingWorld.ts';

test('hotel exterior merges mapped mass, arches and neon into finite bounded geometry',()=>{
 const errors:unknown[]=[];const old=console.error;console.error=(...args)=>errors.push(args);let root:THREE.Group;
 try{root=buildSaintKate(()=>0);}finally{console.error=old;}
 assert.deepEqual(errors,[]);assert.equal(root!.name,'saint-kate');assert.equal(root!.children.filter(child=>child instanceof THREE.Mesh).length,15);
 let triangles=0;
 for(const mesh of root!.children.filter(child=>child instanceof THREE.Mesh) as THREE.Mesh[]){const p=mesh.geometry.getAttribute('position'),n=mesh.geometry.getAttribute('normal');assert.equal(p.count,n.count);for(const v of p.array)assert.ok(Number.isFinite(v));for(const v of n.array)assert.ok(Number.isFinite(v));triangles+=p.count/3;}
 assert.ok(triangles<90000);assert.equal(root!.children.filter(child=>child.name==='BLDG').length,2);
 root!.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(root!);assert.ok(bounds.max.y-root!.position.y>36);assert.ok(bounds.max.y-root!.position.y<38);
 assert.equal(root!.rotation.y,site.bearing);assert.ok(Math.abs(root!.position.x-site.x)<.001);
 assert.equal(root!.userData.entrance.facade,'north');
});

test('night lighting preserves a majority of dark rooms, readable neon and a warm recessed entry',()=>{
 const root=buildSaintKate(()=>0),get=(key:string)=>(root.children.find(child=>child.userData.part===key) as THREE.Mesh).material as THREE.MeshStandardMaterial;
 assert.ok(root.userData.roomWindows.dark>root.userData.roomWindows.lit*2);
 root.userData.setLightingMode('night');assert.ok(get('litGlass').emissiveIntensity>.4);assert.ok(get('glass').emissiveIntensity<.03);assert.ok(get('neon').emissiveIntensity>2);assert.ok(get('wood').emissiveIntensity>.2);assert.ok(get('entryGlass').opacity<.5);
 root.userData.setLightingMode('sunset');assert.ok(get('neon').emissiveIntensity>1&&get('neon').emissiveIntensity<2);
 root.userData.setLightingMode('day');for(const key of ['litGlass','glass','warm','wood','entryGlass'])assert.equal(get(key).emissiveIntensity,0);
});

test('mapped north canopy stays open and every door leaf is visible ahead of structural solids',()=>{
 const root=buildSaintKate(()=>0);root.updateMatrixWorld(true);const solids=root.children.filter(child=>child.name==='BLDG');
 for(const x of root.userData.entrance.leafCenters){
  const eye=new THREE.Vector3(x,1.55,-27.5).applyMatrix4(root.matrixWorld),direction=new THREE.Vector3(0,0,1).applyQuaternion(root.quaternion);
  const ray=new THREE.Raycaster(eye,direction),hits=ray.intersectObject(root,true);
  assert.equal(hits[0]?.object.userData.part,'entryGlass',`Door x=${x} must show glass first`);
  const nearest=ray.intersectObjects(solids,false)[0];assert.ok(nearest);assert.ok(nearest.distance>hits[0].distance+2,'Solid lobby wall must be recessed behind the glass');
 }
});

test('neon north name and both outward corner names face their observers with consistent lettering axes',()=>{
 const root=buildSaintKate(()=>0),neon=root.getObjectByName('saint-kate-neon') as THREE.Mesh,p=neon.geometry.getAttribute('position');
 const faces=root.userData.signFaces as {name:string;normal:number[];firstVertex:number;vertexCount:number;readingDirection:number[]}[];
 assert.equal(faces.length,3);
 for(const face of faces){
  const range=new THREE.Box3();for(let i=face.firstVertex;i<face.firstVertex+face.vertexCount;i++)range.expandByPoint(new THREE.Vector3().fromBufferAttribute(p,i));
  const center=range.getCenter(new THREE.Vector3()),camera=new THREE.PerspectiveCamera();camera.position.copy(center).addScaledVector(new THREE.Vector3(...face.normal),30);camera.lookAt(center);camera.updateMatrixWorld(true);
  const first=new THREE.Vector3().fromBufferAttribute(p,face.firstVertex).applyMatrix4(camera.matrixWorldInverse),last=new THREE.Vector3().fromBufferAttribute(p,face.firstVertex+face.vertexCount-1).applyMatrix4(camera.matrixWorldInverse);
  if(face.name==='north-entrance'){assert.ok(first.x<last.x-15,'North name advances left-to-right from outside');assert.ok(range.getSize(new THREE.Vector3()).x>18);}
  else{assert.ok(first.y>last.y+15,'Corner name advances from top to bottom');assert.ok(range.getSize(new THREE.Vector3()).y>17);}
 }
});

function cachedScene(){
 const read=(path:string)=>{const b=readFileSync(new URL(path,import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
 const tb=read('../public/data/terrain.bin'),v=new DataView(tb),nx=v.getUint32(4,true),ny=v.getUint32(8,true);
 const terrain={nx,ny,x0:v.getFloat32(12,true),y0:v.getFloat32(16,true),step:v.getFloat32(20,true),heights:new Float32Array(tb.slice(24,24+nx*ny*4)),colors:new Uint8Array(tb.slice(24+nx*ny*4))};
 const tileBuffer=read('../public/data/tiles/t_-1_0.bin'),tv=new DataView(tileBuffer),tile=new THREE.Group();let offset=12;
 for(let section=0;section<tv.getUint32(8,true);section++){
  const name=String.fromCharCode(...new Uint8Array(tileBuffer,offset,4)).trim(),count=tv.getUint32(offset+4,true);offset+=8;const origin=[0,4,8].map(k=>tv.getFloat32(offset+k,true)),scale=tv.getFloat32(offset+12,true);offset+=16;
  const positions=new Float32Array(count*3);for(let i=0;i<count*3;i++)positions[i]=tv.getInt16(offset+i*2,true)*scale+origin[i%3];offset=Math.ceil((offset+count*6)/4)*4;offset=Math.ceil((offset+count*3)/4)*4;
  if(['ROAD','BLDG'].includes(name)){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.name=name;tile.add(mesh);}
 }
 assert.ok(removeSaintKatePlaceholder(tile,{i:-1,j:0})>0);
 const ground=(x:number,z:number)=>bilinearTerrainHeight(terrain,x,z),root=buildSaintKate(ground),tiles=new THREE.Group(),environment=new THREE.Group();tiles.add(tile);environment.add(tiles,root);
 const geometry=new THREE.PlaneGeometry(110,110,55,55);geometry.rotateX(-Math.PI/2);geometry.translate(-478,0,-777);const p=geometry.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,ground(p.getX(i),p.getZ(i)));
 const groundMesh=new THREE.Mesh(geometry);groundMesh.name='TERRAIN';environment.add(groundMesh);environment.updateMatrixWorld(true);return{root,tiles,environment};
}

test('actual Kilbourn road datum reaches every recessed entrance door through the open porte-cochere',()=>{
 const {root,tiles,environment}=cachedScene(),world=createWalkingWorld(tiles,environment),point=(x:number,z:number)=>new THREE.Vector3(x,0,z).applyMatrix4(root.matrixWorld);
 assert.ok(root.position.y>4.45&&root.position.y<4.65);assert.ok(root.userData.entrance.calibration>.4);
 const roads:THREE.Mesh[]=[];tiles.traverse(child=>{if(child instanceof THREE.Mesh&&child.name==='ROAD')roads.push(child);});
 const actualRoad=new THREE.Raycaster(new THREE.Vector3(-480,20,-783),new THREE.Vector3(0,-1,0)).intersectObjects(roads)[0];assert.ok(actualRoad);assert.ok(Math.abs(actualRoad.point.y-root.position.y)<.14);
 const origin=point(.22,-36),spawn=world.findSpawn(origin.x,origin.z);assert.ok(spawn);assert.ok(Math.hypot(spawn.x-origin.x,spawn.z-origin.z)<.05);
 for(const x of root.userData.entrance.leafCenters){
  const outside=point(x,-34),along=world.resolve(spawn,{x:outside.x,y:spawn.y,z:outside.z});assert.equal(along.blocked,false);
  const end=point(x,-21.02),result=world.resolve(along,{x:end.x,y:root.position.y,z:end.z});
  assert.equal(result.blocked,false,JSON.stringify({x,along,end:end.toArray(),result}));assert.ok(Math.hypot(result.x-end.x,result.z-end.z)<.025);assert.ok(Math.abs(result.y-root.position.y)<.04);
 }
});

test('all curved corner guest and crown windows sit outside the actual mapped wall',()=>{
 const root=buildSaintKate(()=>0);root.updateMatrixWorld(true);
 for(const c of root.userData.cornerWindowStations as {x:number;z:number;angle:number}[]){
  const normal=new THREE.Vector3(Math.sin(c.angle),0,Math.cos(c.angle)),right=new THREE.Vector3(Math.cos(c.angle),0,-Math.sin(c.angle));
  for(const y of [9.8,13.05,16.30,19.55,22.8,26.05,29.30,33.0,34.15]){
   const position=new THREE.Vector3(c.x,y,c.z).addScaledVector(right,.46).addScaledVector(normal,3).applyMatrix4(root.matrixWorld);
   const ray=new THREE.Raycaster(position,normal.clone().negate().applyQuaternion(root.quaternion),0,6),hits=ray.intersectObject(root,true);
   assert.ok(['glass','litGlass'].includes(hits[0]?.object.userData.part),`Curved bay at ${JSON.stringify(c)}, y=${y} must expose glass, got ${hits[0]?.object.userData.part}`);
  }
 }
});

test('neon bright core remains visible through its outer glow and three bounded lights illuminate the portico',()=>{
 const root=buildSaintKate(()=>0),back=(root.getObjectByName('saint-kate-neonBack') as THREE.Mesh).material as THREE.MeshStandardMaterial;
 assert.equal(back.transparent,true);assert.equal(back.depthWrite,false);assert.ok(back.opacity<.4);assert.equal(back.blending,THREE.AdditiveBlending);
 const lights:THREE.PointLight[]=[];root.traverse(child=>{if(child instanceof THREE.PointLight)lights.push(child);});assert.equal(lights.length,3);
 for(const light of lights){assert.equal(light.intensity,0);assert.equal(light.visible,false);assert.equal(light.castShadow,false);assert.ok(light.distance<=16);}
 root.userData.setLightingMode('night');for(const light of lights){assert.ok(light.intensity>=38);assert.equal(light.visible,true);}
 root.userData.setLightingMode('sunset');for(const light of lights)assert.ok(light.intensity>0&&light.intensity<20);
 root.userData.setLightingMode('day');for(const light of lights){assert.equal(light.intensity,0);assert.equal(light.visible,false);}
});
