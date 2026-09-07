import * as THREE from 'three';
import {buildNewMuseum} from './newMuseum.ts';
import {NEW_MUSEUM_SITE} from './newMuseumSite.ts';
import {districtGeometry} from './districtGeometry.ts';
import {createNewMuseumGround} from './newMuseumGround.ts';

export function buildNewMuseumCampus(terrainAt:(x:number,z:number)=>number){
 const root=new THREE.Group();root.name='new-milwaukee-public-museum-campus';
 const s=NEW_MUSEUM_SITE;
 const grade=createNewMuseumGround(terrainAt),groundAt=grade.heightAt;
 const museum=buildNewMuseum({width:s.buildingWidth,depth:s.buildingDepth,height:30.48});
 museum.position.set(s.x,grade.floor,s.z);museum.rotation.y=s.bearing;root.add(museum);
 const b=districtGeometry(root);
 const stone=new THREE.MeshStandardMaterial({color:0xd8d1bb,roughness:.9});
 const cream=new THREE.MeshStandardMaterial({color:0xd9d5c7,roughness:.85});
 const metal=new THREE.MeshStandardMaterial({color:0x727d7d,roughness:.65,metalness:.3});
 const leaves=new THREE.MeshStandardMaterial({color:0x607449,roughness:.96});
 const timber=new THREE.MeshStandardMaterial({color:0xa38555,roughness:.95});
 const soil=new THREE.MeshStandardMaterial({color:0x535c3d,roughness:1});
 const lawn=new THREE.MeshStandardMaterial({color:0x82905e,roughness:1});
 const wetland=new THREE.MeshStandardMaterial({color:0x536d65,roughness:.83});
 const pathMaterial=new THREE.MeshStandardMaterial({color:0xd9ccb0,roughness:.95});
 const flowers=new THREE.MeshStandardMaterial({color:0xab7389,roughness:1});
 const grasses=new THREE.MeshStandardMaterial({color:0x9caa69,roughness:1});
 const garageDark=new THREE.MeshStandardMaterial({color:0x35413f,roughness:.9});
 const garageScreen=new THREE.MeshStandardMaterial({color:0xb8bbb1,roughness:.7,metalness:.2});
 const garageAccent=new THREE.MeshStandardMaterial({color:0x59b1b0,roughness:.65});
 const streetlightMetal=new THREE.MeshStandardMaterial({color:0x3f4a4a,roughness:.5,metalness:.7});
 const streetlightGlow=new THREE.MeshStandardMaterial({color:0xffd19a,emissive:0xffa64d,emissiveIntensity:0,roughness:.38});
 type Point=[number,number];
 // July 2023 City ZND presentation, pp. 8/10 (north-up plans), 13–15
 // (garden/garage perspectives). Coordinates interpret those published plans;
 // they are not surveyed landscape or construction dimensions.
 function surface(points:Point[],material:THREE.Material,name:string,lift=.045){
  const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x,-z)));
  const geometry=new THREE.ShapeGeometry(shape).rotateX(-Math.PI/2);
  const positions=geometry.getAttribute('position');
  for(let i=0;i<positions.count;i++)positions.setY(i,groundAt(positions.getX(i),positions.getZ(i))+lift);
  geometry.computeVertexNormals();b.add(geometry,material,name);
 }
 function route(points:Point[],width:number,material:THREE.Material,name:string,lift=.09,curved=true){
  const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,0,z)));
  const samples=curved?curve.getPoints(Math.max(24,points.length*8)):points.map(([x,z])=>new THREE.Vector3(x,0,z));
  const vertices:number[]=[],indices:number[]=[];
  samples.forEach((point,i)=>{
   const tangent=samples[Math.min(i+1,samples.length-1)]!.clone().sub(samples[Math.max(0,i-1)]!).normalize();
   for(const side of [-1,1]){const x=point.x-tangent.z*width*.5*side,z=point.z+tangent.x*width*.5*side;vertices.push(x,groundAt(x,z)+lift,z);}
   if(i<samples.length-1){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
  });
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();b.add(geometry,material,name);
  return samples.map(point=>[point.x,point.z] as Point);
 }
 const gardenBoundary:Point[]=[[-1095,-1476],[-1072,-1476],[-1072,-1424],[-1070,-1419],[-1087,-1418],[-1089,-1401],[-1089,-1382],[-1088,-1361],[-1075,-1354],[-1096,-1354],[-1098,-1376],[-1097,-1420]];
 surface(gardenBoundary,lawn,'museum-connected-garden-lawn');
 const rainGarden:Point[]=[[-1088,-1469],[-1079,-1471],[-1074,-1466],[-1075,-1454],[-1082,-1443],[-1087,-1438],[-1090,-1444],[-1088,-1456]];
 surface(rainGarden,soil,'museum-irregular-rain-garden',.065);
 surface([[-1085,-1467],[-1079,-1468],[-1077,-1464],[-1078,-1455],[-1083,-1447],[-1087,-1443],[-1087,-1454]],wetland,'museum-rain-garden-basin',.075);
 const westWalk:Point[]=[[-1091,-1477],[-1086,-1473],[-1089,-1462],[-1092,-1448],[-1090,-1438],[-1080,-1429],[-1080,-1420],[-1090,-1416],[-1093,-1402],[-1091,-1384],[-1093,-1371],[-1090,-1358],[-1080,-1353]];
 const walkSamples=route(westWalk,3.1,pathMaterial,'museum-connected-garden-paths');
 const branchSamples=[
  route([[-1090,-1438],[-1083,-1434],[-1073,-1425],[-1068,-1421]],3,pathMaterial,'museum-connected-garden-paths'),
  route([[-1093,-1402],[-1096,-1404],[-1099,-1404]],2.5,pathMaterial,'museum-connected-garden-paths'),
  route([[-1093,-1371],[-1097,-1370],[-1099,-1370]],2.5,pathMaterial,'museum-connected-garden-paths'),
 ];
 surface([[-1086,-1430],[-1073,-1430],[-1070,-1423],[-1069,-1419],[-1085,-1419],[-1090,-1422]],pathMaterial,'museum-connected-garden-paths',.085);
 // Slender angular timber walk along the rain garden's east side and a lookout.
 const boardwalk:Point[]=[[-1088,-1440],[-1081,-1448],[-1076,-1455],[-1075,-1467],[-1079,-1470]];
 route(boardwalk,1.8,timber,'museum-timber-boardwalk',.38,false);
 surface([[-1081,-1471.5],[-1076,-1470.5],[-1076.6,-1466.5],[-1081.6,-1467.5]],timber,'museum-timber-boardwalk',.38);
 for(let i=0;i<boardwalk.length-1;i++){
  const [ax,az]=boardwalk[i]!,[bx,bz]=boardwalk[i+1]!,length=Math.hypot(bx-ax,bz-az),steps=Math.ceil(length/.6);
  for(let j=0;j<=steps;j++){
   const t=j/steps,x=ax+(bx-ax)*t,z=az+(bz-az)*t,dx=-(bz-az)/length*.85,dz=(bx-ax)/length*.85;
   b.beam(new THREE.Vector3(x-dx,groundAt(x-dx,z-dz)+.4,z-dz),new THREE.Vector3(x+dx,groundAt(x+dx,z+dz)+.4,z+dz),.025,metal,'museum-boardwalk-plank-joints');
  }
 }
 // The north/east rectangle is the attached parking structure, not a cafe.
 const garage={x:-1050.5,z:-1450,width:39,depth:54,height:12.4};
 const garageFloor=groundAt(garage.x,garage.z);
 b.box(garage.x,garageFloor+garage.height/2,garage.z,garage.width-.7,garage.height,garage.depth-.7,garageDark,'museum-parking-open-decks');
 for(let level=0;level<=3;level++)b.box(garage.x,garageFloor+.2+level*4,garage.z,garage.width,.34,garage.depth,cream,'museum-parking-concrete-decks');
 for(let x=-1069;x<=-1032;x+=4.6){
  b.box(x,garageFloor+6.2,-1477,.35,12.4,.45,cream,'museum-parking-concrete-decks');
  b.box(x,garageFloor+6.2,-1423,.35,12.4,.45,cream,'museum-parking-concrete-decks');
 }
 for(let y=1.2;y<12.4;y+=.5)b.box(-1070.08,garageFloor+y,-1450,.16,.14,54,garageScreen,'museum-parking-garden-screen');
 for(const x of [-1062,-1056,-1050])b.box(x,garageFloor+7.4,-1477.3,3.1,6.5,.18,garageAccent,'museum-parking-vliet-banners');
 // Short southern connection and outdoor cafe tables match the garden views.
 b.box(-1058,garageFloor+2.4,-1420,15,4.8,6,cream,'museum-parking-concrete-decks');
 for(const [x,z] of [[-1077,-1424],[-1083,-1425],[-1080,-1420]] as Point[]){
  const y=groundAt(x,z);b.cylinder(x,y+.76,z,.65,.1,timber,'museum-garden-tables',12);
  b.cylinder(x,y+.37,z,.07,.74,metal,'museum-garden-furniture');
  for(const dx of [-1.05,1.05])b.box(x+dx,y+.42,z,.5,.12,.55,timber,'museum-garden-tables');
 }
 function inside([x,z]:Point,polygon:Point[]){let result=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i]!,c=polygon[j]!;if((a[1]>z)!==(c[1]>z)&&x<(c[0]-a[0])*(z-a[1])/(c[1]-a[1])+a[0])result=!result;
 }return result;}
 const shrubZones:Point[][]=[
  [[-1095,-1474],[-1091,-1472],[-1093,-1458],[-1095,-1447],[-1097,-1450]],
  [[-1074,-1473],[-1071,-1473],[-1071,-1432],[-1077,-1437],[-1080,-1442],[-1072,-1454]],
  [[-1095,-1433],[-1091,-1434],[-1087,-1428],[-1090,-1421],[-1097,-1419]],
  [[-1098,-1415],[-1095,-1413],[-1096,-1392],[-1095,-1380],[-1098,-1377]],
  [[-1097,-1368],[-1094,-1366],[-1093,-1360],[-1083,-1356],[-1082,-1353],[-1097,-1353]],
  [[-1084,-1352],[-1032,-1352],[-1032,-1349],[-1084,-1349]],
  [[-1068,-1481],[-1033,-1481],[-1033,-1478],[-1068,-1478]],
 ];
 const allWalkSamples=[...walkSamples,...branchSamples.flat()];
 let plantCount=0;
 for(let zoneIndex=0;zoneIndex<shrubZones.length;zoneIndex++){
  const zone=shrubZones[zoneIndex]!,xs=zone.map(p=>p[0]),zs=zone.map(p=>p[1]);
  for(let x=Math.min(...xs)+.6;x<Math.max(...xs);x+=1.65)for(let z=Math.min(...zs)+.55;z<Math.max(...zs);z+=1.7){
   const px=x+.35*Math.sin(x*12+z),pz=z+.3*Math.cos(z*7-x);
   if(!inside([px,pz],zone)||allWalkSamples.some(([wx,wz])=>Math.hypot(px-wx,pz-wz)<2))continue;
   const y=groundAt(px,pz),index=plantCount++,r=.45+(index%4)*.11;
   b.add(new THREE.IcosahedronGeometry(r,0).scale(1,.7+index%3*.2,1).translate(px,y+r*.6,pz),index%5===0?flowers:index%3===0?grasses:leaves,index%5===0?'museum-flowering-perennials':index%3===0?'museum-native-grasses':'museum-native-shrubs');
  }
 }
 const trees:Point[]=[[-1093,-1472],[-1073,-1473],[-1073,-1460],[-1073,-1445],[-1075,-1435],[-1089,-1430],[-1094,-1425],[-1094,-1415],[-1097,-1393],[-1097,-1381],[-1097,-1364],[-1089,-1351],[-1078,-1350],[-1067,-1350],[-1056,-1350],[-1045,-1350],[-1034,-1350],[-1087,-1480],[-1076,-1480],[-1065,-1480],[-1054,-1480],[-1043,-1480],[-1034,-1480]];
 trees.forEach(([x,z],i)=>{
  const y=groundAt(x,z),r=1.8+(i%3)*.35,h=4.3+(i%4)*.4;
  b.cylinder(x,y+h*.47,z,.13,h*.94,timber,'museum-street-tree-trunks',7);
  b.add(new THREE.IcosahedronGeometry(r,1).scale(1,1.24,1).translate(x,y+h,z),leaves,'museum-street-tree-canopies');
 });
 for(const [x,z] of [[-1093,-1436],[-1095,-1398],[-1090,-1360]] as Point[]){const y=groundAt(x,z);b.box(x,y+.53,z,.7,.15,2.5,timber,'museum-garden-benches');for(const dz of [-.85,.85])b.box(x,y+.25,z+dz,.45,.5,.12,metal,'museum-bench-feet');}
 for(const [x,z,r] of [[-1084,-1436,.6],[-1082,-1438,.8],[-1086,-1435,.55]])b.add(new THREE.IcosahedronGeometry(r,0).scale(1.3,.7,1).translate(x,groundAt(x,z)+r*.4,z),stone,'museum-garden-boulders');
 const ground=new THREE.Mesh(grade.geometry,stone);
 ground.name='museum-graded-ground';ground.receiveShadow=true;
 ground.userData.walkingSurface='grade';ground.userData.drivingSurface='road';
 root.add(ground);
 root.userData.finishedFloor=grade.floor;root.userData.groundAt=groundAt;
 route([[-1094,-1353],[-1080,-1353],[-1055,-1353],[-1026,-1353]],4,pathMaterial,'museum-connected-garden-paths');
 root.userData.landscapeSource={document:'City of Milwaukee File 221922 ZND presentation, July 2023',pages:[8,10,13,14,15],interpretation:'approximate published site-plan layout'};
 root.userData.gardenPath=walkSamples;
 root.userData.boardwalk=boardwalk;
 root.userData.garage=garage;
 root.userData.treePositions=trees;
 root.userData.plantCount=plantCount;

 // Six slim fixtures mark the public Sixth Street and McKinley edges. Their
 // bases are sampled independently so they remain grounded on the live terrain.
 const streetlightPositions:[number,number][]=[
  [-1097.0,-1460],[-1097.0,-1415],[-1097.0,-1370],
  [-1085,-1352],[-1055,-1352],[-1025,-1352],
 ];
 for(const [x,z] of streetlightPositions){
  const y=groundAt(x,z);
  b.cylinder(x,y+3.3,z,.105,6.6,streetlightMetal,'museum-streetlight-poles',8);
  b.box(x,y+6.65,z,.62,.14,.42,streetlightMetal,'museum-streetlight-fixture-arms');
  b.box(x,y+6.52,z,.38,.2,.28,streetlightGlow,'museum-streetlight-lamps');
 }
 b.finish();

 // A single additive pool mesh keeps the six warm pools cheap to render.
 const poolSize=24,rgba=new Uint8Array(poolSize*poolSize*4);
 for(let py=0;py<poolSize;py++)for(let px=0;px<poolSize;px++){
  const i=(py*poolSize+px)*4,r=Math.hypot((px+.5)/poolSize*2-1,(py+.5)/poolSize*2-1);
  rgba[i]=255;rgba[i+1]=194;rgba[i+2]=112;rgba[i+3]=Math.round(82*Math.max(0,1-r)**2);
 }
 const poolTexture=new THREE.DataTexture(rgba,poolSize,poolSize);poolTexture.needsUpdate=true;
 const poolMaterial=new THREE.MeshBasicMaterial({map:poolTexture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0});
 const pools=new THREE.InstancedMesh(new THREE.PlaneGeometry(4,4).rotateX(-Math.PI/2),poolMaterial,streetlightPositions.length);
 pools.name='museum-streetlight-ground-light-pools';
 streetlightPositions.forEach(([x,z],i)=>pools.setMatrixAt(i,new THREE.Matrix4().makeTranslation(x,groundAt(x,z)+.035,z)));
 pools.instanceMatrix.needsUpdate=true;root.add(pools);
 root.userData.streetlightPositions=streetlightPositions.map(([x,z])=>({x,z,y:groundAt(x,z)}));
 root.userData.lampPositions=root.userData.streetlightPositions;
 root.userData.setLightingMode=(mode:'day'|'sunset'|'night')=>museum.userData.setLightingMode?.(mode);
 const setLightingMode=root.userData.setLightingMode;
 root.userData.setLightingMode=(mode:'day'|'sunset'|'night')=>{
  const level=mode==='night'?1:mode==='sunset'?.35:0;
  streetlightGlow.emissiveIntensity=level*2.2;poolMaterial.opacity=level;pools.visible=level>0;
  setLightingMode(mode);root.userData.lightingMode=mode;
 };
 root.userData.setLightingMode('day');
 root.userData.visualization='future-completed-design';
 return root;
}
