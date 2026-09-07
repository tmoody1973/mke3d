import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface NewMuseumOptions {width?:number;depth?:number;height?:number}
type Mode='day'|'sunset'|'night';

function box(x:number,y:number,z:number,w:number,h:number,d:number){const g=new THREE.BoxGeometry(w,h,d);g.translate(x,y,z);return g;}
function roundedPlan(shape:THREE.Path,w:number,d:number,r:number,inset=0){
  const hw=w/2-inset,hd=d/2-inset,rr=Math.max(.02,Math.min(r-inset,hw,hd));
  shape.moveTo(-hw+rr,-hd);shape.lineTo(hw-rr,-hd);shape.absarc(hw-rr,-hd+rr,rr,-Math.PI/2,0,false);shape.lineTo(hw,hd-rr);shape.absarc(hw-rr,hd-rr,rr,0,Math.PI/2,false);shape.lineTo(-hw+rr,hd);shape.absarc(-hw+rr,hd-rr,rr,Math.PI/2,Math.PI,false);shape.lineTo(-hw,-hd+rr);shape.absarc(-hw+rr,-hd+rr,rr,Math.PI,Math.PI*1.5,false);
}
function merge(root:THREE.Group,name:string,parts:THREE.BufferGeometry[],material:THREE.Material,collision=false){
  if(!parts.length)return null;const flat=parts.map(p=>{const g=p.index?p.toNonIndexed():p.clone();g.deleteAttribute('uv');return g;});const geometry=mergeGeometries(flat,false)!;parts.forEach(p=>p.dispose());flat.forEach(p=>p.dispose());
  const mesh=new THREE.Mesh(geometry,material);mesh.name=collision?'BLDG':name;mesh.castShadow=collision;mesh.receiveShadow=true;root.add(mesh);return mesh;
}
type MuseumVolume={x:number;z:number;w:number;d:number;r:number;low:number;high:number;kind:number};
// Rounded plans keep straight wall portions and smooth corners. Wall strips are
// clipped around openings, so stone and horizontal ribs never cross the glass.
function volumeWall(l:MuseumVolume,low:number,high:number,offset=0,opening=false){
 const shape=new THREE.Shape();roundedPlan(shape,l.w,l.d,l.r);
 const raw=shape.getPoints(10),points:THREE.Vector2[]=[];
 for(let i=0;i<raw.length-1;i++){
  const a=raw[i],b=raw[i+1],n=Math.max(1,Math.ceil(a.distanceTo(b)/(offset>0?2.8:.75)));
  for(let j=0;j<n;j++)points.push(a.clone().lerp(b,j/n));
 }
 const curve=(p:THREE.Vector2,y:number)=>{
  const t=(y-l.low)/(l.high-l.low);
  const swell=l.kind===0?-1.2+3.0*Math.sin(t*Math.PI*.7):l.kind===1?-1.0+2.5*Math.sin(t*Math.PI*.62):0;
  const onWestEast=Math.abs(p.x)/(l.w/2)>Math.abs(p.y)/(l.d/2);
  const along=onWestEast?Math.abs(p.y):Math.abs(p.x),extent=onWestEast?l.d/2:l.w/2;
  const corner=Math.exp(-(((along-(extent-l.r*.45))/5.5)**2));
  // Strata strengthen at curved corners and dissolve over smooth panel faces.
  const relief=offset>0?offset*(.15+1.9*corner):offset;
  return new THREE.Vector3(l.x+p.x*(1+(swell+relief)/(l.w/2)),y,l.z+p.y*(1+(swell+relief)/(l.d/2)));
 };
 const bottom=(p:THREE.Vector2,segment:THREE.Vector2)=>{
  const x=l.x+p.x,z=l.z+p.y,y=(low+high)/2;
  let value=low;
  if(l.kind===0){
   // Northwest cafeteria: north face and rounded corner stay level. On the
   // Sixth Street face the soffit rolls down once, leaving a solid south pier.
   const northFace=segment.x<-l.w/2+l.r;
   const streetFace=segment.y>l.d/2-l.r;
   if(northFace&&z>-4)value=Math.max(value,4.6);
   if(streetFace&&x<-8){
    const t=THREE.MathUtils.clamp((x+19)/11,0,1);
    value=Math.max(value,4.6*Math.sqrt(Math.max(0,1-t*t)));
   }
   // A single recessed window turns the northwest corner. It ends before
   // the southern pier instead of becoming a continuous horizontal belt.
   if(y>=16.6&&y<=19.05&&((northFace&&z>17)||(streetFace&&x<-12)))value=high;
   if(y>=10.3&&y<=10.95&&p.y>l.d/2-.6&&x>-14&&x<-8)value=high;
  }else if(l.kind===1){
   if(p.x>l.w/2-1&&Math.abs(z-11)<12)value=Math.max(value,4.6*Math.sqrt(Math.max(0,1-((z-11)/12)**2)));
   if(p.y>l.d/2-2&&x>15)value=Math.max(value,5.5*Math.sqrt(Math.max(0,1-((34-x)/19)**2)));
   if(y>=14.7&&y<=16.7&&p.y>l.d/2-3&&x>19)value=high;
   if(y>=21&&y<=21.65&&p.y>l.d/2-.6&&x>11&&x<24)value=high;
  }else if(l.kind===2){
   // Separate northwest lobe beside the garden, with a low glazed Commons.
   if(p.y< -l.d/2+l.r&&x< -16)value=Math.max(value,4.2);
   if(y>=14.7&&y<=16.6&&p.x<-l.w/2+1.2&&z<-17)value=high;
  }else if(l.kind===3){
   if(y>=30.3&&y<=31&&p.y>l.d/2-.5&&x>-21&&x<-12)value=high;
   if(y>=30.3&&y<=31&&p.x<-l.w/2+.5&&z>-5&&z<4)value=high;
  }
  return Math.min(high,value);
 };
 const vertices:number[]=[],normals:number[]=[];
 const normal=(i:number)=>{
  const previous=points[(i-1+points.length)%points.length],next=points[(i+1)%points.length];
  return new THREE.Vector3(next.y-previous.y,0,previous.x-next.x).normalize();
 };
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length],segment=a.clone().add(b).multiplyScalar(.5),ya=bottom(a,segment),yb=bottom(b,segment);
  if(opening?(ya<=low&&yb<=low):(ya>=high&&yb>=high))continue;
  const A=curve(a,opening?low:ya),B=curve(b,opening?low:yb),C=curve(b,opening?yb:high),D=curve(a,opening?ya:high);
  vertices.push(...A.toArray(),...D.toArray(),...C.toArray(),...A.toArray(),...C.toArray(),...B.toArray());
  const na=normal(i).toArray(),nb=normal((i+1)%points.length).toArray();normals.push(...na,...na,...nb,...na,...nb,...nb);
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));return g;
}

