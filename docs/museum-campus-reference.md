# Milwaukee Art Museum campus reference

The model treats the lakefront campus as three connected architectural generations. Plan limits come from the cached OpenStreetMap extract in `data/museum_site.json`: Quadracci Pavilion 403894584, War Memorial Center 403895414, and Kahler Building 446874803. The extract establishes world axes (x east, z south), footprint limits, level counts, and the Quadracci alignment. It does not provide surveyed floor or roof elevations.

- **Quadracci Pavilion.** The existing detailed pavilion model remains positioned at the cached alignment anchor. Milwaukee Art Museum's architecture material identifies it as the 2001 Santiago Calatrava addition.
- **War Memorial Center.** The dedicated model follows Saarinen's 1952 second-floor plan in the Library of Congress: unequal west/east arms, shorter north/south arms, and circulation around a long north–south open court. This replaces the former four-box perimeter. The published 30-foot cantilever informs the inset piers; the model's outer envelope is approximately 63 × 64 m from the cached footprint. The Court of Honor sits on the museum pedestal, rather than at lakefront ground level. Sculpted, splayed piers carry the upper floors from that raised base.
- **West facade mosaic.** The War Memorial Center identifies the west-facade work as Edmund Lewandowski's mosaic mural. Five aligned panels and four narrow vertical window strips follow reference photographs. The colored treatment is interpretive, not a reproduction of the artwork. Panel dimensions are approximately 7.62 × 4.86 m. Published total-area figures conflict (1,800 ft² versus five 25 × 16 ft panels), so these dimensions should not be treated as a survey.
- **Kahler Building.** Milwaukee Art Museum's War Memorial Center architecture page describes the 1975 David Kahler addition and its relationship to Saarinen's building. The model uses the source footprint for the low lakeward volume, with an interpretive roof garden, skylights, and glazed connector seams.

Sources:

- Library of Congress, Saarinen second-floor plan: https://www.loc.gov/item/2008680857/
- Library of Congress, Balthazar Korab whole-building photograph: https://tile.loc.gov/storage-services/service/pnp/krb/00200/00265v.jpg
- War Memorial Center, Court of Honor and Eternal Flame: https://warmemorialcenter.org/honor-roll-eternal-flame-memorial/
- War Memorial Center, Lincoln Memorial Bridge: https://warmemorialcenter.org/lincoln-memorial-bridge/
- War Memorial Center, “Building Significance & History”: https://warmemorialcenter.org/building-significance-history/
- War Memorial Center, “West Facade Mosaic Mural”: https://warmemorialcenter.org/west-facade-mosaic-mural/
- Milwaukee Art Museum, “War Memorial Center”: https://mam.org/info/architecture/wmc/
- Local plan reference: `data/museum_site.json`

Detailed heights, court dimensions, pier placement, roof-garden layout, and connector proportions are visual approximations based on the source plan, footprint, and photographs. The memorial court is at 9.5 m in application coordinates; upper floors span 14.3–21.92 m. These are estimated model elevations, not surveyed floor levels. The terrain callback grounds the stone pedestal. The Quadracci entrance remains at the cached 10.7 m bridge alignment.

The mapped Mason Street bridge ends near world (563.6, -605.72). Its packed road surface was sampled at 8.4–8.5 m. A short supported entrance connection rises from this endpoint to the memorial's court datum. This is an interpretive pedestrian connection, not a replacement street alignment.

Day, sunset, and night modes update the memorial glazing, pool, and eternal flame with restrained emissive materials. These do not claim a measured lighting design. The new War Memorial Center destination uses 1× height for review; geometry tests check the open court, foundation and support contact, outward faces, finite bounds, and rendering budget. Run `npm run test:warmemorial` and `npm run test:museum` from `web/`.

## Supplied reference pack refinement — September 6, 2026

Reviewed the actual ten photographs, HABS image and six Yale PDF pages in the user's `milwaukee_war_memorial_threejs_reference_pack`. The pack's prose is a research aid, not a survey specification. Photos 01 and 06 show the west facade/bridge arrival; 09 and 10 show the court, tapered supports, narrow vertical window slots and substantial glazed projection. Several other numbered photographs mainly show nearby streets and towers. The HABS TIFF is an exterior photograph, despite the pack calling it a perspective drawing. Yale's 1954–55 sheets contain conceptual alternatives, not a complete current-condition floor plan.

The refinement adds broad, chamfered concrete blade piers in place of hourglass columns, physical depth to the west mural hood and balcony, recessed entrance glazing, court-facing slot windows, primary/secondary facade mullion hierarchy, side-wall ribs and slim roof rails. The west court glass volume now spans both upper storeys with a faceted underside; an open switchback stair occupies the opposite court edge. These follow the visible photographic forms, with estimated dimensions and placement. The earlier clear-water/open-court ray remains unobstructed.

The photo-derived model does not embed any source-image pixels. The original images/scans remain in the supplied folder. The mural remains a stylized treatment: its precise artwork, panel/window widths and facade coverage still need measured elevation data. The 63 × 64 m footprint and 9.5 m court datum remain existing placement estimates; conceptual sketches alone were not used to replace them. The former statement that the pool must be entirely open overhead has been narrowed to a clear water sample, since the real projecting stair volume sits over part of its edge.

## Additional PDF checked — September 7, 2026

The separately supplied `10016965.pdf` is byte-identical to the earlier pack's `drawings/wmc_12_yale_saarinen_sections_plans_sketches.pdf` (SHA-256 `3d53db05b93e5a87f6427f4b4cc07b26975cccdb246b9c9a95dffbaf7bdbf8c5`). All six pages were inspected again: the cover identifies Yale collection MS 593, box 180, folder 559, dated 1954–55; pages 2–3 show upper-level elevations and stair studies; page 4 shows the raised terrace and sloping stone base; page 5 is a building section with a graphic scale; page 6 is a gridded structural/plan study. The section's graphic scale supports relative design proportions, but does not establish current surveyed dimensions. The ruler and color patches at the bottom of the sheets calibrate the archival image, not the building. This duplicate adds no independent measured evidence requiring a geometry change. Original catalogue: https://collections.library.yale.edu/catalog/10016965.
