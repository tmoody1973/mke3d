"""Reusable OSM road meshing.

``build_roads`` accepts source coordinates in (east, north) meters and emits
Three.js positions (east, elevation, -north), split at the actual tile bounds.
"""
from collections import defaultdict
import math
import time
from functools import lru_cache

from shapely.geometry import LineString, MultiPolygon, Point, Polygon, box
from shapely.geometry.polygon import orient
from shapely.strtree import STRtree

import geometry as G
from config import BRIDGE_LIFT_M, ROAD_WIDTH_M, TILE_M
from highway_profiles import build_profiles, is_bridge, point_key
from highway_details import build_highway_details


ASPHALT = (105, 108, 110)
PATH = (166, 151, 128)
CONCRETE = (176, 174, 166)
MAJOR = {"motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link"}
PATHS = {"footway", "cycleway", "path", "steps", "bridleway", "track"}
SUPPORTED = set(ROAD_WIDTH_M) | PATHS
FALLBACK_WIDTH = {"footway": 1.8, "cycleway": 2.4, "path": 1.6, "steps": 1.5, "bridleway": 2.2, "track": 3.0}
ONEWAY_WIDTH = {
    "motorway": 10.0, "motorway_link": 6.0, "trunk": 9.0, "trunk_link": 5.5,
    "primary": 6.4, "primary_link": 5.0, "secondary": 5.8, "secondary_link": 4.5,
    "tertiary": 5.0, "tertiary_link": 4.0, "residential": 4.0,
    "unclassified": 4.0, "living_street": 4.0, "service": 3.0,
}
SURFACE_CONCRETE = {"concrete", "concrete:lanes", "concrete:plates", "paving_stones", "sett"}
_STEP = 30.0
_APPROACH = 75.0
_STRIPE = 14.0


def _number(value):
    try:
        return float(str(value).split(";")[0])
    except (TypeError, ValueError):
        return None


def road_width(tags):
    """Road width in meters: tagged width, lane count, then class fallback."""
    width = G.parse_height(tags.get("width"))
    if width and 0.5 <= width <= 60:
        return width
    lanes = _number(tags.get("lanes"))
    highway = tags.get("highway")
    if highway in ("motorway", "motorway_link"):
        lanes = lanes or (2 if highway == "motorway" else 1)
        shoulders = 4.2 if highway == "motorway" else 2.1
        return lanes * 3.66 + shoulders
    if lanes and 0 < lanes <= 16:
        # OSM lanes is the lane count on this way. This also handles separate
        # one-way carriageways without accidentally halving their width.
        return max(2.5, lanes * 3.2)
    if tags.get("oneway") in ("yes", "1", "true", "-1") and highway in ONEWAY_WIDTH:
        return ONEWAY_WIDTH[highway]
    return ROAD_WIDTH_M.get(highway, FALLBACK_WIDTH.get(highway))


def _bridge(tags):
    return is_bridge(tags)


def _layer(tags):
    try:
        return int(tags.get("layer", "1"))
    except (TypeError, ValueError):
        return 1


def _densify(coords, step=_STEP):
    out = [coords[0]]
    for a, b in zip(coords, coords[1:]):
        length = math.hypot(b[0] - a[0], b[1] - a[1])
        n = max(1, int(math.ceil(length / step)))
        out.extend([(a[0] + (b[0] - a[0]) * i / n,
                     a[1] + (b[1] - a[1]) * i / n) for i in range(1, n + 1)])
    return out


def _bounded_triangles(verts, idx, max_edge=20.0):
    """Yield CCW 2-D triangles with a hard planar edge bound."""
    pending = [[tuple(verts[k]) for k in idx[i:i + 3]] for i in range(0, len(idx), 3)]
    while pending:
        tri = pending.pop()
        lengths = [math.dist(tri[0], tri[1]), math.dist(tri[1], tri[2]), math.dist(tri[2], tri[0])]
        edge = max(range(3), key=lengths.__getitem__)
        if lengths[edge] <= max_edge:
            yield tri
            continue
        a, b, c = tri[edge], tri[(edge + 1) % 3], tri[(edge + 2) % 3]
        midpoint = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        pending.append([a, midpoint, c])
        pending.append([midpoint, b, c])


