import { describe, expect, it } from 'vitest';
import { aerodynamicForces, finiteSpanLiftSlope, type Vector3Like } from '../src/physics/aerodynamics';
import {BODY_REFERENCE_AREA,BODY_REFERENCE_SPAN} from '../src/athlete/pose';

const dot = (a: Vector3Like, b: Vector3Like) => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (v: Vector3Like) => Math.hypot(v.x, v.y, v.z);
const subtract = (a: Vector3Like, b: Vector3Like): Vector3Like => ({
  x: a.x - b.x, y: a.y - b.y, z: a.z - b.z,
});
const state = (velocity: Vector3Like = { x: 25, y: -3, z: 0 }) => ({
  velocity, wind: { x: 0, y: 0, z: 0 }, pitch: .08, roll: 0,
  omega: 0, bodyLean: .85, vAngle: .25,
});

describe('dimensional aerodynamic forces', () => {
  it('reduces lift slope for low aspect ratio rather than treating the body as a long wing',()=>{
    const body=finiteSpanLiftSlope(BODY_REFERENCE_SPAN,BODY_REFERENCE_AREA);
    expect(body).toBeGreaterThan(0);
    expect(body).toBeLessThan(1);
    expect(finiteSpanLiftSlope(.02,1)).toBeLessThan(body);
    expect(finiteSpanLiftSlope(100,1)).toBeCloseTo(2*Math.PI,2);
  });
  it('uses air-relative speed and dynamic pressure in SI units', () => {
    const input = { ...state(), wind: { x: -4, y: 1, z: 2 } };
    const u = subtract(input.velocity, input.wind);
    const result = aerodynamicForces(input, { density: 1.225 });
    expect(result.airSpeed).toBeCloseTo(length(u), 10);
    expect(result.dynamicPressure).toBeCloseTo(.5 * 1.225 * dot(u, u), 10);
  });

  it('lift performs no work in the air frame and drag dissipates energy', () => {
    for (const pitch of [-1.1, -.2, .15, .65, 1.7]) {
      for (const roll of [-.5, 0, .6]) {
        const input = { ...state({ x: 23, y: -7, z: 3 }), pitch, roll,
          wind: { x: -3, y: 2, z: -2 } };
        const result = aerodynamicForces(input);
        const u = subtract(input.velocity, input.wind);
        const powerScale = Math.max(1, length(result.lift) * length(u));
        expect(Math.abs(dot(result.lift, u)) / powerScale).toBeLessThan(1e-10);
        expect(dot(result.drag, u)).toBeLessThanOrEqual(0);
        expect(result.cd).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('returns the sum of lift and drag as the translational force', () => {
    const result = aerodynamicForces({ ...state(), roll: .3 });
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(result.force[axis]).toBeCloseTo(result.drag[axis] + result.lift[axis], 10);
    }
  });

  it('scales force with the square of speed at the same orientation', () => {
    const low = aerodynamicForces(state({ x: 12, y: -2, z: 1 }));
    const high = aerodynamicForces(state({ x: 24, y: -4, z: 2 }));
    expect(high.airSpeed).toBeCloseTo(2 * low.airSpeed, 10);
    expect(high.dynamicPressure).toBeCloseTo(4 * low.dynamicPressure, 10);
    expect(length(high.drag)).toBeCloseTo(4 * length(low.drag), 8);
    expect(length(high.lift)).toBeCloseTo(4 * length(low.lift), 8);
  });

  it('scales pressure and forces linearly with density', () => {
    const full = aerodynamicForces(state(), { density: 1.225 });
    const half = aerodynamicForces(state(), { density: .6125 });
    expect(half.dynamicPressure).toBeCloseTo(full.dynamicPressure / 2, 10);
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(half.force[axis]).toBeCloseTo(full.force[axis] / 2, 10);
    }
  });

  it('has no aerodynamic forces or moments without air', () => {
    const result = aerodynamicForces({ ...state(), omega: 3 }, { density: 0 });
    expect(length(result.force)).toBe(0);
    expect(length(result.drag)).toBe(0);
    expect(length(result.lift)).toBe(0);
    expect(result.moment).toBe(0);
  });

  it('handles zero relative airspeed without division by zero', () => {
    const velocity = { x: 12, y: -2, z: 1 };
    const result = aerodynamicForces({ ...state(velocity), wind: velocity });
    expect(result.airSpeed).toBe(0);
    expect(result.dynamicPressure).toBe(0);
    expect(length(result.force)).toBe(0);
    expect(result.moment).toBe(0);
    for (const value of [result.alpha, result.cl, result.cd, ...Object.values(result.force)]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });

  it('is invariant under a common velocity offset of air and jumper', () => {
    const input = state({ x: 21, y: -5, z: 2 });
    const base = aerodynamicForces(input);
    const offset = aerodynamicForces({ ...input,
      velocity: { x: 28, y: -2, z: -2 }, wind: { x: 7, y: 3, z: -4 },
    });
    expect(offset.airSpeed).toBeCloseTo(base.airSpeed, 10);
    expect(offset.alpha).toBeCloseTo(base.alpha, 10);
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(offset.force[axis]).toBeCloseTo(base.force[axis], 10);
    }
  });

  it('wraps angular differences instead of accumulating full rotations', () => {
    const base = aerodynamicForces(state());
    const rotated = aerodynamicForces({ ...state(), pitch: state().pitch + Math.PI * 4 });
    expect(rotated.alpha).toBeCloseTo(base.alpha, 10);
    expect(rotated.moment).toBeCloseTo(base.moment, 8);
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(rotated.force[axis]).toBeCloseTo(base.force[axis], 8);
    }
  });
});
