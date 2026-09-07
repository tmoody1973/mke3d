import * as THREE from 'three';
import { buildAmFamBowl } from './amfamBowl.ts';
import { buildAmFamDetails } from './amfamDetails.ts';
import { facadePoint, facadeFrame, AMFAM_LOCAL_FOOTPRINT } from './amfamFacade.ts';

export type AmFamLightingMode = 'day' | 'sunset' | 'night';

type Point = [number, number, number];
type RoofPanelInfo = {
  name: string;
  kind: 'fixed' | 'movable';
  stackSide: 'left' | 'right' | null;
  moved: boolean;
  angleStartDeg: number;
  angleEndDeg: number;
  stackOffsetM: number;
};

const DEG = Math.PI / 180;
export const BASE_PATH_M = 27.432;
export const ROOF_SPAN_M = 182.88;
export const ROOF_PEAK_M = 100.584;
export const CENTER_FIELD_M = 121.92;
export const HOME_PLATE: Point = [0, 0, 0];
export const CENTER_FIELD: Point = [0, 0, -CENTER_FIELD_M];
export const ROOF_PIVOT: Point = [0, 38, 55];
const BASE_OFFSET_M = BASE_PATH_M / Math.SQRT2;
export const BASES = {
  home: [0, 0, 0] as Point,
  first: [BASE_OFFSET_M, 0, -BASE_OFFSET_M] as Point,
  second: [0, 0, -2 * BASE_OFFSET_M] as Point,
  third: [-BASE_OFFSET_M, 0, -BASE_OFFSET_M] as Point,
};
export const AMFAM_LOCAL_BOUNDS = {
  min: [-146.57, 0, -126.76] as Point,
  max: [155.94, ROOF_PEAK_M, 93.30] as Point,
};

function tri(out: number[], a: Point, b: Point, c: Point) { out.push(...a, ...b, ...c); }

function quad(out: number[], a: Point, b: Point, c: Point, d: Point) {
  tri(out, a, b, d); tri(out, b, c, d);
}

function geometry(points: number[]): THREE.BufferGeometry {
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  result.computeVertexNormals();
  return result;
}

function addBox(out: number[], min: Point, max: Point) {
  const [x0,y0,z0]=min, [x1,y1,z1]=max;
  const p:Point[]=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],
    [x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
  quad(out,p[0],p[3],p[2],p[1]); quad(out,p[4],p[5],p[6],p[7]);
  quad(out,p[0],p[1],p[5],p[4]); quad(out,p[1],p[2],p[6],p[5]);
  quad(out,p[2],p[3],p[7],p[6]); quad(out,p[3],p[0],p[4],p[7]);
}

/** Adds a solid rectangular member between two points, rather than a camera-facing ribbon. */
function beam(out:number[], aa:Point, bb:Point, width:number, depth=width) {
  const a=new THREE.Vector3(...aa), b=new THREE.Vector3(...bb);
  const direction=b.clone().sub(a); if(direction.lengthSq()<1e-10)return;
  direction.normalize();
  const reference=Math.abs(direction.y)<.92?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0);
  const u=new THREE.Vector3().crossVectors(direction,reference).normalize().multiplyScalar(width/2);
  const v=new THREE.Vector3().crossVectors(direction,u).normalize().multiplyScalar(depth/2);
  const pt=(center:THREE.Vector3,su:number,sv:number):Point=>{
    const p=center.clone().addScaledVector(u,su).addScaledVector(v,sv); return [p.x,p.y,p.z];
  };
  const p:Point[]=[pt(a,-1,-1),pt(a,1,-1),pt(a,1,1),pt(a,-1,1),
    pt(b,-1,-1),pt(b,1,-1),pt(b,1,1),pt(b,-1,1)];
  quad(out,p[0],p[3],p[2],p[1]); quad(out,p[4],p[5],p[6],p[7]);
  quad(out,p[0],p[1],p[5],p[4]); quad(out,p[1],p[2],p[6],p[5]);
  quad(out,p[2],p[3],p[7],p[6]); quad(out,p[3],p[0],p[4],p[7]);
}

