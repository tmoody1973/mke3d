import * as THREE from 'three';

export type WarMemorialLightingMode = 'day' | 'sunset' | 'night';

export const WAR_MEMORIAL_COURT_Y = 9.5;
export const WAR_MEMORIAL_SITE = {
  x: 627,
  z: -608,
  bearing: Math.atan2(5.075, 70.009),
  courtY: WAR_MEMORIAL_COURT_Y,
  upperBottomY: 14.3,
  upperTopY: 21.92,
} as const;

type Point = [number, number, number];
type Rect = readonly [number, number, number, number];

const upperRects: readonly Rect[] = [
  [-31.5, -8, -22, 22],       // west arm
  [20, 31.5, -22, 22],        // east arm
  [-8, 20, -32, -22],         // north arm
  [-8, 20, 22, 32],           // south arm
  [-8, -4.8, -22, 22],        // court-side circulation ring
  [17, 20, -22, 22],
  [-4.8, 17, -22, -18.5],
  [-4.8, 17, 18.5, 22],
] as const;

function tri(out: number[], a: Point, b: Point, c: Point) { out.push(...a, ...b, ...c); }

function quad(out: number[], a: Point, b: Point, c: Point, d: Point) {
  tri(out, a, b, c); tri(out, a, c, d);
}

function appendBox(out: number[], rect: Rect, bottom: number, top: number) {
  const [x0, x1, z0, z1] = rect;
  quad(out, [x0,bottom,z0], [x0,bottom,z1], [x0,top,z1], [x0,top,z0]);
  quad(out, [x1,bottom,z0], [x1,top,z0], [x1,top,z1], [x1,bottom,z1]);
  quad(out, [x0,bottom,z0], [x0,top,z0], [x1,top,z0], [x1,bottom,z0]);
  quad(out, [x0,bottom,z1], [x1,bottom,z1], [x1,top,z1], [x0,top,z1]);
  quad(out, [x0,top,z0], [x0,top,z1], [x1,top,z1], [x1,top,z0]);
  quad(out, [x0,bottom,z0], [x1,bottom,z0], [x1,bottom,z1], [x0,bottom,z1]);
}

function geometry(positions: number[], colors?: number[]) {
  const result = new THREE.BufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (colors) result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  result.computeVertexNormals();
  return result;
}

function mesh(name: string, positions: number[], material: THREE.Material) {
  const result = new THREE.Mesh(geometry(positions), material);
  result.name = name;
  result.castShadow = !(material.transparent);
  result.receiveShadow = true;
  return result;
}

function localToWorld(x: number, z: number): [number, number] {
  const c = Math.cos(WAR_MEMORIAL_SITE.bearing), s = Math.sin(WAR_MEMORIAL_SITE.bearing);
  return [WAR_MEMORIAL_SITE.x + c*x + s*z, WAR_MEMORIAL_SITE.z - s*x + c*z];
}

function appendTerrainPrism(out: number[], rect: Rect, top: number, groundAt: (x:number,z:number)=>number) {
  const [x0,x1,z0,z1] = rect;
  const y00 = groundAt(...localToWorld(x0,z0)), y01 = groundAt(...localToWorld(x0,z1));
  const y10 = groundAt(...localToWorld(x1,z0)), y11 = groundAt(...localToWorld(x1,z1));
  quad(out,[x0,y00,z0],[x0,y01,z1],[x0,top,z1],[x0,top,z0]);
  quad(out,[x1,y10,z0],[x1,top,z0],[x1,top,z1],[x1,y11,z1]);
  quad(out,[x0,y00,z0],[x0,top,z0],[x1,top,z0],[x1,y10,z0]);
  quad(out,[x0,y01,z1],[x1,y11,z1],[x1,top,z1],[x0,top,z1]);
  quad(out,[x0,top,z0],[x0,top,z1],[x1,top,z1],[x1,top,z0]);
  tri(out,[x0,y00,z0],[x1,y10,z0],[x1,y11,z1]);
  tri(out,[x0,y00,z0],[x1,y11,z1],[x0,y01,z1]);
}

