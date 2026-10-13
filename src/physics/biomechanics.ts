import {jointPose,dimensions,ankleHeight} from '../athlete/pose';
/** Approximate segment mass distribution, matching the rig's fixed-length FK.
 * Body/equipment mass partition is a documented modelling assumption. */
export function centerOfMassOffset(extension:number,flightSeconds=0,landing=0,bodyLean=1.27){
  const p=jointPose(extension,flightSeconds,landing,{bodyLean});
  const hip={x:p.hipX,y:p.hipY};
  const knee={x:hip.x+dimensions.thigh*(Math.sin(p.legs[0].upper)+Math.sin(p.legs[1].upper))*.5,
    y:hip.y-dimensions.thigh*(Math.cos(p.legs[0].upper)+Math.cos(p.legs[1].upper))*.5};
  const axis={x:Math.sin(p.trunkLean),y:Math.cos(p.trunkLean)};
  const weighted=(key:'x'|'y')=>.50*(hip[key]+.24*axis[key])+.08*(hip[key]+.65*axis[key])+.127*(hip[key]+.22*axis[key])+
    .20*(hip[key]+knee[key])*.5+.093*(knee[key]+(key==='x'?0:ankleHeight))*.5;
  return {x:weighted('x')*70/78+.15*8/78,y:weighted('y')*70/78+.05*8/78};
}
export function extensionAtHeight(h:number){let lo=0,hi=1;for(let i=0;i<22;i++){const e=(lo+hi)/2;if(centerOfMassOffset(e).y<h)lo=e;else hi=e;}return (lo+hi)/2;}
export function rotatedOffset(e:number,f:number,l:number,lean:number,pitch:number,roll=0){
  const o=centerOfMassOffset(e,f,l,lean);
  return {x:o.x*Math.cos(pitch)-o.y*Math.sin(pitch),y:(o.x*Math.sin(pitch)+o.y*Math.cos(pitch))*Math.cos(roll),z:(o.x*Math.sin(pitch)+o.y*Math.cos(pitch))*Math.sin(roll)};
}
