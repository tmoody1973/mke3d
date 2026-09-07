import * as THREE from 'three';

/** OSM way 592527373: the 2020 glass tower at 790 North Water Street.
 * X east / Z south in meters from lon -87.905 / lat 43.035.
 * Center and bearing use the minimum rotated rectangle of the mapped full
 * building footprint (including the eastern podium). Local +X points east.
 * The west edge is angled, with a rounded NW corner and a small SW step.
 * Floor is the shipped terrain at the source polygon centroid, not a surveyed
 * threshold. Public approaches slope toward Water Street; the model must
 * ground its entrance/foundation rather than assume the whole site is flat.
 */
export const BMO_SITE = {
  "x": -308.0535923695676,
  "z": -644.2359104863834,
  "lat": 43.04082628746799,
  "lon": -87.90878593505516,
  "bearing": 0.07465772959183248,
  "width": 86.8012639430626,
  "depth": 35.577122248316414,
  "footprint": [
    [
      -352.461,
      -656.08
    ],
    [
      -345.561,
      -636.475
    ],
    [
      -343.926,
      -636.597
    ],
    [
      -343.47,
      -630.592
    ],
    [
      -342.949,
      -623.792
    ],
    [
      -333.722,
      -624.478
    ],
    [
      -331.525,
      -624.644
    ],
    [
      -325.309,
      -625.119
    ],
    [
      -308.474,
      -626.38
    ],
    [
      -306.049,
      -626.568
    ],
    [
      -301.598,
      -626.955
    ],
    [
      -298.938,
      -627.098
    ],
    [
      -287.676,
      -627.983
    ],
    [
      -281.378,
      -628.436
    ],
    [
      -269.189,
      -629.321
    ],
    [
      -263.502,
      -629.73
    ],
    [
      -263.844,
      -634.451
    ],
    [
      -264.495,
      -643.331
    ],
    [
      -265.78,
      -660.89
    ],
    [
      -266.097,
      -665.169
    ],
    [
      -271.785,
      -664.76
    ],
    [
      -283.974,
      -663.875
    ],
    [
      -303.112,
      -662.427
    ],
    [
      -306.448,
      -662.172
    ],
    [
      -334.292,
      -660.071
    ],
    [
      -339.28,
      -659.696
    ],
    [
      -349.198,
      -658.944
    ],
    [
      -350.712,
      -658.49
    ],
    [
      -351.998,
      -657.561
    ],
    [
      -352.461,
      -656.08
    ]
  ],
  "localFootprint": [
    [
      -43.401,
      -15.123
    ],
    [
      -37.982,
      4.942
    ],
    [
      -36.342,
      4.942
    ],
    [
      -36.336,
      10.964
    ],
    [
      -36.324,
      17.784
    ],
    [
      -27.071,
      17.789
    ],
    [
      -24.868,
      17.787
    ],
    [
      -18.633,
      17.777
    ],
    [
      -1.751,
      17.775
    ],
    [
      0.681,
      17.769
    ],
    [
      5.148,
      17.715
    ],
    [
      7.812,
      17.77
    ],
    [
      19.108,
      17.728
    ],
    [
      25.422,
      17.745
    ],
    [
      37.643,
      17.772
    ],
    [
      43.346,
      17.789
    ],
    [
      43.357,
      13.055
    ],
    [
      43.37,
      4.152
    ],
    [
      43.398,
      -13.454
    ],
    [
      43.401,
      -17.745
    ],
    [
      37.698,
      -17.762
    ],
    [
      25.477,
      -17.789
    ],
    [
      6.285,
      -17.772
    ],
    [
      2.939,
      -17.767
    ],
    [
      -24.984,
      -17.749
    ],
    [
      -29.986,
      -17.746
    ],
    [
      -39.933,
      -17.736
    ],
    [
      -41.476,
      -17.396
    ],
    [
      -42.828,
      -16.566
    ],
    [
      -43.401,
      -15.123
    ]
  ],
  "floor": 7.0071553,
  "height": 99.9744,
  "source": {
    "id": 592527373,
    "kind": "way",
    "tile": {
      "i": -1,
      "j": 0
    },
    "name": "BMO Tower",
    "address": "790 North Water Street",
    "mappedLevels": 25,
    "mappedHeight": "328 ft",
    "base": 5.51,
    "roof": 106.97,
    "fullTriangles": 85,
    "lodTriangles": 19,
    "extract": "data/raw/osm/pbf_extract.json",
    "extracted": "2026-09-06",
    "url": "https://www.openstreetmap.org/way/592527373"
  }
} as const;

/** Distinct older 1968 bank building immediately south; retained verbatim. */
export const BMO_NEIGHBOR = {
  id: 69020761, name: 'BMO Harris Building', address: '770–780 North Water Street',
  base: 4.61, roof: 90.61, levels: 21,
} as const;

/** Measured terrain samples from the shipped grid, not survey elevations. */
export const BMO_PUBLIC_DATUM = {
  waterNorth: { x: -350, z: -650, terrain: 5.2442383 },
  waterEntrance: { x: -352, z: -633, terrain: 5.3342773 },
  northMiddle: { x: -302, z: -665, terrain: 7.1084961 },
  eastSide: { x: -266, z: -640, terrain: 9.0034180 },
} as const;

const BMO_SOURCES = [BMO_SITE] as const;
const tolerance = 0.16;

/** Remove only source-node triangles at each building's cached base/roof pair.
 * Requiring a roof vertex preserves ground surfaces, and exact nodes preserve
 * neighboring buildings even where their bounding boxes overlap these sites.
 * The LOD rings use a subset of the same OSM nodes, with coarser quantization.
 */
export function removeBmoPlaceholder(group: THREE.Group, tile: { i: number; j: number }): number {
  const sites = BMO_SOURCES.filter(site => site.source.tile.i === tile.i && site.source.tile.j === tile.j);
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
      if (!(attribute instanceof THREE.BufferAttribute)) continue;
      const array = attribute.array.slice(0, keep.length * attribute.itemSize);
      keep.forEach((vertex, index) => {
        for (let component = 0; component < attribute.itemSize; component++)
          array[index * attribute.itemSize + component] = attribute.array[vertex * attribute.itemSize + component];
      });
      geometry.setAttribute(name, new THREE.BufferAttribute(array, attribute.itemSize, attribute.normalized));
    }
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    object.geometry = geometry;
    original.dispose();
  });
  return removed;
}
