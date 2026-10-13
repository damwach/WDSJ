import {jointPose,legKneePosition,type PoseControl} from '../athlete/pose';
import {DEFAULT_EQUIPMENT} from '../equipment/config';
import {skiProperties} from '../equipment/model';
/** Approximate segment mass distribution, matching the rig's fixed-length FK.
 * Body/equipment mass partition is a documented modelling assumption. */
export function centerOfMassOffset(extension:number,flightSeconds=0,landing=0,bodyLean=1.27,controls:PoseControl={}){
  const p=jointPose(extension,flightSeconds,landing,{...controls,bodyLean});
  const hip={x:p.hipX,y:p.hipY};
  const knees=[legKneePosition(p,0),legKneePosition(p,1)];
  const knee={x:(knees[0].x+knees[1].x)*.5,y:(knees[0].y+knees[1].y)*.5};
  const bodyZ=(.20+.093)*(knees[0].z+knees[1].z)*.25;
  const axis={x:Math.sin(p.trunkLean),y:Math.cos(p.trunkLean)};
  const weighted=(key:'x'|'y')=>.50*(hip[key]+.24*axis[key])+.08*(hip[key]+.65*axis[key])+.127*(hip[key]+.22*axis[key])+
    .20*(hip[key]+knee[key])*.5+.093*(knee[key]+(key==='x'?0:p.ankleHeightM))*.5;
  const equipment=controls.equipment??DEFAULT_EQUIPMENT,properties=skiProperties(equipment),b=equipment.binding;
  const skiCOM=p.legs.map((leg,i)=>{
    const heel=controls.skiStates?.[i]?.heelAngleRad??0,angle=p.skiPitch+heel;
    const frontX=-b.ankleOffsetM+b.frontAttachmentOffsetM,frontY=b.frontPivotHeightM-p.ankleHeightM;
    const dx=properties.centerOfMass.x-properties.frontAttachment.x,dy=properties.centerOfMass.y-properties.frontAttachment.y;
    const x=frontX*Math.cos(p.skiPitch)-frontY*Math.sin(p.skiPitch)+dx*Math.cos(angle)-dy*Math.sin(angle);
    const yaw=(i===0?1:-1)*p.vAngleRad;
    return {x:leg.ankleX+x*Math.cos(yaw),
      y:p.ankleHeightM+frontX*Math.sin(p.skiPitch)+frontY*Math.cos(p.skiPitch)+dx*Math.sin(angle)+dy*Math.cos(angle),
      z:leg.ankleZ-x*Math.sin(yaw)};
  });
  // 70 kg body + 4.4 kg skis + 3.6 kg boots/remaining equipment at defaults.
  // Segment fractions and the remaining equipment COM are engineering estimates.
  const otherEquipmentMass=3.6,totalMass=controls.totalMassKg??70+2*equipment.ski.massKg+otherEquipmentMass;
  const bodyMass=totalMass-2*equipment.ski.massKg-otherEquipmentMass;
  if(!Number.isFinite(totalMass)||!Number.isFinite(bodyMass)||bodyMass<=0)throw new Error('The total system mass must leave a positive body mass after equipment.');
  const weightedSki=(key:'x'|'y'|'z')=>equipment.ski.massKg*(skiCOM[0][key]+skiCOM[1][key]);
  return {x:(weighted('x')*bodyMass+weightedSki('x')+.03*otherEquipmentMass)/totalMass,
    y:(weighted('y')*bodyMass+weightedSki('y')+.055*otherEquipmentMass)/totalMass,
    z:(bodyZ*bodyMass+weightedSki('z'))/totalMass};
}
export function extensionAtHeight(h:number,controls:PoseControl={}){let lo=0,hi=1;for(let i=0;i<22;i++){const e=(lo+hi)/2;if(centerOfMassOffset(e,0,0,1.27,controls).y<h)lo=e;else hi=e;}return (lo+hi)/2;}
export function rotatedOffset(e:number,f:number,l:number,lean:number,pitch:number,roll=0,controls:PoseControl={}){
  const o=centerOfMassOffset(e,f,l,lean,controls);
  const y=o.x*Math.sin(pitch)+o.y*Math.cos(pitch);
  return {x:o.x*Math.cos(pitch)-o.y*Math.sin(pitch),y:y*Math.cos(roll)-o.z*Math.sin(roll),z:y*Math.sin(roll)+o.z*Math.cos(roll)};
}
