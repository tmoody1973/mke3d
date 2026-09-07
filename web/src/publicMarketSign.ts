import * as THREE from 'three';
import type { PublicMarketLightingMode } from './publicMarket';

/** Typeset neon name, inspired by the west entrance; no reference-photo pixels. */
export function addPublicMarketSign(model: THREE.Group): void {
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.width = 2048; canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '110px "Arial Narrow", Arial, sans-serif';
  ctx.strokeStyle = '#fa7467'; ctx.fillStyle = '#c52d28'; ctx.lineWidth = 6;
  const name = 'MILWAUKEE PUBLIC MARKET';
  ctx.translate(1024, 82);
  ctx.scale(1960 / ctx.measureText(name).width, 1);
  ctx.fillText(name, 0, 0);
  ctx.strokeText(name, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshStandardMaterial({
    map: texture, transparent: true, alphaTest: .05, depthWrite: false,
    roughness: .55, emissive: 0xffffff, emissiveMap: texture,
    emissiveIntensity: .12, side: THREE.DoubleSide,
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(32, 3), material);
  sign.name = 'west-entrance-red-neon-market-name';
  sign.position.set(-38.6, 11.3, -1); sign.rotation.y = -Math.PI / 2;
  model.add(sign);
  const updateLighting = model.userData.setLightingMode;
  model.userData.setLightingMode = (mode: PublicMarketLightingMode) => {
    updateLighting?.(mode);
    material.emissiveIntensity = mode === 'night' ? 1.6 : mode === 'sunset' ? 1.0 : .12;
  };
}
