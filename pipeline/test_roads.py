"""Focused road mesh checks. Run: pipeline/.venv/bin/python pipeline/test_roads.py"""
import math
import sys
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon

sys.path.insert(0, str(Path(__file__).parent))
import roads


def way(coords, **tags):
    return {"type": "way", "geometry": coords, "tags": {"highway": "residential", **tags}}


def coords(e): return e["geometry"]


def test_width_priority_and_path_mapping():
    assert roads.road_width({"highway": "primary", "width": "20 ft", "lanes": "4"}) == 6.096
    assert math.isclose(roads.road_width({"highway": "residential", "lanes": "3"}), 9.6)
    assert roads.road_width({"highway": "cycleway"}) == 2.4
    assert roads.road_width({"highway": "track"}) == 3.0
    assert math.isclose(roads.road_width({"highway": "motorway", "oneway": "yes"}), 11.52)
    assert math.isclose(roads.road_width({"highway": "motorway", "lanes": "3"}), 15.18)
    assert math.isclose(roads.road_width({"highway": "motorway_link"}), 5.76)
    assert roads.road_width({"highway": "primary", "oneway": "yes"}) == 6.4
    assert roads._color({"highway": "cycleway", "surface": "asphalt"}) == roads.ASPHALT


def test_layer_without_bridge_drapes_ground():
    mesh = roads.build_roads([way([(0, 0), (100, 0)], layer="3")], coords, lambda x, y: x / 10)
    ys = np.concatenate([np.array(tile["r"][0])[:, 1] for tile in mesh.values()])
    assert ys.min() < 1 and ys.max() > 9, "layer alone must not create a raised deck"


def test_bridge_is_linear_and_does_not_dip_into_valley():
    ground = lambda x, y: 10 if x < 1 or x > 99 else -30
    mesh = roads.build_roads([way([(0, 0), (100, 0)], bridge="yes", layer="2")], coords, ground)
    ys = np.array(next(iter(mesh.values()))["r"][0])[:, 1]
    assert np.allclose(ys, 24.4), ys


def test_tile_clipping_and_upward_winding():
    mesh = roads.build_roads([way([(1990, 0), (2010, 0)], highway="primary")], coords, lambda x, y: 0)
    assert (0, -1) in mesh and (1, 0) in mesh  # round caps/ribbon cross both axes and x tiles
    for (i, j), tile in mesh.items():
        tri = np.asarray(tile["r"][0]).reshape(-1, 3, 3)
        assert tri[:, :, 0].min() >= i * 2000 - 1e-8 and tri[:, :, 0].max() <= (i + 1) * 2000 + 1e-8
        north = -tri[:, :, 2]
        assert north.min() >= j * 2000 - 1e-8 and north.max() <= (j + 1) * 2000 + 1e-8
        normals = np.cross(tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0])
        assert (normals[:, 1] > 0).all()


def test_bridge_transition_and_skip():
    bridge = way([(0, 0), (100, 0)], bridge="yes", layer="2")
    approach = way([(-100, 0), (0, 0)])
    skipped = way([(0, 50), (100, 50)], bridge="yes")
    mesh = roads.build_roads([bridge, approach, skipped], coords, lambda x, y: 0, lambda e: e is skipped)
    pts = np.concatenate([np.asarray(v["r"][0]) for v in mesh.values()])
    near = pts[(np.abs(pts[:, 0]) < 1e-8) & (np.abs(pts[:, 2]) < 5), 1]
    assert near.size and np.allclose(near, .4), "a connected local bridge must meet bank-grade approaches"
    assert not np.any(np.isclose(pts[:, 2], -50))


def test_area_highway_is_ignored_and_long_edges_are_subdivided():
    area = way([(0, 0), (100, 0), (100, 20), (0, 0)], area="yes")
    road = way([(0, 0), (300, 0)])
    mesh = roads.build_roads([area, road], coords, lambda x, y: 0)
    tri = np.concatenate([np.asarray(v["r"][0]).reshape(-1, 3, 3) for v in mesh.values()])
    edges = np.concatenate([tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 1], tri[:, 0] - tri[:, 2]])
    assert np.linalg.norm(edges[:, [0, 2]], axis=1).max() <= 20.000001