/** Future Milwaukee Public Museum visualization, centered at grade zero.
 * Finished local -X faces Sixth Street; +Z faces McKinley. Volume profiles
 * are authored with the entrance at +Z, then rotated onto the mapped site.
 */
export function buildNewMuseum(options:NewMuseumOptions={}):THREE.Group{
  const width=options.width??52,depth=options.depth??60,height=options.height??30.48,sx=width/68,sz=depth/60,sy=height/34;
  const root=new THREE.Group();root.name='future-milwaukee-public-museum';
  const stone=new THREE.MeshStandardMaterial({color:0xe2dccd,roughness:.91});
  const bandMat=new THREE.MeshStandardMaterial({color:0xe7e1d3,roughness:.88});
  const recessMat=new THREE.MeshStandardMaterial({color:0x303838,roughness:.64});
  const glassMat=new THREE.MeshStandardMaterial({color:0x67838a,roughness:.2,metalness:.14,transparent:true,opacity:.6,emissive:0x9ec7c4,emissiveIntensity:0});
  const entryBlueMat=new THREE.MeshStandardMaterial({color:0x367caa,roughness:.45,metalness:.25,emissive:0x2465a2,emissiveIntensity:0});
  const frameMat=new THREE.MeshStandardMaterial({color:0xa9b3af,roughness:.43,metalness:.56});
  const solarMat=new THREE.MeshStandardMaterial({color:0x263e4c,roughness:.25,metalness:.35});
  const planterMat=new THREE.MeshStandardMaterial({color:0x736a5b,roughness:.93});
  const shrubMat=new THREE.MeshStandardMaterial({color:0x496743,roughness:1});
  const glowMat=new THREE.MeshBasicMaterial({color:0xd9efff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
  const commonsMat=new THREE.MeshStandardMaterial({color:0xb9ad95,roughness:.83,emissive:0xc6a56d,emissiveIntensity:0});
  const commons:THREE.BufferGeometry[]=[];
  const entryInfill:THREE.BufferGeometry[]=[];
  const shell:THREE.BufferGeometry[]=[],bands:THREE.BufferGeometry[]=[],recesses:THREE.BufferGeometry[]=[],glass:THREE.BufferGeometry[]=[],frames:THREE.BufferGeometry[]=[],roof:THREE.BufferGeometry[]=[],planters:THREE.BufferGeometry[]=[],shrubs:THREE.BufferGeometry[]=[],glow:THREE.BufferGeometry[]=[];

  // Three principal masses, with the highest western lobe stepping back above
  // a planted shoulder. The step occurs near the roof, not halfway up the wall.
  const volumes:MuseumVolume[]=[
    {x:-19,z:11,w:30,d:36,r:7.8,low:0,high:26.8,kind:0},
    {x:18,z:11,w:28,d:33,r:7.8,low:0,high:26.5,kind:1},
    {x:-18,z:-20,w:24,d:26,r:6.5,low:0,high:23.4,kind:2},
    {x:-20.5,z:10,w:27,d:32,r:7.8,low:26.8,high:34,kind:3},
    {x:-19,z:-22,w:21,d:21,r:5.5,low:23.4,high:28,kind:4},
  ];
  const levels=[0,8,10.3,10.95,14.7,16.6,16.7,19.05,21,21.65,23.4,26.5,26.8,30.3,31,34];
  for(const l of volumes){
    const cuts=[l.low,...levels.filter(y=>y>l.low&&y<l.high),l.high];
    for(let i=0;i<cuts.length-1;i++){
      shell.push(volumeWall(l,cuts[i],cuts[i+1]));
      const pane=volumeWall(l,cuts[i],cuts[i+1],-.72,true);
      if(pane.getAttribute('position').count){
        glass.push(pane);
        (cuts[i]===0?commons:recesses).push(volumeWall(l,cuts[i],cuts[i+1],-1.3,true));
        const p=pane.getAttribute('position');
        if((l.kind===0||l.kind===2)&&cuts[i]===0){
          // Close the shallow soffit between the outer stone edge and inset
          // glass, including the corner, using matching perimeter vertices.
          const outer=volumeWall(l,cuts[i],cuts[i+1],0,true),q=outer.getAttribute('position'),soffit:number[]=[];
          for(let j=0;j<p.count;j+=6){
            const vertex=(attribute:THREE.BufferAttribute|THREE.InterleavedBufferAttribute,k:number)=>[attribute.getX(k),attribute.getY(k),attribute.getZ(k)];
            const a=vertex(q,j+1),b=vertex(q,j+2),c=vertex(p,j+2),d=vertex(p,j+1);
            soffit.push(...a,...b,...c,...a,...c,...d);
          }
          const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(soffit,3));g.computeVertexNormals();shell.push(g);outer.dispose();
        }
        if(l.kind===1&&cuts[i]===0){
          const n=pane.getAttribute('normal'),blue:number[]=[];
          for(let j=0;j<p.count;j+=3)if([0,1,2].every(k=>n.getX(j+k)>.8)){
            for(let k=0;k<3;k++)blue.push(p.getX(j+k)+.045,p.getY(j+k),p.getZ(j+k));
          }
          const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(blue,3));g.computeVertexNormals();entryInfill.push(g);
        }
        for(let k=0;k<p.count;k+=cuts[i]===0?12:24){
          const h=p.getY(k+1)-p.getY(k);
          if(h>1.1)frames.push(box(p.getX(k),p.getY(k)+h/2,p.getZ(k),cuts[i]===0?.11:.075,h,cuts[i]===0?.11:.075));
        }
      }else pane.dispose();
    }
    const cap=new THREE.Shape();roundedPlan(cap,l.w,l.d,l.r);
    shell.push(new THREE.ShapeGeometry(cap,12).rotateX(-Math.PI/2).translate(l.x,l.high,l.z));
    // Shallow light-colored relief creates fine shadow lines, not dark floor belts.
    for(let y=l.low+.3;y<l.high-.1;y+=.38){
      bands.push(volumeWall(l,y-.095,y+.095,.21));
    }
  }
  // Ground glazing, curved slot windows and their dark reveals are clipped
  // from the very same surface as the stone above; no rectangular panes protrude.
  // The Sixth Street elevation has two distinct rounded masses, separated by
  // a narrow glazed cleft. The previous long western block erased this gap.
  glass.push(box(-18,12,-8.5,8,22,6));
  recesses.push(box(-18,12,-8.5,5.8,22,1.4));
  for(const y of [1,5,9,13,17,21,25])frames.push(box(-20.05,y,-8.5,.12,.12,4.1));
  for(const z of [-10.45,-8.5,-6.55])frames.push(box(-20.05,13,z,.12,24,.09));
  // Fit every curtain-wall edge to the actual stone surface. A constant-width
  // box leaves triangular gaps when the two surrounding lobes lean outward.
  const probeMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});
  const probes=shell.map(g=>new THREE.Mesh(g,probeMaterial));
  const canyonZ=24.2,canyonRows:{y:number;left:number;right:number}[]=[];
  function edge(y:number,direction:number){
    const ray=new THREE.Raycaster(new THREE.Vector3(0,Math.max(.02,y),canyonZ),new THREE.Vector3(direction,0,0));
    const hit=ray.intersectObjects(probes,false)[0];
    if(!hit)throw new Error(`Museum canyon has no stone edge at ${y}`);
    return hit.point.x+direction*.16; // embed the seal inside the stone
  }
  function quad(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,d:THREE.Vector3){
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([...a.toArray(),...b.toArray(),...c.toArray(),...a.toArray(),...c.toArray(),...d.toArray()],3));g.computeVertexNormals();return g;
  }
  function mullion(a:THREE.Vector3,b:THREE.Vector3,r=.055){
    const direction=b.clone().sub(a),g=new THREE.CylinderGeometry(r,r,direction.length(),6);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()));g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());frames.push(g);
  }
  for(let i=0;i<=54;i++){const y=26.2*i/54;canyonRows.push({y,left:edge(y,-1),right:edge(y,1)});}
  for(let i=1;i<canyonRows.length;i++){
    const a=canyonRows[i-1],c=canyonRows[i];
    const panel=(z:number,inset=0)=>quad(new THREE.Vector3(a.left+inset,a.y,z),new THREE.Vector3(a.right-inset,a.y,z),new THREE.Vector3(c.right-inset,c.y,z),new THREE.Vector3(c.left+inset,c.y,z));
    glass.push(panel(canyonZ));recesses.push(panel(canyonZ-1.3));glow.push(panel(canyonZ+.025,.22));
    for(const t of [0,.25,.5,.75,1])mullion(new THREE.Vector3(THREE.MathUtils.lerp(a.left,a.right,t),a.y,canyonZ+.07),new THREE.Vector3(THREE.MathUtils.lerp(c.left,c.right,t),c.y,canyonZ+.07));
  }
  for(const y of [0,3.8,7.5,11.2,15,18.8,22.5,26.2]){
    const left=edge(y,-1),right=edge(y,1);
    frames.push(box((left+right)/2,y,canyonZ+.08,right-left,.12,.15));
    if(y>3.8&&y<26)shell.push(box((left+right)/2,y-.12,21,right-left,.22,6));
  }
  probeMaterial.dispose();
  // Terrace on the shoulder between the taller upper mass and the south face.
  for(const [x,z,y,w,d] of [[-12,28,26.8,12,1.6],[-18,-8.5,23.4,15,2.4]]){
    planters.push(box(x,y+.25,z,w,.5,d));
    for(let i=0;i<9;i++){const g=new THREE.IcosahedronGeometry(.65,1);g.scale(1,.8+(i%3)*.25,1);g.translate(x-w*.45+i*w*.9/8,y+.8,z+Math.sin(i*2.4)*.45);shrubs.push(g);}
  }
  // Glazed rooftop commons behind the high western shoulder.
  glass.push(box(-8,26,-12,7,4,8));
  for(const side of [-1,1]){const g=new THREE.BoxGeometry(3.8,.14,8.4);g.rotateZ(side*.12);g.translate(-8+side*1.8,28.1,-12);glass.push(g);}
  for(const [cx,cz,cy,nx,nz] of [[-21,10,34.15,5,8],[18,11,26.65,4,8],[-19,-22,28.15,4,5]] as const)
    for(let ix=0;ix<nx;ix++)for(let iz=0;iz<nz;iz++)roof.push(box(cx+(ix-(nx-1)/2)*3.7,cy,cz+(iz-(nz-1)/2)*3,3.2,.12,2.5));

  merge(root,'new-museum-commons-interior',commons,commonsMat);
  merge(root,'new-museum-blue-entry-installation',entryInfill,entryBlueMat);
  merge(root,'new-museum-softened-geological-lobes',shell,stone,true);
  const strataMesh=merge(root,'new-museum-horizontal-strata-bands',bands,bandMat)!;strataMesh.castShadow=true;
  merge(root,'new-museum-real-window-recesses',recesses,recessMat);
  merge(root,'new-museum-canyon-scoops-and-slots',glass,glassMat);
  merge(root,'new-museum-curtainwall-frames',frames,frameMat);
  merge(root,'new-museum-solar-and-butterfly-roof',roof,solarMat);
  merge(root,'new-museum-terrace-planters',planters,planterMat);
  merge(root,'new-museum-terrace-shrubs',shrubs,shrubMat);
  const glowMesh=merge(root,'new-museum-canyon-interior-light',glow,glowMat)!;glowMesh.castShadow=false;
  // The authored entrance elevation is +Z. Rotate it onto Sixth Street (-X),
  // placing the high bluff northwest, the short bluff southwest and the rear
  // bluff northeast, as in the architect's site plan. Fit AFTER this rotation.
  root.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.rotateY(-Math.PI/2);});
  // Fit the complete architecture, including bands and roof equipment, to the caller's placement envelope.
  const rawBounds=new THREE.Box3().setFromObject(root),rawSize=new THREE.Vector3(),rawCenter=new THREE.Vector3();rawBounds.getSize(rawSize);rawBounds.getCenter(rawCenter);
  root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.translate(-rawCenter.x,-rawBounds.min.y,-rawCenter.z);o.geometry.scale(width/rawSize.x,height/rawSize.y,depth/rawSize.z);o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();}});
  let drawCalls=0,triangles=0;root.traverse(o=>{if(o instanceof THREE.Mesh){drawCalls++;const p=o.geometry.getAttribute('position');triangles+=(o.geometry.index?.count??p.count)/3;}});
  root.userData.canyonSeams=canyonRows.map(p=>({y:(p.y-rawBounds.min.y)*height/rawSize.y,left:(p.left-rawCenter.z)*depth/rawSize.z,right:(p.right-rawCenter.z)*depth/rawSize.z,x:(-canyonZ-rawCenter.x)*width/rawSize.x}));
  root.userData.authoredTransform={center:rawCenter.toArray(),size:rawSize.toArray(),width,depth,height};
  root.userData.dimensions={width,depth,height};root.userData.drawCalls=drawCalls;root.userData.triangles=triangles;
  root.userData.axes={westFront:'-X / Sixth Street entrance',southFront:'+Z / McKinley Avenue'};
  root.userData.features={lobes:3,entryCanyon:true,scoopedGroundGlazing:2,realMidheightRecesses:3,terraces:2,butterflyRoof:true};
  const facadeLights:THREE.SpotLight[]=[];
  for(const [x,z,tx,tz,color] of [[-46,8,-30,2,0xffdfb8],[-22,44,-19,28,0xf0f4ff],[23,44,18,28,0xf0f4ff]]){
    const light=new THREE.SpotLight(color,0,85,1.3,1,2);
    light.name='museum-soft-facade-wash';
    light.position.set(-z*sx,1.3*sy,x*sz);light.target.position.set(-tz*sx,18*sy,tx*sz);root.add(light,light.target);facadeLights.push(light);
  }
  root.userData.setLightingMode=(mode:Mode)=>{commonsMat.emissiveIntensity=mode==='night'?.35:mode==='sunset'?.18:0;stone.emissive.set(0x9caabe);bandMat.emissive.copy(stone.emissive);stone.emissiveIntensity=bandMat.emissiveIntensity=mode==='night'?.075:mode==='sunset'?.018:0;entryBlueMat.emissiveIntensity=mode==='night'?.8:mode==='sunset'?.3:0;facadeLights.forEach(light=>light.intensity=mode==='night'?2200:mode==='sunset'?750:0);glassMat.emissiveIntensity=mode==='night'?.19:mode==='sunset'?.07:0;glowMat.opacity=mode==='night'?.3:mode==='sunset'?.16:0;glowMesh.visible=glowMat.opacity>0;};
  root.userData.setLightingMode('day');return root;
}
