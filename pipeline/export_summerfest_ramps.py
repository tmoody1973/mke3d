"""Export cached Lake Interchange ramp geometry/profile provenance; no tile writes.

The user-supplied current-conditions pack's 94 freeway/ramp geometries match
the cached OSM coordinates exactly. Elevations remain pipeline estimates.
Run with pipeline/.venv/bin/python pipeline/export_summerfest_ramps.py.
"""
import json
import math
from collections import defaultdict
from pathlib import Path

from rebuild_roads import road_elements, terrain_sampler
from build_tiles import way_coords, is_hoan
from highway_profiles import build_profiles, is_bridge
from roads import SUPPORTED, road_width


def main():
    rows = []
    incidence = defaultdict(list)
    for element in road_elements():
        tags, coords = element['tags'], way_coords(element)
        if (tags.get('highway') not in SUPPORTED or len(coords) < 2
                or tags.get('area') == 'yes' or tags.get('tunnel') in ('yes', 'building_passage')):
            continue
        if not any(-2000 < x < 3000 and -4000 < y < 2500 for x, y in coords):
            continue
        rows.append((element, tags, coords))
        for point in coords:
            incidence[point].append((element, tags))
    ground = terrain_sampler()
    profiles = build_profiles(rows, ground, skip_fn=is_hoan)
    selected = []
    for element, tags, coords in rows:
        if not any(-600 < x < 1000 and -600 < y < 500 for x, y in coords):
            continue
        profile = profiles.get(id(element))
        affected = profile and not is_bridge(tags) and any(profile(x, y) - ground(x, y) - .4 > .01 for x, y in coords)
        if tags.get('highway') == 'motorway_link' or affected:
            selected.append((element, tags, coords))
    selected_ids = {element['id'] for element, _, _ in selected}
    out = []
    for element, tags, coords in selected:
        profile = profiles[id(element)]
        distances = [0.0]
        for a, b in zip(coords, coords[1:]):
            distances.append(distances[-1] + math.dist(a, b))
        anchors = []
        for point in coords:
            others = [(e, t) for e, t in incidence[point] if e is not element]
            if any(is_bridge(t) or t['highway'] == 'motorway' for _, t in others):
                anchors.append('deck')
            elif any(e['id'] not in selected_ids for e, _ in others):
                anchors.append('ground')
            else:
                anchors.append(None)
        samples = []
        for i, (a, b) in enumerate(zip(coords, coords[1:])):
            count = max(1, math.ceil(math.dist(a, b) / 6))
            for k in range(count):
                t = k / count
                x, y = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
                samples.append([distances[i] + math.dist(a, b) * t, profile(x, y) - ground(x, y) - .4])
        x, y = coords[-1]
        samples.append([distances[-1], profile(x, y) - ground(x, y) - .4])
        out.append(dict(id=element['id'], highway=tags['highway'], bridge=is_bridge(tags), width=road_width(tags),
                        points=[[x, -y, profile(x, y)] for x, y in coords],
                        anchors=anchors, profile=samples))
    path = Path(__file__).resolve().parents[1] / 'web/src/summerfestRampData.ts'
    path.write_text('''/** Cached OSM source plan geometry and estimated raw pipeline profiles.
 * Regenerate with pipeline/export_summerfest_ramps.py. No surveyed heights.
 * points: [scene x, scene z, raw asphalt y]; profile: [station, lift above raw DEM+.4].
 * deck anchors share an original source node with a preserved bridge/mainline;
 * ground anchors leave the existing profiled approach network at a street/path.
 */
export interface SummerfestRampSource {id:number;highway:string;bridge:boolean;width:number;points:number[][];anchors:(string|null)[];profile:number[][]}
export const summerfestRampSources:SummerfestRampSource[] = ''' + json.dumps(out, separators=(',', ':')) + ';\n')
    print(f'Exported {len(out)} ramp/connected-approach ways to {path}')


if __name__ == '__main__':
    main()
