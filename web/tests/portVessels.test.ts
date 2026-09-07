import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { buildPortFreighter, buildPortFerry } from '../src/portVessels.ts';

for (const [name, factory, length, beam] of [
  ['freighter', buildPortFreighter, 180, 22], ['ferry', buildPortFerry, 58, 18],
] as const) {
  test(`${name} has finite solid geometry, expected envelope and bounded draw cost`, () => {
    for (const scale of [1, .7, 1.3]) {
      const group = scale === 1 ? factory() : factory({ length: length * scale, beam: beam * scale });
      const bounds = new THREE.Box3().setFromObject(group), size = bounds.getSize(new THREE.Vector3());
      assert.ok(Math.abs(size.x - length * scale) < .002);
      assert.ok(size.z <= beam * scale + .002);
      assert.ok(size.z >= beam * scale * .97);
      assert.ok(bounds.min.y < 0 && bounds.max.y > 10 * scale);
      assert.ok(bounds.max.y < 24 * scale);
      let draws = 0, triangles = 0;
      group.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        draws++;
        const positions = object.geometry.getAttribute('position'), normals = object.geometry.getAttribute('normal');
        assert.ok(Array.from(positions.array).every(Number.isFinite));
        assert.ok(Array.from(normals.array).every(Number.isFinite));
        assert.ok(!Array.isArray(object.material));
        assert.equal((object.material as THREE.MeshStandardMaterial).map, null);
        triangles += positions.count / 3;
      });
      assert.ok(draws <= 8, `${draws} draws`);
      assert.ok(triangles < 12000, `${triangles} triangles`);
      assert.equal(group.userData.waterline, 0);
      assert.equal(group.userData.bowAxis, '+X');
      assert.equal(group.userData.stationary, true);
    }
  });
  test(`${name} rejects invalid dimensions`, () => {
    for (const options of [{ length: NaN }, { beam: Infinity }, { length: -1 }, { beam: 0 }, { length: 5, beam: 10 }])
      assert.throws(() => factory(options), /dimensions/);
  });
}

test('ferry leaves a real twin-hull tunnel open at the waterline', () => {
  const ferry = buildPortFerry();
  ferry.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const p = object.geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) < 2) assert.ok(Math.abs(p.getZ(i)) > 3.9, 'low hull vertex must stay out of center tunnel');
    }
  });
});
