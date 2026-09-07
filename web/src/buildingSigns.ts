import * as THREE from 'three';
import type { TileInfo } from './geo';
import type { Mode } from './scene';

export interface BuildingSign {
  name: string;
  center: [number, number]; // local x/z, inside the tower footprint
  face: [number, number]; // outward x/z direction
  logo: string;
  width: number;
  height: number;
  belowRoof: number;
  backing?: number;
}

/** Finds the actual rendered facade instead of guessing a sign's height or floating it nearby. */
export function mountOnFacade(building: THREE.Mesh, spec: BuildingSign) {
  const center = new THREE.Vector3(spec.center[0], 1000, spec.center[1]);
  const roof = new THREE.Raycaster(center, new THREE.Vector3(0, -1, 0)).intersectObject(building)[0];
  if (!roof) return null;
  center.y = roof.point.y - spec.belowRoof;
  const outward = new THREE.Vector3(spec.face[0], 0, spec.face[1]).normalize();
  const origin = center.clone().addScaledVector(outward, 100);
  const walls = new THREE.Raycaster(origin, outward.clone().negate(), 0, 100).intersectObject(building);
  const wall = walls.filter(hit => hit.face && hit.face.normal.dot(outward) > 0.85)
    .sort((a, b) => b.distance - a.distance)[0];
  if (!wall?.face) return null;
  const normal = wall.face.normal.clone().normalize();
  // Check both ends land on the same facade before attaching a wide sign.
  const across = new THREE.Vector3(normal.z, 0, -normal.x);
  for (const offset of [-spec.width / 2, spec.width / 2]) {
    const edge = wall.point.clone().addScaledVector(across, offset).addScaledVector(normal, 1);
    const hits = new THREE.Raycaster(edge, normal.clone().negate(), 0, 1.2).intersectObject(building);
    if (!hits.length) return null;
  }
  return { position: wall.point.clone().addScaledVector(normal, 0.18), normal };
}

export class BuildingSigns {
  private materials = new Map<string, THREE.MeshLambertMaterial>();
  private backings = new Map<number, THREE.MeshLambertMaterial>();
  private night = 0;
  private specs: BuildingSign[];
  private tileSize: number;
  private assetBase: string;

  constructor(specs: BuildingSign[], tileSize: number, assetBase: string) {
    this.specs = specs; this.tileSize = tileSize; this.assetBase = assetBase;
  }

  private logoMaterial(logo: string) {
    let material = this.materials.get(logo);
    if (material) return material;
    material = new THREE.MeshLambertMaterial({
      color: 0xffffff, emissive: 0xffffff, emissiveIntensity: this.night * 0.65,
      transparent: true, alphaTest: 0.08, depthWrite: false,
    });
    material.visible = false;
    const loadedMaterial = material;
    new THREE.ImageLoader().load(`${this.assetBase}/${logo}`, image => {
      // Rasterize vector assets at sign resolution before uploading to WebGL.
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = Math.max(1, Math.round(1024 * image.height / image.width));
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      loadedMaterial.map = texture;
      loadedMaterial.emissiveMap = texture;
      loadedMaterial.needsUpdate = true;
      loadedMaterial.visible = true;
    }, undefined, () => console.warn(`Building sign asset unavailable: ${logo}`));
    this.materials.set(logo, material);
    return material;
  }

  setMode(mode: Mode) {
    this.night = mode === 'night' ? 1 : mode === 'sunset' ? 0.15 : 0;
    for (const material of this.materials.values()) material.emissiveIntensity = this.night * 0.65;
    for (const material of this.backings.values()) material.emissiveIntensity = this.night * 0.14;
  }

  attach(group: THREE.Group, tile: TileInfo, lod: boolean) {
    // A simplified footprint can move a wall. Signs return with the full tile.
    if (lod) return;
    const building = group.getObjectByName('BLDG') as THREE.Mesh | undefined;
    if (!building) return;
    building.updateMatrixWorld(true);
    for (const spec of this.specs) {
      if (Math.floor(spec.center[0] / this.tileSize) !== tile.i || Math.floor(-spec.center[1] / this.tileSize) !== tile.j) continue;
      const mount = mountOnFacade(building, spec);
      if (!mount) continue;
      const sign = new THREE.Group();
      sign.name = spec.name;
      sign.position.copy(mount.position);
      sign.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), mount.normal);
      if (spec.backing !== undefined) {
        let material = this.backings.get(spec.backing);
        if (!material) {
          material = new THREE.MeshLambertMaterial({
            color: spec.backing, emissive: spec.backing, emissiveIntensity: this.night * 0.14,
          });
          this.backings.set(spec.backing, material);
        }
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(spec.width + 1, spec.height + 1), material);
        sign.add(panel);
      }
      const logo = new THREE.Mesh(new THREE.PlaneGeometry(spec.width, spec.height), this.logoMaterial(spec.logo));
      logo.position.z = 0.03;
      sign.add(logo);
      group.add(sign);
    }
  }
}
