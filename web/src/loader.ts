import {cityData} from './dataFetch';
import * as THREE from 'three';
import type { Manifest, TileInfo } from './geo';

export interface Section { name: string; positions: Float32Array; colors: Uint8Array }

/** Parse the 'MKE1' v2 binary written by pipeline/build_tiles.py (int16 quantized positions + rgb). */
export function parseSections(buf: ArrayBuffer): Section[] {
  const dv = new DataView(buf);
  if (String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3)) !== 'MKE1') throw new Error('bad tile magic');
  const version = dv.getUint32(4, true); if (version !== 2) throw new Error(`unsupported tile version ${version}`);
  const nSec = dv.getUint32(8, true); let off = 12; const out: Section[] = [];
  for (let s = 0; s < nSec; s++) {
    const name = String.fromCharCode(dv.getUint8(off), dv.getUint8(off + 1), dv.getUint8(off + 2), dv.getUint8(off + 3)).trim(); off += 4;
    const n = dv.getUint32(off, true); off += 4;
    const cx = dv.getFloat32(off, true), cy = dv.getFloat32(off + 4, true), cz = dv.getFloat32(off + 8, true), scale = dv.getFloat32(off + 12, true); off += 16;
    const q = new Int16Array(buf, off, n * 3); off += n * 6; off += (4 - (off % 4)) % 4;
    const colors = new Uint8Array(buf.slice(off, off + n * 3)); off += n * 3; off += (4 - (off % 4)) % 4;
    const positions = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { positions[i * 3] = q[i * 3] * scale + cx; positions[i * 3 + 1] = q[i * 3 + 1] * scale + cy; positions[i * 3 + 2] = q[i * 3 + 2] * scale + cz; }
    out.push({ name, positions, colors });
  }
  return out;
}

export function sectionToGeometry(s: Section): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(s.positions, 3));
  g.setAttribute('color', new THREE.BufferAttribute(s.colors, 3, true));
  g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}

export interface TerrainData { nx: number; ny: number; x0: number; y0: number; step: number; heights: Float32Array; colors: Uint8Array }
export function parseTerrain(buf: ArrayBuffer): TerrainData {
  const dv = new DataView(buf);
  const nx = dv.getUint32(4, true), ny = dv.getUint32(8, true);
  const x0 = dv.getFloat32(12, true), y0 = dv.getFloat32(16, true), step = dv.getFloat32(20, true);
  const heights = new Float32Array(buf.slice(24, 24 + nx * ny * 4));
  const colors = new Uint8Array(buf.slice(24 + nx * ny * 4, 24 + nx * ny * 7));
  return { nx, ny, x0, y0, step, heights, colors };
}

export async function fetchBuffer(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  return cityData.buffer(url, signal);
}

type Materials = { building: THREE.Material; road: THREE.Material };
interface Loaded { group: THREE.Group; lod: boolean; controller?: AbortController }

/**
 * Lazy tile manager: keeps full-detail tiles within `nearRadius` of the focus point, LOD tiles within `farRadius`,
 * unloads beyond that. One merged mesh per layer per tile. Emits progress for the UI.
 */
export class TileManager {
  private loaded = new Map<string, Loaded>();
  private inflight = 0; private queue: { t: TileInfo; lod: boolean }[] = [];
  private failures = 0;
  onProgress?: (done: number, total: number) => void;
  onError?: (msg: string, retry: () => void) => void;
  /** Attach details to the tile so unloading it also removes its signage. */
  onTileReady?: (group: THREE.Group, tile: TileInfo, lod: boolean) => void;
  constructor(private manifest: Manifest, private root: THREE.Group, private mats: Materials, private base: string,
              public nearRadius: number, public farRadius: number, private concurrency = 6) {}

  /** Recompute wanted set for focus (x,z); call on camera settle, not every frame. */
  update(fx: number, fz: number) {
    const want = new Map<string, { t: TileInfo; lod: boolean }>();
    for (const t of this.manifest.tiles) {
      const d = Math.hypot(t.cx - fx, t.cz - fz);
      if (d < this.nearRadius) want.set(this.key(t), { t, lod: false });
      else if (d < this.farRadius) want.set(this.key(t), { t, lod: true });
    }
    for (const [k, l] of this.loaded) {
      const w = want.get(k);
      if (!w || w.lod !== l.lod) { this.unload(k); }
    }
    this.queue = [];
    for (const [k, w] of want) if (!this.loaded.has(k)) this.queue.push(w);
    this.queue.sort((a, b) => Math.hypot(a.t.cx - fx, a.t.cz - fz) - Math.hypot(b.t.cx - fx, b.t.cz - fz));
    this.pump(); this.report();
  }
  private key(t: TileInfo) { return `${t.i}_${t.j}`; }
  private report() {
    const total = this.loaded.size + this.queue.length;   // in-flight tiles are already in `loaded`
    const done = [...this.loaded.values()].filter(l => !l.controller).length;
    this.onProgress?.(done, total);
  }
  private pump() {
    while (this.inflight < this.concurrency && this.queue.length) {
      const w = this.queue.shift()!; this.load(w.t, w.lod);
    }
  }
  private async load(t: TileInfo, lod: boolean) {
    const k = this.key(t); const controller = new AbortController();
    const group = new THREE.Group(); group.name = k;
    this.loaded.set(k, { group, lod, controller }); this.inflight++;
    try {
      const url = `${this.base}/tiles/t_${t.i}_${t.j}${lod ? '.lod' : ''}.bin`;
      const buf = await fetchBuffer(url, controller.signal);
      const secs = parseSections(buf);
      for (const s of secs) {
        if (!s.positions.length) continue;
        const mesh = new THREE.Mesh(sectionToGeometry(s), s.name === 'BLDG' ? this.mats.building : this.mats.road);
        mesh.name = s.name;
        mesh.castShadow = s.name === 'BLDG' || s.name === 'HWAY'; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false;
        group.add(mesh);
      }
      const entry = this.loaded.get(k);
      if (entry && entry.controller === controller) {
        this.onTileReady?.(group, t, lod);
        entry.controller = undefined; this.root.add(group); this.failures = 0;
      }
      else this.dispose(group);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        this.loaded.delete(k); this.failures++;
        if (this.failures <= 3) this.queue.push({ t, lod });
        else this.onError?.(`Could not load city tiles (${(e as Error).message}).`, () => { this.failures = 0; this.queue.push({ t, lod }); this.pump(); });
      }
    } finally { this.inflight--; this.pump(); this.report(); }
  }
  private unload(k: string) {
    const l = this.loaded.get(k); if (!l) return;
    l.controller?.abort(); this.root.remove(l.group); this.dispose(l.group); this.loaded.delete(k);
  }
  private dispose(g: THREE.Group) { g.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose(); }); }
  get loadedCount() { return [...this.loaded.values()].filter(l => !l.controller).length; }
}
