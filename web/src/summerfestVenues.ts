import * as THREE from 'three';
import { districtGeometry } from './districtGeometry.ts';
import { buildAuroraArchitecture } from './auroraPavilion.ts';

export type SummerfestVenueKind = 'amphitheater' | 'bmo' | 'miller' | 'generac' | 'briggs' | 'tmobile' | 'uline' | 'aurora' | 'south';
type LightingMode = 'day' | 'sunset' | 'night';
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Metres; stage faces +Z. Width/depth describe the roof, excluding outdoor seating. */
export function buildSummerfestVenue(kind: SummerfestVenueKind, width: number, depth: number): THREE.Group {
  const root = new THREE.Group(); root.name = `summerfest-${kind}`;
  const batch = districtGeometry(root);
  const material = (color: number, metalness = .12) => new THREE.MeshStandardMaterial({color, roughness: .72, metalness, side: THREE.DoubleSide});
  const steel = material(['bmo', 'aurora', 'south'].includes(kind) ? 0xd7dedb : 0x303b3e, .45);
  const dark = material(0x171d24), roof = material(kind === 'amphitheater' ? 0x37484a : kind === 'bmo' ? 0x758788 : 0x535c5f, .4);
  const pale = material(0xe8e6db), concrete = material(0x969b97), warm = material(0x8d5436), orange = material(0xe65c1b);
  const seat = material(kind === 'amphitheater' ? 0x566b63 : 0x81938c), turf = material(0x4c7045);
  const pink = material(0xb34e92), blue = material(0x416c9b), gold = material(0xcb9c52);
  const leds = [pink, blue, gold]; leds.forEach(m => m.emissive.copy(m.color));
  const lamp = material(0xd5dcd0); lamp.emissive.set(0xffdeb0);
  const halfW = width / 2, halfD = depth / 2;
  const large = kind === 'amphitheater' || kind === 'bmo';
  const height = kind === 'amphitheater' ? 27 : kind === 'bmo' ? 16 : Math.min(18, Math.max(10, width * .31));
  // Aurora's roof covers the audience as well as the performance area.
  // Keep its shallow stage at the lake end, instead of scaling it to the hall.
  const coveredAudience = kind === 'aurora';
  const architecture = coveredAudience ? buildAuroraArchitecture(width, depth) : undefined;
  if (architecture) root.add(architecture);
  const stageD = coveredAudience ? 12 : depth * (large ? .22 : .56);
  const stageZ = coveredAudience ? -halfD + 4 + stageD / 2 : kind === 'amphitheater' ? -halfD + Math.min(15, depth * .19) : kind === 'bmo' ? -halfD + depth * .17 : -depth * .12;
  const stageW = width * (large ? .34 : .62), stageFront = stageZ + stageD / 2;

  function surface(points: THREE.Vector3[], mat: THREE.Material, name: string) {
    const positions: number[] = [];
    for (let i = 1; i < points.length - 1; i++) positions.push(...points[0].toArray(), ...points[i].toArray(), ...points[i + 1].toArray());
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.computeVertexNormals(); batch.add(g, mat, name);
  }
  function truss(a: THREE.Vector3, b: THREE.Vector3, rise = 1, gauge = .2, mat = steel) {
    batch.beam(a, b, gauge, mat, 'roof-truss-chords');
    batch.beam(a.clone().add(v(0, -rise, 0)), b.clone().add(v(0, -rise, 0)), gauge, mat, 'roof-truss-chords');
    const divisions = Math.max(3, Math.ceil(a.distanceTo(b) / 3.5));
    for (let i = 0; i < divisions; i++) {
      const p = a.clone().lerp(b, i / divisions), q = a.clone().lerp(b, (i + 1) / divisions);
      if (i % 2) p.y -= rise; else q.y -= rise;
      batch.beam(p, q, gauge * .65, mat, 'triangulated-roof-webs');
    }
  }
  function column(x: number, z: number, h: number, mat = steel) {
    batch.box(x, .25, z, 1.5, .5, 1.5, concrete, 'column-footings');
    batch.box(x, h / 2, z, .55, h, .55, mat, 'exposed-columns');
  }
  function screen(x: number, y: number, z: number, w: number, h: number) {
    batch.box(x, y, z, w + .5, h + .5, .42, dark, 'screen-enclosures');
    batch.box(x, y, z + .25, w, h, .06, blue, 'abstract-concert-led-panels');
    for (let i = 0; i < 7; i++) {
      const barH = h * (.16 + .52 * (Math.sin(i * 2.4 + 1) * .5 + .5));
      batch.box(x - w * .42 + i * w * .14, y - h * .35 + barH / 2, z + .3, w * .075, barH, .05, leds[i % 3], 'abstract-equalizer-screen');
    }
  }
  function seating(z0: number, rows: number, pitch: number, w: number, step: number) {
    for (let r = 0; r < rows; r++) {
      const z = z0 + r * pitch, y = .25 + r * step;
      for (const side of [-1, 1]) {
        const blockW = (w - 3) / 2, x = side * (blockW / 2 + 1.5);
        batch.box(x, y / 2, z, blockW, y, pitch * .94, concrete, 'audience-terraces');
        batch.box(x, y + .5, z, blockW - .7, .12, .5, seat, 'bench-seating-rows');
        batch.box(x, y + .86, z + .26, blockW - .7, .48, .09, seat, 'seat-backs');
      }
    }
  }

  batch.box(0, .5, stageZ, stageW, 1, stageD, dark, 'raised-performance-deck');
  batch.box(0, height * .27, stageZ - stageD * .46, stageW, height * .5, .65, dark, 'stage-backdrop');
  screen(0, height * .35, stageZ - stageD * .42, stageW * .61, height * .27);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 6; i++) batch.box(side * stageW * .43, height * .62 - i * .7, stageFront - 1 + i * .06, 1.05, .6, .95, dark, 'suspended-line-array-speakers');
    for (let i = 0; i < 4; i++) batch.box(side * (stageW / 2 + .8), .16 + i * .2, stageFront - 1.7 + i * .4, 1.6, .3, .5, concrete, 'stage-access-stairs');
  }
  truss(v(-stageW / 2, height * .73, stageFront - 1), v(stageW / 2, height * .73, stageFront - 1), .7, .13, dark);
  for (let i = 0; i < 11; i++) {
    const x = (i / 10 - .5) * stageW * .93;
    batch.box(x, height * .7, stageFront - .9, .43, .55, .55, dark, 'concert-light-fixtures');
    batch.box(x, height * .69, stageFront - .59, .31, .25, .06, leds[i % 3], 'concert-light-lenses');
  }
  batch.box(0, 1.25, stageZ, stageW * .21, .5, stageD * .24, dark, 'drum-riser');
  const drum = new THREE.CylinderGeometry(.65, .65, .55, 12); drum.rotateX(Math.PI / 2); drum.translate(0, 2.05, stageZ + .6); batch.add(drum, steel, 'drum-kit');
  for (const x of [-stageW * .28, stageW * .28]) {
    batch.box(x, 1.7, stageZ, 1.2, 1.4, .8, dark, 'backline-amplifiers');
    batch.beam(v(x * .55, 1, stageFront - 2), v(x * .55, 2.7, stageFront - 2), .05, steel, 'microphone-stands');
    batch.beam(v(x * .55 - .35, 1.03, stageFront - 2), v(x * .55 + .35, 1.03, stageFront - 2), .07, steel, 'microphone-bases');
  }

  if (kind === 'amphitheater') {
    // Permanent faceted fan roof, narrow at the rear stage and wide at its audience lip.
    const rearHalf = width * .2;
    // Rebuilt northern entry: stepped white stage house, glazed hospitality
    // volume and the long red frame visible in current exterior references.
    const entryRed=material(0xa42c2c),entryGlass=material(0x4f6a75,.25);
    batch.box(0,6.5,-halfD+1,width*.56,13,10,pale,'amphitheater-entry-stage-house');
    batch.box(width*.19,10,-halfD-2,width*.23,14,9,entryGlass,'amphitheater-glazed-entry-volume');
    for(const y of [4,11,17])batch.box(width*.19,y,-halfD-7,width*.26,.65,.65,entryRed,'amphitheater-red-entry-frame');
    for(const x of [width*.06,width*.32])batch.box(x,10.5,-halfD-7,.55,13,.55,entryRed,'entry-frame-columns');
    for(let i=0;i<6;i++){
      const x=width*.065+i*width*.042;
      batch.beam(v(x,11.3,-halfD-7.2),v(x+width*.04,16.7,-halfD-7.2),.2,pale,'entry-white-diagonal-braces');
    }
    for(const y of [4,10]){
      batch.box(width*.19,y,-halfD-10,width*.3,.45,8,pale,'entry-hospitality-terraces');
      batch.beam(v(width*.04,y+1.1,-halfD-14),v(width*.34,y+1.1,-halfD-14),.13,steel,'terrace-guardrails');
    }
    const edge = (t: number) => v(Math.sin(t) * halfW, height - 4 + Math.cos(t) * 1.5, halfD - (1 - Math.cos(t)) * depth * .24);
    for (let i = 0; i < 12; i++) {
      const t0 = -Math.PI / 2 + i * Math.PI / 12, t1 = -Math.PI / 2 + (i + 1) * Math.PI / 12;
      const a = edge(t0), b = edge(t1), ra = v(Math.sin(t0) * rearHalf, height + 2, -halfD), rb = v(Math.sin(t1) * rearHalf, height + 2, -halfD);
      surface([ra, rb, b, a], roof, 'permanent-faceted-fan-roof');
      truss(ra, a, 2.6, .36); truss(a, b, 2.4, .34);
      if (i % 3 === 0 || i === 11) column(a.x, a.z, a.y - 2.4);
      for (const fraction of [.34, .68]) truss(ra.clone().lerp(a, fraction), rb.clone().lerp(b, fraction), 1.3, .22);
    }
    column(-rearHalf, -halfD + 1, height + 1); column(rearHalf, -halfD + 1, height + 1);
    truss(v(-rearHalf, height + 2, -halfD), v(rearHalf, height + 2, -halfD), 3, .4);
    // Elliptical seating fan: radial aisles and a modest lawn strip past the roof.
    const centerZ = stageFront - 4, reach = halfD + 23 - centerZ;
    for (let row = 0; row < 30; row++) {
      const t = .24 + row * .025, y = .4 + row * .23;
      for (let sector = 0; sector < 8; sector++) {
        const a0 = -1.17 + sector * .2925 + .025, a1 = a0 + .2425, rx = width * .55 * t, rz = reach * t;
        const point = (a: number, shrink: number) => v(Math.sin(a) * (rx - shrink), y, centerZ + Math.cos(a) * (rz - shrink));
        surface([point(a0, 0), point(a1, 0), point(a1, 1), point(a0, 1)], row > 24 ? turf : concrete, 'curved-amphitheater-seating-bowl');
        if (row < 25) {
          const n = Math.max(3, Math.round(rx * .2425 / 1.1));
          for (let s = 0; s < n; s++) {
            const a = a0 + (a1 - a0) * (s + .5) / n, p = point(a, .4);
            batch.box(p.x, y + .34, p.z, .56, .16, .55, seat, 'individual-bowl-seats');
            batch.box(p.x, y + .65, p.z + .2, .56, .48, .09, seat, 'bowl-seat-backs');
          }
        }
      }
    }
    for (const side of [-1, 1]) screen(side * width * .26, 10, stageFront - 1, width * .13, 7);
  } else if (kind === 'bmo') {
    // Three gently overlapping barrel-wave shells with exposed lattice and V legs.
    for (let shell = 0; shell < 3; shell++) {
      const centerX = (shell - 1) * width * .285, shellW = width * .43;
      const point = (u: number, z: number) => v(Math.max(-halfW, Math.min(halfW, centerX + (u - .5) * shellW)), height + (shell === 1 ? 3 : 0) + Math.sin(u * Math.PI) * 4 + Math.sin((z / depth + .5) * Math.PI) * 1.3, z);
      for (let u = 0; u < 12; u++) for (let d = 0; d < 6; d++) {
        const z0 = -halfD + d * depth / 6, z1 = z0 + depth / 6;
        surface([point(u / 12, z0), point((u + 1) / 12, z0), point((u + 1) / 12, z1), point(u / 12, z1)], roof, 'bmo-three-overlapping-wave-shells');
        if (d === 0 || d === 3 || d === 5) truss(point(u / 12, z1), point((u + 1) / 12, z1), 1.5, .16);
      }
      for (const z of [-halfD + 2, 0, halfD - 2]) {
        for (const side of [-1, 1]) {
          const top = point(side < 0 ? .13 : .87, z), foot = v(centerX + side * shellW * .22, .3, z);
          batch.beam(foot, top, .45, steel, 'bmo-white-v-supports');
          batch.beam(foot, top.clone().add(v(-side * shellW * .24, 1, 0)), .4, steel, 'bmo-white-v-supports');
        }
        truss(point(.08, z), point(.92, z), 1.8, .18);
      }
      for (let u = 1; u < 7; u++) truss(point(u / 8, -halfD), point(u / 8, halfD), 1.1, .14);
    }
    seating(stageFront + 5, 15, Math.max(1.5, (halfD - stageFront - 7) / 15), width * .84, .2);
    for (const side of [-1, 1]) screen(side * width * .3, 7.5, stageFront, width * .13, 5);
  } else {
    const front = halfD, rear = -halfD, warmStage = kind === 'uline' || kind === 'briggs', frameMat = warmStage ? warm : steel;
    if (kind === 'aurora') {
      // The dedicated pavilion includes both audience roofs and the stage canopy.
    } else if (kind === 'south') {
      const p = (x: number, z: number) => v(x, height + 2 * (1 - Math.abs(x) / halfW), z);
      for (let x = 0; x < 10; x++) for (let z = 0; z < 5; z++) {
        const x0 = -halfW + x * width / 10, x1 = x0 + width / 10, z0 = rear + z * depth / 5, z1 = z0 + depth / 5;
        surface([p(x0, z0), p(x1, z0), p(x1, z1), p(x0, z1)], pale, `${kind}-open-pavilion-roof`);
        truss(p(x0, z0), p(x1, z0), 1.15, .12); truss(p(x0, z0), p(x0, z1), 1.15, .12);
        batch.beam(p(x0, z0).add(v(0, -1.15, 0)), p(x1, z1), .1, steel, 'pavilion-spaceframe-diagonals');
      }
      for (const x of [-halfW + 1, halfW - 1]) for (const z of [rear + 1, 0, front - 1]) {
        column(x, z, p(x, z).y - 1); batch.beam(v(x, 3, z), p(x * .72, z), .28, steel, 'pavilion-knee-braces');
      }
    } else {
      const rearY = height - 1.5, frontY = height + (kind === 'generac' ? 1 : kind === 'briggs' ? .8 : 2);
      surface([v(-halfW, rearY, rear), v(halfW, rearY, rear), v(halfW, frontY, front), v(-halfW, frontY, front)], warmStage ? warm : roof, 'slanted-standing-seam-stage-roof');
      for (let x = 0; x <= 14; x++) {
        const xx = -halfW + x * width / 14;
        batch.beam(v(xx, rearY + .07, rear), v(xx, frontY + .07, front), .11, warmStage ? warm : steel, 'roof-standing-seams');
        if (x % 2 === 0) truss(v(xx, rearY - .25, rear), v(xx, frontY - .25, front), .95, .19, frameMat);
      }
      for (const z of [rear + 1, front - 1]) {
        const y = z < 0 ? rearY : frontY;
        truss(v(-halfW + 1, y, z), v(halfW - 1, y, z), 1.5, .32, frameMat);
        for (const side of [-1, 1]) {
          column(side * (halfW - 1.3), z, y - .5, frameMat);
          batch.beam(v(side * (halfW - 1.3), y - 5, z), v(side * (halfW - 5), y - 1.5, z), .42, frameMat, 'open-stage-knee-braces');
        }
      }
      for (const side of [-1, 1]) {
        const x = side * width * .405, wingW = width * .17;
        batch.box(x, height * .35, stageFront - .6, wingW, height * .7, 1, warmStage ? warm : dark, 'stage-wings');
        if (warmStage) for (let i = 0; i < (kind === 'briggs' ? 13 : 9); i++) batch.box(x - wingW / 2 + i * wingW / (kind === 'briggs' ? 12 : 8), height * .35, stageFront, kind === 'briggs' ? .2 : .12, height * .68, .14, kind === 'briggs' ? warm : pale, 'vertical-wood-cladding-ribs');
        if (kind === 'generac' || kind === 'tmobile') {
          const edge = side * (halfW - .1), inner = side * width * .3;
          surface([v(inner, height * .8, stageFront + .2), v(edge, height * .98, stageFront + .2), v(edge - side * 2.5, .4, stageFront + .2), v(inner, .4, stageFront + .2)], kind === 'generac' ? orange : pale, 'angular-splayed-brand-wings');
        }
        screen(x, height * .4, stageFront + .4, wingW * .82, height * .27);
      }
      if (kind === 'tmobile' || kind === 'generac') surface([v(-halfW, height * .97, front), v(halfW, height * 1.1, front), v(halfW - 1, height * .9, front), v(-halfW + 1, height * .79, front)], kind === 'generac' ? orange : pale, 'slanted-proscenium-fascia');
      if (kind === 'miller') for (let i = 0; i < 7; i++) batch.box(0, height - i * .22, front + .1, width * .85, .1, .2, steel, 'miller-horizontal-louver-fascia');
    }
    const seatStart = coveredAudience ? stageFront + 6 : front + 8;
    const seatRows = coveredAudience ? 14 : kind === 'south' ? 5 : 9;
    const seatPitch = coveredAudience ? 2.2 : 2.7;
    seating(seatStart, seatRows, seatPitch, width * .86, coveredAudience ? 0 : .12);
    const boothZ = coveredAudience ? front - 8 : front + (kind === 'south' ? 32 : 35);
    batch.box(0, .6, boothZ, 5.8, 1.2, 3.4, concrete, 'sound-mix-platform');
    batch.box(0, 1.55, boothZ - .5, 4.1, .55, 1.1, dark, 'front-of-house-mixing-desk');
    if (!coveredAudience) {
      for (const x of [-2.8, 2.8]) for (const z of [boothZ - 1.6, boothZ + 1.6]) batch.box(x, 2.1, z, .12, 3.5, .12, steel, 'mixing-canopy-posts');
      batch.box(0, 3.9, boothZ, 6.2, .18, 3.8, roof, 'mixing-position-canopy');
    }
    const railStart = coveredAudience ? seatStart - 2 : front + 5;
    const railPitch = coveredAudience ? ((seatRows - 1) * seatPitch + 4) / 6 : 4.4;
    for (const side of [-1, 1]) {
      const x = side * width * .45;
      for (let j = 0; j < 7; j++) {
        const z = railStart + j * railPitch;
        batch.beam(v(x, .2, z), v(x, 1.15, z), .06, steel, 'audience-barrier-posts');
        if (j < 6) batch.beam(v(x, 1.15, z), v(x, 1.15, z + railPitch), .06, steel, 'audience-barrier-rails');
      }
    }
  }
  // A single physically local wash; the lenses and LED panels provide concert color.
  const spot = new THREE.SpotLight(0x85afff, 0, large ? 75 : 42, Math.PI / 5, .8, 2);
  spot.name = 'localized-stage-wash'; spot.castShadow = false;
  spot.position.set(0, height * .68, stageFront - 1); spot.target.position.set(0, 1.1, stageZ + 1); root.add(spot, spot.target);
  for (const x of [-stageW * .44, stageW * .44]) batch.box(x, 1.12, stageFront + .05, .42, .12, .2, lamp, 'stage-edge-lamps');
  batch.finish();
  root.userData.setLightingMode = (mode: LightingMode) => {
    architecture?.userData.setLightingMode(mode);
    const night = mode === 'night', sunset = mode === 'sunset';
    leds.forEach(m => { m.emissiveIntensity = night ? 2.3 : sunset ? .75 : 0; });
    lamp.emissiveIntensity = night ? 3 : sunset ? 1 : 0;
    spot.intensity = night ? (large ? 10000 : 3200) : sunset ? (large ? 3000 : 900) : 0; spot.visible = mode !== 'day'; root.userData.lightingMode = mode;
  };
  root.userData.setLightingMode('day'); root.userData.venueKind = kind;
  root.userData.stageFront = stageFront; root.userData.stageCenter = [0, 1, stageZ]; root.userData.audienceDirection = [0, 0, 1];
  root.userData.roofDimensions = { width, depth, height };
  root.userData.cameraTarget = [0, height * .35, large ? 0 : halfD];
  root.userData.cameraOffset = [width * .75, height + width * .45, depth * .7 + 45];
  root.updateMatrixWorld(true); root.userData.localBounds = new THREE.Box3().setFromObject(root);
  return root;
}
