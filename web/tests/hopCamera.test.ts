import test from 'node:test';
import assert from 'node:assert/strict';
import { hopCameraPose } from '../src/hopCamera.ts';
import type { HopPath,HopPoint } from '../src/hopTypes.ts';
function path(points:HopPoint[]):HopPath {
  const distances=[0];for(let i=1;i<points.length;i++)distances.push(distances[i-1]+Math.hypot(...points[i].map((v,j)=>v-points[i-1][j])));
  return {id:'test',routeId:'M',name:'test',color:'#fff',points,distances,length:distances.at(-1)!};
}
test('third-person stays behind the full car even at the start, with an aerial alternative',()=>{
  const p=path([[0,3,0],[0,3,200]]);
  for(const distance of [0,10,80]) {
    const close=hopCameraPose(p,distance,1,'third-person'),aerial=hopCameraPose(p,distance,1,'aerial');
    assert.ok(close.cameraPosition.z<=close.position.z-24.9);
    assert.equal(close.cameraPosition.y,10);
    assert.ok(aerial.cameraPosition.y>close.cameraPosition.y+15);
  }
});
test('camera follows bends and wraps at closed-loop seam without jumping',()=>{
  const p=path([[0,0,0],[100,0,0],[100,0,100],[0,0,100],[0,0,0]]);
  const a=hopCameraPose(p,0,1,'third-person'),b=hopCameraPose(p,p.length,1,'third-person');
  assert.ok(a.cameraPosition.distanceTo(b.cameraPosition)<1e-6);
  const bend=hopCameraPose(p,115,1,'third-person');
  assert.ok(bend.cameraPosition.x<100,'trailing camera remains on previous leg through a bend');
  const scaled=hopCameraPose(path([[0,4,0],[0,4,100]]),50,4,'third-person');
  assert.equal(scaled.position.y,16);assert.equal(scaled.cameraPosition.y,23,'camera clearance is physical height above exaggerated ground');
});
