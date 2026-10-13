import {BODY_REFERENCE_AREA,BODY_REFERENCE_SPAN,dimensions} from '../athlete/pose';
/** SI units throughout. These reduced-order polars are engineering estimates,
 * not wind-tunnel calibration of a particular athlete or ski. */
export interface Vector3Like { x:number; y:number; z:number }
export interface AeroState {
  velocity:Vector3Like; wind:Vector3Like; pitch:number; roll:number; omega:number;
  bodyLean:number; vAngle:number;
  /** Each ski rotates about its front attachment relative to the boot. */
  skiAngles?:readonly [number,number];
}
export const G = 9.80665;
export const AIR_DENSITY = 1.225;
/** Estimated passive trim and damping; not inferred from the hill certificate. */
export const TRIM_INCIDENCE = 6.5*Math.PI/180;
export const wrapAngle = (angle:number) => Math.atan2(Math.sin(angle),Math.cos(angle));
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
/** Helmbold finite-span lifting-plate estimate. Body geometry has low aspect
 * ratio; it is not a high-aspect-ratio airfoil. This remains a reduced model. */
export function finiteSpanLiftSlope(span:number,area:number){
  const aspect=span*span/area;
  return 2*Math.PI*aspect/(2+Math.sqrt(4+aspect*aspect));
}
export function aerodynamicForces(s:AeroState, options:{density?:number;skiLength?:number;skiWidth?:number}={}) {
  const u={x:s.velocity.x-s.wind.x,y:s.velocity.y-s.wind.y,z:s.velocity.z-s.wind.z};
  const speed=Math.hypot(u.x,u.y,u.z), density=options.density??AIR_DENSITY;
  const q=speed<1e-6||density<=0?0:.5*density*speed*speed;
  const dot3=(a:Vector3Like,b:Vector3Like)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const rotate=(v:Vector3Like)=>{
    const x=Math.cos(s.pitch)*v.x-Math.sin(s.pitch)*v.y;
    const y=Math.sin(s.pitch)*v.x+Math.cos(s.pitch)*v.y;
    return {x,y:y*Math.cos(s.roll)-v.z*Math.sin(s.roll),z:y*Math.sin(s.roll)+v.z*Math.cos(s.roll)};
  };
  const angle=(chord:Vector3Like,normal:Vector3Like)=>Math.atan2(-dot3(u,normal),dot3(u,chord));
  const skiArea=(options.skiLength??dimensions.ski)*(options.skiWidth??.115);
  // Ry(V) Rz(binding) followed by the same Rx(roll) Rz(pitch) as the rig.
  // Each normal, chord and incidence is evaluated independently.
  const surfaces=[0,1].map(i=>{
    const heel=s.skiAngles?.[i]??0,v=(i===0?1:-1)*s.vAngle;
    const chord=rotate({x:Math.cos(v)*Math.cos(heel),y:Math.sin(heel),z:-Math.sin(v)*Math.cos(heel)});
    const normal=rotate({x:-Math.cos(v)*Math.sin(heel),y:Math.cos(heel),z:Math.sin(v)*Math.sin(heel)});
    return {angle:angle(chord,normal),chord,normal,area:skiArea,slope:3.5,cd0:.075};
  });
  const beta=Math.PI/2-s.bodyLean;
  const bodyChord=rotate({x:Math.cos(beta),y:Math.sin(beta),z:0});
  const bodyNormal=rotate({x:-Math.sin(beta),y:Math.cos(beta),z:0});
  surfaces.push({angle:angle(bodyChord,bodyNormal),chord:bodyChord,normal:bodyNormal,
    area:BODY_REFERENCE_AREA,slope:finiteSpanLiftSlope(BODY_REFERENCE_SPAN,BODY_REFERENCE_AREA),cd0:.16});
  const dir=speed>1e-6?{x:u.x/speed,y:u.y/speed,z:u.z/speed}:{x:1,y:0,z:0};
  const deployment=.88+.12*clamp(Math.abs(s.vAngle)/.25,0,1);
  const samples=surfaces.map(surface=>{
    const a=surface.angle,separated=clamp((Math.abs(a)-.35)/.35,0,1);
    const attached=clamp(surface.slope*a,-1.12,1.12);
    const cl=attached*(1-separated)+.85*Math.sin(2*a)*separated;
    const cd=surface.cd0+.10*cl*cl+.40*Math.sin(a)**2+.25*separated;
    const amount=q*surface.area*cl*deployment;
    const projection=dot3(surface.normal,dir);
    const axis={x:surface.normal.x-projection*dir.x,y:surface.normal.y-projection*dir.y,z:surface.normal.z-projection*dir.z};
    const length=Math.hypot(axis.x,axis.y,axis.z);
    const lift=length>1e-8?{x:amount*axis.x/length,y:amount*axis.y/length,z:amount*axis.z/length}:{x:0,y:0,z:0};
    const dragAmount=q*surface.area*cd;
    const drag={x:-dragAmount*dir.x,y:-dragAmount*dir.y,z:-dragAmount*dir.z};
    return {alpha:a,chord:surface.chord,normal:surface.normal,area:surface.area,cl,cd,lift,drag,
      force:{x:lift.x+drag.x,y:lift.y+drag.y,z:lift.z+drag.z},liftAmount:amount,dragAmount};
  });
  const sum=(key:'lift'|'drag'|'force'):Vector3Like=>samples.reduce((v,f)=>({x:v.x+f[key].x,y:v.y+f[key].y,z:v.z+f[key].z}),{x:0,y:0,z:0});
  const alpha=Math.atan2(Math.sin(samples[0].alpha)+Math.sin(samples[1].alpha),Math.cos(samples[0].alpha)+Math.cos(samples[1].alpha));
  const area=BODY_REFERENCE_AREA+2*skiArea,referenceLength=1.45;
  // Existing unvalidated whole-system moment about COM; no new tuned polar.
  const cm=q>0?-.055*Math.sin(2*(alpha-(TRIM_INCIDENCE+.25*(1.27-s.bodyLean))))-s.omega*referenceLength/(2*speed):0;
  return {drag:sum('drag'),lift:sum('lift'),force:sum('force'),moment:q*area*referenceLength*cm,
    airSpeed:speed,dynamicPressure:q,alpha,
    cl:q>0?samples.reduce((v,f)=>v+f.liftAmount,0)/(q*area):0,
    cd:q>0?samples.reduce((v,f)=>v+f.dragAmount,0)/(q*area):0,
    skis:[samples[0],samples[1]] as const,body:samples[2]};
}
