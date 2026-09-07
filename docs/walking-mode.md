# Street-level district walking

The main map now offers **Walk around a district** below the driving button. Start near the current map focus or choose Deer District, Historic Third Ward, Public Market, Lakefront & Museum Campus, or Nature & Culture Museum.

The first-person camera stays 1.7 m above supported ground. WASD moves; left/right arrows turn; up/down arrows move; dragging looks around and up; Page Up/Down changes pitch. Shift uses a brisk pace. The pace selector offers stroll (0.9 m/s), walk (1.65 m/s), and brisk (3.2 m/s). Touch movement buttons can also be held with Space/Enter. Day, sunset, and night remain available. Back to start resets the pedestrian position; Back to map or Escape restores the prior aerial view and exaggeration.

Movement uses a 0.3 m pedestrian footprint, short collision substeps, and sliding along real building triangles. It supports loaded terrain/plazas and nearby road decks, rejects water, unloaded ground, steep slopes and large steps, and avoids snapping to overhead highways. Named landmark collision meshes participate. District positions are starting suggestions; spawn selection finds nearby supported ground within 120 m. This is an exterior exploration mode, not a complete interior or stair navigation system. Untagged decorative furnishings are not all colliders.

Verification: 10 walking-world tests cover narrow passages, sliding/reverse, thin walls, water, bridge height, steep ramps, open-bottom building shells, public passages, loaded coverage, and cache invalidation. Existing 29 driving checks pass. Browser verification covers Deer District entry, free look above the arena, movement via the on-screen pad and the distance counter.
