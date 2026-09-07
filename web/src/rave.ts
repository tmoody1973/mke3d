import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RAVE_SITE as site, RAVE_PUBLIC_DATUM as datum } from './raveSite.ts';
type Mode='day'|'sunset'|'night';
/** Wisconsin Avenue facade is local -Z. Photo-proportioned permanent exterior;
 * recessed three-portal entry, monumental arches and seven-bay upper loggia. */
export function buildRave(groundAt:(x:number,z:number)=>number){
 const root=new THREE.Group();root.name='the-rave';root.rotation.y=site.bearing;
 const world=(x:number,z:number)=>new THREE.Vector3(x,0,z).applyAxisAngle(new THREE.Vector3(0,1,0),site.bearing).add(new THREE.Vector3(site.x,0,site.z));
 const local=(x:number,z:number)=>new THREE.Vector3(x-site.x,0,z-site.z).applyAxisAngle(new THREE.Vector3(0,1,0),-site.bearing);
 const calibrated=Math.abs(groundAt(datum.frontCenter.x,datum.frontCenter.z)-datum.frontCenter.terrain)<.08;
 const floor=calibrated?site.entrance.suggestedFloor:groundAt(datum.frontCenter.x,datum.frontCenter.z)+.08;
 const roadCorrection=calibrated?datum.wisconsinSidewalk.road-groundAt(datum.wisconsinSidewalk.x,datum.wisconsinSidewalk.z):0;
 root.position.set(site.x,floor,site.z);
 const buckets:Record<string,THREE.BufferGeometry[]>={stone:[],relief:[],side:[],joint:[],dark:[],roof:[],copper:[],glass:[],litGlass:[],entryGlass:[],metal:[],warm:[],banner:[],letter:[],grade:[]};
 const materials:Record<string,THREE.MeshStandardMaterial>={
  stone:new THREE.MeshStandardMaterial({color:0xc6b398,roughness:.91}),relief:new THREE.MeshStandardMaterial({color:0xd0cabb,roughness:.9}),side:new THREE.MeshStandardMaterial({color:0xb5a78f,roughness:.93}),joint:new THREE.MeshStandardMaterial({color:0x9d8a73,roughness:.98}),dark:new THREE.MeshStandardMaterial({color:0x282b2d,roughness:.83}),roof:new THREE.MeshStandardMaterial({color:0x373b39,roughness:.91}),copper:new THREE.MeshStandardMaterial({color:0x639486,roughness:.69,metalness:.28}),
  glass:new THREE.MeshStandardMaterial({color:0x29434e,roughness:.27,metalness:.22}),litGlass:new THREE.MeshStandardMaterial({color:0x7c7764,emissive:0xffbd75,emissiveIntensity:0,roughness:.36}),entryGlass:new THREE.MeshStandardMaterial({color:0x586b68,roughness:.26,transparent:true,opacity:.52,emissive:0xe8a666,emissiveIntensity:0}),metal:new THREE.MeshStandardMaterial({color:0x20292c,roughness:.60,metalness:.40}),warm:new THREE.MeshStandardMaterial({color:0xffe3ad,emissive:0xffc178,emissiveIntensity:0}),banner:new THREE.MeshStandardMaterial({color:0x303d4e,roughness:.91}),letter:new THREE.MeshStandardMaterial({color:0xeee0bd,emissive:0xe8b071,emissiveIntensity:0,roughness:.8}),
 };materials.grade=materials.stone;
 function add(k:string,g:THREE.BufferGeometry){g.deleteAttribute('uv');const flat=g.index?g.toNonIndexed():g;if(flat!==g)g.dispose();buckets[k].push(flat);}
 function box(k:string,x:number,y:number,z:number,w:number,h:number,d:number,angle=0){const g=new THREE.BoxGeometry(w,h,d);g.rotateY(angle);g.translate(x,y,z);add(k,g);}
 function rod(k:string,a:number[],b:number[],r:number,segments=6){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),delta=bv.clone().sub(av),g=new THREE.CylinderGeometry(r,r,delta.length(),segments);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...av.add(bv).multiplyScalar(.5).toArray());add(k,g);}
 function quad(k:string,a:number[],b:number[],c:number[],d:number[]){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([...a,...b,...c,...a,...c,...d],3));g.computeVertexNormals();add(k,g);}
 function ring(k:string,x:number,y:number,z:number,r:number,t:number,sx=1,sy=1){const g=new THREE.TorusGeometry(r,t,4,12);g.scale(sx,sy,1);g.translate(x,y,z);add(k,g);}
 function panel(k:string,shape:THREE.Shape,x:number,z:number,depth=.08){const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:20});g.rotateY(Math.PI);g.translate(x,0,z);add(k,g);}
 function arch(w:number,b:number,h:number){const r=w/2,s=new THREE.Shape();s.moveTo(-r,b);s.lineTo(r,b);s.lineTo(r,b+h-r);s.absarc(0,b+h-r,r,0,Math.PI,false);s.closePath();return s;}
 function archBand(k:string,x:number,z:number,cy:number,r:number,t:number){const s=new THREE.Shape();s.absarc(0,cy,r+t,0,Math.PI,false);s.absarc(0,cy,r,Math.PI,0,true);s.closePath();panel(k,s,x,z,.12);}
 function mass(k:string,points:THREE.Vector3[],b:number,h:number){const s=new THREE.Shape();points.forEach((p,i)=>i?s.lineTo(p.x,-p.z):s.moveTo(p.x,-p.z));s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:false});g.rotateX(-Math.PI/2);g.translate(0,b,0);add(k,g);}
 const front=site.entrance.localPavilionZ,sideFront=site.entrance.localFacadeZ,cx=1.3,doors=[-4.8,1.3,7.4];
 const mapped=site.footprint.slice(0,-1).map(([x,z])=>local(x,z));
 const body=mapped.map(p=>new THREE.Vector3(p.x,0,Math.max(p.z,front+2.70)));
 mass('side',body,-.15,24.4);mass('roof',body,24.25,.24);
 // Site grade falls about 3.5m toward Michigan Street; retain the exposed base.
 for(let i=0;i<body.length;i++){const a=body[i],b=body[(i+1)%body.length];if(a.distanceTo(b)<.01)continue;const aw=world(a.x,a.z),bw=world(b.x,b.z),ay=groundAt(aw.x,aw.z)-floor-.18,by=groundAt(bw.x,bw.z)-floor-.18;quad('side',[a.x,ay,a.z],[b.x,by,b.z],[b.x,.03,b.z],[a.x,.03,a.z]);}
 // Broad flat ballroom roof and a modest rear upper volume; the ballroom dome
 // described by WHS is suspended indoors and is not an exterior roof dome.
 box('side',.8,25.2,21,38,2.3,21);box('roof',.8,26.42,21,38.4,.20,21.4);
 box('roof',-2,26.8,22,8,.6,7);
 // Side wings and stepped shoulder walls retain the mapped front projection.
 for(const [x,w] of [[-15.5,8.6],[18.1,8.85]]){box('stone',x,10.96,sideFront+.35,w,22.2,.82);box('relief',x,21.08,sideFront-.16,w,1.82,.20);box('roof',x,22.12,sideFront-.06,w+.2,.22,.55);}
 for(const [x,w] of [[-9.65,3.4],[12.15,3.1]]){box('stone',x,10.35,front+.60,w,20.8,1.4);box('roof',x,20.86,front+.15,w,.15,.45);}
 // Swept shoulder parapets rise into the loggia without inventing roof towers.
 for(const side of [-1,1]){const x=side<0?-10.9:13.45,s=new THREE.Shape();s.moveTo(0,20.55);s.lineTo(side*3.3,20.55);s.lineTo(side*3.3,24.8);s.bezierCurveTo(side*2.4,23.8,side*2.0,21.7,0,21.15);s.closePath();panel('stone',s,x,front+.52,.9);}
 // Central wall is truly pierced by three large arch openings.
 const facade=new THREE.Shape();facade.moveTo(-9.35,3.5);facade.lineTo(9.35,3.5);facade.lineTo(9.35,21.0);facade.lineTo(-9.35,21.0);facade.closePath();
 for(const x of doors){const hole=arch(4.82,5.15,12.15),path=new THREE.Path(hole.getPoints(28).reverse().map(p=>new THREE.Vector2(p.x-(x-cx),p.y)));facade.holes.push(path);}
 panel('stone',facade,cx,front+1.0,1.0);
 // Foliate arch surrounds use original rosettes and paired leaves, modeled in relief.
 function rosette(x:number,y:number,z:number,size:number){ring('relief',x,y,z,size,.024,.85,1.14);for(const side of [-1,1]){const g=new THREE.SphereGeometry(size*.45,6,4);g.scale(.55,1.7,.27);g.rotateZ(side*.52);g.translate(x+side*size*.83,y,z);add('relief',g);}}
 for(const x of doors){
  panel('dark',arch(4.5,5.25,11.95),x,front+2.0,.04);
  const reveal=arch(4.16,5.40,11.65);reveal.holes.push(new THREE.Path(arch(3.34,5.66,10.95).getPoints(28).reverse()));
  panel('relief',reveal,x,front+1.66,1.04);panel('glass',arch(3.34,5.66,10.95),x,front+1.50,.035);
  const radius=1.96,cy=15.00;
  archBand('relief',x,front+.39,cy,1.73,.15);archBand('joint',x,front+.29,cy,2.13,.07);
  for(const sign of [-1,1])for(let y=5.8;y<14.9;y+=.53)rosette(x+sign*1.94,y,front+.35,.19);
  for(let j=0;j<=15;j++){const a=j*Math.PI/15;rosette(x+Math.cos(a)*radius,cy+Math.sin(a)*radius,front+.35,.19);}
  for(const dx of [-1.15,-.58,0,.58,1.15])box('metal',x+dx,10.0,front+1.42,.065,8.5,.08);
  for(const y of [6.0,7.5,9.0,11.8,13.4,15.0])box('metal',x,y,front+1.42,3.35,.07,.08);
  box('relief',x,10.45,front+.87,3.44,.96,1.27);for(const dx of [-1.25,-.62,0,.62,1.25])rosette(x+dx,10.45,front+.18,.23);
  // Three ground portals, each a pair of glass leaves, set behind stepped stone jambs.
  for(const sign of [-1,1]){box('stone',x+sign*1.67,1.95,front+.22,.30,3.9,.40);box('relief',x+sign*1.47,1.78,front+.37,.15,3.56,.21);}
  box('stone',x,3.80,front+.20,3.62,.32,.45);box('relief',x,3.54,front+.37,3.03,.17,.23);
  for(const dx of [-.68,.68]){box('entryGlass',x+dx,1.61,front+.64,1.25,3.15,.035);for(const side of [-1,1])box('metal',x+dx+side*.65,1.65,front+.57,.065,3.30,.09);box('warm',x+dx-.40,1.40,front+.52,.05,.50,.08);}
  box('metal',x,3.22,front+.57,2.77,.09,.09);box('dark',x,1.8,front+2.55,3.0,3.6,.07);box('warm',x,3.1,front+2.45,2.5,.10,.08);
  box('grade',x,.035,front+.04,3.5,.08,1.35);
 }
 // Stone between ground portals, rather than a wall covering their doors.
 for(const [x,w] of [[-7.65,.62],[-1.75,2.55],[4.35,2.55],[10.05,.72]])box('stone',x,1.83,front+.30,w,3.66,1.40);
 function rectangularWindow(x:number,z:number,b:number,w:number,h:number,angle=0,lit=false){box('dark',x,b+h/2,z,w+.15,h+.18,.15,angle);box(lit?'litGlass':'glass',x-Math.sin(angle)*.10,b+h/2,z-Math.cos(angle)*.10,w,h,.04,angle);for(const dx of [-w/4,0,w/4])box('metal',x+Math.cos(angle)*dx-Math.sin(angle)*.12,b+h/2,z-Math.sin(angle)*dx-Math.cos(angle)*.12,.05,h,.05,angle);for(const y of [b+.07,b+h/2,b+h-.07])box('metal',x-Math.sin(angle)*.12,y,z-Math.cos(angle)*.12,w,.055,.05,angle);}
 for(const x of [-15.5,18.1]){
  rectangularWindow(x,sideFront-.15,1.15,3.55,4.20);rectangularWindow(x,sideFront-.15,8.0,3.55,3.5,0,true);rectangularWindow(x,sideFront-.15,13.2,3.55,3.65);
  panel('relief',arch(3.7,16.65,1.96),x,sideFront-.20,.09);archBand('joint',x,sideFront-.30,16.76,1.91,.055);
  // Original spread-wing motif in the window tympanum.
  for(const sign of [-1,1])for(let j=0;j<5;j++)rod('relief',[x,17.3,sideFront-.36],[x+sign*(.65+j*.18),17.8-j*.08,sideFront-.36],.045);
  box('relief',x,12.30,sideFront-.30,3.6,1.23,.14);for(const dx of [-1.25,-.62,0,.62,1.25])rosette(x+dx,12.3,sideFront-.42,.22);
  box('metal',x,7.7,sideFront-.85,4.6,.19,1.7);for(const dx of [-1.8,1.8])box('metal',x+dx,7.2,sideFront-.49,.31,1.0,.7);
  for(let dx=-2.15;dx<2.2;dx+=.29)box('metal',x+dx,8.22,sideFront-1.63,.035,.98,.035);for(const y of [7.77,8.73])box('metal',x,y,sideFront-1.63,4.6,.055,.06);
 }
 // Seven openings, pierced balustrade and twisted columns in the upper gallery.
 const arcade=new THREE.Shape();arcade.moveTo(-9.6,20.50);arcade.lineTo(9.6,20.50);arcade.lineTo(9.6,25.70);arcade.lineTo(-9.6,25.70);arcade.closePath();
 const loggia=Array.from({length:7},(_,i)=>cx-7.92+i*2.64);
 for(const x of loggia){const h=arch(2.20,21.55,3.68);arcade.holes.push(new THREE.Path(h.getPoints(24).reverse().map(p=>new THREE.Vector2(p.x-(x-cx),p.y))));box('dark',x,23.05,front+2.12,2.4,4.1,.08);box('warm',x,24.6,front+.72,.22,.37,.22);}
 panel('relief',arcade,cx,front+.66,.74);
 for(let i=0;i<8;i++){
  const x=cx-9.24+i*2.64;box('relief',x,21.55,front+.09,.45,.22,.50);rod('relief',[x,21.65,front+.10],[x,24.14,front+.10],.17,10);box('relief',x,24.18,front+.10,.49,.25,.53);
  const points=Array.from({length:33},(_,j)=>new THREE.Vector3(x+Math.cos(j/32*Math.PI*5)*.18,21.68+j/32*2.33,front+.10+Math.sin(j/32*Math.PI*5)*.18));add('relief',new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),36,.036,5,false));
 }
 for(const y of [20.46,20.70,21.40])box('relief',cx,y,front-.20,19.8,.17,.42);
 for(let x=cx-9.4;x<cx+9.4;x+=.32){rod('relief',[x,20.78,front-.2],[x,21.31,front-.2],.055);const g=new THREE.SphereGeometry(.085,6,4);g.scale(1,1.45,1);g.translate(x,21.03,front-.2);add('relief',g);}
 // Deep green copper cornice with visible brackets and a shallow roof slope.
 box('dark',cx,25.78,front-.05,20.7,.18,2.5);box('copper',cx,26.0,front-.10,20.9,.34,2.8);box('copper',cx,26.25,front-.17,21.1,.18,2.95);
 for(let x=cx-10;x<cx+10;x+=1.32){rod('dark',[x,25.48,front+.38],[x,25.80,front-1.26],.085);box('copper',x,26.45,front-1.2,.12,.22,.26);}
 quad('roof',[cx-10.5,26.31,front-1.4],[cx-10.5,26.80,front+3.2],[cx+10.5,26.80,front+3.2],[cx+10.5,26.31,front-1.4]);
 // Original low-relief figures preserve the rhythm of the carved wing friezes.
 for(const [center,w] of [[-15.5,8.3],[18.1,8.55]])for(let i=0;i<6;i++){
  const x=center-w/2+.65+i*(w-1.3)/5,y=20.80,z=sideFront-.35;
  rod('relief',[x,y-.45,z],[x,y+.36,z],.115);const head=new THREE.SphereGeometry(.15,7,5);head.scale(1,1,.42);head.translate(x,y+.56,z);add('relief',head);
  for(const sign of [-1,1]){rod('relief',[x,y-.25,z],[x+sign*.29,y-.76,z],.07);rod('relief',[x,y+.24,z],[x+sign*.42,y+.48,z],.06);for(let j=0;j<4;j++)rod('relief',[x+sign*.08,y+.26,z],[x+sign*(.33+j*.07),y+.8-j*.06,z],.025);}
 }
 // Cut-stone course joints on exposed front fields and utilitarian side walls.
 for(let y=.8;y<20;y+=.62){for(const [x,w,z] of [[-15.5,8.4,sideFront-.08],[18.1,8.65,sideFront-.08],[-9.65,3.2,front-.13],[12.15,2.9,front-.13]])box('joint',x,y,z,w,.014,.015);for(let i=0;i<body.length;i++){const a=body[i],b=body[(i+1)%body.length];if(Math.abs(a.z-b.z)<.4)continue;const sign=Math.sign((a.x+b.x)/2),dx=b.x-a.x,dz=b.z-a.z;box('joint',(a.x+b.x)/2+sign*.012,y,(a.z+b.z)/2,Math.hypot(dx,dz),.014,.016,Math.atan2(-dz,dx));}}
 // Project every side window onto the exact structural edge at its station.
 // The west wall has a 4m setback: rectangle bounds cannot locate its windows.
 const sideWindowSurfaces:{x:number;z:number;y:number;width:number;height:number;angle:number;normal:number[]}[]=[];
 function sideSurface(z:number,sign:number){
  const edges=body.flatMap((a,i)=>{const b=body[(i+1)%body.length];if(Math.abs(a.z-b.z)<.001||z<=Math.min(a.z,b.z)||z>=Math.max(a.z,b.z))return [];return [{a,b,x:a.x+(b.x-a.x)*(z-a.z)/(b.z-a.z)}];});
  return edges.sort((a,b)=>sign*(b.x-a.x))[0];
 }
 function sideWindow(z:number,y:number,w:number,h:number,sign:number,lit=false){
  const edge=sideSurface(z,sign);if(!edge)return;
  const slope=(edge.b.x-edge.a.x)/(edge.b.z-edge.a.z),normal=new THREE.Vector3(sign,0,-sign*slope).normalize(),angle=Math.atan2(-normal.x,-normal.z);
  // Keep the entire opening away from a step or return, including its frame.
  const halfSpan=(w+.20)/2*Math.abs(Math.sin(angle));
  for(const end of [z-halfSpan-.06,z+halfSpan+.06]){const sample=sideSurface(end,sign);if(!sample||Math.abs(sample.x-(edge.x+slope*(end-z)))>.015)return;}
  rectangularWindow(edge.x,z,y,w,h,angle,lit);
  sideWindowSurfaces.push({x:edge.x,z,y,width:w,height:h,angle,normal:normal.toArray()});
 }
 for(let i=0;i<10;i++){
  const z=-28+i*6.0;
  for(const y of [2.1,7.0,12.0,17.0])for(const dz of [-.85,.85])sideWindow(z+dz,y,1.36,2.70,1,(i+Math.round(y))%11===0);
 }
 for(let i=0;i<8;i++)for(const y of [3,9,15])sideWindow(-25+i*7,y,1.6,2.4,-1);
 for(const x of [-15,-7,2,10,17])rectangularWindow(x,35.84,3.1,2.0,3.0,Math.PI,false);
 // Original ordinary names on the entrance/banners, with north-facing reading axes.
 const glyph:Record<string,number[][][]>={A:[[[0,0],[.42,1],[.84,0]],[[.16,.4],[.68,.4]]],B:[[[0,0],[0,1],[.6,1],[.8,.8],[.8,.65],[.6,.5],[0,.5]],[[.6,.5],[.85,.3],[.85,.15],[.6,0],[0,0]]],C:[[[.82,.87],[.65,1],[.2,1],[0,.8],[0,.2],[.2,0],[.65,0],[.82,.13]]],E:[[[.8,1],[0,1],[0,0],[.8,0]],[[0,.5],[.68,.5]]],G:[[[.8,.87],[.65,1],[.2,1],[0,.8],[0,.2],[.2,0],[.8,0],[.8,.48],[.46,.48]]],H:[[[0,0],[0,1]],[[.8,0],[.8,1]],[[0,.5],[.8,.5]]],L:[[[0,1],[0,0],[.8,0]]],R:[[[0,0],[0,1],[.6,1],[.8,.8],[.8,.65],[.6,.5],[0,.5]],[[.4,.5],[.8,0]]],S:[[[.8,.9],[.65,1],[.15,1],[0,.85],[0,.65],[.15,.5],[.65,.5],[.8,.35],[.8,.15],[.65,0],[.15,0],[0,.1]]],T:[[[0,1],[.8,1]],[[.4,1],[.4,0]]],U:[[[0,1],[0,.2],[.2,0],[.6,0],[.8,.2],[.8,1]]],V:[[[0,1],[.4,0],[.8,1]]]};
 const signRanges:{text:string;first:number;count:number}[]=[];
 function label(text:string,x:number,y:number,z:number,size:number,vertical=false){const first=buckets.letter.reduce((n,g)=>n+g.getAttribute('position').count,0);let advance=0;for(const char of text){for(const path of glyph[char]??[])for(let i=1;i<path.length;i++){const point=(p:number[])=>vertical?[x-p[0]*size,y-advance+p[1]*size,z]:[x-advance-p[0]*size,y+p[1]*size,z];rod('letter',point(path[i-1]),point(path[i]),size*.04);}advance+=(char===' '?.6:1.03)*size;}const end=buckets.letter.reduce((n,g)=>n+g.getAttribute('position').count,0);signRanges.push({text,first,count:end-first});}
 label('EAGLES',9.0,4.27,front-.16,.56);label('THE RAVE',3.6,4.27,front-.16,.53);label('CLUB',-3.62,4.27,front-.16,.58);
 for(const [x,text] of [[-9.75,'EAGLES CLUB'],[12.2,'THE RAVE']] as const){box('banner',x,13.2,front-.13,2.24,11.4,.055);rod('metal',[x-1.3,18.98,front-.14],[x+1.3,18.98,front-.14],.025);label(text,x+.29,18.12,front-.20,.73,true);}
 // Four urns and two shallow saucer planters are durable facade landmarks.
 for(const x of [-17.5,-11.1,12.8,19.0]){
  box('dark',x,.50,front-5.9,1.65,1.0,1.65);const points=[[.38,0],[.40,.18],[.24,.28],[.34,.50],[.56,.87],[.52,1.12],[.42,1.34],[.52,1.38]].map(([r,y])=>new THREE.Vector2(r,y));const g=new THREE.LatheGeometry(points,16);g.translate(x,1.0,front-5.9);add('metal',g);ring('metal',x,2.12,front-6.42,.22,.045,1,.9);
 }
 for(const x of [-2.7,5.2]){box('dark',x,.38,front-5.8,2.9,.75,2.6);const profile=[[.35,0],[.47,.12],[1.15,.36],[1.50,.73],[1.55,.82]].map(([r,y])=>new THREE.Vector2(r,y));const g=new THREE.LatheGeometry(profile,20);g.translate(x,.75,front-5.8);add('dark',g);}
 // Public forecourt rises toward Wisconsin; grade remains separate from BLDG.
 const apronFront=-70.25,apronBack=front+.68;
 for(let col=0;col<18;col++)for(let row=0;row<14;row++){
  const xa=-20.2+col*2.4,xb=xa+2.4,za=apronFront+row*(apronBack-apronFront)/14,zb=za+(apronBack-apronFront)/14;
  const grade=(x:number,z:number)=>{const w=world(x,apronFront),edge=groundAt(w.x,w.z)+roadCorrection-floor;return THREE.MathUtils.lerp(edge,.06,THREE.MathUtils.clamp((z-apronFront)/(apronBack-apronFront-1.8),0,1));};
  quad('grade',[xa,grade(xa,za),za],[xa,grade(xa,zb),zb],[xb,grade(xb,zb),zb],[xb,grade(xb,za),za]);
 }
 for(const [key,geometries] of Object.entries(buckets)){const geometry=mergeGeometries(geometries);if(!geometry)throw new Error(`Rave ${key} merge failed`);const mesh=new THREE.Mesh(geometry,materials[key]);mesh.name=['stone','side','relief'].includes(key)?'BLDG':`rave-${key}`;mesh.userData.part=key;if(key==='grade')mesh.userData.walkingSurface='grade';mesh.castShadow=!['entryGlass','warm','letter'].includes(key);mesh.receiveShadow=true;root.add(mesh);geometries.forEach(g=>g.dispose());}
 const lights=new THREE.Group();lights.name='rave-entry-lights';const lamps=doors.map(x=>{const light=new THREE.PointLight(0xffce8d,0,20,2);light.position.set(x,8.2,front-2.9);light.castShadow=false;lights.add(light);return light;});root.add(lights);
 root.userData.finishedFloor=floor;root.userData.referenceHeight=26.85;root.userData.entrance={facade:'north',centers:doors,doorZ:front+.64,approachZ:apronFront,roadCorrection};root.userData.signRanges=signRanges;root.userData.sideWindowSurfaces=sideWindowSurfaces;
 root.userData.setLightingMode=(mode:Mode)=>{materials.litGlass.emissiveIntensity=mode==='night'?.31:mode==='sunset'?.12:0;materials.entryGlass.emissiveIntensity=mode==='night'?.07:mode==='sunset'?.025:0;materials.warm.emissiveIntensity=mode==='night'?1.8:mode==='sunset'?.6:0;materials.letter.emissiveIntensity=mode==='night'?.30:mode==='sunset'?.08:0;for(const light of lamps){light.visible=mode!=='day';light.intensity=mode==='night'?110:mode==='sunset'?28:0;}};
 root.userData.setLightingMode('day');return root;
}
