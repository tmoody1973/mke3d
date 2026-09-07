import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FISERV_SITE as SITE } from './fiservSite.ts';

const HEIGHT = 128 * .3048;
type Point = [number, number, number];
function box(x:number,y:number,z:number,w:number,h:number,d:number) {
  const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);return g;
}
function beam(a:Point,b:Point,w:number,d=w) {
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),v=end.clone().sub(start);
  const g=new THREE.BoxGeometry(w,v.length(),d);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));
  g.translate(...start.add(end).multiplyScalar(.5).toArray());return g;
}
function quad(a:Point,b:Point,c:Point,d:Point) {
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([...a,...b,...c,...a,...c,...d],3));g.computeVertexNormals();return g;
}
function merged(root:THREE.Group,parts:THREE.BufferGeometry[],material:THREE.Material,name:string) {
  const flat=parts.map(g=>{const p=g.index?g.toNonIndexed():g.clone();p.deleteAttribute('uv');return p;});
  const g=mergeGeometries(flat,false)!;const mesh=new THREE.Mesh(g,material);
  mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  parts.forEach(p=>p.dispose());flat.forEach(p=>p.dispose());return mesh;
}
// East entry follows the slanted mapped plaza edge; +Z is south.
const east=(z:number)=>86-.2*z;
const section=new THREE.CatmullRomCurve3([
  new THREE.Vector3(0,27.8,55),new THREE.Vector3(0,35,35),
  new THREE.Vector3(0,HEIGHT,5),new THREE.Vector3(0,37.8,-23),
  new THREE.Vector3(0,30,-49),new THREE.Vector3(0,17,-61),new THREE.Vector3(0,5,-58),
]);

/** Original photo-based exterior, calibrated to the contractor's 128-foot
 * overall height and the cached OSM site. Fine facade dimensions are estimates.
 */
