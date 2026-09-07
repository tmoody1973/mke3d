"""Focused checks for highway detail geometry."""
import math
import sys
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import highway_details as hd


def _all(mesh, key="h"):
    return np.asarray([p for tile in mesh.values() for p in tile[key][0]], float)


def _triangles(mesh, key="hl"):
    points = _all(mesh, key)
    return points.reshape(-1, 3, 3) if points.size else np.empty((0, 3, 3))


def _colors(mesh, key="h"):
    return [c for tile in mesh.values() for c in tile[key][1]]


def test_markings_are_above_surface_and_budget_is_bounded():
    mesh=hd.build_highway_details([(0,0),(100,0)], 12,
                                  {"highway":"motorway","lanes":"3","oneway":"yes"},
                                  lambda x,n: 10, lambda x,n: 0)
    pts=_all(mesh)
    assert pts.size and np.allclose(pts[:,1],10.14)
    assert sum(len(v["h"][0])//3 for v in mesh.values()) <= 500
    assert not _all(mesh,"hl").size


def test_bridge_has_thickness_grounded_supports_and_blocker():
    args=([(0,0),(110,0)],14,{"highway":"primary","bridge":"yes","lanes":"2"},
          lambda x,n:20,lambda x,n:3)
    mesh=hd.build_highway_details(*args)
    pts=_all(mesh,"hl")
    assert np.isclose(pts[:,1],20-14*.085).any()
    assert (pts[:,1] < 3.01).any()
    blocked=hd.build_highway_details(*args, blockers=lambda x,n,r,top: True)
    bpts=_all(blocked,"hl")
    assert not (bpts[:,1] < 3.01).any()
    assert hd._bridge({"bridge":"cantilever"})
    assert not hd._bridge({"bridge":"no"})


def test_barriers_leave_end_mouths_clear():
    mesh=hd.build_highway_details([(0,0),(100,0)],10,
                                  {"highway":"primary","bridge":"viaduct"},lambda x,n:10,lambda x,n:0,
                                  blockers=lambda *a: True)
    pts=_all(mesh,"hl")
    high=pts[pts[:,1]>10.5]
    assert high.size and high[:,0].min() >= 12-1e-8 and high[:,0].max() <= 88+1e-8


def test_actual_tile_clipping_and_finite_output():
    mesh=hd.build_highway_details([(1990,10),(2010,10)],12,
                                  {"highway":"primary","lanes":"2"},lambda x,n:5,lambda x,n:0)
    assert (0,0) in mesh and (1,0) in mesh
    for (i,j),tile in mesh.items():
        p=np.asarray(tile["h"][0])
        assert np.isfinite(p).all()
        assert p[:,0].min() >= i*hd.TILE_M-1e-7 and p[:,0].max() <= (i+1)*hd.TILE_M+1e-7
        north=-p[:,2]
        assert north.min() >= j*hd.TILE_M-1e-7 and north.max() <= (j+1)*hd.TILE_M+1e-7


def test_curved_markings_follow_source_path():
    mesh=hd.build_highway_details([(0,0),(20,0),(20,20)],10,
                                  {"highway":"primary","lanes":"2"},lambda x,n:2,lambda x,n:0)
    pts=_all(mesh)
    # No diagonal shortcut through the inside of the right-angle bend.
    assert not np.any((pts[:,0] < 16) & (-pts[:,2] > 4))


def test_deck_sides_and_underside_face_outward():
    mesh = hd.build_highway_details([(100,100),(200,100)], 10,
        {"highway":"primary","bridge":"cantilever"}, lambda x,n:20, lambda x,n:0,
        blockers=lambda *a:True)
    triangles = _all(mesh, "hl").reshape(-1,3,3)
    checked = 0
    for tri in triangles:
        if tri[:,1].max() > 20.001:
            continue
        normal = np.cross(tri[1]-tri[0], tri[2]-tri[0])
        if np.linalg.norm(normal) < 1e-8:
            continue
        center = tri.mean(axis=0)
        outward = center - np.array([150,19.4,-100])
        assert np.dot(normal,outward) > 0, (tri, normal)
        checked += 1
    assert checked == 6


def test_bent_deck_has_shared_join_lateral_heights_and_no_curtains():
    height = lambda x,n: 15 + .02*x + .08*n
    mesh = hd.build_highway_details([(0,0),(30,0),(30,30)], 10,
        {"highway":"primary","bridge":"yes"}, height, lambda x,n:0,
        blockers=lambda *a:True, end_setbacks=(0,0))
    triangles = _triangles(mesh)
    # A full-width vertical quad at a source endpoint/join is the old curtain
    # failure. Rail end faces are only 0.3 m wide and do not trip this guard.
    for tri in triangles:
        vertical = np.ptp(tri[:,1]) > .65
        across_x = (np.ptp(tri[:,2]) > 7 and np.ptp(tri[:,0]) < 1e-8
                    and any(np.isclose(tri[:,0].mean(), v) for v in (0,30)))
        across_n = (np.ptp(tri[:,0]) > 7 and np.ptp(tri[:,2]) < 1e-8
                    and any(np.isclose(tri[:,2].mean(), v) for v in (0,-30)))
        assert not (vertical and (across_x or across_n)), tri
    # Top deck vertices use their actual lateral coordinates, not centerline y.
    top = _all(mesh,"hl")
    candidates = top[(np.isclose(top[:,0],0)) & (np.isclose(top[:,2],-5))]
    assert candidates.size and np.isclose(candidates[:,1], height(0,5)).any()


def test_structure_faces_are_opaque_non_degenerate_and_outward():
    mesh = hd.build_highway_details([(100,100),(200,100)], 10,
        {"highway":"primary","bridge":"yes"}, lambda x,n:20, lambda x,n:0,
        blockers=lambda *a:True)
    assert set(_colors(mesh,"hl")) == {hd.CONCRETE}
    triangles = _triangles(mesh)
    for tri in triangles:
        normal = np.cross(tri[1]-tri[0], tri[2]-tri[0])
        assert np.linalg.norm(normal) > 1e-8, tri
        center = tri.mean(axis=0)
        if tri[:,1].max() <= 20.001:
            solid_center = np.array([150, 20-10*.085/2, -100])
        else:
            rail_z = -104.88 if center[2] < -100 else -95.12
            solid_center = np.array([150, 20.44, rail_z])
        assert np.dot(normal, center-solid_center) > 1e-8, (tri, normal)


def test_support_policy_ground_contact_and_opening_clearance():
    ground = lambda x,n: 2 + .03*n
    tags = {"highway":"primary","bridge":"yes"}
    mesh = hd.build_highway_details([(0,0),(160,0)], 14, tags, lambda x,n:20, ground,
        support_allowed=lambda x,n,r: x < 60 or x > 100)
    low = _all(mesh,"hl")
    low = low[low[:,1] < 18]
    assert low.size
    assert not np.any((low[:,0] >= 60) & (low[:,0] <= 100))
    # Foundation corners are buried 5 cm into their local terrain sample.
    foundation = low[low[:,1] < 3]
    north = -foundation[:,2]
    assert foundation.size and np.allclose(foundation[:,1],
                                            [ground(x,n)-.05 for x,n in zip(foundation[:,0],north)])

    water_clear = hd.build_highway_details(
        [(0,0),(160,0)], 14, tags, lambda x,n:20, ground,
        support_allowed=lambda x,n,r: False)
    assert _all(water_clear,"hl")[:,1].min() >= 20-14*.085-1e-8

    for bridge_tags, length in (({"highway":"primary","bridge":"movable"},200),
                                ({"highway":"primary","bridge":"yes"},60)):
        clear = hd.build_highway_details([(0,0),(length,0)], 14, bridge_tags,
                                         lambda x,n:20, ground)
        assert not np.any(_all(clear,"hl")[:,1] < 18)


def test_path_bridge_has_thin_deck_open_rail_and_no_road_paint():
    mesh = hd.build_highway_details([(0,0),(60,0)], 2,
        {"highway":"footway","bridge":"yes","oneway":"yes"},
        lambda x,n:10, lambda x,n:0, end_setbacks=(0,0))
    assert set(_colors(mesh,"h")) == {hd.CONCRETE}
    pts = _all(mesh,"hl")
    assert np.isclose(pts[:,1], 9.74).any()
    triangles = _triangles(mesh)
    # No long solid face fills the open metre between deck and handrail.
    spanning = triangles[(triangles[:,:,1].min(axis=1) < 10.1) &
                         (triangles[:,:,1].max(axis=1) > 10.9)]
    assert all(np.ptp(tri[:,0]) <= .1 for tri in spanning)


def test_one_kilometre_structure_budget_stays_economical():
    mesh = hd.build_highway_details([(0,0),(1000,0)], 14,
        {"highway":"motorway","bridge":"yes","lanes":"3"},
        lambda x,n:20, lambda x,n:0)
    assert sum(len(v["hl"][0])//3 for v in mesh.values()) < 2200


if __name__ == "__main__":
    for name, fn in sorted(globals().copy().items()):
        if name.startswith("test_"): fn(); print("ok",name)
