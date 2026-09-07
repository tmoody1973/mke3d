import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LIGHTHOUSE_SITE_DATA, type SiteArea, type SitePoint, type SiteWay } from './lighthouseSiteData.ts';

export const LIGHTHOUSE_SITE_BOUNDS = Object.freeze({ minX: 2450, maxX: 3070, minZ: -3690, maxZ: -3090 });
const TERRAIN_DISPLAY_OFFSET = -.6;
const SURFACE_Y = -.3;
const BRIDGE_IDS = new Set([403385113, 403666568]);
const MAX_TREES = 480;
type XZ = readonly [number, number];

interface BuiltBridge {
  id: number;
  endpoints: [[number, number, number], [number, number, number]];
  midpoint: [number, number, number];
  source: 'OpenStreetMap';
}

function distanceToSegment(point: XZ, a: XZ, b: XZ): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const length2 = dx * dx + dz * dz;
  const amount = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / length2));
  return Math.hypot(point[0] - (a[0] + dx * amount), point[1] - (a[1] + dz * amount));
}

function densify(path: readonly SitePoint[], maximum = 1.5): XZ[] {
  if (path.length < 2) return [];
  const result: XZ[] = [[path[0][0], path[0][1]]];
  for (let index = 0; index < path.length - 1; index++) {
    const a = path[index], b = path[index + 1];
    const count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / maximum));
    for (let step = 1; step <= count; step++) {
      const amount = step / count;
      result.push([a[0] + (b[0] - a[0]) * amount, a[1] + (b[1] - a[1]) * amount]);
    }
  }
  return result;
}

export function lighthouseRoadWidth(way: SiteWay): number {
  const tags = way.tags;
  if (way.id === 18989099) return 4.2; // East Ravine Road is a paved, motor-vehicle-free park path.
  if (tags.bridge) return 3.4;
  if (tags.highway === 'primary') return Math.max(7.2, Number(tags.lanes ?? 2) * 3.3);
  if (tags.highway === 'secondary') return Math.max(7.2, Number(tags.lanes ?? 2) * 3.2);
  if (tags.highway === 'residential' || tags.highway === 'unclassified') return 6.4;
  if (tags.highway === 'service') return tags.service === 'parking_aisle' ? 4.8 : tags.service === 'driveway' ? 3.5 : 4.0;
  if (tags.highway === 'cycleway' || tags.highway === 'path') return 3.0;
  if (tags.highway === 'steps') return 1.6;
  return tags.footway === 'crossing' ? 2.2 : 1.8;
}

function materialClass(way: SiteWay): 'road' | 'concrete' | 'path' | 'steps' {
  if (way.tags.highway === 'steps') return 'steps';
  if (way.id === 18989099 || ['cycleway', 'path', 'footway'].includes(way.tags.highway ?? '')) return way.tags.surface === 'concrete' || way.tags.surface === 'paving_stones' ? 'concrete' : 'path';
  return way.tags.surface === 'concrete' ? 'concrete' : 'road';
}

function pushTriangle(output: number[], a: readonly [number, number, number], b: readonly [number, number, number], c: readonly [number, number, number]): void {
  const normalY = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
  if (normalY >= 0) output.push(...a, ...b, ...c);
  else output.push(...a, ...c, ...b);
}

function geometryFromTriangles(positions: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  return geometry;
}

function bridgeEndpoints(): XZ[] {
  const endpoints: XZ[] = [];
  for (const way of LIGHTHOUSE_SITE_DATA.ways) {
    if (!BRIDGE_IDS.has(way.id)) continue;
    for (const path of way.paths) endpoints.push(path[0], path[path.length - 1]);
  }
  return endpoints;
}

function approachHeight(x: number, z: number, groundAt: (x: number, z: number) => number, endpoints: readonly XZ[]): number {
  let lift = 0;
  for (const endpoint of endpoints) {
    const distance = Math.hypot(x - endpoint[0], z - endpoint[1]);
    if (distance < 8) lift = Math.max(lift, .8 * (1 - distance / 8));
  }
  return groundAt(x, z) + SURFACE_Y + lift;
}

