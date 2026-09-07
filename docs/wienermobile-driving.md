# Wienermobile driving mode

The sidebar's **Drive the Wienermobile** button enters a third-person arcade driving mode on the existing Milwaukee map. Driving uses 1× height and a close chase camera; exiting restores the previous map camera, field of view and height setting. Landmark/streetcar tours stop on entry.

## Controls

- W / Up: accelerate. S / Down: brake, then reverse.
- A / D or Left / Right: steer. Space: brake.
- Drag the map: look around and tilt up toward buildings. Horizontal orbit smoothly recenters after release; vertical aim remains until adjusted. V or Recenter view restores the chase view.
- C: hold to look behind. R: reset to the road checkpoint. Escape: return to map.
- On-screen steering and pedal buttons support simultaneous touch input.
- Standard gamepad: left stick steers, right stick looks around/up, RT accelerates, LT brakes/reverses, A brakes. Actual gamepad hardware is not part of the browser verification.
- Losing window focus or hiding the page clears held inputs and stops the vehicle; press a driving control to resume.

## Model and references

The user's `wienermobile_threejs_reference_and_control_pack` supplied official exterior reference photographs, envelope dimensions and an arcade-controller example. The procedural model uses the supplied 8.2296 × 2.4384 × 3.3528 m envelope, local −Z forward, an orange sausage shell, yellow bun/bodywork, cab glazing, separately animated wheels, lamp assemblies and small geometric badges. Lamps have supporting end fairings and separate lighting materials from the badges. No supplied photographs are embedded in the runtime.

Handling is a new typed implementation adapted to this map's axes and camera ownership. Performance settings are gameplay choices rather than real vehicle specifications: forward limit 16 m/s (about 36 mph), reverse 4 m/s, speed-sensitive steering and stable substeps capped during long render stalls. This is free driving, without missions, traffic simulation, vehicle damage or a full rigid-body physics engine.

## Roads, collisions and limits

Movement prefers rendered ROAD/HWAY triangles at the current deck elevation. Missing road samples fall back to rendered dry terrain within loaded tile coverage, allowing sidewalks, verges and road gaps. The full footprint samples the center, axles and corners; water above that terrain, steep discontinuities and building facades block the move. Elevated road edges still reject a drop to terrain below. A local spatial cache keeps road/building queries within the active neighborhood and invalidates on nearby tile/geometry/transform changes. Tile streaming continues around the moving vehicle. The chase camera shortens in front of cached buildings and bridge decks.

These checks inherit the existing map geometry. Loaded coverage is conservatively derived from each tile’s road/building bounds, so sparse outer tile edges can still stop a drive until neighboring data loads. The reset button returns to the initial road checkpoint. Custom landmark meshes and moving streetcars are not separately indexed as collision bodies. Jump physics and traffic-law enforcement are outside this version. Terrain fallback does not permit driving over water or into unloaded neighborhoods.

## Verification

`npm --prefix web run test:driving` checks model scale/grounding, lamps contacting bodywork, independent wheels, lighting, 30/60 fps handling, turning direction, reverse/braking, collision rejection, stacked bridge decks, camera obstructions and cache invalidation. Production build and manual browser entry, on-screen acceleration/braking, keyboard reset and exit are checked before delivery.

Final receipt: 13 driving/model tests and 7 existing tour tests pass; production build passes. Two real-data downtown starts each travel 26.06 m over three simulated seconds with no blocked substeps. The initial spawn search was bounded after a full-data performance check; a four-tile query measured 141 ms before the final heading-clearance refinement. Browser checks cover entry, visible acceleration, braking input, keyboard reset/exit, restoration of 2× map height, camera orbit, and headlights/taillights in night mode. Day/night screenshots are saved in `docs/review/wienermobile-drive-{day,night}.png`.


## Collision recovery and free look repair

A rejected turning pose now tries collision-checked straight movement at the
previous body heading. This lets a long vehicle back away from a tight wall
before its corner has room to turn. Full blockage stops speed immediately and
preserves wheel steering; reverse engages without residual forward creep.
The HUD explicitly identifies reverse and the moving-steering requirement.

Camera pitch now changes the look direction rather than only raising the chase
camera above the car. Dragging upward can look above the skyline; V and the
Recenter view button restore the standard chase angle. The collision anchor
remains at the vehicle. Browser checks confirmed upward look and recentering.
Automated checks cover tight-wall escape, head-on reverse, dry terrain gaps,
water and building rejection, bridge drops, unloaded ground, and camera poses.

## Guided car tours

Enter **Drive the Wienermobile**, choose a **Scenic drive**, then press
**Start drive**. The car is placed at that route's street start, with the normal
chase camera and free look retained. The three choices are:

- **Lakefront Cruise** — 2.13 km along Lincoln Memorial Drive toward McKinley Marina.
- **Downtown Architecture** — 2.21 km through Wisconsin, Broadway, Mason, Water, State and Jackson streets.
- **Historic Third Ward** — 1.00 km around Saint Paul, Milwaukee, Menomonee and Broadway.

The routes use the September 6 cached OpenStreetMap street graph, respecting
one-way directions and excluding motorways, elevated links, bridges, tunnels
and restricted roads. Source way IDs and street names are retained in
`web/src/drivingRoutes.ts`. They are simulation tours, not live navigation.

Tour speed offers 0.5×, 1×, 1.5× and 2×; 1× targets 8 m/s (about 18 mph) on
straight streets, with gradual acceleration and lower speeds through bends
and near the destination. Pause/Resume (or Space) keeps the current location.
Take the wheel, steering, or either pedal returns to manual driving. Camera
look controls leave the tour running. Focus loss pauses guided travel; Resume
continues. R resets to the chosen tour start and returns to manual mode.
Routes stop at completion, including the circuits, rather than teleporting
back to repeat. An unexpected obstruction pauses the car; Resume retries the
same location or Take the wheel lets the visitor navigate around it.

The full car footprint was checked at 0.5-metre intervals along all three
routes against the cached roads, buildings, terrain and water: 10,679 positions
with no blocked poses. Runtime collision checks remain active and prefetch
streets ahead. Tests also cover speed scaling, frame independence, pause,
collision stops, route continuity and destination completion.
