import {height,slope,landing,landingSlope,inrunCurvature,gatePosition,certificate,pisteWidth,distanceAt,hill} from '../world/hill';
import type {Gesture} from '../input/gesture';
import {aerodynamicForces,G,AIR_DENSITY,wrapAngle} from './aerodynamics';
import {centerOfMassOffset,extensionAtHeight,rotatedOffset} from './biomechanics';
import {jointPose} from '../athlete/pose';
export const DT=1/120;
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
interface Options {mass?:number;airDensity?:number;gravity?:number;gate?:number}
export class Simulation {
  readonly mass:number;readonly airDensity:number;readonly gravity:number;
  x=gatePosition(certificate.inrun.gates).x;y=height(this.x);z=0;v=0;vx=0;vy=0;vz=0;
  comX=0;comY=0;comZ=0;
  pitch=Math.atan(slope(this.x));omega=0;roll=0;rollRate=0;
  extension=0;extensionRate=0;target=0;stroke=0;effort=0;eccentricity=0;
  normalVelocity=0;normalForce=0;takeoffImpulse=0;muscleWork=0;
  gestureDuration=0;gestureSpeed=0;private gestureUp=0;private gestureSide=0;
  flightTime=0;time=0;phase='ready';demo=false;wind=0;crossWind=0;impact=0;
  bodyLean=1.27;skiPitch=0;pilotBank=0;landingPose=0;resultDistance=0;aftermathTime=0;
  private contactHeight=centerOfMassOffset(0).y;
  private options:Options;
  aero={lift:0,drag:0,alpha:0};
  constructor(options:Options={}){
    this.options=options;this.mass=options.mass??78;this.airDensity=options.airDensity??AIR_DENSITY;this.gravity=options.gravity??G;
    const start=gatePosition(options.gate??certificate.inrun.gates);this.x=start.x;this.y=start.y;this.pitch=Math.atan(slope(this.x));
    this.updateContactCom();
  }
  reset(demo=false){const options=this.options,wind=this.wind,crossWind=this.crossWind;Object.assign(this,new Simulation(options));this.wind=wind;this.crossWind=crossWind;this.demo=demo;this.phase='inrun';}
  gesture(g:Gesture){
    if(this.phase!=='inrun'||this.x<-8||!Number.isFinite(g.up+g.side+g.duration)||g.duration<=0)return;
    this.gestureDuration+=g.duration;this.gestureUp+=Math.max(0,g.up);this.gestureSide+=g.side;
    this.stroke=clamp(this.stroke+g.up/120,0,1.8);this.target=clamp(this.stroke,0,1);
    this.gestureSpeed=this.gestureUp/this.gestureDuration;
    this.effort=this.gestureSpeed/600;
    this.eccentricity=clamp(this.gestureSide/100,-1,1);
  }
  trim(up:number,side:number){
    if(this.phase!=='flight')return;
    this.bodyLean=clamp(this.bodyLean+up*.001,1.05,1.42);
    this.pilotBank=clamp(this.pilotBank+side*.001,-.3,.3);
  }
  /** Test/replay entry: x/y/z are physical COM coordinates, velocity is m/s. */
  setAirborne(s:{x:number;y:number;z?:number;vx:number;vy:number;vz?:number;pitch?:number;omega?:number}){
    this.comX=s.x;this.comY=s.y;this.comZ=s.z??0;this.vx=s.vx;this.vy=s.vy;this.vz=s.vz??0;
    this.pitch=s.pitch??0;this.omega=s.omega??0;this.phase='flight';this.flightTime=0;this.updateSkiDatum();
  }
  private updateContactCom(){const groundResult=this.phase==='landed'||this.phase==='fallen';const o=rotatedOffset(this.extension,groundResult?this.flightTime:0,groundResult?this.landingPose:0,this.bodyLean,this.pitch);this.comX=this.x+o.x;this.comY=this.y+o.y;this.comZ=this.z+o.z;}
  private updateSkiDatum(){const o=rotatedOffset(this.extension,this.flightTime,this.landingPose,this.bodyLean,this.pitch,this.roll);this.x=this.comX-o.x;this.y=this.comY-o.y;this.z=this.comZ-o.z;}
  private launch(){
    const a=Math.atan(slope(Math.min(0,this.x)));
    this.updateContactCom();this.vx=this.v*Math.cos(a)-this.normalVelocity*Math.sin(a);
    this.vy=this.v*Math.sin(a)+this.normalVelocity*Math.cos(a);this.vz=this.eccentricity*.35;
    this.takeoffImpulse=this.mass*this.normalVelocity;this.phase='flight';this.flightTime=0;this.normalForce=0;
  }
  step(){
    if(this.phase==='ready'||this.phase==='invalid')return;
    this.time+=DT;
    if(this.phase==='landed'||this.phase==='fallen'){this.stepOutrun();return;}
    if(this.phase==='inrun')this.stepContact();else this.stepFlight();
    if(![this.x,this.y,this.z,this.vx,this.vy,this.vz,this.pitch,this.omega].every(Number.isFinite))this.phase='invalid';
  }
  private stepContact(){
    const angle=Math.atan(slope(this.x));this.pitch=angle;
    const drag=.5*this.airDensity*.22*this.v*this.v;
    this.v+=(-this.gravity*Math.sin(angle)-.02*this.gravity*Math.cos(angle)-drag/this.mass)*DT;
    if(this.demo&&this.x>-6.5)this.gesture({up:500*DT,side:0,duration:DT});
    const h0=centerOfMassOffset(0).y,h1=centerOfMassOffset(1).y;
    const wantedH=centerOfMassOffset(this.target).y;
    const commandVelocity=clamp(this.gestureSpeed/120*(h1-h0),0,4.1);
    // A muscle-actuated prismatic leg model: N=m(g_n+curvature+dh²/dt²).
    // Maximum force/work limit the actuator; extension is inverse FK of COM rise.
    const desiredVelocity=Math.min(Math.max(0,(wantedH-this.contactHeight)/.045),commandVelocity);
    const desiredAcceleration=(desiredVelocity-this.normalVelocity)/.040;
    const curvature=inrunCurvature(this.x);
    const baseline=this.gravity*Math.cos(angle)+this.v*this.v*curvature;
    const maxForce=this.mass*this.gravity*3.4;
    const rawForce=this.mass*(baseline+desiredAcceleration);
    if(rawForce<0&&this.normalVelocity>.35){this.launch();return;}
    this.normalForce=clamp(rawForce,0,maxForce);
    const acceleration=this.normalForce/this.mass-baseline;
    this.normalVelocity=Math.max(0,this.normalVelocity+acceleration*DT);
    const previous=this.extension;
    this.contactHeight=clamp(this.contactHeight+this.normalVelocity*DT,h0,h1);
    this.extension=extensionAtHeight(this.contactHeight);
    this.extensionRate=(this.extension-previous)/DT;
    this.muscleWork+=Math.max(0,this.normalForce*this.normalVelocity*DT);
    const aggressive=Math.max(0,this.effort-1)+Math.max(0,this.stroke-1)*1.7;
    const lever=this.stroke>0?clamp(.004-.085*aggressive,-.18,.04):0;
    const moment=this.normalForce*lever;
    this.omega+=moment/18*DT;
    this.rollRate+=this.normalForce*this.eccentricity*.045/18*DT;
    this.x+=this.v*Math.cos(angle)*DT;this.y=height(Math.min(0,this.x));
    this.updateContactCom();
    if(this.x>=0){this.x=0;this.y=0;this.launch();}
    else if(this.extension>.999&&this.normalVelocity>.35)this.launch();
  }
  private stepFlight(){
    this.flightTime+=DT;
    // Completing extension aloft changes the pose about fixed COM; no extra impulse.
    this.extension=clamp(this.extension+Math.max(0,this.extensionRate)*Math.exp(-this.flightTime/.12)*DT,0,Math.max(this.extension,this.target));
    const pose=jointPose(this.extension,this.flightTime,this.landingPose,{bodyLean:this.bodyLean});
    const f=aerodynamicForces({velocity:{x:this.vx,y:this.vy,z:this.vz},wind:{x:this.wind,y:0,z:this.crossWind},pitch:this.pitch,roll:this.roll,omega:this.omega,bodyLean:pose.trunkLean,vAngle:.25*pose.v},{density:this.airDensity});
    this.aero={lift:Math.hypot(f.lift.x,f.lift.y,f.lift.z),drag:Math.hypot(f.drag.x,f.drag.y,f.drag.z),alpha:f.alpha};
    const before={x:this.x,y:this.y,z:this.z};
    this.vx+=f.force.x/this.mass*DT;
    this.vy+=(-this.gravity+f.force.y/this.mass)*DT;
    this.vz+=f.force.z/this.mass*DT;
    this.comX+=this.vx*DT;this.comY+=this.vy*DT;this.comZ+=this.vz*DT;
    this.omega+=f.moment/18*DT;this.pitch+=this.omega*DT;
    const bankMoment=f.dynamicPressure*.6*1.45*(-.012*Math.sin(2*this.roll)+.06*(this.pilotBank-this.roll)-.6*this.rollRate*1.45/(2*Math.max(.1,f.airSpeed)));
    this.rollRate+=bankMoment/14*DT;this.roll+=this.rollRate*DT;
    this.updateSkiDatum();
    const surface=(x:number)=>x<0?height(x):landing(x);
    const clearance=this.y-surface(this.x);
    if(this.x>=0){const normalSpeed=Math.max(.1,Math.abs(this.vy-landingSlope(this.x)*this.vx));this.landingPose=clamp(1-clearance/(normalSpeed*.38),0,1);}
    if(clearance<=0&&(this.x>0||this.flightTime>.10)){
      // First crossing at ski datum; interpolate along this step to avoid tunnelling.
      const oldClear=before.y-surface(before.x);const t=clamp(oldClear/(oldClear-clearance),0,1);
      this.x=before.x+(this.x-before.x)*t;this.z=before.z+(this.z-before.z)*t;
      this.y=surface(this.x);const tangent=this.x<0?slope(this.x):landingSlope(this.x);
      this.impact=Math.abs((this.vy-tangent*this.vx)/Math.hypot(1,tangent));
      const angleError=Math.abs(wrapAngle(this.pitch-Math.atan(tangent)));
      const absorptionCapacity=this.mass*this.gravity*4*.45;
      const normalEnergy=.5*this.mass*this.impact*this.impact;
      const inPiste=Math.abs(this.z)<pisteWidth(this.x)/2;
      this.phase=this.x>0&&inPiste&&angleError<.55&&Math.abs(this.roll)<.4&&Math.abs(this.omega)<2.6&&normalEnergy<=absorptionCapacity?'landed':'fallen';
      this.resultDistance=distanceAt(this.x);
      // Inelastic normal impulse: dissipate normal kinetic energy instead of turning it into forward speed.
      this.v=Math.max(0,(this.vx+tangent*this.vy)/Math.hypot(1,tangent));this.landingPose=1;
      this.vx=this.v/Math.hypot(1,tangent);this.vy=this.vx*tangent;this.vz=0;
    }
  }
  private stepOutrun(){
    this.aftermathTime+=DT;
    const tangent=this.x<0?slope(this.x):landingSlope(this.x),angle=Math.atan(tangent);
    // Reduced automatic braking on the outrun; not a measured snow coefficient.
    const braking=clamp((this.x-hill.points.U.x)/15,0,1);
    const friction=this.phase==='fallen'?.45:.055+.245*braking;
    this.v=Math.max(0,this.v+(-this.gravity*Math.sin(angle)-friction*this.gravity*Math.cos(angle)-.5*this.airDensity*.55*this.v*this.v/this.mass)*DT);
    this.x+=this.v*Math.cos(angle)*DT;this.y=this.x<0?height(this.x):landing(this.x);
    this.pitch=angle;this.landingPose=1;this.updateContactCom();
  }
  snapshot(){return {x:this.x,y:this.y,z:this.z,pitch:this.pitch,roll:this.roll,extension:this.extension,phase:this.phase,flightTime:this.flightTime,comX:this.comX,comY:this.comY}}
}
export class FixedClock {
  accumulator=0;
  advance(seconds:number,step:()=>void){this.accumulator+=Math.max(0,Math.min(seconds,.25));while(this.accumulator+1e-12>=DT){step();this.accumulator-=DT;}}
}
