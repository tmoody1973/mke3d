"""Focused network-profile regressions, including cached Milwaukee fixtures."""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from highway_profiles import (MAX_APPROACH_GRADE, PATH_GRADE, STEPS_GRADE,
                              _grade_limit, build_profiles, is_bridge)


def way(wid, coords, highway="motorway", **tags):
    return {"type": "way", "id": wid, "geometry": coords,
            "tags": {"highway": highway, **tags}}


def profiles(elements, ground=lambda x, y: 0, skip_fn=lambda e: False):
    rows = [(e, e["tags"], e["geometry"]) for e in elements]
    return build_profiles(rows, ground, skip_fn=skip_fn)


def test_cached_marquette_cantilevers_are_elevated_above_sampled_terrain():
    # Consecutive coordinates copied from cached Geofabrik ways 19849982
    # (I-94) and 176724145 (I-94 connector).
    low = way(19849982, [(-87.9281681, 43.0355912), (-87.92669, 43.0354829),
        (-87.9253921, 43.0352009), (-87.9240792, 43.0344598),
        (-87.9232316, 43.0332991)], bridge="cantilever", layer="1", lanes="2")
    high = way(176724145, [(-87.9223231, 43.0336374), (-87.9229722, 43.034774),
        (-87.9234758, 43.0352131), (-87.9241754, 43.0356143),
        (-87.9259609, 43.036049)], highway="motorway_link",
        bridge="cantilever", layer="5", lanes="2")
    terrain = lambda x, y: 2.0 + 20.0 * (y - 43.034)
    p = profiles([low, high], terrain)
    assert is_bridge(low["tags"])
    assert p[id(high)](*high["geometry"][2]) > p[id(low)](*low["geometry"][2]) + 5.0


def test_every_bridge_class_spans_an_adverse_valley_from_surface_abutments():
    ground = lambda x, y: -30.0 if 0 < x < 100 else 10.0
    for n, highway in enumerate(("primary", "secondary", "residential", "service", "footway"), 1):
        left = way(n * 10, [(-60, 0), (0, 0)], highway=highway)
        bridge = way(n * 10 + 1, [(0, 0), (50, 0), (100, 0)],
                     highway=highway, bridge="yes", layer="1")
        right = way(n * 10 + 2, [(100, 0), (160, 0)], highway=highway)
        p = profiles([left, bridge, right], ground)
        assert id(bridge) in p
        assert math.isclose(p[id(bridge)](50, 0), 10.4, abs_tol=1e-6)
        left_height = p.get(id(left), lambda x, y: ground(x, y) + .4)(0, 0)
        right_height = p.get(id(right), lambda x, y: ground(x, y) + .4)(100, 0)
        assert math.isclose(left_height, p[id(bridge)](0, 0), abs_tol=1e-6)
        assert math.isclose(right_height, p[id(bridge)](100, 0), abs_tol=1e-6)


def test_split_bridge_tags_share_exact_deck_height_without_a_way_end_seam():
    approach = way(1, [(-100, 0), (0, 0)], highway="primary")
    first = way(2, [(0, 0), (80, 0)], highway="primary", bridge="yes", layer="1")
    second = way(3, [(80, 0), (180, 0)], highway="primary", bridge="viaduct", layer="2")
    exit_way = way(4, [(180, 0), (280, 0)], highway="primary")
    p = profiles([approach, first, second, exit_way], lambda x, y: x / 100.0)
    assert math.isclose(p[id(first)](80, 0), p[id(second)](80, 0), abs_tol=1e-8)
    approach_height = p.get(id(approach), lambda x, y: x / 100.0 + .4)(0, 0)
    exit_height = p.get(id(exit_way), lambda x, y: x / 100.0 + .4)(180, 0)
    assert math.isclose(approach_height, p[id(first)](0, 0), abs_tol=1e-8)
    assert math.isclose(p[id(second)](180, 0), exit_height, abs_tol=1e-8)


