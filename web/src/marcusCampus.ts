import * as THREE from 'three';
import {buildMarcusCenter} from './marcusCenter.ts';
import {buildMarcusLandscape} from './marcusLandscape.ts';
import {buildMarcusGarage} from './marcusGarage.ts';

export function buildMarcusCampus(groundAt:(x:number,z:number)=>number){
 const root=new THREE.Group();root.name='marcus-campus';
 root.add(buildMarcusCenter(groundAt),buildMarcusLandscape(groundAt),buildMarcusGarage(groundAt));
 root.userData.setLightingMode=(mode:'day'|'sunset'|'night')=>root.children.forEach(child=>child.userData.setLightingMode?.(mode));
 root.userData.setLightingMode('day');return root;
}
