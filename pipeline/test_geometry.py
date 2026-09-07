"""Smallest checks that fail if the geometry rules break. Run: .venv/bin/python test_geometry.py"""
import numpy as np
from shapely.geometry import Polygon
import geometry as G

def test_winding_faces_up_and_outward():
    for ring in ([(0, 0), (10, 0), (10, 10), (0, 10)], [(0, 0), (0, 10), (10, 10), (10, 0)]):   # CCW and CW input
        o, c = [], []; G.extrude(Polygon(ring), 0, 5, (1, 1, 1), out=o, cols=c)
        t = np.array(o).reshape(-1, 3, 3); n = np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])
        assert (n[:2, 1] > 0).all(), "roof must face +y"
        ctr = t[2:].mean(axis=1) - [5, 2.5, -5]
        assert ((n[2:] * ctr).sum(axis=1) > 0).all(), "walls must face outward"
        o, c = [], []; G.flat(Polygon(ring), 0, (1, 1, 1), o, c)
        t = np.array(o).reshape(-1, 3, 3); assert (np.cross(t[:, 1] - t[:, 0], t[:, 2] - t[:, 0])[:, 1] > 0).all(), "flat must face +y"

def test_height_priority():
    assert G.estimate_height({"height": "120 ft", "building:levels": "3"}, 100) == (36.576, "height")
    assert G.estimate_height({"building:levels": "4"}, 100) == (13.2, "levels")
    assert G.estimate_height({"building": "church"}, 100) == (14.0, "estimate")
    assert G.estimate_height({"building": "yes"}, 30)[0] == 3.0 and G.estimate_height({"building": "yes"}, 9000)[0] == 12.0

def test_road_ribbon_bridge_lift():
    poly, lift = G.road_ribbon([(0, 0), (100, 0)], {"highway": "primary", "bridge": "yes", "layer": "2"})
    assert round(poly.area) == 1200 and lift == 14.0
    assert G.road_ribbon([(0, 0), (100, 0)], {"highway": "primary", "tunnel": "yes"}) is None

if __name__ == "__main__":
    for f in (test_winding_faces_up_and_outward, test_height_priority, test_road_ribbon_bridge_lift): f(); print("ok", f.__name__)
