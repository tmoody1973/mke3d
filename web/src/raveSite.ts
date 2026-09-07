import * as THREE from 'three';

/** OSM way 567330938, The Rave/Eagles Club at 2401 West Wisconsin Avenue.
 * X east / Z south, meters from lon -87.905 / lat 43.035.
 * Center and dimensions are the mapped minimum rotated rectangle; bearing
 * is THREE rotation.y. Wisconsin Avenue/front faces north (local -Z),
 * North 24th Street is east (+X), and Michigan Street is south (+Z).
 * The source floor is centroid terrain, not an entrance datum: the north
 * entrance ground is approximately 1.8 m higher and the rear is lower.
 */
export const RAVE_SITE = {
  x: -3117.09882046625444,
  z: -325.02547015687645,
  lat: 43.03793943847700,
  lon: -87.94330870337870,
  bearing: -0.00687716537447,
  width: 45.11538152945013,
  depth: 71.74625924799875,
  floor: 36.8,
  footprint: [
    [-3139.800,-302.575],[-3139.100,-302.564],[-3135.764,-302.542],[-3135.846,-289.284],
    [-3135.561,-289.284],[-3134.715,-289.273],[-3133.453,-289.273],[-3094.853,-289.018],
    [-3094.804,-297.134],[-3096.390,-297.146],[-3096.366,-300.629],[-3096.350,-303.183],
    [-3096.333,-306.323],[-3096.309,-309.707],[-3096.276,-314.981],[-3096.260,-317.569],
    [-3096.244,-320.145],[-3096.244,-320.587],[-3096.211,-325.574],[-3096.203,-326.868],
    [-3096.179,-330.063],[-3096.163,-332.905],[-3096.154,-334.177],[-3096.146,-335.061],
    [-3096.122,-338.412],[-3096.097,-342.315],[-3096.081,-345.643],[-3096.049,-350.022],
    [-3094.372,-350.011],[-3094.364,-350.652],[-3094.324,-357.386],[-3094.316,-358.514],
    [-3096.504,-358.525],[-3103.242,-358.569],[-3103.233,-359.432],[-3103.225,-360.250],
    [-3103.941,-360.250],[-3104.763,-360.261],[-3106.293,-360.272],[-3106.285,-360.825],
    [-3109.971,-360.847],[-3115.699,-360.880],[-3121.761,-360.925],[-3124.812,-360.936],
    [-3124.812,-360.405],[-3126.610,-360.416],[-3128.165,-360.427],[-3128.173,-358.757],
    [-3136.627,-358.813],[-3136.676,-350.321],[-3135.276,-350.309],[-3135.382,-334.951],
    [-3138.035,-334.973],[-3139.353,-334.973],[-3139.589,-334.973],[-3139.613,-331.423],
    [-3139.792,-303.293],[-3139.800,-302.575],
  ],
  source: {
    id: 567330938, kind: 'way', tile: { i: -2, j: 0 },
    name: 'The Rave/Eagles Club', building: 'retail', mappedLevels: 5,
    base: 35.30, roof: 53.30, innerRings: 0,
    fullTriangles: 169, lodTriangles: 34,
    extract: 'data/raw/osm/pbf_extract.json', extracted: '2026-09-06',
  },
  entrance: {
    facade: 'north', street: 'West Wisconsin Avenue',
    localFacadeZ: -33.65, localPavilionZ: -35.87,
    localPavilionMinX: -7.96, localPavilionMaxX: 10.57,
    // Interpreted threshold suited to the measured frontage; not a survey.
    suggestedFloor: 38.8,
  },
} as const;

/** Actual terrain/ROAD samples from shipped data; public approach sample
 * positions are illustrative, not surveyed door locations. The forecourt
 * rises north to Wisconsin Avenue while the building site falls south.
 */
export const RAVE_PUBLIC_DATUM = {
  frontCenter: { x: -3117, z: -364, terrain: 38.632 },
  frontWest: { x: -3135, z: -364, terrain: 38.209 },
  frontEast: { x: -3098, z: -364, terrain: 38.791 },
  forecourt: { x: -3117, z: -380, terrain: 39.014 },
  wisconsinSidewalk: { x: -3117, z: -395.2, terrain: 39.358, road: 39.738 },
  wisconsinRoad: { x: -3117, z: -403.6, terrain: 39.421, road: 40.015 },
  eastSidewalk: { x: -3092.5, z: -345, terrain: 38.065, road: 38.542 },
  eastRoad: { x: -3085, z: -345, terrain: 38.269, road: 38.693 },
  rear: { x: -3117, z: -285, terrain: 35.260 },
  michiganRoad: { x: -3117, z: -276.7, terrain: 34.955, road: 35.371 },
} as const;

/** Nearby mapped public sidewalk section; the front facade is set back
 * approximately 34 m from this Wisconsin Avenue sidewalk centerline.
 */
export const RAVE_FRONT_SIDEWALK = {
  sourceId: 868425989,
  points: [[-3185.220,-395.379],[-3138.222,-395.744],[-3092.135,-394.395]],
} as const;

const RAVE_SOURCES = [RAVE_SITE] as const;
const tolerance = 0.16;

/** Remove only source-node triangles at each building's cached base/roof pair.
 * Requiring a roof vertex preserves ground surfaces, and exact nodes preserve
 * neighboring buildings even where their bounding boxes overlap these sites.
 * The LOD rings use a subset of the same OSM nodes, with coarser quantization.
 */
export function removeRavePlaceholder(group: THREE.Group, tile: { i: number; j: number }): number {
  const sites = RAVE_SOURCES.filter(site => site.source.tile.i === tile.i && site.source.tile.j === tile.j);
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
