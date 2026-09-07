"""Regression for sub-grid road slivers reversed by binary tile compression."""
import struct
import tempfile
import unittest
from pathlib import Path
import numpy as np
from build_tiles import write_sections
from rebuild_roads import sections


class TilePackingTests(unittest.TestCase):
    def test_road_sliver_keeps_upward_face_and_attached_colors_after_packing(self):
        points = np.array([[.6250954666, 0, -.8972138010],
                           [19.6250954666, 0, -4.8972138010],
                           [10.3149954666, 0, -2.9373138010]])
        colors = [[10, 20, 30], [40, 50, 60], [70, 80, 90]]
        naive = np.round((points - points.mean(axis=0)) / .1)
        self.assertGreater(np.cross(points[1]-points[0], points[2]-points[0])[1], 0)
        self.assertLess(np.cross(naive[1]-naive[0], naive[2]-naive[0])[1], 0)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'test.bin'
            write_sections(path, [('ROAD', points, colors), ('HWAY', points, colors)])
            packed = dict(sections(path.read_bytes()))
        road = packed[b'ROAD']
        self.assertEqual(struct.unpack_from('<I', road, 4)[0], 3)
        q = np.frombuffer(road, dtype='<i2', count=9, offset=24).reshape(3, 3).astype(int)
        self.assertGreater(np.cross(q[1]-q[0], q[2]-q[0])[1], 0)
        color_offset = (24 + 18 + 3) // 4 * 4
        self.assertEqual(list(road[color_offset:color_offset+9]), [10,20,30,70,80,90,40,50,60])
        # Structural undersides may legitimately face down; do not flip them.
        h = np.frombuffer(packed[b'HWAY'], dtype='<i2', count=9, offset=24).reshape(3, 3)
        np.testing.assert_array_equal(h, naive)


if __name__ == '__main__':
    unittest.main()
