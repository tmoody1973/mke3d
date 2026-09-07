# The Couture model

## Evidence and placement

The supplied `the_couture_threejs_reference_pack` controls the architecture. Commons photos 01/02/05 show the curved tower and floor bands; owner photos 10/11 show the finished pale rear crown and upper setback. Temporary construction hoists and unfinished rooftop framing were omitted. Files 07/08 show the streetcar concourse interior; file 12 is an apartment interior despite its exterior filename. No supplied photos are shipped or used as textures.

[Thornton Tomasetti's project description](https://www.thorntontomasetti.com/project/couture), checked September 6, 2026, identifies 47 stories, a 537-foot height measured from the top of foundations, and a streetcar connection through the podium above basement parking. This model uses an explicitly approximate 160 m visible ground-to-crown height rather than treating foundation height as surveyed above-grade height.

The cached OSM building parts provide tower center `(449.424,-247.259)`, rotated footprint bounds 30.798 × 43.058 m, and Y rotation 0.02339657675 radians. Local +X faces the lake. The floor is estimated at city Y 4.05 m. The east wing is taller than the west shoulder; the central mechanical spine is highest. Mapped parts distinguish 40/44/45 levels; the model uses 44 repeating glazed elevations and a separate mechanical crown.

## Site and transit

The old parent way 1300225285 extruded the entire complex—including the garage and concourse—to tower height. Source-specific replacement removes 85 full-detail and 22 LOD triangles, retaining all other buildings, roads, packed attributes and Michigan Street passage corrections.

The new podium follows six mapped parts: garage 1300225284, concourse roof 1403766299, western core 1403766300, east podium 1403766304 and terraces 1403766305/06. Three parking decks have open sides; the glazed podium has separate roof elevations and mullions. A roof slab and beams cover the concourse with open portals and low-intensity ceiling strips. The existing Hop rails and platforms remain the route authority.

Tests sample the actual bundled L-Line path and check a 2.9 m wide by 3.65 m high vehicle envelope under the new structure, as well as the north and south portal openings. These are scene clearance checks, not engineering certification. Podium floor heights, beams, glazing modules and landscaping are estimated from photos. The cached map does not contain a reliable pedestrian bridge alignment at this site, so this change does not invent a new bridge crossing.

## Rendering and integration

The tower uses seven merged meshes and about 33,000 triangles: bluegray curtain wall, pale floor bands, mullions, recessed balcony interiors, glass guards, stepped roofs and sparse apartment illumination. Adjacent panes share an apartment state with varied brightness. Day hides the lit panels; sunset and night illuminate only selected apartments. No light objects are added.

The Couture appears in landmark search, map labels and the geographic tour between U.S. Bank Center and the Art Museum. The saved 1× view faces the tower from the northeast to reveal its lower western crown. The campus participates in day/sunset/night and the existing height controls.

## Verification

`npm run test:couture` covers footprint/height, crown, actual balcony recesses, sparse lighting, triangle budget, source-specific replacement, both tile LODs and streetcar clearance. Additional Hop passage/follow and landmark-tour regression checks accompany the production build. Screenshots are stored in `docs/review/couture-*.png`.

The development-only `/couture-review.html` page provides lakefront, west, crown and transit-hall inspection angles at 1×, using the production model factory. Its flat surrounding ground is for geometry inspection; the city retains its own terrain, roads and animated streetcars. The page is not a production entry point.
