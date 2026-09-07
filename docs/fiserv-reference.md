# Fiserv Forum exterior reference pass

September 7, 2026. Original procedural geometry, using the user's local
`milwaukee_threejs_photo_references/photos/fiserv_forum/` pack as visual evidence.
Photographs are not included in the runtime or used as textures.

## Evidence and interpretation

- Photos 01 and 02 establish the asymmetric roof, curved zinc-clad north side,
  east atrium, deep overhang and projecting Panorama Club.
- Photo 04 supplies the overall roof/atrium relationship, three curved glazing
  ribbons, restrained roof seams, orange name signage and warm lighting placement.
- Files 03 and 05 are interior atrium photographs despite their exterior-oriented
  filenames. They inform gallery/frame treatment, not exterior orientation.
- [Populous, project description](https://populous.com/showcases/fiserv-forum)
  identifies the zinc roof, glass atrium, Cream City-inspired masonry and club.
- [Mortenson, opening announcement](https://www.mortenson.com/news-insights/fiserv-forum-opens)
  gives the overall height as 128 feet (39.0144 m). The cached extrusion's
  26.5 m height is not retained for the new exterior.
- [Populous, fan experience](https://populous.com/article/four-keys-better-nba-fan-experience-fiserv-forum)
  describes the approximately 100-foot atrium. The modeled main glass field is
  29.3 m high, with the upper club and arch extending above it.

The site comes from cached OSM relation 10689047. Its minimum rotated rectangle
is approximately 205.933 m east–west by 125.678 m north–south, with +X local aligned
east using a Three.js Y bearing of -0.015631 radians. The public entrance faces
the east plaza. The exact mapped outer ring is retained for the foundation;
roof cross-sections, fine panels, columns, canopy sizes and glazing subdivisions
are photo estimates. No surveyed building parts were present in the cached data.
The arena bowl/interior, full event setup and surrounding district landscaping
are outside this exterior pass. The name sign uses the arena website’s vector wordmark with its exterior orange finish.

## Implementation and verification

`fiserv.ts` builds the curved roof and zinc flank separately from the recessed
atrium, club frame, cream masonry, south facade supports and entrance canopies.
Nine merged meshes plus one sign keep draw calls bounded. Day,
sunset and night switch emissive surfaces and selected concourse windows without
adding light objects per window. Lighting is an illustrative quiet-evening
setting rather than a recreation of a specific event photograph.

The source relation has seven inner rings. Their 36 nodes participate in roof
triangulation; matching only the outer ring left a white roof fragment crossing
the new atrium. `removeFiservPlaceholder` now checks all exact source nodes and
the cached base/roof pair. It removes 294 full-detail and 141 LOD triangles,
preserving other packed attributes, roads, plazas and neighboring buildings.
The foundation still uses only the outer ring. No broad bounding-box deletion.

`npm run test:fiserv` checks calibrated height, roof normals/raycasts, the curved
north flank, east entry placement, finite/nondegenerate geometry, draw budget,
lighting restoration and precise full/LOD removal. The full 180-test suite and
production build passed during integration; targeted checks and build passed
again after the inner-ring fix.

Visual review uses the production factory in `/fiserv-review.html` and the full
city at 1× height. The full-city artifact was rechecked after its removal fix.
Saved images in `docs/review/`: `fiserv-model-day.png`, `fiserv-south-day.png`,
`fiserv-model-sunset.png`, `fiserv-model-night.png`, and `fiserv-city-day.png`.
These are comparison captures, not claims of photogrammetric fidelity.

## Sign correction

Replaced the Arial canvas label with the arena-supplied SVG wordmark, preserving
its narrow letterforms and proportions. The sign is now 13 m wide, centered at
local Z=34 m / Y=29 m, mounted just outside the zinc facade. A continuous zinc
spandrel extends down to 27 m behind it. This keeps the lettering below the
curved soffit and separate from the Panorama Club frame. Explicit SVG dimensions
ensure WebKit can upload the artwork as a texture. Night emission is restrained.
`/fiserv-review.html` includes a Sign detail angle for checking the fit at 1×.

## Deer District and arena refinement — September 7, 2026

Reference input: the supplied `fiserv_forum_deer_district_detailed_threejs_pack`.
Actual photographs, especially OJB plaza/restaurant views 01/02/12 and the covered
passage view 07, take precedence over the pack's sometimes inaccurate filenames
and schematic layout. No reference photos are bundled as runtime textures.

The arena now has a shallow asymmetric cross-span roof fall, staggered panel
courses, transparent atrium glazing with galleries/mega-columns/circulation
silhouettes, recessed door vestibules and articulated south retail bays. The
39.0144 m crown and reviewed vector wordmark placement are preserved.

`deerDistrict.ts` supplies the public realm: terrain-draped patterned pavers,
bronze cross-bands, event lawn, three circular fountain grates/jets, tree beds,
planted seating edges, benches, cafe tables/parasols, entrance bollards, bike
hoops and slender paired-arm lighting. Paving follows DEM + 0.43 m to clear the
existing DEM + 0.4 m pedestrian ROAD ribbon; surfaces are subdivided to follow
local grade. Ground decorations do not cast self-shadow patterns. The Beer Garden
has a glazed steel canopy, hanging bulbs, picnic seating and a small wood stage.
The quiet-day configuration leaves a continuous central walking aisle open.

`deerDistrictBuildings.ts` models the two restaurant blocks and The Trade using
cached projected OSM footprints. Glazing and frame lines sit outside the solid
walls, including New Fashioned's angled plaza corner. Roofs follow the footprints;
restaurant floor heights, window divisions and terrace details are photographic
estimates. The north restaurant has three modeled storeys; the southern block
has two. The Trade has layered room bays, a podium and rooftop restaurant mass.
The public east-west passage is centered on Z=-1109.5; no slot is cut through
333 W. Juneau's footprint. The canopy replaces the mapped Beer Garden extrusion.

The four exact source building replacements were verified against actual tile
(-1, 0) binaries: 141 full-resolution and 52 LOD triangles removed, zero targeted
residuals and zero unrelated removals. Juneau/Highland roads and neighboring city
buildings remain in the existing tile system. Detailed hotel interiors,
restaurant tenancy/signage, crowds, temporary event infrastructure, the parking
skybridge and full eight-block district are not reconstructed by this pass.
The new public-realm props are visual assets, not driving collision objects.

Public realm: 16 batched/instanced meshes / approximately 33k triangles; restaurant/hotel
context: 5 merged meshes / approximately 10k triangles. Day/sunset/night change
lamp lenses and selected occupied bays, with no per-window or per-prop lights. One instanced set of soft light-pool decals
adds warm falloff on the paving; this is illustrative, not photometric lighting.

Verification: `npm run test:fiserv` includes both district suites (15 tests).
The review page has District, Plaza and Beer Garden viewpoints at 1× height,
and the full-city Fiserv destination frames the wider site.
