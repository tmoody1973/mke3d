# Milwaukee street lighting

Street-light fixtures use the existing Day, Sunset and Night controls in the district, walking and driving views. Fixtures are unlit in daylight, softly illuminated at sunset, and brighter at night. The separate `street-lighting-review.html` page presents the five fixture families at physical scale.

## Reference and placement

The supplied pack's profiles inform five original models: an outreach LED road mast, a decorative heritage lantern, a low shielded riverwalk bollard, a taller stadium area mast, and a contemporary plaza fixture. The example coordinate strips in the pack are illustrative and are not used as real Milwaukee locations.

[Milwaukee DPW's street-lighting page](https://city.milwaukee.gov/dpw/Infrastructure/Programs/Street-Lighting) documents the city's LED conversion program. [GRAEF's Third Ward Riverwalk project](https://graef-usa.com/historic-third-ward-riverwalk/) provides pedestrian-scale riverwalk context. Fixture shapes and district assignments are visual interpretations, not a pole-by-pole equipment survey. Reference photographs are not shipped as textures.

Placement uses mapped street-light nodes from the project's OSM extract, supplemented along mapped roads and paths where coverage is sparse. Each record identifies its source. Building and water masks, intersection spacing, bridge/tunnel checks, and actual packed road/terrain elevations constrain placement. Existing landmark-campus lighting remains in place.

## Runtime and verification

Physical poles and luminous lenses are instanced by fixture family. Ground accents and nearby real lights make sunset and night visible without creating a separate dynamic light for every pole. A single shared pool is capped at six dynamic street lights on desktop and three on mobile, with shadows disabled. Selection follows the camera during walking, driving and map movement.

Validation checks fixture dimensions and lens visibility, grounded instance transforms, bounded light selection, daylight reset, disposal, source provenance, obstacle exclusions and placement elevations. Browser review checks appearance and actual street context separately from automated tests.
