import * as THREE from 'three';
import { AMFAM_LOCAL_FOOTPRINT } from './amfamFacade.ts';

export type AmFamBowlLightingMode = 'day' | 'sunset' | 'night';
type Point = [number, number, number];

const DEG = Math.PI / 180;
const TAN_55 = Math.tan(55 * DEG);
const FIELD_RADIUS = 121.92;
const SEGMENTS = 88;
// Main grandstand runs from the first-base line, around home, to third base.
// The open outfield is completed only by the two smaller corner bleachers.
const START_DEG = 45;
const END_DEG = 315;

function tri(out:number[], a:Point, b:Point, c:Point) { out.push(...a,...b,...c); }
function quad(out:number[], a:Point, b:Point, c:Point, d:Point) {
  tri(out,a,b,d); tri(out,b,c,d);
}
function geometry(points:number[]) {
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  g.computeVertexNormals();
  return g;
}

function cross(ax:number,az:number,bx:number,bz:number) { return ax*bz-az*bx; }

/** First mapped-building intersection on a ray from home plate.
 * Concave service recesses can create a second, exterior interval; seating
 * must remain in the uninterrupted interior interval containing the field. */
function footprintRadius(angle:number) {
  const dx=Math.sin(angle), dz=-Math.cos(angle);
  let radius=Number.POSITIVE_INFINITY;
  for(let i=0;i<AMFAM_LOCAL_FOOTPRINT.length;i++) {
    const a=AMFAM_LOCAL_FOOTPRINT[i], b=AMFAM_LOCAL_FOOTPRINT[(i+1)%AMFAM_LOCAL_FOOTPRINT.length];
    const ex=b[0]-a[0], ez=b[1]-a[1], den=cross(dx,dz,ex,ez);
    if(Math.abs(den)<1e-9)continue;
    const t=cross(a[0],a[1],ex,ez)/den;
    const u=cross(a[0],a[1],dx,dz)/den;
    if(t>=0&&u>=-1e-7&&u<=1+1e-7)radius=Math.min(radius,t);
  }
  if(!Number.isFinite(radius))throw new Error('Bowl ray missed mapped stadium footprint');
  return radius;
}

function fairWallRadius(angleDeg:number) {
  const t=(angleDeg+45)/90;
  return angleDeg<=0
    ? THREE.MathUtils.lerp(104.8512,FIELD_RADIUS,t*2)
    : THREE.MathUtils.lerp(FIELD_RADIUS,105.156,t*2-1);
}

function lowerInnerRadius(angleDeg:number) {
  const aa=Math.abs(angleDeg);
  if(aa<=45)return fairWallRadius(angleDeg)+6.2;
  // Continue smoothly around the foul corners toward the compact backstop.
  return THREE.MathUtils.lerp(fairWallRadius(Math.sign(angleDeg)*45)+6.2,29,
    THREE.MathUtils.smoothstep(aa,45,112));
}

function point(angle:number,radius:number,y:number):Point {
  const x=Math.sin(angle)*radius, z=-Math.cos(angle)*radius;
  const roofDistance=z-(55-Math.abs(x)/TAN_55);
  // Ease into the low public roof over four metres, then honor its exact cap.
  const blend=THREE.MathUtils.smoothstep(roofDistance,-4,0);
  return [x,THREE.MathUtils.lerp(y,Math.min(y,32.2),blend),z];
}

type TierSpec={innerOffset:number; width:number; low:number; high:number};
const TIER_SPECS:TierSpec[]=[
  {innerOffset:0,width:20,low:2.2,high:11.8},
  {innerOffset:16.5,width:21,low:13.4,high:22.8},
  {innerOffset:30,width:25,low:23.8,high:34.5},
];

