import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DISCOVERY_PARTS, type DiscoveryPlanPoint } from './discoveryGeometry.ts';
import { DISCOVERY_SITE } from './discoverySite.ts';

const wing = DISCOVERY_PARTS.find(part => part.id === 700564608)!;
export const DISCOVERY_ROOF_BASE = wing.height + .16;
export const DISCOVERY_ROOF_TOP = DISCOVERY_ROOF_BASE + 1.18;

type UV = readonly [number, number];
type Point = readonly [number, number, number];

// SW, SE, NE, NW corners of the mapped technology-wing roof. Bilinear UV
// placement keeps every detail within this slightly skewed OSM quadrilateral.
const ROOF_CORNERS = [wing.footprint[0], wing.footprint[7], wing.footprint[6], wing.footprint[4]] as const;

function plan([u, v]: UV): DiscoveryPlanPoint {
  const [sw, se, ne, nw] = ROOF_CORNERS;
  const west: DiscoveryPlanPoint = [sw[0] + (nw[0] - sw[0]) * v, sw[1] + (nw[1] - sw[1]) * v];
  const east: DiscoveryPlanPoint = [se[0] + (ne[0] - se[0]) * v, se[1] + (ne[1] - se[1]) * v];
  return [west[0] + (east[0] - west[0]) * u, west[1] + (east[1] - west[1]) * u];
}

function local([x, z]: DiscoveryPlanPoint): [number, number] {
  return [x - DISCOVERY_SITE.x, z - DISCOVERY_SITE.z];
}

function prism(uv: readonly UV[], bottom: number, top: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  uv.forEach((value, index) => {
    const [x, z] = local(plan(value));
    if (index) shape.lineTo(x, -z); else shape.moveTo(x, -z);
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: top - bottom, bevelEnabled: false, steps: 1 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bottom, 0);
  return geometry;
}

function beam(a: Point, b: Point, width: number): THREE.BufferGeometry {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
  const direction = end.clone().sub(start);
  const geometry = new THREE.BoxGeometry(width, direction.length(), width);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
  geometry.translate(...start.add(end).multiplyScalar(.5).toArray());
  return geometry;
}

function roofPoint(uv: UV, y: number): Point {
  const [x, z] = local(plan(uv));
  return [x, y, z];
}

function mergedMesh(geometries: THREE.BufferGeometry[], material: THREE.Material, name: string): THREE.Mesh {
  const compatible = geometries.map(geometry => geometry.index ? geometry.toNonIndexed() : geometry.clone());
  const geometry = mergeGeometries(compatible, false);
  if (!geometry) throw new Error(`Could not merge ${name}`);
  geometry.computeBoundingSphere();
  geometries.forEach(geometryPart => geometryPart.dispose());
  compatible.forEach(geometryPart => geometryPart.dispose());
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Photo-derived roof dressing for the technology wing, in DISCOVERY_SITE-local
 * coordinates. The aerial reference suggests two large photovoltaic fields;
 * their 12-by-4 visual module grid is deliberately approximate, not a surveyed
 * panel count. Equipment placement and rail spacing are visual estimates. */
export function buildDiscoveryRoof(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'discovery-technology-wing-roof-details';

  const solar = new THREE.MeshStandardMaterial({ color: 0x173944, roughness: .32, metalness: .38 });
  const frame = new THREE.MeshStandardMaterial({ color: 0xb8c0bd, roughness: .62, metalness: .48 });
  const equipment = new THREE.MeshStandardMaterial({ color: 0xaeb2ae, roughness: .78, metalness: .25 });

  const arrays: THREE.BufferGeometry[] = [];
  const frames: THREE.BufferGeometry[] = [];
  const fields: readonly [number, number][] = [[.09, .44], [.56, .91]];
  for (const [v0, v1] of fields) {
    arrays.push(prism([[.055, v0], [.945, v0], [.945, v1], [.055, v1]], DISCOVERY_ROOF_BASE + .05, DISCOVERY_ROOF_BASE + .14));
    for (let column = 0; column <= 12; column++) {
      const u = .055 + .89 * column / 12;
      frames.push(prism([[u - .002, v0], [u + .002, v0], [u + .002, v1], [u - .002, v1]], DISCOVERY_ROOF_BASE + .14, DISCOVERY_ROOF_BASE + .17));
    }
    for (let row = 0; row <= 4; row++) {
      const v = v0 + (v1 - v0) * row / 4;
      frames.push(prism([[.055, v - .003], [.945, v - .003], [.945, v + .003], [.055, v + .003]], DISCOVERY_ROOF_BASE + .14, DISCOVERY_ROOF_BASE + .17));
    }
  }
  root.add(mergedMesh(arrays, solar, 'technology-wing-photovoltaic-fields'));
  root.add(mergedMesh(frames, frame, 'technology-wing-photovoltaic-frames'));

  const boxes: THREE.BufferGeometry[] = [];
  for (const [u0, u1, v0, v1, height] of [
    [.28, .36, .465, .535, .62], [.47, .57, .46, .54, .84], [.68, .75, .47, .53, .54],
  ] as const) boxes.push(prism([[u0, v0], [u1, v0], [u1, v1], [u0, v1]], DISCOVERY_ROOF_BASE + .03, DISCOVERY_ROOF_BASE + height));
  root.add(mergedMesh(boxes, equipment, 'technology-wing-rooftop-equipment'));

  const rails: THREE.BufferGeometry[] = [];
  const inset = .018;
  const perimeter: UV[] = [[inset, inset], [1 - inset, inset], [1 - inset, 1 - inset], [inset, 1 - inset]];
  for (let side = 0; side < perimeter.length; side++) {
    const a = perimeter[side], b = perimeter[(side + 1) % perimeter.length];
    rails.push(beam(roofPoint(a, DISCOVERY_ROOF_BASE + .72), roofPoint(b, DISCOVERY_ROOF_BASE + .72), .045));
    const posts = side % 2 === 0 ? 13 : 5;
    for (let index = 0; index <= posts; index++) {
      const t = index / posts;
      const uv: UV = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      rails.push(beam(roofPoint(uv, DISCOVERY_ROOF_BASE + .04), roofPoint(uv, DISCOVERY_ROOF_BASE + .74), .04));
    }
  }
  root.add(mergedMesh(rails, frame, 'technology-wing-perimeter-safety-rail'));

  root.userData.roofCorners = ROOF_CORNERS;
  root.userData.baseline = DISCOVERY_ROOF_BASE;
  root.userData.maximumHeight = DISCOVERY_ROOF_TOP;
  root.userData.source = 'dw_03 aerial photograph; mapped OSM technology-wing footprint';
  return root;
}
