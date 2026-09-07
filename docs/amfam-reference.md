# American Family Field model references

The dedicated ballpark replaces the single-height extrusion from OpenStreetMap relation 5747956. Its source outline is about 245 by 252 metres in world axes. `data/amfam_site.json` preserves the mapped 143-node outer outline and the placement calculation. The runtime site contract keeps that boundary separate from 41 additional cached source nodes used by the relation's interior roof triangulation. The older landmark label referred to a constituent way; it now links to the full stadium relation.

Home plate is inferred from the circular backstop in mapped pitch way 1209147114. The resulting center-field bearing is approximately 125 degrees clockwise from north, toward the east-southeast. This is a geometric inference from the pitch, not a surveyed home-plate coordinate. The model floor is 11.85 metres above the project's lake datum, just above the local terrain samples. All model dimensions use metres and the normal review setting is 1× height.

Reference evidence:

- [Brewers roof description](https://www.mlb.com/brewers/ballpark/roof-status): seven panels, five movable; three stack left and two right; approximately 600-foot span.
- [Brewers facts and figures](https://www.mlb.com/brewers/ballpark/facts-figures): listed roof peak 330 feet.
- [Brewers exterior reference photograph](https://img.mlbstatic.com/mlb-images/image/upload/t_2x1/t_w1536/mlb/ckyq6nib4fqzpq1yl62s.jpg): brick entrance arcade, glazed arches, green truss work, cornices and stacked roof panels.
- Cached OpenStreetMap stadium and pitch geometry; field boundary tags include 344-foot left field, 345-foot right field and 400-foot center field.

The roof starts in an illustrative open configuration, independent of the real stadium's current roof status. The landmark panel now offers Open roof / Close roof. Individual truss members, seating tiers, facade bays, materials and lighting are approximations. The model is an architectural interpretation rather than a scanned or engineering model.

The full-detail and distant tiles are filtered by exact source nodes at the unique original 10.17-metre base and 112.27-metre roof elevations. The replacement removes 549 full-detail triangles and 222 distant-detail triangles while preserving packed attributes and unrelated tile sections. Future pipeline builds omit the source relation directly. At runtime the original bounding ellipse is replaced in place by an extrusion of the mapped footprint; its underside reaches the lowest finite terrain sample around the outline, avoiding a floating or clipped stadium edge on the large sloping site.

Night lighting uses emissive glazing, signs, floodlight fixtures and a restrained field wash to keep the playing surface readable; it is a rendering approximation rather than a simulation of every stadium light.

## September 7 photo completion pass

The supplied `american_family_field_threejs_photo_references` pack was checked
against the existing factory. File labels are not reliable roof-state evidence:
01 shows an open central aperture despite its `roof_closed` filename; 10 is an
exterior entry/roof view rather than the labeled interior club view. Photo 08
shows the open fan from overhead. Photos 05–07 establish fine curtain-wall
framing, brick reveals, suspended canopies, a slender entrance tower and the
pivot's open steel service frame. Historical Miller Park branding is not copied.
Reference images remain local study material; none are shipped as textures.

The roof retains seven panels and uses angular positioning about the common
pivot: five movable panels close the central opening and return to three left
and two right stacks. Fixed wings remain in place. The two outer clerestory
trusses are shallow; movable-panel trusses retain deeper curved chords. The
control switches between model states, without claiming a timed mechanical
simulation or live stadium roof status.

The public facade now samples the mapped perimeter rather than the old bounding
ellipse. This corrects its over-wide shoulders and keeps the detailed arches,
doors, canopies and entry tower aligned to the same wall surface. A continuous
concourse roof closes the gaps between the brick facade and radial roof wings.
Fixed-wing bearing columns reach ground. Seating now wraps behind home plate,
has visible row bands and aisles, and is contained by the stadium envelope;
fair territory remains clear. Fine elevations, member sizes, tower location,
seating subdivisions and roof-stack clearances remain photo interpretations.

The detail assembly adds four merged meshes with no extra light objects. The
whole model stays within 44 meshes (excluding the browser name sign) and 100,000
triangles. Tests cover mapped facade positions and outward normals, grounded
tower/frame/foundation, open and closed roof raycasts, fixed-panel stability,
baseball dimensions, a continuous backstop bowl, lighting restoration and exact
cached-tile preservation. `/amfam-review.html` uses the production factory at 1×.

The broader parking lots, access streets and freeway context remain the existing
streamed city data. This pass does not recreate every stall, landscape feature,
interior concession, scoreboard graphic or temporary event fixture.


## Screenshot geometry repair

The two user screenshots exposed unsupported roof-track columns, a straight
rear wall through fair territory, and green seating walls extending to grade.
The former roof-fitting function also discarded whole seating triangles,
producing the hanging pointed shapes. These have been replaced by three
continuous decks, shallow underside slabs, concrete concourses and columns.
The bowl follows the first intersection with the mapped footprint and leaves
the playing field clear. The scoreboard and its legs now sit beyond center field.

Lower wing walls and rectangular glazing share the clerestory's radial planes.
The outfield enclosure follows the mapped rear perimeter, with glazed bays,
piers and cornices. Roof-track bents reach grade and carry a continuous curved
beam. Nested leaf offsets taper to the common pivot and outer bearing heights;
the fixed wings sit below the movable stacks. Stack clearances remain estimated,
not engineering dimensions. The field now includes curved foul territory, an
inner grass diamond and the pitcher’s mound.

The local review camera near plane is one metre, preventing depth flicker between
the turf and foundation at distant photographic angles. The production city
already uses a four-metre near plane. Daylight open, closed, entrance and bowl
views were checked at 1× using the production model factory.

Review captures: [open entrance](review/amfam-repaired-open.png),
[bowl](review/amfam-repaired-bowl.png), [closed roof](review/amfam-repaired-closed.png).
