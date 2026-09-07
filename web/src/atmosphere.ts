import * as THREE from 'three';

export interface SkyPalette {
  zenith: number; horizon: number; west: number; glow: number;
}

// Shared by the visible sky and water: west is -x in the city's projection.
const SKY_GLSL = `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uWest;
  uniform float uGlow;
  vec3 skyColor(vec3 direction) {
    float height = clamp(direction.y, 0.0, 1.0);
    vec3 sky = mix(uHorizon, uZenith, pow(height, 0.48));
    float west = pow(max(-direction.x, 0.0), 5.0);
    float haze = exp(-height * 7.0) * smoothstep(0.0, 0.08, height) * west * uGlow;
    return mix(sky, uWest, haze);
  }
`;

export function createAtmosphere(scene: THREE.Scene, water: THREE.MeshPhongMaterial) {
  const uniforms = {
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uWest: { value: new THREE.Color() },
    uGlow: { value: 0 },
    uTime: { value: 0 },
  };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(70000, 32, 16), new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec3 vDirection;
      void main() {
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `${SKY_GLSL}
      varying vec3 vDirection;
      void main() {
        gl_FragColor = vec4(skyColor(normalize(vDirection)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,
  }));
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  // A sky reflection, not a screen-space reflection of buildings. The tiny
  // normal perturbations keep the lake from looking like a flat painted plane.
  water.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWaterWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWaterWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${SKY_GLSL}\nuniform float uTime; varying vec3 vWaterWorld;`)
      .replace('#include <opaque_fragment>', `
        vec3 waveNormal = normalize(vec3(
          0.009 * sin(vWaterWorld.x * 0.065 + vWaterWorld.z * 0.09 + uTime * 0.3),
          1.0,
          0.006 * sin(vWaterWorld.z * 0.11 - vWaterWorld.x * 0.04 + uTime * 0.23)));
        vec3 eye = normalize(cameraPosition - vWaterWorld);
        vec3 reflection = reflect(-eye, waveNormal);
        reflection.y = abs(reflection.y);
        float fresnel = 0.035 + 0.7 * pow(1.0 - max(dot(eye, waveNormal), 0.0), 5.0);
        outgoingLight = mix(outgoingLight, skyColor(reflection) * 0.65, fresnel);
        #include <opaque_fragment>
      `);
  };
  water.customProgramCacheKey = () => 'lake-sky-reflection-v1';
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    setPalette(palette: SkyPalette) {
      uniforms.uZenith.value.set(palette.zenith);
      uniforms.uHorizon.value.set(palette.horizon);
      uniforms.uWest.value.set(palette.west);
      uniforms.uGlow.value = palette.glow;
    },
    update(camera: THREE.Camera, dt: number) {
      sky.position.copy(camera.position);
      if (!reduceMotion) uniforms.uTime.value += Math.min(dt, 0.1);
    },
  };
}
