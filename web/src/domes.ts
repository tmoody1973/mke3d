import * as THREE from 'three';

export type DomesMode = 'day' | 'sunset' | 'night';

export const DOME_DIAMETER_M = 42.672;
export const DOME_HEIGHT_M = 25.908;
export const OCULUS_DIAMETER_M = 11.2776;

/** Local +X is east and +Z is south; the public entrance faces west (-X). */
export const DOMES_CENTERS = [
  { name: 'desert-dome-northwest', x: -18, z: -37.9735 },
  { name: 'show-dome-southeast', x: -18, z: 37.9735 },
  { name: 'tropical-dome-rear', x: 17.6589, z: .4473 },
] as const;

type Point = [number, number, number];
const TAU = Math.PI * 2;
const profileControls: readonly [number, number][] = [
  [0.35,21.1], [2.2,21.336], [5,21.19], [8,20.72], [11,19.83],
  [14,18.45], [17,16.52], [19.6,14.20], [21.7,11.72], [23.25,9.05],
  [24.35,OCULUS_DIAMETER_M/2],
] as const;
const verticalBands = 20;
const profile: [number,number][] = Array.from({length:verticalBands+1},(_,i)=>{
  const y=profileControls[0][0]+(profileControls.at(-1)![0]-profileControls[0][0])*i/verticalBands;
  let k=1; while(k<profileControls.length-1&&profileControls[k][0]<y)k++;
  const a=profileControls[k-1],b=profileControls[k],t=(y-a[0])/(b[0]-a[0]);
  return [y,THREE.MathUtils.lerp(a[1],b[1],t)];
});
const radialSegments = 48;

function tri(out: number[], a: Point, b: Point, c: Point) { out.push(...a, ...b, ...c); }

function quad(out: number[], a: Point, b: Point, c: Point, d: Point) {
  tri(out, a, b, d); tri(out, b, c, d);
}

function point(cx: number, cz: number, ring: number, column: number): Point {
  const [y, radius] = profile[ring];
  const angle = TAU * (column + (ring % 2) * 0.5) / radialSegments;
  return [cx + Math.cos(angle) * radius, y, cz + Math.sin(angle) * radius];
}

function boxBetween(out: number[], aa: Point, bb: Point, width: number) {
  const a = new THREE.Vector3(...aa), b = new THREE.Vector3(...bb);
  const direction = b.clone().sub(a); if (direction.lengthSq() < 1e-8) return;
  direction.normalize();
  const reference = Math.abs(direction.y) < .92 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(direction, reference).normalize().multiplyScalar(width / 2);
  const v = new THREE.Vector3().crossVectors(direction, u).normalize().multiplyScalar(width / 2);
  const p = (center: THREE.Vector3, su: number, sv: number): Point => {
    const q = center.clone().addScaledVector(u, su).addScaledVector(v, sv); return [q.x, q.y, q.z];
  };
  const q: Point[] = [p(a,-1,-1),p(a,1,-1),p(a,1,1),p(a,-1,1),p(b,-1,-1),p(b,1,-1),p(b,1,1),p(b,-1,1)];
  quad(out,q[0],q[3],q[2],q[1]); quad(out,q[4],q[5],q[6],q[7]);
  quad(out,q[0],q[1],q[5],q[4]); quad(out,q[1],q[2],q[6],q[5]);
  quad(out,q[2],q[3],q[7],q[6]); quad(out,q[3],q[0],q[4],q[7]);
}

function geometry(positions: number[], colors?: number[]) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals(); return g;
}

