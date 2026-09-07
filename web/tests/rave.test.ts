import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { buildRave } from '../src/rave.ts';
import { RAVE_SITE as site, removeRavePlaceholder } from '../src/raveSite.ts';
import { bilinearTerrainHeight } from '../src/localTerrain.ts';
import { createWalkingWorld } from '../src/walkingWorld.ts';

test('Rave merges its modeled stone arches, spiral columns and roof into finite geometry',()=>{
 const errors:unknown[]=[];const original=console.error;console.error=(...args)=>errors.push(args);let model:THREE.Group;
 try{model=buildRave(()=>0);}finally{console.error=original;}
 assert.deepEqual(errors,[]);assert.equal(model!.name,'the-rave');const meshes=model!.children.filter(c=>c instanceof THREE.Mesh) as THREE.Mesh[];assert.equal(meshes.length,15);
 let triangles=0;for(const mesh of meshes){const p=mesh.geometry.getAttribute('position'),n=mesh.geometry.getAttribute('normal');assert.equal(p.count,n.count);for(const v of p.array)assert.ok(Number.isFinite(v));for(const v of n.array)assert.ok(Number.isFinite(v));triangles+=p.count/3;}
 assert.ok(triangles<100000,`${triangles} exceeds the exterior budget`);assert.equal(model!.children.filter(c=>c.name==='BLDG').length,3);
 model!.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model!);assert.ok(bounds.max.y-model!.position.y>26.5);assert.ok(bounds.max.y-model!.position.y<28);
 const roof=model!.getObjectByName('rave-roof') as THREE.Mesh,p=roof.geometry.getAttribute('position'),n=roof.geometry.getAttribute('normal');let slope=0;
 for(let i=0;i<p.count;i++)if(p.getY(i)>26.30&&p.getZ(i)<-30){assert.ok(n.getY(i)>.9,'Upper gallery roof must face upward');slope++;}assert.ok(slope>=6);
});

test('all three recessed portals show glass before any BLDG and monumental arches remain open',()=>{
 const model=buildRave(()=>0);model.updateMatrixWorld(true);
 for(const x of model.userData.entrance.centers)for(const dx of [-.68,.68]){
  const eye=new THREE.Vector3(x+dx,1.6,-41).applyMatrix4(model.matrixWorld),direction=new THREE.Vector3(0,0,1).applyQuaternion(model.quaternion);
  const hits=new THREE.Raycaster(eye,direction).intersectObject(model,true);assert.equal(hits[0]?.object.userData.part,'entryGlass',`Portal leaf ${x+dx} blocked by ${hits[0]?.object.userData.part}`);
 }
 for(const x of model.userData.entrance.centers)for(const y of [8.2,12.6,15.5]){
  const eye=new THREE.Vector3(x+.26,y,-40).applyMatrix4(model.matrixWorld),direction=new THREE.Vector3(0,0,1).applyQuaternion(model.quaternion),hits=new THREE.Raycaster(eye,direction).intersectObject(model,true);
  assert.ok(['glass','metal'].includes(hits[0]?.object.userData.part),`Central arch must expose glass/frame, not masonry: ${hits[0]?.object.userData.part}`);
  const localHit=model.worldToLocal(hits[0].point.clone());assert.ok(localHit.z-site.entrance.localPavilionZ>1.3,'Glazing must be recessed behind the carved arch reveal');
 }
});

test('north entrance names read left to right from outside',()=>{
 const model=buildRave(()=>0),letters=model.getObjectByName('rave-letter') as THREE.Mesh,p=letters.geometry.getAttribute('position');
 const camera=new THREE.PerspectiveCamera();camera.position.set(1.3,4.5,-46);camera.lookAt(1.3,4.5,-35.87);camera.updateMatrixWorld(true);
 const center=(index:number)=>{const sign=model.userData.signRanges[index];let min=Infinity,max=-Infinity;for(let i=sign.first;i<sign.first+sign.count;i++){min=Math.min(min,p.getX(i));max=Math.max(max,p.getX(i));}return -(min+max)/2;};
 assert.ok(center(0)<center(1)&&center(1)<center(2),'EAGLES / THE RAVE / CLUB must occupy the photographed left-to-right doors');
 assert.ok(center(4)<center(3),'THE RAVE banner belongs to observer left');
 for(const sign of model.userData.signRanges.slice(0,3) as {text:string;first:number;count:number}[]){
  const a=new THREE.Vector3().fromBufferAttribute(p,sign.first).applyMatrix4(camera.matrixWorldInverse),b=new THREE.Vector3().fromBufferAttribute(p,sign.first+sign.count-1).applyMatrix4(camera.matrixWorldInverse);
  assert.ok(b.x>a.x+1,`${sign.text} must advance to the observer's right`);
 }
});

test('side window corners sit within fifteen centimetres of the actual structural wall',()=>{
 const model=buildRave(()=>0);model.updateMatrixWorld(true);
 const wall=model.children.filter(c=>c.userData.part==='side'),glass=model.children.filter(c=>['glass','litGlass'].includes(c.userData.part));
 assert.ok(model.userData.sideWindowSurfaces.length>80,'Preserve the paired window rhythm');
 let steppedWest=0;
 for(const opening of model.userData.sideWindowSurfaces){
  const normal=new THREE.Vector3(...opening.normal),tangent=new THREE.Vector3(Math.cos(opening.angle),0,-Math.sin(opening.angle));
  if(opening.x>-20&&opening.x<0)steppedWest++;
  for(const u of [-.43,.43])for(const v of [.08,.92]){
   const p=new THREE.Vector3(opening.x,opening.y+v*opening.height,opening.z).addScaledVector(tangent,u*opening.width).addScaledVector(normal,1);
   const ray=new THREE.Raycaster(p.applyMatrix4(model.matrixWorld),normal.clone().negate().applyQuaternion(model.quaternion));
   const structural=ray.intersectObjects(wall)[0],pane=ray.intersectObjects(glass)[0];
   assert.ok(structural&&pane,'Every pane corner must have structural support immediately behind it');
   const gap=structural.distance-pane.distance;assert.ok(gap>.05&&gap<.15,`Window at ${opening.x},${opening.z} floats ${gap}m off its wall`);
  }
 }
 assert.ok(steppedWest>=6,'Windows must follow the recessed west wall');
});

