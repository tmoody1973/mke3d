import * as THREE from 'three';
import {PORT_BUILDINGS} from './portSite.ts';

const tolerance = .18;

export const PORT_SOURCE_ELEVATIONS = {
  86681939:{floor:-3.113,roof:7.387},86681947:{floor:-2.892,roof:7.608},
  86681951:{floor:-2.192,roof:11.308},86681965:{floor:1.808,roof:12.308},
  398081883:{floor:1.058,roof:11.558},398081884:{floor:.658,roof:11.158},
  663078993:{floor:-.342,roof:10.158},663078994:{floor:1.508,roof:12.008},
  663078998:{floor:.587,roof:11.087},663207021:{floor:.187,roof:10.687},
  398080309:{floor:-.013,roof:10.487},663206982:{floor:-.213,roof:9.287},
  663207002:{floor:.187,roof:9.687},902005611:{floor:.787,roof:10.287},
  902005613:{floor:.897,roof:10.397},902005614:{floor:.997,roof:10.497},
  902005615:{floor:.887,roof:10.387},902005616:{floor:.787,roof:10.287},
  1028458569:{floor:1.087,roof:10.587},1028458570:{floor:1.387,roof:10.887},
  398077470:{floor:5.287,roof:14.787},94668874:{floor:1.887,roof:11.387},
} as const;

/** Mapped source shells replaced by the detailed port composition. The small
 * round way 1068003691 is deliberately absent: its packed source footprint no
 * longer matches enough mapped nodes to remove its roof safely. */
export const PORT_REPLACED_IDS = Object.keys(PORT_SOURCE_ELEVATIONS).map(Number) as readonly number[];

const sourceById = new Map<number,(typeof PORT_BUILDINGS)[number]>(PORT_BUILDINGS.filter(building => PORT_REPLACED_IDS.includes(building.id))
  .map(building => [building.id, building] as const));

/** Remove only triangles whose three vertices use a selected OSM footprint's
 * exact source nodes and packed base/roof pair. Surviving attributes retain
 * their original typed arrays and normalized flags. */
export function removePortPlaceholders(group: THREE.Group, tile: {i:number;j:number}): number {
  if (tile.i !== 0 || (tile.j !== -1 && tile.j !== -2)) return 0;
  let removed = 0;
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh) || object.name !== 'BLDG') return;
    const original = object.geometry, position = original.getAttribute('position');
    if (!position || original.index) return;
    const keep: number[] = [];
    for (let triangle = 0; triangle + 2 < position.count; triangle += 3) {
      let matched = false;
      for (const id of PORT_REPLACED_IDS) {
        const source = sourceById.get(id), elevation = PORT_SOURCE_ELEVATIONS[id as keyof typeof PORT_SOURCE_ELEVATIONS];
        if (!source || !elevation) continue;
        let hasRoof = false, exact = true;
        for (let vertex = triangle; vertex < triangle + 3; vertex++) {
          const x = position.getX(vertex), y = position.getY(vertex), z = position.getZ(vertex);
          const roof = Math.abs(y - elevation.roof) < tolerance;
          hasRoof ||= roof;
          if (!(roof || Math.abs(y - elevation.floor) < tolerance)
            || !source.footprint.some(([px,pz]) => Math.hypot(x-px,z-pz) < tolerance)) {
            exact = false; break;
          }
        }
        if (exact && hasRoof) { matched = true; break; }
      }
      if (matched) removed++;
      else keep.push(triangle,triangle+1,triangle+2);
    }
    if (keep.length === position.count) return;
    const geometry = new THREE.BufferGeometry();
    for (const [name,attribute] of Object.entries(original.attributes)) {
      if (!(attribute instanceof THREE.BufferAttribute)) continue;
      const array = attribute.array.slice(0,keep.length*attribute.itemSize);
      keep.forEach((vertex,index) => {
        for (let component=0;component<attribute.itemSize;component++)
          array[index*attribute.itemSize+component]=attribute.array[vertex*attribute.itemSize+component];
      });
      geometry.setAttribute(name,new THREE.BufferAttribute(array,attribute.itemSize,attribute.normalized));
    }
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    object.geometry=geometry; original.dispose();
  });
  return removed;
}
