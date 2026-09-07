# Nature & Culture Museum of Wisconsin — future completed visualization

Implemented September 7, 2026. Open `http://127.0.0.1:5173/new-museum-review.html` for 1× comparison views, or select **Nature & Culture Museum of Wisconsin** in the main landmark menu. The landmark tour includes it after Fiserv Forum.

## Status and sources

This model represents the intended completed Nature & Culture Museum of Wisconsin, not its current construction state. The [museum's current FAQ](https://www.mpm.edu/wisconsin-wonders/faq) locates the project at the northeast corner of Sixth and McKinley, gives approximately 200,000 square feet, and anticipates opening in early 2027. The [official architecture gallery](https://www.mpm.edu/museum-survey) describes rounded geological forms, Cream City coloring, a northwest cafeteria/public garden, rooftop butterfly vivarium, and an adjoining garage. The [architect-team design announcement](https://www.kahlerslater.com/news/milwaukee-public-museum-reveals-design-for-new-museum-building) describes five stories and rounded concrete-and-glass forms. Its 2022 opening forecast is superseded by the current museum FAQ.

User-provided reference folder: `/Users/tarikmoody/Downloads/new_milwaukee_public_museum_threejs_references/`. Primary visual comparisons used the street-level and aerial renderings numbered 01, 02, 07 and 08. The image labeled `mpm_06_current_construction_aerial.jpg` depicts the same finished-design rendering as the aerial reference, so it was not treated as evidence of actual construction. Reference images are not bundled or used as model textures; all rendered geometry and materials are original.

## Site versus interpretation

`newMuseumSite.ts` records exact cached OSM construction parcel **way 713732739**, approximately 80 × 137 m, between Sixth, McKinley and Vliet. This is a land-use polygon, not a building footprint. The cached tiles have no museum BLDG placeholder, so adjacent buildings and the existing southeast/east garage are retained.

The principal museum mass is interpreted at **52 × 60 × 30.48 m**, centered in the southern part of that parcel at scene coordinates `(-1061.447, -1387)`, with a terrain datum of 7.664 m. The height is calibrated to the museum’s published 100-foot maximum; the horizontal dimensions and placement remain interpretations of the parcel and renderings, not surveyed construction dimensions. The low northern wing and garden are interpreted inside the same parcel. No new street alignments are invented.

## Model features

- Three rounded primary volumes in a triangular plan: tallest northwest, shorter southwest, and rear northeast, with varied roof heights and offset upper sections.
- Fine horizontal facade strata following the curved footprints, merged for efficient rendering.
- Ground-level openings cut into the wall geometry, with recessed glazing and mullions.
- Inset horizontal windows and a tall glazed entry canyon.
- Rooftop planters, solar arrays and a glazed roof element representing the butterfly/commons zone.
- North-side cafe wing, planted garden beds, benches, street trees and entry paving.
- Restrained glazing emission and three soft facade washes enabled for sunset/night; daytime lights are off.

Fine facade rhythms, glazing details, equipment, planting, interior forms and lighting placement remain interpretations of the renderings. The existing neighboring garage is context geometry, not a newly detailed garage model. Building-wide proportions are a simplified miniature and should not be presented as an as-built architectural model.

## Verification

`npm run test:newmuseum`: **16 tests pass** after the final orientation correction, covering finite/bounded geometry, the complete rotated/scalable envelope, northwest/southwest/northeast mass placement and roof hierarchy, recessed openings, Commons clearance and its single descending closure, sealed Sixth Street canyon edges, day/night behavior, parcel containment and preservation of adjacent geometry.

The production build passed during the earlier implementation; the final deployment checks are recorded with the publication work.

Browser checks at 1×: southwest corner, northwest aerial and night lighting. Saved views:

- [Daytime corner](review/new-museum-day.png)
- [Aerial](review/new-museum-aerial.png)
- [Night lighting](review/new-museum-night.png)

## Rendering-based correction, September 7

Additional primary research: [Ennead project](https://ennead.com/work/milwaukee-public-museum-future-museum/), [museum topping-off announcement](https://www.mpm.edu/node/28580), and [museum description of Stonecast façade panels](https://www.mpm.edu/press/press-releases/local-business-crafts-future-museums-exterior). The museum reports a five-story structure reaching 100 feet (30.48 m) and 670 varied sculpted precast exterior panels. These factual anchors supersede the earlier estimated 34 m model height.

The façade has been rebuilt as continuous rounded and outward-leaning surfaces, with relief strongest near corners and smoother central areas. Glazing and dark reveals are generated from the same surface openings as the stone; this removes the former full-perimeter dark belt and protruding rectangular window boxes. The upper western mass now steps back near the roof, with an asymmetric front scoop, blue entry feature, planted shoulder, and denser solar fields. The new McKinley camera permits pedestrian-height upward views.

Updated comparison targets are the supplied front elevation (`mpm_05`, whose filename says interior despite showing the exterior), oblique Sixth Street view (`mpm_04`), and completed-design aerial (`mpm_06`, not an actual construction photo). Exact precast shop-panel geometry, fine aggregate texture and interior exhibits are not reproduced. Historic saved review images above predate this revision; use the live review for the current model.

The June 2026 frontage photo further calibrates the tapered connector, asymmetric scoops, and smoother central precast areas. The current envelope is interpreted at 52 m east–west and 60 m north–south after rotating the entrance elevation onto Sixth Street; these are not surveyed dimensions. The glass connector is fitted to ray intersections with the actual stone surface at multiple heights, with embedded edge seals, rather than positioned as a fixed rectangle. The review and main landmark now use the future name Nature & Culture Museum of Wisconsin. Soft façade washes, blue entry light, and six warm perimeter streetlights activate in sunset/night; daylight switches them off.

## Final site orientation correction — September 7

The earlier frontage interpretation placed the central entrance canyon on McKinley and arranged the western masses incorrectly. This revision supersedes those descriptions. The finished model uses **−X for west / Sixth Street**, **+Z for south / McKinley Avenue**, and **−Z for north / the garden**. The authored entrance elevation is rotated onto Sixth Street before the complete geometry is fitted to the 52 × 60 × 30.48 m site envelope.

The supplied street-level and aerial references, [Ennead’s project page](https://ennead.com/work/milwaukee-public-museum-future-museum/), and the [museum’s captioned architecture gallery](https://www.mpm.edu/museum-survey) guide the interpretation. The landscape plan establishes the street/garden relationship; it is not a dimensioned façade drawing and does not establish current shop-panel dimensions.

| Position or side | Final modeled treatment |
| --- | --- |
| Northwest mass | Tallest rounded bluff, with a stepped upper roof. The Commons/cafeteria opening crosses the north face and northwest corner onto Sixth Street. Its head has a level run, then descends once to grade toward a solid entrance-side pier. The inset upper window turns the northwest corner but stops before that pier. |
| Southwest mass | Shorter bluff on Sixth and McKinley, separated from the northwest bluff by the tapered west-facing glass entrance canyon. Local scooped openings and upper windows leave substantial stone between them. The blue planetarium installation faces south toward McKinley; it represents glazed tiles and LEDs rather than clear entrance glass. |
| Northeast mass | Rear bluff east of the main mass, forming the third point of the triangular arrangement. Its limited ground glazing does not become a continuous glass skirt. The southeast quadrant remains open rather than gaining a fourth principal block. |
| West / Sixth Street | Two projecting stone masses flank the recessed entrance canyon. Curtain-wall edges follow the stone contours at sampled heights, with embedded seals, and the ground-level entrance remains glazed and unobstructed by the stone shell. |
| North / garden | The northwest Commons opening and northern garden relationship follow the oblique and aerial references. The rear volume is east of the tallest mass. Portions behind the other volumes are not fully documented. |
| South / McKinley and east | The blue south-facing feature and rounded southwest volume provide the McKinley frontage. A complete east elevation has not been confirmed, so hidden returns remain restrained interpretations. |

The principal masses are arranged northwest, southwest, and northeast rather than in a line. Tests use actual ray intersections in physical street directions to check this layout, roof hierarchy, recessed glazing, the level Commons head and single closure, solid piers, and the sealed Sixth Street canyon. Ground glass, stone cutouts, and soffits use matching contours. The rear solar field and terrace follow the rear mass.

Daytime city sun direction differs from the supplied architectural photograph, so the west façade may be shaded in the live model. Sunset/night architectural lights and perimeter streetlights remain active only in their respective modes. Saved review images above predate the final revision; use the current review page for comparison.

This is a procedural visualization calibrated to photographs and an interpreted site plan. It does not reproduce exact panel fabrication, surveyed dimensions, all concealed elevations, or as-built conditions. The orientation correction improves the relationship between the visible façades and the mapped streets; it does not make the model an exact architectural reconstruction.
