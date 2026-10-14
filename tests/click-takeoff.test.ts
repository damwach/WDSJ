import { describe, expect, it } from 'vitest';
import { Simulation, DT } from '../src/physics/simulation';
import { slope } from '../src/world/hill';

function atInrun(x: number) {
  const s = new Simulation(); s.reset();
  for (let i=0;i<1500 && s.phase==='inrun' && s.x<x;i++)s.step();
  expect(s.phase).toBe('inrun');
  return s;
}
function release(s: Simulation) {
  let peak=0;
  for(let i=0;i<300 && s.phase==='inrun';i++) {
    s.step();
    peak=Math.max(peak,s.normalForce);
  }
  expect(s.phase).toBe('flight');
  return peak;
}

describe('one-click takeoff on the actual table',()=>{
  it('rejects clicks too early, accepts one timed press, and rejects repeated presses',()=>{
    const s=atInrun(-12);
    expect(s.clickTakeoff()).toBe(false);
    expect(s.takeoffClicked).toBe(false);
    while(s.phase==='inrun' && s.x< -6)s.step();
    expect(s.clickTakeoff()).toBe(true);
    const at=s.takeoffClickX;
    expect(s.clickTakeoff()).toBe(false);
    expect(s.takeoffClickX).toBe(at);
    expect(s.target).toBe(1);
    expect(s.eccentricity).toBe(0);
  });

  it('produces a finite, bounded normal reaction over physical steps, not a click impulse',()=>{
    const s=atInrun(-6.2);
    const oldVelocity=s.normalVelocity;
    expect(s.clickTakeoff()).toBe(true);
    expect(s.normalVelocity).toBe(oldVelocity);
    expect(s.takeoffImpulse).toBe(0);
    const peak=release(s);
    expect(peak).toBeGreaterThan(s.mass*s.gravity*1.5);
    expect(peak).toBeLessThanOrEqual(s.mass*s.gravity*2.85+1e-6);
    expect(s.takeoffImpulse).toBeGreaterThan(0);
    expect(s.normalVelocity).toBeGreaterThan(.1);
    // The airborne impulse is normal to the 11-degree-down table, not vertical.
    const angle=Math.atan(slope(0));
    const normalVelocity=-Math.sin(angle)*s.vx+Math.cos(angle)*s.vy;
    const tangentialVelocity=Math.cos(angle)*s.vx+Math.sin(angle)*s.vy;
    expect(normalVelocity).toBeCloseTo(s.normalVelocity,6);
    expect(tangentialVelocity).toBeCloseTo(s.v,6);
  });

  it('penalizes a late click naturally through a shorter time of ground contact',()=>{
    const optimal=atInrun(-6.2), late=atInrun(-1.0);
    expect(optimal.clickTakeoff()).toBe(true);
    expect(late.clickTakeoff()).toBe(true);
    release(optimal);release(late);
    expect(optimal.takeoffImpulse).toBeGreaterThan(late.takeoffImpulse);
    expect(optimal.normalVelocity).toBeGreaterThan(late.normalVelocity);
    expect(optimal.takeoffElapsed).toBeGreaterThan(late.takeoffElapsed);
  });

  it('does not allow horizontal mouse trim to steer the body',()=>{
    const s=new Simulation({airDensity:0});s.reset();
    s.setAirborne({x:10,y:1000,vx:25,vy:-3});
    s.trim(0,120);
    expect(s.pilotBank).toBe(0);
    s.trim(10,-200);
    expect(s.pilotBank).toBe(0);
    expect(s.bodyLean).toBeGreaterThan(1.27);
    for(let i=0;i<10/DT;i++)s.step();
    expect(Number.isFinite(s.pitch+s.omega)).toBe(true);
  });
});
