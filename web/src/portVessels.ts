import * as THREE from 'three';

type Point = [number, number, number];
type VesselOptions = { length?: number; beam?: number };
type Bucket = 'hull' | 'waterline' | 'deck' | 'white' | 'glass' | 'metal' | 'rescue';
type GeometryBuckets = Record<Bucket, number[]>;
const palette: Record<Bucket, number> = {
  hull: 0x24343b, waterline: 0x814c3d, deck: 0x6c7776,
  white: 0xeeeae0, glass: 0x213e4d, metal: 0x9ba8a6, rescue: 0xd58442,
};
const buckets = (): GeometryBuckets => ({ hull: [], waterline: [], deck: [], white: [], glass: [], metal: [], rescue: [] });
function quad(out: number[], a: Point, b: Point, c: Point, d: Point) { out.push(...a, ...b, ...c, ...a, ...c, ...d); }
function add(out: number[], geometry: THREE.BufferGeometry, position: Point, rotation?: THREE.Quaternion) {
  if (rotation) geometry.applyQuaternion(rotation);
  geometry.translate(...position);
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  out.push(...Array.from(flat.getAttribute('position').array));
  if (flat !== geometry) flat.dispose();
  geometry.dispose();
}
function box(out: number[], x: number, y: number, z: number, w: number, h: number, d: number) {
  add(out, new THREE.BoxGeometry(w, h, d), [x, y, z]);
}
function bar(out: number[], a: Point, b: Point, radius: number) {
  const axis = new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
  const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.clone().normalize());
  add(out, new THREE.CylinderGeometry(radius, radius, axis.length(), 5),
    [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], rotation);
}

/** Convex stations form a tapered stern and fine bow; lower sections narrow
 * toward the keel. Stationary illustrative ships, not naval architecture data. */
function hull(out: number[], length: number, beam: number, z: number, bottom: number, top: number, keel = 1, x = 0) {
  const stations = [[-.5, .60], [-.46, .88], [-.36, 1], [.28, 1], [.40, .80], [.47, .39], [.5, .02]];
  const loops: Point[][] = stations.map(([s, width]) => {
    const half = width * beam / 2;
    return [[s * length + x, bottom, z - half * keel], [s * length + x, bottom, z + half * keel],
      [s * length + x, top, z + half], [s * length + x, top, z - half]];
  });
  for (let section = 0; section + 1 < loops.length; section++) {
    const a = loops[section], b = loops[section + 1];
    for (let i = 0; i < 4; i++) quad(out, a[i], b[i], b[(i + 1) % 4], a[(i + 1) % 4]);
  }
  quad(out, loops[0][0], loops[0][1], loops[0][2], loops[0][3]);
  const end = loops[loops.length - 1]; quad(out, end[3], end[2], end[1], end[0]);
}
function rail(out: number[], x0: number, x1: number, y: number, z: number, spacing: number, scale: number) {
  for (const dy of [.55, 1.05]) bar(out, [x0, y + dy * scale, z], [x1, y + dy * scale, z], .055 * scale);
  const steps = Math.ceil((x1 - x0) / spacing);
  for (let i = 0; i <= steps; i++) {
    const x = x0 + (x1 - x0) * i / steps;
    bar(out, [x, y, z], [x, y + 1.08 * scale, z], .06 * scale);
  }
}
function finish(name: string, geometry: GeometryBuckets, length: number, beam: number) {
  const root = new THREE.Group(); root.name = name;
  let triangles = 0;
  for (const key of Object.keys(geometry) as Bucket[]) {
    const points = geometry[key]; if (!points.length) continue;
    const shape = new THREE.BufferGeometry(); shape.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    shape.computeVertexNormals(); shape.computeBoundingBox(); shape.computeBoundingSphere();
    const material = new THREE.MeshStandardMaterial({ color: palette[key], roughness: key === 'glass' ? .28 : .74,
      metalness: key === 'glass' ? .35 : key === 'metal' ? .25 : .08 });
    const mesh = new THREE.Mesh(shape, material); mesh.name = `${name}-${key}`;
    mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); triangles += points.length / 9;
  }
  root.userData = { length, beam, waterline: 0, bowAxis: '+X', stationary: true, illustrative: true, triangles };
  return root;
}
function validate(length: number, beam: number) {
  if (![length, beam].every(Number.isFinite) || length <= 0 || beam <= 0 || length < beam * 2)
    throw new Error('Vessel dimensions must be finite, positive, and length at least twice beam');
}