function addDomeGlass(positions: number[], colors: number[], cx: number, cz: number, domeIndex: number) {
  for (let ring = 0; ring < profile.length - 1; ring++) for (let column = 0; column < radialSegments; column++) {
    const a = point(cx,cz,ring,column), b = point(cx,cz,ring,column+1);
    const c = point(cx,cz,ring+1,column+1), d = point(cx,cz,ring+1,column);
    const start = positions.length;
    // Outward winding: at angle zero the radial component of each face normal is +X.
    tri(positions,a,d,b); tri(positions,b,d,c);
    const variation = ((ring * 17 + column * 11 + domeIndex * 7) % 9) / 8;
    const color = new THREE.Color().setRGB(.25 + .08*variation, .39 + .09*variation, .43 + .10*variation);
    for (let i = start; i < positions.length; i += 3) colors.push(color.r,color.g,color.b);
  }
}

function addDomeLattice(fine: number[], heavy: number[], cx: number, cz: number) {
  for (let ring = 0; ring < profile.length - 1; ring++) for (let column = 0; column < radialSegments; column++) {
    // These are the three unique non-circumferential edges of the same a-b-d / b-c-d
    // pane triangles emitted by addDomeGlass. Ring staggering is already in point().
    boxBetween(fine, point(cx,cz,ring,column), point(cx,cz,ring+1,column), .105);
    boxBetween(fine, point(cx,cz,ring,column+1), point(cx,cz,ring+1,column), .105);
  }
  for (let ring = 0; ring < profile.length; ring++) for (let column = 0; column < radialSegments; column++)
    boxBetween(fine,point(cx,cz,ring,column),point(cx,cz,ring,column+1),.09);
  // Twelve gently spiralling primary ribs remain legible without latitude-like bands.
  for (let column = 0; column < radialSegments; column += 4) for (let ring = 0; ring < profile.length - 1; ring++)
    boxBetween(heavy, point(cx,cz,ring,column+ring%2), point(cx,cz,ring+1,column+(ring+1)%2), .21);
}

function addEntranceArches(out: number[], glazing: number[], canopy: number[]) {
  const x = -30.25, count = 9, spacing = 3.75;
  for (let bay = 0; bay < count; bay++) {
    const z = (bay - (count - 1) / 2) * spacing;
    for(const faceX of [x,x+5.8]){
      boxBetween(out,[faceX-.08,.05,z-1.5],[faceX,4.05,z-1.03],.4);
      boxBetween(out,[faceX-.08,.05,z+1.5],[faceX,4.05,z+1.03],.4);
      let previous:Point=[faceX,4.05,z-1.03];
      for(let segment=1;segment<=8;segment++){
        const u=segment/8;
        const current:Point=[faceX,4.05+2.0*Math.sin(Math.PI*u),z-1.03+2.06*u];
        boxBetween(out,previous,current,.4); previous=current;
      }
    }
    // Photos 03–05 show continuous thin concrete vaults, not freestanding arch ribs.
    // Their dark recessed windows rise into the rounded heads of the shells.
    const section: [number,number][] = [[-1.5,.05],[-1.03,4.05]];
    for(let segment=1;segment<=12;segment++){
      const u=segment/12; section.push([-1.03+2.06*u,4.05+2*Math.sin(Math.PI*u)]);
    }
    section.push([1.5,.05]);
    for(let i=0;i<section.length-1;i++){
      const [za,ya]=section[i], [zb,yb]=section[i+1];
      const a:Point=[x,ya,z+za],b:Point=[x,yb,z+zb];
      quad(canopy,a,b,[x+5.8,yb,z+zb],[x+5.8,ya,z+za]);
      quad(canopy,[x,ya-.16,z+za],[x+5.8,ya-.16,z+za],
        [x+5.8,yb-.16,z+zb],[x,yb-.16,z+zb]);
      quad(canopy,a,[x,ya-.16,z+za],[x,yb-.16,z+zb],b);
      // Fan winding faces west. The glass remains behind the concrete front edge.
      tri(glazing,[x+.18,2.6,z],[x+.18,Math.max(.12,yb-.2),z+zb*.87],[x+.18,Math.max(.12,ya-.2),z+za*.87]);
    }
    tri(glazing,[x+.18,2.6,z],[x+.18,.12,z-1.305],[x+.18,.12,z+1.305]);
    // Slender mullions and door rails are visible in the frontal photograph.
    for(const dz of [-.46,.46])boxBetween(out,[x+.15,.12,z+dz],[x+.15,5.3,z+dz],.065);
    for(const y of [2.1,3.55])boxBetween(out,[x+.15,y,z-1.12],[x+.15,y,z+1.12],.065);
  }
}

