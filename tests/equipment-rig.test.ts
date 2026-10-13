import {describe,expect,it} from 'vitest';
import * as T from 'three';
import {Athlete,dimensions} from '../src/athlete/rig';
import {jointPose,legKneePosition,maxLegAbductionRad} from '../src/athlete/pose';
import {DEFAULT_EQUIPMENT,cloneEquipmentConfig,setBindingFraction} from '../src/equipment/config';
import {createBindingSystemState,maximumHeelAngleRad,tailGapM} from '../src/equipment/model';
import {centerOfMassOffset} from '../src/physics/biomechanics';

const world=(object:T.Object3D)=>object.getWorldPosition(new T.Vector3());

describe('ski geometry and fixed-length lateral leg rig',()=>{
  it('measures 57 percent to the actual boot toe and keeps front fixation joined while the heel moves',()=>{
    const athlete=new Athlete(),state=createBindingSystemState();
    for(const heel of [0,.04,.10,maximumHeelAngleRad()]) {
      state.skis[0].heelAngleRad=heel;
      state.skis[1].heelAngleRad=heel*.6;
      athlete.pose(1,1,0,{skiStates:state.skis});
      athlete.root.updateMatrixWorld(true);
      for(const leg of athlete.legs) {
        const hardware=leg.equipment;
        expect(hardware.boot.parent).toBe(leg.ankle);
        expect(hardware.ski.parent).toBe(leg.ankle);
        expect(world(hardware.bootFront).distanceTo(world(hardware.ski.getObjectByName(`${hardware.side}-ski-front-attachment`)!))).toBeLessThan(1e-12);
        const tip=world(hardware.ski.getObjectByName(`${hardware.side}-ski-tip`)!);
        const toe=world(hardware.bootToe);
        if(heel===0) {
          const chord=new T.Vector3(1,0,0).applyQuaternion(hardware.ski.getWorldQuaternion(new T.Quaternion()));
          expect(tip.clone().sub(toe).dot(chord)).toBeCloseTo(1.482,7);
          expect(tip.clone().sub(world(leg.ankle)).dot(chord)).toBeCloseTo(1.662,7);
        }
        const rodLength=world(hardware.rearBoot).distanceTo(world(hardware.rearSki));
        expect(rodLength).toBeCloseTo(hardware.ski.userData.rodLengthM,12);
        expect(rodLength).toBeLessThanOrEqual(DEFAULT_EQUIPMENT.binding.rodMaxLengthM+1e-10);
      }
    }
    expect(athlete.legs[0].ski.userData.heelRiseM).toBeGreaterThan(.04);
    expect(athlete.root.getObjectByName('left-binding-rear-rod')).toBeInstanceOf(T.Mesh);
  });

  it('moves ski mesh and mount arms when the legal mounting position changes',()=>{
    const athlete=new Athlete();
    athlete.pose(1,1,0);
    athlete.root.updateMatrixWorld(true);
    const originalTip=world(athlete.root.getObjectByName('left-ski-tip')!);
    const originalToe=world(athlete.root.getObjectByName('left-boot-toe')!);
    const config=setBindingFraction(DEFAULT_EQUIPMENT,.53);
    athlete.pose(1,1,0,{equipment:config});
    athlete.root.updateMatrixWorld(true);
    const shiftedTip=world(athlete.root.getObjectByName('left-ski-tip')!);
    const shiftedToe=world(athlete.root.getObjectByName('left-boot-toe')!);
    expect(shiftedTip.clone().sub(shiftedToe).length()).toBeLessThan(originalTip.clone().sub(originalToe).length()-.09);
    expect(athlete.legs[0].equipment.config).toBe(config);
    const shiftedCOM=centerOfMassOffset(1,1,0,1.27,{equipment:config});
    expect(Math.abs(shiftedCOM.x-centerOfMassOffset(1,1,0).x)).toBeGreaterThan(.003);
    // The laboratory may retain an editable object; editing it in place must
    // still rebuild the equipment rather than only changing its diagnostics.
    config.binding.frontSkiFraction=.51;
    config.binding.bootToePositionM=config.ski.lengthM*(1-.51);
    const oldMesh=athlete.legs[0].ski.children[0];
    athlete.pose(1,1,0,{equipment:config});
    expect(athlete.legs[0].ski.children[0]).not.toBe(oldMesh);
  });

  it('preserves the tail gap, contact height and bone lengths through V transfer and landing',()=>{
    const athlete=new Athlete(),state=createBindingSystemState();
    for(let i=0;i<=240;i++) {
      const time=i/120,landing=Math.max(0,Math.min(1,(time-.85)/.65));
      state.skis[0].heelAngleRad=maximumHeelAngleRad()*.70*Math.sin(Math.PI*i/240)**2*(1-landing);
      state.skis[1].heelAngleRad=maximumHeelAngleRad()*.30*Math.sin(Math.PI*i/240)**2*(1-landing);
      const controls={skiStates:state.skis};
      athlete.pose(1,time,landing,controls);
      athlete.root.updateMatrixWorld(true);
      const p=jointPose(1,time,landing,controls);
      expect(tailGapM(DEFAULT_EQUIPMENT,p.ankleHalfSeparationM,p.vAngleRad,state.skis.map(s=>s.heelAngleRad))).toBeGreaterThanOrEqual(.03-1e-10);
      // Precise bounds use the actual tapered tail vertices; transforming a
      // local AABB combines the tail x with the raised tip's y and overstates it.
      const left=new T.Box3().setFromObject(athlete.legs[0].ski.children[0],true);
      const right=new T.Box3().setFromObject(athlete.legs[1].ski.children[0],true);
      expect(right.min.z-left.max.z).toBeGreaterThanOrEqual(.03-1e-6);
      for(let j=0;j<2;j++) {
        const leg=athlete.legs[j],hip=world(leg.hip),knee=world(leg.knee),ankle=world(leg.ankle);
        expect(hip.distanceTo(knee)).toBeCloseTo(dimensions.thigh,10);
        expect(knee.distanceTo(ankle)).toBeCloseTo(dimensions.shin,10);
        expect(ankle.y).toBeCloseTo(.115,10);
        expect(ankle.z).toBeCloseTo(p.legs[j].ankleZ,10);
        const expected=legKneePosition(p,j);
        expect(knee.distanceTo(new T.Vector3(expected.x,expected.y,expected.z))).toBeLessThan(1e-10);
      }
    }
  });

  it('limits opening to a reachable leg stance for the largest permitted equipment configuration',()=>{
    const config=cloneEquipmentConfig();
    config.ski.lengthM=3.2;config.ski.widthM=.16;config.ski.minTailGapM=.2;config.ski.vAngleRad=.5;
    config.binding.frontSkiFraction=.4;config.binding.bootToePositionM=3.2*.6;
    const athlete=new Athlete(config);
    for(let i=0;i<=80;i++) {
      const time=i/100,p=jointPose(1,time,0,{equipment:config});
      athlete.pose(1,time,0);
      athlete.root.updateMatrixWorld(true);
      expect(p.vAngleRad).toBeLessThanOrEqual(config.ski.vAngleRad);
      expect(tailGapM(config,p.ankleHalfSeparationM,p.vAngleRad)).toBeGreaterThanOrEqual(.2-1e-9);
      for(const leg of p.legs)expect(Math.abs(leg.abduction)).toBeLessThanOrEqual(maxLegAbductionRad+1e-9);
      for(const leg of athlete.legs) {
        expect(world(leg.hip).distanceTo(world(leg.knee))).toBeCloseTo(dimensions.thigh,10);
        expect(world(leg.knee).distanceTo(world(leg.ankle))).toBeCloseTo(dimensions.shin,10);
      }
    }
    expect(jointPose(1,1,0,{equipment:config}).vAngleRad).toBeLessThan(.4);
  });

  it('keeps real mesh edges apart across laboratory incidence and asymmetric heel extremes',()=>{
    const athlete=new Athlete(),state=createBindingSystemState(),maxHeel=maximumHeelAngleRad();
    for(const pitch of [-.5,-.25,0,.25,.5])for(const heelPair of [[0,0],[maxHeel,0],[0,maxHeel],[maxHeel,maxHeel]])for(const spread of [0,.2,.5,.8,1]) {
      state.skis[0].heelAngleRad=heelPair[0];state.skis[1].heelAngleRad=heelPair[1];
      athlete.pose(1,1,0,{skiPitch:pitch,vSpread:spread,skiStates:state.skis});
      athlete.root.updateMatrixWorld(true);
      const left=new T.Box3().setFromObject(athlete.legs[0].ski.children[0],true);
      const right=new T.Box3().setFromObject(athlete.legs[1].ski.children[0],true);
      expect(right.min.z-left.max.z,`pitch=${pitch}, heel=${heelPair}, V=${spread}`).toBeGreaterThanOrEqual(.03-1e-6);
      for(const leg of athlete.legs)expect(world(leg.equipment.bootFront).distanceTo(world(leg.ski.getObjectByName(`${leg.equipment.side}-ski-front-attachment`)!))).toBeLessThan(1e-12);
    }
  });
});
