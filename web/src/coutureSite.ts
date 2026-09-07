import * as THREE from 'three';

/** Projected OSM ways from the cached Milwaukee PBF, extracted 2026-09-06.
 * X east, Z south, meters. Tower alignment is the minimum rotated rectangle
 * of parts 1403766301/02/03. The floor and podium heights are visual estimates;
 * the source parent has outdated 44-level massing and is replaced at runtime.
 */
export const COUTURE_SITE = {
  x: 449.424, z: -247.259, floor: 4.05,
  bearing: 0.023396576750020853,
  towerWidth: 30.798, towerDepth: 43.058,
  // Reference engineer's 537ft includes foundations, not a surveyed grade height.
  referenceHeight: 163.7,
  transit: {
    north: [420.843, -283.821], south: [403.902, -196.225],
    northRailY: 4.646, southRailY: 4.15,
    clearWidth: 5.6, ceilingY: 9.646,
  },
  parts: {"garage":{"id":1300225284,"levels":3,"footprint":[[358.743,-193.062],[369.931,-193.814],[375.09,-194.157],[397.132,-195.605],[403.284,-228.059],[405.342,-238.818],[413.04,-278.658],[412.535,-282.152],[411.266,-282.384],[409.818,-284.982],[408.182,-286.84],[405.464,-288.366],[405.936,-289.284],[378.613,-299.412],[358.743,-193.062]]},"concourseRoof":{"id":1403766299,"levels":3,"footprint":[[430.99,-280.007],[414.431,-196.977],[407.368,-196.468],[403.902,-196.225],[401.86,-196.037],[400.021,-195.871],[397.132,-195.605],[403.284,-228.059],[405.342,-238.818],[413.04,-278.658],[412.535,-282.152],[411.266,-282.384],[409.818,-284.982],[408.182,-286.84],[405.464,-288.366],[405.936,-289.284],[416.205,-285.535],[418.207,-284.695],[420.843,-283.821],[424.448,-282.45],[430.99,-280.007]]},"westCore":{"id":1403766300,"levels":4,"footprint":[[405.342,-238.818],[399.5,-239.912],[397.45,-229.154],[403.284,-228.059],[405.342,-238.818]]},"eastPodium":{"id":1403766304,"levels":3,"footprint":[[430.99,-280.007],[451.795,-272.277],[458.695,-268.031],[456.515,-268.96],[454.244,-268.673],[452.886,-268.186],[439.037,-268.551],[436.645,-264.239],[435.017,-259.197],[431.657,-259.783],[424.561,-225.007],[436.71,-225.914],[438.191,-226.677],[438.964,-227.738],[440.095,-230.514],[441.877,-228.391],[442.861,-227.694],[444.106,-226.82],[446.173,-225.648],[447.231,-228.225],[449.216,-227.583],[451.771,-227.462],[453.358,-227.882],[456.23,-229.518],[457.654,-231.133],[458.419,-232.382],[460.534,-234.671],[461.999,-237.413],[447.955,-204.529],[445.676,-201.93],[441.803,-199.431],[436.978,-198.569],[414.431,-196.977],[430.99,-280.007]]},"southTerrace":{"id":1403766305,"levels":4,"footprint":[[442.861,-227.694],[441.917,-225.405],[440.274,-223.813],[437.8,-223.16],[424.765,-222.254],[421.193,-203.301],[436.075,-204.407],[439.362,-205.513],[442.121,-207.149],[444.708,-209.56],[446.604,-212.169],[453.358,-227.882],[451.771,-227.462],[449.216,-227.583],[447.231,-228.225],[446.173,-225.648],[444.106,-226.82],[442.861,-227.694]]},"lowTerrace":{"id":1403766306,"levels":2,"footprint":[[440.095,-230.514],[438.964,-227.738],[438.191,-226.677],[436.71,-225.914],[424.561,-225.007],[431.657,-259.783],[435.017,-259.197],[434.171,-254.088],[433.968,-249.499],[434.456,-244.468],[435.383,-239.548],[436.929,-235.6],[438.703,-232.283],[440.095,-230.514]]}}
} as const;

export const COUTURE_SOURCE = {
  id: 1300225285, base: 2.5, roof: 149.2,
  footprint: [[378.613, -299.412], [405.936, -289.284], [416.205, -285.535], [418.207, -284.695], [420.843, -283.821], [424.448, -282.45], [430.99, -280.007], [451.795, -272.277], [458.695, -268.031], [461.502, -265.389], [463.358, -261.198], [464.415, -256.111], [464.733, -251.268], [464.407, -245.751], [463.447, -241.217], [461.999, -237.413], [447.955, -204.529], [445.676, -201.93], [441.803, -199.431], [436.978, -198.569], [414.431, -196.977], [407.368, -196.468], [403.902, -196.225], [401.86, -196.037], [400.021, -195.871], [397.132, -195.605], [375.09, -194.157], [369.931, -193.814], [358.743, -193.062], [378.613, -299.412]]
} as const;

const tolerance = .16;
const passageNodes = [[418.207, -284.695], [420.843, -283.821], [424.448, -282.45],
  [407.368, -196.468], [403.902, -196.225], [401.86, -196.037]] as const;

/** Removes only the cached parent extrusion, preserving adjacent buildings,
 * platform and road sections. Supports full/LOD quantization and either order
 * relative to adaptHopPassages; no broad spatial cutouts are used.
 */
export function removeCouturePlaceholder(group: THREE.Group, tile: {i: number; j: number}): number {
  if (tile.i !== 0 || tile.j !== 0) return 0;
  let removed = 0;
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object.name !== 'BLDG') return;
    const original = object.geometry;
    const position = original.getAttribute('position');
    if (!position || original.index) return;
    const keep: number[] = [];
    for (let triangle = 0; triangle + 2 < position.count; triangle += 3) {
      let roof = false, matches = true;
      for (let vertex = triangle; vertex < triangle + 3; vertex++) {
        const x = position.getX(vertex), y = position.getY(vertex), z = position.getZ(vertex);
        const atRoof = Math.abs(y - COUTURE_SOURCE.roof) < tolerance;
        roof ||= atRoof;
        const wasPassage = Math.abs(y - COUTURE_SITE.transit.ceilingY) < tolerance
          && passageNodes.some(([px, pz]) => Math.hypot(x - px, z - pz) < tolerance);
        if (!(atRoof || Math.abs(y - COUTURE_SOURCE.base) < tolerance || wasPassage)
          || !COUTURE_SOURCE.footprint.some(([px, pz]) => Math.hypot(x - px, z - pz) < tolerance)) {
          matches = false; break;
        }
      }
      if (matches && roof) removed++;
      else keep.push(triangle, triangle + 1, triangle + 2);
    }
    if (keep.length === position.count) return;
    const geometry = new THREE.BufferGeometry();
    // Preserve every packed per-vertex attribute and its raw representation.
    for (const [name, attribute] of Object.entries(original.attributes)) {
      if (!(attribute instanceof THREE.BufferAttribute) || name === 'normal') continue;
      const array = attribute.array.slice(0, keep.length * attribute.itemSize);
      keep.forEach((vertex, index) => {
        for (let component = 0; component < attribute.itemSize; component++)
          array[index * attribute.itemSize + component] = attribute.array[vertex * attribute.itemSize + component];
      });
      geometry.setAttribute(name, new THREE.BufferAttribute(array, attribute.itemSize, attribute.normalized));
    }
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    object.geometry = geometry; original.dispose();
  });
  return removed;
}
