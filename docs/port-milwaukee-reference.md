# Port Milwaukee / Jones Island model

Implemented September 7, 2026. Review at `http://127.0.0.1:5173/port-review.html`, or select **Port Milwaukee** in the main app. The landmark tour now includes the port after the Hoan Bridge. Review cameras use 1× physical height.

## Sources and accuracy

The user-supplied `port_milwaukee_detailed_threejs_reference_pack` guided the industrial silhouettes, cargo sheds, paired bulk-storage domes, open-frame dock cranes, administration building, wind turbine and Lake Express ferry. The supplied UWM main-harbor map guided the overall relationship between Jones Island's cargo fingers, inland rail yard and southern ferry terminal.

Geographic placement comes from the existing cached OpenStreetMap extract (`data/raw/milwaukee.osm.pbf`), projected with the application's city origin. `pipeline/extract_port_site.py` reproduces `web/src/portSite.ts`. It contains 81 active railway ways and significant mapped building footprints. The approximately 30 km of centerlines includes approach tracks and the surrounding network; it is not a claim about the length of port-owned track. Disused railway ways are excluded.

The 12 industrial quay chains in `portDockEdges.ts` were extracted from the actual shipped `water.bin` triangle boundaries and simplified by no more than 0.25 m. Narrow land-side aprons, retaining walls, fenders and bollards follow these edges. No large new rectangles fill the slips.

Public context sources:

- [Port Milwaukee property map](https://port.milwaukee.gov/Port-Mke/Work-with-the-Port/Port-Property-Map)
- [Port Milwaukee rail-service infrastructure](https://port.milwaukee.gov/Port-Mke/Contact-Us/News/State-Grant-Readies-Port-Milwaukee-for-Increased-Rail-Service)
- [UWM Milwaukee harbor maps](https://uwm.edu/freshwater/community-engagement/community-resources/harbor-maps/milwaukee-harbor-maps/)

## Geometry

- 22 selected source building shells are replaced with corrugated cargo sheds, bulk-storage domes, cylindrical tanks, the administration building and ferry terminal. Footprint size, orientation and location follow mapped geometry; roof forms, heights and facade details are interpretations rather than surveyed construction drawings.
- Four open-frame dock cranes have lattice booms, cabs, undercarriages and hoist cables. Equipment locations are illustrative; their centers are on land and clear of mapped buildings and rail centerlines.
- A 180 × 22 m lake freighter and 58 × 18 m twin-hull ferry are static illustrations. Their full rectangular envelopes were checked against the rendered water geometry. These are original unbranded meshes, not live vessel positions or exact replicas.
- The public administration building and wind turbine use their mapped positions. The paired dome roof interpretation uses the reference photographs over two adjacent mapped circular storage footprints.
- Rail centerlines preserve source vertices and junctions, with two steel running rails, ballast and instanced sleepers. Track vertical profiles follow the terrain; rail bridge heights are approximate, using the source bridge/layer tags. Turnout blades, signaling, electrification and animated rail traffic are not represented.
- Small warm yard fixtures turn on in sunset/night modes. Geometry is merged by shared material, and all sleepers use one instanced draw call.

## Integration and preservation

`removePortPlaceholders` matches original footprint nodes and measured packed floor/roof pairs. It removes only the 22 selected shells from full and LOD tiles, preserving other triangle data and attributes. Circular way `1068003691` remains its original source mesh because too few packed vertices matched to replace it safely. Nearby wastewater treatment structures and unrelated buildings remain intact.

The original shoreline and street geometry remain the base context. Existing coarse terrain artifacts along the southern freeway approaches are outside this port-building pass.

## Verification

`npm run test:port`: **22 passing tests** covering bounded geometry, roof slopes, twin-hull clearance, mapped data, rail continuity and sleeper batching, exact placeholder removal in both detail levels, composition render budget and complete vessel-envelope water containment.

`npm run build`: passes. Vite retains its existing large-bundle warning.

Browser checks: cargo docks, close rail yard, bulk storage, ferry terminal, night mode, and navigation through the live Port Milwaukee landmark button. Review images:

- [Cargo docks](review/port-cargo-docks.png)
- [Rail yard](review/port-rail-yard.png)
- [Night](review/port-night.png)

## Jones Island reference expansion

The subsequent `jones_island_detailed_threejs_reference_pack` adds the reclamation facility and Kaszube's Park to the same port scene. Modern exterior photos `ji_02`, `ji_03`, `ji_04`, `ji_01` and `ji_05` guided the materials and visible details. The pack's conceptual north/south diagram was not used for geographic placement; mapped coordinates and aerial relationships take precedence. Historical fishing-village photos were retained as background research and were not mixed into the modern geometry.

`pipeline/extract_jones_island_site.py` generates `jonesIslandSite.ts` from the cached OSM file, with water heights sampled from shipped water triangles. Runtime additions include:

- 49 mapped wastewater basin surfaces: 20 circular basins with concrete rims, center hubs and radial walkways, plus polygon-following channel walls for the remaining shapes.
- Warm masonry colors, repeated facade windows and sparse roof vents/skylights on existing source plant buildings. Original building geometry and roof elevations remain intact; this is an exterior-detail pass, not a surveyed replacement of the entire plant.
- Four mapped chimney positions. Their heights, taper and cap dimensions are estimated from the exterior photo; the largest is represented at 70 m, the other three at 24 m.
- Kaszube's Park's exact mapped lawn polygon, with a wood arrow sign, original text texture, timber posts, chains, benches, marker boulder and trees. Furniture and tree positions are illustrative.
- A correction for DEM bridge returns in the basin water, which reached about 18 m in one source basin. Only water triangles wholly within mapped basin polygons are flattened; elevations above 2.2 m are capped at that local approximation. Surrounding harbor triangles and all X/Z coordinates remain unchanged. Water levels are visual estimates, not survey values.

No clearly mapped Grand Trunk wetland was found within the cached extraction bounds; no invented wetland polygon was added.

The facility's historic context was cross-checked against [MMSD's centennial account](https://www.mmsd.com/about-us/news/100-years-jones-island-water-reclamation); the island's history against [Milwaukee Public Library](https://www.mpl.org/blog/now/a-history-of-jones-island).

Expanded validation: **30 port/Jones Island tests pass**, including basin-height correction, harbor preservation, unchanged building footprints and idempotent decoration. Production build passes with the existing bundle-size warning. The review page now includes **Jones Island plant** and **Kaszube’s Park** cameras.

- [Jones Island plant review](review/jones-island-plant.png)
- [Kaszube's Park review](review/kaszubes-park.png)
