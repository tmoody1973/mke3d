import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { STREET_LIGHT_SITES, STREET_LIGHT_STATS } from '../src/streetLightSites.ts';
import * as THREE from 'three';
import {prepareSummerfestTerrain,adaptSummerfestTile} from '../src/summerfestSite.ts';
import {prepareHoanTerrain} from '../src/hoanSite.ts';
import {bilinearTerrainHeight,terrainHeight} from '../src/localTerrain.ts';

test('placement provenance, district coverage, fixture families and bounded counts are explicit', () => {
  assert.equal(STREET_LIGHT_STATS.mappedNodesInExtract,3545);
  assert.equal(STREET_LIGHT_SITES.length,1920);
  assert.deepEqual(STREET_LIGHT_STATS.bySource,{'osm-node':705,'derived-road':1215});
  assert.equal(STREET_LIGHT_STATS.terrainCorrections.resampled,58);
  assert.deepEqual(STREET_LIGHT_STATS.terrainCorrections.rejectedBelowWater,['node-13747299353-460']);
  assert.ok(!STREET_LIGHT_SITES.some(s=>s.id==='node-13747299353-460'));
  assert.equal(STREET_LIGHT_SITES.length,STREET_LIGHT_STATS.total);
  assert.ok(STREET_LIGHT_SITES.length>=1500&&STREET_LIGHT_SITES.length<=2200);
  assert.equal(new Set(STREET_LIGHT_SITES.map(s=>s.id)).size,STREET_LIGHT_SITES.length);
  for(const key of ['bySource','byKind','byDistrict','bySurface'] as const) {
    assert.equal(Object.values(STREET_LIGHT_STATS[key]).reduce((a,b)=>a+b,0),STREET_LIGHT_SITES.length);
  }
  for(const kind of ['downtownMast','thirdWardHeritage','thirdWardRiverwalk','stadiumCampus','plazaEvent'])
    assert.ok(STREET_LIGHT_SITES.some(site=>site.kind===kind),kind);
  for(const district of ['downtown','thirdWard','riverwalk','wisconsinAvenue','stadium'])
    assert.ok(STREET_LIGHT_SITES.some(site=>site.district===district),district);
  assert.ok(STREET_LIGHT_SITES.some(site=>site.source==='osm-node'));
  assert.ok(STREET_LIGHT_SITES.some(site=>site.source==='derived-road'));
  for(const [district,cap] of Object.entries(STREET_LIGHT_STATS.gapFillLimits))
    assert.ok(STREET_LIGHT_SITES.filter(site=>site.source==='derived-road'&&site.district===district).length<=cap,`${district} gap fill exceeds density cap`);
  assert.ok(STREET_LIGHT_SITES.filter(site=>site.district==='stadium'&&site.source==='derived-road').length<=175);
  for(const site of STREET_LIGHT_SITES) {
    assert.ok([site.x,site.y,site.z,site.heading,site.poolX,site.poolY,site.poolZ].every(Number.isFinite));
    assert.ok(Number.isInteger(site.sourceId)&&site.sourceId>0);
    assert.ok(site.y>=-.1&&site.y<150);
    if(site.kind==='thirdWardRiverwalk')assert.equal(site.pool,false);
  }
});

test('all poles keep minimum spacing and known museum fixtures are not duplicated', () => {
  const cells=new Map<string,typeof STREET_LIGHT_SITES[number][]>();
  const existing=[[-1097,-1460],[-1097,-1415],[-1097,-1370],[-1085,-1352],[-1055,-1352],[-1025,-1352]];
  for(const site of STREET_LIGHT_SITES) {
    const i=Math.floor(site.x/8),j=Math.floor(site.z/8);
    const spacing=site.source==='osm-node'?8:STREET_LIGHT_STATS.derivedSpacingM[site.kind];
    const radius=Math.ceil(spacing/8);
    for(let di=-radius;di<=radius;di++)for(let dj=-radius;dj<=radius;dj++)for(const other of cells.get(`${i+di},${j+dj}`)??[])
      assert.ok(Math.hypot(other.x-site.x,other.z-site.z)>=spacing-.002,`${site.id} overlaps ${other.id} (spacing ${spacing})`);
    for(const[x,z]of existing)assert.ok(Math.hypot(site.x-x,site.z-z)>=7.998);
    const key=`${i},${j}`;if(!cells.has(key))cells.set(key,[]);cells.get(key)!.push(site);
  }
});

