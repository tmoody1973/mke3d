import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildNewMuseum} from '../src/newMuseum.ts';

// Probe locations follow recognizable authored landmarks, then map into the
// fitted site envelope. Ray directions below are physical street directions.
function sitePoint(m:THREE.Group,x:number,y:number,z:number){
 const t=m.userData.authoredTransform as {center:number[];size:number[];width:number;depth:number;height:number};
 return new THREE.Vector3((x-t.center[0])*t.width/t.size[0],(y-t.center[1]+t.size[1]/2)*t.height/t.size[1],(z-t.center[2])*t.depth/t.size[2]);
}
function surfaces(m:THREE.Group){return {stone:m.getObjectByName('BLDG')!,glass:m.getObjectByName('new-museum-canyon-scoops-and-slots')!};}
function fromSouth(m:THREE.Group,x:number,y:number){return new THREE.Raycaster(sitePoint(m,x,y,60),new THREE.Vector3(0,0,-1));}
function fromSixth(m:THREE.Group,z:number,y:number){return new THREE.Raycaster(sitePoint(m,-60,y,z),new THREE.Vector3(1,0,0));}

test('future museum is finite, centered at grade, and within its render budget',()=>{
 const museum=buildNewMuseum(),bounds=new THREE.Box3().setFromObject(museum),center=new THREE.Vector3();bounds.getCenter(center);
 assert.ok([bounds.min.x,bounds.min.y,bounds.min.z,bounds.max.x,bounds.max.y,bounds.max.z,...Object.values(museum.userData.dimensions)].every(Number.isFinite));
 museum.traverse(o=>{if(o instanceof THREE.Mesh)assert.ok(Array.from(o.geometry.getAttribute('position').array).every(Number.isFinite),'all mesh vertices are finite');});
 assert.ok(Math.abs(bounds.min.y)<.02);assert.ok(Math.abs(center.x)<.02&&Math.abs(center.z)<.02);assert.ok(museum.userData.triangles<85000);assert.ok(museum.userData.drawCalls<20);
 assert.deepEqual(museum.userData.dimensions,{width:52,depth:60,height:30.48});
});

test('custom dimensions scale the complete museum envelope',()=>{
 const museum=buildNewMuseum({width:82,depth:66,height:40}),bounds=new THREE.Box3().setFromObject(museum),size=new THREE.Vector3();bounds.getSize(size);
 assert.deepEqual(museum.userData.dimensions,{width:82,depth:66,height:40});
 assert.ok(Math.abs(size.x-82)<.02&&Math.abs(size.z-66)<.02&&Math.abs(size.y-40)<.02);
});

test('three principal masses occupy southwest, southeast and northwest with a taller southwest roof',()=>{
 const m=buildNewMuseum(),{stone}=surfaces(m);
 const centers=[sitePoint(m,-19,60,11),sitePoint(m,18,60,11),sitePoint(m,-18,60,-20)];
 assert.ok(centers[0].x<0&&centers[0].z>0,'main bluff is southwest');
 assert.ok(centers[1].x>0&&centers[1].z>0,'short bluff is southeast');
 assert.ok(centers[2].x<0&&centers[2].z<0,'rear bluff is northwest');
 const roofs=centers.map(p=>new THREE.Raycaster(p,new THREE.Vector3(0,-1,0)).intersectObject(stone)[0]);
 assert.ok(roofs.every(Boolean),'each principal mass has a roof');
 assert.ok(roofs[0].point.y>roofs[1].point.y+5&&roofs[0].point.y>roofs[2].point.y+4,'southwest roof dominates both neighboring masses');
 assert.ok(new THREE.Raycaster(sitePoint(m,18,60,-20),new THREE.Vector3(0,-1,0)).intersectObject(stone)[0],'connected eastern wing occupies the northeast floor area shown in the site plan');
});

test('canyon interior and facade lighting switch off in daylight',()=>{
 const museum=buildNewMuseum(),glow=museum.getObjectByName('new-museum-canyon-interior-light') as THREE.Mesh;
 const lights:THREE.SpotLight[]=[];museum.traverse(o=>{if(o instanceof THREE.SpotLight)lights.push(o);});
 assert.ok(lights.length>0);assert.ok(!glow.visible&&lights.every(l=>l.intensity===0));
 museum.userData.setLightingMode('night');assert.ok(glow.visible&&(glow.material as THREE.MeshBasicMaterial).opacity>0&&lights.every(l=>l.intensity>0));
 museum.userData.setLightingMode('day');assert.ok(!glow.visible&&lights.every(l=>l.intensity===0));
});