def test_short_approach_continues_a_gentle_grade_through_the_next_way():
    bridge = way([(0, 0), (50, 0)], highway="motorway", bridge="yes", layer="2")
    approach = way([(-20, 0), (0, 0)], highway="motorway")
    next_way = way([(-300, 0), (-20, 0)], highway="motorway")
    mesh = roads.build_roads([bridge, approach, next_way], coords, lambda x, y: 0,
                             lambda e: e is bridge)
    pts = np.concatenate([np.asarray(v["r"][0]) for v in mesh.values()])
    far = pts[(pts[:, 0] < -299.9) & (np.abs(pts[:, 2]) < 4), 1]
    assert far.size and np.allclose(far, 0.4)
    # A 14m descent over only 20m would be a 70% ramp. The neighboring way
    # must carry the remainder of the descent while preserving the source join.
    for tri in pts.reshape(-1, 3, 3):
        planar = [(p[0], -p[2]) for p in tri]
        if Polygon(planar).covers(Point(-10, 0)):
            a = np.asarray([[planar[0][0], planar[1][0], planar[2][0]],
                            [planar[0][1], planar[1][1], planar[2][1]], [1, 1, 1]], float)
            weights = np.linalg.solve(a, [-10, 0, 1])
            assert 13.5 <= float(weights @ tri[:, 1]) <= 14.4
            break
    else: raise AssertionError("approach midpoint was not meshed")


def test_short_way_between_bridge_ends_hits_both_decks():
    left = way([(-50, 0), (0, 0)], bridge="yes", layer="1")
    middle = way([(0, 0), (20, 0)])
    right = way([(20, 0), (70, 0)], bridge="yes", layer="2")
    mesh = roads.build_roads([left, middle, right], coords, lambda x, y: 0)
    pts = np.concatenate([np.asarray(v["r"][0]) for v in mesh.values()])
    at_left = pts[(np.abs(pts[:, 0]) < 1e-8) & (np.abs(pts[:, 2]) < 4), 1]
    at_right = pts[(np.abs(pts[:, 0] - 20) < 1e-8) & (np.abs(pts[:, 2]) < 4), 1]
    assert at_left.size and np.allclose(at_left, .4)
    assert at_right.size and np.allclose(at_right, .4)


def test_densify_preserves_original_bend():
    dense = roads._densify([(0, 0), (10, 30), (40, 30)], 12)
    assert (10, 30) in dense
    mesh = roads.build_roads([way([(0, 0), (10, 30), (40, 30)])], coords, lambda x, y: 0)
    pts = np.concatenate([np.asarray(v["r"][0]) for v in mesh.values()])
    assert ((np.abs(pts[:, 0] - 10) < 4) & (np.abs(-pts[:, 2] - 30) < 4)).any()


def test_long_straight_road_has_linear_mesh_budget():
    mesh = roads.build_roads([way([(0, 100), (1000, 100)])], coords, lambda x, y: 0)
    triangles = sum(len(tile["r"][0]) // 3 for tile in mesh.values())
    assert triangles <= 500, triangles


def test_tile_filter_limits_road_and_detail_output():
    freeway = way([(1990, 100), (2010, 100)], highway="motorway",
                  bridge="cantilever", layer="2", lanes="2")
    mesh = roads.build_roads([freeway], coords, lambda x, y: 0, tile_filter={(1, 0)})
    assert set(mesh) == {(1, 0)}
    assert mesh[(1, 0)]["r"][0]
    assert mesh[(1, 0)]["h"][0]


if __name__ == "__main__":
    for name, fn in sorted(globals().copy().items()):
        if name.startswith("test_"):
            fn(); print("ok", name)
