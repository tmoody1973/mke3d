# Summerfest grounds / Henry Maier Festival Park

Implemented September 7, 2026 using the user-provided `summerfest_grounds_detailed_threejs_reference_pack` and the project's cached September 6 Geofabrik OpenStreetMap extract. Review at `/summerfest-review.html` with dedicated campus, pavilion, Harbor Drive, north road connections, and Erie Street 1×-height camera presets and Day / Sunset / Night controls.

## Evidence and interpretation

- The park boundary is OSM relation **8154902**, reconstructed from its 12 outer member ways. Scene coordinates use the existing manifest projection (X east, Z south).
- `summerfestSiteData.ts` contains **80 mapped building footprints, 71 public path segments, 43 green/public-space polygons**. Exact source nodes include inner courtyard rings, required to completely replace the amphitheater's old extrusion.
- Source anchors: amphitheater relation **6019180**; BMO **385057703**; Uline **385057702**; T-Mobile **597941287**; Aurora **385065526**; South Pavilion **385057705** (older OSM name JoJo's Martini Lounge). Miller, Generac and Briggs venue extents are ways **385065531**, **385065525**, **385065520**, with stage-building anchors **385065537**, **385065538**, **385065543**.
- Venue-roof proportions, heights and orientations are interpreted from footprints and photos, not measured architectural drawings. Amphitheater audience faces southwest; BMO opens toward the west. The highway-backed central stages face generally east. Aurora Pavilion faces west into the grounds, with its stage back to the water on the east; its local roof dimensions are exchanged when rotated to preserve the mapped east–west footprint.
- The supplied aerials include older imagery and architectural renderings. Current venue close-ups guide roof forms: permanent faceted amphitheater fan, three overlapping BMO wave roofs, open white Aurora and South Pavilion structures, orange Generac portal, angular white T-Mobile facade, and warmer shed roofs at Uline/Briggs.
- Detailed service-building facades, trees, benches, playground equipment, string lights, and performance equipment are representative. Not every temporary vendor or event installation is reproduced. No reference photographs are shipped as model textures.

## Lighting and terrain

Day extinguishes the concert lights and all added emissive illumination. Sunset uses reduced warm path/counter lighting and stage washes; night increases these locally. Each venue has one nonshadow spotlight. Walkway pools share one instanced draw instead of introducing dozens of dynamic lights. Abstract LED graphics are original geometry; this is a festival-lighting interpretation, not a particular programmed show.

The coarse DEM contains building and bridge returns. Terrain inside the park is blended toward an estimated 2.2 m apron with a 12 m boundary transition. A separate corridor follows the mapped freeway and Harbor exit centerlines to remove bridge returns beneath those structures, with a 40 m core and 45 m feather; the northern approach blends toward a 3.7 m grade. These are visualization grades, not survey elevations. The approach treatment only lowers high ground, excludes the harbor water, and preserves terrain outside the explicit correction footprint. Ground-road surfaces follow this corrected terrain while elevated ROAD decks and HWAY structures remain unchanged. Building replacement uses exact source nodes/elevations, including courtyard edges, rather than deleting an entire rectangular area.

## Verification

`npm run test:summerfest`: nine venue placements; finite/bounded batched geometry; day/sunset/night behavior; terrain immutability and boundary confinement; packed source replacement; complete old amphitheater roof removal; preservation of highways, neighboring city buildings and an unrelated shell within the grounds. Production TypeScript/Vite build and visual checks at natural height.

## Public sources

- [Summerfest stages](https://www.summerfest.com/stages/)
- [Official visitor information and current grounds map](https://www.summerfest.com/about/)
- [Generac Power Stage](https://www.summerfest.com/generac-stage/)
- [Milwaukee World Festival venues](https://www.milwaukeeworldfestival.com/event-planning/venues/) (reference pack extract; direct fetch returned 403 during implementation)
- [OSM festival park relation](https://www.openstreetmap.org/relation/8154902)

## Aurora Pavilion close-up revision

The four additional user-supplied photographs (`raSmith-The-Aurora-Pavilion-1.jpg`, Laguna `N23` and `N17`, and `aurora-headliners800x500.jpg`) guide the dedicated `auroraPavilion.ts` model: two overlapping barrel roof sections, corrugated blue-gray metal, deep white triangular space framing, branching perimeter supports, a separate low stage canopy, corrugated stage enclosures, blue-roofed entrance concession wings and a navy digital sign tower. Seating now sits on a level floor under the roof, with an open entry passage and the mixing position behind the rows.

The mapped 65 × 35 m roof footprint and east-facing stage back are preserved. The 12 m stage depth, roof elevations, concession dimensions and seating arrangement remain photo-based approximations; these photos do not provide a measured plan or definitive seat count. Lettering is original typesetting; no reference photo is used as a texture. Review the entrance and “Under the pavilion” views at 1×, including sunset/night illumination.


## Roads and approach correction

The September 7 road review used the [City of Milwaukee Lakefront Gateway completed-project summary](https://city.milwaukee.gov/AreaPlans/Downtown/Milwaukee-Lakefront-Gateway-Project.htm), the [official 2026 festival map](https://s3.summerfest.com/assets/images/maps/SF26_GroundsMap-Layered_050426.jpg), the supplied aerial context, and the cached OpenStreetMap street geometry. The City confirms the Lincoln Memorial Drive connection to Chicago Street, the Clybourn boulevard/extension, and the Harbor Drive pedestrian/bicycle plaza near the mid-gate. The festival map distinguishes the north, mid, and south gate approaches. These sources guide the separation of surface streets, pedestrian connections, and elevated freeway ramps; temporary event traffic controls are not modeled as permanent road changes.

The previous festival adapter incorrectly treated every `ROAD` surface as ground-level pavement. Elevated freeway decks also live in that section; `HWAY` contains their supporting details. The revised adapter identifies ground-level triangles against the untouched source terrain, preserves elevated decks, and fits corrected pavement to the terrain grid and its diagonals. It retains the mapped horizontal alignments and widths. The standalone review now loads the southwest neighboring tile as well, avoiding abruptly cropped street context, and shares the main city's road/terrain adapters.

The road review presets provide closer checks of Harbor Drive, the north connections, and Erie Street instead of relying only on a campus aerial. Geometry tests check actual shipped road tiles, elevated-road preservation, terrain clearance, and repeat application. These checks establish geometric consistency; this remains an interpreted model, not a surveyed road design.

The corrected road surfaces also drive the street-light generator's final height pass: 58 nearby fixture/pool anchors were resampled and one invalid shoreline node omitted. The main model and the standalone review use the same terrain inputs and road fitting logic.


## Animated Skyglider

The campus includes an animated two-lane Skyglider following cached OSM way 597941283, with low terminal turns and 94 colorful open double chairs. Review placement, photographic evidence, dated chair count, and estimated height in [skyglider-reference.md](skyglider-reference.md). The Skyglider route and terminal camera presets include pause/play; it also animates in the main city and respects reduced-motion preferences. Procedural tree placement leaves the cable corridor clear without removing mapped buildings.
