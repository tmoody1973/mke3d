import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { buildAmFamDetails } from '../src/amfamDetails.ts';
import { facadePoint, facadeFrame, AMFAM_LOCAL_FOOTPRINT } from '../src/amfamFacade.ts';

test('photo details have four merged meshes, finite outward surfaces and no light sources',()=>{
  const group=buildAmFamDetails();let meshes=0,triangles=0;
  group.traverse(object=>{
    assert.ok(!(object instanceof THREE.Light),'details should not add a per-fixture light');
    if(!(object instanceof THREE.Mesh))return;
    meshes++;
    const p=object.geometry.getAttribute('position'),n=object.geometry.getAttribute('normal');
    assert.ok(Array.from(p.array).every(Number.isFinite),object.name);
    assert.ok(Array.from(n.array).every(Number.isFinite),object.name);
    for(let i=0;i<n.count;i++)assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.001,'zero or invalid normal');
    triangles+=p.count/3;
  });
  assert.equal(meshes,4);assert.ok(triangles<30_000,`${triangles} triangles`);
});

test('brick entry tower reaches ground and has a closed roof rather than a floating ornament',()=>{
  const group=buildAmFamDetails();group.updateMatrixWorld(true);
  const [x,,z]=facadePoint(-70*Math.PI/180,0);
  const brick=group.getObjectByName('amfam-brick-reveal-courses-and-entry-tower')!;
  const bounds=new THREE.Box3().setFromObject(brick);
  assert.equal(bounds.min.y,0);
  const down=new THREE.Raycaster(new THREE.Vector3(x,55,z),new THREE.Vector3(0,-1,0));
  assert.ok(down.intersectObject(group,true).some(hit=>Math.abs(hit.point.y-50.1)<.001),'entry tower roof is open');
  const up=new THREE.Raycaster(new THREE.Vector3(x,-2,z),new THREE.Vector3(0,1,0));
  assert.ok(up.intersectObject(brick).some(hit=>Math.abs(hit.point.y)<.001),'entry tower does not meet ground');
});

test('rectangular side glazing and door glazing face outward and service frame meets grade',()=>{
  const group=buildAmFamDetails();group.updateMatrixWorld(true);
  const glazing=group.getObjectByName('amfam-side-curtainwalls-and-entry-glazing')!;
  const angle=55*Math.PI/180;
  const front=new THREE.Vector3(Math.sin(angle)*5,0,55-Math.cos(angle)*5);
  const end=new THREE.Vector3(Math.sin(angle)*182.88,0,55-Math.cos(angle)*182.88);
  const along=end.sub(front),length=along.length();along.normalize();
  const outward=new THREE.Vector3(-along.z,0,along.x).normalize();
  const center=front.clone().addScaledVector(along,length*.55/12.5).setY(15);
  const ray=new THREE.Raycaster(center.clone().addScaledVector(outward,3),outward.clone().negate());
  assert.ok(ray.intersectObject(glazing).length,'side glazing faces inward');
  const doorFrame=facadeFrame(0);
  const doors=new THREE.Raycaster(doorFrame.origin.clone().addScaledVector(doorFrame.normal,4).setY(1.8),doorFrame.normal.clone().negate());
  assert.ok(doors.intersectObject(glazing).length,'entry door glazing faces inward');
  const service=group.getObjectByName('amfam-fine-mullions-canopies-and-pivot-frame')!;
  const under=new THREE.Raycaster(new THREE.Vector3(-3.2,-2,52.4),new THREE.Vector3(0,1,0));
  assert.ok(under.intersectObject(service).some(hit=>Math.abs(hit.point.y)<.001),'pivot frame floats above grade');
});

test('facade follows the mapped perimeter and offsets along a finite outward surface normal',()=>{
  const edgeDistance=(x:number,z:number)=>Math.min(...AMFAM_LOCAL_FOOTPRINT.map((a,i)=>{
    const b=AMFAM_LOCAL_FOOTPRINT[(i+1)%AMFAM_LOCAL_FOOTPRINT.length],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=THREE.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1),0,1);
    return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);
  }));
  for(let degrees=-180;degrees<180;degrees+=2){
    const angle=degrees*Math.PI/180,p=facadePoint(angle,8),offset=facadePoint(angle,8,.8),f=facadeFrame(angle);
    assert.ok(edgeDistance(p[0],p[2])<1e-6,'facade drifts from mapped building');
    assert.equal(p[1],8);assert.ok(Math.abs(Math.hypot(offset[0]-p[0],offset[2]-p[2])-.8)<1e-8);
    assert.ok(Math.abs(f.tangent.length()-1)<1e-8 && Math.abs(f.normal.length()-1)<1e-8);
    assert.ok(f.normal.dot(f.origin.clone().sub(new THREE.Vector3(4.685,0,-16.73)))>0);
  }
  assert.ok(facadePoint(0,0)[2]<90,'front facade retained its oversized bounding ellipse');
  assert.ok(Math.abs(facadePoint(-76*Math.PI/180,0)[0])<100,'side facade retained its oversized bounding ellipse');
});
