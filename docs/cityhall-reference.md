# Milwaukee City Hall geometry reference

The model uses local metres with ground at `Y=0`; the long body runs north–south, south is `+Z`, and the clock tower is centered at `(0, 42)`. Placement should use world anchor `(-385.684, ground, -744.163)` and rotation `Y=+0.19128` radians. The tapered body runs approximately from `Z=-46` to `Z=+34`; its north end is about 32 m wide and its south neck is about 14 m wide.

Primary references:

- [City of Milwaukee, Basic Facts About City Hall](https://city.milwaukee.gov/BasicFacts) and its [history page](https://city.milwaukee.gov/cityclerk/MilwaukeeHistory?docid=166216): four 18-foot (5.486 m) clock faces; 40-foot (12.192 m) flagpole.
- [City of Milwaukee restoration brochure](https://city.milwaukee.gov/ImageLibrary/Groups/ccClerk/PDFs/CityHallRestorationBrochureWeb.pdf): eight occupied masonry floors, sandstone lower floors, pressed brick and terra cotta upper floors, two copper-roofed spires, and the four-face clock.
- [Library of Congress photograph, LC-DIG-highsm-40236](https://www.loc.gov/item/2016631054/): south tower massing, staged setbacks, corner pinnacles, steep roof and facade proportions. The catalog identifies the bell tower as 353 feet (107.594 m).

The model therefore puts the architectural tower roof at 107.594 m and the flagpole above it, for a nominal total of 119.786 m. Low-body widths, bay spacing and secondary roof heights are visual estimates from the cited photograph rather than survey dimensions. Geometry is intentionally simplified and merged by material for map-scale rendering.

## HABS photograph refinement, September 6, 2026

The user supplied the [Library of Congress HABS WI-254 gallery](https://www.loc.gov/resource/hhh.wi0021.photos/?st=gallery). Three photographs were inspected directly:

- [Photo 7, south tower top](https://www.loc.gov/resource/hhh.wi0021.photos/?sp=7): curved copper spire, open lantern, round corner pinnacles, clock pediments, dark dials with pale hands, and the open gallery below the clocks.
- [Photo 8, west roof area](https://www.loc.gov/resource/hhh.wi0021.photos/?sp=8): Flemish gables, layered cornices, window surrounds and the secondary roof lantern.
- [Photo 18, elevated south/west view](https://www.loc.gov/resource/hhh.wi0021.photos/?sp=18): tower-to-office proportions, vertically grouped tower windows and the round-arched entrance.

These are archival views, not evidence for current temporary signage, street furniture or surrounding development. No historical event signs or source-image pixels are reproduced.

The upper tower now has curved roof sections rather than a single cone, four clock pediments, arched bell recesses, gallery columns and balustrades, corner turrets, and an open crown lantern. Clock dials and hands are outside both the pediment and roof surfaces; the prior model placed them inside the tower. Ray tests verify their visibility from all four cardinal directions.

The office cornice is estimated at 36 m, with eight rows of windows and a 47 m ridge. Roof eaves follow the same piecewise taper as the walls, and exterior roof faces point upward. Repeated gables and a secondary north lantern restore the visible roof silhouette. The small entrance arch and detailed recesses remain surface representations rather than accessible interior spaces.

Clock diameter and nominal architectural height retain the earlier sourced values. All other dimensions, gable profiles and decorative features are approximations, not measured HABS drawings. Sculpture, exact tracery, atrium structure and material weathering are not modeled.

Verification: `npm run test:cityhall` from `web/` checks source replacement at both tile detail levels, finite/non-degenerate geometry, height bounds, roof coverage, clock visibility and the secondary roof silhouette. Review screenshots use 1× building height.
