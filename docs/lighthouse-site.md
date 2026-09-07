# North Point Lighthouse site geometry

The lighthouse site replaces cached road triangles only inside local bounds `x = 2450…3070`, `z = -3690…-3090`. Its projection matches the city scene:

```text
x = (longitude + 87.905) × 81367.90195302747
z = (43.035 - latitude) × 110574
```

`pipeline/extract_lighthouse_site.py` streams `data/raw/osm/pbf_extract.json`, projects and clips every non-area OSM highway to those exact bounds, and writes `web/src/lighthouseSiteData.ts`. It also extracts clipped grass, natural wood, building footprints, and mapped pedestrian areas. Regenerate the module with:

```sh
python3 pipeline/extract_lighthouse_site.py --output web/src/lighthouseSiteData.ts
```

`buildLighthouseSite(groundAt)` turns the extracted centerlines into terrain-fitted ribbons. Ordinary roads and paths are densified to at most 1.5 metres between samples and placed at `groundAt - 0.3`, accounting for the terrain mesh's `-0.6` scene offset. Each side of a ribbon samples its own terrain height so pavement follows cross-slope as well as the centerline profile. Widths follow OSM highway class and lane count. Mapped `highway=steps` ways use 0.35 m tread intervals with vertical risers instead of smooth ramps. East Ravine Road (OSM 18989099) is classified as a paved park path because its tags prohibit motor vehicles, although its mapped geometry begins about 38 m north of this exact replacement ROI and is consequently clipped out. The mapped Wahl Avenue, lighthouse driveway, staircase paths, and North and South Lighthouse Ravine Trails are retained.

The south and north Lion Bridges use OSM ways 403385113 and 403666568. Each concrete deck follows its mapped plan alignment while its elevation interpolates between the two endpoint ground elevations plus 0.5 m. This keeps the deck level through the ravine instead of draping it onto the terrain. The geometry includes a restrained underside, straight railing posts, and small end piers; it does not invent arches or other undocumented structure. Nearby path elevations blend into the bridge endpoint elevation over eight metres.

Grass and woodland do not add surface meshes over the DEM. `lighthouseLandCoverAt(x, z)` returns the mapped cover so the terrain builder can color its own high-resolution vertices without intersecting overlays. The two small pedestrian plazas remain meshes subdivided to one-metre triangles and sampled from terrain. Trees are deterministic low-poly instances placed only inside OSM `natural=wood` polygons. Candidates within roads or building footprints are rejected, as are candidates in the lakeward sightline from the lighthouse. The cap is 480 trees. Individual tree locations, heights, and crown forms are illustrative; the polygons, roads, footprints, trail names, and bridge alignments carry the geographic evidence.

Primary geometry source: the cached Geofabrik-derived OpenStreetMap extract. Trail and Lion Bridge naming was cross-checked against the [Milwaukee County Lake Park map](https://county.milwaukee.gov/files/county/parks-department/Park-Maps/Lake1.pdf). The supplied aerial site photograph was used to check the open lawn around the keeper's house and tower, the wooded ravine edges, and the clear lakeward view. OSM centerlines do not survey pavement edges, and the renderer's class-based widths are approximations. No claim is made that individual trees or bridge structural details are surveyed conditions.
