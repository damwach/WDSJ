import { describe, expect, it } from 'vitest';
import { DT, Simulation } from '../src/physics/simulation';
import {certificate,hill,landingSlope} from '../src/world/hill';

function advance(simulation: Simulation, seconds: number) {
  for (let i = 0; i < Math.round(seconds / DT); i++) simulation.step();
}

function highFreefall(mass: number, gravity = 9.81) {
  const sim = new Simulation({ mass, airDensity: 0, gravity });
  sim.setAirborne({ x: 40, y: 1000, vx: 12, vy: 3, pitch: -.1 });
  return sim;
}

describe('flight and input regression', () => {
  it('applies gravity as an acceleration, without dividing it by jumper mass', () => {
    const sim = highFreefall(78);
    advance(sim, 2);
    expect(sim.vy).toBeCloseTo(3 - 9.81 * 2, 9);
    expect(sim.vx).toBeCloseTo(12, 10);
    expect(sim.comX).toBeCloseTo(40 + 12 * 2, 8);
    // The tolerance includes the known O(dt) error of semi-implicit Euler.
    expect(Math.abs(sim.comY - (1000 + 3 * 2 - .5 * 9.81 * 2 ** 2))).toBeLessThan(.1);
    expect(sim.phase).toBe('flight');
  });

  it('freefall follows the same trajectory for different masses', () => {
    const light = highFreefall(55), heavy = highFreefall(95);
    advance(light, 2);
    advance(heavy, 2);
    expect(light.vy).toBeCloseTo(heavy.vy, 10);
    expect(light.comX).toBeCloseTo(heavy.comX, 10);
    expect(light.comY).toBeCloseTo(heavy.comY, 10);
  });

  it('does not create propulsion when both gravity and air density are zero', () => {
    const sim = highFreefall(78, 0);
    advance(sim, 2);
    expect(sim.vx).toBeCloseTo(12, 10);
    expect(sim.vy).toBeCloseTo(3, 10);
    expect(sim.comX).toBeCloseTo(64, 8);
    expect(sim.comY).toBeCloseTo(1006, 8);
  });

  it('does not invent an external roll damping torque in vacuum', () => {
    const sim = highFreefall(78);
    sim.roll = .3;
    sim.rollRate = .6;
    advance(sim, 2);
    // Gravity acts at COM. The reduced fixed-inertia model has no external
    // roll torque when air density and ground contact are absent.
    expect(sim.rollRate).toBeCloseTo(.6, 10);
    expect(sim.roll).toBeCloseTo(.3 + .6 * 2, 9);
  });

  it('preserves custom physical parameters through a reset', () => {
    const sim = new Simulation({ mass: 63, airDensity: .95, gravity: 9.81 });
    sim.reset(true);
    expect(sim.mass).toBe(63);
    expect(sim.airDensity).toBe(.95);
    // A separate vacuum reset isolates gravity from aerodynamic acceleration.
    const vacuum = new Simulation({ mass: 63, airDensity: 0, gravity: 9.81 });
    vacuum.reset();
    vacuum.setAirborne({ x: 40, y: 1000, vx: 0, vy: 0 });
    advance(vacuum, 1);
    expect(vacuum.vy).toBeCloseTo(-9.81, 9);
  });

  it.each([
    ['demo in calm air', true, 0, 0],
    ['without takeoff gesture', false, 0, 0],
    ['headwind', true, -4, 0],
    ['tailwind', true, 4, 0],
    ['crosswind', true, 0, 2],
  ] as const)('reaches the hill after a finite ordinary jump: %s', (_name, demo, wind, crossWind) => {
    const sim = new Simulation();
    sim.reset(demo);
    sim.wind = wind;
    sim.crossWind = crossWind;
    for (let i = 0; i < 16 / DT && (sim.phase === 'inrun' || sim.phase === 'flight'); i++) {
      sim.step();
      for (const value of [sim.comX, sim.comY, sim.comZ, sim.vx, sim.vy, sim.vz, sim.pitch, sim.omega]) {
        expect(Number.isFinite(value)).toBe(true);
      }
    }
    expect(['landed', 'fallen']).toContain(sim.phase);
    expect(sim.flightTime).toBeGreaterThan(0);
    expect(sim.flightTime).toBeLessThan(12);
    expect(sim.comX).toBeGreaterThan(0);
    expect(sim.comY).toBeLessThan(0);
  });

  it('ends flight on contact rather than an arbitrary normal-flight timer', () => {
    const sim = new Simulation({ airDensity: 0, gravity: 9.81 });
    sim.setAirborne({ x: 40, y: 10000, vx: 0, vy: 0 });
    advance(sim, 10);
    expect(sim.phase).toBe('flight');
    expect(sim.comY).toBeGreaterThan(9400);
    expect(sim.vy).toBeCloseTo(-98.1, 8);
  });

  it('evaluates gesture speed and length consistently across pointer event rates', () => {
    const run = (parts: number) => {
      const sim = new Simulation();
      sim.reset();
      while (sim.phase === 'inrun' && sim.x < -4) sim.step();
      expect(sim.phase).toBe('inrun');
      for (let i = 0; i < parts; i++) sim.gesture({ up: 120 / parts, side: 20 / parts, duration: .2 / parts });
      return sim;
    };
    const one = run(1);
    for (const parts of [12, 30, 120]) {
      const many = run(parts);
      expect(many.target).toBeCloseTo(one.target, 10);
      expect(many.stroke).toBeCloseTo(one.stroke, 10);
      expect(many.gestureDuration).toBeCloseTo(.2, 10);
      expect(many.gestureSpeed).toBeCloseTo(600, 8);
      expect(many.effort).toBeCloseTo(one.effort, 8);
      expect(many.eccentricity).toBeCloseTo(one.eccentricity, 8);
    }
  });

  it('distinguishes gesture speed from gesture length', () => {
    const run = (duration: number) => {
      const sim = new Simulation();
      sim.reset();
      while (sim.phase === 'inrun' && sim.x < -4) sim.step();
      sim.gesture({ up: 120, side: 0, duration });
      return sim;
    };
    const fast = run(.08), slow = run(.4);
    expect(fast.target).toBe(slow.target);
    expect(fast.gestureSpeed).toBeGreaterThan(slow.gestureSpeed);
    expect(fast.effort).toBeGreaterThan(slow.effort);
  });

  it('saturates muscle and reaction-lever effects for extreme mouse speeds', () => {
    const run = (duration: number) => {
      const sim = new Simulation();
      sim.reset();
      while (sim.phase === 'inrun' && sim.x < -4) sim.step();
      sim.gesture({ up: 120, side: 0, duration });
      for (let i = 0; i < 1200 && sim.phase === 'inrun'; i++) sim.step();
      expect(sim.phase).toBe('flight');
      return sim;
    };
    const high = run(.001), extreme = run(1e-9);
    expect(extreme.gestureSpeed).toBeGreaterThan(high.gestureSpeed * 100000);
    // A millionfold faster pointer event must not create a millionfold
    // ground-reaction lever or angular impulse in a human body.
    expect(extreme.normalVelocity).toBeCloseTo(high.normalVelocity, 9);
    expect(extreme.takeoffImpulse).toBeCloseTo(high.takeoffImpulse, 8);
    expect(extreme.omega).toBeCloseTo(high.omega, 9);
    expect(Math.abs(extreme.omega)).toBeLessThan(20);
  });
});

