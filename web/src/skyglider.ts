import * as THREE from 'three';
import { districtGeometry } from './districtGeometry.ts';

/** OSM way 597941283 terminal centres. Dimensions are photo-based estimates. */
export const SKYGLIDER = {
 north: { x: 489.2245, z: 96.9402 }, south: { x: 512.6829, z: 578.8770 },
 chairCount: 94, seatsPerChair: 2, laneSeparation: 3.5,
 cableHeight: 11, terminalCableHeight: 4.05, seatDrop: 3.4, speed: 1.35,
} as const;
export const SKYGLIDER_ROUTE = [SKYGLIDER.north,{x:491.5679,z:159.7020},{x:490.3718,z:267.6665},{x:493.9764,z:304.4102},SKYGLIDER.south] as const;
export function distanceToSkygliderRoute(x:number,z:number){
 let best=Infinity;
 for(let i=1;i<SKYGLIDER_ROUTE.length;i++){const a=SKYGLIDER_ROUTE[i-1],b=SKYGLIDER_ROUTE[i],dx=b.x-a.x,dz=b.z-a.z,t=THREE.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);best=Math.min(best,Math.hypot(x-a.x-t*dx,z-a.z-t*dz));}
 return best;
}
export interface SkygliderSample { x: number; y: number; z: number; yaw: number; }
type Ground = (x: number, z: number) => number;
const TAU = Math.PI * 2;
const mod = (n: number, d: number) => ((n % d) + d) % d;

export function createSkygliderRoute(groundAt: Ground) {
 const nodes=SKYGLIDER_ROUTE.map(p=>new THREE.Vector3(p.x,0,p.z));
 // Preserve the mapped walkway alignment; short fillets prevent abrupt yaw
 // changes at digitized vertices without cutting across concessions.
 const path=new THREE.CurvePath<THREE.Vector3>();let start=nodes[0];
 for(let i=1;i<nodes.length-1;i++){
  const vertex=nodes[i],before=vertex.clone().addScaledVector(nodes[i-1].clone().sub(vertex).normalize(),4),after=vertex.clone().addScaledVector(nodes[i+1].clone().sub(vertex).normalize(),4);
  path.add(new THREE.LineCurve3(start,before));path.add(new THREE.QuadraticBezierCurve3(before,vertex,after));start=after;
 }
 path.add(new THREE.LineCurve3(start,nodes.at(-1)!));
 const length=path.getLength(),r=SKYGLIDER.laneSeparation/2,planLength=2*length+TAU*r;
 const centerCount=4096,center=new Float64Array((centerCount+1)*2);
 for(let i=0;i<=centerCount;i++){const p=path.getPointAt(i/centerCount);center[i*2]=p.x;center[i*2+1]=p.z;}
 function world(side:number,along:number,out={x:0,z:0,yaw:0}){
  const f=THREE.MathUtils.clamp(along/length,0,1)*centerCount,i=Math.min(centerCount-1,Math.floor(f)),t=f-i;
  const dx=center[(i+1)*2]-center[i*2],dz=center[(i+1)*2+1]-center[i*2+1];
  const prev=Math.max(0,i-1),next=Math.min(centerCount,i+2);
  const tx=THREE.MathUtils.lerp(center[(i+1)*2]-center[prev*2],center[next*2]-center[i*2],t),tz=THREE.MathUtils.lerp(center[(i+1)*2+1]-center[prev*2+1],center[next*2+1]-center[i*2+1],t),d=Math.hypot(tx,tz),ux=tx/d,uz=tz/d;
  const extension=along<0?along:along>length?along-length:0;
  out.x=center[i*2]+dx*t+uz*side+ux*extension;out.z=center[i*2+1]+dz*t-ux*side+uz*extension;out.yaw=Math.atan2(ux,uz);return out;
 }
 // Tower count and exact support positions are interpreted from photographs.
 const supports=[0,.034,.13,.23,.33,.43,.53,.63,.73,.83,.966,1].map(t=>{
  const p=world(0,t*length);return {along:t*length,x:p.x,z:p.z,ground:groundAt(p.x,p.z),y:groundAt(p.x,p.z)+(t===0||t===1?SKYGLIDER.terminalCableHeight:t<.05||t>.95?7.2:SKYGLIDER.cableHeight)};
 });
 function cableY(along:number){
  if(along<=0)return supports[0].y;if(along>=length)return supports.at(-1)!.y;
  let i=1;while(supports[i].along<along)i++;
  const a=supports[i-1],b=supports[i],t=(along-a.along)/(b.along-a.along);
  return THREE.MathUtils.lerp(a.y,b.y,t*t*(3-2*t))-.3*Math.sin(Math.PI*t)**2;
 }
 const routePoint={x:0,z:0,yaw:0};
 function raw(s:number,out:SkygliderSample){
  s=mod(s,planLength);let side:number,along:number,vx:number,vz:number;
  if(s<length){side=r;along=s;vx=0;vz=1;}
  else if(s<length+Math.PI*r){const a=(s-length)/r;side=r*Math.cos(a);along=length+r*Math.sin(a);vx=-Math.sin(a);vz=Math.cos(a);}
  else if(s<2*length+Math.PI*r){side=-r;along=length-(s-length-Math.PI*r);vx=0;vz=-1;}
  else {const a=(s-2*length-Math.PI*r)/r;side=-r*Math.cos(a);along=-r*Math.sin(a);vx=Math.sin(a);vz=-Math.cos(a);}
  const p=world(side,along,routePoint);out.x=p.x;out.z=p.z;
  out.y=cableY(along);out.yaw=p.yaw+Math.atan2(vx,vz);return out;
 }
 // Arc-length remapping makes speed constant on slopes as well as station turns.
 const count=16384,distances=new Float64Array(count+1),previous={x:0,y:0,z:0,yaw:0},next={...previous};raw(0,previous);
 for(let i=1;i<=count;i++){raw(planLength*i/count,next);distances[i]=distances[i-1]+Math.hypot(next.x-previous.x,next.y-previous.y,next.z-previous.z);Object.assign(previous,next);}
 const totalLength=distances[count];
 function sample(distance:number,out:SkygliderSample={x:0,y:0,z:0,yaw:0}){
  const s=mod(distance,totalLength);let lo=0,hi=count;
  while(hi-lo>1){const mid=(lo+hi)>>1;if(distances[mid]<=s)lo=mid;else hi=mid;}
  return raw(planLength*(lo+(s-distances[lo])/(distances[hi]-distances[lo]))/count,out);
 }
 return {length,totalLength,supports,world,cableY,sample};
}

