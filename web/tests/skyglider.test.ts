import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildSkyglider,createSkygliderRoute,SKYGLIDER,distanceToSkygliderRoute} from '../src/skyglider.ts';
import {SUMMERFEST_BUILDINGS} from '../src/summerfestSiteData.ts';
const ground=()=>2.2;
const route=createSkygliderRoute(ground);
const model=buildSkyglider(ground);
const distance=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
test('mapped Skyglider corridor, low stations, and estimated high line are internally consistent',()=>{
 assert.ok(route.length>482&&route.length<485);assert.ok(route.totalLength>970&&route.totalLength<990);
 for(const s of route.supports){assert.ok(distanceToSkygliderRoute(s.x,s.z)<.15);assert.equal(s.ground,2.2);}
 assert.ok(Math.abs(route.cableY(0)-ground()-SKYGLIDER.seatDrop-.65)<1e-9);
 assert.ok(route.cableY(route.length/2)-ground()-SKYGLIDER.seatDrop>7);
 assert.ok(distanceToSkygliderRoute(490.3718,267.6665)<.001);
});
test('full circuit has no teleport, with opposite lane motion and constant cable distance speed',()=>{
 assert.ok(distance(route.sample(0),route.sample(route.totalLength))<1e-9);
 assert.ok(distance(route.sample(-.01),route.sample(.01))<.0201);
 for(let d=0;d<route.totalLength;d+=.71){const a=route.sample(d),b=route.sample(d+.02);assert.ok(Math.abs(distance(a,b)-.02)<.0015);}
 const a=route.sample(200),b=route.sample(200+.1),c=route.sample(route.totalLength/2+200),d=route.sample(route.totalLength/2+200.1);
 assert.ok(b.z>a.z&&d.z<c.z);
 assert.ok(Math.cos(a.yaw-c.yaw)<-.99);
});
test('94 two-person chairs are instanced, upright, and attached to cable; moving bounds cover every stop',()=>{
 const meshes:THREE.InstancedMesh[]=[];let count=0;
 model.traverse(o=>{if(o instanceof THREE.Mesh){count++;for(const n of o.geometry.getAttribute('position').array)assert.ok(Number.isFinite(n));}if(o instanceof THREE.InstancedMesh)meshes.push(o);});
 assert.equal(meshes.length,3);assert.ok(count<=13);assert.equal(model.userData.stats.chairs,94);assert.equal(model.userData.stats.seatsPerChair,2);
 const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3(),quaternion=new THREE.Quaternion();
 for(const mesh of meshes){assert.equal(mesh.count,94);for(let i=0;i<94;i++){mesh.getMatrixAt(i,matrix);matrix.decompose(position,quaternion,scale);const expected=model.userData.getChairPose(i);assert.ok(distance(position,expected)<.0001);assert.ok(new THREE.Vector3(0,1,0).applyQuaternion(quaternion).distanceTo(new THREE.Vector3(0,1,0))<1e-6);assert.ok(mesh.boundingBox!.containsPoint(position));}}
 for(let d=0;d<route.totalLength;d+=.5){const p=route.sample(d);for(const mesh of meshes)assert.ok(mesh.boundingSphere!.containsPoint(new THREE.Vector3(p.x,p.y,p.z)));}
});
test('both chair lanes clear nearby mapped concession walls and market roofs',()=>{
 function inside(x:number,z:number,polygon:readonly (readonly number[])[]){let c=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
 const buildings=SUMMERFEST_BUILDINGS.filter(s=>[385065552,385065519].includes(s.id));assert.equal(buildings.length,2);
 for(let d=0;d<route.totalLength;d+=.2){const p=route.sample(d);for(const building of buildings)for(const side of [-.82,0,.82])for(const fore of [-.53,0,.53]){const x=p.x+Math.cos(p.yaw)*side+Math.sin(p.yaw)*fore,z=p.z-Math.sin(p.yaw)*side+Math.cos(p.yaw)*fore;if(inside(x,z,building.footprint))assert.ok(p.y-SKYGLIDER.seatDrop>ground()+.1+Math.max(3,Math.min(9,building.height-1.5)),`chair envelope overlaps building ${building.id} at ${x},${z}`);}}
});
test('animation pauses for reduced motion and terminal glow resets to daylight',()=>{
 const before=model.userData.getChairPose(4);model.userData.update(.5,true);assert.deepEqual(model.userData.getChairPose(4),before);
 model.userData.update(.5);assert.ok(distance(before,model.userData.getChairPose(4))>.65);assert.ok(Math.abs(model.userData.stats.elapsedDistance-.675)<1e-9);
 const strip=model.getObjectByName('skyglider-terminal-light-strips') as THREE.Mesh;const material=strip.material as THREE.MeshStandardMaterial;
 model.userData.setLightingMode('night');assert.equal(material.emissiveIntensity,1.7);model.userData.setLightingMode('sunset');assert.equal(material.emissiveIntensity,.65);model.userData.setLightingMode('day');assert.equal(material.emissiveIntensity,0);
});
test('disposal is idempotent and stops animation',()=>{
 const small=buildSkyglider(ground);let disposals=0;small.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.addEventListener('dispose',()=>disposals++);});small.userData.dispose();const count=disposals;small.userData.dispose();small.userData.update(1);assert.ok(count>0);assert.equal(disposals,count);assert.equal(small.userData.stats.travel,0);assert.equal(small.userData.stats.disposed,true);
});

test('terminal downlight lenses are exposed below their beams and boarding pools fade off in daylight',()=>{
 model.updateMatrixWorld(true);
 for(const along of [0,route.length]){
  const p=route.world(0,along),y=route.cableY(along);
  const ray=new THREE.Raycaster(new THREE.Vector3(p.x,y+.62,p.z),new THREE.Vector3(0,1,0),0,.3);
  const first=ray.intersectObject(model,true)[0];assert.ok(first);assert.equal(first.object.name,'skyglider-terminal-light-strips','lens must be the first surface viewed from below, not hidden inside red support');
 }
 const pools=model.getObjectByName('skyglider-boarding-light-pools') as THREE.Mesh;const material=pools.material as THREE.MeshBasicMaterial;
 const position=pools.geometry.getAttribute('position');for(let i=0;i<position.count;i++)assert.ok(Math.abs(position.getY(i)-(ground()+.135))<1e-6,'pool lies just above the platform');
 assert.equal(material.depthWrite,false);assert.equal(material.blending,THREE.AdditiveBlending);
 model.userData.setLightingMode('night');assert.ok(pools.visible);assert.equal(material.opacity,.3);
 model.userData.setLightingMode('sunset');assert.ok(pools.visible);assert.equal(material.opacity,.12);
 model.userData.setLightingMode('day');assert.equal(pools.visible,false);assert.equal(material.opacity,0);
});
