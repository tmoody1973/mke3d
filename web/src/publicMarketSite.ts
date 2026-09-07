import * as THREE from 'three';

/** OSM-aligned market anchor. Floor/height are visual estimates, not surveyed.
 * See data/public_market_site.json for footprint and source provenance. */
export const PUBLIC_MARKET_SITE = { x: -251.6, z: -27.4, floor: 5.6, bearing: 0.06913312901304965 };

/** Parent footprint signature; source canopy signatures follow below. */
export const PUBLIC_MARKET_SOURCE = {
  id: 53160687,
  base: 4.11,
  roof: 12.21,
  bounds: [-290.75, -45.96, -212.42, -9.94],
  footprint: [[-251.264,-43.058],[-251.256,-42.051],[-252.859,-42.04],[-254.421,-42.029],[-254.429,-43.124],[-275.04,-43.544],[-289.084,-43.832],[-289.133,-44.484],[-290.589,-44.384],[-290.052,-36.799],[-289.881,-34.322],[-290.028,-34.311],[-290.174,-34.3],[-290.109,-33.316],[-290.02,-32.133],[-289.93,-30.817],[-289.653,-26.847],[-289.466,-24.227],[-289.426,-23.63],[-289.222,-20.711],[-289.182,-20.113],[-289.003,-17.57],[-288.946,-16.774],[-288.872,-15.768],[-288.799,-14.728],[-288.767,-14.231],[-288.132,-14.275],[-288.026,-12.782],[-288.36,-12.76],[-288.173,-10.106],[-285.333,-10.305],[-250.792,-12.694],[-215.161,-15.16],[-213.119,-15.303],[-213.371,-18.908],[-213.81,-18.886],[-213.884,-19.97],[-212.582,-20.058],[-212.639,-20.898],[-212.72,-22.026],[-212.761,-22.701],[-212.793,-23.077],[-212.834,-23.751],[-213.029,-26.505],[-213.07,-27.069],[-213.265,-29.866],[-213.339,-30.883],[-213.924,-39.176],[-213.989,-40.16],[-216.227,-40.006],[-220.198,-39.718],[-224.047,-39.453],[-230.125,-39.033],[-230.377,-42.626],[-233.436,-42.682],[-239.523,-42.803],[-244.071,-42.903],[-247.912,-42.991],[-248.53,-43.002],[-248.514,-45.789],[-250.735,-45.8],[-250.76,-43.046],[-251.264,-43.058]],
} as const;

/** Attached canopy ways share facade nodes; standalone sheds and palapas remain. */
export const PUBLIC_MARKET_SOURCES = [PUBLIC_MARKET_SOURCE,
  {"id":584794009,"base":3.11,"roof":8.51,"footprint":[[-213.07,-27.069],[-213.265,-29.866],[-211.06,-30.01],[-210.865,-27.223],[-213.07,-27.069]]},
  {"id":584794011,"base":3.01,"roof":8.41,"footprint":[[-212.834,-23.751],[-213.029,-26.505],[-210.824,-26.659],[-210.637,-23.906],[-212.256,-23.796],[-212.834,-23.751]]},
  {"id":584794014,"base":2.91,"roof":8.31,"footprint":[[-212.639,-20.898],[-212.72,-22.026],[-212.761,-22.701],[-212.793,-23.077],[-210.588,-23.232],[-210.434,-21.053],[-212.639,-20.898]]},
  {"id":584794023,"base":3.11,"roof":17.61,"footprint":[[-291.614,-24.072],[-291.802,-26.693],[-291.24,-26.737],[-289.653,-26.847],[-289.466,-24.227],[-291.037,-24.116],[-291.614,-24.072]]},
  {"id":584794025,"base":2.71,"roof":17.21,"footprint":[[-291.354,-16.608],[-291.216,-14.574],[-290.304,-14.629],[-288.799,-14.728],[-288.872,-15.768],[-288.946,-16.774],[-290.459,-16.675],[-291.354,-16.608]]},
  {"id":584794027,"base":3.01,"roof":17.51,"footprint":[[-289.426,-23.63],[-289.222,-20.711],[-290.768,-20.6],[-291.37,-20.556],[-291.574,-23.464],[-290.996,-23.508],[-289.426,-23.63]]},
  {"id":584794030,"base":2.81,"roof":17.31,"footprint":[[-291.33,-19.97],[-290.719,-20.014],[-289.182,-20.113],[-289.003,-17.57],[-290.524,-17.471],[-291.151,-17.426],[-291.33,-19.97]]},
  {"id":584794032,"base":3.41,"roof":17.91,"footprint":[[-292.501,-33.161],[-290.109,-33.316],[-290.02,-32.133],[-289.93,-30.817],[-292.322,-30.651],[-292.501,-33.161]]},
  {"id":584831296,"base":5.71,"roof":10.21,"footprint":[[-251.264,-43.058],[-251.297,-47.945],[-254.462,-47.934],[-254.437,-44.517],[-254.429,-43.124],[-254.421,-42.029],[-252.859,-42.04],[-251.256,-42.051],[-251.264,-43.058]]},
  {"id":584831321,"base":4.21,"roof":9.61,"footprint":[[-213.989,-40.16],[-214.299,-44.583],[-216.439,-44.44],[-223.607,-43.942],[-230.434,-43.456],[-230.377,-42.626],[-230.125,-39.033],[-224.047,-39.453],[-220.198,-39.718],[-216.227,-40.006],[-213.989,-40.16]]},
] as const;

/** Remove only triangles whose three vertices match the source footprint and
 * original base/roof elevations. The .16m tolerance covers both 10cm-quantized
 * tile origins. LOD simplification retains a subset of these same vertices. */
export function removePublicMarketPlaceholder(group: THREE.Group, tile: { i: number; j: number }): number {
  if (tile.i !== -1 || tile.j !== 0) return 0;
  let removed = 0;
  const tolerance = .16;
  for (const child of group.children) {
    if (!(child instanceof THREE.Mesh) || child.name !== 'BLDG') continue;
    const original = child.geometry;
    const position = original.getAttribute('position');
    const color = original.getAttribute('color');
    const keep: number[] = [];
    for (let index = 0; index < position.count; index += 3) {
      const matches = PUBLIC_MARKET_SOURCES.some(source => {
        let roof = false;
        for (let vertex = index; vertex < index + 3; vertex++) {
          const x = position.getX(vertex), y = position.getY(vertex), z = position.getZ(vertex);
          const atRoof = Math.abs(y - source.roof) < tolerance;
          roof ||= atRoof;
          if (!(atRoof || Math.abs(y - source.base) < tolerance)
            || !source.footprint.some(([px, pz]) => Math.hypot(x - px, z - pz) < tolerance)) return false;
        }
        return roof;
      });
      if (matches) removed++;
      else keep.push(index, index + 1, index + 2);
    }
    if (keep.length === position.count) continue;
    const positions = new Float32Array(keep.length * 3), colors = new Uint8Array(keep.length * 3);
    keep.forEach((vertex, index) => {
      positions.set([position.getX(vertex), position.getY(vertex), position.getZ(vertex)], index * 3);
      colors.set([color.getX(vertex) * 255, color.getY(vertex) * 255, color.getZ(vertex) * 255], index * 3);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, true));
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    child.geometry = geometry; original.dispose();
  }
  return removed;
}
