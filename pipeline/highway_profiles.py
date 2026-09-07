"""Conservative, topology-based vertical profiles for OSM roads and bridges.

The source extract does not retain OSM node ids, but repeated source
coordinates survive projection exactly. Those exact coordinates are the only
places where profiles join; a geometric crossing is never a junction.
"""
from collections import defaultdict
from functools import lru_cache
import heapq
import math
import re

from shapely.geometry import LineString
from shapely.strtree import STRtree

try:
    from config import LAKE_DATUM_M
except ImportError:  # Keep the small module usable in isolation.
    LAKE_DATUM_M = 176.5


FREEWAYS = {"motorway", "motorway_link", "trunk", "trunk_link"}
FALSE = {None, "", "no", "false", "0"}
ROAD_SURFACE = 0.4
FIXED_BRIDGE_LIFT = 14.4
MAX_APPROACH_GRADE = 0.08
LOCAL_ROAD_GRADE = 0.12
PATH_GRADE = 0.20
STEPS_GRADE = 0.65
MIN_CROSSING_CLEARANCE = 5.4
PEDESTRIAN_CLEARANCE = 2.7
NON_VEHICLE = {"footway", "cycleway", "path", "steps", "pedestrian", "bridleway", "track"}
APPROACH_SAMPLE_M = 30.0


def point_key(point):
    """Exact key for an original (not densified) source coordinate."""
    return float(point[0]), float(point[1])


def is_bridge(tags):
    """OSM bridge values are open-ended (for example ``cantilever``)."""
    return str(tags.get("bridge", "")).strip().lower() not in FALSE


def layer(tags):
    try:
        return int(str(tags.get("layer", "1")).split(";")[0])
    except (TypeError, ValueError):
        return 1


def _length_m(value):
    """Parse the small subset of OSM length syntax useful for bridge tags."""
    if value is None:
        return None
    text = str(value).strip().lower().replace(",", ".")
    match = re.match(r"^\s*(-?\d+(?:\.\d+)?)\s*([a-z']*)", text)
    if not match:
        return None
    number = float(match.group(1))
    unit = match.group(2)
    if unit in {"ft", "foot", "feet", "'"}:
        number *= 0.3048
    elif unit == "cm":
        number /= 100.0
    return number if math.isfinite(number) else None


def _tagged_height(tags, ground):
    """Return an explicit deck height in scene meters when OSM supplies one.

    ``ele`` is an absolute elevation and is converted to the project's lake
    datum. ``bridge:height`` and ``height`` are treated as a vertical lift;
    clearance restrictions such as ``maxheight`` are deliberately ignored.
    """
    elevation = _length_m(tags.get("ele"))
    if elevation is not None:
        return elevation - LAKE_DATUM_M
    lift = _length_m(tags.get("bridge:height"))
    if lift is None:
        lift = _length_m(tags.get("height"))
    if lift is not None and lift > 0:
        return ground + ROAD_SURFACE + lift
    return None