function fieldPoint(angleDeg:number, extra=0):Point {
  const angle=angleDeg*DEG;
  const mix=(angleDeg+45)/90;
  const edge=angleDeg<0
    ? THREE.MathUtils.lerp(104.8512,CENTER_FIELD_M,mix*2)
    : THREE.MathUtils.lerp(CENTER_FIELD_M,105.156,mix*2-1);
  const radius=edge+extra;
  return [Math.sin(angle)*radius,.04,-Math.cos(angle)*radius];
}

function makeField(): THREE.BufferGeometry {
  const shape=new THREE.Shape();
  for(let i=0;i<=32;i++){
    const p=fieldPoint(-45+90*i/32);if(i)shape.lineTo(p[0],-p[2]);else shape.moveTo(p[0],-p[2]);
  }
  // Foul territory follows the backstop and sidelines, leaving only a narrow apron.
  for(let i=0;i<=90;i++){
    const degrees=45+270*i/90,aa=Math.abs(degrees>180?degrees-360:degrees),angle=degrees*DEG;
    const radius=THREE.MathUtils.lerp(110.9,29,THREE.MathUtils.smoothstep(aa,45,112))-2;
    shape.lineTo(Math.sin(angle)*radius,Math.cos(angle)*radius);
  }
  shape.closePath();
  const result=new THREE.ShapeGeometry(shape);
  result.rotateX(-Math.PI/2); result.translate(0,.04,0); return result;
}

function makeDiamond(): THREE.BufferGeometry {
  const d=BASE_OFFSET_M;
  const shape=new THREE.Shape();
  shape.moveTo(0,0); shape.lineTo(d,d); shape.lineTo(0,2*d); shape.lineTo(-d,d); shape.closePath();
  const result=new THREE.ShapeGeometry(shape);
  result.rotateX(-Math.PI/2); result.translate(0,.09,0); return result;
}

function addWarningTrack(out:number[]) {
  for(let i=0;i<32;i++){
    const a=45-90*i/32, b=45-90*(i+1)/32;
    const i0=fieldPoint(a,0), i1=fieldPoint(b,0), o0=fieldPoint(a,5.3), o1=fieldPoint(b,5.3);
    i0[1]=i1[1]=o0[1]=o1[1]=.065;
    quad(out,i0,o0,o1,i1);
  }
}

function panelHeight(t:number) {
  return THREE.MathUtils.lerp(38,45.72,t)+23.14*Math.sin(Math.PI*t);
}

function trussHeight(t:number) {
  // With the sampled midpoint this chord reaches the documented 330-foot peak.
  return THREE.MathUtils.lerp(42,45.72,t)+56.724*Math.sin(Math.PI*t);
}

function roofPoint(angle:number,t:number,yOffset=0):Point {
  const radius=5+(ROOF_SPAN_M-5)*t;
  return [Math.sin(angle)*radius,panelHeight(t)+yOffset*Math.sin(Math.PI*t),ROOF_PIVOT[2]-Math.cos(angle)*radius];
}

function makeRoofPanel(startDeg:number,endDeg:number,heightOffset:number):THREE.BufferGeometry {
  const out:number[]=[], radial=24, across=4;
  for(let i=0;i<radial;i++)for(let j=0;j<across;j++){
    const t0=i/radial,t1=(i+1)/radial;
    const a0=(startDeg+(endDeg-startDeg)*j/across)*DEG;
    const a1=(startDeg+(endDeg-startDeg)*(j+1)/across)*DEG;
    // Across then outward gives the exposed roof an upward-facing winding.
    quad(out,roofPoint(a0,t0,heightOffset),roofPoint(a1,t0,heightOffset),
      roofPoint(a1,t1,heightOffset),roofPoint(a0,t1,heightOffset));
  }
  return geometry(out);
}

