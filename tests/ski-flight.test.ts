import {describe,it,expect} from 'vitest';
import {Simulation,DT,FixedClock} from '../src/physics/simulation';
import {aerodynamicForces} from '../src/physics/aerodynamics';
import {DEFAULT_EQUIPMENT,setBindingFraction,cloneEquipmentConfig} from '../src/equipment/config';
import {sampleSkiContact} from '../src/equipment/contact';
import {jointPose} from '../src/athlete/pose';
import {landing} from '../src/world/hill';
import {maximumHeelAngleRad,pitchAngularMomentum,rotationalEnergy} from '../src/equipment/model';

const airborne=(equipment=DEFAULT_EQUIPMENT)=>{
  const s=new Simulation({equipment});
  s.setAirborne({x:40,y:1000,vx:27,vy:0,pitch:.17});
  s.flightTime=1;s.extension=1;
  return s;
};

describe('independent skis in the live flight solver',()=>{
  it('transfers real pressure-arm torques through both front attachments',()=>{
    const a=airborne(),b=airborne(setBindingFraction(DEFAULT_EQUIPMENT,.52));
    a.step();b.step();
    expect(a.skiBindings.skis[0].aeroPitchTorqueNm).toBeGreaterThan(0);
    expect(a.skiBindings.skis[0].heelAngleRad).toBeGreaterThan(0);
    expect(Math.abs(a.skiBindings.skis[0].aeroPitchTorqueNm-b.skiBindings.skis[0].aeroPitchTorqueNm)).toBeGreaterThan(5);
    expect(a.skiBindings.skis[0].reactionTorqueNm).not.toBe(0);
    expect(a.skiBindings.bodyPitchRad).toBe(a.pitch);
  });
  it('keeps asymmetric ski motion finite and inside the mechanical rod limits',()=>{
    const s=airborne();s.crossWind=3;s.roll=.2;
    for(let i=0;i<90;i++)s.step();
    const max=maximumHeelAngleRad(s.equipment);
    for(const ski of s.skiBindings.skis){
      expect(ski.heelAngleRad).toBeGreaterThanOrEqual(0);
      expect(ski.heelAngleRad).toBeLessThanOrEqual(max+1e-12);
      expect(ski.rodLengthM).toBeLessThanOrEqual(s.equipment.binding.rodMaxLengthM+1e-12);
      expect(Object.values(ski).every(Number.isFinite)).toBe(true);
    }
    expect(Math.abs(s.skiBindings.skis[0].heelAngleRad-s.skiBindings.skis[1].heelAngleRad)).toBeGreaterThan(1e-6);
  });
  it('passive binding motion cannot add translation or angular momentum in vacuum',()=>{
    const s=new Simulation({airDensity:0,gravity:0});
    s.setAirborne({x:40,y:1000,vx:12,vy:3});
    s.skiBindings.skis.forEach((ski,i)=>{ski.heelAngleRad=i===0?.12:.05;ski.absolutePitchRad=s.pitch+ski.heelAngleRad;});
    const momentum=pitchAngularMomentum(s.skiBindings,s.bodyPitchInertia,s.equipment);
    let energy=rotationalEnergy(s.skiBindings,s.bodyPitchInertia,s.equipment);
    for(let i=0;i<120;i++){
      s.step();
      expect(pitchAngularMomentum(s.skiBindings,s.bodyPitchInertia,s.equipment)).toBeCloseTo(momentum,10);
      const next=rotationalEnergy(s.skiBindings,s.bodyPitchInertia,s.equipment);
      expect(next).toBeLessThanOrEqual(energy+1e-10);energy=next;
    }
    expect(s.vx).toBe(12);expect(s.vy).toBe(3);
    expect(s.comX).toBeCloseTo(52,9);expect(s.comY).toBeCloseTo(1003,8);
  });
  it('freezes an independent legal equipment snapshot for the attempt',()=>{
    const input=setBindingFraction(DEFAULT_EQUIPMENT,.52),s=airborne(input);
    input.binding.frontSkiFraction=.7;
    expect(s.equipment.binding.frontSkiFraction).toBe(.52);
    expect(Object.isFrozen(s.equipment.binding)).toBe(true);
    expect(()=>new Simulation({equipment:input})).toThrow();
    s.reset();expect(s.equipment.binding.frontSkiFraction).toBe(.52);
  });
  it('repeats both ski states across different presentation frame partitions',()=>{
    const run=(fps:number)=>{
      const s=new Simulation();s.reset(true);const c=new FixedClock();
      for(let i=0;i<12*fps;i++)c.advance(1/fps,()=>s.step());
      return {snapshot:s.snapshot(),bindings:s.skiBindings};
    };
    expect(run(30)).toEqual(run(144));
  });
  it('does not reset heel angles when the first ski-datum contact is detected',()=>{
    const s=new Simulation();s.reset(true);
    let heels:number[]=[];
    while(s.phase==='inrun'||s.phase==='flight'){
      heels=s.skiBindings.skis.map(ski=>ski.heelAngleRad);s.step();
    }
    expect(['landed','fallen']).toContain(s.phase);
    s.skiBindings.skis.forEach((ski,i)=>expect(Math.abs(ski.heelAngleRad-heels[i])).toBeLessThan(.01));
    const atContact=s.skiBindings.skis.map(ski=>ski.heelAngleRad);
    s.step();
    s.skiBindings.skis.forEach((ski,i)=>expect(Math.abs(ski.heelAngleRad-atContact[i])).toBeLessThan(.01));
  });
  it('does not reinterpret the trailing ski at the table as a landing hill contact',()=>{
    const s=new Simulation();s.reset(true);
    while(s.phase==='inrun')s.step();
    for(let i=0;i<6;i++)s.step();
    expect(s.phase).toBe('flight');expect(s.landingContact).toBeNull();
    expect(s.landingPose).toBe(0);
  });
  it('aligns ground skis with finite angular velocity and keeps the whole sole above snow',()=>{
    const s=new Simulation();s.reset(true);
    while(s.phase==='inrun'||s.phase==='flight')s.step();
    for(let i=0;i<30;i++){
      const previous=s.pitch;s.step();
      expect((s.pitch-previous)/DT).toBeCloseTo(s.omega,10);
      expect(Math.abs(s.pitch-previous)).toBeLessThan(.01);
      const pose=jointPose(s.extension,s.flightTime,s.landingPose,{bodyLean:s.bodyLean,equipment:s.equipment,
        skiStates:s.skiBindings.skis,totalMassKg:s.mass,groundedSeconds:s.aftermathTime,impactSpeed:s.impact});
      const contact=sampleSkiContact(s.equipment,pose,s.pitch,s.roll,{x:s.x,y:s.y,z:s.z},s.skiBindings.skis.map(ski=>ski.heelAngleRad),x=>x<0?null:landing(x));
      expect(Math.abs(contact.minimumClearanceM)).toBeLessThan(1e-8);
    }
  });
  it('derives total mass from configured ski masses without changing the athlete mass',()=>{
    const gear=cloneEquipmentConfig();gear.ski.massKg=3;
    const heavier=new Simulation({equipment:gear}),nominal=new Simulation();
    expect(heavier.mass).toBeCloseTo(79.6,12);
    expect(heavier.bodyPitchInertia).toBeCloseTo(nominal.bodyPitchInertia,12);
    const remounted=new Simulation({equipment:setBindingFraction(DEFAULT_EQUIPMENT,.52)});
    expect(remounted.bodyPitchInertia).toBe(nominal.bodyPitchInertia);
  });
});

describe('per-ski aerodynamic evaluation',()=>{
  const state={velocity:{x:27,y:0,z:0},wind:{x:0,y:0,z:0},pitch:.17,roll:0,omega:0,bodyLean:1.27,vAngle:.25};
  it('sums two independent forces and keeps lift perpendicular to relative air velocity',()=>{
    const f=aerodynamicForces({...state,skiAngles:[.04,.12]});
    expect(f.skis[0].alpha).not.toBe(f.skis[1].alpha);
    for(const axis of ['x','y','z'] as const)
      expect(f.force[axis]).toBeCloseTo(f.skis[0].force[axis]+f.skis[1].force[axis]+f.body.force[axis],12);
    for(const ski of f.skis){expect(ski.lift.x).toBeCloseTo(0,10);expect(ski.drag.x).toBeLessThan(0);}
  });
  it('V yaw changes independent ski force directions without an invented lift multiplier correction',()=>{
    const f=aerodynamicForces({...state,skiAngles:[.08,.08]});
    expect(f.skis[0].lift.z).toBeCloseTo(-f.skis[1].lift.z,12);
    expect(Math.abs(f.skis[0].lift.z)).toBeGreaterThan(0);
    expect(f.force.z).toBeCloseTo(0,12);
  });
});
