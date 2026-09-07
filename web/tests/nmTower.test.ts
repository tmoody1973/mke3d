import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildNMTower } from '../src/nmTower.ts';
import { NM_PARTS, NM_SITE } from '../src/nmSite.ts';

const parts=Object.values(NM_PARTS).filter(p=>p.levels>20).map(p=>({
  id:p.id,height:'height' in p?p.height:169,
  polygon:p.footprint.map(([x,z])=>[x-NM_SITE.x,z-NM_SITE.z] as [number,number]),
  minHeight:p.minLevel*3.3,
}));
const build=()=>buildNMTower({parts});

test('NM tower preserves the mapped asymmetric footprint and 169 meter calibration',()=>{
  const tower=build(),bounds=new THREE.Box3().setFromObject(tower);
  assert.equal(bounds.min.y,0);assert.equal(bounds.max.y,169);
  assert.equal(tower.userData.dimensions.officeLevels,32);
  assert.equal(tower.userData.dimensions.parts.length,parts.length);
  assert.ok(Math.abs(bounds.min.x-(354.308-NM_SITE.x))<.1);
  assert.ok(Math.abs(bounds.max.x-(427.328-NM_SITE.x))<.1);
  assert.ok(Math.abs(bounds.min.z-(-579.054-NM_SITE.z))<.1);
  assert.ok(Math.abs(bounds.max.z-(-525.591-NM_SITE.z))<.1);
  const shifted=new THREE.Box3().setFromObject(buildNMTower({parts,height:160,baseHeight:3}));
  assert.equal(shifted.min.y,3);assert.equal(shifted.max.y,163);
  assert.throws(()=>buildNMTower({parts:[]}));
  assert.throws(()=>buildNMTower({parts,height:NaN}));
});

test('mapped lower blades have real roof setbacks below the main curved crown',()=>{
  const tower=build();tower.updateMatrixWorld(true);
  function roofAt(x:number,z:number) {
    const ray=new THREE.Raycaster(new THREE.Vector3(x-NM_SITE.x,190,z-NM_SITE.z),new THREE.Vector3(0,-1,0));
    return ray.intersectObject(tower,true)[0]?.point.y;
  }
  assert.ok(Math.abs(roofAt(360,-537)-(169*490/550-.18))<.03,'southwestern projecting blade');
  assert.ok(Math.abs(roofAt(375,-575)-(169*520/550-.18))<.03,'lower north spine');
  assert.ok(Math.abs(roofAt(380,-558)-(169-.18))<.03,'main upper envelope');
  assert.equal(roofAt(424,-538),undefined,'the sharply tapered lakeward footprint is not replaced with a box');
});

test('name anchor faces the curved southeast facade and sits immediately outside real geometry',()=>{
  const tower=build(),anchor=tower.userData.signAnchor;tower.updateMatrixWorld(true);
  assert.ok(anchor);assert.ok(anchor.rotationY>0&&anchor.rotationY<Math.PI/2);
  const outward=new THREE.Vector3(Math.sin(anchor.rotationY),0,Math.cos(anchor.rotationY));
  const ray=new THREE.Raycaster(new THREE.Vector3(...anchor.position),outward.negate(),0,1);
  const hits=ray.intersectObject(tower,true).filter(hit=>hit.object.name==='nm-bluegray-curtain-wall'||hit.object.name==='nm-blue-spandrels-and-crown-screen');
  assert.ok(hits.length>0);assert.ok(hits[0].distance>.1&&hits[0].distance<.25);
});

test('office lighting stays sparse and deterministic with no per-window lights',()=>{
  const tower=build(),offices=tower.userData.offices;
  const occupancy=offices.litGroups/offices.groups;
  assert.ok(occupancy>.10&&occupancy<.19);
  const light=tower.getObjectByName('nm-occupied-office-suites') as THREE.Mesh;
  const material=light.material as THREE.MeshBasicMaterial;
  assert.equal(light.visible,false);
  tower.userData.setLightingMode('sunset');const dusk=material.color.r;assert.equal(light.visible,true);
  tower.userData.setLightingMode('night');assert.ok(material.color.r>dusk&&material.color.r<.6);
  tower.userData.setLightingMode('day');assert.equal(light.visible,false);
  assert.deepEqual(light.geometry.getAttribute('color').array,(build().getObjectByName(light.name) as THREE.Mesh).geometry.getAttribute('color').array);
  tower.traverse(o=>assert.equal(o instanceof THREE.Light,false));
});

test('merged tower geometry stays finite and nondegenerate within a modest draw budget',()=>{
  const tower=build();let count=0,triangles=0;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  tower.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;count++;
    const p=object.geometry.getAttribute('position');triangles+=p.count/3;
    const color=object.geometry.getAttribute('color');if(color)assert.equal(color.count,p.count);
    for(let i=0;i<p.count;i+=3) {
      a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);
      assert.ok(Number.isFinite(a.x+a.y+a.z+b.x+b.y+b.z+c.x+c.y+c.z));
      assert.ok(b.sub(a).cross(c.sub(a)).lengthSq()>1e-12,`${object.name}: triangle ${i/3}`);
    }
  });
  assert.ok(count<=8);assert.ok(triangles<50000);
});
