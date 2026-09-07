import * as THREE from 'three';

/** Cached OSM footprints, Geofabrik extract 2026-09-06.
 * X east / Z south, meters from lon -87.905 / lat 43.035.
 * Anchors/dimensions are minimum rotated rectangles; bearing is THREE rotation.y.
 * Floors follow cached terrain extrusion base + 1.5 m, not a surveyed datum.
 * Riverside occupies the shared 13-level Empire Building. Replacement must
 * retain its entire mapped mass, including the tower above the theater entry.
 */

/** Wells Street facade faces local +Z; the main inset facade spans x -12.68 to +19.84. */
export const PABST_SITE = {
  x: -443.47023485459124,
  z: -676.07232736959179,
  lat: 43.04111420702307,
  lon: -87.91045018642745,
  bearing: 0.33027851809981,
  width: 54.76535404077151,
  depth: 29.50477346796777,
  floor: 4.21,
  footprint: [
    [-473.740,-679.931],[-472.902,-677.962],[-464.179,-657.517],[-453.284,-661.199],
    [-451.934,-661.653],[-451.250,-659.662],[-450.729,-658.136],[-419.915,-668.553],
    [-420.469,-670.167],[-421.128,-672.080],[-420.932,-672.146],[-421.111,-672.677],
    [-420.387,-672.920],[-414.163,-675.021],[-422.332,-698.850],[-428.329,-696.826],
    [-429.281,-696.506],[-430.176,-696.196],[-435.196,-694.504],[-434.513,-692.525],
    [-441.852,-690.048],[-443.821,-689.374],[-444.488,-689.363],[-445.270,-689.318],
    [-446.067,-689.208],[-447.231,-689.009],[-448.362,-688.743],[-449.590,-688.224],
    [-451.047,-687.439],[-452.438,-686.466],[-459.208,-684.177],[-459.403,-684.785],
    [-473.740,-679.931],
  ],
  source: {
    id: 68649538, kind: 'way', tile: { i: -1, j: 0 },
    name: 'Pabst Theater', base: 2.71, roof: 14.11,
    mappedLevels: 3, mappedParts: false, innerRings: 0,
    fullTriangles: 94, lodTriangles: 28,
    extract: 'data/raw/osm/pbf_extract.json', extracted: '2026-09-06',
  },
} as const;

/** Wisconsin frontage runs world (-497.500,-430.763) to (-451.633,-430.431).
 * The diagonal river wall is the local +X side; local +Z is the south end. */
export const RIVERSIDE_SITE = {
  x: -489.45936040986317,
  z: -450.70715355069308,
  lat: 43.03907606809513,
  lon: -87.91101538627225,
  bearing: 0.60291165213326,
  width: 45.68999201161290,
  depth: 76.30065703623995,
  floor: 2.11,
  footprint: [
    [-526.328,-471.642],[-519.314,-460.872],[-518.851,-460.198],[-520.657,-459.103],
    [-522.211,-458.152],[-521.300,-456.671],[-519.721,-457.633],[-517.939,-458.727],
    [-513.562,-452.038],[-512.170,-449.793],[-511.300,-448.400],[-501.763,-433.096],
    [-501.959,-430.829],[-499.558,-429.668],[-497.500,-430.763],[-492.959,-430.730],
    [-488.175,-430.697],[-488.199,-428.264],[-488.216,-426.230],[-477.280,-426.031],
    [-477.263,-428.131],[-477.239,-430.608],[-470.892,-430.564],[-468.817,-430.564],
    [-465.872,-430.531],[-462.853,-430.498],[-460.754,-430.498],[-457.255,-430.465],
    [-451.633,-430.431],[-451.340,-432.941],[-451.169,-434.445],[-451.096,-435.087],
    [-452.495,-437.132],[-454.253,-439.686],[-457.198,-444.132],[-461.852,-450.888],
    [-462.463,-451.772],[-464.391,-454.581],[-471.657,-465.130],[-484.969,-484.469],
    [-491.308,-493.680],[-515.661,-478.365],[-525.035,-472.472],[-526.328,-471.642],
  ],
  source: {
    id: 68641417, kind: 'way', tile: { i: -1, j: 0 },
    name: 'Empire Building', base: 0.61, roof: 45.01,
    mappedLevels: 13, mappedParts: false, innerRings: 0,
    fullTriangles: 127, lodTriangles: 37,
    extract: 'data/raw/osm/pbf_extract.json', extracted: '2026-09-06',
  },
} as const;

export const THEATER_SOURCES = [PABST_SITE, RIVERSIDE_SITE] as const;

/** Separate mapped marquee roof. The generic tile builder extruded this
 * building=roof/layer=1 feature down to street level, blocking the entry.
 * The detailed Riverside model already supplies the canopy and its supports.
 */
export const RIVERSIDE_CANOPY_SOURCE = {
  footprint: [
    [-488.216,-426.230],[-477.280,-426.031],[-477.263,-428.131],[-477.239,-430.608],
    [-477.426,-430.619],[-478.093,-430.619],[-480.095,-430.630],[-482.731,-430.653],
    [-485.351,-430.675],[-487.329,-430.686],[-487.980,-430.697],[-488.175,-430.697],
    [-488.199,-428.264],[-488.216,-426.230],
  ],
  source: {
    id: 397489770, kind: 'way', tile: { i: -1, j: 0 },
    name: 'Riverside marquee roof', building: 'roof', layer: 1,
    base: 2.01, roof: 7.01, innerRings: 0,
    fullTriangles: 37, lodTriangles: 0,
    extract: 'data/raw/osm/pbf_extract.json', extracted: '2026-09-06',
  },
} as const;

export const THEATER_PLACEHOLDER_SOURCES = [...THEATER_SOURCES, RIVERSIDE_CANOPY_SOURCE] as const;
const tolerance = 0.16;

/** Remove only source-node triangles at each building's cached base/roof pair.
 * Requiring a roof vertex preserves ground surfaces, and exact nodes preserve
 * neighboring buildings even where their bounding boxes overlap these sites.
 * The LOD rings use a subset of the same OSM nodes, with coarser quantization.
 */
export function removeTheaterPlaceholders(group: THREE.Group, tile: { i: number; j: number }): number {
  const sites = THEATER_PLACEHOLDER_SOURCES.filter(site => site.source.tile.i === tile.i && site.source.tile.j === tile.j);
  if (!sites.length) return 0;
  let removed = 0;
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object.name !== 'BLDG') return;
    const original = object.geometry;
    const position = original.getAttribute('position');
    if (!position || original.index) return;
    const keep: number[] = [];
    for (let triangle = 0; triangle + 2 < position.count; triangle += 3) {
      const matches = sites.some(site => {
        let roof = false;
        for (let vertex = triangle; vertex < triangle + 3; vertex++) {
          const x = position.getX(vertex), y = position.getY(vertex), z = position.getZ(vertex);
          const atRoof = Math.abs(y - site.source.roof) < tolerance;
          roof ||= atRoof;
          if (!(atRoof || Math.abs(y - site.source.base) < tolerance)
            || !site.footprint.some(([px, pz]) => Math.hypot(x - px, z - pz) < tolerance)) return false;
        }
        return roof;
      });
      if (matches) removed++;
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
