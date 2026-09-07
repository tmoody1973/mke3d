import * as THREE from 'three';
import type { TerrainData } from './loader';
import { lighthouseLandCoverAt } from './lighthouseSite.ts';

export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export const LIGHTHOUSE_BOUNDS: Bounds = { minX: 2450, maxX: 3070, minZ: -3690, maxZ: -3090 };
export const contains = (b: Bounds, x: number, z: number) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;

/** Match the Python pipeline's ground datum at generated-road/custom-model connections. */
export function bilinearTerrainHeight(t: TerrainData, x: number, z: number): number {
  const fx=(x-t.x0)/t.step, fy=(-z-t.y0)/t.step;
  const i=Math.max(0,Math.min(t.nx-2,Math.floor(fx))),j=Math.max(0,Math.min(t.ny-2,Math.floor(fy)));
  const u=Math.max(0,Math.min(1,fx-i)),v=Math.max(0,Math.min(1,fy-j));
  return t.heights[j*t.nx+i]*(1-u)*(1-v)+t.heights[j*t.nx+i+1]*u*(1-v)
    +t.heights[(j+1)*t.nx+i]*(1-u)*v+t.heights[(j+1)*t.nx+i+1]*u*v;
}

/** Interpolate the actual terrain triangles, including their diagonal, rather than a curved bilinear surface. */
export function terrainHeight(t: TerrainData, x: number, z: number): number {
  const fx = (x - t.x0) / t.step, fy = (-z - t.y0) / t.step;
  const i = Math.max(0, Math.min(t.nx - 2, Math.floor(fx))), j = Math.max(0, Math.min(t.ny - 2, Math.floor(fy)));
  const u = Math.max(0, Math.min(1, fx - i)), v = Math.max(0, Math.min(1, fy - j));
  const a = t.heights[j * t.nx + i], b = t.heights[j * t.nx + i + 1];
  const c = t.heights[(j + 1) * t.nx + i], d = t.heights[(j + 1) * t.nx + i + 1];
  return v >= u ? a * (1 - v) + c * (v - u) + d * u : a * (1 - u) + b * (u - v) + d * v;
}

// Cached OSM coastline ways 180434164 / 403007530; x east, z south.
const coast = [[2672.66,-2987.65],[2872.57,-3199.57],[2903.78,-3235.33],[2917.79,-3256.27],[2922.55,-3262.1],[2927.22,-3265.45],[2936.76,-3267.35],[2944.67,-3270.05],[2953.68,-3276.56],[2958.86,-3283.27],[2963.39,-3304.64],[2963.22,-3318.05],[2971.08,-3352.94],[2984.18,-3384.14],[3003.39,-3418.69],[3010.69,-3435.38],[3018.17,-3462.48],[3028.26,-3487.49],[3040.38,-3520.31],[3049.62,-3538.42],[3061.64,-3555.32],[3093.24,-3599.1],[3110.54,-3630.07],[3135.64,-3687.48],[3143.98,-3708.84]];
export function coastX(z: number) {
  for (let i = 1; i < coast.length; i++) {
    const a = coast[i - 1], b = coast[i];
    if (z <= a[1] && z >= b[1]) return a[0] + (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]);
  }
  return Infinity;
}

/** Keep raw USGS data untouched; blend its perimeter into the city and apply the existing illustrative lake-bed convention. */
export function prepareLocalTerrain(base: TerrainData, source: TerrainData): TerrainData {
  const t = { ...source, heights: source.heights.slice(), colors: source.colors.slice() };
  const b = LIGHTHOUSE_BOUNDS;
  const landColors = { grass: new THREE.Color(0x8b9b70).toArray(), wood: new THREE.Color(0x5f7152).toArray() };
  for (let j = 0; j < t.ny; j++) for (let i = 0; i < t.nx; i++) {
    const k = j * t.nx + i, x = t.x0 + i * t.step, z = -t.y0 - j * t.step;
    const edge = Math.max(0, Math.min(x - b.minX, b.maxX - x, z - b.minZ, b.maxZ - z));
    const u = Math.min(1, edge / 40), blend = u * u * (3 - 2 * u);
    const east = x - coastX(z);
    const measured = east >= 0 ? -Math.min(4, east * .4 + .25) : t.heights[k];
    t.heights[k] = terrainHeight(base, x, z) * (1 - blend) + measured * blend;
    const cover = lighthouseLandCoverAt(x,z);
    if (cover && east < 0) for(let c=0;c<3;c++) t.colors[k*3+c]=Math.round(landColors[cover][c]*255);
    // Reuse the surrounding land-cover colors at the seam; roads/woodland refine the interior.
    const bi = Math.max(0, Math.min(base.nx - 1, Math.round((x - base.x0) / base.step)));
    const bj = Math.max(0, Math.min(base.ny - 1, Math.round((-z - base.y0) / base.step)));
    for (let c = 0; c < 3; c++) t.colors[k * 3 + c] = Math.round(base.colors[(bj * base.nx + bi) * 3 + c] * (1 - blend) + t.colors[k * 3 + c] * blend);
  }
  return t;
}

