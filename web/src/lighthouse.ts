import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type LighthouseLightingMode = 'day' | 'sunset' | 'night';

const METRES_PER_LON = 81367.90195302747;
const METRES_PER_LAT = 110574;
const TOWER_HEIGHT_M = 74 * 0.3048;

const towerLonLat = [
  [-87.8714387, 43.0655634], [-87.8714156, 43.0655416],
  [-87.8713704, 43.0655415], [-87.8713465, 43.0655623],
  [-87.8713459, 43.0655915], [-87.8713701, 43.0656060],
  [-87.8714153, 43.0656061], [-87.8714381, 43.0655925],
] as const;

const houseLonLat = [
  [-87.8715511, 43.0656351], [-87.8715299, 43.0656351],
  [-87.8714565, 43.0656351], [-87.8714565, 43.0656481],
  [-87.8714154, 43.0656481], [-87.8714153, 43.0656061],
  [-87.8713701, 43.0656060], [-87.8713698, 43.0656508],
  [-87.8712841, 43.0656508], [-87.8712841, 43.0656956],
  [-87.8713106, 43.0656956], [-87.8713106, 43.0657369],
  [-87.8713749, 43.0657369], [-87.8713749, 43.0657487],
  [-87.8715511, 43.0657487],
] as const;

function project([lon, lat]: readonly [number, number]): [number, number] {
  return [(lon + 87.905) * METRES_PER_LON, (43.035 - lat) * METRES_PER_LAT];
}

const towerWorld = towerLonLat.map(project);
const towerBounds = {
  minX: Math.min(...towerWorld.map((p) => p[0])), maxX: Math.max(...towerWorld.map((p) => p[0])),
  minZ: Math.min(...towerWorld.map((p) => p[1])), maxZ: Math.max(...towerWorld.map((p) => p[1])),
};

/** Center of the mapped OSM tower footprint in the city's projected metre grid. */
export const LIGHTHOUSE_SITE = Object.freeze({
  x: (towerBounds.minX + towerBounds.maxX) / 2,
  z: (towerBounds.minZ + towerBounds.maxZ) / 2,
});

type Point = [number, number, number];
type PlanPoint = [number, number];

export const LIGHTHOUSE_TOWER_HEIGHT_M = TOWER_HEIGHT_M;
export const LIGHTHOUSE_TOWER_FOOTPRINT = towerWorld.map(([x, z]) =>
  [x - LIGHTHOUSE_SITE.x, z - LIGHTHOUSE_SITE.z] as PlanPoint);
export const LIGHTHOUSE_HOUSE_FOOTPRINT = houseLonLat.map(project).map(([x, z]) =>
  [x - LIGHTHOUSE_SITE.x, z - LIGHTHOUSE_SITE.z] as PlanPoint);

const WHITE = new THREE.MeshLambertMaterial({ color: 0xf3f1e9 });
const TOWER_WHITE = new THREE.MeshLambertMaterial({ color: 0xf8f7f1 });
const TRIM = new THREE.MeshLambertMaterial({ color: 0xfffdf4 });
const RED_ROOF = new THREE.MeshLambertMaterial({ color: 0x9e3328, side: THREE.DoubleSide });
const BRICK = new THREE.MeshLambertMaterial({ color: 0x704239 });
const DARK = new THREE.MeshLambertMaterial({ color: 0x171b1c });
const STONE = new THREE.MeshLambertMaterial({ color: 0xb9ae9d });

function tri(out: number[], a: Point, b: Point, c: Point) { out.push(...a, ...b, ...c); }
function quad(out: number[], a: Point, b: Point, c: Point, d: Point) {
  tri(out, a, b, d); tri(out, b, c, d);
}

function rawGeometry(positions: number[]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  geometry.translate(x, y, z);
  return geometry;
}

function planExtrusion(points: readonly PlanPoint[], height: number, y = 0) {
  const shape = new THREE.Shape();
  shape.moveTo(points[0][0], -points[0][1]);
  for (const [x, z] of points.slice(1)) shape.lineTo(x, -z);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  return geometry;
}

function frustum(points: readonly PlanPoint[], bottomY: number, topY: number,
  bottomScale: number, topScale: number) {
  const p: number[] = [];
  const ring = (index: number, y: number, scale: number): Point =>
    [points[index][0] * scale, y, points[index][1] * scale];
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    quad(p, ring(i, bottomY, bottomScale), ring(next, bottomY, bottomScale),
      ring(next, topY, topScale), ring(i, topY, topScale));
  }
  const bottomCenter: Point = [0, bottomY, 0], topCenter: Point = [0, topY, 0];
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    tri(p, bottomCenter, ring(next, bottomY, bottomScale), ring(i, bottomY, bottomScale));
    tri(p, topCenter, ring(i, topY, topScale), ring(next, topY, topScale));
  }
  return rawGeometry(p);
}

