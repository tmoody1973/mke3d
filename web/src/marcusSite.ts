import * as THREE from 'three';

/** Cached OSM campus geometry (Geofabrik extract 2026-09-06).
 * X east / Z south, meters from lon -87.905 / lat 43.035.
 * Anchor/bearing/width/depth describe each minimum rotated rectangle.
 * Floor is the cached extrusion base + 1.5 m, a terrain estimate, not a survey.
 */

export const MARCUS_SITE = {
  x: -539.11315096504723,
  z: -872.38969466199865,
  lat: 43.04288964579975,
  lon: -87.91162562433128,
  bearing: 0.22480985811118,
  width: 120.71192624392222,
  depth: 59.18630007845877,
  floor: 4.01,
  footprint: [
    [-602.546,-879.030],[-593.294,-855.036],[-587.623,-840.340],[-584.881,-833.264],
    [-571.227,-836.592],[-570.788,-834.789],[-560.251,-837.311],[-560.527,-838.461],
    [-561.390,-842.010],[-560.535,-842.242],[-559.697,-842.474],[-553.359,-838.892],
    [-507.581,-849.595],[-504.131,-855.633],[-503.553,-855.754],[-502.911,-855.887],
    [-501.942,-851.851],[-501.641,-850.602],[-490.567,-853.233],[-491.560,-857.358],
    [-490.445,-859.072],[-489.273,-860.874],[-486.482,-861.526],[-481.381,-862.709],
    [-482.560,-867.707],[-482.886,-867.630],[-483.089,-868.515],[-482.772,-868.581],
    [-482.593,-870.560],[-482.528,-873.756],[-482.569,-875.658],[-481.373,-875.724],
    [-478.045,-875.890],[-481.226,-889.999],[-484.676,-888.761],[-485.514,-888.462],
    [-486.425,-890.530],[-487.638,-892.664],[-488.932,-894.687],[-489.257,-894.621],
    [-489.509,-895.683],[-489.184,-895.749],[-490.412,-900.957],[-495.840,-899.696],
    [-498.305,-899.121],[-500.136,-899.906],[-501.804,-900.747],[-502.601,-904.119],
    [-513.700,-901.543],[-513.529,-900.824],[-513.228,-899.564],[-512.618,-896.965],
    [-513.228,-896.821],[-513.692,-896.645],[-514.855,-897.341],[-516.043,-898.027],
    [-519.990,-900.360],[-525.417,-899.144],[-537.524,-896.269],[-542.358,-895.119],
    [-543.082,-894.953],[-556.866,-891.680],[-558.094,-891.392],[-558.395,-892.653],
    [-559.502,-897.208],[-559.705,-898.038],[-568.640,-895.970],[-568.705,-895.660],
    [-569.055,-893.736],[-569.404,-891.846],[-569.746,-890.010],[-570.072,-888.241],
    [-582.025,-890.729],[-582.545,-888.197],[-583.107,-885.466],[-585.133,-885.012],
    [-587.021,-884.592],[-588.648,-891.061],[-601.008,-888.175],[-600.935,-887.843],
    [-601.935,-887.600],[-600.902,-883.254],[-602.098,-882.967],[-601.211,-879.340],
    [-602.546,-879.030],
  ],
  source: {
    id: 68762980, kind: 'way', tile: { i: -1, j: 0 },
    name: 'Marcus Center for the Performing Arts', base: 2.51, roof: 17.21,
    building: 'commercial', mappedLevels: 4, innerRings: 0,
    fullTriangles: 250, lodTriangles: 97,
    extract: 'data/raw/osm/pbf_extract.json', extracted: '2026-09-06',
  },
} as const;

export const PECK_SITE = {
  x: -568.24376278648197,
  z: -808.58204174705202,
  lat: 43.04231258742332,
  lon: -87.91198363542807,
  bearing: 0.33651818361715,
  width: 28.90834212041545,
  depth: 33.58114991484206,
  floor: 1.91,
  footprint: [
    [-585.344,-813.692],[-577.590,-794.286],[-577.256,-794.397],[-576.215,-791.411],
    [-572.350,-789.476],[-552.065,-796.453],[-551.292,-798.389],[-549.624,-799.129],
    [-559.054,-826.087],[-563.139,-828.044],[-573.302,-824.550],[-582.838,-821.178],
    [-583.245,-821.123],[-582.692,-819.552],[-584.441,-818.955],[-585.027,-817.263],
    [-583.945,-814.178],[-585.344,-813.692],
  ],
  source: {
    id: 599981655, kind: 'way', tile: { i: -1, j: 0 },
    name: 'Peck Pavillion', base: 0.41, roof: 8.51,
    building: 'retail', mappedLevels: 2, innerRings: 0,
    fullTriangles: 49, lodTriangles: 22,
    extract: 'data/raw/osm/pbf_extract.json', extracted: '2026-09-06',
  },
} as const;

