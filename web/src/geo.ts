/** Manifest shape written by pipeline/build_tiles.py and the lon/lat -> local-meter projection it used. */
export interface TileInfo { i: number; j: number; cx: number; cz: number; bytes: number; lodBytes: number; buildings: number; lodBuildings: number }
export interface Stats {
  generated: string; buildings: number; buildings_in_city_limits: number;
  height_source: Record<string, { count: number; pct: number }>; max_height_m: number; tiles: number;
  tile_bytes_total: number; lod_bytes_total: number; water_polygons: number; lake_area_km2: number | null; green_polygons: number; osm_elements: number;
}
export interface Manifest {
  version: number; origin: { lat: number; lon: number }; mPerDegLat: number; mPerDegLon: number; tileSize: number; lakeDatumM: number;
  bounds: { x0: number; z0: number; x1: number; z1: number }; tiles: TileInfo[]; stats: Stats;
}

/** WGS84 -> local meters in Three.js axes (x east, z south). Same math as pipeline/geometry.to_local. */
export function lonLatToLocal(m: Manifest, lon: number, lat: number): [number, number] {
  return [(lon - m.origin.lon) * m.mPerDegLon, -(lat - m.origin.lat) * m.mPerDegLat];
}
