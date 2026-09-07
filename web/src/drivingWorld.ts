import * as THREE from 'three';
import type { DriveState } from './drivingPhysics';

type Tri = { a: THREE.Vector3; b: THREE.Vector3; c: THREE.Vector3; minX: number; maxX: number; minZ: number; maxZ: number };
type SurfaceKind = 'road' | 'building' | 'terrain' | 'water';
const CELL = 64, CACHE_RADIUS = 650, CACHE_SHIFT = 250, HALF_LENGTH = 4.15, HALF_WIDTH = 1.25;

function key(x: number, z: number) { return `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`; }
function addToGrid(grid: Map<string, Tri[]>, t: Tri) {
  for (let ix = Math.floor(t.minX / CELL); ix <= Math.floor(t.maxX / CELL); ix++)
    for (let iz = Math.floor(t.minZ / CELL); iz <= Math.floor(t.maxZ / CELL); iz++) {
      const k = `${ix},${iz}`, bucket = grid.get(k);
      if (bucket) bucket.push(t); else grid.set(k, [t]);
    }
}
function heightAt(t: Tri, x: number, z: number): number | undefined {
  const d = (t.b.z - t.c.z) * (t.a.x - t.c.x) + (t.c.x - t.b.x) * (t.a.z - t.c.z);
  if (Math.abs(d) < 1e-8) return undefined;
  const u = ((t.b.z - t.c.z) * (x - t.c.x) + (t.c.x - t.b.x) * (z - t.c.z)) / d;
  const v = ((t.c.z - t.a.z) * (x - t.c.x) + (t.a.x - t.c.x) * (z - t.c.z)) / d;
  const w = 1 - u - v;
  return u >= -1e-5 && v >= -1e-5 && w >= -1e-5 ? u * t.a.y + v * t.b.y + w * t.c.y : undefined;
}
function insideBody(x: number, z: number, s: DriveState) {
  const dx = x - s.x, dz = z - s.z, sin = Math.sin(s.yaw), cos = Math.cos(s.yaw);
  const side = dx * cos - dz * sin, forward = -dx * sin - dz * cos;
  return Math.abs(side) <= HALF_WIDTH && Math.abs(forward) <= HALF_LENGTH;
}
function segmentsCross(ax:number,az:number,bx:number,bz:number,cx:number,cz:number,dx:number,dz:number) {
  const orient=(px:number,pz:number,qx:number,qz:number,rx:number,rz:number)=>(qx-px)*(rz-pz)-(qz-pz)*(rx-px);
  const a=orient(ax,az,bx,bz,cx,cz),b=orient(ax,az,bx,bz,dx,dz),c=orient(cx,cz,dx,dz,ax,az),d=orient(cx,cz,dx,dz,bx,bz);
  const overlap=Math.max(Math.min(ax,bx),Math.min(cx,dx))<=Math.min(Math.max(ax,bx),Math.max(cx,dx))+1e-8
    &&Math.max(Math.min(az,bz),Math.min(cz,dz))<=Math.min(Math.max(az,bz),Math.max(cz,dz))+1e-8;
  return overlap&&a*b<=1e-10&&c*d<=1e-10;
}

export interface DrivingWorld {
  sampleRoad(x: number, z: number, nearY?: number): number | undefined;
  resolve(previous: DriveState, next: DriveState): { x: number; y: number; z: number; blocked: boolean };
  findSpawn(x: number, z: number): { x: number; y: number; z: number; yaw: number } | undefined;
  cameraPosition(target: THREE.Vector3, desired: THREE.Vector3): THREE.Vector3;
}

