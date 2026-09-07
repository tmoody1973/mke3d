# Hoan Bridge photo-based refinement

Reference review: September 6, 2026. Source folder: `/Users/tarikmoody/Downloads/hoan_bridge_threejs_photo_references/`.

## Evidence used

The supplied side, underside and waterfront photographs establish the main correction: the yellow central arch springs well below the roadway from short concrete piers. Its crown rises above the deck, with yellow side-span framing returning to the approach structure. The previous mesh put the entire arch above the road and supported its ends with tall columns. A continuous deep concrete slab also hid the floor-beam and lateral-bracing system visible in the underside photographs.

The [rehabilitation engineer](https://mbakerintl.com/projects/daniel-hoan-bridge/) describes the tied arch and connected I-794 approach structures. [GRAEF](https://graef-usa.com/hoan-bridge-inspection-and-reconstruction/) describes the three-span system and girder/floor-beam framing. These support a coordinated three-span structure, not three independent above-road arches. Historical failure details are not used as present-day connection specifications.

| Supplied photo | Use |
| --- | --- |
| 01, side elevation | Arch spring/deck/crown relationship and approach framing |
| 03, underside | Longitudinal girders, floor beams, lateral bracing and pier bearings |
| 04 and 09, daylight waterfront | Yellow steel, blue-gray girder fascia, short main piers and shoreline context |
| 05, roadway | Median double-arm lamp poles, lane scale and outer safety fencing |
| 08, Signify night view | Blue arch/side-frame accents, warm vertical fixtures and discrete deck lights |

**Pack correction:** Photo 02 is labeled as an aerial/lighthouse view, but its pixels are identical to photo 01. Both SHA-256 hashes are `043c4f08206e609a24adb898dddd3036722904671b0454de52b6d4acf7c03fd0`. It provides no independent aerial evidence. Geographic placement must come from the cached mapping and separately checked site features.

Photographs remain external references. No source photographs or image textures are included in the application. Member thicknesses, exact pier profiles, fencing and pole spacing are visual estimates; the result is a miniature, not an engineering model.

## Geographic corrections

The generated `landmarks_geo.json` follows the longest merged **single carriageway**. Near the main span its x-coordinate is 501.60 m; the opposite carriageway, OSM way 123681034, is about 485.5 m. Their median is approximately 493.55 m. OSM bridge outline 698128024 is approximately 36 m wide. The harbor structure therefore needs an approximately 8 m westward center correction and a wider deck, blended back to the existing approach endpoints. This is a local correction; it does not certify every branch of the larger Lakefront Interchange.

The coarse elevation grid also contains the bridge deck as a ground feature. Original samples around the main piers reach 18–30 m, while neighboring riverfront ground is near lake level. Raised river-water vertices were generated from the same contaminated elevation. Both terrain and water need correction within the mapped harbor crossing, preserving horizontal shorelines. Local bank elevations remain estimates rather than surveyed levels.

## Implemented model and context

- Central arch: 182.88 m spring-to-spring, nominal spring elevation 12 m, roadway/deck datum 38 m and crown 61 m. The 23 m crown rise above the roadway and 84 m side spans are photo-based estimates. Short concrete piers stop at the arch bearings; yellow steel rises from there to the deck. The side spans have no extra intermediate concrete columns.
- The harbor deck is 36 m wide with an 8 m westward correction; both taper back over 60 m outside the framed crossing. Original network endpoints stay fixed. Six traffic lanes use approximately 3.66 m spacing in the widened section, with separate shoulder lines.
- A 0.65 m slab exposes blue-gray longitudinal girders, transverse floor beams and underside X bracing. Fencing, median barriers and upward-forking light poles follow the roadway photograph. Geometry is merged by material into eight structural meshes.
- Blue accents follow the full below/above-deck arch and side-span framing. Warm vertical accents continue onto the underdeck supports. Fixture halos are capped at eight pixels and are dimmer at sunset; no per-fixture scene lights are added.
- `hoanSite.ts` corrects 70 contaminated terrain cells and 141 water vertices. Water XZ coordinates remain unchanged; triangle samples across the central channel stay at water level. A feathered bridge-outline mask and bounded harbor polygon keep this local to the crossing.
- Surface-road correction moves 5,750 full-detail vertices and 376 LOD vertices only when their original height matches the source ground-road offset. Buildings and elevated road structures retain their original geometry.
- Four context meshes (2,484 triangles) add mapped northern and southern quay edges, a red northern waterfront railing, mooring bollards and a narrow grass verge. Shorelines use river relation 5900827; local quay elevations of 2.15 m and the 2.2 m bank cap are estimates. Industrial Jones Island is not turned into a public park.

## Validation

### Second structural detail pass

Photos 01 and 03 show open transverse steel frames with curved haunches at the rib connections. The second pass replaces the main-pier X braces and speculative side-panel diagonals with open frames, adds the receding lower transverse ties, and gives overhead ties curved ends in the arch-tangent plane. Suspension members are now paired round rods (estimated 0.09 m diameter, 0.46 m separation), with their light paths mounted just outside the rod faces. These sizes are visual approximations, not measured fabrication details.

Fine vertical fence infill follows photo 05. Structural materials now distinguish rough concrete/asphalt from painted steel using physically based roughness and modest metalness. Eight merged structural meshes are retained, as are all span dimensions, support stations and network endpoints.

The development-only `/hoan-review.html` uses the production model factory at 1× scale, with side, waterfront, underside and roadway camera presets. Its flat water/ground is explicitly a structural study backdrop, not the city terrain. Updated captures are `docs/review/hoan-structure-*.png`. The expanded 18-test Hoan suite includes geometry raycasts through the rod-pair gaps and open pier portals. Type checking and production build pass; the existing bundle-size advisory remains.

`npm run test:hoan` covers structural proportions, low main-pier bearings, deck continuity, width/alignment, clear spans, road markings, exposed LED mounting, terrain/water correction and preservation of unrelated tile geometry. The Hop and tour regression suites guard the shared scene integration. Day, sunset and night reference views are saved under `docs/review/hoan-photo-*.png` at 1× height. The existing production bundle-size advisory remains.

Remaining limits: the original approach network uses one simplified centerline rather than a complete reconstruction of every carriageway split. Bank levels, side-span dimensions, pier shapes and fine members remain visual estimates. The local correction is deliberately not represented as surveyed terrain or as a complete rebuild of the Lakefront Interchange.

## Additional city photo pack — September 7, 2026

Reviewed all six photographs in `milwaukee_threejs_photo_references/photos/hoan_bridge/`.

- **01, contemporary underside:** the concrete approach piers visible beyond the low arch springings have curved, outward-flaring legs and a narrow rounded opening at their base. This supplies a clear silhouette correction to the former straight-post bents.
- **02 and 06, historic construction:** these show the same scene at different crops/resolutions, rather than two independent views. They help explain the portal shape but do not establish present-day deck construction, temporary steelwork or exact dimensions.
- **03, actual aerial approach:** this depicts the Port interchange and southern Jones Island approaches, with separate carriageways, ramps, embankments and industrial context. It is not the central harbor arch or the northern Lakefront Interchange. Moving these ramps alongside the central arch would introduce a geographic error. Rebuilding that network requires aligned mapping, road connections and elevations beyond this bounded pier pass.
- **04 and 05, night:** the existing arch/backstay fixture paths remain consistent with these views. Photo 05 also corroborates the open, flared concrete approach-pier silhouette. Different photographed color programs do not establish one permanent lighting sequence.

The approach bents now use extruded concrete portals with curved legs, a rounded open central bay and six bearing seats that meet the underside girders. Their existing stations, terrain anchoring and deck alignment are preserved; the two short main arch springing piers remain unchanged. Portal thickness (3.2 m), head depth, curvature and base proportions are visual estimates, not fabrication dimensions. Very shallow terrain clearances use a short support rather than an inverted opening. The model still uses eight merged structural meshes and adds no scene lights.

`npm run test:hoan` passes all 19 checks. The added raycast check verifies open central bays, narrower feet, outward-flaring heads and retained support coverage, alongside the existing span, LED mounting, endpoint and terrain regressions.

## Northern carriageway and ramp connections

The broader `is_hoan()` pipeline filter omits both carriageways, while the landmark exporter retains only the longest merged line. That line follows the northbound route. This left the southbound approach chain absent, including actual ramp mouths approximately 72 m west of the replacement alignment. The Summerfest review additionally omitted the entire custom Hoan group.

The correction restores cached OSM southbound ways **123680910**, **99456188**, **99456186**, and the northern part of **123681034**, joining the latter into the modeled harbor approach. It does not restore the old terrain-relative road through the harbor or invent a road across the festival park. The separately modeled northbound approach must remain a single carriageway until the routes meet at the harbor structure.

At mapped connections, immutable asphalt heights come from the same raw-terrain pipeline profiles used to generate the adjacent ROAD/HWAY tiles. Sampling the corrected ground for these anchors would introduce a new vertical step. The northbound ramp **458568016** at scene coordinates **(-123.712, -119.674)** previously met a 17.692 m custom road at a 20.635 m source road: a 2.943 m mismatch. Interior profile anchors close that step. Heights between anchors, road structure details and support spacing remain visualization estimates, not surveyed engineering geometry.

The [City’s executed Lakefront Gateway plan](https://city.milwaukee.gov/AreaPlans/Downtown/Milwaukee-Lakefront-Gateway-Project/Street-and-Highway-Development.htm) confirms the intended street network; source OSM geometry provides the individual carriageway alignments. The plan documents the I-794 service ramps at Lincoln Memorial Drive / Harbor Drive, the southward Lincoln Memorial extension to Chicago Street, and Clybourn’s connection toward Discovery World.

Validation for this correction: 24 Hoan structure, lighting, site and approach tests pass. New regressions raycast all four restored southbound mouths and three northbound junctions against the shipped road tiles, check both edges of the z=930 m tie-in, verify upward asphalt faces and sample source-curve continuity. Five candidate piers at mapped road/path crossings are omitted. Browser checks cover the northern connections, Harbor Drive and the complete approach corridor; the production build passes.
