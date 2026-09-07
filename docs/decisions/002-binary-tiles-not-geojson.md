# 002 — Pre-built binary tiles instead of drawing from GeoJSON in the browser

**Decision** — The pipeline turns every footprint into triangles ahead of time and writes them as compact binary files, one per 2 km square (plus a lighter "far away" version of each). The browser only reads triangles; it never sees a polygon.

**Why this came up** — Extruding 150,000 polygons in the browser takes tens of seconds on a laptop and much longer on a phone, and drawing each building separately would mean 150,000 draw calls (a draw call is one instruction to the graphics card; a few thousand per frame is the practical ceiling).

**Options**
- *Ship GeoJSON and extrude in the browser.* Simplest pipeline, but slow first paint and heavy memory on mobile.
- *Pre-triangulate into binary tiles (chosen).* Fast to load, one draw call per tile per layer, but a custom file format that both the Python writer and the TypeScript reader must agree on.
- *Use a vector-tile server (Mapbox/MapLibre style).* Mature tooling, but adds a tile server or a hosted service for what is a static site.

**What we chose and why** — Binary tiles, with positions stored as 16-bit integers in tenths of a meter relative to the tile center, which halves the size versus 32-bit floats. Claude's call, within Tarik's "no per-building draw call" and "static, deployable" constraints.

**What we gave up** — Nothing in the browser knows which building is which; hover-to-identify a building would need an extra ID layer. The format is ours, so any change means regenerating all tiles.

**How we'll know if this was right** — Downtown should appear in under 3 seconds on a laptop and the phone build should hold a steady frame rate with the reduced-detail radius. If either fails, the tile size or LOD threshold is the first knob to turn.

**What actually happened** —