/** Original Great Lakes cargo-vessel interpretation from local harbor photos.
 * Local +X is bow; Y=0 is waterline. No names, photo textures, or live operations. */
export function buildPortFreighter({ length = 180, beam = 22 }: VesselOptions = {}): THREE.Group {
  validate(length, beam);
  const g = buckets(), s = beam / 22, deck = 5.3 * s;
  hull(g.waterline, length, beam * .97, 0, -4.2 * s, .4 * s, .65);
  hull(g.hull, length, beam, 0, .35 * s, deck, .97);
  // Broad working deck, raised forecastle, and seven framed cargo hatches.
  box(g.deck, -.025 * length, deck + .05 * s, 0, length * .73, .13 * s, beam * .91);
  hull(g.hull, length * .15, beam * .80, 0, deck, deck + 1.25 * s, 1, length * .425);
  for (let i = 0; i < 7; i++) {
    const x = length * (-.245 + i * .075);
    box(g.hull, x, deck + .28 * s, 0, length * .065, .55 * s, beam * .72);
    box(g.deck, x, deck + .62 * s, 0, length * .061, .22 * s, beam * .68);
    for (let seam = -2; seam <= 2; seam++) box(g.metal, x, deck + .75 * s, seam * beam * .115, length * .060, .06 * s, .07 * s);
  }
  // Aft accommodation and bridge overlook the working deck.
  box(g.white, -.375 * length, deck + 3.6 * s, 0, length * .14, 7.2 * s, beam * .74);
  box(g.white, -.35 * length, deck + 8.5 * s, 0, length * .10, 2.6 * s, beam * .82);
  box(g.deck, -.35 * length, deck + 9.88 * s, 0, length * .115, .20 * s, beam * .88);
  for (const sign of [-1, 1]) {
    for (let row = 0; row < 3; row++) for (let i = 0; i < 7; i++)
      box(g.glass, length * (-.429 + i * .017), deck + (1.7 + row * 2.3) * s, sign * beam * .371,
        length * .009, .90 * s, .065 * s);
    for (let i = 0; i < 6; i++) box(g.glass, length * (-.39 + i * .016), deck + 8.6 * s, sign * beam * .411,
      length * .012, 1.25 * s, .065 * s);
    // Portholes in the forecastle and enclosed orange lifeboats on both sides.
    for (let i = 0; i < 5; i++) {
      const geometry = new THREE.CylinderGeometry(.28 * s, .28 * s, .06 * s, 8); geometry.rotateX(Math.PI / 2);
      add(g.glass, geometry, [length * (.305 + i * .017), deck + .58 * s, sign * beam * (.395 - i * .033)]);
    }
    const boat = new THREE.SphereGeometry(1, 10, 6); boat.scale(3.0 * s, .8 * s, 1.0 * s);
    add(g.rescue, boat, [-.40 * length, deck + 4.5 * s, sign * beam * .44]);
    bar(g.metal, [-.42 * length, deck, sign * beam * .44], [-.42 * length, deck + 5.4 * s, sign * beam * .44], .10 * s);
    rail(g.metal, -.29 * length, .29 * length, deck + .10 * s, sign * beam * .47, 4 * s, s);
    rail(g.metal, -.40 * length, -.30 * length, deck + 10 * s, sign * beam * .42, 3 * s, s);
  }
  box(g.glass, -.299 * length, deck + 8.6 * s, 0, .07 * s, 1.25 * s, beam * .70);
  box(g.hull, -.405 * length, deck + 10.3 * s, 0, 3.8 * s, 5.4 * s, 4.0 * s);
  box(g.rescue, -.405 * length, deck + 10.8 * s, 0, 3.84 * s, 1.0 * s, 4.04 * s);
  bar(g.metal, [-.32 * length, deck + 10 * s, 0], [-.32 * length, deck + 16 * s, 0], .12 * s);
  bar(g.metal, [-.32 * length, deck + 14.5 * s, -3 * s], [-.32 * length, deck + 14.5 * s, 3 * s], .09 * s);
  box(g.white, .35 * length, deck + 2.0 * s, 0, 5 * s, 1.5 * s, beam * .40);
  bar(g.metal, [.39 * length, deck + 1.25 * s, 0], [.39 * length, deck + 6.5 * s, 0], .13 * s);
  return finish('port-freighter', g, length, beam);
}