function beam(a: Point, b: Point, width: number, depth = width) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const direction = end.clone().sub(start);
  const length = direction.length();
  const geometry = new THREE.BoxGeometry(width, length, depth);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0), direction.normalize()));
  geometry.translate(...start.add(end).multiplyScalar(.5).toArray());
  return geometry;
}

function mesh(parts: THREE.BufferGeometry[], material: THREE.Material, name: string) {
  const compatible = parts.map((source) => {
    const geometry = source.index ? source.toNonIndexed() : source.clone();
    geometry.deleteAttribute('uv');
    return geometry;
  });
  const geometry = mergeGeometries(compatible, false);
  if (!geometry) throw new Error(`Unable to merge ${name}`);
  const result = new THREE.Mesh(geometry, material);
  result.name = name; result.castShadow = true; result.receiveShadow = true;
  parts.forEach((part) => part.dispose());
  compatible.forEach((part) => part.dispose());
  return result;
}

function gableAlongX(out: THREE.BufferGeometry[], x0: number, x1: number,
  z0: number, z1: number, eaveY: number, ridgeY: number) {
  const middle = (z0 + z1) / 2;
  const positions: number[] = [];
  quad(positions, [x0, eaveY, z0], [x0, ridgeY, middle], [x1, ridgeY, middle], [x1, eaveY, z0]);
  quad(positions, [x0, ridgeY, middle], [x0, eaveY, z1], [x1, eaveY, z1], [x1, ridgeY, middle]);
  out.push(rawGeometry(positions));
}

function gableAlongZ(out: THREE.BufferGeometry[], x0: number, x1: number,
  z0: number, z1: number, eaveY: number, ridgeY: number) {
  const middle = (x0 + x1) / 2;
  const positions: number[] = [];
  quad(positions, [x0, eaveY, z0], [middle, ridgeY, z0], [middle, ridgeY, z1], [x0, eaveY, z1]);
  quad(positions, [middle, ridgeY, z0], [x1, eaveY, z0], [x1, eaveY, z1], [middle, ridgeY, z1]);
  out.push(rawGeometry(positions));
}

function gableFace(out: THREE.BufferGeometry[], a: Point, peak: Point, b: Point) {
  const positions: number[] = [];
  tri(positions, a, peak, b); tri(positions, b, peak, a);
  out.push(rawGeometry(positions));
}

function windowOnZ(glass: THREE.BufferGeometry[], trim: THREE.BufferGeometry[],
  x: number, y: number, z: number, width = 1.25, height = 1.65) {
  glass.push(box(width, height, .10, x, y, z));
  trim.push(box(width + .28, .12, .15, x, y - height / 2 - .07, z),
    box(width + .28, .12, .15, x, y + height / 2 + .07, z),
    box(.12, height + .38, .15, x - width / 2 - .07, y, z),
    box(.12, height + .38, .15, x + width / 2 + .07, y, z),
    box(.07, height, .16, x, y, z));
}

function windowOnX(glass: THREE.BufferGeometry[], trim: THREE.BufferGeometry[],
  x: number, y: number, z: number, width = 1.25, height = 1.65) {
  glass.push(box(.10, height, width, x, y, z));
  trim.push(box(.15, .12, width + .28, x, y - height / 2 - .07, z),
    box(.15, .12, width + .28, x, y + height / 2 + .07, z),
    box(.15, height + .38, .12, x, y, z - width / 2 - .07),
    box(.15, height + .38, .12, x, y, z + width / 2 + .07),
    box(.16, height, .07, x, y, z));
}

