import {describe,it,expect} from 'vitest';
import {Simulation,FixedClock} from '../src/physics/simulation';
import {height,slope,hill,certificate} from '../src/world/hill';
import {centerOfMassOffset} from '../src/physics/biomechanics';
describe('deterministic biomechanics',()=>{
 it('matches the complete jump at 30 and 144 Hz',()=>{const run=(hz:number)=>{const s=new Simulation();s.reset(true);const c=new FixedClock();for(let i=0;i<hz*12;i++)c.advance(1/hz,()=>s.step());expect(s.phase).toBe('landed');return s.snapshot()};expect(run(30)).toEqual(run(144))});
 it('preserves the certified table angle and joins the inrun',()=>{expect(height(0)).toBe(0);expect(slope(-6)).toBeCloseTo(-Math.tan(certificate.inrun.tableAngle*Math.PI/180));for(const x of [hill.points.E1.x,hill.points.E2.x])expect(slope(x-.0001)).toBeCloseTo(slope(x+.0001),5)});
 it('generates visible COM rise and normal velocity before release',()=>{const s=new Simulation();s.reset(true);while(s.phase==='inrun')s.step();expect(centerOfMassOffset(s.extension).y-centerOfMassOffset(0).y).toBeGreaterThan(.15);expect(s.normalVelocity).toBeGreaterThan(1);expect(s.x).toBeGreaterThan(-8);expect(s.x).toBeLessThanOrEqual(0);expect(Number.isFinite(s.vy)).toBe(true)});
 it('ignores gestures outside contact window and retains direction',()=>{const s=new Simulation();s.reset();s.gesture({up:120,side:0,duration:.2});expect(s.target).toBe(0);s.x=-4;s.gesture({up:-120,side:0,duration:.2});expect(s.target).toBe(0);s.gesture({up:120,side:20,duration:.2});expect(s.target).toBe(1);expect(s.eccentricity).toBeGreaterThan(0)});
 it('aggression introduces torque, without prescribing a rotation',()=>{const run=(up:number)=>{const s=new Simulation();s.reset();s.x=-7;s.gesture({up,side:0,duration:.08});while(s.phase==='inrun')s.step();return s};const calm=run(90),hard=run(190);expect(Math.abs(hard.omega)).toBeGreaterThan(Math.abs(calm.omega));expect(hard.pitch).toEqual(calm.pitch)});
});
