export interface DriveState {
  x: number; y: number; z: number; yaw: number;
  speed: number; steer: number; distance: number;
}

export interface DriveInput {
  throttle: number;
  /** -1 turns left, +1 turns right. */
  steer: number;
  brake: boolean;
}

export type DriveResolver = (previous: DriveState, next: DriveState) => {
  x: number; y: number; z: number; blocked: boolean;
};

const MAX_FORWARD = 16;
const MAX_REVERSE = 4;
const WHEELBASE = 5;
const MAX_STEER = Math.PI * 27 / 180;

export function createDriveState(x: number, y: number, z: number, yaw = 0): DriveState {
  return { x, y, z, yaw, speed: 0, steer: 0, distance: 0 };
}

function approach(value: number, target: number, amount: number) {
  return value < target ? Math.min(target, value + amount) : Math.max(target, value - amount);
}

/** Mutates state. Large render-frame deltas are capped and integrated in stable fixed-size slices. */
export function stepDrive(state: DriveState, input: DriveInput, dt: number, resolve: DriveResolver): void {
  let remaining = Math.min(Math.max(Number.isFinite(dt) ? dt : 0, 0), .1);
  const throttle = Math.min(1, Math.max(-1, Number.isFinite(input.throttle) ? input.throttle : 0));
  const steering = Math.min(1, Math.max(-1, Number.isFinite(input.steer) ? input.steer : 0));
  while (remaining > 1e-8) {
    const h = Math.min(remaining, 1 / 60);
    remaining -= h;

    const desiredSteer = steering * MAX_STEER * (1 - .52 * Math.min(1, Math.abs(state.speed) / MAX_FORWARD));
    state.steer += (desiredSteer - state.steer) * (1 - Math.exp(-7 * h));

    if (input.brake) {
      state.speed = approach(state.speed, 0, 13 * h);
    } else if (throttle > 0) {
      // Opposite throttle first acts as a service brake; it cannot reverse in the same substep.
      state.speed = state.speed < 0 ? Math.min(0, state.speed + 11 * h)
        : Math.min(MAX_FORWARD, state.speed + 5.8 * throttle * h);
    } else if (throttle < 0) {
      state.speed = state.speed > 0 ? Math.max(0, state.speed - 11 * h)
        : Math.max(-MAX_REVERSE, state.speed + 3.4 * throttle * h);
    } else {
      // Linear rolling resistance plus quadratic aero drag are nearly frame-rate independent under substeps.
      const drag = 1.05 + .012 * state.speed * state.speed;
      state.speed = approach(state.speed, 0, drag * h);
    }
    if (Math.abs(state.speed) < .015 && throttle === 0) state.speed = 0;

    // Local forward is -Z. Positive world yaw points left; negative input means left.
    const yawStep = -state.speed / WHEELBASE * Math.tan(state.steer) * h;
    const previous = { ...state };
    const nextYaw = state.yaw + yawStep;
    const distance = state.speed * h;
    let next: DriveState = {
      ...state,
      x: state.x - Math.sin(nextYaw) * distance,
      z: state.z - Math.cos(nextYaw) * distance,
      yaw: nextYaw,
      distance: state.distance + Math.abs(distance),
    };
    let result = resolve(previous, next);
    if (result.blocked && Math.abs(yawStep) > 1e-10) {
      // A long body's turning corner can hit a wall even when backing straight
      // away is safe. Keep the wheel angle, but defer the body rotation until
      // there is clearance. The fallback still passes every world collision check.
      const straight: DriveState = {
        ...next, yaw: previous.yaw,
        x: previous.x - Math.sin(previous.yaw) * distance,
        z: previous.z - Math.cos(previous.yaw) * distance,
      };
      const escape = resolve(previous, straight);
      if (!escape.blocked) { result = escape; next = straight; }
    }
    state.x = result.x; state.y = result.y; state.z = result.z;
    if (result.blocked) {
      // Stop at contact. Residual forward speed and repeated steering decay
      // otherwise delay reverse engagement and fight the driver's input.
      state.speed = 0;
    } else {
      state.yaw = next.yaw;
      state.distance = next.distance;
    }
  }
}