def _stripe_polygons(poly, stripe=_STRIPE):
    """Partition a tile-clipped ribbon before earcut can form long fans.

    Split on the longer bounds axis. A normal road then yields a sequence of
    roughly 14m rectangles, so the recursive edge guard has little work left.
    """
    minx, miny, maxx, maxy = poly.bounds
    along_x = (maxx - minx) >= (maxy - miny)
    lo, hi = (minx, maxx) if along_x else (miny, maxy)
    first = math.floor(lo / stripe)
    last = math.floor(hi / stripe)
    # Padding only on the unsplit axis; intersections remain inside the source
    # polygon and therefore inside its tile.
    pad = max(maxx - minx, maxy - miny) + 1.0
    for k in range(first, last + 1):
        a, b = k * stripe, (k + 1) * stripe
        cutter = box(a, miny - pad, b, maxy + pad) if along_x else box(minx - pad, a, maxx + pad, b)
        piece = poly.intersection(cutter)
        geoms = piece.geoms if hasattr(piece, "geoms") else (piece,)
        for g in geoms:
            if isinstance(g, Polygon) and g.area >= 0.05:
                yield g


def _color(tags):
    if tags.get("surface") in {"asphalt", "chipseal"}:
        return ASPHALT
    if tags.get("surface") in SURFACE_CONCRETE:
        return CONCRETE
    if tags.get("highway") in PATHS or tags.get("surface") in {"gravel", "dirt", "ground", "compacted", "fine_gravel"}:
        return PATH
    return ASPHALT


def _endpoint_key(p):
    return point_key(p)


