import {describe,it,expect} from 'vitest';
import {DEFAULT_EQUIPMENT,cloneEquipmentConfig,freezeEquipmentConfig,setBindingFraction,validateEquipmentConfig,assertCompetitionEquipment,mountingMeasurement} from '../src/equipment/config';
import {skiProperties,heelGeometry,maximumHeelAngleRad,requiredAnkleHalfSeparation,tailGapM,skiPressureTorqueNm,effectiveAngularStiffness} from '../src/equipment/model';

describe('ski dimensions and mounting',()=>{
  it('measures the requested 57% to the boot toe, separately from the ankle and front pivot',()=>{
    const config=cloneEquipmentConfig(),m=mountingMeasurement(config);
    expect(validateEquipmentConfig(config,{competition:true})).toEqual({valid:true,errors:[]});
    expect(m.frontLengthM).toBeCloseTo(1.482,12);
    expect(m.rearLengthM).toBeCloseTo(1.118,12);
    expect(m.frontLengthRoundedCm).toBe(148);
    expect(m.ankleFromTailM).toBeCloseTo(.938,12);
    expect(m.frontAttachmentFromTailM).toBeCloseTo(1.093,12);
    expect(m.ankleFromTailM).not.toBe(m.rearLengthM);
    expect(m.frontAttachmentFromTailM).not.toBe(m.rearLengthM);
  });
  it('rejects a competition mount over 57%, including values hidden by centimetre rounding',()=>{
    const illegal=setBindingFraction(DEFAULT_EQUIPMENT,.5701);
    expect(mountingMeasurement(illegal).frontLengthRoundedCm).toBe(148);
    expect(validateEquipmentConfig(illegal).valid).toBe(true);
    expect(validateEquipmentConfig(illegal,{competition:true}).valid).toBe(false);
    expect(()=>assertCompetitionEquipment(illegal)).toThrow(/57%/);
    const inconsistent=cloneEquipmentConfig();inconsistent.binding.bootToePositionM+=.1;
    expect(validateEquipmentConfig(inconsistent).valid).toBe(false);
  });
  it('derives mass and inertia from a mass distribution rather than a geometric midpoint',()=>{
    const p=skiProperties();
    expect(p.massKg).toBe(2.2);
    expect(p.areaM2).toBeCloseTo(.299,12);
    expect(p.centerOfMass.x+DEFAULT_EQUIPMENT.binding.bootToePositionM).toBeCloseTo(.487*2.6,12);
    expect(p.pitchInertiaAboutFrontKgM2).toBeGreaterThan(p.pitchInertiaKgM2);
    expect(p.rollInertiaKgM2).toBeLessThan(p.pitchInertiaKgM2);
    const uniform=cloneEquipmentConfig();
    uniform.ski.massDistribution=[{startFraction:0,endFraction:1,massFraction:1}];
    expect(skiProperties(uniform).pitchInertiaKgM2).toBeCloseTo(2.2*(2.6**2+.021**2)/12,12);
    uniform.ski.massDistribution[0].massFraction=.9;
    expect(validateEquipmentConfig(uniform).valid).toBe(false);
  });
  it('moves the mount and changes the measured force arm when the mounting fraction changes',()=>{
    const original=cloneEquipmentConfig(),moved=setBindingFraction(original,.55);
    const force={x:0,y:100};
    expect(mountingMeasurement(moved).frontAttachmentFromTailM-mountingMeasurement(original).frontAttachmentFromTailM).toBeCloseTo(.052,12);
    expect(skiPressureTorqueNm(original,0,force)-skiPressureTorqueNm(moved,0,force)).toBeCloseTo(5.2,10);
    expect(skiProperties(original).pitchInertiaAboutFrontKgM2).not.toBe(skiProperties(moved).pitchInertiaAboutFrontKgM2);
    expect(original.binding.frontSkiFraction).toBe(.57);
  });
  it('freezes a validated attempt snapshot independently of later preview changes',()=>{
    const preview=cloneEquipmentConfig(),attempt=freezeEquipmentConfig(preview,{competition:true});
    preview.ski.massKg=3;
    preview.ski.massDistribution[0].massFraction=.4;
    expect(attempt.ski.massKg).toBe(2.2);
    expect(attempt.ski.massDistribution[0].massFraction).toBe(.31);
    expect(Object.isFrozen(attempt)).toBe(true);
    expect(Object.isFrozen(attempt.ski.massDistribution[0])).toBe(true);
    expect(()=>freezeEquipmentConfig(setBindingFraction(preview,.58),{competition:true})).toThrow();
  });
});

describe('front attachment, rear rod and V geometry',()=>{
  it('keeps the front pivot fixed while the heel follows the rod-defined range',()=>{
    const config=cloneEquipmentConfig(),limit=maximumHeelAngleRad(config),neutral=heelGeometry(config,0);
    const end=heelGeometry(config,limit);
    expect(neutral.rodLengthM).toBeCloseTo(Math.hypot(.020,.014),12);
    expect(end.frontPoint).toEqual(neutral.frontPoint);
    expect(end.rearSkiPoint).toEqual(neutral.rearSkiPoint);
    expect(end.rodLengthM).toBeCloseTo(config.binding.rodMaxLengthM,12);
    expect(end.heelRiseM).toBeGreaterThan(.035);
    expect(end.heelRiseM).toBeLessThan(.09);
    expect(heelGeometry(config,limit+.001).rodLengthM).toBeGreaterThan(config.binding.rodMaxLengthM);
    config.binding.rodMaxLengthM=.05;
    expect(maximumHeelAngleRad(config)).toBeLessThan(limit);
    expect(effectiveAngularStiffness(config)).toBe(90);
    config.binding.bootSoleAngularStiffnessNmPerRad=90;
    expect(effectiveAngularStiffness(config)).toBe(60);
  });
  it('preserves at least 3cm clearance for both independent heels throughout V opening',()=>{
    const config=cloneEquipmentConfig(),maxHeel=maximumHeelAngleRad(config);
    for(let i=0;i<=50;i++) {
      const angle=config.ski.vAngleRad*i/50,half=requiredAnkleHalfSeparation(config,angle);
      for(let j=0;j<=16;j++) {
        const heels=[maxHeel*j/16,maxHeel*(16-j)/16];
        for(const bootPitch of [-.5,-.25,0,.25,.5])
          expect(tailGapM(config,half,angle,heels,bootPitch)).toBeGreaterThanOrEqual(config.ski.minTailGapM-1e-12);
      }
    }
    expect(requiredAnkleHalfSeparation(config,.25)).toBeGreaterThan(.29);
    expect(requiredAnkleHalfSeparation(config,.25)).toBeLessThan(.32);
  });
  it('accounts for a different ski length, width and mount instead of hardcoded V offsets',()=>{
    const config=cloneEquipmentConfig(),base=requiredAnkleHalfSeparation(config,.25);
    config.ski.widthM=.14;
    expect(requiredAnkleHalfSeparation(config,.25)).toBeGreaterThan(base);
    config.ski.lengthM=2.9;
    const longer=setBindingFraction(config,.57);
    expect(requiredAnkleHalfSeparation(longer,.25)).toBeGreaterThan(requiredAnkleHalfSeparation(config,.25));
    const rearward=setBindingFraction(longer,.55);
    expect(requiredAnkleHalfSeparation(rearward,.25)).toBeGreaterThan(requiredAnkleHalfSeparation(longer,.25));
  });
});
