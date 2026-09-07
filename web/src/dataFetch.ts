/** Shared city-data requests: retry interrupted transfers, preserve cancellation,
 * and name the failed asset instead of reporting only "Failed to fetch". */
export class DataLoadError extends Error {
  readonly asset:string;
  constructor(asset:string,reason:string){super(`${asset}: ${reason}`);this.name='DataLoadError';this.asset=asset;}
}
function wait(ms:number,signal?:AbortSignal){
 return new Promise<void>((resolve,reject)=>{
  if(signal?.aborted){reject(signal.reason);return;}
  const abort=()=>{clearTimeout(timer);reject(signal?.reason);};
  const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
  signal?.addEventListener('abort',abort,{once:true});
 });
}
export function createDataLoader(fetcher:typeof fetch=fetch,delay:typeof wait=wait){
 async function load<T>(url:string,read:(r:Response)=>Promise<T>,signal?:AbortSignal):Promise<T>{
  const asset=url.split('/').pop()||url;
  for(let attempt=0;attempt<3;attempt++){
   signal?.throwIfAborted();
   const controller=new AbortController();let timedOut=false,retryable=true;
   const abort=()=>controller.abort(signal?.reason);
   signal?.addEventListener('abort',abort,{once:true});
   const timeout=setTimeout(()=>{timedOut=true;controller.abort();},15000);
   try{
    const response=await fetcher(url,{signal:controller.signal,...(attempt?{cache:'reload' as const}:{})});
    if(!response.ok){
     retryable=response.status===408||response.status===429||response.status>=500;
     throw new Error(`HTTP ${response.status}${response.statusText?` ${response.statusText}`:''}`);
    }
    return await read(response);
   }catch(error){
    signal?.throwIfAborted();
    if(error instanceof SyntaxError)retryable=false;
    if(!retryable||attempt===2){
     const reason=timedOut?'request timed out':error instanceof TypeError?'connection interrupted':error instanceof Error?error.message:'request failed';
     throw new DataLoadError(asset,reason);
    }
   }finally{
    clearTimeout(timeout);signal?.removeEventListener('abort',abort);
   }
   await delay(attempt===0?300:900,signal);
  }
  throw new DataLoadError(asset,'request failed');
 }
 return {
  buffer:(url:string,signal?:AbortSignal)=>load(url,r=>r.arrayBuffer(),signal),
  json:<T>(url:string,signal?:AbortSignal)=>load<T>(url,r=>r.json(),signal),
 };
}
export const cityData=createDataLoader();
