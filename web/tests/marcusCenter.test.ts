import test from 'node:test';
import { readFileSync } from 'node:fs';
import { bilinearTerrainHeight } from '../src/localTerrain.ts';
import { createWalkingWorld } from '../src/walkingWorld.ts';
import { removeMarcusPlaceholders } from '../src/marcusSite.ts';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildMarcusCenter } from '../src/marcusCenter.ts';
import { MARCUS_SITE as site } from '../src/marcusSite.ts';

test('Marcus exterior merges stone panels, custom glazing and canopy into finite geometry',()=>{
 const errors:unknown[]=[];const old=console.error;console.error=(...args)=>errors.push(args);let model:THREE.Group;
 try{model=buildMarcusCenter(()=>4.31);}finally{console.error=old;}
 assert.deepEqual(errors,[]);assert.equal(model!.name,'marcus-center');assert.equal(model!.children.length,11);
 let triangles=0;
 for(const child of model!.children as THREE.Mesh[]){
  const p=child.geometry.getAttribute('position'),n=child.geometry.getAttribute('normal');assert.ok(p.count>0);assert.equal(n.count,p.count);assert.equal(child.geometry.getAttribute('color').count,p.count);
  for(const value of p.array)assert.ok(Number.isFinite(value));for(const value of n.array)assert.ok(Number.isFinite(value));triangles+=p.count/3;
 }
 assert.ok(triangles<85000,`Unexpected exterior complexity: ${triangles}`);
 assert.equal(model!.children.filter(child=>child.name==='BLDG').length,4);
 model!.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model!);assert.ok(bounds.max.y-model!.position.y>38);assert.ok(bounds.max.y-model!.position.y<40);
});

test('colored night illumination covers real stone facade surfaces and resets for daylight',()=>{
 const model=buildMarcusCenter(()=>4.31);
 const material=(part:string)=>(model.children.find(child=>child.userData.part===part) as THREE.Mesh).material as THREE.MeshStandardMaterial;
 model.userData.setLightingMode('night');
 for(const part of ['washRed','washCool','washWhite'])assert.ok(material(part).emissiveIntensity>.8);
 const red=material('washRed').emissive,blue=material('washCool').emissive;assert.ok(red.r>red.b*4);assert.ok(blue.b>blue.r*4);
 assert.ok(material('warm').emissiveIntensity>2);
 model.userData.setLightingMode('sunset');for(const part of ['washRed','washCool','washWhite'])assert.ok(material(part).emissiveIntensity>0&&material(part).emissiveIntensity<.4);
 model.userData.setLightingMode('day');for(const part of ['washRed','washCool','washWhite','glass','warm','letters','recess'])assert.equal(material(part).emissiveIntensity,0);
});

test('foundation follows the falling river grade while the east entrance stays above the public road',()=>{
 const terrain=(x:number)=>4.31+(x+474)*.025,model=buildMarcusCenter(terrain);model.updateMatrixWorld(true);
 assert.equal(model.userData.facade,'east');assert.ok(model.position.y>=4.72);assert.equal(model.rotation.y,site.bearing);
 const stone=model.children.find(child=>child.userData.part==='stone') as THREE.Mesh,p=stone.geometry.getAttribute('position');
 // Foundation skirt is first: its actual world vertices reach ground on every edge.
 const edges=site.footprint.length-1;
 for(let i=0;i<edges;i++){
  for(const offset of [0,1]){const world=new THREE.Vector3().fromBufferAttribute(p,i*6+offset).applyMatrix4(model.matrixWorld);assert.ok(Math.abs(world.y-(terrain(world.x)-.22))<.002);}
 }
 const entry=new THREE.Vector3(...model.userData.entryLocal).applyMatrix4(model.matrixWorld);assert.ok(entry.x>site.x+50);assert.ok(entry.y>4.70);
});

test('east bowed curtain wall normals face the street and south glazing faces the lawn',()=>{
 const model=buildMarcusCenter(()=>4.31),glass=model.getObjectByName('marcus-glass') as THREE.Mesh;
 const p=glass.geometry.getAttribute('position'),n=glass.geometry.getAttribute('normal');let east=0,south=0;
 for(let i=0;i<p.count;i++){
  if(p.getX(i)>54&&p.getY(i)>17){assert.ok(n.getX(i)>.85,'Main curtain wall is facing inward');east++;}
  if(p.getZ(i)>28.5&&p.getX(i)<2&&p.getY(i)>5.8){assert.ok(n.getZ(i)>.95,'Curved public-entry glazing is facing inward');south++;}
 }
 assert.ok(east>=60);assert.ok(south>60);
});

