import * as THREE from 'three';

/** Original typesetting, not a photograph or a claim to reproduce the exact logo. */
export function addNMNameSign(tower: THREE.Group): void {
  if (typeof document === 'undefined' || !tower.userData.signAnchor) return;
  const anchor = tower.userData.signAnchor as { position: [number, number, number]; rotationY: number; width: number };
  const canvas = document.createElement('canvas'); canvas.width = 2048; canvas.height = 160;
  const context = canvas.getContext('2d'); if (!context) return;
  context.font = '112px Georgia, serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
  context.fillStyle = '#eef1ed';
  const name = 'Northwestern Mutual';
  context.translate(1024, 80); context.scale(1920 / context.measureText(name).width, 1);
  context.fillText(name, 0, 0);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({ map: texture, transparent: true, alphaTest: .08,
    roughness: .55, depthWrite: false, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: .12 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(anchor.width, anchor.width / 12.8), material);
  sign.name = 'northwestern-mutual-crown-name'; sign.position.set(...anchor.position); sign.rotation.y = anchor.rotationY;
  tower.add(sign);
  const update = tower.userData.setLightingMode;
  tower.userData.setLightingMode = (mode: string) => {
    update?.(mode); material.emissiveIntensity = mode === 'night' ? .45 : mode === 'sunset' ? .25 : .12;
  };
}