function stations(spec:TierSpec) {
  const result:{angle:number;inner:number;outer:number;low:number;high:number}[]=[];
  for(let i=0;i<=SEGMENTS;i++) {
    const angleDeg=THREE.MathUtils.lerp(START_DEG,END_DEG,i/SEGMENTS);
    const signedDeg=angleDeg>180?angleDeg-360:angleDeg;
    const angle=angleDeg*DEG;
    const limit=footprintRadius(angle)-3.0;
    // Center field has only about three metres between the 400-foot wall and
    // mapped shell. Preserve that narrow real condition rather than pushing a
    // nominal full-depth deck through either boundary.
    const fieldMinimum=Math.abs(signedDeg)<=45?fairWallRadius(signedDeg)+.8:0;
    const inner=Math.max(fieldMinimum,Math.min(lowerInnerRadius(signedDeg)+spec.innerOffset,limit-.8));
    const outer=Math.min(inner+spec.width,limit);
    const a=point(angle,inner,spec.low), b=point(angle,outer,spec.high);
    result.push({angle,inner,outer,low:a[1],high:b[1]});
  }
  return result;
}

function addTierSurface(out:number[], s:ReturnType<typeof stations>) {
  for(let i=0;i<s.length-1;i++) {
    const a=s[i],b=s[i+1];
    quad(out,point(a.angle,a.inner,a.low),point(b.angle,b.inner,b.low),
      point(b.angle,b.outer,b.high),point(a.angle,a.outer,a.high));
  }
}

function addUnderside(out:number[], s:ReturnType<typeof stations>) {
  for(let i=0;i<s.length-1;i++) {
    const a=s[i],b=s[i+1];
    const ai=point(a.angle,a.inner,Math.max(.7,a.low-.65));
    const bi=point(b.angle,b.inner,Math.max(.7,b.low-.65));
    const ao=point(a.angle,a.outer,Math.max(1,a.high-1));
    const bo=point(b.angle,b.outer,Math.max(1,b.high-1));
    quad(out,ai,ao,bo,bi);
    // A short outer fascia closes the deck without extending a wall to grade.
    quad(out,ao,point(a.angle,a.outer,a.high),point(b.angle,b.outer,b.high),bo);
  }
}

function addRowBands(out:number[], s:ReturnType<typeof stations>, rows:number) {
  for(let row=1;row<rows;row++) {
    const t=row/rows;
    for(let i=0;i<s.length-1;i++) {
      const a=s[i],b=s[i+1];
      const ar=THREE.MathUtils.lerp(a.inner,a.outer,t), br=THREE.MathUtils.lerp(b.inner,b.outer,t);
      const ay=THREE.MathUtils.lerp(a.low,a.high,t)+.04, by=THREE.MathUtils.lerp(b.low,b.high,t)+.04;
      const depth=.14;
      quad(out,point(a.angle,ar-depth,ay),point(b.angle,br-depth,by),
        point(b.angle,Math.min(br+depth,b.outer),by+.08),point(a.angle,Math.min(ar+depth,a.outer),ay+.08));
    }
  }
}

function addBox(out:number[], center:Point, size:Point) {
  const [x,y,z]=center,[sx,sy,sz]=size,x0=x-sx/2,x1=x+sx/2,y0=y-sy/2,y1=y+sy/2,z0=z-sz/2,z1=z+sz/2;
  const p:Point[]=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
  quad(out,p[0],p[3],p[2],p[1]);quad(out,p[4],p[5],p[6],p[7]);quad(out,p[0],p[1],p[5],p[4]);
  quad(out,p[1],p[2],p[6],p[5]);quad(out,p[2],p[3],p[7],p[6]);quad(out,p[3],p[0],p[4],p[7]);
}

function addConcourse(out:number[], s:ReturnType<typeof stations>, y:number) {
  for(let i=0;i<s.length-1;i++) {
    const a=s[i],b=s[i+1], ar=a.inner-2.2,br=b.inner-2.2;
    quad(out,point(a.angle,ar,y),point(b.angle,br,y),point(b.angle,b.inner,y),point(a.angle,a.inner,y));
  }
}

