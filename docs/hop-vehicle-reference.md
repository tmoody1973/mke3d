# The Hop vehicle reference review

Reference pack: `the_hop_streetcar_vehicle_threejs_reference_pack (1)`, supplied September 6, 2026. The included photos are visual evidence; their accompanying modeling suggestions are not a vehicle specification.

## Controlling views

- `hop_01_three_quarter_vehicle_profile_cc_by_sa_4.jpg`: rounded nose, wrapped windshield, roof cheek vents, original blue band and champagne lower panels.
- `hop_02_side_profile_street_running_cc_by_sa_4.jpg`: module proportions, two separate door bays in the center section and accordion joints. This car carries a different advertising wrap.
- `hop_09_station_platform_and_vehicle_cc_by_4.jpg`: cab mask, glazing border, low door thresholds and normal blue/champagne livery in service.
- `hop_10_omf_vehicle_detail_cc_by_sa_4.jpg`: roof fascia, side panes, open center door bays and concealed running gear.
- The file named `hop_05_front_nose_and_windshield_cc_by_sa_4.jpg` is actually a distant streetcar crossing a bridge. It is not the controlling close-up for the cab.

The existing approximately 67-foot (20.4 m) body envelope, 2.64 m width, section pivots, gauge and rail-contact origin remain the motion model's shared dimensions. The pack rounds length to 20.3 m; it does not provide dimensioned body or bogie drawings. Cab curvature, pane sizes, roof equipment and door spacing are photo-based approximations.

## Review method

Run the web development server and open `/hop-review.html`. This development-only page calls the same `createHopVehicle` factory as the city and presents 1× views for the cab, side, three-quarter and roof. Door and lighting controls permit checks without surrounding buildings hiding the vehicle. The page is not included in the production entry points.

The neutral blue/champagne livery represents the supplied photos, not every changing sponsor wrap. M-Line and L-Line labels share the same exterior colors. Reference photos are not bundled or used as textures.

The pantograph remains stowed for the existing off-wire preview: the city does not yet have mapped overhead-contact-wire coverage. Vehicle detail does not imply the addition of a complete overhead network or a changed route simulation.

## Result and checks

The revised vehicle has a raked, rounded cab with separate windshield and dark surround; white roof fascia and vents; individual side panes; blue/champagne livery; two paired sliding door bays per side with inset vestibules; lower skirting, wheel rims and wiper details. M/L route glyphs are separate from the body paint. Finished bounds are 20.416 × 2.640 × 3.505 m, with 8,504 triangles and 19 draw calls per car, and no added light objects.

All 34 Hop tests and seven tour tests pass, including two hours of timetable motion, visible glass/headlamp ray checks, independent paired door movement, recessed openings, physical bounds and both lines' shared paint. Production build passes with the existing large-bundle advisory. The review page was inspected in day, sunset and night modes. Matching-angle screenshots are `docs/review/hop-vehicle-before.png` and `hop-vehicle-after.png`; cab, open-door and night details are saved alongside them.

## Follow camera and playback controls — September 7, 2026

The Hop controls now offer **Aerial** and **Third person** camera views. The close view follows the track approximately 25 m behind the vehicle center and 7 m above the sampled track, with a small side offset. It retains the full 20.4 m vehicle in view, samples the preceding track through bends, wraps correctly at loop seams and extends behind open path starts. A nearby-geometry camera check shortens the view around cached building facades and bridge decks. Fine custom landmark geometry is not separately indexed for camera collision.

The existing director eases between the views. Near clipping is reduced while close following and restored when it ends. A floating control bar keeps the camera selector, playback rates and stop-follow action available throughout the ride; it stays synchronized with the sidebar controls.

Playback choices are **0.5×, 1×, 2× and 4×**, applied to the whole scheduled simulation before its existing fixed physics steps. Vehicle movement, dwell times and the preview clock advance together; changing rate does not jump the clock, recreate the vehicle or resume a paused preview. These are playback multipliers, not real-world streetcar speed settings. Both M-Line and L-Line ride tours use the chosen view and playback rate.

Validation: production build, 41 Hop tests and 7 existing tour tests pass. Tests include proportional clock/motion at 30/60 fps, pause and rate transitions, camera clearance at path starts, loop-seam continuity and exaggerated ground height. Browser checks cover third-person following, 2×/4× synchronization, changing speed while paused, and returning to aerial view.
