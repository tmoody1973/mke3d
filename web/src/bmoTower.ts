import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BMO_SITE as site } from './bmoSite.ts';

type Point = [number, number];
type Mode = 'day' | 'sunset' | 'night';
/** 2020 BMO Tower, 790 N Water. Owner fact sheet: 328 ft, 25 stories,
 * eight parking levels, office floors 11–25 and 5 ft curtain-wall module.
 * OSM fixes the angled Water frontage, rounded NW corner and full podium.
 * Split crown, terrace and screen treatment follow owner/architect photos;
 * their unmeasured dimensions are visual estimates, not survey geometry. */
export function buildBmoTower(groundAt: (x: number, z: number) => number) {
  const root = new THREE.Group(); root.name = 'bmo-tower'; root.rotation.y = site.bearing;
  const world = (x: number, z: number) => new THREE.Vector3(x, 0, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), site.bearing).add(new THREE.Vector3(site.x, 0, site.z));
  const west = world(-39.7, -1.5), floor = groundAt(west.x, west.z) + .08;
  root.position.set(site.x, floor, site.z);
  const grade = (x: number, z: number) => { const p = world(x, z); return groundAt(p.x, p.z) - floor; };
  const materials: Record<string, THREE.MeshStandardMaterial> = {
    core: new THREE.MeshStandardMaterial({ color: 0x26353e, roughness: .65 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x789bab, roughness: .19, metalness: .16 }),
    glassBlue: new THREE.MeshStandardMaterial({ color: 0x7b9ead, roughness: .22, metalness: .14 }),
    glassGray: new THREE.MeshStandardMaterial({ color: 0x7498a8, roughness: .25, metalness: .16 }),
    litGlass: new THREE.MeshStandardMaterial({ color: 0x7b9ba9, roughness: .25, metalness: .16, emissive: 0xffdca0, emissiveIntensity: 0 }),
    spandrel: new THREE.MeshStandardMaterial({ color: 0x60818f, roughness: .38, metalness: .18 }),
    mullion: new THREE.MeshStandardMaterial({ color: 0x83959c, roughness: .43, metalness: .65 }),
    silver: new THREE.MeshStandardMaterial({ color: 0xc0c9ca, roughness: .43, metalness: .52 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x566167, roughness: .55, metalness: .48 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1a2429, roughness: .78 }),
    stone: new THREE.MeshStandardMaterial({ color: 0xaaa79e, roughness: .87 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x787e7c, roughness: .9 }),
    entryGlass: new THREE.MeshStandardMaterial({ color: 0x84a6ad, roughness: .16, metalness: .12, transparent: true, opacity: .38, emissive: 0xffd6a0, emissiveIntensity: 0 }),
    warm: new THREE.MeshStandardMaterial({ color: 0xe4d2b2, roughness: .5, emissive: 0xffca87, emissiveIntensity: 0 }),
    blue: new THREE.MeshStandardMaterial({ color: 0x0079c1, roughness: .4, emissive: 0x0079c1, emissiveIntensity: 0 }),
    foliage: new THREE.MeshStandardMaterial({ color: 0x48643b, roughness: .95 }),
  };
  const buckets: Record<string, THREE.BufferGeometry[]> = Object.fromEntries(Object.keys(materials).map(k => [k, []]));
  function add(k: string, geometry: THREE.BufferGeometry) { geometry.deleteAttribute('uv'); const g = geometry.index ? geometry.toNonIndexed() : geometry; if (g !== geometry) geometry.dispose(); buckets[k].push(g); }
  function box(k: string, x: number, y: number, z: number, w: number, h: number, d: number, angle = 0) { const g = new THREE.BoxGeometry(w, h, d); g.rotateY(angle); g.translate(x, y, z); add(k, g); }
  function quad(k: string, a: number[], b: number[], c: number[], d: number[]) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3)); g.computeVertexNormals(); add(k, g); }
  function prism(k: string, plan: Point[], bottom: number, height: number) { const s = new THREE.Shape(); plan.forEach(([x, z], i) => i ? s.lineTo(x, -z) : s.moveTo(x, -z)); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: height, bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, bottom, 0); add(k, g); }
  const podium: Point[] = site.localFootprint.slice(0, -1).map(([x, z]) => [x, z]);
  const north: Point[] = [[-43.401, -15.123], [-37.982, 4.942], [25.477, 4.942], [25.477, -17.789], [-39.933, -17.736], [-41.476, -17.396], [-42.828, -16.566]];
  const south: Point[] = [[-36.342, 4.942], [-36.324, 17.784], [25.422, 17.745], [25.477, 4.942]];
  const towerPlan: Point[] = [north[0], north[1], south[0], south[1], south[2], north[3], ...north.slice(4)];
  const officeBase = 35, module = 1.524, officeFloor = 4.064, officeTop = officeBase + 15 * officeFloor;
  // Solid structures sit behind the façade; the public lobby remains recessed.
  prism('core', podium.map(([x, z]) => [x * .978, z * .95]), 9.8, 25.2);
  prism('core', towerPlan.map(([x, z]) => [x * .992, z * .982]), officeBase, officeTop - officeBase);
  prism('roof', north, 99.68, .2944); prism('roof', south, officeTop, .24);
  prism('roof', podium, 34.82, .18);
  // Ground-contact skirt varies around the sloping site and never lifts the
  // western lobby to the higher Broadway threshold.
  for (let i = 0; i < podium.length; i++) {
    const a = podium[i], b = podium[(i + 1) % podium.length];
    quad('stone', [a[0], grade(...a) - .3, a[1]], [b[0], grade(...b) - .3, b[1]], [b[0], grade(...b) + .12, b[1]], [a[0], grade(...a) + .12, a[1]]);
  }
  const panelCounts = { dark: 0, lit: 0 };
  function segment(a: Point, b: Point) { const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz); return { dx, dz, length, nx: -dz / length, nz: dx / length, angle: Math.atan2(-dz, dx) }; }
  function face(k: string, a: Point, b: Point, bottom: number, top: number, push = .04) { const s = segment(a, b); quad(k, [a[0] + s.nx * push, bottom, a[1] + s.nz * push], [b[0] + s.nx * push, bottom, b[1] + s.nz * push], [b[0] + s.nx * push, top, b[1] + s.nz * push], [a[0] + s.nx * push, top, a[1] + s.nz * push]); }
  function bar(k: string, a: Point, b: Point, y: number, h: number, push = .1, thickness = .085) { const s = segment(a, b); box(k, (a[0] + b[0]) / 2 + s.nx * push, y, (a[1] + b[1]) / 2 + s.nz * push, s.length + .03, h, thickness, s.angle); }
  function curtain(a: Point, b: Point, bottom: number, top: number, floors: number, seed: number) {
    const s = segment(a, b), cols = Math.max(1, Math.round(s.length / module));
    for (let col = 0; col < cols; col++) {
      const p: Point = [a[0] + s.dx * col / cols, a[1] + s.dz * col / cols], q: Point = [a[0] + s.dx * (col + 1) / cols, a[1] + s.dz * (col + 1) / cols];
      for (let row = 0; row < floors; row++) {
        const lo = bottom + (top - bottom) * row / floors, hi = bottom + (top - bottom) * (row + 1) / floors;
        const hash = (col * 7 + row * 13 + seed * 3) % 23, lit = hash < 4;
        panelCounts[lit ? 'lit' : 'dark']++;
        face(lit ? 'litGlass' : hash < 10 ? 'glassBlue' : hash < 17 ? 'glassGray' : 'glass', p, q, lo, hi);
        face('spandrel', p, q, lo, lo + .4, .075);
      }
      box('mullion', p[0] + s.nx * .14, (bottom + top) / 2, p[1] + s.nz * .14, .054, top - bottom, .095, s.angle);
    }
    for (let row = 0; row <= floors; row++) bar('mullion', a, b, bottom + (top - bottom) * row / floors, .065);
  }
  // A fine continuous grid follows all curved/angled segments rather than
  // rectangular windows pasted onto a box. Shared split-bar seam is internal.
  for (let i = 0; i < towerPlan.length; i++) curtain(towerPlan[i], towerPlan[(i + 1) % towerPlan.length], officeBase, officeTop, 15, i);
  for (let i = 0; i < north.length; i++) {
    const a = north[i], b = north[(i + 1) % north.length];
    curtain(a, b, officeTop, 99.65, 1, i + 10); bar('silver', a, b, 99.80, .27, .11, .16);
  }
  for (let i = 0; i < south.length; i++) bar('silver', south[i], south[(i + 1) % south.length], officeTop + .08, .36, .15, .25);
  // Water corner glass drops through the podium. The remaining parking floors
  // have a darker ventilated metal screen, not 8 additional office floors.
  for (let i = 0; i < podium.length; i++) {
    const a = podium[i], b = podium[(i + 1) % podium.length], s = segment(a, b), mx = (a[0] + b[0]) / 2;
    if (s.length < .1) continue;
    if (mx < -30) curtain(a, b, 10.15, officeBase, 8, i + 25);
    else {
      face('screen', a, b, 10.15, officeBase, .02);
      for (let y = 10.4; y < 34.8; y += .36) bar('mullion', a, b, y, .048, .065, .04);
      for (let y = 10.15; y <= 35; y += (35 - 10.15) / 8) bar('dark', a, b, y, .16, .1);
      const n = Math.ceil(s.length / 5.8);
      for (let j = 0; j <= n; j++) box('silver', a[0] + s.dx * j / n + s.nx * .21, 22.55, a[1] + s.dz * j / n + s.nz * .21, .16, 24.8, .35, s.angle);
    }
    bar('silver', a, b, 35.04, .25, .12, .22);
    bar('dark', a, b, 9.93, .43, .15, .16);
  }
  // North screened podium has a horizontal band of inset glazing.
  const nA: Point = [-19, -17.76], nB: Point = [20, -17.785];
  curtain(nB, nA, 16.1, 26.2, 3, 45);
  // Retail glazing follows each grade, with opaque interiors placed well back.
  prism('dark', [[-33, -14], [-33, 14], [40, 14], [40, -14]], .12, 9.65);
  for (let i = 0; i < podium.length; i++) {
    const a = podium[i], b = podium[(i + 1) % podium.length], s = segment(a, b);
    if (s.length < .1 || (a[0] > 43 && b[0] > 43)) continue;
    const baseA = grade(...a) + .14, baseB = grade(...b) + .14;
    quad('entryGlass', [a[0] + s.nx * .07, baseA, a[1] + s.nz * .07], [b[0] + s.nx * .07, baseB, b[1] + s.nz * .07], [b[0] + s.nx * .07, 9.69, b[1] + s.nz * .07], [a[0] + s.nx * .07, 9.69, a[1] + s.nz * .07]);
    const count = Math.max(1, Math.ceil(s.length / 2.6));
    for (let j = 0; j <= count; j++) { const t = j / count, x = a[0] + s.dx * t, z = a[1] + s.dz * t, lo = grade(x, z) + .14; box('dark', x + s.nx * .14, (lo + 9.69) / 2, z + s.nz * .14, .095, 9.69 - lo, .16, s.angle); }
    bar('dark', a, b, 5.85, .11, .14);
  }
  // Water Street flat canopy, glazed doors, fine pulls and warm recessed soffit.
  const entry = { x: -40.17, z: -3.15 }, edge = segment(north[0], north[1]);
  const entryY = grade(entry.x, entry.z) + .14;
  box('dark', entry.x + edge.nx * 1.4, 5.15, entry.z + edge.nz * 1.4, 12, .34, 3.2, edge.angle);
  box('blue', entry.x + edge.nx * 3, 5.18, entry.z + edge.nz * 3, 12, .11, .10, edge.angle);
  box('warm', entry.x + edge.nx * 1.4, 4.96, entry.z + edge.nz * 1.4, 10.9, .04, 2.45, edge.angle);
  const doorCenters: Point[] = [];
  for (const u of [-2.4, -.8, .8, 2.4]) {
    const x = entry.x + edge.dx / edge.length * u, z = entry.z + edge.dz / edge.length * u; doorCenters.push([x, z]);
    box('entryGlass', x + edge.nx * .24, entryY + 1.65, z + edge.nz * .24, 1.48, 3.3, .035, edge.angle);
    for (const d of [-.78, .78]) box('silver', x + edge.dx / edge.length * d + edge.nx * .29, entryY + 1.7, z + edge.dz / edge.length * d + edge.nz * .29, .055, 3.4, .055, edge.angle);
    box('silver', x + edge.nx * .34, entryY + 1.4, z + edge.nz * .34, .04, .66, .07, edge.angle);
  }
  // Three Broadway garage mouths begin at the higher eastern pavement datum.
  for (const z of [-10.7, -.4, 9.9]) {
    const y = grade(43.4, z) + .12;
    box('dark', 43.41, y + 2.3, z, .07, 4.6, 7.6);
    box('screen', 41.8, y + 2.2, z, .06, 4.4, 7.3);
    for (let j = 0; j < 12; j++) box('mullion', 43.47, y + .23 + j * .36, z, .06, .055, 7.3);
    for (const d of [-4, 4]) box('stone', 43.48, y + 2.4, z + d, .25, 4.8, .3);
    box('silver', 43.5, y + 4.7, z, .26, .26, 8.3);
  }
  // Roof terrace is on the eastern podium, not an extra full-height tower.
  box('stone', 34.45, 35.08, 0, 16.4, .12, 31.9);
  for (const z of [-15.7, 15.7]) {
    box('dark', 34.8, 35.52, z, 14.4, .8, .8); box('foliage', 34.8, 36.02, z, 13.8, .48, .64);
    box('silver', 34.5, 36.15, z + Math.sign(z) * .8, 17, .06, .06);
    for (let x = 26.2; x < 43; x += 1.9) box('silver', x, 35.66, z + Math.sign(z) * .8, .045, 1.05, .045);
  }
  for (const z of [-8, 0, 8]) {
    box('dark', 41.2, 35.62, z, 1.7, .9, 1.7);
    const g = new THREE.IcosahedronGeometry(1.25, 1); g.scale(.8, 1.5, .8); g.translate(41.2, 37.1, z); add('foliage', g);
  }
  box('roof', -6, 99.94, -5, 24, .06, 11);
  // Mechanical screen remains below the tall north parapet silhouette.
  box('screen', -6, 98.03, -6, 23, 3.1, 10);
  for (let x = -17; x < 6; x += .6) box('silver', x, 98.0, -.92, .06, 2.8, .08);
  for (const [key, geometries] of Object.entries(buckets)) {
    if (!geometries.length) continue;
    const geometry = mergeGeometries(geometries); if (!geometry) throw new Error(`BMO ${key} merge failed`);
    const mesh = new THREE.Mesh(geometry, materials[key]); mesh.name = ['core', 'stone'].includes(key) ? 'BLDG' : `bmo-${key}`; mesh.userData.part = key;
    mesh.castShadow = !['entryGlass', 'litGlass'].includes(key); mesh.receiveShadow = true; root.add(mesh); geometries.forEach(g => g.dispose());
  }
  // Brand SVG is an ordinary exterior sign. Single-sided planes use outward
  // normals and never show mirrored lettering through the back.
  const signMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, alphaTest: .15, roughness: .38, emissive: 0xffffff, emissiveIntensity: 0, side: THREE.FrontSide });
  if (typeof document !== 'undefined') { const texture = new THREE.TextureLoader().load('/signs/bmo-white.svg'); texture.colorSpace = THREE.SRGBColorSpace; signMaterial.map = texture; signMaterial.emissiveMap = texture; }
  const signs = [
    { name: 'north-crown', x: -28, y: 96.78, z: -18.00, angle: Math.PI, w: 18, h: 6.201 },
    { name: 'water-crown', x: -41.50, y: 96.78, z: -7.085, angle: edge.angle, w: 16, h: 5.512 },
    { name: 'water-entry', x: entry.x + edge.nx * .32, y: 7.65, z: entry.z + edge.nz * .32, angle: edge.angle, w: 4.2, h: 1.45 },
  ];
  for (const sign of signs) { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sign.w, sign.h), signMaterial); mesh.name = `bmo-sign-${sign.name}`; mesh.position.set(sign.x, sign.y, sign.z); mesh.rotation.y = sign.angle; mesh.userData.normal = [Math.sin(sign.angle), 0, Math.cos(sign.angle)]; root.add(mesh); }
  root.userData.referenceHeight = site.height; root.userData.finishedFloor = floor;
  root.userData.officeBase = officeBase; root.userData.officeFloors = 15; root.userData.parkingFloors = 8;
  root.userData.towerPlan = towerPlan; root.userData.podiumPlan = podium; root.userData.panelCounts = panelCounts;
  root.userData.entrance = { ...entry, floor: entryY, normal: [edge.nx, 0, edge.nz], doorCenters };
  root.userData.setLightingMode = (mode: Mode) => {
    const amount = mode === 'night' ? 1 : mode === 'sunset' ? .38 : 0;
    materials.litGlass.emissiveIntensity = amount * .5;
    materials.entryGlass.emissiveIntensity = amount * .15;
    materials.warm.emissiveIntensity = amount * 1.5;
    materials.blue.emissiveIntensity = amount * .7;
    signMaterial.emissiveIntensity = amount * .7;
  };
  root.userData.setLightingMode('day'); return root;
}
