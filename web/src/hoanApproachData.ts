/** Extracted from data/raw/osm/pbf_extract.json (cached OSM ways).
 * Coordinates are exact source alignment, projected to scene x,z, rounded to 1e-8 m.
 * y is the estimated pipeline highway_profiles deck surface using shipped terrain.bin,
 * not surveyed elevation. Shared skipped-way endpoints are terrain + 14.4 m.
 * Final way is clipped at z=930 m, interpolated on its source segment; its height is
 * blended by hoanApproaches into the custom deck, not used as a harbor roadway.
 */
export const hoanSouthboundSource = [
  {
    "wayId": 123680910,
    "widthM": 11.52,
    "points": [
      [
        -350.97230828,
        15.95295625,
        -60.7272408
      ],
      [
        -198.35867138,
        18.62227242,
        -53.9932842
      ],
      [
        -157.10514509,
        19.34357427,
        -52.5337074
      ],
      [
        -123.38628652,
        19.9327794,
        -52.3125594
      ],
      [
        -33.56425956,
        21.50232792,
        -52.8433146
      ]
    ]
  },
  {
    "wayId": 99456188,
    "widthM": 11.52,
    "points": [
      [
        -33.56425956,
        21.50232792,
        -52.8433146
      ],
      [
        47.87687351,
        20.85252874,
        -54.3692358
      ],
      [
        109.70020541,
        20.35931438,
        -55.0216224
      ],
      [
        166.10443505,
        19.90934639,
        -55.4196888
      ],
      [
        177.30065836,
        19.81987342,
        -54.7562448
      ],
      [
        187.0566698,
        19.74130572,
        -53.407242
      ],
      [
        194.86798839,
        19.67805453,
        -52.0471818
      ],
      [
        205.7306033,
        19.58841599,
        -49.1722578
      ],
      [
        217.98460933,
        19.48475547,
        -44.8488144
      ],
      [
        226.78861632,
        19.40716047,
        -40.7133468
      ],
      [
        234.51856701,
        19.33735015,
        -36.6110514
      ],
      [
        248.92882245,
        19.20110727,
        -27.4444668
      ],
      [
        262.89155442,
        19.05579266,
        -15.7457376
      ],
      [
        273.97386267,
        18.9203675,
        -2.8859814
      ],
      [
        285.59319906,
        18.76140743,
        13.3020522
      ],
      [
        289.64532058,
        18.68809261,
        21.5508726
      ],
      [
        292.09449443,
        18.63299795,
        28.0083942
      ],
      [
        292.3711453,
        18.58707628,
        33.7582422
      ]
    ]
  },
  {
    "wayId": 99456186,
    "widthM": 11.52,
    "points": [
      [
        292.3711453,
        18.58707628,
        33.7582422
      ],
      [
        295.73977644,
        18.78473704,
        42.681564
      ],
      [
        336.65969433,
        23.12953551,
        248.3049744
      ],
      [
        377.88881025,
        27.81444293,
        470.5808292
      ]
    ]
  },
  {
    "wayId": 123681034,
    "widthM": 15.18,
    "points": [
      [
        377.88881025,
        27.81444293,
        470.5808292
      ],
      [
        380.2566162,
        27.74854028,
        483.6175038
      ],
      [
        387.0589728,
        27.5625166,
        520.3944162
      ],
      [
        457.67117744,
        25.495169,
        930
      ]
    ]
  }
] as const;
/** Source nodes on the retained northbound alignment with external ramp branches. */
export const hoanNorthboundJunctions = [
  [395.366635589449, 455.23315799930435, 32.82475221397705],
  [180.86457246106048, -116.43442200065967, 20.491968386390177],
  [-123.71175812970633, -119.6742402000224, 20.63454479567861],
] as const;

/** 62 m support candidates checked against all other cached source road/path widths + 1.5 m.
 * Rejected supports at road crossings; no pillars are placed on the merge transition. */
export const hoanApproachSupportStations = [231, 293, 355, 417, 479, 541, 603, 727, 851, 913, 975, 1037] as const;
