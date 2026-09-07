import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  createHopVehicle,
  HOP_HEIGHT_M,
  HOP_LENGTH_M,
  HOP_SECTION_CENTERS,
  HOP_SECTION_LENGTHS,
  HOP_WIDTH_M,
} from '../src/hopVehicle.ts';

function bounds(object: THREE.Object3D) {
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object);
}

test('vehicle has the manufacturer footprint and rail-contact origin', () => {
  const vehicle = createHopVehicle('M-Line');
  const box = bounds(vehicle.group);
  const size = box.getSize(new THREE.Vector3());

  assert.ok(Math.abs(size.z - HOP_LENGTH_M) < 0.08, `length including exposed glazing ${size.z}`);
  assert.ok(Math.abs(size.x - HOP_WIDTH_M) < 0.002, `width ${size.x}`);
  assert.ok(Math.abs(box.min.y) < 0.002, `rail contact ${box.min.y}`);
  assert.ok(size.y >= HOP_HEIGHT_M - 0.08 && size.y <= HOP_HEIGHT_M + 0.08, `height ${size.y}`);
  assert.deepEqual(vehicle.group.userData.sectionLengthsM, [...HOP_SECTION_LENGTHS]);
  assert.equal(vehicle.group.userData.forwardAxis, '+Z');

  assert.deepEqual(
    [vehicle.sectionGroups.front.position.z, vehicle.sectionGroups.center.position.z, vehicle.sectionGroups.rear.position.z],
    [...HOP_SECTION_CENTERS],
  );
  assert.equal(vehicle.sectionGroups.front.getObjectByName('hop-front-body-shell-wheels-hvac')!.userData.wheelContactY, 0);
  assert.equal(vehicle.sectionGroups.rear.getObjectByName('hop-rear-body-shell-wheels-hvac')!.userData.wheelContactY, 0);
  const wheels = vehicle.sectionGroups.front.getObjectByName('hop-front-body-shell-wheels-hvac')!.userData.wheelCentersX;
  assert.ok(wheels.every((x: number) => Math.abs(Math.abs(x) - vehicle.group.userData.gaugeM / 2) < .08));
  vehicle.dispose();
});

test('side glazing, cab windshield, and headlamps sit visibly outside the body skin', () => {
  const vehicle = createHopVehicle('M-Line');
  vehicle.group.updateMatrixWorld(true);
  const sideHit = new THREE.Raycaster(
    new THREE.Vector3(3, 1.86, 6.8), new THREE.Vector3(-1, 0, 0), 0, 4,
  ).intersectObject(vehicle.group, true)[0];
  assert.equal(sideHit?.object.name, 'hop-front-wrapped-glazing-route-display-interior');

  const windshieldHit = new THREE.Raycaster(
    new THREE.Vector3(0, 2.02, 13), new THREE.Vector3(0, 0, -1), 0, 4,
  ).intersectObject(vehicle.group, true)[0];
  assert.equal(windshieldHit?.object.name, 'hop-front-wrapped-glazing-route-display-interior');

  const lampHit = new THREE.Raycaster(
    new THREE.Vector3(.72, .82, 13), new THREE.Vector3(0, 0, -1), 0, 4,
  ).intersectObject(vehicle.group, true)[0];
  assert.equal(lampHit?.object.name, 'hop-forward-headlamps');
  assert.equal(vehicle.group.userData.routeDisplay, 'M');
  assert.equal(vehicle.group.userData.brand, 'THE HOP');
  vehicle.dispose();
});

test('each side has two door bays with independent paired leaves and low-floor openings', () => {
  const vehicle = createHopVehicle('L-Line');
  const leaves = (side: string) => {
    const result: THREE.Object3D[] = [];
    vehicle.group.traverse(object => {
      if (object.name.startsWith(`hop-door-${side}-`) && Number.isFinite(object.userData.closedZ)) result.push(object);
    });
    return result.sort((a, b) => a.userData.closedZ - b.userData.closedZ);
  };
  const left = leaves('left'), right = leaves('right');
  assert.equal(left.length, 4, 'two paired door bays on left');
  assert.equal(right.length, 4, 'two paired door bays on right');
  const closed = left.map(door => door.position.z);
  assert.ok(closed[1] < -.5 && closed[2] > .5, 'door bays leave the center window intact');
  vehicle.setDoors(1, 'left');
  left.forEach((door, i) => {
    assert.ok((door.position.z - closed[i]) * door.userData.openDirection > .4);
    assert.ok(door.position.x < 0);
  });
  assert.deepEqual(right.map(door => door.position.z), closed, 'opposite platform side remains closed');
  vehicle.setDoors(.5, 'right');
  right.forEach((door, i) => {
    const travel = (door.position.z - closed[i]) * door.userData.openDirection;
    assert.ok(travel > .2 && travel < .4, 'half-open door travel');
  });
  vehicle.setDoors(0, 'left');
  assert.deepEqual(left.map(door => door.position.z), closed);
  assert.deepEqual(vehicle.group.userData.doors, { left: 0, right: .5 });
  vehicle.dispose();
});

