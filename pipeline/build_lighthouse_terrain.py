#!/usr/bin/env python3
"""Build the source-backed North Point Lighthouse terrain patch.

The ArcGIS export is locked to the best available 1 m 3DEP source raster.  The
GeoTIFF is sampled by the service onto a 5 m ground grid, then converted to the
compact terrain format consumed by web/src/loader.ts.
"""

from __future__ import annotations

import argparse
import json
import math
import struct
import tempfile
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import tifffile


ROOT = Path(__file__).resolve().parents[1]
SERVICE = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer"

LAT0 = 43.035
LON0 = -87.905
M_PER_DEG_LAT = 110_574.0
M_PER_DEG_LON = 81_367.90195302747
LAKE_DATUM_M = 176.5

X0 = 2450.0
X1 = 3070.0
NORTHING0 = 3090.0
NORTHING1 = 3690.0
STEP_M = 5.0
NX = int((X1 - X0) / STEP_M) + 1
NY = int((NORTHING1 - NORTHING0) / STEP_M) + 1

LIGHTHOUSE_LON = -87.8714176
LIGHTHOUSE_LAT = 43.0656749


def request_bytes(url: str, params: dict[str, object] | None = None) -> bytes:
    if params:
        url = f"{url}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": "mke3d-terrain-builder/1.0"})
    with urllib.request.urlopen(req, timeout=120) as response:
        return response.read()


def request_json(url: str, params: dict[str, object]) -> dict[str, object]:
    payload = json.loads(request_bytes(url, params))
    if "error" in payload:
        raise RuntimeError(f"ArcGIS request failed: {payload['error']}")
    return payload


def local_to_lonlat(x: float, northing: float) -> tuple[float, float]:
    return LON0 + x / M_PER_DEG_LON, LAT0 + northing / M_PER_DEG_LAT


def lonlat_to_web_mercator(lon: float, lat: float) -> tuple[float, float]:
    radius = 6_378_137.0
    mx = radius * math.radians(lon)
    my = radius * math.log(math.tan(math.pi / 4.0 + math.radians(lat) / 2.0))
    return mx, my


def export_bbox_3857() -> tuple[float, float, float, float]:
    # ArcGIS pixels represent areas.  Expand by half a ground cell so the TIFF
    # pixel centers coincide with the requested scene vertices.
    southwest = local_to_lonlat(X0 - STEP_M / 2.0, NORTHING0 - STEP_M / 2.0)
    northeast = local_to_lonlat(X1 + STEP_M / 2.0, NORTHING1 + STEP_M / 2.0)
    west, south = lonlat_to_web_mercator(*southwest)
    east, north = lonlat_to_web_mercator(*northeast)
    return west, south, east, north


def query_source_record() -> tuple[dict[str, object], dict[str, object]]:
    service_metadata = request_json(SERVICE, {"f": "json"})
    west, south = local_to_lonlat(X0, NORTHING0)
    east, north = local_to_lonlat(X1, NORTHING1)
    catalog = request_json(
        f"{SERVICE}/query",
        {
            "f": "json",
            "geometry": f"{west},{south},{east},{north}",
            "geometryType": "esriGeometryEnvelope",
            "inSR": 4326,
            "spatialRel": "esriSpatialRelIntersects",
            "where": "Category = 1",
            "outFields": "*",
            "returnGeometry": "false",
        },
    )
    records = [feature["attributes"] for feature in catalog.get("features", [])]
    primary = [
        record
        for record in records
        if record.get("Source") == "USGS"
        and record.get("VerticalDatum") == "North American Vertical Datum of 1988 (NAVD 88)"
        and "/Elevation/1m/" in str(record.get("URL", ""))
    ]
    if not primary:
        raise RuntimeError("No USGS 1 m NAVD 88 source raster covers the requested patch")
    # LowPS is the source pixel size exposed by this mosaic catalog.  Smaller is
    # more detailed; publication date breaks ties in favor of the latest source.
    primary.sort(key=lambda r: (float(r.get("LowPS") or math.inf), -int(r.get("pubdate") or 0)))
    return service_metadata, primary[0]


