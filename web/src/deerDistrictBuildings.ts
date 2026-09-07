import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type XZ = readonly [number, number];
type LightingMode = 'day' | 'sunset' | 'night';

/** Current cached OSM outlines, projected into the city world coordinate system. */
export const DEER_DISTRICT_BUILDING_SITES = {
  tradeHotel: {
    osm: 'area/1205534370',
    source: { id: 1205534370, tile: {i:-1,j:0}, base: 3.41, roof: 35.61 },
    footprint: [[-994.243,-1225.105],[-994.422,-1196.223],[-906.870,-1195.681],[-906.691,-1223.700],[-976.374,-1224.143],[-976.374,-1224.994]] as readonly XZ[],
  },
  entertainmentBlock: {
    osm: 'area/12582717',
    source: { id: 12582717, tile: {i:-1,j:0}, base: 2.81, roof: 10.91 },
    footprint: [[-873.704,-1162.498],[-872.687,-1153.718],[-869.091,-1153.519],[-865.250,-1116.366],[-834.119,-1116.167],[-832.540,-1116.134],[-832.483,-1119.617],[-832.068,-1119.617],[-831.946,-1124.703],[-832.483,-1124.714],[-832.410,-1129.171],[-833.126,-1129.182],[-832.320,-1160.784],[-835.648,-1160.861],[-838.089,-1160.916],[-837.967,-1162.033],[-860.319,-1162.487]] as readonly XZ[],
  },
  newFashioned: {
    osm: 'area/12582715',
    source: { id: 12582715, tile: {i:-1,j:0}, base: 2.41, roof: 10.51 },
    footprint: [[-866.9,-1070.0],[-842.9,-1049.1],[-832.9,-1049.0],[-832.2,-1103.3],[-832.6,-1103.3],[-846.4,-1103.5],[-866.3,-1103.5]] as readonly XZ[],
  },
  beerGardenPlaceholder: {
    osm: 'area/673905465',
    source: { id: 673905465, tile: {i:-1,j:0}, base: 2.51, roof: 10.71 },
    footprint: [[-802.426,-1124.250],[-802.442,-1115.515],[-802.442,-1114.862],[-803.915,-1114.907],[-803.915,-1108.880],[-804.021,-1103.053],[-819.114,-1103.186],[-826.364,-1103.252],[-832.198,-1103.341],[-832.646,-1103.341],[-832.638,-1106.072],[-834.403,-1106.094],[-834.306,-1109.411],[-834.119,-1116.167],[-832.540,-1116.134],[-832.483,-1119.617],[-832.068,-1119.617],[-831.946,-1124.703],[-825.632,-1124.626]] as readonly XZ[],
  },
  /** Public east-west promenade between the two mapped restaurant buildings. */
  promenade: { bounds: {x0:-866,x1:-780,z0:-1116.1,z1:-1103.5}, centerZ:-1109.5 },
} as const;

function box(x:number,y:number,z:number,w:number,h:number,d:number) {
  const geometry = new THREE.BoxGeometry(w,h,d); geometry.translate(x,y,z); return geometry;
}

function wallBetween(a:XZ,b:XZ,y:number,h:number,depth:number,offsetX=0) {
  const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  const geometry=new THREE.BoxGeometry(length,h,depth);
  geometry.rotateY(Math.atan2(-dz,dx)); geometry.translate((a[0]+b[0])/2+offsetX,y,(a[1]+b[1])/2); return geometry;
}

function footprintPrism(points:readonly XZ[], bottom:number, top:number) {
  const shape = new THREE.Shape();
  points.forEach(([x,z],i)=>i ? shape.lineTo(x,-z) : shape.moveTo(x,-z));
  const geometry = new THREE.ExtrudeGeometry(shape,{depth:top-bottom,bevelEnabled:false});
  geometry.rotateX(-Math.PI/2); geometry.translate(0,bottom,0); return geometry;
}

const sourceTolerance=.16;

