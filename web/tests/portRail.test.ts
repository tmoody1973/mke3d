import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildPortRail} from '../src/portRail.ts';
test('mapped tracks preserve connections, gauge and terrain without per-sleeper draw calls',()=>{
  const paths=[{id:1,points:[[0,0],[0,30],[10,50]] as [number,number][]},{id:2,points:[[0,30],[-10,50]] as [number,number][]}];
  const root=buildPortRail(paths,(_x,z)=>2+z*.01);
  assert.equal(root.userData.gauge,1.435);assert.equal(root.userData.pathCount,2);
  assert.ok(Math.abs(root.userData.railLengthM-(30+2*Math.hypot(10,20)))<.001);
  const ties=root.getObjectByName('port-railway-sleepers') as THREE.InstancedMesh;
  assert.ok(ties.count>80);assert.equal(root.children.length,3);
  const m=new THREE.Matrix4();ties.getMatrixAt(0,m);assert.ok(Math.abs(m.elements[13]-2.25)<1e-6);
  root.traverse(o=>{if(o instanceof THREE.Mesh){assert.ok(Array.from(o.geometry.getAttribute('position').array).every(Number.isFinite));assert.equal(o.castShadow,false);}});
});
