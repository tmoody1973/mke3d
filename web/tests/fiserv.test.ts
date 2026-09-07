import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { buildFiserv } from '../src/fiserv.ts';
import { FISERV_SITE } from '../src/fiservSite.ts';

function bounds(model: THREE.Object3D, object: THREE.Object3D = model) {
  model.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object);
}

test('arena uses the mapped site and contractor-calibrated 128-foot height', () => {
  const model = buildFiserv();
  assert.equal(model.name, 'fiserv-forum');
  assert.deepEqual(model.position.toArray(), [FISERV_SITE.x, FISERV_SITE.floor, FISERV_SITE.z]);
  assert.equal(model.userData.dimensions.height, 39.0144);
  assert.equal(model.userData.dimensions.mappedWidth, FISERV_SITE.width);
  assert.equal(model.userData.dimensions.mappedLength, FISERV_SITE.length);
  const shell = bounds(model, model.getObjectByName('fiserv-curled-zinc-shell')!);
  assert.ok(Math.abs(shell.max.y - (FISERV_SITE.floor + 39.0144)) < .002);
  const whole = bounds(model);
  assert.ok(whole.max.y <= FISERV_SITE.floor + 39.0144 + .11,
    'small roof equipment may project only slightly above the calibrated shell');
});

test('wave roof is upward-facing and distinct from the curved north flank', () => {
  const model = buildFiserv();
  model.updateMatrixWorld(true);
  const roof = model.getObjectByName('fiserv-wave-roof') as THREE.Mesh;
  const geometry = roof.geometry.index ? roof.geometry.toNonIndexed() : roof.geometry;
  const position = geometry.getAttribute('position');
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let upward = 0, roofSurface = 0;
  for (let i = 0; i < position.count; i += 3) {
    a.fromBufferAttribute(position, i); b.fromBufferAttribute(position, i + 1); c.fromBufferAttribute(position, i + 2);
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    if (Math.abs(normal.y) > .1) { roofSurface++; if (normal.y > 0) upward++; }
  }
  assert.ok(upward / roofSurface > .99, 'broad roof faces should point upward');
  const down = new THREE.Raycaster(
    new THREE.Vector3(FISERV_SITE.x, FISERV_SITE.floor + 80, FISERV_SITE.z),
    new THREE.Vector3(0, -1, 0), 0, 100,
  ).intersectObject(roof);
  assert.ok(down.length > 0 && down[0].face!.normal.y > .9, 'crown is not raycastable from above');
  const shell = model.getObjectByName('fiserv-curled-zinc-shell')!;
  const north = new THREE.Raycaster(
    new THREE.Vector3(FISERV_SITE.x, FISERV_SITE.floor + 17, FISERV_SITE.z - 100),
    new THREE.Vector3(0, 0, 1), 0, 150,
  ).intersectObject(shell, false);
  assert.ok(north.length > 0 && north[0].face!.normal.z < -.5, 'curved north flank does not face north');
  const local = roof.geometry.getAttribute('position');
  let west=-Infinity,crown=-Infinity,east=-Infinity;
  for(let i=0;i<local.count;i++) {
    const x=local.getX(i),y=local.getY(i);
    if(x < -85) west=Math.max(west,y);
    else if(Math.abs(x+8)<10) crown=Math.max(crown,y);
    else if(x>70) east=Math.max(east,y);
  }
  assert.ok(crown-west>.6 && east-west>.6, 'roof needs restrained asymmetric cross-span curvature');
});

test('glazed public entrance addresses the east plaza across a broad north-south face', () => {
  const model = buildFiserv();
  assert.equal(model.userData.eastEntry, true);
  const glazing = bounds(model, model.getObjectByName('fiserv-atrium-and-ribbon-glazing')!);
  const entries = bounds(model, model.getObjectByName('fiserv-concourse-lighting')!);
  assert.ok(glazing.max.x > FISERV_SITE.x + 90, 'atrium does not reach the east edge');
  assert.ok(entries.max.x > FISERV_SITE.x + 90, 'entrance canopies do not address the east plaza');
  assert.ok(entries.max.z - entries.min.z > 90, 'entrances do not span the north-south facade');
  assert.ok(entries.max.x < Math.max(...FISERV_SITE.footprint.map(([x]) => x)) + 1,
    'entrance geometry intrudes materially into the open plaza');
});

