import * as THREE from 'three';

type XZ = readonly [number, number];

interface PassageOpening {
  readonly name: string;
  readonly clearanceY: number;
  readonly originalFloorMax: number;
  readonly originalRoofMin: number;
  readonly edges: readonly (readonly [XZ, XZ])[];
}

/**
 * Exact projected OSM facade edges adjoining the tram passage nodes. The
 * packed building pipeline currently extrudes the parent footprints from the
 * terrain and ignores the mapped building:min_level on ways 1403766299 and
 * 700370375. Only these parent-wall edges need their lower limit corrected.
 */
export const HOP_PASSAGE_OPENINGS: readonly PassageOpening[] = [
  {
    name: 'Couture transit concourse (parent way 1300225285, overhead part 1403766299)',
    clearanceY: 9.646, // highest cached route rail y 4.6455 + 5 m
    originalFloorMax: 3,
    originalRoofMin: 100,
    edges: [
      [[418.207, -284.695], [420.843, -283.821]],
      [[420.843, -283.821], [424.448, -282.450]],
      [[407.368, -196.468], [403.902, -196.225]],
      [[403.902, -196.225], [401.860, -196.037]],
    ],
  },
  {
    name: 'Michigan Street passage (parent way 34901930, overhead part 700370375)',
    clearanceY: 11.413, // highest cached route rail y 6.4128 + 5 m
    originalFloorMax: 7,
    originalRoofMin: 150,
    edges: [
      [[211.524, -304.388], [211.410, -305.881]],
      [[211.410, -305.881], [210.588, -315.600]],
      [[273.201, -297.765], [272.184, -309.873]],
      [[272.184, -309.873], [272.143, -310.392]],
      [[272.143, -310.392], [271.272, -320.720]],
    ],
  },
] as const;

const SOURCE_VERTEX_TOLERANCE_M = .18;

function near(point: XZ, x: number, z: number) {
  return Math.hypot(x - point[0], z - point[1]) <= SOURCE_VERTEX_TOLERANCE_M;
}

function matchesSourceEdge(position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
                           triangle: number, edge: readonly [XZ, XZ]) {
  let atA = false, atB = false;
  for (let vertex = triangle; vertex < triangle + 3; vertex++) {
    const x = position.getX(vertex), z = position.getZ(vertex);
    const a = near(edge[0], x, z), b = near(edge[1], x, z);
    if (!a && !b) return false;
    atA ||= a;
    atB ||= b;
  }
  return atA && atB;
}

/**
 * Raise only the low vertices of the cached parent-building facade triangles
 * at the two mapped tram passages. Returns the number of corrected triangles.
 * Calling it again is a no-op, as is calling it for every other city tile.
 */
export function adaptHopPassages(group: THREE.Group, tile: { i: number; j: number }): number {
  if (tile.i !== 0 || tile.j !== 0) return 0;
  let corrected = 0;
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object.name !== 'BLDG') return;
    const position = object.geometry.getAttribute('position');
    if (!position || position.itemSize < 3) return;
    let changed = false;
    for (let triangle = 0; triangle + 2 < position.count; triangle += 3) {
      const ys = [position.getY(triangle), position.getY(triangle + 1), position.getY(triangle + 2)];
      const passage = HOP_PASSAGE_OPENINGS.find(candidate =>
        Math.min(...ys) < candidate.originalFloorMax
        && Math.max(...ys) > candidate.originalRoofMin
        && candidate.edges.some(edge => matchesSourceEdge(position, triangle, edge)));
      if (!passage) continue;
      let raised = false;
      for (let vertex = triangle; vertex < triangle + 3; vertex++) {
        if (position.getY(vertex) >= passage.clearanceY) continue;
        position.setY(vertex, passage.clearanceY);
        raised = changed = true;
      }
      if (raised) corrected++;
    }
    if (!changed) return;
    position.needsUpdate = true;
    object.geometry.computeVertexNormals();
    object.geometry.computeBoundingBox();
    object.geometry.computeBoundingSphere();
  });
  return corrected;
}
