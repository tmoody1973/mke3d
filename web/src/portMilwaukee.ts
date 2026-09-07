import {buildJonesIsland} from './jonesIsland.ts';
import * as THREE from 'three';
import {districtGeometry} from './districtGeometry.ts';
import {PORT_BUILDINGS,PORT_RAILS,PORT_ANCHORS} from './portSite.ts';
import {PORT_REPLACED_IDS} from './portPlaceholder.ts';
import {PORT_DOCK_EDGES,PORT_CRANE_PLACEMENTS,PORT_FREIGHTER_PLACEMENT,PORT_FERRY_PLACEMENT} from './portDockEdges.ts';
import {buildPortRail} from './portRail.ts';
import {buildPortCrane,buildPortDome,buildPortWarehouse,buildPortTurbine} from './portAssets.ts';
import {buildPortFreighter,buildPortFerry} from './portVessels.ts';

const UP=new THREE.Vector3(0,1,0);
export const PORT_FOCUS={x:770,z:1940,lat:43.017455198,lon:-87.895537007};

/** Current mapped footprints and tracks; fine architectural and equipment details
 * are interpretations of the supplied public exterior photographs. */
export function buildPortMilwaukee(groundAt:(x:number,z:number)=>number){
  const root=new THREE.Group();root.name='port-milwaukee';
  const batch=districtGeometry(root);
  const stone=new THREE.MeshStandardMaterial({color:0xb9b4a5,roughness:.93});
  const dark=new THREE.MeshStandardMaterial({color:0x394146,roughness:.7,metalness:.25});
  const pale=new THREE.MeshStandardMaterial({color:0xcfd2ca,roughness:.75,metalness:.14});
  const features:{id:string;kind:string;position:number[]}[]=[];
  const selected=new Set<number>(PORT_REPLACED_IDS);
  const lights:THREE.BufferGeometry[]=[];
  function place(asset:THREE.Group,x:number,y:number,z:number,bearing=0,id=asset.name){
    asset.position.set(x,y,z);asset.rotation.y=bearing;asset.updateMatrixWorld(true);
    features.push({id,kind:asset.name,position:[x,y,z]});
    asset.traverse(o=>{
      if(o instanceof THREE.Mesh){const g=o.geometry.clone().applyMatrix4(o.matrixWorld);batch.add(g,o.material as THREE.Material,`port-${(o.material as THREE.Material).uuid}`);}
      else if(o instanceof THREE.LineSegments){const line=new THREE.LineSegments(o.geometry.clone().applyMatrix4(o.matrixWorld),o.material);line.name='port-crane-hoist-cables';root.add(line);}
    });
  }
  function tank(radius:number,height:number){
    const g=new THREE.Group();g.name='port-storage-tank';const b=districtGeometry(g);
    b.cylinder(0,height/2,0,radius,height,pale,'tank-shell',32);
    b.add(new THREE.ConeGeometry(radius,.8,32).translate(0,height+.4,0),pale,'tank-roof');
    for(const y of [1,height*.5,height-.5])b.add(new THREE.TorusGeometry(radius+.04,.065,4,40).rotateX(Math.PI/2).translate(0,y,0),dark,'tank-bands');
    for(const x of [-.4,.4])b.box(x,height/2,radius+.18,.07,height,.08,dark,'tank-ladder');
    for(let y=.6;y<height;y+=.4)b.box(0,y,radius+.18,.9,.06,.08,dark,'tank-ladder');
    b.finish();return g;
  }
  function publicBuilding(width:number,depth:number,height:number,admin:boolean){
    const g=new THREE.Group();g.name=admin?'port-administration':'port-ferry-terminal';const b=districtGeometry(g);
    const eave=height*.72;
    b.box(0,eave/2,0,width,eave,depth,stone,'port-public-walls');
    const roof=new THREE.MeshStandardMaterial({color:admin?0x79756a:0x486773,roughness:.8});
    const roofShape=new THREE.BufferGeometry();const w=width/2+.5,d=depth/2+.5,r=width*.28;
    roofShape.setAttribute('position',new THREE.Float32BufferAttribute([
      -w,eave,-d,-r,height,0,r,height,0,-w,eave,-d,r,height,0,w,eave,-d,
      -w,eave,d,w,eave,d,r,height,0,-w,eave,d,r,height,0,-r,height,0,
      -w,eave,-d,-w,eave,d,-r,height,0,w,eave,d,w,eave,-d,r,height,0,
    ],3));roofShape.computeVertexNormals();b.add(roofShape,roof,'port-public-hipped-roof');
    for(const side of [-1,1])for(let x=-width/2+3;x<width/2-1;x+=4.4)for(const y of admin?[2,5]:[2.6]){
      b.box(x,y,side*(depth/2+.05),1.65,admin?1.65:3.2,.12,dark,'port-public-windows');
      b.box(x,y-.9,side*(depth/2+.15),2.1,.13,.3,pale,'port-public-sills');
    }
    b.box(0,1.4,depth/2+.1,2.8,2.8,.15,dark,'port-public-entry');
    b.box(0,3.4,depth/2+2,6,.25,4,pale,'port-public-entry-canopy');
    b.finish();return g;
  }
  for(const building of PORT_BUILDINGS){
    if(!selected.has(building.id))continue;
    const {x,z,width,depth,bearing}=building.bounds;
    const grade=Math.max(.6,...building.footprint.map(([px,pz])=>groundAt(px,pz)));
    let asset:THREE.Group;
    if([663206982,663207002].includes(building.id))asset=buildPortDome({radius:Math.min(width,depth)/2,height:Math.min(width,depth)*.62});
    else if(building.kind==='tank')asset=tank(Math.min(width,depth)/2,Math.max(9,building.height));
    else if(building.id===398077470||building.id===94668874)asset=publicBuilding(width,depth,building.height,building.id===398077470);
    else asset=buildPortWarehouse({width,depth,height:Math.max(8,building.height)});
    place(asset,x,grade,z,bearing,`way/${building.id}`);
    // A shallow foundation reaches the lower terrain corners without moving the roof.
    const low=Math.min(...building.footprint.map(([px,pz])=>groundAt(px,pz)));
    if(grade-low>.1){const plinth=new THREE.BoxGeometry(width,grade-low+.15,depth);plinth.rotateY(bearing);plinth.translate(x,(grade+low)/2-.05,z);batch.add(plinth,stone,'port-foundations');}
    if(building.kind!=='tank'){
      const p=new THREE.Vector3(0,0,depth/2+5).applyAxisAngle(UP,bearing).add(new THREE.Vector3(x,0,z));
      const y=groundAt(p.x,p.z);batch.box(p.x,y+5,p.z,.2,10,.2,dark,'port-yard-lamp-poles');
      const lamp=new THREE.BoxGeometry(1.2,.15,.65);lamp.translate(p.x,y+10,p.z);lights.push(lamp);
    }
  }
  const turbine=PORT_ANCHORS.find(a=>a.kind==='turbine');
  if(turbine)place(buildPortTurbine({height:38,rotorRadius:10}),turbine.position[0],groundAt(...turbine.position),turbine.position[1],.4,'port-wind-turbine');

  // Static vessel/equipment placements are illustrative, not live operations.
  for(const [index,p] of PORT_CRANE_PLACEMENTS.entries())
    place(buildPortCrane({height:26,boomLength:34,baseWidth:8}),p.x,Math.max(.6,groundAt(p.x,p.z)),p.z,p.bearing,`port-dock-crane-${index+1}`);
  const ship=PORT_FREIGHTER_PLACEMENT,ferry=PORT_FERRY_PLACEMENT;
  place(buildPortFreighter({length:180,beam:22}),ship.x,0,ship.z,ship.bearing,'port-freighter');
  place(buildPortFerry(),ferry.x,0,ferry.z,ferry.bearing,'port-ferry');
  const asphalt=new THREE.MeshStandardMaterial({color:0x8b8a7e,roughness:.98});
  const rubber=new THREE.MeshStandardMaterial({color:0x292d2d,roughness:.95});
  for(const edge of PORT_DOCK_EDGES){
    for(let i=1;i<edge.points.length;i++){
      const [ax,az]=edge.points[i-1],[bx,bz]=edge.points[i];
      const length=Math.hypot(bx-ax,bz-az);if(length<.5)continue;
      const dx=(bx-ax)/length,dz=(bz-az)/length,nx=-dz*edge.landSide,nz=dx*edge.landSide;
      const steps=Math.ceil(length/12);
      for(let j=0;j<steps;j++){
        const x=ax+dx*length*(j+.5)/steps,z=az+dz*length*(j+.5)/steps;
        const top=Math.max(.65,groundAt(x+nx*3,z+nz*3));
        const wall=new THREE.BoxGeometry(length/steps+.02,top+1,.65).rotateY(Math.atan2(-dz,dx)).translate(x+nx*.35,(top-1)/2,z+nz*.35);
        batch.add(wall,stone,'port-quay-walls');
        // Narrow land-side apron follows the existing coast without filling slips.
        const apron=new THREE.BoxGeometry(length/steps+.02,.12,4).rotateY(Math.atan2(-dz,dx)).translate(x+nx*2.5,top+.02,z+nz*2.5);
        batch.add(apron,asphalt,'port-quay-aprons');
        batch.cylinder(x+nx*1.4,top+.45,z+nz*1.4,.24,.9,dark,'port-mooring-bollards',8);
        batch.cylinder(x+nx*1.4,top+.87,z+nz*1.4,.36,.12,dark,'port-mooring-bollards',8);
        const fender=new THREE.BoxGeometry(.65,1.5,1.1).rotateY(Math.atan2(-dz,dx)).translate(x-nx*.3,top-.6,z-nz*.3);
        batch.add(fender,rubber,'port-dock-fenders');
      }
    }
  }
  batch.finish();
  const railPaths=PORT_RAILS.map(path=>({id:path.id,points:path.points,bridge:'bridge' in path&&Boolean(path.bridge),layer:'layer' in path?Number(path.layer):0}));
  root.add(buildPortRail(railPaths,groundAt),buildJonesIsland(groundAt));
  const glow=new THREE.MeshBasicMaterial({color:0xffd69a,transparent:true,opacity:0,toneMapped:false});
  const lightBatch=districtGeometry(root);for(const geometry of lights)lightBatch.add(geometry,glow,'port-yard-light-fixtures');lightBatch.finish();
  root.userData.features=features;root.userData.dockEdgeCount=PORT_DOCK_EDGES.length;
  root.userData.setLightingMode=(mode:'day'|'sunset'|'night')=>{glow.opacity=mode==='night'?.9:mode==='sunset'?.45:0;};
  root.userData.setLightingMode('day');
  return root;
}