function appendRibbon(output: number[], points: readonly XZ[], width: number, heightAt: (x: number, z: number) => number): void {
  if (points.length < 2) return;
  const sides: Array<[[number, number, number], [number, number, number]]> = [];
  for (let index = 0; index < points.length; index++) {
    const previous = points[Math.max(0, index - 1)], next = points[Math.min(points.length - 1, index + 1)];
    const dx = next[0] - previous[0], dz = next[1] - previous[1], length = Math.hypot(dx, dz) || 1;
    const nx = -dz / length * width / 2, nz = dx / length * width / 2;
    const x = points[index][0], z = points[index][1];
    const clampX = (value: number) => Math.max(LIGHTHOUSE_SITE_BOUNDS.minX, Math.min(LIGHTHOUSE_SITE_BOUNDS.maxX, value));
    const clampZ = (value: number) => Math.max(LIGHTHOUSE_SITE_BOUNDS.minZ, Math.min(LIGHTHOUSE_SITE_BOUNDS.maxZ, value));
    const leftX = clampX(x + nx), leftZ = clampZ(z + nz), rightX = clampX(x - nx), rightZ = clampZ(z - nz);
    sides.push([[leftX, heightAt(leftX, leftZ), leftZ], [rightX, heightAt(rightX, rightZ), rightZ]]);
  }
  for (let index = 0; index < sides.length - 1; index++) {
    pushTriangle(output, sides[index][0], sides[index][1], sides[index + 1][0]);
    pushTriangle(output, sides[index][1], sides[index + 1][1], sides[index + 1][0]);
  }
}

