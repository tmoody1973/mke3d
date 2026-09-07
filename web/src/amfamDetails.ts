import * as THREE from 'three';
import { facadeFrame as mappedFacadeFrame } from './amfamFacade.ts';

type Point = [number, number, number];
type Frame = { origin: THREE.Vector3; tangent: THREE.Vector3; normal: THREE.Vector3 };
const DEG=Math.PI/180;

function tri(out:number[],a:Point,b:Point,c:Point){out.push(...a,...b,...c);}
function quad(out:number[],a:Point,b:Point,c:Point,d:Point){tri(out,a,b,d);tri(out,b,c,d);}
function at(frame:Frame,u:number,y:number,offset=0):Point{
  const p=frame.origin.clone().addScaledVector(frame.tangent,u).addScaledVector(frame.normal,offset);
  return [p.x,y,p.z];
}
function facadeFrame(angleDeg:number):Frame{
  return mappedFacadeFrame(angleDeg*DEG);
}
function box(out:number[],frame:Frame,u0:number,u1:number,y0:number,y1:number,d0:number,d1:number){
  const p=[at(frame,u0,y0,d0),at(frame,u1,y0,d0),at(frame,u1,y1,d0),at(frame,u0,y1,d0),
    at(frame,u0,y0,d1),at(frame,u1,y0,d1),at(frame,u1,y1,d1),at(frame,u0,y1,d1)];
  quad(out,p[0],p[3],p[2],p[1]);quad(out,p[4],p[5],p[6],p[7]);
  quad(out,p[0],p[1],p[5],p[4]);quad(out,p[1],p[2],p[6],p[5]);
  quad(out,p[2],p[3],p[7],p[6]);quad(out,p[3],p[0],p[4],p[7]);
}
function beam(out:number[],aa:Point,bb:Point,width:number,depth=width){
  const a=new THREE.Vector3(...aa), b=new THREE.Vector3(...bb),delta=b.clone().sub(a);
  if(delta.lengthSq()<1e-9)return;
  const geometry=new THREE.BoxGeometry(width,delta.length(),depth);
  geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
  geometry.translate(...a.add(b).multiplyScalar(.5).toArray());
  const p=geometry.getAttribute('position'),index=geometry.index!;
  for(let i=0;i<index.count;i++){const j=index.getX(i);out.push(p.getX(j),p.getY(j),p.getZ(j));}
  geometry.dispose();
}
function rectangle(out:number[],f:Frame,u0:number,u1:number,y0:number,y1:number,depth:number){
  // The tangent / up ordering faces outward from the stadium wall.
  quad(out,at(f,u0,y0,depth),at(f,u1,y0,depth),at(f,u1,y1,depth),at(f,u0,y1,depth));
}

/**
 * Photo-estimated exterior details from aff_05, aff_06 and aff_07. Metres;
 * home plate at origin, center field toward -Z, matching buildAmFam().
 * No reference pixels, historic Miller signage, or additional light sources.
 */