test('restrained warm night lighting uses only three bounded lights and returns to daylight',()=>{
 const model=buildRave(()=>0),lights:THREE.PointLight[]=[];model.traverse(c=>{if(c instanceof THREE.PointLight)lights.push(c);});assert.equal(lights.length,3);
 const get=(k:string)=>(model.children.find(c=>c.userData.part===k) as THREE.Mesh).material as THREE.MeshStandardMaterial;
 model.userData.setLightingMode('night');for(const light of lights){assert.equal(light.castShadow,false);assert.ok(light.intensity>80);assert.ok(light.distance<=20);}
 assert.ok(get('litGlass').emissiveIntensity>.2);assert.ok(get('warm').emissiveIntensity>1);assert.equal(get('glass').emissiveIntensity,1);
 model.userData.setLightingMode('sunset');assert.ok(get('litGlass').emissiveIntensity>0&&get('litGlass').emissiveIntensity<.2);
 model.userData.setLightingMode('day');for(const key of ['litGlass','warm','entryGlass','letter'])assert.equal(get(key).emissiveIntensity,0);for(const light of lights){assert.equal(light.intensity,0);assert.equal(light.visible,false);}
});

function realScene(){
 const read=(path:string)=>{const b=readFileSync(new URL(path,import.meta.url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};
 const tb=read('../public/data/terrain.bin'),tv=new DataView(tb),nx=tv.getUint32(4,true),ny=tv.getUint32(8,true);
 const terrain={nx,ny,x0:tv.getFloat32(12,true),y0:tv.getFloat32(16,true),step:tv.getFloat32(20,true),heights:new Float32Array(tb.slice(24,24+nx*ny*4)),colors:new Uint8Array(tb.slice(24+nx*ny*4))};
 const bytes=read('../public/data/tiles/t_-2_0.bin'),view=new DataView(bytes),tile=new THREE.Group();let offset=12;
 for(let section=0;section<view.getUint32(8,true);section++){
  const name=String.fromCharCode(...new Uint8Array(bytes,offset,4)).trim(),count=view.getUint32(offset+4,true);offset+=8;const origin=[0,4,8].map(k=>view.getFloat32(offset+k,true)),scale=view.getFloat32(offset+12,true);offset+=16;
  const positions=new Float32Array(count*3);for(let i=0;i<count*3;i++)positions[i]=view.getInt16(offset+i*2,true)*scale+origin[i%3];offset=Math.ceil((offset+count*6)/4)*4;offset=Math.ceil((offset+count*3)/4)*4;
  if(['ROAD','BLDG'].includes(name)){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.name=name;tile.add(mesh);}
 }
 assert.ok(removeRavePlaceholder(tile,{i:-2,j:0})>0);
 const ground=(x:number,z:number)=>bilinearTerrainHeight(terrain,x,z),model=buildRave(ground),tiles=new THREE.Group(),environment=new THREE.Group();tiles.add(tile);environment.add(tiles,model);
 const geometry=new THREE.PlaneGeometry(140,160,70,80);geometry.rotateX(-Math.PI/2);geometry.translate(site.x,0,-353);const p=geometry.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,ground(p.getX(i),p.getZ(i)));const mesh=new THREE.Mesh(geometry);mesh.name='TERRAIN';environment.add(mesh);environment.updateMatrixWorld(true);return{model,tiles,environment,ground};
}

test('shipped high Wisconsin terrain and ROAD allow walking down the forecourt to all portal doors',()=>{
 const {model,tiles,environment}=realScene(),world=createWalkingWorld(tiles,environment),point=(x:number,z:number)=>new THREE.Vector3(x,0,z).applyMatrix4(model.matrixWorld);
 assert.ok(Math.abs(model.position.y-38.8)<.01);assert.ok(model.userData.entrance.roadCorrection>.3);
 const roads:THREE.Mesh[]=[];tiles.traverse(c=>{if(c instanceof THREE.Mesh&&c.name==='ROAD')roads.push(c);});const street=new THREE.Raycaster(new THREE.Vector3(-3117,60,-395.2),new THREE.Vector3(0,-1,0)).intersectObjects(roads)[0];assert.ok(street);assert.ok(street.point.y-model.position.y>.8);
 for(const x of model.userData.entrance.centers){
  const start=point(x,-74),spawn=world.findSpawn(start.x,start.z);assert.ok(spawn);assert.ok(Math.hypot(start.x-spawn.x,start.z-spawn.z)<.05);
  const end=point(x+.68,model.userData.entrance.doorZ-.59),result=world.resolve(spawn,{x:end.x,y:model.position.y,z:end.z});
  assert.equal(result.blocked,false,JSON.stringify({x,spawn,result,end:end.toArray()}));assert.ok(Math.hypot(result.x-end.x,result.z-end.z)<.03);assert.ok(Math.abs(result.y-model.position.y)<.09);
 }
 // The rear foundation physically reaches the much lower terrain.
 const side=model.children.find(c=>c.userData.part==='side') as THREE.Mesh,p=side.geometry.getAttribute('position');let low=Infinity;for(let i=0;i<p.count;i++)if(p.getZ(i)>25)low=Math.min(low,p.getY(i)+model.position.y);assert.ok(low<36);
});
