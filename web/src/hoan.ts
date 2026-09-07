import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { LandmarkGeo } from './landmarks';
import { createHoanLighting, type HoanLightPath } from './hoanLighting.ts';
import { hoanNorthboundJunctions } from './hoanApproachData.ts';
import { buildHoanApproaches, withinHoanApproachMerge } from './hoanApproaches.ts';

type HoanGeo = NonNullable<LandmarkGeo['hoan']>;

const concrete = new THREE.MeshStandardMaterial({ color: 0xaaa69d, roughness: .95 });
const asphalt = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .92 });
const steel = new THREE.MeshStandardMaterial({ color: 0xe7ad32, roughness: .45, metalness: .25 });
const darkConcrete = new THREE.MeshStandardMaterial({ color: 0x77756f, roughness: .95 });
const floorSteel = new THREE.MeshStandardMaterial({ color: 0x566871, roughness: .65, metalness: .2 });
const marking = new THREE.MeshLambertMaterial({ color: 0xe8e2ce });
const safetySteel = new THREE.MeshLambertMaterial({ color: 0x676d70 });

function smoothstep(t: number) {
  const x = THREE.MathUtils.clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function addBoxBetween(out: THREE.BufferGeometry[], a: THREE.Vector3, b: THREE.Vector3,
  width: number, height: number) {
  const delta = b.clone().sub(a);
  const length = delta.length();
  if (length < 0.05 || width <= 0 || height <= 0) return;
  const geometry = new THREE.BoxGeometry(width, height, length);
  // Keep beam width horizontal; a shortest-arc quaternion twists sloped arches.
  const along = delta.normalize();
  const across = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), along);
  if (across.lengthSq() < 1e-8) across.set(1, 0, 0);
  across.normalize();
  const up = new THREE.Vector3().crossVectors(along, across).normalize();
  const matrix = new THREE.Matrix4().compose(
    a.clone().add(b).multiplyScalar(0.5),
    new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, up, along)),
    new THREE.Vector3(1, 1, 1),
  );
  geometry.applyMatrix4(matrix);
  out.push(geometry);
}

// The transverse ties flare smoothly into the arch ribs in the reference
// photographs. Keep the opening clear instead of filling it with X-bracing.
function addHaunchedBeam(out: THREE.BufferGeometry[], a: THREE.Vector3, b: THREE.Vector3,
  thickness: number, depth: number, haunch: number, planeUp = new THREE.Vector3(0, 1, 0)) {
  const along = b.clone().sub(a).normalize();
  const up = planeUp.clone().addScaledVector(along, -planeUp.dot(along)).normalize();
  const normal = new THREE.Vector3().crossVectors(along, up).normalize();
  const length = a.distanceTo(b), reach = Math.min(haunch * 1.4, length * .2);
  const half = depth / 2;
  const profile = new THREE.Shape();
  profile.moveTo(0, half + haunch);
  profile.quadraticCurveTo(0, half, reach, half);
  profile.lineTo(length - reach, half);
  profile.quadraticCurveTo(length, half, length, half + haunch);
  profile.lineTo(length, -half - haunch);
  profile.quadraticCurveTo(length, -half, length - reach, -half);
  profile.lineTo(reach, -half);
  profile.quadraticCurveTo(0, -half, 0, -half - haunch);
  profile.closePath();
  const geometry = new THREE.ExtrudeGeometry(profile, { depth: thickness, bevelEnabled: false, curveSegments: 6 });
  geometry.translate(0, 0, -thickness / 2);
  geometry.applyMatrix4(new THREE.Matrix4().makeBasis(along, up, normal).setPosition(a));
  // BoxGeometry is indexed; normalize this custom profile for the same merge.
  geometry.setIndex(Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i));
  out.push(geometry);
}

