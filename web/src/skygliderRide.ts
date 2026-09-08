import * as THREE from 'three';
import type {City,Mode} from './scene';
import type {SkygliderSample} from './skyglider';

/** Seat eye is above the white bench, below the canopy, facing chair-local +Z. */
export function skygliderSeatView(pose:SkygliderSample,yaw=0,pitch=0){
 const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),pose.yaw);
 const eye=new THREE.Vector3(-.28,-2.45,.04).applyQuaternion(rotation).add(new THREE.Vector3(pose.x,pose.y,pose.z));
 const direction=new THREE.Vector3(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)).applyQuaternion(rotation);
 return {eye,target:eye.clone().addScaledVector(direction,20)};
}
export function createSkygliderRide({city,canvas,model,onEnter=()=>{},onExit=()=>{},getMotionPaused=()=>false,setMotionPaused=()=>{},setLighting=(mode:Mode)=>city.setMode(mode)}:{city:City;canvas:HTMLCanvasElement;model:THREE.Object3D;onEnter?:()=>void;onExit?:()=>void;getMotionPaused?:()=>boolean;setMotionPaused?:(paused:boolean)=>void;setLighting?:(mode:Mode)=>void}){
 const chair=model.getObjectByName('summerfest-skyglider')!;
 const hud=document.createElement('div');hud.id='skyglider-ride-hud';hud.hidden=true;
 hud.innerHTML='<strong>Riding the Skyglider</strong><p id="skyglider-ride-help">Drag or use arrow keys to look · Esc to exit</p><div class="skyglider-ride-actions"><button type="button" data-exit>Exit Skyglider</button> <button type="button" data-motion>Pause ride</button> <select aria-label="Ride lighting"><option value="day">Day</option><option value="sunset">Sunset</option><option value="night">Night</option></select></div>';document.body.append(hud);
 let active=false,yaw=0,pitch=-.08,index=0,drag:{id:number;x:number;y:number}|undefined;
 let previous:{eye:THREE.Vector3;target:THREE.Vector3;quaternion:THREE.Quaternion;near:number;fov:number;enabled:boolean;exaggeration:number;label:string|null;description:string|null;focus:Element|null}|undefined;
 const listeners:(()=>void)[]=[];
 function listen(target:EventTarget,type:string,fn:EventListener,options?:AddEventListenerOptions){target.addEventListener(type,fn,options);listeners.push(()=>target.removeEventListener(type,fn,options));}
 function clearDrag(){if(drag&&canvas.hasPointerCapture(drag.id))canvas.releasePointerCapture(drag.id);drag=undefined;}
 function update(){if(!active)return;const motion=hud.querySelector<HTMLButtonElement>('[data-motion]')!;motion.textContent=getMotionPaused()?'Resume ride':'Pause ride';motion.setAttribute('aria-pressed',String(getMotionPaused()));hud.querySelector<HTMLSelectElement>('select')!.value=city.mode;const v=skygliderSeatView(chair.userData.getChairPose(index),yaw,pitch);city.camera.position.copy(v.eye);city.controls.target.copy(v.target);city.camera.lookAt(v.target);}
 function start(){
  if(active)return;const returnFocus=document.activeElement;onEnter();
  previous={eye:city.camera.position.clone(),target:city.controls.target.clone(),quaternion:city.camera.quaternion.clone(),near:city.camera.near,fov:city.camera.fov,enabled:city.controls.enabled,exaggeration:city.exaggeration,label:canvas.getAttribute('aria-label'),description:canvas.getAttribute('aria-describedby'),focus:returnFocus};
  // Board the actual northbound/southbound chair closest to the north platform.
  let best=Infinity;for(let i=0;i<chair.userData.stats.chairs;i++){const p=chair.userData.getChairPose(i);const d=Math.hypot(p.x-489.2245,p.z-96.9402);if(d<best){best=d;index=i;}}
  active=true;yaw=0;pitch=-.08;city.setExaggeration(1);city.controls.enabled=false;city.camera.near=.03;city.camera.fov=75;city.camera.updateProjectionMatrix();hud.hidden=false;document.body.classList.add('skyglider-riding');city.resize();
  canvas.setAttribute('aria-label','Seated Skyglider ride');canvas.setAttribute('aria-describedby','skyglider-ride-help');update();canvas.focus({preventScroll:true});
 }
 function stop(){if(!active)return;active=false;clearDrag();hud.hidden=true;document.body.classList.remove('skyglider-riding');city.resize();
  if(previous){city.setExaggeration(previous.exaggeration);city.camera.position.copy(previous.eye);city.controls.target.copy(previous.target);city.camera.quaternion.copy(previous.quaternion);city.camera.near=previous.near;city.camera.fov=previous.fov;city.camera.updateProjectionMatrix();city.controls.enabled=previous.enabled;
   for(const [key,value] of [['aria-label',previous.label],['aria-describedby',previous.description]]){if(value===null)canvas.removeAttribute(key!);else canvas.setAttribute(key!,value!);}
  }onExit();if(previous?.focus instanceof HTMLElement)previous.focus.focus({preventScroll:true});
 }
 listen(hud.querySelector('select')!,'change',event=>{setLighting((event.target as HTMLSelectElement).value as Mode);});
 listen(hud.querySelector('[data-exit]')!,'click',stop);
 listen(hud.querySelector('[data-motion]')!,'click',()=>{setMotionPaused(!getMotionPaused());update();});
 listen(canvas,'pointerdown',((e:PointerEvent)=>{if(!active||e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}) as EventListener);
 listen(canvas,'pointermove',((e:PointerEvent)=>{if(!active||drag?.id!==e.pointerId)return;yaw=THREE.MathUtils.clamp(yaw-(e.clientX-drag.x)*.004,-Math.PI*.95,Math.PI*.95);pitch=THREE.MathUtils.clamp(pitch-(e.clientY-drag.y)*.004,-1.2,.7);drag.x=e.clientX;drag.y=e.clientY;update();}) as EventListener);
 for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(canvas,type,()=>{drag=undefined;});
 listen(window,'blur',clearDrag);
 listen(window,'keydown',((e:KeyboardEvent)=>{if(!active)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();stop();return;}if(e.target!==canvas||!e.key.startsWith('Arrow'))return;e.preventDefault();e.stopImmediatePropagation();yaw=THREE.MathUtils.clamp(yaw+(e.key==='ArrowLeft'?.08:e.key==='ArrowRight'?-.08:0),-Math.PI*.95,Math.PI*.95);pitch=THREE.MathUtils.clamp(pitch+(e.key==='ArrowUp'?.06:e.key==='ArrowDown'?-.06:0),-1.2,.7);update();}) as EventListener,{capture:true});
 return {get active(){return active;},start,stop,update,dispose(){stop();listeners.forEach(remove=>remove());hud.remove();}};
}
