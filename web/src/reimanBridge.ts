import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Reiman's mapped alignment; mast height, rail details and cable spacing are interpretive. */
export function buildReimanBridge(groundAt: (x: number, z: number) => number): THREE.Group {
  const group = new THREE.Group(); group.name = 'reiman-pedestrian-bridge';
  const start = new THREE.Vector3(522.772, 10.7, -464.3);
  const end = new THREE.Vector3(610.104, 10.7, -470.507);
  const direction = end.clone().sub(start).normalize();
  const across = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
  const white = new THREE.MeshPhongMaterial({ color: 0xecece7, shininess: 25 });
  const cable = new THREE.MeshLambertMaterial({ color: 0xb4bdc4 });
  const paving = new THREE.MeshLambertMaterial({ color: 0x9c9991 });
  const structure: THREE.BufferGeometry[] = [], wires: THREE.BufferGeometry[] = [];
  function beam(a: THREE.Vector3, b: THREE.Vector3, radius: number, into: THREE.BufferGeometry[]) {
    const g = new THREE.CylinderGeometry(radius * .8, radius, a.distanceTo(b), 6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
    g.translate(...a.clone().add(b).multiplyScalar(.5).toArray()); into.push(g);
  }
  const deck = new THREE.BoxGeometry(start.distanceTo(end), .55, 4.5);
  deck.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction));
  deck.translate(...start.clone().add(end).multiplyScalar(.5).add(new THREE.Vector3(0, -.275, 0)).toArray());
  const walking = new THREE.Mesh(deck, paving); walking.name = 'reiman-deck'; group.add(walking);
  for (const side of [-1, 1]) {
    const offset = across.clone().multiplyScalar(side * 2.05);
    beam(start.clone().add(offset).add(new THREE.Vector3(0, 1.1, 0)), end.clone().add(offset).add(new THREE.Vector3(0, 1.1, 0)), .075, structure);
    for (let i = 0; i <= 24; i++) {
      const p = start.clone().lerp(end, i / 24).add(offset);
      beam(p, p.clone().add(new THREE.Vector3(0, 1.1, 0)), .045, structure);
    }
  }
  const foot = end.clone().add(new THREE.Vector3(-2, 0, .14));
  const tip = foot.clone().add(new THREE.Vector3(45.69, 49, -3.32));
  beam(foot, tip, .7, structure);
  beam(new THREE.Vector3(foot.x, groundAt(foot.x, foot.z) - .5, foot.z), foot, 1.25, structure);
  for (let i = 0; i < 16; i++) {
    const anchor = start.clone().lerp(end, .06 + i * .052).add(new THREE.Vector3(0, .3, 0));
    beam(anchor, foot.clone().lerp(tip, .60 + i * .026), .045, wires);
  }
  for (const [parts, material, name] of [[structure, white, 'reiman-mast-and-railings'], [wires, cable, 'reiman-stay-cables']] as const) {
    const merged = mergeGeometries(parts); if (!merged) throw new Error('Bridge geometry could not be merged');
    const mesh = new THREE.Mesh(merged, material); mesh.name = name; group.add(mesh); parts.forEach(g => g.dispose());
  }
  group.traverse(o => { if (o instanceof THREE.Mesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.userData.end = end.toArray(); group.userData.start = start.toArray();
  return group;
}
