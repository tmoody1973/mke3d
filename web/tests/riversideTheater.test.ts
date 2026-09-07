import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { bilinearTerrainHeight } from '../src/localTerrain.ts';
import { createWalkingWorld } from '../src/walkingWorld.ts';
import { buildRiversideTheater } from '../src/riversideTheater.ts';
import { RIVERSIDE_SITE as site } from '../src/theaterSites.ts';

const getMaterial = (root: THREE.Group, name: string) => (root.getObjectByName(name) as THREE.Mesh).material as THREE.MeshStandardMaterial;

test('Riverside rebuilds the complete Empire wedge with valid merged roof and solids', () => {
 const errors: unknown[] = [], original = console.error; let root: THREE.Group;
 console.error = (...args) => errors.push(args);
 try { root = buildRiversideTheater(() => site.floor); } finally { console.error = original; }
 assert.deepEqual(errors, []);
 assert.equal(root!.name, 'riverside-theater'); assert.equal(root!.children.length, 12);
 for (const mesh of root!.children as THREE.Mesh[]) {
  assert.ok(mesh.geometry.getAttribute('normal'));
  for (const value of mesh.geometry.getAttribute('position').array) assert.ok(Number.isFinite(value));
 }
 const shell = root!.children.find(mesh => mesh.userData.part === 'brick') as THREE.Mesh;
 const positions = shell.geometry.getAttribute('position');
 // Remote north/west vertex is part of the same mass, preventing a standalone theater box.
 assert.ok(Array.from({length: positions.count}, (_, i) => Math.hypot(positions.getX(i) + site.x + 526.328, positions.getZ(i) + site.z + 471.642)).some(d => d < .01));
 const roof = root!.getObjectByName('riverside-roof') as THREE.Mesh;
 roof.geometry.computeBoundingBox(); assert.ok(roof.geometry.boundingBox!.max.y > 43);
 assert.equal(root!.rotation.y, 0); // Minimum-rectangle bearing is not the Wisconsin frontage bearing.
});

test('Wisconsin entry and marquee project south with visible underside lighting', () => {
 const root = buildRiversideTheater(() => 3.2); root.updateMatrixWorld(true);
 const board = root.getObjectByName('riverside-board') as THREE.Mesh;
 const bounds = new THREE.Box3().setFromObject(board);
 assert.ok(bounds.min.z > -431 && bounds.max.z < -425.5);
 assert.ok(Math.abs(bounds.getCenter(new THREE.Vector3()).x + 482.748) < .1);
 assert.ok(bounds.max.x - bounds.min.x > 11 && bounds.max.z - bounds.min.z > 4);
 assert.equal(root.userData.bladeHeight, 12.192);
 assert.equal(root.userData.bladeBottom, 16);
 const redBounds = new THREE.Box3().setFromObject(root.getObjectByName('riverside-red')!);
 assert.ok(Math.abs(redBounds.max.y - (3.2 + 16 + 12.192)) < .01);
 assert.ok(root.userData.undersideBulbCount >= 100);
 const bulbs = (root.getObjectByName('riverside-bulbs') as THREE.Mesh).geometry.getAttribute('position');
 let undersideVertices = 0;
 for (let i = 0; i < bulbs.count; i++) if (bulbs.getY(i) < 3.65 && bulbs.getZ(i) > 20.2) undersideVertices++;
 assert.ok(undersideVertices > 1000);
 const totalBounds = new THREE.Box3().setFromObject(root);
 assert.ok(totalBounds.min.y < 3.2); assert.ok(totalBounds.max.y > 47);
 assert.equal(root.userData.finishedFloor, 3.2);
});

test('Riverside window, letterboard and bulb emission follows day/sunset/night and resets', () => {
 const root = buildRiversideTheater(() => 0);
 for (const name of ['riverside-glass','riverside-board','riverside-bulbs']) {
  const material = getMaterial(root, name);
  assert.equal(material.emissiveIntensity, 0);
  root.userData.setLightingMode('sunset'); const sunset = material.emissiveIntensity;
  root.userData.setLightingMode('night'); assert.ok(material.emissiveIntensity > sunset && sunset > 0);
  root.userData.setLightingMode('day'); assert.equal(material.emissiveIntensity, 0);
 }
});

test('recessed entrance has three visible door pairs with no structural wall in front', () => {
 const floor=2.11, root=buildRiversideTheater(()=>floor);root.updateMatrixWorld(true);
 const entrance=root.userData.entrance;
 assert.equal(entrance.pairCount,3);assert.ok(entrance.recessDepth>1.2);
 const solids=root.children.filter(object=>object.name==='BLDG');
 for(const x of entrance.leafCenters) for(const eyeHeight of [1.05,1.5,2.25]) {
  const ray=new THREE.Raycaster(new THREE.Vector3(x,floor+eyeHeight,entrance.front+8),new THREE.Vector3(0,0,-1));
  const hits=ray.intersectObject(root,true);
  assert.equal(hits[0]?.object.userData.part,'glass',`Door at x=${x}, height=${eyeHeight} must remain visible from the sidewalk`);
  assert.ok(Math.abs(hits[0].point.z-entrance.doorZ)<.03);
  const solidHits=ray.intersectObjects(solids,false);
  assert.ok(solidHits.length>0);assert.ok(solidHits[0].point.z<entrance.doorZ-.2,'Ground-storey mass must recess behind the doors');
 }
});


