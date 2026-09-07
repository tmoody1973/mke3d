import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type StreetLightKind = 'downtownMast' | 'thirdWardHeritage' | 'thirdWardRiverwalk' | 'stadiumCampus' | 'plazaEvent';
export type StreetLightingMode = 'day' | 'sunset' | 'night';
export interface StreetLightingSite {
  id: string; kind: StreetLightKind; x: number; z: number; y?: number; poolX?: number; poolY?: number; poolZ?: number;
  /** Radians around world +Y; local +Z is the mast's outreach direction. */
  heading?: number;
  /** Disable approximate ground pools on water-facing or uncertain surfaces. */
  pool?: boolean;
}
export interface StreetLightingOptions {
  mobile?: boolean; maxLights?: number; activeRadius?: number; updateIntervalMs?: number;
  /** Monotonic clock override, useful for deterministic simulation and tests. */
  now?: () => number;
}
const PROFILES = {
  downtownMast: { height: 9.5, head: [0, 9.28, 2.8], color: 0xffe7bb, intensity: 260, reach: 23, pool: 5.3 },
  thirdWardHeritage: { height: 5.7, head: [0, 5.12, 0], color: 0xffcd85, intensity: 90, reach: 14, pool: 3.4 },
  thirdWardRiverwalk: { height: 1.05, head: [0, .84, 0], color: 0xffcf8c, intensity: 9, reach: 4, pool: 1.25 },
  stadiumCampus: { height: 14, head: [0, 13.15, 0], color: 0xffe3b5, intensity: 580, reach: 31, pool: 6.8 },
  plazaEvent: { height: 6.8, head: [0, 6.53, 0], color: 0xffdfaa, intensity: 145, reach: 18, pool: 3.9 },
} satisfies Record<StreetLightKind, {height:number;head:number[];color:number;intensity:number;reach:number;pool:number}>;

