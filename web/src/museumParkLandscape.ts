import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAMPUS_CONTEXT } from './campusContextData.ts';

/** Planting interpreted from the supplied aerials, constrained to mapped lawn footprints. */
export function parkLawnContains(x:number,z:number,raised:boolean) {
  return CAMPUS_CONTEXT.grass.some(p => {
    if(p.raised !== raised) return false;
    const signs=p.points.map((a,i)=>{const b=p.points[(i+1)%3];return (x-a[0])*(b[1]-a[1])-(z-a[1])*(b[0]-a[0]);});
    return signs.every(v=>v>=-1e-7)||signs.every(v=>v<=1e-7);
  });
}
export function buildMuseumParkLandscape(groundAt:(x:number,z:number)=>number) {
  const root=new THREE.Group(); root.name='museum-raised-park-planting';
  const batches:THREE.BufferGeometry[][]=[[],[],[],[]];
  const sites:{x:number,z:number,base:number,radius:number,raised:boolean,kind:string}[]=[];
  const circleFits=(x:number,z:number,r:number,raised:boolean)=>parkLawnContains(x,z,raised)&&Array.from({length:16},(_,i)=>parkLawnContains(x+Math.cos(i*Math.PI/8)*r,z+Math.sin(i*Math.PI/8)*r,raised)).every(Boolean);
  const add=(geometry:THREE.BufferGeometry,index:number,x:number,y:number,z:number)=>{const g=geometry.index?geometry.toNonIndexed():geometry;g.deleteAttribute('uv');g.translate(x,y,z);batches[index].push(g);};
  const nearExisting=(x:number,z:number)=>CAMPUS_CONTEXT.trees.some(t=>Math.hypot(Number(t[0])-x,Number(t[1])-z)<6);
  for(const raised of [true,false]) {
    for(let z=-585;z<-307;z+=9)for(let x=raised?388:325;x<(raised?532:445);x+=9){
      const xx=x+Math.sin(z*.31+x)*1.7,zz=z+Math.cos(x*.17)*1.6,r=2.5+.45*(1+Math.sin(x+z));
      if(!circleFits(xx,zz,r+.7,raised)||nearExisting(xx,zz))continue;
      // Keep the broad lawn centers open, with trees concentrated around their margins.
      if(circleFits(xx,zz,10,raised)||Math.hypot(xx-522.772,zz+464.3)<13)continue;
      if(sites.some(s=>s.kind==='tree'&&Math.hypot(s.x-xx,s.z-zz)<8))continue;
      const base=raised?10.89:groundAt(xx,zz)+.14,h=6.5+1.4*(1+Math.cos(x*.7+z));
      add(new THREE.CylinderGeometry(.14,.23,h*.68,6),0,xx,base+h*.34,zz);
      const crown=new THREE.IcosahedronGeometry(r,1);crown.scale(1,1.15,1);
      add(crown,(Math.round(x+z)%2===0)?1:2,xx,base+h*.72,zz);
      sites.push({x:xx,z:zz,base,radius:r,raised,kind:'tree'});
    }
    for(let z=-584;z<-309;z+=3.2)for(let x=raised?389:325;x<(raised?532:445);x+=3.2){
      if(!circleFits(x,z,.9,raised)||circleFits(x,z,2.5,raised))continue;
      if(Math.hypot(x-522.772,z+464.3)<11)continue;
      const base=raised?10.89:groundAt(x,z)+.14;
      const shrub=new THREE.IcosahedronGeometry(.72,0);shrub.scale(1,.65,1);
      add(shrub,3,x,base+.4,z);sites.push({x,z,base,radius:.72,raised,kind:'shrub'});
    }
  }
  [0x68503a,0x496336,0x647c40,0x71824d].forEach((color,i)=>{
    if(!batches[i].length)return;
    const mesh=new THREE.Mesh(mergeGeometries(batches[i]),new THREE.MeshStandardMaterial({color,roughness:1}));
    mesh.name=['park-tree-trunks','park-tree-canopies','park-tree-canopies-light','park-low-planting'][i];
    mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);batches[i].forEach(g=>g.dispose());
  });
  root.userData.plantingSites=sites;root.userData.source='Supplied Google Earth aerials; interpreted planting, mapped lawn constraints';
  return root;
}
