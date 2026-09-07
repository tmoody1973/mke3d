import * as THREE from 'three';

export interface HoanLightPath {
  kind: 'arch' | 'hanger' | 'deck';
  points: [number, number, number][];
  side: -1 | 1;
}

export type HoanLightingMode = 'day' | 'sunset' | 'night';

const BLUE = new THREE.Color(0x409aff);
const GOLD = new THREE.Color(0xffbb55);
const MAX_NODES = 3000;

function validPoint(point: [number, number, number]) {
  return point.length === 3 && point.every(Number.isFinite);
}

function pathLength(points: THREE.Vector3[]) {
  let length = 0;
  for (let i = 1; i < points.length; i++) length += points[i].distanceTo(points[i - 1]);
  return length;
}

function samplesAlong(points: THREE.Vector3[], spacing: number) {
  const total = pathLength(points);
  if (total <= 0) return points.slice(0, 1);
  const count = Math.max(2, Math.floor(total / spacing) + 1);
  const samples: THREE.Vector3[] = [];
  let segment = 1;
  let segmentStart = 0;
  for (let i = 0; i < count; i++) {
    const target = total * i / (count - 1);
    while (segment < points.length - 1) {
      const length = points[segment].distanceTo(points[segment - 1]);
      if (segmentStart + length >= target) break;
      segmentStart += length;
      segment++;
    }
    const a = points[segment - 1];
    const b = points[segment];
    const length = a.distanceTo(b);
    samples.push(a.clone().lerp(b, length > 0 ? (target - segmentStart) / length : 0));
  }
  return samples;
}

/** Architectural LED accents for the bridge. Contains emissive geometry, never scene lights. */
export function createHoanLighting(paths: HoanLightPath[]) {
  const group = new THREE.Group();
  group.name = 'hoan-architectural-lighting';

  const linePositions: number[] = [];
  const lineColors: number[] = [];
  const nodeCandidates: { position: THREE.Vector3; color: THREE.Color; side: -1 | 1 }[] = [];

  for (const path of paths) {
    if (path.points.length < 2 || !path.points.every(validPoint)) continue;
    const points = path.points.map(point => new THREE.Vector3(...point));
    const color = path.kind === 'hanger' ? GOLD : BLUE;
    // Deck fixtures are discrete; arch and hanger LEDs also get a continuous luminous core.
    if (path.kind !== 'deck') {
      for (let i = 1; i < points.length; i++) {
        linePositions.push(...points[i - 1].toArray(), ...points[i].toArray());
        lineColors.push(...color.toArray(), ...color.toArray());
      }
    }
    const spacing = path.kind === 'deck' ? 8 : 1.3;
    for (const position of samplesAlong(points, spacing)) nodeCandidates.push({ position, color, side: path.side });
  }

  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
  lineGeometry.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
  const uniforms = {
    uIntensity: { value: 0 },
    uPointScale: { value: 14 },
    uTime: { value: 0 },
  };
  // A continuous color ribbon moves along the span; no flashing or extra lights.
  const animation = `
    uniform float uTime;
    uniform float uIntensity;
    varying vec3 vColor;
    varying float vPhase;
    vec3 ribbonColor() {
      float wave = 0.5 + 0.5 * sin(vPhase - uTime * 0.7);
      float shimmer = 0.78 + 0.22 * wave;
      vec3 accent = mix(vec3(0.04, 0.75, 1.0), vec3(0.65, 0.12, 1.0), wave);
      return mix(vColor, accent, 0.9) * shimmer * uIntensity;
    }
  `;
  const lineMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      varying vec3 vColor;
      varying float vPhase;
      void main() {
        vColor = color;
        vPhase = position.x * 0.035 + position.y * 0.012;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: animation + `
      void main() {
        gl_FragColor = vec4(ribbonColor(), 0.95);
        #include <colorspace_fragment>
      }
    `,
    vertexColors: true,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
  const cores = new THREE.LineSegments(lineGeometry, lineMaterial);
  cores.name = 'hoan-led-emissive-cores';
  cores.frustumCulled = false;
  group.add(cores);

  // Evenly thin the complete candidate list so long approaches cannot consume the cap.
  const selected = nodeCandidates.length <= MAX_NODES ? nodeCandidates : Array.from(
    { length: MAX_NODES }, (_, i) => nodeCandidates[Math.floor(i * nodeCandidates.length / MAX_NODES)],
  );
  const pointPositions: number[] = [];
  const pointColors: number[] = [];
  const pointSides: number[] = [];
  for (const node of selected) {
    pointPositions.push(...node.position.toArray());
    pointColors.push(...node.color.toArray());
    pointSides.push(node.side);
  }
  const pointGeometry = new THREE.BufferGeometry();
  pointGeometry.setAttribute('position', new THREE.Float32BufferAttribute(pointPositions, 3));
  pointGeometry.setAttribute('color', new THREE.Float32BufferAttribute(pointColors, 3));
  pointGeometry.setAttribute('side', new THREE.Float32BufferAttribute(pointSides, 1));
  const pointMaterial = new THREE.ShaderMaterial({
    uniforms,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
    vertexShader: `
      uniform float uPointScale;
      varying vec3 vColor;
      varying float vPhase;
      void main() {
        vColor = color;
        vPhase = position.x * 0.035 + position.y * 0.012;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = clamp(uPointScale * (300.0 / max(1.0, -mvPosition.z)), 2.2, 18.0);
      }
    `,
    fragmentShader: animation + `
      void main() {
        float radius = length(gl_PointCoord - vec2(0.5));
        float glow = 1.0 - smoothstep(0.08, 0.5, radius);
        float core = 1.0 - smoothstep(0.0, 0.14, radius);
        float alpha = min(0.95, 0.8 * glow + 0.9 * core);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(ribbonColor() * (0.8 + 0.35 * core), alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const nodes = new THREE.Points(pointGeometry, pointMaterial);
  nodes.name = 'hoan-led-fixture-nodes';
  nodes.frustumCulled = false;
  group.add(nodes);

  let intensity = 1;
  const setMode = (mode: HoanLightingMode) => {
    intensity = mode === 'day' ? 0 : mode === 'sunset' ? 1.25 : 2.2;
    group.visible = mode !== 'day';
    uniforms.uIntensity.value = intensity;
    group.userData.mode = mode;
    group.userData.intensity = intensity;
  };
  const update = (seconds: number, reducedMotion = false) => {
    if (!group.visible) return;
    uniforms.uTime.value = reducedMotion || !Number.isFinite(seconds) ? 0 : Math.max(0, seconds);
  };
  const dispose = () => {
    lineGeometry.dispose();
    pointGeometry.dispose();
    lineMaterial.dispose();
    pointMaterial.dispose();
  };

  group.userData.uniforms = uniforms;
  group.userData.nodeCount = selected.length;
  group.userData.drawCalls = 2;
  setMode('day');
  return { group, setMode, update, dispose };
}
