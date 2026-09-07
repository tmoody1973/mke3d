"""Rebuild cached street meshes while preserving building sections byte for byte.

Run .venv/bin/python rebuild_roads.py after editing roads.py. No downloads required.
The full build uses the same road builder.
"""
import json
import argparse
import math
import re
import os
import struct
import tempfile
import time
from pathlib import Path

import numpy as np

from config import OUT, RAW, TILE_M
from build_tiles import way_coords, is_hoan, write_sections
from roads import build_roads


def road_elements():
    """Stream the cached JSON array; don't retain the city's building objects."""
    decoder = json.JSONDecoder()
    seen = set()
    for path in sorted((RAW / 'osm').glob('*.json')):
        with path.open() as source:
            buffer = source.read(65536)
            while not (match := re.search(r'"elements"\s*:\s*\[', buffer)):
                chunk = source.read(65536)
                if not chunk:
                    raise ValueError(f'Missing elements array in {path}')
                buffer += chunk
            buffer = buffer[match.end():]
            while True:
                buffer = buffer.lstrip(' \n\r\t,')
                if buffer.startswith(']'):
                    break
                try:
                    element, end = decoder.raw_decode(buffer)
                except json.JSONDecodeError:
                    chunk = source.read(65536)
                    if not chunk:
                        raise ValueError(f'Incomplete elements array in {path}')
                    buffer += chunk
                    continue
                buffer = buffer[end:]
                if element.get('type') == 'way' and 'highway' in element.get('tags', {}):
                    key = element['id']
                    if key not in seen:
                        seen.add(key)
                        yield element


def sections(data):
    assert data[:4] == b"MKE1" and struct.unpack_from("<I", data, 4)[0] == 2
    offset = 12
    for _ in range(struct.unpack_from("<I", data, 8)[0]):
        start = offset
        name = data[offset:offset + 4]
        count = struct.unpack_from("<I", data, offset + 4)[0]
        offset += 24 + count * 6
        offset = (offset + 3) // 4 * 4
        offset += count * 3
        offset = (offset + 3) // 4 * 4
        yield name, data[start:offset]
    assert offset == len(data)


def terrain_sampler():
    data = (OUT / "terrain.bin").read_bytes()
    assert data[:4] == b"MKET"
    nx, ny, x0, y0, step = struct.unpack_from("<IIfff", data, 4)
    heights = np.frombuffer(data, dtype="<f4", count=nx * ny, offset=24).reshape(ny, nx).tolist()

    def sample(x, y):
        fx, fy = (x - x0) / step, (y - y0) / step
        i, j = max(0, min(nx - 2, int(fx))), max(0, min(ny - 2, int(fy)))
        tx, ty = max(0, min(1, fx - i)), max(0, min(1, fy - j))
        return float(heights[j][i] * (1 - tx) * (1 - ty) + heights[j][i + 1] * tx * (1 - ty)
                     + heights[j + 1][i] * (1 - tx) * ty + heights[j + 1][i + 1] * tx * ty)

    return sample


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--highways-only', action='store_true', help='Rebuild every road layer in tiles touched by highways and their approaches')
    parser.add_argument('--details-only', action='store_true', help='Regenerate HWAY structures and markings while retaining ROAD surfaces')
    args = parser.parse_args()
    started = time.time()
    manifest = json.loads((OUT / "manifest.json").read_text())
    elements = list(road_elements())
    selected = None
    if args.highways_only or args.details_only:
        selected = set()
        for e in elements:
            if e.get('tags', {}).get('highway') not in {'motorway', 'motorway_link', 'trunk', 'trunk_link'}:
                continue
            coords = way_coords(e)
            if not coords:
                continue
            xs, ys = zip(*coords)
            # Include shoulders, supports, and adjoining surface-road approaches.
            for i in range(math.floor((min(xs) - 100) / TILE_M), math.floor((max(xs) + 100) / TILE_M) + 1):
                for j in range(math.floor((min(ys) - 100) / TILE_M), math.floor((max(ys) + 100) / TILE_M) + 1):
                    selected.add((i, j))
        print(f"Highway rebuild covers {len(selected)} tiles", flush=True)
    print(f"Loaded {len(elements)} street/path ways; rebuilding streets…", flush=True)
    roads = build_roads(elements, way_coords, terrain_sampler(), is_hoan, progress=True, tile_filter=selected, details_only=args.details_only)
    road_tile_count = len(roads)
    full_vertices = sum(len(t["r"][0]) for t in roads.values())
    print(f"Street mesh: {full_vertices // 3:,} triangles, {full_vertices * 9 / 1e6:.1f} MB before section headers", flush=True)
    tiles = {(t["i"], t["j"]): dict(t) for t in manifest["tiles"]}
    for i, j in roads:
        tiles.setdefault((i, j), {"i": i, "j": j, "cx": (i + .5) * TILE_M,
                                 "cz": -(j + .5) * TILE_M, "buildings": 0, "lodBuildings": 0})
    # Stage every output before replacing any live tile. Non-road bytes stay exact.
    with tempfile.TemporaryDirectory(prefix="mke-streets-", dir=OUT) as temp:
        stage = Path(temp)
        for (i, j), tile in tiles.items():
            if selected is not None and (i, j) not in selected:
                continue
            for suffix, key, byte_key in (("", "r", "bytes"), (".lod", "rl", "lodBytes")):
                name = f"t_{i}_{j}{suffix}.bin"
                original = OUT / "tiles" / name
                replaced_tags = (b"HWAY",) if args.details_only else (b"ROAD", b"HWAY")
                retained = [raw for tag, raw in sections(original.read_bytes()) if tag not in replaced_tags] if original.exists() else []
                generated = stage / name
                highway_key = 'h' if key == 'r' else 'hl'
                replacement = [("HWAY", *roads.get((i, j), {}).get(highway_key, ([], [])))]
                if not args.details_only:
                    replacement.insert(0, ("ROAD", *roads.get((i, j), {}).get(key, ([], []))))
                write_sections(generated, replacement)
                road_sections = [raw for _, raw in sections(generated.read_bytes())]
                generated.write_bytes(b"MKE1" + struct.pack("<II", 2, len(retained) + len(road_sections))
                                      + b"".join(retained + road_sections))
                tile[byte_key] = generated.stat().st_size
            roads.pop((i, j), None)  # release each completed tile before packing the next
        stats = manifest["stats"]
        stats.update(tiles=len(tiles), tile_bytes_total=sum(t["bytes"] for t in tiles.values()),
                     lod_bytes_total=sum(t["lodBytes"] for t in tiles.values()))
        manifest["tiles"] = sorted(tiles.values(), key=lambda t: t["cx"] ** 2 + t["cz"] ** 2)
        for file in stage.iterdir():
            os.replace(file, OUT / "tiles" / file.name)
        (OUT / "stats.json").write_text(json.dumps(stats, indent=1))
        (OUT / "manifest.json").write_text(json.dumps(manifest))
    print(f"Rebuilt roads in {road_tile_count} tiles in {time.time() - started:.1f}s; buildings preserved.")
    print(f"Full tiles: {stats['tile_bytes_total'] / 1e6:.1f} MB; LOD: {stats['lod_bytes_total'] / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
