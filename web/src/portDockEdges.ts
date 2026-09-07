/** Dock edges extracted from the EXISTING rendered web/public/data/water.bin.
 * WATR sections were decoded with each section's int16 scale/origin, then
 * triangles were unioned and boundary chains simplified by at most 0.25m.
 * Coordinates follow the rendered shoreline to its 0.1m packing precision;
 * this is mapped geometry, not surveyed berth dimensions or live operations.
 * Pipeline provenance: build_tiles.py combines OSM coastline/lake polygons,
 * OSM water polygons and data/raw/city_water.geojson before packing the water.
 * These descriptive IDs are extraction IDs, not OSM feature IDs.
 * X east / Z south; landSide +1 = normal (-dz, dx), -1 = (dz, -dx).
 * Land side was checked against unioned rendered water using 3m probes.
 * middle-pier-south's tiny middle segment preserves a packed tile seam.
 */
export type PortDockEdge = {
  readonly id: string;
  readonly points: readonly (readonly [number, number])[];
  readonly landSide: -1 | 1;
};

export const PORT_DOCK_EDGES = [
  {
    "id": "rendered-water:north-slip-head",
    "points": [
      [
        625.49,
        1641.49
      ],
      [
        652.69,
        1725.69
      ]
    ],
    "landSide": 1
  },
  {
    "id": "rendered-water:north-pier-north",
    "points": [
      [
        652.69,
        1725.69
      ],
      [
        835.09,
        1507.39
      ]
    ],
    "landSide": 1
  },
  {
    "id": "rendered-water:north-pier-south",
    "points": [
      [
        876.89,
        1601.49
      ],
      [
        686.39,
        1830.29
      ]
    ],
    "landSide": 1
  },
  {
    "id": "rendered-water:middle-slip-head",
    "points": [
      [
        686.39,
        1830.29
      ],
      [
        719.69,
        1931.19
      ]
    ],
    "landSide": 1
  },
  {
    "id": "rendered-water:middle-pier-north",
    "points": [
      [
        719.69,
        1931.19
      ],
      [
        899.69,
        1712.39
      ]
    ],
    "landSide": 1
  },
  {
    "id": "rendered-water:middle-pier-end",
    "points": [
      [
        915.19,
        1711.89
      ],
      [
        973.19,
        1868.39
      ]
    ],
    "landSide": 1
  },
  {
    "id": "rendered-water:middle-pier-south",
    "points": [
      [
        971.29,
        1875.29
      ],
      [
        866.69,
        1999.99
      ],
      [
        866.67,
        2000.04
      ],
      [
        775.77,
        2108.24
      ]
    ],
    "landSide": 1
  },
  {
    "id": "rendered-water:east-bulk-shore",
    "points": [
      [
        775.77,
        2108.24
      ],
      [
        906.67,
        2511.34
      ]
    ],
    "landSide": 1
  },
  {
    "id": "rendered-water:west-bulk-south",
    "points": [
      [
        591.57,
        2764.54
      ],
      [
        483.77,
        2429.94
      ]
    ],
    "landSide": 1
  },
  {
    "id": "rendered-water:west-bulk-bend",
    "points": [
      [
        483.77,
        2429.94
      ],
      [
        466.07,
        2376.94
      ]
    ],
    "landSide": 1
  },
  {
    "id": "rendered-water:west-bulk-north",
    "points": [
      [
        461.67,
        2363.84
      ],
      [
        330.77,
        2118.84
      ]
    ],
    "landSide": 1
  },
  {
    "id": "rendered-water:west-bulk-entry",
    "points": [
      [
        330.77,
        2118.84
      ],
      [
        282.17,
        2026.14
      ]
    ],
    "landSide": 1
  }
] as const satisfies readonly PortDockEdge[];

/** Illustrative static placements, not mapped operating positions. Each crane
 * center is on dry land, >10m from cached OSM building footprints and >6m from
 * mapped rail centerlines. Bearings point local +X boom toward adjoining water.
 * Clearances do not certify the footprint of an arbitrary crane model. */
export const PORT_CRANE_PLACEMENTS = [
  { x: 816.97, z: 1648.45, bearing: -.6943082241869188 },
  { x: 840.05, z: 1810.07, bearing: 2.453181118718006 },
  { x: 867.05, z: 1777.25, bearing: 2.453181118718006 },
  { x: 457.17, z: 2287.51, bearing: -2.6508941475132928 },
] as const;

/** The full 180m x 22m rectangular envelope lies inside decoded rendered water,
 * at a 20m perpendicular offset from north-pier-south; local +X is vessel bow. */
export const PORT_FREIGHTER_PLACEMENT = {
  x: 797.0099304227472, z: 1728.6870793074008, bearing: -2.2651045509818153,
} as const;

/** Near the mapped Lake Express terminal. The full 58m x 18m envelope plus
 * a 3m clearance buffer lies inside the existing rendered water. Local +X bow
 * points northeast, approximately parallel to the shoreline. Static illustration. */
export const PORT_FERRY_PLACEMENT = { x: 1546, z: 3492, bearing: 1.10 } as const;
