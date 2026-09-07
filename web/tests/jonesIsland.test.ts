import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildJonesIsland} from '../src/jonesIsland.ts';
import {JONES_BASINS,JONES_GREEN_AREAS} from '../src/jonesIslandSite.ts';
import {prepareJonesIslandWater,jonesBasinLevel} from '../src/jonesIslandWater.ts';
import {detailJonesIslandBuildings} from '../src/jonesIslandBuildings.ts';
import {PORT_BUILDINGS} from '../src/portSite.ts';
test('Jones Island composes mapped basins and park without filling surrounding harbor',()=>{
 const root=buildJonesIsland(()=>2);assert.equal(root.userData.basinCount,49);assert.equal(root.userData.circularCount,20);
 const park=JONES_GREEN_AREAS.find(p=>p.id===340218889)!;assert.deepEqual(root.userData.parkPosition,[park.center[0],2,park.center[1]]);
 let draws=0;root.traverse(o=>{if(o instanceof THREE.Mesh){draws++;for(const n of o.geometry.getAttribute('position').array)assert.ok(Number.isFinite(n));}});assert.ok(draws<20);
});
test('basin correction removes high DEM returns while preserving harbor vertices and source arrays',()=>{
 const b=JONES_BASINS.find(b=>b.id===405502179)!;const [x,z]=b.center;
 const p=new Float32Array([x,18,z,x+1,19,z,x,20,z+1, 100,0,2000,101,0,2000,100,0,2001]);
 const source={name:'WATR',positions:p,colors:new Uint8Array(18)};const [result]=prepareJonesIslandWater([source]);
 assert.equal(p[1],18);for(const i of [1,4,7])assert.ok(Math.abs(result.positions[i]-jonesBasinLevel(b))<1e-5);
 for(let i=0;i<p.length;i++)if(![1,4,7].includes(i))assert.equal(result.positions[i],p[i]);
 assert.equal(result.colors,source.colors);
});
test('industrial facade details retain the original footprint and are idempotent',()=>{
 const b=PORT_BUILDINGS.find(b=>b.id===663078932)!;const vertices:number[]=[];
 for(let i=1;i<b.footprint.length;i++){const a=b.footprint[i-1],c=b.footprint[i];vertices.push(a[0],2,a[1],c[0],2,c[1],c[0],11,c[1],a[0],2,a[1],c[0],11,c[1],a[0],11,a[1]);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.BufferAttribute(new Uint8Array(vertices.length).fill(240),3,true));
 const group=new THREE.Group(),mesh=new THREE.Mesh(geometry);mesh.name='BLDG';group.add(mesh);
 assert.equal(detailJonesIslandBuildings(group,{i:0,j:-1}),1);assert.deepEqual(Array.from(geometry.getAttribute('position').array),Array.from(new Float32Array(vertices)));
 assert.notEqual(geometry.getAttribute('color').getX(0),240/255);assert.equal(detailJonesIslandBuildings(group,{i:0,j:-1}),0);
});
