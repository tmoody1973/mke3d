"""Fetch City of Milwaukee open data (CC-BY): city limits shapefile -> WGS84 GeoJSON,
and the Waterways polygon layer (rivers, ponds) from the city's ArcGIS server.
Writes data/raw/citylimit.geojson, data/raw/city_water.geojson, data/raw/bbox.json"""
import json, os, zipfile, io, requests, shapefile
from pyproj import CRS, Transformer
from shapely.geometry import shape, mapping, Polygon, MultiPolygon
from shapely.ops import transform, unary_union
from config import RAW, MARGIN_M, M_PER_DEG_LAT, M_PER_DEG_LON

CITYLIMIT_ZIP = "https://data.milwaukee.gov/dataset/61436830-335e-4039-b761-e1ab8e214d4b/resource/63751b20-b104-4d45-8ca9-7cae06ad8666/download/citylimit.zip"
WATER_LAYER = "https://milwaukeemaps.milwaukee.gov/arcgis/rest/services/reference/reference_map/MapServer/23/query"

def city_limits():
    d = RAW / "citylimit"
    if not (d / "citylimit.shp").exists():
        z = requests.get(CITYLIMIT_ZIP, timeout=120); z.raise_for_status()
        zipfile.ZipFile(io.BytesIO(z.content)).extractall(d)
    r = shapefile.Reader(str(d / "citylimit"))
    crs = CRS.from_wkt(open(d / "citylimit.prj").read())
    tf = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
    geoms = [transform(tf.transform, shape(s.__geo_interface__)) for s in r.shapes()]
    g = unary_union(geoms).buffer(0)
    json.dump({"type": "Feature", "properties": {"source": "City of Milwaukee Open Data, CC-BY", "crs_in": crs.name},
               "geometry": mapping(g)}, open(RAW / "citylimit.geojson", "w"))
    return g

def city_water():
    feats, offset = [], 0
    while True:
        p = {"where": "1=1", "outFields": "NAME,TYPE,ELEVATION", "outSR": "4326", "f": "geojson",
             "resultOffset": offset, "resultRecordCount": 500}
        j = requests.get(WATER_LAYER, params=p, timeout=120).json()
        feats += j.get("features", [])
        if not j.get("properties", {}).get("exceededTransferLimit") and len(j.get("features", [])) < 500: break
        offset += 500
    json.dump({"type": "FeatureCollection", "source": "City of Milwaukee Waterways layer (CC-BY)", "features": feats},
              open(RAW / "city_water.geojson", "w"))
    return feats

if __name__ == "__main__":
    g = city_limits()
    minx, miny, maxx, maxy = g.bounds
    dlat, dlon = MARGIN_M / M_PER_DEG_LAT, MARGIN_M / M_PER_DEG_LON
    bbox = {"south": round(miny - dlat, 4), "west": round(minx - dlon, 4),
            "north": round(maxy + dlat, 4), "east": round(maxx + dlon, 4)}
    json.dump(bbox, open(RAW / "bbox.json", "w"))
    print("city limits bounds (WGS84):", [round(v, 4) for v in g.bounds], "area km2:", round(g.area * M_PER_DEG_LAT * M_PER_DEG_LON / 1e6, 1))
    print("fetch bbox with margin:", bbox)
    w = city_water()
    print("city water polygons:", len(w))
