import type {TerrainData} from './loader.ts';
import * as THREE from 'three';
import {bilinearTerrainHeight,terrainHeight} from './localTerrain.ts';
import {summerfestRampSources,type SummerfestRampSource} from './summerfestRampData.ts';

type Node={x:number;z:number;raw:number;y:number;floor:number;fixed:boolean;deck:boolean;edges:Map<Node,number>};
type Route={source:SummerfestRampSource;nodes:Node[];stations:number[];changed:boolean;minX:number;maxX:number;minZ:number;maxZ:number};
const key=(x:number,z:number)=>`${x.toFixed(6)},${z.toFixed(6)}`;
const cache=new WeakMap<TerrainData,ReturnType<typeof buildRampProfiles>>();
export function summerfestRampProfiles(raw:TerrainData,terrain:TerrainData){
 let result=cache.get(terrain);if(!result){result=buildRampProfiles(raw,terrain);cache.set(terrain,result);}return result;
}
function buildRampProfiles(raw:TerrainData,terrain:TerrainData){
 const floor=(x:number,z:number)=>Math.max(bilinearTerrainHeight(terrain,x,z)+.4,terrainHeight(terrain,x,z)-.48);
 const nodes=new Map<string,Node>();
 const routes:Route[]=summerfestRampSources.map(source=>{
  const routeNodes=source.points.map(([x,z,y],i)=>{
   const id=key(x,z),deck=source.bridge||source.anchors[i]==='deck',fixed=deck||source.anchors[i]==='ground';
   if(source.bridge)return {x,z,raw:y,y,floor:floor(x,z),fixed:true,deck:true,edges:new Map<Node,number>()};
   let node=nodes.get(id);
   if(!node){node={x,z,raw:y,y:floor(x,z),floor:floor(x,z),fixed:false,deck:false,edges:new Map()};nodes.set(id,node);}
   if(deck){node.fixed=true;node.deck=true;node.y=y;node.raw=y;}
   else if(fixed&&!node.deck){node.fixed=true;node.y=node.floor;}
   return node;
  });
  const stations=[0];
  for(let i=1;i<routeNodes.length;i++){
   const a=routeNodes[i-1],b=routeNodes[i],distance=Math.hypot(b.x-a.x,b.z-a.z);stations.push(stations[i-1]+distance);
   if(!source.bridge&&distance>0){a.edges.set(b,1/distance);b.edges.set(a,1/distance);}
  }
  const xs=source.points.map(p=>p[0]),zs=source.points.map(p=>p[1]),pad=source.width/2+.3;
  return {source,nodes:routeNodes,stations,changed:false,minX:Math.min(...xs)-pad,maxX:Math.max(...xs)+pad,minZ:Math.min(...zs)-pad,maxZ:Math.max(...zs)+pad};
 });
 // Solve whole source-connected ramp components. Bridge mouths stay at their
 // original deck heights; street/path mouths use the corrected terrain datum.
 // This is an estimated continuous grade, not survey/superelevation information.
 const seen=new Set<Node>();
 for(const start of nodes.values()){
  if(seen.has(start))continue;
  const component:Node[]=[],queue=[start];seen.add(start);
  while(queue.length){const node=queue.pop()!;component.push(node);for(const other of node.edges.keys())if(!seen.has(other)){seen.add(other);queue.push(other);}}
  const changed=component.some(n=>Math.abs(bilinearTerrainHeight(raw,n.x,n.z)-bilinearTerrainHeight(terrain,n.x,n.z))>.05);
  if(!changed){for(const n of component){n.y=n.raw;n.fixed=true;}continue;}
  for(const n of component)if(n.edges.size<2&&!n.fixed){n.fixed=true;n.y=n.floor;}
  for(let pass=0;pass<2500;pass++){
   let error=0;
   for(const n of component){if(n.fixed)continue;let sum=0,weight=0;for(const [other,w]of n.edges){sum+=other.y*w;weight+=w;}
    const y=Math.max(n.floor,weight?sum/weight:n.floor);error=Math.max(error,Math.abs(y-n.y));n.y=y;}
   if(error<.00001)break;
  }
  for(const route of routes)if(!route.source.bridge&&component.includes(route.nodes[0]))route.changed=true;
 }
 const project=(route:Route,x:number,z:number)=>{
  let best=Infinity,s=0,index=1,tBest=0,cx=0,cz=0,inside=true;
  for(let i=1;i<route.nodes.length;i++){
   const a=route.nodes[i-1],b=route.nodes[i],dx=b.x-a.x,dz=b.z-a.z,den=dx*dx+dz*dz;
   const original=((x-a.x)*dx+(z-a.z)*dz)/(den||1),t=Math.max(0,Math.min(1,original));
   const distance=Math.hypot(x-a.x-t*dx,z-a.z-t*dz);
   if(distance<best){best=distance;s=route.stations[i-1]+t*Math.sqrt(den);index=i;tBest=t;cx=a.x+t*dx;cz=a.z+t*dz;
    inside=!(i===1&&original<-.02||i===route.nodes.length-1&&original>1.02);}
  }return {distance:best,s,index,t:tBest,x:cx,z:cz,inside};
 };
 const correction=(route:Route,s:number)=>{
  const values=route.source.profile;let i=1;while(i<values.length-1&&values[i][0]<s)i++;
  const a=values[i-1],b=values[i],t=Math.max(0,Math.min(1,(s-a[0])/(b[0]-a[0]||1)));return a[1]+t*(b[1]-a[1]);
 };
 const target=(route:Route,x:number,z:number)=>{
  const p=project(route,x,z),a=route.nodes[p.index-1],b=route.nodes[p.index];
  return Math.max(floor(x,z),a.y+(b.y-a.y)*p.t);
 };
 const buckets=new Map<string,Route[]>();
 for(const route of routes){
  if(!route.changed&&!route.source.bridge)continue;
  for(let x=Math.floor(route.minX/50);x<=Math.floor(route.maxX/50);x++)for(let z=Math.floor(route.minZ/50);z<=Math.floor(route.maxZ/50);z++){
   const id=`${x},${z}`;if(!buckets.has(id))buckets.set(id,[]);buckets.get(id)!.push(route);
  }
 }
 for(const values of buckets.values())values.sort((a,b)=>Number(b.source.bridge)-Number(a.source.bridge));
 function match(triangle:readonly (readonly number[])[],markings=false){
  const x=triangle.reduce((sum,p)=>sum+p[0],0)/3,z=triangle.reduce((sum,p)=>sum+p[2],0)/3;
  const candidates=buckets.get(`${Math.floor(x/50)},${Math.floor(z/50)}`)||[];
  let best:Route|undefined,score=Infinity;
  for(const route of candidates){
   if(x<route.minX||x>route.maxX||z<route.minZ||z>route.maxZ)continue;
   let error=0,valid=true;
   const center=project(route,x,z);
   if(route.source.bridge&&!center.inside)continue;
   for(const [px,py,pz]of triangle){const p=project(route,px,pz);
    if(p.distance>route.source.width/2+.3){valid=false;break;}
    const centerSample=markings||route.source.bridge;
    const y=bilinearTerrainHeight(raw,centerSample?p.x:px,centerSample?p.z:pz)+.4+correction(route,p.s)+(markings?.14:0);
    const delta=Math.abs(py-y);if(delta>.4){valid=false;break;}error+=delta;
   }
   if(!valid)continue;
   // Confirmed bridge surfaces win over a touching approach ribbon.
   if(route.source.bridge)return undefined;
   if(route.changed&&error<score){best=route;score=error;}
  }
  return best;
 }
 return {routes,match,target,sourceHeight:(route:Route,x:number,z:number)=>{const p=project(route,x,z);return bilinearTerrainHeight(raw,x,z)+.4+correction(route,p.s);}};
}

