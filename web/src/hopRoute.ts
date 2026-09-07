import * as THREE from 'three';
import type { HopData, HopPath, HopPoint, HopStop } from './hopTypes.ts';
import { sampleHopPath } from './hopMotion.ts';

const GAUGE = 1.435; // gauge=1435 on the cached Milwaukee OSM tram ways.
function ribbon(points: HopPoint[], width: number, offset: number, lift: number) {
  const vertices: number[] = [];
  const sides = points.map((p, i) => {
    const a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
    const nx = (b[2] - a[2]) / length, nz = -(b[0] - a[0]) / length;
    return [-1, 1].map(s => [p[0] + nx * (offset + s * width / 2), p[1] + lift, p[2] + nz * (offset + s * width / 2)]);
  });
  for (let i = 1; i < sides.length; i++) {
    if (Math.hypot(points[i][0] - points[i - 1][0], points[i][2] - points[i - 1][2]) < .001) continue;
    const [a, b] = sides[i - 1], [c, d] = sides[i];
    vertices.push(...a, ...c, ...b, ...b, ...c, ...d);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  g.computeVertexNormals(); return g;
}

/** Project onto a directed traversal; keep opposite-direction platforms separate. */
export function locateHopPlatform(stop: HopStop, paths: HopPath[]) {
  let best = { point: stop.position, yaw: 0, side: 'right' as 'right' | 'left', error: Infinity };
  for (const path of paths) for (let i = 1; i < path.points.length; i++) {
    const a = path.points[i - 1], b = path.points[i];
    const dx = b[0] - a[0], dz = b[2] - a[2], squared = dx * dx + dz * dz;
    if (!squared) continue;
    const t = Math.max(0, Math.min(1, ((stop.position[0] - a[0]) * dx + (stop.position[2] - a[2]) * dz) / squared));
    const p: HopPoint = [a[0] + dx * t, a[1] + (b[1] - a[1]) * t, a[2] + dz * t];
    const error = Math.hypot(stop.position[0] - p[0], stop.position[2] - p[2]);
    if (error < best.error) best = { point: p, yaw: Math.atan2(dx, dz),
      side: stop.platformSide ?? ((stop.position[0] - p[0]) * dz - (stop.position[2] - p[2]) * dx >= 0 ? 'right' : 'left'), error };
  }
  return best;
}

/** Use the importer's directed stop attachment, including opposite visits to a street. */
export function scheduledHopPlatforms(data: HopData) {
  const result = new Map<string, ReturnType<typeof locateHopPlatform>>();
  const paths = new Map(data.paths.map(p => [p.id, p]));
  const stops = new Map(data.stops.map(s => [s.id, s]));
  for (const trip of [...data.trips].sort((a, b) => b.stops.length - a.stops.length)) {
    const path = paths.get(trip.pathId); if (!path) continue;
    for (const visit of trip.stops) {
      const key = `${path.id}:${visit.stopId}`, stop = stops.get(visit.stopId);
      if (result.has(key) || !stop) continue;
      const { position, tangent } = sampleHopPath(path, visit.distance);
      const lateral = (stop.position[0] - position[0]) * tangent[2] - (stop.position[2] - position[2]) * tangent[0];
      result.set(key, { point: position, yaw: Math.atan2(tangent[0], tangent[2]),
        side: stop.platformSide ?? (lateral >= 0 ? 'right' : 'left'),
        error: Math.hypot(stop.position[0] - position[0], stop.position[2] - position[2]) });
    }
  }
  return result;
}

export function buildHopRoute(data: HopData) {
  const group = new THREE.Group(); group.name = 'hop-track-and-platforms';
  const physical = new THREE.Group(); physical.name = 'embedded-tram-rails';
  const railMaterial = new THREE.MeshLambertMaterial({ color: 0x596267, side: THREE.DoubleSide });
  const overlayMaterials: THREE.Material[] = [], overlays = new Map<string, THREE.Group>();
  const guides: THREE.Line[] = [];
  const trackSources = data.physicalTracks ?? data.paths.map(p => ({ id: p.id, points: p.points, routeIds: [p.routeId] }));
  // The importer shares physical ways across M/L; fallback deduplicates identical edges.
  const seen = new Set<string>(), railPositions: number[] = [];
  for (const track of trackSources) {
    for (let i = 1; i < track.points.length; i++) {
      const pair = [track.points[i - 1], track.points[i]];
      const key = pair.map(p => p.map(v => Math.round(v * 10)).join(',')).sort().join('|');
      if (seen.has(key)) continue; seen.add(key);
      for (const offset of [-GAUGE / 2, GAUGE / 2]) {
        const geometry = ribbon(pair, .065, offset, .035);
        railPositions.push(...geometry.getAttribute('position').array); geometry.dispose();
      }
    }
  }
  const rails = new THREE.BufferGeometry(); rails.setAttribute('position', new THREE.Float32BufferAttribute(railPositions, 3)); rails.computeVertexNormals();
  physical.add(new THREE.Mesh(rails, railMaterial)); group.add(physical);
  for (const path of data.paths) {
    const overlay = new THREE.Group(); overlay.name = `${path.name}-route-overlay`;
    const material = new THREE.MeshBasicMaterial({ color: `#${path.color.replace('#', '')}`, transparent: true, opacity: .8,
      side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    overlayMaterials.push(material);
    const mesh = new THREE.Mesh(ribbon(path.points, .42, path.routeId === 'TL-7' ? -.28 : .28, .085), material); mesh.renderOrder = 3; overlay.add(mesh);
    // A one-pixel guide remains legible at city scale; it is an explicit map overlay.
    const guideMaterial = new THREE.LineBasicMaterial({ color: material.color, transparent: true, opacity: .8, depthTest: false, depthWrite: false });
    overlayMaterials.push(guideMaterial);
    const guide = new THREE.Line(new THREE.BufferGeometry().setFromPoints(path.points.map(p => new THREE.Vector3(p[0], p[1] + .1, p[2]))), guideMaterial);
    guide.renderOrder = 4; guide.visible = false; guides.push(guide); overlay.add(guide);
    overlays.set(path.routeId, overlay); overlay.visible = false; group.add(overlay);
  }
  const platformMaterial = new THREE.MeshLambertMaterial({ color: 0xb6b7aa });
  const warningMaterial = new THREE.MeshLambertMaterial({ color: 0xdbbc61 });
  const markerMaterial = new THREE.MeshLambertMaterial({ color: 0x456a58 });
  const platforms = new THREE.Group(); platforms.name = 'hop-directional-platforms';
  const deck = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, .35, 18), platformMaterial, data.stops.length);
  const edge = new THREE.InstancedMesh(new THREE.BoxGeometry(.22, .035, 18), warningMaterial, data.stops.length);
  const marker = new THREE.InstancedMesh(new THREE.BoxGeometry(.12, 2.4, .12), markerMaterial, data.stops.length);
  deck.name = 'hop-platform-decks'; edge.name = 'hop-platform-warning-edges'; marker.name = 'hop-platform-markers';
  platforms.add(deck, edge, marker);
  const scheduled = scheduledHopPlatforms(data);
  const placements = data.stops.map(stop => {
    const paths = data.paths.filter(path => data.trips.some(trip => trip.pathId === path.id && trip.stops.some(t => t.stopId === stop.id)));
    return paths.map(path => scheduled.get(`${path.id}:${stop.id}`)).find(Boolean) ?? locateHopPlatform(stop, paths);
  });
  const setHeightScale = (scale: number) => {
    placements.forEach((pose, index) => {
      const side = pose.side === 'right' ? 1 : -1;
      const station = new THREE.Matrix4().compose(new THREE.Vector3(pose.point[0], pose.point[1] * scale, pose.point[2]),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pose.yaw), new THREE.Vector3(1, 1, 1));
      deck.setMatrixAt(index, station.clone().multiply(new THREE.Matrix4().makeTranslation(side * 2.12, .175, 0)));
      edge.setMatrixAt(index, station.clone().multiply(new THREE.Matrix4().makeTranslation(side * 1.5, .367, 0)));
      marker.setMatrixAt(index, station.clone().multiply(new THREE.Matrix4().makeTranslation(side * 2.7, 1.45, 7.8)));
    });
    for (const mesh of [deck, edge, marker]) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); }
  };
  setHeightScale(1);
  return { group, overlays, platforms, setHeightScale,
    setGuideVisible(visible: boolean) { guides.forEach(line => { line.visible = visible; }); },
    setOverlay(show: boolean, visibleLines: Set<string>) { overlays.forEach((g, id) => { g.visible = show && visibleLines.has(id); }); },
    dispose() { platforms.traverse(o => { if (o instanceof THREE.Mesh) o.geometry.dispose(); }); platforms.removeFromParent(); group.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.Line) o.geometry.dispose(); });
      [railMaterial, platformMaterial, warningMaterial, markerMaterial, ...overlayMaterials].forEach(m => m.dispose()); group.removeFromParent(); },
  };
}
