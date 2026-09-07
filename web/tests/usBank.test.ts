import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildUsBank} from '../src/usBank.ts';
const width=60.976394,depth=38.253531;
const build=()=>buildUsBank({width,depth});
const close=(actual:number,expected:number)=>assert.ok(Math.abs(actual-expected)<.00002,`${actual} ≈ ${expected}`);

test('surveyed rectangular shaft reaches the 601-foot overall elevation',()=>{
  const root=build(),bounds=new THREE.Box3().setFromObject(root);
  close(bounds.min.x,-width/2);close(bounds.max.x,width/2);close(bounds.min.z,-depth/2);close(bounds.max.z,depth/2);close(bounds.min.y,0);close(bounds.max.y,183.2);
  assert.equal(root.userData.dimensions.stories,42);assert.equal(root.userData.dimensions.panesPerBay,4);
  close(new THREE.Box3().setFromObject(buildUsBank({width,depth,height:160})).max.y,160);
  assert.throws(()=>buildUsBank({width:NaN,depth}));assert.throws(()=>buildUsBank({width,depth:0}));
});
test('three open diagonal bands interrupt the slab grid at reference elevations',()=>{
  const root=build();
  for(const [name,low,high] of [['lower',10.6,18.9],['middle',71.5,79.8],['crown',174.9,183.2]] as const){
    const band=root.getObjectByName(`usb-${name}-truss-band`)!;assert.ok(band);
    const box=new THREE.Box3().setFromObject(band);close(box.min.y,low);close(box.max.y,high);
  }
  const p=(root.getObjectByName('usb-white-horizontal-floor-rails') as THREE.Mesh).geometry.getAttribute('position');
  for(let i=0;i<p.count;i++)assert.ok(!((p.getY(i)>11.2&&p.getY(i)<18.8)||(p.getY(i)>72.1&&p.getY(i)<79.7)||(p.getY(i)>175.5)));
  assert.ok(new THREE.Box3().setFromObject(root.getObjectByName('usb-recessed-roof-and-foundation')!).max.y<182);
});
test('outward glazing normals and crown anchors follow all four faces',()=>{
  const root=build(),glass=root.getObjectByName('usb-dark-neutral-glazing') as THREE.Mesh;
  const p=glass.geometry.getAttribute('position'),n=glass.geometry.getAttribute('normal');
  for(let i=0;i<p.count;i++){assert.ok(p.getX(i)*n.getX(i)+p.getZ(i)*n.getZ(i)>0);assert.ok(Math.abs(n.getY(i))<1e-8);}
  root.updateMatrixWorld(true);
  for(const anchor of root.userData.signAnchors){
    const out=new THREE.Vector3(Math.sin(anchor.rotationY),0,Math.cos(anchor.rotationY));
    const ray=new THREE.Raycaster(new THREE.Vector3(...anchor.position),out.negate(),0,2);
    assert.ok(ray.intersectObject(root,true).length>0,anchor.face);assert.ok(anchor.width>20&&anchor.width<width);close(anchor.position[1],179.05);
  }
});
test('sparse warm suites are deterministic and restore day mode without residual light',()=>{
  const root=build(),{groups,litGroups}=root.userData.offices;assert.ok(litGroups/groups>.075&&litGroups/groups<.15);
  const windows=root.getObjectByName('usb-occupied-office-windows') as THREE.Mesh,material=windows.material as THREE.MeshBasicMaterial;
  assert.equal(windows.visible,false);assert.equal(material.color.r,0);
  root.userData.setLightingMode('sunset');const dusk=material.color.r;assert.equal(windows.visible,true);
  root.userData.setLightingMode('night');assert.ok(material.color.r>dusk&&material.color.r<.6);
  const c=windows.geometry.getAttribute('color');for(let i=0;i<c.count;i++)assert.ok(c.getX(i)>c.getY(i)&&c.getY(i)>c.getZ(i));
  root.userData.setLightingMode('day');assert.equal(windows.visible,false);assert.equal(material.color.r,0);
  assert.deepEqual(c.array,(build().getObjectByName(windows.name) as THREE.Mesh).geometry.getAttribute('color').array);root.traverse(o=>assert.ok(!(o instanceof THREE.Light)));
});
test('merged triangles remain finite and nondegenerate within a modest draw budget',()=>{
  let meshes=0,triangles=0;const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  build().traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;meshes++;const p=o.geometry.getAttribute('position'),n=o.geometry.getAttribute('normal');triangles+=p.count/3;assert.equal(n.count,p.count);
    for(let i=0;i<p.count;i+=3){
      a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);assert.ok(Number.isFinite(a.x+a.y+a.z+b.x+b.y+b.z+c.x+c.y+c.z));
      assert.ok(b.sub(a).cross(c.sub(a)).lengthSq()>1e-12,`${o.name} triangle ${i/3}`);assert.ok(Number.isFinite(n.getX(i)+n.getY(i)+n.getZ(i)));
    }
  });assert.ok(meshes<25);assert.ok(triangles<60000);
});
