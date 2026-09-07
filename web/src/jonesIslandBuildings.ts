import * as THREE from 'three';
import {PORT_BUILDINGS} from './portSite.ts';
import {districtGeometry} from './districtGeometry.ts';
import {buildIndustrialRoofDetails} from './jonesIslandAssets.ts';

const plantBuildings=PORT_BUILDINGS.filter(b=>b.bounds.x>300&&b.bounds.z<1610);
const brick=new THREE.Color(0xa79472),roof=new THREE.Color(0x757b78);
const glazing=new THREE.MeshStandardMaterial({color:0x3d5359,roughness:.5,metalness:.12});
const stone=new THREE.MeshStandardMaterial({color:0xc5bcaa,roughness:.9});

/** Detail source buildings in place. Exact footprint-node matching keeps nearby
 * buildings intact; the existing roof elevation remains the vertical reference. */
export function detailJonesIslandBuildings(group:THREE.Group,tile:{i:number;j:number}){
 if(tile.i!==0||tile.j!==-1||group.userData.jonesIslandDetailed)return 0;
 group.userData.jonesIslandDetailed=true;
 const details=new THREE.Group();details.name='jones-island-building-details';
 const batch=districtGeometry(details);let count=0;
 for(const object of [...group.children]){
  if(!(object instanceof THREE.Mesh)||object.name!=='BLDG')continue;
  const pos=object.geometry.getAttribute('position'),colors=object.geometry.getAttribute('color');
  if(!pos||!colors)continue;
  for(const building of plantBuildings){
   const matches:number[]=[];
   for(let v=0;v<pos.count;v++)if(building.footprint.some(([x,z])=>Math.hypot(x-pos.getX(v),z-pos.getZ(v))<.18))matches.push(v);
   if(matches.length<9)continue;
   const top=Math.max(...matches.map(v=>pos.getY(v))),floor=Math.min(...matches.map(v=>pos.getY(v)));
   if(top-floor<2)continue;
   const indices=new Set(matches);
   for(let v=0;v<pos.count;v+=3){
    if(!indices.has(v)||!indices.has(v+1)||!indices.has(v+2))continue;
    const flat=Math.abs(pos.getY(v)-pos.getY(v+1))<.15&&Math.abs(pos.getY(v)-pos.getY(v+2))<.15;
    const c=flat?roof:brick;for(let k=0;k<3;k++)colors.setXYZ(v+k,c.r,c.g,c.b);
   }
   colors.needsUpdate=true;count++;
   // Large irregular compound footprint includes courtyards and basins: keep its
   // source structure, but don't span those voids with a rectangular roof kit.
   const {x,z,width,depth,bearing}=building.bounds;
   let area=0;const points=building.footprint;
   for(let i=1;i<points.length;i++)area+=points[i-1][0]*points[i][1]-points[i][0]*points[i-1][1];
   if(width<150&&Math.abs(area/2)/(width*depth)>.9){
    const kit=buildIndustrialRoofDetails({width:Math.max(4,width-2),depth:Math.max(4,depth-2)});
    kit.position.set(x,top+.04,z);kit.rotation.y=bearing;kit.updateMatrixWorld(true);
    kit.traverse(o=>{if(o instanceof THREE.Mesh)batch.add(o.geometry.clone().applyMatrix4(o.matrixWorld),o.material as THREE.Material,'jones-island-rooftops');});
   }
   // Window rhythm follows each real exterior edge, offset a few centimetres.
   for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    if(length<8)continue;
    const side=area>0?1:-1,nx=side*dz/length,nz=-side*dx/length;
    for(let t=4;t<length-3;t+=7){
     const px=a[0]+dx*t/length+nx*.1,pz=a[1]+dz*t/length+nz*.1;
     const y=top-2.3;
     const window=new THREE.BoxGeometry(1.4,1.65,.12).rotateY(Math.atan2(-dz,dx)).translate(px,y,pz);
     batch.add(window,glazing,'jones-island-facade-windows');
     const sill=new THREE.BoxGeometry(1.7,.12,.24).rotateY(Math.atan2(-dz,dx)).translate(px,y-.9,pz);
     batch.add(sill,stone,'jones-island-window-sills');
    }
   }
  }
 }
 batch.finish();details.userData.buildingCount=count;group.add(details);return count;
}
