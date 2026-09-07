import * as THREE from 'three';
import siteData from '../../data/amfam_site.json' with { type: 'json' };

/** OSM relation 5747956; home plate inferred from the mapped pitch backstop, x east and z south. */
export const AMFAM_FOOTPRINT = siteData.worldOutline as [number, number][];
export const AMFAM_INTERIOR_SOURCE_NODES = [
  [-5439.533,725.511],[-5438.933,722.311],[-5413.033,709.211],[-5413.033,710.811],[-5386.333,711.311],
  [-5348.133,714.911],[-5344.133,716.611],[-5319.533,714.111],[-5309.933,746.511],[-5318.933,779.011],
  [-5317.133,782.511],[-5318.333,784.911],[-5316.833,786.211],[-5339.333,812.211],[-5339.833,812.511],
  [-5346.933,816.911],[-5347.633,817.211],[-5365.933,826.611],[-5379.133,828.911],[-5381.033,826.011],
  [-5407.733,830.211],[-5408.233,828.111],[-5413.133,826.411],[-5416.733,791.711],[-5417.933,791.311],
  [-5418.733,789.611],[-5429.633,768.711],[-5431.333,763.611],[-5429.933,763.411],[-5431.433,756.311],
  [-5439.433,729.111],[-5386.333,709.811],[-5378.633,710.111],[-5433.033,756.511],[-5437.333,718.911],
  [-5435.333,715.911],[-5433.233,713.611],[-5430.633,711.511],[-5427.233,709.811],[-5423.033,709.111],
  [-5312.233,724.811],
] as const;
export const AMFAM_SOURCE_NODES = [...AMFAM_FOOTPRINT, ...AMFAM_INTERIOR_SOURCE_NODES] as readonly (readonly [number, number])[];
export const AMFAM_SOURCE = { id: 5747956, pitchId: 1209147114, tile: {i:-3,j:-1}, base:10.17, roof:112.27 } as const;
export const AMFAM_SITE = {
  x: -5419.3658, z: 728.6078, floor: 11.85, bearing: -2.1872693943,
  footprint: AMFAM_FOOTPRINT, source: AMFAM_SOURCE,
} as const;

/** Replace only the old stadium extrusion, at both streamed detail levels. */
export function removeAmFamPlaceholder(group: THREE.Group, tile: { i: number; j: number }) {
  if (tile.i !== AMFAM_SOURCE.tile.i || tile.j !== AMFAM_SOURCE.tile.j) return 0;
  let removed = 0;
  group.traverse(child => {
    if (!(child instanceof THREE.Mesh) || child.name !== 'BLDG') return;
    const original = child.geometry, pos = original.getAttribute('position');
    if (!pos || original.index) return;
    const keep: number[] = [];
    for (let i = 0; i < pos.count; i += 3) {
      let matches = true, roof = false;
      for (let j = i; j < i + 3; j++) {
        const x = pos.getX(j), y = pos.getY(j), z = pos.getZ(j);
        const atRoof = Math.abs(y - AMFAM_SOURCE.roof) < .12;
        roof ||= atRoof;
        matches &&= (atRoof || Math.abs(y - AMFAM_SOURCE.base) < .12)
          && AMFAM_SOURCE_NODES.some(([px,pz]) => Math.hypot(x-px,z-pz) < .12);
      }
      if (matches && roof) removed++;
      else keep.push(i, i + 1, i + 2);
    }
    if (keep.length === pos.count) return;
    const geometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(original.attributes)) {
      if (!(attribute instanceof THREE.BufferAttribute) || name === 'normal') continue;
      const array = attribute.array.slice(0, keep.length * attribute.itemSize);
      keep.forEach((vertex,index) => {
        for (let component=0; component<attribute.itemSize; component++)
          array[index*attribute.itemSize+component]=attribute.array[vertex*attribute.itemSize+component];
      });
      geometry.setAttribute(name,new THREE.BufferAttribute(array,attribute.itemSize,attribute.normalized));
    }
    geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    child.geometry = geometry; original.dispose();
  });
  return removed;
}

/** Replace the factory's bounding ellipse with the mapped relation footprint,
 * extending its underside to the lowest finite terrain sample. Call after the
 * model has been placed and rotated at AMFAM_SITE.
 */
export function groundAmFamFoundation(model: THREE.Group, groundAt: (x:number,z:number)=>number): THREE.Mesh {
  const foundation=model.getObjectByName('approximate-stadium-foundation');
  if (!(foundation instanceof THREE.Mesh)) throw new Error('American Family Field foundation mesh is missing');
  const inverse=new THREE.Matrix4().makeRotationY(-AMFAM_SITE.bearing);
  const local=AMFAM_FOOTPRINT.map(([x,z]) => {
    const p=new THREE.Vector3(x-AMFAM_SITE.x,0,z-AMFAM_SITE.z).applyMatrix4(inverse);
    return [p.x,p.z] as const;
  });
  const samples=AMFAM_FOOTPRINT.map(([x,z])=>groundAt(x,z)-AMFAM_SITE.floor).filter(Number.isFinite);
  const bottom=Math.min(-.5,...samples)-.1;
  const shape=new THREE.Shape();
  local.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));
  shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:-bottom,bevelEnabled:false});
  geometry.rotateX(-Math.PI/2); geometry.translate(0,bottom,0);
  foundation.geometry.dispose(); foundation.geometry=geometry;
  foundation.position.set(0,0,0); foundation.rotation.set(0,0,0); foundation.scale.set(1,1,1);
  foundation.userData.mappedFootprint=true; foundation.userData.terrainBottom=bottom;
  foundation.castShadow=true; foundation.receiveShadow=true;
  return foundation;
}


/** Readable stadium-name signage, typeset from the reference; not a reproduced corporate logo. */
export function addAmFamNameSign(model: THREE.Group) {
  if (typeof document === 'undefined') return;
  const anchor = model.userData.entranceSign;
  if (!anchor) return;
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 256;
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  ctx.fillStyle = '#112a44'; ctx.fillRect(0,0,1024,256);
  ctx.strokeStyle = '#d9b760'; ctx.lineWidth = 12; ctx.strokeRect(8,8,1008,240);
  ctx.textAlign = 'center'; ctx.fillStyle = '#f4f0df';
  ctx.font = '600 72px sans-serif'; ctx.fillText('AMERICAN FAMILY',512,109);
  ctx.font = '600 77px serif'; ctx.fillText('F I E L D',512,206);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshPhongMaterial({map:texture,emissive:0xffffff,emissiveMap:texture,emissiveIntensity:.08});
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(anchor.widthM,anchor.widthM/4),material);
  sign.name='american-family-field-name-sign'; sign.position.fromArray(anchor.position); model.add(sign);
  const update = model.userData.setLightingMode;
  model.userData.setLightingMode = (mode: 'day'|'sunset'|'night') => {
    update?.(mode); material.emissiveIntensity = mode === 'day' ? .08 : mode === 'sunset' ? .3 : .65;
  };
}
