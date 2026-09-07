import * as THREE from 'three';

export type NMLightingMode = 'day' | 'sunset' | 'night';
type Plan = [number, number];
type Point = [number, number, number];
export interface NMTowerOptions {
  /** Mapped, non-overlapping building parts in local east-X / south-Z coordinates. */
  parts: readonly {id: string | number; polygon: readonly (readonly [number, number])[]; height: number; minHeight?: number}[];
  height?: number;
  baseHeight?: number;
}
const hash = (n: number) => {
  let x = (n + 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
};
const lerp = (a: Plan, b: Plan, t: number): Plan => [a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t];
const offset = (p: Plan, n: Plan, d: number): Plan => [p[0]+n[0]*d,p[1]+n[1]*d];
function quad(out: number[], a: Point, b: Point, c: Point, d: Point) {out.push(...a,...b,...c,...a,...c,...d);}
function wall(out: number[], a: Plan, b: Plan, low: number, high: number) {
  quad(out,[a[0],low,a[1]],[a[0],high,a[1]],[b[0],high,b[1]],[b[0],low,b[1]]);
}
function cap(out: number[], ring: Plan[], y: number, upward = true) {
  for (const triangle of THREE.ShapeUtils.triangulateShape(ring.map(p=>new THREE.Vector2(...p)),[])) {
    for (const i of upward ? [...triangle].reverse() : triangle) out.push(ring[i][0],y,ring[i][1]);
  }
}
function mesh(name: string, values: number[], material: THREE.Material, colors?: number[]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(values,3));
  if(colors)geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const result = new THREE.Mesh(geometry,material);result.name=name;result.castShadow=true;result.receiveShadow=true;
  return result;
}
function colorVertices(out: number[], vertices: number, color: THREE.Color) {
  for(let i=0;i<vertices;i++)out.push(color.r,color.g,color.b);
}
function contains(ring: readonly (readonly number[])[], p: Plan) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
}

