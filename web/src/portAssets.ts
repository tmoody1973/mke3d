import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type PortLightingMode='day'|'sunset'|'night';
export interface PortCraneOptions {height?:number;boomLength?:number;baseWidth?:number;cabSide?:'left'|'right'}
export interface PortDomeOptions {radius?:number;height?:number}
export interface PortWarehouseOptions {width?:number;depth?:number;height?:number}
export interface PortSiloOptions {radius?:number;height?:number;count?:number}
export interface PortTurbineOptions {height?:number;rotorRadius?:number}

const mat={
  steel:new THREE.MeshStandardMaterial({color:0xc9b650,roughness:.58,metalness:.48}),
  dark:new THREE.MeshStandardMaterial({color:0x34393b,roughness:.62,metalness:.52}),
  concrete:new THREE.MeshStandardMaterial({color:0x92928a,roughness:.94}),
  pale:new THREE.MeshStandardMaterial({color:0xc8c8bd,roughness:.82,metalness:.08}),
  roof:new THREE.MeshStandardMaterial({color:0x667176,roughness:.67,metalness:.42}),
  glass:new THREE.MeshStandardMaterial({color:0x39535c,roughness:.2,metalness:.15}),
  weather:new THREE.MeshStandardMaterial({color:0x786e5e,roughness:.94}),
};

function box(x:number,y:number,z:number,w:number,h:number,d:number){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);return g;}
function beam(a:THREE.Vector3,b:THREE.Vector3,w:number,d=w){
  const v=b.clone().sub(a),g=new THREE.BoxGeometry(w,v.length(),d);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize()));
  g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());return g;
}
function merge(root:THREE.Group,name:string,parts:THREE.BufferGeometry[],material:THREE.Material,collision=false){
  if(!parts.length)return;
  const flat=parts.map(p=>{const g=p.index?p.toNonIndexed():p.clone();g.deleteAttribute('uv');return g;});
  const geometry=mergeGeometries(flat,false)!;parts.forEach(p=>p.dispose());flat.forEach(p=>p.dispose());
  const mesh=new THREE.Mesh(geometry,material);mesh.name=collision?'BLDG':name;mesh.castShadow=collision;mesh.receiveShadow=true;root.add(mesh);
}
function finish(root:THREE.Group,dimensions:Record<string,number>,lit?:THREE.MeshBasicMaterial){
  let drawCalls=0,triangles=0;root.traverse(o=>{if(o instanceof THREE.Mesh){drawCalls++;const p=o.geometry.getAttribute('position');triangles+=(o.geometry.index?.count??p.count)/3;}else if(o instanceof THREE.LineSegments)drawCalls++;});
  root.userData.dimensions=dimensions;root.userData.drawCalls=drawCalls;root.userData.triangles=triangles;
  root.userData.setLightingMode=(mode:PortLightingMode)=>{if(lit)lit.opacity=mode==='night'?.52:mode==='sunset'?.18:0;};
  root.userData.setLightingMode('day');return root;
}
function cable(root:THREE.Group,points:THREE.Vector3[]){
  const geometry=new THREE.BufferGeometry().setFromPoints(points);const line=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:0x252a2b}));line.name='port-crane-cables';root.add(line);
}

