import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCityHallTower } from './cityHallTower.ts';

const BRICK = new THREE.MeshLambertMaterial({ color: 0xa56f55 });
const STONE = new THREE.MeshLambertMaterial({ color: 0xb8aa93 });
const COPPER = new THREE.MeshLambertMaterial({ color: 0x607b70 });
const DARK = new THREE.MeshLambertMaterial({ color: 0x292823 });

function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return g;
}

function mainRoof() {
  const positions: number[] = [];
  const widths = (z: number) => 1 + (z < -16 ? 16 - (z + 46) / 15
    : z < 20 ? 14 - (z + 16) / 18 : 12 - (z - 20) * 5 / 14);
  const levels = [-46, -40, -16, 20, 28, 34];
  const ridgeY = (z: number) => z === -46 || z === 34 ? 36 : 47;
  for (const side of [-1, 1]) for (let i = 0; i < levels.length - 1; i++) {
    const z0 = levels[i], z1 = levels[i + 1];
    const a = [side * widths(z0), 36, z0], b = [side * widths(z1), 36, z1];
    const c = [0, ridgeY(z1), z1], d = [0, ridgeY(z0), z0];
    positions.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  const pos = g.getAttribute('position'), normal = g.getAttribute('normal');
  for (let i = 0; i < pos.count; i += 3) if (normal.getY(i) < 0) {
    const b = [pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1)];
    pos.setXYZ(i + 1, pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
    pos.setXYZ(i + 2, ...b as [number, number, number]);
  }
  g.computeVertexNormals(); return g;
}

function taperedBlock(height: number, y: number) {
  const outline: [number, number][] = [[-16, -46], [16, -46], [14, -16], [12, 20], [7, 34], [-7, 34], [-12, 20], [-14, -16]];
  const shape = new THREE.Shape(); shape.moveTo(outline[0][0], -outline[0][1]);
  for (const [x, z] of outline.slice(1)) shape.lineTo(x, -z); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); g.translate(0, y, 0); return g;
}

function mesh(parts: THREE.BufferGeometry[], material: THREE.Material, name: string) {
  const compatible = parts.map((g) => { const n = g.index ? g.toNonIndexed() : g.clone(); n.deleteAttribute('uv'); return n; });
  const geometry = mergeGeometries(compatible, false); if (!geometry) throw new Error(`Could not merge ${name}`);
  parts.forEach(g => g.dispose()); compatible.forEach(g => g.dispose());
  const out = new THREE.Mesh(geometry, material); out.name = name; out.castShadow = true; out.receiveShadow = true; return out;
}