function addRoofTruss(out:number[],angleDeg:number,heightOffset:number,shallow=false) {
  const angle=angleDeg*DEG, segments=12;
  const lower:Point[]=[], upper:Point[]=[];
  for(let i=0;i<=segments;i++){
    const t=i/segments,radius=5+(ROOF_SPAN_M-5)*t;
    lower.push([Math.sin(angle)*radius,panelHeight(t)+heightOffset*Math.sin(Math.PI*t)+1.4,ROOF_PIVOT[2]-Math.cos(angle)*radius]);
    upper.push([Math.sin(angle)*radius,(shallow?panelHeight(t)+3:trussHeight(t))+heightOffset*Math.sin(Math.PI*t)-.30,ROOF_PIVOT[2]-Math.cos(angle)*radius]);
  }
  for(let i=0;i<segments;i++){
    beam(out,lower[i],lower[i+1],1.05,.72); beam(out,upper[i],upper[i+1],1.16,.8);
    beam(out,i%2===0?lower[i]:upper[i],i%2===0?upper[i+1]:lower[i+1],.46,.40);
    if(i%2===0)beam(out,lower[i],upper[i],.42,.36);
  }
  beam(out,lower[segments],upper[segments],.42,.36);
}

function addClerestory(glazing:number[],structure:number[],angleDeg:number) {
  const angle=angleDeg*DEG,segments=16,start=.055;
  const top=(t:number)=>roofPoint(angle,t,-4.8);
  const bottom=(t:number):Point=>{
    const p=top(t); return[p[0],32,p[2]];
  };
  for(let i=0;i<segments;i++){
    const t0=start+(1-start)*i/segments,t1=start+(1-start)*(i+1)/segments;
    quad(glazing,bottom(t0),bottom(t1),top(t1),top(t0));
    beam(structure,top(t0),bottom(t0),.46,.40);
    for(const fraction of [.25,.5,.75]){
      const a=bottom(t0),b=bottom(t1),ta=top(t0),tb=top(t1);
      beam(structure,
        [a[0],THREE.MathUtils.lerp(a[1],ta[1],fraction),a[2]],
        [b[0],THREE.MathUtils.lerp(b[1],tb[1],fraction),b[2]],.34,.30);
    }
  }
  beam(structure,top(1),bottom(1),.46,.40);
}

function addTrack(out:number[]) {
  const segments=56;
  for(let i=0;i<segments;i++){
    const a=(-56+112*i/segments)*DEG,b=(-56+112*(i+1)/segments)*DEG;
    for(const radius of [ROOF_SPAN_M-1.15,ROOF_SPAN_M+1.15])
      beam(out,[Math.sin(a)*radius,45.72,ROOF_PIVOT[2]-Math.cos(a)*radius],
        [Math.sin(b)*radius,45.72,ROOF_PIVOT[2]-Math.cos(b)*radius],.52,.38);
  }
  for(let i=0;i<segments;i++){
    const a=(-56+112*i/segments)*DEG,b=(-56+112*(i+1)/segments)*DEG,r=ROOF_SPAN_M;
    beam(out,[Math.sin(a)*r,44.5,ROOF_PIVOT[2]-Math.cos(a)*r],
      [Math.sin(b)*r,44.5,ROOF_PIVOT[2]-Math.cos(b)*r],2.1,2.2);
  }
  for(let i=0;i<=10;i++){
    const a=(-54+108*i/10)*DEG,r=ROOF_SPAN_M;
    beam(out,[Math.sin(a)*r,0,ROOF_PIVOT[2]-Math.cos(a)*r],
      [Math.sin(a)*r,45.72,ROOF_PIVOT[2]-Math.cos(a)*r],.72,.72);
  }
}