/** Open-lattice harbor crane, centered on a mobile/pedestal undercarriage at grade zero. */
export function buildPortCrane(options:PortCraneOptions={}):THREE.Group{
  const height=options.height??42,boomLength=options.boomLength??48,baseWidth=options.baseWidth??9,side=options.cabSide==='right'?1:-1;
  const root=new THREE.Group();root.name='port-harbor-crane';
  const base:THREE.BufferGeometry[]=[],steel:THREE.BufferGeometry[]=[],dark:THREE.BufferGeometry[]=[],cab:THREE.BufferGeometry[]=[];
  base.push(box(0,1.1,0,baseWidth,2.2,7),new THREE.CylinderGeometry(2.25,2.8,1.5,16).translate(0,2.7,0));
  for(const x of [-baseWidth*.38,baseWidth*.38])for(const z of [-2.45,0,2.45])dark.push(new THREE.CylinderGeometry(.65,.65,.55,10).rotateZ(Math.PI/2).translate(x,.65,z));
  const pivot=new THREE.Vector3(0,height*.28,0),mastTop=new THREE.Vector3(0,height*.64,0);
  steel.push(beam(new THREE.Vector3(-2.2,3.4,-1.8),mastTop,.5),beam(new THREE.Vector3(2.2,3.4,-1.8),mastTop,.5));
  for(let i=0;i<5;i++){const y=5+i*(mastTop.y-5)/5;steel.push(beam(new THREE.Vector3(-1.7,y,-1),new THREE.Vector3(1.7,y+3,-1),.18));}
  cab.push(box(side*2.4,pivot.y+1.1,-.3,3.4,2.5,3.8),box(side*3.05,pivot.y+1.5,-2.25,2.1,1.25,.12));
  const angle=Math.asin(Math.min(.92,(height-pivot.y)/boomLength)),dir=new THREE.Vector3(Math.cos(angle),Math.sin(angle),0),tip=pivot.clone().addScaledVector(dir,boomLength);
  const normal=new THREE.Vector3(-dir.y,dir.x,0),half=1.25,boomHalfZ=.7;
  for(const sideY of [-1,1])for(const sideZ of [-1,1])
    steel.push(beam(pivot.clone().addScaledVector(normal,sideY*half).add(new THREE.Vector3(0,0,sideZ*boomHalfZ)),tip.clone().addScaledVector(normal,sideY*.35).add(new THREE.Vector3(0,0,sideZ*.28)),.27));
  for(let i=0;i<12;i++){
    const t=i/12,u=(i+1)/12,a=pivot.clone().lerp(tip,t),b=pivot.clone().lerp(tip,u),aw=THREE.MathUtils.lerp(half,.35,t),bw=THREE.MathUtils.lerp(half,.35,u),az=THREE.MathUtils.lerp(boomHalfZ,.28,t),bz=THREE.MathUtils.lerp(boomHalfZ,.28,u);
    for(const sideZ of [-1,1])steel.push(beam(a.clone().addScaledVector(normal,(i%2?1:-1)*aw).add(new THREE.Vector3(0,0,sideZ*az)),b.clone().addScaledVector(normal,(i%2?-1:1)*bw).add(new THREE.Vector3(0,0,sideZ*bz)),.13));
    if(i%2===0)for(const sideY of [-1,1])steel.push(beam(a.clone().addScaledVector(normal,sideY*aw).add(new THREE.Vector3(0,0,-az)),a.clone().addScaledVector(normal,sideY*aw).add(new THREE.Vector3(0,0,az)),.12));
  }
  const back=pivot.clone().add(new THREE.Vector3(-10,7,0));steel.push(beam(pivot,back,.55),box(-7,pivot.y+5,0,4,2.3,3));
  const hookY=Math.max(4,tip.y-boomLength*.63);dark.push(new THREE.CylinderGeometry(.48,.62,1.3,10).translate(tip.x,hookY,0));
  merge(root,'port-crane-undercarriage',base,mat.concrete);merge(root,'port-crane-open-lattice-boom',steel,mat.steel);merge(root,'port-crane-wheels-hook',dark,mat.dark);merge(root,'port-crane-cab',cab,mat.glass);
  cable(root,[back,mastTop,mastTop,tip,tip,new THREE.Vector3(tip.x,hookY+.7,0)]);
  return finish(root,{height:Math.max(height,tip.y),boomLength,baseWidth});
}

/** Ribbed dry-bulk storage dome with a recessed loading entrance. */
export function buildPortDome(options:PortDomeOptions={}):THREE.Group{
  const radius=options.radius??18,height=options.height??17,root=new THREE.Group();root.name='port-material-dome';
  const shell:THREE.BufferGeometry[]=[],ribs:THREE.BufferGeometry[]=[],dark:THREE.BufferGeometry[]=[];
  const sphere=new THREE.SphereGeometry(radius,32,14,0,Math.PI*2,0,Math.PI/2);sphere.scale(1,height/radius,1);sphere.translate(0,.35,0);shell.push(sphere,box(0,.25,0,radius*2.02,.5,radius*2.02));
  for(let i=0;i<16;i++){
    const a=i*Math.PI*2/16;
    for(let segment=0;segment<8;segment++){
      const t0=segment*Math.PI/16,t1=(segment+1)*Math.PI/16;
      const point=(t:number)=>new THREE.Vector3(Math.cos(a)*radius*Math.cos(t),.35+height*Math.sin(t),Math.sin(a)*radius*Math.cos(t));
      ribs.push(beam(point(t0),point(t1),.14,.1));
    }
  }
  dark.push(box(0,2.6,radius*.91,6.2,5.2,3.1),box(0,2.7,radius*1.005,4.8,4.5,.25));
  merge(root,'port-dome-shell',shell,mat.pale,true);merge(root,'port-dome-ribs',ribs,mat.roof);merge(root,'port-dome-loading-entrance',dark,mat.dark);
  return finish(root,{radius,height,width:radius*2,depth:radius*2});
}

function pitchedWarehouse(width:number,depth:number,height:number){
  const eave=height*.72,verts:number[]=[];const face=(a:number[],b:number[],c:number[],d:number[])=>verts.push(...a,...b,...c,...a,...c,...d);
  face([-width/2,0,-depth/2],[width/2,0,-depth/2],[width/2,eave,-depth/2],[-width/2,eave,-depth/2]);
  face([width/2,0,depth/2],[-width/2,0,depth/2],[-width/2,eave,depth/2],[width/2,eave,depth/2]);
  face([-width/2,0,depth/2],[-width/2,0,-depth/2],[-width/2,eave,-depth/2],[-width/2,eave,depth/2]);face([width/2,0,-depth/2],[width/2,0,depth/2],[width/2,eave,depth/2],[width/2,eave,-depth/2]);
  // Opposite winding keeps each gable's normal facing out from the shed.
  verts.push(width/2,eave,-depth/2,-width/2,eave,-depth/2,0,height,-depth/2);
  verts.push(-width/2,eave,depth/2,width/2,eave,depth/2,0,height,depth/2);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.computeVertexNormals();return g;
}

