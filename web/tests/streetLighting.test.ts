import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { STREET_LIGHT_SITES } from '../src/streetLightSites.ts';
import { bilinearTerrainHeight } from '../src/localTerrain.ts';
import { createStreetLighting } from '../src/streetLighting.ts';
import type { StreetLightKind, StreetLightingSite } from '../src/streetLighting.ts';
const kinds:StreetLightKind[]=['downtownMast','thirdWardHeritage','thirdWardRiverwalk','stadiumCampus','plazaEvent'];
const familySites:StreetLightingSite[]=kinds.map((kind,i)=>({id:kind,kind,x:i*30,z:0,y:10+i,heading:Math.PI/2,pool:kind!=='thirdWardRiverwalk'}));
const lights=(root:THREE.Group)=>root.children.filter(c=>c instanceof THREE.PointLight) as THREE.PointLight[];
const lenses=(root:THREE.Group)=>root.children.filter(c=>c.userData.part==='lens') as THREE.InstancedMesh[];

test('five fixture families have finite instanced geometry and exact pole-foot contact',()=>{
 const system=createStreetLighting(familySites,()=>-10),bodies=system.root.children.filter(c=>c.userData.part==='body') as THREE.InstancedMesh[];
 assert.equal(bodies.length,5);assert.equal(lenses(system.root).length,5);assert.equal(system.stats.drawCalls,11);assert.equal(system.stats.fixtures,5);
 for(const mesh of [...bodies,...lenses(system.root)]){
  assert.equal(mesh.count,1);assert.ok(mesh.boundingBox&&!mesh.boundingBox.isEmpty());assert.ok(Number.isFinite(mesh.boundingSphere!.radius));
  for(const attribute of Object.values(mesh.geometry.attributes))for(const v of attribute.array)assert.ok(Number.isFinite(v));
  const matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);const site=familySites.find(s=>s.kind===mesh.userData.kind)!;
  assert.ok(new THREE.Vector3().setFromMatrixPosition(matrix).distanceTo(new THREE.Vector3(site.x,site.y!,site.z))<1e-6);
  if(mesh.userData.part==='body')assert.ok(Math.abs(mesh.geometry.boundingBox!.min.y)<1e-6,'Base must meet supplied elevation, not guessed terrain');
 }
 system.setMode('night');system.update(new THREE.Vector3(0,11,0));const mast=lights(system.root).find(l=>l.userData.siteId==='downtownMast')!;
 assert.ok(mast);assert.ok(Math.abs(mast.position.x-2.8)<1e-6,'Heading +PI/2 turns the local +Z arm east');assert.ok(Math.abs(mast.position.z)<1e-6);assert.ok(Math.abs(mast.position.y-19.28)<1e-6);
 system.dispose();
});

test('fixture lenses remain visible from pedestrian views outside their housings',()=>{
 const probes:Record<StreetLightKind,{eye:number[];target:number[]}>= {
  downtownMast:{eye:[0,7.6,3.1],target:[0,9.23,3.0]},
  thirdWardHeritage:{eye:[0,5,2],target:[.04,5.03,0]},
  thirdWardRiverwalk:{eye:[0,.84,1],target:[.02,.84,0]},
  stadiumCampus:{eye:[0,11.5,1.47],target:[0,12.9,1.47]},
  plazaEvent:{eye:[1,5,0],target:[.2,6.57,0]},
 };
 for(const kind of kinds){
  const system=createStreetLighting([{id:kind,kind,x:0,z:0,y:0}],()=>0,{maxLights:0});system.root.updateMatrixWorld(true);
  const eye=new THREE.Vector3(...probes[kind].eye),target=new THREE.Vector3(...probes[kind].target),ray=new THREE.Raycaster(eye,target.sub(eye).normalize());
  const meshes=system.root.children.filter(c=>c.userData.part==='body'||c.userData.part==='lens'),hit=ray.intersectObjects(meshes)[0];
  assert.equal(hit?.object.userData.part,'lens',`${kind} luminous surface is hidden by its housing`);system.dispose();
 }
});

