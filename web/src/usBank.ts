import * as THREE from 'three';

export type UsBankLightingMode = 'day' | 'sunset' | 'night';
export interface UsBankOptions {
  /** Rectangular shaft footprint, in metres. Broad elevations face local ±Z. */
  width: number;
  depth: number;
  height?: number;
}
type Point = [number, number, number];
type UV = [number, number];
type Face = { name: string; span: number; bays: number; tangent: [number,number]; normal: [number,number]; offset: number };
const hash=(seed:number)=>{let n=Math.imul(seed^0x6d2b79f5,0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return ((n^(n>>>16))>>>0)/4294967296;};
function quad(out:number[],a:Point,b:Point,c:Point,d:Point){out.push(...a,...b,...c,...a,...c,...d);}
function point(face:Face,u:number,y:number,inset=0):Point{return [face.tangent[0]*u+face.normal[0]*(face.offset+inset),y,face.tangent[1]*u+face.normal[1]*(face.offset+inset)];}
function panel(out:number[],face:Face,left:number,right:number,bottom:number,top:number,inset:number){
  quad(out,point(face,left,bottom,inset),point(face,right,bottom,inset),point(face,right,top,inset),point(face,left,top,inset));
}
/** CCW cross-section, with correct exterior winding on all six prism sides. */
function prism(out:number[],face:Face,polygon:UV[],front=0,back=-.42){
  const a=polygon.map(([u,y])=>point(face,u,y,front)),b=polygon.map(([u,y])=>point(face,u,y,back));
  for(let i=1;i<polygon.length-1;i++){out.push(...a[0],...a[i],...a[i+1],...b[0],...b[i+1],...b[i]);}
  for(let i=0;i<polygon.length;i++){const j=(i+1)%polygon.length;quad(out,a[i],b[i],b[j],a[j]);}
}
function bar(out:number[],face:Face,l:number,r:number,b:number,t:number,front=0,back=-.42){prism(out,face,[[l,b],[r,b],[r,t],[l,t]],front,back);}
function diagonal(out:number[],face:Face,a:UV,b:UV,width:number){
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),ox=-dy/length*width/2,oy=dx/length*width/2;
  prism(out,face,[[a[0]-ox,a[1]-oy],[b[0]-ox,b[1]-oy],[b[0]+ox,b[1]+oy],[a[0]+ox,a[1]+oy]],-.035,-.70);
}
function colored(out:number[],count:number,color:THREE.Color){for(let i=0;i<count;i++)out.push(color.r,color.g,color.b);}
function mesh(name:string,positions:number[],material:THREE.Material,colors?:number[]){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  if(colors)geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const object=new THREE.Mesh(geometry,material);object.name=name;object.castShadow=true;object.receiveShadow=true;return object;
}

