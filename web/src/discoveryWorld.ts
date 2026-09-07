import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DISCOVERY_SITE } from './discoverySite.ts';
import { buildDiscoveryRoof } from './discoveryRoof.ts';
import { DISCOVERY_PARTS, type DiscoveryPlanPoint } from './discoveryGeometry.ts';

export type DiscoveryLightingMode = 'day' | 'sunset' | 'night';
type Point = [number, number, number];
const TAU = Math.PI * 2;
/** OSM upper glass outline bounds, rather than the overall complex centroid. */
export const DISCOVERY_ROUND_CENTER = { x: 809.1955, z: -196.689 };
// Photo-estimated oversailing hoop: wider than the white rotunda shells.
export const DISCOVERY_CROWN = { innerRadius: 21.8, outerRadius: 22.0, bottom: 12.1, top: 12.32 };
export const DISCOVERY_TERRACE = { innerRadius: 14.9, outerRadius: 19.65, bottom: 7.9248, top: 8.09 };
/** A 2.4 m visual-estimate promenade apron follows the mapped south facade,
 * crosses the short connector and terminates inside the round boardwalk. */
export const DISCOVERY_PROMENADE_INNER: readonly DiscoveryPlanPoint[] = [
  [683.1,-182.7], [686.647,-182.945], [758.756,-188.009], [762.1,-188.241], [790.9,-190.258],
];
export const DISCOVERY_PROMENADE_WIDTH = 2.4;

function local([x, z]: DiscoveryPlanPoint): [number, number] {
  return [x - DISCOVERY_SITE.x, z - DISCOVERY_SITE.z];
}
function extrude(points: readonly DiscoveryPlanPoint[], bottom: number, top: number) {
  const shape = new THREE.Shape();
  points.forEach((point, i) => { const [x, z] = local(point); if (i) shape.lineTo(x, -z); else shape.moveTo(x, -z); });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: top - bottom, bevelEnabled: false, steps: 1 });
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, bottom, 0);
  return geometry;
}
function beam(a: Point, b: Point, width: number, depth = width) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), direction = end.clone().sub(start);
  const geometry = new THREE.BoxGeometry(width, direction.length(), depth);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
  geometry.translate(...start.add(end).multiplyScalar(.5).toArray());
  return geometry;
}
function betweenPlan(a: DiscoveryPlanPoint, b: DiscoveryPlanPoint, y: number, width: number, height: number) {
  const [ax, az] = local(a), [bx, bz] = local(b);
  const geometry = new THREE.BoxGeometry(Math.hypot(bx - ax, bz - az), height, width);
  geometry.rotateY(-Math.atan2(bz - az, bx - ax));
  geometry.translate((ax + bx) / 2, y, (az + bz) / 2);
  return geometry;
}
function add(root: THREE.Group, geometries: THREE.BufferGeometry[], material: THREE.Material, name: string) {
  const compatible = geometries.map((g) => { const n = g.index ? g.toNonIndexed() : g.clone(); n.deleteAttribute('uv'); return n; });
  const geometry = mergeGeometries(compatible, false);
  if (!geometry) throw new Error(`Could not merge ${name}`);
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
  geometries.forEach(g => g.dispose()); compatible.forEach(g => g.dispose());
  return mesh;
}
function circle(radius: number, segments = 72): DiscoveryPlanPoint[] {
  return Array.from({ length: segments }, (_, i) => [DISCOVERY_ROUND_CENTER.x + Math.cos(i * TAU / segments) * radius,
    DISCOVERY_ROUND_CENTER.z + Math.sin(i * TAU / segments) * radius]);
}
/** An actual annulus: the crown and promenade retain an open centre. */
function ring(inner: number, outer: number, bottom: number, top: number, start = 0, end = TAU) {
  const segments = Math.ceil((end - start) / TAU * 72), points: DiscoveryPlanPoint[] = [];
  const point = (radius: number, angle: number): DiscoveryPlanPoint => [DISCOVERY_ROUND_CENTER.x + Math.cos(angle) * radius,
    DISCOVERY_ROUND_CENTER.z + Math.sin(angle) * radius];
  // Leave a tiny closure gap only for open arcs; full rings are shapes with holes.
  if (end - start < TAU - .001) {
    for (let i = 0; i <= segments; i++) points.push(point(outer, start + (end - start) * i / segments));
    for (let i = segments; i >= 0; i--) points.push(point(inner, start + (end - start) * i / segments));
    return extrude(points, bottom, top);
  }
  const shape = new THREE.Shape();
  circle(outer).forEach((p, i) => { const [x,z] = local(p); if(i) shape.lineTo(x,-z); else shape.moveTo(x,-z); });
  shape.closePath();
  const hole = new THREE.Path();
  circle(inner).reverse().forEach((p, i) => { const [x,z] = local(p); if(i) hole.lineTo(x,-z); else hole.moveTo(x,-z); });
  hole.closePath(); shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: top - bottom, bevelEnabled: false, steps: 1 });
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, bottom, 0); return geometry;
}

