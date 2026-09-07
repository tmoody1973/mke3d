import {jonesBasinLevel} from './jonesIslandWater.ts';
import * as THREE from 'three';
import {JONES_BASINS,JONES_GREEN_AREAS,JONES_ANCHORS} from './jonesIslandSite.ts';
import {buildClarifierDetails,buildKaszubesPark} from './jonesIslandAssets.ts';
import {districtGeometry} from './districtGeometry.ts';

/** Photo-based exterior details at mapped Jones Island coordinates. */
export function buildJonesIsland(groundAt:(x:number,z:number)=>number){
 const root=new THREE.Group();root.name='jones-island-context';const batch=districtGeometry(root);
 const concrete=new THREE.MeshStandardMaterial({color:0xaaa699,roughness:.95});
 const water=new THREE.MeshStandardMaterial({color:0x566f69,roughness:.38,metalness:.15});
 const brick=new THREE.MeshStandardMaterial({color:0x806950,roughness:.96});
 const dark=new THREE.MeshStandardMaterial({color:0x3b4140,roughness:.8});
 let basinCount=0,circularCount=0;
 function merge(asset:THREE.Group){asset.updateMatrixWorld(true);asset.traverse(o=>{if(o instanceof THREE.Mesh&&o.name!=='kaszubes-lawn')batch.add(o.geometry.clone().applyMatrix4(o.matrixWorld),o.material as THREE.Material,o.name);});}
 for(const basin of JONES_BASINS){
  if(basin.kind!=='wastewater')continue;
  const [x,z]=basin.center;
  const radii=basin.footprint.map(p=>Math.hypot(p[0]-x,p[1]-z));
  const circular=basin.footprint.length>=20&&Math.max(...radii)/Math.min(...radii)<1.08;
  const y=jonesBasinLevel(basin);
  // Water overlays use only mapped basin polygons, never the surrounding harbor.
  const shape=new THREE.Shape(basin.footprint.map(([px,pz])=>new THREE.Vector2(px,-pz)));
  const surface=new THREE.ShapeGeometry(shape).rotateX(-Math.PI/2).translate(0,y+.025,0);
  batch.add(surface,water,'jones-island-basin-surfaces');
  if(circular){
   const asset=buildClarifierDetails({radius:basin.radius,waterY:.72});asset.position.set(x,y-.72,z);asset.rotation.y=.17;merge(asset);circularCount++;
  }else{
   for(let i=0;i<basin.footprint.length;i++){
    const a=basin.footprint[i],b=basin.footprint[(i+1)%basin.footprint.length];
    const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);if(length<.1)continue;
    batch.add(new THREE.BoxGeometry(length,.85,.5).rotateY(Math.atan2(-dz,dx)).translate((a[0]+b[0])/2,y+.33,(a[1]+b[1])/2),concrete,'jones-island-channel-rims');
   }
  }
  basinCount++;
 }
 const park=JONES_GREEN_AREAS.find(p=>p.id===340218889);
 if(park){
  const [x,z]=park.center;
  const y=groundAt(x,z)+.1;
  const lawn=new THREE.ShapeGeometry(new THREE.Shape(park.footprint.map(([px,pz])=>new THREE.Vector2(px,-pz)))).rotateX(-Math.PI/2).translate(0,y,0);
  batch.add(lawn,new THREE.MeshStandardMaterial({color:0x587548,roughness:1}),'kaszubes-mapped-lawn');
  const asset=buildKaszubesPark({width:24,depth:11});asset.position.set(x,y,z);asset.rotation.y=.43;merge(asset);
  if(typeof document!=='undefined'){
   const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const ctx=canvas.getContext('2d');
   if(ctx){ctx.fillStyle='#e6dec6';ctx.textAlign='center';ctx.font='600 56px sans-serif';ctx.fillText("KASZUBE’S",256,102);ctx.fillText('PARK',256,174);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const label=new THREE.Mesh(new THREE.PlaneGeometry(3.1,1.5),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
    label.name='kaszubes-park-sign-lettering';label.position.set(-24*.22+.4,3.4,-11*.12+.17);label.updateMatrix();label.applyMatrix4(asset.matrixWorld);root.add(label);
   }
  }
  root.userData.parkPosition=[x,groundAt(x,z),z];
 }
 // Chimney locations are mapped; tapered exterior dimensions are estimated from
 // the supplied broad photograph. No smoke or operating-state simulation.
 for(const [i,anchor] of JONES_ANCHORS.filter(a=>a.kind==='chimney').entries()){
  const [x,z]=anchor.position,y=groundAt(x,z),height=i===0?70:24,r=i===0?2.7:1.25;
  batch.add(new THREE.CylinderGeometry(r*.72,r,height,20).translate(x,y+height/2,z),brick,'jones-island-brick-chimneys');
  batch.cylinder(x,y+height-.2,z,r*.77,.4,dark,'jones-island-chimney-caps',20);
 }
 batch.finish();root.userData.basinCount=basinCount;root.userData.circularCount=circularCount;
 return root;
}
