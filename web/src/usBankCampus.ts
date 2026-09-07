import * as THREE from 'three';
import { buildUsBank } from './usBank.ts';
import { US_BANK_SITE as site, US_BANK_PARTS } from './usBankSite.ts';
import { districtGeometry } from './districtGeometry.ts';
import { addMichiganPassage } from './usBankPassage.ts';

/** Mapped Galleria and shaft share a single local metre frame. */
export function buildUsBankCampus(groundAt:(x:number,z:number)=>number){
  const root=buildUsBank(site),batch=districtGeometry(root);
  const inverse=new THREE.Matrix4().makeRotationY(-site.bearing);
  const local=(x:number,z:number)=>new THREE.Vector3(x-site.x,0,z-site.z).applyMatrix4(inverse);
  const stone=new THREE.MeshStandardMaterial({color:0xd3cbbb,roughness:.84});
  const frame=new THREE.MeshStandardMaterial({color:0xd9dfd9,roughness:.52,metalness:.25});
  const glass=new THREE.MeshPhongMaterial({color:0x698b91,shininess:65,emissive:0x000000,side:THREE.DoubleSide});
  const roof=new THREE.MeshStandardMaterial({color:0x999f9b,roughness:.85});
  const northRoof=Math.max(...US_BANK_PARTS.northGalleria.footprint.map(([x,z])=>groundAt(x,z)-site.floor))+US_BANK_PARTS.northGalleria.height;
  function polygon(points:THREE.Vector3[],bottom:number,top:number,material:THREE.Material,name:string){
    const shape=new THREE.Shape();points.forEach((p,i)=>i?shape.lineTo(p.x,-p.z):shape.moveTo(p.x,-p.z));shape.closePath();
    const g=new THREE.ExtrudeGeometry(shape,{depth:top-bottom,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,bottom,0);batch.add(g,material,name);
  }
  for(const [key,part] of Object.entries(US_BANK_PARTS)){
    const points=part.footprint.map(([x,z])=>local(x,z));
    const grades=part.footprint.map(([x,z])=>groundAt(x,z)-site.floor).filter(Number.isFinite);
    const grade=grades.length?Math.max(...grades):0,bottom=Math.min(-.5,...grades)-.15;
    const raised=key==='southRaisedGalleria';
    // Michigan Street passes beneath this entire mapped building part. A
    // building:min_level is an open volume, never a solid foundation.
    // Clearance/member sizes are an interpretation, not a posted road limit.
    const floor=raised?grade+5.2:grade+part.minLevel*3.3;
    const top=key.startsWith('south')?Math.max(northRoof,grade+part.height,floor+4.4):grade+part.height;
    if(raised){
      polygon(points,floor,floor+.55,stone,'us-bank-galleria-travertine');
      const bounds=new THREE.Box3().setFromPoints(points);
      for(const z of [bounds.min.z+1.2,bounds.max.z-1.2])for(let x=bounds.min.x+1.2;x<bounds.max.x;x+=11.7){
        const world=new THREE.Vector3(x,0,z).applyAxisAngle(new THREE.Vector3(0,1,0),site.bearing);
        const foot=groundAt(world.x+site.x,world.z+site.z)-site.floor-.2;
        batch.box(x,(foot+floor)/2,z,1.05,floor-foot,1.05,stone,'us-bank-galleria-travertine');
      }
      root.userData.michiganPassage={floor:floor+site.floor,roof:top+site.floor,clearanceApproximate:true};
    }else polygon(points,bottom,Math.max(bottom+.3,floor+.28),stone,'us-bank-galleria-travertine');
    polygon(points,top-.3,top,roof,'us-bank-galleria-roofs');
    for(let i=0;i<points.length-1;i++){
      const a=points[i],b=points[i+1],length=a.distanceTo(b);if(length<.5)continue;
      const n=Math.max(1,Math.round(length/4.3));
      const at=(t:number,y:number)=>a.clone().lerp(b,t).setY(y);
      for(let j=0;j<n;j++){
        const glazingBottom=floor+(raised?.55:.3);
        const p=at(j/n,glazingBottom),q=at((j+1)/n,glazingBottom),r=at((j+1)/n,top-.35),s=at(j/n,top-.35);
        const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([...p.toArray(),...q.toArray(),...r.toArray(),...p.toArray(),...r.toArray(),...s.toArray()],3));g.computeVertexNormals();batch.add(g,glass,'us-bank-galleria-glass');
        batch.beam(at(j/n,floor),at(j/n,top),.2,frame,'us-bank-galleria-mullions');
      }
      for(const y of [floor,top, ...(part.levels===2?[(floor+top)/2]:[])])batch.beam(at(0,y),at(1,y),.35,frame,'us-bank-galleria-mullions');
    }
    if(key==='northGalleria'){
      const bounds=new THREE.Box3().setFromPoints(points),y=top+.12;
      // The Wisconsin Avenue Galleria's repeated glazed pyramid skylights.
      for(let x=bounds.min.x+3;x<bounds.max.x-2;x+=4.7){
        const z=bounds.min.z+3,peak=new THREE.Vector3(x,y+2,z);
        const corners=[[-1.9,-1.9],[1.9,-1.9],[1.9,1.9],[-1.9,1.9]].map(([dx,dz])=>new THREE.Vector3(x+dx,y,z+dz));
        for(let i=0;i<4;i++){
          const a=corners[i],b=corners[(i+1)%4],g=new THREE.BufferGeometry();
          g.setAttribute('position',new THREE.Float32BufferAttribute([...a.toArray(),...b.toArray(),...peak.toArray()],3));g.computeVertexNormals();batch.add(g,glass,'us-bank-galleria-glass');
          batch.beam(a,peak,.1,frame,'us-bank-galleria-mullions');batch.beam(a,b,.12,frame,'us-bank-galleria-mullions');
        }
      }
    }
  }
  batch.finish();
  // Only this explicitly modeled structure participates in vehicle collision;
  // its empty passage stays empty, while its columns and walls remain solid.
  for(const child of root.children)if(child.name.startsWith('us-bank-galleria-'))child.userData.drivingSurface='building';
  addMichiganPassage(root,groundAt);
  const lighting=root.userData.setLightingMode;
  root.userData.setLightingMode=(mode:'day'|'sunset'|'night')=>{lighting(mode);glass.emissive.setHex(0x9f8158);glass.emissiveIntensity=mode==='night'?.18:mode==='sunset'?.04:0;};
  addUsBankSigns(root);
  root.position.set(site.x,site.floor,site.z);root.rotation.y=site.bearing;
  return root;
}

