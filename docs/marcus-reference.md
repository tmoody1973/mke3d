# Marcus Center campus

The district and `marcus-review.html` use the same models: main performing arts center, Peck Pavilion and community grounds, north parking structure and the State Street skywalk. Marcus Center and Peck Pavilion are separate walking/tour destinations; lighting follows the city’s day, sunset and night modes.

## Reference controls

The user-supplied Marcus reference pack provides visual controls for the glass entrance, stepped stone halls, red/blue/white nighttime facade washes, open pavilion roof, current landscaping and garage’s vertical concrete fins. The two broad garage photographs are duplicates; the third corroborates the open decks and fins. The Vogel Hall image is a rendering and the aerial is historical, so neither establishes current landscaping by itself. Photos are not bundled as textures.

[The City’s garage RFP](https://city.milwaukee.gov/ImageLibrary/Groups/cityDCD/projects/pdfs/MarcusCenterRFPFinalDraft.pdf) confirms the existing parking structure and skywalk immediately north of the center. This model represents that structure, not a proposed replacement development. Deck heights, fin spacing, stair volumes and architectural ornament are photograph-based approximations.

[GRAEF’s completed landscape description](https://graef-usa.com/marcus-centers-newly-unveiled-exterior-upgrades/) controls the current at-grade lawn, two dozen honey locusts, crushed-stone cafe borders, native planting beds and southeast circular memorial. The historical sunken chestnut grove is not reconstructed. [Peck Pavilion’s venue page](https://www.marcuscenter.org/host-an-event/peck-pavilion/) supplies the seating capacity; individual seats and truss geometry are approximate.

## Map and ground alignment

`marcusSite.ts` records exact cached OSM rings for the main center, pavilion, garage, connector and southwest canopy, plus independently sampled street/terrain heights. X points east and Z points south. The main east entrance uses the Water Street approach elevation; the grounds follow the slope toward the river.

Only matching old building triangles and the spurious elevated skywalk road ribbon are removed, in full and distant tile detail levels. State Street below the connector, neighboring buildings and ordinary road geometry are preserved. The review page loads the shipped terrain elevations, so it can reveal ground-contact issues hidden by a flat preview.

## Validation and limits

Tests cover source replacement, geometry, open passages, terrain contact, walking on public paths, and lighting resets. Browser views compare the campus, entrance, pavilion, garage and night mode. This is an interpretive exterior model; exact construction details and photometric lighting are not surveyed.
