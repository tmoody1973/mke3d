# Highway structure mesh

`pipeline/highway_details.py` adds markings and a lightweight structural shell
to OSM highway centerlines. Coordinates stay in local `(east, north)` meters
until emission, when north becomes Three.js `-z`. All structure is clipped to
the same 2 km tile grid as the road surface.

## Integration contract

```python
build_highway_details(
    coords,
    width,
    tags,
    height,
    ground_at,
    blockers=None,
    support_allowed=None,
    end_caps=(False, False),
    end_setbacks=(12.0, 12.0),
)
```

`coords` is the original OSM alignment and `width` is the resolved width of
that way. `height(east, north)` must be the same profile used to tessellate the
road surface. The builder samples it at the actual lateral vertices, so a
sloped or banked road meets its deck sides without a gap.

Call the builder for every accepted `bridge=*` way with a profile, including
non-freeway road and path bridges. Marking output is internally limited to
motorway, trunk, primary, and secondary classes and their links. Path bridges
therefore get structure without freeway shoulder paint.

`blockers(x, north, radius, deck_bottom)` rejects a column that would intersect
another road below the deck. `support_allowed(x, north, radius)` is the place
for project-level land and water knowledge. Return false where a foundation
would lie in a navigable channel or on another unsuitable surface. A rejected
column produces no floating cap beam.

Full-width end caps default off. OSM commonly splits one physical bridge into
several ways, and a cap on every source endpoint appears as a vertical curtain.
Only request an end cap for a verified exposed structural end. In the usual
case, leave the shell open where it enters its approach pavement or abutment.

Rail setbacks are independent at the start and end. At a plain continuation
between ways, pass zero for that joined end. A branch or ramp mouth may use a
larger clearance, while an outer bridge end can use a short setback. This
prevents the former 24 m guardrail gap at every OSM split. A zero-setback end
also omits the small rail end face, so two continuous ways do not stack
coplanar caps at their shared node.

## Geometry rules

- Adjacent source segments share a bounded mitered cross-section. This closes
  bends without overlapping side slivers or gaps, while a twofold miter limit
  prevents spikes at malformed near-reversals.
- Road decks scale from 0.7 to 1.2 m deep. Foot and cycle bridge decks scale
  from 0.25 to 0.45 m and use an open post-and-handrail edge treatment.
- Deck sides, underside, rails, columns, and cap beams have explicit outward
  winding. Structure colors are opaque RGB values.
- Columns sample all four foundation corners and extend 5 cm into terrain so a
  slope cannot leave a floating edge.
- Ways shorter than 72 m do not receive inferred intermediate supports.
  `bridge=movable` and mapped bascule, lift, swing, or drawbridge spans receive
  no inferred piers or mechanism. Their mapped alignment and clear opening are
  preserved until surveyed structure is available.
- Longer fixed spans use evenly spaced compact bents near the source alignment.
  Candidate columns still require both the road blocker and support policy to
  accept them.

## Verification

Run the focused suite with the pipeline environment:

```sh
pipeline/.venv/bin/python pipeline/test_highway_details.py
```

The checks cover marking elevation and budget, tile clipping, curved alignment,
lateral deck contact, bend continuity, absence of full-width curtains, outward
opaque faces, terrain contact, road/water-style support rejection, opening and
short-span clearance, pedestrian deck/rail treatment, and a one-kilometre
triangle budget.

Road packing also enforces upward winding after 10 cm vertex quantization.
Long, very narrow triangles can reverse when rounded; their vertex order and
attached colors are swapped together. Structural faces retain their intended
orientation, including downward-facing undersides. The regression fixture is
`pipeline/test_tile_packing.py`.