def download_export(source_id: int, destination: Path) -> tuple[dict[str, object], dict[str, object]]:
    bbox = export_bbox_3857()
    mosaic_rule = {
        "mosaicMethod": "esriMosaicLockRaster",
        "lockRasterIds": [source_id],
        "mosaicOperation": "MT_FIRST",
    }
    params: dict[str, object] = {
        "f": "json",
        "bbox": ",".join(f"{value:.6f}" for value in bbox),
        "bboxSR": 3857,
        "imageSR": 3857,
        "size": f"{NX},{NY}",
        "format": "tiff",
        "pixelType": "F32",
        "interpolation": "RSP_BilinearInterpolation",
        "adjustAspectRatio": "false",
        "mosaicRule": json.dumps(mosaic_rule, separators=(",", ":")),
    }
    export = request_json(f"{SERVICE}/exportImage", params)
    href = str(export.get("href", ""))
    if not href:
        raise RuntimeError(f"ArcGIS export returned no TIFF URL: {export}")
    destination.write_bytes(request_bytes(href))
    return export, params


def terrain_colors(heights: np.ndarray) -> np.ndarray:
    """Muted greens derived only from elevation and slope; geometry is unchanged."""
    gy, gx = np.gradient(heights.astype(np.float64), STEP_M, STEP_M)
    slope = np.hypot(gx, gy)
    colors = np.empty((*heights.shape, 3), dtype=np.float64)
    colors[:] = (69, 105, 72)
    colors[heights < 12.0] = (64, 103, 70)
    colors[heights < 5.0] = (74, 107, 75)
    colors[heights < 1.25] = (112, 120, 88)
    colors[heights > 25.0] = (77, 109, 75)
    shade = np.clip(1.0 - slope * 0.12, 0.76, 1.0)[..., None]
    return np.clip(colors * shade, 0, 255).astype(np.uint8)


def bilinear_sample(grid: np.ndarray, x: float, northing: float) -> float:
    fx = (x - X0) / STEP_M
    fy = (northing - NORTHING0) / STEP_M
    ix = min(max(int(math.floor(fx)), 0), NX - 2)
    iy = min(max(int(math.floor(fy)), 0), NY - 2)
    tx = min(max(fx - ix, 0.0), 1.0)
    ty = min(max(fy - iy, 0.0), 1.0)
    return float(
        grid[iy, ix] * (1 - tx) * (1 - ty)
        + grid[iy, ix + 1] * tx * (1 - ty)
        + grid[iy + 1, ix] * (1 - tx) * ty
        + grid[iy + 1, ix + 1] * tx * ty
    )


