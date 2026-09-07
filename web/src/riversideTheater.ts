import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RIVERSIDE_SITE as site } from './theaterSites.ts';

type LightingMode = 'day' | 'sunset' | 'night';
// Original stroke lettering, intentionally independent of venue logo artwork.
const LETTERS: Record<string, number[][]> = {
 B:[[0,0,0,1],[0,1,.7,1],[.7,1,1,.75],[1,.75,.65,.5],[.65,.5,0,.5],[.65,.5,1,.25],[1,.25,.7,0],[.7,0,0,0]],
 O:[[.2,0,.8,0],[.8,0,1,.2],[1,.2,1,.8],[1,.8,.8,1],[.8,1,.2,1],[.2,1,0,.8],[0,.8,0,.2],[0,.2,.2,0]],
 X:[[0,0,1,1],[0,1,1,0]], F:[[0,0,0,1],[0,1,1,1],[0,.5,.8,.5]],
 C:[[1,1,.2,1],[.2,1,0,.8],[0,.8,0,.2],[0,.2,.2,0],[.2,0,1,0]],
 R:[[0,0,0,1],[0,1,.7,1],[.7,1,1,.8],[1,.8,1,.6],[1,.6,.7,.5],[.7,.5,0,.5],[.55,.5,1,0]],
 I:[[0,1,1,1],[.5,1,.5,0],[0,0,1,0]], V:[[0,1,.5,0],[.5,0,1,1]],
 E:[[0,0,0,1],[0,1,1,1],[0,.5,.8,.5],[0,0,1,0]],
 S:[[1,1,0,1],[0,1,0,.5],[0,.5,1,.5],[1,.5,1,0],[1,0,0,0]],
 D:[[0,0,0,1],[0,1,.65,1],[.65,1,1,.75],[1,.75,1,.25],[1,.25,.65,0],[.65,0,0,0]],
};