function addFacade(out:number[]) {
  const segments=36;
  for(let i=0;i<segments;i++){
    const a=(-76+152*i/segments)*DEG,b=(-76+152*(i+1)/segments)*DEG;
    quad(out,facadePoint(a,0),facadePoint(b,0),facadePoint(b,34),facadePoint(a,34));
  }
  // Follow the mapped outfield outline instead of a straight wall through fair territory.
  for(let i=0;i<AMFAM_LOCAL_FOOTPRINT.length;i++){
    const a=AMFAM_LOCAL_FOOTPRINT[i],b=AMFAM_LOCAL_FOOTPRINT[(i+1)%AMFAM_LOCAL_FOOTPRINT.length];
    if(Math.max(a[1],b[1])>-49)continue;
    quad(out,[a[0],0,a[1]],[b[0],0,b[1]],[b[0],27,b[1]],[a[0],27,a[1]]);
  }
  // Side wings land on full-height occupied curtain-wall volumes beneath the roof.
  for(const side of [-1,1]){
    const a=roofPoint(side*55*DEG,0),b=roofPoint(side*55*DEG,1);
    quad(out,[a[0],0,a[2]],[b[0],0,b[2]],[b[0],32,b[2]],[a[0],32,a[2]]);
  }
}

function addArcade(glazing:number[],trim:number[]) {
  for(let bay=0;bay<11;bay++){
    const angle=(-62+124*bay/10)*DEG;
    const center=new THREE.Vector3(...facadePoint(angle,0,.18));
    const tangent=facadeFrame(angle).tangent;
    const point=(u:number,y:number):Point=>{
      const p=center.clone().addScaledVector(tangent,u); return[p.x,y,p.z];
    };
    const width=10.8, low=4.7, spring=20.2, radius=width/2;
    const boundary:Point[]=[point(-radius,low),point(radius,low),point(radius,spring)];
    for(let i=1;i<=8;i++){
      const a=Math.PI*i/8;
      boundary.push(point(Math.cos(a)*radius,spring+Math.sin(a)*6.2));
    }
    const middle=point(0,13.5);
    for(let i=0;i<boundary.length;i++)tri(glazing,middle,boundary[i],boundary[(i+1)%boundary.length]);
    beam(trim,point(-radius,low),point(-radius,spring),.72,.62);
    beam(trim,point(radius,low),point(radius,spring),.72,.62);
    let previous=point(radius,spring);
    for(let i=1;i<=8;i++){
      const a=Math.PI*i/8,current=point(Math.cos(a)*radius,spring+Math.sin(a)*6.2);
      beam(trim,previous,current,.72,.62); previous=current;
    }
    beam(trim,point(-radius-2.3,3.8),point(-radius-2.3,32),1.15,.95);
  }
  // Cream limestone base and cornice follow the curved brick arcade.
  for(let i=0;i<36;i++){
    const a=(-76+152*i/36)*DEG,b=(-76+152*(i+1)/36)*DEG;
    beam(trim,facadePoint(a,3.6,.5),facadePoint(b,3.6,.5),1.15,.95);
    beam(trim,facadePoint(a,32,.5),facadePoint(b,32,.5),1.25,1.05);
  }
}

function addFieldMarks(out:number[]) {
  const d=BASE_OFFSET_M;
  const points:Point[]=[[0,.16,0],[d,.16,-d],[0,.16,-2*d],[-d,.16,-d]];
  beam(out,points[0],points[1],.16,.07); beam(out,points[0],points[3],.16,.07);
  for(const p of points.slice(1))addBox(out,[p[0]-.25,.12,p[2]-.25],[p[0]+.25,.22,p[2]+.25]);
  addBox(out,[-.27,.12,-.18],[.27,.22,.18]);
}

/**
 * A metre-scale, economical interpretation of American Family Field.
 * Local home plate is (0,0,0), +Y is up, and center field lies along local -Z.
 */