def _distances(coords):
    out = [0.0]
    for a, b in zip(coords, coords[1:]):
        out.append(out[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    return out


def _point_away(coords, index, direction, distance):
    """Walk from a source vertex in one direction and return a sample point."""
    remaining = distance
    current = coords[index]
    i = index
    while 0 <= i + direction < len(coords):
        following = coords[i + direction]
        segment = math.hypot(following[0] - current[0], following[1] - current[1])
        if segment >= remaining and segment:
            t = remaining / segment
            return (current[0] + (following[0] - current[0]) * t,
                    current[1] + (following[1] - current[1]) * t)
        remaining -= segment
        current = following
        i += direction
    return current if current != coords[index] else None


def _project_distance(coords, distances, x, y):
    best_d, best_q = 0.0, float("inf")
    for k, (a, b) in enumerate(zip(coords, coords[1:])):
        dx, dy = b[0] - a[0], b[1] - a[1]
        denominator = dx * dx + dy * dy
        t = max(0.0, min(1.0, ((x - a[0]) * dx + (y - a[1]) * dy) /
                              denominator)) if denominator else 0.0
        px, py = a[0] + t * dx, a[1] + t * dy
        q = (x - px) ** 2 + (y - py) ** 2
        if q < best_q:
            best_q = q
            best_d = distances[k] + t * (distances[k + 1] - distances[k])
    return best_d


def _interpolate(samples, distance):
    if distance <= samples[0][0]:
        return samples[0][1]
    if distance >= samples[-1][0]:
        return samples[-1][1]
    for (d0, h0), (d1, h1) in zip(samples, samples[1:]):
        if d0 <= distance <= d1:
            t = (distance - d0) / (d1 - d0) if d1 != d0 else 0.0
            return h0 + (h1 - h0) * t
    return samples[-1][1]


def _components(structural, records):
    """Yield bridge-way components connected only by exact source nodes."""
    node_ways = defaultdict(list)
    for way_index in structural:
        for point in records[way_index][2]:
            node_ways[point_key(point)].append(way_index)
    neighbors = defaultdict(set)
    for attached in node_ways.values():
        for way_index in attached:
            neighbors[way_index].update(attached)
    unseen = set(structural)
    while unseen:
        seed = unseen.pop()
        component = {seed}
        stack = [seed]
        while stack:
            for other in neighbors[stack.pop()]:
                if other in unseen:
                    unseen.remove(other)
                    component.add(other)
                    stack.append(other)
        yield component


def _solve_component(component, records, incidence, ground_at, skip_fn, clearance):
    """Solve one bridge graph with fixed abutments and harmonic interiors."""
    graph = defaultdict(dict)
    structural_at = defaultdict(list)
    for way_index in component:
        _, _, coords = records[way_index]
        for point in coords:
            structural_at[point_key(point)].append(way_index)
        for a, b in zip(coords, coords[1:]):
            ka, kb = point_key(a), point_key(b)
            distance = math.hypot(b[0] - a[0], b[1] - a[1])
            if not distance:
                continue
            old = graph[ka].get(kb)
            graph[ka][kb] = graph[kb][ka] = distance if old is None else min(old, distance)

    fixed = defaultdict(list)
    forced = defaultdict(list)
    explicit = defaultdict(list)
    # Actual surface-road incidences provide the best available abutment datum.
    for node in structural_at:
        samples = []
        for way_index, coord_index in incidence[node]:
            if way_index in component or is_bridge(records[way_index][1]):
                continue
            coords = records[way_index][2]
            for direction in (-1, 1):
                point = _point_away(coords, coord_index, direction, APPROACH_SAMPLE_M)
                if point is not None:
                    samples.append(ground_at(*point) + ROAD_SURFACE)
        if samples:
            samples.sort()
            approach = samples[len(samples) // 2]
            local_layer = max(layer(records[i][1]) for i in structural_at[node])
            elevated = any(records[i][1].get("highway") in FREEWAYS
                           for i in structural_at[node])
            # A local river or movable bridge normally meets the bank at road
            # grade. OSM layer orders features; it is not a metric height.
            # Freeways are the sole connected-approach exception because their
            # mapped bridge sequences represent explicitly elevated decks.
            lift = max(local_layer, 1) * clearance if elevated else 0.0
            fixed[node].append(max(ground_at(*node) + ROAD_SURFACE,
                                   approach + lift))

    for way_index in component:
        element, tags, coords = records[way_index]
        if skip_fn(element):
            for point in (coords[0], coords[-1]):
                forced[point_key(point)].append(ground_at(*point) + FIXED_BRIDGE_LIFT)
        for point in coords:
            tagged = _tagged_height(tags, ground_at(*point))
            if tagged is not None:
                explicit[point_key(point)].append(max(tagged, ground_at(*point) + ROAD_SURFACE))

    # A terminal without a mapped surface continuation needs a conservative
    # fallback. It is the only place where layer*clearance is used as height.
    terminals = [node for node in structural_at if len(graph[node]) <= 1]
    for node in terminals:
        if node in fixed or node in forced or node in explicit:
            continue
        local_layer = max(layer(records[i][1]) for i in structural_at[node])
        fixed[node].append(ground_at(*node) + ROAD_SURFACE + max(local_layer, 1) * clearance)
    if not fixed and not forced and not explicit:
        node = next(iter(structural_at))
        local_layer = max(layer(records[i][1]) for i in structural_at[node])
        fixed[node].append(ground_at(*node) + ROAD_SURFACE + max(local_layer, 1) * clearance)

    locked = {}
    for node in structural_at:
        if node in forced:
            locked[node] = max(forced[node])
        elif node in explicit:
            locked[node] = max(explicit[node])
        elif node in fixed:
            locked[node] = max(fixed[node])
    initial = sum(locked.values()) / len(locked)
    heights = {node: locked.get(node, initial) for node in structural_at}
    # Weighted graph relaxation is exactly linear on an unbranched chain and
    # gives a single shared height at bridge merges and splits.
    for _ in range(1000):
        change = 0.0
        for node in sorted(structural_at):
            if node in locked or not graph[node]:
                continue
            weighted = [(1.0 / distance, heights[other])
                        for other, distance in graph[node].items()]
            value = sum(weight * height for weight, height in weighted) / sum(
                weight for weight, _ in weighted)
            change = max(change, abs(value - heights[node]))
            heights[node] = value
        if change < 1e-5:
            break
    return heights


def _road_layer(tags):
    """OSM's ordinary default is layer zero; bridge fallback differs."""
    try:
        return int(str(tags.get("layer", "0")).split(";")[0])
    except (TypeError, ValueError):
        return 0


def _vertical_rank(tags):
    """Comparable OSM stacking rank, with freeways winning ambiguous ties."""
    return (_road_layer(tags), tags.get("highway") in FREEWAYS)


def _grade_limit(tags):
    highway = tags.get("highway")
    if highway in FREEWAYS:
        return MAX_APPROACH_GRADE
    if highway == "steps":
        return STEPS_GRADE
    if highway in NON_VEHICLE:
        return PATH_GRADE
    return LOCAL_ROAD_GRADE


def _profile_samples(coords, targets, extras=()):
    distances = _distances(coords)
    source = [(distance, targets[point_key(point)])
              for point, distance in zip(coords, distances)]
    merged = {distance: height for distance, height in source}
    for distance, required in extras:
        merged[distance] = max(merged.get(distance, -math.inf), required,
                               _interpolate(source, distance))
    return distances, sorted(merged.items())


def _intersection_points(geometry):
    if geometry.geom_type == "Point":
        return (geometry,)
    if geometry.geom_type == "MultiPoint":
        return geometry.geoms
    return ()


def _raise_crossings(records, structural, deck_targets, ground_at, skip_fn,
                     approach_corrections=None, extras=None):
    """Add smooth interior anchors wherever a mapped bridge crosses a road.

    Layer is used only to decide stack order. The resulting height comes from
    the lower road plus physical clearance, never from ``layer * clearance``.
    """
    lines = [LineString(coords) for _, _, coords in records]
    tree = STRtree(lines)
    by_geometry = {id(line): index for index, line in enumerate(lines)}
    graph = defaultdict(dict)
    immutable = set()
    for way_index in structural:
        element, _, coords = records[way_index]
        if skip_fn(element):
            immutable.update((point_key(coords[0]), point_key(coords[-1])))
        for a, b in zip(coords, coords[1:]):
            ka, kb = point_key(a), point_key(b)
            distance = math.hypot(b[0] - a[0], b[1] - a[1])
            if distance:
                cost = _grade_limit(records[way_index][1]) * distance
                old = graph[ka].get(kb)
                graph[ka][kb] = graph[kb][ka] = cost if old is None else min(old, cost)

    approach_corrections = approach_corrections or {}
    extras = extras or defaultdict(list)
    raised_crossings = 0

    def deck_height(way_index, x, y):
        coords = records[way_index][2]
        distances, samples = _profile_samples(coords, deck_targets, extras[way_index])
        return _interpolate(samples, _project_distance(coords, distances, x, y))

    def propagate(seeds):
        queue = []
        for node, height in seeds.items():
            if node in immutable:
                continue
            if height > deck_targets[node] + 1e-9:
                deck_targets[node] = height
                heapq.heappush(queue, (-height, node))
        while queue:
            negative_height, node = heapq.heappop(queue)
            height = -negative_height
            if height != deck_targets[node]:
                continue
            for other, vertical_drop in graph[node].items():
                if other in immutable:
                    continue
                candidate = height - vertical_drop
                if candidate > deck_targets[other] + 1e-9:
                    deck_targets[other] = candidate
                    heapq.heappush(queue, (-candidate, other))

    # Lower bridge decks are resolved first so a higher layer sees their final
    # crossing elevation rather than the initial harmonic estimate.
    for way_index in sorted(structural, key=lambda i: _vertical_rank(records[i][1])):
        element, tags, coords = records[way_index]
        if skip_fn(element):
            continue
        line = lines[way_index]
        coord_set = set(coords)
        source_distances = _distances(coords)
        for hit in tree.query(line):
            other_index = (int(hit) if not hasattr(hit, "geom_type")
                           else by_geometry[id(hit)])
            if other_index == way_index:
                continue
            other_element, other_tags, other_coords = records[other_index]
            if other_index in structural and skip_fn(other_element):
                continue
            if _vertical_rank(tags) <= _vertical_rank(other_tags):
                continue
            intersection = line.intersection(lines[other_index])
            shared = coord_set.intersection(other_coords)
            for point in _intersection_points(intersection):
                xy = (point.x, point.y)
                if any(math.hypot(xy[0] - source[0], xy[1] - source[1]) <= 1e-6
                       for source in shared):
                    continue
                lower = (deck_height(other_index, *xy) if other_index in structural
                         else None)
                if lower is None:
                    other_distances = _distances(other_coords)
                    correction_samples = [(distance, approach_corrections.get(
                        point_key(source), 0.0)) for source, distance in
                        zip(other_coords, other_distances)]
                    lower = (ground_at(*xy) + ROAD_SURFACE +
                             _interpolate(correction_samples, _project_distance(
                                 other_coords, other_distances, *xy)))
                required = lower + (PEDESTRIAN_CLEARANCE
                                    if other_tags.get("highway") in NON_VEHICLE
                                    else MIN_CROSSING_CLEARANCE)
                current = deck_height(way_index, *xy)
                if current >= required - 1e-9:
                    continue
                raised_crossings += 1
                distance = _project_distance(coords, source_distances, *xy)
                extras[way_index].append((distance, required))
                segment = max(0, min(len(coords) - 2,
                    next((k for k in range(len(source_distances) - 1)
                          if source_distances[k] <= distance <= source_distances[k + 1]),
                         len(coords) - 2)))
                seeds = {
                    point_key(coords[segment]):
                        required - _grade_limit(tags) * (distance - source_distances[segment]),
                    point_key(coords[segment + 1]):
                        required - _grade_limit(tags) * (source_distances[segment + 1] - distance),
                }
                propagate(seeds)
    return extras, raised_crossings


def _surface_approaches(records, structural, deck_targets, ground_at):
    """Propagate bridge endpoint corrections through the exact road graph."""
    surface_graph = defaultdict(dict)
    for _, tags, coords in records:
        if is_bridge(tags):
            continue
        for a, b in zip(coords, coords[1:]):
            ka, kb = point_key(a), point_key(b)
            distance = math.hypot(b[0] - a[0], b[1] - a[1])
            if not distance:
                continue
            cost = _grade_limit(tags) * distance
            old = surface_graph[ka].get(kb)
            surface_graph[ka][kb] = surface_graph[kb][ka] = cost if old is None else min(old, cost)

    corrections = {}
    locked = set()
    queue = []
    for node, target in deck_targets.items():
        if node not in surface_graph:
            continue
        correction = max(0.0, target - (ground_at(*node) + ROAD_SURFACE))
        corrections[node] = correction
        locked.add(node)
        if correction > 0:
            heapq.heappush(queue, (-correction, node))
    while queue:
        negative_correction, node = heapq.heappop(queue)
        correction = -negative_correction
        if correction != corrections.get(node):
            continue
        for other, vertical_drop in surface_graph[node].items():
            if other in locked:
                continue
            candidate = correction - vertical_drop
            if candidate > 1e-9 and candidate > corrections.get(other, -math.inf):
                corrections[other] = candidate
                heapq.heappush(queue, (-candidate, other))
    return corrections


def build_profiles(ways, ground_at, *, skip_fn=lambda e: False, clearance=7.0):
    """Return ``{id(element): height(x, y)}`` for roads needing a profile.

    Every freeway keeps a profile for highway-detail generation. Every bridge,
    regardless of highway class, gets a topology-based deck. Other roads are
    included only when an exact source node receives a bridge approach grade.
    """
    records = [(element, tags, tuple(tuple(point) for point in coords))
               for element, tags, coords in ways if tags.get("highway") and len(coords) >= 2]
    incidence = defaultdict(list)
    for way_index, (_, _, coords) in enumerate(records):
        for coord_index, point in enumerate(coords):
            incidence[point_key(point)].append((way_index, coord_index))
    structural = {i for i, (_, tags, _) in enumerate(records) if is_bridge(tags)}

    deck_targets = {}
    for component in _components(structural, records):
        deck_targets.update(_solve_component(component, records, incidence, ground_at,
                                             skip_fn, clearance))
    crossing_samples = defaultdict(list)
    approach_corrections = {}
    # A second pass sees roads raised by a different bridge approach. Stack
    # rank is acyclic, so three bounded passes resolve the cached network while
    # avoiding an open-ended geometric relaxation.
    for _ in range(3):
        crossing_samples, raised = _raise_crossings(
            records, structural, deck_targets, ground_at, skip_fn,
            approach_corrections, crossing_samples)
        approach_corrections = _surface_approaches(
            records, structural, deck_targets, ground_at)
        if not raised:
            break

    result = {}
    for way_index, (element, tags, coords) in enumerate(records):
        distances = _distances(coords)
        structural_way = way_index in structural
        if structural_way:
            distances, samples = _profile_samples(coords, deck_targets,
                                                  crossing_samples[way_index])
        else:
            corrections = [(distance, max(0.0, approach_corrections.get(point_key(point), 0.0)))
                           for point, distance in zip(coords, distances)]
            affected = any(correction > 1e-9 for _, correction in corrections)
            if tags.get("highway") not in FREEWAYS and not affected:
                continue
            samples = corrections

        @lru_cache(maxsize=4096)
        def height(x, y, *, coords=coords, distances=distances, samples=samples,
                   structural_way=structural_way):
            distance = _project_distance(coords, distances, x, y)
            value = _interpolate(samples, distance)
            if structural_way:
                return value
            return ground_at(x, y) + ROAD_SURFACE + value

        result[id(element)] = height
    return result
