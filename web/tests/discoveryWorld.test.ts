import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { buildDiscoveryWorld, DISCOVERY_CROWN, DISCOVERY_TERRACE, DISCOVERY_ROUND_CENTER, DISCOVERY_PROMENADE_INNER, DISCOVERY_PROMENADE_WIDTH } from '../src/discoveryWorld.ts';
import { DISCOVERY_PARTS } from '../src/discoveryGeometry.ts';
import { DISCOVERY_SITE } from '../src/discoverySite.ts';

function worldBounds(model: THREE.Group, object: THREE.Object3D) {
  model.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object);
}
function sourceMesh(model: THREE.Group,id: number) {
  return model.children.find(o=>o.userData.sourceId===id) as THREE.Mesh;
}

test('every component preserves its exact cached OSM footprint and absolute top height',()=>{
  const source=JSON.parse(readFileSync(new URL('../../data/discovery_site.json',import.meta.url),'utf8'));
  const model=buildDiscoveryWorld(()=>-5);
  assert.equal(model.name,'discovery-world');
  assert.deepEqual(model.position.toArray(),[721,2.5,-200]);
  assert.equal(DISCOVERY_PARTS.length,13);
  for(const part of DISCOVERY_PARTS) {
    const raw=source.areas.find((a:{id:number})=>a.id===part.id);
    assert.deepEqual(part.footprint,raw.outer_xz.slice(0,-1));
    assert.equal(part.height,raw.height_m);
    const box=worldBounds(model,sourceMesh(model,part.id));
    const expected=raw.bounds_xz;
    [box.min.x,box.min.z,box.max.x,box.max.z].forEach((n,i)=>assert.ok(Math.abs(n-expected[i])<.001,`${part.id}: projected bounds`));
    assert.ok(Math.abs(box.max.y-(DISCOVERY_SITE.floor+raw.height_m))<.001);
    const bottom=part.roofOnly?part.height-.23:part.minHeight;
    assert.ok(Math.abs(box.min.y-(DISCOVERY_SITE.floor+bottom))<.001);
  }
});

test('rectangular science wing is west of rotunda and 2017 hall stays north and low',()=>{
  const model=buildDiscoveryWorld(()=>-5);
  const science=worldBounds(model,sourceMesh(model,700564608));
  const round=worldBounds(model,sourceMesh(model,700564600));
  const north=worldBounds(model,sourceMesh(model,700564567));
  const bridge=worldBounds(model,sourceMesh(model,700564603));
  assert.ok(science.max.x<round.min.x);
  assert.ok(north.max.z<round.min.z);
  assert.ok(north.max.y<science.max.y);
  assert.ok(bridge.min.x<round.min.x&&bridge.max.x>=round.min.x);
  assert.ok(science.max.x-science.min.x>70);
  assert.ok(round.max.x-round.min.x>35&&round.max.x-round.min.x<37);
  const panels=worldBounds(model,model.getObjectByName('science-wing-white-upper-panels')!);
  assert.ok(Math.abs(panels.max.y-panels.min.y-3.7)<.001);
  assert.ok(panels.min.y>DISCOVERY_SITE.floor+3.3,'recessed glass base remains exposed');
  assert.ok(panels.max.y<science.max.y,'upper window strip remains exposed');
});

test('mapped white arcs remain separate from glass and crown retains a real centre hole',()=>{
  const model=buildDiscoveryWorld(()=>-5);
  const arcs=DISCOVERY_PARTS.filter(p=>p.white);
  assert.equal(arcs.length,4);
  arcs.forEach(p=>assert.ok(p.minHeight>3));
  const crown=model.getObjectByName('pilothouse-open-white-crown') as THREE.Mesh;
  const pos=crown.geometry.getAttribute('position');
  const cx=DISCOVERY_ROUND_CENTER.x-DISCOVERY_SITE.x,cz=DISCOVERY_ROUND_CENTER.z-DISCOVERY_SITE.z;
  for(let i=0;i<pos.count;i++) {
    const radius=Math.hypot(pos.getX(i)-cx,pos.getZ(i)-cz);
    assert.ok(radius>=DISCOVERY_CROWN.innerRadius-.001&&radius<=DISCOVERY_CROWN.outerRadius+.001);
  }
  // A ray down the open centre must pass through the crown without a roof hit.
  model.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(DISCOVERY_ROUND_CENTER.x,30,DISCOVERY_ROUND_CENTER.z),new THREE.Vector3(0,-1,0));
  assert.equal(ray.intersectObject(crown).length,0);
  assert.ok(ray.intersectObject(sourceMesh(model,700564602)).length>0,'inset Pilot House is a closed volume');
});

