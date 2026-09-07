import test from 'node:test';
import assert from 'node:assert/strict';
import { HopSimulation, sampleHopPath, solveHopPose } from '../src/hopMotion.ts';
import type { HopData, HopPath, HopPoint } from '../src/hopTypes.ts';
function path(points: HopPoint[]): HopPath {
  const distances = [0]; for(let i=1;i<points.length;i++) distances.push(distances[i-1]+Math.hypot(...points[i].map((n,j)=>n-points[i-1][j])));
  return {id:'p',routeId:'M',name:'test',color:'#abc',points,distances,length:distances.at(-1)!};
}
const straight = path([[0,0,0],[0,0,500]]);
function fixture(p=straight): HopData { return {version:1,defaultDate:'20260908',defaultTime:0,paths:[p],stops:[{id:'a',name:'a',position:[0,0,0]},{id:'b',name:'b',position:[0,0,100],platformSide:'left'},{id:'c',name:'c',position:[0,0,200]}],trips:[{id:'t',blockId:'one',routeId:'M',serviceId:'weekday',pathId:'p',stops:[{stopId:'a',arrival:0,departure:0,distance:0},{stopId:'b',arrival:40,departure:40,distance:100},{stopId:'c',arrival:100,departure:100,distance:200}]}],calendars:[{id:'weekday',start:'20260101',end:'20261231',weekdays:[true,true,true,true,true,false,false]}],exceptions:[],provenance:{}}; }
function tick(sim:HopSimulation,seconds:number,fps=60) {for(let i=0;i<seconds*fps;i++)sim.update(1/fps);}
const close=(a:number,b:number,e=1e-5)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
test('distance sampling handles seam, extended visits, slope and degenerate paths',()=>{
  const loop=path([[0,0,0],[10,0,0],[10,0,10],[0,0,10],[0,0,0]]);
  assert.deepEqual(sampleHopPath(loop,45),sampleHopPath(loop,5));
  assert.deepEqual(sampleHopPath(loop,-5),sampleHopPath(loop,35));
  assert.deepEqual(sampleHopPath(path([[1,2,3]]),10).position,[1,2,3]);
});
test('articulation keeps rigid hinge distances and both bogies on curved elevated track',()=>{
  const pts:HopPoint[]=[];for(let i=0;i<=120;i++){const a=i*Math.PI/60;pts.push([20*Math.cos(a),2*Math.sin(a),20*Math.sin(a)]);}pts[120]=[...pts[0]];
  const p=path(pts),pose=solveHopPose(p,30,4);
  for(const [i,j]of [[0,0],[2,1]])close(Math.hypot(...pose.sections[i].position.map((n,k)=>n-pose.hinges[j][k])),3.7,1e-5);
  assert.ok(Math.abs(pose.sections[0].yaw-pose.sections[2].yaw)>.2);
  const flat=solveHopPose(straight,50); close(flat.sections[0].position[2],56.8);close(flat.sections[2].position[2],43.2);
});
test('stops open only at zero speed, close before departure, and use platform side',()=>{
  const sim=new HopSimulation(fixture());let sawDoor=false,sawDepart=false;
  for(let i=0;i<120*60;i++){sim.update(1/60);const car=sim.vehicles[0];if(car.doors>0){assert.equal(car.speed,0);assert.equal(car.phase,'dwell');if(car.nextStopId==='b'){sawDoor=true;assert.equal(car.platformSide,'left');}}if(sawDoor&&car.distance>101&&car.phase==='travel'){sawDepart=true;assert.equal(car.doors,0);}}
  assert.ok(sawDoor);assert.ok(sawDepart);
});
test('30/60 fps agree, pause has no catch-up, reduced motion starts static',()=>{
  const a=new HopSimulation(fixture()),b=new HopSimulation(fixture());tick(a,90,30);tick(b,90,60);close(a.time,b.time);close(a.vehicles[0].distance,b.vehicles[0].distance);
  a.setPlaying(false);const before=a.time;a.update(2000);close(a.time,before);a.setPlaying(true);a.update(1/60);close(a.time,before+1/60);
  const reduced=new HopSimulation(fixture(),{reducedMotion:true});reduced.update(10);assert.equal(reduced.time,0);reduced.setPlaying(true);tick(reduced,2);assert.ok(reduced.time>1);
});
test('stop segment timing seeds partial trip, four active blocks survive and IDs persist through handoff',()=>{
  const data=fixture();data.defaultTime=25;data.trips=Array.from({length:4},(_,i)=>({...data.trips[0],id:`t${i}`,blockId:`b${i}`}));
  const sim=new HopSimulation(data);assert.equal(sim.vehicles.length,4);assert.ok(sim.vehicles[0].distance>0&&sim.vehicles[0].distance<100);
  const one=fixture();one.trips.push({...one.trips[0],id:'second',stops:[{stopId:'c',arrival:125,departure:125,distance:200},{stopId:'d',arrival:175,departure:175,distance:300}]});
  const reuse=new HopSimulation(one);const car=reuse.vehicles[0];tick(reuse,200);assert.equal(reuse.vehicles.length,1);assert.equal(reuse.vehicles[0],car);assert.equal(car.tripId,'second');
});
test('corner speed limited before a tight turn, no backwards movement or acceleration jumps',()=>{
  const data=fixture(path([[0,0,0],[0,0,100],[100,0,100]]));data.trips[0].stops=[{stopId:'a',arrival:0,departure:0,distance:0},{stopId:'c',arrival:30,departure:30,distance:200}];
  const sim=new HopSimulation(data);let prev=0,speed=0,sawTurn=false;
  for(let i=0;i<100*60;i++){sim.update(1/60);const c=sim.vehicles[0];assert.ok(c.distance>=prev);assert.ok(c.speed<=11.001);assert.ok(c.speed-speed<=.8/60+1e-8);if(c.distance>96&&c.distance<104){sawTurn=true;assert.ok(c.speed<=3.1, `corner ${c.distance}, speed ${c.speed}`);}prev=c.distance;speed=c.speed;}
  assert.ok(sawTurn);
});
test('shared-track follower waits behind a dwelling car instead of overlapping it',()=>{
  const data=fixture();data.defaultTime=0;
  data.trips=[{...data.trips[0],id:'lead',blockId:'lead',stops:[{stopId:'a',arrival:0,departure:80,distance:70},{stopId:'c',arrival:180,departure:180,distance:200}]},{...data.trips[0],id:'follow',blockId:'follow',stops:[{stopId:'a',arrival:0,departure:0,distance:0},{stopId:'c',arrival:25,departure:25,distance:200}]}];
  const sim=new HopSimulation(data);
  for(let i=0;i<80*60;i++){sim.update(1/60);const lead=sim.vehicles.find(c=>c.blockId==='lead')!,follow=sim.vehicles.find(c=>c.blockId==='follow')!;assert.ok(lead.distance-follow.distance>=22.39);}
});
test('disconnected block path transition holds at a terminal rather than teleporting',()=>{
  const data=fixture();const other=path([[500,0,0],[500,0,500]]);other.id='other';data.paths.push(other);
  data.trips.push({...data.trips[0],id:'second',pathId:'other',stops:[{stopId:'a',arrival:125,departure:125,distance:0},{stopId:'b',arrival:200,departure:200,distance:100}]});
  const sim=new HopSimulation(data);tick(sim,250);assert.equal(sim.vehicles[0].tripId,'t');assert.equal(sim.vehicles[0].phase,'layover');assert.equal(sim.vehicles[0].distance,200);
});
test('perpendicular track crossing gives one car priority and both clear without collision or deadlock',()=>{
  const north=path([[0,0,-100],[0,0,100]]),east=path([[-100,0,0],[100,0,0]]);east.id='east';
  const data=fixture(north);data.paths.push(east);data.trips=[{...data.trips[0],id:'a',blockId:'a',stops:[{stopId:'a',arrival:0,departure:0,distance:0},{stopId:'c',arrival:40,departure:40,distance:200}]},{...data.trips[0],id:'b',blockId:'b',pathId:'east',stops:[{stopId:'a',arrival:0,departure:0,distance:0},{stopId:'c',arrival:40,departure:40,distance:200}]}];
  const sim=new HopSimulation(data);
  for(let i=0;i<120*60;i++){sim.update(1/60);const [a,b]=sim.vehicles;const pa=sampleHopPath(north,a.distance).position,pb=sampleHopPath(east,b.distance).position;assert.ok(!(Math.abs(pa[2])<11.6&&Math.abs(pb[0])<11.6),'cars overlap at crossing');}
  assert.ok(sim.vehicles.every(c=>c.distance>150),'both cars clear the crossing');
});
test('bundled weekday noon runs four persistent blocks through two hours without teleporting or overlapping bodies', async()=>{
  const {readFileSync}=await import('node:fs');
  const data:HopData=JSON.parse(readFileSync(new URL('../public/data/hop/network.json',import.meta.url),'utf8'));
  const sim=new HopSimulation(data);assert.equal(sim.vehicles.length,4);
  const initial=sim.vehicles.map(c=>c.id),paths=new Map(data.paths.map(p=>[p.id,p])),prior=new Map<string,HopPoint>(),trips=new Map<string,Set<string>>();
  const rectanglesOverlap=(a:ReturnType<typeof solveHopPose>['sections'][0],b:ReturnType<typeof solveHopPose>['sections'][0],ha:number,hb:number)=>{
    if(Math.abs(a.position[1]-b.position[1])>3.8)return false;
    const aa=[[Math.sin(a.yaw),Math.cos(a.yaw)],[Math.cos(a.yaw),-Math.sin(a.yaw)]],bb=[[Math.sin(b.yaw),Math.cos(b.yaw)],[Math.cos(b.yaw),-Math.sin(b.yaw)]],v=[b.position[0]-a.position[0],b.position[2]-a.position[2]];
    return [...aa,...bb].every(axis=>{const dot=(u:number[])=>Math.abs(u[0]*axis[0]+u[1]*axis[1]);return Math.abs(v[0]*axis[0]+v[1]*axis[1])<ha*dot(aa[0])+1.32*dot(aa[1])+hb*dot(bb[0])+1.32*dot(bb[1]);});
  };
  for(let frame=0;frame<14400;frame++){
    sim.update(.5);const cars=sim.vehicles;
    assert.deepEqual(cars.map(c=>c.id),initial);
    for(const car of cars){const pos=sampleHopPath(paths.get(car.pathId)!,car.distance).position,previous=prior.get(car.id);if(previous)assert.ok(Math.hypot(...pos.map((n,j)=>n-previous[j]))<6.3,'physical location jumps at handoff');prior.set(car.id,pos);const visited=trips.get(car.id)??new Set();visited.add(car.tripId);trips.set(car.id,visited);assert.ok(car.speed>=0&&car.speed<=11.001);if(car.doors>0)assert.equal(car.speed,0);}
    if(frame%2===0){const poses=cars.map(c=>solveHopPose(paths.get(c.pathId)!,c.distance));for(let a=0;a<cars.length;a++)for(let b=a+1;b<cars.length;b++){const ac=poses[a].sections[1].position,bc=poses[b].sections[1].position;if(Math.hypot(ac[0]-bc[0],ac[2]-bc[2])>22)continue;for(let x=0;x<3;x++)for(let y=0;y<3;y++)assert.ok(!rectanglesOverlap(poses[a].sections[x],poses[b].sections[y],x===1?2.8:3.4,y===1?2.8:3.4),`bodies overlap at ${sim.time}`);}}
  }
  for(const visited of trips.values())assert.ok(visited.size>=2,'block failed to complete a trip handoff');
});
