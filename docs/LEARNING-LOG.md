# Learning log

## 2026-09-06 — Live map APIs are not a build dependency
**Expected:** Pulling Milwaukee from the OpenStreetMap live API in ~100 small squares would take about ten minutes.
**Happened:** The API allowed one request at a time from this address and rejected most of the rest; 9 squares in 15 minutes.
**Now believe:** For anything reproducible, download a dated extract and process it locally. Keep live APIs for one-off lookups (we still used one to verify twelve landmark coordinates).

## 2026-09-06 — "The lake isn't in the file" usually means it's there under a different name
**Expected:** The shoreline would be tagged as coastline, like an ocean.
**Happened:** Zero coastline ways in the whole Wisconsin file. The Great Lakes are one giant "water" relation, and a regional extract only contains its untagged member ways.
**Now believe:** When a feature is "missing", check how the source models it before switching sources. Reading the relation's members gave us 743 shoreline pieces from the same file.

## 2026-09-06 — Two invisible-geometry bugs, both caught by counting instead of looking
**Expected:** If a shape renders "solid", its triangles are fine.
**Happened:** Every roof and water surface faced downward (the renderer skips faces pointing away from you), and the city-wide water file collapsed to zero-area triangles because 16-bit positions only reach ±3.3 km from a file's center. Buildings still *looked* solid because we were seeing the inside of the far walls.
**Now believe:** For geometry, write a numeric check (count up-facing vs down-facing triangles, check coordinate ranges) before trusting a screenshot. A test now guards the winding rule; the writer splits wide files automatically.
