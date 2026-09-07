#!/usr/bin/env bash
# Rebuild all viewer data from scratch (idempotent; cached downloads in data/raw are reused).
set -euo pipefail
cd "$(dirname "$0")"
[ -d .venv ] || uv venv -q .venv
uv pip install -q -p .venv/bin/python shapely pyproj mapbox_earcut pyshp requests numpy pillow osmium
.venv/bin/python fetch_city.py       # city limits + waterways (CC-BY)  -> data/raw/bbox.json
.venv/bin/python fetch_terrain.py    # AWS terrarium tiles              -> data/raw/terrain.npz
RAW=../data/raw; PBF=$RAW/wisconsin-latest.osm.pbf
[ -f "$PBF" ] || curl -L -o "$PBF" https://download.geofabrik.de/north-america/us/wisconsin-latest.osm.pbf
if command -v osmium >/dev/null; then    # fast path: cut the Milwaukee box first (seconds instead of ~30 min)
  BBOX=$(python3 -c 'import json;b=json.load(open("'"$RAW"'/bbox.json"));print(f"{b["west"]},{b["south"]},{b["east"]},{b["north"]}")')
  osmium extract --overwrite -b "$BBOX" "$PBF" -o "$RAW/milwaukee.osm.pbf"
  .venv/bin/python fetch_osm_pbf.py "$RAW/milwaukee.osm.pbf"   # -> data/raw/osm/pbf_extract.json
else
  .venv/bin/python fetch_osm_pbf.py                              # whole-state walk (slow but no extra tools)
fi
.venv/bin/python build_tiles.py      # -> web/public/data/{manifest.json,terrain.bin,water.bin,tiles/*.bin,stats.json}