/** Cut a rectangle out of triangles exactly, retaining interpolated vertex attributes at its edges. */
export function cutGeometry(g: THREE.BufferGeometry, b: Bounds): THREE.BufferGeometry {
  const names = Object.keys(g.attributes).filter(n => n !== 'normal');
  const sizes = names.map(n => g.getAttribute(n).itemSize), offsets = sizes.map((_, i) => sizes.slice(0, i).reduce((a, v) => a + v, 0));
  const p = offsets[names.indexOf('position')];
  const out: number[][] = names.map(name => { const a = g.getAttribute(name); return Array.from({length:a.count * a.itemSize}, (_, n) => a.getComponent(Math.floor(n / a.itemSize), n % a.itemSize)); });
  const indices: number[] = [], idx = g.index, positions = g.getAttribute('position');
  const count = idx?.count ?? positions.count;
  const vertex = (n: number) => names.flatMap(name => {
    const a = g.getAttribute(name); return Array.from({length:a.itemSize}, (_, c) => a.getComponent(n, c));
  });
  const emit = (poly: number[][]) => {
    if (poly.length < 3) return;
    const first = out[0].length / sizes[0];
    for (const v of poly) names.forEach((_, n) => out[n].push(...v.slice(offsets[n], offsets[n] + sizes[n])));
    for (let i = 1; i < poly.length - 1; i++) indices.push(first, first+i, first+i+1);
  };
  const planes = [(v:number[]) => v[p] - b.minX, (v:number[]) => b.maxX - v[p], (v:number[]) => v[p+2] - b.minZ, (v:number[]) => b.maxZ - v[p+2]];
  for (let i = 0; i < count; i += 3) {
    const ids = [0,1,2].map(k => idx ? idx.getX(i+k) : i+k);
    if (ids.every(k => positions.getX(k) <= b.minX) || ids.every(k => positions.getX(k) >= b.maxX)
      || ids.every(k => positions.getZ(k) <= b.minZ) || ids.every(k => positions.getZ(k) >= b.maxZ)) {
      indices.push(...ids); continue;
    }
    if (ids.every(k => contains(b, positions.getX(k), positions.getZ(k)))) continue;
    let poly = ids.map(vertex);
    for (const f of planes) {
      const inside: number[][] = [], outside: number[][] = [];
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k], c = poly[(k+1)%poly.length], da = f(a), dc = f(c);
        (da >= 0 ? inside : outside).push(a);
        if ((da >= 0) !== (dc >= 0)) {
          const u = da / (da - dc), v = a.map((x, j) => x + (c[j] - x) * u);
          inside.push(v); outside.push(v);
        }
      }
      emit(outside); poly = inside;
      if (poly.length < 3) break;
    }
  }
  const result = new THREE.BufferGeometry();
  names.forEach((n, i) => result.setAttribute(n, new THREE.Float32BufferAttribute(out[i], sizes[i])));
  result.setIndex(indices); result.computeVertexNormals(); result.computeBoundingSphere(); return result;
}

/** Replace old draped streets and the two erroneous lighthouse extrusions in streamed tiles. */
export function adaptLighthouseTile(group: THREE.Group, tile: {i:number;j:number}, base: TerrainData, groundAt:(x:number,z:number)=>number) {
  if (tile.i !== 1 || tile.j !== 1) return;
  for (const child of group.children) {
    if (!(child instanceof THREE.Mesh)) continue;
    if (child.name === 'ROAD' || child.name === 'HWAY') {
      const old = child.geometry; child.geometry = cutGeometry(old, LIGHTHOUSE_BOUNDS); old.dispose();
    } else if (child.name === 'BLDG') {
      // Both mapped lighthouse footprints lie in this isolated envelope. No adjacent houses intersect it.
      const old = child.geometry;
      child.geometry = cutGeometry(old, {minX:2721,maxX:2745,minZ:-3402,maxZ:-3374}); old.dispose();
      const pos = child.geometry.getAttribute('position');
      // Move each connected building rigidly: draping individual vertices would bend roofs on the bluff.
      const parent = Array.from({length:pos.count},(_,i)=>i), shared = new Map<string,number>();
      const find = (i:number):number => { while(parent[i]!==i) { parent[i]=parent[parent[i]]; i=parent[i]; } return i; };
      const join = (a:number,b:number) => { parent[find(a)]=find(b); };
      const index = child.geometry.index!;
      for (let i=0;i<index.count;i+=3) {
        const ids=[0,1,2].map(k=>index.getX(i+k)); join(ids[0],ids[1]);join(ids[1],ids[2]);
        for(const id of ids) {
          const key=[pos.getX(id),pos.getY(id),pos.getZ(id)].map(v=>Math.round(v*100)).join(',');
          const previous=shared.get(key); if(previous!==undefined) join(id,previous);else shared.set(key,id);
        }
      }
      const groups = new Map<number,number[]>();
      for(const id of new Set<number>(Array.from(index.array as ArrayLike<number>))) { const root=find(id);if(!groups.has(root))groups.set(root,[]);groups.get(root)!.push(id); }
      for(const ids of groups.values()) {
        const xs=ids.map(i=>pos.getX(i)), zs=ids.map(i=>pos.getZ(i));
        const x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...zs)+Math.max(...zs))/2;
        if(!contains(LIGHTHOUSE_BOUNDS,x,z))continue;
        const delta=groundAt(x,z)-terrainHeight(base,x,z);
        for(const id of ids)pos.setY(id,pos.getY(id)+delta);
      }
      pos.needsUpdate = true; child.geometry.computeVertexNormals(); child.geometry.computeBoundingSphere();
    }
  }
}