function mergedMesh(name: string, geometries: THREE.BufferGeometry[], material: THREE.Material) {
  if (!geometries.length) return null;
  const geometry = mergeGeometries(geometries, false);
  geometries.forEach(g => g.dispose());
  if (!geometry) return null;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Concrete approach portal: curved, spreading legs with an open U-shaped bay. */
function addApproachPortal(out: THREE.BufferGeometry[], center: THREE.Vector3,
  side: THREE.Vector3, baseY: number, topY: number, halfWidth: number) {
  const height = topY - baseY;
  const foot = halfWidth * .52;
  const opening = halfWidth * .12;
  const profile = new THREE.Shape();
  profile.moveTo(-foot, 0);
  profile.lineTo(-foot, height * .14);
  profile.quadraticCurveTo(-foot, height * .55, -halfWidth, height - 2.2);
  profile.lineTo(-halfWidth, height);
  profile.lineTo(halfWidth, height);
  profile.lineTo(halfWidth, height - 2.2);
  profile.quadraticCurveTo(foot, height * .55, foot, height * .14);
  profile.lineTo(foot, 0);
  profile.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-opening, 1.4);
  hole.quadraticCurveTo(-opening - .6, 1.4, -opening - .6, 2.3);
  hole.quadraticCurveTo(-opening - .7, height * .52, -halfWidth + 3.4, height - 3.1);
  hole.quadraticCurveTo(-halfWidth + 3.1, height - 2.6, -halfWidth + 4.2, height - 2.6);
  hole.lineTo(halfWidth - 4.2, height - 2.6);
  hole.quadraticCurveTo(halfWidth - 3.1, height - 2.6, halfWidth - 3.4, height - 3.1);
  hole.quadraticCurveTo(opening + .7, height * .52, opening + .6, 2.3);
  hole.quadraticCurveTo(opening + .6, 1.4, opening, 1.4);
  hole.closePath();
  profile.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(profile, { depth: 3.2, bevelEnabled: false, curveSegments: 12 });
  geometry.translate(0, 0, -1.6);
  const normal = new THREE.Vector3().crossVectors(side, new THREE.Vector3(0, 1, 0)).normalize();
  geometry.applyMatrix4(new THREE.Matrix4().makeBasis(side, new THREE.Vector3(0, 1, 0), normal)
    .setPosition(center.clone().setY(baseY)));
  geometry.setIndex(Array.from({ length: geometry.getAttribute('position').count }, (_, i) => i));
  out.push(geometry);
}

function closedRibbon(stations: number[], frameAt: (station: number) => { center: THREE.Vector3; side: THREE.Vector3 },
  width: number, topOffset: number, thickness: number) {
  const positions: number[] = [];
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) => {
    positions.push(...a.toArray(), ...d.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...b.toArray());
  };
  const section = (s: number) => {
    const f = frameAt(s);
    const top = f.center.clone().add(new THREE.Vector3(0, topOffset, 0));
    return {
      lt: top.clone().addScaledVector(f.side, width / 2),
      rt: top.clone().addScaledVector(f.side, -width / 2),
      lb: top.clone().addScaledVector(f.side, width / 2).add(new THREE.Vector3(0, -thickness, 0)),
      rb: top.clone().addScaledVector(f.side, -width / 2).add(new THREE.Vector3(0, -thickness, 0)),
    };
  };
  let previous = section(stations[0]);
  quad(previous.lt, previous.lb, previous.rb, previous.rt);
  for (let i = 1; i < stations.length; i++) {
    const current = section(stations[i]);
    quad(previous.lt, previous.rt, current.rt, current.lt);
    quad(previous.lb, current.lb, current.rb, previous.rb);
    quad(previous.lt, current.lt, current.lb, previous.lb);
    quad(previous.rt, previous.rb, current.rb, current.rt);
    previous = current;
  }
  quad(previous.lt, previous.rt, previous.rb, previous.lb);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Photo-referenced Hoan Bridge assembled in one station-distance coordinate frame. */