export function buildSkyglider(groundAt: Ground): THREE.Group {
 const root=new THREE.Group();root.name='summerfest-skyglider';
 const route=createSkygliderRoute(groundAt),b=districtGeometry(root);
 const mat=(color:number)=>new THREE.MeshStandardMaterial({color,roughness:.64,metalness:.16});
 const red=mat(0xd01d39),black=mat(0x20272b),white=mat(0xebe9dd),concrete=mat(0xb6b1a5);
 const light=new THREE.MeshStandardMaterial({color:0xffe8be,emissive:0xffcc87,emissiveIntensity:0});
 function localBox(side:number,y:number,along:number,w:number,h:number,d:number,m:THREE.Material,name:string){const p=route.world(side,along),g=new THREE.BoxGeometry(w,h,d);g.rotateY(p.yaw);g.translate(p.x,y,p.z);b.add(g,m,name);}
 function crossBeam(sideA:number,sideB:number,y:number,along:number,w:number,m:THREE.Material){const a=route.world(sideA,along),c=route.world(sideB,along);b.beam(new THREE.Vector3(a.x,y,a.z),new THREE.Vector3(c.x,y,c.z),w,m,'skyglider-structure');}
 for(const s of route.supports.slice(1,-1)){
  b.cylinder(s.x,s.ground+.08,s.z,.48,.16,concrete,'skyglider-grounded-footings');
  b.cylinder(s.x,(s.ground+s.y-.45)/2,s.z,.24,s.y-.45-s.ground,red,'skyglider-red-towers');
  localBox(0,s.y-.48,s.along,4.55,.26,.32,red,'skyglider-red-towers');
  for(const side of [-1.75,1.75])for(const offset of [-.35,.35]){
   const p=route.world(side,s.along+offset),wheel=new THREE.TorusGeometry(.23,.055,5,12);wheel.rotateY(Math.PI/2+p.yaw);wheel.translate(p.x,s.y-.23,p.z);b.add(wheel,black,'skyglider-cables-and-sheaves');
  }
 }
 // Continuous cable loop uses precisely the same sampled attachment path as chairs.
 const point={x:0,y:0,z:0,yaw:0},a=new THREE.Vector3(),c=new THREE.Vector3();route.sample(0,point);a.set(point.x,point.y,point.z);
 for(let i=1;i<=1200;i++){route.sample(route.totalLength*i/1200,point);c.set(point.x,point.y,point.z);b.beam(a,c,.045,black,'skyglider-cables-and-sheaves');a.copy(c);}
 const wheels:THREE.Group[]=[];
 for(const along of [0,route.length]){
  const p=route.world(0,along),floor=groundAt(p.x,p.z),y=route.cableY(along);
  localBox(0,floor+.06,along,8,.12,11,concrete,'skyglider-grounded-boarding-platforms');
  b.cylinder(p.x,floor+(y-floor-.3)/2,p.z,.34,y-floor-.3,red,'skyglider-red-towers');
  const cone=new THREE.CylinderGeometry(1.1,.34,.8,10);cone.translate(p.x,y-.75,p.z);b.add(cone,red,'skyglider-red-towers');
  const wheel=new THREE.Group();wheel.name=along===0?'skyglider-north-return-wheel':'skyglider-south-return-wheel';wheel.position.set(p.x,y,p.z);root.add(wheel);wheels.push(wheel);
  const wb=districtGeometry(wheel),rim=new THREE.TorusGeometry(SKYGLIDER.laneSeparation/2,.11,6,48);rim.rotateX(Math.PI/2);wb.add(rim,black,'return-wheel-rim');
  for(let k=0;k<8;k++){const t=k*TAU/8;wb.beam(new THREE.Vector3(),new THREE.Vector3(Math.cos(t)*1.67,0,Math.sin(t)*1.67),.13,red,'return-wheel-spokes');}wb.cylinder(0,0,0,.36,.27,red,'return-wheel-spokes');wb.finish();
  // Open queue/boarding fences leave the two moving-chair lanes unobstructed.
  for(const side of [-3.8,3.8]){
   for(let d=-5;d<=5;d+=.45){const q=route.world(side,along+d);b.cylinder(q.x,floor+.61,q.z,.035,1.1,white,'skyglider-white-station-fences',5);}
   for(const h of [.18,1.16])localBox(side,floor+h,along,.08,.1,10,white,'skyglider-white-station-fences');
  }
  for(const side of [-.55,.55])localBox(side,floor+.07,along,.075,.02,8,white,'skyglider-white-station-fences');
  crossBeam(-1,1,y+.8,along,.08,red);
  // Exposed downlight: its upper face sits below the red beam's underside.
  localBox(0,y+.715,along,2,.045,.09,light,'skyglider-terminal-light-strips');
 }
 b.finish();
 // Subtle additive pools keep boarding platforms readable without extra lights.
 // Black perimeter vertices fade to zero contribution under additive blending.
 const poolPositions:number[]=[],poolColors:number[]=[];
 for(const along of [0,route.length]){
  const center=route.world(0,along),floor=groundAt(center.x,center.z)+.135;
  for(let i=0;i<32;i++){
   poolPositions.push(center.x,floor,center.z);poolColors.push(.72,.72,.72);
   for(const angle of [i*TAU/32,(i+1)*TAU/32]){const p=route.world(Math.cos(angle)*3.65,along+Math.sin(angle)*4.8);poolPositions.push(p.x,floor,p.z);poolColors.push(0,0,0);}
  }
 }
 const poolGeometry=new THREE.BufferGeometry();poolGeometry.setAttribute('position',new THREE.Float32BufferAttribute(poolPositions,3));poolGeometry.setAttribute('color',new THREE.Float32BufferAttribute(poolColors,3));poolGeometry.computeVertexNormals();
 const poolMaterial=new THREE.MeshBasicMaterial({color:0xffd49b,vertexColors:true,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
 const pools=new THREE.Mesh(poolGeometry,poolMaterial);pools.name='skyglider-boarding-light-pools';pools.visible=false;root.add(pools);
 // Three shared chair batches: colored shell/canopy, white seat, black hanger/frame.
 const chairTemplate=new THREE.Group(),cb=districtGeometry(chairTemplate),shell=mat(0xffffff);
 cb.box(0,-3.42,0,1.36,.14,.67,shell,'chair-shells');cb.box(0,-3.14,-.29,1.36,.52,.13,shell,'chair-shells');
 for(const x of [-.64,.64])cb.box(x,-3.14,0,.1,.48,.64,shell,'chair-shells');
 const canopy=new THREE.SphereGeometry(1,16,6,0,TAU,0,Math.PI/2);canopy.scale(.82,.25,.53);canopy.translate(0,-1.86,0);cb.add(canopy,shell,'chair-shells');
 cb.box(0,-3.325,.025,1.15,.07,.52,white,'chair-white-benches');cb.box(0,-3.085,-.21,1.15,.43,.045,white,'chair-white-benches');
 const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(0,-.6,-.08),new THREE.Vector3(0,-1.05,-.2),new THREE.Vector3(0,-1.63,.08),new THREE.Vector3(0,-1.85,0)]);
 cb.add(new THREE.TubeGeometry(curve,16,.037,6,false),black,'chair-open-frames-and-hangers');
 cb.box(0,-.015,0,.15,.07,.3,black,'chair-open-frames-and-hangers');
 for(const x of [-.63,.63]){
  cb.beam(new THREE.Vector3(x,-1.88,-.27),new THREE.Vector3(x,-3.35,-.25),.043,black,'chair-open-frames-and-hangers');
  cb.beam(new THREE.Vector3(x,-1.88,.24),new THREE.Vector3(x,-2.78,.34),.036,black,'chair-open-frames-and-hangers');
  cb.beam(new THREE.Vector3(x,-2.78,.34),new THREE.Vector3(x,-3.23,.2),.035,black,'chair-open-frames-and-hangers');
 }
 cb.beam(new THREE.Vector3(-.63,-2.79,.34),new THREE.Vector3(.63,-2.79,.34),.04,black,'chair-open-frames-and-hangers');
 cb.finish();
 const chairs:THREE.InstancedMesh[]=[];const colors=[0x068bd0,0xe12b39,0xf6cc17,0x16946a];
 for(const child of chairTemplate.children){const source=child as THREE.Mesh;const mesh=new THREE.InstancedMesh(source.geometry,source.material,SKYGLIDER.chairCount);mesh.name=`skyglider-${source.name}`;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=true;mesh.receiveShadow=true;
  if(source.material===shell)for(let i=0;i<SKYGLIDER.chairCount;i++)mesh.setColorAt(i,new THREE.Color(colors[i%4]));
  root.add(mesh);chairs.push(mesh);
 }
 const object=new THREE.Object3D();let travel=0,disposed=false;
 const stats={chairs:SKYGLIDER.chairCount,seatsPerChair:2,towers:route.supports.length-2,terminals:2,routeLength:route.length,loopLength:route.totalLength,travel:0,elapsedDistance:0,chairSpacing:route.totalLength/SKYGLIDER.chairCount,disposed:false};
 function place(){
  for(let i=0;i<SKYGLIDER.chairCount;i++){route.sample(travel+i*route.totalLength/SKYGLIDER.chairCount,point);object.position.set(point.x,point.y,point.z);object.rotation.set(0,point.yaw,0);object.updateMatrix();for(const mesh of chairs)mesh.setMatrixAt(i,object.matrix);}
  for(const mesh of chairs)mesh.instanceMatrix.needsUpdate=true;
  for(const wheel of wheels)wheel.rotation.y=-travel/(SKYGLIDER.laneSeparation/2);
 }
 place();
 // All moving batches keep conservative route-wide bounds rather than stale first-frame bounds.
 const bounds=new THREE.Box3(new THREE.Vector3(SKYGLIDER.north.x-6,Math.min(...route.supports.map(s=>s.ground))-1,SKYGLIDER.north.z-6),new THREE.Vector3(SKYGLIDER.south.x+6,Math.max(...route.supports.map(s=>s.y))+2,SKYGLIDER.south.z+6));
 for(const mesh of chairs){mesh.boundingBox=bounds.clone();mesh.boundingSphere=bounds.getBoundingSphere(new THREE.Sphere());}
 root.userData.route=route;root.userData.stats=stats;
 root.userData.getChairPose=(index:number)=>route.sample(travel+mod(Math.floor(index),SKYGLIDER.chairCount)*stats.chairSpacing);
 root.userData.update=(dt:number,reducedMotion=false)=>{if(disposed||reducedMotion||!Number.isFinite(dt)||dt<=0)return;travel=mod(travel+Math.min(dt,1)*SKYGLIDER.speed,route.totalLength);stats.travel=travel;stats.elapsedDistance=travel;place();};
 root.userData.setLightingMode=(mode:string)=>{light.emissiveIntensity=mode==='night'?1.7:mode==='sunset'?.65:0;poolMaterial.opacity=mode==='night'?.3:mode==='sunset'?.12:0;pools.visible=poolMaterial.opacity>0;};
 root.userData.dispose=()=>{if(disposed)return;disposed=true;stats.disposed=true;const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();root.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());};
 return root;
}
