import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildAmFamBowl } from '../src/amfamBowl.ts';
import { AMFAM_LOCAL_FOOTPRINT } from '../src/amfamFacade.ts';

function inside(x:number,z:number) {
  let result=false;
  for(let i=0,j=AMFAM_LOCAL_FOOTPRINT.length-1;i<AMFAM_LOCAL_FOOTPRINT.length;j=i++) {
    const a=AMFAM_LOCAL_FOOTPRINT[i],b=AMFAM_LOCAL_FOOTPRINT[j];
    if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])result=!result;
  }
  return result;
}

test('three coherent decks wrap continuously behind home plate and both foul lines',()=>{
  const bowl=buildAmFamBowl();
  const tiers=[1,2,3].map(i=>bowl.getObjectByName(`terraced-dark-green-bowl-tier-${i}`) as THREE.Mesh);
  assert.ok(tiers.every(Boolean));
  for(const tier of tiers) {
    const p=tier.geometry.getAttribute('position');
    assert.equal(p.count,88*6,'every neighboring station is joined by two triangles');
    const regions={left:false,right:false,back:false};
    for(let i=0;i<p.count;i++) {
      const x=p.getX(i),z=p.getZ(i);
      if(z>10)regions.back=true;if(x<-35&&z<0)regions.left=true;if(x>35&&z<0)regions.right=true;
    }
    assert.deepEqual(regions,{left:true,right:true,back:true});
  }
});

test('all bowl triangles are finite, nondegenerate, and remain in the mapped footprint',()=>{
  const bowl=buildAmFamBowl();
  bowl.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;
    const p=o.geometry.getAttribute('position');
    for(let i=0;i<p.count;i++)assert.ok(inside(p.getX(i),p.getZ(i)),`${o.name} vertex ${i} left footprint`);
    for(let i=0;i<p.count;i+=3) {
      const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);
      assert.ok(a.toArray().every(Number.isFinite));
      assert.ok(b.sub(a).cross(c.sub(a)).lengthSq()>1e-10,`${o.name} triangle ${i/3} is degenerate`);
    }
  });
});

test('fair-territory seating starts beyond the documented outfield wall',()=>{
  const bowl=buildAmFamBowl();
  bowl.traverse(o=>{
    if(!(o instanceof THREE.Mesh)||(!o.name.includes('tier')&&o.name!=='outfield-corner-bleachers'))return;
    const p=o.geometry.getAttribute('position');
    for(let i=0;i<p.count;i++) {
      const x=p.getX(i),z=p.getZ(i),angle=Math.atan2(x,-z)/Math.PI*180;
      if(Math.abs(angle)>45||z>=0)continue;
      const radius=Math.hypot(x,z);
      const t=(angle+45)/90;
      const wall=angle<=0?THREE.MathUtils.lerp(104.8512,121.92,t*2):THREE.MathUtils.lerp(121.92,105.156,t*2-1);
      assert.ok(radius>=wall+.7,`${o.name} overlaps fair field at ${angle.toFixed(1)} degrees`);
    }
  });
});

test('backstop deck vertices stay beneath the low roof and supports reach grade',()=>{
  const bowl=buildAmFamBowl(),tan55=Math.tan(55*Math.PI/180);
  for(const tier of [1,2,3].map(i=>bowl.getObjectByName(`terraced-dark-green-bowl-tier-${i}`) as THREE.Mesh)) {
    const p=tier.geometry.getAttribute('position');
    for(let i=0;i<p.count;i++)if(p.getZ(i)>55-Math.abs(p.getX(i))/tan55)assert.ok(p.getY(i)<=32.2001);
  }
  const supports=bowl.getObjectByName('under-stand-concrete-supports') as THREE.Mesh;
  const p=supports.geometry.getAttribute('position');let min=Infinity;
  for(let i=0;i<p.count;i++)min=Math.min(min,p.getY(i));
  assert.ok(Math.abs(min)<1e-6);
});