test('facade wash has brighter white centers, blue edges and downward falloff without extra lights',()=>{
 const model=buildMarcusCenter(()=>4.31),white=model.children.find(child=>child.userData.part==='washWhite') as THREE.Mesh;
 const p=white.geometry.getAttribute('position'),wash=white.geometry.getAttribute('facadeWash');assert.equal(wash.count,p.count);
 const upper:number[]=[],lower:number[]=[],edge:number[]=[];
 for(let i=0;i<p.count;i++){
  for(let c=0;c<3;c++)assert.ok(Number.isFinite(wash.array[i*3+c]));
  if(Math.abs(p.getZ(i)-19.7)<.2){if(p.getY(i)>20)upper.push(wash.getX(i));if(p.getY(i)<2)lower.push(wash.getX(i));}
  if(p.getZ(i)>21.8&&p.getZ(i)<22.3&&p.getY(i)>20){edge.push(wash.getX(i));assert.ok(wash.getZ(i)>wash.getX(i)*2);}
 }
 assert.ok(upper.length&&lower.length&&edge.length);
 const mean=(a:number[])=>a.reduce((n,x)=>n+x,0)/a.length;
 assert.ok(mean(upper)>mean(lower)*2);assert.ok(mean(upper)>mean(edge)*2);
 let lights=0;model.traverse(child=>{if(child instanceof THREE.Light)lights++;});assert.equal(lights,0);
});

test('lighting resets daylight stone color, transparency and standard shader tone mapping',()=>{
 const model=buildMarcusCenter(()=>4.31),parts=['washWhite','washRed','washCool','glass'];
 const materials=parts.map(part=>(model.children.find(child=>child.userData.part===part) as THREE.Mesh).material as THREE.MeshStandardMaterial);
 const original=materials.map(material=>({color:material.color.getHex(),opacity:material.opacity,toneMapped:material.toneMapped}));
 model.userData.setLightingMode('night');assert.ok(materials[3].emissiveIntensity<.11);assert.ok(materials[3].opacity<.6);
 assert.equal(materials[1].toneMapped,false);
 model.userData.setLightingMode('day');materials.forEach((material,i)=>{assert.equal(material.color.getHex(),original[i].color);assert.equal(material.opacity,original[i].opacity);assert.equal(material.toneMapped,original[i].toneMapped);});
 const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms)};
 materials[0].onBeforeCompile(shader,{} as THREE.WebGLRenderer);
 assert.match(shader.vertexShader,/attribute vec3 facadeWash/);assert.match(shader.fragmentShader,/totalEmissiveRadiance \*= vFacadeWash/);
});

test('shipped Water Street terrain and road permit walking up to the clear glass doors',()=>{
 const read=(path:string)=>{const b=readFileSync(new URL(path,import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
 const buffer=read('../public/data/terrain.bin'),view=new DataView(buffer),nx=view.getUint32(4,true),ny=view.getUint32(8,true);
 const terrain={nx,ny,x0:view.getFloat32(12,true),y0:view.getFloat32(16,true),step:view.getFloat32(20,true),heights:new Float32Array(buffer.slice(24,24+nx*ny*4)),colors:new Uint8Array(buffer.slice(24+nx*ny*4))};
 const tileBuffer=read('../public/data/tiles/t_-1_0.bin'),tileView=new DataView(tileBuffer),tile=new THREE.Group();let offset=12;
 for(let section=0;section<tileView.getUint32(8,true);section++){
  const name=String.fromCharCode(...new Uint8Array(tileBuffer,offset,4)).trim(),count=tileView.getUint32(offset+4,true);offset+=8;
  const origin=[0,4,8].map(k=>tileView.getFloat32(offset+k,true)),scale=tileView.getFloat32(offset+12,true);offset+=16;
  const positions=new Float32Array(count*3);for(let i=0;i<count*3;i++)positions[i]=tileView.getInt16(offset+i*2,true)*scale+origin[i%3];
  offset=Math.ceil((offset+count*6)/4)*4;offset=Math.ceil((offset+count*3)/4)*4;
  if(['ROAD','BLDG'].includes(name)){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.name=name;tile.add(mesh);}
 }
 assert.ok(removeMarcusPlaceholders(tile,{i:-1,j:0})>0);
 const ground=(x:number,z:number)=>bilinearTerrainHeight(terrain,x,z),model=buildMarcusCenter(ground),tiles=new THREE.Group(),environment=new THREE.Group();tiles.add(tile);environment.add(tiles,model);
 const terrainGeometry=new THREE.PlaneGeometry(110,110,55,55);terrainGeometry.rotateX(-Math.PI/2);terrainGeometry.translate(-479,0,-886);
 const p=terrainGeometry.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,ground(p.getX(i),p.getZ(i)));
 const groundMesh=new THREE.Mesh(terrainGeometry);groundMesh.name='TERRAIN';environment.add(groundMesh);environment.updateMatrixWorld(true);
 const world=createWalkingWorld(tiles,environment),point=(x:number,z:number)=>new THREE.Vector3(x,0,z).applyMatrix4(model.matrixWorld);
 const start=point(70,.8),spawn=world.findSpawn(start.x,start.z);assert.ok(spawn);assert.ok(Math.hypot(spawn.x-start.x,spawn.z-start.z)<.05);
 const destination=point(59.8,.8),result=world.resolve(spawn,{x:destination.x,y:model.position.y,z:destination.z});
 assert.equal(result.blocked,false,JSON.stringify({spawn,destination:destination.toArray(),result}));assert.ok(Math.hypot(result.x-destination.x,result.z-destination.z)<.05);
 const inward=new THREE.Vector3(-1,0,0).applyQuaternion(model.quaternion),eye=new THREE.Vector3(result.x,result.y+1.6,result.z),ray=new THREE.Raycaster(eye,inward,0,3);
 const hits=ray.intersectObject(model,true);assert.equal(hits[0]?.object.userData.part,'glass','Exterior approach must face visible glass, without a BLDG volume across the entry');
});
