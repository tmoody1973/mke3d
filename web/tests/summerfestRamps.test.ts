import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {prepareSummerfestTerrain,adaptSummerfestTile} from '../src/summerfestSite.ts';
import {prepareHoanTerrain} from '../src/hoanSite.ts';
import {bilinearTerrainHeight} from '../src/localTerrain.ts';
import {summerfestRampProfiles,buildSummerfestRampEmbankments} from '../src/summerfestRamps.ts';

const base=new URL('../public/data/',import.meta.url);
const terrainBuffer=readFileSync(new URL('terrain.bin',base)),nx=terrainBuffer.readUInt32LE(4),ny=terrainBuffer.readUInt32LE(8);
const raw={nx,ny,x0:terrainBuffer.readFloatLE(12),y0:terrainBuffer.readFloatLE(16),step:terrainBuffer.readFloatLE(20),
 heights:new Float32Array(terrainBuffer.buffer.slice(terrainBuffer.byteOffset+24,terrainBuffer.byteOffset+24+nx*ny*4)),colors:new Uint8Array(nx*ny*3)};
const fixed=prepareSummerfestTerrain(prepareHoanTerrain(raw)),ground=(x:number,z:number)=>bilinearTerrainHeight(fixed,x,z);
function load(j:number){
 const b=readFileSync(new URL(`tiles/t_0_${j}.bin`,base)),g=new THREE.Group();let o=12;
 for(let i=0;i<b.readUInt32LE(8);i++){
  const name=b.toString('ascii',o,o+4),count=b.readUInt32LE(o+4),origin=[8,12,16].map(k=>b.readFloatLE(o+k)),scale=b.readFloatLE(o+20);o+=24;
  if(['ROAD','HWAY'].includes(name)){
   const p=new Float32Array(count*3);for(let k=0;k<p.length;k++)p[k]=origin[k%3]+b.readInt16LE(o+k*2)*scale;
   const mesh=new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(p,3)));mesh.name=name;g.add(mesh);
  }
  o=Math.ceil((o+count*6)/4)*4;o=Math.ceil((o+count*3)/4)*4;
 }return g;
}
function sampleIndex(groups:THREE.Group[],name='ROAD'){
 const cells=new Map<string,number[][]>();
 for(const group of groups)for(const mesh of group.children as THREE.Mesh[]){if(mesh.name!==name)continue;const p=mesh.geometry.getAttribute('position');
  for(let i=0;i<p.count;i+=3){const t=[0,1,2].flatMap(k=>[p.getX(i+k),p.getY(i+k),p.getZ(i+k)]);
   const x0=Math.floor(Math.min(t[0],t[3],t[6])/40),x1=Math.floor(Math.max(t[0],t[3],t[6])/40),z0=Math.floor(Math.min(t[2],t[5],t[8])/40),z1=Math.floor(Math.max(t[2],t[5],t[8])/40);
   for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const key=`${x},${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key)!.push(t);}
  }
 }
 return(x:number,z:number)=>{const ys:number[]=[];for(const a of cells.get(`${Math.floor(x/40)},${Math.floor(z/40)}`)||[]){
  const bx=a[3]-a[0],bz=a[5]-a[2],cx=a[6]-a[0],cz=a[8]-a[2],det=bx*cz-bz*cx;if(Math.abs(det)<1e-8)continue;
  const u=((x-a[0])*cz-(z-a[2])*cx)/det,v=(bx*(z-a[2])-bz*(x-a[0]))/det;
  if(u>=-.003&&v>=-.003&&u+v<=1.003)ys.push(a[1]+u*(a[4]-a[1])+v*(a[7]-a[1]));
 }return ys;};
}
const groups=[load(0),load(-1)],before=sampleIndex(groups);
groups.forEach((group,k)=>adaptSummerfestTile(group,{i:0,j:-k},ground,raw,fixed));
const after=sampleIndex(groups),profiles=summerfestRampProfiles(raw,fixed);
const closest=(ys:number[],target:number)=>ys.reduce((best,y)=>Math.abs(y-target)<Math.abs(best-target)?y:best,Infinity);

test('three reported artificial ramp cliffs are continuous after the complete terrain adapter',()=>{
 const pairs=[
  {id:766550389,a:[298.7280299384937,-15.699362998388178],b:[299.7365482877856,-13.972258271065122]},
  {id:572477370,a:[316.7694563982923,-12.375366436834312],b:[315.7604621961681,-14.097366345343785]},
  {id:572477385,a:[455.348449276061,-50.227241351952415],b:[455.91237655238353,-52.14609153553098]},
 ];
 for(const {id,a,b}of pairs){
  const route=profiles.routes.find(r=>r.source.id===id)!;
  const y=[a,b].map(([x,z])=>closest(after(x,z),profiles.target(route,x,z)));
  assert.ok(y.every(Number.isFinite),`missing approach ${id}`);
  assert.ok(Math.abs(y[1]-y[0])<.35,`remaining 2m-sample height cliff on ${id}: ${y}`);
  for(const [x,z]of [a,b])assert.ok(Math.abs(closest(after(x,z),profiles.target(route,x,z))-profiles.target(route,x,z))<.16);
 }
});

test('source-connected ramp endpoints share heights and preserve actual bridge anchors',()=>{
 let bridgeMouths=0,groundMouths=0;
 for(const route of profiles.routes){if(!route.changed||route.source.highway!=='motorway_link')continue;
  for(const i of [0,route.nodes.length-1]){
   const n=route.nodes[i];
   for(const other of profiles.routes){if(!other.changed)continue;for(const q of other.nodes)if(Math.hypot(q.x-n.x,q.z-n.z)<.0001)assert.ok(Math.abs(n.y-q.y)<.0001);}
   if(n.deck){assert.equal(n.y,n.raw);bridgeMouths++;}
   else if(n.fixed){assert.equal(n.y,n.floor);groundMouths++;}
  }
 }
 assert.ok(bridgeMouths>=4&&groundMouths>=4,`${bridgeMouths} bridge/${groundMouths} street mouths`);
 // Preserve the real overpass while lowering the independent road underneath.
 const x=366.766,z=74.4,a=before(x,z),b=after(x,z);
 assert.ok(a.some(y=>y>16));assert.ok(b.some(y=>y>16)&&b.some(y=>y<4));
 assert.ok(Math.abs(Math.max(...a)-Math.max(...b))<.001);
});

test('all affected source ramp continuations follow their continuous profile across way splits',t=>{
 let checked=0,maxError=0;
 for(const route of profiles.routes){if(!route.changed||route.source.highway!=='motorway_link')continue;
  for(let i=1;i<route.nodes.length;i++){
   const a=route.nodes[i-1],b=route.nodes[i],length=Math.hypot(b.x-a.x,b.z-a.z);
   for(let distance=1;distance<length;distance+=3){
    const f=distance/length,x=a.x+(b.x-a.x)*f,z=a.z+(b.z-a.z)*f;
    if(x<82||x>878||z<-198||z>1658)continue;
    const target=profiles.target(route,x,z),values=[0,-.08,.08].flatMap(dx=>[0,-.08,.08].flatMap(dz=>after(x+dx,z+dz)));
    const error=Math.abs(closest(values,target)-target);maxError=Math.max(maxError,error);checked++;
    assert.ok(error<.4,`way ${route.source.id} misses its profile by ${error}m at ${x},${z}`);
   }
  }
 }
 assert.ok(checked>150);t.diagnostic(`${checked} source-ramp samples; maximum profile error ${maxError.toFixed(3)}m`);
});

test('profile-aware adaptation moves nonbridge HWAY paint together with its road',()=>{
 const changed=groups.flatMap(g=>g.children).filter(o=>o.name==='HWAY').reduce((sum,o)=>sum+(o.userData.summerfestRampMarkings||0),0);
 assert.ok(changed>30,`only ${changed} paint triangles corrected`);
 const paint=sampleIndex(groups,'HWAY');let checked=0;
 for(const route of profiles.routes){if(!route.changed||route.source.highway!=='motorway_link')continue;
  for(let i=1;i<route.nodes.length;i++){
   const a=route.nodes[i-1],b=route.nodes[i],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);if(length<10)continue;
   const x=(a.x+b.x)/2+dz/length*(route.source.width/2-.6),z=(a.z+b.z)/2-dx/length*(route.source.width/2-.6);
   const target=profiles.target(route,x,z)+.14,ys=paint(x,z);
   if(ys.some(y=>Math.abs(y-target)<.2))checked++;
  }
 }
 assert.ok(checked>10,`only ${checked} corrected paint samples lie on the road`);
});

test('descending nonbridge ramps receive bounded retaining walls while bridge corridors stay open',()=>{
 const fill=buildSummerfestRampEmbankments(raw,fixed);fill.updateMatrixWorld(true);
 assert.equal(fill.children.length,2);assert.ok(fill.userData.segments>20);assert.ok(fill.userData.bridgeCrossingsSkipped>0);
 for(const mesh of fill.children as THREE.Mesh[]){const p=mesh.geometry.getAttribute('position');
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);assert.ok(Number.isFinite(x+y+z));assert.ok(x>60&&x<900&&z>-220&&z<1680);}
 }
 const route=profiles.routes.find(r=>r.source.id===572477385)!;
 const x=455.9,z=-52.1,y=profiles.target(route,x,z);
 const hit=new THREE.Raycaster(new THREE.Vector3(x,y-.25,z),new THREE.Vector3(1,0,0),0,12).intersectObject(fill,true);
 assert.ok(hit.length,'the formerly floating ramp must have a side wall directly below its asphalt');
 // This point is on the preserved source bridge, with a separate ground road below.
 const bridgeColumn=new THREE.Raycaster(new THREE.Vector3(366.766,30,74.4),new THREE.Vector3(0,-1,0));
 assert.equal(bridgeColumn.intersectObject(fill,true).length,0,'earth fill must not block the bridge/ground-road crossing');
});