function addOutfieldBleachers(out:number[]) {
  for(const [from,to] of [[-43,-14],[14,43]] as const) {
    const n=12;
    for(let i=0;i<n;i++) {
      const ad=THREE.MathUtils.lerp(from,to,i/n),bd=THREE.MathUtils.lerp(from,to,(i+1)/n);
      const a=ad*DEG,b=bd*DEG, ai=fairWallRadius(ad)+6.2,bi=fairWallRadius(bd)+6.2;
      const ao=Math.min(ai+12,footprintRadius(a)-3),bo=Math.min(bi+12,footprintRadius(b)-3);
      quad(out,point(a,ai,3),point(b,bi,3),point(b,bo,10),point(a,ao,10));
    }
  }
}

export function buildAmFamBowl():THREE.Group {
  const root=new THREE.Group(); root.name='continuous-american-family-field-bowl';
  const seatMaterial=new THREE.MeshStandardMaterial({color:0x174e3a,roughness:.86,side:THREE.DoubleSide});
  const rowMaterial=new THREE.MeshStandardMaterial({color:0x0b3127,roughness:.9,side:THREE.DoubleSide});
  const concreteMaterial=new THREE.MeshStandardMaterial({color:0xaaa99f,roughness:.95,side:THREE.DoubleSide});
  const concourseMaterial=new THREE.MeshStandardMaterial({color:0xc7c3b4,roughness:.93,side:THREE.DoubleSide});
  const stationSets=TIER_SPECS.map(stations);
  stationSets.forEach((s,index)=>{
    const seats:number[]=[],rows:number[]=[],under:number[]=[];
    addTierSurface(seats,s); addRowBands(rows,s,index===2?11:9); addUnderside(under,s);
    const tier=new THREE.Mesh(geometry(seats),seatMaterial); tier.name=`terraced-dark-green-bowl-tier-${index+1}`;root.add(tier);
    const bands=new THREE.Mesh(geometry(rows),rowMaterial);bands.name=`bounded-seat-rows-tier-${index+1}`;root.add(bands);
    const slab=new THREE.Mesh(geometry(under),concreteMaterial);slab.name=`concrete-tier-${index+1}-underside-and-fascia`;root.add(slab);
  });
  const concourses:number[]=[];
  addConcourse(concourses,stationSets[1],12.8);addConcourse(concourses,stationSets[2],23.2);
  const concourse=new THREE.Mesh(geometry(concourses),concourseMaterial);concourse.name='continuous-bowl-concourse-rings';root.add(concourse);
  const supports:number[]=[];
  for(const angleDeg of [-120,-96,-72,-48,48,72,96,120]) {
    const angle=angleDeg*DEG, base=lowerInnerRadius(angleDeg)+35;
    for(const height of [12.4,22.7]) {
      const r=Math.min(base+(height>20?12:0),footprintRadius(angle)-5);
      addBox(supports,point(angle,r,height/2),[1.15,height,1.15]);
    }
  }
  const supportMesh=new THREE.Mesh(geometry(supports),concreteMaterial);supportMesh.name='under-stand-concrete-supports';root.add(supportMesh);
  const bleachers:number[]=[];addOutfieldBleachers(bleachers);
  const outfield=new THREE.Mesh(geometry(bleachers),seatMaterial);outfield.name='outfield-corner-bleachers';root.add(outfield);
  root.userData.bowl={homePlate:[0,0,0],centerField:[0,0,-FIELD_RADIUS],tierCount:3,segments:SEGMENTS};
  root.userData.setLightingMode=(mode:AmFamBowlLightingMode)=>{
    const glow=mode==='night'?0x123c2d:mode==='sunset'?0x092017:0;
    seatMaterial.emissive.setHex(glow);rowMaterial.emissive.setHex(glow);
    seatMaterial.emissiveIntensity=mode==='night'?.32:mode==='sunset'?.12:0;
    rowMaterial.emissiveIntensity=seatMaterial.emissiveIntensity;
  };
  root.userData.setLightingMode('day');
  return root;
}
