import {describe,expect,it} from 'vitest';
import {DT} from '../src/physics/simulation';
import {DEFAULT_SCENARIO_CONFIGURATION,SCENARIOS,replayScenario,runScenario,runScenarioSuite} from '../src/physics/scenarios';

const suite=runScenarioSuite();
const result=(id:string)=>suite.find(run=>run.scenario.id===id)!;

describe('deterministic gameplay comparisons',()=>{
  it('keeps the same gate, equipment/mass, air density and starting weather for all cases',()=>{
    expect(suite).toHaveLength(SCENARIOS.length);
    for(const run of suite){
      expect(run.configuration).toEqual(DEFAULT_SCENARIO_CONFIGURATION);
      expect(run.fixedStepSeconds).toBe(DT);
      expect(run.metrics.stopReason).toBe('contact');
      expect(['landed','fallen']).toContain(run.metrics.phase);
      expect(run.metrics.elapsedSeconds).toBeLessThan(16);
      for(const value of Object.values(run.finalState))expect(Number.isFinite(value)).toBe(true);
      expect(run.metrics.peakNormalForceN).toBeLessThanOrEqual(run.configuration.mass*run.configuration.gravity*3.4+1e-9);
    }
  });

  it('adds no takeoff impulse or positive actuator work without a gesture',()=>{
    const none=result('no-takeoff');
    expect(none.inputs).toEqual([]);
    // Roundoff in m*baseline/m may leave ~1e-15 N·s; keep the raw value.
    expect(Math.abs(none.metrics.takeoffImpulseNs)).toBeLessThan(1e-9);
    expect(Math.abs(none.metrics.positiveActuatorWorkJ)).toBeLessThan(1e-9);
    expect(none.metrics.peakPitchRateRadPerSecond).toBeGreaterThan(0); // Aero may still rotate a passive jumper.
  });

  it('observes a reference-gesture benefit without treating it as a universal optimum',()=>{
    const nominal=result('nominal'),none=result('no-takeoff');
    expect(nominal.metrics.takeoffImpulseNs).toBeGreaterThan(none.metrics.takeoffImpulseNs);
    expect(nominal.metrics.positiveActuatorWorkJ).toBeGreaterThan(0);
    expect(nominal.metrics.resultDistanceM).toBeGreaterThan(none.metrics.resultDistanceM);
    expect(nominal.metrics.gestureUpPx).toBeLessThanOrEqual(120+1e-9);
    expect(nominal.metrics.peakRollRateRadPerSecond).toBe(0);
  });

  it('distinguishes early and late timing at identical commanded speed and stroke limits',()=>{
    const early=result('early'),nominal=result('nominal'),late=result('late');
    const firstTick=(run:typeof early)=>run.inputs.find(input=>input.type==='gesture')!.tick;
    expect(firstTick(early)).toBeLessThan(firstTick(nominal));
    expect(firstTick(nominal)).toBeLessThan(firstTick(late));
    expect(Math.abs(early.metrics.takeoffImpulseNs-late.metrics.takeoffImpulseNs)).toBeGreaterThan(1);
    expect(Math.abs(early.metrics.resultDistanceM-late.metrics.resultDistanceM)).toBeGreaterThan(1);
    expect(late.metrics.gestureUpPx).toBeLessThan(120); // Contact, not a forced rule, truncates this gesture.
  });

  it('an aggressive straight gesture creates more pitch rotation without a prescribed roll',()=>{
    const excessive=result('excessive'),nominal=result('nominal');
    expect(excessive.metrics.peakPitchRateRadPerSecond).toBeGreaterThan(nominal.metrics.peakPitchRateRadPerSecond);
    expect(excessive.metrics.peakRollRateRadPerSecond).toBe(0);
    expect(excessive.metrics.takeoffPitchRateRadPerSecond).toBeLessThan(0);
    for(const input of excessive.inputs)if(input.type==='gesture')expect(input.side).toBe(0);
  });

  it('isolates flight posture and wind changes from the identical takeoff',()=>{
    const nominal=result('nominal');
    for(const id of ['changing-wind','upright-flight','flat-flight']){
      const run=result(id);
      expect(run.metrics.takeoffImpulseNs).toBe(nominal.metrics.takeoffImpulseNs);
      expect(run.metrics.takeoffPitchRateRadPerSecond).toBe(nominal.metrics.takeoffPitchRateRadPerSecond);
      expect(run.metrics.takeoffTimeSeconds).toBe(nominal.metrics.takeoffTimeSeconds);
      expect(Math.abs(run.metrics.resultDistanceM-nominal.metrics.resultDistanceM)).toBeGreaterThan(.1);
    }
    expect(result('changing-wind').inputs.filter(input=>input.type==='wind').map(input=>input.x)).toEqual([-2,2]);
    expect(result('upright-flight').finalState.bodyLean).toBeCloseTo(1.05,12);
    expect(result('flat-flight').finalState.bodyLean).toBeCloseTo(1.42,12);
  });

  it.each(SCENARIOS.map(scenario=>scenario.id))('replays the observed input schedule exactly: %s',id=>{
    const original=result(id),replayed=replayScenario(original),repeated=runScenario(id);
    expect(replayed.metrics).toEqual(original.metrics);
    expect(replayed.finalState).toEqual(original.finalState);
    expect(replayed.inputs).toEqual(original.inputs);
    expect(repeated).toEqual(original);
  });

  it('reports an exhausted diagnostic budget without inventing contact',()=>{
    const run=runScenario('nominal',{maxTicks:10});
    expect(run.metrics.stopReason).toBe('timeout');
    expect(run.metrics.phase).toBe('inrun');
    expect(run.metrics.resultDistanceM).toBe(0);
    expect(run.metrics.contactNormalSpeedMps).toBe(0);
  });
});
