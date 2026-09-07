import * as THREE from 'three';

export interface NightWindowUniforms {
  uNight: { value: number };
}

/** Adds sparse, stable procedural window light to vertical building faces. */
export function patchNightWindows(mat: THREE.Material, uniforms: NightWindowUniforms): void {
  const previousCompile = mat.onBeforeCompile;
  const previousCacheKey = mat.customProgramCacheKey.bind(mat);

  mat.onBeforeCompile = (shader, renderer) => {
    previousCompile.call(mat, shader, renderer);
    shader.uniforms.uNight = uniforms.uNight;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vWindowPos;\nvarying vec3 vWindowNormal;',
      )
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\n// Object-space geometry is unaffected by the city height exaggeration.\nvWindowPos = transformed;\nvWindowNormal = normalize(objectNormal);',
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWindowPos;
varying vec3 vWindowNormal;
uniform float uNight;

float windowHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
if (uNight > 0.0 && abs(vWindowNormal.y) < 0.45) {
  float facadeX = abs(vWindowNormal.x) > abs(vWindowNormal.z)
    ? vWindowPos.z
    : vWindowPos.x;
  vec2 grid = vec2(facadeX / 3.2, vWindowPos.y / 3.4);
  vec2 cell = floor(grid);
  vec2 uv = fract(grid);
  vec2 aa = fwidth(grid);

  vec2 insideLow = smoothstep(vec2(0.23, 0.2) - aa, vec2(0.23, 0.2) + aa, uv);
  vec2 insideHigh = 1.0 - smoothstep(vec2(0.77, 0.74) - aa, vec2(0.77, 0.74) + aa, uv);
  float pane = insideLow.x * insideLow.y * insideHigh.x * insideHigh.y;

  // These broad spatial bands only break up merged tile geometry; they are not
  // building identities. Most bands stay dark, while lit suites share a small
  // three-window, two-floor pattern with a few individual exceptions.
  float facadeDepth = abs(vWindowNormal.x) > abs(vWindowNormal.z)
    ? vWindowPos.x
    : vWindowPos.z;
  float surfaceBand = floor(facadeDepth / 16.0)
    + (abs(vWindowNormal.x) > abs(vWindowNormal.z) ? 17.0 : 43.0);
  vec2 darkZone = floor(vec2(cell.x / 9.0, cell.y / 6.0));
  vec2 suite = floor(vec2(cell.x / 3.0, cell.y / 2.0));

  float zoneChance = windowHash(vec3(darkZone + 31.0, surfaceBand));
  float suiteChance = windowHash(vec3(suite + 73.0, surfaceBand * 1.7));
  float cellChance = windowHash(vec3(cell.yx + 19.0, surfaceBand * 2.3));
  float isolatedChance = windowHash(vec3(cell + 127.0, surfaceBand * 3.1));

  float activeZone = step(0.58, zoneChance);
  float suiteLit = step(0.77, suiteChance);
  float individualKeep = step(0.12, cellChance);
  float isolatedLight = step(0.965, isolatedChance);
  float lit = activeZone * max(suiteLit * individualKeep, isolatedLight);

  float variation = windowHash(vec3(cell + 211.0, surfaceBand * 4.7));
  float rareHighlight = step(0.985, windowHash(vec3(cell.yx + 307.0, surfaceBand * 5.3)));
  float brightness = mix(0.58, 0.72, variation) + rareHighlight * 0.16;

  // Suppress sub-pixel panes as the camera pulls back so the skyline stays calm.
  float distanceFade = 1.0 - smoothstep(0.18, 0.48, max(aa.x, aa.y));
  distanceFade *= distanceFade;
  vec3 softAmber = vec3(1.0, 0.74, 0.50);
  vec3 warmWhite = vec3(1.0, 0.88, 0.68);
  vec3 windowColor = mix(softAmber, warmWhite, 0.3 + variation * 0.45);
  totalEmissiveRadiance += windowColor * pane * lit * brightness * distanceFade * uNight * 0.50;
}`,
      );
  };

  mat.customProgramCacheKey = () => `${previousCacheKey()}|natural-night-windows-v2`;
  mat.needsUpdate = true;
}
