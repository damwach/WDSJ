import {certificate as c, reconstruction} from './certificate';
export {certificate, reconstruction} from './certificate';
const rad=(angle:number)=>angle*Math.PI/180;
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
type Point={x:number;y:number};
type Node=Point&{slope:number;station:number};

// A--E1 straight, E1--E2 circular R90, E2--T straight. e1/e2 include table t.
const gamma=rad(c.inrun.angle),alpha=rad(c.inrun.tableAngle),r=c.inrun.radius;
const T:Point={x:0,y:0};
const E2:Point={x:-c.inrun.tableLength*Math.cos(alpha),y:c.inrun.tableLength*Math.sin(alpha)};
const E1:Point={x:E2.x-r*(Math.sin(gamma)-Math.sin(alpha)),y:E2.y+r*(Math.cos(alpha)-Math.cos(gamma))};
const inrunArcLength=r*(gamma-alpha);
const startAtLength=(length:number):Point=>{
  const straight=length-c.inrun.tableLength-inrunArcLength;
  return {x:E1.x-straight*Math.cos(gamma),y:E1.y+straight*Math.sin(gamma)};
};
const A=startAtLength(c.inrun.e1),B=startAtLength(c.inrun.e2);
const circleX=E2.x+r*Math.sin(alpha),circleY=E2.y+r*Math.cos(alpha);
export function height(x:number){
  if(x===0)return 0;
  if(x<=E1.x)return E1.y-Math.tan(gamma)*(x-E1.x);
  if(x>=E2.x)return -x*Math.tan(alpha);
  return circleY-Math.sqrt(r*r-(x-circleX)**2);
}
export function slope(x:number){
  if(x<=E1.x)return -Math.tan(gamma);
  if(x>=E2.x)return -Math.tan(alpha);
  return (x-circleX)/Math.sqrt(r*r-(x-circleX)**2);
}
export const inrunCurvature=(x:number)=>x>E1.x&&x<E2.x?1/r:0;
export function inrunDistance(x:number){
  if(x<=E1.x)return (E1.x-x)/Math.cos(gamma)+inrunArcLength+c.inrun.tableLength;
  if(x<E2.x)return r*(Math.asin((circleX-x)/r)-alpha)+c.inrun.tableLength;
  return Math.max(0,-x/Math.cos(alpha));
}
/** Gate1 is lowest. A--B band takes precedence over inconsistent pitch note. */
export const gatePosition=(gate:number)=>startAtLength(mix(c.inrun.e2,c.inrun.e1,
  (clamp(Math.round(gate),1,c.inrun.gates)-1)/(c.inrun.gates-1)));

const gx=[0,-.5384693101056831,.5384693101056831,-.906179845938664,.906179845938664];
const gw=[.5688888888888889,.4786286704993665,.4786286704993665,.2369268850561891,.2369268850561891];
function integral(fn:(value:number)=>number,from:number,to:number){
  const half=(to-from)/2,mid=(from+to)/2;
  return half*gx.reduce((sum,x,i)=>sum+gw[i]*fn(mid+half*x),0);
}
function hermite(a:number,b:number,ma:number,mb:number,span:number,t:number,derivative=false){
  if(derivative)return ((6*t*t-6*t)*a+(3*t*t-4*t+1)*span*ma+(-6*t*t+6*t)*b+(3*t*t-2*t)*span*mb)/span;
  return (2*t*t*t-3*t*t+1)*a+(t*t*t-2*t*t+t)*span*ma+(-2*t*t*t+3*t*t)*b+(t*t*t-t*t)*span*mb;
}
/** Angle versus true arc length: exact spans/end angles and end radii.
 * Variable curvature between reported points; not a complete surveyed profile. */