export function buildFiserv(groundAt:(x:number,z:number)=>number=()=>SITE.floor):THREE.Group {
  const root=new THREE.Group();root.name='fiserv-forum';root.position.set(SITE.x,SITE.floor,SITE.z);
  const arena=new THREE.Group();arena.rotation.y=SITE.bearing;root.add(arena);
  const zinc=new THREE.MeshStandardMaterial({color:0x807068,metalness:.28,roughness:.58,side:THREE.DoubleSide});
  const membrane=new THREE.MeshStandardMaterial({color:0xaeb3b3,metalness:.12,roughness:.72,side:THREE.DoubleSide});
  const glass=new THREE.MeshStandardMaterial({
    color:0x688891,metalness:.18,roughness:.26,side:THREE.DoubleSide,
    transparent:true,opacity:.52,depthWrite:false,
  });
  const frame=new THREE.MeshStandardMaterial({color:0x818b87,metalness:.5,roughness:.46});
  const stone=new THREE.MeshStandardMaterial({color:0xc8bfaa,roughness:.9});
  const dark=new THREE.MeshStandardMaterial({color:0x323b3b,roughness:.73});
  const gold=new THREE.MeshStandardMaterial({color:0xb19a66,metalness:.35,roughness:.64,side:THREE.DoubleSide});
  const light=new THREE.MeshBasicMaterial({color:0xffd29a,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
  const shell:THREE.BufferGeometry[]=[],roof:THREE.BufferGeometry[]=[],windows:THREE.BufferGeometry[]=[],metal:THREE.BufferGeometry[]=[],masonry:THREE.BufferGeometry[]=[],recess:THREE.BufferGeometry[]=[],soffit:THREE.BufferGeometry[]=[],lit:THREE.BufferGeometry[]=[];
  const profile=section.getPoints(96);
  // Normalize the interpolated crown too, since cubic interpolation can overshoot.
  const ratio=HEIGHT/Math.max(...profile.map(p=>p.y));profile.forEach(p=>p.y*=ratio);
  // A restrained cross-span fall gives the roof its second direction of curvature:
  // the service-side shoulder sits lower than the plaza overhang while the crown
  // retains the contractor-calibrated height.
  const point=(p:THREE.Vector3,t:number,offset=0):Point=>{
    const edgeFall=1.4*Math.pow(Math.abs(2*t-1),1.6)*(1-t);
    return [-101+(east(p.z)+101)*t,p.y-edgeFall+offset,p.z*(1+.015*Math.sin(Math.PI*t))];
  };
  for(let i=0;i<profile.length-1;i++) {
    const a=profile[i],b=profile[i+1];
    for(let j=0;j<36;j++) {
      const t=j/36,u=(j+1)/36;
      (a.z<-40?shell:roof).push(quad(point(a,t),point(a,u),point(b,u),point(b,t)));
    }
    // Folded zinc edge and a warm soffit under the deep east overhang.
    shell.push(quad(point(a,1),point(b,1),point(b,1,-.8),point(a,1,-.8)));
    if(a.y>28) {
      soffit.push(quad(point(a,.955,-.85),point(b,.955,-.85),point(b,1,-.85),point(a,1,-.85)));
      soffit.push(quad([east(a.z)-.7,a.y-1,a.z],[east(b.z)-.7,b.y-1,b.z],
        [east(b.z)-.7,b.y-1.55,b.z],[east(a.z)-.7,a.y-1.55,a.z]));
    }
    if(i%3===0 && a.z<-40) {
      const start=point(a,0,.06),end=point(a,1,.06);start[2]-=.12;end[2]-=.12;
      metal.push(beam(start,end,.045));
    }
  }
  for(let j=1;j<18;j++) for(let i=0;i<profile.length-1;i++) {
    const a=profile[i],b=profile[i+1],t=j/18;
    metal.push(beam(point(a,t,.055),point(b,t,.055),a.z<-40?.045:.075));
  }
  // Broad, staggered H-seam courses make the zinc read as fabricated panels.
  // They share the frame mesh rather than creating thousands of panel objects.
  for(let i=4;i<profile.length-2;i+=12) {
    const p=profile[i];
    for(let bay=0;bay<12;bay++) {
      const t0=bay/12+(i%12===4?.018:0),t1=Math.min(1,(bay+1)/12+(i%12===4?.018:0));
      if(t0>=1)continue;
      metal.push(beam(point(p,t0,.07),point(p,t1,.07),.065,.045));
    }
  }
  // Three narrow glazing cuts follow the curved north shell instead of flat decals.
  for(const t of [.23,.51,.78]) for(let i=0;i<profile.length-1;i++) {
    const a=profile[i],b=profile[i+1];if(a.z>-44 || a.y<7)continue;
    const aa=point(a,t-.017,.1),bb=point(b,t-.017,.1),cc=point(b,t+.017,.1),dd=point(a,t+.017,.1);
    aa[2]-=.15;bb[2]-=.15;cc[2]-=.15;dd[2]-=.15;
    windows.push(quad(aa,bb,cc,dd));metal.push(beam(aa,dd,.07));
  }
  // Recessed concourse volume prevents views through the entire building.
  recess.push(box(-15,13.5,0,166,27,100));
  masonry.push(box(-101,13,0,1.8,26,110),box(-7,2,0,187,4,112));
  const front=(z:number,y:number,inset=4):Point=>[east(z)-inset,y,z];
  // East atrium: six-storey glass face with a deep structural/interior layer.
  windows.push(quad(front(52,1),front(-41,1),front(-41,29.3),front(52,29.3)));
  for(let z=-41;z<=52;z+=2.6) metal.push(beam(front(z,.4,3.84),front(z,29.3,3.84),.10));
  for(let y=1;y<=29;y+=2.4) metal.push(beam(front(-41,y,3.82),front(52,y,3.82),.09));
  for(const y of [7,14,21]) {
    masonry.push(beam(front(-39,y,7),front(50,y,7),.65,1.5));
    metal.push(beam(front(-41,y,3.7),front(52,y,3.7),.28,.12));
    lit.push(beam(front(-35,y-.7,3.78),front(44,y-.7,3.78),.32,.07));
  }
  // The photographs show a sparse, legible white mega-frame and diagonal circulation.
  for(const z of [-37,-18,2,22,43]) {
    masonry.push(beam(front(z,1,6.7),front(z,28.5,6.7),.58,.58));
  }
  for(const [z0,y0,z1,y1] of [[-32,3,-12,10],[-9,10,11,17],[14,17,34,24]] as const) {
    recess.push(beam(front(z0,y0,6.2),front(z1,y1,6.2),.72,.42));
    metal.push(beam(front(z0,y0+.35,6),front(z1,y1+.35,6),.13,.1));
  }
  for(let z=-37;z<48;z+=5.2) for(const y of [2.9,11,18]) {
    if((Math.round(z*10)+y*10)%3===0) continue;
    if(y>3 && Math.round(z*10)%4===0) continue;
    lit.push(quad(front(z,y-1,3.76),front(z-2.1,y-1,3.76),front(z-2.1,y+1,3.76),front(z,y+1,3.76)));
  }
  // Fill the arch-shaped upper spandrel and solid curled north cheek.
  const outline=new THREE.Shape();profile.forEach((p,i)=>i?outline.lineTo(p.z,p.y-.8):outline.moveTo(p.z,p.y-.8));
  outline.lineTo(-41,4);outline.lineTo(-41,29.3);outline.lineTo(52,29.3);outline.closePath();
  const fascia=new THREE.ShapeGeometry(outline);const pos=fascia.getAttribute('position');
  for(let i=0;i<pos.count;i++){const z=pos.getX(i),y=pos.getY(i);pos.setXYZ(i,east(z)-1,y,z);}fascia.computeVertexNormals();shell.push(fascia);
  // The sign's continuous zinc spandrel drops below the neighboring glass head.
  shell.push(quad(front(25.7,27,1),front(46,27,1),front(46,29.3,1),front(25.7,29.3,1)));
  // Projecting Panorama Club: a deep, long slot with the characteristic stepped end.
  const club:[number,number][]=[[-33,25],[-33,33],[25,33],[19,25]];
  windows.push(quad(front(-33,25,1.3),front(-33,33,1.3),front(25,33,1.3),front(19,25,1.3)));
  club.forEach(([z,y],i)=>{const [zz,yy]=club[(i+1)%4];recess.push(beam(front(z,y,.55),front(zz,yy,.55),.85,1.1));});
  for(let z=-30;z<20;z+=3.3)metal.push(beam(front(z,25.5,.6),front(z,32.5,.6),.09));
  metal.push(beam(front(-32,28.7,.4),front(21,28.7,.4),.14));
  metal.push(beam(front(-33,32.7,.35),front(24,32.7,.35),.22,.18));
  metal.push(beam(front(24,32.7,.35),front(18.5,25.4,.35),.22,.18));
  recess.push(quad(front(-31,26,1.8),front(18,26,1.8),front(21.8,31.8,1.8),front(-31,31.8,1.8)));
  lit.push(beam(front(-31,25.6,.35),front(18,25.6,.35),.16,.08));
  // Lower doors sit in recessed vestibules beneath separate blade canopies.
  for(const z of [-26,-5,16,38]) {
    recess.push(box(east(z)-3.45,2.35,z,1.15,4.7,12.4));
    windows.push(box(east(z)-2.78,2.25,z,.12,4.35,11.4));
    masonry.push(box(east(z)-1,4.8,z,7,.5,13));
    for(const dz of [-5.5,5.5])metal.push(beam([east(z)+1,0,z+dz],[east(z)+1,4.7,z+dz],.2));
    for(let dz=-4;dz<=4;dz+=2) {
      metal.push(beam(front(z+dz,.2,3.6),front(z+dz,4.4,3.6),.12));
    }
    metal.push(beam(front(z-5.3,2.2,3.58),front(z+5.3,2.2,3.58),.09));
    lit.push(box(east(z),4.51,z,3,.06,11));
  }
  // South flank: Cream City masonry piers, retail recesses, sunshades and leaning steel.
  windows.push(quad([-98,4,54.3],[72,4,54.3],[72,26,54.3],[-98,26,54.3]));
  for(let x=-94;x<70;x+=11) {
    masonry.push(box(x,11.5,54.65,5.2,15,1));
    masonry.push(box(x+5.5,2.1,55.05,5.6,4.2,1.45));
    recess.push(box(x+7.6,2.25,54.55,3.5,4.15,.65));
    metal.push(beam([x+4.8,.2,56],[x+4.8,26.8,54.3],.38));
    metal.push(beam([x+4.8,19,54.7],[x+9,27,54.7],.24));
    metal.push(box(x+7.5,5.1,55.45,7.2,.18,2.1));
    for(let y=5;y<27;y+=3)metal.push(beam([x+2.7,y,54.9],[x+8.6,y,54.9],.09));
    if(x%3!==0)lit.push(box(x+7,7,54.96,2,1.7,.04));
  }
  for(let x=-83;x<53;x+=23) roof.push(box(x,37.8,5,5,1,2));
  merged(arena,shell,zinc,'fiserv-curled-zinc-shell');merged(arena,roof,membrane,'fiserv-wave-roof');
  merged(arena,windows,glass,'fiserv-atrium-and-ribbon-glazing');merged(arena,metal,frame,'fiserv-curtain-wall-and-seams');
  merged(arena,masonry,stone,'fiserv-cream-masonry-and-galleries');merged(arena,recess,dark,'fiserv-recessed-interior-and-club-frame');
  merged(arena,soffit,gold,'fiserv-gold-roof-soffit');
  const lights=merged(arena,lit,light,'fiserv-concourse-lighting');lights.castShadow=false;
  // Foundation alone uses the exact mapped footprint, meeting local ground.
  const shape=new THREE.Shape();SITE.footprint.forEach(([x,z],i)=>i?shape.lineTo(x-SITE.x,SITE.z-z):shape.moveTo(x-SITE.x,SITE.z-z));
  const bottom=Math.min(-.15,...SITE.footprint.map(([x,z])=>groundAt(x,z)-SITE.floor))-.1;
  const footing=new THREE.ExtrudeGeometry(shape,{depth:.15-bottom,bevelEnabled:false});footing.rotateX(-Math.PI/2);footing.translate(0,bottom,0);
  merged(root,[footing],stone,'fiserv-mapped-foundation');
  // Arena-supplied vector wordmark, with the all-orange finish of the mounted sign.
  // Fit the complete logo inside the south spandrel, below the low roof edge.
  const signMaterial=new THREE.MeshStandardMaterial({
    color:0xffffff,transparent:true,alphaTest:.15,roughness:.55,
    emissive:0xffffff,emissiveIntensity:.04,
  });
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(13,13*496/1810),signMaterial);
  sign.name='fiserv-original-name-sign';
  sign.position.set(...front(34,29,.78));sign.rotation.y=Math.atan2(1,.2);
  sign.visible=false;arena.add(sign);
  if(typeof document!=='undefined') {
    new THREE.TextureLoader().load('/signs/fiserv-forum.svg',tex=>{
      tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;
      signMaterial.map=tex;signMaterial.emissiveMap=tex;
      signMaterial.needsUpdate=true;sign.visible=true;
    });
  }
  root.userData.dimensions={height:HEIGHT,mappedWidth:SITE.width,mappedLength:SITE.length,atriumHeight:29.3};
  root.userData.detail={zincPanelCourses:8,roofCrossfallMeters:1.4,atriumMegaColumns:5,atriumEscalators:3,entryVestibules:4,southRetailBays:15};
  root.userData.eastEntry=true;root.userData.panoramaClub=true;
  root.userData.setLightingMode=(mode:string)=>{
    light.opacity=mode==='night'?.34:mode==='sunset'?.15:0;lights.visible=light.opacity>0;
    gold.emissive.setHex(0xffb65d);gold.emissiveIntensity=mode==='night'?.28:mode==='sunset'?.12:0;
    glass.emissive.setHex(0x6b8875);glass.emissiveIntensity=mode==='night'?.12:mode==='sunset'?.035:0;
    signMaterial.emissiveIntensity=mode==='night'?.7:mode==='sunset'?.3:.04;
  };
  root.userData.setLightingMode('day');return root;
}
