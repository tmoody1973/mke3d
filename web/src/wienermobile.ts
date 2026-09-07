import * as THREE from 'three';

export type WienermobileMode = 'day' | 'sunset' | 'night';

const LENGTH = 8.2296, WIDTH = 2.4384, HEIGHT = 3.3528;
const MATERIALS = {
  orange: new THREE.MeshStandardMaterial({ color: 0xf04a18, roughness: .3, metalness: .05 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xffc915, roughness: .32, metalness: .04 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x111416, roughness: .25, metalness: .15 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x17242b, roughness: .14, metalness: .18, emissive: 0x8bb6c5 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xb9c1c4, roughness: .18, metalness: .82 }),
  red: new THREE.MeshStandardMaterial({ color: 0xa81712, roughness: .25, emissive: 0xff1808 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf1f4e9, roughness: .18, emissive: 0xffffdc }),
  amber: new THREE.MeshStandardMaterial({ color: 0xff7a00, roughness: .25, emissive: 0xff5500 }),
};

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, name: string) {
  const value = new THREE.Mesh(geometry, material); value.name = name; value.castShadow = true; value.receiveShadow = true; return value;
}

/** A self-contained modern Oscar Mayer Wienermobile. Origin is tire contact, forward is -Z. */
export function buildWienermobile(): THREE.Group {
  const { orange, yellow, dark, glass, chrome, red, white, amber } = Object.fromEntries(
    Object.entries(MATERIALS).map(([key, material]) => [key, material.clone()]),
  ) as typeof MATERIALS;
  const root = new THREE.Group(); root.name = 'wienermobile';
  // Yellow lower bun / chassis: capsule's native long axis is Y, rotated onto Z.
  const bun = mesh(new THREE.CapsuleGeometry(WIDTH / 2, LENGTH - WIDTH, 8, 24), yellow, 'wienermobile-yellow-bun');
  bun.rotation.x = Math.PI / 2; bun.scale.z = .66; bun.position.y = WIDTH * .33; root.add(bun);
  // The photographed lower body ends in broad, blunt bumper pods rather than
  // following the bun capsule to a point. These fairings support the lamps.
  for (const end of [-1, 1]) {
    const fairing = mesh(new THREE.CapsuleGeometry(.36, 1.56, 6, 20), yellow, end < 0 ? 'wienermobile-front-fairing' : 'wienermobile-rear-fairing');
    fairing.rotation.z = Math.PI / 2; fairing.scale.y = .82; fairing.position.set(0, 1.12, end * 3.74); root.add(fairing);
  }

  // The hot dog is deliberately asymmetric in placement: its rounded rear projects over the bun.
  const dog = mesh(new THREE.CapsuleGeometry(.91, 5.72, 10, 28), orange, 'wienermobile-orange-sausage');
  dog.rotation.x = Math.PI / 2; dog.scale.y = .98; dog.position.set(0, 2.461, .36); root.add(dog);
  const band = mesh(new THREE.CylinderGeometry(.925, .925, .94, 28, 1, true), yellow, 'wienermobile-bun-band');
  band.rotation.x = Math.PI / 2; band.position.set(0, 2.461, 2.57); band.scale.y = .98; root.add(band);

  // Black wraparound cab: windshield plus four side window bays per side.
  const windshield = mesh(new THREE.SphereGeometry(.82, 20, 12, 0, Math.PI * 2, .12, 1.05), glass, 'wienermobile-windshield');
  windshield.scale.set(.93, .79, .25); windshield.position.set(0, 2.56, -3.27); windshield.rotation.x = -.12; root.add(windshield);
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const window = mesh(new THREE.BoxGeometry(.025, .61 - i * .025, .69), glass, `wienermobile-side-window-${side}-${i}`);
    window.position.set(side * (.865 + i * .008), 2.57 + i * .015, -2.67 + i * .76); window.rotation.z = side * -.06; root.add(window);
  }
  // Window pillars and mirrors make the cab read at street-view scale.
  for (const side of [-1, 1]) {
    const mirror = mesh(new THREE.SphereGeometry(.14, 10, 8), dark, `wienermobile-mirror-${side}`);
    mirror.scale.set(.55, 1, .72); mirror.position.set(side * 1.04, 2.42, -2.55); root.add(mirror);
  }

  const wheels: THREE.Mesh[] = [], steerPivots: THREE.Group[] = [];
  const wheelRadius = .43;
  for (const z of [-2.47, 2.55]) for (const side of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.name = z < 0 ? `wienermobile-front-steer-${side}` : `wienermobile-rear-wheel-mount-${side}`;
    pivot.position.set(side * 1.08, wheelRadius, z); root.add(pivot);
    const tire = mesh(new THREE.CylinderGeometry(wheelRadius, wheelRadius, .25, 20), dark, `wienermobile-wheel-${z < 0 ? 'front' : 'rear'}-${side}`);
    tire.rotation.z = Math.PI / 2; pivot.add(tire); wheels.push(tire); if (z < 0) steerPivots.push(pivot);
    const hub = mesh(new THREE.CylinderGeometry(.22, .22, .262, 16), chrome, `wienermobile-hub-${z}-${side}`);
    hub.rotation.z = Math.PI / 2; pivot.add(hub);
  }
  // Wheel-well eyebrows visually cut the tires into the yellow body.
  for (const z of [-2.47, 2.55]) for (const side of [-1, 1]) {
    const brow = mesh(new THREE.TorusGeometry(.51, .075, 8, 18, Math.PI), yellow, `wienermobile-wheelwell-${z}-${side}`);
    brow.position.set(side * 1.14, .585, z); brow.rotation.set(0, Math.PI / 2, side > 0 ? 0 : Math.PI); root.add(brow);
  }

  const grille = mesh(new THREE.SphereGeometry(.65, 16, 8), dark, 'wienermobile-front-grille');
  grille.scale.set(1.22, .28, .10); grille.position.set(0, .94, -4.045); root.add(grille);
  const lampMaterials: THREE.MeshStandardMaterial[] = [];
  for (const side of [-1, 1]) {
    const head = mesh(new THREE.BoxGeometry(.48, .18, .055), white, `wienermobile-headlamp-${side}`); head.position.set(side * .82, 1.30, -4.08); root.add(head);
    const marker = mesh(new THREE.BoxGeometry(.24, .10, .06), amber, `wienermobile-front-marker-${side}`); marker.position.set(side * .83, .97, -4.08); root.add(marker);
    const tail = mesh(new THREE.BoxGeometry(.48, .19, .055), red, `wienermobile-taillamp-${side}`); tail.position.set(side * .78, 1.25, 4.08); root.add(tail);
  }
  lampMaterials.push(white, amber, red);

  // Geometric Oscar Mayer badge; layered plaque remains legible without DOM/canvas textures.
  for (const side of [-1, 1]) {
    const badge = new THREE.Group(); badge.name = `oscar-mayer-badge-${side}`; badge.position.set(side * .925, 2.48, 2.16); badge.rotation.y = side * Math.PI / 2;
    const badgeRed = red.clone(); badgeRed.emissiveIntensity = 0;
    const badgeWhite = white.clone(); badgeWhite.emissiveIntensity = 0;
    const frame = mesh(new THREE.BoxGeometry(.56, .54, .035), badgeRed, 'oscar-mayer-red-frame');
    const face = mesh(new THREE.BoxGeometry(.47, .45, .045), badgeWhite, 'oscar-mayer-white-label'); face.position.z = .025;
    const o = mesh(new THREE.TorusGeometry(.09, .022, 6, 12), badgeRed, 'oscar-mayer-o'); o.position.set(-.11, .02, .056);
    const m = new THREE.Group(); m.name = 'oscar-mayer-m'; m.position.set(.11, .02, .056);
    for (const [x, rotation] of [[-.07, 0], [0, -.58], [.07, 0]] as const) {
      const stroke = mesh(new THREE.BoxGeometry(.025, .19, .022), badgeRed, 'oscar-mayer-m-stroke'); stroke.position.x = x; stroke.rotation.z = rotation; m.add(stroke);
    }
    badge.add(frame, face, o, m); root.add(badge);
  }

  let roll = 0;
  root.userData.animateWheels = (distance: number, steer: number) => {
    roll -= distance / wheelRadius;
    wheels.forEach(wheel => { wheel.rotation.x = roll; });
    const steeringYaw = -THREE.MathUtils.clamp(steer, -.62, .62);
    steerPivots.forEach(pivot => { pivot.rotation.y = steeringYaw; });
    root.userData.wheelRotation = roll; root.userData.steer = steeringYaw;
  };
  root.userData.setMode = (mode: WienermobileMode, braking = false) => {
    root.userData.mode = mode; root.userData.braking = braking;
    glass.emissiveIntensity = mode === 'night' ? .16 : mode === 'sunset' ? .06 : 0;
    white.emissiveIntensity = mode === 'night' ? 2.2 : mode === 'sunset' ? .5 : 0;
    amber.emissiveIntensity = mode === 'night' ? .8 : mode === 'sunset' ? .25 : 0;
    red.emissiveIntensity = braking ? 3 : mode === 'night' ? 1.3 : mode === 'sunset' ? .3 : 0;
  };
  root.userData.forwardAxis = '-Z'; root.userData.dimensionsM = { length: LENGTH, width: WIDTH, height: HEIGHT };
  root.userData.setMode('day');
  return root;
}
