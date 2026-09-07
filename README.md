# Milwaukee in Miniature

An interactive 3D miniature of Milwaukee, Wisconsin, built from real geographic data: every building footprint, road, river and park in the city limits (plus a 1.5 km margin), Lake Michigan, and the real terrain. Rendered in the browser with Three.js.

**Features:** orbit/zoom/pan with mouse or touch · day, sunset and night lighting · landmarks with clickable labels and short descriptions · automated fly-through with pause/resume · vertical exaggeration 1×/2×/4× · lazy-loaded tiles with progress and error states · reduced-detail mode on phones.

## Run it

```bash
cd web
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in web/dist (typechecks first)
npm run preview    # serve the production build locally
```

The viewer reads pre-built data from `web/public/data/` (committed, ~see stats.json for sizes). You only need the pipeline below if you want to regenerate it.

## Regenerate the data

### The Hop streetcar preview

The **The Hop** destination-board entry provides animated M/L service, route visibility, car selection, Play/Pause and Follow car. It uses a bundled weekday timetable, independently of Day/Sunset/Night, and is labeled **Scheduled preview**. See [implementation and validation](docs/hop-implementation.md) and [source accuracy notes](docs/hop-route-discrepancies.md).

Regenerate its optional asset with `pipeline/.venv/bin/python pipeline/build_hop.py` from the repository root. Validate with `pipeline/.venv/bin/python pipeline/test_hop.py` and `cd web && npm run test:hop`. The source reference pack path can be supplied with `--pack`.

### City tiles

