# BMO Tower — 790 North Water Street

Reviewed September 7, 2026. This is the 2020 tower at Water and Wells, distinct from the older bank building at 770 North Water and the Summerfest BMO Pavilion.

## Primary evidence

- [Kahler Slater project and built photographs](https://www.kahlerslater.com/expertise/office/bmo-tower-at-market-square): two-part glass massing, a tightly rounded corner responding to City Hall, metal/translucent parking screens, podium terraces and street retail. Photographs show crown signs on both north and west faces, the dark Wells Street parking screen, and glass wrapping down the Water Street corner.
- [Owner fact sheet](https://bmotower.com/wp-content/uploads/2020/06/Insert_Fact-Sheet.pdf): 25 stories, 328 feet (99.9744 m), eight parking levels, 653 parking stalls, 13 ft 4 in office slab spacing, five-foot planning module, and three garage doors from Broadway. The ground lobby has a 33 ft 3 in slab height; Broadway retail has a 19 ft 3 in slab height.
- [Owner 2025 brochure](https://bmotower.com/wp-content/uploads/2025/06/BMO-Tower-Brochure_LoRes.pdf): page 3 site and massing views locate Water Street plaza/lobby, Wells Street frontage and Broadway parking access. Page 4 typical office plan shows the angled west edge, rounded northwest corner and southwest step. The brochure's future pocket park is not treated as completed landscaping.

## Placement and interpretation

Cached OSM way 592527373 controls the full podium footprint. Its rotated rectangle is approximately 86.8 by 35.6 m, at scene center (-308.054, -644.236), with a 4.28-degree bearing. The typical office plate is smaller than the full base; the tower/podium setback is inferred from the owner plan and photographs. Exact setback, facade panel dimensions, roof equipment and terrace furniture are interpretive rather than surveyed.

The shipped terrain rises from approximately 5.3 m at Water Street to 9.0 m at Broadway. Entry thresholds and the foundation follow that change; the centroid terrain height is not used as a flat platform floating over Water Street. The legacy placeholder is removed by its exact source footprint and elevation signature at both detail levels. All other tile triangles, including the adjacent older bank sharing some footprint nodes, remain intact.

Authentic BMO artwork is reused from the existing `public/signs/bmo.svg` asset; see `public/signs/SOURCES.md`. Reference photographs and brochure pages are not republished as model textures.

The tower uses a white-letter variant of the same SVG paths to match the built crown signs. Model lighting is selective: occupied-window panels, entrance accents and logos brighten at sunset/night and reset in daylight. The exterior is approximately 40,766 triangles in 19 meshes. Eight tests cover source replacement at both LODs, preservation of the older bank, street datums, model bounds, recessed entrance doors, sign orientation and lighting reset. TypeScript and the production build pass. Browser review covered the City Hall corner, Water Street lobby, Broadway parking side and sunset appearance; tests do not establish surveyed accuracy.
