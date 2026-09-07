# Highway profile audit

This audit covers the cached `data/raw/osm/pbf_extract.json` source extracted
from the Geofabrik Wisconsin PBF on 2026-09-06 and the generated 40 m terrain
surface in `web/public/data/terrain.bin`. Heights are scene-model estimates,
not surveyed bridge elevations.

## Failure diagnosis

The previous solver profiled only motorway and trunk classes. The cache has
142,645 supported road/path ways and 2,331 bridge ways, but only 354 of those
bridges were motorway/trunk bridges. The missing set included 1,097 footways,
201 secondary roads, 162 tertiary roads, 155 primary roads, and many local,
service, path, cycle, and step bridges.

It also based each freeway deck on the highest terrain sample anywhere under
that source way. This is unstable beside carved water and coarse DEM changes.
For example, I-794 ways 123681034 and 1101016694 contain interior terrain
samples 6.792 m and 6.624 m above their higher endpoint terrain. Adding that
error to every deck point explains the abrupt lifted ribbons at source-way
boundaries.

## Implemented model

- Exact repeated source coordinates are the only topological junctions. No
  coordinate rounding or geometric proximity joins roads at overpasses.
- All bridge classes receive a structural profile. Existing freeway profiles
  remain available for markings and structure detail.
- Bridge components use connected, off-deck approach terrain as their datum and
  interpolate through adverse terrain or carved water. A connected layer-1
  local or movable bridge meets bank grade; OSM `layer` orders crossings and is
  not treated as a literal seven-meter multiplier there.
- Freeway bridge sequences retain conservative layer clearance. Isolated bridge
  ends retain the older clearance fallback because the cache has no approach
  evidence.
- Geometric road crossings add 5.4 m vehicle clearance or 2.7 m non-vehicle
  clearance, with class grade caps of 8% freeway, 12% local road, 20% path, and
  65% steps.
- Explicit `ele`, `bridge:height`, and `height` tags take precedence;
  `maxheight` is a vehicle restriction and is not used as deck elevation.
- Skipped Hoan proxy interiors are excluded from crossing constraints. Their
  source endpoints remain exactly terrain + 14.4 m for contact with the
  separate interpretive main-span model.

## Cached-network results

Every cached bridge way has a profile (2,331/2,331). Across 531 shared bridge
nodes, the largest deck seam is 1.11e-16 m. Across 3,376 bridge-to-surface
contacts, the largest seam is 8.88e-16 m. Hoan endpoint contract error is 0 m.

The crossing audit evaluated 3,030 ordered, non-node road crossings after
excluding Hoan proxy interiors. There are no inverted residual crossings and
no remaining vehicle-clearance deficits. Five pedestrian-only loop conflicts
remain: the largest is 1.338 m short of the 2.7 m target. In these small loops,
raising the upper path also raises its connected lower approach; forcing more
iterations would inflate both surfaces without resolving the source ambiguity.
All five source IDs, coordinates, and modeled gaps are recorded in
`docs/highway-crossing-audit.json`.

At West Clybourn Street, cached movable bridge ways 1262262334 and 1262262335
remain river-bank structures rather than receiving a 14 m layer-2 lift. Their
nearest cached I-794 deck source way is 394246036, about 34 m away in plan, so
the source lines do not form a geometric crossing. The modeled I-794 deck is
about 15 m above the Clybourn deck at those nearest points. The Marquette and
I-794 freeway crossings have no residual inversion or vehicle-clearance entry
in the final audit.

The machine-readable evidence is in
[`highway-crossing-audit.json`](highway-crossing-audit.json). Re-run the audit
after refreshing OSM or the terrain raster; these values describe the current
cache only.

## Regenerated assets and review

The full road rebuild regenerated 195 geographic tiles (390 full/LOD files).
The packed-asset audit checks 8,255,749 ROAD triangles and 1,469,228 structural
triangles across both detail levels: no nonfinite coordinates, out-of-tile
vertices, or downward road faces remain. All 390 building sections match the
pre-rebuild files byte for byte. The report is
`data/highway-rebuild-validation.json`. The web production build and 25 Hoan,
lighting, lighthouse, and local-terrain regressions passed. The profile,
road-mesh, structure, and packing suites also passed (32 checks combined).

Visual review uses the app's Marquette Interchange, Milwaukee Public Market,
and Hoan Bridge destinations at 1× height. Source plan alignments are retained;
this pass does not claim surveyed vertical curves or exact pier locations.
