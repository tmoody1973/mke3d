import * as THREE from 'three';
import {districtGeometry} from './districtGeometry.ts';

/** Photo-interpreted architecture; local +Z is the inland public entrance. */
export function buildAuroraArchitecture(width:number,depth:number){
 const root=new THREE.Group();root.name='aurora-pavilion-architecture';
 const b=districtGeometry(root),v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
 const mat=(color:number,metalness=.2)=>new THREE.MeshStandardMaterial({color,metalness,roughness:.65,side:THREE.DoubleSide});
 const frame=mat(0xe0e7e3,.45),roof=mat(0x86a5ad,.4),fascia=mat(0x526f79),navy=mat(0x133f58),wall=mat(0x768785),black=mat(0x202a2c),concrete=mat(0xb5b7ac);
 const warm=mat(0xffdd91);warm.emissive.set(0xffcc79);
 const luminous:THREE.MeshStandardMaterial[]=[warm];
 const half=width/2,end=depth/2;
 function surface(points:THREE.Vector3[],material:THREE.Material,name:string){
  const a:number[]=[];for(let i=1;i<points.length-1;i++)a.push(...points[0].toArray(),...points[i].toArray(),...points[i+1].toArray());
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(a,3));g.computeVertexNormals();b.add(g,material,name);
 }
 // Two staggered barrel roofs. Each has its own exposed front arch rather
 // than one wavy sheet: the taller lakeward shell rises behind the entry roof.
 for(let tier=0;tier<2;tier++){
  const z0=tier===0?-end:1,z1=tier===0?5:end,eave=tier===0?12:9.5;
  const point=(x:number,z:number)=>v(x,eave+5.2*(1-(x/half)**2),z);
  const nx=20,nz=6,drop=1.7;
  for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){
   const x0=-half+i*width/nx,x1=x0+width/nx,a=z0+j*(z1-z0)/nz,c=z0+(j+1)*(z1-z0)/nz;
   surface([point(x0,a),point(x1,a),point(x1,c),point(x0,c)],roof,'aurora-stepped-barrel-roofs');
  }
  // White upper/lower chords and triangular webs form the deep space frame.
  for(let j=0;j<=nz;j++)for(let i=0;i<nx;i++){
   const z=z0+j*(z1-z0)/nz,a=point(-half+i*width/nx,z),c=point(-half+(i+1)*width/nx,z);
   b.beam(a,c,.17,frame,'aurora-arched-truss-chords');
   b.beam(a.clone().add(v(0,-drop,0)),c.clone().add(v(0,-drop,0)),.14,frame,'aurora-arched-truss-chords');
   b.beam(i%2?a:a.clone().add(v(0,-drop,0)),i%2?c.clone().add(v(0,-drop,0)):c,.10,frame,'aurora-triangular-truss-webs');
  }
  for(let i=0;i<=nx;i++){
   const x=-half+i*width/nx;
   b.beam(point(x,z0).add(v(0,.055,0)),point(x,z1).add(v(0,.055,0)),.065,roof,'aurora-corrugated-roof-seams');
   if(i%2===0)for(let j=0;j<nz;j++){
    const a=point(x,z0+j*(z1-z0)/nz).add(v(0,-drop,0)),c=point(x,z0+(j+1)*(z1-z0)/nz).add(v(0,-drop,0));
    b.beam(a,c,.11,frame,'aurora-longitudinal-spaceframe');
    if(i<nx)b.beam(a,point(x+width/nx*2,c.z),.09,frame,'aurora-spaceframe-cross-bracing');
   }
  }
  for(const side of [-1,1])for(const z of [z0+1,z1-1]){
   const foot=v(side*(half-.9),.5,z),top=point(side*(half-.6),z).add(v(0,-drop,0));
   b.box(foot.x,.25,z,1.7,.5,1.7,concrete,'aurora-support-footings');
   b.beam(foot,top,.38,frame,'aurora-branching-supports');
   b.beam(foot,point(side*(half-4.5),z).add(v(0,-drop,0)),.30,frame,'aurora-branching-supports');
   b.beam(foot,point(side*(half-.6),z+(z<0?3:-3)).add(v(0,-drop,0)),.25,frame,'aurora-branching-supports');
  }
 }
 // Independent, low arched proscenium shelter visible inside the larger hall.
 const stageRear=-end+2,stageFront=-end+17;
 for(let i=0;i<16;i++){
  const x0=-width*.36+i*width*.72/16,x1=x0+width*.72/16;
  const y=(x:number)=>7.6+1.9*(1-(x/(width*.36))**2);
  surface([v(x0,y(x0),stageRear),v(x1,y(x1),stageRear),v(x1,y(x1),stageFront),v(x0,y(x0),stageFront)],frame,'aurora-inner-stage-canopy');
  b.beam(v(x0,y(x0)-.3,stageRear),v(x0,y(x0)-.3,stageFront),.22,frame,'aurora-stage-canopy-ribs');
 }
 b.box(0,3.3,-end+3,width*.73,6.6,1.1,black,'aurora-stage-house-rear');
 for(const side of [-1,1]){
  b.box(side*width*.365,3.1,-end+9,.4,6.2,12,wall,'aurora-stage-side-enclosures');
  for(let i=0;i<36;i++)b.box(side*(width*.365+.22),3.1,-end+3+i/3,.07,6.1,.08,fascia,'aurora-stage-wall-corrugations');
 }
 // Entry concessions flank an open, eleven-metre central passage.
 for(const side of [-1,1]){
  const x=side*10.5,z=end-2.5;
  b.box(x,1.25,z,10,2.5,4.8,navy,'aurora-entry-concession-bases');
  b.box(x,1.45,z+2.65,10.4,.18,.85,concrete,'aurora-serving-counters');
  for(const dx of [-4.7,0,4.7])b.box(x+dx,2.9,z+2.2,.15,3,.15,frame,'aurora-concession-posts');
  for(let i=0;i<12;i++){
   const a=z-3+i*.55,c=a+.55,ya=4.2+.65*Math.sin(i/12*Math.PI),yc=4.2+.65*Math.sin((i+1)/12*Math.PI);
   surface([v(x-5.5,ya,a),v(x+5.5,ya,a),v(x+5.5,yc,c),v(x-5.5,yc,c)],roof,'aurora-blue-concession-awnings');
   b.beam(v(x-5.5,ya+.06,a),v(x+5.5,ya+.06,a),.065,roof,'aurora-concession-roof-ribs');
  }
  b.box(x,3.35,z+2.21,8.8,.8,.1,warm,'aurora-warm-menu-boards');
  b.box(x,3.95,z+1.6,8.4,.08,.15,warm,'aurora-concession-downlights');
 }
 // A freestanding navy sign pylon and the header mounted on the entrance arch.
 const signX=half+1.6,signZ=end+1;
 b.box(signX,.3,signZ,3.7,.6,1.8,concrete,'aurora-sign-plinth');
 b.box(signX,4.4,signZ,3.25,8.2,1.3,navy,'aurora-sign-pylon');
 b.box(signX,5,signZ+.7,2.9,5.65,.12,black,'aurora-digital-display-bezel');
 b.box(signX,9.1,signZ,3.8,1.3,1.6,navy,'aurora-pylon-header');
 b.box(0,12.25,end+.12,13,1.6,.32,navy,'aurora-entrance-name-board');
 b.finish();
 // Original typesetting, not a photo texture. Safe when building in Node tests.
 function sign(name:string,x:number,y:number,z:number,w:number,h:number,lines:string[],background:string){
  const material=mat(0xffffff);material.emissive.set(0xffffff);material.emissiveIntensity=0;luminous.push(material);
  if(typeof document!=='undefined'){
   const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=Math.round(1024*h/w);
   const c=canvas.getContext('2d');if(c){
    c.fillStyle=background;c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle='#f5f6ec';c.textAlign='center';c.textBaseline='middle';
    lines.forEach((line,i)=>{c.font=`${Math.floor(lines.length===1?canvas.height*.78:canvas.height/(lines.length+1)*.9)}px ${i===0?'Georgia':'sans-serif'}`;c.fillText(line,512,canvas.height*(i+1)/(lines.length+1),940);});
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;material.map=texture;material.emissiveMap=texture;
   }
  }else material.color.set(background);
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),material);mesh.name=name;mesh.position.set(x,y,z);root.add(mesh);
 }
 sign('aurora-entry-lettering',0,12.25,end+.3,12.6,1.4,['Aurora Pavilion'],'#133f58');
 sign('aurora-pylon-lettering',signX,9.1,signZ+.82,3.5,1.1,['Aurora','Pavilion'],'#133f58');
 sign('aurora-digital-welcome',signX,5,signZ+.78,2.65,5.35,['Welcome','to','Aurora','PAVILION'],'#205c88');
 root.userData.setLightingMode=(mode:string)=>{const level=mode==='night'?1:mode==='sunset'?.4:0;luminous.forEach(m=>m.emissiveIntensity=level*(m===warm?1.2:.65));};
 root.userData.setLightingMode('day');root.userData.roofTiers=2;
 return root;
}