function pointInRing(point: XZ, ring: readonly SitePoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const a = ring[index], b = ring[previous];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function pointInArea(point: XZ, area: SiteArea): boolean {
  return pointInRing(point, area.outer) && !area.holes.some(hole => pointInRing(point, hole));
}

/** Mapped land cover lookup used to color the high-resolution terrain itself. */
export function lighthouseLandCoverAt(x: number, z: number): 'grass' | 'wood' | undefined {
  if (x < LIGHTHOUSE_SITE_BOUNDS.minX || x > LIGHTHOUSE_SITE_BOUNDS.maxX || z < LIGHTHOUSE_SITE_BOUNDS.minZ || z > LIGHTHOUSE_SITE_BOUNDS.maxZ) return undefined;
  const point: XZ = [x, z];
  // Wood wins where OSM polygons overlap broad park grass polygons.
  for (const kind of ['wood', 'grass'] as const) for (const area of LIGHTHOUSE_SITE_DATA.areas) if (area.kind === kind && pointInArea(point, area)) return kind;
  return undefined;
}

function appendTerrainArea(output: number[], area: SiteArea, groundAt: (x: number, z: number) => number, offset: number, maximumEdge: number): void {
  const contour = area.outer.map(point => new THREE.Vector2(point[0], point[1]));
  const holes = area.holes.map(ring => ring.map(point => new THREE.Vector2(point[0], point[1])));
  const flat = [...contour, ...holes.flat()];
  const triangles = THREE.ShapeUtils.triangulateShape(contour, holes);
  type Triangle = [THREE.Vector2, THREE.Vector2, THREE.Vector2];
  const pending: Triangle[] = triangles.map(([a, b, c]) => [flat[a], flat[b], flat[c]]);
  while (pending.length) {
    const [a, b, c] = pending.pop()!;
    const ab = a.distanceTo(b), bc = b.distanceTo(c), ca = c.distanceTo(a);
    const longest = Math.max(ab, bc, ca);
    if (longest > maximumEdge) {
      if (longest === ab) { const middle = a.clone().lerp(b, .5); pending.push([a, middle, c], [middle, b, c]); }
      else if (longest === bc) { const middle = b.clone().lerp(c, .5); pending.push([a, b, middle], [a, middle, c]); }
      else { const middle = c.clone().lerp(a, .5); pending.push([a, b, middle], [middle, b, c]); }
      continue;
    }
    pushTriangle(output, [a.x, groundAt(a.x, a.y) + offset, a.y], [b.x, groundAt(b.x, b.y) + offset, b.y], [c.x, groundAt(c.x, c.y) + offset, c.y]);
  }
}

function appendSteps(output: number[], path: readonly SitePoint[], width: number, heightAt: (x: number, z: number) => number): void {
  const points = densify(path, .35);
  if (points.length < 2) return;
  const edges: Array<[[number, number], [number, number]]> = [];
  const levels: number[] = [];
  for (let index = 0; index < points.length; index++) {
    const previous = points[Math.max(0, index - 1)], next = points[Math.min(points.length - 1, index + 1)];
    const dx = next[0] - previous[0], dz = next[1] - previous[1], length = Math.hypot(dx, dz) || 1;
    const nx = -dz / length * width / 2, nz = dx / length * width / 2;
    const clampX = (value: number) => Math.max(LIGHTHOUSE_SITE_BOUNDS.minX, Math.min(LIGHTHOUSE_SITE_BOUNDS.maxX, value));
    const clampZ = (value: number) => Math.max(LIGHTHOUSE_SITE_BOUNDS.minZ, Math.min(LIGHTHOUSE_SITE_BOUNDS.maxZ, value));
    const left: [number, number] = [clampX(points[index][0] + nx), clampZ(points[index][1] + nz)];
    const right: [number, number] = [clampX(points[index][0] - nx), clampZ(points[index][1] - nz)];
    edges.push([left, right]);
    levels.push((heightAt(left[0], left[1]) + heightAt(right[0], right[1])) / 2);
  }
  for (let index = 0; index < edges.length - 1; index++) {
    const [leftA, rightA] = edges[index], [leftB, rightB] = edges[index + 1];
    const y = levels[index], nextY = levels[index + 1];
    pushTriangle(output, [leftA[0], y, leftA[1]], [rightA[0], y, rightA[1]], [leftB[0], y, leftB[1]]);
    pushTriangle(output, [rightA[0], y, rightA[1]], [rightB[0], y, rightB[1]], [leftB[0], y, leftB[1]]);
    if (Math.abs(nextY - y) > 1e-4) {
      pushTriangle(output, [leftB[0], y, leftB[1]], [rightB[0], y, rightB[1]], [leftB[0], nextY, leftB[1]]);
      pushTriangle(output, [rightB[0], y, rightB[1]], [rightB[0], nextY, rightB[1]], [leftB[0], nextY, leftB[1]]);
    }
  }
}

function beam(a: THREE.Vector3, b: THREE.Vector3, radius: number): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 6);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  geometry.translate(...a.clone().add(b).multiplyScalar(.5).toArray());
  return geometry;
}

