import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMuseumParkLandscape, parkLawnContains } from '../src/museumParkLandscape.ts';
test('park planting occupies lawns, respects the bridge landing and uses the roof elevation',()=>{
 const root=buildMuseumParkLandscape(()=>-2);
 const sites=root.userData.plantingSites;
 assert.ok(sites.filter((s:any)=>s.kind==='tree'&&s.raised).length>12);
 assert.ok(root.children.length<=4);
 for(const s of sites){
  assert.ok(Math.abs(s.base-(s.raised?10.89:-1.86))<1e-9);
  assert.ok(Math.hypot(s.x-522.772,s.z+464.3)>=11);
  for(let i=0;i<16;i++)assert.ok(parkLawnContains(s.x+Math.cos(i*Math.PI/8)*s.radius,s.z+Math.sin(i*Math.PI/8)*s.radius,s.raised));
 }
});
