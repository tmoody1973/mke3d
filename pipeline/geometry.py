"""Geometry helpers: projection, height estimation, extrusion and ribbons -> flat float32 triangle lists."""
import math, re, numpy as np
import mapbox_earcut as earcut
from shapely.geometry import Polygon, MultiPolygon, LineString, box
from shapely.geometry.polygon import orient

def grid_split(poly, cell=2000.0, min_area=1e6):
    """Cut a large/complex polygon into grid cells. Earcut silently drops regions of very complex rings
    (harbor breakwaters, long rivers); small clean pieces triangulate reliably and fit int16 tiles."""
    if poly.area < min_area: return [poly]
    x0, y0, x1, y1 = poly.bounds; out = []
    import math
    for i in range(math.floor(x0 / cell), math.ceil(x1 / cell)):
        for j in range(math.floor(y0 / cell), math.ceil(y1 / cell)):
            piece = poly.intersection(box(i * cell, j * cell, (i + 1) * cell, (j + 1) * cell))
            if piece.is_empty: continue
            geoms = piece.geoms if hasattr(piece, "geoms") else [piece]
            out += [g for g in geoms if isinstance(g, Polygon) and g.area > 1]
    return out
from shapely.ops import linemerge, unary_union, polygonize
from config import (LAT0, LON0, M_PER_DEG_LAT, M_PER_DEG_LON, LEVEL_HEIGHT_M, TYPE_HEIGHTS, ROAD_WIDTH_M,
                    BRIDGE_LIFT_M, LANDMARK_PLINTH)

def to_local(lon, lat):
    """WGS84 -> local meters. x east, y north (converted to Three z=-y at write time)."""
    return (lon - LON0) * M_PER_DEG_LON, (lat - LAT0) * M_PER_DEG_LAT

_num = re.compile(r"^\s*([0-9]+(?:\.[0-9]+)?)\s*(m|ft|')?\s*$")
def parse_height(v):
    m = _num.match(v or "")
    if not m: return None
    h = float(m.group(1))
    return h * 0.3048 if m.group(2) in ("ft", "'") else h

def estimate_height(tags, area_m2):
    """Returns (height_m, source). Source is 'height' | 'levels' | 'estimate'."""
    h = parse_height(tags.get("height"))
    if h and 1.5 <= h <= 400: return h, "height"
    lv = tags.get("building:levels")
    try:
        n = float(lv)
        if 0 < n <= 120: return max(n * LEVEL_HEIGHT_M, 2.5), "levels"
    except (TypeError, ValueError): pass
    t = tags.get("building", "yes")
    if t in TYPE_HEIGHTS: return TYPE_HEIGHTS[t], "estimate"
    # generic building=yes: area-based (small = shed/garage, large = commercial block)
    if area_m2 < 60: h = 3.0
    elif area_m2 < 250: h = 6.0
    elif area_m2 < 1200: h = 8.0
    elif area_m2 < 5000: h = 10.0
    else: h = 12.0
    return h, "estimate"

def rings_to_polygons(outer_rings, inner_rings=()):
    """Assemble closed ways / relation members into polygons (holes dropped when invalid)."""
    polys = []
    def _polys(rings):
        lines = [LineString(r) for r in rings if len(r) >= 2]
        if not lines: return []
        u = unary_union(lines)
        try: merged = linemerge(u) if u.geom_type == "MultiLineString" else u
        except ValueError: merged = u
        return [p for p in polygonize(merged) if p.is_valid and p.area > 0]
    polys = _polys(outer_rings)
    if inner_rings and polys:
        holes = _polys(inner_rings)
        if holes:
            polys = [p.difference(unary_union(holes)) for p in polys]
    out = []
    for p in polys:
        if isinstance(p, MultiPolygon): out += list(p.geoms)
        elif isinstance(p, Polygon) and not p.is_empty: out.append(p)
    return out

def triangulate(poly):
    """Earcut a shapely Polygon -> (Nx2 vertices, flat index list)."""
    rings = [np.asarray(poly.exterior.coords[:-1], dtype=np.float64)]
    rings += [np.asarray(i.coords[:-1], dtype=np.float64) for i in poly.interiors]
    verts = np.concatenate(rings)
    ring_ends = np.cumsum([len(r) for r in rings]).astype(np.uint32)
    idx = earcut.triangulate_float64(verts, ring_ends)
    return verts, idx

def extrude(poly, base, height, color, roof_color=None, out=None, cols=None):
    """Append extruded prism triangles (x, y_up, z) with per-vertex RGB into out/cols lists."""
    if poly.is_empty or not poly.is_valid: poly = poly.buffer(0)
    if poly.is_empty or poly.area < 1.0: return
    if isinstance(poly, MultiPolygon):
        for g in poly.geoms: extrude(g, base, height, color, roof_color, out, cols)
        return
    poly = orient(poly, 1.0)          # exterior CCW, holes CW -> fixed winding below faces up/outward (verified)
    verts, idx = triangulate(poly)
    top = base + height
    roof_color = roof_color or color
    # roof (normal +y after the z = -north flip)
    for i in range(0, len(idx), 3):
        for k in (idx[i], idx[i + 1], idx[i + 2]):
            out.append((verts[k][0], top, -verts[k][1])); cols.append(roof_color)
    # walls (exterior + interiors), outward-facing
    for ring in [poly.exterior] + list(poly.interiors):
        c = list(ring.coords)
        for i in range(len(c) - 1):
            (x0, y0), (x1, y1) = c[i], c[i + 1]
            a, b, cc, d = (x0, base, -y0), (x1, base, -y1), (x1, top, -y1), (x0, top, -y0)
            for t in ((a, b, cc), (a, cc, d)):
                for v in t: out.append(v); cols.append(color)

def flat(poly, y, color, out, cols, split=True):
    """Append a flat (roof-only) polygon at height y. Large polygons are grid-split once (see grid_split)."""
    if poly.is_empty: return
    if not poly.is_valid: poly = poly.buffer(0)
    if isinstance(poly, MultiPolygon):
        for g in poly.geoms: flat(g, y, color, out, cols, split)
        return
    if not isinstance(poly, Polygon) or poly.area < 0.5: return
    if split and poly.area >= 1e6:
        for piece in grid_split(poly): flat(piece, y, color, out, cols, split=False)
        return
    verts, idx = triangulate(orient(poly, 1.0))
    for i in range(0, len(idx), 3):
        for k in (idx[i], idx[i + 1], idx[i + 2]):
            out.append((verts[k][0], y, -verts[k][1])); cols.append(color)

def road_ribbon(coords, tags):
    """Buffer a road centerline into a polygon; returns (polygon, lift_m) or None."""
    w = ROAD_WIDTH_M.get(tags.get("highway"))
    if not w or len(coords) < 2: return None
    line = LineString(coords)
    lift = 0.0
    if tags.get("bridge") in ("yes", "viaduct") or tags.get("layer", "0").lstrip("-").isdigit() and int(tags.get("layer", "0")) > 0:
        try: layer = max(int(tags.get("layer", "1")), 1)
        except ValueError: layer = 1
        lift = BRIDGE_LIFT_M * layer
    if tags.get("tunnel") in ("yes", "building_passage"): return None
    return line.buffer(w / 2, cap_style=2, join_style=2), lift