test('real Wisconsin road datum keeps doors above the street and the entrance apron meets its crossfall', () => {
 const read=(path:string)=>{const b=readFileSync(new URL(path,import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
 const terrainBuffer=read('../public/data/terrain.bin'),d=new DataView(terrainBuffer),nx=d.getUint32(4,true),ny=d.getUint32(8,true);
 const terrain={nx,ny,x0:d.getFloat32(12,true),y0:d.getFloat32(16,true),step:d.getFloat32(20,true),heights:new Float32Array(terrainBuffer.slice(24,24+nx*ny*4)),colors:new Uint8Array(terrainBuffer.slice(24+nx*ny*4))};
 // Decode the independently shipped road mesh, rather than sharing the model's datum formula.
 const buffer=read('../public/data/tiles/t_-1_0.bin'),tile=new DataView(buffer),roads:THREE.Mesh[]=[];let offset=12;
 for(let section=0;section<tile.getUint32(8,true);section++) {
  const name=String.fromCharCode(...new Uint8Array(buffer,offset,4)).trim(),count=tile.getUint32(offset+4,true);offset+=8;
  const origin=[0,4,8].map(k=>tile.getFloat32(offset+k,true)),scale=tile.getFloat32(offset+12,true);offset+=16;
  const positions=new Float32Array(count*3);for(let i=0;i<count*3;i++)positions[i]=tile.getInt16(offset+i*2,true)*scale+origin[i%3];
  offset=Math.ceil((offset+count*6)/4)*4;offset=Math.ceil((offset+count*3)/4)*4;
  if(name==='ROAD'){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));const road=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));road.name='ROAD';roads.push(road);}
 }
 const root=buildRiversideTheater((x,z)=>bilinearTerrainHeight(terrain,x,z));root.updateMatrixWorld(true);
 const floor=root.userData.finishedFloor,apron=root.userData.approach;
 assert.ok(floor>4.1&&floor<4.3,'Finished floor must follow Wisconsin sidewalk, not the low Empire center');
 for(const x of root.userData.entrance.leafCenters) {
  const roadRay=new THREE.Raycaster(new THREE.Vector3(x,15,apron.front),new THREE.Vector3(0,-1,0));
  const street=roadRay.intersectObjects(roads,false)[0];assert.ok(street);
  const edgeRay=new THREE.Raycaster(new THREE.Vector3(x,floor+.6,apron.front-.001),new THREE.Vector3(0,-1,0));
  const edge=edgeRay.intersectObject(root,true)[0];assert.ok(edge);
  assert.ok(Math.abs(edge.point.y-street.point.y)<.025,'Apron outer edge must meet independently decoded ROAD height');
  const eye=new THREE.Raycaster(new THREE.Vector3(x,street.point.y+1.6,apron.front+2),new THREE.Vector3(0,0,-1));
  assert.equal(eye.intersectObject(root,true)[0]?.object.userData.part,'glass','Door glazing must remain visible from actual street eye level');
  let previous=NaN;
  for(let i=0;i<=12;i++) {
   const z=apron.front-.002-i*(apron.front-apron.back-.004)/12;
   const stepRay=new THREE.Raycaster(new THREE.Vector3(x,floor+.6,z),new THREE.Vector3(0,-1,0));
   const hit=stepRay.intersectObject(root,true)[0];assert.ok(hit);
   assert.ok(hit.point.y>=bilinearTerrainHeight(terrain,x,z)-.02);
   if(Number.isFinite(previous))assert.ok(Math.abs(hit.point.y-previous)<.09,'Approach must form a continuous walking slope');
   previous=hit.point.y;
  }
 }
 // Exercise the real walking collision/surface resolver, not just ray heights.
 const tiles=new THREE.Group(),environment=new THREE.Group();tiles.add(...roads);environment.add(root);
 const terrainGeometry=new THREE.PlaneGeometry(100,100,50,50);terrainGeometry.rotateX(-Math.PI/2);terrainGeometry.translate(-482,0,-430);
 const terrainPositions=terrainGeometry.getAttribute('position');
 for(let i=0;i<terrainPositions.count;i++)terrainPositions.setY(i,bilinearTerrainHeight(terrain,terrainPositions.getX(i),terrainPositions.getZ(i)));
 const terrainMesh=new THREE.Mesh(terrainGeometry);terrainMesh.name='TERRAIN';environment.add(terrainMesh);
 assert.equal(root.getObjectByName('riverside-entrance-apron')!.userData.walkingSurface,'grade');
 const world=createWalkingWorld(tiles,environment),spawn=world.findSpawn(root.userData.entrance.x,apron.front+4);
 assert.ok(spawn);assert.ok(Math.abs(spawn.x-root.userData.entrance.x)<.01);
 const onStreet=world.resolve(spawn,{...spawn,z:apron.front+.8});
 assert.equal(onStreet.blocked,false);assert.ok(onStreet.y>3.9);
 for(const x of root.userData.entrance.leafCenters) {
  const alongStreet=world.resolve(onStreet,{x,y:onStreet.y,z:apron.front+.8});assert.equal(alongStreet.blocked,false);
  const atEntrance=world.resolve(alongStreet,{x,y:floor,z:apron.back+.45});
  assert.equal(atEntrance.blocked,false,`Walking must traverse the apron: ${JSON.stringify({x,alongStreet,atEntrance})}`);
  assert.ok(Math.abs(atEntrance.z-(apron.back+.45))<.01);assert.ok(Math.abs(atEntrance.y-floor)<.06);
 }
 const flat=buildRiversideTheater(()=>0);assert.equal(flat.userData.finishedFloor,0);assert.equal(flat.userData.approach.roadCalibration,0);
});
