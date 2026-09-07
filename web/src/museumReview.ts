import * as THREE from 'three';
import { createCity, type Mode } from './scene';
import { fetchBuffer, parseTerrain, parseSections, sectionToGeometry } from './loader';
import { bilinearTerrainHeight } from './localTerrain';
import { buildMuseumCampus } from './museumCampus';
import { buildReimanBridge } from './reimanBridge';
import { buildLakefrontContext } from './lakefrontContext';
import { buildMuseumLandscape } from './museumLandscape';
import { removeMuseumPlaceholder } from './museumSite';

const city = createCity(document.querySelector('canvas')!, document.querySelector('#labels')!, false);
city.camera.near = .1; city.camera.updateProjectionMatrix(); city.controls.minDistance = 2;
const terrain = parseTerrain(await fetchBuffer('/data/terrain.bin'));
const groundAt = (x: number, z: number) => bilinearTerrainHeight(terrain, x, z);
city.addTerrain(terrain);
city.addWater(parseSections(await fetchBuffer('/data/water.bin')));
const campus = buildMuseumCampus(groundAt);
city.landmarks.add(campus, buildReimanBridge(groundAt), buildLakefrontContext(groundAt), buildMuseumLandscape(groundAt));
for (const [i,j] of [[0,0],[0,1],[-1,0]]) {
  const group = new THREE.Group();
  for (const section of parseSections(await fetchBuffer(`/data/tiles/t_${i}_${j}.bin`))) {
    if (!['ROAD','HWAY','BLDG'].includes(section.name)) continue;
    const mesh = new THREE.Mesh(sectionToGeometry(section), section.name === 'BLDG' ? city.mats.building : city.mats.road);
    mesh.name = section.name; mesh.castShadow = section.name === 'BLDG'; mesh.receiveShadow = true; group.add(mesh);
  }
  removeMuseumPlaceholder(group, {i,j}); city.tiles.add(group);
}
const views: Record<string, { eye: [number,number,number]; target: [number,number,number] }> = {
  aerial: {eye:[960,340,-240],target:[550,8,-560]},
  north: {eye:[665,155,-1040],target:[513,8,-660]},
  bridge: {eye:[755,100,-800],target:[500,10,-575]},
  gardens: {eye:[775,110,-350],target:[590,5,-457]},
  street: {eye:[563,5,-480],target:[632,17,-480]},
};
function view(key: string) {
  const v = views[key]; city.camera.position.fromArray(v.eye); city.controls.target.fromArray(v.target); city.controls.update();
  document.querySelectorAll<HTMLButtonElement>('[data-angle]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.angle === key)));
}
document.querySelectorAll<HTMLButtonElement>('[data-angle]').forEach(b => b.onclick = () => view(b.dataset.angle!));
document.querySelector('select')!.onchange = e => {
  const mode = (e.target as HTMLSelectElement).value.toLowerCase() as Mode;
  city.setMode(mode); campus.userData.setMuseumMode(mode);
};
const initial = new URLSearchParams(location.search).get('view'); view(initial && views[initial] ? initial : 'aerial');
city.resize(); addEventListener('resize', () => city.resize());
let previous = performance.now();
city.renderer.setAnimationLoop(now => { city.render(Math.min(.05,(now-previous)/1000)); previous = now; });
if (import.meta.hot) import.meta.hot.dispose(() => {city.renderer.setAnimationLoop(null); city.controls.dispose(); city.renderer.dispose();});
