import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {buildSummerfest} from '../src/summerfest.ts';
import {SUMMERFEST_VENUES,adaptSummerfestTile,prepareSummerfestTerrain,withinSummerfest} from '../src/summerfestSite.ts';
function parseSections(buffer:ArrayBuffer){
 const bytes=new Uint8Array(buffer),view=new DataView(buffer),sections:{name:string;positions:Float32Array}[]=[];let offset=12;
 for(let s=0;s<view.getUint32(8,true);s++){
  const name=new TextDecoder().decode(bytes.slice(offset,offset+4)).trim();offset+=4;
  const count=view.getUint32(offset,true);offset+=4;
  const origin=[0,4,8].map(i=>view.getFloat32(offset+i,true)),scale=view.getFloat32(offset+12,true);offset+=16;
  const positions=new Float32Array(count*3);for(let i=0;i<positions.length;i++)positions[i]=view.getInt16(offset+i*2,true)*scale+origin[i%3];
  offset=Math.ceil((offset+count*6)/4)*4;offset=Math.ceil((offset+count*3)/4)*4;sections.push({name,positions});
 }return sections;
}


const model=buildSummerfest(()=>2.2);
test('all nine venues have finite, bounded geometry at mapped locations',()=>{
 for(const site of SUMMERFEST_VENUES){const venue=model.getObjectByName(`summerfest-${site.id}`)!;assert.ok(venue);assert.equal(venue.position.x,site.x);assert.equal(venue.position.z,site.z);assert.ok(withinSummerfest(site.x,site.z));}
 let meshes=0;model.traverse(o=>{if(o instanceof THREE.Mesh){meshes++;for(const n of o.geometry.getAttribute('position').array)assert.ok(Number.isFinite(n));}});
 assert.ok(meshes<130,`too many unbatched meshes: ${meshes}`);
 assert.equal(model.userData.stats.mappedBuildings,80);assert.ok(model.userData.stats.paths>=60);assert.ok(model.userData.stats.lamps>=15);
});
test('night and sunset light the campus, and day extinguishes every venue light',()=>{
 const lights:THREE.SpotLight[]=[];model.traverse(o=>{if(o instanceof THREE.SpotLight)lights.push(o);});assert.equal(lights.length,9);
 model.userData.setLightingMode('night');const night=lights.map(l=>l.intensity);assert.ok(night.every(n=>n>0));assert.ok(model.getObjectByName('warm-walkway-light-pools')!.visible);
 model.userData.setLightingMode('sunset');lights.forEach((l,i)=>assert.ok(l.intensity>0&&l.intensity<night[i]));
 model.userData.setLightingMode('day');assert.ok(lights.every(l=>l.intensity===0));assert.equal(model.getObjectByName('warm-walkway-light-pools')!.visible,false);
 model.traverse(o=>{if(o instanceof THREE.Mesh){const ms=Array.isArray(o.material)?o.material:[o.material];for(const m of ms)if(m instanceof THREE.MeshStandardMaterial)assert.equal(m.emissiveIntensity*m.emissive.getHex(),0);}});
});
test('terrain correction is immutable and confined to the festival boundary',()=>{
 const base={nx:60,ny:120,x0:250,y0:-1050,step:10,heights:new Float32Array(7200).fill(15),colors:new Uint8Array(21600)};
 const result=prepareSummerfestTerrain(base);let changed=0;
 for(let j=0;j<base.ny;j++)for(let i=0;i<base.nx;i++){const k=j*base.nx+i;assert.equal(base.heights[k],15);if(result.heights[k]!==15){changed++;assert.ok(withinSummerfest(base.x0+i*10,-base.y0-j*10));assert.ok(result.heights[k]>=2.19);}}
 assert.ok(changed>100);assert.equal(result.colors,base.colors);
});
test('packed tile replacement preserves highways and unrelated building triangles',()=>{
 let total=0;
 for(const j of [0,-1]){
  const bytes=readFileSync(new URL(`../public/data/tiles/t_0_${j}.bin`,import.meta.url));const sections=parseSections(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));const group=new THREE.Group();
  for(const s of sections){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(s.positions.slice(),3));const mesh=new THREE.Mesh(geo);mesh.name=s.name;group.add(mesh);}
  const highways=group.children.filter(o=>o.name==='HWAY').map(o=>(o as THREE.Mesh).geometry.getAttribute('position').array.slice());
  const before=group.children.filter(o=>o.name==='BLDG').flatMap(o=>Array.from((o as THREE.Mesh).geometry.getAttribute('position').array));
  total+=adaptSummerfestTile(group,{i:0,j},()=>2.2);
  group.children.filter(o=>o.name==='HWAY').forEach((o,i)=>assert.deepEqual((o as THREE.Mesh).geometry.getAttribute('position').array,highways[i]));
  // The old amphitheater includes five inner courtyard rings. No horizontal
  // roof triangles at its packed 22.63m level may remain in the seating bowl.
  for(const o of group.children.filter(o=>o.name==='BLDG')){
    const p=(o as THREE.Mesh).geometry.getAttribute('position');
    for(let i=0;i<p.count;i+=3)assert.ok(![0,1,2].every(k=>Math.abs(p.getY(i+k)-22.63)<.02&&p.getX(i+k)>525&&p.getX(i+k)<680&&p.getZ(i+k)>780&&p.getZ(i+k)<950),'old amphitheater roof remains');
  }
  const after=group.children.filter(o=>o.name==='BLDG').flatMap(o=>Array.from((o as THREE.Mesh).geometry.getAttribute('position').array));
  const outside=(a:number[])=>{const out:string[]=[];for(let i=0;i<a.length;i+=9)if([0,3,6].every(k=>a[i+k]<320||a[i+k]>820||a[i+k+2]<-100||a[i+k+2]>1020))out.push(a.slice(i,i+9).join(','));return out;};
  assert.deepEqual(outside(after),outside(before));
  assert.equal(adaptSummerfestTile(group,{i:0,j},()=>2.2),0,'replacement must be idempotent');
 }
 assert.ok(total>500,`expected mapped shells to be removed, got ${total}`);
});