function addHouse(root: THREE.Group, glassMaterial: THREE.Material) {
  root.add(mesh([planExtrusion(LIGHTHOUSE_HOUSE_FOOTPRINT, .38)], STONE,
    'mapped-keeper-house-footprint'));
  const houseWalls = [
    // The mapped outline includes the one-storey tower corridor; the taller masses
    // are kept within it instead of incorrectly extruding the corridor two storeys.
    planExtrusion(LIGHTHOUSE_HOUSE_FOOTPRINT, 3.42, .38),
    box(14.3, 2.08, 11.35, -5.78, 4.82, -13.65),
    box(8.05, 2.08, 9.25, -9.31, 4.82, -11.03),
    box(7.55, 2.08, 5.35, 5.03, 4.82, -11.12),
  ];
  gableFace(houseWalls, [-13.34, 5.86, -6.35], [-9.31, 9.70, -6.35], [-5.28, 5.86, -6.35]);
  gableFace(houseWalls, [.68, 5.86, -7.97], [4.94, 9.42, -7.97], [9.20, 5.86, -7.97]);
  gableFace(houseWalls, [-13.34, 5.86, -19.72], [-5.75, 9.82, -19.72], [1.84, 5.86, -19.72]);
  root.add(mesh(houseWalls, WHITE, 'white-clapboard-keeper-house-and-tower-corridor'));

  const clapboard: THREE.BufferGeometry[] = [];
  for (let y = .72; y < 3.66; y += .32) {
    clapboard.push(box(14.35, .045, .08, -5.75, y, -6.745));
    clapboard.push(box(.08, .045, 12.25, -12.955, y, -13.05));
  }
  for (let y = 3.92; y < 5.70; y += .32) {
    clapboard.push(box(8.0, .045, .08, -9.31, y, -6.385));
    clapboard.push(box(6.1, .045, .08, -2.25, y, -7.94));
    clapboard.push(box(.08, .045, 12.25, -12.955, y, -13.05));
  }
  root.add(mesh(clapboard, TRIM, 'keeper-house-horizontal-clapboard-courses'));

  const roofs: THREE.BufferGeometry[] = [];
  gableAlongX(roofs, -13.35, 1.85, -19.75, -6.33, 5.84, 9.82);
  gableAlongZ(roofs, -13.38, -5.25, -15.9, -6.15, 5.84, 9.70);
  gableAlongZ(roofs, .65, 9.22, -14.05, -7.95, 5.84, 9.42);
  gableAlongX(roofs, -2.25, 2.25, -8.9, -3.25, 4.32, 6.15);
  // Low porch roof wraps the broad south and west elevations.
  gableAlongX(roofs, -13.45, .55, -7.55, -4.6, 3.75, 4.38);
  root.add(mesh(roofs, RED_ROOF, 'red-intersecting-gable-and-porch-roofs'));

  const windows: THREE.BufferGeometry[] = [], trim: THREE.BufferGeometry[] = [];
  for (const x of [-10.8, -7.6, -4.2]) windowOnZ(windows, trim, x, 2.05, -6.72);
  for (const x of [-10.8, -7.6]) windowOnZ(windows, trim, x, 4.65, -6.30);
  windowOnZ(windows, trim, -4.2, 4.65, -7.92);
  for (const y of [2.0, 4.3]) for (const z of [-10.2, -14.1, -17.6])
    windowOnX(windows, trim, -12.95, y, z);
  for (const y of [2.0, 4.25]) windowOnX(windows, trim, 8.84, y, -11.65);
  windowOnZ(windows, trim, 4.9, 2.05, -7.92);
  windowOnZ(windows, trim, -.15, 2.1, -3.23, 1.05, 1.35);
  root.add(mesh(windows, glassMaterial, 'keeper-house-dark-window-panes'));

  const porch: THREE.BufferGeometry[] = [...trim];
  for (const x of [-12.4, -9.3, -6.2, -3.1, .05]) {
    porch.push(box(.16, 3.28, .16, x, 1.94, -4.85));
    porch.push(box(.13, 1.05, .13, x, 1.02, -4.56));
  }
  porch.push(box(14.1, .18, .22, -6.2, 1.54, -4.56), box(14.1, .12, .18, -6.2, .58, -4.56));
  for (let x = -12.1; x < .1; x += .43) porch.push(box(.07, .95, .07, x, 1.05, -4.56));
  for (let step = 0; step < 4; step++) porch.push(box(2.15 + step * .24, .18, .72, -3.2, .18 + step * .18, -4.2 + step * .56));
  root.add(mesh(porch, TRIM, 'white-porch-columns-rails-window-trim-and-steps'));

  const chimney = mesh([box(1.15, 4.15, 1.0, -1.4, 9.58, -14.9)], BRICK, 'keeper-house-brick-chimney');
  root.add(chimney);
}

