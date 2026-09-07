import * as THREE from 'three';

// OSM 66709384: tower at the narrow south end of the wedge-shaped block.
export const CITY_HALL_SITE = { x: -385.684, z: -744.163, bearing: 0.19128, floor: 4.424 };

export function removeCityHallPlaceholder(group: THREE.Group, tile: { i: number; j: number }) {
  if (tile.i !== -1 || tile.j !== 0) return 0;
  let removed = 0;
  for (const child of group.children) {
    if (!(child instanceof THREE.Mesh) || child.name !== 'BLDG') continue;
    const original = child.geometry, pos = original.getAttribute('position'), color = original.getAttribute('color');
    const keep: number[] = [];
    for (let i = 0; i < pos.count; i += 3) {
      let matches = true, roof = false;
      for (let j = i; j < i + 3; j++) {
        const x = pos.getX(j), y = pos.getY(j), z = pos.getZ(j);
        const atRoof = Math.abs(y - 112.0) < .18;
        roof ||= atRoof;
        matches &&= x >= -411.1 && x <= -368.5 && z >= -790.9 && z <= -692.7
          && (atRoof || Math.abs(y - 2.91) < .18);
      }
      if (matches && roof) removed++;
      else keep.push(i, i + 1, i + 2);
    }
    if (keep.length === pos.count) continue;
    const positions = new Float32Array(keep.length * 3), colors = new Uint8Array(keep.length * 3);
    keep.forEach((j, i) => {
      positions.set([pos.getX(j), pos.getY(j), pos.getZ(j)], i * 3);
      colors.set([color.getX(j) * 255, color.getY(j) * 255, color.getZ(j) * 255], i * 3);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, true));
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    child.geometry = geometry; original.dispose();
  }
  return removed;
}
