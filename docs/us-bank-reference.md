# U.S. Bank Center model

Implemented from the supplied `us_bank_center_threejs_reference_pack`, using its full-tower, lower-truss, crown, and owner aerial photographs. The model is an architectural interpretation rather than a surveyed reconstruction.

## Evidence and dimensions

- 42 stories and 601 feet (183.2 metres), consistent with the Wisconsin Historical Society, Encyclopedia of Milwaukee, and Hines references in the pack.
- The mapped shaft footprint is approximately 60.98 × 38.25 metres, with its original bearing retained. No taper or invented spire.
- White aluminum framing, dark glazing in four-pane groups, and three Warren diagonal bands distinguish the tower. The lower band meets the north Galleria roof; band positions and member thicknesses are photo-derived approximations.
- Six mapped Galleria/connector footprints retain the campus outline. Ground samples establish the higher Wisconsin Avenue entrance and the lower south-facing base. Repeated pyramid skylights follow the owner aerial reference.
- U.S. Bank signs occupy the short crown faces; Baird lettering occupies the broad faces, following the supplied signage references. The existing U.S. Bank asset is reused; Baird lettering is typeset. These are approximations of physical signs.

Reference links supplied with the pack: [Wisconsin Historical Society](https://www.wisconsinhistory.org/Records/Property/HI40639), [Encyclopedia of Milwaukee](https://emke.uwm.edu/entry/us-bank-center/), [Hines](https://www.hines.com/properties/u.s.-bank-center-milwaukee), [owner gallery](https://www.usbcmilwaukee.com/gallery).

## Integration and limits

The original single tall extrusion of the entire campus is removed by exact source-node and height matching: 169 triangles in the full tile and 37 in its LOD. Neighboring buildings and surviving geometry attributes are preserved. The detailed campus replaces both versions. The landmark camera approaches from the northeast lake side to avoid the Couture blocking the tower.

The shaft uses ten merged meshes. Galleria geometry uses four additional material batches. Sparse, deterministic office groups illuminate at sunset/night (about 11.3% of office groups); daytime restores unlit windows. Galleria light remains subdued.

Facade spacing, truss heights, roof equipment, skylight dimensions, and signage are photo interpretations. Glazing is simplified, with no detailed interior. Nearby Westin, 833 East, and parking structures are not incorporated into this building model.

## Review

The development review page is `/usbank-review.html`, using the production campus factory at 1× physical scale, with tower, Galleria, crown, and street camera angles plus three lighting modes.

- [Day elevation](review/us-bank-day.png)
- [Galleria and lower truss](review/us-bank-galleria.png)
- [Crown signs](review/us-bank-crown.png)
- [Night lighting](review/us-bank-night.png)
- [City placement at 1× height](review/us-bank-city.png)

Validation: ten U.S. Bank geometry/site/campus/passage tests and 29 driving tests pass. Production TypeScript/Vite build passes; the existing large-bundle advisory remains.

## Michigan Street correction

The Wisconsin Historical Society property record explicitly describes the Galleria extending over East Michigan Street (2017 survey). The first model incorrectly filled the `southRaisedGalleria` part from the ground to its floor; that solid plinth is now removed. An overhead slab and two perimeter rows of columns leave the street open. The southern Galleria roofs follow a shared elevation instead of stepping down with the road. Clearance is modeled at approximately five metres above the roadway, with member sizes and support spacing interpreted rather than surveyed; it is not a verified posted clearance.

Cached source ways 89802969 and 701108047 identify the missing street as `tunnel=building_passage`, `highway=primary`, asphalt, three lanes, one backward lane, embedded tram rails. Their exact world centerline is `(211.523998, -304.388107) → (218.041567, -304.974149) → (272.183769, -309.872578)`. The existing road importer omitted building passages along with tunnels. A scoped runtime surface now restores these two ways, meeting the cached approaches at shared endpoints and using the existing 9.6 m width and terrain + 0.4 m elevation convention. Existing streetcar geometry remains separate. Sidewalks and lane markings are interpreted within that mapped corridor.

The restored road and the Galleria's solid members explicitly opt into driving collision. No building-wide collision exemption is used. Tests sample all three lanes in both directions, check upward-facing pavement, and verify open overhead clearance throughout the crossing. The review page includes **Michigan Street** and **Passage overview** angles.

- [Street-level passage](review/us-bank-michigan-passage.png)
- [Passage overview](review/us-bank-michigan-overview.png)
