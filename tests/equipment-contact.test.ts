import {describe,expect,it} from 'vitest';
import * as T from 'three';
import {Athlete} from '../src/athlete/rig';
import {jointPose} from '../src/athlete/pose';
import {DEFAULT_EQUIPMENT,cloneEquipmentConfig} from '../src/equipment/config';
import {sampleSkiContact,skiProfileAt,SKI_PROFILE_SECTIONS} from '../src/equipment/contact';
import {createBindingSystemState,maximumHeelAngleRad} from '../src/equipment/model';
import {centerOfMassOffset} from '../src/physics/biomechanics';

describe('contact samples match the actual rendered skis',()=>{
  it('shares every sole section with the 3D mesh, including a changed toe mounting position',()=>{
    const config=cloneEquipmentConfig();
    config.binding.frontSkiFraction=.52;config.binding.bootToePositionM=config.ski.lengthM*(1-.52);
    const athlete=new Athlete(config),surface=athlete.legs[0].ski.children[0] as T.Mesh;
    const vertices=surface.geometry.getAttribute('position');
    for(let section=0;section<=SKI_PROFILE_SECTIONS;section++) {
      const profile=skiProfileAt(config,config.ski.lengthM*section/SKI_PROFILE_SECTIONS);
      expect(vertices.getX(section*4)).toBeCloseTo(profile.x,6);
      expect(vertices.getY(section*4)).toBeCloseTo(profile.yBottom,6);
      expect(vertices.getZ(section*4)).toBeCloseTo(-profile.halfWidth,6);
      expect(vertices.getZ(section*4+1)).toBeCloseTo(profile.halfWidth,6);
    }
  });

  it('finds the same minimum clearance as transformed mesh vertices across body, V and binding poses',()=>{
    const athlete=new Athlete(),state=createBindingSystemState(),limit=maximumHeelAngleRad();
    const rootPosition={x:4,y:8,z:-.3},surface=(x:number,z:number)=>.16*x+.08*z-3;
    for(const [extension,flight,landing] of [[0,0,0],[1,0,0],[1,.24,0],[1,1,0],[1,2,.55],[1,3,1]])for(const [pitch,roll] of [[-.55,.12],[.18,-.09],[0,0]])for(const heels of [[0,0],[limit*.8,limit*.3]]) {
      state.skis[0].heelAngleRad=heels[0];state.skis[1].heelAngleRad=heels[1];
      const controls={skiPitch:.07,skiStates:state.skis};
      athlete.pose(extension,flight,landing,controls);
      athlete.root.position.set(rootPosition.x,rootPosition.y,rootPosition.z);
      athlete.root.rotation.set(roll,0,pitch,'XYZ');
      athlete.root.updateMatrixWorld(true);
      const pose=jointPose(extension,flight,landing,controls);
      const sample=sampleSkiContact(DEFAULT_EQUIPMENT,pose,pitch,roll,rootPosition,heels,surface);
      let minimum=Infinity;
      for(const leg of athlete.legs) {
        const ski=leg.ski.children[0] as T.Mesh,vertices=ski.geometry.getAttribute('position');
        for(let section=0;section<=SKI_PROFILE_SECTIONS;section++)for(const edge of [0,1]) {
          const i=section*4+edge;
          const point=new T.Vector3(vertices.getX(i),vertices.getY(i),vertices.getZ(i)).applyMatrix4(ski.matrixWorld);
          minimum=Math.min(minimum,point.y-surface(point.x,point.z));
        }
      }
      expect(sample.minimumClearanceM).toBeCloseTo(minimum,6);
      expect(sample.point.y-sample.surfacePoint.y).toBe(sample.minimumClearanceM);
      expect(sample.skiIndex).toBeGreaterThanOrEqual(0);expect(sample.skiIndex).toBeLessThan(2);
    }
  });

  it('detects the heel-loaded ski tail before a level boot datum crosses the surface',()=>{
    const pose=jointPose(1,1,0),root={x:0,y:0,z:0};
    const neutral=sampleSkiContact(DEFAULT_EQUIPMENT,pose,0,0,root,[0,0],()=>0);
    const liftedHeel=sampleSkiContact(DEFAULT_EQUIPMENT,pose,0,0,root,[.1,0],()=>0);
    expect(neutral.minimumClearanceM).toBeCloseTo(0,12);
    expect(liftedHeel.minimumClearanceM).toBeLessThan(-.08);
    expect(liftedHeel.skiIndex).toBe(0);
    expect(liftedHeel.section).toBeLessThan(4);
    const moved=sampleSkiContact(DEFAULT_EQUIPMENT,pose,0,0,{...root,y:.5},[.1,0],()=>0);
    expect(moved.minimumClearanceM-liftedHeel.minimumClearanceM).toBeCloseTo(.5,12);
  });

  it('keeps flat sole portions on a sloped plane when the physical body pitch follows it',()=>{
    const slope=.25,pitch=Math.atan(slope),pose=jointPose(0,0,0);
    const sample=sampleSkiContact(DEFAULT_EQUIPMENT,pose,pitch,0,{x:0,y:0,z:0},[0,0],x=>x*slope);
    expect(sample.minimumClearanceM).toBeCloseTo(0,12);
  });
});

describe('COM uses the actual total mass',()=>{
  it('changes the segment/equipment weighting with body mass and rejects impossible totals',()=>{
    const light=centerOfMassOffset(1,1,0,1.27,{totalMassKg:55});
    const heavy=centerOfMassOffset(1,1,0,1.27,{totalMassKg:95});
    expect(heavy.y).toBeGreaterThan(light.y+.025);
    expect(()=>centerOfMassOffset(1,1,0,1.27,{totalMassKg:8})).toThrow(/positive body mass/);
    expect(()=>centerOfMassOffset(1,1,0,1.27,{totalMassKg:NaN})).toThrow();
    expect(centerOfMassOffset(1,1,0)).toEqual(centerOfMassOffset(1,1,0,1.27,{totalMassKg:78}));
  });
});