Requires Python 3.12+ and [uv](https://docs.astral.sh/uv/). Everything is cached under `data/raw/` and is safe to re-run.

```bash
pipeline/run_all.sh
```

That runs four scripts in order:

| Script | What it does | Source |
|---|---|---|
| `fetch_city.py` | City-limit polygon (State Plane → WGS84) and the city's river/pond polygons; writes the fetch bounding box | City of Milwaukee Open Data (CC-BY) |
| `fetch_terrain.py` | Samples elevation onto a 40 m grid | Terrain Tiles on AWS (Mapzen "terrarium", zoom 13) |
| `fetch_osm_pbf.py` | Reads the Wisconsin extract (~290 MB, downloaded on first run; `run_all.sh` cuts the Milwaukee box first with `osmium` if installed) and pulls buildings, roads, water, parks and the Lake Michigan shoreline inside the box | Geofabrik / OpenStreetMap (ODbL) |
| `mprop.py` | Builds a spatial index of the city's parcel polygons and looks up each parcel's recorded story count from the Master Property File (used by `build_tiles.py`) | City of Milwaukee Open Data (CC-BY) |
| `build_tiles.py` | Estimates heights, extrudes and triangulates, drapes roads on terrain, builds Lake Michigan from the coastline, writes binary tiles + manifest + stats | — |

`fetch_osm.py` is an alternative Overpass-API fetcher kept for reference; it works but the public API rate-limits so heavily that the extract is the recommended path.

## How the model is built

- **Projection.** Everything is converted to a local plane in meters centered on downtown (43.035° N, 87.905° W). Three.js x = east, y = up, z = south. Vertical exaggeration simply scales the whole city group in y.
- **Buildings.** Extruded from OpenStreetMap footprints (closed ways and multipolygon relations). Height, in priority order:
  1. the OSM `height` tag (meters or feet);
  2. the OSM `building:levels` tag × 3.3 m;
  3. the **recorded story count** of the parcel the building sits on, from the city's Master Property File (MPROP `NR_STORIES`), × 3.3 m + 1 m. Skipped for footprints under 60 m² and for garages/sheds so outbuildings don't inherit the house's height;
  4. a **documented estimate** by building type (e.g. house 6 m, apartments 12 m, church 14 m, warehouse 9 m — full table in `pipeline/config.py`), or for untyped buildings by footprint area (3 m for sheds under 60 m² up to 12 m for blocks over 5,000 m²).
  
  `web/public/data/stats.json` and the in-app "i" panel report how many buildings fall in each category. Colors follow a "Cream City brick" palette by height band, with a small per-building variation.
- **Roads.** Follow OSM centerlines, retaining mapped bends. Widths use `width` first, then lane counts and class estimates. Motorways use 3.66 m lanes plus estimated shoulders; ordinary streets use 3.2 m lanes. Mapped walking/cycling paths are included in nearby tiles. Rounded connections, subdivision, and clipping to tile boundaries improve terrain contact and loading continuity. Asphalt, concrete, and unpaved surfaces have distinct colors. Freeway bridge profiles share elevations at original source junctions, including internal way nodes, and retain mapped structure ordering. Generic bridges use endpoint-based deck profiles; `layer` alone does not lift a street. Bridge clearances and missing widths are estimates, not surveyed dimensions.
- **Water.** Lake Michigan is built by polygonizing OSM coastline ways against the bounding box and keeping the pieces that contain known lake points. Rivers and ponds are the union of OSM water polygons and the city's Waterways layer; the terrain is carved into a shallow trench beneath them and the water surface is draped just above the trench floor. The lake surface sits at 0 m = 176.5 m above sea level (approximate long-term Lake Michigan level).
- **Terrain.** One displaced grid (40 m spacing) with vertex colors: land inside the city limits, muted land outside, green for parks/cemeteries/woods, a sand tone along shorelines.
- **Tiles.** 2 km squares. Each has a full file and a `.lod` file (only buildings ≥ 12 m tall or ≥ 600 m² footprint, simplified; only major roads). The browser keeps full tiles near the focus point and LOD tiles farther out, and unloads the rest. Positions are int16 tenths-of-meters relative to the tile center; colors are RGB bytes. One mesh per layer per tile, so draw calls stay in the dozens.
- **Lighting.** Sunset combines low western sunlight, cool ambient shadows, and a directional sky gradient. Night uses restrained ambient light and approximately 10% procedural window occupancy, grouped into small suites with larger dark facade areas. Dim warm panes have anti-aliased edges and distance fading; roads and unlit facades do not emit light. The fixed pattern uses spatial zones rather than measured building occupancy. Water reflects the procedural sky with subtle ripples (paused for reduced motion), not surrounding buildings. Shadow coverage tightens around nearby landmarks. These are artistic presets, not a simulation of a particular date or weather.

## Landmarks

The original twelve locations were verified against OpenStreetMap objects on 2026-09-06 (`pipeline/verify_landmarks.py`, results in `data/landmarks_nominatim.json`). Five have **interpretive geometry** — simplified, hand-authored shapes that are recognizable but not measured models: the Art Museum’s Quadracci Pavilion (72 fins, a 66.14 m wingspan, inclined mast, vaulted glass hall, galleria, curved auditorium, and Reiman Bridge), the Hoan Bridge’s 182.88 m central arch with below-road spring points, connected side-span framing, steel floor system, short main piers, roadway details and mapped harbor context (photo-based member dimensions and local bank grades; see `docs/hoan-reference.md`), the three Mitchell Park Domes (42.672 m diameter and 25.908 m height, source-aligned centers, triangular glazing, broad oculi, connecting entrance and rear greenhouses; details remain interpretive, see `docs/domes-reference.md`), the North Point Lighthouse tower, and the Basilica's dome and towers. The rest use ordinary extruded footprints. Descriptions are short summaries of public facts; treat dates and dimensions as approximate.

Building signs use official U.S. Bank, Baird, and BMO logo assets (see `web/public/signs/SOURCES.md`). U.S. Bank Center and BMO Tower locations come from the named footprints in the cached OSM extract. Signs mount against actual full-detail tile walls, unload with those buildings, scale with height exaggeration, and illuminate in night mode. The logo artwork is authentic; dimensions, mounting details, and placement are approximate. U.S. Bank is shown on the east/west faces, Baird on north/south, and BMO on the confirmed west face. Focused landmark views hide other labels until the detail panel is closed.

## Known limitations

- Only ~1% of Milwaukee buildings in OSM carry a height or floor count. Inside the city limits most heights come from the parcel's recorded story count instead; outside the city (the 1.5 km context margin) and on parcels without a story count they are estimates. `stats.json` gives the exact split.
- A story count is per parcel, not per building, so a multi-building parcel (a campus, a plant) gives every building the same height.
- Multipolygon buildings keep their courtyards, but any invalid ring in OSM is dropped rather than repaired.
- Rivers upstream of the North Avenue dam are draped on 40 m terrain, so their banks are smoothed.
- Street detail depends on OSM coverage and the 40 m terrain grid. Lane counts estimate pavement width; parking lanes, shoulders, curb lines, signal positions, and crosswalks are not surveyed or synthesized. Generic bridge heights remain approximate.
- Coverage numbers come from the extract's date (see stats.json); nothing here claims completeness beyond what OSM contained that day.

## Attribution

- Buildings, roads, parks, water and coastline: © OpenStreetMap contributors, [ODbL](https://www.openstreetmap.org/copyright). Extract: Geofabrik, dated in `stats.json`.
- City limits, Waterways, parcel outlines and the Master Property File (MPROP): [City of Milwaukee Open Data](https://data.milwaukee.gov), CC-BY.
- Elevation: [Terrain Tiles on AWS](https://registry.opendata.aws/terrain-tiles/) (Mapzen terrarium; underlying USGS 3DEP/NED, GEBCO and others; attribution per that page).
- Landmark verification: Nominatim / OpenStreetMap.

## Deploy

The existing live site is [mke3d.vercel.app](https://mke3d.vercel.app) (Vercel project `mke3d`, first deployed 2026-09-06). The public source repository is [tmoody1973/mke3d](https://github.com/tmoody1973/mke3d).

The app is a static site. Configure Vercel with root directory `web`, build command `npm run build`, and output directory `dist`. From `web/`, `npm run build` produces the production site, including the landmark review pages. With the Vercel project linked at the repository root, run `vercel --prod` from the repository root to redeploy. `web/vercel.json` sets cache headers for the tile files. The committed `web/public/data/` assets are required for deployment; regenerating the data pipeline is optional. No application environment variables or secrets are needed.

## License

Original project code and documentation are available under the [MIT license](LICENSE), copyright 2026 Tarik Moody. Geographic data, bundled fonts, logo artwork, trademarks, and dependencies retain their respective terms; see [third-party notices](THIRD_PARTY_NOTICES.md). Local research-photo packs and source-download caches are excluded from the public repository.

## Decisions and learning log

See `docs/decisions/` and `docs/LEARNING-LOG.md`.

## Camera tour

The tour uses curved, distance-sensitive flights with gradual acceleration and braking, followed by a gentle sweep around each landmark. The horizon stays level. Stops follow a geographic circuit through the lakefront, downtown, and outlying landmarks. Camera motion uses elapsed time rather than a fixed rotation per frame, and long rendering gaps are capped to avoid sudden jumps when returning to the tab.

Pause freezes the current flight or sweep; Resume continues the same stop. Dragging or zooming pauses the tour and gives manual control. Reduced-motion preferences disable animated transfers and automatic orbits. Ground-relative landmark framing and transfer altitude are approximate; this is a cinematic camera path, not a terrain or building collision simulation.

Run `npm run test:tour` from `web/` to check frame-rate independence, phase continuity, pause/resume, interruption, and reduced motion.

## Landmark geometry checks

From `web/`, run `npm run test:hoan` with Node.js 22.18+ to check the Hoan roadway beneath both arches, tie-to-deck contact, end supports, clear navigation span, and approach connections. The regression uses uneven terrain to catch accidental terrain-following through the main span.

Run `npm run test:signs` from `web/` to verify outward facade mounting, corner clearance, and placement against the shipped building tiles.

The Hoan's architectural lighting follows the blue arch outlines, warm gold vertical members, and spaced blue deck fixtures in [Signify's installation photographs](https://www.signify.com/en-us/our-company/news/press-releases/2025/20250708-signify-color-kinetics-architectural-led-luminiaries-activated-east-side-milwaukee-hoan-bridge). Both sides are represented: the west side opened in 2020 and the harbor-facing east side in 2025. Fixtures follow the model's actual steel and deck paths, switch off during Day, and illuminate at reduced intensity in Sunset and full intensity in Night. This is a static interpretation of one photographed color scheme; fixture spacing is approximate and it does not reproduce the bridge's live programmable shows or cast reflections onto the water. Two batched draws keep the lighting inexpensive. `npm run test:hoan` also checks lighting modes and fixture geometry.

## Explore landmarks on foot

Select any landmark and choose **Walk around this landmark**, or use **Street view · walk around** on the destination board. The walking menu includes all 23 landmarks and the current map area. The camera starts 1.7 m above supported ground, facing the selected landmark; building collisions and water checks remain active.

Use **WASD** or the on-screen arrows to move, drag to look around and up, and hold **Shift** for a brisk pace. **Back to start** restores your starting point; **Esc / Back to map** restores the aerial view. You can change landmarks and day/sunset/night lighting without leaving walking mode.

## Street geometry checks

Run `pipeline/.venv/bin/python pipeline/test_roads.py` to check road widths, preserved bends, tile boundaries, terrain subdivision, and bridge approach continuity. Run `pipeline/.venv/bin/python pipeline/rebuild_roads.py` to regenerate street sections from cached source data and terrain; it preserves building sections byte for byte. The full pipeline uses the same road builder.

## Highways and Marquette Interchange

The highway model recognizes open-ended OSM bridge tags, including `bridge=cantilever`, which was previously omitted and caused several Marquette decks to collapse to terrain level. Freeway elevation profiles join only identical original source coordinates, so crossing ramps remain separate. Shared structural anchors keep adjoining decks connected; untagged segments between bridge anchors interpolate between them. Hoan connection elevations remain pinned to the interpretive model's endpoints.

The separate `HWAY` tile section adds shoulder and lane markings, concrete deck sides and undersides, parapets, and piers. Markings follow every mapped bend; structural details cast shadows and remain in distant tiles. Candidate columns are omitted where they would intersect mapped lower road ribbons. Exact lane tapers, vertical curves, superelevation, retaining walls, measured clearances, and pier spacing are not surveyed. The 40 m terrain grid still limits depressed-highway accuracy.

Source geometry is the cached Geofabrik/OpenStreetMap extract from September 2026. [WisDOT's Marquette/Valley Bridge overview](https://wisconsindot.gov/Documents/projects/by-region/se/marq-interchange/2015-marqint-pim-handout.pdf) provides the interchange context and documents its 29 core bridges. This represents the mapped network, not proposed I-794 alternatives or live construction closures.

Use `pipeline/.venv/bin/python pipeline/rebuild_roads.py --highways-only` to rebuild road and highway-detail sections in highway-affected tiles, preserving other sections and updating manifest sizes. The loader streams cached OSM elements to avoid retaining building source objects. Additional checks: `pipeline/test_highway_profiles.py` and `pipeline/test_highway_details.py`.

For a change limited to freeway markings or structural detail, `--details-only` replaces only `HWAY` in freeway-affected tiles and retains existing `ROAD` and building bytes. Changes affecting local bridges or the shared elevation solver require the full `pipeline/.venv/bin/python pipeline/rebuild_roads.py` command, without filters.

The shared solver now covers all 2,331 cached bridge ways, including movable street bridges and pedestrian spans. It uses connected approach terrain, class-specific grade limits, and crossing clearance constraints instead of lifting every local bridge by its OSM layer. Decks have joined edges, solid undersides, and terrain-grounded supports; movable and short spans receive no invented intermediate piers. The cached network audit found no inverted crossings or vehicle-clearance deficits. Five short pedestrian-loop conflicts remain documented in [the profile audit](docs/highway-profile-audit.md); elevations and support layouts remain estimates. After rebuilding, `pipeline/.venv/bin/python pipeline/verify_road_tiles.py /path/to/pre-rebuild-copy` checks packed road geometry and byte-for-byte preservation of building sections.

## Quadracci Pavilion model

`web/src/museum.ts` replaces the obsolete generic pavilion model. The hall points east and slightly north along the mapped Reiman Bridge / Wisconsin Avenue axis; the long galleria runs north toward the War Memorial. The old landmark ID 51865486 is absent from the current extract. The correct pavilion is OSM way 403894584. The runtime removes its old extrusion at both detail levels; future full builds omit that footprint. The adjacent War Memorial (403895414) and Kahler Building (446874803) are preserved. `data/museum_site.json` records the source footprints and placement inference.

The 72 fins, 217-foot wingspan, and 90-foot hall ceiling follow the [Museum’s architecture description](https://mam.org/info/pressroom/2010/10/anniversary/). The inclined axis and site relationship follow [Calatrava’s project description](https://prod.calatrava.com/projects/milwaukee-art-museum.html). Fin camber, floor elevation, facade details, auditorium profile, and bridge mast/cables are interpretive, not surveyed. The wings remain shown open in these artistic lighting presets.

Run `npm run test:museum` from `web/` to check actual fin continuity, winding, roof clearance, orientation, entrance-to-bridge contact, geometry budget, and removal of the old pavilion without changing neighboring buildings.

The broader museum campus model joins the Quadracci Pavilion to the raised War Memorial Center, open Court of Honor, Kahler lakeward addition, Reiman Bridge, and Museum Center Park. The dedicated `web/src/warMemorial.ts` uses Saarinen's original second-floor plan to arrange unequal cruciform wings around the elevated court, with sculpted piers and a five-panel west mural treatment. Select **War Memorial Center** in the destination board to inspect it at 1× height. Run `npm run test:warmemorial` for its geometry and lighting checks. Cached OSM footprints and paths control the plan alignment. Museum Center Park (way 55206404) is mapped as a park, so the open parking structure below its raised roof, structural levels, stalls, trees, and north surface lot are interpretive additions based on supplied visual references. The park roof and Reiman walking deck meet at elevation 10.7 m. See `docs/museum-campus-reference.md` and `docs/lakefront-reference.md` for sources and modeling limits.

### American Family Field

The dedicated stadium model replaces relation 5747956 at both streamed detail levels. It adds a fan-shaped open roof with exposed trusses, a baseball field and tiered bowl, brick entrance arcade, name signage, and lighting tied to Day/Sunset/Night. Source-derived placement faces center field east-southeast; details remain interpretive. See [reference notes](docs/amfam-reference.md) and review at 1× height. Run `npm run test:amfam` from `web/` for model and source-removal checks.

### North Point Lighthouse and Lake Park

North Point now uses the supplied HABS WI-358 tower elevations/plans and current photographs, with a separate keeper's house at its mapped footprint. The 74-foot octagonal tower has a stepped plinth, tapered steel/cast-iron stages, window surrounds, flared cornice, black gallery and lantern. A local USGS 3DEP terrain patch samples native 1 m elevation data at 5 m spacing across 620 × 600 m. Mapped Wahl Avenue, Lincoln Memorial Drive, the driveway, ravine trails, stairs and both Lion Bridges follow that ground; bridge decks span the ravines. Woodland and lawn colors come from OSM polygons, with illustrative tree instances. These remain simplified models, not survey-grade reconstructions. See `docs/lighthouse-model.md`, `docs/lighthouse-site.md`, and `docs/lighthouse-terrain.md` for sources and limitations. Run `npm run test:lighthouse` from `web/`.

Discovery World now uses its 13 mapped building parts instead of the single parent extrusion. The detailed model includes the west Tech wing, four white arc panels around the glazed Aqua building, upper Pilot House with an open steel crown, low promenade, north event pavilion, and a supported boardwalk collar. Its estimated deck datum avoids the old submerged terrain sample. Select **Discovery World** at **1× height**; run `npm run test:discovery` from `web/`. See [the source and accuracy notes](docs/discovery-world-reference.md).

Milwaukee Public Market now follows its mapped footprint with TKWA photo references for the glass, cream masonry, exposed steel, projecting sun shades and west-facing neon sign. Ten oversized source canopy extrusions are replaced with thin entrance canopies. Select **Milwaukee Public Market** at **1× height**; run `npm run test:market` from `web/`. Heights and facade details remain visual estimates. See [the source and accuracy notes](docs/public-market-reference.md).

### Turner Hall Ballroom

Turner Hall now has a mapped exterior model with cream/red masonry, arched windows, twin gables, central dormered roof tower, north addition and side fire escapes. Select **Turner Hall Ballroom** to fly there or walk around it. [Model review](https://mke3d.vercel.app/turner-hall-review.html). Architecture and height details are photo-based estimates; see `docs/turner-hall-reference.md`.

### Pabst and Riverside theaters

Both theaters now have detailed exterior models, landmark labels and walking destinations. Pabst includes the Wells Street iron porch, ornate masonry, balcony, mansard roofs and two-sided blade signs. Riverside includes the complete mapped Empire Building, Wisconsin Avenue entrance, projecting bulb-lit marquee and red vertical blade. [Pabst review](https://mke3d.vercel.app/pabst-review.html) · [Riverside review](https://mke3d.vercel.app/riverside-review.html). See `docs/theaters-reference.md` for sources and modeling limits.

### Marcus Center campus

The Marcus Performing Arts Center, Peck Pavilion, north parking garage and State Street skywalk now share a detailed campus model. Public grounds include the current lawn, trees, rain gardens, cafe furniture and memorial corner; night mode lights the stone facade, entrance, pavilion and garage. [Campus review](https://mke3d.vercel.app/marcus-review.html). See `docs/marcus-reference.md` for references and modeling limits.

### Saint Kate

Saint Kate – The Arts Hotel now has a mapped exterior model with brick guest-room floors, arched stone window bands, detailed Kilbourn entrance and red neon signage. It is included in walking, tours and day/sunset/night lighting. [Hotel review](https://mke3d.vercel.app/saint-kate-review.html). References and scope are recorded in `docs/saint-kate-reference.md`.

### The Rave / Eagles Club

The Rave has a mapped exterior with its three monumental arches, upper arcade, ornamental stone bands, recessed entrances and night lighting. It is included in walking and tours. [Model review](https://mke3d.vercel.app/rave-review.html). References and scope are recorded in `docs/rave-reference.md`.

### Street lighting

Mapped street-light locations and road-based infill now use five fixture families, with sunset and night illumination and a bounded pool of nearby lights. [Fixture review](https://mke3d.vercel.app/street-lighting-review.html). Sources, placement and rendering details are recorded in `docs/street-lighting-reference.md`.
