import type { BuildingSign } from './buildingSigns';

// Interior points from the named OSM tower footprints in the shipped extract.
// Heights/wall locations are resolved against the active tile, not hard-coded.
const bmo: [number, number] = [-311.31, -642.94]; // way/592527373

export const BUILDING_SIGNS: BuildingSign[] = [
  {
    name: 'BMO Tower west sign', center: bmo, face: [-1, 0],
    logo: 'bmo.svg', width: 12, height: 12 * 72 / 209, belowRoof: 5, backing: 0xf6f5f0,
  },
];
