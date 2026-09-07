import * as THREE from 'three';

type Point = [number, number, number];

function geometryFromTriangles(points: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function triangle(out: number[], a: Point, b: Point, c: Point) {
  out.push(...a, ...b, ...c);
}

function quad(out: number[], a: Point, b: Point, c: Point, d: Point) {
  triangle(out, a, b, d);
  triangle(out, b, c, d);
}

function beamSegment(out: number[], a: Point, b: Point, width: number, depth: number) {
  const av=new THREE.Vector3(...a), bv=new THREE.Vector3(...b);
  const direction=bv.clone().sub(av).normalize();
  const ref=Math.abs(direction.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);
  const u=new THREE.Vector3().crossVectors(direction,ref).normalize().multiplyScalar(width/2);
  const v=new THREE.Vector3().crossVectors(direction,u).normalize().multiplyScalar(depth/2);
  const pt=(c:THREE.Vector3,su:number,sv:number):Point=>{const p=c.clone().addScaledVector(u,su).addScaledVector(v,sv);return[p.x,p.y,p.z]};
  const p:Point[]=[pt(av,-1,-1),pt(av,1,-1),pt(av,1,1),pt(av,-1,1),pt(bv,-1,-1),pt(bv,1,-1),pt(bv,1,1),pt(bv,-1,1)];
  quad(out,p[0],p[3],p[2],p[1]); quad(out,p[4],p[5],p[6],p[7]);
  quad(out,p[0],p[1],p[5],p[4]); quad(out,p[1],p[2],p[6],p[5]);
  quad(out,p[2],p[3],p[7],p[6]); quad(out,p[3],p[0],p[4],p[7]);
}

function addBox(out: number[], min: Point, max: Point) {
  const [x0, y0, z0] = min; const [x1, y1, z1] = max;
  const p: Point[] = [[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],
    [x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
  quad(out,p[0],p[3],p[2],p[1]); quad(out,p[4],p[5],p[6],p[7]);
  quad(out,p[0],p[1],p[5],p[4]); quad(out,p[1],p[2],p[6],p[5]);
  quad(out,p[2],p[3],p[7],p[6]); quad(out,p[3],p[0],p[4],p[7]);
}

function vaultPeak(x:number) {
  if(x<=-18)return THREE.MathUtils.lerp(7.5,7.25,(x+40)/22);
  if(x<=7)return THREE.MathUtils.lerp(7.25,27.4,(x+18)/25);
  return THREE.MathUtils.lerp(27.4,5,(x-7)/33);
}
function vaultHeight(x:number,z: number) {
  const t = Math.min(1, Math.abs(z) / 12);
  return 3.6+(vaultPeak(x)-3.6)*Math.pow(1-t,.62);
}
function extrudeOutline(out:number[], outline:[number,number][], y0:number,y1:number){
  const start = out.length;
  for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];quad(out,[a[0],y0,a[1]],[b[0],y0,b[1]],[b[0],y1,b[1]],[a[0],y1,a[1]])}
  for(let i=1;i<outline.length-1;i++){triangle(out,[outline[0][0],y1,outline[0][1]],[outline[i][0],y1,outline[i][1]],[outline[i+1][0],y1,outline[i+1][1]]);triangle(out,[outline[0][0],y0,outline[0][1]],[outline[i+1][0],y0,outline[i+1][1]],[outline[i][0],y0,outline[i][1]])}
  // The footprint uses x/z coordinates; reverse x/y-plane winding.
  for (let i = start; i < out.length; i += 9) for (let k = 0; k < 3; k++) [out[i+3+k], out[i+6+k]] = [out[i+6+k], out[i+3+k]];
}

export type MuseumMode = 'day' | 'night';

/**
 * An interpretive, metre-scale model of the Quadracci Pavilion.
 * Local +X points east toward Lake Michigan and local +Z points south.
 */
export function buildMuseum(): THREE.Group {
  const museum = new THREE.Group();
  museum.name = 'quadracci-pavilion';

  const white = new THREE.MeshPhongMaterial({ color: 0xf4f2e9, shininess: 38 });
  const concrete = new THREE.MeshLambertMaterial({ color: 0xd8d5cb });
  const glass = new THREE.MeshPhongMaterial({
    color: 0x7293a5, transparent: true, opacity: 0.70, depthWrite: false,
    side: THREE.DoubleSide, shininess: 90,
  });
  const darkGlass = new THREE.MeshPhongMaterial({
    color: 0x284453, emissive: 0x000000, transparent: true, opacity: 0.76,
    depthWrite: false, side: THREE.DoubleSide,
  });

  // Flowing podium, north galleria, and auditorium are one low concrete mass.
  const baseTriangles: number[] = [];
  addBox(baseTriangles, [-40, -10, -13], [43, 0, 13]);
  addBox(baseTriangles, [-23, -10, -108], [18, 0, -12]);
  extrudeOutline(baseTriangles, [[-20,11],[23,12],[25,22],[22,35],[14,46],[3,51],[-10,47],[-18,36],[-22,22]],-10,0);
  const base = new THREE.Mesh(geometryFromTriangles(baseTriangles), concrete);
  base.name = 'museum-flowing-podium-galleria-auditorium';
  museum.add(base);

  // Faceted pointed glass vault of Windhover Hall.
  const glassTriangles: number[] = [];
  // Include the mast/roof breakpoints so triangulation cannot bridge above the clearance envelope.
  const xStations = [-40, -32, -24, -18, -12, -6, 0, 7, 14, 22, 31, 40];
  const zStations = [-12, -9, -6, -3, 0, 3, 6, 9, 12];
  for (let xi = 0; xi < xStations.length - 1; xi++) {
    for (let zi = 0; zi < zStations.length - 1; zi++) {
      const x0 = xStations[xi], x1 = xStations[xi + 1];
      const z0 = zStations[zi], z1 = zStations[zi + 1];
      quad(glassTriangles, [x0,vaultHeight(x0,z0),z0], [x1,vaultHeight(x1,z0),z0],
        [x1,vaultHeight(x1,z1),z1], [x0,vaultHeight(x0,z1),z1]);
    }
  }
  // Connected, rounded-looking ship prow formed by narrowing faceted rings.
  const prowRings: [number, number, number][] = [[40,12,5.2],[45,7.5,4.7],[48,1.2,3.7]];
  for (let i = 0; i < prowRings.length - 1; i++) {
    const [x0,w0,y0] = prowRings[i], [x1,w1,y1] = prowRings[i + 1];
    quad(glassTriangles,[x0,y0,-w0],[x1,y1,-w1],[x1,y1,w1],[x0,y0,w0]);
    triangle(glassTriangles,[x0,vaultHeight(x0,0),0],[x1,y1,-w1],[x1,y1+Math.max(1,w1),0]);
    triangle(glassTriangles,[x0,vaultHeight(x0,0),0],[x1,y1+Math.max(1,w1),0],[x1,y1,w1]);
  }
  for(const x of [-40,40])for(let zi=0;zi<zStations.length-1;zi++)quad(glassTriangles,[x,0,zStations[zi]],[x,0,zStations[zi+1]],[x,vaultHeight(x,zStations[zi+1]),zStations[zi+1]],[x,vaultHeight(x,zStations[zi]),zStations[zi]]);
  const gx=[-23,-15,-7,1,9,18]; const gy=(x:number)=>2.1+3.6*Math.sqrt(Math.max(0,1-Math.pow((x+2.5)/20.5,2)));
  // The galleria has an opaque white barrel roof with narrow glazed slots,
  // while the windows below its eaves stay transparent.
  const galleryRoof: number[] = [];
  const roofXs = [-23, -15, -9, -8, 3, 4, 9, 18];
  for (let z = -108; z < -12; z += 8) for (let i = 0; i < roofXs.length - 1; i++) {
    const x0 = roofXs[i], x1 = roofXs[i+1], z1 = Math.min(-12, z+8);
    const out = x1-x0 <= 1 ? glassTriangles : galleryRoof;
    quad(out, [x0,gy(x0),z], [x0,gy(x0),z1], [x1,gy(x1),z1], [x1,gy(x1),z]);
  }
  for (const x of [-23,18]) quad(glassTriangles, [x,0,-108], [x,0,-12], [x,gy(x),-12], [x,gy(x),-108]);
  const gallery = new THREE.Mesh(geometryFromTriangles(galleryRoof), white);
  gallery.name = 'galleria-white-barrel-roof'; museum.add(gallery);
  const hallGlass = new THREE.Mesh(geometryFromTriangles(glassTriangles), glass);
  hallGlass.name = 'windhover-glass-vault'; hallGlass.renderOrder = 2;
  museum.add(hallGlass);

  // Thin structural arches trace the vault at regular east-west stations.
  const ribTriangles: number[] = [];
  for (let xi = 0; xi < xStations.length; xi++) {
    const x = xStations[xi];
    for (let zi = 0; zi < zStations.length - 1; zi++) {
      const z0 = zStations[zi], z1 = zStations[zi + 1];
      beamSegment(ribTriangles, [x,vaultHeight(x,z0),z0], [x,vaultHeight(x,z1),z1], .38, .38);
    }
  }
  for(let z=-108;z<=-12;z+=12)for(let i=0;i<gx.length-1;i++)beamSegment(ribTriangles,[gx[i],gy(gx[i]),z],[gx[i+1],gy(gx[i+1]),z],.28,.28);
  const ribs = new THREE.Mesh(geometryFromTriangles(ribTriangles), white);
  ribs.name = 'windhover-vault-ribs'; museum.add(ribs);

  // Inclined 47-degree spine and 36 paired stations (72 independently legible fins).
  const finTriangles: number[] = [];
  const finRoots: { side: 'north'|'south'; station: number; root: Point; tip: Point }[] = [];
  const spineStart = new THREE.Vector3(-18, 8, 0);
  const spineEnd = new THREE.Vector3(12, 40, 0);
  for (let station = 0; station < 36; station++) {
    const t = station / 35;
    const root = spineStart.clone().lerp(spineEnd, t);
    const length = 7.9 + (33.07 - 7.9) * Math.pow(t, .92);
    for (const sign of [-1, 1] as const) {
      let previous: Point = [root.x, root.y, 0];
      for (let segment = 1; segment <= 4; segment++) {
        const u = segment / 4;
        // A restrained camber keeps the brise soleil broad and nearly horizontal.
        const current: Point = [root.x + .35*u, root.y + 1.35*Math.sin(Math.PI*u), sign*length*u];
        beamSegment(finTriangles, previous, current, .64 - .16*u, .30 - .10*u);
        previous = current;
      }
      finRoots.push({ side: sign < 0 ? 'north' : 'south', station,
        root: [root.x,root.y,0], tip: previous });
    }
  }
  const fins = new THREE.Mesh(geometryFromTriangles(finTriangles), white);
  fins.name = 'burke-brise-soleil-72-fins';
  fins.userData.finRoots = finRoots;
  museum.add(fins);

  const spineGeometry = new THREE.CylinderGeometry(.58, .72, spineStart.distanceTo(spineEnd), 8, 1);
  const spine = new THREE.Mesh(spineGeometry, white);
  spine.name = 'inclined-47-degree-mast';
  spine.position.copy(spineStart).add(spineEnd).multiplyScalar(.5);
  spine.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), spineEnd.clone().sub(spineStart).normalize());
  museum.add(spine);

  // A subtle inner glazing layer can glow after dark without sharing city shaders.
  const inner = new THREE.Mesh(new THREE.BoxGeometry(33, 5.5, 12), darkGlass);
  inner.position.set(-2, 5.9, 0); inner.name = 'windhover-interior-glow'; inner.renderOrder = 1;
  museum.add(inner);

  museum.userData.finRoots = finRoots;
  museum.userData.finCount = 72;
  museum.userData.wingSpan = 66.14;
  museum.userData.museumFloorElevation = 10.7;
  museum.userData.foundationBottom = -10;
  museum.userData.spineEndpoints = [spineStart.toArray(), spineEnd.toArray()];
  museum.userData.setMuseumMode = (mode: MuseumMode) => {
    white.emissive.setHex(mode === 'night' ? 0x38352e : 0x000000);
    white.emissiveIntensity = .55;
    darkGlass.emissive.setHex(mode === 'night' ? 0x385567 : 0x000000);
    darkGlass.emissiveIntensity = mode === 'night' ? 0.75 : 1;
  };
  museum.traverse(object => {
    if (object instanceof THREE.Mesh) { object.castShadow = true; object.receiveShadow = true; }
  });
  return museum;
}