test('one global light pool is capped, distance-limited, throttled and reassigned across districts',()=>{
 let time=0;
 const sites=Array.from({length:1500},(_,i):StreetLightingSite=>({id:`pole-${i}`,kind:'plazaEvent',x:i<20?i*10:1000+(i-20)*10,z:0,y:0,pool:false}));
 const system=createStreetLighting(sites,()=>0,{maxLights:100,activeRadius:200,now:()=>time});system.setMode('night');system.update(new THREE.Vector3(0,2,0));
 assert.equal(lights(system.root).length,6);assert.equal(system.stats.activeLights,6);assert.deepEqual(system.stats.selectedSiteIds,['pole-0','pole-1','pole-2','pole-3','pole-4','pole-5']);
 const first=system.stats.selectedSiteIds.slice();time=100;system.update(new THREE.Vector3(1000,2,0));assert.deepEqual(system.stats.selectedSiteIds,first);assert.equal(system.stats.selectionUpdates,1);
 time=251;system.update(new THREE.Vector3(1000,2,0));assert.equal(system.stats.selectionUpdates,2);assert.ok(system.stats.selectedSiteIds.every(id=>Number(id.split('-')[1])>=20));
 for(const light of lights(system.root)){assert.equal(light.castShadow,false);assert.ok(light.position.distanceTo(new THREE.Vector3(1000,2,0))<90);}
 time=502;system.update(new THREE.Vector3(-1000,2,0));assert.equal(system.stats.activeLights,0);assert.ok(lights(system.root).every(l=>!l.visible&&l.intensity===0));
 const mobile=createStreetLighting(sites,()=>0,{mobile:true,maxLights:100});mobile.setMode('night');mobile.update(new THREE.Vector3(0,2,0));assert.equal(lights(mobile.root).length,3);assert.equal(mobile.stats.activeLights,3);
 system.dispose();mobile.dispose();
});

test('sunset uses forty percent output and daylight resets actual lights, lenses and pools',()=>{
 const system=createStreetLighting([{id:'pole',kind:'thirdWardHeritage',x:0,z:0,y:0}],()=>0);system.update(new THREE.Vector3(0,2,0));
 const lens=lenses(system.root)[0].material as THREE.MeshStandardMaterial,pools=system.root.getObjectByName('street-ground-pools') as THREE.Mesh,material=pools.material as THREE.MeshBasicMaterial;
 system.setMode('night');const intensity=lights(system.root)[0].intensity;assert.ok(intensity>0);assert.equal(lens.emissiveIntensity,4);assert.equal(material.opacity,.2);assert.equal(pools.visible,true);
 system.setMode('sunset');assert.ok(Math.abs(lights(system.root)[0].intensity/intensity-.4)<1e-9);assert.equal(lens.emissiveIntensity,1.6);assert.ok(Math.abs(material.opacity-.08)<1e-9);
 system.setMode('day');assert.equal(lens.emissiveIntensity,0);assert.equal(material.opacity,0);assert.equal(pools.visible,false);assert.equal(system.stats.activeLights,0);assert.ok(lights(system.root).every(l=>l.intensity===0&&!l.visible));
 system.dispose();
});

test('pools conform to terrain around the independent pavement datum and stay off river edges',()=>{
 const ground=(x:number,z:number)=>x*.04+z*.03;
 const system=createStreetLighting([
  {id:'road',kind:'downtownMast',x:0,z:0,y:1,poolX:0,poolZ:2.2,poolY:.2},
  {id:'water',kind:'thirdWardHeritage',x:30,z:0,y:1,pool:false},
  {id:'edge',kind:'thirdWardRiverwalk',x:50,z:0,y:1},
 ],ground);
 assert.equal(system.stats.pools,1);const mesh=system.root.getObjectByName('street-ground-pools') as THREE.Mesh,p=mesh.geometry.getAttribute('position'),color=mesh.geometry.getAttribute('color');
 const expectedOffset=.2-ground(0,2.2);let maxBrightness=0,minBrightness=Infinity;
 for(let i=0;i<p.count;i++){assert.ok(Math.abs(p.getY(i)-(ground(p.getX(i),p.getZ(i))+expectedOffset))<1e-6);maxBrightness=Math.max(maxBrightness,color.getX(i));minBrightness=Math.min(minBrightness,color.getX(i));}
 assert.ok(maxBrightness>.5);assert.equal(minBrightness,0);
 for(let i=0;i<p.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);assert.ok(b.sub(a).cross(c.sub(a)).y>0,'Pool triangles must face upward');}
 system.dispose();
});