/** Original regional fixture templates; reference photos are not runtime assets. */
function template(kind: StreetLightKind) {
  const body: THREE.BufferGeometry[] = [], lens: THREE.BufferGeometry[] = [];
  const charcoal = 0x303a39, silver = 0x929995, green = 0x3f6258;
  function add(g:THREE.BufferGeometry, color:number, luminous=false) {
    g.deleteAttribute('uv'); const flat=g.index?g.toNonIndexed():g;if(flat!==g)g.dispose();
    if(!luminous){const c=new THREE.Color(color),colors=new Float32Array(flat.getAttribute('position').count*3);for(let i=0;i<colors.length;i+=3)c.toArray(colors,i);flat.setAttribute('color',new THREE.BufferAttribute(colors,3));}
    (luminous?lens:body).push(flat);
  }
  function box(x:number,y:number,z:number,w:number,h:number,d:number,color=charcoal,luminous=false){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);add(g,color,luminous);}
  function cylinder(x:number,y:number,z:number,rt:number,rb:number,h:number,color=charcoal,luminous=false,segments=10){const g=new THREE.CylinderGeometry(rt,rb,h,segments);g.translate(x,y,z);add(g,color,luminous);}
  function bar(a:number[],b:number[],r:number,color=charcoal){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),delta=vb.clone().sub(va);const g=new THREE.CylinderGeometry(r,r,delta.length(),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));g.translate(...va.add(vb).multiplyScalar(.5).toArray());add(g,color);}
  function curved(points:number[][],r:number,color=charcoal){add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),12,r,6,false),color);}
  function base(radius:number,color=charcoal){cylinder(0,.07,0,radius,radius,.14,color);cylinder(0,.31,0,radius*.64,radius*.8,.48,color);for(const x of [-1,1])for(const z of [-1,1])cylinder(x*radius*.57,.155,z*radius*.57,.027,.027,.035,silver,false,6);}
  if(kind==='downtownMast') {
    base(.28,silver);cylinder(0,4.6,0,.065,.125,8.6,silver);
    curved([[0,8.3,0],[.30,8.78,0],[1.2,9.15,0],[2.35,9.38,0]],.064,silver);
    const housing=new THREE.SphereGeometry(1,12,6);housing.scale(.60,.13,.245);housing.translate(2.75,9.38,0);add(housing,silver);
    box(2.95,9.263,0,.62,.025,.35,0,true);for(let i=0;i<4;i++)box(2.76+i*.11,9.242,0,.075,.02,.29,0,true);
    box(.10,.91,0,.055,.29,.105,charcoal);
  } else if(kind==='thirdWardHeritage') {
    base(.28);cylinder(0,.78,0,.13,.20,1.1);cylinder(0,2.78,0,.068,.115,3.2);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;bar([Math.cos(a)*.105,.65,Math.sin(a)*.105],[Math.cos(a)*.081,3.95,Math.sin(a)*.081],.012);}
    for(const y of [1.25,4.29,4.43])cylinder(0,y,0,.15,.15,.065);
    cylinder(0,4.63,0,.25,.13,.28);cylinder(0,5.03,0,.29,.16,.68,0,true,6);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;bar([Math.cos(a)*.16,4.69,Math.sin(a)*.16],[Math.cos(a)*.29,5.37,Math.sin(a)*.29],.023);}
    cylinder(0,5.38,0,.33,.33,.10);cylinder(0,5.51,0,.07,.35,.23);cylinder(0,5.65,0,.018,.07,.10);
    curved([[0,3.45,0],[.48,3.67,0],[.66,3.92,0],[.38,4.01,0]],.025);
  } else if(kind==='thirdWardRiverwalk') {
    base(.16);cylinder(0,.49,0,.10,.13,.70);cylinder(0,.84,0,.135,.135,.26,0,true);
    for(const y of [.73,.80,.88,.97])cylinder(0,y,0,.158,.158,.038);
    cylinder(0,1.01,0,.11,.17,.08);
  } else if(kind==='stadiumCampus') {
    base(.37,silver);cylinder(0,6.05,0,.105,.21,11.6,silver);cylinder(0,11.95,0,.16,.19,.27,green);
    // Twin curved public-approach heads visible in the stadium exterior photos.
    for(const side of [-1,1]){
      curved([[0,11.72,0],[side*.55,12.18,0],[side*1.0,13.25,0],[side*1.31,13.56,0],[side*1.47,13.23,0]],.065,green);
      cylinder(side*1.47,13.18,0,.12,.34,.36,green);cylinder(side*1.47,12.92,0,.28,.20,.19,0,true);
      cylinder(side*1.47,13.4,0,.035,.10,.22,green);
    }
    cylinder(0,13.71,0,.025,.07,.57,green);
  } else {
    base(.23);cylinder(0,3.31,0,.064,.105,6.34);
    for(const side of [-1,1])bar([side*.05,6.12,0],[side*.29,6.54,0],.033);
    cylinder(0,6.58,0,.41,.31,.09,0,true,16);cylinder(0,6.70,0,.29,.48,.16,charcoal,false,16);
    cylinder(0,6.79,0,.05,.19,.025);
  }
  const geometry=mergeGeometries(body)!,glowGeometry=mergeGeometries(lens)!;body.forEach(g=>g.dispose());lens.forEach(g=>g.dispose());
  geometry.rotateY(-Math.PI/2);glowGeometry.rotateY(-Math.PI/2);geometry.computeBoundingBox();glowGeometry.computeBoundingBox();return {geometry,glowGeometry};
}