test('mapped foundations and each boardwalk pile reach the sampled lake bed',()=>{
  const ground=(x:number,z:number)=>-4.8+Math.sin(x/12)*.2+Math.cos(z/20)*.1;
  const model=buildDiscoveryWorld(ground);
  const foundation=worldBounds(model,model.getObjectByName('mapped-foundations-to-terrain')!);
  assert.ok(foundation.min.y<-4.8);
  assert.ok(Math.abs(foundation.max.y-DISCOVERY_SITE.floor)<.001);
  assert.equal(model.userData.pileBases.length,24);
  for(const p of model.userData.pileBases) assert.ok(p.bottom<=ground(p.x,p.z));
  const deck=worldBounds(model,model.getObjectByName('supported-round-boardwalk')!);
  const piles=worldBounds(model,model.getObjectByName('boardwalk-piles-to-ground')!);
  assert.ok(Math.abs(deck.min.y-piles.max.y)<.001);
  const noTerrain=buildDiscoveryWorld(()=>NaN);
  noTerrain.traverse(o=>{ if(o instanceof THREE.Mesh) assert.ok(Array.from(o.geometry.getAttribute('position').array).every(Number.isFinite)); });
});

test('night and sunset lighting are reversible, subtle, and confined to glazing and crown',()=>{
  const model=buildDiscoveryWorld(()=>-5);
  const glass=sourceMesh(model,700564602).material as THREE.MeshStandardMaterial;
  const white=sourceMesh(model,700564597).material as THREE.MeshStandardMaterial;
  const crown=(model.getObjectByName('pilothouse-open-white-crown') as THREE.Mesh).material as THREE.MeshStandardMaterial;
  model.userData.setLightingMode('night');
  assert.ok(glass.emissiveIntensity>.15&&glass.emissiveIntensity<.25);
  assert.ok(crown.emissiveIntensity>0&&crown.emissiveIntensity<.1);
  assert.equal(white.emissive.getHex(),0);
  model.userData.setLightingMode('sunset');
  assert.ok(glass.emissiveIntensity>0&&glass.emissiveIntensity<.2);
  model.userData.setLightingMode('day');
  assert.equal(glass.emissiveIntensity,0);
  assert.equal(glass.emissive.getHex(),0);
  assert.equal(crown.emissiveIntensity,0);
});

test('all triangles are finite, nondegenerate and roof caps point upward within geometry budget',()=>{
  const model=buildDiscoveryWorld(()=>-5);
  let meshes=0,triangles=0;
  model.traverse(o=>{
    if(!(o instanceof THREE.Mesh))return;
    meshes++;
    const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry;
    const p=g.getAttribute('position');
    assert.ok(Array.from(p.array).every(Number.isFinite),o.name);
    triangles+=p.count/3;
    const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
    for(let i=0;i<p.count;i+=3) {
      a.fromBufferAttribute(p,i); b.fromBufferAttribute(p,i+1); c.fromBufferAttribute(p,i+2);
      const cross=b.clone().sub(a).cross(c.clone().sub(a));
      assert.ok(cross.lengthSq()>1e-13,`${o.name}: degenerate triangle ${i/3}`);
    }
    if(o.name.startsWith('roof-')) {
      g.computeBoundingBox(); const top=g.boundingBox!.max.y;
      let upward=0;
      for(let i=0;i<p.count;i+=3) {
        if([0,1,2].every(j=>Math.abs(p.getY(i+j)-top)<.0001)) {
          a.fromBufferAttribute(p,i); b.fromBufferAttribute(p,i+1); c.fromBufferAttribute(p,i+2);
          assert.ok(b.sub(a).cross(c.sub(a)).y>0,`${o.name}: inverted roof cap`); upward++;
        }
      }
      assert.ok(upward>0);
    }
  });
  assert.ok(meshes<100,`${meshes} meshes`);
  assert.ok(triangles<45_000,`${triangles} triangles`);
});


