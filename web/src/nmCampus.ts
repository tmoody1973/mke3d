import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NM_SITE as SITE, NM_PARTS } from './nmSite.ts';
import { buildNMTower } from './nmTower.ts';
import { addNMNameSign } from './nmSign.ts';
import { nmGlassReflections } from './nmEnvironment.ts';

type XZ = readonly [number, number];
type Part = { id: number; levels: number; minLevel: number; material: string; footprint: readonly XZ[]; height?: number };
function slab(points: readonly XZ[], bottom: number, top: number) {
  const shape = new THREE.Shape();
  points.forEach(([x,z],i) => { if(i) shape.lineTo(x-SITE.x, SITE.z-z); else shape.moveTo(x-SITE.x, SITE.z-z); });
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, {depth: top-bottom, bevelEnabled:false});
  g.rotateX(-Math.PI/2); g.translate(0,bottom,0); return g;
}
function bar(a: XZ, b: XZ, y: number, width: number, height: number) {
  const g = new THREE.BoxGeometry(Math.hypot(b[0]-a[0],b[1]-a[1]), height, width);
  g.rotateY(-Math.atan2(b[1]-a[1],b[0]-a[0]));
  g.translate((a[0]+b[0])/2-SITE.x, y, (a[1]+b[1])/2-SITE.z); return g;
}
function column(x: number,z: number,bottom: number,top: number,width: number) {
  const g = new THREE.BoxGeometry(width,top-bottom,width); g.translate(x-SITE.x,(bottom+top)/2,z-SITE.z); return g;
}
function add(root: THREE.Group, parts: THREE.BufferGeometry[], material: THREE.Material, name: string) {
  if(!parts.length) return;
  const flat = parts.map(g => { const p=g.index?g.toNonIndexed():g.clone();p.deleteAttribute('uv');return p; });
  const geometry = mergeGeometries(flat,false)!;
  const mesh = new THREE.Mesh(geometry,material); mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  parts.forEach(g=>g.dispose());flat.forEach(g=>g.dispose());return mesh;
}

/** Mapped disjoint campus parts replace the single full-height source extrusion.
 * Commons story heights, glazing and terrace details are visual estimates.
 */
export function buildNM(groundAt: (x:number,z:number)=>number): THREE.Group {
  const root = new THREE.Group();root.name='northwestern-mutual';root.position.set(SITE.x,SITE.floor,SITE.z);
  const mapped = Object.values(NM_PARTS) as Part[];
  const tower = buildNMTower({parts: mapped.filter(p=>p.levels>20).map(p=>({
    id:p.id, polygon:p.footprint.map(([x,z])=>[x-SITE.x,z-SITE.z] as [number,number]),
    height:(p.height??167.64)*169/167.64,
    minHeight:p.minLevel*3.7,
  })),height:169});
  addNMNameSign(tower); root.add(tower);
  const glass = new THREE.MeshStandardMaterial({color:0x65828a,metalness:.26,roughness:.32});
  const stone = new THREE.MeshStandardMaterial({color:0xc6c8c3,roughness:.86});
  const metal = new THREE.MeshStandardMaterial({color:0x657575,metalness:.45,roughness:.44});
  const roof = new THREE.MeshStandardMaterial({color:0x788382,roughness:.92});
  const lit = new THREE.MeshBasicMaterial({color:0xf5ddb0,transparent:true,opacity:0,depthWrite:false});
  const glazing:THREE.BufferGeometry[]=[],opaque:THREE.BufferGeometry[]=[],frames:THREE.BufferGeometry[]=[],roofs:THREE.BufferGeometry[]=[],windows:THREE.BufferGeometry[]=[];
  const commons: {id:number;bottom:number;top:number}[]=[];
  for(const part of mapped.filter(p=>p.levels<=6)) {
    const top = part.height ?? part.levels*3.7;
    const bottom = part.minLevel ? part.minLevel*3.7 : .05;
    if(top<=bottom) continue;
    commons.push({id:part.id,bottom,top});
    (part.material==='glass'?glazing:opaque).push(slab(part.footprint,bottom,top));
    roofs.push(slab(part.footprint,top,top+.22));
    if(!part.minLevel){
      const base = Math.min(-.1,...part.footprint.map(([x,z])=>groundAt(x,z)-SITE.floor))-.15;
      opaque.push(slab(part.footprint,base,.05));
    }
    for(let edge=0;edge<part.footprint.length-1;edge++) {
      const a=part.footprint[edge],b=part.footprint[edge+1],length=Math.hypot(b[0]-a[0],b[1]-a[1]);
      if(length<.2) continue;
      const bays=Math.max(1,Math.ceil(length/2.7));
      for(let i=0;i<bays;i++) {
        const t=i/bays,x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t;
        frames.push(column(x,z,bottom,top,.095));
        if(part.minLevel===1 && i%4===0) opaque.push(column(x,z,0,bottom,.36));
        // A few occupied bays, placed independently of geometry density.
        if(part.material==='glass' && (part.id+edge*7+i*13)%17===0 && length>5) {
          const u=(i+.15)/bays,v=(i+.85)/bays;
          const start:XZ=[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];
          const end:XZ=[a[0]+(b[0]-a[0])*v,a[1]+(b[1]-a[1])*v];
          windows.push(bar(start,end,bottom+Math.min(2,(top-bottom)/2),.16,Math.min(1.4,top-bottom-.2)));
        }
      }
      if(part.material==='glass') for(let y=bottom+3.2;y<top;y+=3.2) {
        frames.push(bar(a,b,y,.16,.18));
        frames.push(bar(a,b,y+1.4,.11,.07));
      }
      frames.push(bar(a,b,top,.17,.22));
    }
  }
  add(root,glazing,glass,'nm-commons-glazing');add(root,opaque,stone,'nm-commons-stone-foundations');
  add(root,frames,metal,'nm-commons-curtainwall-frames');add(root,roofs,roof,'nm-commons-roofs');
  const occupied=add(root,windows,lit,'nm-commons-occupied-bays');
  const reflect=nmGlassReflections(root);
  root.userData.commonsParts=commons;
  root.userData.setLightingMode=(mode:string)=>{
    reflect(mode);
    tower.userData.setLightingMode?.(mode);lit.opacity=mode==='night'?.38:mode==='sunset'?.16:0;
    if(occupied)occupied.visible=lit.opacity>0;
  };
  root.userData.setLightingMode('day');return root;
}
