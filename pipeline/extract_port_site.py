#!/usr/bin/env python3
"""Extract a bounded Port Milwaukee context layer from the cached OSM PBF."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import osmium
from shapely.geometry import LineString, Polygon, box

from config import LAT0, LON0, M_PER_DEG_LAT, M_PER_DEG_LON, TYPE_HEIGHTS

WEST, EAST, SOUTH, NORTH = -87.91, -87.885, 43.000, 43.028


def inside(lon: float, lat: float) -> bool:
    return WEST <= lon <= EAST and SOUTH <= lat <= NORTH


def project(lon: float, lat: float) -> list[float]:
    return [round((lon - LON0) * M_PER_DEG_LON, 3), round(-(lat - LAT0) * M_PER_DEG_LAT, 3)]


ROI = box(*project(WEST, NORTH), *project(EAST, SOUTH))


def metres(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return float(value.lower().replace("meters", "").replace("meter", "").replace("m", "").strip())
    except ValueError:
        if "'" in value:
            try:
                feet, inches = (value.replace('"', '').split("'") + ["0"])[:2]
                return float(feet) * .3048 + float(inches or 0) * .0254
            except ValueError:
                return None
    return None


class PortHandler(osmium.SimpleHandler):
    def __init__(self) -> None:
        super().__init__()
        self.rails: list[dict] = []
        self.quays: list[dict] = []
        self.buildings: list[dict] = []
        self.anchors: list[dict] = []

    @staticmethod
    def coords(way) -> list[tuple[float, float]]:
        return [(node.lon, node.lat) for node in way.nodes if node.location.valid()]

    def node(self, node) -> None:
        if not node.location.valid() or not inside(node.lon, node.lat):
            return
        tags = dict(node.tags)
        kind = ("turbine" if tags.get("generator:source") == "wind"
                else "ferry_terminal" if tags.get("amenity") == "ferry_terminal"
                else None)
        if kind:
            self.anchors.append({"id": f"node/{node.id}", "name": tags.get("name", kind.replace("_", " ").title()),
                                 "kind": kind, "position": project(node.lon, node.lat)})

    def way(self, way) -> None:
        tags, raw = dict(way.tags), self.coords(way)
        if len(raw) < 2 or not any(inside(*point) for point in raw):
            return
        line = LineString([project(lon, lat) for lon, lat in raw])
        clipped = line.intersection(ROI)
        parts = [clipped] if clipped.geom_type == "LineString" else list(getattr(clipped, "geoms", []))
        if tags.get("railway") in {"rail", "light_rail"}:
            for part_index, part in enumerate(parts):
                points = [[round(x, 3), round(y, 3)] for x, y in part.coords]
                if max(point[0] for point in points) < -50 or max(point[1] for point in points) < 1100:
                    continue
                item = {"id": way.id, "points": points}
                for key in ("name", "service", "usage", "operator", "bridge", "layer"):
                    if tags.get(key): item[key] = tags[key]
                self.rails.append(item)
        if tags.get("man_made") in {"quay", "pier", "breakwater"} or tags.get("natural") == "coastline":
            kind = "shoreline" if tags.get("natural") == "coastline" else tags["man_made"]
            for part_index, part in enumerate(parts):
                if part.length < 20:
                    continue
                points = [[round(x, 3), round(y, 3)] for x, y in part.coords]
                item = {"id": way.id, "kind": kind, "points": points}
                if tags.get("name"): item["name"] = tags["name"]
                self.quays.append(item)
        building = tags.get("building") or tags.get("man_made") in {"silo", "storage_tank"}
        if building and len(raw) >= 4 and raw[0] == raw[-1]:
            polygon = Polygon([project(*p) for p in raw]).intersection(ROI)
            if not polygon.is_valid or polygon.area < 350:
                return
            if polygon.geom_type != "Polygon":
                polygon = max(polygon.geoms, key=lambda shape: shape.area)
            points = [[round(x, 3), round(y, 3)] for x, y in polygon.exterior.coords]
            explicit = metres(tags.get("height"))
            levels = metres(tags.get("building:levels"))
            kind = "dome" if tags.get("roof:shape") == "dome" else "silo" if tags.get("man_made") == "silo" else "tank" if tags.get("man_made") == "storage_tank" else "warehouse" if tags.get("building") in {"industrial", "warehouse"} else tags.get("building", "industrial")
            height = explicit or ((levels or 0) * 3.3) or TYPE_HEIGHTS.get(tags.get("building", "industrial"), 9.0)
            item = {"id": way.id, "footprint": points[:-1], "height": round(height, 2), "kind": kind}
            rectangle = polygon.minimum_rotated_rectangle
            corners = list(rectangle.exterior.coords)[:4]
            edges = [(math.hypot(b[0] - a[0], b[1] - a[1]), a, b) for a, b in zip(corners, corners[1:] + corners[:1])]
            width, a, b = max(edges, key=lambda edge: edge[0])
            center = polygon.centroid
            center_xz = [round(center.x, 3), round(center.y, 3)]
            item["bounds"] = {"x": center_xz[0], "z": center_xz[1], "width": round(width, 2),
                              "depth": round(min(edge[0] for edge in edges), 2),
                              "bearing": round(math.atan2(-(b[1] - a[1]), b[0] - a[0]), 6)}
            if tags.get("name"): item["name"] = tags["name"]
            base = metres(tags.get("min_height"))
            if base is not None: item["sourceBase"] = round(base, 3)
            if explicit is not None: item["sourceRoof"] = round((base or 0) + explicit, 3)
            self.buildings.append(item)
            anchor_kind = ("ferry_terminal" if tags.get("amenity") == "ferry_terminal" or "ferry" in tags.get("name", "").lower()
                           else "administration" if "administration" in tags.get("name", "").lower() else None)
            if anchor_kind:
                centroid = polygon.centroid
                self.anchors.append({"id": f"way/{way.id}", "name": tags.get("name", anchor_kind.title()),
                                     "kind": anchor_kind,
                                     "position": [round(centroid.x, 3), round(centroid.y, 3)]})


def emit(handler: PortHandler) -> str:
    rails = sorted(handler.rails, key=lambda row: row["id"])
    buildings = sorted(handler.buildings, key=lambda row: row["id"])
    quays = sorted(handler.quays, key=lambda row: row["id"])
    anchors = sorted(handler.anchors, key=lambda row: row["id"])
    center_lon, center_lat = (WEST + EAST) / 2, (SOUTH + NORTH) / 2
    site = {"focus": dict(zip(("x", "z"), project(center_lon, center_lat))), "lat": center_lat, "lon": center_lon,
            "bounds": {"west": WEST, "east": EAST, "south": SOUTH, "north": NORTH,
                       "xMin": project(WEST, center_lat)[0], "xMax": project(EAST, center_lat)[0],
                       "zMin": project(center_lon, NORTH)[1], "zMax": project(center_lon, SOUTH)[1]},
            "source": "OpenStreetMap contributors; cached data/raw/milwaukee.osm.pbf"}
    packed = lambda value: json.dumps(value, separators=(",", ":"), ensure_ascii=False)
    return f'''/** Generated by pipeline/extract_port_site.py from the cached Milwaukee OSM PBF.
 * Coordinates use the scene projection: X east, Z south, metres. */
export type PortPoint = readonly [number,number];
export const PORT_SITE={packed(site)} as const;
export const PORT_RAILS={packed(rails)} as const;
export const PORT_BUILDINGS={packed(buildings)} as const;
export const PORT_QUAYS={packed(quays)} as const;
export const PORT_ANCHORS={packed(anchors)} as const;
'''


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=Path("data/raw/milwaukee.osm.pbf"))
    parser.add_argument("--output", type=Path, default=Path("web/src/portSite.ts"))
    args = parser.parse_args()
    handler = PortHandler()
    handler.apply_file(args.input, locations=True)
    args.output.write_text(emit(handler), encoding="utf-8")
    print(f"{len(handler.rails)} rails, {len(handler.buildings)} buildings, {len(handler.quays)} quay/shore lines, {len(handler.anchors)} anchors")


if __name__ == "__main__":
    main()