def build(source_tiff: Path | None, output: Path, metadata_path: Path) -> dict[str, object]:
    service_metadata, source = query_source_record()
    export: dict[str, object] | None = None
    request_params: dict[str, object] | None = None

    if source_tiff is None:
        with tempfile.TemporaryDirectory(prefix="mke3d-lighthouse-") as tmp_dir:
            tiff_path = Path(tmp_dir) / "lighthouse-3dep.tif"
            export, request_params = download_export(int(source["OBJECTID"]), tiff_path)
            source_values = tifffile.imread(tiff_path)
    else:
        source_values = tifffile.imread(source_tiff)

    if source_values.shape != (NY, NX):
        raise ValueError(f"expected TIFF shape {(NY, NX)}, got {source_values.shape}")
    if not np.issubdtype(source_values.dtype, np.floating):
        raise ValueError(f"expected floating-point elevation TIFF, got {source_values.dtype}")
    if not np.isfinite(source_values).all():
        raise ValueError("source TIFF contains non-finite elevation values")

    # GeoTIFF scanlines run north-to-south.  The terrain binary runs from the
    # southern y0 toward increasing northing, so reverse the row order.
    absolute_m = np.flipud(source_values).astype("<f4", copy=True)
    heights = (absolute_m - LAKE_DATUM_M).astype("<f4")
    colors = terrain_colors(heights)

    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("wb") as stream:
        stream.write(b"MKET")
        stream.write(struct.pack("<IIfff", NX, NY, X0, NORTHING0, STEP_M))
        stream.write(heights.tobytes(order="C"))
        stream.write(colors.tobytes(order="C"))

    lighthouse_x = (LIGHTHOUSE_LON - LON0) * M_PER_DEG_LON
    lighthouse_northing = (LIGHTHOUSE_LAT - LAT0) * M_PER_DEG_LAT
    east_low_x, east_low_northing = 2925.0, 3392.0
    samples = {
        "northPointLighthouse": {
            "lon": LIGHTHOUSE_LON,
            "lat": LIGHTHOUSE_LAT,
            "world": {"x": lighthouse_x, "z": -lighthouse_northing},
            "absoluteElevationM": bilinear_sample(absolute_m, lighthouse_x, lighthouse_northing),
            "heightAboveLakeDatumM": bilinear_sample(heights, lighthouse_x, lighthouse_northing),
        },
        "eastLowGround": {
            "world": {"x": east_low_x, "z": -east_low_northing},
            "absoluteElevationM": bilinear_sample(absolute_m, east_low_x, east_low_northing),
            "heightAboveLakeDatumM": bilinear_sample(heights, east_low_x, east_low_northing),
        },
    }
    west, south = local_to_lonlat(X0, NORTHING0)
    east, north = local_to_lonlat(X1, NORTHING1)
    metadata: dict[str, object] = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": {
            "agency": "U.S. Geological Survey",
            "program": "3D Elevation Program (3DEP)",
            "service": SERVICE,
            "serviceDescription": service_metadata.get("serviceDescription"),
            "servicePixelType": service_metadata.get("pixelType"),
            "catalogRecord": source,
            "nativeSourceResolutionM": float(source["LowPS"]),
            "verticalDatum": source["VerticalDatum"],
            "elevationUnit": "meter",
        },
        "export": {
            "request": request_params,
            "response": export,
            "note": "The response href is temporary; the catalog record URL is the stable source reference.",
            "resampling": "bilinear",
            "requestedGroundGridSpacingM": STEP_M,
            "webMercatorPixelSizeM": {
                "x": (export_bbox_3857()[2] - export_bbox_3857()[0]) / NX,
                "y": (export_bbox_3857()[3] - export_bbox_3857()[1]) / NY,
            },
        },
        "sceneProjection": {
            "origin": {"lat": LAT0, "lon": LON0},
            "mPerDegLat": M_PER_DEG_LAT,
            "mPerDegLon": M_PER_DEG_LON,
            "lakeDatumM": LAKE_DATUM_M,
        },
        "patch": {
            "binaryFormat": "MKET: magic[4], uint32 nx, uint32 ny, float32 x0, float32 y0, float32 step, float32 heights[nx*ny], uint8 rgb[nx*ny*3]; little-endian",
            "dimensions": {"nx": NX, "ny": NY},
            "worldBounds": {"xMin": X0, "xMax": X1, "zMin": -NORTHING1, "zMax": -NORTHING0},
            "northingBounds": {"yMin": NORTHING0, "yMax": NORTHING1},
            "geographicBounds": {"west": west, "south": south, "east": east, "north": north},
            "gridSpacingM": STEP_M,
            "rowOrder": "south-to-north (ascending northing; scene z decreases)",
            "heightReference": f"meters relative to project lake datum {LAKE_DATUM_M} m",
            "absoluteElevationRangeM": {"min": float(absolute_m.min()), "max": float(absolute_m.max())},
            "heightAboveLakeRangeM": {"min": float(heights.min()), "max": float(heights.max())},
            "finiteValues": int(np.isfinite(heights).sum()),
            "samples": samples,
            "output": str(output.relative_to(ROOT)),
            "byteLength": output.stat().st_size,
        },
        "limitations": [
            "The 5 m output grid is a bilinear resampling of the identified 1 m bare-earth DEM; it does not add detail beyond the source.",
            "The source is a bare-earth DEM, so buildings, trees, curbs, and other surface objects are intentionally absent.",
            "The source reports the hydro-flattened Lake Michigan surface near 176.7 m; the integration layer must reapply the project's mapped lake-bed mask below scene y=0.",
            "The project uses a local equirectangular scene projection; the ArcGIS export uses EPSG:3857 only as an aligned transport raster.",
        ],
    }
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n")
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-tiff", type=Path, help="Use an already-exported 125x121 float GeoTIFF")
    parser.add_argument("--output", type=Path, default=ROOT / "web/public/data/lighthouse-terrain.bin")
    parser.add_argument("--metadata", type=Path, default=ROOT / "data/lighthouse-terrain-source.json")
    args = parser.parse_args()
    metadata = build(args.source_tiff, args.output, args.metadata)
    patch = metadata["patch"]
    print(f"wrote {args.output}: {patch['dimensions']}, {patch['byteLength']} bytes")
    print(f"absolute range: {patch['absoluteElevationRangeM']}")
    print(f"above-lake range: {patch['heightAboveLakeRangeM']}")
    print(f"lighthouse sample: {patch['samples']['northPointLighthouse']}")


if __name__ == "__main__":
    main()
