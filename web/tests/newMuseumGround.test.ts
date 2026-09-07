import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createNewMuseumGround} from '../src/newMuseumGround.ts';
import {buildNewMuseumCampus} from '../src/newMuseumCampus.ts';
import {NEW_MUSEUM_SITE as s} from '../src/newMuseumSite.ts';
import {bilinearTerrainHeight} from '../src/localTerrain.ts';
import {createWalkingWorld} from '../src/walkingWorld.ts';

// Real shipped terrain, independent decoder: a flat mock hid the original gap.
const bytes=readFileSync(new URL('../public/data/terrain.bin',import.meta.url));
const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),view=new DataView(buffer);
const nx=view.getUint32(4,true),ny=view.getUint32(8,true);
const terrain={nx,ny,x0:view.getFloat32(12,true),y0:view.getFloat32(16,true),step:view.getFloat32(20,true),heights:new Float32Array(buffer.slice(24,24+nx*ny*4)),colors:new Uint8Array(buffer.slice(24+nx*ny*4))};
const original=(x:number,z:number)=>bilinearTerrainHeight(terrain,x,z);

test('museum base meets the actual finished ground instead of the old floating datum',()=>{
 const campus=buildNewMuseumCampus(original);campus.updateMatrixWorld(true);
 const museum=campus.getObjectByName('future-milwaukee-public-museum')!,ground=campus.getObjectByName('museum-graded-ground')!;
 const base=new THREE.Box3().setFromObject(museum.getObjectByName('BLDG')!).min.y;
 for(const name of ['new-museum-canyon-scoops-and-slots','new-museum-blue-entry-installation'])assert.ok(Math.abs(new THREE.Box3().setFromObject(museum.getObjectByName(name)!).min.y-base)<.001,'glass and stone meet at the same grade');
 assert.ok(museum.position.y<s.floor-1,'real terrain places the museum more than a metre below its former fixed datum');
 assert.equal(campus.getObjectByName('museum-foundation'),undefined,'no thin elevated foundation slab');
 // Entrance plus both south ground openings, west Commons, and northeast wing.
 for(const [dx,dz] of [[0,24],[-20,24],[20,24],[-25,0],[20,-20]]){
  const hit=new THREE.Raycaster(new THREE.Vector3(s.x+dx,50,s.z+dz),new THREE.Vector3(0,-1,0)).intersectObject(ground)[0];
  assert.ok(hit&&Math.abs(hit.point.y-base)<.005,`base contact at ${dx}, ${dz}`);
 }
});

test('apron joins the sidewalk datum continuously with no step at the building edge',()=>{
 const grade=createNewMuseumGround(original);
 for(const [dx,dz,ux,uz] of [[0,30,0,1],[-26,0,-1,0],[26,0,1,0],[0,-30,0,-1]]){
  let previous=grade.heightAt(s.x+dx,s.z+dz);
  assert.ok(Math.abs(previous-grade.floor)<.001);
  for(let t=.25;t<=7;t+=.25){
   const x=s.x+dx+ux*t,z=s.z+dz+uz*t,y=grade.heightAt(x,z);
   assert.ok(Math.abs(y-previous)<.09,'no curb-sized step within the sloped apron');
   assert.ok(y>=original(x,z)-.001);previous=y;
  }
  assert.ok(Math.abs(previous-original(s.x+dx+ux*7,s.z+dz+uz*7))<.001,'apron reaches existing sidewalk grade');
 }
});

test('walking uses the finished apron rather than the buried terrain',()=>{
 const grade=createNewMuseumGround(original),tiles=new THREE.Group(),environment=new THREE.Group();
 const buried=new THREE.Mesh(new THREE.PlaneGeometry(200,200).rotateX(-Math.PI/2).translate(s.x,4.5,s.z));buried.name='TERRAIN';environment.add(buried);
 const coverage=new THREE.Mesh(new THREE.PlaneGeometry(200,200).rotateX(-Math.PI/2).translate(s.x,4.5,s.z));coverage.name='ROAD';tiles.add(coverage);environment.add(tiles);
 const surface=new THREE.Mesh(grade.geometry);surface.userData.walkingSurface='grade';environment.add(surface);
 const world=createWalkingWorld(tiles,environment),start=world.findSpawn(s.x,s.z+36);
 assert.ok(start);assert.ok(Math.abs(start.y-grade.heightAt(start.x,start.z))<.02,'spawn rests on new paving');
 let point=start;
 for(let z=35.8;z>=27;z-=.2){const next=world.resolve(point,{...point,z:s.z+z});assert.equal(next.blocked,false);point=next;}
 assert.ok(Math.abs(point.y-grade.floor)<.005,'walk reaches entrance floor without sinking underneath');
});