def test_fixed_bridge_grade_propagates_across_split_ramp_without_vertical_jump():
    bridge = way(1, [(0, 0), (80, 0)], bridge="yes", layer="2")
    ramp_a = way(2, [(80, 0), (130, 0)], highway="motorway_link")
    ramp_b = way(3, [(130, 0), (230, 0)], highway="motorway_link")
    mainline = way(4, [(230, 0), (330, 0)])
    elements = [bridge, ramp_a, ramp_b, mainline]
    p = profiles(elements, skip_fn=lambda e: e is bridge)
    nodes = [(bridge, 80), (ramp_a, 80), (ramp_a, 130), (ramp_b, 130),
             (ramp_b, 230), (mainline, 230), (mainline, 330)]
    heights = {(id(e), x): p[id(e)](x, 0) for e, x in nodes}
    assert math.isclose(heights[(id(bridge), 80)], heights[(id(ramp_a), 80)])
    assert math.isclose(heights[(id(ramp_a), 130)], heights[(id(ramp_b), 130)])
    assert math.isclose(heights[(id(ramp_b), 230)], heights[(id(mainline), 230)])
    for element in (ramp_a, ramp_b, mainline):
        a, b = element["geometry"]
        grade = abs(p[id(element)](*b) - p[id(element)](*a)) / math.dist(a, b)
        assert grade <= MAX_APPROACH_GRADE + 1e-9


def test_grade_separated_crossings_and_nearby_source_points_do_not_join():
    low = way(10, [(-100, 0), (100, 0)], bridge="cantilever", layer="1")
    high = way(11, [(0, -100), (0, 100)], highway="trunk_link", bridge="yes", layer="5")
    nearby = way(12, [(100, 0.0004), (160, 0.0004)], highway="primary")
    p = profiles([low, high, nearby])
    assert p[id(high)](0, 0) - p[id(low)](0, 0) >= 4 * 7.0
    assert id(nearby) not in p


def test_local_bank_grade_bridge_rises_only_where_it_crosses_a_lower_road():
    west = way(20, [(-200, 0), (-100, 0)], highway="secondary")
    bridge = way(21, [(-100, 0), (100, 0)], highway="secondary",
                 bridge="movable", layer="1")
    east = way(22, [(100, 0), (200, 0)], highway="secondary")
    lower = way(23, [(0, -100), (0, 100)], highway="residential")
    p = profiles([west, bridge, east, lower])
    assert math.isclose(p[id(bridge)](-100, 0), .4, abs_tol=1e-8)
    assert math.isclose(p[id(bridge)](100, 0), .4, abs_tol=1e-8)
    assert p[id(bridge)](0, 0) - .4 >= 5.4 - 1e-8
    assert (p[id(bridge)](0, 0) - p[id(bridge)](-100, 0)) / 100 <= MAX_APPROACH_GRADE


def test_explicit_bridge_height_overrides_layer_fallback_but_not_clearance_tags():
    explicit = way(1, [(0, 0), (100, 0)], highway="service", bridge="yes",
                   height="12", maxheight="3.5", layer="1")
    p = profiles([explicit])
    assert math.isclose(p[id(explicit)](50, 0), 12.4, abs_tol=1e-6)


def test_skipped_proxy_endpoint_remains_fixed_when_connected_deck_is_raised():
    forced = way(1, [(0, 0), (100, 0)], bridge="yes", layer="2")
    connected = way(2, [(100, 0), (110, 0), (300, 0)], bridge="yes", layer="1")
    lower = way(3, [(110, -20), (110, 20)], highway="residential")
    terrain = lambda x, y: 20.0 if abs(x - 110) < 1e-8 else 0.0
    p = profiles([forced, connected, lower], terrain, skip_fn=lambda e: e is forced)
    assert math.isclose(p[id(forced)](0, 0), 14.4, abs_tol=1e-8)
    assert math.isclose(p[id(forced)](100, 0), 14.4, abs_tol=1e-8)
    assert math.isclose(p[id(connected)](100, 0), 14.4, abs_tol=1e-8)


def test_grade_limits_allow_short_paths_and_steps_to_climb_without_lifting_network():
    assert _grade_limit({"highway": "motorway_link"}) == MAX_APPROACH_GRADE
    assert _grade_limit({"highway": "secondary"}) == .12
    assert _grade_limit({"highway": "footway"}) == PATH_GRADE
    assert _grade_limit({"highway": "steps"}) == STEPS_GRADE


if __name__ == "__main__":
    for name, fn in sorted(globals().copy().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
