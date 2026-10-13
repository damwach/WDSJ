import {describe,expect,it} from 'vitest';
import {height,slope,inrunDistance,inrunCurvature,landing,landingSlope,pisteWidth,distanceAt,xAtDistance,hill,certificate,gatePosition} from '../src/world/hill';
const rad=(v:number)=>v*Math.PI/180;
const arc=(from:number,to:number,s:(x:number)=>number)=>{
 let result=0;const n=4000,d=(to-from)/n;
 for(let i=0;i<n;i++)result+=Math.hypot(1,s(from+(i+.5)*d))*d;
 return result;
};
describe('Wielka Krokiew certificate dimensions in SI metres',()=>{
 it('retains the measured K point, table height and U depth without horizontal scaling',()=>{
  expect(hill.points.K).toEqual({x:107.76,y:-62.37});
  expect(landing(107.76)).toBeCloseTo(-62.37,10);
  expect(height(0)-landing(0)).toBeCloseTo(3.13,10);
  expect(landing(hill.points.U.x)).toBe(-89.11);
  expect(hill.points.outrunEnd.x-hill.points.U.x).toBeCloseTo(103,10);
 });
 it('reconstructs the full 97.80m/77.00m inrun, 6.50m table and R90 circle',()=>{
  const {A,B,E1,E2}=hill.points;
  expect(arc(A.x,0,slope)).toBeCloseTo(97.80,5);
  expect(arc(B.x,0,slope)).toBeCloseTo(77,5);
  expect(Math.hypot(E2.x,E2.y)).toBeCloseTo(6.5,10);
  expect(arc(E1.x,E2.x,slope)).toBeCloseTo(90*rad(24),6);
  expect(Math.atan(slope(A.x))).toBeCloseTo(-rad(35),10);
  expect(Math.atan(slope(-1))).toBeCloseTo(-rad(11),10);
  expect(inrunCurvature((E1.x+E2.x)/2)).toBeCloseTo(1/90,10);
  expect(inrunDistance(A.x)).toBeCloseTo(certificate.inrun.e1,10);
  expect(inrunDistance(B.x)).toBeCloseTo(certificate.inrun.e2,10);
 });
 it('places the start gates inside the 20.80m A--B band',()=>{
  expect(gatePosition(1)).toEqual(hill.points.B);
  expect(gatePosition(34)).toEqual(hill.points.A);
  expect(inrunDistance(gatePosition(34).x)-inrunDistance(gatePosition(1).x)).toBeCloseTo(20.8,10);
  for(let gate=1;gate<=34;gate++)expect(gatePosition(gate).y).toBeCloseTo(height(gatePosition(gate).x),10);
 });
 it('matches landing angles and true P--K / K--L arc lengths',()=>{
  const {P,K,L}=hill.points;
  for(const [p,angle] of [[P,37],[K,34.3],[L,31.3]] as const){
   expect(landing(p.x)).toBeCloseTo(p.y,10);
   expect(Math.atan(landingSlope(p.x))).toBeCloseTo(-rad(angle),10);
  }
  expect(arc(P.x,K.x,landingSlope)).toBeCloseTo(16,6);
  expect(arc(K.x,L.x,landingSlope)).toBeCloseTo(15,6);
 });
 it('has continuous positions and tangents at every profile join',()=>{
  const {P,K,L,U,uphillJoin}=hill.points;
  for(const p of [P,K,L,U,uphillJoin]){
   expect(landing(p.x-1e-5)).toBeCloseTo(landing(p.x+1e-5),4);
   expect(landingSlope(p.x-1e-5)).toBeCloseTo(landingSlope(p.x+1e-5),5);
  }
  for(const p of [hill.points.E1,hill.points.E2]){
   expect(height(p.x-1e-5)).toBeCloseTo(height(p.x+1e-5),4);
   expect(slope(p.x-1e-5)).toBeCloseTo(slope(p.x+1e-5),5);
  }
 });
 it('descends to U and then rises to the 17-degree outrun, matching its analytic slope',()=>{
  for(let x=.3;x<hill.points.outrunEnd.x;x+=.3){
   expect(landingSlope(x)).toBeCloseTo((landing(x+1e-5)-landing(x-1e-5))/2e-5,6);
   if(x<hill.points.U.x)expect(landingSlope(x)).toBeLessThanOrEqual(0);
   else expect(landingSlope(x)).toBeGreaterThanOrEqual(0);
  }
  expect(landingSlope(hill.points.U.x)).toBe(0);
  expect(Math.atan(landingSlope(hill.points.outrunEnd.x))).toBeCloseTo(rad(17),10);
 });
 it('respects the prescribed landing/transition radii at their reference points',()=>{
  for(const [p,radius] of [[hill.points.P,310],[hill.points.K,310],[hill.points.L,168],[hill.points.U,99.3]] as const){
   const derivative=(landingSlope(p.x+.001)-landingSlope(p.x-.001))/.002;
   const measured=Math.hypot(1,landingSlope(p.x))**3/Math.abs(derivative);
   expect(Math.abs(measured-radius)).toBeLessThan(.15);
  }
 });
 it('uses the certified widths for the track, K point and outrun',()=>{
  expect(certificate.inrun.width).toBe(2.65);
  expect(pisteWidth(hill.points.K.x)).toBe(25);
  expect(pisteWidth(hill.points.U.x)).toBe(27.5);
  expect(pisteWidth(hill.points.outrunEnd.x)).toBe(27.5);
 });
 it('registers P109 / K125 / HS140 to their slope stations, not horizontal x',()=>{
  for(const [point,distance] of [[hill.points.P,109],[hill.points.K,125],[hill.points.L,140]] as const){
   expect(distanceAt(point.x)).toBeCloseTo(distance,10);
   expect(xAtDistance(distance)).toBeCloseTo(point.x,10);
   expect(point.x).not.toBeCloseTo(distance,1);
  }
  for(let d=1;d<230;d++)expect(distanceAt(xAtDistance(d))).toBeCloseTo(d,9);
 });
});