/** Removes only the four cached OSM placeholders replaced by this module. */
export function removeDeerDistrictBuildingPlaceholders(group:THREE.Group,tile:{i:number;j:number}):number {
  if(tile.i!==-1||tile.j!==0)return 0;
  const sources=[DEER_DISTRICT_BUILDING_SITES.tradeHotel,DEER_DISTRICT_BUILDING_SITES.entertainmentBlock,DEER_DISTRICT_BUILDING_SITES.newFashioned,DEER_DISTRICT_BUILDING_SITES.beerGardenPlaceholder];
  let removed=0;
  group.traverse(object=>{
    if(!(object instanceof THREE.Mesh)||object.name!=='BLDG')return;
    const original=object.geometry,position=original.getAttribute('position');
    if(!position||original.index)return;
    const keep:number[]=[];
    for(let triangle=0;triangle+2<position.count;triangle+=3){
      const matchesSource=sources.some(site=>{
        let roof=false;
        for(let vertex=triangle;vertex<triangle+3;vertex++){
          const x=position.getX(vertex),y=position.getY(vertex),z=position.getZ(vertex);
          const atRoof=Math.abs(y-site.source.roof)<sourceTolerance; roof||=atRoof;
          if(!(atRoof||Math.abs(y-site.source.base)<sourceTolerance)||!site.footprint.some(([px,pz])=>Math.hypot(x-px,z-pz)<sourceTolerance))return false;
        }
        return roof;
      });
      if(matchesSource)removed++; else keep.push(triangle,triangle+1,triangle+2);
    }
    if(keep.length===position.count)return;
    const geometry=new THREE.BufferGeometry();
    for(const [name,attribute] of Object.entries(original.attributes)){
      if(!(attribute instanceof THREE.BufferAttribute)||name==='normal')continue;
      const array=attribute.array.slice(0,keep.length*attribute.itemSize);
      keep.forEach((vertex,index)=>{for(let component=0;component<attribute.itemSize;component++)array[index*attribute.itemSize+component]=attribute.array[vertex*attribute.itemSize+component];});
      geometry.setAttribute(name,new THREE.BufferAttribute(array,attribute.itemSize,attribute.normalized));
    }
    geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();object.geometry=geometry;original.dispose();
  });
  return removed;
}

function addMerged(root:THREE.Group,name:string,parts:THREE.BufferGeometry[],material:THREE.Material,collision=false) {
  const prepared=parts.map(part=>{const g=part.index?part.toNonIndexed():part.clone();g.deleteAttribute('uv');return g;});
  const geometry=mergeGeometries(prepared,false)!; prepared.forEach(g=>g.dispose()); parts.forEach(g=>g.dispose());
  const mesh=new THREE.Mesh(geometry,material); mesh.name=collision?'BLDG':name;
  mesh.castShadow=collision; mesh.receiveShadow=true; root.add(mesh); return mesh;
}

function facadeGrid(out:THREE.BufferGeometry[], x0:number, x1:number, z:number, base:number, floors:number, spacing=4.4) {
  for(let floor=0;floor<floors;floor++) for(let x=x0+2.3;x<x1-1.2;x+=spacing)
    out.push(box(x,base+3.15+floor*3.25,z,2.35,1.85,.18));
}