test('south facade exposes white upper panels while its low glazing remains visible',()=>{
  const model=buildDiscoveryWorld(()=>-5); model.updateMatrixWorld(true);
  const facadeAt=(y:number)=>new THREE.Raycaster(new THREE.Vector3(720,y,-150),new THREE.Vector3(0,0,-1)).intersectObject(model,true)[0].object.name;
  assert.equal(facadeAt(8.5),'science-wing-white-upper-panels');
  assert.ok(facadeAt(4).startsWith('osm-700564608'));
});

test('narrow south promenade continuously joins wing, connecting bridge and round collar on a foundation',()=>{
  const model=buildDiscoveryWorld(()=>-5); model.updateMatrixWorld(true);
  const apron=model.getObjectByName('continuous-south-promenade-boardwalk')!;
  const collar=model.getObjectByName('supported-round-boardwalk')!;
  const foundation=worldBounds(model,model.getObjectByName('south-promenade-foundation-to-ground')!);
  const deck=worldBounds(model,apron);
  assert.ok(Math.abs(foundation.max.y-deck.min.y)<.001);
  assert.ok(foundation.min.y<-5);
  for(let i=0;i<DISCOVERY_PROMENADE_INNER.length-1;i++) {
    const a=DISCOVERY_PROMENADE_INNER[i],b=DISCOVERY_PROMENADE_INNER[i+1];
    for(let t=0;t<=1;t+=.1) {
      const x=a[0]+(b[0]-a[0])*t,z=a[1]+(b[1]-a[1])*t+DISCOVERY_PROMENADE_WIDTH/2;
      const ray=new THREE.Raycaster(new THREE.Vector3(x,20,z),new THREE.Vector3(0,-1,0));
      assert.ok(ray.intersectObject(apron).length>0);
    }
  }
  const end=DISCOVERY_PROMENADE_INNER.at(-1)!;
  const ray=new THREE.Raycaster(new THREE.Vector3(end[0]-.02,20,end[1]+1.2),new THREE.Vector3(0,-1,0));
  assert.ok(ray.intersectObject(apron).length>0&&ray.intersectObject(collar).length>0,'walkway overlaps the supported collar');
});


test('photo-reference crown overhangs the white shells with open louvers and a walkable terrace',()=>{
  const model=buildDiscoveryWorld(()=>-5); model.updateMatrixWorld(true);
  const ribs=model.getObjectByName('pilothouse-radial-steel-crown-supports')!;
  const ribBounds=worldBounds(model,ribs);
  assert.ok(ribBounds.min.y<=DISCOVERY_SITE.floor+DISCOVERY_TERRACE.top+.01,'ribs reach the balcony');
  assert.ok(DISCOVERY_CROWN.outerRadius>21,'hoop oversails the roughly 20m white shell');
  const terrace=model.getObjectByName('pilothouse-wraparound-terrace')!;
  const louvers=model.getObjectByName('pilothouse-open-canopy-louvers')!;
  const angle=Math.PI/24;
  const rayAt=(radius:number)=>new THREE.Raycaster(new THREE.Vector3(
    DISCOVERY_ROUND_CENTER.x+Math.cos(angle)*radius,30,
    DISCOVERY_ROUND_CENTER.z+Math.sin(angle)*radius),new THREE.Vector3(0,-1,0));
  assert.ok(rayAt(17).intersectObject(terrace).length>0,'terrace fills the space outside Pilot House glazing');
  assert.equal(rayAt(0).intersectObject(terrace).length,0,'terrace does not cap the inner room');
  assert.ok(rayAt(15.70).intersectObject(louvers).length>0,'sunshade blade is present');
  assert.equal(rayAt(16.0).intersectObject(louvers).length,0,'sky remains visible between louvers');
  const rail=worldBounds(model,model.getObjectByName('waterfront-boardwalk-cable-railings')!);
  const deck=worldBounds(model,model.getObjectByName('supported-round-boardwalk')!);
  assert.ok(rail.min.y<=deck.max.y+.01,'waterside rail posts meet boardwalk');
});
