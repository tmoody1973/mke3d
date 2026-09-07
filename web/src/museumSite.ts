import * as THREE from 'three';

/** Windhover Hall lies on the Reiman Bridge axis, south of the campus centroid.
 * Placement inferred from cached OSM way 403894584 and bridge way 66893521.
 * See data/museum_site.json for the source geometry and preserved neighbors. */
export const MUSEUM_SITE = { x: 650, z: -473.4, floor: 10.7, bearing: Math.atan2(5.075, 70.009) };
export const MUSEUM_SOURCES = [
  { id: 403894584, base: 2.95, roof: 22.75, bounds: [609.1, -581.1, 698.4, -420.5] },
  { id: 403895414, base: 3.0, roof: 17.7, bounds: [596.3, -640.3, 659.0, -576.2] },
  { id: 446874803, base: .3, roof: 8.4, bounds: [654.1, -648.2, 725.2, -580.6] },
] as const;
export const MUSEUM_SOURCE = MUSEUM_SOURCES[0];

/** Remove the old pavilion, War Memorial and Kahler extrusions. Their distinctive
 * base/roof elevations disambiguate adjacent geometry at the shared footprint edges.
 * Coordinates allow 15cm for the tile's 10cm quantization. Applies to both LODs. */
export function removeMuseumPlaceholder(group: THREE.Group, tile: { i: number; j: number }): number {
  if (tile.i !== 0 || tile.j !== 0) return 0;
  let removed = 0;
  for (const child of group.children) {
    if (!(child instanceof THREE.Mesh) || child.name !== 'BLDG') continue;
    const geometry = child.geometry as THREE.BufferGeometry;
    const position = geometry.getAttribute('position');
    const color = geometry.getAttribute('color');
    const keep: number[] = [];
    for (let i = 0; i < position.count; i += 3) {
      let matches = false;
      const vertices: [number, number, number][] = [];
      for (let k = i; k < i + 3; k++) {
        vertices.push([position.getX(k), position.getY(k), position.getZ(k)]);
      }
      for (const source of MUSEUM_SOURCES) {
        const [x0,z0,x1,z1] = source.bounds;
        const valid = vertices.every(([x,y,z]) => x >= x0 && x <= x1 && z >= z0 && z <= z1
          && (Math.abs(y-source.base) < .16 || Math.abs(y-source.roof) < .16));
        const roof = vertices.some(([,y]) => Math.abs(y-source.roof) < .16);
        if (valid && roof) { matches = true; break; }
      }
      if (matches) removed++;
      else keep.push(i, i + 1, i + 2);
    }
    if (keep.length === position.count) continue;
    const positions = new Float32Array(keep.length * 3), colors = new Uint8Array(keep.length * 3);
    for (let i = 0; i < keep.length; i++) {
      const k = keep[i];
      positions.set([position.getX(k), position.getY(k), position.getZ(k)], i * 3);
      // Preserve the original normalized byte colors without an sRGB conversion.
      colors.set([color.getX(k) * 255, color.getY(k) * 255, color.getZ(k) * 255], i * 3);
    }
    const replacement = new THREE.BufferGeometry();
    replacement.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    replacement.setAttribute('color', new THREE.BufferAttribute(colors, 3, true));
    replacement.computeVertexNormals(); replacement.computeBoundingSphere();
    child.geometry = replacement; geometry.dispose();
  }
  return removed;
}
