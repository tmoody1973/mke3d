import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type HopVehicleMode = 'day' | 'sunset' | 'night';

export interface HopSectionPose {
  position: readonly [number, number, number] | THREE.Vector3;
  yaw: number;
  pitch: number;
}

export interface HopPose {
  sections: readonly [HopSectionPose, HopSectionPose, HopSectionPose];
}

export interface HopVehicle {
  group: THREE.Group;
  sectionGroups: {
    front: THREE.Group;
    center: THREE.Group;
    rear: THREE.Group;
  };
  applyPose(pose: HopPose): void;
  setDoors(amount: number, side: 'left' | 'right'): void;
  setMode(mode: HopVehicleMode): void;
  dispose(): void;
}

export const HOP_LENGTH_M = 20.4;
export const HOP_WIDTH_M = 2.64;
export const HOP_HEIGHT_M = 3.5;
export const HOP_SECTION_LENGTHS = [6.8, 5.6, 6.8] as const;
export const HOP_SECTION_CENTERS = [6.8, 0, -6.8] as const;
export const HOP_BELLOWS_GAP_M = 0.6;

const BODY_WHITE = new THREE.Color(0xe9ecea);
const BODY_SILVER = new THREE.Color(0xb4a17b);
const DARK = new THREE.Color(0x172126);
const TIRE = new THREE.Color(0x17191a);
const GLASS = new THREE.Color(0x40565b);
const GOLD = new THREE.Color(0xc8a446);
const HEADLIGHT = new THREE.Color(0xfff4d4);
const TAILLIGHT = new THREE.Color(0xb62424);

type Part = THREE.BufferGeometry;

