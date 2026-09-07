import * as THREE from 'three';

export type WalkingPosition = { x: number; y: number; z: number };
export interface WalkingWorld {
  findSpawn(x: number, z: number): WalkingPosition | undefined;
  resolve(previous: WalkingPosition, next: WalkingPosition): WalkingPosition & { blocked: boolean };
}
type Kind = 'road' | 'terrain' | 'water' | 'building';
type Triangle = { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; walkable: boolean };
type MeshCache = { signature: string; x: number; z: number; grid: Map<string, Triangle[]> };
const RADIUS = .3, HEIGHT = 1.7, CELL = 16, CACHE_RADIUS = 180, CACHE_SHIFT = 40;
const MAX_RISE = .65, MAX_DROP = .8, MAX_STEP = .15;
const key = (x: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;

function heightAt(t: Triangle, x: number, z: number): number | undefined {
  const d = (t.b.z - t.c.z) * (t.a.x - t.c.x) + (t.c.x - t.b.x) * (t.a.z - t.c.z);
  if (Math.abs(d) < 1e-9) return undefined;
  const u = ((t.b.z - t.c.z) * (x - t.c.x) + (t.c.x - t.b.x) * (z - t.c.z)) / d;
  const v = ((t.c.z - t.a.z) * (x - t.c.x) + (t.a.x - t.c.x) * (z - t.c.z)) / d;
  return u >= -1e-7 && v >= -1e-7 && u + v <= 1 + 1e-7 ? u * t.a.y + v * t.b.y + (1 - u - v) * t.c.y : undefined;
}

function clipHeight(points: THREE.Vector3[], y: number, above: boolean) {
  const result: THREE.Vector3[] = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const insideA = above ? a.y >= y : a.y <= y, insideB = above ? b.y >= y : b.y <= y;
    if (insideA) result.push(a);
    if (insideA !== insideB) result.push(a.clone().lerp(b, (y - a.y) / (b.y - a.y)));
  }
  return result;
}

function touchesBody(t: Triangle, p: WalkingPosition) {
  const points = clipHeight(clipHeight([t.a, t.b, t.c], p.y + .05, true), p.y + HEIGHT, false);
  if (!points.length) return false;
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j], b = points[i], dx = b.x - a.x, dz = b.z - a.z;
    const fraction = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    if ((p.x - a.x - fraction * dx) ** 2 + (p.z - a.z - fraction * dz) ** 2 < RADIUS ** 2 - 1e-8) return true;
    if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