/** Photo-proportioned Empire Building and Riverside exterior. South (+Z) faces Wisconsin Avenue. */
export function buildRiversideTheater(groundAt: (x: number, z: number) => number) {
 const root = new THREE.Group(); root.name = 'riverside-theater';
 const materials: Record<string, THREE.MeshStandardMaterial> = {
  brick: new THREE.MeshStandardMaterial({ color: 0x968773, roughness: .92 }),
  stone: new THREE.MeshStandardMaterial({ color: 0xc9bda3, roughness: .88 }),
  recess: new THREE.MeshStandardMaterial({ color: 0x191b19, roughness: .95 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x344747, metalness: .20, roughness: .30 }),
  metal: new THREE.MeshStandardMaterial({ color: 0x242626, metalness: .45, roughness: .60 }),
  roof: new THREE.MeshStandardMaterial({ color: 0x4a4b46, roughness: .94 }),
  red: new THREE.MeshStandardMaterial({ color: 0x9b1723, roughness: .5, metalness: .15 }),
  gold: new THREE.MeshStandardMaterial({ color: 0xc9a965, roughness: .4, metalness: .5 }),
  board: new THREE.MeshStandardMaterial({ color: 0xf5ecce, emissive: 0xffe3ad, emissiveIntensity: 0, roughness: .7 }),
  bulbs: new THREE.MeshStandardMaterial({ color: 0xffe7ac, emissive: 0xffce70, emissiveIntensity: 0, roughness: .35 }),
 };
 // Keep coherent structural solids separate from decorative cornices: the
 // walking volume test must not infer an enclosure from unrelated stone trims.
 materials.foundation=materials.stone;
 const buckets: Record<string, THREE.BufferGeometry[]> = Object.fromEntries(Object.keys(materials).map(k => [k, []]));
 function add(key: string, g: THREE.BufferGeometry) {
  g.deleteAttribute('uv'); const normalized = g.index ? g.toNonIndexed() : g;
  if (normalized !== g) g.dispose(); buckets[key].push(normalized);
 }
 function box(k: string, x: number, y: number, z: number, w: number, h: number, d: number) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); add(k, g);
 }
 function rod(k: string, a: THREE.Vector3, b: THREE.Vector3, radius: number) {
  const delta = b.clone().sub(a); const g = new THREE.CylinderGeometry(radius, radius, delta.length(), 6);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
  g.translate(...a.clone().add(b).multiplyScalar(.5).toArray()); add(k, g);
 }
 function bulb(x: number, y: number, z: number, r = .075) {
  const g = new THREE.SphereGeometry(r, 6, 4); g.translate(x, y, z); add('bulbs', g);
 }
 function letters(text: string, x: number, y: number, z: number, height: number, width: number, vertical = false, side = false) {
  const advance = vertical ? height * 1.30 : width * 1.38;
  for (let i = 0; i < text.length; i++) {
   for (const [ax, ay, bx, by] of LETTERS[text[i]] ?? []) {
    const originX = vertical ? x : x + i * advance;
    const originY = vertical ? y - i * advance : y;
    const point = (u: number, v: number) => side ? new THREE.Vector3(x, originY + v * height, z + u * width) : new THREE.Vector3(originX + u * width, originY + v * height, z);
    rod('bulbs', point(ax, ay), point(bx, by), height * .06);
   }
  }
 }
 // The full Empire wedge is rebuilt from the cached footprint. The four-point
 // Wisconsin projection is the canopy: omit it from the 13-storey tower ring.
 const width = 45.868, depth = 67.65, corniceHeight = site.source.roof - site.floor;
 const facadeCenter = (-497.500 - 451.633) / 2 - site.x;
 const front = (-430.763 - 430.431) / 2 - site.z;
 const entranceX = (-488.216 - 477.280) / 2 - site.x;
 const entryBack = front - 1.6;
 // ROAD tile t_-1_0 has a crowned Wisconsin surface above the coarse terrain.
 // Calibrate its surveyed-in-cache plane to the caller's local terrain. The
 // variation factor makes constant-height review scenes retain their datum.
 const streetZ = -424;
 const calibrationX = [-488,-485,-477];
 const streetSamples = calibrationX.map(x=>groundAt(x,streetZ));
 const roadCalibration = Math.min(1,Math.max(0,(Math.max(...streetSamples)-Math.min(...streetSamples))/.7845703125));
 function cachedTerrainAtStreet(x: number) {
  return x < -485 ? 3.71923828125+(x+485)*.00826416015625 : 3.71923828125-(x+485)*.0980712890625;
 }
 function streetHeight(x: number) {
  const road=4.153603802619706-(x+488)*.0286272422277424;
  return groundAt(x,streetZ)+roadCalibration*(road-cachedTerrainAtStreet(x));
 }
 const approachHalfWidth=5.30;
 const floor=Math.max(groundAt(site.x,site.z),...[-approachHalfWidth,0,approachHalfWidth].map(dx=>streetHeight(site.x+entranceX+dx)));
 const foundationBottom=Math.min(-1.6,...site.footprint.map(([x,z])=>groundAt(x,z)-floor-.35));
 const towerRing = site.footprint.filter((_, i) => i < 17 || i > 20);
 function footprintMass(k: string, bottom: number, height: number, ring: readonly (readonly number[])[] = towerRing) {
  const shape = new THREE.Shape();
  ring.forEach(([x,z], i) => { const px = x-site.x, pz = -(z-site.z); if(i === 0) shape.moveTo(px,pz); else shape.lineTo(px,pz); });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2); geometry.translate(0, bottom, 0); add(k, geometry);
 }
 // The entrance is a real 1.6 m notch in the ground-storey solid. Keeping
 // the original full ground-wall extrusion hid the recessed door surfaces.
 const entryRing: number[][] = [];
 site.footprint.forEach(([x,z],i) => {
  if(i>=17 && i<=20) return;
  entryRing.push([x,z]);
  if(i===16) entryRing.push([x,site.z+entryBack],[-477.239,site.z+entryBack]);
 });
 footprintMass('foundation', foundationBottom, .04-foundationBottom);
 footprintMass('foundation', .04, 3.86, entryRing);
 footprintMass('brick', 3.9, corniceHeight - 3.9);
 footprintMass('roof', corniceHeight, .18);
 // Long facade edges get cornice bands; tiny mapped edge segments are retained
 // in the structural mass while the principal planes receive windows.
 const elevations = [
  [[-497.500,-430.763],[-451.633,-430.431]],
  [[-451.096,-435.087],[-491.308,-493.680]],
  [[-491.308,-493.680],[-526.328,-471.642]],
  [[-526.328,-471.642],[-501.763,-433.096]],
 ] as const;
 function edgeBox(k: string, a: readonly number[], b: readonly number[], t: number, y: number, w: number, h: number, d: number, outward: number) {
  const dx=b[0]-a[0], dz=b[1]-a[1], length=Math.hypot(dx,dz);
  const x=a[0]+dx*t-site.x-dz/length*outward, z=a[1]+dz*t-site.z+dx/length*outward;
  const g=new THREE.BoxGeometry(w,h,d); g.rotateY(-Math.atan2(dz,dx));g.translate(x,y,z);add(k,g);
 }
 for (const [a,b] of elevations) {
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  for (const [y,h,d] of [[corniceHeight-1.6,.28,.4],[corniceHeight-.5,.22,.62],[corniceHeight+.15,.38,1],[corniceHeight+.48,.18,1.22]]) edgeBox('stone',a,b,.5,y,length+.25,h,d,.14);
 }
 box('brick', -2, corniceHeight + 1.25, -10, 13, 2.3, 10);
 box('roof', -2, corniceHeight + 2.47, -10, 13.4, .22, 10.4);
 for (const x of [-11, -5, 10]) box('metal', x, corniceHeight + .7, -14, 2.4, 1.2, 3);
 // Storefront + tall second floor, then closely spaced office floors.
 for (const y of [4.1, 8.7, 9.1]) box('stone', facadeCenter, y, front + .15, width, y === 4.1 ? .6 : .25, .34);
 function frontWindow(x: number, y: number, w: number, h: number, z: number, direction = 1) {
  z += (x - facadeCenter) * .007238;
  box('recess', x, y, z + direction * .022, w + .26, h + .24, .08);
  box('glass', x, y, z + direction * .073, w, h, .04);
  for (const s of [-1, 1]) box('stone', x + s * (w / 2 + .08), y, z + direction * .13, .12, h + .25, .14);
  box('stone', x, y - h / 2 - .10, z + direction * .19, w + .38, .16, .25);
  box('stone', x, y + h / 2 + .07, z + direction * .13, w + .26, .12, .17);
  box('metal', x, y, z + direction * .12, w, .065, .05);
 }
 const bays = 13, spacing = (width - 3) / bays;
 for (let j = 0; j < bays; j++) {
  const x = facadeCenter - width / 2 + 1.5 + spacing * (j + .5);
  frontWindow(x, 6.3, spacing * .64, 3.25, front);
  for (let floor = 0; floor < 11; floor++) {
   const y = 10.5 + floor * 2.92;
   frontWindow(x, y, spacing * .51, 1.95, front);
  }
  // Small repeating cornice brackets emphasize the long Empire facade.
  box('stone', x, corniceHeight - .3, front + .32, .32, .65, .65);
 }
 for (const [edgeIndex, [a,b]] of elevations.slice(1).entries()) {
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]), count=Math.floor(length/3.35);
  for(let j=0;j<count;j++) for(let floor=0;floor<12;floor++) {
   const t=(j+.5)/count, y=floor===0?6.3:10.5+(floor-1)*2.92, h=floor===0?3.25:1.95;
   edgeBox('recess',a,b,t,y,2.05,h+.23,.08,.04);
   edgeBox('glass',a,b,t,y,1.82,h,.04,.10);
   edgeBox('stone',a,b,t,y-h/2-.09,2.18,.15,.22,.17);
   edgeBox('stone',a,b,t,y+h/2+.06,2.08,.10,.13,.12);
   edgeBox('metal',a,b,t,y,1.85,.06,.05,.15);
  }
  // River and Plankinton shop bays continue the street-level glazed base;
  // the shorter northern service elevation retains its masonry ground floor.
  if (edgeIndex !== 1) for (let j=0;j<count;j++) {
   const t=(j+.5)/count, bay=length/count;
   edgeBox('recess',a,b,t,1.72,bay-.32,3.3,.09,.06);
   edgeBox('glass',a,b,t,1.72,bay-.52,3.05,.05,.12);
   edgeBox('metal',a,b,t,1.72,.065,3.12,.06,.17);
   edgeBox('metal',a,b,t,3.43,bay-.20,.30,1.05,.50);
   edgeBox('stone',a,b,(j+1)/count,1.8,.31,3.6,.34,.12);
  }
  for (const y of [4.1,8.7,9.1]) edgeBox('stone',a,b,.5,y,length,.25,.35,.10);
 }
 // Pedestrian scale base courses; generic shops stop at the theater opening.
 for (let j = 0; j < bays; j++) {
  const x = facadeCenter - width / 2 + 1.5 + spacing * (j + .5);
  if (Math.abs(x-entranceX) < 5.5+spacing/2) continue;
  box('glass', x, 1.75, front + .23, spacing - .45, 3.2, .07);
  box('stone', x + spacing / 2 - .1, 1.8, front + .18, .40, 3.6, .44);
  box('metal', x, 3.45, front + .6, spacing - .22, .33, 1.12);
  box('metal', x, 1.72, front + .28, .06, 3.1, .06);
 }
 // Deep shadow behind the glazed bank, masonry reveals, and brass threshold.
 // All entrance faces sit in front of the notched structural wall, not on it.
 const doorZ = entryBack + .30;
 box('recess',entranceX,1.65,entryBack+.08,10.88,3.22,.10);
 box('stone',entranceX,.04,front-.76,10.92,.08,1.74);
 for(const side of [-1,1]) {
  box('stone',entranceX+side*5.43,1.62,front-.72,.18,3.16,1.68);
  box('gold',entranceX+side*5.29,1.59,front+.09,.065,3.15,.07);
 }
 box('metal',entranceX,3.40,front-.65,10.87,.40,1.7);
 box('gold',entranceX,.065,doorZ+.06,10.64,.03,.28);
 // Three pairs of full-height framed doors, separate transoms, center stiles,
 // brass kick plates and pulls. Their glazing remains visible at walking height.
 for(let leaf=0;leaf<6;leaf++) {
  const x=entranceX-2.25+leaf*1.02;
  box('glass',x,1.39,doorZ,.92,2.42,.045);
  for(const side of [-1,1]) box('gold',x+side*.48,1.39,doorZ+.06,.058,2.51,.075);
  for(const y of [.16,2.62]) box('gold',x,y,doorZ+.06,1.02,.066,.075);
  box('gold',x,.34,doorZ+.045,.91,.30,.07);
  const handleX=x+(leaf%2===0?.29:-.29);
  box('gold',handleX,1.29,doorZ+.15,.038,.48,.045);
  for(const y of [1.07,1.51]) box('gold',handleX,y,doorZ+.10,.045,.055,.14);
  box('glass',x,2.88,doorZ,.93,.36,.04);
  box('gold',x,3.10,doorZ+.06,1.02,.055,.07);
 }
 // Recessed box-office ticket window and small transaction counter.
 const ticketX=entranceX-4.14;
 box('metal',ticketX,1.55,doorZ+.05,1.86,2.92,.12);
 box('glass',ticketX,1.94,doorZ+.14,1.60,1.42,.045);
 for(const side of [-1,1]) box('gold',ticketX+side*.84,1.94,doorZ+.19,.062,1.53,.06);
 for(const y of [1.18,2.71]) box('gold',ticketX,y,doorZ+.19,1.73,.065,.07);
 box('gold',ticketX,1.11,doorZ+.31,1.90,.09,.43);
 box('recess',ticketX,1.25,doorZ+.23,.44,.09,.05);
 const speakRing=new THREE.TorusGeometry(.085,.012,5,16);
 speakRing.translate(ticketX,1.83,doorZ+.19);add('gold',speakRing);
 // Illuminated, original lettering on the soffit fascia.
 box('metal',entranceX,3.26,front+.13,10.64,.48,.12);
 letters('BOX OFFICE',entranceX-1.46,3.10,front+.205,.30,.22);
 for(const y of [3.02,3.50]) box('gold',entranceX,y,front+.21,10.70,.038,.05);
 // Two original abstract poster cases flank the entrance; no event artwork.
 for(const side of [-1,1]) {
  const x=entranceX+side*5.88;
  box('metal',x,1.68,front+.28,.82,1.89,.20);
  box('red',x,1.68,front+.391,.68,1.70,.035);
  for(const edge of [-1,1]) box('gold',x+edge*.38,1.68,front+.414,.035,1.84,.04);
  for(const y of [.77,2.59]) box('gold',x,y,front+.414,.79,.035,.04);
  for(let j=0;j<4;j++) box('board',x,1.25+j*.12,front+.422,.47-j*.055,.045,.025);
  const art=new THREE.TorusGeometry(.19,.028,5,18);
  art.translate(x,2.08,front+.423);add('gold',art);
  box('bulbs',x,2.53,front+.43,.56,.04,.035);
 }
 // Projecting marquee: red top/bottom rails, illuminated letterboard and side returns.
 const canopyWidth = 11.3, canopyDepth = 4.5, canopyFront = front + canopyDepth;
 box('metal', entranceX, 3.74, front + canopyDepth / 2, canopyWidth, .26, canopyDepth);
 // Shallow coffer rails give the canopy underside visible depth between lamps.
 for(let i=0;i<=6;i++) box('gold',entranceX-canopyWidth/2+i*canopyWidth/6,3.59,front+canopyDepth/2,.045,.065,canopyDepth-.15);
 for(let i=0;i<=3;i++) box('gold',entranceX,3.59,front+.12+i*(canopyDepth-.24)/3,canopyWidth-.15,.065,.045);
 box('red', entranceX, 4.60, canopyFront, canopyWidth + .15, 1.6, .24);
 box('board', entranceX, 4.6, canopyFront + .135, canopyWidth - .45, 1.16, .06);
 for (const s of [-1, 1]) {
  const x = entranceX + s * canopyWidth / 2;
  box('red', x, 4.6, front + canopyDepth / 2, .22, 1.6, canopyDepth);
  box('board', x + s * .13, 4.6, front + canopyDepth / 2, .05, 1.16, canopyDepth - .38);
  for (const y of [3.87, 5.33]) box('gold', x + s * .14, y, front + canopyDepth / 2, .09, .065, canopyDepth);
 }
 for (const y of [3.87, 5.33]) box('gold', entranceX, y, canopyFront + .17, canopyWidth + .12, .07, .07);
 for (const y of [4.21, 4.60, 4.99]) box('metal', entranceX, y, canopyFront + .174, canopyWidth - .48, .016, .02);
 // Warm bulbs in fanning rows are visible from street level, not only from above.
 let undersideBulbs = 0;
 for (let row = 0; row < 15; row++) for (let j = 0; j < 7; j++) {
  const t = j / 6, x = entranceX + (row - 7) * (.63 + .18 * t), z = front + .35 + t * (canopyDepth - .55);
  bulb(x, 3.565, z); undersideBulbs++;
 }
 for (let j = 0; j <= 36; j++) bulb(entranceX - canopyWidth / 2 + j * canopyWidth / 36, 3.81, canopyFront + .17, .06);
 // Circular backing follows the photographed marquee silhouette; its
 // simple round frame and original stroke text do not reproduce logo artwork.
 const disc = new THREE.CylinderGeometry(1.28,1.28,.16,48);
 disc.rotateX(Math.PI/2);disc.translate(entranceX,6.2,canopyFront-.16);add('red',disc);
 const circleTrim = new THREE.TorusGeometry(1.30,.065,6,48);
 circleTrim.translate(entranceX,6.2,canopyFront-.05);add('gold',circleTrim);
 for(let i=0;i<48;i++) {
  const angle=i*Math.PI*2/48;
  bulb(entranceX+1.19*Math.cos(angle),6.2+1.19*Math.sin(angle),canopyFront+.035,.037);
 }
 // Original upper lettering on a red sign panel in front of the round backing.
 box('red', entranceX, 6.2, canopyFront -.03, 9.8, 1.6, .20);
 for (const y of [5.43, 6.97]) box('gold', entranceX, y, canopyFront + .09, 9.8, .075, .08);
 letters('RIVERSIDE', entranceX - 4.45, 5.62, canopyFront + .13, 1.1, .72);
 // Curved metal scrolls suggest the photographed frame without reproducing the wordmark.
 for (const side of [-1, 1]) for (let j = 0; j < 15; j++) {
  const t = j / 14, theta = t * Math.PI * 1.8;
  const x = entranceX + side * (5.0 + .7 * t * Math.cos(theta));
  const y = 5.85 + .42 * t * Math.sin(theta);
  if (j > 0) {
   const q = (j - 1) / 14, angle = q * Math.PI * 1.8;
   rod('gold', new THREE.Vector3(entranceX + side * (5 + .7 * q * Math.cos(angle)), 5.85 + .42 * q * Math.sin(angle), canopyFront + .05), new THREE.Vector3(x, y, canopyFront + .05), .06);
  }
 }
 // Forty-foot blade (12.192 m), perpendicular to the frontage, facing east/west.
 // Mounting elevation is estimated from the street photo against office floors.
 const bladeX = entranceX - 1.2, bladeBottom = 16, bladeHeight = 12.192;
 const bladeZ = front + 1.5, bladeDepth = 1.74;
 box('red', bladeX, bladeBottom + bladeHeight / 2, bladeZ, .44, bladeHeight, bladeDepth);
 for (const y of [bladeBottom + .10, bladeBottom + bladeHeight - .10]) box('gold', bladeX, y, bladeZ, .51, .16, bladeDepth);
 for (const s of [-1, 1]) {
  for (const z of [bladeZ - bladeDepth / 2 + .06, bladeZ + bladeDepth / 2 - .06]) box('gold', bladeX + s * .24, bladeBottom + bladeHeight / 2, z, .07, bladeHeight -.16, .07);
  letters('RIVERSIDE', bladeX + s * .27, bladeBottom + bladeHeight - 1.45, bladeZ + s * .46, .96, -s * .90, true, true);
  for (let j = 0; j < 34; j++) for (const z of [bladeZ - .78, bladeZ + .78]) bulb(bladeX + s * .275, bladeBottom + .3 + j * .35, z, .033);
 }
 for (const y of [bladeBottom + 1, bladeBottom + bladeHeight - 1]) {
  box('metal', bladeX, y, front + .63, .20, .24, 1.35);
  rod('metal', new THREE.Vector3(bladeX, y + .8, front + .06), new THREE.Vector3(bladeX, y, bladeZ), .06);
 }
 // Solid, terrain-integrated paving fills the narrow entrance approach.
 // Its outer edge follows the real road crossfall; the threshold edge is level.
 const apronBack=site.z+doorZ+.24, apronFront=streetZ, apronX=site.x+entranceX;
 const apronPositions:number[]=[];
 const triangle=(a:number[],b:number[],c:number[])=>apronPositions.push(...a,...b,...c);
 const apronTop=(x:number,z:number)=>{
  const t=(z-apronBack)/(apronFront-apronBack);
  return THREE.MathUtils.lerp(floor+.04,streetHeight(x)+.015*roadCalibration,t);
 };
 const local=(x:number,y:number,z:number)=>[x-site.x,y-floor,z-site.z];
 for(let ix=0;ix<6;ix++) for(let iz=0;iz<4;iz++) {
  const x0=apronX-approachHalfWidth+ix*approachHalfWidth/3,x1=x0+approachHalfWidth/3;
  const z0=apronBack+iz*(apronFront-apronBack)/4,z1=z0+(apronFront-apronBack)/4;
  const A=local(x0,apronTop(x0,z0),z0),B=local(x1,apronTop(x1,z0),z0),C=local(x1,apronTop(x1,z1),z1),D=local(x0,apronTop(x0,z1),z1);
  triangle(A,C,B);triangle(A,D,C);
  // Closed sides sink into terrain; this is not a floating presentation slab.
  for(const [p,q,edge] of [[A,B,iz===0],[B,C,ix===5],[C,D,iz===3],[D,A,ix===0]] as [number[],number[],boolean][]) {
   if(!edge)continue;
   const P=[p[0],Math.min(p[1]-.12,groundAt(p[0]+site.x,p[2]+site.z)-floor-.20),p[2]];
   const Q=[q[0],Math.min(q[1]-.12,groundAt(q[0]+site.x,q[2]+site.z)-floor-.20),q[2]];
   triangle(p,q,Q);triangle(p,Q,P);
  }
 }
 const apronGeometry=new THREE.BufferGeometry();apronGeometry.setAttribute('position',new THREE.Float32BufferAttribute(apronPositions,3));apronGeometry.computeVertexNormals();
 const apronMesh=new THREE.Mesh(apronGeometry,materials.stone);apronMesh.name='riverside-entrance-apron';
 apronMesh.userData.walkingSurface='grade';apronMesh.userData.part='approach';apronMesh.receiveShadow=true;root.add(apronMesh);
 root.userData.approach={ minX:apronX-approachHalfWidth,maxX:apronX+approachHalfWidth,back:apronBack,front:apronFront,roadCalibration };
 for (const [name, geometries] of Object.entries(buckets)) {
  if (!geometries.length) continue;
  const geometry = mergeGeometries(geometries);
  if (!geometry) throw new Error(`Riverside geometry merge failed: ${name}`);
  const mesh = new THREE.Mesh(geometry, materials[name]);
  mesh.name = ['brick', 'foundation'].includes(name) ? 'BLDG' : `riverside-${name}`;
  mesh.userData.part = name; mesh.castShadow = !['glass', 'bulbs'].includes(name); mesh.receiveShadow = true;
  root.add(mesh); geometries.forEach(g => g.dispose());
 }
 root.position.set(site.x, floor, site.z);
 root.userData.finishedFloor = floor; root.userData.facade = 'south';
 root.userData.bladeHeight = bladeHeight; root.userData.bladeBottom = bladeBottom; root.userData.undersideBulbCount = undersideBulbs;
 root.userData.referenceDimensions = { width, depth, corniceHeight };
 root.userData.entrance = { x: site.x+entranceX, front: site.z+front, doorZ: site.z+doorZ, leafCenters: Array.from({length:6},(_,i)=>site.x+entranceX-2.25+i*1.02), pairCount: 3, recessDepth: front-doorZ };
 root.userData.setLightingMode = (mode: LightingMode) => {
  materials.recess.emissive.setHex(0xb78143);
  materials.recess.emissiveIntensity = mode === 'night' ? .075 : mode === 'sunset' ? .025 : 0;
  materials.glass.emissive.setHex(0xf2c486);
  materials.glass.emissiveIntensity = mode === 'night' ? .35 : mode === 'sunset' ? .12 : 0;
  materials.board.emissiveIntensity = mode === 'night' ? 1.35 : mode === 'sunset' ? .65 : 0;
  materials.bulbs.emissiveIntensity = mode === 'night' ? 3 : mode === 'sunset' ? 1.8 : 0;
 };
 root.userData.setLightingMode('day'); return root;
}
