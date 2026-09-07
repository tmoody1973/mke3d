import * as THREE from 'three';
import {districtGeometry} from './districtGeometry.ts';

export interface PortRailPath {id:number;points:readonly (readonly [number,number])[];bridge?:boolean;layer?:number}
const GAUGE=1.435;

/** Mapped railway centre-lines, with standard-gauge rails, ballast and sleepers. */
export function buildPortRail(paths:readonly PortRailPath[],groundAt:(x:number,z:number)=>number){
  const root=new THREE.Group();root.name='port-milwaukee-railways';
  const ballast=new THREE.MeshStandardMaterial({color:0x66665e,roughness:1});
  const steel=new THREE.MeshStandardMaterial({color:0x979e9f,metalness:.65,roughness:.43});
  const timber=new THREE.MeshStandardMaterial({color:0x55473b,roughness:.98});
  const batches=districtGeometry(root),sleepers:{x:number;y:number;z:number;yaw:number}[]=[];
  let totalLength=0,segmentCount=0;
  const lengths=paths.map(path=>path.points.slice(1).reduce((sum,b,i)=>sum+Math.hypot(b[0]-path.points[i][0],b[1]-path.points[i][1]),0));
  const sleeperSpacing=Math.max(.75,lengths.reduce((a,b)=>a+b,0)/40000);
  for(const path of paths){
    let tieDistance=0;
    for(let i=1;i<path.points.length;i++){
      const [ax,az]=path.points[i-1],[bx,bz]=path.points[i],length=Math.hypot(bx-ax,bz-az);
      if(!Number.isFinite(length)||length<.05)continue;
      const dx=(bx-ax)/length,dz=(bz-az)/length,nx=-dz,nz=dx;
      const lift=path.bridge?Math.max(1,path.layer??1)*7:0;
      const height=(x:number,z:number)=>groundAt(x,z)+lift;
      const steps=Math.ceil(length/5);
      for(let j=0;j<steps;j++){
        const x0=ax+(bx-ax)*j/steps,z0=az+(bz-az)*j/steps,x1=ax+(bx-ax)*(j+1)/steps,z1=az+(bz-az)*(j+1)/steps;
        const y0=height(x0,z0),y1=height(x1,z1);
        if(!Number.isFinite(y0)||!Number.isFinite(y1))continue;
        const ribbon=(offset:number,width:number,lift:number,material:THREE.Material,name:string)=>{
          const a=[x0+nx*(offset-width/2),y0+lift,z0+nz*(offset-width/2)],b=[x1+nx*(offset-width/2),y1+lift,z1+nz*(offset-width/2)];
          const c=[x1+nx*(offset+width/2),y1+lift,z1+nz*(offset+width/2)],d=[x0+nx*(offset+width/2),y0+lift,z0+nz*(offset+width/2)];
          const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([...a,...c,...b,...a,...d,...c],3));g.computeVertexNormals();batches.add(g,material,name);
        };
        ribbon(0,3.1,.13,ballast,'port-track-ballast');
        for(const side of [-1,1]){
          ribbon(side*GAUGE/2,.085,.47,steel,'port-steel-rails');
          // Two vertical webs below the bright running heads.
          const p=new THREE.Vector3((x0+x1)/2+nx*side*GAUGE/2,(y0+y1)/2+.36,(z0+z1)/2+nz*side*GAUGE/2);
          const g=new THREE.BoxGeometry(.045,.18,length/steps);g.rotateY(Math.atan2(dx,dz));g.translate(...p.toArray());batches.add(g,steel,'port-steel-rails');
        }
        segmentCount++;
      }
      while(tieDistance<length){
        const x=ax+dx*tieDistance,z=az+dz*tieDistance,y=height(x,z)+.25;
        if(Number.isFinite(y))sleepers.push({x,y,z,yaw:Math.atan2(dx,dz)});
        tieDistance+=sleeperSpacing;
      }
      tieDistance-=length;totalLength+=length;
    }
  }
  batches.finish();
  const ties=new THREE.InstancedMesh(new THREE.BoxGeometry(2.55,.14,.23),timber,sleepers.length);
  ties.name='port-railway-sleepers';
  const matrix=new THREE.Matrix4(),quaternion=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
  sleepers.forEach((s,i)=>{quaternion.setFromAxisAngle(up,s.yaw);matrix.compose(new THREE.Vector3(s.x,s.y,s.z),quaternion,new THREE.Vector3(1,1,1));ties.setMatrixAt(i,matrix);});
  ties.instanceMatrix.needsUpdate=true;ties.computeBoundingSphere();root.add(ties);
  root.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=false;o.receiveShadow=true;}});
  root.userData={gauge:GAUGE,railLengthM:totalLength,sleeperCount:sleepers.length,sleeperSpacing,pathCount:paths.length,segmentCount,drawCalls:3};
  return root;
}
