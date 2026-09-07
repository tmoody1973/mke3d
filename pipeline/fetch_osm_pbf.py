"""Extract Milwaukee-area OSM features from the Geofabrik Wisconsin extract (ODbL) using pyosmium.
Reproducible alternative to Overpass (which rate-limits). Run: .venv/bin/python fetch_osm_pbf.py [input.osm.pbf]
Faster path if osmium-tool is installed (brew install osmium-tool):
  osmium extract -b WEST,SOUTH,EAST,NORTH data/raw/wisconsin-latest.osm.pbf -o data/raw/milwaukee.osm.pbf
  .venv/bin/python fetch_osm_pbf.py data/raw/milwaukee.osm.pbf
Input : data/raw/wisconsin-latest.osm.pbf (download: https://download.geofabrik.de/north-america/us/wisconsin-latest.osm.pbf)
Output: data/raw/osm/pbf_extract.json with 'elements': areas (polygons with rings) and ways (linestrings), same tag dicts as Overpass."""
import json, time, sys, requests, osmium, osmium.filter
from config import RAW

PBF_URL = "https://download.geofabrik.de/north-america/us/wisconsin-latest.osm.pbf"
AREA_TAGS = {"building", "natural", "leisure", "landuse", "waterway"}
WAY_TAGS = {"highway", "natural", "waterway", "name"}
HIGHWAYS = {"motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link",
            "tertiary", "tertiary_link", "residential", "unclassified", "living_street", "service", "pedestrian", "footway", "cycleway", "path", "steps", "track"}

def wanted_area(tags):
    return ("building" in tags or tags.get("natural") in ("water", "wood") or tags.get("waterway") == "riverbank"
            or tags.get("leisure") in ("park", "golf_course", "nature_reserve", "pitch")
            or tags.get("landuse") in ("grass", "cemetery", "forest", "recreation_ground", "meadow"))

def wanted_way(tags):
    return tags.get("highway") in HIGHWAYS or tags.get("natural") == "coastline"

def in_bbox(lon, lat, b): return b["west"] <= lon <= b["east"] and b["south"] <= lat <= b["north"]

if __name__ == "__main__":
    bbox = json.load(open(RAW / "bbox.json")); pbf = RAW / "wisconsin-latest.osm.pbf"
    if len(sys.argv) > 1: pbf = __import__("pathlib").Path(sys.argv[1])   # optional: a pre-cut extract (see run_all.sh)
    if not pbf.exists():
        print("downloading", PBF_URL, flush=True)
        with requests.get(PBF_URL, stream=True, timeout=600) as r:
            r.raise_for_status()
            with open(pbf, "wb") as f:
                for chunk in r.iter_content(1 << 20): f.write(chunk)
    t0 = time.time(); els = []; n_area = n_way = 0
    # Pass 1: shoreline. Great Lakes are multipolygon relations in OSM; the extract only holds the member ways
    # inside our box, untagged. Collect their ids so pass 2 can emit them as natural=coastline lines.
    shore_ids = set()
    for r in osmium.FileProcessor(str(pbf), osmium.osm.RELATION):
        if r.tags.get("natural") == "water" and r.tags.get("name") in ("Lake Michigan",):
            shore_ids.update(m.ref for m in r.members if m.type == "w" and m.role == "outer")
    print("Lake Michigan shoreline member ways in box:", len(shore_ids), flush=True)
    fp = (osmium.FileProcessor(str(pbf)).with_locations().with_areas())
    for o in fp:
        if o.is_area():
            tags = dict(o.tags)
            if not wanted_area(tags): continue
            rings = []
            try:
                for outer in o.outer_rings():
                    oc = [(n.lon, n.lat) for n in outer if n.location.valid()]
                    if len(oc) < 4 or not any(in_bbox(x, y, bbox) for x, y in oc): continue
                    inner = [[(n.lon, n.lat) for n in i if n.location.valid()] for i in o.inner_rings(outer)]
                    rings.append({"outer": oc, "inner": [r for r in inner if len(r) >= 4]})
            except Exception: continue
            if not rings: continue
            els.append({"type": "area", "id": o.orig_id(), "from": "way" if o.from_way() else "relation", "tags": tags, "rings": rings}); n_area += 1
        elif o.is_way():
            tags = dict(o.tags)
            if o.id in shore_ids: tags = {"natural": "coastline", "source_relation": "Lake Michigan"}
            elif not wanted_way(tags): continue
            try: coords = [{"lon": n.lon, "lat": n.lat} for n in o.nodes if n.location.valid()]
            except Exception: continue
            if len(coords) < 2 or not any(in_bbox(c["lon"], c["lat"], bbox) for c in coords): continue
            els.append({"type": "way", "id": o.id, "tags": tags, "geometry": coords}); n_way += 1
    d = RAW / "osm"; d.mkdir(exist_ok=True)
    json.dump({"source": "Geofabrik wisconsin-latest.osm.pbf", "extracted": time.strftime("%Y-%m-%d"), "elements": els}, open(d / "pbf_extract.json", "w"))
    print(f"areas {n_area}, ways {n_way}, {time.time()-t0:.0f}s -> {d/'pbf_extract.json'}")