function terrainData(){
  const bytes=readFileSync(new URL('../public/data/terrain.bin',import.meta.url));
  const nx=bytes.readUInt32LE(4),ny=bytes.readUInt32LE(8),x0=bytes.readFloatLE(12),y0=bytes.readFloatLE(16),step=bytes.readFloatLE(20);
  return {nx,ny,x0,y0,step,heights:new Float32Array(bytes.buffer.slice(bytes.byteOffset+24,bytes.byteOffset+24+nx*ny*4)),colors:new Uint8Array(nx*ny*3)};
}
const rawTerrain=terrainData(),correctedTerrain=prepareSummerfestTerrain(prepareHoanTerrain(rawTerrain));
function terrainSampler(){return (x:number,z:number)=>terrainHeight(correctedTerrain,x,z);}

type Triangle=readonly[number,number,number,number,number,number,number,number,number];
function roadSampler(){
  const tiles=new Map<string,Map<string,Triangle[]>>();
  return(x:number,z:number)=>{
    const key=`${Math.floor(x/2000)}_${Math.floor(-z/2000)}`;
    if(!tiles.has(key)){
      const grid=new Map<string,Triangle[]>();tiles.set(key,grid);
      const bytes=readFileSync(new URL(`../public/data/tiles/t_${key}.bin`,import.meta.url));let offset=12;
      const group=new THREE.Group();
      for(let section=0;section<bytes.readUInt32LE(8);section++){
        const name=bytes.subarray(offset,offset+4).toString().trim(),count=bytes.readUInt32LE(offset+4);
        const origin=[8,12,16].map(n=>bytes.readFloatLE(offset+n)),scale=bytes.readFloatLE(offset+20);offset+=24;
        if(name==='ROAD'){
          const positions=new Float32Array(count*3);for(let n=0;n<positions.length;n++)positions[n]=bytes.readInt16LE(offset+n*2)*scale+origin[n%3];
          const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));const mesh=new THREE.Mesh(geometry);mesh.name='ROAD';group.add(mesh);
        }
        offset=Math.ceil((offset+count*6)/4)*4;offset=Math.ceil((offset+count*3)/4)*4;
      }
      adaptSummerfestTile(group,{i:Math.floor(x/2000),j:Math.floor(-z/2000)},(x,z)=>bilinearTerrainHeight(correctedTerrain,x,z),rawTerrain,correctedTerrain);
      for(const mesh of group.children as THREE.Mesh[]){
        const position=mesh.geometry.getAttribute('position');
        for(let triangle=0;triangle<position.count/3;triangle++){
          const p=Array.from({length:9},(_,n)=>position.array[triangle*9+n]) as unknown as Triangle;
          const minX=Math.floor(Math.min(p[0],p[3],p[6])/20),maxX=Math.floor(Math.max(p[0],p[3],p[6])/20);
          const minZ=Math.floor(Math.min(p[2],p[5],p[8])/20),maxZ=Math.floor(Math.max(p[2],p[5],p[8])/20);
          for(let i=minX;i<=maxX;i++)for(let j=minZ;j<=maxZ;j++){
            const k=`${i},${j}`;if(!grid.has(k))grid.set(k,[]);grid.get(k)!.push(p);
          }
        }
      }
    }
    const hits:number[]=[];
    for(const[ax,ay,az,bx,by,bz,cx,cy,cz]of tiles.get(key)!.get(`${Math.floor(x/20)},${Math.floor(z/20)}`)??[]){
      const denominator=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);if(Math.abs(denominator)<1e-9)continue;
      const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/denominator,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/denominator;
      if(Math.min(u,v,1-u-v)>=-.001)hits.push(u*ay+v*by+(1-u-v)*cy);
    }
    return hits;
  };
}

test('pole feet and offset light pools reproduce the shared corrected terrain or ROAD surfaces', () => {
  const terrain=terrainSampler(),road=roadSampler();
  for(const site of STREET_LIGHT_SITES){
    for(const[x,y,z]of [[site.x,site.y,site.z],[site.poolX,site.poolY-.025,site.poolZ]]){
      const t=terrain(x,z),hits=road(x,z).filter(h=>Math.abs(h-t)<1.8);
      const surfaces=[t,...hits];
      assert.ok(surfaces.some(h=>Math.abs(h-y)<.012),`${site.id} floats above/below corrected surface at ${x},${z}: y=${y}, surfaces=${surfaces}`);
    }
  }
});
