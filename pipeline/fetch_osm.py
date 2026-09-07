"""Fetch OSM data from Overpass in small chunks with disk cache + retries.
Run: .venv/bin/python fetch_osm.py     (safe to re-run; only missing chunks are fetched)
Output: data/raw/osm/chunk_{south}_{west}.json (raw Overpass JSON)."""
import json, time, sys, requests
from config import RAW, OSM_CHUNK_DEG

ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter",
             "https://overpass.private.coffee/api/interpreter"]
UA = {"User-Agent": "mke3d-pipeline/1.0 (https://github.com/tarikmoody; tarik@radiomilwaukee.org)"}

QUERY = """[out:json][timeout:180];
(
  way["building"]({s},{w},{n},{e});
  relation["building"]["type"="multipolygon"]({s},{w},{n},{e});
  way["highway"~"^(motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|residential|unclassified|living_street|service|pedestrian|footway|cycleway|path|steps|track)$"]({s},{w},{n},{e});
  way["natural"="water"]({s},{w},{n},{e});
  relation["natural"="water"]({s},{w},{n},{e});
  way["waterway"="riverbank"]({s},{w},{n},{e});
  way["natural"="coastline"]({s},{w},{n},{e});
  way["leisure"~"^(park|golf_course|nature_reserve|pitch)$"]({s},{w},{n},{e});
  way["landuse"~"^(grass|cemetery|forest|recreation_ground|meadow)$"]({s},{w},{n},{e});
  way["natural"="wood"]({s},{w},{n},{e});
  relation["leisure"="park"]({s},{w},{n},{e});
);
out geom;"""

def chunks(bbox):
    s0, w0 = bbox["south"], bbox["west"]
    lat = s0
    while lat < bbox["north"]:
        lon = w0
        while lon < bbox["east"]:
            yield (round(lat, 4), round(lon, 4), round(min(lat + OSM_CHUNK_DEG, bbox["north"]), 4),
                   round(min(lon + OSM_CHUNK_DEG, bbox["east"]), 4))
            lon += OSM_CHUNK_DEG
        lat += OSM_CHUNK_DEG

def fetch(s, w, n, e):
    q = QUERY.format(s=s, w=w, n=n, e=e)
    for attempt in range(6):
        ep = ENDPOINTS[attempt % len(ENDPOINTS)]
        try:
            r = requests.post(ep, data={"data": q}, headers=UA, timeout=240)
            if r.status_code == 200 and r.headers.get("content-type", "").startswith("application/json"):
                j = r.json()
                if "elements" in j: return j
            wait = 10 * (attempt + 1)
            print(f"  {ep.split('/')[2]} -> HTTP {r.status_code}; retry in {wait}s", flush=True)
        except Exception as ex:
            wait = 10 * (attempt + 1); print(f"  {ep.split('/')[2]} -> {type(ex).__name__}; retry in {wait}s", flush=True)
        time.sleep(wait)
    raise RuntimeError(f"Overpass failed for chunk {s},{w}")

if __name__ == "__main__":
    bbox = json.load(open(RAW / "bbox.json"))
    d = RAW / "osm"; d.mkdir(exist_ok=True)
    todo = list(chunks(bbox)); done = 0
    for (s, w, n, e) in todo:
        f = d / f"chunk_{s}_{w}.json"
        if f.exists(): done += 1; continue
        t = time.time(); j = fetch(s, w, n, e)
        json.dump(j, open(f, "w"))
        done += 1
        print(f"[{done}/{len(todo)}] chunk {s},{w}: {len(j['elements'])} elements in {time.time()-t:.1f}s", flush=True)
        time.sleep(1.5)
    print("OSM fetch complete:", len(todo), "chunks")