function appendSplayedPier(out: number[], x: number, z: number, outwardX: number, outwardZ: number) {
  // Broad planar blades with clipped corners, as visible in the current court photos.
  // The depth is radial; the narrow dimension follows the facade.
  const levels = [
    { y: WAR_MEMORIAL_SITE.courtY, depth: .62, width: .48, shift: 0 },
    { y: 11.65, depth: 1.0, width: .54, shift: .18 },
    { y: WAR_MEMORIAL_SITE.upperBottomY, depth: 1.62, width: .64, shift: .52 },
  ];
  const outline = [[1,.72],[.86,1],[-.86,1],[-1,.72],[-1,-.72],[-.86,-1],[.86,-1],[1,-.72]];
  const ring = (level: typeof levels[number]) => outline.map(([u,v]):Point => {
    const radial = u*level.depth + level.shift, lateral=v*level.width;
    return [x + outwardX*radial - outwardZ*lateral, level.y,
      z + outwardZ*radial + outwardX*lateral];
  });
  const rings = levels.map(ring);
  for(let k=0;k<rings.length-1;k++) for(let i=0;i<8;i++) {
    const next=(i+1)%8;
    quad(out,rings[k][i],rings[k+1][i],rings[k+1][next],rings[k][next]);
  }
  for(let i=7;i>=2;i--) tri(out,rings[2][0],rings[2][i],rings[2][i-1]);
}

function appendColoredTri(out:number[], colors:number[], a:Point,b:Point,c:Point,color:THREE.Color){
  tri(out,a,b,c);
  for(let i=0;i<3;i++)colors.push(color.r,color.g,color.b);
}

function appendWestStroke(out:number[],z0:number,y0:number,z1:number,y1:number,width:number){
  const dz=z1-z0,dy=y1-y0,length=Math.hypot(dz,dy);
  const oz=-dy/length*width/2,oy=dz/length*width/2,x=-31.57;
  quad(out,[x,y0+oy,z0+oz],[x,y0-oy,z0-oz],[x,y1-oy,z1-oz],[x,y1+oy,z1+oz]);
}

/**
 * An interpretive metre-scale model of Saarinen's Milwaukee War Memorial Center.
 * Local +X is east and +Z is south; the mural facade faces west.
 */