/** A metre-scale interpretive model of the Mitchell Park Horticultural Conservatory. */
export function buildDomes(): THREE.Group {
  const root = new THREE.Group(); root.name = 'mitchell-park-domes';
  const glassPositions: number[] = [], glassColors: number[] = [], fine: number[] = [], heavy: number[] = [];
  DOMES_CENTERS.forEach((center,index) => {
    addDomeGlass(glassPositions,glassColors,center.x,center.z,index);
    addDomeLattice(fine,heavy,center.x,center.z);
  });

  const glassMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff, vertexColors: true, transparent: true,
    opacity: .91, depthWrite: true, side: THREE.FrontSide, shininess: 92 });
  const glass = new THREE.Mesh(geometry(glassPositions,glassColors),glassMaterial);
  glass.name='domes-blue-gray-glazing'; glass.renderOrder=2; glass.receiveShadow=true; root.add(glass);

  const fineMesh = new THREE.Mesh(geometry(fine),new THREE.MeshLambertMaterial({color:0xc4c7c3}));
  fineMesh.name='domes-aluminum-diagonal-lattice'; fineMesh.castShadow=true; root.add(fineMesh);
  const concrete = new THREE.MeshLambertMaterial({color:0xb6b0a4});
  const cream = new THREE.MeshLambertMaterial({color:0xd8d0c1});
  const plants = new THREE.MeshLambertMaterial({color:0x42693f,emissive:0x000000});
  const crownFrames:number[]=[], crownRoofs:number[]=[], basePanels:number[]=[];
  for (const center of DOMES_CENTERS) {
    const foundation = new THREE.Mesh(new THREE.CylinderGeometry(21.45,21.65,.7,32),concrete);
    foundation.position.set(center.x,0,center.z); foundation.name=`${center.name}-patterned-base`; foundation.receiveShadow=true; root.add(foundation);
    const planting = new THREE.Mesh(new THREE.CylinderGeometry(19.2,19.2,.18,24),plants);
    planting.position.set(center.x,.16,center.z); planting.name=`${center.name}-interior-planting`; root.add(planting);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(4.78,OCULUS_DIAMETER_M/2,1.558,48,1,true),glassMaterial);
    cap.position.set(center.x,25.129,center.z); cap.name=`${center.name}-oculus-cap`; cap.castShadow=false; root.add(cap);
    // The aerial and underside views show a closed shallow metal crown above the
    // sloped glazed collar. Keep the published overall height, not an open chimney.
    for(let j=0;j<radialSegments;j++){
      const a=TAU*j/radialSegments,b=TAU*(j+1)/radialSegments;
      const pa:Point=[center.x+Math.cos(a)*4.78,25.85,center.z+Math.sin(a)*4.78];
      const pb:Point=[center.x+Math.cos(b)*4.78,25.85,center.z+Math.sin(b)*4.78];
      tri(crownRoofs,[center.x,DOME_HEIGHT_M,center.z],pb,pa);
      boxBetween(crownFrames,pa,pb,.085);
      if(j%3===0)boxBetween(crownFrames,[center.x,25.87,center.z],pa,.045);
    }
    for(let j=0;j<16;j++){
      const a=TAU*j/16;
      boxBetween(crownFrames,[center.x+Math.cos(a)*OCULUS_DIAMETER_M/2,24.35,center.z+Math.sin(a)*OCULUS_DIAMETER_M/2],
        [center.x+Math.cos(a)*4.78,25.82,center.z+Math.sin(a)*4.78],.11);
    }
    for(let j=0;j<radialSegments;j++){
      const a=TAU*j/radialSegments,b=TAU*(j+1)/radialSegments;
      const mid=(a+b)/2;
      const left:Point=[center.x+Math.cos(a)*21.38,.32,center.z+Math.sin(a)*21.38];
      const right:Point=[center.x+Math.cos(b)*21.38,.32,center.z+Math.sin(b)*21.38];
      const peak:Point=[center.x+Math.cos(mid)*21.3,1.55,center.z+Math.sin(mid)*21.3];
      tri(basePanels,left,peak,right);
      boxBetween(heavy,left,peak,.13); boxBetween(heavy,peak,right,.13);
      // Three recessed horizontal slots suggest the ventilated triangular plinth.
      for(const fraction of [.25,.48,.7]){
        const mix=(p:Point):Point=>p.map((v,k)=>THREE.MathUtils.lerp(v,peak[k],fraction)) as Point;
        boxBetween(crownFrames,mix(left),mix(right),.045);
      }
    }
  }
  // Build after the plinth frames have been appended so they actually render.
  const heavyMesh = new THREE.Mesh(geometry(heavy),new THREE.MeshLambertMaterial({color:0xb8b7b0}));
  heavyMesh.name='domes-primary-structural-ribs'; heavyMesh.castShadow=true; root.add(heavyMesh);
  const crownMesh=new THREE.Mesh(geometry(crownFrames),new THREE.MeshLambertMaterial({color:0xbfc2bf}));
  crownMesh.name='oculus-radial-struts'; crownMesh.castShadow=true; root.add(crownMesh);
  const roofMesh=new THREE.Mesh(geometry(crownRoofs),new THREE.MeshStandardMaterial({color:0x89938f,roughness:.57,metalness:.26,side:THREE.DoubleSide}));
  roofMesh.name='domes-closed-oculus-roofs'; roofMesh.receiveShadow=true; root.add(roofMesh);
  const panels=new THREE.Mesh(geometry(basePanels),cream);
  panels.name='domes-triangular-ventilated-plinth'; panels.receiveShadow=true; root.add(panels);

  // Low connector keeps the three independent conservatory volumes visually dominant.
  const lobby = new THREE.Mesh(new THREE.BoxGeometry(38,4.05,36),concrete);
  lobby.position.set(-11,1.75,0); lobby.name='low-connecting-lobby'; lobby.receiveShadow=true; root.add(lobby);
  const connector = new THREE.Mesh(new THREE.BoxGeometry(24,3.4,17),concrete);
  connector.position.set(8.5,1.45,.45); connector.name='tropical-dome-connector'; root.add(connector);
  const arches:number[]=[],entryGlass:number[]=[],canopies:number[]=[]; addEntranceArches(arches,entryGlass,canopies);
  const archMesh=new THREE.Mesh(geometry([...arches,...canopies]),cream); archMesh.name='west-entrance-nine-scalloped-arches'; archMesh.castShadow=true; archMesh.receiveShadow=true; root.add(archMesh);
  const entryMesh=new THREE.Mesh(geometry(entryGlass),new THREE.MeshPhongMaterial({color:0x26383b,transparent:true,opacity:.78,depthWrite:false}));
  entryMesh.name='west-entrance-recessed-glazing'; root.add(entryMesh);

  root.userData = {
    centers: DOMES_CENTERS.map(c=>({...c})), diameterM:DOME_DIAMETER_M, heightM:DOME_HEIGHT_M,
    oculusDiameterM:OCULUS_DIAMETER_M,
    setLightingMode(mode: DomesMode) {
      plants.emissive.set(mode === 'night' ? 0x18351b : mode === 'sunset' ? 0x172519 : 0x000000);
      plants.needsUpdate=true;
    },
  };
  return root;
}
