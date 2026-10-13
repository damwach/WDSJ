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

/** Limits of this diagnostic, not new physical limits in the flight solver. */
export const TUNNEL_LIMITS = {
  speed: [0, 60], incidenceDeg: [-25, 45], bodyLeanDeg: [50, 86],
  vHalfAngleDeg: [0, 14.3], density: [0, 1.5],
} as const satisfies Record<keyof TunnelSettings, readonly [number, number]>;

export function normalizeTunnelSettings(settings: TunnelSettings): TunnelSettings {
  const normalized = { ...settings };
  for (const key of Object.keys(TUNNEL_LIMITS) as (keyof TunnelSettings)[]) {
    const value = settings[key];
    if (!Number.isFinite(value)) throw new RangeError(`Non-finite tunnel setting: ${key}`);
    const [min, max] = TUNNEL_LIMITS[key];
    normalized[key] = clamp(value, min, max);
  }
  return normalized;
}

export function sampleTunnel(settings: TunnelSettings) {
  const normalized = normalizeTunnelSettings(settings);
  const { speed, density } = normalized;
  const incidence = normalized.incidenceDeg * degToRad;
  const bodyLean = normalized.bodyLeanDeg * degToRad;
  const vHalfAngle = normalized.vHalfAngleDeg * degToRad;
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
    settings: normalized,
    liftVertical,
    dragLongitudinal,
    // Signed vertical lift-to-drag for the specified horizontal flow.
    ratio: dragLongitudinal > 1e-8 ? liftVertical / dragLongitudinal : 0,
  };
}

export function sweepIncidence(settings: TunnelSettings, min = -10, max = 30, step = 1) {
  // Indexed sampling avoids accumulated angle drift. Reject non-finite bounds
  // before the loop: Infinity/NaN previously permitted an unbounded sweep.
  if (![min, max, step].every(Number.isFinite) || !(step > 0) || max < min
    || min < TUNNEL_LIMITS.incidenceDeg[0] || max > TUNNEL_LIMITS.incidenceDeg[1]
    || (max - min) / step > 400) throw new RangeError('Invalid tunnel sweep');
  const normalized = normalizeTunnelSettings(settings);
  const rows: { angle: number; lift: number; drag: number; ratio: number }[] = [];
  const intervals = Math.floor((max - min) / step + 1e-9);
  for (let i = 0; i <= intervals; i++) {
    const a = Math.min(max, min + i * step);
    const measured = sampleTunnel({ ...normalized, incidenceDeg: a });
    rows.push({ angle: a, lift: measured.liftVertical,
      drag: measured.dragLongitudinal, ratio: measured.ratio });
  }
  return rows;
}