// The supplied south elevation is the authority for these regression probes.
// +Z faces McKinley; -X faces Sixth Street, independently of camera labels.
test('McKinley entrance is between the tall western and lower eastern masses',()=>{
 const m=buildNewMuseum(),{stone,glass}=surfaces(m);
 const west=fromSouth(m,-19,10).intersectObject(stone)[0],east=fromSouth(m,18,10).intersectObject(stone)[0];
 const entry=fromSouth(m,0,10).intersectObjects([stone,glass])[0];
 assert.ok(west&&east&&entry?.object===glass,'south stone masses flank the glass entrance');
 assert.ok(entry.point.z<west.point.z-1&&entry.point.z<east.point.z-1,'entry is recessed');
 assert.ok(fromSouth(m,0,2).intersectObjects([stone,glass])[0]?.object===glass);
});

test('McKinley blue opening belongs to the left mass with a separate right glass scoop',()=>{
 const m=buildNewMuseum(),{stone,glass}=surfaces(m),blue=m.getObjectByName('new-museum-blue-entry-installation')!;
 assert.ok(fromSouth(m,-23,2).intersectObjects([stone,glass,blue])[0]?.object===blue,'blue installation in western mass');
 assert.ok(fromSouth(m,27,2).intersectObjects([stone,glass])[0]?.object===glass,'localized eastern ground scoop');
 assert.ok(fromSouth(m,15,2).intersectObjects([stone,glass])[0]?.object===stone,'solid right pier beside entrance');
 assert.ok(fromSixth(m,17,2).intersectObjects([stone,glass,blue])[0]?.object===stone,'Sixth pier separates cafeteria and blue installation');
});

test('McKinley asymmetric slots sit at separate heights',()=>{
 const m=buildNewMuseum(),{stone,glass}=surfaces(m);
 for(const [x,y] of [[-28,23],[-18,6.6],[-11,10.6],[25,15.5],[18,21.3],[21,24.3]]){
  assert.ok(fromSouth(m,x,y).intersectObjects([stone,glass])[0]?.object===glass,`south slot at ${x}, ${y}`);
 }
 assert.ok(fromSouth(m,-19,18).intersectObjects([stone,glass])[0]?.object===stone);
 assert.ok(fromSouth(m,12,15.5).intersectObjects([stone,glass])[0]?.object===stone);
});

test('Sixth Street cafeteria closes once before McKinley corner',()=>{
 const m=buildNewMuseum(),{stone,glass}=surfaces(m);
 for(const z of [-2,0,2]){
  assert.ok(fromSixth(m,z,5.2).intersectObjects([stone,glass])[0]?.object===glass,'level cafeteria head');
  assert.ok(fromSixth(m,z,6.1).intersectObjects([stone,glass])[0]?.object===stone,'stone soffit');
 }
 const tops=[2,4,6,8,10,13].map(z=>{
  let low=0,high=6;
  for(let i=0;i<12;i++){const y=(low+high)/2;if(fromSixth(m,z,y).intersectObjects([stone,glass])[0]?.object===glass)low=y;else high=y;}
  return low;
 });
 assert.ok(tops[0]>5.5&&tops.at(-1)!<.1);
 tops.slice(1).forEach((top,i)=>assert.ok(top<=tops[i]+.01,'no dip-and-rise arc'));
 for(const z of [14,17,20])assert.ok(fromSixth(m,z,2).intersectObjects([stone,glass])[0]?.object===stone);
});

test('west gallery window is recessed and leaves southwest pier solid',()=>{
 const m=buildNewMuseum(),{stone,glass}=surfaces(m),recess=m.getObjectByName('new-museum-real-window-recesses')!;
 const ray=fromSixth(m,3,17.5),pane=ray.intersectObject(glass)[0],reveal=ray.intersectObject(recess)[0],below=fromSixth(m,3,15).intersectObject(stone)[0];
 assert.ok(pane&&reveal&&below&&ray.intersectObjects([stone,glass])[0]?.object===glass);
 assert.ok(pane.point.x>below.point.x+.2&&reveal.point.x>pane.point.x);
 assert.ok(fromSixth(m,20,17.5).intersectObjects([stone,glass])[0]?.object===stone);
});

test('McKinley canyon seals both stone edges at sampled heights',()=>{
 const m=buildNewMuseum(),{stone,glass}=surfaces(m);
 const seams=m.userData.canyonSeams as {y:number;left:number;right:number;z:number}[];
 assert.ok(seams[0].right-seams[0].left>seams.at(-1)!.right-seams.at(-1)!.left);
 for(let i=1;i<seams.length-1;i+=4){const s=seams[i];
  for(const edge of [s.left,s.right])for(const delta of [-.25,0,.25]){
   const hit=new THREE.Raycaster(new THREE.Vector3(edge+delta,s.y,60),new THREE.Vector3(0,0,-1)).intersectObjects([stone,glass])[0];
   assert.ok(hit&&hit.point.z>=s.z-.1,`unsealed south edge y=${s.y}, x=${edge+delta}`);
  }
 }
});
