# Hop route evidence and remaining geometric estimates

Implementation snapshot: September 6, 2026. Bundled schedule preview defaults to Tuesday, September 8, 2026, at noon in America/Chicago. This is not live tracking.

## Inputs and normalization

`pipeline/build_hop.py` reads the supplied reference pack's raw GTFS, the cached Milwaukee OSM PBF, and the current city manifest, terrain and ROAD tile geometry. `web/public/data/hop/network.json` contains source SHA-256 hashes, source IDs, projection constants, attribution and estimate flags. Rebuild from the repository root with `pipeline/.venv/bin/python pipeline/build_hop.py`; pass `--pack /path/to/reference_pack` if the pack moves.

The operator snapshot has two shapes, 26 directional platform records, 402 trips, 5,988 stop-time rows, seven service calendars and no calendar exceptions. All original route, trip, stop, block and calendar IDs survive normalization. The 75 blank intermediate times are interpolated by traveled distance between known timepoints. Missing terminal times raise an error instead of inventing an arrival. Original explicit times, including zero-valued timepoints, are preserved. Calendar weekdays run Monday to Sunday. Extended GTFS hours are accepted.

Sources: [The Hop feed listing](https://www.transit.land/feeds/f-the~hop~mke), [operator system map](https://thehopmke.com/interactive-map/), [L-Line description](https://thehopmke.com/l-line/), [City streetcar route GIS](https://data.milwaukee.gov/dataset/streetcar-route), and [OpenStreetMap](https://www.openstreetmap.org/copyright). The City GIS in the pack is a sparse historical schematic and is not substituted for mapped rails. No reference photos or route-map pixels are shipped.

## Horizontal alignment

The cached PBF contains 38 `railway=tram` ways, all tagged `gauge=1435`; the rendered gauge is therefore 1.435 m. This is mapped evidence, not an engineering survey certification. Depot ways bearing `fixme=find actual geometry` are excluded from service map matching.

The importer builds a directed graph from shared OSM nodes and `railway:preferred_direction=forward`. Each operator shape is matched to a continuous traversal of that graph. Crossing lines do not create new graph connections unless they share a mapped node. This preserves the L-Line figure-eight traversal and prevents shortcutting at crossings. OSM straight segments and their mapped corner vertices are retained; linear densification to at most 3 m introduces no curve overshoot. No unconstrained spline or invented lateral lane offset is used.

| Measure | L-Line | M-Line |
| --- | ---: | ---: |
| Original GTFS shape points | 113 | 254 |
| Matched route length | 3,077.05 m | 6,299.61 m |
| Densified path points, including closure | 1,215 | 2,464 |
| Mean original GTFS point distance to mapped traversal | 2.64 m | 2.15 m |
| 95th percentile distance | 10.48 m | 5.63 m |
| Largest point distance | 16.15 m | 13.07 m |

The differences are retained and disclosed rather than claiming GTFS is surveyed rail geometry. Public Market corners, the St. Paul river crossing and Burns Commons now use actual mapped track nodes. The physical rail asset contains 1,529 unique directed graph segments with route memberships; shared M/L rails are not generated twice.

### Stop placement

GTFS provides platform points, not track-distance values. For each stop, the importer retains distinct spatial visits within a 25 m tolerance, chooses the nearest projection in each visit, then attaches stops in forward traversal order. A full trip is constrained by regression checks to no more than one loop. This is particularly necessary at **TL-62, Ogden/Jackson Westbound**: its feed platform point lies closer to the opposite-direction rail. Choosing only the globally nearest segment incorrectly forced an extra circuit. Directional platform records remain separate even where their names or coordinates duplicate. Rendered platforms should anchor to a matching imported `trip.stops[].distance` on that trip's `pathId`, normalized modulo path length, rather than project the raw platform point again. Cache by `(pathId, stopId)`; the first complete trip provides a stable occurrence, including a terminal at either endpoint of the same closed loop. Re-projecting TL-62 globally would reintroduce the opposite-direction attachment error. Platform furnishing offsets and door sides still require photo-based interpretation.

## Elevation and interfaces with city geometry

Rail height is precomputed from packed ROAD top triangles, independent of tile streaming. The sampler prefers the road at the local surface grade and rejects the elevated I-794 surface where it crosses the streetcar. The St. Paul crossing explicitly chooses the low river-bridge deck in its mapped corridor, including nearby deck triangles across small packing gaps. Rail clearance is 0.055 m above the selected surface.

Elsewhere, missing exact coverage uses a road triangle within 4 m, then terrain plus the ordinary 0.4 m road allowance and rail clearance. Current output records 915 nearby-surface lookups and 75 terrain fallback lookups (these are sampler calls, not distinct stations or route segments). The Couture concourse is among locations without ordinary highway ROAD coverage. Those heights are estimates.

The shipped road geometry has small discontinuities at Clybourn/Milwaukee and a quantized gap on the St. Paul bridge. Isolated grades over 20% receive a symmetric 12 m local interpolation. This affects 41 path samples, with a largest adjustment of 0.76 m. Vehicle paths and physical rails use exactly the same repaired height at every shared, quantized XZ coordinate; a regression check covers all 3,679 route points. It prevents a visible car pitch jolt but is **not a survey correction to the city roads**; matching road surfaces should ultimately be improved together. Terrain remains the city's coarse terrain model, so individual rail profiles are not engineering grade data.

### Building passages that need actual openings

The mapped Couture concourse runs south through OSM ways **1272608049** and **1222527340**. Representative city coordinates are `(420.84, 4.65, -283.82)` → `(413.30, 4.45, -243.27)` → `(405.99, 4.13, -203.93)` → `(403.90, 4.15, -196.22)`. The building parent is **1300225285** and the overhead passage part **1403766299** has `building:min_level=2`. Rendering the parent footprint as a single solid would block the service route; the city integration now preserves a real lower opening and retains the elevated structure.

A second mapped building passage, way **507134241**, runs below the U.S. Bank Center connector at `(211.41, 6.41, -305.88)` → `(272.14, 6.31, -310.39)`. Parent **34901930** and overhead part **700370375** (`building:min_level=1`, `height=25 ft`) should remain open below their connector. These source-specific passage openings are now implemented by `web/src/hopSite.ts`: 18 matching facade triangles across nine guarded source edges are adapted and regression-tested, retaining the towers and elevated connector structure. Whole towers are not removed.

## Limits to retain in the experience

The feed describes scheduled service, not measured running speeds, signal delays, dwell times or dispatch. The noon snapshot has four distinct active blocks: three M-Line and one L-Line; there is no arbitrary three-car cap. The seasonal F-Line is not in the bundled route IDs. Neither continuous overhead wires nor current sponsor wraps are inferred from route geometry. Exact platform edges, turnout radii, track cant and survey elevations remain outside this data's accuracy.
