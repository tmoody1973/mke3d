import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildCoutureTower } from '../src/couture.ts';

function bounds(root: THREE.Object3D) { root.updateMatrixWorld(true); return new THREE.Box3().setFromObject(root); }

test('Couture tower follows the mapped plan and calibrated ground-to-roof height',()=>{
  const tower=buildCoutureTower(),b=bounds(tower),d=tower.userData.dimensions;
  assert.ok(Math.abs(b.max.y-160)<.001);
  assert.ok(b.min.y>=0);
  assert.ok(b.max.x-b.min.x<=30.798+.51);
  assert.ok(b.max.z-b.min.z<=43.058+.51);
  assert.equal(d.glazedLevels,44);
  assert.equal(d.highestMechanicalLevel,45);
  const moved=buildCoutureTower({width:34,depth:46,height:165,baseHeight:3}),m=bounds(moved);
  assert.ok(Math.abs(m.min.y-3)<.001&&Math.abs(m.max.y-165)<.001);
  assert.throws(()=>buildCoutureTower({height:NaN}));
});

test('finished crown has a lower western terrace, taller eastern glazing and highest pale backbone',()=>{
  const tower=buildCoutureTower(),d=tower.userData.dimensions;
  tower.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();
  const roofHeight=(x:number,z:number)=>{
    ray.set(new THREE.Vector3(x,180,z),new THREE.Vector3(0,-1,0));
    return ray.intersectObject(tower,true)[0]?.point.y;
  };
  assert.ok(Math.abs(roofHeight(-10,0)-d.shoulder)<.1,'rear mass stops at its terrace');
  assert.ok(roofHeight(10,0)>d.shoulder+10,'lakeward mass rises above terrace');
  assert.ok(roofHeight(0,0)>159.9,'pale roof spine is the highest element');
});

test('balcony interiors are recessed behind their glass guards and include genuine horizontal slabs',()=>{
  const tower=buildCoutureTower();
  const inside=bounds(tower.getObjectByName('couture-recessed-balcony-interiors')!);
  const guards=bounds(tower.getObjectByName('couture-balcony-glass-guards')!);
  assert.ok(tower.userData.apartments.balconyPanels>100);
  // Recess walls span from outer slab edge to inset wall, so compare central face positions with ray hits.
  tower.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(-2,tower.userData.dimensions.glassTop/44*8+.9,40),new THREE.Vector3(0,0,-1));
  const hits=ray.intersectObject(tower,true);
  const guard=hits.find(hit=>hit.object.name==='couture-balcony-glass-guards');
  const interior=hits.find(hit=>hit.object.name==='couture-recessed-balcony-interiors');
  assert.ok(guard&&interior);
  assert.ok(guard!.point.z-interior!.point.z>1,'balcony has real depth rather than a dark decal');
  assert.ok(guards.max.z>inside.max.z-.3);
});

test('night illumination is sparse, deterministic and does not create scene lights',()=>{
  const tower=buildCoutureTower(),lit=tower.getObjectByName('couture-occupied-apartments') as THREE.Mesh;
  const data=tower.userData.apartments,material=lit.material as THREE.MeshBasicMaterial;
  assert.ok(data.litGroups/data.groups>=.10&&data.litGroups/data.groups<=.20);
  assert.equal(lit.visible,false);
  tower.userData.setMode('sunset');const dusk=material.color.r;assert.equal(lit.visible,true);
  tower.userData.setMode('night');assert.ok(material.color.r>dusk&&material.color.r<1);
  tower.userData.setMode('day');assert.equal(lit.visible,false);
  assert.deepEqual(lit.geometry.getAttribute('position').array,(buildCoutureTower().getObjectByName(lit.name) as THREE.Mesh).geometry.getAttribute('position').array);
  tower.traverse(o=>assert.equal(o instanceof THREE.Light,false));
});

test('tower geometry has finite, nondegenerate triangles within the scene budget',()=>{
  const tower=buildCoutureTower();let triangles=0,meshes=0;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  tower.traverse(o=>{if(!(o instanceof THREE.Mesh))return;meshes++;
    const p=o.geometry.getAttribute('position');assert.equal(p.count%3,0);triangles+=p.count/3;
    const colors=o.geometry.getAttribute('color');if(colors)assert.equal(colors.count,p.count);
    for(let i=0;i<p.count;i+=3){
      a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);
      assert.ok(Number.isFinite(a.x+a.y+a.z+b.x+b.y+b.z+c.x+c.y+c.z));
      assert.ok(b.sub(a).cross(c.sub(a)).lengthSq()>1e-12,`${o.name} triangle ${i/3} is degenerate`);
    }
  });
  assert.ok(meshes<=8);assert.ok(triangles<100000);
});
