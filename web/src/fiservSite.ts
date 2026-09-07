import * as THREE from 'three';

/** Cached OSM relation 10689047, projected X east / Z south in meters.
 * Dimensions are the minimum rotated rectangle of the mapped outer ring.
 * `bearing` follows THREE's Y rotation convention and aligns local +X eastward.
 */
export const FISERV_SITE = {
  x: -1012.939, z: -1107.733, floor: 3.41,
  bearing: -0.0156311050499272,
  width: 205.933, length: 125.678,
  footprint: [
    [-1116.164,-1049.944],[-1085.708,-1049.524],[-1085.757,-1046.041],[-1072.518,-1045.831],
    [-1072.510,-1046.638],[-1068.816,-1046.594],[-1068.824,-1045.776],[-1048.108,-1045.444],
    [-1048.100,-1046.351],[-1044.390,-1046.306],[-1044.406,-1045.389],[-1023.893,-1045.068],
    [-1023.885,-1046.074],[-1020.207,-1046.030],[-1020.215,-1045.013],[-999.605,-1044.681],
    [-999.588,-1045.798],[-995.927,-1045.754],[-995.943,-1044.626],[-975.211,-1044.305],
    [-975.194,-1045.510],[-971.492,-1045.466],[-971.508,-1044.250],[-950.890,-1043.918],
    [-950.873,-1045.234],[-947.163,-1045.190],[-947.179,-1043.863],[-931.898,-1043.620],
    [-930.800,-1048.750],[-924.876,-1076.427],[-922.785,-1075.985],[-915.283,-1111.634],
    [-917.260,-1112.043],[-909.311,-1149.229],[-919.270,-1152.767],[-935.812,-1157.865],
    [-948.083,-1161.326],[-960.629,-1164.090],[-969.694,-1165.826],[-978.262,-1167.219],
    [-987.806,-1168.447],[-1002.705,-1169.895],[-1013.169,-1170.371],[-1024.308,-1170.758],
    [-1035.927,-1170.536],[-1046.196,-1170.116],[-1068.556,-1167.883],[-1070.997,-1167.617],
    [-1073.210,-1167.285],[-1084.081,-1165.494],[-1084.154,-1160.430],[-1089.370,-1160.507],
    [-1089.264,-1168.015],[-1098.483,-1168.137],[-1098.467,-1168.568],[-1105.212,-1169.066],
    [-1105.196,-1170.448],[-1114.936,-1170.581],[-1115.082,-1157.400],[-1115.139,-1153.453],
    [-1115.562,-1123.542],[-1115.765,-1108.737],[-1115.790,-1107.365],[-1115.806,-1106.227],
    [-1115.375,-1106.215],[-1116.164,-1049.944],
  ],
  source: {
    id: 10689047, kind: 'relation', tile: { i: -1, j: 0 },
    base: 3.41, roof: 29.91, mappedParts: false, innerRings: 7,
  },
} as const;

/** Projected nodes for the seven openings in the source multipolygon. These
 * participate in the cached roof triangulation but are not the site boundary.
 */
export const FISERV_INNER_RINGS = [
  [[-1114.578,-1124.184],[-1114.106,-1157.389],[-1102.275,-1157.223],[-1102.307,-1155.366],[-1102.747,-1124.029],[-1114.578,-1124.184]],
  [[-1072.502,-1046.904],[-1072.470,-1049.845],[-1068.784,-1049.801],[-1068.816,-1046.859],[-1072.502,-1046.904]],
  [[-1048.092,-1046.616],[-1048.059,-1049.425],[-1044.357,-1049.380],[-1044.390,-1046.572],[-1048.092,-1046.616]],
  [[-1023.877,-1046.340],[-1023.852,-1049.038],[-1020.174,-1048.993],[-1020.207,-1046.295],[-1023.877,-1046.340]],
  [[-999.588,-1046.063],[-999.556,-1048.640],[-995.894,-1048.595],[-995.927,-1046.019],[-999.588,-1046.063]],
  [[-975.194,-1045.776],[-975.162,-1048.275],[-971.460,-1048.230],[-971.492,-1045.731],[-975.194,-1045.776]],
  [[-950.873,-1045.499],[-950.849,-1047.855],[-947.139,-1047.810],[-947.163,-1045.455],[-950.873,-1045.499]],
] as const;

export const FISERV_SOURCE = {
  id: FISERV_SITE.source.id,
  footprint: FISERV_SITE.footprint,
  nodes: [...FISERV_SITE.footprint, ...FISERV_INNER_RINGS.flat()],
  base: FISERV_SITE.source.base,
  roof: FISERV_SITE.source.roof,
} as const;

const tolerance = 0.16;

/** Remove only triangles made from the known relation nodes at its cached
 * base/roof pair. Plaza surfaces, roads, and neighboring buildings survive.
 */
export function removeFiservPlaceholder(group: THREE.Group, tile: { i: number; j: number }): number {
  if (tile.i !== FISERV_SITE.source.tile.i || tile.j !== FISERV_SITE.source.tile.j) return 0;
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
        const atRoof = Math.abs(y - FISERV_SOURCE.roof) < tolerance;
        roof ||= atRoof;
        if (!(atRoof || Math.abs(y - FISERV_SOURCE.base) < tolerance)
          || !FISERV_SOURCE.nodes.some(([px, pz]) => Math.hypot(x - px, z - pz) < tolerance)) {
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
