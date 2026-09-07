import test from 'node:test';
import assert from 'node:assert/strict';
import {DrivingTour} from '../src/drivingTour.ts';
import {createDriveState,type DriveState} from '../src/drivingPhysics.ts';
const route={id:'test',name:'Test road',description:'',points:[[0,0],[0,-1000]] as [number,number][]};
const free=(_:DriveState,next:DriveState)=>({...next,blocked:false});
function run(rate:number,fps=60){const tour=new DrivingTour(route),state=createDriveState(0,0,0);for(let i=0;i<fps*12;i++)tour.update(state,1/fps,rate,free);return {tour,state};}
test('guided speed changes distance without changing route and remains frame independent',()=>{
 const slow=run(.5),normal=run(1),fast=run(2),thirty=run(1,30);
 assert.ok(slow.tour.distance<normal.tour.distance&&normal.tour.distance<fast.tour.distance);
 assert.ok(Math.abs(thirty.tour.distance-normal.tour.distance)<.01);
 assert.equal(normal.state.x,0);assert.ok(normal.state.speed<=8);
});
test('pause freezes travel; resume continues and collision stops progress',()=>{
 const {tour,state}=run(1),d=tour.distance;tour.pause(state);tour.update(state,1,2,free);assert.equal(tour.distance,d);
 tour.resume();tour.update(state,.1,1,free);assert.ok(tour.distance>d);
 const before={...state},at=tour.distance;
 tour.update(state,.1,1,(p)=>({...p,blocked:true}));assert.equal(tour.status,'blocked');assert.equal(tour.distance,at);assert.equal(state.z,before.z);assert.equal(state.speed,0);
});
test('tour finishes at destination without looping or teleporting',()=>{
 const tour=new DrivingTour({...route,points:[[0,0],[0,-5]]}),state=createDriveState(0,0,0);
 for(let i=0;i<1000;i++)tour.update(state,1/60,1,free);
 assert.equal(tour.status,'complete');assert.ok(Math.abs(state.z+5)<.02);assert.equal(state.speed,0);
 const end=state.z;tour.update(state,1,2,free);assert.equal(state.z,end);
});