function landingSection(length:number,a:number,b:number,radiusA:number,radiusB:number){
  const angle=(s:number)=>hermite(rad(a),rad(b),1/radiusA,1/radiusB,length,s/length);
  const nodes:Node[]=[{x:0,y:0,slope:Math.tan(angle(0)),station:0}];
  const count=Math.ceil(length/.05);
  for(let i=1;i<=count;i++){
    const from=length*(i-1)/count,to=length*i/count,last=nodes[i-1];
    nodes.push({x:last.x+integral(s=>Math.cos(angle(s)),from,to),
      y:last.y+integral(s=>Math.sin(angle(s)),from,to),slope:Math.tan(angle(to)),station:to});
  }
  return nodes;
}
const K:Point={x:c.landing.n,y:-c.landing.h};
const pk=landingSection(c.landing.pToK,-c.landing.pAngle,-c.landing.kAngle,c.landing.radius,c.landing.radius);
const pkEnd=pk[pk.length-1];
const P:Point={x:K.x-pkEnd.x,y:K.y-pkEnd.y};
const kl=landingSection(c.landing.kToL,-c.landing.kAngle,-c.landing.lAngle,c.landing.radius,c.landing.transitionRadiusAtL);
const klEnd=kl[kl.length-1];
const L:Point={x:K.x+klEnd.x,y:K.y+klEnd.y};
const landingNodes:Node[]=[
  ...pk.map(p=>({...p,x:p.x+P.x,y:p.y+P.y,station:p.station+c.p})),
  ...kl.slice(1).map(p=>({...p,x:p.x+K.x,y:p.y+K.y,station:p.station+c.k})),
];
// R(angle)=r2+(r2L-r2)*(angle/betaL)^p, solving p for the reported ZU.
const betaL=rad(c.landing.lAngle),targetDrop=c.landing.uDrop+L.y;
const radiusAt=(angle:number,power:number)=>c.landing.transitionRadiusAtU+
  (c.landing.transitionRadiusAtL-c.landing.transitionRadiusAtU)*(angle/betaL)**power;
function transitionDrop(power:number){
  let sum=0;
  for(let i=0;i<128;i++)sum+=integral(a=>radiusAt(a,power)*Math.sin(a),betaL*i/128,betaL*(i+1)/128);
  return sum;
}
let lo=.01,hi=32;
for(let i=0;i<48;i++){const power=(lo+hi)/2;if(transitionDrop(power)>targetDrop)lo=power;else hi=power;}
const transitionPower=(lo+hi)/2;
for(let i=1;i<=256;i++){
  const highAngle=betaL*(1-(i-1)/256),lowAngle=betaL*(1-i/256),last=landingNodes[landingNodes.length-1];
  landingNodes.push({x:last.x+integral(a=>radiusAt(a,transitionPower)*Math.cos(a),lowAngle,highAngle),
    y:last.y-integral(a=>radiusAt(a,transitionPower)*Math.sin(a),lowAngle,highAngle),
    slope:-Math.tan(lowAngle),station:last.station+integral(a=>radiusAt(a,transitionPower),lowAngle,highAngle)});
}
const lastNode=landingNodes[landingNodes.length-1];
const U:Point={x:lastNode.x,y:-c.landing.uDrop};lastNode.y=U.y;
const S:Point={x:0,y:-c.landing.tableHeight};
// Quintic S--P: betaS is an explicit assumption, matching angle/radius at P.
const startSlope=-Math.tan(rad(reconstruction.knollStartAngle));
const endSlope=-Math.tan(rad(c.landing.pAngle));
const endSecond=1/(c.landing.radius*Math.cos(rad(c.landing.pAngle))**3);
const a0=S.y,a1=P.x*startSlope;
const d0=P.y-a0-a1,d1=P.x*endSlope-a1,d2=P.x*P.x*endSecond;
const a3=10*d0-4*d1+.5*d2,a4=-15*d0+7*d1-d2,a5=6*d0-3*d1+.5*d2;
const knollHeight=(x:number)=>{const t=x/P.x;return a0+a1*t+a3*t**3+a4*t**4+a5*t**5;};
const knollSlope=(x:number)=>{const t=x/P.x;return (a1+3*a3*t*t+4*a4*t**3+5*a5*t**4)/P.x;};
function interval(nodes:Node[],x:number){
  let a=0,b=nodes.length-1;
  while(b-a>1){const m=(a+b)>>1;if(nodes[m].x<=x)a=m;else b=m;}
  return [nodes[a],nodes[b]];
}
function curveSample(x:number,derivative:boolean){
  const [a,b]=interval(landingNodes,x),span=b.x-a.x;
  return hermite(a.y,b.y,a.slope,b.slope,span,(x-a.x)/span,derivative);
}
// Circular r2 continuation into the reported 17-degree uphill outrun.
// a=103 is horizontal U--end distance, as dimensioned in the certificate.
const uphill=rad(c.outrun.uphillAngle),uphillRadius=c.landing.transitionRadiusAtU;
const uphillJoin:Point={x:U.x+uphillRadius*Math.sin(uphill),y:U.y+uphillRadius*(1-Math.cos(uphill))};
const outrunEnd:Point={x:U.x+c.outrun.horizontalLength,
  y:uphillJoin.y+(c.outrun.horizontalLength-uphillRadius*Math.sin(uphill))*Math.tan(uphill)};
