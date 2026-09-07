import * as THREE from 'three';

export type CoutureLightingMode = 'day' | 'sunset' | 'night';
export interface CoutureTowerOptions {
  /** Local X spans east/west; +X is the lakeward glazed elevation. */
  width?: number;
  depth?: number;
  /** Highest visible point above the parent ground plane, not foundation height. */
  height?: number;
  baseHeight?: number;
}
type Plan = [number, number];
type Point = [number, number, number];
const SEGMENTS = 72;
const FLOORS = 44;
const SHOULDER_FLOOR = 40;
const hash = (n: number) => {
  let x = (n + 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x21f0aaad);
  x = Math.imul(x ^ (x >>> 15), 0x735a2d97);
  return ((x ^ (x >>> 15)) >>> 0) / 4294967296;
};
function quad(out: number[], a: Point, b: Point, c: Point, d: Point) { out.push(...a, ...b, ...c, ...a, ...c, ...d); }
function along(a: Plan, b: Plan, t: number): Plan { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
function offset(p: Plan, normal: Plan, distance: number): Plan { return [p[0] + normal[0] * distance, p[1] + normal[1] * distance]; }
function wall(out: number[], a: Plan, b: Plan, low: number, high: number) {
  quad(out, [a[0], low, a[1]], [a[0], high, a[1]], [b[0], high, b[1]], [b[0], low, b[1]]);
}
function flat(out: number[], polygon: Plan[], y: number) {
  const triangles = THREE.ShapeUtils.triangulateShape(polygon.map(p => new THREE.Vector2(...p)), []);
  for (const [a, b, c] of triangles) {
    // Plan points run counter-clockwise in XZ, so reverse to face upward.
    for (const index of [c, b, a]) out.push(polygon[index][0], y, polygon[index][1]);
  }
}
function box(out: number[], x0: number, x1: number, z0: number, z1: number, y0: number, y1: number) {
  const ring: Plan[] = [[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
  for (let i=0;i<4;i++) wall(out,ring[i],ring[(i+1)%4],y0,y1);
  flat(out,ring,y1);
}
function clipFront(polygon: Plan[], cut: number): Plan[] {
  const out: Plan[] = [];
  for(let i=0;i<polygon.length;i++) {
    const a=polygon[i],b=polygon[(i+1)%polygon.length],insideA=a[0]>=cut,insideB=b[0]>=cut;
    if(insideA) out.push(a);
    if(insideA!==insideB) out.push(along(a,b,(cut-a[0])/(b[0]-a[0])));
  }
  return out;
}
function mesh(name: string, positions: number[], material: THREE.Material, colors?: number[]) {
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  if(colors) geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  const result=new THREE.Mesh(geometry,material);result.name=name;result.castShadow=true;result.receiveShadow=true;return result;
}

/**
 * Completed Couture silhouette, based on supplied photos 01/02/05 and owner 10/11.
 * The construction hoist and unfinished rooftop frame in the Commons views are omitted.
 * Footprint, setback and facade dimensions are architectural approximations, not shop drawings.
 */
export function buildCoutureTower(options: CoutureTowerOptions = {}): THREE.Group {
  const { width=30.798, depth=43.058, height=160, baseHeight=0 }=options;
  if (![width,depth,height,baseHeight].every(Number.isFinite) || width<=0 || depth<=0 || height-baseHeight<60) throw new Error('Invalid Couture tower dimensions');
  const root=new THREE.Group();root.name='couture-residential-tower';
  const glass: number[]=[],glassColors:number[]=[],cladding:number[]=[],frames:number[]=[],recess:number[]=[],guards:number[]=[],roofs:number[]=[],lights:number[]=[],lightColors:number[]=[];
  const glassTop=height-3.8, floorHeight=(glassTop-baseHeight)/FLOORS, shoulder=baseHeight+SHOULDER_FLOOR*floorHeight;
  // A rounded rectangle keeps recognisable broad elevations; an ellipse made the existing tower too tubular.
  const ring: Plan[]=Array.from({length:SEGMENTS},(_,i)=>{
    const a=i/SEGMENTS*Math.PI*2,c=Math.cos(a),s=Math.sin(a),power=.72;
    return [Math.sign(c)*Math.pow(Math.abs(c),power)*width/2,Math.sign(s)*Math.pow(Math.abs(s),power)*depth/2];
  });
  const cut=-width*.065, crown=clipFront(ring,cut);
  let apartmentGroups=0,litApartmentGroups=0,balconyCount=0;
  for(let floor=0;floor<FLOORS;floor++) {
    const y=baseHeight+floor*floorHeight, top=y+floorHeight, contour=floor<SHOULDER_FLOOR?ring:crown;
    for(let i=0;i<contour.length;i++) {
      const a=contour[i],b=contour[(i+1)%contour.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
      const n:Plan=[dz/length,-dx/length],mid=along(a,b,.5);
      const isCrownBack=floor>=SHOULDER_FLOOR && Math.abs(mid[0]-cut)<.01;
      // Two narrow balcony stacks recessed into north/south shoulders, not the construction lift on the lake face.
      const balcony=floor>=3 && floor<SHOULDER_FLOOR && Math.abs(mid[1])>depth*.465 && mid[0]>-width*.28 && mid[0]<width*.08;
      const back=mid[0]<-width*.28 || isCrownBack;
      const aGlass=offset(a,n,balcony?-1.65:0),bGlass=offset(b,n,balcony?-1.65:0);
      const low=y+(back?.85:.34), high=top-(back?.62:.08);
      const target=balcony?recess:glass, oldCount=target.length;
      wall(target,aGlass,bGlass,low,high);
      if(!balcony) {
        const tint=new THREE.Color().setRGB(.66+hash(i+31)*.13,.81+hash(i+31)*.1,.87+hash(i+31)*.1);
        for(let j=oldCount;j<target.length;j+=3)glassColors.push(tint.r,tint.g,tint.b);
      }
      // Pale floor edges project slightly, giving real shadowed recesses at the balcony stacks.
      wall(cladding,offset(a,n,.1),offset(b,n,.1),y,y+(back?.85:.32));
      if(back)wall(cladding,offset(a,n,.1),offset(b,n,.1),high,top);
      const ledgeA=offset(a,n,.1),ledgeB=offset(b,n,.1);
      quad(cladding,[ledgeA[0],y+.32,ledgeA[1]],[ledgeB[0],y+.32,ledgeB[1]],[bGlass[0],y+.32,bGlass[1]],[aGlass[0],y+.32,aGlass[1]]);
      if(back && i%3===0) wall(cladding,offset(along(a,b,.05),n,.11),offset(along(a,b,.42),n,.11),y+.7,top);
      if(balcony) {
        balconyCount++;
        wall(guards,offset(a,n,-.14),offset(b,n,-.14),y+.37,y+1.42);
        wall(frames,offset(a,n,-.12),offset(b,n,-.12),y+1.39,y+1.45);
        wall(recess,a,aGlass,y+.32,top);wall(recess,bGlass,b,y+.32,top);
      }
      // Fine curtain wall bars remain secondary to the wide horizontal concrete slab edges.
      const subdivisions=Math.max(1,Math.round(length/1.5));
      for(let j=0;j<subdivisions;j++) {
        const t=j/subdivisions,half=.045/length;
        wall(frames,offset(along(aGlass,bGlass,Math.max(0,t-half)),n,.025),offset(along(aGlass,bGlass,Math.min(1,t+half)),n,.025),low,high);
      }
      // Adjacent glazing panes share an apartment's state. Reproducible, subdued occupancy, no flashing/random-per-frame windows.
      const apartment=Math.floor(i/3),seed=floor*127+apartment*13;
      const eligible=floor>=3&&!balcony;
      if(eligible && i%3===0){apartmentGroups++;if(hash(seed)<.15)litApartmentGroups++;}
      if(eligible && hash(seed)<.15) {
        const before=lights.length, aa=offset(along(aGlass,bGlass,.07),n,.044),bb=offset(along(aGlass,bGlass,.93),n,.044);
        wall(lights,aa,bb,low+.08,high-.07);
        const brightness=.25+hash(seed+3)*.36,warm=new THREE.Color().setRGB(brightness,brightness*(.7+hash(seed+7)*.15),brightness*.49);
        for(let j=before;j<lights.length;j+=3)lightColors.push(warm.r,warm.g,warm.b);
      }
    }
  }
  flat(roofs,ring,shoulder+.025); // terrace is exposed only behind the four-story upper cutback
  flat(roofs,crown,glassTop);
  // The final crown has a curved projecting lip and an offset pale mechanical spine, not an unfinished steel cage.
  for(const [contour,y] of [[ring,shoulder],[crown,glassTop]] as [Plan[],number][]) {
    for(let i=0;i<contour.length;i++) {
      const a=contour[i],b=contour[(i+1)%contour.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]),n:Plan=[(b[1]-a[1])/len,-(b[0]-a[0])/len];
      if(y===shoulder && (a[0]+b[0])/2>cut)continue;
      wall(cladding,offset(a,n,.25),offset(b,n,.25),y-.05,y+.55);
      if(y===shoulder)wall(guards,offset(a,n,-.15),offset(b,n,-.15),y+.56,y+1.45);
    }
  }
  box(cladding,cut-.13,cut+width*.12,-depth*.28,depth*.28,shoulder,height);
  // Actual small openings break the otherwise solid rear spine; restrained mechanical roof screen.
  for(let floor=0;floor<5;floor++)box(recess,cut-.155,cut-.14,-.55,.55,shoulder+1+floor*floorHeight,shoulder+2.6+floor*floorHeight);
  box(roofs,width*.02,width*.21,-depth*.18,depth*.15,glassTop+.2,height-.85);
  for(let j=0;j<10;j++)box(frames,width*.017,width*.214,-depth*.18,depth*.15,glassTop+.3+j*.21,glassTop+.37+j*.21);

  const glazed=new THREE.MeshStandardMaterial({color:0x7999a4,vertexColors:true,metalness:.35,roughness:.3,side:THREE.DoubleSide});
  root.add(mesh('couture-bluegray-curtain-wall',glass,glazed,glassColors));
  root.add(mesh('couture-pale-floor-bands-and-crown',cladding,new THREE.MeshStandardMaterial({color:0xc9cdd0,metalness:.13,roughness:.65,side:THREE.DoubleSide})));
  root.add(mesh('couture-mullions-and-roof-louvers',frames,new THREE.MeshStandardMaterial({color:0x62777d,metalness:.45,roughness:.4,side:THREE.DoubleSide})));
  root.add(mesh('couture-recessed-balcony-interiors',recess,new THREE.MeshStandardMaterial({color:0x354a53,roughness:.56,metalness:.18,side:THREE.DoubleSide})));
  root.add(mesh('couture-balcony-glass-guards',guards,new THREE.MeshStandardMaterial({color:0x799499,roughness:.24,metalness:.32,transparent:true,opacity:.52,depthWrite:false,side:THREE.DoubleSide})));
  root.add(mesh('couture-terraces-and-mechanical-roof',roofs,new THREE.MeshStandardMaterial({color:0x8a9598,roughness:.85,side:THREE.DoubleSide})));
  // Basic shading preserves each apartment's vertex-colour brightness independently of the sun.
  const nightMaterial=new THREE.MeshBasicMaterial({color:0xffffff,vertexColors:true,toneMapped:false,side:THREE.DoubleSide});
  const lit=mesh('couture-occupied-apartments',lights,nightMaterial,lightColors);lit.castShadow=false;root.add(lit);
  root.userData.setMode=(mode:CoutureLightingMode)=>{lit.visible=mode!=='day';nightMaterial.color.setScalar(mode==='sunset'?.08:.48);};
  root.userData.setMode('day');
  root.userData.dimensions={width,depth,height,baseHeight,shoulder,glassTop,glazedLevels:FLOORS,highestMechanicalLevel:45};
  root.userData.apartments={groups:apartmentGroups,litGroups:litApartmentGroups,balconyPanels:balconyCount};
  return root;
}
