import * as THREE from 'three';

/** OSM-aligned anchor; floor is a visual estimate above the lake, not the broken
 * submerged centroid base in the shipped extrusion. See data/discovery_site.json. */
export const DISCOVERY_SITE = { x: 721, z: -200, floor: 2.5, bearing: Math.atan2(5.374, 78.45) };

/** The cached tile builder emits only the parent way. Its 13 building:part ways
 * provide the custom model geometry but were never emitted as placeholders. */
export const DISCOVERY_SOURCE = {
  id: 55205380,
  base: -4.9,
  roof: 8.2,
  bounds: [677.6, -245.8, 829.4, -176.4],
  footprint: [[789.879,-190.187],[762.1,-188.241],[762.198,-186.815],[762.295,-185.41],[683.848,-180.037],[678.787,-179.683],[678.462,-184.161],[677.843,-192.786],[682.937,-193.151],[681.619,-212.203],[681.505,-213.728],[682.009,-213.762],[684.434,-213.972],[739.968,-217.742],[744.956,-218.085],[747.201,-218.24],[747.12,-219.456],[747.039,-220.783],[744.769,-220.628],[742.962,-220.507],[741.335,-243.086],[743.125,-243.219],[772.238,-245.275],[776.315,-245.574],[777.934,-222.984],[773.915,-222.707],[770.383,-222.464],[763.239,-221.944],[759.732,-221.69],[759.952,-219.113],[760.147,-216.294],[760.586,-209.925],[761.408,-198.182],[778.357,-199.365],[788.837,-200.106],[789.171,-200.128],[790.074,-203.191],[791.604,-206.486],[793.484,-209.195],[795.217,-211.042],[797.479,-212.877],[800.156,-214.458],[802.906,-215.575],[805.412,-216.183],[807.674,-216.46],[808.447,-216.482],[809.969,-216.493],[811.677,-216.316],[812.174,-216.261],[814.729,-215.763],[817.349,-214.724],[819.725,-213.463],[820.026,-213.253],[821.588,-212.147],[823.565,-210.356],[825.225,-208.388],[826.608,-206.265],[827.739,-203.876],[827.902,-203.456],[828.35,-202.218],[828.415,-201.93],[828.976,-199.199],[829.155,-196.28],[828.968,-193.836],[828.488,-191.437],[827.772,-189.247],[826.551,-186.693],[825.136,-184.548],[823.492,-182.635],[821.246,-180.645],[820.018,-179.793],[818.797,-179.064],[816.38,-177.925],[815.079,-177.471],[813.858,-177.128],[813.573,-177.084],[810.709,-176.62],[807.332,-176.62],[806.494,-176.708],[804.606,-177.04],[801.62,-177.958],[796.689,-180.755],[794.761,-182.458],[792.955,-184.537],[791.897,-186.074],[791.197,-187.401],[790.684,-188.363],[790.489,-188.827],[790.245,-189.402],[789.879,-190.187]],
} as const;

/** Remove only triangles whose three vertices match the source footprint and
 * original base/roof elevations. The .16m tolerance covers both 10cm-quantized
 * tile origins. LOD simplification retains a subset of these same vertices. */
export function removeDiscoveryPlaceholder(group: THREE.Group, tile: { i: number; j: number }): number {
  if (tile.i !== 0 || tile.j !== 0) return 0;
  let removed = 0;
  const tolerance = .16;
  for (const child of group.children) {
    if (!(child instanceof THREE.Mesh) || child.name !== 'BLDG') continue;
    const original = child.geometry;
    const position = original.getAttribute('position');
    const color = original.getAttribute('color');
    const keep: number[] = [];
    for (let index = 0; index < position.count; index += 3) {
      let matches = true, roof = false;
      for (let vertex = index; vertex < index + 3; vertex++) {
        const x = position.getX(vertex), y = position.getY(vertex), z = position.getZ(vertex);
        const atRoof = Math.abs(y - DISCOVERY_SOURCE.roof) < tolerance;
        roof ||= atRoof;
        matches &&= (atRoof || Math.abs(y - DISCOVERY_SOURCE.base) < tolerance)
          && DISCOVERY_SOURCE.footprint.some(([px, pz]) => Math.hypot(x - px, z - pz) < tolerance);
      }
      if (matches && roof) removed++;
      else keep.push(index, index + 1, index + 2);
    }
    if (keep.length === position.count) continue;
    const positions = new Float32Array(keep.length * 3), colors = new Uint8Array(keep.length * 3);
    keep.forEach((vertex, index) => {
      positions.set([position.getX(vertex), position.getY(vertex), position.getZ(vertex)], index * 3);
      colors.set([color.getX(vertex) * 255, color.getY(vertex) * 255, color.getZ(vertex) * 255], index * 3);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, true));
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    child.geometry = geometry; original.dispose();
  }
  return removed;
}