export function landing(x:number){
  if(x<=0)return S.y+startSlope*x;
  if(x<P.x)return knollHeight(x);
  if(x<U.x)return curveSample(x,false);
  if(x<uphillJoin.x)return U.y+uphillRadius-Math.sqrt(uphillRadius**2-(x-U.x)**2);
  return uphillJoin.y+(x-uphillJoin.x)*Math.tan(uphill);
}
export function landingSlope(x:number){
  if(x<=0)return startSlope;
  if(x<P.x)return knollSlope(x);
  if(x<U.x)return curveSample(x,true);
  if(x<uphillJoin.x)return (x-U.x)/Math.sqrt(uphillRadius**2-(x-U.x)**2);
  return Math.tan(uphill);
}
export function pisteWidth(x:number){
  if(x<=K.x)return mix(reconstruction.knollStartWidth,c.landing.kWidth,clamp(x/K.x,0,1));
  return mix(c.landing.kWidth,c.landing.uWidth,clamp((x-K.x)/(U.x-K.x),0,1));
}
// Register metre marks to P109/K125/L140. S--P arc is normalised to109;
// P--L is true arc length. No fabricated claim of surveyed metre stations.
const distanceNodes:Node[]=[{...S,slope:startSlope,station:0}];
const knollCount=Math.ceil(P.x/.1);
for(let i=1;i<=knollCount;i++){
  const from=P.x*(i-1)/knollCount,to=P.x*i/knollCount,last=distanceNodes[i-1];
  distanceNodes.push({x:to,y:knollHeight(to),slope:knollSlope(to),
    station:last.station+integral(x=>Math.hypot(1,knollSlope(x)),from,to)});
}
const knollArcLength=distanceNodes[distanceNodes.length-1].station;
for(const node of distanceNodes)node.station*=c.p/knollArcLength;
distanceNodes.push(...landingNodes.slice(1));
for(let x=U.x+.1;x<outrunEnd.x+.1;x+=.1){
  const last=distanceNodes[distanceNodes.length-1],to=Math.min(x,outrunEnd.x);
  distanceNodes.push({x:to,y:landing(to),slope:landingSlope(to),
    station:last.station+integral(x=>Math.hypot(1,landingSlope(x)),last.x,to)});
}
export function distanceAt(x:number){
  if(x<=0)return 0;
  const last=distanceNodes[distanceNodes.length-1];
  if(x>=last.x)return last.station+(x-last.x)*Math.hypot(1,landingSlope(last.x));
  const [a,b]=interval(distanceNodes,x);return mix(a.station,b.station,(x-a.x)/(b.x-a.x));
}
export function xAtDistance(distance:number){
  if(distance<=0)return 0;
  let a=0,b=distanceNodes.length-1;const last=distanceNodes[b];
  if(distance>=last.station)return last.x+(distance-last.station)/Math.hypot(1,last.slope);
  while(b-a>1){const m=(a+b)>>1;if(distanceNodes[m].station<=distance)a=m;else b=m;}
  return mix(distanceNodes[a].x,distanceNodes[b].x,(distance-distanceNodes[a].station)/(distanceNodes[b].station-distanceNodes[a].station));
}
export const hill={points:{A,B,E1,E2,T,S,P,K,L,U,uphillJoin,outrunEnd},inrunArcLength,transitionPower,knollArcLength} as const;