/** Original curtain-wall geometry, calibrated to the as-built photos and mapped tower parts. */
export function buildNMTower(options: NMTowerOptions): THREE.Group {
  const {parts,height=169,baseHeight=0}=options;
  if(!parts.length || !Number.isFinite(height+baseHeight) || height<60 || parts.some(p=>p.polygon.length<3||!Number.isFinite(p.height)||p.height<=0||p.polygon.some(v=>!v.every(Number.isFinite))))throw new Error('Invalid Northwestern Mutual tower geometry');
  const root=new THREE.Group();root.name='northwestern-mutual-tower';
  const glass:number[]=[],glassColors:number[]=[],spandrels:number[]=[],bands:number[]=[],mullions:number[]=[],roof:number[]=[],lights:number[]=[],lightColors:number[]=[];
  const maxSourceHeight=Math.max(...parts.map(p=>p.height));
  let groups=0,litGroups=0,panels=0;
  const dimensions: {id:string|number;height:number;polygon:Plan[]}[]=[];
  let signAnchor: {position:Point;rotationY:number;width:number}|undefined,signScore=-Infinity;
  parts.forEach((part,partIndex)=>{
    const partHeight=part.height/maxSourceHeight*height,top=baseHeight+partHeight,minY=baseHeight+(part.minHeight??0);
    let ring:Plan[]=part.polygon.map(p=>[p[0],p[1]]);
    if(Math.hypot(ring[0][0]-ring.at(-1)![0],ring[0][1]-ring.at(-1)![1])<.001)ring.pop();
    // Positive XZ area gives the outward normal (dz, -dx).
    if(THREE.ShapeUtils.area(ring.map(p=>new THREE.Vector2(...p)))<0)ring.reverse();
    const isMain=part.height===maxSourceHeight;
    dimensions.push({id:part.id,height:partHeight,polygon:ring});
    const floorHeight=(height-4.3)/32;
    const floors=Math.ceil((partHeight-4.3)/floorHeight);
    let perimeter=0;
    const edges=ring.map((a,i)=>{
      const b=ring[(i+1)%ring.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]),start=perimeter;
      perimeter+=length;
      const normal:Plan=[(b[1]-a[1])/length,-(b[0]-a[0])/length];
      const sample=offset(lerp(a,b,.5),normal,.06);
      const adjacentTop=Math.max(baseHeight,...parts.filter(p=>p.id!==part.id&&contains(p.polygon,sample)).map(p=>baseHeight+p.height/maxSourceHeight*height));
      return {a,b,length,start,normal,adjacentTop};
    }).filter(edge=>edge.length>.01);
    for(let floor=0;floor<floors;floor++) {
      const low=Math.max(minY,baseHeight+floor*floorHeight),high=Math.min(baseHeight+(floor+1)*floorHeight,top-4.3);
      if(high<=low+.05)continue;
      for(const {a,b,length,start,normal:n,adjacentTop} of edges) {
        if(high<=adjacentTop+.001)continue;
        const wallLow=Math.max(low,adjacentTop);
        if(high<=wallLow+.7)continue;
        const count=Math.max(1,Math.ceil(length/1.48));
        for(let bay=0;bay<count;bay++) {
          const aa=lerp(a,b,bay/count),bb=lerp(a,b,(bay+1)/count),distance=start+(bay+.5)*length/count;
          const before=glass.length;
          wall(glass,aa,bb,wallLow+.65,high);
          // Broad, subtle vertical reflection changes and a few differently shaded blinds.
          const reflect=.93+.045*Math.sin(distance*.075)+.035*Math.sin(distance*.19);
          const blind=hash(partIndex*811+floor*47+Math.floor(distance/6))<.08?.9:1;
          colorVertices(glassColors,(glass.length-before)/3,new THREE.Color().setRGB(reflect*blind,Math.min(1,reflect*1.04)*blind,Math.min(1,reflect*1.075)*blind));
          const jamb=offset(aa,n,.034),end=offset(lerp(aa,bb,Math.min(.075/(length/count),.12)),n,.034);
          wall(mullions,jamb,end,wallLow,high);
          // Low after-hours occupancy is shared by adjacent bays, never random per animation frame.
          const suite=Math.floor(distance/6.6),seed=partIndex*9001+floor*127+suite*17;
          const active=floor>1&&hash(seed)<.14;
          groups++;if(active)litGroups++;panels++;
          if(active) {
            const beforeLight=lights.length;
            wall(lights,offset(lerp(aa,bb,.06),n,.044),offset(lerp(aa,bb,.94),n,.044),wallLow+.88,high-.2);
            const brightness=.21+hash(seed+9)*.3;
            colorVertices(lightColors,(lights.length-beforeLight)/3,new THREE.Color().setRGB(brightness,brightness*(.8+hash(seed+4)*.1),brightness*.66));
          }
        }
        wall(spandrels,a,b,wallLow,wallLow+.65);
        // Fine horizontal silver lines at slab and intermediate transom heights.
        for(const y of [wallLow+.64,wallLow+(high-wallLow)*.56])wall(bands,offset(a,n,.065),offset(b,n,.065),y,y+.085);
      }
    }
    // The upper mechanical screen follows the curtain-wall envelope and closes over a recessed roof.
    for(const {a,b,length,normal:n,adjacentTop} of edges) {
      if(top<=adjacentTop+.001)continue;
      const crownLow=Math.max(top-4.3,adjacentTop);
      wall(spandrels,a,b,crownLow,top);
      for(let j=1;j<8;j++)if(top-4.3+j*.5>=crownLow)wall(bands,offset(a,n,.055),offset(b,n,.055),top-4.3+j*.5,top-4.3+j*.5+.05);
      wall(bands,offset(a,n,.075),offset(b,n,.075),top-.15,top);
      for(let j=0,count=Math.max(1,Math.ceil(length/1.48));j<count;j++)wall(mullions,offset(lerp(a,b,j/count),n,.036),offset(lerp(a,b,Math.min(1,j/count+.07/length)),n,.036),crownLow,top);
    }
    cap(roof,ring,top-.18);cap(roof,ring,minY,false);
    if(isMain) {
      // Sign centered on the broad convex southeast curtain wall, away from the sharp eastern prow.
      for(const candidate of edges.filter(e=>e.normal[0]>.2&&e.normal[1]>.2&&e.adjacentTop===baseHeight)) {
        const score=12-Math.abs(candidate.normal[0]-.56)*20+candidate.length*.02;
        if(score<=signScore)continue;
        signScore=score;
        const p=offset(lerp(candidate.a,candidate.b,.5),candidate.normal,.18);
        signAnchor={position:[p[0],top-9.3,p[1]],rotationY:Math.atan2(candidate.normal[0],candidate.normal[1]),width:25};
      }
    }
  });
  root.add(mesh('nm-bluegray-curtain-wall',glass,new THREE.MeshStandardMaterial({color:0x7898aa,vertexColors:true,metalness:.37,roughness:.28,side:THREE.DoubleSide}),glassColors));
  root.add(mesh('nm-blue-spandrels-and-crown-screen',spandrels,new THREE.MeshStandardMaterial({color:0x587888,metalness:.33,roughness:.4,side:THREE.DoubleSide})));
  root.add(mesh('nm-silver-floor-bands',bands,new THREE.MeshStandardMaterial({color:0x9eafb4,metalness:.5,roughness:.43,side:THREE.DoubleSide})));
  root.add(mesh('nm-fine-vertical-mullions',mullions,new THREE.MeshStandardMaterial({color:0x6d8793,metalness:.4,roughness:.4,side:THREE.DoubleSide})));
  root.add(mesh('nm-closed-roofs-and-foundations',roof,new THREE.MeshStandardMaterial({color:0x65727a,roughness:.85,side:THREE.DoubleSide})));
  // Window light adds to the reflected dusk sky instead of covering it with
  // dark opaque rectangles when the after-hours intensity is still low.
  const lightMaterial=new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false,side:THREE.DoubleSide,
    transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
  const occupied=mesh('nm-occupied-office-suites',lights,lightMaterial,lightColors);occupied.castShadow=false;root.add(occupied);
  root.userData.setLightingMode=(mode:NMLightingMode)=>{occupied.visible=mode!=='day';lightMaterial.color.setScalar(mode==='sunset'?.12:.52);};
  root.userData.setLightingMode('day');
  root.userData.dimensions={height,baseHeight,officeLevels:32,parts:dimensions};
  root.userData.offices={groups,litGroups,panels};
  root.userData.signAnchor=signAnchor;
  return root;
}
