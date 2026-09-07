import * as THREE from 'three';
import type { City } from './scene';
import { buildWienermobile } from './wienermobile';
import { createDriveState, stepDrive, type DriveInput, type DriveState } from './drivingPhysics';
import { createDrivingWorld } from './drivingWorld';
import { driveCameraPose } from './drivingCamera';
import { DrivingTour } from './drivingTour';
import { CAR_TOURS } from './drivingRoutes';

type Options = { city: City; canvas: HTMLCanvasElement; onEnter(): void; onExit(): void; prefetch(x:number,z:number): void };
const driveKeys = new Set(['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyC','KeyV','KeyR','Escape']);

/** Owns input and camera only while driving. City/tour navigation is restored on exit. */
export function createDrivingMode({city,canvas,onEnter,onExit,prefetch}: Options) {
  const vehicle=buildWienermobile(); vehicle.visible=false; city.scene.add(vehicle);
  const headlamps=[-1,1].map(side=>{
    const light=new THREE.SpotLight(0xffedc9,0,35,.48,.65,2);
    light.position.set(side*.82,1.3,-4.02);light.target.position.set(side*.82,.2,-19);
    vehicle.add(light,light.target);return light;
  });
  const world=createDrivingWorld(city.tiles,city.city);
  const hud=document.querySelector<HTMLElement>('#drive-hud')!;
  const speed=document.querySelector<HTMLElement>('#drive-speed')!;
  const distance=document.querySelector<HTMLElement>('#drive-distance')!;
  const status=document.querySelector<HTMLElement>('#drive-status')!;
  const startButton=document.querySelector<HTMLButtonElement>('#drive-start')!;
  const routeSelect=document.querySelector<HTMLSelectElement>('#drive-route')!;
  const tourStart=document.querySelector<HTMLButtonElement>('#drive-tour-start')!;
  const tourPause=document.querySelector<HTMLButtonElement>('#drive-tour-pause')!;
  const tourManual=document.querySelector<HTMLButtonElement>('#drive-tour-manual')!;
  const tourRate=document.querySelector<HTMLSelectElement>('#drive-tour-speed')!;
  const tourInfo=document.querySelector<HTMLElement>('#drive-tour-info')!;
  for(const route of CAR_TOURS){const option=document.createElement('option');option.value=route.id;option.textContent=route.name;routeSelect.append(option);}
  let tour:DrivingTour|undefined,pendingTour:string|undefined;
  const keys=new Set<string>(), held=new Map<number,string>();
  const listeners: (()=>void)[]=[];
  let active=false, suspended=false, state:DriveState|undefined, spawn:DriveState|undefined;
  let previous:{position:THREE.Vector3;target:THREE.Vector3;near:number;fov:number;exaggeration:number}|undefined;
  let gamepadLooking=false;
  let orbit=0, pitch=0, drag:{id:number;x:number;y:number}|undefined, lastStream=0;
  const followTarget=new THREE.Vector3(), desiredCamera=new THREE.Vector3();
  function listen(target:EventTarget,type:string,fn:EventListener,options?:AddEventListenerOptions) {
    target.addEventListener(type,fn,options); listeners.push(()=>target.removeEventListener(type,fn,options));
  }
  function clearInput() { keys.clear(); held.clear(); drag=undefined; }
  function setStatus(message:string) { if(status.textContent!==message)status.textContent=message; }
  function setText(element:HTMLElement,text:string){if(element.textContent!==text)element.textContent=text;}
  function syncTour(){
    tourPause.disabled=!tour||tour.status==='complete';tourManual.disabled=!tour&&!pendingTour;
    setText(tourPause,!tour||tour.status==='playing'?'Pause':'Resume');
    setText(tourStart,pendingTour?'Loading streets…':'Start drive');tourStart.disabled=!!pendingTour;
    const selected=CAR_TOURS.find(route=>route.id===routeSelect.value);
    setText(tourInfo,tour?`${tour.route.name} · ${Math.round(tour.distance/tour.length*100)}% · ${tour.status==='blocked'?'Route blocked — take the wheel or retry':tour.status}`:selected?.description??'');
  }
  function takeWheel(){tour=undefined;pendingTour=undefined;if(state)state.speed=0;syncTour();}
  function beginTour(){
    const route=CAR_TOURS.find(route=>route.id===pendingTour);if(!route||!state)return;
    const nextTour=new DrivingTour(route),pose=nextTour.pose(0);
    const y=world.sampleRoad(pose.x,pose.z);
    if(y===undefined)return;
    const next=createDriveState(pose.x,y,pose.z,pose.yaw);
    if(world.resolve(next,next).blocked){pendingTour=undefined;syncTour();tourInfo.textContent='Route start unavailable · choose another drive';return;}
    state=next;spawn={...next};tour=nextTour;pendingTour=undefined;clearInput();suspended=false;orbit=0;pitch=0;
    vehicle.position.set(state.x,state.y,state.z);vehicle.rotation.y=state.yaw;updateCamera(0,true);syncTour();
  }
  function reset() {
    takeWheel();
    if(!active||!spawn)return;
    // The checkpoint tile may have streamed out during a long drive.
    prefetch(spawn.x,spawn.z);
    state={...spawn}; clearInput(); orbit=0; pitch=0; suspended=false;
    vehicle.position.set(state.x,state.y,state.z); vehicle.rotation.set(0,state.yaw,0);
    setStatus('Back on the road'); updateCamera(0,true);
  }
  function updateCamera(dt:number,snap=false) {
    if(!state)return;
    if(!drag&&!gamepadLooking&&!keys.has('KeyC'))orbit*=Math.exp(-2*dt);
    const pose=driveCameraPose(state,orbit,pitch,keys.has('KeyC'));
    followTarget.set(...pose.target);
    desiredCamera.set(...pose.eye);
    const safe=world.cameraPosition(followTarget,desiredCamera);
    // Obstruction shortening is immediate; releasing the camera back is damped.
    if(snap||safe.distanceTo(followTarget)<city.camera.position.distanceTo(followTarget)-2)city.camera.position.copy(safe);
    else city.camera.position.lerp(safe,1-Math.exp(-6*dt));
    city.controls.target.set(...pose.lookAt); city.camera.lookAt(...pose.lookAt);
  }
  function start() {
    if(active)return;
    const target=city.controls.target;
    const savedExaggeration=city.exaggeration;
    city.setExaggeration(1);city.scene.updateMatrixWorld(true);
    const point=world.findSpawn(target.x,target.z)??world.findSpawn(0,0);
    if(!point) { city.setExaggeration(savedExaggeration); startButton.textContent='Roads loading · try again'; prefetch(0,0); return; }
    previous={position:city.camera.position.clone(),target:target.clone(),near:city.camera.near,fov:city.camera.fov,exaggeration:savedExaggeration};
    onEnter(); city.setExaggeration(1); city.scene.updateMatrixWorld(true);
    // Resample after removing height exaggeration: driving always uses real metres.
    const roadY=world.sampleRoad(point.x,point.z);
    state=createDriveState(point.x,roadY??point.y,point.z,point.yaw); spawn={...state};
    active=true; suspended=false; vehicle.visible=true; hud.hidden=false;
    document.body.classList.add('driving'); city.controls.enabled=false;
    city.camera.near=.15;city.camera.fov=58;city.camera.updateProjectionMatrix();
    canvas.setAttribute('aria-label','Drive the Wienermobile through Milwaukee');
    canvas.setAttribute('aria-describedby','drive-instructions');
    city.resize(); reset(); canvas.focus({preventScroll:true});
    startButton.textContent='Drive the Wienermobile';
  }
  function stop() {
    if(!active)return;
    active=false; takeWheel(); clearInput(); vehicle.visible=false; hud.hidden=true; document.body.classList.remove('driving');
    if(previous) {
      city.setExaggeration(previous.exaggeration); city.camera.position.copy(previous.position); city.controls.target.copy(previous.target);
      city.camera.near=previous.near;city.camera.fov=previous.fov;city.camera.updateProjectionMatrix();
    }
    city.controls.enabled=true; city.controls.update(); city.resize();
    canvas.setAttribute('aria-label','Interactive 3D map of Milwaukee');canvas.setAttribute('aria-describedby','map-navigation-help');
    onExit(); startButton.focus({preventScroll:true});
  }
  syncTour();
  listen(routeSelect,'change',()=>{if(pendingTour)pendingTour=undefined;syncTour();});
  listen(tourStart,'click',()=>{if(!active)return;takeWheel();pendingTour=routeSelect.value;const route=CAR_TOURS.find(r=>r.id===pendingTour);if(route){prefetch(...route.points[0]);syncTour();beginTour();}canvas.focus({preventScroll:true});});
  listen(tourPause,'click',()=>{if(!tour||!state)return;if(tour.status==='playing')tour.pause(state);else{tour.resume();suspended=false;}syncTour();canvas.focus({preventScroll:true});});
  listen(tourManual,'click',()=>{takeWheel();suspended=false;canvas.focus({preventScroll:true});});
  listen(startButton,'click',start);
  listen(document.querySelector('#drive-exit')!,'click',stop);
  listen(document.querySelector('#drive-camera-reset')!,'click',()=>{orbit=0;pitch=0;canvas.focus({preventScroll:true});});
  listen(document.querySelector('#drive-reset')!,'click',()=>{reset();canvas.focus({preventScroll:true});});
  listen(window,'keydown',((event:KeyboardEvent)=>{
    if(!active||!driveKeys.has(event.code))return;
    const target=event.target as HTMLElement;
    if(target.matches('input,textarea,select'))return;
    // Preserve Space/Enter activation of HUD buttons for keyboard users.
    if(event.code==='Space'&&target.closest('button'))return;
    event.preventDefault();event.stopImmediatePropagation();
    if(event.code==='Escape'){stop();return;}
    if(event.code==='KeyR'&&!event.repeat){reset();return;}
    if(event.code==='KeyV'){orbit=0;pitch=0;return;}
    if(event.code==='Space'&&tour&&state){if(!event.repeat){if(tour.status==='playing')tour.pause(state);else{tour.resume();suspended=false;}syncTour();}return;}
    suspended=false; keys.add(event.code);
  }) as EventListener,{capture:true});
  listen(window,'keyup',((event:KeyboardEvent)=>{keys.delete(event.code);}) as EventListener);
  listen(window,'blur',()=>{clearInput();suspended=true;if(state){state.speed=0;tour?.pause(state);}syncTour();});
  listen(document,'visibilitychange',()=>{if(document.hidden){clearInput();suspended=true;if(state){state.speed=0;tour?.pause(state);}syncTour();}});
  listen(canvas,'pointerdown',((event:PointerEvent)=>{
    if(!active||event.button!==0)return;
    suspended=false;drag={id:event.pointerId,x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);
  }) as EventListener);
  listen(canvas,'pointermove',((event:PointerEvent)=>{
    if(!active||drag?.id!==event.pointerId)return;
    orbit-=(event.clientX-drag.x)*.005;pitch=THREE.MathUtils.clamp(pitch-(event.clientY-drag.y)*.006,-.75,1.25);
    drag.x=event.clientX;drag.y=event.clientY;
  }) as EventListener);
  for(const eventName of ['pointerup','pointercancel','lostpointercapture'])listen(canvas,eventName,()=>{drag=undefined;});
  document.querySelectorAll<HTMLButtonElement>('[data-drive]').forEach(button=>{
    listen(button,'pointerdown',((event:PointerEvent)=>{if(!active)return;event.preventDefault();suspended=false;held.set(event.pointerId,button.dataset.drive!);button.setPointerCapture(event.pointerId);}) as EventListener);
    for(const name of ['pointerup','pointercancel','lostpointercapture'])listen(button,name,((event:PointerEvent)=>{held.delete(event.pointerId);}) as EventListener);
  });
  return {get active(){return active;},start,stop,
    update(dt:number) {
      if(!active||!state)return;
      if(pendingTour)beginTour();
      const pressing=(codes:string[],action:string)=>codes.some(code=>keys.has(code))||[...held.values()].includes(action);
      const input:DriveInput={throttle:Number(pressing(['KeyW','ArrowUp'],'forward'))-Number(pressing(['KeyS','ArrowDown'],'reverse')),
        steer:Number(pressing(['KeyD','ArrowRight'],'right'))-Number(pressing(['KeyA','ArrowLeft'],'left')),brake:pressing(['Space'],'brake')};
      gamepadLooking=false;
      const pad=Array.from(navigator.getGamepads?.()??[]).find(p=>p?.connected&&p.mapping==='standard');
      if(pad&&!suspended) {
        const axis=pad.axes[0]??0; if(Math.abs(axis)>.14)input.steer=axis;
        const throttle=(pad.buttons[7]?.value??0)-(pad.buttons[6]?.value??0);if(Math.abs(throttle)>.1)input.throttle=throttle;
        input.brake ||= !!pad.buttons[0]?.pressed;
        const lookX=pad.axes[2]??0,lookY=pad.axes[3]??0;
        gamepadLooking=Math.abs(lookX)>.14||Math.abs(lookY)>.14;
        if(Math.abs(lookX)>.14)orbit-=lookX*Math.min(dt,.1)*2;
        if(Math.abs(lookY)>.14)pitch=THREE.MathUtils.clamp(pitch-lookY*Math.min(dt,.1)*1.5,-.75,1.25);
      }
      if((tour||pendingTour)&&(input.throttle!==0||input.steer!==0||input.brake)){takeWheel();suspended=false;}
      let blocked=false;const before=state.distance;
      if(tour&&!suspended){
        tour.update(state,dt,Number(tourRate.value),world.resolve);
        syncTour();
      }
      else if(!pendingTour&&!suspended&&!tour)stepDrive(state,input,dt,(a,b)=>{const resolved=world.resolve(a,b);blocked ||= resolved.blocked;return resolved;});
      vehicle.position.set(state.x,state.y+.035,state.z);vehicle.rotation.y=state.yaw;
      const forwardHeight=world.sampleRoad(state.x-Math.sin(state.yaw)*2.5,state.z-Math.cos(state.yaw)*2.5,state.y);
      const rearHeight=world.sampleRoad(state.x+Math.sin(state.yaw)*2.5,state.z+Math.cos(state.yaw)*2.5,state.y);
      const tilt=forwardHeight!==undefined&&rearHeight!==undefined?Math.atan2(forwardHeight-rearHeight,5):0;
      vehicle.rotation.x=THREE.MathUtils.clamp(tilt,-.25,.25);
      vehicle.userData.animateWheels((state.distance-before)*Math.sign(state.speed),state.steer);
      vehicle.userData.setMode(city.mode,input.brake||input.throttle<0&&state.speed>0);
      headlamps.forEach(light=>{light.intensity=city.mode==='night'?90:city.mode==='sunset'?35:0;});
      updateCamera(Math.min(dt,.1));
      speed.textContent=String(Math.round(Math.abs(state.speed)*2.23694));
      distance.textContent=`${Math.round(state.distance)} m explored`;
      setStatus(tour?`${tour.route.name} · ${tour.status==='playing'?'Guided drive':tour.status}`:pendingTour?'Loading tour streets…':suspended?'Paused · press a driving control to resume':blocked?'Blocked · hold S / ↓ to reverse · R to reset':state.speed<-.1?'Reverse':Math.abs(state.speed)<.1&&Math.abs(input.steer)>.1?'Hold W / ↑ or S / ↓ while steering':'Milwaukee · free drive');
      lastStream+=dt;if(lastStream>1){
        const pending=CAR_TOURS.find(route=>route.id===pendingTour);
        const ahead=tour?.point(tour.distance+100);
        if(pending)prefetch(...pending.points[0]);else if(ahead)prefetch(ahead.x,ahead.z);else prefetch(state.x,state.z);
        lastStream=0;
      }
    },
    dispose(){stop();listeners.forEach(remove=>remove());vehicle.removeFromParent();vehicle.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}});}
  };
}