export function buildAmFamDetails():THREE.Group{
  const root=new THREE.Group();root.name='american-family-field-exterior-details';
  const brick:number[]=[],stone:number[]=[],steel:number[]=[],glass:number[]=[];

  const addWindowGrid=(f:Frame,width:number,low:number,top:number,arched:boolean)=>{
    const half=width/2,depth=.53;
    for(let column=-3;column<=3;column++){
      const u=column*width/8;
      const upper=arched?20.2+6.2*Math.sqrt(Math.max(0,1-(u/5.4)**2)):top;
      beam(steel,at(f,u,low,depth),at(f,u,upper,depth),column%2===0?.13:.085);
    }
    for(let y=low+1.55;y<top-.1;y+=1.55){
      const w=arched&&y>20.2?5.4*Math.sqrt(Math.max(0,1-((y-20.2)/6.2)**2)):half;
      beam(steel,at(f,-w,y,depth),at(f,w,y,depth),.075);
    }
    for(const y of [11.2,19.2])box(steel,f,-half,half,y-.24,y+.24,.39,.66);
    // Open steel diagonal bracing is visible behind the lower panes in photo 06.
    for(const side of [-1,1]){
      beam(steel,at(f,side*half*.87,5.3,.42),at(f,0,10.7,.42),.065);
      beam(steel,at(f,side*half*.87,11.8,.42),at(f,0,18.5,.42),.065);
    }
  };
  const addDoorBank=(f:Frame,width:number)=>{
    rectangle(glass,f,-width/2,width/2,.08,3.3,.47);
    for(let column=0;column<=6;column++){
      const u=-width/2+width*column/6;
      beam(steel,at(f,u,.08,.61),at(f,u,3.3,.61),.105);
      if(column<6)beam(stone,at(f,u+.25,1.16,.65),at(f,u+width/6-.25,1.16,.65),.055);
    }
    beam(steel,at(f,-width/2,2.4,.62),at(f,width/2,2.4,.62),.095);
    // Slim cantilever canopy and diagonal suspension rods, not a thick solid awning.
    box(steel,f,-width/2-.45,width/2+.45,3.67,3.83,.42,2.7);
    for(const u of [-width*.38,width*.38]){
      beam(steel,at(f,u,3.79,2.7),at(f,u,6.0,.48),.065);
      beam(steel,at(f,u,3.67,.42),at(f,u,3.67,2.7),.12);
    }
  };

  for(let bay=0;bay<11;bay++){
    const frame=facadeFrame(-62+124*bay/10);
    addWindowGrid(frame,10.8,4.7,26.4,true);addDoorBank(frame,8.2);
    // Narrow nested brick arch courses sit outside the existing broad reveal.
    for(const expand of [.58,.9]){
      let previous=at(frame,5.4+expand,20.2,.59);
      for(let i=1;i<=20;i++){
        const a=Math.PI*i/20,current=at(frame,Math.cos(a)*(5.4+expand),20.2+Math.sin(a)*(6.2+expand),.59);
        beam(brick,previous,current,.18);previous=current;
      }
    }
    for(const side of [-1,1]){
      box(brick,frame,side*6.3-.16,side*6.3+.16,4.7,20.2,.36,.64);
      // Pale masonry inserts and green square accents in the brick piers.
      for(const y of [7.0,13.1,19.2,25.3])box(stone,frame,side*7.5-.31,side*7.5+.31,y,y+.28,.4,.62);
      box(steel,frame,side*7.5-.4,side*7.5+.4,29.0,29.8,.32,.47);
    }
  }

  // Photo 07 shows tall rectangular side windows between the brick piers.
  // Their locations follow the existing straight side-wall segments, not a new footprint.
  for(const side of [-1,1]){
    const front=new THREE.Vector3(side*Math.sin(55*DEG)*5,0,55-Math.cos(55*DEG)*5),back=new THREE.Vector3(side*Math.sin(55*DEG)*182.88,0,55-Math.cos(55*DEG)*182.88);
    const along=back.clone().sub(front),length=along.length();along.normalize();
    const outward=new THREE.Vector3(-along.z,0,along.x).multiplyScalar(side).normalize();
    for(let bay=0;bay<12;bay++){
      const origin=front.clone().addScaledVector(along,length*(bay+.55)/12.5);
      const f={origin,tangent:along.clone().multiplyScalar(side),normal:outward};
      // Reorient tangent so tangent × up gives the outward side of the wall.
      f.tangent.set(outward.z,0,-outward.x);
      rectangle(glass,f,-5.1,5.1,4.7,29.8,.32);
      addWindowGrid(f,10.2,4.7,29.8,false);
      for(const u of [-5.5,5.5])box(brick,f,u-.28,u+.28,4.0,31.8,.18,.59);
      if(bay===1||bay===4)addDoorBank(f,8.0);
    }
  }

  // A single slender brick entry tower appears at the end of the curved arcade
  // in photo 05. Its exact footprint and height are photo estimates, not a survey.
  const tower=facadeFrame(-70);
  box(brick,tower,-4.7,4.7,0,47.2,-4.3,5.1);
  for(const y of [4,32,42.5,47.2])box(stone,tower,-5.1,5.1,y,y+.65,-4.7,5.5);
  rectangle(glass,tower,-1.5,1.5,6.2,40.8,5.14);
  for(const y of [8,12,16,20,24,28,32,36,40])beam(steel,at(tower,-1.5,y,5.18),at(tower,1.5,y,5.18),.08);
  beam(steel,at(tower,0,6.2,5.18),at(tower,0,40.8,5.18),.12);
  // Glazed lantern band and broad, flat metal canopy crown (no obsolete logo).
  box(glass,tower,-4.25,4.25,47.85,49.8,-3.85,4.65);
  box(steel,tower,-5.7,5.7,49.8,50.1,-5.3,6.1);
  for(const u of [-4,-2,0,2,4])beam(stone,at(tower,u,47.85,4.7),at(tower,u,49.8,4.7),.13);

  // The roof hinge service frame and stair flights are visible in photo 06.
  // Keep this structure below the established 38 m pivot; roof mechanics above
  // that datum belong to the roof assembly. It is independently grounded at Y=0.
  const pivot:Frame={origin:new THREE.Vector3(0,0,55),tangent:new THREE.Vector3(1,0,0),normal:new THREE.Vector3(0,0,1)};
  for(const x of [-3.2,3.2])for(const z of [-2.6,2.6])box(steel,pivot,x-.24,x+.24,0,38,z-.24,z+.24);
  for(let level=0;level<5;level++){
    const y=level*7.5,next=y+7.5;
    for(const z of [-2.6,2.6]){
      beam(steel,at(pivot,-3.2,y,z),at(pivot,3.2,next,z),.18);
      beam(steel,at(pivot,3.2,y,z),at(pivot,-3.2,next,z),.18);
    }
    box(steel,pivot,-4.3,4.3,next-.22,next,-3.6,3.6);
    for(const z of [-3.5,3.5]){
      beam(steel,at(pivot,-4.2,next+.85,z),at(pivot,4.2,next+.85,z),.06);
      for(const x of [-4.2,0,4.2])beam(steel,at(pivot,x,next,z),at(pivot,x,next+.85,z),.06);
    }
    // A narrow switchback run beside the service frame, with discrete treads.
    for(let step=0;step<24;step++){
      const t=(step+.5)/24, u=(level%2===0?-3.4:3.4)+(level%2===0?6.8:-6.8)*t;
      box(steel,pivot,u-.17,u+.17,y+7.5*t-.05,y+7.5*t+.05,3.9,5.1);
    }
    for(const z of [3.9,5.1])beam(steel,at(pivot,level%2===0?-3.4:3.4,y+.8,z),at(pivot,level%2===0?3.4:-3.4,next+.8,z),.07);
  }

  const materials=[
    new THREE.MeshStandardMaterial({color:0x98543e,roughness:.94}),
    new THREE.MeshStandardMaterial({color:0xc8bda7,roughness:.87}),
    new THREE.MeshStandardMaterial({color:0x405956,roughness:.62,metalness:.25}),
    new THREE.MeshStandardMaterial({color:0x263e43,roughness:.32,metalness:.18}),
  ];
  const names=['amfam-brick-reveal-courses-and-entry-tower','amfam-entry-limestone-and-hardware',
    'amfam-fine-mullions-canopies-and-pivot-frame','amfam-side-curtainwalls-and-entry-glazing'];
  [brick,stone,steel,glass].forEach((positions,index)=>{
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,materials[index]);mesh.name=names[index];mesh.castShadow=index!==3;mesh.receiveShadow=true;root.add(mesh);
  });
  root.userData={photoReferences:['aff_05','aff_06','aff_07'],entryTowerAngleDeg:-70,entryTowerHeightM:50.1,
    pivot:[0,38,55],measured:false,detailDrawCalls:4};
  return root;
}
