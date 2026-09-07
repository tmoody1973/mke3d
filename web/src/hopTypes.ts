/** Normalized operator snapshot. Coordinates are metres, x east / y up / z south. */
export type HopPoint = [number, number, number];
export interface HopPath { id: string; routeId: string; name: string; color: string; points: HopPoint[]; distances: number[]; length: number }
export interface HopStop { id: string; name: string; position: HopPoint; platformSide?: 'left' | 'right'; }
export interface HopStopTime { stopId: string; arrival: number; departure: number; distance: number; inferred?: boolean }
export interface HopTrip { id: string; routeId: string; serviceId: string; blockId: string; pathId: string; stops: HopStopTime[] }
export interface HopCalendar { id: string; start: string; end: string; weekdays: boolean[] }
export interface HopData {
  version: 1; defaultDate: string; defaultTime: number;
  paths: HopPath[]; stops: HopStop[]; trips: HopTrip[];
  physicalTracks?: { id: string; points: HopPoint[]; routeIds: string[] }[];
  calendars: HopCalendar[]; exceptions: { serviceId: string; date: string; type: 1 | 2 }[];
  provenance: Record<string, unknown>;
}