export function createDrivingWorld(tiles: THREE.Group, environment?: THREE.Group): DrivingWorld {
  let cacheSignature = '', cacheX = Infinity, cacheZ = Infinity;
  let roads = new Map<string, Tri[]>(), buildings = new Map<string, Tri[]>(), roadList: Tri[] = [];
  let terrain = new Map<string, Tri[]>(), water = new Map<string, Tri[]>(), coverage: THREE.Box3[] = [];
  function ensure(x:number,z:number) {
    tiles.updateWorldMatrix(true,true);
    const nearby:THREE.Mesh[]=[];const signatureParts:string[]=[];
    const surfaceKinds=new Map<THREE.Mesh,SurfaceKind>();
    const tileBounds=new Map<THREE.Object3D,THREE.Box3>();
    tiles.traverse(object => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !['ROAD', 'HWAY', 'BLDG'].includes(mesh.name)) return;
      if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
      const box=mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
      // Each streamed tile has one group. Direct mesh roots remain useful for small worlds.
      let tile:THREE.Object3D=mesh;
      while(tile.parent&&tile.parent!==tiles)tile=tile.parent;
      if(tile===mesh)tile=tiles;
      const bounds=tileBounds.get(tile);
      if(bounds)bounds.union(box);else tileBounds.set(tile,box.clone());
      if(box.max.x<x-CACHE_RADIUS||box.min.x>x+CACHE_RADIUS||box.max.z<z-CACHE_RADIUS||box.min.z>z+CACHE_RADIUS)return;
      nearby.push(mesh);
      surfaceKinds.set(mesh,mesh.name==='BLDG'?'building':'road');
      const position=mesh.geometry.getAttribute('position') as THREE.BufferAttribute|undefined;
      signatureParts.push(`${mesh.id}:${mesh.geometry.id}:${position?.version||0}:${mesh.geometry.index?.version||0}:${mesh.matrixWorld.elements.join(',')}`);
    });
    if(environment)environment.traverse(object=>{
      const mesh=object as THREE.Mesh;
      if(!mesh.isMesh)return;
      const tagged=mesh.userData.drivingSurface;
      const kind:SurfaceKind|undefined=tagged==='road'||tagged==='building'?tagged
        :mesh.name==='TERRAIN'?'terrain':mesh.name==='WATER'?'water':undefined;
      if(!kind)return;
      mesh.updateWorldMatrix(true,false);
      if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
      const box=mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
      if(box.max.x<x-CACHE_RADIUS||box.min.x>x+CACHE_RADIUS||box.max.z<z-CACHE_RADIUS||box.min.z>z+CACHE_RADIUS)return;
      nearby.push(mesh);
      surfaceKinds.set(mesh,kind);
      const position=mesh.geometry.getAttribute('position') as THREE.BufferAttribute|undefined;
      signatureParts.push(`${kind}:${mesh.id}:${mesh.geometry.id}:${position?.version||0}:${mesh.geometry.index?.version||0}:${mesh.matrixWorld.elements.join(',')}`);
    });
    coverage=[...tileBounds.values()];
    const signature=signatureParts.join('|'), moved=Math.hypot(x-cacheX,z-cacheZ)>CACHE_SHIFT;
    if(!moved&&signature===cacheSignature)return;
    cacheSignature=signature;cacheX=x;cacheZ=z;roads=new Map();buildings=new Map();roadList=[];terrain=new Map();water=new Map();
    for(const mesh of nearby){
      const p = mesh.geometry.getAttribute('position'); if (!p) continue;
      const index = mesh.geometry.index, count = index ? index.count : p.count;
      for (let i = 0; i + 2 < count; i += 3) {
        const vertex = (at: number) => new THREE.Vector3().fromBufferAttribute(p, index ? index.getX(at) : at).applyMatrix4(mesh.matrixWorld);
        const a=vertex(i),b=vertex(i+1),c=vertex(i+2);
        const t={a,b,c,minX:Math.min(a.x,b.x,c.x),maxX:Math.max(a.x,b.x,c.x),minZ:Math.min(a.z,b.z,c.z),maxZ:Math.max(a.z,b.z,c.z)};
        if(t.maxX<x-CACHE_RADIUS||t.minX>x+CACHE_RADIUS||t.maxZ<z-CACHE_RADIUS||t.minZ>z+CACHE_RADIUS)continue;
        const kind=surfaceKinds.get(mesh);
        if (kind === 'building') addToGrid(buildings,t);
        else if(kind==='terrain')addToGrid(terrain,t);
        else if(kind==='water')addToGrid(water,t);
        else { addToGrid(roads,t); roadList.push(t); }
      }
    }
  }
  function sampleGrid(grid:Map<string,Tri[]>,x:number,z:number,nearY?:number) {
    const hits:number[]=[];
    for(const t of grid.get(key(x,z))||[]){const y=heightAt(t,x,z);if(y!==undefined)hits.push(y);}
    if(!hits.length)return undefined;
    if(nearY===undefined)return Math.min(...hits);
    hits.sort((a,b)=>Math.abs(a-nearY)-Math.abs(b-nearY));
    return hits[0];
  }
  function sampleCached(x:number,z:number,nearY?:number) {return sampleGrid(roads,x,z,nearY);}
  function sampleGround(x:number,z:number,nearY:number) {
    const road=sampleCached(x,z,nearY);
    if(road!==undefined)return road;
    if(!environment||!coverage.some(box=>x>=box.min.x&&x<=box.max.x&&z>=box.min.z&&z<=box.max.z))return undefined;
    const ground=sampleGrid(terrain,x,z,nearY);
    if(ground===undefined)return undefined;
    for(const t of water.get(key(x,z))||[]){const surface=heightAt(t,x,z);if(surface!==undefined&&surface>ground)return undefined;}
    return ground;
  }
  function sampleRoad(x:number,z:number,nearY?:number) { ensure(x,z);return sampleCached(x,z,nearY); }
  function buildingHit(s:DriveState) {
    const radius=HALF_LENGTH, seen=new Set<Tri>();
    for(let ix=Math.floor((s.x-radius)/CELL);ix<=Math.floor((s.x+radius)/CELL);ix++)for(let iz=Math.floor((s.z-radius)/CELL);iz<=Math.floor((s.z+radius)/CELL);iz++)
      for(const t of buildings.get(`${ix},${iz}`)||[]){
        if(seen.has(t))continue;seen.add(t);
        const low=Math.min(t.a.y,t.b.y,t.c.y),high=Math.max(t.a.y,t.b.y,t.c.y);
        if(high<s.y+.15||low>s.y+3.7)continue;
        const vs=[t.a,t.b,t.c];if(vs.some(v=>insideBody(v.x,v.z,s)))return true;
        const sin=Math.sin(s.yaw),cos=Math.cos(s.yaw), corners=[[-HALF_WIDTH,-HALF_LENGTH],[HALF_WIDTH,-HALF_LENGTH],[HALF_WIDTH,HALF_LENGTH],[-HALF_WIDTH,HALF_LENGTH]].map(([side,fwd])=>({x:s.x+side*cos-fwd*sin,z:s.z-side*sin-fwd*cos}));
        for(let e=0;e<3;e++)for(let j=0;j<4;j++)if(segmentsCross(vs[e].x,vs[e].z,vs[(e+1)%3].x,vs[(e+1)%3].z,corners[j].x,corners[j].z,corners[(j+1)%4].x,corners[(j+1)%4].z))return true;
      }
    return false;
  }
  function resolveCached(previous:DriveState,next:DriveState) {
    // Centre, axles and all four footprint corners stay on loaded, dry, supported ground.
    const sin=Math.sin(next.yaw),cos=Math.cos(next.yaw);
    const samples:[number,number][]=[
      [next.x,next.z],[next.x+2.8*sin,next.z+2.8*cos],[next.x-2.8*sin,next.z-2.8*cos],
      [next.x+HALF_WIDTH*cos+HALF_LENGTH*sin,next.z-HALF_WIDTH*sin+HALF_LENGTH*cos],
      [next.x-HALF_WIDTH*cos+HALF_LENGTH*sin,next.z+HALF_WIDTH*sin+HALF_LENGTH*cos],
      [next.x+HALF_WIDTH*cos-HALF_LENGTH*sin,next.z-HALF_WIDTH*sin-HALF_LENGTH*cos],
      [next.x-HALF_WIDTH*cos-HALF_LENGTH*sin,next.z+HALF_WIDTH*sin-HALF_LENGTH*cos]
    ];
    const heights=samples.map(([x,z])=>sampleGround(x,z,previous.y));
    if(heights.some(y=>y===undefined))return{x:previous.x,y:previous.y,z:previous.z,blocked:true};
    const hs=heights as number[], min=Math.min(...hs),max=Math.max(...hs),center=hs[0];
    if(max-min>1.8||Math.abs(center-previous.y)>1.25||buildingHit({...next,y:center}))return{x:previous.x,y:previous.y,z:previous.z,blocked:true};
    return{x:next.x,y:center,z:next.z,blocked:false};
  }
  function resolve(previous:DriveState,next:DriveState) { ensure(next.x,next.z);return resolveCached(previous,next); }
  function findSpawn(x:number,z:number) {
    ensure(x,z);
    const candidates:{score:number,x:number,y:number,z:number}[]=[];
    for(const t of roadList){
      const cx=(t.a.x+t.b.x+t.c.x)/3,cz=(t.a.z+t.b.z+t.c.z)/3,dist=Math.hypot(cx-x,cz-z);if(dist>400)continue;
      const area=Math.abs((t.b.x-t.a.x)*(t.c.z-t.a.z)-(t.b.z-t.a.z)*(t.c.x-t.a.x))/2;
      if(area<8)continue;
      const y=(t.a.y+t.b.y+t.c.y)/3;
      const score=dist-Math.min(area,400)*.2+Math.abs(y)*2;
      candidates.push({score,x:cx,y,z:cz});
    }
    candidates.sort((a,b)=>a.score-b.score);
    let fallback:{runway:number,x:number,y:number,z:number,yaw:number}|undefined;
    for(const candidate of candidates.slice(0,128)){
      for(let direction=0;direction<16;direction++){
        const yaw=direction*Math.PI/8;
        let state:DriveState={x:candidate.x,y:candidate.y,z:candidate.z,yaw,speed:0,steer:0,distance:0},runway=0;
        if(resolveCached(state,state).blocked)continue;
        for(let distance=2;distance<=24;distance+=2){
          const next={...state,x:candidate.x-Math.sin(yaw)*distance,z:candidate.z-Math.cos(yaw)*distance};
          const result=resolveCached(state,next);if(result.blocked)break;
          state={...next,x:result.x,y:result.y,z:result.z};runway=distance;
        }
        if(!fallback||runway>fallback.runway)fallback={runway,x:candidate.x,y:candidate.y,z:candidate.z,yaw};
        if(runway>=24)return{x:candidate.x,y:candidate.y,z:candidate.z,yaw};
      }
    }
    return fallback&&fallback.runway>=10?{x:fallback.x,y:fallback.y,z:fallback.z,yaw:fallback.yaw}:undefined;
  }
  function cameraPosition(target:THREE.Vector3,desired:THREE.Vector3) {
    const mid=target.clone().add(desired).multiplyScalar(.5);ensure(mid.x,mid.z);
    const direction=desired.clone().sub(target),length=direction.length();if(length<1e-6)return desired.clone();direction.divideScalar(length);
    const ray=new THREE.Ray(target,direction);let nearest=length;
    const radius=length*.5, seen=new Set<Tri>();
    for(let ix=Math.floor((mid.x-radius)/CELL);ix<=Math.floor((mid.x+radius)/CELL);ix++)for(let iz=Math.floor((mid.z-radius)/CELL);iz<=Math.floor((mid.z+radius)/CELL);iz++)for(const grid of [buildings,roads])for(const t of grid.get(`${ix},${iz}`)||[]){
      if(seen.has(t))continue;seen.add(t);const hit=ray.intersectTriangle(t.a,t.b,t.c,false,new THREE.Vector3());const distance=hit?.distanceTo(target);
      if(distance!==undefined&&distance>.2)nearest=Math.min(nearest,distance);
    }
    return nearest<length?target.clone().addScaledVector(direction,Math.max(.5,nearest-.5)):desired.clone();
  }
  return {sampleRoad,resolve,findSpawn,cameraPosition};
}