/** White aluminum trussed-tube tower. Local photo pack is reference only; no photo textures. */
export function buildUsBank({width,depth,height=183.2}:UsBankOptions):THREE.Group {
  if(![width,depth,height].every(Number.isFinite)||width<20||depth<15||height<80)throw new Error('Invalid U.S. Bank Center dimensions');
  const root=new THREE.Group();root.name='us-bank-center';
  const scale=height/183.2;
  const faces:Face[]=[
    {name:'south',span:width,bays:8,tangent:[1,0],normal:[0,1],offset:depth/2},
    {name:'east',span:depth,bays:5,tangent:[0,-1],normal:[1,0],offset:width/2},
    {name:'north',span:width,bays:8,tangent:[-1,0],normal:[0,-1],offset:depth/2},
    {name:'west',span:depth,bays:5,tangent:[0,1],normal:[-1,0],offset:width/2},
  ];
  // Reference photos 04 and 07 place the lower truss directly on the Galleria roof.
  // Its two-level depth reaches the fifth-story zone; no office rows intervene.
  const trussBands=[{name:'lower',low:10.6*scale,high:18.9*scale,story:5},{name:'middle',low:71.5*scale,high:79.8*scale,story:18},{name:'crown',low:174.9*scale,high:height,story:42}];
  const glass:number[]=[],glassColors:number[]=[],rails:number[]=[],jambs:number[]=[],mullions:number[]=[],recess:number[]=[],roof:number[]=[],lights:number[]=[],lightColors:number[]=[];
  const trusses=trussBands.map(()=>[] as number[]);
  const aluminum=new THREE.MeshStandardMaterial({color:0xe7e8e0,roughness:.48,metalness:.05});
  const windowMaterial=new THREE.MeshStandardMaterial({color:0x414b4b,vertexColors:true,roughness:.34,metalness:.38});
  const darkMaterial=new THREE.MeshStandardMaterial({color:0x303735,roughness:.7,metalness:.2});
  // 42 levels are the historical story count. Taller truss/mechanical zones interrupt
  // the ordinary four-metre office rhythm, as in the street and full-tower photos.
  const zones=[{low:0,high:trussBands[0].low,floors:2},{low:trussBands[0].high,high:trussBands[1].low,floors:13},{low:trussBands[1].high,high:trussBands[2].low,floors:23}];
  let officeBays=0,litBays=0,windowPanes=0;
  faces.forEach((face,faceIndex)=>{
    const half=face.span/2,bay=face.span/face.bays;
    // Every frame member lies within the surveyed shaft envelope.
    for(let i=0;i<=face.bays;i++){
      const u=-half+i*bay,w=(i===0||i===face.bays)?.75:.55;
      bar(jambs,face,Math.max(-half,u-w/2),Math.min(half,u+w/2),0,height);
    }
    let level=0;
    zones.forEach(zone=>{
      const pitch=(zone.high-zone.low)/zone.floors;
      for(let floor=0;floor<zone.floors;floor++,level++){
        const low=zone.low+floor*pitch,high=low+pitch;
        bar(rails,face,-half,half,low,low+.70*scale);
        for(let b=0;b<face.bays;b++){
          const left=-half+b*bay,seed=faceIndex*6007+level*173+b*31;
          const active=level>1&&hash(seed)<.115;
          officeBays++;if(active)litBays++;
          // Four slender panes per structural bay, with suite-wide subtle blinds.
          for(let pane=0;pane<4;pane++){
            const l=left+pane*bay/4+.10,r=left+(pane+1)*bay/4-.10;
            const before=glass.length;
            panel(glass,face,l,r,low+.70*scale,high-.035,-.28);
            const shade=.83+hash(seed+pane)*.17,blind=hash(seed+8)<.10?1.16:1;
            colored(glassColors,(glass.length-before)/3,new THREE.Color().setRGB(shade*blind,shade*blind,shade*blind));windowPanes++;
            if(pane>0)bar(mullions,face,l-.125,l-.07,low+.70*scale,high,-.13,-.31);
            if(active){
              const start=lights.length;
              panel(lights,face,l+.05,r-.05,low+.86*scale,high-.15*scale,-.265);
              const intensity=.32+hash(seed+13)*.33;
              colored(lightColors,(lights.length-start)/3,new THREE.Color().setRGB(intensity,intensity*.77,intensity*.48));
            }
          }
        }
      }
    });
    trussBands.forEach((band,index)=>{
      // Deep dark recess behind the diagonals; no intermediate slab line crosses them.
      panel(recess,face,-half+.25,half-.25,band.low,band.high,-.95);
      bar(trusses[index],face,-half,half,band.low,band.low+.55*scale);
      bar(trusses[index],face,-half,half,band.high-.55*scale,band.high);
      for(let b=0;b<face.bays;b++){
        const left=-half+b*bay+.37,right=-half+(b+1)*bay-.37,middle=(left+right)/2;
        const bottom=band.low+.65*scale,top=band.high-.65*scale;
        // Warren triangles: a pair of slender leaning members per bay, not crossed Xs.
        diagonal(trusses[index],face,[left,bottom],[middle,top],.65*scale);
        diagonal(trusses[index],face,[middle,top],[right,bottom],.65*scale);
        // Recessed narrow glazing remains visible behind the open structural cage.
        for(let pane=1;pane<4;pane++){
          const u=-half+(b+pane/4)*bay;
          bar(mullions,face,u-.035,u+.035,band.low+.55*scale,band.high-.55*scale,-.82,-.98);
        }
      }
    });
    // Roof set 2.5 metres down inside the crown: the parapet remains at 601 feet.
    const roofY=height-2.5*scale;
    bar(recess,face,-half+.8,half-.8,roofY,height-.75*scale,-1.0,-1.25);
  });
  const y=height-2.5*scale,x=width/2-.85,z=depth/2-.85;
  quad(roof,[-x,y,z],[x,y,z],[x,y,-z],[-x,y,-z]);
  quad(roof,[-width/2,0,-depth/2],[width/2,0,-depth/2],[width/2,0,depth/2],[-width/2,0,depth/2]);
  // Low rooftop mechanical enclosure is invisible from most street-level views.
  const mechanicalHeight=.75*scale;
  for(const face of faces){const insetFace={...face,span:face.span*.46,offset:face.offset*.46};bar(roof,insetFace,-insetFace.span/2,insetFace.span/2,y,y+mechanicalHeight,0,-.18);}
  quad(roof,[-width*.23,y+mechanicalHeight,depth*.23],[width*.23,y+mechanicalHeight,depth*.23],[width*.23,y+mechanicalHeight,-depth*.23],[-width*.23,y+mechanicalHeight,-depth*.23]);
  root.add(mesh('usb-dark-neutral-glazing',glass,windowMaterial,glassColors));
  root.add(mesh('usb-white-horizontal-floor-rails',rails,aluminum));
  root.add(mesh('usb-white-structural-jambs',jambs,aluminum));
  root.add(mesh('usb-slender-pane-mullions',mullions,new THREE.MeshStandardMaterial({color:0x9caaa5,metalness:.55,roughness:.4})));
  root.add(mesh('usb-recessed-truss-and-mechanical-screen',recess,darkMaterial));
  trusses.forEach((positions,index)=>{
    const band=trussBands[index],group=new THREE.Group();group.name=`usb-${band.name}-truss-band`;group.userData={...band};
    group.add(mesh(`usb-${band.name}-white-diagonal-frame`,positions,aluminum));root.add(group);
  });
  root.add(mesh('usb-recessed-roof-and-foundation',roof,new THREE.MeshStandardMaterial({color:0x656964,roughness:.92})));
  const lightMaterial=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
  const occupied=mesh('usb-occupied-office-windows',lights,lightMaterial,lightColors);occupied.castShadow=false;root.add(occupied);
  root.userData.setLightingMode=(mode:UsBankLightingMode)=>{occupied.visible=mode!=='day';lightMaterial.color.setScalar(mode==='sunset'?.13:mode==='night'?.55:0);};
  root.userData.setLightingMode('day');
  root.userData.dimensions={width,depth,height,stories:42,broadBays:8,endBays:5,panesPerBay:4,trussBands};
  root.userData.offices={groups:officeBays,litGroups:litBays,panels:windowPanes};
  root.userData.signAnchors=faces.map(face=>({face:face.name,position:point(face,0,(trussBands[2].low+height)/2,.12),rotationY:Math.atan2(face.normal[0],face.normal[1]),width:face.span*(1-2/face.bays)-.7,height:5.8*scale}));
  return root;
}
