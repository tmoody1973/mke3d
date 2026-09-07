import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function box(w: number, h: number, d: number, x: number, y: number, z: number) {
  const geometry = new THREE.BoxGeometry(w, h, d);
  geometry.translate(x, y, z); return geometry;
}
function cylinder(top: number, bottom: number, height: number, x: number, y: number, z: number, sides = 12) {
  const geometry = new THREE.CylinderGeometry(top, bottom, height, sides);
  geometry.translate(x, y, z); return geometry;
}
function onFace(geometry: THREE.BufferGeometry, angle: number) {
  geometry.rotateY(angle); geometry.translate(0, 0, 42); return geometry;
}
function arch(width: number, bottom: number, spring: number, depth: number, x: number, z: number) {
  const shape = new THREE.Shape(); const r = width / 2;
  shape.moveTo(-r, bottom); shape.lineTo(r, bottom); shape.lineTo(r, spring);
  shape.absarc(0, spring, r, 0, Math.PI, false); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 8 });
  geometry.translate(x, 0, z); return geometry;
}
function batch(parts: THREE.BufferGeometry[], color: number, name: string) {
  const compatible = parts.map((part) => {
    const geometry = part.index ? part.toNonIndexed() : part.clone();
    geometry.deleteAttribute('uv'); return geometry;
  });
  const geometry = mergeGeometries(compatible, false);
  if (!geometry) throw new Error(`Could not merge ${name}`);
  for (const part of [...parts, ...compatible]) part.dispose();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({ color }));
  mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; return mesh;
}

/** The 1895 tower's upper stages. Dimensions above the documented clock diameter
 * are photo-based proportions, in metres; the architectural crown ends at 107.594.
 * Local Y is height and the tower centre is X=0, Z=42. */
