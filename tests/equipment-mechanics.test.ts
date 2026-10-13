import {describe,it,expect} from 'vitest';
import {cloneEquipmentConfig} from '../src/equipment/config';
import {createBindingSystemState,stepBindingSystem,skiProperties,maximumHeelAngleRad,pitchAngularMomentum,rotationalEnergy,heelGeometry} from '../src/equipment/model';

const dt=1/120;
describe('coupled body and independent ski pitch dynamics',()=>{
  it('conserves total angular momentum in vacuum across elastic reactions and heel stops',()=>{
    const config=cloneEquipmentConfig(),bodyI=18-2*skiProperties(config).pitchInertiaAboutFrontKgM2;
    let state=createBindingSystemState(.2,.8,config);
    const limit=maximumHeelAngleRad(config);
    state.skis[0].heelAngleRad=limit*.8;
    state.skis[1].heelAngleRad=limit*.15;
    state.skis[0].absoluteAngularVelocityRadS=7;
    state.skis[1].absoluteAngularVelocityRadS=-4;
    const momentum=pitchAngularMomentum(state,bodyI,config);
    let energy=rotationalEnergy(state,bodyI,config),stopped=false;
    for(let i=0;i<600;i++) {
      state=stepBindingSystem(state,{bodyTorqueNm:0,skiTorqueNm:[0,0],bodyInertiaKgM2:bodyI},config,dt);
      expect(pitchAngularMomentum(state,bodyI,config)).toBeCloseTo(momentum,10);
      const nextEnergy=rotationalEnergy(state,bodyI,config);
      expect(nextEnergy).toBeLessThanOrEqual(energy+1e-9);
      energy=nextEnergy;
      for(const ski of state.skis) {
        expect(ski.heelAngleRad).toBeGreaterThanOrEqual(0);
        expect(ski.heelAngleRad).toBeLessThanOrEqual(limit);
        expect(ski.rodLengthM).toBeLessThanOrEqual(config.binding.rodMaxLengthM+1e-12);
        if(ski.heelAngleRad<1e-10||ski.heelAngleRad>limit-1e-10)stopped=true;
      }
    }
    expect(stopped).toBe(true);
  });
  it('does not impose a hidden body angle target or slow uniform vacuum rotation',()=>{
    const config=cloneEquipmentConfig(),bodyI=15;
    let state=createBindingSystemState(.2,1.2,config);
    for(let i=0;i<120;i++)state=stepBindingSystem(state,{bodyTorqueNm:0,skiTorqueNm:[0,0],bodyInertiaKgM2:bodyI},config,dt);
    expect(state.bodyPitchRad).toBeCloseTo(1.4,11);
    expect(state.bodyAngularVelocityRadS).toBeCloseTo(1.2,11);
    expect(state.skis[0].heelAngleRad).toBeCloseTo(0,11);
    expect(state.skis[1].heelAngleRad).toBeCloseTo(0,11);
  });
  it('integrates only the applied total external angular impulse, with asymmetric per-ski response',()=>{
    const config=cloneEquipmentConfig(),bodyI=15;
    let state=createBindingSystemState();
    for(let i=0;i<120;i++)state=stepBindingSystem(state,{bodyTorqueNm:2,skiTorqueNm:[3,-4],bodyInertiaKgM2:bodyI},config,dt);
    expect(pitchAngularMomentum(state,bodyI,config)).toBeCloseTo(1,10);
    expect(state.skis[0].heelAngleRad).toBeGreaterThan(state.skis[1].heelAngleRad+.005);
    expect(state.skis[0].reactionTorqueNm).not.toBe(state.skis[1].reactionTorqueNm);
    expect(state.skis[0].aeroPitchTorqueNm).toBe(3);
    expect(state.skis[1].aeroPitchTorqueNm).toBe(-4);
  });
  it('responds with finite speed rather than jumping to a force equilibrium pose',()=>{
    const config=cloneEquipmentConfig(),initial=createBindingSystemState();
    const state=stepBindingSystem(initial,{bodyTorqueNm:-10,skiTorqueNm:[5,5],bodyInertiaKgM2:15},config,dt);
    expect(state.skis[0].heelAngleRad).toBeGreaterThan(0);
    expect(state.skis[0].heelAngleRad).toBeLessThan(.002);
    expect(state.bodyPitchRad).toBeLessThan(0);
    expect(initial.bodyPitchRad).toBe(0);
    expect(initial.skis[0].heelAngleRad).toBe(0);
    expect(state.skis[0].rodLengthM).toBeCloseTo(heelGeometry(config,state.skis[0].heelAngleRad).rodLengthM,12);
  });
  it('remains passive and within rod limits at a deliberately large step',()=>{
    const config=cloneEquipmentConfig(),bodyI=15;
    let state=createBindingSystemState();
    state.skis[0].heelAngleRad=maximumHeelAngleRad(config)*.7;
    state.skis[0].absoluteAngularVelocityRadS=12;
    const momentum=pitchAngularMomentum(state,bodyI,config),energy=rotationalEnergy(state,bodyI,config);
    state=stepBindingSystem(state,{bodyTorqueNm:0,skiTorqueNm:[0,0],bodyInertiaKgM2:bodyI},config,.2);
    expect(pitchAngularMomentum(state,bodyI,config)).toBeCloseTo(momentum,10);
    expect(rotationalEnergy(state,bodyI,config)).toBeLessThan(energy);
    expect(state.skis[0].rodLengthM).toBeLessThanOrEqual(config.binding.rodMaxLengthM+1e-12);
  });
  it('repeats the same complete mechanism state for the same torque history',()=>{
    const config=cloneEquipmentConfig();
    const run=()=> {
      let state=createBindingSystemState(-.2,.4,config);
      for(let i=0;i<300;i++)state=stepBindingSystem(state,{bodyTorqueNm:i<90?-2:1,
        skiTorqueNm:[i<150?4:0,i<80?3:-1],bodyInertiaKgM2:15},config,dt);
      return state;
    };
    expect(run()).toEqual(run());
  });
  it('rejects nonfinite input and nonpositive inertia instead of contaminating the main simulation',()=>{
    const config=cloneEquipmentConfig(),state=createBindingSystemState();
    expect(()=>stepBindingSystem(state,{bodyTorqueNm:0,skiTorqueNm:[0,0],bodyInertiaKgM2:0},config,dt)).toThrow(/inertias/);
    expect(()=>stepBindingSystem(state,{bodyTorqueNm:NaN,skiTorqueNm:[0,0],bodyInertiaKgM2:15},config,dt)).toThrow(/finite/);
  });
});
