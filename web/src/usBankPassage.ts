import * as THREE from 'three';
import {US_BANK_SITE as site} from './usBankSite.ts';

/** OSM ways 89802969 and 701108047: Michigan Street, tunnel=building_passage.
 * These surface streets were omitted by the cached road importer. */
export const MICHIGAN_PASSAGE = {
  centerline:[[211.523998,-304.388107],[218.041567,-304.974149],[272.183769,-309.872578]],
  width:9.6, lanes:3,
} as const;

export function addMichiganPassage(root:THREE.Group,groundAt:(x:number,z:number)=>number){
  const inverse=new THREE.Matrix4().makeRotationY(-site.bearing);
  const point=(x:number,z:number,lift:number)=>new THREE.Vector3(x-site.x,groundAt(x,z)+lift-site.floor,z-site.z).applyMatrix4(inverse);
  const points=MICHIGAN_PASSAGE.centerline;
  const material=new THREE.MeshStandardMaterial({color:0x696c6e,roughness:1});
  function ribbon(offset:number,width:number,lift:number,mat:THREE.Material,name:string,dashed=false){
    const vertices:number[]=[];
    let distance=0;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      const nx=-(b[1]-a[1])/length,nz=(b[0]-a[0])/length;
      // Sample the terrain at short intervals, matching the cached road lift.
      const steps=Math.ceil(length/2);
      for(let j=0;j<steps;j++){
        if(dashed&&(distance+j*length/steps)%9>3)continue;
        const edge=(t:number,side:number)=>point(a[0]+(b[0]-a[0])*t+nx*(offset+side*width/2),a[1]+(b[1]-a[1])*t+nz*(offset+side*width/2),lift);
        const p=edge(j/steps,-1),q=edge((j+1)/steps,-1),r=edge((j+1)/steps,1),s=edge(j/steps,1);
        vertices.push(...p.toArray(),...r.toArray(),...q.toArray(),...p.toArray(),...s.toArray(),...r.toArray());
      }
      distance+=length;
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,mat);mesh.name=name;mesh.receiveShadow=true;root.add(mesh);return mesh;
  }
  ribbon(0,MICHIGAN_PASSAGE.width,.4,material,'us-bank-michigan-road').userData.drivingSurface='road';
  const sidewalk=new THREE.MeshStandardMaterial({color:0xc7c4b9,roughness:.95});
  const edge=new THREE.MeshStandardMaterial({color:0xcac7b4,roughness:1});
  for(const side of [-1,1]){
    ribbon(side*5.85,2.1,.56,sidewalk,'us-bank-michigan-sidewalk');
    ribbon(side*4.65,.12,.414,edge,'us-bank-michigan-edge-line');
  }
  // Source lanes:backward=1: one westbound lane north of two eastbound lanes.
  const yellow=new THREE.MeshStandardMaterial({color:0xbda448,roughness:1});
  for(const offset of [-1.7,-1.5])ribbon(offset,.1,.416,yellow,'us-bank-michigan-center-line');
  ribbon(1.6,.12,.416,edge,'us-bank-michigan-lane-line',true);
}
