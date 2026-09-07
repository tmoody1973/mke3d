import * as THREE from 'three';

const tolerance = .16;

/** Removes only source-node triangles at the known parent base/roof pair.
 * Both packed LODs retain original nodes, despite different quantization origins.
 */
export function removeUsBankPlaceholder(group: THREE.Group, tile: {i: number; j: number}): number {
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
        const atRoof = Math.abs(y - US_BANK_SOURCE.roof) < tolerance;
        roof ||= atRoof;
        if (!(atRoof || Math.abs(y - US_BANK_SOURCE.base) < tolerance)
          || !US_BANK_SOURCE.footprint.some(([px, pz]) => Math.hypot(x - px, z - pz) < tolerance)) {
          matches = false; break;
        }
      }
      if (matches && roof) removed++;
      else keep.push(triangle, triangle + 1, triangle + 2);
    }
    if (keep.length === position.count) return;
    const geometry = new THREE.BufferGeometry();
    // Copy raw components so normalized integer colors and existing normals
    // remain byte-for-byte identical for all surviving vertices.
    for (const [name, attribute] of Object.entries(original.attributes)) {
      if (!(attribute instanceof THREE.BufferAttribute)) continue;
      const array = attribute.array.slice(0, keep.length * attribute.itemSize);
      keep.forEach((vertex, index) => {
        for (let component = 0; component < attribute.itemSize; component++)
          array[index * attribute.itemSize + component] = attribute.array[vertex * attribute.itemSize + component];
      });
      geometry.setAttribute(name, new THREE.BufferAttribute(array, attribute.itemSize, attribute.normalized));
    }
    if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    object.geometry = geometry; original.dispose();
  });
  return removed;
}

/** Cached Milwaukee OSM/PBF geometry, extracted 2026-09-06; X east, Z south.
 * Shaft alignment is the minimum rotated rectangle of building:part434845088.
 * Local +X follows its broad facade, using THREE's positive Y rotation.
 * Floor follows the existing parent terrain datum, not a surveyed entrance.
 * Reference-pack 601ft/42-story overall height supersedes the 593ft shaft tag.
 */
// Rendered grade samples shipped terrain at the shaft center; source extrusion
// elevations below retain the original whole-parent centroid datum.
export const US_BANK_SITE = {"x":236.719569,"z":-367.393172,"floor":7.989,"bearing":0.08376956440993115,"width":60.976394,"depth":38.253531,"height":183.2,"shaftId":434845088,"shaftFootprint":[[207.993,-345.787],[206.463,-363.711],[206.276,-365.867],[204.738,-383.902],[265.487,-388.988],[266.87,-372.524],[267.001,-370.976],[267.09,-369.925],[267.188,-368.82],[267.342,-366.995],[268.701,-350.884],[207.993,-345.787]]} as const;

/** Only attached low parts inside the mapped parent; excludes neighboring
 * Westin, 833 East, Juneau Square and south parking garage. 25ft is mapped;
 * the untagged one-level side wings use the pipeline estimate of 3.3m. */