function addTower(root: THREE.Group, lanternGlass: THREE.Material) {
  const seamY = 35 * .3048;
  const shaftTopY = 17.02;
  root.add(mesh([frustum(LIGHTHOUSE_TOWER_FOOTPRINT, 0, .72, 1, .84)], TOWER_WHITE,
    'mapped-octagonal-tower-plinth'));
  root.add(mesh([frustum(LIGHTHOUSE_TOWER_FOOTPRINT, .72, seamY, .84, .66)], TOWER_WHITE,
    '1912-steel-lower-octagonal-tower'));
  root.add(mesh([frustum(LIGHTHOUSE_TOWER_FOOTPRINT, seamY, shaftTopY, .66, .53)], TOWER_WHITE,
    '1888-cast-iron-upper-octagonal-tower'));

  const whiteBands: THREE.BufferGeometry[] = [];
  for (const [y, scale] of [[.70, .85], [seamY, .67], [shaftTopY - .06, .545]] as const)
    whiteBands.push(frustum(LIGHTHOUSE_TOWER_FOOTPRINT, y - .10, y + .10, scale, scale));
  root.add(mesh(whiteBands, TRIM, 'tower-base-seam-and-cornice-bands'));

  // Riveted panel joints distinguish the 1912 steel lower stage in current photos.
  const steelSeams: THREE.BufferGeometry[] = [];
  for (const [y, scale] of [[2.5, .805], [5.15, .755], [7.8, .708], [10.45, .665]] as const)
    steelSeams.push(frustum(LIGHTHOUSE_TOWER_FOOTPRINT, y - .025, y + .025, scale, scale));
  for (let i = 0; i < LIGHTHOUSE_TOWER_FOOTPRINT.length; i++) {
    const [bx, bz] = LIGHTHOUSE_TOWER_FOOTPRINT[i];
    steelSeams.push(beam([bx * .838, .78, bz * .838], [bx * .662, seamY - .12, bz * .662], .035));
  }
  root.add(mesh(steelSeams, TRIM, '1912-steel-riveted-panel-seams'));

  const roundPanes: THREE.BufferGeometry[] = [], roundTrim: THREE.BufferGeometry[] = [];
  const portholeZ = (y: number, z: number) => {
    const pane = new THREE.CylinderGeometry(.235, .235, .07, 12);
    pane.rotateX(Math.PI / 2); pane.translate(0, y, z); roundPanes.push(pane);
    const surround = new THREE.TorusGeometry(.36, .085, 6, 12); surround.translate(0, y, z + .045); roundTrim.push(surround);
  };
  const portholeX = (y: number, x: number) => {
    const pane = new THREE.CylinderGeometry(.235, .235, .07, 12);
    pane.rotateZ(Math.PI / 2); pane.translate(x, y, 0); roundPanes.push(pane);
    const surround = new THREE.TorusGeometry(.36, .085, 6, 12); surround.rotateY(Math.PI / 2); surround.translate(x + .045, y, 0); roundTrim.push(surround);
  };
  for (const [y, z] of [[4.4, 2.79], [7.65, 2.60], [10.25, 2.43], [16.0, 1.94]] as const) portholeZ(y, z);
  for (const [y, x] of [[3.0, 3.04], [6.25, 2.83], [9.4, 2.61], [16.0, 2.02]] as const) portholeX(y, x);
  root.add(mesh(roundPanes, DARK, 'tower-porthole-dark-glazing'));

  const squarePanes: THREE.BufferGeometry[] = [];
  const squareTrim: THREE.BufferGeometry[] = [...roundTrim];
  const squareZ = (y: number, z: number) => {
    squarePanes.push(box(.54, .78, .07, 0, y, z));
    squareTrim.push(box(.76, .09, .11, 0, y - .46, z + .04), box(.76, .09, .11, 0, y + .46, z + .04),
      box(.09, .98, .11, -.36, y, z + .04), box(.09, .98, .11, .36, y, z + .04),
      box(.88, .10, .16, 0, y + .60, z + .03));
  };
  const squareX = (y: number, x: number) => {
    squarePanes.push(box(.07, .78, .54, x, y, 0));
    squareTrim.push(box(.11, .09, .76, x + .04, y - .46, 0), box(.11, .09, .76, x + .04, y + .46, 0),
      box(.11, .98, .09, x + .04, y, -.36), box(.11, .98, .09, x + .04, y, .36),
      box(.16, .10, .88, x + .03, y + .60, 0));
  };
  squareZ(12.30, 2.24); squareZ(14.35, 2.08);
  squareX(13.25, 2.27); squareX(15.15, 2.12);
  root.add(mesh(squarePanes, DARK, 'tower-narrow-square-window-glazing'));
  root.add(mesh(squareTrim, TRIM, 'habs-porthole-and-square-window-surrounds'));

  // HABS sheet 2 shows a deep white corbelled cornice beneath the gallery.
  const cornice: THREE.BufferGeometry[] = [];
  const lowerFlare = new THREE.CylinderGeometry(2.36, 2.02, .54, 8); lowerFlare.translate(0, 17.29, 0); cornice.push(lowerFlare);
  const upperFlare = new THREE.CylinderGeometry(2.58, 2.36, .34, 8); upperFlare.translate(0, 17.73, 0); cornice.push(upperFlare);
  const ledge = new THREE.CylinderGeometry(2.70, 2.70, .18, 8); ledge.translate(0, 17.99, 0); cornice.push(ledge);
  root.add(mesh(cornice, TOWER_WHITE, 'white-flared-gallery-cornice'));

  const galleryDeck = new THREE.CylinderGeometry(2.68, 2.78, .28, 8);
  galleryDeck.translate(0, 18.20, 0);
  root.add(mesh([galleryDeck], DARK, 'black-octagonal-gallery-deck'));

  const rails: THREE.BufferGeometry[] = [];
  const radius = 2.56;
  for (let i = 0; i < 16; i++) {
    const angle = Math.PI * 2 * i / 16;
    rails.push(box(.075, 1.16, .075, Math.cos(angle) * radius, 18.91, Math.sin(angle) * radius));
  }
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * 2 * i / 8, b = Math.PI * 2 * (i + 1) / 8;
    rails.push(beam([Math.cos(a) * radius, 19.48, Math.sin(a) * radius],
      [Math.cos(b) * radius, 19.48, Math.sin(b) * radius], .09));
  }
  root.add(mesh(rails, DARK, 'black-gallery-railings'));

  const glass = new THREE.CylinderGeometry(1.91, 1.91, 1.98, 8, 1, true);
  glass.translate(0, 19.37, 0);
  root.add(mesh([glass], lanternGlass, 'lantern-room-glazing'));

  const lanternFrames: THREE.BufferGeometry[] = [];
  for (const y of [18.38, 20.38]) {
    const ring = new THREE.CylinderGeometry(2.02, 2.02, .14, 8);
    ring.translate(0, y, 0); lanternFrames.push(ring);
  }
  for (let i = 0; i < 8; i++) {
    const angle = Math.PI * 2 * (i + .5) / 8;
    lanternFrames.push(box(.11, 2.06, .11, Math.cos(angle) * 1.91, 19.38, Math.sin(angle) * 1.91));
  }
  const cap = new THREE.CylinderGeometry(.42, 2.20, .84, 8);
  cap.translate(0, 20.87, 0); lanternFrames.push(cap);
  const finial = new THREE.CylinderGeometry(.10, .15, .50, 8);
  finial.translate(0, 21.50, 0); lanternFrames.push(finial);
  const ballRadius = (TOWER_HEIGHT_M - 21.80) / 2;
  const ball = new THREE.SphereGeometry(ballRadius, 10, 6);
  ball.translate(0, 21.80 + ballRadius, 0); lanternFrames.push(ball);
  root.add(mesh(lanternFrames, DARK, 'black-lantern-frames-shallow-cap-and-finial'));
}

