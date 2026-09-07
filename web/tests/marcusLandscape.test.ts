import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { buildMarcusLandscape } from '../src/marcusLandscape.ts';
import { PECK_SITE,MARCUS_SITE } from '../src/marcusSite.ts';
import { bilinearTerrainHeight } from '../src/localTerrain.ts';
import { createWalkingWorld } from '../src/walkingWorld.ts';

test('Peck is an open triangulated pavilion with complete finite roof and seating geometry',()=>{
 const errors:unknown[]=[],previous=console.error;let root:THREE.Group;
 console.error=(...args)=>errors.push(args);try{root=buildMarcusLandscape(()=>2);}finally{console.error=previous;}
 assert.deepEqual(errors,[]);assert.equal(root!.name,'marcus-landscape');assert.equal(root!.children.length,16);
 for(const mesh of root!.children as THREE.Mesh[]){for(const value of mesh.geometry.getAttribute('position').array)assert.ok(Number.isFinite(value));assert.ok(mesh.geometry.getAttribute('normal'));}
 assert.equal(root!.userData.seatCenters.length,390);assert.equal(root!.userData.wheelchairPositions,6);assert.equal(root!.userData.treeCenters.length,24);
 const roof=new THREE.Box3().setFromObject(root!.getObjectByName('marcus-landscape-roof')!);
 assert.ok(roof.max.y>9.5&&roof.max.y<9.6);assert.ok(Math.abs(roof.getCenter(new THREE.Vector3()).x-PECK_SITE.x)<.001);
 const ray=new THREE.Raycaster(new THREE.Vector3(PECK_SITE.x,4,PECK_SITE.z),new THREE.Vector3(1,0,0));
 const mass=root!.getObjectByName('marcus-landscape-structure')!;
 assert.equal(ray.intersectObject(mass).filter(hit=>hit.distance<8).length,0,'Seating must not be enclosed by a generic building prism');
});

test('grounds follow real terrain and stay north of Kilbourn sidewalk',()=>{
 const b=readFileSync(new URL('../public/data/terrain.bin',import.meta.url)),a=b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),d=new DataView(a),nx=d.getUint32(4,true),ny=d.getUint32(8,true);
 const terrain={nx,ny,x0:d.getFloat32(12,true),y0:d.getFloat32(16,true),step:d.getFloat32(20,true),heights:new Float32Array(a.slice(24,24+nx*ny*4)),colors:new Uint8Array(a.slice(24+nx*ny*4))};
 const ground=(x:number,z:number)=>bilinearTerrainHeight(terrain,x,z),root=buildMarcusLandscape(ground);
 for(const [name,offset] of [['paving',.04],['grass',.035],['gravel',.025],['soil',.012],['memorial',.055]] as const){
  const mesh=root.getObjectByName(`marcus-landscape-${name}`) as THREE.Mesh,p=mesh.geometry.getAttribute('position');
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),z=p.getZ(i),gap=p.getY(i)-ground(x,z);
   assert.ok(gap>=.005&&gap<.06,`${name} must rest on terrain rather than a raised slab`);
   if(name!=='paving')assert.ok(Math.abs(gap-offset)<.001);
   // Street edge from actual OSM footway704189626. Grounds remain inside it.
   if(x>-525.344&&x<-463.138){const streetZ=-797.725+(x+525.344)*(-21.031/62.206);assert.ok(z<streetZ-.15,`${name} encroaches on Kilbourn`);}
  }
 }
 const m=root.userData.memorial;assert.ok(Math.hypot(m.x+479,m.z+833)<1);
 assert.equal((root.getObjectByName('marcus-landscape-paving') as THREE.Mesh).userData.walkingSurface,'grade');
 // Actual walking resolver crosses the sloping public path using the generated grade.
 const tiles=new THREE.Group(),env=new THREE.Group();env.add(root);
 const road=new THREE.Mesh(new THREE.PlaneGeometry(180,130,18,13));road.geometry.rotateX(-Math.PI/2);road.geometry.translate(-530,0,-820);
 const p=road.geometry.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,ground(p.getX(i),p.getZ(i)));road.name='ROAD';tiles.add(road);
 const local=(x:number,z:number)=>({x:PECK_SITE.x+x*Math.cos(MARCUS_SITE.bearing)+z*Math.sin(MARCUS_SITE.bearing),z:PECK_SITE.z-x*Math.sin(MARCUS_SITE.bearing)+z*Math.cos(MARCUS_SITE.bearing)});
 const from=local(25,-13.2),to=local(75,-13.2),world=createWalkingWorld(tiles,env),start=world.findSpawn(from.x,from.z);assert.ok(start);
 const end=world.resolve(start,{...to,y:start.y});assert.equal(end.blocked,false);assert.ok(Math.hypot(end.x-to.x,end.z-to.z)<.01);
});

test('pavilion and pathway lights follow day/sunset/night and reset cleanly',()=>{
 const root=buildMarcusLandscape(()=>0),lamp=(root.getObjectByName('marcus-landscape-lamp') as THREE.Mesh).material as THREE.MeshStandardMaterial;
 assert.equal(lamp.emissiveIntensity,0);root.userData.setLightingMode('sunset');const sunset=lamp.emissiveIntensity;
 root.userData.setLightingMode('night');assert.ok(lamp.emissiveIntensity>sunset&&sunset>0);root.userData.setLightingMode('day');assert.equal(lamp.emissiveIntensity,0);
});
