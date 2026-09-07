"""Recorded floor counts from the City of Milwaukee Master Property File (MPROP, CC-BY), joined to buildings
through the city's parcel polygons. Height rule when used: stories x LEVEL_HEIGHT_M + 1.0 m (roof/parapet).
Inputs (cached in data/raw): parcels/ParcelPolygonTax.shp (State Plane WI South ftUS), mprop.csv (TAXKEY, NR_STORIES)."""
import csv, json, os, numpy as np, shapefile, shapely
from shapely.geometry import shape
from shapely.strtree import STRtree
from shapely.ops import transform
from pyproj import CRS, Transformer
from config import RAW, LEVEL_HEIGHT_M
import geometry as G

PARCEL_SHP = RAW / "parcels" / "ParcelPolygonTax"
MPROP_CSV = RAW / "mprop.csv"

class ParcelStories:
    def __init__(self):
        stories = {}
        with open(MPROP_CSV, encoding="latin-1") as f:
            for row in csv.DictReader(f):
                try: n = float(row["NR_STORIES"])
                except (TypeError, ValueError): continue
                if 0 < n <= 60: stories[row["TAXKEY"].strip()] = n
        self.stories = stories
        cache = RAW / "parcel_index.pkl"
        if cache.exists():
            import pickle; self.polys, self.keys = pickle.load(open(cache, "rb"))
            self.tree = STRtree(self.polys); self.matched_parcels = len(self.polys); return
        r = shapefile.Reader(str(PARCEL_SHP))
        crs = CRS.from_wkt(open(str(PARCEL_SHP) + ".prj").read())
        tf = Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
        fields = [fl[0] for fl in r.fields[1:]]; ti = fields.index("FK_Tax")
        polys, keys = [], []
        for sr in r.iterShapeRecords():
            key = str(sr.record[ti]).zfill(10)
            if key not in stories: continue
            try:
                g = shape(sr.shape.__geo_interface__)
                g = transform(lambda x, y, z=None: G.to_local(*tf.transform(x, y)), g)
            except Exception: continue
            if g.is_empty: continue
            polys.append(g); keys.append(key)
        self.tree = STRtree(polys); self.polys = polys; self.keys = keys
        self.matched_parcels = len(polys)
        import pickle; pickle.dump((polys, keys), open(cache, "wb"))

    def stories_at(self, x, y):
        """Story count of the parcel containing local point (x, y), or None."""
        pt = shapely.Point(x, y)
        for i in self.tree.query(pt, predicate="within"):
            return self.stories.get(self.keys[i])
        return None

    def height_at(self, x, y):
        n = self.stories_at(x, y)
        return None if n is None else n * LEVEL_HEIGHT_M + 1.0

if __name__ == "__main__":
    import time; t = time.time(); ps = ParcelStories()
    print(f"parcels with stories: {ps.matched_parcels} / mprop rows with stories: {len(ps.stories)} in {time.time()-t:.0f}s")
    for name, lon, lat in [("City Hall", -87.9097516, 43.0417052), ("Public Market", -87.9080905, 43.0352575), ("a Bay View house", -87.9027, 43.0005)]:
        x, y = G.to_local(lon, lat); print(name, "->", ps.stories_at(x, y), "stories")
