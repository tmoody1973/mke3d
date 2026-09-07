import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Batches the public realm by material, keeping hundreds of small details cheap. */
export function districtGeometry(root: THREE.Group) {
  const parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const names = new Map<THREE.Material, string>();
  function add(geometry: THREE.BufferGeometry, material: THREE.Material, name: string) {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    if (flat !== geometry) geometry.dispose();
    flat.deleteAttribute('uv');
    const list = parts.get(material) ?? [];
    list.push(flat); parts.set(material, list); names.set(material, name);
  }
  function box(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material,name='district-details') {
    const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,m,name);
  }
  function beam(a:THREE.Vector3,b:THREE.Vector3,w:number,m:THREE.Material,name='district-frames') {
    const v=b.clone().sub(a);if(v.length()<.001)return;
    const g=new THREE.CylinderGeometry(w/2,w/2,v.length(),6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));
    g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());add(g,m,name);
  }
  function cylinder(x:number,y:number,z:number,r:number,h:number,m:THREE.Material,name='district-details',segments=12) {
    const g=new THREE.CylinderGeometry(r,r,h,segments);g.translate(x,y,z);add(g,m,name);
  }
  function finish() {
    for(const [material,geometries] of parts) {
      const merged=mergeGeometries(geometries,false);
      if(!merged)throw new Error('Cannot merge district geometry');
      const mesh=new THREE.Mesh(merged,material);mesh.name=names.get(material)!;
      mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
      geometries.forEach(g=>g.dispose());
    }
  }
  return {add,box,beam,cylinder,finish};
}
