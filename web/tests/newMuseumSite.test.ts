import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import {NEW_MUSEUM_PARCEL,NEW_MUSEUM_SITE,NEW_MUSEUM_SOURCE,removeNewMuseumPlaceholder} from '../src/newMuseumSite.ts';

test('mapped construction parcel has finite local coordinates and block-scale dimensions',()=>{
  assert.equal(NEW_MUSEUM_SOURCE.id,713732739);
  assert.ok(NEW_MUSEUM_SOURCE.footprint.every(point=>point.every(Number.isFinite)));
  assert.equal(NEW_MUSEUM_SITE.buildingWidth,52);
  assert.equal(NEW_MUSEUM_SITE.buildingDepth,60);
  assert.equal(NEW_MUSEUM_SITE.bearing,0);
  assert.ok(NEW_MUSEUM_SITE.lat>43.047&&NEW_MUSEUM_SITE.lat<43.049);
  assert.ok(NEW_MUSEUM_SITE.lon>-87.919&&NEW_MUSEUM_SITE.lon<-87.917);
  assert.deepEqual(NEW_MUSEUM_SOURCE,NEW_MUSEUM_PARCEL);
});

test('site footprint stays inside its exact mapped bounds',()=>{
  const b=NEW_MUSEUM_SOURCE.bounds;
  for(const [x,z] of NEW_MUSEUM_SOURCE.footprint){
    assert.ok(x>=b.xMin&&x<=b.xMax);
    assert.ok(z>=b.zMin&&z<=b.zMax);
  }
  assert.equal(NEW_MUSEUM_SOURCE.streets.west,'North 6th Street');
  assert.equal(NEW_MUSEUM_SOURCE.streets.south,'West McKinley Avenue');
});

test('construction landuse has no packed placeholder and adjacent BLDG data is untouched',()=>{
  const bytes=readFileSync(new URL('../public/data/tiles/t_-1_0.bin',import.meta.url));
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);let offset=12;const group=new THREE.Group();
  for(let section=0;section<view.getUint32(8,true);section++){
    const name=bytes.subarray(offset,offset+4).toString().trim();offset+=4;
    const count=view.getUint32(offset,true);offset+=4+16;
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(count*3),3));
    offset=Math.ceil((offset+count*6)/4)*4;offset=Math.ceil((offset+count*3)/4)*4;
    const mesh=new THREE.Mesh(geometry);mesh.name=name;group.add(mesh);
  }
  const geometries=group.children.map(child=>(child as THREE.Mesh).geometry);
  assert.equal(removeNewMuseumPlaceholder(group,{i:-1,j:0}),0);
  group.children.forEach((child,index)=>assert.equal((child as THREE.Mesh).geometry,geometries[index]));
});