export function buildAmFam(): THREE.Group {
  const root=new THREE.Group(); root.name='american-family-field';
  root.add(buildAmFamDetails());

  const concrete=new THREE.MeshLambertMaterial({color:0x928f84});
  const turf=new THREE.MeshLambertMaterial({color:0x246b3c});
  const dirt=new THREE.MeshLambertMaterial({color:0xa87345});
  const chalk=new THREE.MeshLambertMaterial({color:0xf2eee1});
  const brick=new THREE.MeshLambertMaterial({color:0x8e4935,side:THREE.DoubleSide});
  const cream=new THREE.MeshLambertMaterial({color:0xd4c5a8});
  const steel=new THREE.MeshLambertMaterial({color:0x73948e});
  const roofFixed=new THREE.MeshPhongMaterial({color:0x718f91,shininess:24,side:THREE.DoubleSide});
  const roofMoving=new THREE.MeshPhongMaterial({color:0x86a4a5,shininess:28,side:THREE.DoubleSide});
  const glass=new THREE.MeshPhongMaterial({color:0x526e73,emissive:0x000000,transparent:true,
    opacity:.82,depthWrite:false,side:THREE.DoubleSide,shininess:72});
  const screenMaterial=new THREE.MeshPhongMaterial({color:0x080d0c,emissive:0x000000,shininess:20});
  const floodMaterial=new THREE.MeshPhongMaterial({color:0xdde8dd,emissive:0x000000,emissiveIntensity:0});

  // The measured source footprint is broad and shallow in this home-plate frame.
  const foundation=new THREE.Mesh(new THREE.CylinderGeometry(1,1,.5,64),concrete);
  foundation.scale.set(151.255,1,110.03); foundation.position.set(4.685,-.25,-16.73);
  foundation.name='approximate-stadium-foundation'; root.add(foundation);

  const field=new THREE.Mesh(makeField(),turf); field.name='baseball-turf-lf344-rf345-cf400'; root.add(field);
  const warning:number[]=[]; addWarningTrack(warning);
  const warningMesh=new THREE.Mesh(geometry(warning),dirt); warningMesh.name='outfield-warning-track'; root.add(warningMesh);
  const diamond=new THREE.Mesh(makeDiamond(),dirt); diamond.name='ninety-foot-infield-diamond'; root.add(diamond);
  const infieldGrassShape=new THREE.Shape();
  infieldGrassShape.moveTo(0,5);infieldGrassShape.lineTo(BASE_OFFSET_M-4,BASE_OFFSET_M);
  infieldGrassShape.lineTo(0,2*BASE_OFFSET_M-4);infieldGrassShape.lineTo(-BASE_OFFSET_M+4,BASE_OFFSET_M);infieldGrassShape.closePath();
  const infieldGrassGeometry=new THREE.ShapeGeometry(infieldGrassShape);infieldGrassGeometry.rotateX(-Math.PI/2);infieldGrassGeometry.translate(0,.13,0);
  const infieldGrass=new THREE.Mesh(infieldGrassGeometry,turf);infieldGrass.name='infield-grass-diamond';root.add(infieldGrass);
  const mound=new THREE.Mesh(new THREE.CylinderGeometry(2.743,2.743,.22,24),dirt);
  mound.position.set(0,.23,-18.4404);mound.name='pitchers-mound';root.add(mound);
  const marks:number[]=[]; addFieldMarks(marks);
  const marksMesh=new THREE.Mesh(geometry(marks),chalk); marksMesh.name='bases-and-foul-lines'; root.add(marksMesh);

  const bowl=buildAmFamBowl();
  for(const child of [...bowl.children])root.add(child);
  const aisles:number[]=[];
  for(const angle of [-45,45]) {
    const p=fieldPoint(angle);beam(aisles,[p[0],.1,p[2]],[p[0],22,p[2]],.23);
  }

  const facadePositions:number[]=[],arcadeGlass:number[]=[],arcadeTrim:number[]=[];
  addFacade(facadePositions); addArcade(arcadeGlass,arcadeTrim);arcadeTrim.push(...aisles);
  const outfieldGlazing:number[]=[];
  for(let i=0;i<AMFAM_LOCAL_FOOTPRINT.length;i++){
    const a=AMFAM_LOCAL_FOOTPRINT[i],b=AMFAM_LOCAL_FOOTPRINT[(i+1)%AMFAM_LOCAL_FOOTPRINT.length];
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(Math.max(a[1],b[1])>-49||length<5)continue;
    let nx=-dz/length,nz=dx/length;if(nx*(a[0]+b[0])+nz*(a[1]+b[1])<0){nx=-nx;nz=-nz;}
    const at=(t:number,y:number):Point=>[a[0]+dx*t+nx*.17,y,a[1]+dz*t+nz*.17];
    const bays=Math.max(1,Math.round(length/7));
    for(let j=0;j<bays;j++){
      const t0=(j+.08)/bays,t1=(j+.92)/bays;
      quad(outfieldGlazing,at(t0,4),at(t1,4),at(t1,24.5),at(t0,24.5));
      beam(arcadeTrim,at(j/bays,1),at(j/bays,27),.6,.6);
      for(const y of [10,17,24.5])beam(arcadeTrim,at(t0,y),at(t1,y),.14,.14);
    }
    beam(arcadeTrim,at(0,27),at(1,27),.7,.65);
  }
  const outfieldWindows=new THREE.Mesh(geometry(outfieldGlazing),glass);
  outfieldWindows.name='outfield-perimeter-curtainwall';root.add(outfieldWindows);
  // Ground the two broad fixed-wing ends beneath the outfield track bearings.
  for(const angle of [-55,55]) {
    const p=roofPoint(angle*DEG,1);
    beam(arcadeTrim,[p[0],0,p[2]],[p[0],45.72,p[2]],2.3,2.3);
  }
  const concourseShape=new THREE.Shape();
  for(let i=0;i<=36;i++) {
    const p=facadePoint((-76+152*i/36)*DEG,32.2);
    if(i)concourseShape.lineTo(p[0],-p[2]);else concourseShape.moveTo(p[0],-p[2]);
  }
  const rightRoof=roofPoint(55*DEG,1),leftRoof=roofPoint(-55*DEG,1);
  concourseShape.lineTo(rightRoof[0],-rightRoof[2]);concourseShape.lineTo(0,-55);
  concourseShape.lineTo(leftRoof[0],-leftRoof[2]);concourseShape.closePath();
  const concourseGeometry=new THREE.ShapeGeometry(concourseShape);concourseGeometry.rotateX(-Math.PI/2);concourseGeometry.translate(0,32.2,0);
  const concourseRoof=new THREE.Mesh(concourseGeometry,new THREE.MeshLambertMaterial({color:0x495953,side:THREE.DoubleSide}));
  concourseRoof.name='continuous-public-concourse-roof';root.add(concourseRoof);
  const facade=new THREE.Mesh(geometry(facadePositions),brick); facade.name='warm-brick-exterior-arcade'; root.add(facade);
  const windows=new THREE.Mesh(geometry(arcadeGlass),glass); windows.name='eleven-large-arched-glazed-bays'; windows.renderOrder=2; root.add(windows);
  const trim=new THREE.Mesh(geometry(arcadeTrim),cream); trim.name='cream-cornices-and-buttress-piers'; root.add(trim);

  const hub=new THREE.Mesh(new THREE.CylinderGeometry(5.3,5.3,2.2,16),steel);
  hub.position.set(0,37,55);hub.name='roof-central-bearing-cap';root.add(hub);
  const panelInfo:RoofPanelInfo[]=[
    {name:'roof-panel-1-fixed-left',kind:'fixed',stackSide:null,moved:false,angleStartDeg:-55,angleEndDeg:-31,stackOffsetM:-4.8},
    {name:'roof-panel-2-movable-left',kind:'movable',stackSide:'left',moved:true,angleStartDeg:-54,angleEndDeg:-41.6,stackOffsetM:-3.2},
    {name:'roof-panel-3-movable-left',kind:'movable',stackSide:'left',moved:true,angleStartDeg:-51.5,angleEndDeg:-39.1,stackOffsetM:-1.6},
    {name:'roof-panel-4-movable-left',kind:'movable',stackSide:'left',moved:true,angleStartDeg:-49,angleEndDeg:-36.6,stackOffsetM:0},
    {name:'roof-panel-5-movable-right',kind:'movable',stackSide:'right',moved:true,angleStartDeg:36.6,angleEndDeg:49,stackOffsetM:-1.6},
    {name:'roof-panel-6-movable-right',kind:'movable',stackSide:'right',moved:true,angleStartDeg:39.1,angleEndDeg:51.5,stackOffsetM:0},
    {name:'roof-panel-7-fixed-right',kind:'fixed',stackSide:null,moved:false,angleStartDeg:31,angleEndDeg:55,stackOffsetM:-4.8},
  ];
  panelInfo.forEach(info=>{
    const panel=new THREE.Mesh(makeRoofPanel(info.angleStartDeg,info.angleEndDeg,info.stackOffsetM),info.kind==='fixed'?roofFixed:roofMoving);
    panel.name=info.name; panel.userData.roofPanel={...info}; panel.castShadow=true; root.add(panel);
  });

  const trusses:number[]=[],clerestoryGlass:number[]=[];
  for(const panel of panelInfo){
    if(panel.kind==='fixed') {
      addRoofTruss(trusses,panel.angleStartDeg,panel.stackOffsetM,panel.angleStartDeg===-55);
      addRoofTruss(trusses,panel.angleEndDeg,panel.stackOffsetM,panel.angleEndDeg===55);
    } else addRoofTruss(trusses,panel.stackSide==='left'?panel.angleEndDeg:panel.angleStartDeg,panel.stackOffsetM);
  }
  addClerestory(clerestoryGlass,trusses,-55); addClerestory(clerestoryGlass,trusses,55);
  const trussMesh=new THREE.Mesh(geometry(trusses),steel);
  trussMesh.name='radial-curved-steel-trusses-with-triangulated-webs'; trussMesh.castShadow=true; root.add(trussMesh);
  const clerestory=new THREE.Mesh(geometry(clerestoryGlass),glass);
  clerestory.name='curved-outer-roof-clerestory-glazing'; clerestory.renderOrder=2; root.add(clerestory);
  const trackPositions:number[]=[]; addTrack(trackPositions);
  const track=new THREE.Mesh(geometry(trackPositions),steel); track.name='semicircular-outfield-retractable-roof-track'; root.add(track);

  // Geometry changes only on a user-selected roof state. Panels move angularly
  // about the same bearing behind home plate; the fixed wings never translate.
  const openPanels=panelInfo.map(p=>({...p}));
  const setRoofOpenness=(openness:number)=>{
    const open=THREE.MathUtils.clamp(Number.isFinite(openness)?openness:1,0,1);
    const framing:number[]=[];
    panelInfo.forEach((info,index)=>{
      if(info.kind==='movable') {
        const start=-31+(index-1)*12.4;
        info.angleStartDeg=THREE.MathUtils.lerp(start,openPanels[index].angleStartDeg,open);
        info.angleEndDeg=info.angleStartDeg+12.4;
        info.stackOffsetM=openPanels[index].stackOffsetM;
        info.moved=open>0;
        const mesh=root.getObjectByName(info.name) as THREE.Mesh;
        mesh.geometry.dispose();mesh.geometry=makeRoofPanel(info.angleStartDeg,info.angleEndDeg,info.stackOffsetM);
        mesh.userData.roofPanel={...info};
      }
      if(info.kind==='fixed') {
        addRoofTruss(framing,info.angleStartDeg,info.stackOffsetM,info.angleStartDeg===-55);
        addRoofTruss(framing,info.angleEndDeg,info.stackOffsetM,info.angleEndDeg===55);
      } else addRoofTruss(framing,info.stackSide==='left'?info.angleEndDeg:info.angleStartDeg,info.stackOffsetM);
    });
    addClerestory([],framing,-55);addClerestory([],framing,55);
    trussMesh.geometry.dispose();trussMesh.geometry=geometry(framing);
    root.userData.roofPanels=panelInfo.map(p=>({...p}));root.userData.roofOpenness=open;
    root.userData.roofState=open===0?'closed':open===1?'open':'partly open';
  };

  const scoreboard=new THREE.Mesh(new THREE.BoxGeometry(38,18,2.1),screenMaterial);
  scoreboard.position.set(0,29,-124); scoreboard.name='large-black-center-field-scoreboard'; root.add(scoreboard);
  const supports:number[]=[];
  beam(supports,[-15,0,-124],[ -15,20,-124],1.2,1.2); beam(supports,[15,0,-124],[15,20,-124],1.2,1.2);
  const supportsMesh=new THREE.Mesh(geometry(supports),steel); supportsMesh.name='scoreboard-steel-supports'; root.add(supportsMesh);

  const floodPositions:number[]=[];
  for(const side of [-1,1])for(let i=0;i<6;i++){
    const x=side*(47+i*9),z=18-i*13;
    addBox(floodPositions,[x-2.8,45,z-.35],[x+2.8,46.7,z+.35]);
  }
  const floodlights=new THREE.Mesh(geometry(floodPositions),floodMaterial);
  floodlights.name='stadium-floodlight-arrays'; root.add(floodlights);

  root.userData={
    homePlate:[...HOME_PLATE], centerField:[...CENTER_FIELD], centerFieldDistanceM:CENTER_FIELD_M,
    basePathM:BASE_PATH_M, bases:Object.fromEntries(Object.entries(BASES).map(([name,p])=>[name,[...p]])),
    roofPivot:[...ROOF_PIVOT], roofPanels:panelInfo.map(panel=>({...panel})),
    setRoofOpenness,roofOpenness:1,roofState:'open',
    roofSpan:ROOF_SPAN_M, roofPeak:ROOF_PEAK_M, interiorArchHeightM:65,
    entranceSign:{position:[4.685,38,94],widthM:34,facing:'+Z'},
    localBounds:{min:[...AMFAM_LOCAL_BOUNDS.min],max:[...AMFAM_LOCAL_BOUNDS.max]},
    setLightingMode(mode:AmFamLightingMode){
      // Approximate the broad field wash from the stadium floodlights without adding shadow maps.
      turf.emissive.setHex(0x32683c); turf.emissiveIntensity=mode==='night'?.75:mode==='sunset'?.2:0;
      bowl.userData.setLightingMode?.(mode);
      glass.emissive.setHex(mode==='night'?0x345b65:mode==='sunset'?0x482a18:0x000000);
      glass.emissiveIntensity=mode==='night'?.9:mode==='sunset'?.45:0;
      screenMaterial.emissive.setHex(mode==='night'?0x17382d:mode==='sunset'?0x161a13:0x000000);
      screenMaterial.emissiveIntensity=mode==='day'?0:.8;
      floodMaterial.emissive.setHex(mode==='night'?0xe5f3df:mode==='sunset'?0xb48a58:0x000000);
      floodMaterial.emissiveIntensity=mode==='night'?3.2:mode==='sunset'?.7:0;
    },
  };
  root.traverse(object=>{
    if(object instanceof THREE.Mesh){
      const opaque=Array.isArray(object.material)?object.material.every(material=>!material.transparent):!object.material.transparent;
      object.castShadow=object.castShadow||opaque; object.receiveShadow=true;
    }
  });
  return root;
}
