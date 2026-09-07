import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildNewMuseum} from '../src/newMuseum.ts';

// Probe locations follow recognizable authored landmarks, then map into the
// fitted site envelope. Ray directions below are physical street directions.
function sitePoint(m:THREE.Group,x:number,y:number,z:number){
 const t=m.userData.authoredTransform as {center:number[];size:number[];width:number;depth:number;height:number};
 return new THREE.Vector3((-z-t.center[0])*t.width/t.size[0],(y-t.center[1]+t.size[1]/2)*t.height/t.size[1],(x-t.center[2])*t.depth/t.size[2]);
}
function surfaces(m:THREE.Group){return {stone:m.getObjectByName('BLDG')!,glass:m.getObjectByName('new-museum-canyon-scoops-and-slots')!};}
function fromSixth(m:THREE.Group,along:number,height:number){return new THREE.Raycaster(sitePoint(m,along,height,60),new THREE.Vector3(1,0,0));}
function fromNorth(m:THREE.Group,eastward:number,height:number){return new THREE.Raycaster(sitePoint(m,-60,height,eastward),new THREE.Vector3(0,0,1));}

test('future museum is finite, centered at grade, and within its render budget',()=>{
 const museum=buildNewMuseum(),bounds=new THREE.Box3().setFromObject(museum),center=new THREE.Vector3();bounds.getCenter(center);
 assert.ok([bounds.min.x,bounds.min.y,bounds.min.z,bounds.max.x,bounds.max.y,bounds.max.z,...Object.values(museum.userData.dimensions)].every(Number.isFinite));
 museum.traverse(o=>{if(o instanceof THREE.Mesh)assert.ok(Array.from(o.geometry.getAttribute('position').array).every(Number.isFinite),'all mesh vertices are finite');});
 assert.ok(Math.abs(bounds.min.y)<.02);assert.ok(Math.abs(center.x)<.02&&Math.abs(center.z)<.02);assert.ok(museum.userData.triangles<85000);assert.ok(museum.userData.drawCalls<20);
 assert.deepEqual(museum.userData.dimensions,{width:52,depth:60,height:30.48});
});

test('custom dimensions scale the complete rotated museum envelope',()=>{
 const museum=buildNewMuseum({width:82,depth:66,height:40}),bounds=new THREE.Box3().setFromObject(museum),size=new THREE.Vector3();bounds.getSize(size);
 assert.deepEqual(museum.userData.dimensions,{width:82,depth:66,height:40});
 assert.ok(Math.abs(size.x-82)<.02&&Math.abs(size.z-66)<.02&&Math.abs(size.y-40)<.02);
});

test('three principal masses occupy northwest, southwest and northeast with a taller northwest roof',()=>{
 const m=buildNewMuseum(),{stone}=surfaces(m);
 const centers=[sitePoint(m,-19,60,11),sitePoint(m,18,60,11),sitePoint(m,-18,60,-20)];
 assert.ok(centers[0].x<0&&centers[0].z<0,'main bluff is northwest');
 assert.ok(centers[1].x<0&&centers[1].z>0,'short bluff is southwest');
 assert.ok(centers[2].x>0&&centers[2].z<0,'rear bluff is northeast');
 const roofs=centers.map(p=>new THREE.Raycaster(p,new THREE.Vector3(0,-1,0)).intersectObject(stone)[0]);
 assert.ok(roofs.every(Boolean),'each principal mass has a roof');
 assert.ok(roofs[0].point.y>roofs[1].point.y+5&&roofs[0].point.y>roofs[2].point.y+4,'northwest roof dominates both neighboring masses');
 assert.ok(!new THREE.Raycaster(sitePoint(m,18,60,-20),new THREE.Vector3(0,-1,0)).intersectObject(stone)[0],'southeast quadrant stays open instead of becoming a fourth block');
});

test('canyon interior and facade lighting switch off in daylight',()=>{
 const museum=buildNewMuseum(),glow=museum.getObjectByName('new-museum-canyon-interior-light') as THREE.Mesh;
 const lights:THREE.SpotLight[]=[];museum.traverse(o=>{if(o instanceof THREE.SpotLight)lights.push(o);});
 assert.ok(lights.length>0);assert.ok(!glow.visible&&lights.every(l=>l.intensity===0));
 museum.userData.setLightingMode('night');assert.ok(glow.visible&&(glow.material as THREE.MeshBasicMaterial).opacity>0&&lights.every(l=>l.intensity>0));
 museum.userData.setLightingMode('day');assert.ok(!glow.visible&&lights.every(l=>l.intensity===0));
});

