# Northwestern Mutual Tower and Commons

Reference review: September 6, 2026. User folder: `northwestern_mutual_tower_threejs_photo_references/`.

## Reference controls

The [architect's completed project](https://www.pickardchilton.com/work/northwestern-mutual-tower-and-commons) confirms a 32-story curved glass tower with a crisp prow, Commons, terraces, and a connection to the historic 1914 headquarters. The [facade contractor](https://www.permasteelisagroup.com/project/northwestern-mutual-tower-and-commons/) lists 169 m and 32 stories. The reference pack's supplier URL uses `/projects/`; the current indexed page uses `/project/`. Its live page presents a verification challenge, so the height is also cross-checked against [Skyscraper Center](https://www.skyscrapercenter.com/milwaukee/northwestern-mutual-tower/15755).

Photos 01, 02, 03, 06 and 10 control the completed silhouette, curtainwall and crown. Photo 05 controls the low Commons facade and framing. Photos 04, 07 and 08 are early visualizations; photo 09 also visibly appears to be a rendering, despite the pack labeling it a construction-period image. Photo 11 may depict the separate North Office renovation. These do not establish the finished tower geometry. All photos remain external visual references, with original model geometry and typeset signage rather than photo textures.

## Scope and confidence

The tower and Commons are separate assemblies. Plan placement comes from cached OSM geometry; detailed facade rhythm, crown shoulder, recesses and material choices are photographic estimates. Night occupancy is illustrative and deliberately sparse; it does not represent actual office occupancy. The crown name is original typesetting, not an exact recreation of the corporate emblem.

## Implemented geometry

The cached parent way 392821857 incorrectly raises the entire roughly 249 m-wide campus to a roof elevation of 182.249 m. Runtime removal now matches only that source extrusion's node/elevation signature: 391 full-detail triangles or 109 LOD triangles. Actual-tile tests preserve every unrelated position/color, including the historic headquarters and North Office.

Disjoint source building parts place the tower at local X 384.438, Z −553.421. Its mapped envelope is approximately 74.16 × 52.17 m; the curved southeast face and sharp eastern prow retain their real map alignment. The existing campus floor of 14.609 m is a source-model datum, not a surveyed level. Foundations extend down to the terrain sampler.

Tall parts retain their different heights and overhangs, scaled together to a 169 m top. The Commons uses its separate mapped footprints and levels, with the existing connector and rooftop equipment enclosures. Curtainwall framing, silver floor lines, crown screens and sparse grouped office lighting use original geometry. Low-frequency procedural sky colors provide local glass reflections that change with day/sunset/night; these are illustrative reflections, not a captured panorama of the actual surroundings.

The tower uses six merged meshes (about 39,300 triangles). The Commons adds five meshes, and the browser adds one typeset crown-name mesh. No per-window scene lights are created. The tower is selectable and included in the 18-stop landmark tour.

## Review

`npm run test:nm` passes ten tests covering source preservation, physical height, stepped parts, open overhangs, low Commons, foundations, finite geometry and lighting. `npm run build` passes TypeScript and production bundling; the existing bundle-size advisory remains. `/nm-review.html` is a development-only study using the production factory at 1× height, with lakefront, Commons, crown and street-level presets. City and detail screenshots are saved under `docs/review/nm-*.png`.
