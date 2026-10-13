import { describe, expect, it } from 'vitest';
import { aerodynamicForces } from '../src/physics/aerodynamics';
import { DEFAULT_TUNNEL_SETTINGS as defaults, sampleTunnel, sweepIncidence } from '../src/lab/windTunnel';

describe('wind-tunnel diagnostics use live flight aerodynamics', () => {
  it('matches the shared aerodynamic calculation without alternative coefficients', () => {
    const d = sampleTunnel(defaults);
    const expected = aerodynamicForces({
      velocity: { x: defaults.speed, y: 0, z: 0 }, wind: { x: 0, y: 0, z: 0 },
      pitch: defaults.incidenceDeg * Math.PI / 180, roll: 0, omega: 0,
      bodyLean: defaults.bodyLeanDeg * Math.PI / 180,
      vAngle: defaults.vHalfAngleDeg * Math.PI / 180,
    }, { density: defaults.density });
    expect(d.force.x).toBeCloseTo(expected.force.x, 10);
    expect(d.force.y).toBeCloseTo(expected.force.y, 10);
    expect(d.moment).toBeCloseTo(expected.moment, 10);
  });
  it('scales measured forces with square of flow speed', () => {
    const a = sampleTunnel({ ...defaults, speed: 15 });
    const b = sampleTunnel({ ...defaults, speed: 30 });
    expect(b.liftVertical).toBeCloseTo(4 * a.liftVertical, 7);
    expect(b.dragLongitudinal).toBeCloseTo(4 * a.dragLongitudinal, 7);
  });
  it('reports no force, moment or instability for zero speed', () => {
    const d = sampleTunnel({ ...defaults, speed: 0 });
    expect(d.dynamicPressure).toBe(0);
    expect(d.dragLongitudinal).toBe(0);
    expect(d.liftVertical).toBe(0);
    expect(d.moment).toBe(0);
    expect(d.ratio).toBe(0);
  });
  it('creates a deterministic finite polar sweep', () => {
    const a = sweepIncidence(defaults), b = sweepIncidence(defaults);
    expect(a).toEqual(b);
    expect(a.length).toBe(41);
    expect(a[0].angle).toBe(-10);
    expect(a.at(-1)?.angle).toBe(30);
    expect(a.every(row => Object.values(row).every(Number.isFinite))).toBe(true);
    expect(() => sweepIncidence(defaults, -10, 30, 0)).toThrow();
  });
});