describe('observable takeoff and contact', () => {
  it('a faster equal-length gesture produces stronger normal momentum', () => {
    const run=(duration:number)=>{const sim=new Simulation();sim.reset();while(sim.phase==='inrun'&&sim.x<-5.5)sim.step();sim.gesture({up:120,side:0,duration});while(sim.phase==='inrun')sim.step();return sim;};
    const fast=run(.18),slow=run(.6);
    expect(fast.takeoffImpulse).toBeGreaterThan(slow.takeoffImpulse*2);
    expect(fast.normalVelocity).toBeGreaterThan(slow.normalVelocity*2);
  });
  it('applies muscle force immediately and makes a visible extension within 100ms', () => {
    const sim=new Simulation();sim.reset();while(sim.phase==='inrun'&&sim.x<-6)sim.step();sim.gesture({up:120,side:0,duration:.2});sim.step();
    expect(sim.normalForce).toBeGreaterThan(sim.mass*sim.gravity);
    for(let i=0;i<10;i++)sim.step();
    expect(sim.extension).toBeGreaterThan(.1);
    expect(sim.muscleWork).toBeGreaterThan(0);
  });
  it('the nominal demonstration lands and dissipates the normal collision energy', () => {
    const sim=new Simulation();sim.reset(true);
    for(let i=0;i<2000&&(sim.phase==='inrun'||sim.phase==='flight');i++)sim.step();
    expect(sim.phase).toBe('landed');
    expect(sim.resultDistance).toBeGreaterThan(40);
    expect(sim.resultDistance).toBeLessThan(certificate.hs);
    expect(sim.impact).toBeLessThan(Math.sqrt(8*sim.gravity*.45));
    // The post-impact velocity is tangent to the actual certified hill model.
    expect(sim.landingContact).not.toBeNull();
    expect(sim.vy-landingSlope(sim.landingContact!.x)*sim.vx).toBeCloseTo(0,10);
    expect(sim.flightTime).toBeLessThan(6);
  });
  it('brakes to rest within the rising certified outrun', () => {
    const sim=new Simulation();sim.reset(true);
    for(let i=0;i<6000&&(sim.phase==='inrun'||sim.phase==='flight'||sim.v>.01);i++)sim.step();
    expect(sim.phase).toBe('landed');
    expect(sim.v).toBeLessThan(.01);
    expect(sim.x).toBeLessThan(hill.points.outrunEnd.x);
  });
});