export function buildHoan(h: HoanGeo, groundAt: (x: number, z: number) => number): THREE.Group {
  const root = new THREE.Group();
  root.name = 'hoan-bridge';
  if (h.centerline.length < 2) return root;

  const source = h.centerline.map(([x, z]) => new THREE.Vector2(x, z));
  const cumulative = [0];
  for (let i = 1; i < source.length; i++)
    cumulative.push(cumulative[i - 1] + source[i].distanceTo(source[i - 1]));
  const total = cumulative[cumulative.length - 1];
  if (total < 1) return root;

  const sourceAt = (station: number) => {
    const s = THREE.MathUtils.clamp(station, 0, total);
    let i = 1;
    while (i < cumulative.length - 1 && cumulative[i] < s) i++;
    const span = cumulative[i] - cumulative[i - 1];
    return source[i - 1].clone().lerp(source[i], span > 0 ? (s - cumulative[i - 1]) / span : 0);
  };

  // Project the supplied arch center onto the distance-parametrized source alignment.
  const archCenter = new THREE.Vector2(...h.archCenter);
  let mainStation = 0;
  let nearestSq = Infinity;
  for (let i = 1; i < source.length; i++) {
    const ab = source[i].clone().sub(source[i - 1]);
    const t = THREE.MathUtils.clamp(archCenter.clone().sub(source[i - 1]).dot(ab) / (ab.lengthSq() || 1), 0, 1);
    const q = source[i - 1].clone().addScaledVector(ab, t);
    const d = q.distanceToSquared(archCenter);
    if (d < nearestSq) { nearestSq = d; mainStation = cumulative[i - 1] + t * ab.length(); }
  }

  const span = Math.min(182.88, total * 0.55);
  const halfSpan = span / 2;
  const mainStart = Math.max(0, mainStation - halfSpan);
  const mainEnd = Math.min(total, mainStation + halfSpan);
  const dir = new THREE.Vector2(...h.archDir).normalize();
  const localForward = sourceAt(Math.min(total, mainStation + 5)).sub(sourceAt(Math.max(0, mainStation - 5))).normalize();
  if (dir.dot(localForward) < 0) dir.multiplyScalar(-1);
  const center = sourceAt(mainStation);
  const transition = Math.min(75, Math.max(25, (total - span) * 0.16));
  const sideFrameExtent = 84;
  const leftFrameStart = Math.max(0, mainStart - sideFrameExtent);
  const rightFrameEnd = Math.min(total, mainEnd + sideFrameExtent);
  const structureTransition = 60;
  const structureWeight = (station: number) => {
    if (station >= leftFrameStart && station <= rightFrameEnd) return 1;
    if (station < leftFrameStart) return smoothstep((station - (leftFrameStart - structureTransition)) / structureTransition);
    return smoothstep(((rightFrameEnd + structureTransition) - station) / structureTransition);
  };

  // Replace only the central span with a straight chord, then blend back into the
  // supplied centerline. The first and last points therefore remain unchanged.
  const planAt = (station: number) => {
    const straight = center.clone().addScaledVector(dir, station - mainStation);
    let weight = 0;
    if (station >= mainStart && station <= mainEnd) weight = 1;
    else if (station < mainStart) weight = smoothstep((station - (mainStart - transition)) / transition);
    else weight = smoothstep(((mainEnd + transition) - station) / transition);
    const point = sourceAt(station).lerp(straight, weight);
    point.x -= 8 * structureWeight(station);
    return point;
  };

  // The tile road pipeline raises bridge-tagged roads by 14 m over its +0.4 m
  // surface offset. Allow for our 0.3 m asphalt topping at both endpoints, keeping the harbor span
  // at a fixed lake-datum elevation instead of inheriting carved terrain.
  const endY0 = groundAt(source[0].x, source[0].y) + 14.1;
  const endY1 = groundAt(source[source.length - 1].x, source[source.length - 1].y) + 14.1;
  const mainY = Math.max(38, (h.deckHeightM || 36) + 2);
  const sourceStation = (x: number, z: number) => {
    let best = Infinity, station = 0;
    for (let i = 1; i < source.length; i++) {
      const a = source[i - 1], ab = source[i].clone().sub(a);
      const t = THREE.MathUtils.clamp(new THREE.Vector2(x, z).sub(a).dot(ab) / ab.lengthSq(), 0, 1);
      const distance = new THREE.Vector2(x, z).distanceToSquared(a.clone().addScaledVector(ab, t));
      if (distance < best) { best = distance; station = cumulative[i - 1] + t * ab.length(); }
    }
    return station;
  };
  // These internal source branch elevations are immutable pipeline values: terrain
  // repairs below the freeway must not move the deck away from its tile ramps.
  const northAnchors = [
    { station: mainEnd, y: mainY },
    ...hoanNorthboundJunctions.map(([x, z, asphaltY]) => ({ station: sourceStation(x, z), y: asphaltY - .3 })),
    { station: total, y: endY1 },
  ].sort((a, b) => a.station - b.station);
  const northBranchOpening = (station: number) => northAnchors.slice(1, -1).some(a => Math.abs(a.station - station) < 18);
  const yAt = (station: number) => {
    if (station <= mainStart) return THREE.MathUtils.lerp(endY0, mainY, smoothstep(station / Math.max(mainStart, 1)));
    if (station >= mainEnd) {
      let i = 1;
      while (i < northAnchors.length - 1 && northAnchors[i].station < station) i++;
      const a = northAnchors[i - 1], b = northAnchors[i];
      return THREE.MathUtils.lerp(a.y, b.y, smoothstep((station - a.station) / (b.station - a.station)));
    }
    return mainY;
  };
  const frameAt = (station: number) => {
    const p = planAt(station);
    const a = planAt(Math.max(0, station - 1));
    const b = planAt(Math.min(total, station + 1));
    const tangent = b.sub(a).normalize();
    const widthScale = THREE.MathUtils.lerp(station > mainEnd ? 11.52 / 21.5 : 1, 1.5, structureWeight(station));
    return {
      center: new THREE.Vector3(p.x, yAt(station), p.y),
      side: new THREE.Vector3(-tangent.y, 0, tangent.x).multiplyScalar(widthScale),
    };
  };

  const stationSet = new Set<number>([0, total, mainStart, mainEnd, ...cumulative, ...northAnchors.map(a => a.station)]);
  const sampleStep = Math.min(8, total / 200);
  for (let s = sampleStep; s < total; s += sampleStep) stationSet.add(s);
  const stations = [...stationSet].filter(s => Number.isFinite(s) && s >= 0 && s <= total).sort((a, b) => a - b)
    .filter((s, i, values) => i === 0 || s - values[i - 1] > 0.01);
  const mainStartPoint = frameAt(mainStart).center;
  const mainEndPoint = frameAt(mainEnd).center;
  const slabThickness = .65;
  const archSpringY = 12;
  const archCrownRise = 23;
  const archCrownY = mainY + archCrownRise;
  const archSegments = 36;
  const archY = (station: number) => {
    const u = THREE.MathUtils.clamp((station - mainStart) / Math.max(mainEnd - mainStart, 1), 0, 1);
    return archSpringY + 4 * (archCrownY - archSpringY) * u * (1 - u);
  };
  const archPoint = (station: number, lateral: number) => {
    const frame = frameAt(station);
    return frame.center.clone().addScaledVector(frame.side, lateral).setY(archY(station));
  };
  const sideFramePoint = (station: number, lateral: number, left: boolean) => {
    const outer = left ? leftFrameStart : rightFrameEnd;
    const spring = left ? mainStart : mainEnd;
    const t = THREE.MathUtils.clamp((station - outer) / (spring - outer || 1), 0, 1);
    const frame = frameAt(station);
    const lower = THREE.MathUtils.lerp(frame.center.y - 2.5, archSpringY, smoothstep(t));
    return frame.center.clone().addScaledVector(frame.side, lateral).setY(lower);
  };

  root.userData = {
    mainStation, mainStart, mainEnd, totalStation: total, deckElevation: mainY,
    mainSpanStart: mainStartPoint.toArray(), mainSpanEnd: mainEndPoint.toArray(),
    archSpringY, archCrownY, slabThickness, sideFrameExtent,
    deckWidthM: 36, approachDeckWidthM: 24, centerCorrectionM: [-8, 0], structureTransition,
    northCarriagewayWidthM: 11.52,
    structureEstimates: {
      archSpringY: 'photo-estimated 12 m scene elevation',
      crownRiseAboveDeckM: 'photo-estimated 23 m',
      slabThicknessM: 'photo-estimated 0.65 m',
      girderDepthM: 'photo-estimated 2.4 m',
    },
  };
  const deckGeos: THREE.BufferGeometry[] = [closedRibbon(stations, frameAt, 24, 0, slabThickness)];
  const roadwayGeometry = closedRibbon(stations, frameAt, 21.5, .3, .3);
  // The user's Lake Interchange aerials show pale concrete paving on the
  // mainline approaches. Keep the harbor's existing asphalt treatment.
  const roadwayPositions = roadwayGeometry.getAttribute('position');
  const roadwayColors = new Float32Array(roadwayPositions.count * 3);
  const harborPaving = new THREE.Color(0x45484b), approachPaving = new THREE.Color(0xa4a298);
  for (let i = 0; i < roadwayPositions.count; i++) {
    const color = harborPaving.clone().lerp(approachPaving, 1 - smoothstep((roadwayPositions.getZ(i) - 850) / 120));
    color.toArray(roadwayColors, i * 3);
  }
  roadwayGeometry.setAttribute('color', new THREE.BufferAttribute(roadwayColors, 3));
  const roadGeos: THREE.BufferGeometry[] = [roadwayGeometry];
  const floorGeos: THREE.BufferGeometry[] = [];
  const detailGeos: THREE.BufferGeometry[] = [];
  const markingGeos: THREE.BufferGeometry[] = [];
  const safetyGeos: THREE.BufferGeometry[] = [];
  const archGeos: THREE.BufferGeometry[] = [];
  const supportGeos: THREE.BufferGeometry[] = [];
  const pairedHangerStations: number[] = [];
  const hangerRodSpacing = .46;
  const hangerRodDiameter = .09;
  const portalBeamStations: number[] = [];
  const approachPortals: { station: number; center: number[]; side: number[]; baseY: number; topY: number; halfWidth: number }[] = [];
  let lowClearanceBentCount = 0;

  // Deep longitudinal plate girders remain visible below the thin concrete slab.
  for (let i = 0; i < stations.length - 1; i++) {
    const a = frameAt(stations[i]), b = frameAt(stations[i + 1]);
    for (const lateral of [-10.35, -6.2, -2.05, 2.05, 6.2, 10.35]) {
      addBoxBetween(floorGeos,
        a.center.clone().addScaledVector(a.side, lateral).add(new THREE.Vector3(0, -1.55, 0)),
        b.center.clone().addScaledVector(b.side, lateral).add(new THREE.Vector3(0, -1.55, 0)), .5, 2.4);
    }
    for (const lateral of [-11.45, 11.45]) {
      addBoxBetween(floorGeos,
        a.center.clone().addScaledVector(a.side, lateral).add(new THREE.Vector3(0, -.9, 0)),
        b.center.clone().addScaledVector(b.side, lateral).add(new THREE.Vector3(0, -.9, 0)), .35, 1.1);
      const midpoint = a.center.clone().lerp(b.center, .5).addScaledVector(a.side.clone().lerp(b.side, .5), lateral);
      if (!northBranchOpening((stations[i] + stations[i + 1]) / 2) && !withinHoanApproachMerge(midpoint.x, midpoint.z)) addBoxBetween(detailGeos,
        a.center.clone().addScaledVector(a.side, lateral).add(new THREE.Vector3(0, .88, 0)),
        b.center.clone().addScaledVector(b.side, lateral).add(new THREE.Vector3(0, .88, 0)), .32, 1.15);
    }
    if (stations[i] <= rightFrameEnd) addBoxBetween(detailGeos, a.center.clone().add(new THREE.Vector3(0, .65, 0)),
      b.center.clone().add(new THREE.Vector3(0, .65, 0)), .38, .7);
  }

  const floorStations = [0];
  for (let s = 12; s < total; s += 12) floorStations.push(s);
  floorStations.push(total);
  for (const s of floorStations) {
    const frame = frameAt(s);
    addBoxBetween(floorGeos,
      frame.center.clone().addScaledVector(frame.side, -10.8).add(new THREE.Vector3(0, -1.35, 0)),
      frame.center.clone().addScaledVector(frame.side, 10.8).add(new THREE.Vector3(0, -1.35, 0)), .55, 1.45);
    for (const lateral of [-11.52, 11.52]) {
      const post = frame.center.clone().addScaledVector(frame.side, lateral);
      if (post.z < 930 || northBranchOpening(s) || withinHoanApproachMerge(post.x, post.z)) continue;
      addBoxBetween(safetyGeos,
        frame.center.clone().addScaledVector(frame.side, lateral).add(new THREE.Vector3(0, 1.2, 0)),
        frame.center.clone().addScaledVector(frame.side, lateral).add(new THREE.Vector3(0, 3.45, 0)), .075, .075);
    }
  }
  for (let i = 0; i + 2 < floorStations.length; i += 2) {
    const a = frameAt(floorStations[i]), b = frameAt(floorStations[i + 2]);
    addBoxBetween(floorGeos, a.center.clone().addScaledVector(a.side, -10.1).add(new THREE.Vector3(0, -2.72, 0)),
      b.center.clone().addScaledVector(b.side, 10.1).add(new THREE.Vector3(0, -2.72, 0)), .18, .18);
    addBoxBetween(floorGeos, a.center.clone().addScaledVector(a.side, 10.1).add(new THREE.Vector3(0, -2.72, 0)),
      b.center.clone().addScaledVector(b.side, -10.1).add(new THREE.Vector3(0, -2.72, 0)), .18, .18);
  }
  for (let i = 0; i < stations.length - 1; i++) for (const lateral of [-11.52, 11.52]) {
    const a = frameAt(stations[i]), b = frameAt(stations[i + 1]);
    const midpoint = a.center.clone().lerp(b.center, .5).addScaledVector(a.side.clone().lerp(b.side, .5), lateral);
    if (midpoint.z < 930 || northBranchOpening((stations[i] + stations[i + 1]) / 2) || withinHoanApproachMerge(midpoint.x, midpoint.z)) continue;
    addBoxBetween(safetyGeos, a.center.clone().addScaledVector(a.side, lateral).add(new THREE.Vector3(0, 3.45, 0)),
      b.center.clone().addScaledVector(b.side, lateral).add(new THREE.Vector3(0, 3.45, 0)), .09, .09);
  }
  // Photo 05 shows a closely spaced, see-through roadside screen. Small
  // pickets preserve that texture without adding opaque sheets or new draws.
  let fenceInfillCount = 0;
  for (let s = 1; s < total; s += 1) for (const lateral of [-11.52, 11.52]) {
    const frame = frameAt(s), p = frame.center.clone().addScaledVector(frame.side, lateral);
    if (p.z < 930 || northBranchOpening(s) || withinHoanApproachMerge(p.x, p.z)) continue;
    const isPost = Math.round(s) % 3 === 0;
    addBoxBetween(safetyGeos, p.clone().add(new THREE.Vector3(0, 1.25, 0)),
      p.clone().add(new THREE.Vector3(0, 3.45, 0)), isPost ? .06 : .022, isPost ? .06 : .022);
    fenceInfillCount++;
  }

  // Four broken white lane dividers describe three lanes in each direction.
  // Widen shoulders with the bridge, rather than stretching traffic lanes to 5.1 m.
  const laneOffset = (s: number, lane: number) => {
    const weight = structureWeight(s);
    return .54 * weight + lane * THREE.MathUtils.lerp(3.4, 3.66, weight);
  };
  for (let s = 4; s < total - 1; s += 10) for (const lateral of [-6.8, -3.4, 3.4, 6.8]) {
    if (s > rightFrameEnd && lateral !== -3.4) continue;
    const a = frameAt(s), b = frameAt(Math.min(s + 4, total));
    const sign = Math.sign(lateral), lane = Math.abs(lateral) / 3.4;
    addBoxBetween(markingGeos, a.center.clone().addScaledVector(a.side.clone().normalize(), s > rightFrameEnd ? 0 : sign * laneOffset(s, lane)).add(new THREE.Vector3(0, .325, 0)),
      b.center.clone().addScaledVector(b.side.clone().normalize(), s > rightFrameEnd ? 0 : sign * laneOffset(Math.min(s + 4, total), lane)).add(new THREE.Vector3(0, .325, 0)), .13, .035);
  }
  for (let i = 1; i < stations.length; i++) for (const sign of [-1, 1]) {
    const a = frameAt(stations[i-1]), b = frameAt(stations[i]);
    addBoxBetween(markingGeos, a.center.clone().addScaledVector(a.side.clone().normalize(), sign * (stations[i-1] > rightFrameEnd ? 10.25 * a.side.length() : laneOffset(stations[i-1], 3))).add(new THREE.Vector3(0,.325,0)),
      b.center.clone().addScaledVector(b.side.clone().normalize(), sign * (stations[i] > rightFrameEnd ? 10.25 * b.side.length() : laneOffset(stations[i], 3))).add(new THREE.Vector3(0,.325,0)), .13, .035);
  }
  // Median Y-poles are geometry only; they do not add per-pole lights.
  for (let s = 55; s < total - 30; s += 82) {
    if (s > rightFrameEnd) continue;
    const frame = frameAt(s), foot = frame.center.clone().add(new THREE.Vector3(0, .45, 0));
    const top = frame.center.clone().add(new THREE.Vector3(0, 10.2, 0));
    const tangent = new THREE.Vector3(frame.side.z, 0, -frame.side.x).normalize();
    addBoxBetween(safetyGeos, foot, top, .15, .15);
    for (const side of [-1, 1]) {
      const tip = top.clone().addScaledVector(frame.side.clone().normalize(), side * 2.2).add(new THREE.Vector3(0, .65, 0));
      addBoxBetween(safetyGeos, top, tip, .1, .1);
      addBoxBetween(safetyGeos, tip.clone().addScaledVector(tangent, -.32),
        tip.clone().addScaledVector(tangent, .32), .12, .08);
    }
  }

  // One central spring-to-spring arch. Its end legs descend below the deck;
  // short framed backstays carry the neighboring side spans.
  for (const lateral of [-10.2, 10.2]) {
    for (let i = 0; i < archSegments; i++) {
      const s0 = mainStart + (mainEnd - mainStart) * i / archSegments;
      const s1 = mainStart + (mainEnd - mainStart) * (i + 1) / archSegments;
      addBoxBetween(archGeos, archPoint(s0, lateral), archPoint(s1, lateral), 1.25, 1.6);
    }
    for (let i = 1; i < archSegments; i += 2) {
      const s = mainStart + (mainEnd - mainStart) * i / archSegments;
      const top = archPoint(s, lateral);
      if (top.y <= mainY + .8) continue;
      const frame = frameAt(s);
      if (lateral < 0) pairedHangerStations.push(s);
      const tangent = new THREE.Vector3(frame.side.z, 0, -frame.side.x).normalize();
      for (const offset of [-hangerRodSpacing / 2, hangerRodSpacing / 2]) {
        const bottom = frame.center.clone().addScaledVector(frame.side, lateral).addScaledVector(tangent, offset)
          .add(new THREE.Vector3(0, .1, 0));
        const end = top.clone().addScaledVector(tangent, offset);
        // Round rods read as paired suspension elements in the underside photo.
        const rod = new THREE.CylinderGeometry(hangerRodDiameter / 2, hangerRodDiameter / 2, end.y - bottom.y, 6);
        rod.translate(bottom.x, (bottom.y + end.y) / 2, bottom.z);
        archGeos.push(rod);
      }
    }
    for (const left of [true, false]) {
      const outer = left ? leftFrameStart : mainEnd;
      const inner = left ? mainStart : rightFrameEnd;
      const sideStations = Array.from({ length: 7 }, (_, i) => THREE.MathUtils.lerp(outer, inner, i / 6));
      for (let i = 0; i < sideStations.length - 1; i++) {
        addBoxBetween(archGeos, sideFramePoint(sideStations[i], lateral, left),
          sideFramePoint(sideStations[i + 1], lateral, left), 1.05, 1.25);
      }
      for (let i = 1; i < sideStations.length - 1; i++) {
        const s = sideStations[i], frame = frameAt(s), lower = sideFramePoint(s, lateral, left);
        const deckBottom = frame.center.clone().addScaledVector(frame.side, lateral).add(new THREE.Vector3(0, -.7, 0));
        addBoxBetween(archGeos, lower, deckBottom, .65, .65);
      }
    }
  }
  for (const fraction of [.28, .4, .5, .6, .72]) {
    const s = mainStart + (mainEnd - mainStart) * fraction;
    const before = archPoint(s - .5, 0), after = archPoint(s + .5, 0);
    addHaunchedBeam(archGeos, archPoint(s, -10.2), archPoint(s, 10.2), .65, .9, 1.8,
      after.sub(before).normalize());
  }

  // Open rectangular transverse bays also tie the two lower backstay ribs.
  for (const left of [true, false]) for (let i = 1; i < 6; i++) {
    const s = THREE.MathUtils.lerp(left ? leftFrameStart : mainEnd, left ? mainStart : rightFrameEnd, i / 6);
    addHaunchedBeam(archGeos, sideFramePoint(s, -10.2, left), sideFramePoint(s, 10.2, left), .65, .85, 1.25);
    portalBeamStations.push(s);
  }

  // Main-span end bents and regular approach piers leave the 182.88 m channel open.
  const supportStations = [leftFrameStart, mainStart, mainEnd, rightFrameEnd];
  for (let s = 45; s < leftFrameStart - 25; s += 62) supportStations.push(s);
  for (let s = rightFrameEnd + 45; s < total - 20; s += 62) supportStations.push(s);
  supportStations.sort((a, b) => a - b);
  root.userData.supportStations = [...supportStations];
  for (const s of supportStations) {
    const frame = frameAt(s);
    const mainPier = Math.abs(s - mainStart) < .01 || Math.abs(s - mainEnd) < .01;
    if (mainPier) {
      for (const lateral of [-10.2, 10.2]) {
        const p = frame.center.clone().addScaledVector(frame.side, lateral);
        const ground = groundAt(p.x, p.z);
        addBoxBetween(supportGeos, new THREE.Vector3(p.x, ground - .2, p.z),
          new THREE.Vector3(p.x, ground + .55, p.z), 5.2, 5.2);
        if (ground < archSpringY - .25) addBoxBetween(supportGeos,
          new THREE.Vector3(p.x, ground + .4, p.z), new THREE.Vector3(p.x, archSpringY - .25, p.z), 4.2, 4.2);
        addBoxBetween(supportGeos, new THREE.Vector3(p.x, archSpringY - .45, p.z),
          new THREE.Vector3(p.x, archSpringY + .05, p.z), 2.3, 2.3);
        addBoxBetween(archGeos, new THREE.Vector3(p.x, archSpringY + .35, p.z),
          new THREE.Vector3(p.x, frame.center.y - .7, p.z), .85, .85);
      }
      for (const y of [archSpringY + 4, archSpringY + 10, frame.center.y - 1.1]) {
        addHaunchedBeam(archGeos,
          frame.center.clone().addScaledVector(frame.side, -10.2).setY(y),
          frame.center.clone().addScaledVector(frame.side, 10.2).setY(y), .85, .9, 1.6);
      }
      portalBeamStations.push(s);
      continue;
    }
    // The contemporary underside photo shows flared concrete portals receding
    // along the viaduct. Their open centers and curved legs are part of the
    // silhouette; two straight posts and a rectangular cap lose that identity.
    const unitSide = frame.side.clone().normalize();
    const halfWidth = 11 * frame.side.length();
    const feet = [-1, 1].map(sign => frame.center.clone().addScaledVector(unitSide, sign * halfWidth * .4));
    const baseY = Math.min(...feet.map(p => groundAt(p.x, p.z))) - .2;
    const topY = frame.center.y - 2.95;
    if (topY - baseY > 7) {
      addApproachPortal(supportGeos, frame.center, unitSide, baseY, topY, halfWidth);
      approachPortals.push({ station: s, center: frame.center.toArray(), side: unitSide.toArray(), baseY, topY, halfWidth });
      // Six small bearing seats meet the bottom flanges of the deck girders.
      for (const lateral of [-10.35, -6.2, -2.05, 2.05, 6.2, 10.35]) {
        const p = frame.center.clone().addScaledVector(frame.side, lateral);
        addBoxBetween(supportGeos, p.clone().setY(topY), p.clone().setY(frame.center.y - 2.7), .8, .8);
      }
    } else {
      // A high local terrain sample must never produce an inverted portal.
      lowClearanceBentCount++;
      addBoxBetween(supportGeos, frame.center.clone().setY(Math.min(baseY, topY - .2)),
        frame.center.clone().setY(frame.center.y - .72), halfWidth * 2, 3.2);
    }
  }

  // Direct-view fixtures trace the outer arch/backstay steel faces. Hanger
  // fixtures begin at deck level only where the arch is actually above it.
  const lightPaths: HoanLightPath[] = [];
  for (const side of [-1, 1] as const) {
    const lateral = side * 10.88;
    const arch: [number, number, number][] = [];
    for (let i = 0; i <= 6; i++) arch.push(sideFramePoint(THREE.MathUtils.lerp(leftFrameStart, mainStart, i / 6), lateral, true).toArray());
    for (let i = 1; i <= archSegments; i++) arch.push(archPoint(mainStart + (mainEnd - mainStart) * i / archSegments, lateral).toArray());
    for (let i = 1; i <= 6; i++) arch.push(sideFramePoint(THREE.MathUtils.lerp(mainEnd, rightFrameEnd, i / 6), lateral, false).toArray());
    lightPaths.push({ kind: 'arch', side, points: arch });
    for (let i = 1; i < archSegments; i += 2) {
      const s = mainStart + (mainEnd - mainStart) * i / archSegments;
      const top = archPoint(s, side * 10.2);
      if (top.y <= mainY + .8) continue;
      const frame = frameAt(s);
      const outward = frame.side.clone().normalize().multiplyScalar(side * (hangerRodDiameter / 2 + .025));
      const tangent = new THREE.Vector3(frame.side.z, 0, -frame.side.x).normalize();
      for (const offset of [-hangerRodSpacing / 2, hangerRodSpacing / 2]) {
        const bottom = frame.center.clone().addScaledVector(frame.side, side * 10.2)
          .add(new THREE.Vector3(0, .1, 0)).add(outward).addScaledVector(tangent, offset);
        const fixtureTop = top.clone().add(outward).addScaledVector(tangent, offset);
        lightPaths.push({ kind: 'hanger', side, points: [bottom.toArray(), fixtureTop.toArray()] });
      }
    }
    for (const left of [true, false]) {
      const outer = left ? leftFrameStart : mainEnd;
      const inner = left ? mainStart : rightFrameEnd;
      for (let i = 1; i < 6; i++) {
        const s = THREE.MathUtils.lerp(outer, inner, i / 6);
        const frame = frameAt(s);
        const outward = frame.side.clone().normalize().multiplyScalar(side * (.325 + .025));
        const bottom = sideFramePoint(s, side * 10.2, left).add(outward);
        const top = frame.center.clone().addScaledVector(frame.side, side * 10.2).add(new THREE.Vector3(0, -.7, 0)).add(outward);
        lightPaths.push({ kind: 'hanger', side, points: [bottom.toArray(), top.toArray()] });
      }
    }
    for (const s of [mainStart, mainEnd]) {
      const frame = frameAt(s);
      const outward = frame.side.clone().normalize().multiplyScalar(side * (.425 + .025));
      const bottom = frame.center.clone().addScaledVector(frame.side, side * 10.2).setY(archSpringY + .35).add(outward);
      const top = frame.center.clone().addScaledVector(frame.side, side * 10.2).setY(frame.center.y - .7).add(outward);
      lightPaths.push({ kind: 'hanger', side, points: [bottom.toArray(), top.toArray()] });
    }
    lightPaths.push({ kind: 'deck', side, points: stations.map(s => {
      const frame = frameAt(s);
      return frame.center.clone().addScaledVector(frame.side, side * 12.02).add(new THREE.Vector3(0, -.45, 0)).toArray();
    }) });
  }

  const meshes = [
    mergedMesh('hoan-thin-concrete-deck', deckGeos, concrete),
    mergedMesh('hoan-roadway', roadGeos, asphalt),
    mergedMesh('hoan-bluegray-floor-system', floorGeos, floorSteel),
    mergedMesh('hoan-parapets-median', detailGeos, concrete),
    mergedMesh('hoan-six-lane-markings', markingGeos, marking),
    mergedMesh('hoan-safety-fence-light-poles', safetyGeos, safetySteel),
    mergedMesh('hoan-yellow-arches-hangers-braces', archGeos, steel),
    mergedMesh('hoan-pier-bents', supportGeos, darkConcrete),
  ];
  let structuralTriangles = 0;
  for (const mesh of meshes) if (mesh) {
    root.add(mesh);
    const position = mesh.geometry.getAttribute('position');
    structuralTriangles += (mesh.geometry.index?.count ?? position.count) / 3;
  }
  root.userData.structuralDrawCalls = meshes.filter(Boolean).length;
  root.userData.structuralTriangles = structuralTriangles;
  root.userData.pairedHangerStations = pairedHangerStations;
  root.userData.hangerRodSpacingM = hangerRodSpacing;
  root.userData.hangerRodDiameterM = hangerRodDiameter;
  root.userData.hangerRodCount = pairedHangerStations.length * 4;
  root.userData.portalBeamStations = portalBeamStations;
  root.userData.approachPortals = approachPortals;
  root.userData.lowClearanceBentCount = lowClearanceBentCount;
  root.userData.mainPierDiagonalCount = 0;
  root.userData.fenceInfillCount = fenceInfillCount;
  const lighting = createHoanLighting(lightPaths);
  root.add(lighting.group);
  root.userData.lightPaths = lightPaths;
  root.userData.setLightingMode = lighting.setMode;
  root.userData.updateLighting = lighting.update;
  const deckFrames = stations.map(s => frameAt(s));
  const sampleDeck = (x: number, z: number) => {
    let best = Infinity, height = 0, halfWidth = 0;
    for (let i = 1; i < stations.length; i++) {
      const a = deckFrames[i - 1], b = deckFrames[i];
      const dx = b.center.x - a.center.x, dz = b.center.z - a.center.z;
      const t = THREE.MathUtils.clamp(((x - a.center.x) * dx + (z - a.center.z) * dz) / (dx * dx + dz * dz), 0, 1);
      const distance = Math.hypot(x - a.center.x - t * dx, z - a.center.z - t * dz);
      if (distance < best) {
        best = distance; height = THREE.MathUtils.lerp(a.center.y, b.center.y, t) + .3;
        halfWidth = 10.75 * THREE.MathUtils.lerp(a.side.length(), b.side.length(), t);
      }
    }
    return { height, distance: best, halfWidth };
  };
  root.add(buildHoanApproaches(sampleDeck, groundAt));
  return root;
}
