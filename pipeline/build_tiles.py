"""Build viewer tiles from cached raw data. Run after fetch_city.py, fetch_terrain.py, fetch_osm.py.
Outputs to web/public/data/: manifest.json, terrain.bin, water.bin, tiles/t_{i}_{j}.bin (+ .lod.bin), stats.json"""
import json, struct, hashlib, time, datetime, numpy as np
from collections import Counter, defaultdict
from shapely.geometry import shape, Polygon, MultiPolygon, LineString, Point, box
from shapely.ops import unary_union, linemerge, polygonize
from shapely.prepared import prep
from config import (RAW, OUT, TILE_M, LAKE_DATUM_M, LANDMARK_PLINTH, LAT0, LON0, M_PER_DEG_LAT, M_PER_DEG_LON,
                    TERRAIN_STEP_M)
import geometry as G
from mprop import ParcelStories
from roads import build_roads
SMALL_TYPES = {"garage", "garages", "shed", "roof", "carport", "hut", "greenhouse", "service"}

# ---- palette (Cream City brick identity) ----
COL_LOW, COL_MID, COL_TALL, COL_TOWER = (232, 220, 195), (217, 199, 165), (183, 179, 170), (127, 141, 163)
COL_LANDMARK = (201, 135, 59)
COL_ROAD, COL_ROAD_MAJOR = (186, 179, 166), (172, 164, 149)
COL_LAND, COL_LAND_OUT, COL_GREEN, COL_SHORE = (239, 233, 220), (226, 221, 210), (185, 201, 163), (222, 214, 190)

def bcolor(h, key):
    base = COL_LOW if h < 8 else COL_MID if h < 30 else COL_TALL if h < 90 else COL_TOWER
    v = (int(hashlib.md5(str(key).encode()).hexdigest()[:2], 16) / 255 - 0.5) * 0.12   # ±6% variation
    c = tuple(max(0, min(255, int(x * (1 + v)))) for x in base)
    roof = tuple(min(255, int(x * 1.06)) for x in c)
    return c, roof

# ---- terrain sampler ----
T = np.load(RAW / "terrain.npz"); GRID, XS, YS = T["grid"].astype(np.float64), T["xs"], T["ys"]
X0, Y0, STEP = float(XS[0]), float(YS[0]), float(TERRAIN_STEP_M)
def elev(x, y):
    fx, fy = (x - X0) / STEP, (y - Y0) / STEP
    i, j = int(np.clip(fx, 0, len(XS) - 2)), int(np.clip(fy, 0, len(YS) - 2))
    tx, ty = np.clip(fx - i, 0, 1), np.clip(fy - j, 0, 1)
    g = GRID
    return (g[j, i] * (1 - tx) * (1 - ty) + g[j, i + 1] * tx * (1 - ty) + g[j + 1, i] * (1 - tx) * ty + g[j + 1, i + 1] * tx * ty) - LAKE_DATUM_M


def way_coords(e): return [G.to_local(p["lon"], p["lat"]) for p in e.get("geometry", [])]

def elem_polys(e):
    """Polygons (local meters) for a building/water/green element from either source format."""
    if e["type"] == "area":
        out = []
        for r in e["rings"]:
            try:
                p = Polygon([G.to_local(x, y) for x, y in r["outer"]], [[G.to_local(x, y) for x, y in i] for i in r["inner"]])
                if not p.is_valid: p = p.buffer(0)
                if isinstance(p, MultiPolygon): out += list(p.geoms)
                elif not p.is_empty: out.append(p)
            except Exception: pass
        return out
    if e["type"] == "way":
        if len(e.get("geometry", [])) < 4: return []
        p = Polygon(way_coords(e))
        if not p.is_valid: p = p.buffer(0)
        return list(p.geoms) if isinstance(p, MultiPolygon) else ([p] if not p.is_empty else [])
    return relation_polys(e)

def load_osm():
    seen, els = set(), []
    for f in sorted((RAW / "osm").glob("*.json")):
        for e in json.load(open(f))["elements"]:
            k = (e["type"], e["id"])
            if k in seen: continue
            seen.add(k); els.append(e)
    return els


