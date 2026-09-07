import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hoanApproachSupportStations, hoanSouthboundSource } from './hoanApproachData.ts';

type DeckSample = { height: number; distance: number; halfWidth: number };
type SampleDeck = (x: number, z: number) => DeckSample;
const smoothstep = (t: number) => { const u = THREE.MathUtils.clamp(t, 0, 1); return u * u * (3 - 2 * u); };

/** Exact source route restored where the single-line Hoan proxy discarded its other carriageway. */
export function buildHoanApproaches(sampleDeck: SampleDeck, groundAt: (x: number, z: number) => number) {
  const group = new THREE.Group();
  group.name = 'hoan-southbound-approaches';
  const road: number[] = [], concrete: number[] = [];
  const furniture: THREE.BufferGeometry[] = [];
  const marking: THREE.BufferGeometry[] = [];
  const joints: number[] = [];
  const vertices: { p: THREE.Vector3; station: number; width: number }[] = [];
  let station = 0;
  for (const way of hoanSouthboundSource) {
    joints.push(station);
    for (let i = 0; i < way.points.length; i++) {
      const p = new THREE.Vector3(...way.points[i]);
      const previous = vertices.at(-1);
      if (previous && p.distanceTo(previous.p) < .001) continue;
      if (previous) station += Math.hypot(p.x - previous.p.x, p.z - previous.p.z);
      vertices.push({ p, station, width: way.widthM });
    }
  }
  const total = station, transitionStart = joints.at(-1)!;
  const at = (s: number) => {
    const d = THREE.MathUtils.clamp(s, 0, total);
    let i = 1;
    while (i < vertices.length - 1 && vertices[i].station < d) i++;
    const a = vertices[i - 1], b = vertices[i];
    const t = (d - a.station) / (b.station - a.station);
    const p = a.p.clone().lerp(b.p, t);
    const width = THREE.MathUtils.lerp(a.width, b.width, t);
    // Reach the shared deck before the ribbons overlap, then stay on its exact surface.
    const weight = smoothstep((d - transitionStart) / (total - transitionStart - 80));
    return { p, width, weight };
  };
  const surfaceAt = (s: number, x: number, z: number) => {
    const { p, weight } = at(s);
    return THREE.MathUtils.lerp(p.y, sampleDeck(x, z).height, weight);
  };
  const frame = (s: number) => {
    const value = at(s), before = at(s - .1).p, after = at(s + .1).p;
    const side = new THREE.Vector3(-(after.z - before.z), 0, after.x - before.x).normalize();
    return { ...value, side };
  };
  const samples = new Set(vertices.map(v => v.station));
  for (let s = 0; s < total; s += 4) samples.add(s);
  samples.add(total);
  const stations = [...samples].sort((a, b) => a - b);
  const quad = (out: number[], a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
    out.push(...a.toArray(), ...d.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...b.toArray());
  };
  const edge = (s: number, sign: number, extra = 0, drop = 0) => {
    const f = frame(s), p = f.p.clone().addScaledVector(f.side, sign * (f.width / 2 + extra));
    return p.setY(surfaceAt(s, p.x, p.z) - drop);
  };
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1], b = stations[i];
    quad(road, edge(a, 1), edge(a, -1), edge(b, -1), edge(b, 1));
    // A 0.7 m slab supports the restored ribbon. The top stays below asphalt.
    quad(concrete, edge(a, 1, .3, .12), edge(a, -1, .3, .12), edge(b, -1, .3, .12), edge(b, 1, .3, .12));
    quad(concrete, edge(a, 1, .3, .82), edge(b, 1, .3, .82), edge(b, -1, .3, .82), edge(a, -1, .3, .82));
    for (const sign of [-1, 1]) {
      const p = edge(a, sign, .3, .12), q = edge(b, sign, .3, .12);
      if (sign === 1) quad(concrete, p, q, q.clone().add(new THREE.Vector3(0, -.7, 0)), p.clone().add(new THREE.Vector3(0, -.7, 0)));
      else quad(concrete, q, p, p.clone().add(new THREE.Vector3(0, -.7, 0)), q.clone().add(new THREE.Vector3(0, -.7, 0)));
    }
  }
  const beam = (out: THREE.BufferGeometry[], a: THREE.Vector3, b: THREE.Vector3, width: number, height: number) => {
    const delta = b.clone().sub(a);
    if (delta.length() < .01) return;
    const geo = new THREE.BoxGeometry(width, height, delta.length());
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), delta.normalize()));
    geo.translate(...a.clone().add(b).multiplyScalar(.5).toArray()); out.push(geo);
  };
  // Leave every real branch mouth open and remove the internal railing at the merge.
  for (let i = 1; i < stations.length; i++) {
    const a = stations[i - 1], b = stations[i], middle = (a + b) / 2;
    if (joints.some(s => Math.abs(s - middle) < 20) || total - middle < 18) continue;
    for (const sign of [-1, 1]) {
      const p = edge(a, sign, -.1), q = edge(b, sign, -.1), d = sampleDeck(p.x, p.z);
      if (d.distance < d.halfWidth + 1 && Math.abs(d.height - p.y) < 2) continue;
      beam(furniture, p.add(new THREE.Vector3(0, .5, 0)), q.add(new THREE.Vector3(0, .5, 0)), .3, 1);
    }
  }
  // Supports stay on the separate approach, clear of the bridge merge and branch mouths.
  for (const s of hoanApproachSupportStations) {
    if (joints.some(j => Math.abs(s - j) < 22)) continue;
    const f = frame(s), top = surfaceAt(s, f.p.x, f.p.z) - .9;
    const base = groundAt(f.p.x, f.p.z);
    if (top <= base + 2) continue;
    const pillar = new THREE.BoxGeometry(1.8, top - base, 1.8);
    pillar.translate(f.p.x, (top + base) / 2, f.p.z); furniture.push(pillar);
    beam(furniture, f.p.clone().addScaledVector(f.side, -f.width * .4).setY(top),
      f.p.clone().addScaledVector(f.side, f.width * .4).setY(top), 1.4, .7);
  }
  for (let s = 8; s < total - 20; s += 12) {
    if (joints.some(j => Math.abs(s - j) < 12)) continue;
    const a = at(s).p, b = at(s + 4).p;
    a.y = surfaceAt(s, a.x, a.z) + .02; b.y = surfaceAt(s + 4, b.x, b.z) + .02;
    beam(marking, a, b, .12, .025);
  }
  const mesh = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material) => {
    geometry.computeVertexNormals();
    const object = new THREE.Mesh(geometry, material); object.name = name;
    object.castShadow = true; object.receiveShadow = true; group.add(object);
  };
  const arrayGeometry = (positions: number[]) => new THREE.BufferGeometry()
    .setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  // A very short source segment at a tight bend can reverse one ribbon triangle.
  // Keep asphalt front faces upward without making the entire material double-sided.
  for (let i = 0; i < road.length; i += 9) {
    const ax = road[i + 3] - road[i], az = road[i + 5] - road[i + 2];
    const bx = road[i + 6] - road[i], bz = road[i + 8] - road[i + 2];
    if (az * bx - ax * bz < 0) {
      for (let k = 0; k < 3; k++) [road[i + 3 + k], road[i + 6 + k]] = [road[i + 6 + k], road[i + 3 + k]];
    }
  }
  mesh('hoan-southbound-roadway', arrayGeometry(road), new THREE.MeshStandardMaterial({ color: 0x45484b, roughness: .92 }));
  const slab = arrayGeometry(concrete);
  // Normalizing the box geometry permits one merged concrete/support draw.
  const parts = [slab, ...furniture.map(g => { const flat = g.toNonIndexed(); g.dispose(); return flat; })];
  const combined = mergeGeometries(parts.map(g => { g.deleteAttribute('normal'); g.deleteAttribute('uv'); return g; }), false)!;
  parts.forEach(g => g.dispose());
  mesh('hoan-southbound-concrete', combined, new THREE.MeshStandardMaterial({ color: 0xaaa69d, roughness: .95 }));
  if (marking.length) {
    const merged = mergeGeometries(marking, false)!; marking.forEach(g => g.dispose());
    mesh('hoan-southbound-markings', merged, new THREE.MeshLambertMaterial({ color: 0xe8e2ce }));
  }
  group.userData.sourceWayIds = hoanSouthboundSource.map(w => w.wayId);
  group.userData.junctions = joints.map(s => at(s).p.toArray());
  group.userData.tieIn = edge(total, 0).toArray();
  group.userData.tieInEdges = [-1, 1].map(sign => edge(total, sign).toArray());
  group.userData.supportStations = [...hoanApproachSupportStations];
  group.userData.estimatedElevations = 'Pipeline source deck heights; final source segment blended into the custom Hoan deck before overlap.';
  return group;
}

/** Open the existing outer Hoan railing where the restored roadway actually merges. */
export function withinHoanApproachMerge(x: number, z: number) {
  if (z < 700 || z > 940) return false;
  const source = hoanSouthboundSource.at(-1)!;
  for (let i = 1; i < source.points.length; i++) {
    const a = source.points[i - 1], b = source.points[i], dx = b[0] - a[0], dz = b[2] - a[2];
    const t = THREE.MathUtils.clamp(((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz), 0, 1);
    if (Math.hypot(x - a[0] - t * dx, z - a[2] - t * dz) < source.widthM / 2 + 1.5) return true;
  }
  return false;
}
