import * as THREE from 'three';
import { districtGeometry } from './districtGeometry.ts';

/** Quiet-day public realm, interpreted from the supplied OJB photographs.
 * X points east, Z south; all surfaces and props are grounded in the city DEM.
 */
export function buildDeerDistrict(groundAt:(x:number,z:number)=>number) {
  const root=new THREE.Group();root.name='deer-district';
  const kit=districtGeometry(root);
  const mat=(color:number,roughness=.85)=>new THREE.MeshStandardMaterial({color,roughness});
  const paving=mat(0xb9b7ab),concrete=mat(0xb9b7ab),joint=mat(0x7b7e77),metal=mat(0x293b3b,.6),wood=mat(0x87613c);
  const soil=mat(0x555743),leaves=mat(0x59704a),bark=mat(0x60523c),lawn=mat(0x517b48);
  const canopy=mat(0xd8d5be),bronze=mat(0x917963,.65);
  for(const material of [lawn,soil,bronze]) {material.polygonOffset=true;material.polygonOffsetFactor=-3;material.polygonOffsetUnits=-3;}
  const glow=new THREE.MeshBasicMaterial({color:0xffcc83});
  const poolMaterial=new THREE.MeshBasicMaterial({color:0xffd29a,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4});
  if(typeof document!=='undefined') {
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
    const ctx=canvas.getContext('2d');if(ctx){
      const gradient=ctx.createRadialGradient(32,32,0,32,32,32);
      gradient.addColorStop(0,'rgba(255,255,255,0.65)');gradient.addColorStop(.4,'rgba(255,255,255,0.25)');gradient.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);poolMaterial.map=new THREE.CanvasTexture(canvas);
    }
  }
  const pools=new THREE.Group();pools.name='district-light-pools';root.add(pools);
  const poolMatrices:THREE.Matrix4[]=[];
  const water=new THREE.MeshStandardMaterial({color:0x709b9a,metalness:.25,roughness:.25,transparent:true,opacity:.62});
  // Cached pedestrian ROAD ribbons use DEM + .4; the paving cap clears them by 3 cm.
  const floor=(x:number,z:number)=>groundAt(x,z)+.43;
  const point=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z);
  const features:{type:string;x:number;z:number}[]=[];
  function surface(points:readonly (readonly number[])[],material:THREE.Material,lift=0,name='district-hardscape') {
    const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z)));
    const g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);
    const source=g.index?g.toNonIndexed():g;
    const pos=source.getAttribute('position'),vertices:number[]=[];
    function triangle(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3) {
      const lengths=[a.distanceToSquared(b),b.distanceToSquared(c),c.distanceToSquared(a)];
      const longest=Math.max(...lengths);
      if(longest>16) {
        if(longest===lengths[0]){const m=a.clone().add(b).multiplyScalar(.5);triangle(a,m,c);triangle(m,b,c);}
        else if(longest===lengths[1]){const m=b.clone().add(c).multiplyScalar(.5);triangle(a,b,m);triangle(a,m,c);}
        else {const m=c.clone().add(a).multiplyScalar(.5);triangle(a,b,m);triangle(m,b,c);}
      } else for(const v of [a,b,c])vertices.push(v.x,floor(v.x,v.z)+lift,v.z);
    }
    for(let i=0;i<pos.count;i+=3)triangle(new THREE.Vector3().fromBufferAttribute(pos,i),new THREE.Vector3().fromBufferAttribute(pos,i+1),new THREE.Vector3().fromBufferAttribute(pos,i+2));
    if(source!==g)source.dispose();g.dispose();
    const draped=new THREE.BufferGeometry();draped.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));draped.computeVertexNormals();kit.add(draped,material,name);
  }
  function rectangle(x:number,z:number,w:number,d:number,m:THREE.Material,lift=0,name='district-hardscape') {
    surface([[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]],m,lift,name);
  }
  function bench(x:number,z:number,length=3) {
    const y=floor(x,z);features.push({type:'bench',x,z});
    for(let i=0;i<4;i++)kit.box(x,y+.48,z+(i-1.5)*.14,length,.10,.115,wood,'district-wood-seating');
    for(const dx of [-length*.35,length*.35])kit.box(x+dx,y+.23,z,.13,.46,.52,metal,'district-street-furniture');
  }
  function planter(x:number,z:number,w:number,d:number) {
    const y=floor(x,z);features.push({type:'planter',x,z});
    kit.box(x,y+.22,z,w,.44,d,concrete,'district-planters');
    kit.box(x,y+.47,z,w-.3,.08,d-.3,soil,'district-planting-beds');
    for(let j=0;j<Math.floor(w/.75);j++)for(let k=0;k<Math.floor(d/.7);k++) {
      const g=new THREE.IcosahedronGeometry(.38,0);g.scale(1,.8,1);
      g.translate(x-w/2+.55+j*.75,y+.72,z-d/2+.5+k*.7);kit.add(g,leaves,'district-trees-and-planting');
    }
  }
  function tree(x:number,z:number,h=6.5) {
    const y=floor(x,z);features.push({type:'tree',x,z});
    rectangle(x,z,2.1,2.1,soil,.02,'district-planting-beds');
    kit.cylinder(x,y+h*.32,z,.12,h*.64,bark,'district-tree-trunks',7);
    for(const [dx,dy,dz,r] of [[0,h*.78,0,1.6],[-.9,h*.68,.35,1.1],[.85,h*.68,-.4,1.1]]) {
      const g=new THREE.IcosahedronGeometry(r,1);g.scale(.9,1.35,.9);g.translate(x+dx,y+dy,z+dz);kit.add(g,leaves,'district-trees-and-planting');
    }
  }
  function lamp(x:number,z:number,height=6.5) {
    const y=floor(x,z);features.push({type:'lamp',x,z});
    // Shared soft falloff gives the little lanterns a restrained pool on the paving.
    poolMatrices.push(new THREE.Matrix4().compose(new THREE.Vector3(x,y+.065,z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2),new THREE.Vector3(1,1,1)));
    kit.cylinder(x,y+height/2,z,.07,height,metal,'district-street-furniture',6);
    kit.cylinder(x,y+.1,z,.19,.2,metal,'district-street-furniture');
    for(const [side,h] of [[1,height-.4],[-1,height-1.8]]) {
      kit.beam(point(x,y+h,z),point(x+side*.85,y+h+.13,z),.09,metal,'district-street-furniture');
      kit.box(x+side*.8,y+h+.1,z,.42,.08,.22,glow,'district-lamp-lenses');
    }
  }
  function bollard(x:number,z:number) {
    const y=floor(x,z);kit.cylinder(x,y+.48,z,.115,.96,metal,'district-street-furniture',8);
    kit.cylinder(x,y+.88,z,.118,.11,glow,'district-lamp-lenses',8);
  }
  function table(x:number,z:number,umbrella=false) {
    const y=floor(x,z);features.push({type:'table',x,z});
    kit.cylinder(x,y+.77,z,.58,.055,metal,'district-street-furniture');
    kit.cylinder(x,y+.38,z,.045,.76,metal,'district-street-furniture',6);
    for(const [dx,dz] of [[-.85,0],[.85,0],[0,.85],[0,-.85]]) {
      kit.box(x+dx,y+.43,z+dz,.4,.05,.4,wood,'district-wood-seating');
      for(const ox of [-.14,.14])kit.box(x+dx+ox,y+.2,z+dz,.045,.4,.32,metal,'district-street-furniture');
    }
    if(umbrella) {
      kit.cylinder(x,y+1.25,z,.03,2.5,metal,'district-street-furniture',6);
      const g=new THREE.ConeGeometry(1.85,.45,4,1,true);g.rotateY(Math.PI/4);g.translate(x,y+2.65,z);kit.add(g,canopy,'district-parasols');
    }
  }
  function fountain(x:number,z:number,r:number) {
    const y=floor(x,z);features.push({type:'fountain',x,z});
    kit.cylinder(x,y+.015,z,r,.03,joint,'district-fountain-grates',40);
    kit.cylinder(x,y+.036,z,r-.12,.015,water,'district-water',40);
    for(let i=0;i<16;i++) {
      const a=i*Math.PI/8,xx=x+Math.cos(a)*(r-.25),zz=z+Math.sin(a)*(r-.25);
      kit.cylinder(xx,y+.075,zz,.075,.05,metal,'district-street-furniture',6);
      kit.cylinder(xx,y+.25+(i%3)*.12,zz,.023,.4+(i%3)*.24,water,'district-water',5);
    }
  }
  const plaza=[[-931,-1046],[-841,-1046],[-845,-1051],[-869,-1070],[-868,-1103],[-864,-1103],[-864,-1116],[-875,-1116],[-875,-1166],[-914,-1166],[-905,-1149],[-913,-1113],[-922,-1076]];
  surface(plaza,paving,0,'district-hardscape');
  // Long mottled paver panels and bronze cross-bands preserve the open event floor.
  const pavers:number[]=[],colors:number[]=[];
  const palette=[0xa7aca9,0x989f9d,0xc2c5bf,0xb5b9b2,0x929b98].map(c=>new THREE.Color(c));
  const inside=(x:number,z:number)=>{
    let hit=false;for(let i=0,j=plaza.length-1;i<plaza.length;j=i++) {
      const a=plaza[i],b=plaza[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;
    }return hit;
  };
  for(let row=0;row<174;row++)for(let col=0;col<29;col++) {
    const z=-1153+row*.58,x=-907+col*1.18+(row%2)*.59;
    if(!inside(x-1,z)||!inside(x+1,z))continue;
    if([-1128,-1097,-1066].some(b=>Math.abs(z-b)<1.5))continue;
    const coords=[[x,z],[x+1.14,z],[x+1.14,z+.54],[x,z+.54]];
    const color=palette[(row*17+col*31+Math.floor(row/3))%palette.length];
    for(const k of [0,2,1,0,3,2]){const [xx,zz]=coords[k];pavers.push(xx,floor(xx,zz)+.018,zz);colors.push(color.r,color.g,color.b);}
  }
  const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.Float32BufferAttribute(pavers,3));pg.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));pg.computeVertexNormals();
  kit.add(pg,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),'district-patterned-paving');
  for(const z of [-1128,-1097,-1066])rectangle(-889,z,35,2.8,bronze,.022,'district-bronze-paving-bands');
  rectangle(-892,-1069,13,19,lawn,.042,'district-event-lawn');
  // Arena-side procession of trees, wooden benches and slender two-arm lights.
  for(const z of [-1058,-1075,-1092,-1110,-1128,-1147]) {
    const x=-925+(Math.abs(z+1058))*.20;
    tree(x+5,z,6.7);bench(x+7.5,z+2.1,3);lamp(x+9,z-4.3);
  }
  // East planted edge stays out of the principal north-south promenade.
  for(const z of [-1058,-1082,-1138,-1155]){
    planter(-872,z,3,8);tree(-872,z,6);bench(-876,z+4.6,3.2);
  }
  for(const z of [-1060,-1084,-1138,-1159])lamp(-878,z);
  for(let x=-925;x<=-861;x+=2.5)bollard(x,-1044.5);
  for(let x=-907;x<=-875;x+=2.6)bollard(x,-1170);
  fountain(-891,-1052,1.8);fountain(-885.5,-1052,1.4);fountain(-880.5,-1052,1.7);
  for(const [x,z,shade] of [[-895,-1058,1],[-883,-1058,1],[-878,-1070,0],[-878,-1075,0],[-880,-1151,1]])table(x,z,!!shade);
  // Bike hoops at the entrances are spaced around a clear opening.
  for(let x=-923;x<-913;x+=1.7){const y=floor(x,-1048);kit.beam(point(x,y,-1048),point(x,y+.8,-1048),.065,metal,'district-street-furniture');kit.beam(point(x+1,y,-1048),point(x+1,y+.8,-1048),.065,metal,'district-street-furniture');kit.beam(point(x,y+.8,-1048),point(x+1,y+.8,-1048),.065,metal,'district-street-furniture');}
  // Linear Beer Garden connection: overhead steel and glazing, with clear center aisle.
  rectangle(-823,-1109.5,85,11.6,paving,0,'district-hardscape');
  const gardenGlass=new THREE.MeshStandardMaterial({color:0x9caead,transparent:true,opacity:.25,depthWrite:false,roughness:.28,side:THREE.DoubleSide});
  const gardenY=floor(-819,-1109.5);
  for(let x=-840;x<=-795;x+=7.5){
    for(const z of [-1104.3,-1114.7])kit.box(x,gardenY+4.1,z,.22,8.2,.22,metal,'district-street-furniture');
    kit.box(x,gardenY+8.25,-1109.5,.18,.30,10.8,metal,'district-street-furniture');
  }
  for(const z of [-1104.3,-1109.5,-1114.7])kit.box(-817.5,gardenY+8.25,z,45,.25,.18,metal,'district-street-furniture');
  kit.box(-817.5,gardenY+8.4,-1109.5,45,.06,10.6,gardenGlass,'district-beer-garden-canopy');
  for(let x=-838;x<=-799;x+=5.5)for(const z of [-1105.8,-1113.3]){
    const y=floor(x,z);kit.box(x,y+.75,z,2,.12,.8,wood,'district-wood-seating');
    for(const dz of [-.7,.7])bench(x,z+dz,2.1);
    for(const dx of [-.7,.7])kit.box(x+dx,y+.36,z,.10,.72,.7,metal,'district-street-furniture');
  }
  for(let x=-837;x<-798;x+=7.5)for(let i=0;i<9;i++){
    const z=-1114+i*1.1,y=gardenY+7.1-Math.sin(i/8*Math.PI)*.6;
    if(i<8)kit.beam(point(x,y,z),point(x,gardenY+7.1-Math.sin((i+1)/8*Math.PI)*.6,z+1.1),.018,metal,'district-street-furniture');
    kit.cylinder(x,y-.09,z,.065,.13,glow,'district-lamp-lenses',6);
  }
  // Small wooden stage against the south wall; no permanent crowd blocks the passage.
  kit.box(-808,gardenY+.3,-1114.0,7,.6,1.7,wood,'district-wood-seating');
  for(let i=0;i<3;i++)kit.box(-848,floor(-848,-1105)+.18+i*.3,-1105.8+i*.48,6,.3,.48,wood,'district-wood-seating');
  root.userData.plazaBoundary=plaza;
  root.userData.pavingOffset=.43;
  root.userData.beerGardenAisle={minX:-866,maxX:-780,minZ:-1111.5,maxZ:-1107.5};
  kit.finish();
  const lightPools=new THREE.InstancedMesh(new THREE.PlaneGeometry(7,7),poolMaterial,poolMatrices.length);
  poolMatrices.forEach((matrix,i)=>lightPools.setMatrixAt(i,matrix));
  lightPools.instanceMatrix.needsUpdate=true;pools.add(lightPools);
  for(const name of ['district-hardscape','district-patterned-paving','district-bronze-paving-bands','district-event-lawn','district-planting-beds','district-water','district-fountain-grates']){
    const mesh=root.getObjectByName(name);if(mesh)mesh.castShadow=false;
  }
  const lamps=root.getObjectByName('district-lamp-lenses') as THREE.Mesh|undefined;
  if(lamps){lamps.castShadow=false;lamps.receiveShadow=false;}
  root.userData.features=features;
  root.userData.setLightingMode=(mode:string)=>{
    if(lamps)lamps.visible=mode!=='day';
    pools.visible=mode!=='day';poolMaterial.opacity=mode==='night'?.36:mode==='sunset'?.10:0;
    water.emissive.setHex(0x579477);water.emissiveIntensity=mode==='night'?.12:0;
  };
  root.userData.setLightingMode('day');
  return root;
}