/** Corrugated port shed with true pitched roof, loading doors, clerestory, and restrained weather streaks. */
export function buildPortWarehouse(options:PortWarehouseOptions={}):THREE.Group{
  const width=options.width??58,depth=options.depth??26,height=options.height??12,eave=height*.72,root=new THREE.Group();root.name='port-pitched-warehouse';
  const body=[pitchedWarehouse(width,depth,height)],roof:THREE.BufferGeometry[]=[],detail:THREE.BufferGeometry[]=[],glass:THREE.BufferGeometry[]=[],weather:THREE.BufferGeometry[]=[];
  const slope=Math.hypot(width/2,height-eave),roofAngle=Math.atan2(height-eave,width/2);
  for(const sign of [-1,1]){const g=new THREE.BoxGeometry(slope+.5,.22,depth+.8);g.rotateZ(-sign*roofAngle);g.translate(sign*width/4,(height+eave)/2,0);roof.push(g);}
  const doors=Math.max(2,Math.floor(width/11));for(let i=0;i<doors;i++){const x=-width/2+(i+.5)*width/doors;detail.push(box(x,2.4,depth/2+.11,width/doors*.68,4.8,.24));glass.push(box(x,eave-.75,depth/2+.14,width/doors*.55,.75,.16));}
  for(let x=-width/2+2;x<width/2;x+=2.4)detail.push(box(x,eave/2,-depth/2-.08,.055,eave,.12));
  for(let x=-width/2+6;x<width/2;x+=13)weather.push(box(x,1.5,-depth/2-.15,.7,3,.04));
  merge(root,'port-warehouse-corrugated-shell',body,mat.pale,true);merge(root,'port-warehouse-pitched-roof',roof,mat.roof);merge(root,'port-warehouse-loading-doors-and-ribs',detail,mat.dark);merge(root,'port-warehouse-clerestory',glass,mat.glass);merge(root,'port-warehouse-weathering',weather,mat.weather);
  return finish(root,{width,depth,height});
}

/** Compact grain/cement silo bank with top gallery and inclined transfer conveyor. */
export function buildPortSilos(options:PortSiloOptions={}):THREE.Group{
  const radius=options.radius??3.6,height=options.height??19,count=Math.max(2,Math.min(8,Math.round(options.count??4))),root=new THREE.Group();root.name='port-silo-cluster';
  const pale:THREE.BufferGeometry[]=[],steel:THREE.BufferGeometry[]=[],dark:THREE.BufferGeometry[]=[];const span=(count-1)*radius*2.15;
  for(let i=0;i<count;i++){const x=-span/2+i*radius*2.15;pale.push(new THREE.CylinderGeometry(radius,radius,height,18).translate(x,height/2,0),new THREE.ConeGeometry(radius,1.7,18).translate(x,height+.85,0));dark.push(box(x,1.8,radius+.08,1.8,3.6,.2));}
  steel.push(box(0,height+2,0,span+radius*2.1,1.3,2.1),beam(new THREE.Vector3(-span/2-radius,height+2.4,0),new THREE.Vector3(-span/2-radius-12,4,0),1.2,1.3));
  merge(root,'port-silo-shells',pale,mat.pale,true);merge(root,'port-silo-gallery-conveyor',steel,mat.roof);merge(root,'port-silo-doors',dark,mat.dark);return finish(root,{radius,height:height+2.65,count,width:span+radius*2});
}

/** Three-blade landmark turbine; rotor faces local +Z and can be oriented by the caller. */
export function buildPortTurbine(options:PortTurbineOptions={}):THREE.Group{
  const height=options.height??38,rotorRadius=options.rotorRadius??11,root=new THREE.Group();root.name='port-wind-turbine';
  const pale:THREE.BufferGeometry[]=[new THREE.CylinderGeometry(.55,1.6,height,14).translate(0,height/2,0),box(0,height,.8,3,1.5,3.8)],blades:THREE.BufferGeometry[]=[];
  for(let i=0;i<3;i++){const a=i*Math.PI*2/3,start=new THREE.Vector3(Math.cos(a)*1.1+0,height+Math.sin(a)*1.1,2.75),end=new THREE.Vector3(Math.cos(a)*rotorRadius,height+Math.sin(a)*rotorRadius,2.75);blades.push(beam(start,end,.65,.18));}
  blades.push(new THREE.CylinderGeometry(1.05,1.05,.9,16).rotateX(Math.PI/2).translate(0,height,2.75));
  merge(root,'port-turbine-tower-nacelle',pale,mat.pale,true);merge(root,'port-turbine-rotor',blades,mat.roof);return finish(root,{height:height+rotorRadius,hubHeight:height,rotorRadius});
}
