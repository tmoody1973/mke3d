# The Hop: route, vehicle, and animation plan

Implemented September 6, 2026. The original plan is retained below; see [implementation and review notes](hop-implementation.md) and [route evidence and estimates](hop-route-discrepancies.md).

Build an accurate miniature streetcar that follows Milwaukee's streets, articulates through turns, stops at platforms, and fits the existing restrained interface. Start with a representative scheduled preview; actual live vehicle tracking is a separate future feature.

## Evidence from the supplied folder

Reference pack: `/Users/tarikmoody/Downloads/the_hop_threejs_reference_and_animation_pack/`.

| Asset inspected | What it establishes | Limitation to handle |
| --- | --- | --- |
| Route/stops GeoJSON | M-Line and L-Line closed shapes, 254 and 113 points respectively; 26 directional platform points | Service shapes are not surveyed rail centerlines or complete engineering curves. Shared track must not be drawn twice. |
| Raw GTFS | 402 trip records across seven service calendars; 5,988 stop-time rows; vehicle `block_id` assignments | 75 rows have blank times; all arrival/departure pairs are equal; no shape-distance values; `direction_id` is 0 for both full-loop shapes. |
| Trip and animation profiles | Useful schedule summaries and shape linkage | Summaries omit block assignments and per-stop timing. Do not use them alone to run the simulation. |
| City route shapefile | Five schematic M/L route records in NAD27 Wisconsin South State Plane, US survey feet | Only 8–18 vertices per record and historical construction-status text. Reproject before comparison; do not treat it as current surveyed track geometry. |
| Side-profile and Public Market turn photographs | Three articulated sections, central doors, wrapped cab glazing, roof equipment, embedded street rails and corner context | Sponsor wraps vary. Photos establish visual references, not exact bogie spacing or track gauge. |
| Animation helper | Demonstrates linking shapes to trips | Uses its own geographic origin, flat y=0 paths, whole-shape constant progress, no stop dwell, and weekday-only service filtering. It is a prototype to learn from, not a module to drop into this app. |

The pack's blanket three-car cap should not be adopted: at weekday noon its trip data contains three M-Line trips and one L-Line trip in four distinct blocks. Also distinguish 26 platform records from 26 unique station sites.