test('northwest Commons glazing is open from Sixth Street and the northern garden',()=>{
 const m=buildNewMuseum(),{stone,glass}=surfaces(m);
 for(const ray of [fromSixth(m,-25,2),fromSixth(m,-20,2),fromNorth(m,11,2),fromNorth(m,20,2)]){
  assert.ok(ray.intersectObjects([stone,glass])[0]?.object===glass,'Commons glazing is visible without a stone wall in front');
 }
 for(const ray of [fromSixth(m,-25,8),fromNorth(m,11,8)])assert.ok(ray.intersectObjects([stone,glass])[0]?.object===stone,'stone overhang remains above Commons');
 assert.ok(fromNorth(m,-20,2).intersectObjects([stone,glass])[0]?.object===stone,'rear northeast volume does not inherit a full Commons glass skirt');
});

test('Commons has a level head and one descending closure before the entrance pier',()=>{
 const m=buildNewMuseum(),{stone,glass}=surfaces(m);
 for(const along of [-30,-25,-20]){
  assert.ok(fromSixth(m,along,4.3).intersectObjects([stone,glass])[0]?.object===glass,'level run remains glazed below its soffit');
  assert.ok(fromSixth(m,along,4.9).intersectObjects([stone,glass])[0]?.object===stone,'stone resumes above the level soffit');
 }
 const tops=[-20,-17,-14,-11,-8].map(along=>{
  let low=0,high=5;
  for(let i=0;i<12;i++){
   const y=(low+high)/2;
   if(fromSixth(m,along,y).intersectObjects([stone,glass])[0]?.object===glass)low=y;else high=y;
  }
  return low;
 });
 assert.ok(tops[0]>4.5&&tops.at(-1)!<.1,'glass descends from the level head to grade');
 tops.slice(1).forEach((top,i)=>assert.ok(top<=tops[i]+.01,'closure does not dip and rise'));
 assert.ok(fromSixth(m,-8,2).intersectObjects([stone,glass])[0]?.object===stone,'solid pier separates Commons from entry canyon');
});

test('northwest upper window is recessed and leaves a solid entrance-side pier',()=>{
 const m=buildNewMuseum(),{stone,glass}=surfaces(m),recess=m.getObjectByName('new-museum-real-window-recesses')!;
 const slot=fromSixth(m,-25,17.5),pane=slot.intersectObject(glass)[0],reveal=slot.intersectObject(recess)[0];
 const below=fromSixth(m,-25,15.5).intersectObject(stone)[0],above=fromSixth(m,-25,21).intersectObject(stone)[0];
 assert.ok(pane&&reveal&&below&&above,'window has stone boundaries and an interior reveal');
 assert.ok(pane.point.x>below.point.x+.2&&reveal.point.x>pane.point.x,'window and reveal sit behind the west wall');
 assert.ok(slot.intersectObjects([stone,glass])[0]?.object===glass,'stone is actually cut away at the slot');
 assert.ok(fromSixth(m,-8,17.5).intersectObjects([stone,glass])[0]?.object===stone,'slot ends before the entrance-side pier');
});

test('southwest local window remains recessed with stone beside and above it',()=>{
 const m=buildNewMuseum(),{stone,glass}=surfaces(m);
 const pane=fromSixth(m,25,15.5).intersectObject(glass)[0],above=fromSixth(m,25,17.5).intersectObject(stone)[0];
 assert.ok(pane&&above&&pane.point.x>above.point.x+.2,'localized pane is recessed inside rounded stone');
 assert.ok(fromSixth(m,18,15.5).intersectObjects([stone,glass])[0]?.object===stone,'window does not become a continuous floor belt');
});

test('Sixth Street entry canyon is glazed between two projecting stone lobes',()=>{
 const m=buildNewMuseum(),{stone,glass}=surfaces(m);
 const north=fromSixth(m,-20,10).intersectObject(stone)[0],south=fromSixth(m,18,10).intersectObject(stone)[0];
 const entry=fromSixth(m,0,10).intersectObjects([stone,glass])[0];
 assert.ok(north&&south&&entry?.object===glass,'two west-facing stone lobes flank the glass entrance');
 assert.ok(entry.point.x>north.point.x+1&&entry.point.x>south.point.x+1,'canyon is recessed east of both street faces');
 assert.ok(fromSixth(m,0,2).intersectObjects([stone,glass])[0]?.object===glass,'entrance stays clear at ground level');
});

test('tapered Sixth Street canyon seals both stone edges at sampled heights',()=>{
 const m=buildNewMuseum(),{stone,glass}=surfaces(m);
 const seams=m.userData.canyonSeams as {y:number;left:number;right:number;x:number}[];
 assert.ok(seams[0].right-seams[0].left>seams.at(-1)!.right-seams.at(-1)!.left,'connector widens toward the entrance');
 for(let i=1;i<seams.length-1;i+=4){
  const s=seams[i];
  for(const edge of [s.left,s.right])for(const delta of [-.25,0,.25]){
   const ray=new THREE.Raycaster(new THREE.Vector3(-60,s.y,edge+delta),new THREE.Vector3(1,0,0));
   const hit=ray.intersectObjects([stone,glass])[0];
   assert.ok(hit&&hit.point.x<=s.x+.1,`unsealed west canyon edge at y=${s.y}, z=${edge+delta}`);
  }
 }
});