def relation_polys(e):
    outers, inners = [], []
    for m in e.get("members", []):
        if m.get("type") != "way" or "geometry" not in m: continue
        c = [G.to_local(p["lon"], p["lat"]) for p in m["geometry"]]
        (inners if m.get("role") == "inner" else outers).append(c)
    return G.rings_to_polygons(outers, inners)

QUANT = 0.1  # meters per int16 unit (positions stored relative to section center)
HOAN_CENTER = Point(G.to_local(-87.8985, 43.0245))   # verified via Nominatim (relation/16271476)
def is_hoan(e):
    """I-794 carriageways on the Hoan: motorway bridge ways within 1.5 km of the verified bridge center."""
    tg = e.get("tags", {})
    if e["type"] != "way" or tg.get("highway") not in ("motorway", "motorway_link") or tg.get("bridge") != "yes": return False
    if not ("794" in tg.get("ref", "") or "Hoan" in tg.get("name", "") or "Hoan" in tg.get("bridge:name", "")): return False
    return len(e.get("geometry", [])) > 1 and LineString(way_coords(e)).distance(HOAN_CENTER) < 1500

def write_sections(path, sections):
    """sections: list of (name4, positions list[(x,y,z)], colors list[(r,g,b)]).
    Layout: 'MKE1' u32 version u32 nSections; per section: name[4] u32 n f32 cx cy cz f32 scale, int16 xyz*n (pad4), u8 rgb*n (pad4)"""
    # int16 covers ±3276 m around a section center; split anything wider (e.g. city-wide water) into 2 km buckets per triangle
    split = []
    for name, pos, col in sections:
        p = np.asarray(pos, dtype=np.float64).reshape(-1, 3) if len(pos) else np.zeros((0, 3))
        if len(p) and (p.max(axis=0) - p.min(axis=0))[[0, 2]].max() > 6000:
            tri = p.reshape(-1, 3, 3); ctr = tri.mean(axis=1); keys = np.floor(ctr[:, [0, 2]] / 2000).astype(int)
            colarr = np.asarray(col, dtype=np.uint8).reshape(-1, 3, 3)
            for k in np.unique(keys, axis=0):
                m = (keys == k).all(axis=1)
                split.append((name, tri[m].reshape(-1, 3), colarr[m].reshape(-1, 3)))
        else: split.append((name, pos, col))
    sections = split
    with open(path, "wb") as f:
        f.write(b"MKE1"); f.write(struct.pack("<II", 2, len(sections)))
        for name, pos, col in sections:
            n = len(pos)
            p = np.asarray(pos, dtype=np.float64).reshape(-1, 3) if n else np.zeros((0, 3))
            c = p.mean(axis=0) if n else np.zeros(3)
            q = np.clip(np.round((p - c) / QUANT), -32767, 32767).astype(np.int16)
            colors = np.asarray(col, dtype=np.uint8).reshape(-1, 3)
            if name == "ROAD" and n:
                # Packing can reverse narrow slivers along a ribbon edge.
                # ROAD contains only top surfaces: preserve upward winding in
                # the coordinates that the renderer will actually receive.
                triangles = q.reshape(-1, 3, 3)
                wide = triangles.astype(np.int64)
                flipped = np.cross(wide[:, 1] - wide[:, 0], wide[:, 2] - wide[:, 0])[:, 1] < 0
                triangles[flipped] = triangles[flipped][:, [0, 2, 1]]
                colors = colors.copy().reshape(-1, 3, 3)
                colors[flipped] = colors[flipped][:, [0, 2, 1]]
            f.write(name.encode()[:4].ljust(4, b" ")); f.write(struct.pack("<Ifff f", n, *c, QUANT))
            qb = q.tobytes(); f.write(qb); f.write(b"\0" * ((4 - len(qb) % 4) % 4))
            cb = colors.tobytes(); f.write(cb); f.write(b"\0" * ((4 - len(cb) % 4) % 4))
    return path.stat().st_size

