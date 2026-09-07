"""Shared constants for the Milwaukee 3D pipeline. Edit here, not in scripts."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"           # cached downloads (safe to delete; re-fetched)
OUT = ROOT / "web" / "public" / "data" # what the viewer loads
RAW.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)

# Local projection origin: downtown Milwaukee (Water St & Wisconsin Ave area)
LAT0, LON0 = 43.035, -87.905
M_PER_DEG_LAT = 110574.0
import math
M_PER_DEG_LON = 111320.0 * math.cos(math.radians(LAT0))

MARGIN_M = 1500          # context around city limits so edges aren't abrupt
TILE_M = 2000            # output tile size (meters)
OSM_CHUNK_DEG = 0.03     # Overpass request size (degrees)
TERRAIN_ZOOM = 13        # terrarium tiles (~19 m/px at this latitude)
TERRAIN_STEP_M = 40      # heightmap grid spacing in output
LAKE_DATUM_M = 176.5     # Lake Michigan long-term mean level (m, IGLD85 ≈ 176.0–177.5)

LEVEL_HEIGHT_M = 3.3
# Documented estimate rules when OSM has neither height nor levels (meters).
# Keyed by building=* value; None -> area-based fallback in geometry.estimate_height
TYPE_HEIGHTS = {
    "house": 6.0, "detached": 6.0, "semidetached_house": 6.0, "residential": 7.5,
    "terrace": 7.0, "bungalow": 4.5, "garage": 3.0, "garages": 3.0, "shed": 2.8,
    "roof": 3.5, "carport": 3.0, "hut": 3.0, "apartments": 12.0, "dormitory": 12.0,
    "hotel": 20.0, "office": 16.0, "commercial": 8.0, "retail": 6.0, "supermarket": 6.5,
    "industrial": 9.0, "warehouse": 9.0, "manufacture": 9.0, "church": 14.0,
    "cathedral": 22.0, "chapel": 8.0, "school": 8.0, "university": 12.0, "college": 12.0,
    "hospital": 16.0, "public": 10.0, "civic": 10.0, "government": 12.0, "parking": 9.0,
    "stadium": 25.0, "sports_hall": 12.0, "train_station": 10.0, "transportation": 8.0,
    "kindergarten": 5.0, "service": 4.0, "fire_station": 8.0, "greenhouse": 4.0,
    "grandstand": 10.0, "pavilion": 5.0, "bridge": 6.0, "construction": 8.0,
}
ROAD_WIDTH_M = {
    "motorway": 16, "motorway_link": 8, "trunk": 14, "trunk_link": 7,
    "primary": 12, "primary_link": 6, "secondary": 10, "secondary_link": 5,
    "tertiary": 8, "tertiary_link": 5, "residential": 6, "unclassified": 6,
    "living_street": 5, "service": 3, "pedestrian": 4,
}
BRIDGE_LIFT_M = 7.0      # per OSM layer for bridge=yes ways

# Landmark OSM ids whose extrusions are replaced by interpretive geometry (plinth only)
LANDMARK_PLINTH = {51865486: 4.0, 54622334: 3.0, 403385111: 2.0, 663419192: 14.0}