function buildBridge(way: SiteWay, groundAt: (x: number, z: number) => number): { group: THREE.Group; metadata: BuiltBridge } {
  const root = new THREE.Group(); root.name = `lion-bridge-${way.id}`;
  const source = way.paths[0];
  const plan = densify(source, 2.5);
  const cumulative = [0];
  for (let index = 1; index < plan.length; index++) cumulative.push(cumulative[index - 1] + Math.hypot(plan[index][0] - plan[index - 1][0], plan[index][1] - plan[index - 1][1]));
  const total = cumulative[cumulative.length - 1];
  const first = plan[0], last = plan[plan.length - 1];
  const startY = groundAt(first[0], first[1]) + .5, endY = groundAt(last[0], last[1]) + .5;
  const centerline = plan.map((point, index) => new THREE.Vector3(point[0], THREE.MathUtils.lerp(startY, endY, cumulative[index] / total), point[1]));
  const top: number[] = [], bottom: number[] = [], sides: number[] = [];
  const width = lighthouseRoadWidth(way), half = width / 2;
  const edges: Array<[THREE.Vector3, THREE.Vector3]> = [];
  for (let index = 0; index < centerline.length; index++) {
    const previous = centerline[Math.max(0, index - 1)], next = centerline[Math.min(centerline.length - 1, index + 1)];
    const direction = next.clone().sub(previous); direction.y = 0; direction.normalize();
    const across = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(half);
    edges.push([centerline[index].clone().add(across), centerline[index].clone().sub(across)]);
  }
  for (let index = 0; index < edges.length - 1; index++) {
    const [leftA, rightA] = edges[index], [leftB, rightB] = edges[index + 1];
    pushTriangle(top, leftA.toArray(), rightA.toArray(), leftB.toArray());
    pushTriangle(top, rightA.toArray(), rightB.toArray(), leftB.toArray());
    const leftBottomA = leftA.clone().add(new THREE.Vector3(0, -.42, 0)), rightBottomA = rightA.clone().add(new THREE.Vector3(0, -.42, 0));
    const leftBottomB = leftB.clone().add(new THREE.Vector3(0, -.42, 0)), rightBottomB = rightB.clone().add(new THREE.Vector3(0, -.42, 0));
    pushTriangle(bottom, leftBottomA.toArray(), leftBottomB.toArray(), rightBottomA.toArray());
    pushTriangle(bottom, rightBottomA.toArray(), leftBottomB.toArray(), rightBottomB.toArray());
    pushTriangle(sides, leftA.toArray(), leftBottomA.toArray(), leftB.toArray()); pushTriangle(sides, leftBottomA.toArray(), leftBottomB.toArray(), leftB.toArray());
    pushTriangle(sides, rightA.toArray(), rightB.toArray(), rightBottomA.toArray()); pushTriangle(sides, rightBottomA.toArray(), rightB.toArray(), rightBottomB.toArray());
  }
  const deckGeometry = geometryFromTriangles([...top, ...bottom, ...sides]);
  const deck = new THREE.Mesh(deckGeometry, new THREE.MeshLambertMaterial({ color: 0xb6b2a8 }));
  deck.name = `lion-bridge-${way.id}-deck`; deck.castShadow = true; deck.receiveShadow = true; root.add(deck);
  const railGeometry: THREE.BufferGeometry[] = [];
  for (const side of [0, 1] as const) {
    for (let index = 0; index < edges.length - 1; index++) railGeometry.push(beam(edges[index][side].clone().add(new THREE.Vector3(0, 1.05, 0)), edges[index + 1][side].clone().add(new THREE.Vector3(0, 1.05, 0)), .055));
    const postCount = Math.max(2, Math.ceil(total / 3.5));
    for (let index = 0; index <= postCount; index++) {
      const target = total * index / postCount;
      let segment = 0; while (segment < cumulative.length - 2 && cumulative[segment + 1] < target) segment++;
      const amount = (target - cumulative[segment]) / (cumulative[segment + 1] - cumulative[segment]);
      const post = edges[segment][side].clone().lerp(edges[segment + 1][side], amount);
      railGeometry.push(beam(post, post.clone().add(new THREE.Vector3(0, 1.08, 0)), .045));
    }
  }
  const mergedRail = mergeGeometries(railGeometry);
  if (!mergedRail) throw new Error(`Unable to merge Lion Bridge ${way.id} railings`);
  const rails = new THREE.Mesh(mergedRail, new THREE.MeshLambertMaterial({ color: 0x59605b })); rails.name = `lion-bridge-${way.id}-railings`; rails.castShadow = true; root.add(rails); railGeometry.forEach(item => item.dispose());
  const pierGeometry: THREE.BufferGeometry[] = [];
  for (const endpointIndex of [0, edges.length - 1]) for (const side of [0, 1] as const) {
    const topPoint = edges[endpointIndex][side].clone().add(new THREE.Vector3(0, -.42, 0));
    const floor = groundAt(topPoint.x, topPoint.z) + TERRAIN_DISPLAY_OFFSET;
    if (topPoint.y > floor) pierGeometry.push(beam(new THREE.Vector3(topPoint.x, floor, topPoint.z), topPoint, .22));
  }
  const mergedPiers = mergeGeometries(pierGeometry);
  if (mergedPiers) { const piers = new THREE.Mesh(mergedPiers, new THREE.MeshLambertMaterial({ color: 0x777970 })); piers.name = `lion-bridge-${way.id}-end-piers`; piers.castShadow = true; root.add(piers); }
  pierGeometry.forEach(item => item.dispose());
  const midpoint = centerline[Math.floor(centerline.length / 2)];
  const metadata: BuiltBridge = { id: way.id, endpoints: [centerline[0].toArray(), centerline[centerline.length - 1].toArray()], midpoint: midpoint.toArray(), source: 'OpenStreetMap' };
  root.userData = metadata;
  return { group: root, metadata };
}

