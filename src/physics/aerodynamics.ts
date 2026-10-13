/** SI units throughout. These reduced-order polars are engineering estimates,
 * not wind-tunnel calibration of a particular athlete or ski. */
export interface Vector3Like { x:number; y:number; z:number }
export interface AeroState {
  velocity:Vector3Like; wind:Vector3Like; pitch:number; roll:number; omega:number;
  bodyLean:number; vAngle:number;
}
export const G = 9.80665;
export const AIR_DENSITY = 1.225;
export const wrapAngle = (angle:number) => Math.atan2(Math.sin(angle),Math.cos(angle));
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
export function aerodynamicForces(s:AeroState, options:{density?:number}={}) {
  const u={x:s.velocity.x-s.wind.x,y:s.velocity.y-s.wind.y,z:s.velocity.z-s.wind.z};
  const speed=Math.hypot(u.x,u.y,u.z), density=options.density??AIR_DENSITY;
  const q=.5*density*speed*speed;
  const drag:Vector3Like={x:0,y:0,z:0},lift:Vector3Like={x:0,y:0,z:0};
  const chord={x:Math.cos(s.pitch),y:Math.sin(s.pitch)*Math.cos(s.roll),z:Math.sin(s.pitch)*Math.sin(s.roll)};
  const normal={x:-Math.sin(s.pitch),y:Math.cos(s.pitch)*Math.cos(s.roll),z:Math.cos(s.pitch)*Math.sin(s.roll)};
  const dot3=(a:Vector3Like,b:Vector3Like)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const alpha=Math.atan2(-dot3(u,normal),dot3(u,chord));
  if(speed<1e-6||density<=0)return {drag,lift,force:{x:0,y:0,z:0},moment:0,airSpeed:speed,dynamicPressure:0,alpha,cl:0,cd:0};
  const dir={x:u.x/speed,y:u.y/speed,z:u.z/speed};
  // Separate body and skis. Surface coefficients depend on incidence, not time.
  const beta=Math.PI/2-s.bodyLean;
  const bodyChord={x:chord.x*Math.cos(beta)+normal.x*Math.sin(beta),y:chord.y*Math.cos(beta)+normal.y*Math.sin(beta),z:chord.z*Math.cos(beta)+normal.z*Math.sin(beta)};
  const bodyNormal={x:-chord.x*Math.sin(beta)+normal.x*Math.cos(beta),y:-chord.y*Math.sin(beta)+normal.y*Math.cos(beta),z:-chord.z*Math.sin(beta)+normal.z*Math.cos(beta)};
  const bodyAngle=Math.atan2(-dot3(u,bodyNormal),dot3(u,bodyChord));
  const skiArea=2*2.6*.115, bodyArea=.70;
  const surfaces=[{angle:alpha,normal,area:skiArea,slope:3.5,cd0:.075},{angle:bodyAngle,normal:bodyNormal,area:bodyArea,slope:2.6,cd0:.16}];
  let totalLift=0,totalDrag=0;
  for(const surface of surfaces){
    const a=surface.angle, absolute=Math.abs(a);
    const separated=clamp((absolute-.35)/.35,0,1);
    const attached=clamp(surface.slope*a,-1.12,1.12);
    const cl=attached*(1-separated)+.85*Math.sin(2*a)*separated;
    const cd=surface.cd0+.10*cl*cl+.40*Math.sin(a)**2+.25*separated;
    const deployment=.88+.12*clamp(s.vAngle/.25,0,1);
    const amount=q*surface.area*cl*deployment;
    const projection=dot3(surface.normal,dir);
    const axis={x:surface.normal.x-projection*dir.x,y:surface.normal.y-projection*dir.y,z:surface.normal.z-projection*dir.z};
    const length=Math.hypot(axis.x,axis.y,axis.z);
    if(length>1e-8){lift.x+=amount*axis.x/length;lift.y+=amount*axis.y/length;lift.z+=amount*axis.z/length;}
    totalLift+=amount;
    totalDrag+=q*surface.area*cd;
  }
  drag.x=-totalDrag*dir.x;drag.y=-totalDrag*dir.y;drag.z=-totalDrag*dir.z;
  // Aerodynamic moment q*S*c*Cm; angular damping uses nondimensional rate.
  const area=bodyArea+skiArea,referenceLength=1.45;
  const cm=-.055*Math.sin(2*(alpha-(.18+.25*(1.27-s.bodyLean))))-3.0*s.omega*referenceLength/(2*speed);
  return {drag,lift,force:{x:drag.x+lift.x,y:drag.y+lift.y,z:drag.z+lift.z},moment:q*area*referenceLength*cm,
    airSpeed:speed,dynamicPressure:q,alpha,cl:totalLift/(q*area),cd:totalDrag/(q*area)};
}
