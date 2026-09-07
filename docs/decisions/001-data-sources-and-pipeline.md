# 001 — Where the city comes from

**Decision** — Build the model from three free sources: OpenStreetMap (buildings, roads, water, parks, coastline), City of Milwaukee open data (the official city boundary and river polygons), and the public "Terrain Tiles" elevation set on AWS. Read OpenStreetMap from a downloaded state-wide file rather than a live API.

**Why this came up** — A 3D city needs footprints for ~150,000 buildings, a shoreline, rivers, and ground heights. If any one source is wrong, misaligned, or not legally reusable, the whole miniature is either misleading or undeployable.

**Options**
- *Live OpenStreetMap API (Overpass).* Free, no download, but it rate-limits heavily. Our first attempt managed 9 of 99 map squares in 15 minutes and would have taken hours. Any rerun would hit the same wall.
- *Downloaded OpenStreetMap extract for Wisconsin (Geofabrik) read locally.* One 292 MB file, dated, reproducible, no rate limits. Costs a few minutes of local processing and a large cached file.
- *Commercial 3D building data (Google, Mapbox, Esri).* Better heights, but licenses forbid extracting and re-serving the geometry, and it costs money.

**What we chose and why** — The downloaded extract, plus the city's own boundary and river layers because they are authoritative and CC-BY, plus AWS terrain tiles because they are public and cover the lake bed too. Claude made the call after the live API stalled; Tarik set the constraint that sources must be legally usable.

**What we gave up** — Only about 1% of OpenStreetMap buildings in Milwaukee carry a recorded height or floor count. We recovered most of that by joining the city's property file (MPROP, which has a floor count per parcel) through the city's parcel outlines, but that only covers the city proper: buildings in the surrounding margin, and on parcels with no recorded count, still use estimates from building type and footprint size.

**How we'll know if this was right** — The stats file lists what share of heights are recorded versus estimated. If the recorded share stays above half of all buildings and downtown looks right against a photo of the skyline, the foundation held.

**What actually happened** —