export const US_BANK_PARTS = {"northGalleria":{"id":434845089,"levels":2,"minLevel":0,"height":7.62,"footprint":[[265.487,-388.988],[262.477,-424.427],[258.302,-424.04],[256.341,-423.863],[254.413,-423.709],[209.734,-420.004],[207.805,-419.838],[205.942,-419.684],[201.719,-419.33],[204.738,-383.902],[265.487,-388.988]]},"southGalleria":{"id":434845087,"levels":2,"minLevel":0,"height":7.62,"footprint":[[212.997,-286.951],[213.558,-280.206],[213.843,-276.844],[214.103,-273.671],[220.295,-274.179],[242.143,-275.982],[245.886,-276.291],[249.661,-276.601],[268.831,-278.182],[274.796,-278.68],[274.34,-284.131],[274.153,-286.353],[273.966,-288.642],[273.689,-291.96],[245.747,-289.649],[243.38,-289.461],[240.995,-289.262],[212.997,-286.951]]},"southRaisedGalleria":{"id":700370375,"levels":2,"minLevel":1,"height":7.62,"footprint":[[273.689,-291.96],[273.575,-293.298],[273.315,-296.371],[273.201,-297.765],[272.184,-309.873],[272.143,-310.392],[271.272,-320.72],[271.167,-321.925],[270.906,-324.988],[270.752,-326.691],[210.027,-321.616],[210.181,-319.891],[210.588,-315.6],[211.41,-305.881],[211.524,-304.388],[212.468,-293.143],[212.622,-291.34],[212.891,-288.189],[212.997,-286.951],[240.995,-289.262],[243.38,-289.461],[245.747,-289.649],[273.689,-291.96]]},"southConnector":{"id":700370376,"levels":2,"minLevel":0,"height":7.62,"footprint":[[270.752,-326.691],[269.914,-336.598],[269.238,-344.549],[268.701,-350.884],[207.993,-345.787],[208.505,-339.816],[209.197,-331.622],[210.027,-321.616],[270.752,-326.691]]},"westWing":{"id":700370371,"levels":1,"minLevel":0,"height":3.3,"footprint":[[201.272,-424.626],[193.062,-423.941],[193.46,-419.263],[198.822,-356.391],[199.945,-343.211],[200.547,-336.156],[200.995,-330.926],[206.805,-331.412],[209.197,-331.622],[208.505,-339.816],[207.993,-345.787],[206.463,-363.711],[206.276,-365.867],[204.738,-383.902],[201.719,-419.33],[201.565,-421.132],[201.272,-424.626]]},"eastWing":{"id":434845090,"levels":1,"minLevel":0,"height":3.3,"footprint":[[262.477,-424.427],[265.487,-388.988],[266.87,-372.524],[267.001,-370.976],[267.09,-369.925],[267.188,-368.82],[267.342,-366.995],[268.701,-350.884],[269.238,-344.549],[269.914,-336.598],[272.151,-336.786],[278.262,-337.295],[277.709,-343.808],[277.342,-348.198],[276.366,-359.73],[275.683,-367.769],[275.43,-370.71],[275.211,-373.309],[275.072,-374.99],[270.386,-430.398],[262.029,-429.702],[262.33,-426.23],[262.477,-424.427]]}} as const;

/** Parent34901930 incorrectly extrudes its entire Galleria to tower height.
 * Its exact original nodes and base/roof pair identify the cached replacement. */
export const US_BANK_SOURCE = {"id":34901930,"base":5.8335,"roof":190.5183,"footprint":[[193.062,-423.941],[193.46,-419.263],[198.822,-356.391],[199.945,-343.211],[200.547,-336.156],[200.995,-330.926],[202.15,-316.208],[210.531,-316.905],[210.588,-315.6],[211.41,-305.881],[211.524,-304.388],[212.468,-293.143],[212.622,-291.34],[212.891,-288.189],[212.997,-286.951],[213.558,-280.206],[213.843,-276.844],[214.103,-273.671],[220.295,-274.179],[242.143,-275.982],[245.886,-276.291],[249.661,-276.601],[268.831,-278.182],[274.796,-278.68],[274.34,-284.131],[274.153,-286.353],[273.966,-288.642],[273.689,-291.96],[273.575,-293.298],[273.315,-296.371],[273.201,-297.765],[272.184,-309.873],[272.143,-310.392],[271.272,-320.72],[271.167,-321.925],[279.45,-322.611],[278.262,-337.295],[277.709,-343.808],[277.342,-348.198],[276.366,-359.73],[275.683,-367.769],[275.43,-370.71],[275.211,-373.309],[275.072,-374.99],[270.386,-430.398],[262.029,-429.702],[262.33,-426.23],[262.477,-424.427],[258.302,-424.04],[256.341,-423.863],[254.413,-423.709],[209.734,-420.004],[207.805,-419.838],[205.942,-419.684],[201.719,-419.33],[201.565,-421.132],[201.272,-424.626],[193.062,-423.941]]} as const;
