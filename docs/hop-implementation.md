# The Hop implementation

September 6, 2026. Open **The Hop** in the destination board to select a car, show either line, pause playback, follow a car or view the complete route. The default is Tuesday, September 8, 2026 at noon, with three M-Line cars and one L-Line car. Lighting is independent of the clock. This is a **Scheduled preview**, not live tracking or an arrival prediction.

The main **Tour** selector also offers **Streetcar · M-Line** and **Streetcar · L-Line**, alongside the landmark tour. **Start ride** follows an active car through its route and scheduled stops. **Pause ride** freezes playback; **Resume ride** continues. **Stop**, manual orbit, Reset, or a different camera flight releases the ride and restores the preview's previous playback preference. Starting a ride explicitly starts a paused preview, including when reduced motion initially paused it. The selected car cannot be changed during a ride. Mobile Start closes the destination drawer; reopen it for Pause or Stop. Streetcar tour choices stay disabled if the optional data cannot load.

## Data and geometry

- `pipeline/build_hop.py` imports the supplied pack's raw GTFS, maps its routes to cached OSM tram ways, and samples the packed street surfaces. The optional browser asset is `web/public/data/hop/network.json`.
- Both closed directed paths, 26 directional platforms, 402 trips and their vehicle blocks are retained. Rails use the mapped 1.435 m gauge. Shared physical segments are emitted once.
- Platforms and door sides use the importer's directed stop distances. Opposite-direction visits are not reassigned to whichever track happens to be nearest a GTFS coordinate.
- Cars use three rigid sections with connected bellows, bogies, two paired door bays per side of the center module, curved cab glazing, roof grilles, Hop lettering and M/L displays. The supplied vehicle photo pack informed the rounded nose, blue/champagne body panels, separate window panes, recessed door openings and wiper. Nominal body dimensions are 20.4 × 2.64 × 3.5 m; the finished nose/glazing bounds are 20.416 × 2.640 × 3.505 m. Section spacing, roof details, height and furnishing dimensions remain photo-based approximations. See [vehicle reference review](hop-vehicle-reference.md).
- Rails and vehicles share exactly the same height profile at all 3,679 route points. Vehicles and platform furnishings retain their physical proportions under 2×/4× city height. Refined cars use 8,504 triangles and 19 draw calls each, with shared materials within each car and no added scene lights.
- Couture and Michigan Street building passages are opened at nine source-guarded facade edges, preserving their upper buildings. See the separate [route evidence](hop-route-discrepancies.md) for source IDs, heights, interpolation and remaining survey limitations.

## Motion and integration

Motion uses a fixed timestep, acceleration/braking limits, corner speed limits, shared-track spacing and crossing priority. Vehicles persist by GTFS block across connected trips. Infeasible timing yields slower running rather than forced speed or teleportation. A disconnected handoff holds at its terminal.

The feed supplies identical arrival/departure times, so a 20-second dwell and door cycle are illustrative. Seventy-five blank intermediate timepoints are bounded interpolations. Cars are seeded along their trips at noon. Playback freezes in hidden tabs and starts paused for reduced-motion preferences.

The existing camera director owns follow mode. Manual orbit, Reset, a landmark flight or a tour releases it. Mobile follow closes the drawer. Colored route guides remain legible at city scale; close views use road-level ribbons and physical rails. Route visibility changes retain car identities and allocated geometry. Hot reload/feature disposal removes listeners, geometries and materials. Failure to load the optional Hop data leaves the city available.

## Verification

- 34 browser-side Hop tests cover physical scale, exposed glazing/lamps, articulation, gauge, directed platforms, passages, calendars, stop/door cycles, spacing, follow ownership, ride playback restoration and optional-data failure. Vehicle regressions check four leaves per side, recessed openings and consistent body paint across both lines.
- The bundled timetable test runs noon–14:00 with four persistent vehicle identities, multiple trip handoffs, no position jumps and no overlapping articulated bodies.
- 10 importer tests check source counts, timepoints, stop order, gauge, elevation continuity and exact rail/path height agreement.
- Seven existing tour regression tests and the production build pass. Vite still reports the application's large bundle advisory.
- Browser review includes the Public Market corridor, day/sunset/night appearance, 1×/2×/4× height, manual follow release and mobile controls at a 390 × 844 viewport override (348 × 753 CSS pixels at the browser's existing zoom). Screenshots are in `docs/review/hop-*.png`.
- Main tour controls were reviewed for both lines, Pause/Resume/Stop, Reset cancellation, switching back to the landmark tour, and mobile drawer dismissal and playback controls. The paused preview status updates immediately across both control panels.

Platform curbs, turnout radii, street elevations and vehicle detail are interpretive, not engineering measurements. Live GPS, seasonal F-Line, passengers, signal control and a complete overhead-wire network remain the explicitly deferred scope in the original plan.
