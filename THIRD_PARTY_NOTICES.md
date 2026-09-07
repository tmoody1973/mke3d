# Third-party notices

The [MIT license](LICENSE) covers original project code and documentation.
Third-party data, fonts, artwork, trademarks, and dependencies retain their
respective licenses and ownership; the project MIT license does not replace
those terms.

## Geographic data

- Buildings, roads, parks, water, and coastline: © OpenStreetMap contributors,
  available under the [Open Database License (ODbL)](https://www.openstreetmap.org/copyright).
  The source extract is provided by [Geofabrik](https://download.geofabrik.de/).
  Extract dates and derived-data statistics are recorded in
  [`web/public/data/stats.json`](web/public/data/stats.json).
- City limits, Waterways, parcel outlines, and the Master Property File
  (MPROP): [City of Milwaukee Open Data](https://data.milwaukee.gov), credited
  as CC-BY in the project source documentation.
- Elevation: [Terrain Tiles on AWS](https://registry.opendata.aws/terrain-tiles/)
  (Mapzen terrarium), with underlying USGS 3DEP/NED, GEBCO, and other providers.
  See the source registry for provider attribution and terms. The local North
  Point Lighthouse terrain patch uses USGS 3DEP elevation data; source details
  are in [`docs/lighthouse-terrain.md`](docs/lighthouse-terrain.md).
- Landmark verification uses Nominatim / OpenStreetMap. Additional site,
  architecture, and transit references are documented in `docs/` and relevant
  generated-data metadata.

The shipped geographic assets in `web/public/data/` include data derived from
these sources. They are not relicensed as MIT. Preserve source attribution and
comply with the applicable source licenses when redistributing or modifying
them. See also the [README attribution](README.md#attribution) and the in-app
About panel.

## Fonts

The bundled Barlow and Barlow Condensed fonts are Copyright 2017 The Barlow
Project Authors and are licensed under the SIL Open Font License, Version 1.1.
The complete copyright and license notice is included in
[`web/public/fonts/OFL.txt`](web/public/fonts/OFL.txt).

## Building signs and trademarks

U.S. Bank, Baird, BMO, and Fiserv Forum logo assets remain the property of their
respective owners. Official source URLs, modifications, and architectural
placement notes are recorded in
[`web/public/signs/SOURCES.md`](web/public/signs/SOURCES.md).
Names, logos, and other trademarks identify modeled buildings and places;
their inclusion does not claim affiliation, sponsorship, or endorsement or
grant trademark rights under the MIT license.

## Research photographs

Local reference-photo packs are excluded from this repository. They were
collected for visual study and are not assumed to permit redistribution.
Reference links and modeling notes in `docs/` document the sources used to
construct the project's interpretive geometry.

## Software dependencies

Third-party packages retain their own licenses. Dependency versions are
recorded in `web/package.json` and `web/package-lock.json`; installed packages
include their applicable license notices. The project MIT license does not
replace those notices.
