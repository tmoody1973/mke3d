import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { createHoanLighting, type HoanLightPath } from '../src/hoanLighting.ts';

const paths: HoanLightPath[] = [
  { kind: 'arch', side: -1, points: [[0, 2, -10], [10, 12, -10], [20, 2, -10]] },
  { kind: 'arch', side: 1, points: [[0, 2, 10], [10, 12, 10], [20, 2, 10]] },
  { kind: 'hanger', side: -1, points: [[10, 2, -10], [10, 12, -10]] },
  { kind: 'deck', side: 1, points: [[0, 2, 10], [80, 2, 10]] },
];

test('modes hide daylight and increase output from sunset to night', () => {
  const lighting = createHoanLighting(paths);
  assert.equal(lighting.group.visible, false);
  assert.equal(lighting.group.userData.intensity, 0);
  lighting.setMode('sunset');
  const sunset = lighting.group.userData.intensity;
  assert.equal(lighting.group.visible, true);
  lighting.setMode('night');
  assert.ok(lighting.group.userData.intensity > sunset);
  lighting.dispose();
});

test('fixtures cover both sides with finite geometry and bounded draw calls', () => {
  const lighting = createHoanLighting(paths);
  const nodes = lighting.group.getObjectByName('hoan-led-fixture-nodes') as THREE.Points;
  const sides = Array.from(nodes.geometry.getAttribute('side').array);
  assert.ok(sides.includes(-1) && sides.includes(1));
  assert.ok(nodes.geometry.getAttribute('position').count <= 3000);
  lighting.group.traverse(object => {
    assert.ok(!(object instanceof THREE.Light));
    if ('geometry' in object && object.geometry instanceof THREE.BufferGeometry) {
      assert.ok(Array.from(object.geometry.getAttribute('position').array).every(Number.isFinite));
    }
  });
  assert.ok(lighting.group.userData.drawCalls <= 4);
  lighting.dispose();
});

test('emissive cores retain the supplied structural path vertices', () => {
  const lighting = createHoanLighting(paths);
  const cores = lighting.group.getObjectByName('hoan-led-emissive-cores') as THREE.LineSegments;
  const positions = Array.from(cores.geometry.getAttribute('position').array);
  const expected = paths.filter(path => path.kind !== 'deck').flatMap(path =>
    path.points.slice(1).flatMap((point, i) => [...path.points[i], ...point]));
  assert.deepEqual(positions, expected);
  lighting.dispose();
});

test('animation shares a clock across cores and halos and respects reduced motion', () => {
  const lighting=createHoanLighting(paths);
  lighting.setMode('night');lighting.update(4);
  const cores=lighting.group.getObjectByName('hoan-led-emissive-cores') as THREE.LineSegments;
  const nodes=lighting.group.getObjectByName('hoan-led-fixture-nodes') as THREE.Points;
  const coreMaterial=cores.material as THREE.ShaderMaterial,nodeMaterial=nodes.material as THREE.ShaderMaterial;
  assert.equal(coreMaterial.uniforms.uTime.value,4);
  assert.equal(nodeMaterial.uniforms.uTime,coreMaterial.uniforms.uTime);
  assert.ok(coreMaterial.uniforms.uIntensity.value>1);
  lighting.update(8);assert.equal(nodeMaterial.uniforms.uTime.value,8);
  lighting.update(10,true);assert.equal(nodeMaterial.uniforms.uTime.value,0);
  lighting.setMode('day');lighting.update(12);
  assert.equal(lighting.group.visible,false);assert.equal(nodeMaterial.uniforms.uIntensity.value,0);
  lighting.dispose();
});
