"""Sample elevation from AWS Terrain Tiles (Mapzen 'terrarium' PNGs; public, attribution required)
into a regular grid over the fetch bbox, in local meters. Writes data/raw/terrain.npz.
Terrarium decode: h = (R*256 + G + B/256) - 32768  (meters)."""
import json, math, io, requests, numpy as np
from PIL import Image
from config import RAW, TERRAIN_ZOOM, TERRAIN_STEP_M, LAT0, LON0, M_PER_DEG_LAT, M_PER_DEG_LON

URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"

def tile_xy(lat, lon, z):
    n = 2 ** z
    x = (lon + 180) / 360 * n
    y = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n
    return x, y

def load_tile(z, x, y, cache):
    f = cache / f"{z}_{x}_{y}.png"
    if not f.exists():
        r = requests.get(URL.format(z=z, x=x, y=y), timeout=60); r.raise_for_status(); f.write_bytes(r.content)
    a = np.asarray(Image.open(f).convert("RGB"), dtype=np.float64)
    return a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768

if __name__ == "__main__":
    bbox = json.load(open(RAW / "bbox.json")); z = TERRAIN_ZOOM
    cache = RAW / "terrain"; cache.mkdir(exist_ok=True)
    x0, y0 = tile_xy(bbox["north"], bbox["west"], z); x1, y1 = tile_xy(bbox["south"], bbox["east"], z)
    tx0, ty0, tx1, ty1 = int(x0), int(y0), int(x1), int(y1)
    # mosaic of tiles
    W, H = (tx1 - tx0 + 1) * 256, (ty1 - ty0 + 1) * 256
    mosaic = np.zeros((H, W))
    for ty in range(ty0, ty1 + 1):
        for tx in range(tx0, tx1 + 1):
            mosaic[(ty - ty0) * 256:(ty - ty0 + 1) * 256, (tx - tx0) * 256:(tx - tx0 + 1) * 256] = load_tile(z, tx, ty, cache)
    print(f"mosaic {W}x{H} px from {(tx1-tx0+1)*(ty1-ty0+1)} tiles")
    # sample onto local-meter grid
    def to_local(lat, lon): return (lon - LON0) * M_PER_DEG_LON, (lat - LAT0) * M_PER_DEG_LAT
    xmin, ymin = to_local(bbox["south"], bbox["west"]); xmax, ymax = to_local(bbox["north"], bbox["east"])
    xs = np.arange(math.floor(xmin), math.ceil(xmax) + 1, TERRAIN_STEP_M)
    ys = np.arange(math.floor(ymin), math.ceil(ymax) + 1, TERRAIN_STEP_M)
    grid = np.zeros((len(ys), len(xs)), dtype=np.float32)
    for j, yl in enumerate(ys):
        lat = LAT0 + yl / M_PER_DEG_LAT
        lons = LON0 + xs / M_PER_DEG_LON
        px = np.array([tile_xy(lat, lo, z)[0] for lo in lons]) - tx0
        py = tile_xy(lat, lons[0], z)[1] - ty0
        pxi = np.clip((px * 256).astype(int), 0, W - 1); pyi = int(np.clip(py * 256, 0, H - 1))
        grid[j] = mosaic[pyi, pxi]
    np.savez_compressed(RAW / "terrain.npz", grid=grid, xs=xs.astype(np.float32), ys=ys.astype(np.float32))
    print(f"grid {grid.shape} step {TERRAIN_STEP_M} m; elev min {grid.min():.1f} max {grid.max():.1f} mean {grid.mean():.1f} m")