def main():
    t0 = time.time(); OUT.joinpath("tiles").mkdir(exist_ok=True)
    bbox = json.load(open(RAW / "bbox.json"))
    bx0, by0 = G.to_local(bbox["west"], bbox["south"]); bx1, by1 = G.to_local(bbox["east"], bbox["north"])
    bbox_poly = box(bx0, by0, bx1, by1)
    city = shape(json.load(open(RAW / "citylimit.geojson"))["geometry"])
    from shapely.ops import transform
    city = transform(lambda x, y, z=None: G.to_local(x, y), city); city_p = prep(city)
    els = load_osm(); print(f"OSM elements (deduped): {len(els)}")
    parcels = None
    try:
        parcels = ParcelStories(); print(f"MPROP parcels with story counts: {parcels.matched_parcels}")
    except Exception as ex: print("MPROP join unavailable:", ex)

    # ---- water: lake from coastline, rivers from OSM + city layer ----
    coast = [LineString(way_coords(e)) for e in els if e["type"] == "way" and e.get("tags", {}).get("natural") == "coastline" and len(e.get("geometry", [])) > 1]
    lake = None
    if coast:
        # OSM coastline convention: land on the left, water on the right of the way direction.
        merged = linemerge(unary_union(coast)); parts = list(merged.geoms) if merged.geom_type == "MultiLineString" else [merged]
        probes = []
        for part in parts:
            if part.length < 1000: continue
            for f in (0.3, 0.5, 0.7):
                d = part.length * f; a = part.interpolate(d - 20); b = part.interpolate(d + 20); m = part.interpolate(d)
                dx, dy = b.x - a.x, b.y - a.y; n = (dx * dx + dy * dy) ** 0.5 or 1
                probes.append(Point(m.x + dy / n * 40, m.y - dx / n * 40))      # 40 m to the right = water side
        cands = [p for p in polygonize(unary_union(coast + [bbox_poly.exterior])) if any(p.contains(q) for q in probes)]
        lake = unary_union(cands) if cands else None
    print("lake polygon area km2:", round(lake.area / 1e6, 1) if lake else None, "| coastline ways:", len(coast))
    water = []
    for e in els:
        tg = e.get("tags", {})
        if tg.get("natural") == "water" or tg.get("waterway") == "riverbank":
            water += elem_polys(e)
    for f in json.load(open(RAW / "city_water.geojson"))["features"]:
        g = shape(f["geometry"]); g = transform(lambda x, y, z=None: G.to_local(x, y), g)
        if g.is_valid: water.append(g)
    water_u = unary_union([w.buffer(0) for w in water]).intersection(bbox_poly)
    if lake is not None: water_u = water_u.difference(lake)
    water_polys = list(water_u.geoms) if isinstance(water_u, MultiPolygon) else [water_u]
    water_polys = [p for p in water_polys if p.area > 200]
    print("river/pond polygons:", len(water_polys))

    # ---- green areas (colored onto terrain) ----
    greens = []
    for e in els:
        tg = e.get("tags", {})
        if tg.get("leisure") in ("park", "golf_course", "nature_reserve", "pitch") or tg.get("landuse") in ("grass", "cemetery", "forest", "recreation_ground", "meadow") or tg.get("natural") == "wood":
            greens += [p for p in elem_polys(e) if p.area > 2000]
    green_u = unary_union(greens)
    print("green polygons:", len(greens))

    # ---- terrain: color by city/green, carve a trench under water, flatten the lake bed ----
    import shapely
    ny, nx = GRID.shape
    H = (GRID - LAKE_DATUM_M).astype(np.float32); C = np.zeros((ny, nx, 3), dtype=np.uint8)
    GX, GY = np.meshgrid(XS.astype(np.float64), YS.astype(np.float64))
    C[:] = COL_LAND_OUT; C[shapely.contains_xy(city, GX, GY)] = COL_LAND; C[shapely.contains_xy(green_u, GX, GY)] = COL_GREEN
    def mask_of(poly):
        b = poly.bounds; sel = (GX >= b[0] - STEP) & (GX <= b[2] + STEP) & (GY >= b[1] - STEP) & (GY <= b[3] + STEP)
        m = np.zeros_like(sel)
        if sel.any(): m[sel] = shapely.contains_xy(poly, GX[sel], GY[sel])
        return m
    river_u = unary_union(water_polys) if water_polys else None
    if river_u is not None and not river_u.is_empty:
        m = mask_of(river_u.buffer(STEP * 0.75))            # trench ~1 grid step wider than the river so banks always dip
        H[m] -= 2.5; C[m] = COL_SHORE
    if lake is not None:
        m = mask_of(lake.buffer(STEP * 0.75)); H[m] = np.minimum(H[m], -4.0); C[m] = COL_SHORE
    GRID_C = H.astype(np.float64)   # carved grid used for draping water/roads/buildings below
    def elev_c(x, y):
        fx, fy = (x - X0) / STEP, (y - Y0) / STEP
        i, j = int(np.clip(fx, 0, len(XS) - 2)), int(np.clip(fy, 0, len(YS) - 2))
        tx, ty = np.clip(fx - i, 0, 1), np.clip(fy - j, 0, 1); g = GRID_C
        return g[j, i] * (1 - tx) * (1 - ty) + g[j, i + 1] * tx * (1 - ty) + g[j + 1, i] * (1 - tx) * ty + g[j + 1, i + 1] * tx * ty
    with open(OUT / "terrain.bin", "wb") as f:
        f.write(b"MKET"); f.write(struct.pack("<IIfff", nx, ny, X0, Y0, STEP)); f.write(H.tobytes()); f.write(C.tobytes())
    print(f"terrain.bin {nx}x{ny}, {(OUT/'terrain.bin').stat().st_size/1e6:.2f} MB")

    # ---- water.bin: lake flat at datum (y=0); rivers/ponds draped 0.8 m above the carved trench floor ----
    pos, col = [], []
    if lake is not None: G.flat(lake, 0.0, (46, 111, 142), pos, col)
    for p in water_polys:
        geoms = list(p.geoms) if isinstance(p, MultiPolygon) else [p]
        for g0 in geoms:
          for g in G.grid_split(g0, min_area=2e5):
            if not g.is_valid: g = g.buffer(0)
            if g.is_empty or g.geom_type != "Polygon": continue
            verts, idx = G.triangulate(G.orient(g, 1.0))
            for i in range(0, len(idx), 3):
                for k in (idx[i], idx[i + 1], idx[i + 2]):
                    x, y = verts[k]; pos.append((x, max(elev_c(x, y) + 0.8, 0.0), -y)); col.append((56, 122, 150))
    nb = write_sections(OUT / "water.bin", [("WATR", pos, col)]); print(f"water.bin {nb/1e6:.2f} MB, {len(pos)//3} tris")
    import sys
    if "--water-only" in sys.argv: print("water-only run; tiles untouched"); return

    # ---- buildings + roads into tiles ----
    tiles = defaultdict(lambda: {"b": ([], []), "bl": ([], []), "r": ([], []), "rl": ([], []), "h": ([], []), "hl": ([], []), "n": 0, "nl": 0})
    stats = Counter(); in_city = 0; hmax = 0
    def tkey(x, y): return (int(np.floor(x / TILE_M)), int(np.floor(y / TILE_M)))
    for e in els:
        tg = e.get("tags", {})
        if "building" in tg and tg["building"] != "no":
            if e["id"] == 5747956 and (e["type"] == "relation" or e.get("from") == "relation"):
                continue  # American Family Field has a dedicated fan-roof model.
            if e["id"] in (403894584, 403895414, 446874803, 66709384, 54622334, 403385102, 403385111) and (e["type"] == "way" or e.get("from") == "way"):
                continue  # The museum campus, City Hall, Domes and North Point Lighthouse have dedicated models.
            for p in elem_polys(e):
                if p.is_empty or p.area < 4: continue
                area = p.area
                h, src = G.estimate_height(tg, area)
                if src == "estimate" and parcels is not None and area >= 60 and tg.get("building") not in SMALL_TYPES:
                    mh = parcels.height_at(p.centroid.x, p.centroid.y)
                    if mh: h, src = mh, "mprop"
                if e["id"] in LANDMARK_PLINTH and (e["type"] == "way" or e.get("from") == "way"): h, src = LANDMARK_PLINTH[e["id"]], "landmark"
                stats[src] += 1; hmax = max(hmax, h)
                c = p.centroid
                if city_p.contains(c): in_city += 1
                base = elev_c(c.x, c.y) - 1.5
                color, roof = bcolor(h, e["id"]) if src != "landmark" else (COL_LANDMARK, COL_LANDMARK)
                t = tiles[tkey(c.x, c.y)]
                G.extrude(p, base, h + 1.5, color, roof, *t["b"]); t["n"] += 1
                if h >= 12 or area >= 600:
                    G.extrude(p.simplify(1.5, preserve_topology=True), base, h + 1.5, color, roof, *t["bl"]); t["nl"] += 1
    # Roads are tessellated, clipped, and graded by the shared street builder.
    for key, road in build_roads(els, way_coords, elev_c, is_hoan, progress=True).items():
        tiles[key]["r"] = road["r"]
        tiles[key]["rl"] = road["rl"]
        tiles[key]["h"] = road.get("h", ([], []))
        tiles[key]["hl"] = road.get("hl", ([], []))
    # ---- Hoan Bridge centerline (ways named 'Hoan' / relation 16271476 members) ----
    hoan_lines = [LineString(way_coords(e)) for e in els if is_hoan(e)]
    hoan = None
    if hoan_lines:
        m = linemerge(unary_union(hoan_lines))
        m = max(m.geoms, key=lambda g: g.length) if m.geom_type == "MultiLineString" else m
        pts = [(x, -y) for x, y in m.coords]
        # arch center: where the centerline crosses the largest water gap (lake/harbor)
        ws = unary_union([lake] + water_polys) if lake is not None else unary_union(water_polys)
        cross = m.intersection(ws)
        seg = max(cross.geoms, key=lambda g: g.length) if cross.geom_type == "MultiLineString" else cross
        if not seg.is_empty and seg.geom_type == "LineString":
            c = seg.interpolate(0.5, normalized=True); a, b = seg.coords[0], seg.coords[-1]
            hoan = {"centerline": pts, "archCenter": [c.x, -c.y], "archDir": [b[0] - a[0], -(b[1] - a[1])], "spanM": seg.length,
                    "lengthM": m.length, "deckHeightM": 36.0}
    json.dump({"hoan": hoan}, open(OUT / "landmarks_geo.json", "w"))
    print("hoan bridge:", "found" if hoan else "not found (no ways named Hoan in fetched chunks)")
    manifest_tiles = []
    for (i, j), t in tiles.items():
        if not t["b"][0] and not t["r"][0]: continue
        f = OUT / "tiles" / f"t_{i}_{j}.bin"; fl = OUT / "tiles" / f"t_{i}_{j}.lod.bin"
        nb = write_sections(f, [("BLDG", *t["b"]), ("ROAD", *t["r"]), ("HWAY", *t["h"])])
        nl = write_sections(fl, [("BLDG", *t["bl"]), ("ROAD", *t["rl"]), ("HWAY", *t["hl"])])
        manifest_tiles.append({"i": i, "j": j, "cx": (i + 0.5) * TILE_M, "cz": -(j + 0.5) * TILE_M, "bytes": nb, "lodBytes": nl,
                               "buildings": t["n"], "lodBuildings": t["nl"]})
    total_b = sum(stats.values())
    stat = {"generated": datetime.date.today().isoformat(), "buildings": total_b, "buildings_in_city_limits": in_city,
            "height_source": {k: {"count": v, "pct": round(100 * v / total_b, 1)} for k, v in stats.items()},
            "max_height_m": hmax, "tiles": len(manifest_tiles), "tile_bytes_total": sum(t["bytes"] for t in manifest_tiles),
            "lod_bytes_total": sum(t["lodBytes"] for t in manifest_tiles), "water_polygons": len(water_polys),
            "lake_area_km2": round(lake.area / 1e6, 1) if lake else None, "green_polygons": len(greens), "osm_elements": len(els)}
    json.dump(stat, open(OUT / "stats.json", "w"), indent=1)
    json.dump({"version": 1, "origin": {"lat": LAT0, "lon": LON0}, "mPerDegLat": M_PER_DEG_LAT, "mPerDegLon": M_PER_DEG_LON,
               "tileSize": TILE_M, "lakeDatumM": LAKE_DATUM_M, "bounds": {"x0": bx0, "z0": -by1, "x1": bx1, "z1": -by0},
               "tiles": sorted(manifest_tiles, key=lambda t: t["cx"] ** 2 + t["cz"] ** 2), "stats": stat},
              open(OUT / "manifest.json", "w"))
    print(json.dumps(stat, indent=1)); print(f"done in {time.time()-t0:.0f}s")

if __name__ == "__main__": main()