test('missing elevations use sampled ground; invalid sites are skipped and resources dispose exactly once',()=>{
 const system=createStreetLighting([{id:'valid',kind:'plazaEvent',x:10,z:20},{id:'bad',kind:'plazaEvent',x:NaN,z:20},{id:'valid',kind:'plazaEvent',x:0,z:0}],()=>4);
 assert.equal(system.stats.fixtures,1);assert.equal(system.stats.skippedSites,2);const body=system.root.children.find(c=>c.userData.part==='body') as THREE.InstancedMesh,matrix=new THREE.Matrix4();body.getMatrixAt(0,matrix);assert.equal(matrix.elements[13],4);
 const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),instances:THREE.InstancedMesh[]=[];
 system.root.traverse(c=>{if(c instanceof THREE.Mesh){geometries.add(c.geometry);for(const m of Array.isArray(c.material)?c.material:[c.material])materials.add(m);}if(c instanceof THREE.InstancedMesh)instances.push(c);});
 let disposedGeometry=0,disposedMaterial=0,disposedInstances=0;geometries.forEach(g=>g.addEventListener('dispose',()=>disposedGeometry++));materials.forEach(m=>m.addEventListener('dispose',()=>disposedMaterial++));instances.forEach(m=>m.addEventListener('dispose',()=>disposedInstances++));
 const scene=new THREE.Scene();scene.add(system.root);system.dispose();system.dispose();system.setMode('night');system.update(new THREE.Vector3());
 assert.equal(system.root.parent,null);assert.equal(system.root.children.length,0);assert.equal(system.stats.disposed,true);assert.equal(system.stats.activeLights,0);assert.equal(disposedGeometry,geometries.size);assert.equal(disposedMaterial,materials.size);assert.equal(disposedInstances,instances.length);
});


test('shipped city placements preserve their exact sampled surface and share one light budget',()=>{
 const bytes=readFileSync(new URL('../public/data/terrain.bin',import.meta.url)),buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),view=new DataView(buffer),nx=view.getUint32(4,true),ny=view.getUint32(8,true);
 const terrain={nx,ny,x0:view.getFloat32(12,true),y0:view.getFloat32(16,true),step:view.getFloat32(20,true),heights:new Float32Array(buffer.slice(24,24+nx*ny*4)),colors:new Uint8Array(buffer.slice(24+nx*ny*4))};
 let time=0;const system=createStreetLighting(STREET_LIGHT_SITES,(x,z)=>bilinearTerrainHeight(terrain,x,z),{now:()=>time}),byId=new Map(STREET_LIGHT_SITES.map(s=>[s.id,s]));
 assert.equal(system.stats.fixtures,STREET_LIGHT_SITES.length);assert.equal(system.stats.skippedSites,0);assert.equal(system.stats.drawCalls,11);
 for(const body of system.root.children.filter(c=>c.userData.part==='body') as THREE.InstancedMesh[]){
  const matrix=new THREE.Matrix4();for(let i=0;i<body.count;i++){body.getMatrixAt(i,matrix);const site=byId.get(body.userData.siteIds[i])!;assert.ok(Math.abs(matrix.elements[13]-site.y)<1e-4);}
 }
 system.setMode('night');
 for(const district of ['downtown','thirdWard','stadium']){const site=STREET_LIGHT_SITES.find(s=>s.district===district)!;time+=300;const camera=new THREE.Vector3(site.x,site.y+2,site.z);system.update(camera);assert.ok(system.stats.activeLights>0&&system.stats.activeLights<=6);for(const light of lights(system.root).filter(l=>l.visible))assert.ok(light.position.distanceTo(camera)<90);}
 const pool=system.root.getObjectByName('street-ground-pools') as THREE.Mesh;for(const v of pool.geometry.getAttribute('position').array)assert.ok(Number.isFinite(v));assert.ok(system.stats.pools<system.stats.fixtures,'Water-adjacent placements must not acquire broad ground pools');
 system.dispose();
});