/** One shared city manager: a fixed light pool, never a budget per district. */
export function createStreetLighting(sites:readonly StreetLightingSite[],groundAt:(x:number,z:number)=>number,options:StreetLightingOptions={}) {
  const root=new THREE.Group();root.name='milwaukee-street-lighting';
  const clock=options.now??(()=>performance.now()),hardCap=options.mobile?3:6;
  const maxLights=Math.max(0,Math.min(hardCap,Math.floor(options.maxLights??hardCap)));
  const radius=Math.max(1,Math.min(90,options.activeRadius??90)),interval=Math.max(100,options.updateIntervalMs??250);
  const bodyMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.65,metalness:.45});
  const lensMaterials:THREE.MeshStandardMaterial[]=[],batches:THREE.InstancedMesh[]=[],geometries:THREE.BufferGeometry[]=[];
  type Fixture={site:StreetLightingSite;floor:number;head:THREE.Vector3;profile:typeof PROFILES[StreetLightKind]};
  const fixtures:Fixture[]=[],grid=new Map<string,Fixture[]>(),seen=new Set<string>();
  const stats={fixtures:0,skippedSites:0,pools:0,drawCalls:0,maxLights,activeLights:0,selectionUpdates:0,selectedSiteIds:[] as string[],disposed:false,families:{} as Partial<Record<StreetLightKind,number>>};
  for(const site of sites){
    if(seen.has(site.id)||!(site.kind in PROFILES)||![site.x,site.z,site.heading??0].every(Number.isFinite)){stats.skippedSites++;continue;}
    const floor=site.y??groundAt(site.x,site.z);if(!Number.isFinite(floor)){stats.skippedSites++;continue;}seen.add(site.id);
    const profile=PROFILES[site.kind],head=new THREE.Vector3(...profile.head).applyAxisAngle(new THREE.Vector3(0,1,0),site.heading??0).add(new THREE.Vector3(site.x,floor,site.z));
    const fixture={site,floor,head,profile};fixtures.push(fixture);const key=`${Math.floor(head.x/radius)},${Math.floor(head.z/radius)}`;const cell=grid.get(key)??[];cell.push(fixture);grid.set(key,cell);
  }
  for(const kind of Object.keys(PROFILES) as StreetLightKind[]){
    const members=fixtures.filter(f=>f.site.kind===kind);if(!members.length)continue;stats.families[kind]=members.length;
    const {geometry,glowGeometry}=template(kind),lensMaterial=new THREE.MeshStandardMaterial({color:0xb9b5a6,emissive:PROFILES[kind].color,emissiveIntensity:0,roughness:.25,toneMapped:false});
    lensMaterials.push(lensMaterial);geometries.push(geometry,glowGeometry);
    const bodies=new THREE.InstancedMesh(geometry,bodyMaterial,members.length),lenses=new THREE.InstancedMesh(glowGeometry,lensMaterial,members.length);
    bodies.name=`street-${kind}-bodies`;lenses.name=`street-${kind}-lenses`;
    bodies.userData={kind,part:'body',siteIds:members.map(f=>f.site.id)};lenses.userData={kind,part:'lens'};
    const transform=new THREE.Object3D();members.forEach((f,i)=>{transform.position.set(f.site.x,f.floor,f.site.z);transform.rotation.set(0,f.site.heading??0,0);transform.updateMatrix();bodies.setMatrixAt(i,transform.matrix);lenses.setMatrixAt(i,transform.matrix);});
    for(const batch of [bodies,lenses]){batch.instanceMatrix.needsUpdate=true;batch.computeBoundingBox();batch.computeBoundingSphere();batch.castShadow=false;batch.receiveShadow=true;root.add(batch);batches.push(batch);}
  }
  // Three radial rings follow local terrain plus the sampled sidewalk/road offset.
  // No pools by default on the water-adjacent riverwalk fixture family.
  const positions:number[]=[],colors:number[]=[];
  for(const f of fixtures){
    if(f.site.pool===false||(f.site.kind==='thirdWardRiverwalk'&&f.site.pool!==true))continue;
    const center={x:f.site.poolX??f.head.x,z:f.site.poolZ??f.head.z},baseTerrain=groundAt(f.site.x,f.site.z),centerTerrain=groundAt(center.x,center.z);if(!Number.isFinite(baseTerrain)||!Number.isFinite(centerTerrain))continue;
    const anchor=f.site.poolY??(centerTerrain+f.floor-baseTerrain+.026),offset=anchor-centerTerrain,color=new THREE.Color(f.profile.color),samples:{p:number[];value:number}[][]=[];let safe=true;
    for(const fraction of [0,.34,.70,1]){
      const ring:{p:number[];value:number}[]=[];
      for(let j=0;j<16;j++){const angle=j*Math.PI/8,x=center.x+Math.cos(angle)*f.profile.pool*fraction,z=center.z+Math.sin(angle)*f.profile.pool*fraction,y=groundAt(x,z)+offset;if(!Number.isFinite(y)||Math.abs(y-anchor)>1.5)safe=false;ring.push({p:[x,y,z],value:Math.pow(1-fraction,2)});}samples.push(ring);
    }
    if(!safe)continue;stats.pools++;
    const vertex=(v:{p:number[];value:number})=>{positions.push(...v.p);colors.push(color.r*v.value,color.g*v.value,color.b*v.value);};
    for(let r=0;r<3;r++)for(let j=0;j<16;j++){const next=(j+1)%16,a=samples[r][j],b=samples[r+1][j],c=samples[r+1][next],d=samples[r][next];vertex(a);vertex(c);vertex(b);if(r>0){vertex(a);vertex(d);vertex(c);}}
  }
  const poolGeometry=new THREE.BufferGeometry();poolGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));poolGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));poolGeometry.computeBoundingSphere();geometries.push(poolGeometry);
  const poolMaterial=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
  const pools=new THREE.Mesh(poolGeometry,poolMaterial);pools.name='street-ground-pools';pools.visible=false;pools.renderOrder=2;root.add(pools);
  const lights=Array.from({length:maxLights},()=>{const light=new THREE.PointLight(0xffffff,0,1,2);light.name='street-nearby-light';light.castShadow=false;light.visible=false;root.add(light);return light;});
  stats.fixtures=fixtures.length;stats.drawCalls=batches.length+(stats.pools?1:0);
  let mode:StreetLightingMode='day',lastSelection=-Infinity,lastCamera:THREE.Vector3|undefined;
  function select(camera:THREE.Vector3,force=false){
    if(stats.disposed||mode==='day')return;const time=clock();if(!force&&time-lastSelection<interval)return;lastSelection=time;stats.selectionUpdates++;
    const closest:{f:Fixture;distance:number}[]=[],gx=Math.floor(camera.x/radius),gz=Math.floor(camera.z/radius);
    for(let x=gx-1;x<=gx+1;x++)for(let z=gz-1;z<=gz+1;z++)for(const f of grid.get(`${x},${z}`)??[]){
      const distance=f.head.distanceToSquared(camera);if(distance>=radius*radius||maxLights===0)continue;
      let index=0;while(index<closest.length&&closest[index].distance<=distance)index++;if(index<maxLights){closest.splice(index,0,{f,distance});if(closest.length>maxLights)closest.pop();}
    }
    const factor=mode==='sunset'?.4:1;stats.selectedSiteIds=closest.map(c=>c.f.site.id);stats.activeLights=closest.length;
    lights.forEach((light,i)=>{const f=closest[i]?.f;light.visible=!!f;light.intensity=f?f.profile.intensity*factor:0;light.userData.siteId=f?.site.id;if(f){light.position.copy(f.head);light.color.setHex(f.profile.color);light.distance=f.profile.reach;}});
  }
  function setMode(next:StreetLightingMode){
    if(stats.disposed)return;mode=next;const factor=mode==='night'?1:mode==='sunset'?.4:0;
    lensMaterials.forEach(m=>m.emissiveIntensity=4*factor);poolMaterial.opacity=.20*factor;pools.visible=factor>0&&stats.pools>0;
    if(!factor){for(const light of lights){light.intensity=0;light.visible=false;delete light.userData.siteId;}stats.activeLights=0;stats.selectedSiteIds=[];lastSelection=-Infinity;}
    else if(lastCamera)select(lastCamera,true);
  }
  function update(position:THREE.Vector3|{x:number;y:number;z:number}){if(stats.disposed||![position.x,position.y,position.z].every(Number.isFinite))return;if(!lastCamera)lastCamera=new THREE.Vector3();lastCamera.set(position.x,position.y,position.z);select(lastCamera);}
  function dispose(){if(stats.disposed)return;setMode('day');stats.disposed=true;batches.forEach(batch=>batch.dispose());geometries.forEach(g=>g.dispose());bodyMaterial.dispose();lensMaterials.forEach(m=>m.dispose());poolMaterial.dispose();grid.clear();root.removeFromParent();root.clear();}
  root.userData.setLightingMode=setMode;return {root,setMode,update,dispose,stats};
}
