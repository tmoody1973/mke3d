# North Point Lighthouse model

The model uses the cached OpenStreetMap geometries for the lighthouse tower (way 403385102) and keeper's house (way 403385111). Coordinates use the project projection:

```text
x = (longitude + 87.905) * 81367.90195302747
z = (43.035 - latitude) * 110574
```

`LIGHTHOUSE_SITE` is the center of the tower's projected bounding box at `(2734.588038467133, -3380.667361200293)`. The tower plinth retains the eight mapped perimeter vertices, spanning about 7.55 by 7.14 metres. HABS sheet 3 shows that the shaft steps inward above this wide footing, then tapers from roughly 20 feet across to about 12–13 feet below the cornice. The house foundation follows its full mapped outline, including the narrow corridor that meets the tower, and lies directly north (negative Z) of it. The OSM `height=74 ft` value attached to the house is intentionally ignored because it describes the lighthouse complex rather than a plausible two-storey dwelling.

The tower is 74 feet (22.5552 metres) from terrain to finial. Its lower 35-foot stage represents the steel extension installed beneath the original structure in 1912 and includes the visible riveted panel grid; the upper white shaft represents the 1888 cast-iron tower. HABS sheet 2 controls the approximately 17-metre shaft-wall height, deep flared white cornice, narrower black octagonal gallery, open railings, glazed lantern room, polygonal cap, and finial. Sheet 4 controls the small glass apertures within larger ornamental porthole surrounds and the narrow upper square-window proportions. There is no rotating or simulated beacon.

The keeper's house is modeled at a credible two-storey scale, with an approximately 9.82-metre ridge. The mapped tower corridor remains one storey while the dwelling rises behind it. White clapboard courses, dark sash windows with white trim, a columned and railed porch, steps, a brick chimney, and overlapping red gable roofs preserve the details visible in the reference photographs while repeated pieces are merged by material to limit draw calls.

Visual and historical references:

- North Point Lighthouse, [History](https://northpointlighthouse.org/learn/history/): the octagonal 1888 tower was originally 39 feet tall, raised onto a 35-foot steel base in 1912 for a 74-foot tower, and decommissioned in 1994. The site stands 154 feet above Lake Michigan.
- North Point Lighthouse official home-page aerial, `north-point-lighthouse-drone-view-2.jpg`: verified the house north of the tower, connecting corridor, intersecting red gables, black gallery and lantern, and shallow cap.
- Getting Stamped, `North-Point-Lighthouse-Wisconsin_-960x540.jpg`: verified the south elevation's clapboard siding, porch, sash-window rhythm, stairs, chimney, tower taper, portholes, and gallery proportions.
- HABS WI-358 sheets 2–4 (public domain) in the supplied reference pack: orthographic control for the stepped plinth, six tapering floor plans, shaft/cornice/lantern proportions, and opening details. The 400 dpi scans are drawn at 1/4 inch to one foot for sheets 2 and 3.
- Reference-pack current photos `npl_01`, `npl_02`, and `npl_06`: verified current white painted steel panel seams, white clapboard siding, red roofing, one-storey corridor, window placement, and black lantern assembly. The pack's `npl_05` is a lecture sign rather than the stated building overview and was not used as a geometry reference.

`buildLighthouse(groundAt)` returns a world-positioned group named `north-point-lighthouse`, grounded at the tower center. `userData.setLightingMode('day' | 'sunset' | 'night')` adjusts only window and lantern-room emissive light; it does not animate or add navigational-light behavior.
