import * as THREE from 'three';
import type { City, Mode } from './scene';
import { createWalkingWorld } from './walkingWorld';

type Place={id:string;name:string;x:number;z:number;lookX:number;lookZ:number};
type Options={city:City;canvas:HTMLCanvasElement;places:Place[];prefetch(x:number,z:number):void;onEnter():void;onExit():void;setLighting(mode:Mode):void};
type Position={x:number;y:number;z:number};
const movementKeys=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageUp','PageDown','ShiftLeft','ShiftRight','KeyR','KeyV','Escape']);

/** Pedestrian camera ownership is exclusive; leaving restores the previous map pose. */
export function createWalkingMode({city,canvas,places,prefetch,onEnter,onExit,setLighting}:Options){
 const world=createWalkingWorld(city.tiles,city.city);
 const element=<T extends HTMLElement>(id:string)=>document.querySelector<T>(`#${id}`)!;
 const hud=element('walk-hud'),startButton=element<HTMLButtonElement>('walk-start');
 const district=element<HTMLSelectElement>('walk-district'),speed=element<HTMLSelectElement>('walk-speed'),lighting=element<HTMLSelectElement>('walk-lighting');
 const status=element('walk-status'),distanceLabel=element('walk-distance');
 for(const p of places){const option=document.createElement('option');option.value=p.id;option.textContent=p.name;district.append(option);}
 let active=false,position:Position|undefined,checkpoint:Position|undefined,checkpointYaw=0;
 let yaw=0,pitch=0,distance=0,streamElapsed=0,spawnElapsed=0,retryElapsed=0;
 let pending:{x:number;z:number;lookX:number;lookZ:number}|undefined;
 let previous:{eye:THREE.Vector3;target:THREE.Vector3;near:number;fov:number;exaggeration:number}|undefined;
 let currentPlace:{x:number;z:number;lookX:number;lookZ:number};
 const keys=new Set<string>(),held=new Map<number,string>(),removeListeners:(()=>void)[]=[];
 let drag:{id:number;x:number;y:number}|undefined;
 function listen(target:EventTarget,type:string,fn:EventListener,options?:AddEventListenerOptions){target.addEventListener(type,fn,options);removeListeners.push(()=>target.removeEventListener(type,fn,options));}
 function text(message:string){if(status.textContent!==message)status.textContent=message;}
 function clearInput(){keys.clear();held.clear();drag=undefined;}
 function camera(){
  if(!position)return;
  city.camera.position.set(position.x,position.y+1.7,position.z);
  city.controls.target.copy(city.camera.position).add(new THREE.Vector3(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch)).multiplyScalar(20));
  city.camera.lookAt(city.controls.target);
 }
 function trySpawn(){
  if(!pending)return;
  const point=world.findSpawn(pending.x,pending.z);
  if(!point)return;
  position=point;checkpoint={...point};
  const dx=pending.lookX-point.x,dz=pending.lookZ-point.z;
  yaw=Math.hypot(dx,dz)>2?Math.atan2(-dx,-dz):yaw;checkpointYaw=yaw;
  pitch=.08;pending=undefined;distance=0;distanceLabel.textContent='0 m explored';
  camera();text('On foot · drag to look around and up');
 }
 function requestPlace(){
  clearInput();pending=places.find(p=>p.id===district.value)??currentPlace;
  position=undefined;checkpoint=undefined;spawnElapsed=0;retryElapsed=0;
  prefetch(pending.x,pending.z);text('Loading a place to walk…');trySpawn();
 }
 function start(){
  if(active)return;
  onEnter();
  previous={eye:city.camera.position.clone(),target:city.controls.target.clone(),near:city.camera.near,fov:city.camera.fov,exaggeration:city.exaggeration};
  const target=city.controls.target;
  currentPlace={x:target.x,z:target.z,lookX:target.x,lookZ:target.z};
  const direction=target.clone().sub(city.camera.position);yaw=Math.atan2(-direction.x,-direction.z);
  active=true;city.setExaggeration(1);city.scene.updateMatrixWorld(true);city.controls.enabled=false;
  city.camera.near=.08;city.camera.fov=72;city.camera.updateProjectionMatrix();
  document.body.classList.add('walking');hud.hidden=false;lighting.value=city.mode;
  canvas.setAttribute('aria-label','Walk around Milwaukee at street level');canvas.setAttribute('aria-describedby','walk-instructions');
  city.resize();requestPlace();canvas.focus({preventScroll:true});
 }
 function stop(){
  if(!active)return;
  active=false;pending=undefined;clearInput();hud.hidden=true;document.body.classList.remove('walking');
  if(previous){city.setExaggeration(previous.exaggeration);city.camera.position.copy(previous.eye);city.controls.target.copy(previous.target);city.camera.near=previous.near;city.camera.fov=previous.fov;city.camera.updateProjectionMatrix();}
  city.controls.enabled=true;city.controls.update();city.resize();
  canvas.setAttribute('aria-label','Interactive 3D map of Milwaukee');canvas.setAttribute('aria-describedby','map-navigation-help');
  onExit();startButton.focus({preventScroll:true});
 }
 function reset(){
  clearInput();
  if(checkpoint){position={...checkpoint};yaw=checkpointYaw;pitch=.08;prefetch(position.x,position.z);camera();text('Returned to your starting point');}
  else requestPlace();
 }
 listen(startButton,'click',start);listen(element('walk-exit'),'click',stop);
 listen(element('walk-reset'),'click',()=>{reset();canvas.focus({preventScroll:true});});
 listen(element('walk-level'),'click',()=>{pitch=0;camera();canvas.focus({preventScroll:true});});
 listen(district,'change',()=>{requestPlace();canvas.focus({preventScroll:true});});
 listen(lighting,'change',()=>setLighting(lighting.value as Mode));
 listen(speed,'change',()=>{clearInput();canvas.focus({preventScroll:true});});
 listen(window,'keydown',((e:KeyboardEvent)=>{
  if(!active||!movementKeys.has(e.code)||(e.target as HTMLElement).matches('input,textarea,select'))return;
  e.preventDefault();e.stopImmediatePropagation();
  if(e.code==='Escape'){stop();return;}
  if(e.code==='KeyR'){if(!e.repeat)reset();return;}
  if(e.code==='KeyV'){pitch=0;camera();return;}
  keys.add(e.code);
 }) as EventListener,{capture:true});
 listen(window,'keyup',((e:KeyboardEvent)=>{keys.delete(e.code);}) as EventListener);
 listen(window,'blur',clearInput);listen(document,'visibilitychange',()=>{if(document.hidden)clearInput();});
 listen(hud,'focusin',clearInput);
 listen(canvas,'wheel',((e:WheelEvent)=>{if(active)e.preventDefault();}) as EventListener,{passive:false});
 listen(canvas,'pointerdown',((e:PointerEvent)=>{if(!active||e.button!==0)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);}) as EventListener);
 listen(canvas,'pointermove',((e:PointerEvent)=>{
  if(!active||drag?.id!==e.pointerId)return;
  yaw-=(e.clientX-drag.x)*.004;pitch=THREE.MathUtils.clamp(pitch-(e.clientY-drag.y)*.004,-1.3,1.48);
  drag.x=e.clientX;drag.y=e.clientY;camera();
 }) as EventListener);
 for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(canvas,type,()=>{drag=undefined;});
 document.querySelectorAll<HTMLButtonElement>('[data-walk]').forEach(button=>{
  listen(button,'keydown',((e:KeyboardEvent)=>{if(active&&(e.code==='Space'||e.code==='Enter')){e.preventDefault();held.set(-1,button.dataset.walk!);}}) as EventListener);
  listen(button,'keyup',((e:KeyboardEvent)=>{if(e.code==='Space'||e.code==='Enter'){e.preventDefault();held.delete(-1);}}) as EventListener);
  listen(button,'blur',()=>held.delete(-1));
  listen(button,'pointerdown',((e:PointerEvent)=>{if(!active)return;e.preventDefault();held.set(e.pointerId,button.dataset.walk!);button.setPointerCapture(e.pointerId);}) as EventListener);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(button,type,((e:PointerEvent)=>{held.delete(e.pointerId);}) as EventListener);
 });
 return {get active(){return active;},start,stop,
  update(elapsed:number){
   if(!active)return;
   const dt=Math.min(elapsed,.05);
   streamElapsed+=elapsed;
   if(streamElapsed>1){const focus=pending??position;if(focus)prefetch(focus.x,focus.z);streamElapsed=0;}
   if(pending){
    spawnElapsed+=elapsed;retryElapsed+=elapsed;
    if(retryElapsed>.75){trySpawn();retryElapsed=0;}
    if(pending&&spawnElapsed>20){pending=undefined;text('No clear ground here yet · choose a district or press R to retry');}
    return;
   }
   if(!position)return;
   const pressing=(code:string,action:string)=>keys.has(code)||[...held.values()].includes(action);
   yaw+=(Number(keys.has('ArrowLeft'))-Number(keys.has('ArrowRight')))*dt*1.5;
   pitch=THREE.MathUtils.clamp(pitch+(Number(keys.has('PageUp'))-Number(keys.has('PageDown')))*dt,-1.3,1.48);
   const forward=Number(pressing('KeyW','forward')||keys.has('ArrowUp'))-Number(pressing('KeyS','back')||keys.has('ArrowDown'));
   const sideways=Number(pressing('KeyD','right'))-Number(pressing('KeyA','left'));
   if(forward||sideways){
    const norm=Math.hypot(forward,sideways),pace=keys.has('ShiftLeft')||keys.has('ShiftRight')?3.2:Number(speed.value);
    const travel=pace*dt/norm;
    const next={x:position.x+(-Math.sin(yaw)*forward+Math.cos(yaw)*sideways)*travel,y:position.y,z:position.z+(-Math.cos(yaw)*forward-Math.sin(yaw)*sideways)*travel};
    const result=world.resolve(position,next);distance+=Math.hypot(result.x-position.x,result.z-position.z);position=result;
    distanceLabel.textContent=`${Math.round(distance)} m explored`;
    text(result.blocked?'Path blocked · step sideways or turn around':'On foot · drag to look around and up');
   }
   camera();
  },
  dispose(){stop();removeListeners.forEach(remove=>remove());}
 };
}
