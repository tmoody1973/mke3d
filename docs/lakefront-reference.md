# Milwaukee Art Museum lakefront context

The lakefront context connects the museum campus to the bluff, Reiman Bridge, north parking, and lakeside walk. Its plan geometry comes from the cached OpenStreetMap extraction in `web/src/campusContextData.ts`. Museum Center Park is OSM way 55206404. The source maps it as a park rather than a building, so the parking structure beneath it does not appear in ordinary building-footprint geometry.

The model keeps the mapped raised park polygon, pedestrian paths, and lawn patches. It places the park deck at a shared, inferred 10.7 m scene elevation with the west landing of Reiman Bridge (the landing’s plan position is mapped; its elevation is not surveyed). The two open parking floors, columns, fascia, railings, stairs, stall markings, parked cars, lamps, and trees are interpretive context derived from the supplied aerial and street-level references. They are intended to convey the site's structure and scale; their counts, dimensions, and exact placements are not surveyed.

The north surface parking lot follows the visible extent in the supplied aerial reference. The lake promenade follows the campus edge, while source paths crossing Museum Center Park are lifted to its roof rather than left at underlying terrain elevation.

Sources:

- Milwaukee Art Museum, “Directions & Parking”: https://mam.org/visit/directions-and-parking/
- OpenStreetMap way 55206404 and nearby paths and lawns, cached in `web/src/campusContextData.ts` on 2026-09-06
- Supplied aerial and street-level reference images

Run `npm run test:museum` from `web/` to verify the context's geometry budget, finite merged buffers, open garage bays, and the shared park-deck/Reiman Bridge landing elevation.
