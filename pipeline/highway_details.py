"""Lightweight markings and bridge structure for major OSM highways.

Input coordinates are ``(east, north)``.  Output uses Three.js coordinates
``(east, elevation, -north)`` and is clipped to the real 2 km tile bounds.
"""
from collections import defaultdict
import math

from config import TILE_M


WHITE = (226, 226, 218)
YELLOW = (224, 181, 57)
CONCRETE = (151, 151, 145)
DECK_THICKNESS = 1.2
END_CLEARANCE = 12.0
MIN_PIER_SPAN = 72.0
PIER_SPACING = 45.0
MARKED_HIGHWAYS = {
    "motorway", "motorway_link", "trunk", "trunk_link",
    "primary", "primary_link", "secondary", "secondary_link",
}
PATH_HIGHWAYS = {"footway", "cycleway", "path", "steps", "bridleway"}


def _bridge(tags):
    value = str(tags.get("bridge", "")).strip().lower()
    return bool(value) and value not in {"no", "false", "0"}


def _lanes(tags):
    try:
        n = int(str(tags.get("lanes", "")).split(";")[0])
        return n if 1 <= n <= 12 else None
    except (TypeError, ValueError):
        return None


def _samples(coords):
    lengths = [0.0]
    for a, b in zip(coords, coords[1:]):
        lengths.append(lengths[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    return lengths


def _clean_coords(coords):
    """Drop repeated source nodes which otherwise make zero-area structure."""
    out = []
    for p in coords:
        p = (float(p[0]), float(p[1]))
        if not out or math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) > 1e-7:
            out.append(p)
    return out


def _vertex_frames(coords):
    """Return a continuous tangent and bounded left miter at every node.

    The miter is shared by the segments on either side of a bend.  Capping its
    length avoids the long paper-thin spikes produced by nearly reversing OSM
    segments while still closing the structural shell.
    """
    segments = []
    for a, b in zip(coords, coords[1:]):
        dx, dn = b[0] - a[0], b[1] - a[1]
        mag = math.hypot(dx, dn)
        segments.append((dx / mag, dn / mag))
    frames = []
    for k in range(len(coords)):
        if k == 0:
            tangent = segments[0]
            left = (-tangent[1], tangent[0])
        elif k == len(coords) - 1:
            tangent = segments[-1]
            left = (-tangent[1], tangent[0])
        else:
            before, after = segments[k - 1], segments[k]
            sx, sn = before[0] + after[0], before[1] + after[1]
            smag = math.hypot(sx, sn)
            tangent = after if smag < 1e-7 else (sx / smag, sn / smag)
            n0, n1 = (-before[1], before[0]), (-after[1], after[0])
            mx, mn = n0[0] + n1[0], n0[1] + n1[1]
            mmag = math.hypot(mx, mn)
            if mmag < 1e-7:
                left = n1
            else:
                mx, mn = mx / mmag, mn / mmag
                projection = mx * n0[0] + mn * n0[1]
                scale = min(2.0, 1.0 / max(projection, .5))
                left = (mx * scale, mn * scale)
        frames.append((tangent[0], tangent[1], left[0], left[1]))
    return frames


def _frame_at(coords, lengths, frames, distance):
    """Sample the path, using the exact shared miter at a source node."""
    distance = min(max(distance, 0.0), lengths[-1])
    for k, d in enumerate(lengths):
        if abs(distance - d) <= 1e-7:
            x, n = coords[k]
            return x, n, *frames[k]
    for k in range(len(lengths) - 1):
        if distance < lengths[k + 1]:
            span = lengths[k + 1] - lengths[k]
            t = (distance - lengths[k]) / span
            a, b = coords[k], coords[k + 1]
            tx = (b[0] - a[0]) / span
            tn = (b[1] - a[1]) / span
            return (a[0] + (b[0] - a[0]) * t,
                    a[1] + (b[1] - a[1]) * t,
                    tx, tn, -tn, tx)
    x, n = coords[-1]
    return x, n, *frames[-1]


def _opening_bridge(tags):
    """Whether the mapped way itself is an opening/movable span."""
    bridge = str(tags.get("bridge", "")).strip().lower()
    movable = str(tags.get("bridge:movable", "")).strip().lower()
    return bridge in {"movable", "bascule", "drawbridge", "lift", "swing"} or (
        bool(movable) and movable not in {"no", "false", "0", "unknown"})


def _at(coords, lengths, distance):
    distance = min(max(distance, 0.0), lengths[-1])
    for k in range(len(lengths) - 1):
        if distance <= lengths[k + 1] or k == len(lengths) - 2:
            span = lengths[k + 1] - lengths[k]
            t = (distance - lengths[k]) / span if span else 0.0
            a, b = coords[k], coords[k + 1]
            x, n = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
            mag = math.hypot(b[0] - a[0], b[1] - a[1]) or 1.0
            return x, n, (b[0] - a[0]) / mag, (b[1] - a[1]) / mag
    return coords[-1][0], coords[-1][1], 1.0, 0.0


def _clip_plane(poly, axis, bound, keep_greater):
    out = []
    for a, b in zip(poly, poly[1:] + poly[:1]):
        av, bv = a[axis], b[axis]
        ina = av >= bound - 1e-9 if keep_greater else av <= bound + 1e-9
        inb = bv >= bound - 1e-9 if keep_greater else bv <= bound + 1e-9
        if ina:
            out.append(a)
        if ina != inb:
            t = (bound - av) / (bv - av)
            out.append(tuple(a[q] + (b[q] - a[q]) * t for q in range(3)))
    return out


def _clip_triangle(tri, i, j):
    # Vertex layout here is east, elevation, north (converted to -north later).
    p = list(tri)
    for axis, bound, greater in ((0, i*TILE_M, True), (0, (i+1)*TILE_M, False),
                                 (2, j*TILE_M, True), (2, (j+1)*TILE_M, False)):
        if not p:
            break
        p = _clip_plane(p, axis, bound, greater)
    return [(p[0], p[k], p[k+1]) for k in range(1, len(p)-1)] if len(p) >= 3 else []


def build_highway_details(coords, width, tags, height, ground_at, blockers=None,
                          support_allowed=None, end_caps=(False, False),
                          end_setbacks=(END_CLEARANCE, END_CLEARANCE)):
    """Return ``{(i,j): {'h': (positions, colors), 'hl': (...)}}``.

    ``height(east, north)`` is the already-computed road-top elevation.
    Markings are full-detail only; bridge concrete is emitted at both levels.
    ``blockers(x, north, radius, top_height)`` may reject a proposed pier that
    intersects another road. ``support_allowed(x, north, radius)`` may reject
    water or other unsuitable foundations.  End faces are opt-in because an
    OSM bridge is commonly split into several connected ways. ``end_setbacks``
    independently controls the rail clearance at the two source endpoints.
    """
    coords = _clean_coords(coords)
    if len(coords) < 2 or width <= 0:
        return {}
    lengths = _samples(coords)
    total = lengths[-1]
    if total <= 1e-6:
        return {}
    out = defaultdict(lambda: {"h": ([], []), "hl": ([], [])})

    def emit(tri, color, lod=False):
        minx, maxx = min(p[0] for p in tri), max(p[0] for p in tri)
        minn, maxn = min(p[2] for p in tri), max(p[2] for p in tri)
        for i in range(math.floor(minx/TILE_M), math.floor(maxx/TILE_M)+1):
            for j in range(math.floor(minn/TILE_M), math.floor(maxn/TILE_M)+1):
                for clipped in _clip_triangle(tri, i, j):
                    converted = [(x, y, -n) for x, y, n in clipped]
                    for key in (("h", "hl") if lod else ("h",)):
                        out[(i, j)][key][0].extend(converted)
                        out[(i, j)][key][1].extend([color] * 3)

    def quad(a, b, c, d, color, lod=False):
        emit((a, b, c), color, lod); emit((a, c, d), color, lod)

    def oriented_quad(a, b, c, d, outward, color=CONCRETE, lod=True):
        """Emit a possibly warped quad with each triangle facing outward."""
        expected = outward
        for tri in ((a, b, c), (a, c, d)):
            rp = [(p[0], p[1], -p[2]) for p in tri]
            u = tuple(rp[1][q] - rp[0][q] for q in range(3))
            v = tuple(rp[2][q] - rp[0][q] for q in range(3))
            normal = (u[1]*v[2] - u[2]*v[1],
                      u[2]*v[0] - u[0]*v[2],
                      u[0]*v[1] - u[1]*v[0])
            if sum(normal[q] * expected[q] for q in range(3)) < 0:
                tri = (tri[0], tri[2], tri[1])
            emit(tri, color, lod)

    def prism(bottom, top):
        """Emit a closed outward-facing prism over a four-point footprint."""
        cx = sum(p[0] for p in bottom) / 4
        cn = sum(p[2] for p in bottom) / 4
        oriented_quad(*bottom, (0, -1, 0))
        oriented_quad(*top, (0, 1, 0))
        for k in range(4):
            a, b = bottom[k], bottom[(k + 1) % 4]
            expected = ((a[0] + b[0]) / 2 - cx, 0,
                        -((a[2] + b[2]) / 2 - cn))
            oriented_quad(a, b, top[(k + 1) % 4], top[k], expected)

    def ribbon(d0, d1, offset, ribbon_width, color):
        cuts = {d0, d1}
        cuts.update(v for v in lengths[1:-1] if d0 < v < d1)
        k = math.floor(d0/8.0)+1
        while k*8.0 < d1:
            cuts.add(k*8.0); k += 1
        cuts = sorted(cuts)
        for s, e in zip(cuts, cuts[1:]):
            a = _at(coords, lengths, s); b = _at(coords, lengths, e)
            la = offset + ribbon_width/2; ra = offset - ribbon_width/2
            y0, y1 = height(a[0], a[1]) + .14, height(b[0], b[1]) + .14
            p0 = (a[0]-a[3]*la, y0, a[1]+a[2]*la)
            p1 = (a[0]-a[3]*ra, y0, a[1]+a[2]*ra)
            p2 = (b[0]-b[3]*ra, y1, b[1]+b[2]*ra)
            p3 = (b[0]-b[3]*la, y1, b[1]+b[2]*la)
            quad(p0, p1, p2, p3, color)

    # Paint only classes that ordinarily carry motor-vehicle lane markings.
    # Calling this shared builder for path bridges must not turn their edges
    # into miniature yellow/white freeway shoulders.
    if tags.get("highway") in MARKED_HIGHWAYS:
        direction = str(tags.get("oneway", "")).lower()
        one_way = direction in {"yes", "1", "true", "-1"}
        link = str(tags.get("highway", "")).endswith("_link")
        left_shoulder, right_shoulder = ((.6, 1.5) if link else (1.2, 3.0))
        if left_shoulder + right_shoulder > width*.6:
            left_shoulder = right_shoulder = max(.3, width*.12)
        left_edge, right_edge = width/2-left_shoulder, -width/2+right_shoulder
        left_color = YELLOW if one_way and direction != "-1" else WHITE
        right_color = YELLOW if direction == "-1" else WHITE
        ribbon(0, total, left_edge, .16, left_color)
        ribbon(0, total, right_edge, .16, right_color)
        lanes = _lanes(tags)
        if lanes and lanes > 1:
            for lane in range(1, lanes):
                offset = left_edge - (left_edge-right_edge)*lane/lanes
                d = 2.0
                while d < total:
                    ribbon(d, min(d + 3.0, total), offset, .14, WHITE)
                    d += 9.0

    if not _bridge(tags):
        return dict(out)

    path_bridge = tags.get("highway") in PATH_HIGHWAYS
    deck_thickness = (max(.25, min(.45, width*.13)) if path_bridge
                      else max(.7, min(DECK_THICKNESS, width*.085)))

    # One shared cross-section per source node closes bends without overlapping
    # segment curtains.  Lateral vertices sample the same height function used
    # by the road ribbon, so the asphalt and deck shell make exact contact.
    frames = _vertex_frames(coords)
    sections = []
    for (x, n), (tx, tn, lx, ln) in zip(coords, frames):
        left_xy = (x + lx*width/2, n + ln*width/2)
        right_xy = (x - lx*width/2, n - ln*width/2)
        left = (left_xy[0], height(*left_xy), left_xy[1])
        right = (right_xy[0], height(*right_xy), right_xy[1])
        sections.append((left, right,
                         (left[0], left[1]-deck_thickness, left[2]),
                         (right[0], right[1]-deck_thickness, right[2]),
                         (tx, tn, lx, ln)))
    for a, b in zip(sections, sections[1:]):
        al, ar, abl, abr, af = a
        bl, br, bbl, bbr, bf = b
        left_out = ((af[2] + bf[2]) / 2, 0, -(af[3] + bf[3]) / 2)
        right_out = (-left_out[0], 0, -left_out[2])
        oriented_quad(al, bl, bbl, abl, left_out)
        oriented_quad(ar, abr, bbr, br, right_out)
        oriented_quad(abl, bbl, bbr, abr, (0, -1, 0))
    for k, enabled in enumerate(end_caps):
        if not enabled:
            continue
        left, right, below_left, below_right, frame = sections[0 if k == 0 else -1]
        direction = -1 if k == 0 else 1
        outward = (direction*frame[0], 0, -direction*frame[1])
        oriented_quad(left, right, below_right, below_left, outward)

    # Low continuous edge rails.  Every bend is a cut so adjacent pieces share
    # vertices; intermediate 18 m cuts bound triangle size without end-capping
    # each piece.
    start_setback = min(total, max(0.0, float(end_setbacks[0])))
    end_setback = min(total, max(0.0, float(end_setbacks[1])))
    if total > start_setback + end_setback + 1e-7:
        for side in (-1, 1):
            rail_half = .05 if path_bridge else .15
            rail_base = 1.0 if path_bridge else .04
            rail_height = .10 if path_bridge else .8
            d0, d1 = start_setback, total-end_setback
            cuts = {d0, d1}
            cuts.update(d for d in lengths[1:-1] if d0 < d < d1)
            d = d0 + 18.0
            while d < d1:
                cuts.add(d); d += 18.0
            rail = []
            for d in sorted(cuts):
                x, n, tx, tn, lx, ln = _frame_at(coords, lengths, frames, d)
                center = side*(width/2-.12)
                inner_off, outer_off = center-side*rail_half, center+side*rail_half
                inner_xy = (x+lx*inner_off, n+ln*inner_off)
                outer_xy = (x+lx*outer_off, n+ln*outer_off)
                inner = (inner_xy[0], height(*inner_xy)+rail_base, inner_xy[1])
                outer = (outer_xy[0], height(*outer_xy)+rail_base, outer_xy[1])
                rail.append((inner, outer,
                             (inner[0], inner[1]+rail_height, inner[2]),
                             (outer[0], outer[1]+rail_height, outer[2]),
                             (tx, tn, lx, ln)))
            for a, b in zip(rail, rail[1:]):
                ai, ao, ait, aot, af = a
                bi, bo, bit, bot, bf = b
                lateral = ((af[2]+bf[2])/2, 0, -(af[3]+bf[3])/2)
                oriented_quad(ai, bi, bit, ait, tuple(-side*v for v in lateral))
                oriented_quad(ao, aot, bot, bo, tuple(side*v for v in lateral))
                oriented_quad(ait, bit, bot, aot, (0, 1, 0))
                oriented_quad(ai, ao, bo, bi, (0, -1, 0))
            for k, row in enumerate((rail[0], rail[-1])):
                # A zero setback denotes a continuous rail on an adjacent way;
                # leave that cross-section open instead of stacking coplanar
                # end faces at the shared OSM node.
                if (start_setback, end_setback)[k] <= 1e-7:
                    continue
                inner, outer, inner_top, outer_top, frame = row
                direction = -1 if k == 0 else 1
                outward = (direction*frame[0], 0, -direction*frame[1])
                oriented_quad(inner, inner_top, outer_top, outer, outward)
            if path_bridge:
                post_d = d0
                while post_d <= d1 + 1e-7:
                    x, n, tx, tn, lx, ln = _frame_at(
                        coords, lengths, frames, min(post_d, d1))
                    lmag = math.hypot(lx, ln) or 1.0
                    lx, ln = lx/lmag, ln/lmag
                    cx, cn = x+lx*side*(width/2-.12), n+ln*side*(width/2-.12)
                    r=.045
                    xy=[]
                    for along, across in ((-r,-r),(r,-r),(r,r),(-r,r)):
                        xy.append((cx+tx*along+lx*across,
                                   cn+tn*along+ln*across))
                    base_y=height(cx,cn)+.04
                    prism([(px,base_y,pn) for px,pn in xy],
                          [(px,base_y+1.06,pn) for px,pn in xy])
                    if post_d >= d1:
                        break
                    post_d = min(post_d+6.0, d1)

    # Piers: no invented mechanism on mapped opening spans and no center-column
    # shortcut on tiny bridges.  Eligible longer ways use evenly spaced bents.
    pier_distances = []
    if total >= MIN_PIER_SPAN and not _opening_bridge(tags):
        count = max(2, int(math.ceil(total/PIER_SPACING))-1)
        pier_distances = [total*k/(count+1) for k in range(1, count+1)]
    for d in pier_distances:
        x, n, tx, tn = _at(coords, lengths, d)
        deck_bottom = height(x, n)-deck_thickness
        offsets = (-width*.22, width*.22) if width >= 12 else (0.0,)
        columns = []
        for off in offsets:
            cx, cn = x-tn*off, n+tx*off
            if blockers and blockers(cx, cn, .7, deck_bottom):
                continue
            if support_allowed and not support_allowed(cx, cn, .7):
                continue
            r=.48
            xy=[(cx-r,cn-r),(cx+r,cn-r),(cx+r,cn+r),(cx-r,cn+r)]
            grounds=[ground_at(px,pn) for px,pn in xy]
            if not all(math.isfinite(gy) for gy in grounds) or max(grounds) >= deck_bottom-.4:
                continue
            # Sink each corner slightly into its sampled terrain so a sloped
            # foundation cannot leave a visibly floating column edge.
            bottom=[(px,gy-.05,pn) for (px,pn),gy in zip(xy,grounds)]
            top=[(px,deck_bottom-.35,pn) for px,pn in xy]
            prism(bottom,top)
            columns.append((cx,cn))
        if columns:
            # cap beam under the deck, oriented across the carriageway
            half=width*.43; depth=.45; thick=.45
            y=deck_bottom
            bottom=[]
            for across,along in ((-half,-depth),(half,-depth),(half,depth),(-half,depth)):
                bottom.append((x-tn*across+tx*along,y-thick,n+tx*across+tn*along))
            top=[(px,y,pn) for px,_,pn in bottom]
            prism(bottom,top)
    return dict(out)
