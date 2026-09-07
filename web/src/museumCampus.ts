import * as THREE from 'three';
import { buildMuseum, type MuseumMode } from './museum.ts';
import { MUSEUM_SITE } from './museumSite.ts';
import { buildWarMemorial, WAR_MEMORIAL_SITE } from './warMemorial.ts';

function box(name: string, size: [number, number, number], position: [number, number, number], material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = !(material instanceof THREE.MeshPhysicalMaterial && material.transparent);
  mesh.receiveShadow = true;
  return mesh;
}

/** Three connected museum generations, placed in the application's metre-scale world coordinates. */
export function buildMuseumCampus(groundAt: (x: number, z: number) => number): THREE.Group {
  const campus = new THREE.Group();
  campus.name = 'milwaukee-art-museum-campus';
  const concrete = new THREE.MeshLambertMaterial({ color: 0xc5c2b9 });
  const paving = new THREE.MeshLambertMaterial({ color: 0xaaa79e });
  const lawn = new THREE.MeshLambertMaterial({ color: 0x6f8761 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x7898a3, roughness: 0.2, metalness: 0.05, transparent: true, opacity: 0.58 });

  const museum = buildMuseum();
  museum.position.set(MUSEUM_SITE.x, MUSEUM_SITE.floor, MUSEUM_SITE.z);
  museum.rotation.y = MUSEUM_SITE.bearing;
  campus.add(museum);

  // Separate fields retain the visible garden gaps rather than swallowing the campus in one slab.
  campus.add(box('campus-north-terrace', [130, .32, 14], [660, groundAt(660, -656) + .16, -656], paving));
  campus.add(box('campus-lake-terrace', [18, .32, 84], [731, groundAt(731, -615) + .16, -615], paving));
  campus.add(box('campus-connector-terrace', [76, .28, 13], [684, groundAt(684, -570) + .14, -570], paving));

  const memorial = buildWarMemorial(groundAt);
  campus.add(memorial);

  // The mapped Mason Street bridge arrives west of the memorial. Its packed
  // ROAD endpoint is 8.4–8.5 m; rise gently to the estimated 9.5 m court datum.
  const entryA = new THREE.Vector3(563.6, 8.45, -605.72);
  const entryB = new THREE.Vector3(WAR_MEMORIAL_SITE.x - 31.5 * Math.cos(WAR_MEMORIAL_SITE.bearing), WAR_MEMORIAL_SITE.courtY,
    WAR_MEMORIAL_SITE.z + 31.5 * Math.sin(WAR_MEMORIAL_SITE.bearing));
  const delta = entryB.clone().sub(entryA);
  const entryGeometry = new THREE.BoxGeometry(delta.length(), .5, 8);
  entryGeometry.rotateZ(Math.atan2(delta.y, Math.hypot(delta.x, delta.z)));
  entryGeometry.rotateY(-Math.atan2(delta.z, delta.x));
  const entry = new THREE.Mesh(entryGeometry, concrete);
  entry.name = 'mason-bridge-memorial-entry';
  entry.position.copy(entryA).add(entryB).multiplyScalar(.5); entry.position.y -= .25;
  entry.castShadow = true; entry.receiveShadow = true; campus.add(entry);
  for (const t of [.42, .78]) {
    const point = entryA.clone().lerp(entryB, t), ground = groundAt(point.x, point.z);
    const top = point.y - .5;
    if (top > ground) campus.add(box('memorial-entry-support', [1.2, top-ground, 6.5],
      [point.x, (top+ground)/2, point.z], concrete));
  }

  const kahler = new THREE.Group();
  kahler.name = 'kahler-building';
  const kahlerGround = groundAt(690, -614);
  const kahlerRoof = kahlerGround + 7.2;
  kahler.add(box('kahler-lakeward-building', [63, 7.2, 61], [690, kahlerGround + 3.6, -614], concrete));
  kahler.add(box('kahler-roof-garden', [49, .32, 43], [691, kahlerRoof + .16, -614], lawn));
  for (const z of [-631, -614, -597]) kahler.add(box('kahler-roof-skylight', [4.5, 1.1, 8], [691, kahlerRoof + .55, z], glass));
  kahler.add(box('kahler-north-glazed-connector', [8, 5.2, 9], [658, kahlerGround + 5.6, -633], glass));
  kahler.add(box('kahler-south-glazed-connector', [8, 5.2, 9], [658, kahlerGround + 5.6, -588], glass));
  campus.add(kahler);

  campus.userData.footprintIds = [403894584, 403895414, 446874803];
  campus.userData.setMuseumMode = (mode: MuseumMode | 'sunset') => {
    museum.userData.setMuseumMode(mode === 'day' ? 'day' : 'night');
    memorial.userData.setLightingMode(mode);
  };
  return campus;
}