export function buildWarMemorial(groundAt: (x: number, z: number) => number): THREE.Group {
  const root = new THREE.Group();
  root.name = 'war-memorial-center';
  root.position.set(WAR_MEMORIAL_SITE.x, 0, WAR_MEMORIAL_SITE.z);
  root.rotation.y = WAR_MEMORIAL_SITE.bearing;

  const concrete = new THREE.MeshLambertMaterial({color:0xb6ad9e});
  const ribConcrete = new THREE.MeshLambertMaterial({color:0xa39886});
  const stone = new THREE.MeshLambertMaterial({color:0x77746c});
  const paving = new THREE.MeshLambertMaterial({color:0xa6a39a});
  const darkEdge = new THREE.MeshLambertMaterial({color:0x262827});
  const glass = new THREE.MeshPhongMaterial({color:0x33464d,transparent:true,opacity:.78,shininess:72,emissive:0x000000});
  const water = new THREE.MeshPhongMaterial({color:0x183b48,transparent:true,opacity:.91,shininess:94,emissive:0x000000});
  const flameMaterial = new THREE.MeshPhongMaterial({color:0xd98527,emissive:0x6a2206,shininess:34});

  // Five adjoining foundations follow the terrain at each corner and meet a single level court.
  const pedestalPositions:number[]=[];
  for(const rect of [
    [-31.5,-8,-22,22], [20,31.5,-22,22], [-8,20,-32,-22], [-8,20,22,32], [-8,20,-22,22],
  ] as Rect[]) appendTerrainPrism(pedestalPositions,rect,WAR_MEMORIAL_SITE.courtY-.22,groundAt);
  // Stone caps bridge the last 22 cm beneath every support row.
  for(const rect of [
    [-6.4,17.4,-24.25,-21.45],[-6.4,17.4,21.45,24.25],
    [20.95,24.25,-16.5,16.5],[-24.25,-20.95,-16.5,16.5],
  ] as Rect[]) appendBox(pedestalPositions,rect,WAR_MEMORIAL_SITE.courtY-.22,WAR_MEMORIAL_SITE.courtY);
  root.add(mesh('war-memorial-rubble-stone-pedestal',pedestalPositions,stone));

  const upperPositions:number[]=[];
  for(const rect of upperRects) appendBox(upperPositions,rect,WAR_MEMORIAL_SITE.upperBottomY,WAR_MEMORIAL_SITE.upperTopY);
  root.add(mesh('war-memorial-unequal-cruciform-upper',upperPositions,concrete));

  const pierPositions:number[]=[];
  for(const x of [-5,2,9,16]) {
    appendSplayedPier(pierPositions,x,-22.85,0,-1);
    appendSplayedPier(pierPositions,x,22.85,0,1);
  }
  for(const z of [-15,-5,5,15]) {
    appendSplayedPier(pierPositions,22.35,z,1,0);
    appendSplayedPier(pierPositions,-22.35,z,-1,0);
  }
  const piers=mesh('war-memorial-splayed-piers',pierPositions,ribConcrete);
  piers.userData.supportTopY=WAR_MEMORIAL_SITE.upperBottomY;
  piers.userData.supportBottomY=WAR_MEMORIAL_SITE.courtY;
  root.add(piers);

  const courtPositions:number[]=[];
  appendBox(courtPositions,[-8,20,-22,22],WAR_MEMORIAL_SITE.courtY-.22,WAR_MEMORIAL_SITE.courtY);
  root.add(mesh('court-of-honor-paving',courtPositions,paving));

  // The pool occupies the southwest portion of the open court and remains open to the sky.
  const poolRect:Rect=[-.5,6.5,5,12];
  const poolPositions:number[]=[]; appendBox(poolPositions,poolRect,9.505,9.565);
  root.add(mesh('court-of-honor-pool',poolPositions,water));
  const edgePositions:number[]=[];
  appendBox(edgePositions,[-.82,-.5,4.68,12.32],9.5,9.62);
  appendBox(edgePositions,[6.5,6.82,4.68,12.32],9.5,9.62);
  appendBox(edgePositions,[-.5,6.5,4.68,5],9.5,9.62);
  appendBox(edgePositions,[-.5,6.5,12,12.32],9.5,9.62);
  root.add(mesh('court-of-honor-pool-black-edge',edgePositions,darkEdge));

  const flameBase = new THREE.Mesh(new THREE.CylinderGeometry(.52,.68,.22,12),darkEdge);
  flameBase.name='war-memorial-eternal-flame-brazier'; flameBase.position.set(3,9.675,8.5); root.add(flameBase);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(.24,.76,8),flameMaterial);
  flame.name='war-memorial-eternal-flame'; flame.position.set(3,10.165,8.5); root.add(flame);

  // A low balustrade traces the opening while leaving the southwest approach clear.
  const railPositions:number[]=[];
  appendBox(railPositions,[-4.92,-4.72,-18.5,1.5],9.5,10.45);
  appendBox(railPositions,[-4.92,-4.72,15.8,18.5],9.5,10.45);
  appendBox(railPositions,[16.9,17.1,-18.5,18.5],9.5,10.45);
  appendBox(railPositions,[-4.8,17.0,-18.6,-18.4],9.5,10.45);
  appendBox(railPositions,[7.2,17.0,18.4,18.6],9.5,10.45);
  root.add(mesh('court-of-honor-balustrade',railPositions,ribConcrete));

  const approachPositions:number[]=[];
  appendTerrainPrism(approachPositions,[-38,-31.5,-5.5,5.5],WAR_MEMORIAL_SITE.courtY-.05,groundAt);
  root.add(mesh('war-memorial-west-approach-porch',approachPositions,stone));

  // Current court photos show a full-height projecting glass stair volume, with
  // a faceted underside. The opposite stair stays an open switchback sequence.
  const stairGlass:number[]=[],stairFrames:number[]=[],stairFlights:number[]=[];
  const sx0=-4.8,sx1=2.8,sz0=11.5,sz1=18.5,sy0=14.3,sy1=21.92;
  appendBox(stairGlass,[sx0,sx1,sz0,sz1],sy0,sy1);
  for(const x of [sx0,sx1]) {
    for(let z=sz0;z<=sz1+.01;z+=.7) appendBox(stairFrames,[x-.045,x+.045,z-.045,z+.045],sy0,sy1);
    for(const y of [sy0,18.1,sy1]) appendBox(stairFrames,[x-.055,x+.055,sz0,sz1],y-.055,y+.055);
  }
  for(const z of [sz0,sz1]) {
    for(let x=sx0;x<=sx1+.01;x+=.76) appendBox(stairFrames,[x-.045,x+.045,z-.045,z+.045],sy0,sy1);
    for(const y of [sy0,18.1,sy1]) appendBox(stairFrames,[sx0,sx1,z-.055,z+.055],y-.055,y+.055);
  }
  const foot:Point[]=[[-1.65,9.5,14.2],[-.35,9.5,14.2],[-.35,9.5,15.8],[-1.65,9.5,15.8]];
  const shoulder:Point[]=[[sx0,sy0,sz0],[sx1,sy0,sz0],[sx1,sy0,sz1],[sx0,sy0,sz1]];
  for(let i=0;i<4;i++){const j=(i+1)%4;quad(stairFlights,foot[i],shoulder[i],shoulder[j],foot[j]);}
  // Open flights along the north court edge connect the court and upper ring.
  for(let flight=0;flight<2;flight++)for(let step=0;step<14;step++) {
    const x=flight===0?9.8+step*.34:14.56-step*.34;
    const top=9.5+flight*2.4+(step+1)*2.4/14;
    appendBox(stairFlights,[x,x+.34,-17.8+flight*1.25,-16.7+flight*1.25],top-.18,top);
  }
  appendBox(stairFlights,[14.4,15.6,-17.8,-15.45],11.72,11.9);
  appendBox(stairFlights,[9.4,10.2,-17.8,-15.45],14.12,14.3);
  // Continuous sloping concrete stringers carry the treads between the landings.
  for(const [xa,ya,xb,yb,z0,z1] of [[9.8,9.5,14.9,11.9,-17.8,-16.7],[14.9,11.9,9.8,14.3,-16.55,-15.45]]) {
    const a:Point=[xa,ya-.23,z0],b:Point=[xb,yb-.23,z0],c:Point=[xb,yb-.23,z1],d:Point=[xa,ya-.23,z1];
    quad(stairFlights,a,b,c,d);
    quad(stairFlights,a,[xa,ya,z0],[xb,yb,z0],b);
    quad(stairFlights,d,c,[xb,yb,z1],[xa,ya,z1]);
  }
  root.add(mesh('court-stair-pavilion-glazing',stairGlass,glass));
  root.add(mesh('court-stair-pavilion-frames',stairFrames,darkEdge));
  root.add(mesh('court-stair-flights',stairFlights,ribConcrete));

  // N/S/E ends use a restrained two-storey glass grid, all batched into two drawables.
  const glassPositions:number[]=[];
  const framePositions:number[]=[];
  const addGrid=(axis:'x'|'z',fixed:number,start:number,end:number,normal:number,columns:number)=>{
    const inset=.035*normal;
    for(let row=0;row<2;row++) for(let col=0;col<columns;col++) {
      const a=THREE.MathUtils.lerp(start,end,col/columns)+.12;
      const b=THREE.MathUtils.lerp(start,end,(col+1)/columns)-.12;
      const y0=15.02+row*3.22+.12, y1=15.02+(row+1)*3.22-.12;
      if(axis==='x') {
        const points:[Point,Point,Point,Point]=[[a,y0,fixed+inset],[a,y1,fixed+inset],[b,y1,fixed+inset],[b,y0,fixed+inset]];
        if(normal>0) points.reverse();
        quad(glassPositions,...points);
      } else {
        const points:[Point,Point,Point,Point]=[[fixed+inset,y0,a],[fixed+inset,y0,b],[fixed+inset,y1,b],[fixed+inset,y1,a]];
        if(normal>0) points.reverse();
        quad(glassPositions,...points);
      }
    }
    for(let col=0;col<=columns;col++) {
      const bar=col%2===0?.17:.045;
      const a=THREE.MathUtils.lerp(start,end,col/columns);
      if(axis==='x') appendBox(framePositions,[a-bar,a+bar,fixed-.32,fixed+.32],14.92,21.58);
      else appendBox(framePositions,[fixed-.32,fixed+.32,a-bar,a+bar],14.92,21.58);
    }
    if(axis==='x') {
      appendBox(framePositions,[start,end,fixed-.08,fixed+.08],14.86,15.12);
      appendBox(framePositions,[start,end,fixed-.08,fixed+.08],18.12,18.38);
      appendBox(framePositions,[start,end,fixed-.08,fixed+.08],21.46,21.7);
    } else {
      appendBox(framePositions,[fixed-.08,fixed+.08,start,end],14.86,15.12);
      appendBox(framePositions,[fixed-.08,fixed+.08,start,end],18.12,18.38);
      appendBox(framePositions,[fixed-.08,fixed+.08,start,end],21.46,21.7);
    }
  };
  addGrid('x',-32.02,-5.8,17.8,-1,6);
  addGrid('x',32.02,-5.8,17.8,1,6);
  addGrid('z',31.52,-19.2,19.2,1,8);
  root.add(mesh('war-memorial-end-glazing',glassPositions,glass));
  root.add(mesh('war-memorial-end-concrete-grid',framePositions,ribConcrete));

  // Five abstract tessera fields locate the west mural without reproducing names or the original artwork.
  const muralPositions:number[]=[], muralColors:number[]=[];
  const palette=[0x514459,0x31506a,0x23272c,0x9b98a2,0x46546a].map(value=>new THREE.Color(value));
  for(let panel=0;panel<5;panel++) {
    const z0=-12.85+panel*5.18, z1=z0+4.86;
    const x=-31.535;
    for(let row=0;row<4;row++)for(let col=0;col<4;col++){
      const za=THREE.MathUtils.lerp(z0,z1,col/4),zb=THREE.MathUtils.lerp(z0,z1,(col+1)/4);
      const ya=THREE.MathUtils.lerp(14.38,21.84,row/4),yb=THREE.MathUtils.lerp(14.38,21.84,(row+1)/4);
      appendColoredTri(muralPositions,muralColors,[x,ya,za],[x,ya,zb],[x,yb,zb],palette[(panel+row+col)%palette.length]);
      appendColoredTri(muralPositions,muralColors,[x,ya,za],[x,yb,zb],[x,yb,za],palette[(panel+row+col+2)%palette.length]);
    }
  }
  const mural = new THREE.Mesh(geometry(muralPositions,muralColors),new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.FrontSide}));
  mural.name='war-memorial-west-five-panel-mural'; root.add(mural);
  const muralWindowPositions:number[]=[];
  for(let panel=1;panel<5;panel++) {
    const z=-12.85+panel*5.18-.16;
    quad(muralWindowPositions,[-31.55,14.38,z-.12],[-31.55,14.38,z+.12],[-31.55,21.84,z+.12],[-31.55,21.84,z-.12]);
  }
  root.add(mesh('war-memorial-mural-vertical-window-strips',muralWindowPositions,glass));
  const dateStrokes:number[]=[];
  const panelCenter=(panel:number)=>-12.85+panel*5.18+2.43;
  const stroke=(panel:number,z0:number,y0:number,z1:number,y1:number)=>appendWestStroke(dateStrokes,panelCenter(panel)+z0,y0,panelCenter(panel)+z1,y1,.24);
  stroke(0,-1.05,15.35,-1.05,20.85); stroke(0,1.05,15.35,1.05,20.85); stroke(0,-1.05,20.85,1.05,15.35);
  stroke(1,-1.25,20.85,0,15.35); stroke(1,0,15.35,1.25,20.85);
  stroke(2,-1.25,15.35,1.25,20.85); stroke(2,-1.25,20.85,1.25,15.35);
  stroke(3,-.82,15.35,-.82,20.85); stroke(3,.82,15.35,.82,20.85);
  stroke(4,-1.12,15.35,-1.12,20.85); stroke(4,1.12,15.35,1.12,20.85); stroke(4,-1.12,18.1,1.12,18.1);
  root.add(mesh('war-memorial-mural-date-strokes',dateStrokes,new THREE.MeshLambertMaterial({color:0xc5c0b5,side:THREE.DoubleSide})));

  // The west mural is recessed behind a projecting concrete hood and balcony.
  const westFrame:number[]=[],rails:number[]=[],entryGlass:number[]=[],courtGlass:number[]=[];
  appendBox(westFrame,[-33.1,-31.45,-13.6,13.6],21.65,22.15);
  appendBox(westFrame,[-33.1,-31.45,-13.6,13.6],14.12,14.52);
  for(const z of [-13.6,13.2]) appendBox(westFrame,[-33.1,-31.45,z,z+.4],14.12,22.15);
  appendBox(rails,[-33.0,-32.93,-13.2,13.2],15.5,15.56);
  for(let z=-13.1;z<=13.2;z+=.32) appendBox(rails,[-33.0,-32.95,z,z+.035],14.52,15.5);
  // Ground-floor entrance remains set back beneath the cantilever.
  quad(entryGlass,[-28.4,9.5,-9],[-28.4,9.5,9],[-28.4,14.25,9],[-28.4,14.25,-9]);
  for(let z=-9;z<=9;z+=1.5) appendBox(rails,[-28.48,-28.35,z-.045,z+.045],9.5,14.25);
  appendBox(rails,[-28.48,-28.35,-9,9],12.55,12.63);
  root.add(mesh('war-memorial-west-recess-frame',westFrame,ribConcrete));
  root.add(mesh('war-memorial-balcony-and-entry-frames',rails,new THREE.MeshLambertMaterial({color:0x7d827f})));
  root.add(mesh('war-memorial-west-entry-glazing',entryGlass,glass));
  // Narrow two-storey vertical windows line the inner court, separated by solid panels.
  for(const x of [-4.77,16.97])for(let z=-17;z<18;z+=2.65)for(let row=0;row<2;row++) {
    const y=14.92+row*3.35;
    const pts:[Point,Point,Point,Point]=[[x,y,z],[x,y+2.9,z],[x,y+2.9,z+.64],[x,y,z+.64]];
    if(x>0)pts.reverse();quad(courtGlass,...pts);
  }
  for(const z of [-18.47,18.47])for(let x=-3.4;x<16;x+=2.65)for(let row=0;row<2;row++) {
    const y=14.92+row*3.35;
    const pts:[Point,Point,Point,Point]=[[x,y,z],[x+.64,y,z],[x+.64,y+2.9,z],[x,y+2.9,z]];
    if(z>0)pts.reverse();quad(courtGlass,...pts);
  }
  root.add(mesh('war-memorial-court-slot-windows',courtGlass,glass));
  // Slim roof-edge guard rails and fine side-wall ribs appear in the HABS image.
  const roofRails:number[]=[],sideRibs:number[]=[];
  for(const [x0,x1,z0,z1] of upperRects.slice(0,4)) {
    appendBox(roofRails,[x0,x1,z0,z0+.035],22.45,22.49);
    appendBox(roofRails,[x0,x1,z1-.035,z1],22.45,22.49);
    for(let x=x0;x<x1;x+=2)for(const z of [z0,z1])appendBox(roofRails,[x,x+.035,z-.018,z+.018],21.92,22.45);
  }
  for(const z of [-22.015,22.015])for(let x=-31.2;x<-8;x+=.32)appendBox(sideRibs,[x,x+.035,z-.025,z+.025],14.4,21.85);
  root.add(mesh('war-memorial-roof-guardrails',roofRails,darkEdge));
  root.add(mesh('war-memorial-side-ribs',sideRibs,ribConcrete));

  const jointPositions:number[]=[];
  for(const z of [-15,-7.5,0,7.5,15]) {
    quad(jointPositions,[31.535,15,z-.035],[31.535,21.55,z-.035],[31.535,21.55,z+.035],[31.535,15,z+.035]);
  }
  for(const x of [-3,4,11,18]) {
    quad(jointPositions,[x,15,-32.035],[x,21.55,-32.035],[x+.07,21.55,-32.035],[x+.07,15,-32.035]);
    quad(jointPositions,[x+.07,15,32.035],[x+.07,21.55,32.035],[x,21.55,32.035],[x,15,32.035]);
  }
  root.add(mesh('war-memorial-concrete-panel-joints',jointPositions,new THREE.MeshLambertMaterial({color:0x777872,side:THREE.DoubleSide})));

  const clearWaterLocal = new THREE.Vector3(5.25,9.575,8.5);
  const clearWaterWorld = clearWaterLocal.clone().applyAxisAngle(new THREE.Vector3(0,1,0),WAR_MEMORIAL_SITE.bearing).add(root.position);
  const poolCenterLocal=new THREE.Vector3(3,9.565,8.5);
  const poolCenterWorld=poolCenterLocal.clone().applyAxisAngle(new THREE.Vector3(0,1,0),WAR_MEMORIAL_SITE.bearing).add(root.position);
  root.userData.openCourt={center:clearWaterWorld.toArray(),poolCenter:poolCenterWorld.toArray(),radius:3.2,localOpening:[-4.8,17,-18.5,18.5]};
  root.userData.courtStairs={glazedProjection:[-4.8,2.8,11.5,18.5],openFlights:[9.4,15.6,-17.8,-15.45]};
  root.userData.setLightingMode=(mode:WarMemorialLightingMode)=>{
    glass.emissive.setHex(mode==='night'?0x152830:mode==='sunset'?0x171614:0x000000);
    water.emissive.setHex(mode==='night'?0x0b2430:mode==='sunset'?0x101817:0x000000);
    flameMaterial.emissive.setHex(mode==='night'?0xb33b08:mode==='sunset'?0x8a2c07:0x6a2206);
    glass.needsUpdate=water.needsUpdate=flameMaterial.needsUpdate=true;
  };
  root.userData.dimensions={overall:[63,64],courtY:9.5,upper:[14.3,21.92],cantileverM:9.15};
  return root;
}
