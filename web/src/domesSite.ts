import * as THREE from 'three';

/** OSM 54622334 exposed circular arcs; x east, z south, metres in the city projection. */
export const DOMES_SITE = { x: -3324.6219, z: 938.0923, floor: 23.3, bearing: .7556086811 };

/** Replace only the old conservatory plinth, at both streamed detail levels. */
export function removeDomesPlaceholder(group: THREE.Group, tile: { i: number; j: number }) {
  if (tile.i !== -2 || tile.j !== -1) return 0;
  let removed = 0;
  for (const child of group.children) {
    if (!(child instanceof THREE.Mesh) || child.name !== 'BLDG') continue;
    const original = child.geometry, pos = original.getAttribute('position'), color = original.getAttribute('color');
    const keep: number[] = [];
    for (let i = 0; i < pos.count; i += 3) {
      let matches = true, roof = false;
      for (let j = i; j < i + 3; j++) {
        const x = pos.getX(j), y = pos.getY(j), z = pos.getZ(j);
        const atRoof = Math.abs(y - 25.58) < .12;
        roof ||= atRoof;
        matches &&= x >= -3385.8 && x <= -3226.5 && z >= 878.3 && z <= 1019.6
          && (atRoof || Math.abs(y - 21.08) < .12);
      }
      if (matches && roof) removed++;
      else keep.push(i, i + 1, i + 2);
    }
    if (keep.length === pos.count) continue;
    const positions = new Float32Array(keep.length * 3), colors = new Uint8Array(keep.length * 3);
    keep.forEach((j, i) => {
      positions.set([pos.getX(j), pos.getY(j), pos.getZ(j)], i * 3);
      colors.set([color.getX(j) * 255, color.getY(j) * 255, color.getZ(j) * 255], i * 3);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, true));
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    child.geometry = geometry; original.dispose();
  }
  return removed;
}

/** Extend only the foundation skirts to the sampled terrain beneath their circumference. */
export function groundDomesFoundations(domes: THREE.Group, groundAt: (x: number, z: number) => number) {
  const c=Math.cos(DOMES_SITE.bearing), s=Math.sin(DOMES_SITE.bearing);
  domes.traverse(child => {
    if (!(child instanceof THREE.Mesh) || !child.name.endsWith('-patterned-base')) return;
    const p=child.geometry.getAttribute('position');
    for(let i=0;i<p.count;i++) {
      if(p.getY(i)>=0) continue;
      const x=p.getX(i)+child.position.x, z=p.getZ(i)+child.position.z;
      const wx=DOMES_SITE.x+c*x+s*z, wz=DOMES_SITE.z-s*x+c*z;
      p.setY(i,Math.min(p.getY(i),groundAt(wx,wz)-DOMES_SITE.floor-.25));
    }
    p.needsUpdate=true;child.geometry.computeVertexNormals();
  });
}

/** Rear service buildings stay on their mapped footprint after the old plinth is removed. */
export function buildDomesServiceBuildings(groundAt: (x: number, z: number) => number) {
  const group = new THREE.Group(); group.name = 'domes-rear-greenhouses';
  const wall = new THREE.MeshLambertMaterial({ color: 0xc1c4ba });
  const roof = new THREE.MeshPhongMaterial({ color: 0x879d9a, shininess: 35 });
  const box = (x: number,z: number,w: number,d: number,h: number) => {
    const floor = groundAt(x,z) - .5;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),wall);
    mesh.position.set(x,floor+h/2,z); mesh.castShadow=true; mesh.receiveShadow=true; group.add(mesh);
    return floor+h;
  };
  // East greenhouse range, south wing, and north transition wing follow the OSM outline.
  for (const [x,z,w,d] of [[-3253,948,49,69],[-3253,1007,49,22],[-3255,896,48,18]]) {
    const top=box(x,z,w,d,3.7);
    const count = Math.round(d/7);
    for(let i=0;i<count;i++) {
      const zz=z-d/2+(i+.5)*d/count, half=d/count/2;
      const p=[x-w/2,top,zz-half,x+w/2,top,zz-half,x+w/2,top+1.3,zz,
        x-w/2,top,zz-half,x+w/2,top+1.3,zz,x-w/2,top+1.3,zz,
        x-w/2,top+1.3,zz,x+w/2,top+1.3,zz,x+w/2,top,zz+half,
        x-w/2,top+1.3,zz,x+w/2,top,zz+half,x-w/2,top,zz+half];
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.computeVertexNormals();
      const pane=new THREE.Mesh(g,roof);pane.material.side=THREE.DoubleSide;group.add(pane);
    }
  }
  box(-3283,944,10,77,4.0);
  box(-3292,922,20,12,3.6);
  box(-3319,905,19,12,3.6);
  box(-3357,895,16,14,3.7);
  const transition=new THREE.Mesh(new THREE.CylinderGeometry(12.2,12.2,4,32),wall);
  transition.position.set(-3335,groundAt(-3335,891)+1.5,891);transition.castShadow=true;group.add(transition);
  const cap=new THREE.Mesh(new THREE.ConeGeometry(12.3,1.8,32),roof);
  cap.position.set(-3335,transition.position.y+2.9,891);group.add(cap);
  return group;
}