/** Source envelope and component heights: cached OSM, data/discovery_site.json.
 * Architectural treatment: HGA project exterior photography (white metal shells,
 * recessed curtain wall, Pilothouse crown). Crown dimensions, panel spacing and
 * floor elevation are visual estimates, not survey measurements. */
export function buildDiscoveryWorld(groundAt: (x: number, z: number) => number): THREE.Group {
  const root = new THREE.Group(); root.name = 'discovery-world';
  root.position.set(DISCOVERY_SITE.x, DISCOVERY_SITE.floor, DISCOVERY_SITE.z);
  const white = new THREE.MeshStandardMaterial({ color: 0xeceeea, roughness: .63, metalness: .22 });
  const roof = new THREE.MeshStandardMaterial({ color: 0xd7d9d7, roughness: .8 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8c9697, roughness: .46, metalness: .6 });
  const joints = new THREE.MeshStandardMaterial({ color: 0xa5afae, roughness: .65 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x999a90, roughness: .96 });
  const timber = new THREE.MeshStandardMaterial({ color: 0x857a65, roughness: .95 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x4d707c, roughness: .28, metalness: .28 });
  const crown = white.clone();
  const frames: THREE.BufferGeometry[] = [], seams: THREE.BufferGeometry[] = [], foundations: THREE.BufferGeometry[] = [];

  for (const part of DISCOVERY_PARTS) {
    const bottom = part.roofOnly ? part.height - .23 : part.minHeight;
    const material = part.white ? white : part.roofOnly ? (part.id === 700564566 ? glass : white) : glass;
    const mass = add(root, [extrude(part.footprint, bottom, part.height)], material, `osm-${part.id}-${part.name.replaceAll(' ', '-')}`);
    mass.userData.sourceId = part.id;
    mass.userData.heightAboveFloor = part.height;
    mass.userData.minHeightAboveFloor = bottom;
    if (!part.white && !part.roofOnly) {
      // Only the exposed upper Pilothouse portion needs its own roof; the lower
      // rotunda roof provides a walkable annular terrace beneath it.
      add(root, [extrude(part.footprint, part.height, part.height + .16)], roof, `roof-${part.id}`);
      const start = part.id === 700564602 ? 7.9248 : bottom;
      part.footprint.forEach((a, i) => {
        const b = part.footprint[(i + 1) % part.footprint.length];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        // Very short mapped edges are shape control points, not extra mullions.
        if (length < .5) return;
        const divisions = Math.max(1, Math.ceil(length / 2.1));
        for (let j = 0; j < divisions; j++) {
          const t = j / divisions, [x,z] = local([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
          frames.push(beam([x,start,z],[x,part.height,z],.105));
        }
        frames.push(betweenPlan(a,b,part.height-.06,.11,.12));
        if (part.height - start > 3.5) frames.push(betweenPlan(a,b,start+2.8,.08,.10));
      });
      if (bottom === 0) {
        const sampled = part.footprint.map(([x,z]) => groundAt(x,z)).filter(Number.isFinite);
        const base = Math.min(-.2, ...sampled.map(y => y - DISCOVERY_SITE.floor)) - .15;
        foundations.push(extrude(part.footprint, base, 0));
      }
    }
    if (part.white) {
      // Four mapped shells, rather than a solid cylinder: the intervening tall
      // glazed slots remain visible. Follow only the outward-facing arc edges.
      part.footprint.forEach((a,i) => {
        const b = part.footprint[(i+1)%part.footprint.length];
        const ra = Math.hypot(a[0]-DISCOVERY_ROUND_CENTER.x,a[1]-DISCOVERY_ROUND_CENTER.z);
        const rb = Math.hypot(b[0]-DISCOVERY_ROUND_CENTER.x,b[1]-DISCOVERY_ROUND_CENTER.z);
        if (Math.min(ra,rb) < 19 || Math.hypot(b[0]-a[0],b[1]-a[1]) < .25) return;
        for(let course=1;course<4;course++) seams.push(betweenPlan(a,b,bottom+(part.height-bottom)*course/4,.042,.033));
      });
    }
  }

  // Upper white panels over the recessed science-wing glass base; the exact
  // mapped glass outline determines the wall bearing and length.
  const wing = DISCOVERY_PARTS.find(p=>p.id===700564608)!;
  const cladding: THREE.BufferGeometry[] = [];
  // Long north and south elevations, plus west return, leave the mapped east
  // curtain wall and connection readable. A narrow band below the roof is glass.
  for(const [ia,ib] of [[4,6],[7,0],[0,4]]) {
    const a=wing.footprint[ia],b=wing.footprint[ib];
    cladding.push(betweenPlan(a,b,5.6,.30,3.7));
    for(let course=1;course<4;course++) seams.push(betweenPlan(a,b,3.75+course*.925,.33,.035));
    const bays=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/3.6);
    for(let bay=1;bay<bays;bay++) {
      const t=bay/bays, p:DiscoveryPlanPoint=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
      const tiny:DiscoveryPlanPoint=[p[0]+(b[0]-a[0])*.0004,p[1]+(b[1]-a[1])*.0004];
      seams.push(betweenPlan(p,tiny,5.6,.334,3.7));
    }
  }
  add(root,cladding,white,'science-wing-white-upper-panels');
  root.add(buildDiscoveryRoof());

  add(root,foundations,concrete,'mapped-foundations-to-terrain');
  add(root,frames,metal,'batched-curtain-wall-mullions');
  add(root,seams,joints,'four-course-white-panel-joints');
  add(root,[ring(DISCOVERY_CROWN.innerRadius,DISCOVERY_CROWN.outerRadius,DISCOVERY_CROWN.bottom,DISCOVERY_CROWN.top)],crown,'pilothouse-open-white-crown');
  const spokes: THREE.BufferGeometry[] = [], rails: THREE.BufferGeometry[] = [];
  const radial = (radius: number, y: number, angle: number): Point => {
    const [x,z]=local([DISCOVERY_ROUND_CENTER.x+Math.cos(angle)*radius,DISCOVERY_ROUND_CENTER.z+Math.sin(angle)*radius]);
    return [x,y,z];
  };
  // GRAEF balcony photo: curved ribs rise from the terrace beside the inset
  // glazing and sweep out to the oversailing hoop. Chord segments keep these
  // slender members inexpensive while preserving the open canopy silhouette.
  for(let i=0;i<24;i++) {
    const a=i*TAU/24;
    const curvePoint=(t:number):Point=>{
      const u=1-t;
      return radial(u*u*15.35+2*u*t*14.1+t*t*21.9,
        u*u*DISCOVERY_TERRACE.top+2*u*t*11.95+t*t*12.21,a);
    };
    for(let j=0;j<12;j++) spokes.push(beam(curvePoint(j/12),curvePoint((j+1)/12),.16,.26));
    rails.push(beam(radial(19.4,8.09,a),radial(19.4,9.15,a),.055));
  }
  add(root,spokes,white,'pilothouse-radial-steel-crown-supports');
  // Narrow concentric blades approximate the sunshade field seen from the
  // balcony and aerial references; every blade is separated by visible sky.
  const louvers: THREE.BufferGeometry[]=[];
  for(let radius=15.65;radius<20.3;radius+=.48) {
    const y=11.79+(radius-15.65)*.07;
    louvers.push(ring(radius,radius+.12,y,y+.16));
  }
  add(root,louvers,white,'pilothouse-open-canopy-louvers');
  add(root,[ring(DISCOVERY_TERRACE.innerRadius,DISCOVERY_TERRACE.outerRadius,
    DISCOVERY_TERRACE.bottom,DISCOVERY_TERRACE.top)],white,'pilothouse-wraparound-terrace');
  rails.push(ring(19.36,19.44,9.11,9.18));
  for(let y=8.28;y<9.04;y+=.15) rails.push(ring(19.388,19.412,y,y+.024));
  add(root,rails,metal,'rotunda-terrace-railings');

  // A narrow boardwalk collar sits on piles and the mapped rotunda foundation;
  // it is not an unsupported disk floating on the lake mask.
  add(root,[ring(17.5,22.05,-.40,-.10)],timber,'supported-round-boardwalk');
  const piles: THREE.BufferGeometry[] = [], planks: THREE.BufferGeometry[] = [];
  const pileBases: {x:number;z:number;bottom:number}[]=[];
  for(let i=0;i<24;i++) {
    const a=i*TAU/24, p=radial(21.3,-.4,a), wx=p[0]+DISCOVERY_SITE.x,wz=p[2]+DISCOVERY_SITE.z;
    const sample=groundAt(wx,wz), bottom=Math.min(-.6,(Number.isFinite(sample)?sample:-5)-DISCOVERY_SITE.floor)-.15;
    piles.push(beam([p[0],bottom,p[2]],p,.32));
    pileBases.push({x:wx,z:wz,bottom:bottom+DISCOVERY_SITE.floor});
  }
  for(let i=0;i<120;i++) planks.push(beam(radial(19.7,-.087,i*TAU/120),radial(22.02,-.087,i*TAU/120),.022,.018));
  const waterfrontRails: THREE.BufferGeometry[]=[];
  // Protect the exposed water-side half; keep the western promenade entrance open.
  for(let i=0;i<=36;i++) {
    const a=-Math.PI/2+i*Math.PI/36;
    waterfrontRails.push(beam(radial(21.9,-.1,a),radial(21.9,1.0,a),.055));
  }
  waterfrontRails.push(ring(21.86,21.94,.96,1.03,-Math.PI/2,Math.PI/2));
  for(let y=.08;y<.9;y+=.17) waterfrontRails.push(ring(21.888,21.912,y,y+.024,-Math.PI/2,Math.PI/2));
  add(root,waterfrontRails,metal,'waterfront-boardwalk-cable-railings');
  add(root,piles,concrete,'boardwalk-piles-to-ground');
  add(root,planks,joints,'batched-boardwalk-plank-joints');
  const promenade: DiscoveryPlanPoint[] = [...DISCOVERY_PROMENADE_INNER,
    ...DISCOVERY_PROMENADE_INNER.toReversed().map(([x,z]): DiscoveryPlanPoint => [x,z+DISCOVERY_PROMENADE_WIDTH])];
  add(root,[extrude(promenade,-.40,-.10)],timber,'continuous-south-promenade-boardwalk');
  const apronSamples=promenade.map(([x,z])=>groundAt(x,z)).filter(Number.isFinite);
  const apronBase=Math.min(-.6,...apronSamples.map(y=>y-DISCOVERY_SITE.floor))-.15;
  add(root,[extrude(promenade,apronBase,-.40)],concrete,'south-promenade-foundation-to-ground');
  const apronPlanks: THREE.BufferGeometry[]=[];
  for(let i=0;i<DISCOVERY_PROMENADE_INNER.length-1;i++) {
    const a=DISCOVERY_PROMENADE_INNER[i],b=DISCOVERY_PROMENADE_INNER[i+1];
    const divisions=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/.75);
    for(let j=0;j<divisions;j++) {
      const t=j/divisions,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
      apronPlanks.push(betweenPlan([x,z],[x,z+DISCOVERY_PROMENADE_WIDTH],-.087,.021,.018));
    }
  }
  add(root,apronPlanks,joints,'batched-south-promenade-plank-joints');
  // Entry canopy supports are inside the actual mapped western roof extent.
  const canopySupports: THREE.BufferGeometry[]=[];
  for(const [x,z] of [[678.8,-180.2],[678.1,-192.2]]) {
    const p=local([x,z]); canopySupports.push(beam([p[0],0,p[1]],[p[0],4.35,p[1]],.17));
  }
  add(root,canopySupports,metal,'west-entrance-canopy-columns');
  root.userData.pileBases=pileBases;
  root.userData.floorElevationEstimate=DISCOVERY_SITE.floor;
  root.userData.source='OSM building parts; HGA and GRAEF exterior photos; supplied Discovery World reference pack';
  root.userData.setLightingMode=(mode: DiscoveryLightingMode)=>{
    const intensity=mode==='night'?.2:mode==='sunset'?.08:0;
    glass.emissive.setHex(intensity?0xffbd79:0); glass.emissiveIntensity=intensity;
    crown.emissive.setHex(intensity?0xffe2b2:0); crown.emissiveIntensity=intensity*.12;
    root.userData.lightingMode=mode;
  };
  root.userData.setLightingMode('day');
  return root;
}
