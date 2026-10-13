import { describe, expect, it } from 'vitest';
import { aerodynamicForces } from '../src/physics/aerodynamics';
import { maximumHeelAngleRad } from '../src/equipment/model';
import { DEFAULT_TUNNEL_SETTINGS as defaults, normalizeTunnelSettings, sampleTunnel, sweepIncidence } from '../src/lab/windTunnel';

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
  it('rejects non-finite API settings instead of feeding NaN to the solver', () => {
    for (const key of Object.keys(defaults) as (keyof typeof defaults)[]) {
      for (const value of [NaN, Infinity, -Infinity]) {
        expect(() => sampleTunnel({ ...defaults, [key]: value })).toThrow(RangeError);
      }
    }
  });
  it('returns the bounded settings actually passed into the shared solver', () => {
    const supplied = { speed: 100, incidenceDeg: -80, bodyLeanDeg: 0, vHalfAngleDeg: 50, density: -1 };
    const result = sampleTunnel(supplied);
    expect(result.settings).toEqual({ speed: 60, incidenceDeg: -25, bodyLeanDeg: 50, vHalfAngleDeg: 14.3, density: 0 });
    expect(result.settings).toEqual(normalizeTunnelSettings(supplied));
    expect(result.force).toEqual({ x: 0, y: 0, z: 0 });
    expect(supplied.density).toBe(-1);
  });
  it('preserves signed lift and reports drag opposing the specified horizontal flow', () => {
    const negative = sampleTunnel({ ...defaults, incidenceDeg: -25, bodyLeanDeg: 86 });
    expect(negative.liftVertical).toBeLessThan(0);
    expect(negative.ratio).toBeLessThan(0);
    expect(negative.dragLongitudinal).toBeGreaterThan(0);
    expect(negative.lift.x).toBeCloseTo(0, 12);
    expect(negative.drag.y).toBeCloseTo(0, 12);
  });
  it('rejects invalid or excessive sweeps and never silently relabels clamped angles', () => {
    for (const [min, max, step] of [
      [NaN, 30, 1], [-10, Infinity, 1], [-Infinity, 30, 1], [-10, 30, Infinity],
      [-10, 30, NaN], [-10, 30, .01], [30, -10, 1], [-26, 30, 1], [-10, 46, 1],
    ]) expect(() => sweepIncidence(defaults, min, max, step)).toThrow(RangeError);
    expect(sweepIncidence(defaults, 10, 10, Number.MIN_VALUE)).toHaveLength(1);
    const decimal = sweepIncidence(defaults, -1, 1, .1);
    expect(decimal).toHaveLength(21);
    expect(decimal.at(-1)?.angle).toBe(1);
  });
  it('matches live polars at slider limits, including vacuum', () => {
    for (const speed of [0, 40]) for (const incidenceDeg of [-10, 30])
      for (const bodyLeanDeg of [50, 86]) for (const vHalfAngleDeg of [0, 14])
        for (const density of [0, 1.5]) {
          const settings = { speed, incidenceDeg, bodyLeanDeg, vHalfAngleDeg, density };
          const actual = sampleTunnel(settings);
          const expected = aerodynamicForces({
            velocity: { x: speed, y: 0, z: 0 }, wind: { x: 0, y: 0, z: 0 },
            pitch: incidenceDeg * Math.PI / 180, roll: 0, omega: 0,
            bodyLean: bodyLeanDeg * Math.PI / 180, vAngle: vHalfAngleDeg * Math.PI / 180,
          }, { density });
          for (const axis of ['x', 'y', 'z'] as const)
            expect(actual.force[axis]).toBeCloseTo(expected.force[axis], 10);
          expect(actual.moment).toBeCloseTo(expected.moment, 10);
          expect(Object.values(actual.force).every(Number.isFinite)).toBe(true);
        }
  });
  it('passes independent static heel angles into the actual ski aerodynamics', () => {
    const heels: [number, number] = [maximumHeelAngleRad(), .03];
    const actual = sampleTunnel(defaults, heels);
    const expected = aerodynamicForces({
      velocity: { x: defaults.speed, y: 0, z: 0 }, wind: { x: 0, y: 0, z: 0 },
      pitch: defaults.incidenceDeg * Math.PI / 180, roll: 0, omega: 0,
      bodyLean: defaults.bodyLeanDeg * Math.PI / 180, vAngle: defaults.vHalfAngleDeg * Math.PI / 180,
      skiAngles: heels,
    }, { density: defaults.density });
    expect(actual.heelAngles).toEqual(heels);
    for (let i = 0; i < 2; i++) {
      expect(actual.skis[i].alpha).toBeCloseTo(expected.skis[i].alpha, 12);
      expect(actual.skis[i].force.y).toBeCloseTo(expected.skis[i].force.y, 10);
    }
    expect(actual.skis[0].alpha).not.toBeCloseTo(actual.skis[1].alpha, 4);
    expect(sweepIncidence(defaults, -10, 30, 1, heels)[20].lift).toBeCloseTo(actual.liftVertical, 10);
  });
  it('enforces the rear-rod travel for lab fixtures rather than allowing arbitrary ski pitch', () => {
    for (const heels of [[-.001, 0], [0, maximumHeelAngleRad() + .001], [Infinity, 0], [0, NaN]])
      expect(() => sampleTunnel(defaults, heels as [number, number])).toThrow(RangeError);
    expect(() => sweepIncidence(defaults, -10, 30, 1, [0, -1])).toThrow(RangeError);
    expect(() => sampleTunnel(defaults, [0] as unknown as [number, number])).toThrow(RangeError);
  });
});
