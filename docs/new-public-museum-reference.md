# Nature & Culture Museum of Wisconsin — completed-design visualization

Open `http://127.0.0.1:5173/new-museum-review.html` for comparison views, or select **Nature & Culture Museum of Wisconsin** in the main landmark menu. This procedural model interprets the published completed design; it is not a surveyed or as-built architectural model.

## Sources

The main references are the [Ennead project gallery](https://ennead.com/work/milwaukee-public-museum-future-museum/), the [museum architecture gallery](https://www.mpm.edu/museum-survey), and the July 2023 **ZND Presentation** in [City of Milwaukee File 221922](https://milwaukee.legistar.com/LegislationDetail.aspx?ID=6184902&GUID=F1A228E0-938E-4747-A984-6B02756BC894&G=08FEFB22-B33A-4882-9C5A-6D37E84EF01D&Options=&Search=). The supplied official northwest and southeast corner renderings together document all four principal directions; they are perspective images, not orthographic elevation sheets.

The [architect-team announcement](https://www.kahlerslater.com/news/milwaukee-public-museum-reveals-design-for-new-museum-building), [museum topping-off announcement](https://www.mpm.edu/node/28580), and [museum account of the sculpted precast façade](https://www.mpm.edu/press/press-releases/local-business-crafts-future-museums-exterior) provide design and construction context. Consult the [museum FAQ](https://www.mpm.edu/wisconsin-wonders/faq) for project status and opening information.

Reference photographs are not embedded in this document, bundled as model textures, or represented as model output. Geometry and materials are procedural interpretations.

## Site and compass

`web/src/newMuseumSite.ts` retains cached OSM construction parcel **way 713732739**. It is a land-use polygon, not the museum footprint. PDF page 7 identifies Sixth Street to the west, McKinley Avenue to the south, Vliet Street to the north, and the We Energies substation to the east. The cached building tiles have no museum placeholder to remove; adjoining context geometry remains intact.

The scene uses **−X west / Sixth Street**, **+X east**, **+Z south / McKinley Avenue**, and **−Z north / Vliet Street**. The museum has no additional orientation rotation. Its broad entrance composition and tall glazed canyon face south toward McKinley. Model dimensions and placement are interpreted from the parcel and published imagery, not construction measurements.

## Building interpretation

The western side has separate, staggered rounded masses with a recessed cleft. A connected eastern wing fills the northeast portion of the museum footprint, with a rear solar roof and a planted front roof. The northeastern portion of the museum is not an empty quadrant.

Continuous rounded stone surfaces carry fine horizontal strata, localized scoops, recessed ribbon windows and ground-level glazing. The south entrance composition includes the tall glazed canyon and blue feature. Openings, reveals and glazing follow the stone contours. Roof planting, solar arrays and the glazed roof element remain simplified interpretations of the references.

## Landscape and parking

`web/src/newMuseumCampus.ts` follows the spatial organization in PDF pages **8 and 10**, supported by the garden and garage perspectives on pages **13–15**:

- A multilevel parking structure occupies the north/east portion of the parcel, with open deck bands, a horizontal garden-facing screen and banners on its Vliet frontage.
- The northwest garden combines an irregular rain-garden basin, lawn and mixed perimeter planting. An angular timber boardwalk follows the basin's east edge and reaches a small viewing platform.
- A continuous curved pedestrian route connects Vliet, the garden gathering area, the museum's west frontage and McKinley. Branches connect to Sixth Street, with café tables, benches and boulders near gathering areas.
- Street-edge tree rows and clustered garden trees accompany shrubs, grasses and flowering plants. These represent planting character and organization, not specified species or exact quantities from a planting schedule.

Paths and landscape details sample the local terrain. Campus geometry is batched by material to control rendering cost. Six perimeter streetlights and architectural lighting follow the day, sunset and night modes.

## Review and limits

Run `npm run test:newmuseum` from `web` for model, campus, placement and lighting checks, and `npm run build` for the production build. Use the live review page to compare the current model; earlier saved screenshots may show superseded geometry.

The model does not reproduce exact precast fabrication, surveyed dimensions, concealed construction, detailed interiors or every planting and furnishing element. The source plan establishes spatial relationships; the perspective renderings guide façade and landscape character. Neither supports a claim of exact architectural reconstruction.
