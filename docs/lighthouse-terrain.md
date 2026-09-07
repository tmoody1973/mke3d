# North Point Lighthouse terrain patch

`web/public/data/lighthouse-terrain.bin` is a source-backed local terrain patch for the North Point Lighthouse scene. It covers the exact scene rectangle `x = 2450..3070` and `z = -3690..-3090`. Its `125 x 121` vertices are spaced 5 m apart. The binary's `y0` is northing `3090`; rows proceed south-to-north while scene `z` proceeds in the negative direction.

The elevation source is the official USGS 3D Elevation Program bare-earth ImageServer. A catalog query over the patch resolves the `WI_SEWRPC_2017` one-meter raster (`USGS_one_meter_x42y477_WI_SEWRPC_2017.tif`, object ID 126361). The source data uses NAVD 88 elevations in meters. Its lidar was acquired from March 24 through April 2, 2015, and the raster was published March 30, 2020. The build locks the ArcGIS mosaic to that record so it cannot silently select a coarser DEM.

The requested 5 m grid spacing is the output sampling interval, not the source resolution. ArcGIS bilinearly resamples the native 1 m bare-earth raster onto the requested grid. The request uses a half-cell-expanded EPSG:3857 envelope so output pixel centers correspond to the local scene vertices. Elevations are then converted to scene heights by subtracting the project's 176.5 m lake datum. No hills or elevation features are synthesized. Muted terrain colors are derived from the resulting height and slope arrays and do not alter geometry.

The 3DEP raster reports the hydro-flattened Lake Michigan surface near 176.7 m. The terrain integration must reapply the project's mapped lake mask and lower those vertices below scene `y = 0`, as the global terrain build does. The patch does not claim that synthetic lake bed as a surveyed 3DEP elevation.

The file starts with `MKET`, followed by little-endian `uint32 nx`, `uint32 ny`, `float32 x0`, `float32 y0`, and `float32 step`. It then contains `nx * ny` row-major float32 heights and `nx * ny * 3` RGB bytes. This matches `parseTerrain` in `web/src/loader.ts`.

Rebuild from the live USGS service:

```bash
python3 pipeline/build_lighthouse_terrain.py
```

To convert a previously exported float GeoTIFF without requesting another export (the script still refreshes the catalog metadata):

```bash
python3 pipeline/build_lighthouse_terrain.py --source-tiff /path/to/lighthouse-3dep.tif
```

The detailed service response, catalog fields, export parameters, coordinate constants, samples, ranges, and limitations are recorded in `data/lighthouse-terrain-source.json`. ArcGIS export URLs are temporary; the catalog record's USGS product URL is the stable source reference.

Runtime integration in `web/src/localTerrain.ts` removes the exact patch rectangle from the coarse city mesh, blends the patch perimeter over 40 m, and colors the actual terrain vertices using cached OSM grass/wood polygons. It lowers mapped lake-side vertices into an illustrative underwater bed; this rendering adjustment is separate from the unmodified USGS binary. Triangle-based elevation queries match the rendered terrain. Existing street triangles inside the patch are clipped out and replaced with mapped site roads; nearby building components move rigidly to the new ground so their roofs do not warp.

Validate the complete lighthouse scene from `web/` with `npm run test:lighthouse`. Review screenshots in `docs/review/lighthouse-day.png` and `lighthouse-night.png` show true 1× height. Individual trees, house details, road widths and bridge structure remain simplified; the source DEM dates to the 2015 lidar acquisition rather than a current ground survey.
