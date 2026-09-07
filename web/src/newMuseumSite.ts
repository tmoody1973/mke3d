import type * as THREE from 'three';

/** Cached OSM way 713732739 is the construction parcel, not a building shell.
 * Coordinates use the scene projection: X east, Z south, metres. */
export const NEW_MUSEUM_PARCEL = {
  id: 713732739,
  kind: 'construction-site',
  footprint: [
    [-1097.791,-1477.081],[-1103.227,-1351.579],[-1102.901,-1349.545],
    [-1102.136,-1348.406],[-1101.616,-1347.974],[-1101.127,-1347.565],
    [-1099.899,-1346.891],[-1097.612,-1346.349],[-1023.421,-1345.376],
    [-1021.533,-1482.455],[-1090.851,-1483.66],[-1092.836,-1483.35],
    [-1094.797,-1482.432],[-1096.481,-1480.52],[-1097.384,-1479.016],
  ],
  center:{x:-1061.447,z:-1413.89},
  bounds: {xMin:-1103.227,xMax:-1021.533,zMin:-1483.66,zMax:-1345.376},
  streets: {west:'North 6th Street',south:'West McKinley Avenue',north:'West Vliet Street'},
  areaM2: 10689.35,
} as const;

export const NEW_MUSEUM_SITE = {
  // Interpreted completed museum mass in the south parcel, inset from streets.
  x:-1061.447,z:-1387,lat:43.047544,lon:-87.9180448,
  bearing:0,
  // Legacy reference datum; the campus derives its actual finished floor from terrain.
  floor:7.664,
  buildingWidth:52,
  buildingDepth:60,
  sourceId:NEW_MUSEUM_PARCEL.id,
  garagePlacement:'separate-east-context',
} as const;

export const NEW_MUSEUM_SOURCE=NEW_MUSEUM_PARCEL;

/** The cached OSM element is landuse=construction and was never emitted into
 * the packed BLDG section. Keep this integration hook as a proven no-op so the
 * adjacent garages and industrial buildings cannot be removed accidentally. */
export function removeNewMuseumPlaceholder(_group:THREE.Group,_tile:{i:number;j:number}):number{return 0;}