export const MARCUS_GARAGE_SITE = {
  x: -543.69375194236500,
  z: -996.25546182602727,
  lat: 43.04400985278479,
  lon: -87.91168191926906,
  bearing: 0.07486863667737,
  width: 66.39892442861264,
  depth: 99.44298192631118,
  floor: 3.61,
  footprint: [
    [-580.519,-1043.354],[-579.933,-1035.625],[-576.418,-988.731],[-575.393,-975.030],
    [-573.522,-950.118],[-573.082,-944.258],[-568.550,-944.589],[-563.245,-944.976],
    [-557.281,-945.419],[-522.797,-947.973],[-518.102,-948.327],[-516.833,-948.415],
    [-515.661,-948.504],[-514.497,-948.592],[-506.873,-949.156],[-506.963,-950.417],
    [-507.052,-951.545],[-513.342,-1035.393],[-514.172,-1046.494],[-514.302,-1048.264],
    [-517.313,-1048.031],[-518.135,-1047.976],[-522.520,-1047.655],[-525.222,-1047.445],
    [-532.732,-1046.893],[-539.005,-1046.428],[-544.555,-1046.019],[-546.971,-1045.842],
    [-573.074,-1043.907],[-576.247,-1043.675],[-580.519,-1043.354],
  ],
  source: {
    id: 66719111, kind: 'way', tile: { i: -1, j: 0 },
    name: 'Marcus Center Parking Structure', base: 2.11, roof: 15.61,
    building: 'parking', mappedLevels: 2, innerRings: 0,
    fullTriangles: 88, lodTriangles: 10,
    extract: 'data/raw/osm/pbf_extract.json', extracted: '2026-09-06',
  },
} as const;

export const MARCUS_CONNECTOR_SITE = {
  x: -515.26067292370851,
  z: -922.60022351222335,
  lat: 43.04334373562964,
  lon: -87.91133248075170,
  bearing: 0.01558544727760,
  width: 2.33890472150955,
  depth: 51.95391035102671,
  floor: 4.01,
  footprint: [
    [-516.833,-948.415],[-516.686,-939.094],[-516.572,-931.796],[-516.255,-911.351],
    [-516.231,-909.836],[-516.043,-898.027],[-514.855,-897.341],[-513.692,-896.645],
    [-513.903,-910.367],[-513.928,-911.904],[-514.245,-932.360],[-514.351,-939.271],
    [-514.497,-948.592],[-515.661,-948.504],[-516.833,-948.415],
  ],
  source: {
    id: 68798760, kind: 'way', tile: { i: -1, j: 0 },
    name: 'Marcus campus connector', base: 2.51, roof: 10.61,
    building: 'bridge', mappedLevels: 2, innerRings: 0,
    fullTriangles: 40, lodTriangles: 0,
    extract: 'data/raw/osm/pbf_extract.json', extracted: '2026-09-06',
  },
} as const;

export const MARCUS_CANOPY_SITE = {
  x: -580.21746506116119,
  z: -837.32668482546546,
  lat: 43.04257254585006,
  lon: -87.91213079053453,
  bearing: 0.23110387099273,
  width: 17.19583328316514,
  depth: 9.25933952912328,
  floor: 2.11,
  footprint: [
    [-589.616,-839.732],[-586.671,-831.052],[-570.788,-834.789],[-571.227,-836.592],
    [-584.881,-833.264],[-587.623,-840.340],[-589.616,-839.732],
  ],
  source: {
    id: 599981653, kind: 'way', tile: { i: -1, j: 0 },
    name: 'Marcus southwest entry canopy', base: 0.61, roof: 5.11,
    building: 'roof', mappedLevels: 0, innerRings: 0,
    fullTriangles: 16, lodTriangles: 0,
    extract: 'data/raw/osm/pbf_extract.json', extracted: '2026-09-06',
  },
} as const;

export const MARCUS_CENTER_SITE = MARCUS_SITE;
export const MARCUS_SITES = [MARCUS_SITE, PECK_SITE, MARCUS_GARAGE_SITE, MARCUS_CONNECTOR_SITE, MARCUS_CANOPY_SITE] as const;

