import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PUBLIC_MARKET_SITE, PUBLIC_MARKET_SOURCE, PUBLIC_MARKET_SOURCES } from './publicMarketSite.ts';

export type PublicMarketLightingMode = 'day' | 'sunset' | 'night';
type Plan = [number, number];
type Point = [number, number, number];
const cos = Math.cos(PUBLIC_MARKET_SITE.bearing), sin = Math.sin(PUBLIC_MARKET_SITE.bearing);
function local([x, z]: readonly [number, number]): Plan {
  const dx = x - PUBLIC_MARKET_SITE.x, dz = z - PUBLIC_MARKET_SITE.z;
  return [cos * dx - sin * dz, sin * dx + cos * dz];
}
function world([x, z]: Plan): Plan {
  return [PUBLIC_MARKET_SITE.x + cos * x + sin * z, PUBLIC_MARKET_SITE.z - sin * x + cos * z];
}
export const PUBLIC_MARKET_FOOTPRINT: Plan[] = PUBLIC_MARKET_SOURCE.footprint.slice(0, -1).map(local);
/** Roof elevations and facade details are photo-based estimates; the plan is OSM-derived. */
export const publicMarketRoofHeight = (z: number) => 8.65 + (z + 10) * .033;

function raw(positions: number[]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
function triangle(out: number[], a: Point, b: Point, c: Point) {
  const ab = new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
  const ac = new THREE.Vector3(...c).sub(new THREE.Vector3(...a));
  if (ab.cross(ac).lengthSq() > 1e-12) out.push(...a, ...b, ...c);
}
function quad(out: number[], a: Point, b: Point, c: Point, d: Point) {
  triangle(out, a, b, c); triangle(out, a, c, d);
}
/** Explicit top winding keeps every shallow roof face upward, including concave service jogs. */
function prism(points: Plan[], bottom: (p: Plan) => number, top: (p: Plan) => number) {
  const out: number[] = [], ring = points.map(([x, z]) => new THREE.Vector2(x, z));
  const area = points.reduce((sum, a, i) => {
    const b = points[(i + 1) % points.length]; return sum + a[0] * b[1] - b[0] * a[1];
  }, 0);
  for (const indices of THREE.ShapeUtils.triangulateShape(ring, [])) {
    const [a, b, c] = indices.map(i => points[i]);
    const topPoints: Point[] = [a, b, c].map(p => [p[0], top(p), p[1]]);
    const crossY = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
    if (crossY < 0) topPoints.reverse();
    triangle(out, topPoints[0], topPoints[1], topPoints[2]);
    const bottomPoints: Point[] = [a, b, c].map(p => [p[0], bottom(p), p[1]]);
    if (crossY > 0) bottomPoints.reverse();
    triangle(out, bottomPoints[0], bottomPoints[1], bottomPoints[2]);
  }
  for (let i = 0; i < points.length; i++) {
    let a = points[i], b = points[(i + 1) % points.length];
    if (area < 0) [a, b] = [b, a];
    quad(out, [a[0], bottom(a), a[1]], [a[0], top(a), a[1]],
      [b[0], top(b), b[1]], [b[0], bottom(b), b[1]]);
  }
  return raw(out);
}
function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z);
}
function beam(a: Point, b: Point, width: number, depth = width) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), axis = end.clone().sub(start);
  return new THREE.BoxGeometry(width, axis.length(), depth)
    .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize()))
    .translate(...start.add(end).multiplyScalar(.5).toArray());
}
function strip(a: Plan, b: Plan, y: number, height: number, depth: number) {
  const geometry = box(Math.hypot(b[0] - a[0], b[1] - a[1]), height, depth, 0, 0, 0);
  geometry.rotateY(-Math.atan2(b[1] - a[1], b[0] - a[0]));
  geometry.translate((a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2);
  return geometry;
}
function mesh(parts: THREE.BufferGeometry[], material: THREE.Material, name: string) {
  const compatible = parts.map(part => {
    const geometry = part.index ? part.toNonIndexed() : part.clone();
    geometry.deleteAttribute('uv'); return geometry;
  });
  const geometry = mergeGeometries(compatible, false);
  if (!geometry) throw new Error(`Could not batch public market ${name}`);
  parts.forEach(part => part.dispose()); compatible.forEach(part => part.dispose());
  const result = new THREE.Mesh(geometry, material);
  result.name = name; result.castShadow = true; result.receiveShadow = true;
  return result;
}

export function buildPublicMarket(groundAt: (x: number, z: number) => number): THREE.Group {
  const root = new THREE.Group(); root.name = 'milwaukee-public-market';
  root.position.set(PUBLIC_MARKET_SITE.x, PUBLIC_MARKET_SITE.floor, PUBLIC_MARKET_SITE.z);
  root.rotation.y = PUBLIC_MARKET_SITE.bearing;
  const steel = new THREE.MeshStandardMaterial({ color: 0x343e40, roughness: .67, metalness: .42 });
  const stone = new THREE.MeshStandardMaterial({ color: 0xc4b48f, roughness: .94 });
  const mortar = new THREE.MeshStandardMaterial({ color: 0xa79a80, roughness: 1 });
  const panel = new THREE.MeshStandardMaterial({ color: 0xa9b0ab, roughness: .7, metalness: .22 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x697375, roughness: .86, metalness: .22 });
  const louver = new THREE.MeshStandardMaterial({ color: 0xe3e2d6, roughness: .65, metalness: .18 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x668b94, roughness: .25, metalness: .34, emissive: 0, emissiveIntensity: 0 });
  const doorGlass = new THREE.MeshStandardMaterial({ color: 0x496c74, roughness: .28, metalness: .35, emissive: 0, emissiveIntensity: 0 });
  const foundation = prism(PUBLIC_MARKET_FOOTPRINT, p => {
    const [x, z] = world(p); return Math.min(.05, groundAt(x, z) - PUBLIC_MARKET_SITE.floor - .08);
  }, () => .22);
  root.add(mesh([foundation], stone, 'mapped-footprint-terrain-foundation'));

  const glassParts: THREE.BufferGeometry[] = [], panelParts: THREE.BufferGeometry[] = [];
  const frame: THREE.BufferGeometry[] = [], masonry: THREE.BufferGeometry[] = [], joints: THREE.BufferGeometry[] = [];
  const roofTrim: THREE.BufferGeometry[] = [];
  for (let i = 0; i < PUBLIC_MARKET_FOOTPRINT.length; i++) {
    const a = PUBLIC_MARKET_FOOTPRINT[i], b = PUBLIC_MARKET_FOOTPRINT[(i + 1) % PUBLIC_MARKET_FOOTPRINT.length];
    const midZ = (a[1] + b[1]) / 2, midX = (a[0] + b[0]) / 2;
    const height = publicMarketRoofHeight(midZ), length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    // Long south and west entrance elevations are glass; north service and east upper walls are metal.
    const glazed = midZ > 10 || midX < -35;
    (glazed ? glassParts : panelParts).push(strip(a, b, 2.06, 3.66, .16));
    (glazed || midX > 35 && midZ > 5 ? glassParts : panelParts).push(strip(a, b, (4.22 + height) / 2, height - 4.22, .16));
    frame.push(strip(a, b, .3, .16, .27), strip(a, b, 3.96, .24, .32), strip(a, b, 5.87, .13, .23));
    roofTrim.push(beam([a[0], publicMarketRoofHeight(a[1]) + .07, a[1]], [b[0], publicMarketRoofHeight(b[1]) + .07, b[1]], .22, .28));
    // Regular glazing mullions are batched even along the long, uninterrupted OSM wall segments.
    if (length > 1.5) for (let n = 0; n <= Math.ceil(length / 2.05); n++) {
      const t = n / Math.ceil(length / 2.05), x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      frame.push(box(.09, publicMarketRoofHeight(z) - .42, .14, x, (publicMarketRoofHeight(z) + .42) / 2, z));
    }
  }

  // The architect's south street elevation: warm masonry below an exposed two-story steel frame.
  const southZ = 14.75;
  for (let i = 0; i <= 12; i++) {
    const x = -37.8 + i * 6.28;
    masonry.push(box(.89, 3.85, .72, x, 2.15, southZ), box(1.05, .18, .88, x, 4.16, southZ));
    frame.push(box(.22, 9.35, .3, x, 4.84, southZ + .18));
    for (let course = 1; course <= 14; course++) joints.push(box(.902, .018, .732, x, .3 + course * .255, southZ));
  }
  // West entrance piers continue the brick / steel rhythm around the highly visible signed elevation.
  for (const z of [-16, -10, -4, 2, 8, 14]) {
    masonry.push(box(.65, 3.8, .85, -37.91, 2.12, z));
    frame.push(box(.29, 8.9, .22, -38.03, 4.7, z));
    for (let course = 1; course <= 14; course++) joints.push(box(.664, .018, .866, -37.91, .3 + course * .255, z));
  }
  // Standing-seam metal panels on the service side and short east end.
  for (let x = -35; x <= 20; x += 1.55) {
    const z = -19.36 + (x + 37.7) * .087;
    frame.push(box(.035, 7.65, .045, x, 4.25, z));
  }
  for (let z = -9; z <= 11; z += 1.5) frame.push(box(.05, 4.1, .035, 38.45, 6.32, z));
  root.add(mesh(glassParts, glass, 'two-level-curtain-wall-glazing'));
  root.add(mesh(panelParts, panel, 'gray-metal-service-and-east-end-panels'));
  root.add(mesh(masonry, stone, 'cream-brick-facade-piers'));
  root.add(mesh(joints, mortar, 'masonry-course-joints'));

  // The built west elevation has a solid brick bay beside the freeway, not glass throughout.
  const westBrick = new THREE.MeshStandardMaterial({ color: 0x8e7460, roughness: .96 });
  root.add(mesh([box(.32, 8.1, 7.35, -38.22, 4.32, -15.05)], westBrick, 'west-north-solid-masonry-bay'));
  const westCourses: THREE.BufferGeometry[] = [];
  for (let y = .55; y < 8.3; y += .28) westCourses.push(box(.025, .018, 7.3, -38.395, y, -15.05));
  root.add(mesh(westCourses, mortar, 'west-masonry-horizontal-courses'));
  root.add(mesh([-18.72, -11.28].map(z => box(.68, 8.65, .55, -38.28, 4.56, z)), stone, 'west-full-height-masonry-pilasters'));

  const roofSkin = prism(PUBLIC_MARKET_FOOTPRINT, p => publicMarketRoofHeight(p[1]), p => publicMarketRoofHeight(p[1]) + .19);
  root.add(mesh([roofSkin], roof, 'shallow-sloping-mapped-roof'));
  // Roof seams are small raised strips; no invented barrel vault or gabled warehouse roof.
  const roofSeams: THREE.BufferGeometry[] = [];
  for (let x = -36; x < 36; x += 3.2) {
    const north = x < 21.5 ? -18.8 + (x + 37.7) * .078 : -9.8;
    roofSeams.push(beam([x, publicMarketRoofHeight(north) + .21, north], [x, publicMarketRoofHeight(14.4) + .21, 14.4], .035, .055));
  }
  root.add(mesh(roofSeams, panel, 'shallow-roof-standing-seams'));

  // The signature open canopy has individual pale blades and projecting triangular steel brackets.
  const blades: THREE.BufferGeometry[] = [], brackets: THREE.BufferGeometry[] = [];
  for (let x = -37.3; x < 37.4; x += .78) blades.push(box(.19, .22, 3.15, x, 9.78, southZ + 1.57));
  for (let i = 0; i <= 12; i++) {
    const x = -37.8 + i * 6.28;
    brackets.push(beam([x, 6.45, southZ + .17], [x, 9.57, southZ + 3.05], .20),
      beam([x, 9.57, southZ + .17], [x, 9.57, southZ + 3.05], .19));
  }
  brackets.push(box(75.3, .16, .16, 0, 9.58, southZ + 2.95));
  root.add(mesh(blades, louver, 'open-white-rooftop-louver-blades'));
  root.add(mesh(brackets, steel, 'cantilevered-canopy-triangular-steel-brackets'));

  // The west entrance's upper glazing sits behind broad horizontal metal sunshades.
  const westSunshades: THREE.BufferGeometry[] = [];
  for (const [z, width] of [[-8, 5.5], [-2, 5.5], [4, 5.5], [9.5, 4.5]]) {
    for (let y = 4.48; y < 8.45; y += .34)
      westSunshades.push(box(.36, .12, width, -38.28, y, z));
    frame.push(box(.16, 4.12, .1, -38.5, 6.48, z - width / 2),
      box(.16, 4.12, .1, -38.5, 6.48, z + width / 2),
      box(.16, .12, width, -38.5, 4.43, z), box(.16, .12, width, -38.5, 8.52, z));
  }
  root.add(mesh(westSunshades, panel, 'west-upper-facade-horizontal-sunshades'));

  const entranceCanopies: THREE.BufferGeometry[] = [], entranceFrames: THREE.BufferGeometry[] = [];
  for (const source of PUBLIC_MARKET_SOURCES.slice(1)) {
    const points = source.footprint.slice(0, -1).map(local);
    entranceCanopies.push(prism(points, () => 3.48, () => 3.67));
    // Two slender rods express the photographed suspended entrance canopies.
    for (const p of [points[0], points[2]]) entranceFrames.push(beam([p[0], 3.69, p[1]], [p[0] * .988, 4.53, p[1] * .988], .055));
  }
  // Smaller street-side shades are visible in the photos but absent from the mapped roof ways.
  for (const x of [-28.4, -9.4, 9.5, 28.3]) {
    entranceCanopies.push(box(3.8, .19, 1.9, x, 3.575, southZ + .95));
    for (const dx of [-1.65, 1.65]) entranceFrames.push(
      beam([x + dx, 3.69, southZ + 1.85], [x + dx, 4.7, southZ + .12], .065));
  }
  root.add(mesh(entranceCanopies, panel, 'mapped-thin-entrance-canopies'));
  root.add(mesh(entranceFrames, steel, 'entrance-canopy-suspension-rods'));
  const doors: THREE.BufferGeometry[] = [];
  for (const z of [-8, -2, 4.5, 10.5]) {
    doors.push(box(.21, 2.6, 2.02, -38.02, 1.58, z));
    frame.push(box(.29, 2.67, .065, -38.16, 1.61, z), box(.3, .09, 2.1, -38.16, 2.94, z),
      box(.33, .55, .055, -38.2, 1.55, z - .17), box(.33, .55, .055, -38.2, 1.55, z + .17));
    frame.push(box(.3, .075, 2.1, -38.16, 2.35, z));
  }
  for (const x of [-28.4, -9.4, 9.5, 28.3]) {
    doors.push(box(2.2, 2.7, .23, x, 1.6, 14.87));
    frame.push(box(.07, 2.7, .31, x, 1.6, 14.98), box(2.28, .08, .31, x, 2.96, 14.98));
  }
  root.add(mesh(doors, doorGlass, 'street-level-glazed-double-doors'));
  // The separate rooftop neon lettering attaches to this west-facing steel support frame.
  const signRack: THREE.BufferGeometry[] = [];
  for (const z of [-16, -8.5, -1, 6.5, 14]) {
    const bottom = publicMarketRoofHeight(z);
    signRack.push(box(.14, 12.45 - bottom, .14, -38.25, (12.45 + bottom) / 2, z),
      beam([-38.25, 10.4, z], [-36.2, publicMarketRoofHeight(z) + .2, z], .09));
  }
  for (const y of [10.35, 11.8]) signRack.push(box(.12, .12, 30.8, -38.25, y, -1));
  root.add(mesh(signRack, steel, 'full-width-west-neon-sign-support-rack'));
  root.add(mesh(frame, steel, 'exposed-steel-frame-mullions-and-sign-supports'));
  root.add(mesh(roofTrim, panel, 'continuous-metal-roof-edge'));

  const glazing = [glass, doorGlass];
  root.userData.setLightingMode = (mode: PublicMarketLightingMode) => {
    for (const material of glazing) {
      material.emissive.set(mode === 'day' ? 0 : 0xffc17b);
      material.emissiveIntensity = mode === 'night' ? .38 : mode === 'sunset' ? .16 : 0;
    }
  };
  root.userData.source = { osmWay: PUBLIC_MARKET_SOURCE.id, footprintScale: 1, heightBasis: 'TKWA project photographs; visual estimate' };
  return root;
}
