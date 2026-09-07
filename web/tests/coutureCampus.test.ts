import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { buildCouture } from '../src/coutureCampus.ts';
import { COUTURE_SITE } from '../src/coutureSite.ts';

test('mapped L-Line has unobstructed vehicle width and height through the new concourse',()=>{
  const root=buildCouture(()=>2.5);root.updateMatrixWorld(true);
  const data=JSON.parse(readFileSync(new URL('../public/data/hop/network.json',import.meta.url),'utf8'));
  const path=data.paths.find((p:{routeId:string})=>p.routeId==='TL-4');
  let checked=0;
  path.points.forEach((p:number[],i:number)=>{
    const [x,y,z]=p;
    if(z< -283.8||z> -196.3)return;
    const t=(z+283.821)/87.596,expectedX=420.843+(403.902-420.843)*t;
    if(Math.abs(x-expectedX)>2)return;
    const prev=path.points[Math.max(0,i-1)],next=path.points[Math.min(path.points.length-1,i+1)];
    const tangent=new THREE.Vector3(next[0]-prev[0],0,next[2]-prev[2]).normalize();
    for(const offset of [-1.45,0,1.45]){
      const origin=new THREE.Vector3(x+tangent.z*offset,y+.08,z-tangent.x*offset);
      const obstacle=new THREE.Raycaster(origin,new THREE.Vector3(0,1,0),0,3.65).intersectObject(root,true)[0];
      assert.equal(obstacle,undefined,`tram envelope hit ${obstacle?.object.name} at ${x},${z}, offset${offset}`);
    }
    checked++;
  });
  assert.ok(checked>20,`checked${checked} actual route samples`);
});

test('podium retains a low garage and clear north and south hall portals',()=>{
  const root=buildCouture(()=>2.5);root.updateMatrixWorld(true);
  const {north,south,northRailY,southRailY}=COUTURE_SITE.transit;
  const direction=new THREE.Vector3(south[0]-north[0],0,south[1]-north[1]).normalize();
  for(const [point,railY,sign] of [[north,northRailY,1],[south,southRailY,-1]] as const){
    const origin=new THREE.Vector3(point[0],railY+2,point[1]).addScaledVector(direction,-5*sign);
    assert.equal(new THREE.Raycaster(origin,direction.clone().multiplyScalar(sign),0,12).intersectObject(root,true).length,0);
  }
  const garageTop=new THREE.Raycaster(new THREE.Vector3(385,40,-250),new THREE.Vector3(0,-1,0),0,40).intersectObject(root,true)[0];
  assert.ok(garageTop&&garageTop.point.y<16&&garageTop.point.y>13,'garage has three levels, not tower height');
});

test('campus mode hooks light the tower and concourse without adding light objects',()=>{
  const root=buildCouture(()=>2.5);
  const fixture=root.getObjectByName('couture-concourse-ceiling-light-strips') as THREE.Mesh;
  const material=fixture.material as THREE.MeshStandardMaterial;
  root.userData.setLightingMode('night');assert.ok(material.emissiveIntensity>0);
  root.userData.setLightingMode('day');assert.equal(material.emissiveIntensity,0);
  root.traverse(node=>assert.ok(!(node instanceof THREE.Light)));
  const bounds=new THREE.Box3().setFromObject(root);
  assert.ok(bounds.max.y<170&&bounds.max.y>160);
});