/** Photo-informed City Hall; south is +Z, local ground is Y=0. */
export function buildCityHall(): THREE.Group {
  const hall = new THREE.Group(); hall.name = 'CITY_HALL';
  const masonry = [taperedBlock(32, 4), box(18, 54, 17, 0, 31, 42)];
  const stone: THREE.BufferGeometry[] = [taperedBlock(4, 0), box(20, 5, 19, 0, 2.5, 42)];
  const windows: THREE.BufferGeometry[] = [];
  const roofs = [mainRoof()];
  const trim: THREE.BufferGeometry[] = [];
  const gables: THREE.BufferGeometry[] = [];

  // Piecewise wall widths follow the existing tapered plan precisely.
  const sideAt = (z: number) => z < -16 ? 16 - (z + 46) / 15
    : z < 20 ? 14 - (z + 16) / 18 : 12 - (z - 20) * 5 / 14;
  const onSide = (w: number, h: number, depth: number, side: number, y: number, z: number, offset = .14) => {
    const slope = z < -16 ? -1 / 15 : z < 20 ? -1 / 18 : -5 / 14;
    return new THREE.BoxGeometry(depth, h, w).rotateY(Math.atan(side * slope))
      .translate(side * (sideAt(z) + offset), y, z);
  };
  for (const side of [-1, 1]) {
    for (let floor = 0; floor < 8; floor++) for (let bay = 0; bay < 16; bay++) {
      const z = -41 + bay * 4.65, y = 6.2 + floor * 3.82;
      windows.push(onSide(1.8, 2.25, .18, side, y, z));
      trim.push(onSide(2.15, .18, .4, side, y - 1.2, z), onSide(2.15, .2, .36, side, y + 1.2, z));
      if (floor === 7) trim.push(onSide(.2, 2.8, .4, side, y, z - 1.1));
    }
    for (const y of [4.3, 12, 27, 35.8]) {
      for (const [a, b] of [[-46, -16], [-16, 20], [20, 34]])
        trim.push(onSide((b - a) / Math.cos(Math.atan((sideAt(b) - sideAt(a)) / (b - a))), .32, .65, side, y, (a + b) / 2));
    }
    // Repeated Flemish gables, including the larger central stepped gable in HABS photo 8.
    for (const [z, width, height] of [[-34, 5, 6], [-22, 5, 6], [-7, 13, 12], [9, 5, 6], [22, 4, 5]]) {
      const profile = new THREE.Shape();
      profile.moveTo(-width / 2, 35.8); profile.lineTo(width / 2, 35.8);
      profile.lineTo(width / 2, 38); profile.lineTo(width * .35, 38);
      profile.bezierCurveTo(width * .35, 40, width * .18, 39, width * .18, 35.8 + height - 1);
      profile.lineTo(-width * .18, 35.8 + height - 1);
      profile.bezierCurveTo(-width * .18, 39, -width * .35, 40, -width * .35, 38);
      profile.lineTo(-width / 2, 38); profile.closePath();
      const face = new THREE.ExtrudeGeometry(profile, { depth: .8, bevelEnabled: false, curveSegments: 6 });
      face.rotateY(side * Math.PI / 2).translate(side * sideAt(z), 0, z); gables.push(face);
      trim.push(onSide(width + .45, .3, 1.2, side, 36.1, z),
        onSide(width * .4, .3, 1.15, side, 35.8 + height - .9, z));
      windows.push(box(.2, 2.2, 1.5, side * (sideAt(z) + .93), 37.6, z));
    }
  }
  // Eight storeys of paired north windows, plus the tower's vertically grouped bays.
  for (let floor = 0; floor < 8; floor++) for (const x of [-12, -8, -4, 0, 4, 8, 12])
    windows.push(box(1.7, 2.25, .2, x, 6.2 + floor * 3.82, -46.12));
  for (const y of [12, 17, 22, 27, 32, 37, 42, 47, 52]) for (const x of [-4.8, 0, 4.8]) {
    windows.push(box(2.2, 3.3, .2, x, y, 50.61));
    for (const side of [-1, 1]) windows.push(box(.2, 3.3, 2.2, side * 9.12, y, 42 + x));
    trim.push(box(2.65, .25, .45, x, y - 1.75, 50.65));
  }
  for (const y of [8, 34.5, 46, 55.7, 57.6]) stone.push(box(19.2, .7, 18.2, 0, y, 42));
  for (const x of [-8, -2.4, 2.4, 8]) trim.push(box(.4, 42, .5, x, 32, 50.65));

  // Deep round-arched south entry with an expressed sandstone archivolt.
  const entry = new THREE.Shape(); entry.moveTo(-3.8, .15); entry.lineTo(3.8, .15);
  entry.lineTo(3.8, 3.4); entry.absarc(0, 3.4, 3.8, 0, Math.PI, false); entry.closePath();
  const entryGeometry = new THREE.ExtrudeGeometry(entry, { depth: .18, bevelEnabled: false, curveSegments: 12 });
  entryGeometry.translate(0, 0, 51.56);
  const arch = new THREE.TorusGeometry(4.1, .38, 6, 24, Math.PI); arch.translate(0, 3.4, 51.8);
  stone.push(arch, box(.75, 3.4, .6, -4.1, 1.7, 51.8), box(.75, 3.4, .6, 4.1, 1.7, 51.8));
  hall.add(mesh([entryGeometry], DARK, 'south-arched-entry'));

  // Secondary north lantern, visible behind the gabled office roof in HABS photo 8.
  masonry.push(box(7, 10, 7, 0, 46, -35));
  stone.push(box(8, .7, 8, 0, 51, -35), box(7.5, .55, 7.5, 0, 56, -35));
  const lantern: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const shaft = new THREE.CylinderGeometry(.18, .24, 4.4, 8);
    shaft.translate(Math.sin(a) * 2.7, 53.5, -35 + Math.cos(a) * 2.7); lantern.push(shaft);
  }
  const cap = new THREE.LatheGeometry([new THREE.Vector2(3.4, 56.25), new THREE.Vector2(3.1, 57.5),
    new THREE.Vector2(2.2, 59), new THREE.Vector2(.15, 61)], 16); cap.translate(0, 0, -35); roofs.push(cap);
  const northPole = new THREE.CylinderGeometry(.07, .1, 4, 6); northPole.translate(0, 63, -35); lantern.push(northPole);

  const pole = new THREE.CylinderGeometry(.18, .28, 12.192, 8); pole.translate(0, 113.69, 42);
  const finial = new THREE.SphereGeometry(.46, 8, 6); finial.translate(0, 119.326, 42);
  hall.add(mesh(masonry, BRICK, 'brick-masonry'), mesh(stone, STONE, 'stone-base'),
    mesh(trim, STONE, 'facade-bands-and-window-surrounds'), mesh(gables, BRICK, 'flemish-roof-gables'),
    mesh(lantern, STONE, 'north-roof-lantern'), mesh(windows, DARK, 'window-bays'),
    mesh(roofs, COPPER, 'copper-roofs'), mesh([pole, finial], DARK, 'flagpole'), buildCityHallTower());
  hall.userData.setMode = (_mode: 'day' | 'sunset' | 'night') => {};
  return hall;
}