The manufacturer confirms a vehicle almost 67 ft long and 8 ft 8 in wide—approximately 20.4 × 2.64 m—with two center-car passenger doors and off-wire battery capability. Use those dimensions for the model; verify height, articulation pivots and wheelbase separately. [Brookville vehicle reference](https://www.brookvillecorp.com/first-of-five-brookville-liberty-streetcar-vehicles-for-the-hop-streetcar-arrives-in-milwaukee/).

The operator describes the L-Line's figure-eight through the Couture transit concourse, Michigan, Clybourn, Milwaukee and Broadway. Its route must pass through the actual concourse opening, not through the current simplified building solid. [Operator L-Line description](https://thehopmke.com/l-line/).

## Recommended experience

- Cars move at natural speed in the normal city view. Seed the preview with vehicles already along their routes, so the user need not wait for the first departure.
- Default to a representative weekday at noon from the bundled schedule snapshot. Clearly label this **Scheduled preview**; it is not a live location or arrival service.
- Keep Day/Sunset/Night independent of the service clock, so changing lighting never teleports cars or empties the scene.
- Add a compact **The Hop** entry to the destination board. Its expanded controls provide M-Line/L-Line visibility, Show route, Play/Pause and Follow car. Normal exploration remains unobstructed.
- Physical rails remain subtle. Show the colored route overlay when the feature is selected; show stop names on selection or at close zoom, rather than placing 26 labels over downtown.
- Follow car is an explicit, smooth elevated tracking view with a look-ahead target. Manual camera input exits follow. Camera tours and Hop follow must have one owner; neither takes over without user action.
- Reduced-motion users get a static route and parked vehicles until they explicitly start playback. Pausing motion keeps the scene and information usable.

## Build order and review gates

### 1. Prepare route data and resolve street alignment

Create `pipeline/build_hop.py` to normalize the supplied GeoJSON and raw GTFS into a small versioned asset under `web/public/data/hop/`. Preserve original IDs, input hashes, retrieval date, coordinate reference systems, attribution, and a list of inferred values.

Use the existing manifest projection in `web/src/geo.ts` (`x` east, `z` south), not the helper's independently averaged origin. Build an ordered, directed track graph. Share physical segments used by both routes while retaining route memberships, direction and stop sequence. At the figure-eight crossing, geometry intersecting itself must not accidentally create a route shortcut.

Compare the service paths against mapped tram tracks, the operator map, City GIS and reference photos. The current pipeline has no dedicated tram layer. Obtain or trace missing tight-turn and lane alignment evidence before describing the rails as accurate. Use a verified gauge, not the pack's arbitrary 0.5–1.0 m lateral offsets.

Fit bounded curves only at verified turns; preserve straight street alignments and avoid unrestricted smoothing that crosses sidewalks. Derive distance tables and attach each stop monotonically to the correct directed traversal, including repeated visits to the same location. A trip may cover a portion of a closed shape; first/last stops determine its extent.

For elevation, match the intended street surface and bridge approach at each route segment. Terrain height alone is insufficient at river crossings; blindly taking the highest raycast surface could instead put a car on I-794. Reuse the road generator's profiles or precompute heights from the matched ROAD surface. Keep this independent of whichever tiles happen to be loaded.

**Gate:** Inspect the complete M/L route overlay at 1×. Confirm the Public Market turn, St. Paul river crossing, Burns Commons turnaround, shared downtown track and Couture concourse. Produce a route discrepancy list with sources for any corrections.

### 2. Build one recognizable, articulated vehicle

Create `web/src/hopVehicle.ts` with front, center and rear body sections, connected bellows, bogies, wheels, center doors, roof equipment and pantograph. Establish meter units, rail-contact pivot and forward axis explicitly. There is no ready-made production vehicle model in this pack.

Use the supplied side-profile, front-nose, maintenance and platform photos for silhouette and materials. Start with the recognizable white/dark-glazing body and separate Hop branding/colored trim; keep changing advertisements as optional decals. Match model views to the photos at 1× before adding small detail.

Add independently controllable head/tail lights, a readable route display, restrained interior illumination and platform-side door motion. Lamps should face the active direction. Avoid a glowing whole body or bright pools from every window.

**Gate:** One correctly sized car sits on the tracks at the Public Market and a platform. Wheel contact, cab shape, section proportions and door/platform relationship pass review in day, sunset and night. Any photo-estimated dimensions are recorded.

### 3. Animate one turn and one stop, then expand to both lines

Create `web/src/hopMotion.ts` with distance-based path sampling and a state machine for travel, braking, dwelling and departure. Use acceleration limits and curve speed limits. Validate travel-time feasibility; do not speed through a tight turn to force an impossible schedule interval.

Sample bogie positions along the route and solve linked rigid sections around their articulation pivots. The rear section must follow the track instead of rotating the complete 20 m vehicle around a single center. Keep bellows connected and test the vehicle's swept envelope at curbs and platforms.

Read raw stop times to anchor movement. Interpolate missing intermediate times only between valid timepoints, using traveled distance; flag ambiguous terminal records. Because the feed contains no separate dwell duration, use a configurable, documented illustrative dwell budget within each feasible interval (initially about 15–25 seconds). Doors open only at a stopped vehicle's platform side and close before departure. These estimated movements are not claimed as observed operations.

Create `web/src/hopSchedule.ts` to apply calendar dates, exceptions and America/Chicago service-day rules; accept extended GTFS times above 24:00 when future feeds contain them. Reuse cars by `block_id` rather than spawning a new car for each trip or imposing a citywide three-car cap. Validate duplicate departures, terminal layovers, trip continuity and block conflicts. Shared-track spacing prevents vehicles from overlapping; it does not require building a full road-traffic simulator.

The simulation clock is separate from the display mode and camera. Default to real-time motion; a labeled preview-speed control can come later. Pause hidden-tab time and reset the frame timestamp on resume to prevent catch-up jumps. Route visibility and tile unloading do not recreate vehicle identities.

**Gate:** First demonstrate a smooth Public Market corner, accurate stop, door cycle and departure with one car. Then run both routes through a complete representative service cycle, including terminal handoffs, with no teleporting, collisions, backwards movement or frame-rate-dependent speed.

### 4. Integrate the feature with the city and interface

Create `web/src/hop.ts` as the feature boundary, with route/station geometry in `hopRoute.ts`. Load it after the terrain and manifest are available in `main.ts`; an optional Hop asset failure must not prevent the city from opening.

Use persistent scene groups rather than attaching transit to streamed tiles, which are disposed during focus/LOD changes. Rails follow the city elevation transform. Place vehicle visuals in an unscaled persistent group, deriving their wheel positions from the rendered track heights, so 2×/4× building height does not stretch the streetcars. Check pitch and articulation under these height settings as well as at 1×.

Update the simulation in the existing render loop before rendering. Extend the existing camera director for optional follow mode rather than running a competing camera animation. Continue streaming tiles from the camera target, not every moving car.

Use the existing board and compact controls in `web/index.html` and the current stylesheet. Include stop name, line and next-stop information in a small selection panel with the Scheduled preview label. Add attribution to About and a source manifest alongside the data.

Add embedded rails and nearby station furnishings with shared geometry. Refine visible platform sides from photos; keep opposite-direction platform records distinct even when sharing a station label. Treat overhead-wire coverage and the Couture opening as source-specific work: the cars support off-wire operation, so do not invent continuous wires over the full network.

**Gate:** Hop focus/follow, manual orbit, Reset and the landmark tour work together. Mobile controls remain compact and keyboard accessible. No new label clutter, terrain gaps, tile reload resets or nighttime glare.

### 5. Validate and finish

Add importer checks for source counts, projections, stop attachment, calendars and missing-time handling. Add `web/tests/hop.test.ts` and a `test:hop` command for distance continuity, articulation, stop/door sequencing, block reuse, pause/resume, reduced motion and physical scale.

Run Hop tests, the existing tour regressions and `npm run build`. Review fixed photo angles and full-route playback at 1×, followed by grounding checks at 2× and 4×. Record day/sunset/night views and narrow-screen interaction checks. Test loading failure and GPU-resource cleanup when toggling the feature.

Use shared materials and vehicle geometry, detailed near models and simplified distant models. Initial targets are at most 20,000 triangles and 16 draw calls per detailed car, plus a bounded shared route/station cost; measure on the existing scene before accepting these budgets. Cache route lookups and service events rather than scanning all 402 trips every frame. Avoid added shadow-casting lights per car.

**Done:** Both bundled routes are recognizable and correctly aligned, cars stay on their tracks and stop at the right platforms, articulation remains connected, motion is calm, and existing landmarks/tours remain intact. Timing and geometric estimates are disclosed in source notes.

## Scope held for a later pass

Live GPS/arrival integration, seasonal F-Line operations, dispatch simulation, road-traffic signals, passengers and a detailed cab interior are separate additions. The bundled feed has only M/L route IDs; F-Line should use separately verified seasonal routing and dates rather than being fabricated from a route label. The operator publishes a distinct [F-Line description](https://thehopmke.com/f-line/) and [route/schedule map](https://thehopmke.com/interactive-map/).

Keep supplied photos and the operator PDF as reference assets. If publishing photos or image-derived textures, carry the exact author, source and license from `commons_vehicle_assets.json`. Preserve City/operator data attribution in generated assets. There is no need to ship the entire reference pack with the app.

**First implementation milestone:** The Public Market streetcar turn and platform stop at 1×, using one accurate articulated car. This validates the hardest geometry and motion before multiplying it across the network.