/** Detailed, bounded-draw-call building context for the arena's east and north edges. */
export function buildDeerDistrictBuildings(groundAt:(x:number,z:number)=>number):THREE.Group {
  const root=new THREE.Group(); root.name='deer-district-buildings';
  const brick=new THREE.MeshStandardMaterial({color:0x57403a,roughness:.86});
  const cream=new THREE.MeshStandardMaterial({color:0xb9a98d,roughness:.84});
  const warmGlass=new THREE.MeshStandardMaterial({color:0x66878a,roughness:.30,metalness:.22});
  const glow=new THREE.MeshBasicMaterial({color:0xffc576,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
  const rail=new THREE.MeshStandardMaterial({color:0x353b3c,roughness:.48,metalness:.55});

  const solids:THREE.BufferGeometry[]=[], masonry:THREE.BufferGeometry[]=[], glazing:THREE.BufferGeometry[]=[], frames:THREE.BufferGeometry[]=[], lights:THREE.BufferGeometry[]=[];
  const trade=DEER_DISTRICT_BUILDING_SITES.tradeHotel.footprint;
  const tradeGround=Math.min(...trade.map(([x,z])=>groundAt(x,z)));
  // The mapped podium meets Juneau; stepped hotel bars and a glazed rooftop restaurant reproduce the reference silhouette.
  solids.push(footprintPrism(trade,tradeGround-.35,tradeGround+7.1));
  solids.push(box(-951.0,tradeGround+19.9,-1210.1,82.0,25.6,26.0));
  masonry.push(box(-951.0,tradeGround+19.9,-1196.86,82.0,25.6,.45));
  facadeGrid(glazing,-992,-910,-1196.60,tradeGround+6.8,7,4.55);
  // Two-storey active frontage facing the arena and plaza.
  glazing.push(box(-951,tradeGround+3.5,-1195.55,82,6.35,.3));
  for(let x=-991;x<-909;x+=4.1) frames.push(box(x,tradeGround+3.55,-1195.25,.16,6.5,.34));
  frames.push(box(-951,tradeGround+3.2,-1195.22,82,.2,.36),box(-951,tradeGround+6.6,-1195.22,82,.25,.36));
  // Il Cervo roof pavilion, pergola and east-side balcony stack.
  glazing.push(box(-953,tradeGround+34.25,-1209.6,67,4.3,18));
  frames.push(box(-953,tradeGround+36.65,-1209.6,71,.55,22));
  for(let x=-987;x<-918;x+=5.8) frames.push(box(x,tradeGround+34.3,-1199.0,.16,4.8,.3));
  for(let floor=0;floor<5;floor++) {
    masonry.push(box(-908.0,tradeGround+12.2+floor*4.2,-1210.2,3.0,.45,20));
    glazing.push(box(-907.7,tradeGround+10.3+floor*4.2,-1210.2,.2,3.3,18.4));
  }
  // Warm edge lights deliberately skip many bays, matching the irregular illuminated window reveals.
  for(const [x,f] of [[-987,1],[-978,3],[-968,0],[-959,5],[-945,2],[-934,4],[-921,1]] as const)
    lights.push(box(x,tradeGround+9.9+f*3.25,-1196.47,2.7,2.15,.08));

  // Photo-based storefront layers follow each mapped edge, including the angled south corner.
  function restaurant(points:readonly XZ[],floors:number) {
    const base=Math.min(...points.map(([x,z])=>groundAt(x,z)))+.28,h=floors*3.8;
    const center=points.reduce((v,p)=>v.add(new THREE.Vector2(...p)),new THREE.Vector2()).multiplyScalar(1/points.length);
    solids.push(footprintPrism(points,base-.5,base+h));
    masonry.push(footprintPrism(points,base+h,base+h+.24));
    points.forEach((a,i)=>{
      const b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
      if(len<1.5)return;
      let nx=-dz/len,nz=dx/len;
      if(nx*(center.x-(a[0]+b[0])/2)+nz*(center.y-(a[1]+b[1])/2)>0){nx=-nx;nz=-nz;}
      const edge=(y:number,height:number,depth:number,offset:number,out:THREE.BufferGeometry[])=>out.push(wallBetween([a[0]+nx*offset,a[1]+nz*offset],[b[0]+nx*offset,b[1]+nz*offset],y,height,depth));
      for(let f=0;f<floors;f++){
        edge(base+f*3.8+2.1,3.05,.10,.15,glazing);
        edge(base+f*3.8+.42,.24,.5,.23,masonry);
        edge(base+f*3.8+3.68,.17,.55,.27,frames);
      }
      edge(base+h+.32,.2,.85,.25,frames);
      const count=Math.ceil(len/2.6);
      for(let j=0;j<=count;j++){
        const t=j/count,x=a[0]+dx*t+nx*.31,z=a[1]+dz*t+nz*.31;
        frames.push(box(x,base+h/2,z,.12,h,.12));
        if(j%3===0)masonry.push(box(x+nx*.12,base+1.95,z+nz*.12,.28,3.9,.28));
      }
      // Slim elevated terrace rail, with open space between the posts.
      edge(base+4.82,.055,.065,.8,frames);
      edge(base+4.05,.055,.065,.8,frames);
      for(let j=0;j<count;j++){
        const t=(j+.5)/count,x=a[0]+dx*t+nx*.8,z=a[1]+dz*t+nz*.8;
        frames.push(box(x,base+4.43,z,.055,.85,.055));
      }
      // Selected small occupied bays, not a single glowing wall.
      for(let j=1;j<count;j+=4){
        const t=j/count,half=.65/len;
        const aa:XZ=[a[0]+dx*(t-half)+nx*.22,a[1]+dz*(t-half)+nz*.22];
        const bb:XZ=[a[0]+dx*(t+half)+nx*.22,a[1]+dz*(t+half)+nz*.22];
        lights.push(wallBetween(aa,bb,base+2.0,1.7,.03));
      }
    });
    return base+h;
  }
  const entTop=restaurant(DEER_DISTRICT_BUILDING_SITES.entertainmentBlock.footprint,3);
  restaurant(DEER_DISTRICT_BUILDING_SITES.newFashioned.footprint,2);
  // The exposed black rooftop framework distinguishes the taller northern restaurant.
  for(const x of [-867,-838]){
    frames.push(box(x,entTop+2.5,-1138,.16,.16,39));
    for(let z=-1157;z<=-1119;z+=6.3)frames.push(box(x,entTop+1.25,z,.16,2.5,.16));
  }
  for(const z of [-1157,-1144.3,-1131.6,-1119])frames.push(box(-852.5,entTop+2.5,z,29,.16,.16));

  addMerged(root,'deer-district-solid-buildings',solids,brick,true);
  addMerged(root,'deer-district-masonry-and-decks',masonry,cream);
  addMerged(root,'deer-district-active-glazing',glazing,warmGlass);
  addMerged(root,'deer-district-frames-rails-and-sign-bands',frames,rail);
  const lit=addMerged(root,'deer-district-interior-and-reveal-lighting',lights,glow); lit.castShadow=false;
  root.userData.sites=DEER_DISTRICT_BUILDING_SITES;
  root.userData.drawCalls=5;
  root.userData.detail={tradeFacadeFloors:7,entertainmentStoreys:3,newFashionedStoreys:2,roofTerraces:3,promenadeCenterZ:-1109.5};
  root.userData.setLightingMode=(mode:LightingMode)=>{
    glow.opacity=mode==='night'?.46:mode==='sunset'?.18:0; lit.visible=glow.opacity>0;
    warmGlass.emissive.setHex(0x8a552e); warmGlass.emissiveIntensity=mode==='night'?.17:mode==='sunset'?.055:0;
  };
  root.userData.setLightingMode('day'); return root;
}
