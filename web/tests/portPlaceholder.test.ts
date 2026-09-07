import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import * as THREE from 'three';
import {PORT_REPLACED_IDS, PORT_SOURCE_ELEVATIONS, removePortPlaceholders} from '../src/portPlaceholder.ts';

function cached(j:number,lod:boolean) {
  const bytes=readFileSync(new URL(`../public/data/tiles/t_0_${j}${lod?'.lod':''}.bin`,import.meta.url));
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),group=new THREE.Group(); let offset=12;
  for(let section=0;section<view.getUint32(8,true);section++){
    const name=bytes.subarray(offset,offset+4).toString().trim();offset+=4;
    const count=view.getUint32(offset,true);offset+=4;
    const origin=[0,4,8].map(i=>view.getFloat32(offset+i,true)),scale=view.getFloat32(offset+12,true);offset+=16;
    const positions=new Float32Array(count*3);
    for(let i=0;i<positions.length;i++)positions[i]=view.getInt16(offset+i*2,true)*scale+origin[i%3];
    offset=Math.ceil((offset+count*6)/4)*4;
    const colors=new Uint8Array(bytes.subarray(offset,offset+count*3));offset=Math.ceil((offset+count*3)/4)*4;
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3,true));
    const mesh=new THREE.Mesh(geometry);mesh.name=name;group.add(mesh);
  }
  return group;
}

test('full and LOD port tiles remove exact source shells and preserve surviving attributes',()=>{
  const counts=new Map([['-1:false',94],['-1:true',82],['-2:false',725],['-2:true',298]]);
  for(const j of [-1,-2])for(const lod of [false,true]){
    const group=cached(j,lod),mesh=group.children.find(child=>child.name==='BLDG') as THREE.Mesh;
    mesh.geometry.computeVertexNormals();
    const before=mesh.geometry,oldPosition=before.getAttribute('position'),oldColor=before.getAttribute('color');
    const other=group.children.filter(child=>child!==mesh).map(child=>(child as THREE.Mesh).geometry);
    assert.equal(removePortPlaceholders(group,{i:0,j}),counts.get(`${j}:${lod}`));
    const position=mesh.geometry.getAttribute('position'),color=mesh.geometry.getAttribute('color');
    assert.equal(oldPosition.count-position.count,(counts.get(`${j}:${lod}`)??0)*3);
    let cursor=0;
    for(let triangle=0;triangle<position.count;triangle+=3){
      while(cursor<oldPosition.count&&position.getX(triangle)!==oldPosition.getX(cursor))cursor+=3;
      assert.ok(cursor<oldPosition.count,'surviving triangle remains an ordered source subsequence');
      for(let v=0;v<3;v++){
        assert.deepEqual([position.getX(triangle+v),position.getY(triangle+v),position.getZ(triangle+v)],
          [oldPosition.getX(cursor+v),oldPosition.getY(cursor+v),oldPosition.getZ(cursor+v)]);
        assert.deepEqual(Array.from(color.array.slice((triangle+v)*3,(triangle+v+1)*3)),
          Array.from(oldColor.array.slice((cursor+v)*3,(cursor+v+1)*3)));
      }
      cursor+=3;
    }
    assert.equal(color.normalized,oldColor.normalized);
    group.children.filter(child=>child!==mesh).forEach((child,index)=>assert.equal((child as THREE.Mesh).geometry,other[index]));
    assert.equal(removePortPlaceholders(group,{i:0,j}),0);
  }
});

test('replacement allowlist has measured finite elevation pairs',()=>{
  assert.equal(PORT_REPLACED_IDS.length,22);
  assert.ok(!PORT_REPLACED_IDS.includes(1068003691));
  for(const id of PORT_REPLACED_IDS){
    const pair=PORT_SOURCE_ELEVATIONS[id as keyof typeof PORT_SOURCE_ELEVATIONS];
    assert.ok(Number.isFinite(pair.floor)&&Number.isFinite(pair.roof)&&pair.roof>pair.floor,id.toString());
  }
});

test('wrong tile and unrelated geometry are unchanged',()=>{
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0],3));
  const mesh=new THREE.Mesh(geometry);mesh.name='BLDG';const group=new THREE.Group();group.add(mesh);
  assert.equal(removePortPlaceholders(group,{i:1,j:-1}),0);assert.equal(mesh.geometry,geometry);
  assert.equal(removePortPlaceholders(group,{i:0,j:-1}),0);assert.equal(mesh.geometry,geometry);
});