test('reference-led facade details preserve the arena hierarchy', () => {
  const model = buildFiserv();
  assert.deepEqual(model.userData.detail, {
    zincPanelCourses: 8,
    roofCrossfallMeters: 1.4,
    atriumMegaColumns: 5,
    atriumEscalators: 3,
    entryVestibules: 4,
    southRetailBays: 15,
  });
  assert.equal(model.userData.panoramaClub, true);
  const glass = bounds(model, model.getObjectByName('fiserv-atrium-and-ribbon-glazing')!);
  const glassMaterial = (model.getObjectByName('fiserv-atrium-and-ribbon-glazing') as THREE.Mesh).material as THREE.MeshStandardMaterial;
  assert.equal(glassMaterial.transparent, true);
  assert.ok(glassMaterial.opacity > .4 && glassMaterial.opacity < .65, 'atrium glass should reveal layered structure');
  const interior = bounds(model, model.getObjectByName('fiserv-recessed-interior-and-club-frame')!);
  assert.ok(interior.min.x < glass.max.x - 4, 'atrium needs visible depth behind its curtain wall');
  const sign = model.getObjectByName('fiserv-original-name-sign') as THREE.Mesh;
  assert.equal((sign.geometry as THREE.PlaneGeometry).parameters.width, 13);
  assert.ok(Math.abs(sign.position.z - 34) < .001 && Math.abs(sign.position.y - 29) < .001,
    'official vector sign must remain at the reviewed facade location below the roof');
});

test('geometry is finite, nondegenerate, shadow-ready, and economical', () => {
  const model = buildFiserv(() => -2);
  let meshes = 0, triangles = 0;
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    meshes++;
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry;
    const position = geometry.getAttribute('position');
    assert.ok(position && Array.from(position.array).every(Number.isFinite), `${object.name}: invalid coordinate`);
    triangles += position.count / 3;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let i = 0; i < position.count; i += 3) {
      a.fromBufferAttribute(position, i); b.fromBufferAttribute(position, i + 1); c.fromBufferAttribute(position, i + 2);
      assert.ok(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() > 1e-13,
        `${object.name}: degenerate triangle ${i / 3}`);
    }
    if (object.name === 'fiserv-original-name-sign') return;
    assert.equal(object.receiveShadow, true, `${object.name}: receiveShadow`);
    if (object.name !== 'fiserv-concourse-lighting') assert.equal(object.castShadow, true, `${object.name}: castShadow`);
  });
  assert.ok(meshes <= 10, `${meshes} drawables`);
  assert.ok(triangles < 35_000, `${triangles} triangles`);
  assert.equal(model.getObjectsByProperty('isLight', true).length, 0, 'facade must not create a light per window');
});

test('day, sunset, and night modes reversibly illuminate facade materials', () => {
  const model = buildFiserv();
  const glow = model.getObjectByName('fiserv-concourse-lighting') as THREE.Mesh;
  const glowMaterial = glow.material as THREE.MeshBasicMaterial;
  const glass = (model.getObjectByName('fiserv-atrium-and-ribbon-glazing') as THREE.Mesh).material as THREE.MeshStandardMaterial;
  const soffit = (model.getObjectByName('fiserv-gold-roof-soffit') as THREE.Mesh).material as THREE.MeshStandardMaterial;
  assert.equal(glow.visible, false);
  assert.equal(glowMaterial.opacity, 0);
  assert.equal(glass.emissiveIntensity, 0);
  assert.equal(soffit.emissiveIntensity, 0);
  model.userData.setLightingMode('sunset');
  assert.equal(glow.visible, true);
  assert.ok(glowMaterial.opacity > 0 && glowMaterial.opacity < .2);
  assert.ok(glass.emissiveIntensity > 0 && soffit.emissiveIntensity > 0);
  model.userData.setLightingMode('night');
  assert.ok(glowMaterial.opacity > .3);
  assert.ok(glass.emissiveIntensity > .1 && soffit.emissiveIntensity > .2);
  model.userData.setLightingMode('day');
  assert.equal(glow.visible, false);
  assert.equal(glowMaterial.opacity, 0);
  assert.equal(glass.emissiveIntensity, 0);
  assert.equal(soffit.emissiveIntensity, 0);
});
