# Milwaukee Public Market model

## References and scope

The primary architectural reference is [TKWA’s Milwaukee Public Market project](https://tkwa.com/milwaukee-public-market/), reviewed September 6, 2026. Its photographs establish the cream masonry, dark exposed steel, two-story glazing, projecting sun shades, shallow roof and large neon name above the west entrance. The page credits the project photography; no source photograph or logo pixels are included in the application.

The user subsequently supplied the exterior perspective drawing (`Screenshot 2026-09-06 at 2.34.21 PM.png`) and `MPM_800-11.jpg`. The built photograph takes precedence where the drawing differs: the north end of the west face is solid masonry, the upper west shades sit in four frames, and the south corner remains visibly glazed. The drawing clarifies the deep diagonal canopy braces, entrance transoms and open rails supporting the neon letters. Their dimensions remain visual estimates.

Useful matching views:

- [Elevated west/south view](https://tkwa.com/wp-content/uploads/MPM_800-11.jpg): sign orientation, upper west shades, entrance canopies, shallow roof and adjacent freeway.
- [Long street facade at dusk](https://tkwa.com/wp-content/uploads/MPM_800-4.jpg): masonry bay rhythm, continuous upper glazing, projecting pale louvers and steel brackets.
- [West entrance at night](https://tkwa.com/wp-content/uploads/MPM_800-9.jpg): red neon name and warm interior light.
- [Shade/brick detail](https://tkwa.com/wp-content/uploads/MPM_800-10.jpg): material hierarchy and steel support structure.

## Placement and replacement

The model uses the cached OpenStreetMap parent way **53160687**, preserving its complete footprint in world metres. Source metadata, footprints and original tile heights are recorded in `data/public_market_site.json`. The anchor is world **(-251.6, 5.6, -27.4)**, with Y rotation **0.06913312901304965 radians**. The floor datum and building heights are visual estimates, not surveyed elevations.

The old parent and ten attached canopy extrusions are removed by footprint-vertex and elevation signatures at both tile detail levels. The source data mixes `13` and `13 ft` canopy heights, producing conspicuously tall blocks. These are replaced with thin, supported entrance canopies on their source footprints. Adjacent standalone palapa **584794007**, shed **584794107**, roads and neighboring buildings are preserved.

## Modeled details and limits

The facade includes masonry piers with course joints, dark steel posts and glazing mullions, gray end/service panels, a shallow sloping roof with seams, individual rooftop shade blades, triangular brackets, west horizontal sun shades and street-level double doors. Foundation bottoms meet the terrain at each source corner. The west-facing red name is a typeset approximation of the neon lettering.

Glazing receives a restrained warm emission at sunset and night; the sign brightens independently. No additional point lights are added. Geometry is batched by material and detail group and checked against an 18,000-triangle budget. The sign spans the west roof edge on a full-width steel rack, and four photo-derived entrance shades supplement the mapped canopy footprints on the long street facade.

Plan alignment is source-derived. Roof height, facade bays, canopy elevations, glass appearance, neon typography and material colors are photo-based approximations. There is no interior vendor model or surveyed architectural reconstruction. Review at **1× building height** using the southwest destination view before comparing proportions with TKWA’s photographs.

## Verification

From `web/`: `npm run test:market`, `npm run test:tour`, and `npm run build`.

Market tests check exact footprint transformation, terrain contact, upward roof normals, thin canopies, finite non-degenerate geometry, restrained glazing lighting and removal of the source model at both detail levels while preserving unrelated vertices/colors. Browser screenshots in `docs/review/public-market-*.png` cover day, sunset and night at 1× height.