/**
 * Builds the North Point Lighthouse at its mapped world position. Local +Z is south;
 * the house is north of the tower and the tower base rests on the sampled terrain.
 */
export function buildLighthouse(groundAt: (x: number, z: number) => number): THREE.Group {
  const root = new THREE.Group();
  root.name = 'north-point-lighthouse';
  root.position.set(LIGHTHOUSE_SITE.x, groundAt(LIGHTHOUSE_SITE.x, LIGHTHOUSE_SITE.z), LIGHTHOUSE_SITE.z);

  const houseGlass = new THREE.MeshPhongMaterial({ color: 0x263236, shininess: 55, emissive: 0x000000 });
  const lanternGlass = new THREE.MeshPhongMaterial({ color: 0x738d92, shininess: 85,
    transparent: true, opacity: .82, emissive: 0x000000 });
  addHouse(root, houseGlass);
  addTower(root, lanternGlass);

  root.userData = {
    source: { towerOsmWay: 403385102, houseOsmWay: 403385111 },
    towerHeightM: TOWER_HEIGHT_M,
    setLightingMode(mode: LighthouseLightingMode) {
      const color = mode === 'night' ? 0xc58a43 : mode === 'sunset' ? 0x5d331d : 0x000000;
      const intensity = mode === 'night' ? 1.15 : mode === 'sunset' ? .34 : 0;
      houseGlass.emissive.setHex(color); houseGlass.emissiveIntensity = intensity;
      lanternGlass.emissive.setHex(color); lanternGlass.emissiveIntensity = intensity;
      houseGlass.needsUpdate = true; lanternGlass.needsUpdate = true;
    },
  };
  return root;
}