export function buildCityHallTower(): THREE.Group {
  const group = new THREE.Group(); group.name = 'city-hall-upper-tower';
  const brick: THREE.BufferGeometry[] = [box(18, 11.6, 17, 0, 63.8, 42), box(10.2, 7, 10.2, 0, 75.5, 42)];
  const stone: THREE.BufferGeometry[] = [];
  const openings: THREE.BufferGeometry[] = [];
  const columns: THREE.BufferGeometry[] = [];
  const turrets: THREE.BufferGeometry[] = [];
  const caps: THREE.BufferGeometry[] = [];
  const faces: THREE.BufferGeometry[] = [];
  const hands: THREE.BufferGeometry[] = [];
  const pediments: THREE.BufferGeometry[] = [];
  for (const [y, width, depth, height] of [[58.3, 19, 18, .6], [69.8, 19.1, 18.1, .65], [70.7, 19.8, 18.8, .55], [72, 17, 17, .65], [77.4, 16.2, 16.2, .65], [78.1, 17.1, 17.1, .45]]) {
    stone.push(box(width, height, depth, 0, y, 42));
  }
  // Three round-headed bell openings on each facade, with archivolts and shafts.
  for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const depth = Math.abs(Math.cos(angle)) > .5 ? 8.55 : 9.05;
    for (const x of [-4.8, 0, 4.8]) {
      openings.push(onFace(arch(2.8, 59.15, 66.3, .12, x, depth), angle));
      for (const side of [-1, 1]) columns.push(onFace(cylinder(.19, .23, 6.8, x + side * 1.64, 62.9, depth + .14), angle));
      const rim = new THREE.TorusGeometry(1.65, .2, 5, 12, Math.PI);
      rim.translate(x, 66.3, depth + .2); stone.push(onFace(rim, angle));
      stone.push(onFace(box(3.8, .35, .5, x, 59.1, depth), angle));
    }
    // Open gallery: paired columns flank three openings, rather than a solid box.
    for (const x of [-5.8, -2, 2, 5.8]) for (const dx of [-.3, .3]) {
      columns.push(onFace(cylinder(.17, .2, 4.65, x + dx, 74.65, 7.3), angle));
      stone.push(onFace(box(.55, .28, .55, x + dx, 76.92, 7.3), angle));
    }
    for (let i = 0; i < 17; i++) columns.push(onFace(cylinder(.09, .13, .95, -6.4 + i * .8, 72.85, 7.7, 6), angle));
    stone.push(onFace(box(14, .22, .35, 0, 73.4, 7.7), angle));
    // Curved masonry clock gable rises out of the roof. Faces lie beyond its front.
    const profile = new THREE.Shape();
    profile.moveTo(-4.7, 78.4); profile.lineTo(4.7, 78.4); profile.lineTo(4.7, 85.7);
    profile.bezierCurveTo(4.7, 88.5, 2.3, 87.5, 0, 91.3);
    profile.bezierCurveTo(-2.3, 87.5, -4.7, 88.5, -4.7, 85.7); profile.closePath();
    const pediment = new THREE.ExtrudeGeometry(profile, { depth: .7, bevelEnabled: false, curveSegments: 8 });
    pediment.translate(0, 0, 7.45); pediments.push(onFace(pediment, angle));
    const rim = new THREE.TorusGeometry(2.94, .21, 6, 40);
    rim.translate(0, 83.2, 8.26); stone.push(onFace(rim, angle));
    const dial = new THREE.CircleGeometry(2.743, 48);
    dial.translate(0, 83.2, 8.29); faces.push(onFace(dial, angle));
    for (let tick = 0; tick < 12; tick++) {
      const a = tick * Math.PI / 6;
      const mark = box(.12, .4, .07, 0, 2.38, 0);
      mark.rotateZ(-a); mark.translate(0, 83.2, 8.36); hands.push(onFace(mark, angle));
    }
    for (const [angleZ, length] of [[Math.PI / 3, 1.55], [-Math.PI / 3, 2.15]]) {
      const hand = box(.16, length, .085, 0, length / 2, 0);
      hand.rotateZ(angleZ); hand.translate(0, 83.2, 8.38); hands.push(onFace(hand, angle));
    }
    const pin = new THREE.CircleGeometry(.2, 12); pin.translate(0, 83.2, 8.44); hands.push(onFace(pin, angle));
  }
  // Four cylindrical corner pinnacles and their pale stone pointed crowns.
  for (const x of [-7.5, 7.5]) for (const z of [34.5, 49.5]) {
    turrets.push(cylinder(1.05, 1.25, 11, x, 77, z));
    for (const y of [72, 78.6, 82.3]) stone.push(cylinder(1.35, 1.35, .4, x, y, z));
    caps.push(cylinder(.12, 1.45, 4.1, x, 84.55, z));
  }
  // A ring loft reproduces the concave, copper-clad spire silhouette. Eight
  // vertices include the square corners, while upper stages become octagonal.
  const rings = [
    [82, 8.1, 1], [85, 7.45, .98], [88, 5.9, .92], [91, 4.3, .85],
    [94, 3.1, .78], [96.5, 2.55, .72], [98.2, 2.45, .7071],
  ];
  const positions: number[] = [];
  const point = (ring: number[], side: number) => {
    const [y, radius, corner] = ring; const a = side * Math.PI / 4;
    const r = side % 2 === 0 ? radius : radius * Math.SQRT2 * corner;
    return [Math.sin(a) * r, y, 42 + Math.cos(a) * r];
  };
  for (let j = 0; j < rings.length - 1; j++) for (let i = 0; i < 8; i++) {
    const a = point(rings[j], i), b = point(rings[j], (i + 1) % 8);
    const c = point(rings[j + 1], (i + 1) % 8), d = point(rings[j + 1], i);
    positions.push(...a, ...b, ...d, ...b, ...c, ...d);
  }
  const spire = new THREE.BufferGeometry(); spire.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); spire.computeVertexNormals();
  const copper = [spire, cylinder(2.7, 2.7, .5, 0, 98.45, 42, 8), cylinder(2.55, 2.7, .4, 0, 102.2, 42, 8)];
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    columns.push(cylinder(.14, .2, 3.35, Math.sin(a) * 2.25, 100.3, 42 + Math.cos(a) * 2.25, 8));
  }
  openings.push(cylinder(1.55, 1.55, 3.1, 0, 100.3, 42, 8));
  const crown = new THREE.LatheGeometry([
    new THREE.Vector2(2.55, 102.4), new THREE.Vector2(2.65, 103.1),
    new THREE.Vector2(2.4, 104.15), new THREE.Vector2(1.6, 105.2),
    new THREE.Vector2(.55, 106.25), new THREE.Vector2(.22, 107.594),
  ], 16); crown.translate(0, 0, 42); copper.push(crown);
  group.add(batch(brick, 0xa56f55, 'upper-tower-masonry'), batch(stone, 0xb8aa93, 'tower-cornices'),
    batch(openings, 0x292823, 'bell-openings'), batch(columns, 0xb8aa93, 'gallery-columns'),
    batch(turrets, 0xa56f55, 'corner-turrets'), batch(caps, 0xb8aa93, 'turret-caps'),
    batch(pediments, 0xb8aa93, 'clock-pediments'), batch(faces, 0x292823, 'clock-faces'),
    batch(hands, 0xe8e1cb, 'clock-hands'), batch(copper, 0x607b70, 'curved-copper-spire'));
  group.userData.clockDiameter = 5.486;
  group.userData.architecturalTop = 107.594;
  return group;
}