function hash01(value: number): number {
  let hash = value | 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

function nearArea(point: XZ, area: SiteArea, distance: number): boolean {
  if (pointInArea(point, area)) return true;
  const rings = [area.outer, ...area.holes];
  return rings.some(ring => ring.some((vertex, index) => distanceToSegment(point, vertex, ring[(index + 1) % ring.length]) < distance));
}

function buildTrees(groundAt: (x: number, z: number) => number, roads: readonly SiteWay[], buildings: readonly SiteArea[]): { trunks: THREE.InstancedMesh; crowns: THREE.InstancedMesh; positions: XZ[] } {
  const candidates: Array<{ x: number; z: number; height: number; rotation: number; score: number }> = [];
  for (const area of LIGHTHOUSE_SITE_DATA.areas) {
    if (area.kind !== 'wood') continue;
    const xs = area.outer.map(point => point[0]), zs = area.outer.map(point => point[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
    const spacing = 11;
    for (let gx = Math.floor(minX / spacing); gx <= Math.ceil(maxX / spacing); gx++) for (let gz = Math.floor(minZ / spacing); gz <= Math.ceil(maxZ / spacing); gz++) {
      const seed = area.id ^ Math.imul(gx, 73856093) ^ Math.imul(gz, 19349663);
      const x = gx * spacing + (hash01(seed) - .5) * 6, z = gz * spacing + (hash01(seed + 17) - .5) * 6;
      const point: XZ = [x, z];
      if (!pointInArea(point, area)) continue;
      const blockedByRoad = roads.some(way => way.paths.some(path => path.some((vertex, index) => index < path.length - 1 && distanceToSegment(point, vertex, path[index + 1]) < lighthouseRoadWidth(way) / 2 + 2.5)));
      if (blockedByRoad || buildings.some(building => nearArea(point, building, 4))) continue;
      // Keep the lakeward view from the lighthouse lawn open.
      if (x >= 2728 && x <= 2925 && Math.abs(z + 3380) < 18 + (x - 2728) * .08) continue;
      candidates.push({ x, z, height: 6 + hash01(seed + 29) * 5, rotation: hash01(seed + 43) * Math.PI * 2, score: hash01(seed + 71) });
    }
  }
  candidates.sort((a, b) => a.score - b.score);
  const selected = candidates.slice(0, MAX_TREES);
  const trunkGeometry = new THREE.CylinderGeometry(.24, .34, 1, 5); trunkGeometry.translate(0, .5, 0);
  const crownGeometry = new THREE.IcosahedronGeometry(1, 1);
  const trunks = new THREE.InstancedMesh(trunkGeometry, new THREE.MeshLambertMaterial({ color: 0x625747 }), selected.length); trunks.name = 'lighthouse-woodland-trunks';
  const crowns = new THREE.InstancedMesh(crownGeometry, new THREE.MeshLambertMaterial({ color: 0x3f6045 }), selected.length); crowns.name = 'lighthouse-woodland-crowns';
  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3(), position = new THREE.Vector3();
  selected.forEach((tree, index) => {
    const floor = groundAt(tree.x, tree.z) + TERRAIN_DISPLAY_OFFSET;
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), tree.rotation);
    matrix.compose(position.set(tree.x, floor, tree.z), quaternion, scale.set(.72 + hash01(index + 5) * .45, tree.height * .52, .72 + hash01(index + 9) * .45)); trunks.setMatrixAt(index, matrix);
    matrix.compose(position.set(tree.x, floor + tree.height * .70, tree.z), quaternion, scale.set(tree.height * .31, tree.height * .38, tree.height * .31)); crowns.setMatrixAt(index, matrix);
  });
  trunks.instanceMatrix.needsUpdate = true; crowns.instanceMatrix.needsUpdate = true;
  trunks.castShadow = true; crowns.castShadow = true; trunks.receiveShadow = true; crowns.receiveShadow = true;
  trunks.computeBoundingSphere(); crowns.computeBoundingSphere();
  return { trunks, crowns, positions: selected.map(tree => [tree.x, tree.z]) };
}

/** OSM-aligned roads, paths, Lion Bridges, lawns, and woodland for the North Point Lighthouse patch. */
export function buildLighthouseSite(groundAt: (x: number, z: number) => number): THREE.Group {
  const root = new THREE.Group(); root.name = 'north-point-lighthouse-site';
  const endpointList = bridgeEndpoints();
  const roadTriangles = new Map<string, number[]>([['road', []], ['concrete', []], ['path', []], ['steps', []]]);
  const roadIds: number[] = [];
  for (const way of LIGHTHOUSE_SITE_DATA.ways) {
    if (BRIDGE_IDS.has(way.id)) continue;
    roadIds.push(way.id);
    const output = roadTriangles.get(materialClass(way))!;
    for (const path of way.paths) {
      const heightAt = (x: number, z: number) => approachHeight(x, z, groundAt, endpointList);
      if (way.tags.highway === 'steps') appendSteps(output, path, lighthouseRoadWidth(way), heightAt);
      else appendRibbon(output, densify(path), lighthouseRoadWidth(way), heightAt);
    }
  }
  const materials: Record<string, THREE.Material> = {
    road: new THREE.MeshLambertMaterial({ color: 0x535653 }),
    concrete: new THREE.MeshLambertMaterial({ color: 0xb0aea5 }),
    path: new THREE.MeshLambertMaterial({ color: 0x77766c }),
    steps: new THREE.MeshLambertMaterial({ color: 0xc0bcb0, side: THREE.DoubleSide }),
  };
  for (const [kind, triangles] of roadTriangles) {
    if (!triangles.length) continue;
    const mesh = new THREE.Mesh(geometryFromTriangles(triangles), materials[kind]); mesh.name = `lighthouse-roads-${kind}`; mesh.receiveShadow = true; root.add(mesh);
  }
  const areaTriangles: number[] = [];
  for (const area of LIGHTHOUSE_SITE_DATA.areas) {
    if (area.kind === 'pedestrian') appendTerrainArea(areaTriangles, area, groundAt, SURFACE_Y + .03, 1);
  }
  if (areaTriangles.length) {
    const material = new THREE.MeshLambertMaterial({ color: 0xaaa69b, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometryFromTriangles(areaTriangles), material); mesh.name = 'lighthouse-ground-pedestrian'; mesh.receiveShadow = true; root.add(mesh);
  }
  const bridges: BuiltBridge[] = [];
  for (const way of LIGHTHOUSE_SITE_DATA.ways) if (BRIDGE_IDS.has(way.id)) { const bridge = buildBridge(way, groundAt); root.add(bridge.group); bridges.push(bridge.metadata); roadIds.push(way.id); }
  const buildings = LIGHTHOUSE_SITE_DATA.areas.filter(area => area.kind === 'building');
  const woodland = buildTrees(groundAt, LIGHTHOUSE_SITE_DATA.ways, buildings); root.add(woodland.trunks, woodland.crowns);
  root.userData = {
    bounds: LIGHTHOUSE_SITE_BOUNDS,
    roadIds: roadIds.sort((a, b) => a - b),
    bridges,
    treeCount: woodland.positions.length,
    treePositions: woodland.positions,
    eastRavineRoadClass: 'motor-vehicle-free paved park path',
    sources: ['OpenStreetMap pbf_extract.json', 'Milwaukee County Lake Park map'],
  };
  return root;
}
