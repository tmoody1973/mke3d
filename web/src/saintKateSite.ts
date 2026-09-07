import * as THREE from 'three';

/** OSM way 69020648, hotel at 139 East Kilbourn Avenue.
 * X east / Z south, meters from lon -87.905 / lat 43.035.
 * Center/dimensions are the mapped minimum rotated rectangle; bearing is THREE rotation.y.
 * Public entrance faces north (local -Z); hotel shares west/south walls with
 * Milwaukee Center way 90551293, which is a distinct source and stays intact.
 * The Upper Bar river terrace at 111 East Kilbourn belongs to the western
 * shared complex beside Associated Bank River Center, not this hotel rooftop.
 */
export const SAINT_KATE_SITE = {
  x: -471.60342111440661,
  z: -751.47416529040959,
  lat: 43.04179611993136,
  lon: -87.91079593930525,
  bearing: 0.32182564910310,
  width: 47.18136290934731,
  depth: 52.96599830359582,
  floor: 4.11,
  footprint: [
    [-500.388,-763.337],[-497.931,-755.939],[-496.507,-751.583],[-494.245,-744.948],
    [-487.508,-724.591],[-486.328,-724.403],[-484.725,-723.950],[-483.350,-723.397],
    [-481.877,-722.590],[-481.047,-722.015],[-479.794,-720.954],[-472.398,-723.342],
    [-459.346,-727.676],[-449.932,-730.784],[-445.579,-732.243],[-440.851,-733.824],
    [-441.323,-735.229],[-443.178,-740.768],[-450.274,-761.965],[-452.430,-768.423],
    [-453.203,-768.169],[-453.463,-768.921],[-453.903,-769.706],[-454.578,-770.878],
    [-455.424,-772.050],[-456.336,-772.813],[-457.304,-773.476],[-458.386,-774.007],
    [-459.501,-774.416],[-460.656,-774.670],[-462.048,-774.704],[-463.618,-774.549],
    [-465.530,-774.062],[-465.774,-774.781],[-466.303,-776.373],[-467.727,-780.619],
    [-491.796,-772.658],[-490.412,-768.522],[-489.843,-766.831],[-493.757,-765.515],
    [-498.810,-763.867],[-500.388,-763.337],
  ],
  source: {
    id: 69020648, kind: 'way', tile: { i: -1, j: 0 },
    name: 'Saint Kate', building: 'hotel', mappedLevels: 10,
    base: 2.61, roof: 37.11, innerRings: 0,
    fullTriangles: 121, lodTriangles: 28,
    extract: 'data/raw/osm/pbf_extract.json', extracted: '2026-09-06',
  },
  entrance: {
    facade: 'north', localX: 0.22, localZ: -26.45,
    // Outer mapped projection covers the public path below; it should not
    // become a solid wall across the entrance or a full-height hotel wing.
    frontage: [[-467.727,-780.619],[-491.796,-772.658]],
    coveredPath: {
      id: 704189646,
      points: [[-466.303,-776.373],[-478.606,-772.359],[-490.412,-768.522]],
    },
  },
} as const;

/** Distinct attached buildings, deliberately retained by hotel replacement. */
export const SAINT_KATE_NEIGHBORS = {
  riverCenter: { id: 69020632, address: '107; 109; 111 East Kilbourn Avenue' },
  sharedPodium: { id: 90551293, address: '131 East Kilbourn Avenue', base: 3.11, roof: 14.51 },
  theater: { id: 69020680, address: '108 East Wells Street' },
  riverTerraceContext: {
    sourceId: 90551293,
    // Actual mapped arc; the photograph corroborates its curved west-side form.
    footprintArc: [[-553.139,-706.126],[-552.895,-701.415],[-550.389,-697.910],[-546.597,-696.163],[-543.131,-696.307]],
    // Approximate feature center inferred from that arc, not a surveyed anchor.
    x: -548, z: -702,
  },
} as const;

/** Measured cached surface samples; x/z select public approach context,
 * not surveyed door thresholds. ROAD is the actual packed street mesh. */
export const SAINT_KATE_PUBLIC_DATUM = {
  northEntryRoad: { x: -480, z: -783, terrain: 4.066, road: 4.503 },
  northwestApproach: { x: -490, z: -782, terrain: 4.080, road: 4.408 },
  northeastApproach: { x: -463, z: -789, terrain: 4.122, road: 4.603 },
  entryProjection: { x: -479, z: -776, terrain: 4.003 },
  sharedComplexEntry: { x: -500, z: -765, terrain: 3.972, road: 4.335 },
} as const;

const SAINT_KATE_SOURCES = [SAINT_KATE_SITE] as const;
const tolerance = 0.16;

/** Remove only source-node triangles at each building's cached base/roof pair.
 * Requiring a roof vertex preserves ground surfaces, and exact nodes preserve
 * neighboring buildings even where their bounding boxes overlap these sites.
 * The LOD rings use a subset of the same OSM nodes, with coarser quantization.
 */
export function removeSaintKatePlaceholder(group: THREE.Group, tile: { i: number; j: number }): number {
  const sites = SAINT_KATE_SOURCES.filter(site => site.source.tile.i === tile.i && site.source.tile.j === tile.j);
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
