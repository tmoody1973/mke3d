# Discovery World model references

## Source geometry and orientation

The model replaces the single Discovery World extrusion (OSM way 55205380) with its mapped component forms. `data/discovery_site.json` records the parent and 13 `building:part` ways recovered from the cached `data/raw/milwaukee.osm.pbf`. The previous area extractor omitted pure building parts, which explains why the scene only showed a generic silhouette.

The science wing is west, the circular Aqua/Pilot House volume is east, the low promenade joins them, and the newer event pavilion extends north. World axes remain x east and z south. The footprint is roughly 151 × 69 m overall, not including the surrounding public boardwalk. Source heights include 26 ft for the main glass/arc components, 38 ft for the upper round volume, and 16 ft for the promenade and north pavilion. Minimum levels converted to meters are estimates rather than surveyed elevations.

The shipped parent extrusion starts around −4.9 m because its terrain sample fell in the mapped lake. That value is unsuitable as the occupied ground-floor datum. The detailed model uses an estimated 2.5 m public-deck elevation and foundations/supports that reach the underlying terrain. The datum and boardwalk details remain interpretive; this work does not claim a surveyed bathymetry or structural pile layout.

## Architectural evidence

- [HGA project description and exterior photographs](https://hga.com/projects/discovery-world-at-pier-wisconsin/): low white-panel-and-glass volumes, recessed transparent base, circular aquarium with an open steel crown, and public boardwalk.
- [HGA waterfront elevation](https://hga.com/wp-content/uploads/2018/03/Discovery-World-at-Pier-Wisconsin-exterior-4.jpg): science wing and round pavilion relationship, panel courses, glazing recess and waterfront platform.
- [HGA circular facade at dusk](https://hga.com/wp-content/uploads/2018/03/Discovery-World-at-Pier-Wisconsin-exterior-1.jpg): separated white arc panels, vertical glass slots, crown spokes, balcony and curved amphitheater.
- [Discovery World venue descriptions](https://discoveryworld.org/rentals/): circular Pilot House with wraparound terrace, event pavilion, promenade and outdoor amphitheater.
- [Official building map](https://discoveryworld.org/wp-content/uploads/2025/12/2025_Winter_MapOnline_English.pdf): distinct Tech/Aqua volumes, connecting promenade, north pavilion and garage below the Tech wing.

Photographs are viewed as references; no source-image pixels are shipped as model textures. Source mapping determines horizontal placement. Small facade details, crown dimensions, panel joints, lighting and waterfront furnishings are visual approximations. The rendering does not imply current vessel berthing or reproduce interior exhibits.

## Verification

Run `npm run test:discovery` from `web/`. Geometry checks cover finite meshes, spatial relationships, outward surfaces, source-part coverage, support contact and reversible lighting. Tile checks cover both shipped levels of detail and preservation of unrelated building geometry. Review Discovery World at 1× height in day, sunset and night modes.

The final waterfront pass adds a 2.4 m timber promenade along the science wing's south edge and glass connector, overlapping the rotunda collar. A narrow foundation reaches the sampled bed beneath this apron. Its width is an interpretation, not a measured replacement for the complete pier/amphitheater. The final model has 34 merged meshes and 17,768 triangles; facade raycasts verify the white upper panels remain exposed above the recessed ground glazing.

## Supplied photo-pack refinement — September 7, 2026

Reviewed the eight images in the user's `discovery_world_threejs_reference_pack` as private architectural references. The aerial (`dw_03`) establishes the two photovoltaic roof fields and central service strip; the walkway (`dw_05`) and terrace detail (`dw_07`) establish the open sunshade, swept ribs, balcony floor and cable rails. The file named “blue balcony” shows pale painted structure under blue sky, so the canopy has not been painted blue. Photographic pixels are not included in the application.

Changes in this pass:

- Expanded the crown beyond the white rotunda shells, replaced shallow straight spokes with curved segmented ribs rooted at the terrace, and added spaced sunshade blades with visible gaps.
- Added the upper annular terrace slab, fine upper cable rails and railings around the exposed eastern boardwalk edge.
- Added two low photovoltaic fields, approximate module grids, a clear service strip, modest equipment and perimeter rails inside the mapped science-wing roof.
- Added vertical science-wing panel joints and adjusted the daytime glass color.

All 13 mapped building parts, their placement and source heights remain intact. Crown dimensions, panel counts, equipment and railing spacing are photo estimates. The full asymmetric amphitheater, projecting landing and harbor landscaping remain simplified; this pass does not claim that the complete waterfront has been reconstructed. Vessels and temporary graphics were not added as permanent geometry.

The model now contains 41 meshes and 33,932 triangles. `npm run test:discovery` passes 14 checks covering mapped footprints, independent rooftop bounds, open sunshade gaps, grounded supports, nondegenerate surfaces and reversible lighting. Production build passes. In-app reviews at 1× height are saved as `docs/review/discovery-world-pack-{day,sunset,night}.png`; these are application screenshots, not redistributed source photographs.