/** Interpretive retaining walls and earth beneath mapped nonbridge approaches.
 * Bridge-tagged spans and their crossing corridors remain open. Dimensions and
 * fill heights follow the source road width/profile, not a surveyed earthwork plan.
 */
export function buildSummerfestRampEmbankments(raw:TerrainData,terrain:TerrainData){
 const group=new THREE.Group();group.name='summerfest-ramp-embankments';
 const profiles=summerfestRampProfiles(raw,terrain),earth:number[]=[],walls:number[]=[];
 const point=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
 const quad=(out:number[],a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,d:THREE.Vector3)=>{
  out.push(...a.toArray(),...b.toArray(),...c.toArray(),...a.toArray(),...c.toArray(),...d.toArray());
 };
 const bridgeRoutes=profiles.routes.filter(r=>r.source.bridge);
 const bridgeAt=(x:number,z:number,pad=1)=>bridgeRoutes.some(r=>{
  if(x<r.minX-pad||x>r.maxX+pad||z<r.minZ-pad||z>r.maxZ+pad)return false;
  for(let i=1;i<r.nodes.length;i++){
   const a=r.nodes[i-1],b=r.nodes[i],dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
   if(Math.hypot(x-a.x-t*dx,z-a.z-t*dz)<r.source.width/2+pad)return true;
  }return false;
 });
 let segments=0,bridgeCrossingsSkipped=0;
 for(const route of profiles.routes){
  if(!route.changed||route.source.bridge||route.source.highway!=='motorway_link')continue;
  const half=route.source.width/2-.18;
  for(let i=1;i<route.nodes.length;i++){
   const a=route.nodes[i-1],b=route.nodes[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);if(length<.1)continue;
   const sideX=-dz/length,sideZ=dx/length,n=Math.max(1,Math.ceil(length/3));
   for(let k=0;k<n;k++){
    const t0=k/n,t1=(k+1)/n,m=(t0+t1)/2,mx=a.x+dx*m,mz=a.z+dz*m;
    if(mx<80||mx>880||mz<-200||mz>1660)continue;
    // Set back from shared street mouths; never run a retaining wall across a branch.
    if(route.nodes.some(node=>node.edges.size>2&&Math.hypot(mx-node.x,mz-node.z)<9))continue;
    const section=(t:number)=>[-1,1].map(sign=>{
     const x=a.x+dx*t+sideX*half*sign,z=a.z+dz*t+sideZ*half*sign;
     const ground=Math.max(bilinearTerrainHeight(terrain,x,z)-.45,terrainHeight(terrain,x,z)-.6);
     return {top:point(x,profiles.target(route,x,z)-.10,z),bottom:point(x,ground,z)};
    });
    const start=section(t0),end=section(t1),corners=[...start,...end];
    if(corners.some(p=>bridgeAt(p.top.x,p.top.z))||bridgeAt(mx,mz,half)){bridgeCrossingsSkipped++;continue;}
    if(corners.every(p=>p.top.y-bilinearTerrainHeight(terrain,p.top.x,p.top.z)<.55))continue;
    // Closed earth prism directly inside the asphalt outline; no lateral apron
    // that could spill across nearby streets. Earth stops below the road surface.
    quad(earth,start[0].top,end[0].top,end[1].top,start[1].top);
    quad(earth,start[1].bottom,end[1].bottom,end[0].bottom,start[0].bottom);
    quad(earth,start[0].bottom,start[0].top,start[1].top,start[1].bottom);
    quad(earth,end[1].bottom,end[1].top,end[0].top,end[0].bottom);
    for(const side of [0,1]){
     const p=start[side],q=end[side],outward=side===0?-1:1;
     // A thin 18 cm retaining skin keeps the descending face concrete-colored.
     const inset=new THREE.Vector3(-sideX*.18*outward,0,-sideZ*.18*outward);
     if(side===0)quad(walls,p.bottom,q.bottom,q.top,p.top);
     else quad(walls,p.top,q.top,q.bottom,p.bottom);
     quad(walls,p.top,q.top,q.top.clone().add(inset),p.top.clone().add(inset));
    }
    segments++;
   }
  }
 }
 const mesh=(name:string,positions:number[],color:number)=>{
  if(!positions.length)return;
  const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const object=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color,roughness:1,side:THREE.DoubleSide}));
  object.name=name;object.castShadow=true;object.receiveShadow=true;group.add(object);
 };
 mesh('summerfest-ramp-earthfill',earth,0x86745c);mesh('summerfest-ramp-retaining-walls',walls,0xaaa69d);
 group.userData.sourceWayIds=profiles.routes.filter(r=>r.changed&&!r.source.bridge&&r.source.highway==='motorway_link').map(r=>r.source.id);
 group.userData.segments=segments;group.userData.bridgeCrossingsSkipped=bridgeCrossingsSkipped;
 group.userData.interpretation='Estimated earth fill and 18 cm retaining skin inside mapped nonbridge ramp widths; source bridge corridors and street mouths kept open.';
 return group;
}