test('an unrelated shell inside the grounds survives source replacement',()=>{
 const group=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(15,80,15).toNonIndexed());mesh.name='BLDG';mesh.geometry.translate(500,50,300);group.add(mesh);const before=mesh.geometry.getAttribute('position').array.slice();
 assert.equal(adaptSummerfestTile(group,{i:0,j:-1},()=>2.2),0);assert.deepEqual(mesh.geometry.getAttribute('position').array,before);
});


test('Aurora stage backs onto the lake while the audience faces east toward it',()=>{
 const venue=model.getObjectByName('summerfest-aurora')!;model.updateMatrixWorld(true);
 const stage=venue.localToWorld(new THREE.Vector3(...venue.userData.stageCenter as [number,number,number]));
 const audience=venue.localToWorld(new THREE.Vector3(0,1,venue.userData.stageFront+18));
 assert.ok(stage.x>audience.x+15,'stage must be east of its inland audience');
 assert.ok(Math.abs(stage.z-audience.z)<.001,'audience axis should run east–west');
 const {width,depth}=venue.userData.roofDimensions;
 const eastWest=venue.localToWorld(new THREE.Vector3(0,0,depth/2)).distanceTo(venue.localToWorld(new THREE.Vector3(0,0,-depth/2)));
 assert.equal(eastWest,65);assert.equal(width,35,'preserve mapped roof dimensions after turning');
 const wash=venue.getObjectByName('localized-stage-wash') as THREE.SpotLight;
 assert.ok(wash.target.getWorldPosition(new THREE.Vector3()).x>wash.getWorldPosition(new THREE.Vector3()).x,'stage wash must turn with the venue');
});

