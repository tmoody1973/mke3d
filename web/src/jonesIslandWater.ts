import {JONES_BASINS} from './jonesIslandSite.ts';
import type {Section} from './loader.ts';
const basins=JONES_BASINS.filter(b=>b.kind==='wastewater');
type Basin=(typeof basins)[number];
/** DEM bridge returns contaminate a few source water heights (up to 18m).
 * Cap those at the same 2.2m local harbor datum used by the Hoan correction. */
export function jonesBasinLevel(b:Basin){return Math.min(2.2,'waterY' in b&&typeof b.waterY==='number'?b.waterY:.5);}
function inside(x:number,z:number,b:Basin){
 let hit=false;const p=b.footprint;
 for(let i=0,j=p.length-1;i<p.length;j=i++){
  const a=p[j],c=p[i],dx=c[0]-a[0],dz=c[1]-a[1],den=dx*dx+dz*dz;
  const u=den?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/den)):0;
  if(Math.hypot(x-a[0]-u*dx,z-a[1]-u*dz)<.2)return true;
  if((a[1]>z)!==(c[1]>z)&&x<(c[0]-a[0])*(z-a[1])/(c[1]-a[1])+a[0])hit=!hit;
 }return hit;
}
/** Flatten only triangles entirely inside mapped treatment basins, keeping the
 * harbor, triangle topology and all X/Z coordinates untouched. */
export function prepareJonesIslandWater(sections:Section[]):Section[]{
 return sections.map(s=>{
  if(s.name!=='WATR')return s;const positions=s.positions.slice();
  for(let i=0;i<positions.length;i+=9){
   const x=positions[i],z=positions[i+2];if(x<270||x>880||z<1100||z>1780)continue;
   for(const b of basins){
    if(!inside(x,z,b)||!inside(positions[i+3],positions[i+5],b)||!inside(positions[i+6],positions[i+8],b))continue;
    for(let k=0;k<3;k++)positions[i+k*3+1]=jonesBasinLevel(b);break;
   }
  }return {...s,positions};
 });
}
