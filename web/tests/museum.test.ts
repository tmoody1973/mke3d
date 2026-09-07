import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { buildMuseum } from '../src/museum.ts';

const museum = buildMuseum();
museum.updateMatrixWorld(true);

test('museum geometry is finite and remains economical', () => {
  let meshes = 0, triangles = 0;
  museum.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    meshes++;
    const position = object.geometry.getAttribute('position');
    assert.ok(Array.from(position.array).every(Number.isFinite), `${object.name} has invalid coordinates`);
    triangles += object.geometry.index ? object.geometry.index.count / 3 : position.count / 3;
  });
  assert.ok(meshes <= 8, `expected <= 8 drawables, got ${meshes}`);
  assert.ok(triangles < 30_000, `triangle budget exceeded: ${triangles}`);
});

test('brise soleil has 72 fins on the inclined mast and a 66.14m span', () => {
  const roots = museum.userData.finRoots;
  assert.equal(roots.length, 72);
  assert.equal(new Set(roots.map((f: {station:number}) => f.station)).size, 36);
  assert.equal(roots.filter((f: {side:string}) => f.side === 'north').length, 36);
  assert.equal(roots.filter((f: {side:string}) => f.side === 'south').length, 36);
  const [startArray, endArray] = museum.userData.spineEndpoints;
  const start = new THREE.Vector3(...startArray), end = new THREE.Vector3(...endArray);
  const angle = THREE.MathUtils.radToDeg(Math.atan2(end.y-start.y, end.x-start.x));
  assert.ok(Math.abs(angle - 47) < .5);
  for (const fin of roots) {
    const t = (fin.root[0] - start.x) / (end.x - start.x);
    const onSpine = start.clone().lerp(end, t);
    assert.ok(onSpine.distanceTo(new THREE.Vector3(...fin.root)) < 1e-8, 'fin does not contact spine');
  }
  const northTip = roots.find((f: {side:string;station:number}) => f.side === 'north' && f.station === 35).tip;
  const southTip = roots.find((f: {side:string;station:number}) => f.side === 'south' && f.station === 35).tip;
  assert.ok(Math.abs(Math.abs(southTip[2] - northTip[2]) - 66.14) < .5);

  const fins = museum.getObjectByName('burke-brise-soleil-72-fins') as THREE.Mesh;
  for (const fin of roots.filter((f: {station:number}) => [0,17,35].includes(f.station))) {
    const root = new THREE.Vector3(...fin.root), tip = new THREE.Vector3(...fin.tip);
    const sign = fin.side === 'north' ? -1 : 1;
    const length = Math.abs(tip.z);
    const samples = [
      root.clone().add(new THREE.Vector3(.002,0,sign*.002)),
      root.clone().add(new THREE.Vector3(.175,1.35,sign*length*.5)),
      root.clone().lerp(tip,.995),
    ];
    for (const sample of samples) {
      const ray = new THREE.Raycaster(sample.clone().add(new THREE.Vector3(0,2,0)),new THREE.Vector3(0,-1,0));
      assert.ok(ray.intersectObject(fins).length, `fin geometry missing near ${sample.toArray()}`);
    }
  }
});

test('the vaulted building stays below the high end of the wings and all masses meet the floor', () => {
  const fins = museum.getObjectByName('burke-brise-soleil-72-fins') as THREE.Mesh;
  fins.geometry.computeBoundingBox();
  const finTop = fins.geometry.boundingBox!.max.y;
  for (const name of ['windhover-glass-vault', 'museum-flowing-podium-galleria-auditorium']) {
    const mesh = museum.getObjectByName(name) as THREE.Mesh;
    mesh.geometry.computeBoundingBox();
    assert.ok(mesh.geometry.boundingBox!.max.y < finTop, `${name} overtops wings`);
  }
  const base = museum.getObjectByName('museum-flowing-podium-galleria-auditorium') as THREE.Mesh;
  assert.ok(base.geometry.boundingBox!.min.y === -10 && base.geometry.boundingBox!.max.y === 0);
  assert.ok(base.geometry.boundingBox!.min.z <= -108 && base.geometry.boundingBox!.max.z >= 50);
  const hall = museum.getObjectByName('windhover-glass-vault') as THREE.Mesh;
  hall.geometry.computeBoundingBox();
  assert.ok(Math.abs(hall.geometry.boundingBox!.max.y - 27.4) < .05, 'vault misses 90ft ceiling');
  assert.ok(hall.geometry.boundingBox!.max.x >= 48, 'east prow is missing');
});

test('triangles are nondegenerate and the vault clears every fin root', () => {
  museum.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object.geometry.index) return;
    const p=object.geometry.getAttribute('position');
    for(let i=0;i<p.count;i+=3){
      const a=new THREE.Vector3().fromBufferAttribute(p,i), b=new THREE.Vector3().fromBufferAttribute(p,i+1), c=new THREE.Vector3().fromBufferAttribute(p,i+2);
      assert.ok(b.sub(a).cross(c.sub(a)).lengthSq()>1e-10, `${object.name} has degenerate triangle`);
    }
  });
  for(const fin of museum.userData.finRoots.filter((f:{side:string})=>f.side==='north')){
    const origin=new THREE.Vector3(fin.root[0],100,0);
    const roof=museum.getObjectByName('windhover-glass-vault') as THREE.Mesh;
    const hit=new THREE.Raycaster(origin,new THREE.Vector3(0,-1,0)).intersectObject(roof)[0];
    if(hit) assert.ok(hit.point.y<=fin.root[1]-.5, `roof intersects wing at station ${fin.station}`);
  }
});


test('opaque gallery and auditorium roofs face upward', () => {
  for (const [name, x, z] of [['galleria-white-barrel-roof', 0, -70], ['museum-flowing-podium-galleria-auditorium', 0, 40]] as const) {
    const mesh = museum.getObjectByName(name) as THREE.Mesh;
    const ray = new THREE.Raycaster(new THREE.Vector3(x, 20, z), new THREE.Vector3(0, -1, 0));
    const hit = ray.intersectObject(mesh)[0];
    assert.ok(hit && hit.face!.normal.y > .5, `${name} roof has reversed winding`);
  }
});