test('pose updates all three section centers and keeps articulated bellows finite', () => {
  const vehicle = createHopVehicle('M-Line');
  vehicle.applyPose({ sections: [
    { position: [8, 1.2, 8], yaw: .24, pitch: .035 },
    { position: [1.4, 1, 6.5], yaw: .08, pitch: .01 },
    { position: [-5.4, .9, 6.3], yaw: -.12, pitch: -.02 },
  ] });

  assert.deepEqual(vehicle.sectionGroups.front.position.toArray(), [8, 1.2, 8]);
  assert.ok(Math.abs(vehicle.sectionGroups.front.rotation.x + .035) < 1e-12);
  assert.ok(Math.abs(vehicle.sectionGroups.front.rotation.y - .24) < 1e-12);
  for (const name of ['hop-front-center-connected-bellows', 'hop-center-rear-connected-bellows']) {
    const bellows = vehicle.group.getObjectByName(name)!;
    assert.ok(bellows.position.toArray().every(Number.isFinite));
    assert.ok(bellows.quaternion.toArray().every(Number.isFinite));
    assert.ok(bellows.scale.z > 0 && Number.isFinite(bellows.scale.z));
  }

  const connected = vehicle.group.getObjectByName('hop-front-center-connected-bellows')!;
  vehicle.group.updateMatrixWorld(true);
  const expectedEnds = [
    vehicle.group.worldToLocal(vehicle.sectionGroups.center.localToWorld(new THREE.Vector3(0, 1.82, 2.8))),
    vehicle.group.worldToLocal(vehicle.sectionGroups.front.localToWorld(new THREE.Vector3(0, 1.82, -3.4))),
  ];
  const actualEnds = [-.38, .38].map(z =>
    vehicle.group.worldToLocal(connected.localToWorld(new THREE.Vector3(0, 0, z))));
  assert.ok(actualEnds[0].distanceTo(expectedEnds[0]) < 1e-6);
  assert.ok(actualEnds[1].distanceTo(expectedEnds[1]) < 1e-6);
  vehicle.dispose();
});

test('M and L service labels share the same photographed body livery', () => {
  const m = createHopVehicle('M-Line'), l = createHopVehicle('L-Line');
  for (const name of ['front', 'center', 'rear']) {
    const getBody = (car: ReturnType<typeof createHopVehicle>) =>
      car.group.getObjectByName(`hop-${name}-body-shell-wheels-hvac`) as THREE.Mesh;
    assert.deepEqual(getBody(m).geometry.getAttribute('color').array, getBody(l).geometry.getAttribute('color').array);
  }
  assert.equal(m.group.userData.routeDisplay, 'M');
  assert.equal(l.group.userData.routeDisplay, 'L');
  m.dispose(); l.dispose();
});

test('open boarding bays reveal recessed vestibules instead of painted body panels', () => {
  const vehicle = createHopVehicle('M-Line');
  const hit = (bay: number) => {
    vehicle.group.updateMatrixWorld(true);
    return new THREE.Raycaster(new THREE.Vector3(3, 1.5, bay + .15), new THREE.Vector3(-1, 0, 0), 0, 5)
      .intersectObject(vehicle.group, true)[0];
  };
  for (const bay of [-1.5, 1.5]) {
    const closed = hit(bay);
    assert.ok(closed?.object.name.startsWith('hop-door-right-'), `closed bay ${bay} must show a door leaf`);
  }
  vehicle.setDoors(1, 'right');
  for (const bay of [-1.5, 1.5]) {
    const open = hit(bay);
    assert.ok(open && open.point.x < 1.2, `open bay ${bay} must expose an inset opening, got ${open?.point.x}`);
  }
  vehicle.dispose();
});

test('scene stays within the triangle and draw-call budgets with no runtime lights', () => {
  const vehicle = createHopVehicle('M-Line');
  let meshes = 0;
  let triangles = 0;
  vehicle.group.traverse(object => {
    assert.ok(object.position.toArray().every(Number.isFinite), `${object.name} has invalid position`);
    assert.ok(!(object instanceof THREE.Light), 'vehicle must not add per-car lights');
    if (!(object instanceof THREE.Mesh)) return;
    meshes++;
    const position = object.geometry.getAttribute('position');
    assert.ok(position && position.count > 0, `${object.name} has no geometry`);
    triangles += object.geometry.index ? object.geometry.index.count / 3 : position.count / 3;
    assert.ok(Array.from(position.array).every(Number.isFinite), `${object.name} has invalid geometry`);
  });

  assert.equal(meshes, vehicle.group.userData.drawCalls);
  assert.ok(meshes <= 32, `draw calls ${meshes}`);
  assert.ok(triangles <= 12_000, `triangles ${triangles}`);
  vehicle.dispose();
});

test('day, sunset, and night modes reuse emissive surfaces without adding lights', () => {
  const vehicle = createHopVehicle('M-Line');
  const glazing = vehicle.group.getObjectByName('hop-front-wrapped-glazing-route-display-interior') as THREE.Mesh;
  const headlamps = vehicle.group.getObjectByName('hop-forward-headlamps') as THREE.Mesh;
  const taillamps = vehicle.group.getObjectByName('hop-rear-taillamps') as THREE.Mesh;
  const material = glazing.material as THREE.MeshLambertMaterial;
  const headlightMaterial = headlamps.material as THREE.MeshLambertMaterial;
  const taillightMaterial = taillamps.material as THREE.MeshLambertMaterial;

  vehicle.setMode('night');
  assert.ok(material.emissiveIntensity > 0);
  assert.ok(headlightMaterial.emissiveIntensity > material.emissiveIntensity);
  assert.ok(taillightMaterial.emissiveIntensity > material.emissiveIntensity);
  assert.notEqual(headlamps.material, glazing.material);
  assert.notEqual(taillamps.material, glazing.material);
  vehicle.setMode('sunset');
  assert.ok(material.emissiveIntensity > 0);
  vehicle.setMode('day');
  assert.equal(material.emissiveIntensity, 0);
  assert.equal(headlightMaterial.emissiveIntensity, 0);
  assert.equal(taillightMaterial.emissiveIntensity, 0);
  assert.equal(vehicle.group.userData.mode, 'day');
  vehicle.dispose();
});
