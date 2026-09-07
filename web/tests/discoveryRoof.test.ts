import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildDiscoveryRoof, DISCOVERY_ROOF_BASE, DISCOVERY_ROOF_TOP } from '../src/discoveryRoof.ts';
import { DISCOVERY_PARTS } from '../src/discoveryGeometry.ts';
import { DISCOVERY_SITE } from '../src/discoverySite.ts';

const wing = DISCOVERY_PARTS.find(part => part.id === 700564608)!;
const corners = [wing.footprint[0], wing.footprint[7], wing.footprint[6], wing.footprint[4]] as const;

function insideMappedRoof(x: number, z: number): boolean {
  const worldX = x + DISCOVERY_SITE.x, worldZ = z + DISCOVERY_SITE.z;
  let sign = 0;
  for (let index = 0; index < corners.length; index++) {
    const a = corners[index], b = corners[(index + 1) % corners.length];
    const cross = (b[0] - a[0]) * (worldZ - a[1]) - (b[1] - a[1]) * (worldX - a[0]);
    if (Math.abs(cross) < .08) continue;
    const next = Math.sign(cross);
    if (sign && next !== sign) return false;
    sign = next;
  }
  return true;
}

test('roof details stay finite, low, and within the mapped technology-wing footprint', () => {
  const roof = buildDiscoveryRoof();
  assert.equal(roof.name, 'discovery-technology-wing-roof-details');
  assert.equal(roof.position.length(), 0, 'builder returns DISCOVERY_SITE-local geometry');
  let triangles = 0, meshes = 0;
  roof.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    meshes++;
    const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry;
    const position = geometry.getAttribute('position');
    triangles += position.count / 3;
    for (let index = 0; index < position.count; index++) {
      const x = position.getX(index), y = position.getY(index), z = position.getZ(index);
      assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z), object.name);
      assert.ok(insideMappedRoof(x, z), `${object.name}: vertex outside mapped roof`);
      assert.ok(y >= DISCOVERY_ROOF_BASE && y <= DISCOVERY_ROOF_TOP + 1e-6, `${object.name}: height ${y}`);
    }
  });
  assert.equal(meshes, 4, 'arrays, frames, equipment and rails remain batched');
  assert.ok(triangles > 500 && triangles < 6000, `${triangles} triangles`);
});

test('two solar fields flank a clear central service path and equipment remains modest', () => {
  const roof = buildDiscoveryRoof();
  const solar = roof.getObjectByName('technology-wing-photovoltaic-fields') as THREE.Mesh;
  const equipment = roof.getObjectByName('technology-wing-rooftop-equipment') as THREE.Mesh;
  const solarBox = new THREE.Box3().setFromObject(solar);
  const equipmentBox = new THREE.Box3().setFromObject(equipment);
  assert.ok(solarBox.max.x - solarBox.min.x > 60, 'solar fields span most of long roof axis');
  assert.ok(solarBox.max.z - solarBox.min.z > 20, 'solar fields cover both sides of service path');
  assert.ok(equipmentBox.max.y <= DISCOVERY_ROOF_BASE + .84 + 1e-6);

  const ray = new THREE.Raycaster();
  const uvPoint = (u: number, v: number) => {
    const [sw, se, ne, nw] = corners;
    const west = [sw[0] + (nw[0] - sw[0]) * v, sw[1] + (nw[1] - sw[1]) * v];
    const east = [se[0] + (ne[0] - se[0]) * v, se[1] + (ne[1] - se[1]) * v];
    return new THREE.Vector3(west[0] + (east[0] - west[0]) * u - DISCOVERY_SITE.x, 20,
      west[1] + (east[1] - west[1]) * u - DISCOVERY_SITE.z);
  };
  ray.set(uvPoint(.15, .25), new THREE.Vector3(0, -1, 0));
  assert.ok(ray.intersectObject(solar).length > 0, 'south photovoltaic field');
  ray.set(uvPoint(.15, .75), new THREE.Vector3(0, -1, 0));
  assert.ok(ray.intersectObject(solar).length > 0, 'north photovoltaic field');
  ray.set(uvPoint(.15, .5), new THREE.Vector3(0, -1, 0));
  assert.equal(ray.intersectObject(solar).length, 0, 'central service path stays clear');
});