/** Passenger catamaran: two separate fine hulls, raised connecting vehicle deck,
 * white passenger enclosure, dark window ribbon and forward panoramic bridge. */
export function buildPortFerry({ length = 58, beam = 18 }: VesselOptions = {}): THREE.Group {
  validate(length, beam);
  const g = buckets(), s = beam / 18;
  for (const sign of [-1, 1]) {
    const z = sign * beam * .36;
    hull(g.hull, length, beam * .28, z, -1.8 * s, .55 * s, .55);
    hull(g.white, length, beam * .28, z, .50 * s, 3.15 * s, .95);
  }
  box(g.white, -.07 * length, 3.5 * s, 0, length * .72, .85 * s, beam * .90);
  box(g.white, -.11 * length, 5.45 * s, 0, length * .60, 3.1 * s, beam * .82);
  box(g.white, -.12 * length, 7.05 * s, 0, length * .61, .23 * s, beam * .86);
  // Swept nose of the passenger cabin keeps the bow tunnel open below it.
  hull(g.white, length * .26, beam * .82, 0, 3.85 * s, 5.6 * s, 1, length * .30);
  box(g.white, .18 * length, 7.15 * s, 0, length * .19, 2.65 * s, beam * .58);
  box(g.deck, .18 * length, 8.55 * s, 0, length * .21, .20 * s, beam * .64);
  for (const sign of [-1, 1]) {
    for (let i = 0; i < 14; i++) box(g.glass, length * (-.392 + i * .041), 6.15 * s,
      sign * beam * .411, length * .037, 1.00 * s, .06 * s);
    for (let i = 0; i < 5; i++) box(g.glass, length * (.102 + i * .038), 7.7 * s,
      sign * beam * .291, length * .032, 1.05 * s, .06 * s);
    rail(g.metal, -.405 * length, .10 * length, 7.18 * s, sign * beam * .42, 2.4 * s, s);
    rail(g.metal, .29 * length, .405 * length, 3.95 * s, sign * beam * .44, 2 * s, s);
    box(g.rescue, -.29 * length, 7.5 * s, sign * beam * .33, 2.0 * s, .5 * s, .8 * s);
    box(g.white, -.28 * length, 8.0 * s, sign * beam * .22, 4.2 * s, 1.5 * s, 1.5 * s);
    box(g.hull, -.28 * length, 8.81 * s, sign * beam * .22, 3.5 * s, .15 * s, 1.3 * s);
  }
  box(g.glass, .276 * length, 7.7 * s, 0, .065 * s, 1.05 * s, beam * .51);
  bar(g.metal, [.19 * length, 8.7 * s, 0], [.19 * length, 12.2 * s, 0], .085 * s);
  bar(g.white, [.19 * length, 10.8 * s, -1.8 * s], [.19 * length, 10.8 * s, 1.8 * s], .11 * s);
  const radar = new THREE.SphereGeometry(.65 * s, 10, 6); add(g.white, radar, [-.14 * length, 8.6 * s, 0]);
  return finish('port-ferry', g, length, beam);
}
