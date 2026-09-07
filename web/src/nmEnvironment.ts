import * as THREE from 'three';

// Original low-frequency sky colors for local glass reflections. No panorama,
// source photography or invented reflected buildings are included.
const maps = new Map<string,THREE.DataTexture>();
function skyMap(mode:string) {
  if(maps.has(mode))return maps.get(mode)!;
  const w=256,h=128,pixels=new Uint8Array(w*h*4);
  const night=mode==='night',sunset=mode==='sunset';
  const zenith=new THREE.Color(night?0x1e314a:sunset?0x728eaf:0x88b6d4);
  const horizon=new THREE.Color(night?0x405063:sunset?0xe9c5a4:0xe2e8e8);
  const ground=new THREE.Color(night?0x161e27:sunset?0x7a7975:0x8b9ca3);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const latitude=y/(h-1),upper=latitude>=.5;
    const t=upper?Math.pow((latitude-.5)*2,.55):Math.pow((.5-latitude)*2,.3);
    const color=horizon.clone().lerp(upper?zenith:ground,t);
    const cloud=upper&&!night?.04*Math.pow(Math.max(0,Math.sin(x/w*Math.PI*6+latitude*17)),8):0;
    color.lerp(new THREE.Color(0xe8eded),cloud).convertLinearToSRGB();
    const i=(y*w+x)*4;pixels[i]=color.r*255;pixels[i+1]=color.g*255;pixels[i+2]=color.b*255;pixels[i+3]=255;
  }
  const texture=new THREE.DataTexture(pixels,w,h);texture.colorSpace=THREE.SRGBColorSpace;
  texture.mapping=THREE.EquirectangularReflectionMapping;texture.needsUpdate=true;
  maps.set(mode,texture);return texture;
}

export function nmGlassReflections(root:THREE.Group):(mode:string)=>void {
  const materials=new Set<THREE.MeshStandardMaterial>();
  root.traverse(object=>{
    if(!(object instanceof THREE.Mesh))return;
    for(const material of Array.isArray(object.material)?object.material:[object.material]){
      if(material instanceof THREE.MeshStandardMaterial && material.metalness>.2)materials.add(material);
    }
  });
  return(mode:string)=>{
    const map=skyMap(mode);
    for(const material of materials){material.envMap=map;material.envMapIntensity=mode==='night'?.22:mode==='sunset'?.75:1;material.needsUpdate=true;}
  };
}