test('Aurora audience fits beneath the pavilion with a clear aisle and no promenade poles',()=>{
 const venue=model.getObjectByName('summerfest-aurora')!;
 const seats=venue.getObjectByName('seat-backs') as THREE.Mesh;
 seats.geometry.computeBoundingBox();const bounds=seats.geometry.boundingBox!;
 const {width,depth}=venue.userData.roofDimensions;
 assert.ok(venue.userData.stageFront < -depth/5,'stage must stay at the lake end of the pavilion');
 const stageMesh=venue.getObjectByName('front-of-house-mixing-desk') as THREE.Mesh;
 const stagePositions=stageMesh.geometry.getAttribute('position'),deckZ:number[]=[];
 // The performance deck is the dark batch's only geometry resting at y=0.
 for(let i=0;i<stagePositions.count;i++)if(Math.abs(stagePositions.getY(i))<.001)deckZ.push(stagePositions.getZ(i));
 assert.equal(Math.max(...deckZ)-Math.min(...deckZ),12,'performance deck must not stretch across the hall');
 assert.ok(bounds.min.z>venue.userData.stageFront+4,'leave an apron between the stage and first row');
 assert.ok(bounds.max.z<depth/2-5,'leave a rear aisle and mixing position beneath the roof');
 assert.ok(bounds.min.x>-width/2+2&&bounds.max.x<width/2-2,'leave side aisles inside the columns');
 const p=seats.geometry.getAttribute('position');
 for(let i=0;i<p.count;i++)assert.ok(Math.abs(p.getX(i))>=1.5,'no seating in the central aisle');
 const pools=model.getObjectByName('warm-walkway-light-pools') as THREE.InstancedMesh;
 const matrix=new THREE.Matrix4();model.updateMatrixWorld(true);
 for(let i=0;i<pools.count;i++){
  pools.getMatrixAt(i,matrix);
  const pole=venue.worldToLocal(pools.localToWorld(new THREE.Vector3().setFromMatrixPosition(matrix)));
  assert.ok(!(pole.x>bounds.min.x-1&&pole.x<bounds.max.x+1&&pole.z>bounds.min.z-1&&pole.z<bounds.max.z+1),'promenade pole intersects seating');
 }
});

test('Aurora has stepped curved roofs and an entrance opening clear of the seats',()=>{
 const venue=model.getObjectByName('summerfest-aurora')!;
 const architecture=venue.getObjectByName('aurora-pavilion-architecture')!;
 const roof=architecture.getObjectByName('aurora-concession-roof-ribs') as THREE.Mesh;
 const p=roof.geometry.getAttribute('position');
 const topAt=(x:number,z:number)=>{
  let y=-Infinity;for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i)-x)<.1&&Math.abs(p.getZ(i)-z)<.1)y=Math.max(y,p.getY(i));return y;
 };
 assert.ok(topAt(0,5)>topAt(0,32.5)+2,'lakeward roof must rise behind the entrance shell');
 assert.ok(topAt(0,32.5)>topAt(17.5,32.5)+4,'entrance shell must arch over its side eaves');
 const entry=architecture.getObjectByName('aurora-entry-lettering')!;
 assert.ok(entry.position.y>10,'name board mounts on the entrance truss');
 assert.ok(architecture.getObjectByName('aurora-digital-welcome'));
 const seats=venue.getObjectByName('seat-backs') as THREE.Mesh;
 seats.geometry.computeBoundingBox();assert.ok(seats.geometry.boundingBox!.max.z<22,'reserve a foyer before the entry concession wings');
 assert.ok(seats.geometry.boundingBox!.max.y<1.5,'pavilion seating rests on a level floor');
 model.userData.setLightingMode('night');
 const display=architecture.getObjectByName('aurora-digital-welcome') as THREE.Mesh;
 assert.ok((display.material as THREE.MeshStandardMaterial).emissiveIntensity>0);
 model.userData.setLightingMode('day');assert.equal((display.material as THREE.MeshStandardMaterial).emissiveIntensity,0);
});
