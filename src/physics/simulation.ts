import {height,slope,landing,landingSlope} from '../world/hill';
import type {Gesture} from '../input/gesture';
export const DT=1/120;
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
export class Simulation {
 x=-40;y=height(-40);z=0;v=12;vx=0;vy=0;vz=0;pitch=Math.atan(slope(-40));omega=0;roll=0;rollRate=0;
 extension=0;extensionRate=0;target=0;stroke=0;effort=0;eccentricity=0;normalVelocity=0;flightTime=0;time=0;phase='ready';demo=false;wind=0;impact=0;
 reset(demo=false){Object.assign(this,new Simulation());this.demo=demo;this.phase='inrun'}
 gesture(g:Gesture){if(this.phase!=='inrun'||this.x < -8)return;this.stroke=clamp(this.stroke+g.up/120,0,1.6);this.target=clamp(this.stroke,0,1);this.effort=clamp(Math.max(0,g.up)/g.duration/600,0,2);this.eccentricity=clamp(this.eccentricity+g.side/100,-1,1);}
 step(){if(this.phase==='ready'||this.phase==='landed'||this.phase==='fallen')return;this.time+=DT;
 if(this.phase==='inrun'){
 const angle=Math.atan(slope(this.x));this.v+=(-9.81*Math.sin(angle)-.02*9.81*Math.cos(angle)-.5*1.225*.22*this.v*this.v/78)*DT;
 if(this.demo&&this.x>-7){this.target=clamp((this.x+7)/6,0,1);this.effort=.8;}
 const previous=this.extension;const acceleration=clamp(70*(this.target-this.extension)-14*this.extensionRate,-18,18);this.extensionRate=clamp(this.extensionRate+acceleration*DT,0,3.5);this.extension=clamp(this.extension+this.extensionRate*DT,0,1);
 // Incremental COM rise produces normal momentum; excess effort changes reaction line.
 const rise=(this.extension-previous)*.48;const force=78*rise/DT*6;
 this.normalVelocity+=rise*6;
 const lever=.006-.045*Math.max(0,this.effort-1)-.06*Math.max(0,this.stroke-1);
 this.omega+=force*lever/18*DT;this.rollRate+=force*this.eccentricity*.035/18*DT;
 this.x+=this.v*Math.cos(angle)*DT;this.y=height(Math.min(0,this.x));this.pitch=angle;
 if(this.x>=0){this.x=0;this.y=0;this.vx=this.v*Math.cos(angle)-Math.sin(angle)*this.normalVelocity;this.vy=this.v*Math.sin(angle)+Math.cos(angle)*this.normalVelocity;this.vz=this.eccentricity*.3;this.phase='flight';}
 }else if(this.phase==='flight'){
 this.flightTime+=DT;const ux=this.vx-this.wind,uy=this.vy,speed=Math.hypot(ux,uy),flow=Math.atan2(uy,ux),alpha=Math.atan2(Math.sin(this.pitch-flow),Math.cos(this.pitch-flow));
 const stall=Math.max(.08,1-Math.max(0,Math.abs(alpha)-.45)*2);const cl=.65*Math.sin(2*alpha)*stall;const cd=.18+.65*Math.sin(alpha)**2;const q=.5*1.225*speed*speed*1.35;
 this.vx+=(-q*cd*ux/speed-q*cl*uy/speed)/78*DT;this.vy+=(-9.81-q*cd*uy/speed+q*cl*ux/speed)/78*DT;
 this.omega+=(q*.08*(flow+.16-this.pitch)*stall-7*this.omega)/18*DT;this.pitch+=this.omega*DT;this.rollRate+=(-4*this.roll-5*this.rollRate)/18*DT;this.roll+=this.rollRate*DT;
 this.x+=this.vx*DT;this.y+=this.vy*DT;this.z+=this.vz*DT;
 if(this.y<=landing(this.x)){const tangent=landingSlope(this.x);this.impact=Math.abs((this.vy-tangent*this.vx)/Math.hypot(1,tangent));this.phase=Math.abs(this.pitch-Math.atan(tangent))<.55&&Math.abs(this.roll)<.4&&this.impact<7?'landed':'fallen';this.y=landing(this.x);}
 }
 }
 snapshot(){return {x:this.x,y:this.y,z:this.z,pitch:this.pitch,roll:this.roll,extension:this.extension,phase:this.phase,flightTime:this.flightTime}}
}
export class FixedClock { accumulator=0; advance(seconds:number,step:()=>void){this.accumulator+=Math.max(0,Math.min(seconds,.25));while(this.accumulator+1e-12>=DT){step();this.accumulator-=DT;}} }