/** Positions are at the soles; the camera adds the 1.7m eye height. */
export function createWalkingWorld(tiles: THREE.Group, environment: THREE.Group): WalkingWorld {
  const cached = new WeakMap<THREE.Mesh, MeshCache>();
  const boundsVersions = new WeakMap<THREE.BufferGeometry, string>();
  let surfaces: { kind: Kind; cache: MeshCache }[] = [], coverage: THREE.Box3[] = [];

  function ensure(x: number, z: number) {
    environment.updateWorldMatrix(true, true);
    if (!tiles.parent) tiles.updateWorldMatrix(true, true);
    const meshes = new Map<THREE.Mesh, Kind>(), bounds = new Map<THREE.Object3D, THREE.Box3>();
    const worldBox = (mesh: THREE.Mesh) => {
      const position = mesh.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
      const version = `${position?.version}:${position?.count}`;
      if (!mesh.geometry.boundingBox || boundsVersions.get(mesh.geometry) !== version) {
        mesh.geometry.computeBoundingBox();
        boundsVersions.set(mesh.geometry, version);
      }
      return mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
    };
    tiles.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !['ROAD', 'HWAY', 'BLDG'].includes(mesh.name)) return;
      meshes.set(mesh, mesh.name === 'BLDG' ? 'building' : 'road');
      let tile: THREE.Object3D = mesh;
      while (tile.parent && tile.parent !== tiles) tile = tile.parent;
      if (tile === mesh) tile = tiles;
      const box = worldBox(mesh), previous = bounds.get(tile);
      if (previous) previous.union(box); else bounds.set(tile, box);
    });
    environment.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh) return;
      const tag = mesh.userData.drivingSurface;
      const kind: Kind | undefined = tag === 'building' || tag === 'road' ? tag
        : mesh.name === 'BLDG' ? 'building' : mesh.name === 'TERRAIN' ? 'terrain' : mesh.name === 'WATER' ? 'water' : undefined;
      if (kind) meshes.set(mesh, kind);
    });
    coverage = [...bounds.values()]; surfaces = [];
    for (const [mesh, kind] of meshes) {
      const box = worldBox(mesh);
      if (box.max.x < x - CACHE_RADIUS || box.min.x > x + CACHE_RADIUS || box.max.z < z - CACHE_RADIUS || box.min.z > z + CACHE_RADIUS) continue;
      const positions = mesh.geometry.getAttribute('position');
      if (!positions) continue;
      const index = mesh.geometry.index;
      const signature = `${mesh.geometry.id}:${(positions as THREE.BufferAttribute).version}:${index?.version}:${mesh.matrixWorld.elements.join(',')}`;
      let entry = cached.get(mesh);
      if (!entry || signature !== entry.signature || Math.hypot(entry.x - x, entry.z - z) > CACHE_SHIFT) {
        entry = { signature, x, z, grid: new Map() };
        const count = index ? index.count : positions.count;
        // Reuse vectors while scanning the large terrain; allocate only nearby triangles.
        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
        for (let i = 0; i + 2 < count; i += 3) {
          a.fromBufferAttribute(positions, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld);
          b.fromBufferAttribute(positions, index ? index.getX(i + 1) : i + 1).applyMatrix4(mesh.matrixWorld);
          c.fromBufferAttribute(positions, index ? index.getX(i + 2) : i + 2).applyMatrix4(mesh.matrixWorld);
          const minX = Math.max(x - CACHE_RADIUS, Math.min(a.x, b.x, c.x)), maxX = Math.min(x + CACHE_RADIUS, Math.max(a.x, b.x, c.x));
          const minZ = Math.max(z - CACHE_RADIUS, Math.min(a.z, b.z, c.z)), maxZ = Math.min(z + CACHE_RADIUS, Math.max(a.z, b.z, c.z));
          if (minX > maxX || minZ > maxZ) continue;
          const normal = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
          const triangle = { a: a.clone(), b: b.clone(), c: c.clone(), walkable: Math.hypot(normal.x, normal.z) <= Math.abs(normal.y) };
          for (let ix = Math.floor(minX / CELL); ix <= Math.floor(maxX / CELL); ix++) for (let iz = Math.floor(minZ / CELL); iz <= Math.floor(maxZ / CELL); iz++) {
            const k = `${ix},${iz}`, bucket = entry.grid.get(k);
            if (bucket) bucket.push(triangle); else entry.grid.set(k, [triangle]);
          }
        }
        cached.set(mesh, entry);
      }
      surfaces.push({ kind, cache: entry });
    }
  }

  function groundAt(x: number, z: number, nearY?: number) {
    if (!coverage.some(box => x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z)) return undefined;
    const candidates: { y: number; kind: Kind }[] = [], water: number[] = [];
    for (const surface of surfaces) {
      if (surface.kind === 'building') continue;
      for (const triangle of surface.cache.grid.get(key(x, z)) || []) {
        const y = heightAt(triangle, x, z);
        if (y === undefined) continue;
        if (surface.kind === 'water') { water.push(y); continue; }
        if (!triangle.walkable) continue;
        if (nearY !== undefined && (y - nearY > MAX_RISE + 1e-5 || nearY - y > MAX_DROP + 1e-5)) continue;
        candidates.push({ y, kind: surface.kind });
      }
    }
    const dry = candidates.filter(candidate => !water.some(y => y >= candidate.y - .02));
    // Without a previous height, prefer the lowest dry surface to avoid highway spawns.
    dry.sort((a, b) => nearY === undefined ? a.y - b.y
      : Number(b.kind === 'road') - Number(a.kind === 'road') || Math.abs(a.y - nearY) - Math.abs(b.y - nearY));
    return dry[0]?.y;
  }

  function buildingHit(position: WalkingPosition) {
    for (const surface of surfaces) {
      if (surface.kind !== 'building') continue;
      const seen = new Set<Triangle>();
      for (let ix = Math.floor((position.x - RADIUS) / CELL); ix <= Math.floor((position.x + RADIUS) / CELL); ix++)
        for (let iz = Math.floor((position.z - RADIUS) / CELL); iz <= Math.floor((position.z + RADIUS) / CELL); iz++)
          for (const triangle of surface.cache.grid.get(`${ix},${iz}`) || []) {
            if (seen.has(triangle)) continue;
            seen.add(triangle);
            if (touchesBody(triangle, position)) return true;
          }
      // Closed volumes also exclude interior spawns. Packed buildings can omit
      // their bottom caps, so a roof additionally needs horizontal enclosure.
      const heights: number[] = [];
      for (const triangle of surface.cache.grid.get(key(position.x, position.z)) || []) {
        const y = heightAt(triangle, position.x, position.z);
        if (y !== undefined && !heights.some(h => Math.abs(h - y) < 1e-5)) heights.push(y);
      }
      const middle = position.y + HEIGHT / 2;
      const above = heights.filter(y => y > middle).length;
      if (above) {
        if ((above % 2 && heights.filter(y => y < middle).length % 2) || horizontallyEnclosed(surface.cache, position, middle)) return true;
      }
    }
    return false;
  }

  function horizontallyEnclosed(cache: MeshCache, position: WalkingPosition, y: number) {
    // Count crossings in both directions on both horizontal axes. Requiring
    // all four avoids turning an open-ended covered passage into a solid box.
    // Even crossings through adjacent buildings leave the space between free.
    for (const axis of ['x', 'z'] as const) {
      const fixed = Math.floor((axis === 'x' ? position.z : position.x) / CELL);
      const center = axis === 'x' ? cache.x : cache.z;
      const ray = new THREE.Ray(new THREE.Vector3(position.x, y, position.z), new THREE.Vector3(axis === 'x' ? 1 : 0, 0, axis === 'z' ? 1 : 0));
      const reverse = new THREE.Ray(ray.origin, ray.direction.clone().negate()), hit = new THREE.Vector3();
      const crossings: number[] = [], seen = new Set<Triangle>();
      for (let cell = Math.floor((center - CACHE_RADIUS) / CELL); cell <= Math.floor((center + CACHE_RADIUS) / CELL); cell++) {
        const bucket = cache.grid.get(axis === 'x' ? `${cell},${fixed}` : `${fixed},${cell}`);
        for (const triangle of bucket || []) {
          if (seen.has(triangle)) continue;
          seen.add(triangle);
          if (ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, hit)
            || reverse.intersectTriangle(triangle.a, triangle.b, triangle.c, false, hit)) {
            const crossing = hit[axis] - position[axis];
            if (!crossings.some(value => Math.abs(value - crossing) < 1e-5)) crossings.push(crossing);
          }
        }
      }
      if (!(crossings.filter(value => value > 0).length % 2) || !(crossings.filter(value => value < 0).length % 2)) return false;
    }
    return true;
  }

  function supported(previous: WalkingPosition, x: number, z: number) {
    const y = groundAt(x, z, previous.y);
    if (y === undefined) return undefined;
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4, edge = groundAt(x + Math.cos(angle) * RADIUS, z + Math.sin(angle) * RADIUS, y);
      if (edge === undefined || Math.abs(edge - y) > MAX_RISE + 1e-5) return undefined;
    }
    const position = { x, y, z };
    return buildingHit(position) ? undefined : position;
  }

  function resolve(previous: WalkingPosition, next: WalkingPosition) {
    ensure(previous.x, previous.z);
    const distance = Math.hypot(next.x - previous.x, next.z - previous.z);
    if (!Number.isFinite(distance) || distance > 120) return { ...previous, blocked: true };
    const steps = Math.max(1, Math.ceil(distance / MAX_STEP)), dx = (next.x - previous.x) / steps, dz = (next.z - previous.z) / steps;
    let position = { ...previous }, blocked = false;
    for (let step = 0; step < steps; step++) {
      const full = supported(position, position.x + dx, position.z + dz);
      if (full) { position = full; continue; }
      blocked = true;
      // Keep useful motion along facades, with every candidate checked independently.
      const alongX = Math.abs(dx) > 1e-9 ? supported(position, position.x + dx, position.z) : undefined;
      const alongZ = Math.abs(dz) > 1e-9 ? supported(position, position.x, position.z + dz) : undefined;
      const slide = Math.abs(dx) >= Math.abs(dz) ? alongX || alongZ : alongZ || alongX;
      if (slide) position = slide; else break;
    }
    return { ...position, blocked };
  }

  function findSpawn(x: number, z: number) {
    ensure(x, z);
    for (let radius = 0; radius <= 120; radius += 3) {
      const count = radius === 0 ? 1 : Math.ceil(2 * Math.PI * radius / 3);
      for (let i = 0; i < count; i++) {
        const px = x + radius * Math.cos(i * 2 * Math.PI / count), pz = z + radius * Math.sin(i * 2 * Math.PI / count), y = groundAt(px, pz);
        if (y === undefined) continue;
        const spawn = supported({ x: px, y, z: pz }, px, pz);
        if (spawn) return spawn;
      }
    }
    return undefined;
  }
  return { findSpawn, resolve };
}