def build_roads(elements, coords_fn, ground_at, skip_fn=lambda e: False, *, progress=False,
                tile_filter=None, details_only=False):
    """Build tiled road meshes.

    Returns ``{(tile_i, tile_j): {'r': (positions, colors), 'rl': (...)}}``.
    Tunnels and unsupported highway classes are omitted. Shared source-node
    profiles coordinate bridges and their connected approaches; geometric
    crossings receive separate clearance constraints. Unprofiled roads follow
    terrain, with endpoint blending retained as a fallback.
    """
    started = time.monotonic()
    ways = []
    profile_rows = []
    bridge_ends = {}
    for e in elements:
        tags = e.get("tags", {})
        if (e.get("type") != "way" or tags.get("area") == "yes"
                or tags.get("highway") not in SUPPORTED):
            continue
        if tags.get("tunnel") in ("yes", "building_passage"):
            continue
        coords = coords_fn(e)
        width = road_width(tags)
        if width is None or len(coords) < 2:
            continue
        original_coords = coords
        coords = _densify(coords)
        line = LineString(coords)
        bridge = _bridge(tags)
        lift = max(_layer(tags), 1) * BRIDGE_LIFT_M + 0.4 if bridge else 0.4
        profile_rows.append((e, tags, original_coords))
        if bridge:
            for p in (coords[0], coords[-1]):
                # At shared deck nodes choose the highest required structure.
                target = ground_at(*p) + (14.4 if skip_fn(e) else lift)
                bridge_ends[_endpoint_key(p)] = max(bridge_ends.get(_endpoint_key(p), -1e9), target)
        # Skipped interpretive bridges (the Hoan) still publish their exact
        # endpoint deck heights so ordinary approach ways meet them cleanly.
        if not skip_fn(e):
            ways.append((e, tags, coords, line, width, bridge, lift, original_coords))

    profiles = build_profiles(profile_rows,
                              ground_at, skip_fn=skip_fn, clearance=BRIDGE_LIFT_M)
    # The shared solver is authoritative. Keeping the old layer*lift targets
    # here would lift a bank-grade approach even after its bridge was corrected.
    bridge_ends.clear()
    for element, tags, original in profile_rows:
        if not _bridge(tags):
            continue
        profile = profiles.get(id(element))
        if profile is None:
            continue
        for point in (original[0], original[-1]):
            key = point_key(point)
            bridge_ends[key] = max(bridge_ends.get(key, -math.inf), profile(*point))
    source_incidence = defaultdict(set)
    bridge_incidence = defaultdict(set)
    for element, tags, original in profile_rows:
        for point in original:
            source_incidence[point_key(point)].add(id(element))
            if _bridge(tags):
                bridge_incidence[point_key(point)].add(id(element))

    def rail_setback(point):
        key = point_key(point)
        if len(source_incidence[key]) > 2:
            return 12.0  # keep a branch/ramp mouth open
        return 0.0 if len(bridge_incidence[key]) > 1 else 2.0

    # Spatial index used by bridge-detail pier placement. A pier is rejected
    # wherever its column would pass through another road ribbon.
    blocker_lines = [row[3] for row in ways]
    blocker_tree = STRtree(blocker_lines) if blocker_lines else None
    blocker_by_geom = {id(g): k for k, g in enumerate(blocker_lines)}
    max_blocker_halfwidth = max((row[4] / 2 for row in ways), default=0.0)

    def blockers_for(own_index):
        def blocked(x, y, radius, deck_bottom):
            if blocker_tree is None:
                return False
            point = Point(x, y)
            probe = point.buffer(radius + max_blocker_halfwidth)
            for hit in blocker_tree.query(probe):
                k = int(hit) if not hasattr(hit, "geom_type") else blocker_by_geom[id(hit)]
                if k == own_index:
                    continue
                other = ways[k]
                if other[3].distance(point) <= radius + other[4] / 2:
                    other_height = profiles.get(id(other[0]))
                    top = other_height(x, y) if other_height else ground_at(x, y) + .4
                    if top < deck_bottom:
                        return True
            return False
        return blocked

    out = defaultdict(lambda: {"r": ([], []), "rl": ([], [])})
    for way_index, (e, tags, coords, line, width, bridge, lift, original_coords) in enumerate(ways):
        if progress and way_index % 10000 == 0:
            print(f"Street meshes {way_index}/{len(ways)} ({time.monotonic() - started:.0f}s)", flush=True)
        if details_only and id(e) not in profiles and not bridge:
            continue
        minx, miny, maxx, maxy = line.bounds
        pad = width / 2
        minx, miny, maxx, maxy = minx-pad, miny-pad, maxx+pad, maxy+pad
        i0, i1 = math.floor(minx / TILE_M), math.floor(maxx / TILE_M)
        j0, j1 = math.floor(miny / TILE_M), math.floor(maxy / TILE_M)
        if tile_filter is not None and not any((i, j) in tile_filter
                for i in range(i0, i1+1) for j in range(j0, j1+1)):
            continue
        # A structural deck has flat ends and shared mitered edges, matching
        # the fascia below it rather than unsupported semicircular road caps.
        poly = line.buffer(width / 2.0, resolution=3, cap_style=2 if bridge else 1,
                           join_style=2 if bridge else 1, mitre_limit=1.8)
        start_target = bridge_ends.get(_endpoint_key(coords[0]))
        end_target = bridge_ends.get(_endpoint_key(coords[-1]))
        if bridge:
            y0 = start_target
            y1 = end_target

        @lru_cache(maxsize=None)
        def height(x, y):
            # Ordinary surface streets need no centerline projection. Adjacent
            # triangles share vertices, so sample each elevation only once.
            if not bridge and start_target is None and end_target is None:
                return ground_at(x, y) + 0.4
            d = line.project(Point(x, y))
            if bridge:
                return y0 + (y1 - y0) * (d / line.length if line.length else 0.0)
            h = ground_at(x, y) + 0.4
            start_delta = None if start_target is None else start_target - (ground_at(*coords[0]) + 0.4)
            end_delta = None if end_target is None else end_target - (ground_at(*coords[-1]) + 0.4)
            # When both ends attach to decks, span the whole way so each
            # endpoint is exact, including ways shorter than the normal blend.
            if start_delta is not None and end_delta is not None:
                t = d / line.length if line.length else 0.0
                return h + start_delta * (1.0 - t) + end_delta * t
            blend = min(_APPROACH, line.length)
            if start_delta is not None and d < blend:
                h += start_delta * (1.0 - d / blend)
            remaining = line.length - d
            if end_delta is not None and remaining < blend:
                h += end_delta * (1.0 - remaining / blend)
            return h

        color = _color(tags)
        profile = profiles.get(id(e))
        if profile is not None:
            height = profile
        for i in (range(i0, i1 + 1) if not details_only else ()):
            for j in range(j0, j1 + 1):
                if tile_filter is not None and (i, j) not in tile_filter:
                    continue
                clipped = poly.intersection(box(i * TILE_M, j * TILE_M, (i + 1) * TILE_M, (j + 1) * TILE_M))
                geoms = list(clipped.geoms) if isinstance(clipped, MultiPolygon) else [clipped]
                for g in geoms:
                    if not isinstance(g, Polygon) or g.area < 0.05:
                        continue
                    pos = []
                    for piece in _stripe_polygons(g):
                        verts, idx = G.triangulate(orient(piece, 1.0))
                        for triangle in _bounded_triangles(verts, idx):
                            for x, y in triangle:
                                pos.append((x, height(x, y), -y))
                    tile = out[(i, j)]
                    tile["r"][0].extend(pos); tile["r"][1].extend([color] * len(pos))
                    if tags.get("highway") in MAJOR or bridge or profile is not None:
                        tile["rl"][0].extend(pos); tile["rl"][1].extend([color] * len(pos))
        if profile is not None or bridge:
            details = build_highway_details(original_coords, width, tags, height, ground_at,
                                            blockers=blockers_for(way_index),
                                            end_setbacks=tuple(rail_setback(p) for p in (original_coords[0], original_coords[-1])))
            for key, sections in details.items():
                if tile_filter is not None and key not in tile_filter:
                    continue
                tile = out[key]
                for section in ("h", "hl"):
                    tile.setdefault(section, ([], []))
                    tile[section][0].extend(sections[section][0])
                    tile[section][1].extend(sections[section][1])
    return dict(out)
