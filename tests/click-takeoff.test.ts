import { describe, expect, it } from 'vitest';
import { Simulation, DT } from '../src/physics/simulation';
import { slope } from '../src/world/hill';

function atInrun(x:number) {
  const s=new Simulation();s.reset();
  for(let i=0;i<1500 && s.phase==='inrun' && s.x<x;i++)s.step();
  expect(s.phase).toBe('inrun');
  return s;
}
function release(s:Simulation) {
  let peak=0;
  for(let i=0;i<300 && s.phase==='inrun';i++) {
    s.step();peak=Math.max(peak,s.normalForce);
  }
  expect(s.phase).toBe('flight');
  return peak;
}

describe('independent, two-button ski jump takeoff',()=>{
  it('accepts only the correct press inside the final eight metres and ignores repeats',()=>{
    const s=atInrun(-12);
    expect(s.clickTakeoff('left')).toBe(false);
    expect(s.takeoffLegTimes).toEqual([null,null]);
    while(s.phase==='inrun' && s.x< -6)s.step();
    expect(s.clickTakeoff('left',1000)).toBe(true);
    expect(s.clickTakeoff('left',1005)).toBe(false);
    expect(s.clickTakeoff('right',1012)).toBe(true);
    expect(s.clickTakeoff('right',1018)).toBe(false);
    expect(s.takeoffPressGapMs).toBeCloseTo(12,8);
    expect(s.target).toBe(1);
    expect(s.eccentricity).toBe(0);
  });

  it('integrates a finite leg impulse in the normal direction, not on press',()=>{
    const s=atInrun(-6.2), old=s.normalVelocity;
    expect(s.clickTakeoff('left',1000)).toBe(true);
    expect(s.clickTakeoff('right',1000)).toBe(true);
    expect(s.normalVelocity).toBe(old);
    expect(s.takeoffImpulse).toBe(0);
    const peak=release(s);
    expect(peak).toBeGreaterThan(s.mass*s.gravity*1.5);
    expect(peak).toBeLessThanOrEqual(s.mass*s.gravity*2.85+1e-6);
    expect(s.takeoffImpulse).toBeGreaterThan(0);
    expect(s.normalVelocity).toBeGreaterThan(.1);
    const angle=Math.atan(slope(0));
    const normal=-Math.sin(angle)*s.vx+Math.cos(angle)*s.vy;
    const tangent=Math.cos(angle)*s.vx+Math.sin(angle)*s.vy;
    expect(normal).toBeCloseTo(s.normalVelocity,6);
    expect(tangent).toBeCloseTo(s.v,6);
    expect(s.takeoffPressGapMs).toBe(0);
  });

  it('equal leg activation balances ground reaction, and delayed press creates real roll torque',()=>{
    const even=atInrun(-6),uneven=atInrun(-6);
    even.clickTakeoff('left',1000);even.clickTakeoff('right',1000);
    uneven.clickTakeoff('left',1000);uneven.clickTakeoff('right',1060);
    for(let i=0;i<10;i++){even.step();uneven.step();}
    expect(even.takeoffLegForcesN[0]).toBeCloseTo(even.takeoffLegForcesN[1],8);
    expect(even.rollRate).toBeCloseTo(0,8);
    expect(uneven.takeoffLegForcesN[0]).toBeGreaterThan(uneven.takeoffLegForcesN[1]);
    expect(uneven.rollRate).toBeGreaterThan(0);
    expect(uneven.takeoffPressGapMs).toBeCloseTo(60,8);
    // Uneven early activation has fewer available muscle forces.
    expect(uneven.normalVelocity).toBeLessThan(even.normalVelocity);
  });

  it('left and right trigger independently; absent leg has no extra extension force',()=>{
    const onlyLeft=atInrun(-6),both=atInrun(-6);
    onlyLeft.clickTakeoff('left',1000);
    both.clickTakeoff('left',1000);both.clickTakeoff('right',1000);
    for(let i=0;i<12;i++){onlyLeft.step();both.step();}
    expect(onlyLeft.takeoffLegForcesN[0]).toBeGreaterThan(onlyLeft.takeoffLegForcesN[1]);
    expect(onlyLeft.normalVelocity).toBeLessThan(both.normalVelocity);
  });

  it('earlier synchronized presses develop more impulse than identical late presses',()=>{
    const onTime=atInrun(-6.2),late=atInrun(-1.0);
    for(const s of [onTime,late]){
      expect(s.clickTakeoff('left')).toBe(true);
      expect(s.clickTakeoff('right')).toBe(true);
    }
    release(onTime);release(late);
    expect(onTime.takeoffImpulse).toBeGreaterThan(late.takeoffImpulse);
    expect(onTime.normalVelocity).toBeGreaterThan(late.normalVelocity);
    expect(onTime.takeoffElapsed).toBeGreaterThan(late.takeoffElapsed);
  });

  it('horizontal mouse flight input has no steering effect',()=>{
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
