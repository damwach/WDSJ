import { aerodynamicForces, AIR_DENSITY } from '../physics/aerodynamics';

/** A stationary wind-tunnel specimen is equivalent to a jumper moving
 * through still air at the same relative velocity. All values use SI units.
 * This is a diagnostic of the game's reduced-order model, NOT CFD. */
export interface TunnelSettings {
  speed: number;             // m/s, relative flow speed
  incidenceDeg: number;      // ski/root pitch relative to the flow
  bodyLeanDeg: number;       // trunk angle from local vertical
  vHalfAngleDeg: number;     // half-angle of the V, for each ski
  density: number;           // kg/m^3
}

export const DEFAULT_TUNNEL_SETTINGS: TunnelSettings = {
  speed: 27, incidenceDeg: 10, bodyLeanDeg: 73,
  vHalfAngleDeg: 10, density: AIR_DENSITY,
};

const degToRad = Math.PI / 180;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export function sampleTunnel(settings: TunnelSettings) {
  const speed = clamp(settings.speed, 0, 60);
  const density = clamp(settings.density, 0, 1.5);
  const incidence = clamp(settings.incidenceDeg, -25, 45) * degToRad;
  const bodyLean = clamp(settings.bodyLeanDeg, 50, 86) * degToRad;
  const vHalfAngle = clamp(settings.vHalfAngleDeg, 0, 14.3) * degToRad;
  // Shared with actual flight physics: no separate 'laboratory' coefficients.
  const result = aerodynamicForces({
    velocity: { x: speed, y: 0, z: 0 },
    wind: { x: 0, y: 0, z: 0 },
    pitch: incidence, roll: 0, omega: 0,
    bodyLean, vAngle: vHalfAngle,
  }, { density });
  const liftVertical = result.lift.y;
  const dragLongitudinal = speed === 0 ? 0 : -result.drag.x;
  return {
    ...result,
    liftVertical,
    dragLongitudinal,
    // Signed vertical lift-to-drag for the specified horizontal flow.
    ratio: dragLongitudinal > 1e-8 ? liftVertical / dragLongitudinal : 0,
  };
}

export function sweepIncidence(settings: TunnelSettings, min = -10, max = 30, step = 1) {
  if (!(step > 0) || max < min || (max - min) / step > 400) throw new Error('Invalid tunnel sweep');
  const rows: { angle: number; lift: number; drag: number; ratio: number }[] = [];
  for (let a = min; a <= max + 1e-8; a += step) {
    const measured = sampleTunnel({ ...settings, incidenceDeg: a });
    rows.push({ angle: a, lift: measured.liftVertical,
      drag: measured.dragLongitudinal, ratio: measured.ratio });
  }
  return rows;
}
