#!/usr/bin/env python3
"""Extract North Point Lighthouse site geometry from the cached OSM JSON.

The input is intentionally decoded as a stream: data/raw/osm/pbf_extract.json is
large enough that loading it as a Python object is wasteful. Output coordinates
are the same local metres used by the web scene and are clipped to the site ROI.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
from typing import Any, Iterable

X_MIN, X_MAX = 2450.0, 3070.0
Z_MIN, Z_MAX = -3690.0, -3090.0
X_SCALE = 81367.90195302747
Z_SCALE = 110574.0


def project(point: list[float] | dict[str, float]) -> tuple[float, float]:
    if isinstance(point, dict):
        lon, lat = point["lon"], point["lat"]
    else:
        lon, lat = point
    return ((lon + 87.905) * X_SCALE, (43.035 - lat) * Z_SCALE)


def elements(path: pathlib.Path) -> Iterable[dict[str, Any]]:
    decoder = json.JSONDecoder()
    with path.open(encoding="utf-8") as source:
        buffer = source.read(65536)
        while not (match := re.search(r'"elements"\s*:\s*\[', buffer)):
            more = source.read(65536)
            if not more:
                raise ValueError(f"No elements array in {path}")
            buffer += more
        buffer = buffer[match.end():]
        while True:
            buffer = buffer.lstrip(" \n\r\t,")
            if buffer.startswith("]"):
                return
            try:
                value, consumed = decoder.raw_decode(buffer)
            except json.JSONDecodeError:
                more = source.read(65536)
                if not more:
                    raise
                buffer += more
                continue
            buffer = buffer[consumed:]
            yield value


def clip_segment(a: tuple[float, float], b: tuple[float, float]) -> tuple[tuple[float, float], tuple[float, float]] | None:
    dx, dz = b[0] - a[0], b[1] - a[1]
    lo, hi = 0.0, 1.0
    for p, q in ((-dx, a[0] - X_MIN), (dx, X_MAX - a[0]), (-dz, a[1] - Z_MIN), (dz, Z_MAX - a[1])):
        if p == 0:
            if q < 0:
                return None
            continue
        ratio = q / p
        if p < 0:
            lo = max(lo, ratio)
        else:
            hi = min(hi, ratio)
        if lo > hi:
            return None
    return ((a[0] + dx * lo, a[1] + dz * lo), (a[0] + dx * hi, a[1] + dz * hi))


def clipped_paths(points: list[tuple[float, float]]) -> list[list[tuple[float, float]]]:
    paths: list[list[tuple[float, float]]] = []
    for a, b in zip(points, points[1:]):
        clipped = clip_segment(a, b)
        if clipped is None:
            continue
        start, end = clipped
        if paths and abs(paths[-1][-1][0] - start[0]) < 1e-6 and abs(paths[-1][-1][1] - start[1]) < 1e-6:
            paths[-1].append(end)
        else:
            paths.append([start, end])
    return paths


def clip_polygon(points: list[tuple[float, float]]) -> list[tuple[float, float]]:
    if len(points) > 1 and points[0] == points[-1]:
        points = points[:-1]

    def edge(vertices: list[tuple[float, float]], axis: int, value: float, keep_greater: bool) -> list[tuple[float, float]]:
        result: list[tuple[float, float]] = []
        if not vertices:
            return result
        for start, end in zip(vertices, vertices[1:] + vertices[:1]):
            start_in = start[axis] >= value if keep_greater else start[axis] <= value
            end_in = end[axis] >= value if keep_greater else end[axis] <= value
            if start_in != end_in:
                other = 1 - axis
                amount = (value - start[axis]) / (end[axis] - start[axis])
                hit = [0.0, 0.0]
                hit[axis] = value
                hit[other] = start[other] + (end[other] - start[other]) * amount
                result.append((hit[0], hit[1]))
            if end_in:
                result.append(end)
        return result

    for axis, value, keep_greater in ((0, X_MIN, True), (0, X_MAX, False), (1, Z_MIN, True), (1, Z_MAX, False)):
        points = edge(points, axis, value, keep_greater)
    return points


def rounded(points: list[tuple[float, float]]) -> list[list[float]]:
    return [[round(x, 3), round(z, 3)] for x, z in points]


def compact_tags(tags: dict[str, str]) -> dict[str, str]:
    keys = ("highway", "name", "surface", "lanes", "bridge", "area", "service", "motor_vehicle", "footway", "natural", "landuse", "building")
    return {key: tags[key] for key in keys if key in tags}


def extract(path: pathlib.Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    ways: list[dict[str, Any]] = []
    areas: list[dict[str, Any]] = []
    for element in elements(path):
        tags = element.get("tags", {})
        is_highway_area = tags.get("highway") and tags.get("area") == "yes"
        if tags.get("highway") and not is_highway_area:
            source_points = element.get("geometry", [])
            paths = clipped_paths([project(point) for point in source_points])
            if paths:
                ways.append({"id": element["id"], "tags": compact_tags(tags), "paths": [rounded(item) for item in paths]})
            continue
        kind = "pedestrian" if is_highway_area else "wood" if tags.get("natural") == "wood" else "grass" if tags.get("landuse") == "grass" else "building" if tags.get("building") else None
        if kind is None:
            continue
        source_rings = element.get("rings") or [{"outer": element.get("geometry", []), "inner": []}]
        for ring in source_rings:
            outer = clip_polygon([project(point) for point in ring.get("outer", [])])
            if len(outer) < 3:
                continue
            holes = []
            for inner in ring.get("inner", []):
                clipped = clip_polygon([project(point) for point in inner])
                if len(clipped) >= 3:
                    holes.append(rounded(clipped))
            areas.append({"id": element["id"], "kind": kind, "outer": rounded(outer), "holes": holes})
    ways.sort(key=lambda item: item["id"])
    areas.sort(key=lambda item: (item["kind"], item["id"]))
    return ways, areas


def typescript(ways: list[dict[str, Any]], areas: list[dict[str, Any]]) -> str:
    payload = json.dumps({"ways": ways, "areas": areas}, separators=(",", ":"))
    return """// Generated by pipeline/extract_lighthouse_site.py from data/raw/osm/pbf_extract.json.\nexport type SitePoint = readonly [number, number];\nexport interface SiteWay { readonly id:number; readonly tags:Readonly<Record<string,string>>; readonly paths:readonly (readonly SitePoint[])[] }\nexport interface SiteArea { readonly id:number; readonly kind:'grass'|'wood'|'building'|'pedestrian'; readonly outer:readonly SitePoint[]; readonly holes:readonly (readonly SitePoint[])[] }\nexport const LIGHTHOUSE_SITE_DATA = %s as const satisfies { readonly ways:readonly SiteWay[]; readonly areas:readonly SiteArea[] };\n""" % payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=pathlib.Path, default=pathlib.Path("data/raw/osm/pbf_extract.json"))
    parser.add_argument("--output", type=pathlib.Path)
    args = parser.parse_args()
    ways, areas = extract(args.input)
    output = typescript(ways, areas)
    if args.output:
        args.output.write_text(output, encoding="utf-8")
    else:
        print(output, end="")
    print(f"{len(ways)} clipped highway ways; {len(areas)} clipped site areas", file=__import__("sys").stderr)


if __name__ == "__main__":
    main()
