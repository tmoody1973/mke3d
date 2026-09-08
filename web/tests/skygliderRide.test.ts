import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildSkyglider,createSkygliderRoute} from '../src/skyglider.ts';
import {skygliderSeatView} from '../src/skygliderRide.ts';

test('seat eye follows the same animated chair matrix, including changing cable height',()=>{
 const model=buildSkyglider((x,z)=>z*.002);
 const mesh=model.getObjectByName('skyglider-chair-shells') as THREE.InstancedMesh;
 for(let step=0;step<100;step++){
  model.userData.update(.5);
  for(const index of [0,23,47,70,93]){
   const view=skygliderSeatView(model.userData.getChairPose(index));
   const matrix=new THREE.Matrix4();mesh.getMatrixAt(index,matrix);
   const expected=new THREE.Vector3(-.28,-2.45,.04).applyMatrix4(matrix);
   assert.ok(view.eye.distanceTo(expected)<.0001);
   const facing=new THREE.Vector3(0,0,1).transformDirection(matrix);
   assert.ok(view.target.clone().sub(view.eye).normalize().distanceTo(facing)<.00001);
  }
 }
 model.userData.dispose();
});
test('seat remains continuous through both terminal turns and the loop seam',()=>{
 const route=createSkygliderRoute(()=>0);
 let previous=skygliderSeatView(route.sample(-.01));
 for(let distance=0;distance<route.totalLength;distance+=.1){
  const view=skygliderSeatView(route.sample(distance));
  assert.ok(view.eye.distanceTo(previous.eye)<.14);
  assert.ok(view.target.clone().sub(view.eye).normalize().angleTo(previous.target.clone().sub(previous.eye).normalize())<.1);
  previous=view;
 }
});
test('looking around changes the view without moving the rider from the seat',()=>{
 const pose={x:12,y:15,z:34,yaw:1.3};
 const forward=skygliderSeatView(pose),look=skygliderSeatView(pose,1,.5);
 assert.equal(forward.eye.distanceTo(look.eye),0);
 assert.ok(Math.abs(look.target.distanceTo(look.eye)-20)<1e-9);
 assert.ok(look.target.y>look.eye.y);
});

test('ride exits restore camera, controls, exaggeration and accessible canvas state',async()=>{
 const {createSkygliderRide}=await import('../src/skygliderRide.ts');
 class Element extends EventTarget {
  classList={values:new Set<string>(),add(value:string){this.values.add(value);},remove(value:string){this.values.delete(value);},contains(value:string){return this.values.has(value);}};value='';style={cssText:''};hidden=false;id='';innerHTML='';textContent='';attrs=new Map<string,string>();children=new Map<string,Element>();removed=false;
  setAttribute(k:string,v:string){this.attrs.set(k,v);}getAttribute(k:string){return this.attrs.get(k)??null;}removeAttribute(k:string){this.attrs.delete(k);}
  querySelector(key:string){if(!this.children.has(key))this.children.set(key,new Element());return this.children.get(key)!;}
  focus(){}append(){}remove(){this.removed=true;}hasPointerCapture(){return false;}releasePointerCapture(){}
 }
 const original={document:globalThis.document,window:globalThis.window,HTMLElement:globalThis.HTMLElement};
 const canvas=new Element(),focus=new Element(),body=new Element();let hud:Element;
 Object.assign(globalThis,{document:{body,activeElement:focus,createElement(){hud=new Element();return hud;}},window:new EventTarget(),HTMLElement:Element});
 const model=new THREE.Group();model.add(buildSkyglider(()=>0));
 const camera=new THREE.PerspectiveCamera(53,1,.7,10000);camera.position.set(12,40,90);
 const target=new THREE.Vector3(3,4,5);camera.lookAt(target);const quaternion=camera.quaternion.clone();
 const controls={target:target.clone(),enabled:true};const city={camera,controls,mode:'day',resize(){},exaggeration:2,setExaggeration(n:number){this.exaggeration=n;}};
 canvas.setAttribute('aria-label','Map');canvas.setAttribute('aria-describedby','help');let enters=0,exits=0,paused=false;
 try{
  const ride=createSkygliderRide({city:city as never,canvas:canvas as never,model,onEnter(){enters++;},onExit(){exits++;},getMotionPaused:()=>paused,setMotionPaused(value){paused=value;},setLighting(mode){city.mode=mode;}});
  ride.start();ride.start();assert.equal(enters,1);assert.equal(ride.active,true);assert.equal(body.classList.contains('skyglider-riding'),true);assert.equal(controls.enabled,false);assert.equal(city.exaggeration,1);assert.equal(camera.near,.03);
  hud!.querySelector('select').value='night';hud!.querySelector('select').dispatchEvent(new Event('change'));assert.equal(city.mode,'night');
  hud!.querySelector('[data-motion]').dispatchEvent(new Event('click'));assert.equal(paused,true);
  model.children[0].userData.update(.5,paused);const eye=camera.position.clone();ride.update();assert.equal(camera.position.distanceTo(eye),0);
  ride.stop();ride.stop();assert.equal(exits,1);assert.equal(body.classList.contains('skyglider-riding'),false);assert.equal(ride.active,false);assert.equal(controls.enabled,true);assert.equal(city.exaggeration,2);assert.equal(camera.near,.7);assert.equal(camera.fov,53);assert.deepEqual(camera.position.toArray(),[12,40,90]);assert.ok(camera.quaternion.angleTo(quaternion)<1e-7);assert.ok(controls.target.equals(target));assert.equal(canvas.getAttribute('aria-label'),'Map');assert.equal(canvas.getAttribute('aria-describedby'),'help');
  ride.start();ride.dispose();assert.equal(ride.active,false);assert.equal(hud!.removed,true);assert.equal(exits,2);
 }finally{model.children[0].userData.dispose();Object.assign(globalThis,original);}
});
