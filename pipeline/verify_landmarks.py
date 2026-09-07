"""Look up each landmark on Nominatim (OSM geocoder) and print lat/lon + OSM id.
Run: pipeline/.venv/bin/python pipeline/verify_landmarks.py
Respects Nominatim's 1 req/s policy."""
import json, time, requests, sys
NAMES = [
 "Milwaukee Art Museum", "Hoan Bridge", "Milwaukee City Hall", "Fiserv Forum",
 "American Family Field", "Mitchell Park Domes", "Discovery World", "North Point Lighthouse",
 "Basilica of St. Josaphat", "Historic Third Ward", "Henry Maier Festival Park", "Milwaukee Public Market",
]
out = []
for n in NAMES:
    r = requests.get("https://nominatim.openstreetmap.org/search",
        params={"q": n + ", Milwaukee, WI", "format": "json", "limit": 1},
        headers={"User-Agent": "mke3d-landmark-check/1.0 (tarik@radiomilwaukee.org)"}, timeout=30)
    j = r.json()
    if j:
        h = j[0]; out.append({"name": n, "lat": float(h["lat"]), "lon": float(h["lon"]),
                              "osm": f'{h["osm_type"]}/{h["osm_id"]}', "display": h["display_name"][:80]})
    else:
        out.append({"name": n, "error": "no result"})
    print(json.dumps(out[-1])); sys.stdout.flush()
    time.sleep(1.1)
json.dump(out, open("data/landmarks_nominatim.json", "w"), indent=1)
