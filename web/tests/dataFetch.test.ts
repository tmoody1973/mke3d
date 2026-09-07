import test from 'node:test';
import assert from 'node:assert/strict';
import {createDataLoader,DataLoadError} from '../src/dataFetch.ts';
const immediate=async()=>{};

test('an interrupted startup fetch recovers and bypasses cached failure on retry',async()=>{
 let calls=0;const caches:unknown[]=[];
 const loader=createDataLoader((async(_url,init)=>{caches.push(init?.cache);if(++calls<3)throw new TypeError('Failed to fetch');return new Response('{"tiles":[]}');}) as typeof fetch,immediate);
 assert.deepEqual(await loader.json('/data/manifest.json'),{tiles:[]});assert.equal(calls,3);assert.deepEqual(caches,[undefined,'reload','reload']);
});
test('a broken binary response body is retried as well as the initial request',async()=>{
 let calls=0;const loader=createDataLoader((async()=>{calls++;return calls===1?{ok:true,arrayBuffer:async()=>{throw new TypeError('connection lost');}}:new Response(new Uint8Array([1,2,3]));}) as typeof fetch,immediate);
 assert.deepEqual(new Uint8Array(await loader.buffer('/data/terrain.bin')),new Uint8Array([1,2,3]));assert.equal(calls,2);
});
test('a missing file reports its name and HTTP status without retrying',async()=>{
 let calls=0;const loader=createDataLoader((async()=>{calls++;return new Response('',{status:404,statusText:'Not Found'});}) as typeof fetch,immediate);
 await assert.rejects(loader.json('/data/landmarks_geo.json'),/landmarks_geo.json: HTTP 404 Not Found/);assert.equal(calls,1);
});
test('temporary server failure recovers but retries are bounded with a useful asset error',async()=>{
 let calls=0;const loader=createDataLoader((async()=>{calls++;return new Response('',{status:503});}) as typeof fetch,immediate);
 await assert.rejects(loader.buffer('/data/water.bin'),e=>e instanceof DataLoadError&&e.asset==='water.bin'&&e.message.includes('503'));assert.equal(calls,3);
});
test('cancelling an unloaded tile is propagated without retrying',async()=>{
 let calls=0;const controller=new AbortController();const loader=createDataLoader((async(_url,init)=>{calls++;return new Promise((_resolve,reject)=>init!.signal!.addEventListener('abort',()=>reject(init!.signal!.reason)));}) as typeof fetch,immediate);
 const request=loader.buffer('/data/tiles/t_0_0.bin',controller.signal);controller.abort();await assert.rejects(request,{name:'AbortError'});assert.equal(calls,1);
});
test('invalid JSON fails clearly instead of repeatedly downloading invalid content',async()=>{
 let calls=0;const loader=createDataLoader((async()=>{calls++;return new Response('<html>not JSON</html>');}) as typeof fetch,immediate);
 await assert.rejects(loader.json('/data/manifest.json'),e=>e instanceof DataLoadError&&e.asset==='manifest.json');assert.equal(calls,1);
});
