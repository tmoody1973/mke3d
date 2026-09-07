# Mitchell Park Domes model reference

The model uses the documented overall dimensions of each conservatory dome: 140 ft (42.672 m) diameter and 85 ft (25.908 m) above the floor. The broad crown opening/cap is 37 ft (11.2776 m) in diameter. These measured values come from Milwaukee County's *Mitchell Park Horticultural Conservatory 2016 Update on Costs and Options for the Domes* and the City of Milwaukee Historic Preservation Commission's *South Side Comprehensive Survey*.

The conoidal profile, truncation at the crown, diagonal aluminum glazing grid, heavier structural rhythm, perimeter base panels, low connector, and narrow repeated entrance arches are interpretive observations from the project photo references `domes_01_aerial_complex_milwaukee_domes_alliance.jpg`, `domes_02_oculus_glazing_national_trust.jpg`, and `domes_03_front_three_domes_overview.jpg`. Exact frame topology, pane colors, planting masses, connector dimensions, and entrance-bay dimensions are approximations chosen for recognition and real-time rendering.

Local coordinates use metres, +X east, +Z south, and floor elevation Y=0. The public entrance faces west. Foundations extend slightly below Y=0 to avoid floating geometry. Transparent glazing does not cast a solid shadow; the separate aluminum and concrete structure does.

The three local center points are derived from fitted arcs of OSM feature 54622334: Desert `(-18, -37.9735)`, Show `(-18, 37.9735)`, and Tropical `(17.6589, 0.4473)`. Their center spacing is therefore site-derived rather than inferred from the photographs.

Sources:

- Milwaukee County, [2016 Update on Costs and Options for the Domes](https://county.milwaukee.gov/files/county/administrative-services/ArchEng/Bids-and-RFPs/5GRAEFMitchellParkHorticulturalConservatory-2016UpdateonCostsandOptionsforDomes.pdf)
- City of Milwaukee Historic Preservation Commission, [South Side Comprehensive Survey](https://city.milwaukee.gov/ImageLibrary/Groups/cityHPC/Books/SouthSideSurveyFinalReport-sml.pdf)

## Placement and verification

The preserved OSM 54622334 outline supplied the northwest, southeast and rear dome arcs. Their fitted centers in local city metres are (-3363.763, 922.796), (-3311.684, 978.075), and (-3311.462, 926.309). The rear circle is inferred from a short exposed arc and is less certain. The rebuilt shells use the published diameter rather than the slightly larger mapped outer foundations. The entrance axis faces southwest (about 227 degrees). Floor elevation is 23.3 m above the city's lake datum, with foundation skirts extended to the sampled terrain.

The previous 3 m footprint extrusion is removed at runtime at both tile detail levels; the same OSM object is excluded from future full tile builds. Rear greenhouse ranges are rebuilt from the mapped extent, with approximate roof ridges and transition-house height. Cached building/road tile files are retained unchanged.

The browser check used the southwest front view at 1× height. Structural topology, glass optical response, planting, entrance shells, and greenhouse roofs remain interpretations, not survey measurements. No reference photograph is shipped as a texture.

## Additional photograph refinement, September 2026

All five photographs in `milwaukee_threejs_photo_references/photos/mitchell_park_domes/` were inspected. The fourth file, `domes_04_structural_glazing_interior_national_trust.webp`, actually shows an **exterior close-up of the entrance vaults**, not an interior structural view. It makes their continuous, thin concrete shells and deep side faces particularly clear. Photographs 03 and 05 show the recessed glazing extending into the rounded arch heads, slender vertical mullions, and low door rails. The model now includes these surfaces instead of relying on separated arch beams and short window rectangles.

The aerial and frontal views show a closed shallow crown above the sloped glazed collar; photograph 02 confirms a broad opaque underside. The previous open cylinder now has a closed, subtly raised metal roof, perimeter rim, and radial seams, while retaining the documented 37 ft outer collar and 85 ft total height. Roof pitch, rim thickness, seams, and finish are photographic approximations; the photographs do not establish a detailed mechanical roof assembly.

Photographs 03 and 05 also show pale triangular ventilated panels around the conservatory bases. Those are now represented by low panels, sloped framing, and narrow horizontal strips. A construction-order bug had appended the base-frame vertices after the structural mesh was created; they are now included in the rendered geometry. Panel heights and vent-strip count are interpretive. The photographed entrance-shell thickness and glazing subdivisions are also approximate, not measured construction details.

The new pass does not change dome diameters, heights, fitted centers, overall conoidal profile, mapped service-building footprints, or terrain grounding. Geometry remains under 20 meshes. Regression checks cover closed crown surfaces, continuous entrance shelter, glazing visibility in front of the lobby wall, outward plinth faces, overall physical scale, finite geometry, mode restoration, and selective placeholder removal. Reference files remain local evidence and are not shipped as model textures.
