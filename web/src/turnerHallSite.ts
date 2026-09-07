import * as THREE from 'three';

/** Cached OSM way 69298480 (Geofabrik extract, 2026-09-06).
 * X east / Z south, meters from lon -87.905 / lat 43.035.
 * Anchor and dimensions are the minimum rotated rectangle of the mapped ring.
 * Local +X points east, +Z south; the principal street facade faces local -X.
 * Floor follows the cached terrain extrusion base + 1.5m, not a surveyed datum.
 */
export const TURNER_HALL_SITE = {
  x: -856.956967, z: -973.595260,
  lat: 43.04380492032418, lon: -87.9155318798521,
  floor: 3.51,
  bearing: -0.01026173944757415,
  width: 46.657480, depth: 32.181981,
  footprint: [
    [-880.327,-969.646],[-879.522,-969.634],[-879.554,-966.704],[-879.815,-966.704],
    [-879.872,-961.153],[-879.611,-961.153],[-879.636,-958.831],[-879.644,-957.737],
    [-876.365,-957.704],[-873.224,-957.670],[-865.364,-957.593],[-845.209,-957.383],
    [-833.801,-957.272],[-833.492,-986.740],[-838.529,-986.784],[-838.496,-989.494],
    [-845.811,-989.571],[-851.027,-989.626],[-851.051,-987.669],[-852.768,-987.680],
    [-879.327,-987.957],[-879.367,-984.562],[-879.375,-983.821],[-879.644,-983.821],
    [-879.701,-978.514],[-879.441,-978.514],[-879.473,-975.119],[-880.262,-975.130],
    [-880.287,-973.250],[-880.295,-972.344],[-880.303,-971.503],[-880.327,-969.646],
  ],
  source: {
    id: 69298480, kind: 'way', tile: { i: -1, j: 0 },
    base: 2.01, roof: 16.71, mappedParts: false, innerRings: 0,
    extract: 'data/raw/osm/pbf_extract.json', extracted: '2026-09-06',
  },
} as const;

export const TURNER_HALL_SOURCE = {
  id: TURNER_HALL_SITE.source.id,
  footprint: TURNER_HALL_SITE.footprint,
  nodes: TURNER_HALL_SITE.footprint,
  base: TURNER_HALL_SITE.source.base,
  roof: TURNER_HALL_SITE.source.roof,
} as const;

const tolerance = 0.16;

/** Remove only triangles made from the known way nodes at its cached
 * base/roof pair. Plaza surfaces, roads, and neighboring buildings survive.
 */
export function removeTurnerHallPlaceholder(group: THREE.Group, tile: { i: number; j: number }): number {
  if (tile.i !== TURNER_HALL_SITE.source.tile.i || tile.j !== TURNER_HALL_SITE.source.tile.j) return 0;
  let removed = 0;
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object.name !== 'BLDG') return;
    const original = object.geometry;
    const position = original.getAttribute('position');
    if (!position || original.index) return;
    const keep: number[] = [];
    for (let triangle = 0; triangle + 2 < position.count; triangle += 3) {
      let roof = false;
      let matches = true;
      for (let vertex = triangle; vertex < triangle + 3; vertex++) {
        const x = position.getX(vertex), y = position.getY(vertex), z = position.getZ(vertex);
        const atRoof = Math.abs(y - TURNER_HALL_SOURCE.roof) < tolerance;
        roof ||= atRoof;
        if (!(atRoof || Math.abs(y - TURNER_HALL_SOURCE.base) < tolerance)
          || !TURNER_HALL_SOURCE.nodes.some(([px, pz]) => Math.hypot(x - px, z - pz) < tolerance)) {
          matches = false;
          break;
        }
      }
      if (matches && roof) removed++;
      else keep.push(triangle, triangle + 1, triangle + 2);
    }
    if (keep.length === position.count) return;
    const geometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(original.attributes)) {
      if (!(attribute instanceof THREE.BufferAttribute) || name === 'normal') continue;
      const array = attribute.array.slice(0, keep.length * attribute.itemSize);
      keep.forEach((vertex, index) => {
        for (let component = 0; component < attribute.itemSize; component++)
          array[index * attribute.itemSize + component] = attribute.array[vertex * attribute.itemSize + component];
      });
      geometry.setAttribute(name, new THREE.BufferAttribute(array, attribute.itemSize, attribute.normalized));
    }
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    object.geometry = geometry;
    original.dispose();
  });
  return removed;
}