function baked(
  source: THREE.BufferGeometry,
  color: THREE.Color,
  position = new THREE.Vector3(),
  rotation = new THREE.Euler(),
  scale = new THREE.Vector3(1, 1, 1),
): Part {
  const geometry = source.index ? source.toNonIndexed() : source.clone();
  source.dispose();
  geometry.deleteAttribute('uv');
  geometry.applyMatrix4(new THREE.Matrix4().compose(
    position,
    new THREE.Quaternion().setFromEuler(rotation),
    scale,
  ));
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function box(
  size: [number, number, number],
  at: [number, number, number],
  color: THREE.Color,
  rotation = new THREE.Euler(),
) {
  return baked(new THREE.BoxGeometry(...size), color, new THREE.Vector3(...at), rotation);
}

function merge(parts: Part[]) {
  const geometry = mergeGeometries(parts, false);
  parts.forEach(part => part.dispose());
  if (!geometry) throw new Error('The Hop vehicle geometry could not be merged');
  geometry.computeBoundingSphere();
  return geometry;
}

type Point = [number, number, number];

function quad(a: Point, b: Point, c: Point, d: Point, color: THREE.Color, outward: Point) {
  const positions = [...a, ...b, ...c, ...a, ...c, ...d];
  const normal = new THREE.Vector3(...b).sub(new THREE.Vector3(...a))
    .cross(new THREE.Vector3(...c).sub(new THREE.Vector3(...a)));
  if (normal.dot(new THREE.Vector3(...outward)) < 0) {
    positions.splice(0, positions.length, ...a, ...c, ...b, ...a, ...d, ...c);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return baked(geometry, color);
}

// Shared curved, raked skin coordinates keep glass visibly outside the cab shell.
function nosePoint(length: number, direction: -1 | 1, angle: number, y: number, offset = 0): Point {
  return [Math.cos(angle) * (1.30 + offset), y,
    direction * (length / 2 - .67 - Math.max(0, y - 1.0) * .10 + Math.sin(angle) * (.67 + offset))];
}

function roundedShell(length: number, direction: -1 | 0 | 1) {
  const parts: Part[] = [];
  const levels = [[.44, .96], [.66, 1], [1.18, 1], [2.62, 1],
    [2.91, 1], [3.15, .965], [3.32, .86], [3.42, .62]];
  const half = length / 2;
  const plan: [number, number][] = direction
    ? [[-1.3, -half], [1.3, -half], ...Array.from({ length: 13 }, (_, i) => {
      const a = i * Math.PI / 12;
      return [1.3 * Math.cos(a), half - .67 + .67 * Math.sin(a)] as [number, number];
    })]
    : [[-1.3, -half], [1.3, -half], [1.3, half], [-1.3, half]];
  const point = (index: number, level: number): Point => {
    const [y, width] = levels[level];
    const [x, z] = plan[index];
    const isCab = direction && index >= 2;
    return [x * width, y,
      direction ? direction * (z - (isCab ? Math.max(0, y - 1) * .1 : 0)) : z];
  };
  for (let layer = direction ? 0 : 3; layer < levels.length - 1; layer++) {
    const color = layer === 1 ? BODY_SILVER : layer === 2 ? DARK : BODY_WHITE;
    for (let i = 0; i < plan.length; i++) {
      const j = (i + 1) % plan.length;
      const a = point(i, layer), b = point(j, layer), c = point(j, layer + 1), d = point(i, layer + 1);
      const faceColor = direction && layer === 1 && i >= 2 && i < plan.length - 1 ? DARK : color;
      parts.push(quad(a, b, c, d, faceColor, [(a[0] + b[0]) / 2, 0, (a[2] + b[2]) / 2]));
    }
  }
  for (let i = 0; i < plan.length; i++) {
    parts.push(quad(point(i, 7), point((i + 1) % plan.length, 7),
      [0, 3.42, 0], [0, 3.42, 0], BODY_WHITE, [0, 1, 0]));
  }
  if (!direction) {
    // Open doors expose this inset vestibule, with exterior panels only between bays.
    parts.push(box([2.38, 2.13, length], [0, 1.555, 0], DARK));
    for (const side of [-1, 1]) {
      for (const [z, span] of [[-2.47, .66], [0, 1.74], [2.47, .66]]) {
        parts.push(box([.075, .25, span], [side * 1.255, .555, z], BODY_WHITE));
        parts.push(box([.075, .51, span], [side * 1.255, .935, z], BODY_SILVER));
      }
      for (const bay of [-1.5, 1.5]) {
        parts.push(box([.17, .065, 1.3], [side * 1.205, .475, bay], BODY_SILVER));
        parts.push(box([.022, .028, 1.23], [side * 1.302, .509, bay], GOLD));
        for (const edge of [-.65, .65]) {
          parts.push(box([.105, 2.08, .035], [side * 1.245, 1.54, bay + edge], BODY_SILVER));
        }
      }
    }
  }
  return parts;
}

function wheelParts(cabDirection: -1 | 0 | 1) {
  if (cabDirection === 0) return [];
  const parts: Part[] = [];
  for (const z of [-.9, .9]) for (const x of [-.76, .76]) {
    parts.push(baked(new THREE.CylinderGeometry(.32, .32, .16, 12), TIRE,
      new THREE.Vector3(x, .32, z), new THREE.Euler(0, 0, Math.PI / 2)));
    parts.push(baked(new THREE.CylinderGeometry(.21, .21, .018, 12), new THREE.Color(0x687071),
      new THREE.Vector3(x + Math.sign(x) * .086, .32, z), new THREE.Euler(0, 0, Math.PI / 2)));
  }
  parts.push(box([1.9, .22, 2.35], [0, .49, 0], DARK));
  for (const side of [-1, 1]) {
    parts.push(box([.10, .18, 2.5], [side * .98, .38, 0], DARK));
    for (const z of [-.95, .95]) parts.push(box([.16, .27, .24], [side * .94, .41, z], new THREE.Color(0x545d60)));
  }
  return parts;
}

function wordmarkParts(length: number, direction: -1 | 0 | 1) {
  const parts: Part[] = [];
  const letters = 'THEHOP';
  const glyphs: Record<string, [number, number, number, number][]> = {
    T: [[0, 1, 1, 1], [.5, 0, .5, 1]],
    H: [[0, 0, 0, 1], [1, 0, 1, 1], [0, .5, 1, .5]],
    E: [[0, 0, 0, 1], [0, 0, 1, 0], [0, .5, 1, .5], [0, 1, 1, 1]],
    O: [[0, 0, 0, 1], [1, 0, 1, 1], [0, 0, 1, 0], [0, 1, 1, 1]],
    P: [[0, 0, 0, 1], [1, .5, 1, 1], [0, .5, 1, .5], [0, 1, 1, 1]],
  };
  const text = (place: (u: number, y: number) => THREE.Vector3, scale: number, low: number) => {
    for (let i = 0; i < letters.length; i++) for (const [ax, ay, bx, by] of glyphs[letters[i]]) {
      const start = (i - 3) * .31 + (i >= 3 ? .16 : 0);
      parts.push(cylinderBetween(place((start + ax * .21) * scale, low + ay * .32 * scale),
        place((start + bx * .21) * scale, low + by * .32 * scale), .014 * scale, GOLD));
    }
  };
  if (direction === 0) for (const side of [-1, 1]) {
    text((u, y) => new THREE.Vector3(side * 1.305, y, -side * u), 1, 2.82);
  }
  if (direction) {
    text((u, y) => new THREE.Vector3(...nosePoint(length, direction, Math.acos(direction * u / 1.3), y, .012)), .80, 2.965);
  }
  return parts;
}

function bodyGeometry(length: number, cabDirection: -1 | 0 | 1, trim: THREE.Color) {
  const parts = roundedShell(length, cabDirection);
  const sideLength = length - (cabDirection ? 1.45 : .06);
  for (const side of [-1, 1]) {
    parts.push(box([.02, .155, sideLength], [side * 1.307, 2.655, -.68 * cabDirection], trim));
    if (cabDirection) {
      for (let z = -2.16; z <= 2.33; z += 1.12) {
        parts.push(box([.016, 1.43, .065], [side * 1.307, 1.90, z * cabDirection], DARK));
        parts.push(box([.012, .62, .016], [side * 1.302, .83, z * cabDirection], new THREE.Color(0x7c796e)));
      }
      parts.push(box([.018, .06, .40], [side * 1.31, .85, cabDirection * 1.60], GOLD));
      // Shoulder louvers track the rounded fascia instead of adding an HVAC block.
      for (let i = 0; i < 7; i++) {
        const y = 2.97 + i * .043;
        const x = y <= 3.15 ? 1.3 * (1 - (y - 2.91) * .035 / .24)
          : 1.3 * (.965 - (y - 3.15) * .105 / .17);
        parts.push(box([.013, .014, .82], [side * (x + .004), y, cabDirection * 1.77], DARK));
      }
    }
  }
  if (cabDirection) for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 12, b = (i + 1) * Math.PI / 12;
    parts.push(quad(nosePoint(length, cabDirection, a, .72, .008),
      nosePoint(length, cabDirection, b, .72, .008),
      nosePoint(length, cabDirection, b, 2.91, .008),
      nosePoint(length, cabDirection, a, 2.91, .008), DARK,
      [Math.cos((a + b) / 2), 0, cabDirection * Math.sin((a + b) / 2)]));
  }
  // Flush roof hatches / grilles keep a nearly continuous roof silhouette.
  for (const z of [-1.3, .75]) {
    parts.push(box([1.18, .018, 1.25], [0, 3.432, z], new THREE.Color(0xcbd0cd)));
    for (let i = 0; i < 9; i++) parts.push(box([.93, .012, .022], [0, 3.446, z - .45 + i * .11], new THREE.Color(0x788181)));
  }
  parts.push(...wheelParts(cabDirection), ...wordmarkParts(length, cabDirection));
  if (cabDirection) {
    const wp = (x: number, y: number) => new THREE.Vector3(...nosePoint(length, cabDirection, Math.acos(x / 1.3), y, .024));
    parts.push(cylinderBetween(wp(.31, 1.19), wp(.60, 1.79), .018, DARK));
    parts.push(cylinderBetween(wp(.60, 1.79), wp(.70, 2.14), .014, DARK));
  }
  return merge(parts);
}

function glazingGeometry(length: number, cabDirection: -1 | 0 | 1, lineName: string) {
  const parts: Part[] = [];
  for (const side of [-1, 1]) {
    const panes = cabDirection
      ? Array.from({ length: 5 }, (_, i) => [-2.72 + i * 1.12, 1.04])
      : [[0, 1.52], [-2.49, .39], [2.49, .39]];
    for (const [z, span] of panes) {
      parts.push(box([.012, 1.26, span], [side * 1.314, 1.895, z * (cabDirection || 1)], GLASS));
    }
  }
  if (cabDirection) {
    for (const side of [-1, 1]) {
      parts.push(quad([side * 1.314, 1.29, cabDirection * 2.34],
        [side * 1.314, 1.29, cabDirection * 2.64],
        [side * 1.314, 2.53, cabDirection * 2.53],
        [side * 1.314, 2.53, cabDirection * 2.34], GLASS, [side, 0, 0]));
    }
    for (let i = 0; i < 12; i++) {
      const a = .44 + i * (Math.PI - .88) / 12, b = .44 + (i + 1) * (Math.PI - .88) / 12;
      const bottom = (angle: number) => 1.16 + .18 * Math.pow(Math.cos(angle), 4);
      const top = (angle: number) => 2.82 - .07 * Math.pow(Math.cos(angle), 4);
      parts.push(quad(nosePoint(length, cabDirection, a, bottom(a), .012),
        nosePoint(length, cabDirection, b, bottom(b), .012),
        nosePoint(length, cabDirection, b, top(b), .012),
        nosePoint(length, cabDirection, a, top(a), .012), GLASS,
        [Math.cos((a + b) / 2), 0, cabDirection * Math.sin((a + b) / 2)]));
    }
    const z = cabDirection * (length / 2 - .17 + .027);
    parts.push(box([.92, .22, .014], [0, 2.68, z], DARK));
    const faceZ = z + cabDirection * .009;
    const glyphBox = (size: [number, number], at: [number, number], angle = 0) => parts.push(box(
      [size[0], size[1], .004], [at[0] * cabDirection, at[1], faceZ], GOLD, new THREE.Euler(0, 0, angle * cabDirection)));
    if (/^l/i.test(lineName)) {
      glyphBox([.045, .12], [-.09, 2.68]); glyphBox([.20, .04], [0, 2.63]);
    } else {
      glyphBox([.04, .13], [-.13, 2.68]); glyphBox([.04, .13], [.13, 2.68]);
      glyphBox([.04, .15], [-.065, 2.685], .60); glyphBox([.04, .15], [.065, 2.685], -.60);
    }
  }
  return merge(parts);
}

function lampGeometry(length: number, cabDirection: -1 | 1) {
  const parts: Part[] = [];
  for (const x of [-.72, .72]) {
    const position = new THREE.Vector3(...nosePoint(length, cabDirection, Math.acos(x / 1.3), .82, .025));
    parts.push(baked(new THREE.SphereGeometry(.077, 10, 6), cabDirection === 1 ? HEADLIGHT : TAILLIGHT,
      position, new THREE.Euler(), new THREE.Vector3(1, 1, .55)));
  }
  return merge(parts);
}

function doorLeafGeometry() {
  const parts = [box([.022, 1.97, .60], [0, 0, 0], DARK)];
  for (const side of [-1, 1]) {
    parts.push(box([.005, 1.26, .51], [side * .0135, .25, 0], GLASS));
    parts.push(box([.005, .43, .51], [side * .0135, -.62, 0], BODY_SILVER));
    parts.push(box([.005, .11, .56], [side * .0135, -.91, 0], BODY_WHITE));
    parts.push(box([.005, .025, .59], [side * .0135, -.97, 0], GOLD));
    parts.push(box([.005, .12, .021], [side * .014, -.03, .20], BODY_SILVER));
  }
  return merge(parts);
}

function bellowsGeometry() {
  const parts: Part[] = [box([2.38, 2.45, .76], [0, 0, 0], new THREE.Color(0x343a3c))];
  for (let z = -.36; z <= .361; z += .12) {
    parts.push(box([2.48, 2.52, .035], [0, 0, z], new THREE.Color(0x555b5c)));
  }
  return merge(parts);
}

function cylinderBetween(a: THREE.Vector3, b: THREE.Vector3, radius: number, color: THREE.Color) {
  const delta = b.clone().sub(a);
  const midpoint = a.clone().add(b).multiplyScalar(.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
  const geometry = new THREE.CylinderGeometry(radius, radius, delta.length(), 8);
  const bakedGeometry = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  geometry.dispose();
  bakedGeometry.deleteAttribute('uv');
  bakedGeometry.applyMatrix4(new THREE.Matrix4().compose(midpoint, quaternion, new THREE.Vector3(1, 1, 1)));
  const count = bakedGeometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
  bakedGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return bakedGeometry;
}

function pantographGeometry() {
  const color = new THREE.Color(0x3d4548);
  const parts: Part[] = [box([1.25, .06, .52], [0, 3.46, 0], color)];
  for (const x of [-.34, .34]) {
    parts.push(cylinderBetween(new THREE.Vector3(x, 3.47, -.58), new THREE.Vector3(x, 3.48, .28), .025, color));
    parts.push(cylinderBetween(new THREE.Vector3(x, 3.48, .28), new THREE.Vector3(x, 3.47, .76), .025, color));
  }
  parts.push(cylinderBetween(new THREE.Vector3(-.58, 3.48, .3), new THREE.Vector3(.58, 3.48, .3), .025, color));
  return merge(parts);
}

function makeSection(
  name: 'front' | 'center' | 'rear',
  length: number,
  cabDirection: -1 | 0 | 1,
  trim: THREE.Color,
  bodyMaterial: THREE.MeshStandardMaterial,
  glassMaterial: THREE.MeshStandardMaterial,
  lineName: string,
  lampMaterial?: THREE.MeshLambertMaterial,
) {
  const group = new THREE.Group();
  group.name = `hop-${name}-section`;
  const body = new THREE.Mesh(bodyGeometry(length, cabDirection, trim), bodyMaterial);
  body.name = `hop-${name}-body-shell-wheels-hvac`;
  body.castShadow = true;
  body.receiveShadow = true;
  body.userData.wheelContactY = cabDirection ? 0 : null;
  body.userData.wheelCentersX = cabDirection ? [-.76, .76] : [];
  const glazing = new THREE.Mesh(glazingGeometry(length, cabDirection, lineName), glassMaterial);
  glazing.name = `hop-${name}-wrapped-glazing-route-display-interior`;
  group.add(body, glazing);
  if (cabDirection && lampMaterial) {
    const lamps = new THREE.Mesh(lampGeometry(length, cabDirection), lampMaterial);
    lamps.name = cabDirection === 1 ? 'hop-forward-headlamps' : 'hop-rear-taillamps';
    group.add(lamps);
  }
  return group;
}

function readPosition(value: HopSectionPose['position'], target: THREE.Vector3) {
  if (value instanceof THREE.Vector3) target.copy(value);
  else target.set(value[0], value[1], value[2]);
}

/**
 * Build a lightweight Brookville Liberty-style vehicle for The Hop.
 * Local +Z is forward and each section group's local y=0 is the rail plane.
 */
export function createHopVehicle(lineName: string): HopVehicle {
  const group = new THREE.Group();
  group.name = `the-hop-${lineName || 'scheduled'}-vehicle`;
  // Original blue/champagne livery is shared by both routes.
  const trim = new THREE.Color(0x3775b3);
  const bodyMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .52, metalness: .12, emissive: 0x000000 });
  const glassMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .30, metalness: .08, emissive: 0x000000 });
  const headlightMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x000000 });
  const taillightMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x000000 });
  const doorMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x000000 });
  const bellowsMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, color: 0x777777 });
  const pantographMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, color: 0x777777 });

  const front = makeSection('front', 6.8, 1, trim, bodyMaterial, glassMaterial, lineName, headlightMaterial);
  const center = makeSection('center', 5.6, 0, trim, bodyMaterial, glassMaterial, lineName);
  const rear = makeSection('rear', 6.8, -1, trim, bodyMaterial, glassMaterial, lineName, taillightMaterial);
  front.position.z = HOP_SECTION_CENTERS[0];
  rear.position.z = HOP_SECTION_CENTERS[2];
  group.add(front, center, rear);

  const doors: Record<'left' | 'right', THREE.Mesh[]> = { left: [], right: [] };
  const doorGeometry = doorLeafGeometry();
  for (const [sideName, x] of [['left', -1.303], ['right', 1.303]] as const) {
    for (const [bayIndex, bayZ] of [-1.5, 1.5].entries()) {
      for (const [leaf, offset] of [['trailing', -.31], ['leading', .31]] as const) {
        const z = bayZ + offset;
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.name = `hop-door-${sideName}-${bayIndex + 1}-${leaf}`;
        door.position.set(x, 1.51, z);
        door.userData.closedZ = z;
        door.userData.closedX = x;
        door.userData.bayCenterZ = bayZ;
        door.userData.openDirection = Math.sign(offset);
        doors[sideName].push(door);
        center.add(door);
      }
    }
  }

  const bellowsGeo = bellowsGeometry();
  const frontBellows = new THREE.Mesh(bellowsGeo, bellowsMaterial);
  frontBellows.name = 'hop-front-center-connected-bellows';
  const rearBellows = new THREE.Mesh(bellowsGeo, bellowsMaterial);
  rearBellows.name = 'hop-center-rear-connected-bellows';
  group.add(frontBellows, rearBellows);

  const pantograph = new THREE.Mesh(pantographGeometry(), pantographMaterial);
  pantograph.name = 'hop-folded-off-wire-pantograph';
  center.add(pantograph);

  function sectionPoint(section: THREE.Group, z: number) {
    group.updateMatrixWorld(true);
    return group.worldToLocal(section.localToWorld(new THREE.Vector3(0, 1.82, z)));
  }

  function updateBellows(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3) {
    const delta = b.clone().sub(a);
    const length = delta.length();
    mesh.position.copy(a).add(b).multiplyScalar(.5);
    if (length > 1e-6) {
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), delta.multiplyScalar(1 / length));
    } else {
      mesh.quaternion.identity();
    }
    mesh.scale.set(1, 1, Math.max(.08, length / .76));
  }

  function updateBellowsPositions() {
    updateBellows(frontBellows, sectionPoint(center, 2.8), sectionPoint(front, -3.4));
    updateBellows(rearBellows, sectionPoint(rear, 3.4), sectionPoint(center, -2.8));
  }

  function applyPose(pose: HopPose) {
    const sections = [front, center, rear];
    pose.sections.forEach((sectionPose, index) => {
      readPosition(sectionPose.position, sections[index].position);
      sections[index].rotation.set(-sectionPose.pitch, sectionPose.yaw, 0, 'YXZ');
    });
    updateBellowsPositions();
  }

  function setDoors(amount: number, side: 'left' | 'right') {
    const opening = THREE.MathUtils.clamp(amount, 0, 1);
    for (const door of doors[side]) {
      door.position.z = door.userData.closedZ + door.userData.openDirection * .53 * opening;
      // Plug-sliding leaves clear the neighboring glass while moving along the side.
      door.position.x = door.userData.closedX + Math.sign(door.userData.closedX) * .032 * Math.min(1, opening * 5);
    }
    group.userData.doors[side] = opening;
  }

  function setMode(mode: HopVehicleMode) {
    const sunset = mode === 'sunset';
    const night = mode === 'night';
    bodyMaterial.emissive.setHex(night ? 0x080b0c : 0x000000);
    bodyMaterial.emissiveIntensity = night ? .14 : 0;
    glassMaterial.emissive.setHex(night ? 0x263225 : sunset ? 0x17160e : 0x000000);
    glassMaterial.emissiveIntensity = night ? .34 : sunset ? .12 : 0;
    headlightMaterial.emissive.copy(HEADLIGHT);
    headlightMaterial.emissiveIntensity = night ? .8 : sunset ? .24 : 0;
    taillightMaterial.emissive.copy(TAILLIGHT);
    taillightMaterial.emissiveIntensity = night ? .6 : sunset ? .18 : 0;
    doorMaterial.emissive.setHex(night ? 0x131b1c : 0x000000);
    doorMaterial.emissiveIntensity = night ? .18 : 0;
    group.userData.mode = mode;
  }

  function dispose() {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const assigned = Array.isArray(object.material) ? object.material : [object.material];
      assigned.forEach(material => materials.add(material));
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  }

  group.userData.dimensionsM = { length: HOP_LENGTH_M, width: HOP_WIDTH_M, height: HOP_HEIGHT_M };
  group.userData.sectionLengthsM = [...HOP_SECTION_LENGTHS];
  group.userData.forwardAxis = '+Z';
  group.userData.railContactY = 0;
  group.userData.gaugeM = 1.435;
  group.userData.routeDisplay = /^l/i.test(lineName) ? 'L' : 'M';
  group.userData.lineName = lineName;
  group.userData.brand = 'THE HOP';
  group.userData.doors = { left: 0, right: 0 };
  let drawCalls = 0;
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    drawCalls += Array.isArray(object.material) ? object.material.length : 1;
  });
  group.userData.drawCalls = drawCalls;
  group.userData.estimatedDimensions = { height: true, wheelbase: true, roofEquipment: true };
  updateBellowsPositions();
  setMode('day');
  return { group, sectionGroups: { front, center, rear }, applyPose, setDoors, setMode, dispose };
}