/** OSM footway way 68799107, a 1.8 m-wide covered bridge between garage
 * and main building. The cached street pipeline placed this ribbon at ~16.5 m.
 * Exact packed 3D vertices (full and LOD) distinguish it from State Street below.
 */
export const MARCUS_SKYWALK_SOURCE = {
  id: 68799107, kind: 'way', tile: { i: -1, j: 0 },
  centerline: [[-515.661,-948.504],[-514.855,-897.341]], width: 1.8,
  fullTriangles: 10, lodTriangles: 10,
  nodes: [
    [-516.564,16.503,-948.446],[-516.364,16.503,-938.046],[-516.164,16.503,-924.046],
    [-516.164,16.503,-922.946],[-515.964,16.403,-910.046],[-515.764,16.403,-897.346],
    [-514.764,16.503,-948.546],[-514.564,16.503,-938.046],[-514.364,16.503,-924.046],
    [-514.364,16.503,-922.946],[-514.164,16.403,-910.046],[-513.964,16.403,-897.346],
    [-516.531,16.433,-948.441],[-516.431,16.433,-938.041],[-516.131,16.433,-924.041],
    [-516.131,16.433,-922.941],[-515.931,16.433,-910.041],[-515.731,16.433,-897.341],
    [-514.731,16.433,-948.541],[-514.631,16.433,-938.041],[-514.331,16.433,-924.041],
    [-514.331,16.433,-922.941],[-514.131,16.433,-910.041],[-513.931,16.433,-897.341],
  ],
} as const;

/** Actual cached terrain and street samples, meters above the project datum.
 * Position selection is illustrative public approach context, not surveyed doors.
 * Keep plaza/landscape surfaces graded: Peck is materially lower than Water Street.
 */
export const MARCUS_PUBLIC_DATUM = {
  waterEntry: { x: -474, z: -880, terrain: 4.312, road: 4.703 },
  garageSoutheast: { x: -500, z: -948, terrain: 4.182, road: 4.603 },
  garageSouthwest: { x: -560, z: -940, terrain: 3.563, road: 3.949 },
  peck: { x: -568.244, z: -808.582, terrain: 1.911 },
  lawnWest: { x: -543, z: -813, terrain: 2.979 },
  lawnEast: { x: -498, z: -824, terrain: 4.227 },
  kilbourn: { x: -500, z: -793, terrain: 4.128, road: 4.523 },
  stateUnderSkywalk: { x: -515.5, z: -922, terrain: 4.005, road: 4.424 },
} as const;

export const MARCUS_PUBLIC_PATHS = {
  kilbournSidewalk: {
    id: 704189626,
    points: [[-574.075,-776.672],[-571.268,-777.888],[-532.813,-794.585],[-525.344,-797.725],[-463.138,-818.756],[-461.177,-820.647],[-460.811,-821.498]],
  },
  southCampusWalk: {
    id: 704189618,
    points: [[-467.727,-857.877],[-586.239,-829.792],[-592.700,-828.266]],
  },
} as const;

const tolerance = 0.16;

/** Remove only source-node triangles at each building's cached base/roof pair.
 * Requiring a roof vertex preserves ground surfaces, and exact nodes preserve
 * neighboring buildings even where their bounding boxes overlap these sites.
 * Only the exact elevated skywalk vertices are removed from ROAD; the
 * street surface below remains intact. The LOD rings use a subset of the same OSM nodes, with coarser quantization.
 */
export function removeMarcusPlaceholders(group: THREE.Group, tile: { i: number; j: number }): number {
  const sites = MARCUS_SITES.filter(site => site.source.tile.i === tile.i && site.source.tile.j === tile.j);
  if (!sites.length) return 0;
  let removed = 0;
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh) || !['BLDG', 'ROAD'].includes(object.name)) return;
    const original = object.geometry;
    const position = original.getAttribute('position');
    if (!position || original.index) return;
    const keep: number[] = [];
    for (let triangle = 0; triangle + 2 < position.count; triangle += 3) {
      const matches = object.name === 'ROAD'
        ? [triangle, triangle + 1, triangle + 2].every(vertex => MARCUS_SKYWALK_SOURCE.nodes.some(([x, y, z]) =>
          Math.hypot(position.getX(vertex) - x, position.getY(vertex) - y, position.getZ(vertex) - z) < tolerance))
        : sites.some(site => {
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
