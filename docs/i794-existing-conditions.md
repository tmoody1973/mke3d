# I-794 / Summerfest existing-condition review

Reviewed September 7, 2026. The model represents the built elevated Lake Interchange and its public street connections. Construction closures are not a separate scene state.

## Evidence checked

- [WisDOT study overview](https://www.794lakeinterchange.wisconsindot.gov/about): the existing interchange has eight service ramps. The draft environmental impact statement is anticipated in late 2026; final design and construction depend on approval and funding.
- [Spring 2026 public materials](https://www.794lakeinterchange.wisconsindot.gov/public-meetings/spring-2026): removal, replacement and improvement alternatives are study options, not built layouts.
- [WisDOT bridge maintenance project](https://projects.511wi.gov/794bridges/full-project-overview/): eastbound maintenance in 2026 and westbound in 2027 involves bridge overlays, approach slabs, parapets and markings. It is separate from the interchange alternatives study.
- [City Lakefront Gateway project](https://city.milwaukee.gov/AreaPlans/Downtown/Milwaukee-Lakefront-Gateway-Project.htm): completed work includes ramp redesign, Lincoln Memorial Drive continuing to Chicago Street, and the Clybourn boulevard connection. The [street-network explanation](https://city.milwaukee.gov/AreaPlans/Downtown/Milwaukee-Lakefront-Gateway-Project/Street-and-Highway-Development.htm) identifies the Harbor Drive connections.
- User-supplied Google Earth views, `Screenshot 2026-09-07 at 2.29.27 PM.png` and `2.28.53 PM.png`: verify the two curved mainline decks, lower connecting ramps, long approaches toward Lincoln Memorial Drive, pale mainline pavement and low concrete barriers. Imagery capture date is not supplied; current official sources establish that the elevated layout remains the baseline.
- Pack `i794_summerfest_third_ward_roadway_threejs_system_pack`: all 94 freeway/trunk source ways match the existing cached OSM coordinate arrays. Pack coordinates use a different origin and Z north; the application uses Z south. The module's generic 7.5/9.5/13.5 m heights are not adopted as surveyed or source-matched elevations.

## Reference-pack corrections

The image called `i794_03_lake_interchange_aerial.jpg`, filed under `current_public_geometry`, is a redevelopment rendering with proposed towers and a landscaped replacement corridor. It is excluded from the current model despite that label. `i794_04_hoan_lakefront_ramp_context.jpg` depicts the southern Hoan/Port approach, not the northern Lake Interchange. It provides broader bridge context only. The first two aerials are useful for the existing Third Ward decks and ramps. Future-study boards and temporary closure maps are not used as the default roadway state.

No reference images are copied into the public site. Existing OSM attribution applies to derived route coordinates.

## Confirmed model fault

The prior terrain adapter classified individual ROAD triangles as ground when their heights were within 1 m of raw terrain + 0.4 m. Descending ramp profiles cross that threshold. Lowering only the triangles on one side of it introduced abrupt steps within continuous source ways:

| Source way | Scene X, Z | Unwanted lowering |
|---|---|---|
| 766550389 | 299.737, -13.972 | 3.375 m |
| 572477370 | 316.769, -12.375 | 3.002 m |
| 572477385 | 455.912, -52.146 | 2.440 m |

The mapped routes themselves were present. Shared-node continuity in the raw pipeline did not establish continuity after the runtime terrain correction. Validation must exercise the rendered adapter, including both road pavement and the separate HWAY markings.

## Visual review

The Summerfest review includes **Lake Interchange** (southeast view comparable to the supplied Google Earth screenshots), **Third Ward highway**, and **Ramp grades**. Existing **North road connections** and **Freeway connections** presets remain available. The northern custom mainline uses pale concrete paving and low barriers; tall harbor fencing remains confined to the harbor approach and crossing. Road elevation profiles and barrier/support dimensions remain visual estimates rather than surveyed highway engineering geometry.

## Correction and checks

The runtime now solves connected approach profiles from cached source nodes. Bridge/mainline endpoints retain their existing deck elevations; the actual ground-street ends join corrected terrain. Matching uses both a route's horizontal footprint and its raw elevation, so a ground road crossing beneath a bridge does not become part of that bridge. The same correction moves the separate HWAY pavement markings. A reproducible exporter, `pipeline/export_summerfest_ramps.py`, supplies the bounded 239-way source graph; 41 connected approach ways receive a changed profile.

The original cliff samples now change by approximately 0.10–0.16 m over 2 m of travel, rather than dropping several metres at a triangle boundary. Across 300 samples on the affected ramp continuations, the maximum difference between rendered pavement and the continuous profile is 0.122 m. The residual reflects quantized road geometry; exact elevations and grades remain estimates. Spatial buckets and a cached graph keep the adapter local. Street-light surface resampling retains the existing 1,920 fixtures without requiring placement changes.

Descending nonbridge freeway ramps also receive earth fill and concrete retaining walls along their mapped pavement footprint. The geometry is batched into two meshes, follows the corrected profile, and leaves bridge crossings and branch mouths open. Both the full city and the Summerfest review use the same geometry. Wall dimensions are visual estimates.

Validation: 25 Summerfest tests and 24 Hoan tests pass; TypeScript and the production build pass. Browser inspection covered the southeast Lake Interchange view and the close Ramp grades view, including the previously unsupported road edges. Tests check continuity, preserved bridge anchors, attached markings and clear crossings; they do not establish surveyed dimensional accuracy.