function addUsBankSigns(root:THREE.Group){
  if(typeof document==='undefined')return;
  const materials:THREE.MeshBasicMaterial[]=[];
  for(const side of [-1,1]){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=192;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#132d62';ctx.fillRect(0,0,1024,192);
    ctx.fillStyle='#ffffff';ctx.font='120px Georgia, serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('BAIRD',512,102);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.MeshBasicMaterial({map:texture});materials.push(material);
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(28,5.8),material);sign.position.set(0,179.05,side*(site.depth/2+.14));sign.rotation.y=side<0?Math.PI:0;sign.name=`us-bank-baird-${side<0?'north':'south'}-crown-sign`;root.add(sign);
  }
  const material=new THREE.MeshBasicMaterial({color:0xffffff});materials.push(material);
  new THREE.ImageLoader().load('/signs/us-bank.svg',image=>{
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=286;const ctx=canvas.getContext('2d')!;
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1024,286);ctx.drawImage(image,30,15,964,256);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;material.map=texture;material.needsUpdate=true;
  });
  for(const side of [-1,1]){const sign=new THREE.Mesh(new THREE.PlaneGeometry(21.5,5.8),material);sign.position.set(side*(site.width/2+.14),179.05,0);sign.rotation.y=side*Math.PI/2;sign.name=`us-bank-${side<0?'west':'east'}-crown-sign`;root.add(sign);}
  const lighting=root.userData.setLightingMode;
  root.userData.setLightingMode=(mode:'day'|'sunset'|'night')=>{lighting(mode);for(const m of materials)m.color.setScalar(mode==='night'?.65:mode==='sunset'?.85:1);};
}
