# Milwaukee Art Museum lakefront context

The lakefront context connects the museum campus to the bluff, Reiman Bridge, north parking, and lakeside walk. Its plan geometry comes from the cached OpenStreetMap extraction in `web/src/campusContextData.ts`. Museum Center Park is OSM way 55206404. The source maps it as a park rather than a building, so the parking structure beneath it does not appear in ordinary building-footprint geometry.

The model keeps the mapped raised park polygon, pedestrian paths, and lawn patches. It places the park deck at a shared, inferred 10.7 m scene elevation with the west landing of Reiman Bridge (the landing’s plan position is mapped; its elevation is not surveyed). The two open parking floors, columns, fascia, railings, stairs, stall markings, parked cars, lamps, and trees are interpretive context derived from the supplied aerial and street-level references. They are intended to convey the site's structure and scale; their counts, dimensions, and exact placements are not surveyed.

The north surface parking lot follows the visible extent in the supplied aerial reference. The lake promenade follows the campus edge, while source paths crossing Museum Center Park are lifted to its roof rather than left at underlying terrain elevation.

Sources:

- Milwaukee Art Museum, “Directions & Parking”: https://mam.org/visit/directions-and-parking/
- OpenStreetMap way 55206404 and nearby paths and lawns, cached in `web/src/campusContextData.ts` on 2026-09-06
- Supplied aerial and street-level reference images

Run `npm run test:museum` from `web/` to verify the context's geometry budget, finite merged buffers, open garage bays, and the shared park-deck/Reiman Bridge landing elevation.

## September 7 landscape references

The supplied Google Earth views at 2:32–2:40 PM distinguish three landscape levels: the elevated Museum Center Park garage roof; the lower museum forecourt and Cudahy Gardens; and the wooded bluff west of Lincoln Memorial Drive. The Mason Street vehicle bridge and Reiman pedestrian bridge cross above the lower roadway. Their surroundings must not be flattened into one park platform.

The [Museum's Cudahy Gardens description](https://mam.org/visit/cudahy-gardens/) identifies a formal garden approximately 600 by 100 feet, five lawn compartments separated by hedges, fountain plazas at its ends, and a connecting water channel. It also identifies linden and crabapple plantings. This establishes the garden's organization; the supplied aerials and cached OSM polygons control placement in the model. Individual tree positions, canopy sizes and hedge dimensions are interpretive.

The new [Art Museum review](https://mke3d.vercel.app/museum-review.html) includes campus, north green corridor, Mason Street bridge, garden and street-level views for comparison with those references.

`museumLandscape.ts` fills approximately 23,456 square metres of omitted mapped grass and woodland ground, adds 196 trees, and supplies four transverse garden paths with hedge dividers. Source lawn/wood polygons are unioned, then existing campus lawn footprints and buffered roads/paths are subtracted before triangulation. This prevents the triangular holes produced by rejecting entire triangles at path edges. Planting is denser in woodland than on open lawns, and includes the west bluff patch. Individual plant positions remain estimates.

Existing ground lawn triangles in `lakefrontContext.ts` are subdivided before sampling terrain, so their interiors follow the bluff instead of disappearing below it. The raised garage-roof lawn retains its level datum. The 17 museum tests pass, including a check of 19,732 existing ground-lawn triangle interiors against the actual terrain, new-lawn coverage, road/path clearance and the bridge landing. Browser review covered the north green corridor and formal gardens; TypeScript and the production build passed.

### Raised park planting
Additional trees and low shrubs follow the mapped grass footprints on Museum Center Park and adjacent western lawns. The supplied Google Earth aerials (2:34:43 PM and 2:40:22 PM) guide the planted lawn margins and open central lawns. Individual species, counts, and dimensions are interpretive, not surveyed. Roof planting starts at 10.89 m in model coordinates; ground planting samples local terrain. The Reiman Bridge landing remains clear.
