import {DEFAULT_EQUIPMENT,type EquipmentConfig} from './config';

export interface Point2 {x:number;y:number}
export interface Point3 extends Point2 {z:number}
const heelLimitCache=new WeakMap<EquipmentConfig,{key:string;value:number}>();
const rearReachCache=new WeakMap<EquipmentConfig,{key:string;value:number}>();

export function effectiveAngularStiffness(config:EquipmentConfig=DEFAULT_EQUIPMENT) {
  const b=config.binding;
  return 1/(1/b.angularStiffnessNmPerRad+1/b.bootSoleAngularStiffnessNmPerRad);
}

/** Each ski has its own mass, COM, inertia and aerodynamic pressure point. */
export function skiProperties(config:EquipmentConfig=DEFAULT_EQUIPMENT) {
  const s=config.ski,b=config.binding;
  let mean=0,second=0;
  for(const segment of s.massDistribution) {
    const a=segment.startFraction*s.lengthM,end=segment.endFraction*s.lengthM;
    const mid=(a+end)/2;
    mean+=segment.massFraction*mid;
    second+=segment.massFraction*(mid*mid+(end-a)**2/12);
  }
  const centerOfMass={x:mean-b.bootToePositionM,y:s.thicknessM/2,z:0};
  const frontAttachment={x:b.frontAttachmentOffsetM,y:b.frontPivotHeightM,z:0};
  const longitudinal=s.massKg*(second-mean*mean);
  const pitchInertiaKgM2=longitudinal+s.massKg*s.thicknessM*s.thicknessM/12;
  return {
    lengthM:s.lengthM,widthM:s.widthM,massKg:s.massKg,areaM2:s.lengthM*s.widthM,
    centerOfMass,centerOfPressure:{x:s.centerOfPressureFraction*s.lengthM-b.bootToePositionM,y:s.thicknessM/2,z:0},
    frontAttachment,pitchInertiaKgM2,
    rollInertiaKgM2:s.massKg*(s.widthM*s.widthM+s.thicknessM*s.thicknessM)/12,
    yawInertiaKgM2:longitudinal+s.massKg*s.widthM*s.widthM/12,
    pitchInertiaAboutFrontKgM2:pitchInertiaKgM2+s.massKg*((centerOfMass.x-frontAttachment.x)**2+(centerOfMass.y-frontAttachment.y)**2),
    tipFromToeM:s.lengthM-b.bootToePositionM,tailFromToeM:-b.bootToePositionM,
  };
}

/** Toe-local ski frame, with ski bottom at y=0. A positive heel angle rotates
 * the boot clockwise about the FRONT mount, lifting its rear off the ski. */
export function heelGeometry(config:EquipmentConfig,angleRad:number) {
  const b=config.binding,c=Math.cos(angleRad),s=Math.sin(angleRad);
  const frontPoint={x:b.frontAttachmentOffsetM,y:b.frontPivotHeightM};
  const dx=b.rearAttachmentOffsetM-frontPoint.x,dy=b.rearBootAttachmentHeightM-frontPoint.y;
  const rearBootPoint={x:frontPoint.x+dx*c+dy*s,y:frontPoint.y-dx*s+dy*c};
  const rearSkiPoint={x:b.rearSkiAnchorOffsetM,y:b.rearSkiAnchorHeightM};
  return {frontPoint,rearSkiPoint,rearBootPoint,
    rodLengthM:Math.hypot(rearBootPoint.x-rearSkiPoint.x,rearBootPoint.y-rearSkiPoint.y),
    heelRiseM:rearBootPoint.y-b.rearBootAttachmentHeightM,
    soleFlexAngleRad:angleRad*b.angularStiffnessNmPerRad/(b.angularStiffnessNmPerRad+b.bootSoleAngularStiffnessNmPerRad)};
}

export function maximumHeelAngleRad(config:EquipmentConfig=DEFAULT_EQUIPMENT) {
  const b=config.binding,maxLength=b.rodMaxLengthM;
  const key=[b.frontAttachmentOffsetM,b.frontPivotHeightM,b.rearAttachmentOffsetM,b.rearBootAttachmentHeightM,
    b.rearSkiAnchorOffsetM,b.rearSkiAnchorHeightM,maxLength].join(',');
  const cached=heelLimitCache.get(config);
  if(cached?.key===key)return cached.value;
  if(heelGeometry(config,0).rodLengthM>=maxLength)throw new Error('The binding rod cannot assemble in the neutral position.');
  let low=0,high=0;
  // First geometrical limit, including unusual valid anchor configurations.
  for(let i=1;i<=64;i++) {
    high=i*Math.PI/128;
    if(heelGeometry(config,high).rodLengthM>=maxLength)break;
    low=high;
  }
  if(heelGeometry(config,high).rodLengthM<maxLength)throw new Error('The rear rod does not limit heel rotation.');
  for(let i=0;i<48;i++) {
    const middle=(low+high)/2;
    if(heelGeometry(config,middle).rodLengthM<maxLength)low=middle;else high=middle;
  }
  const value=(low+high)/2;
  heelLimitCache.set(config,{key,value});
  return value;
}

function tailVectorFromAnkle(config:EquipmentConfig,heelAngleRad:number,tailHeightM:number) {
  const b=config.binding;
  const x=-b.bootToePositionM-b.frontAttachmentOffsetM,y=tailHeightM-b.frontPivotHeightM;
  return {x:b.frontAttachmentOffsetM-b.ankleOffsetM+x*Math.cos(heelAngleRad)-y*Math.sin(heelAngleRad),
    y:b.frontPivotHeightM-b.ankleHeightM+x*Math.sin(heelAngleRad)+y*Math.cos(heelAngleRad)};
}
function rearReachM(config:EquipmentConfig,heelAngleRad:number,bootPitchRad=0) {
  // Bound both tail corners and use full ski width instead of the tapered tip.
  return Math.max(...[0,config.ski.tailRiseM+config.ski.thicknessM].map(height=>{
    const point=tailVectorFromAnkle(config,heelAngleRad,height);
    return -(point.x*Math.cos(bootPitchRad)-point.y*Math.sin(bootPitchRad));
  }));
}
function maximumRearReachM(config:EquipmentConfig) {
  const max=maximumHeelAngleRad(config),b=config.binding,s=config.ski;
  const key=[max,b.ankleOffsetM,b.ankleHeightM,b.frontAttachmentOffsetM,b.bootToePositionM,s.tailRiseM,s.thicknessM,b.frontPivotHeightM].join(',');
  const cached=rearReachCache.get(config);
  if(cached?.key===key)return cached.value;
  const values:number[]=[];
  // The radius bounds aft projection under ANY common boot pitch. Include a
  // conservative tail rectangle, and extrema of |a + R(heel)b| over heel travel.
  for(const height of [0,s.tailRiseM+s.thicknessM]) {
    const ax=b.frontAttachmentOffsetM-b.ankleOffsetM,ay=b.frontPivotHeightM-b.ankleHeightM;
    const bx=-b.bootToePositionM-b.frontAttachmentOffsetM,by=height-b.frontPivotHeightM;
    const stationary=Math.atan2(ay*bx-ax*by,ax*bx+ay*by);
    for(const angle of [0,max,stationary]) {
      if(angle>=0&&angle<=max) {
        const point=tailVectorFromAnkle(config,angle,height);
        values.push(Math.hypot(point.x,point.y));
      }
    }
  }
  const value=Math.max(...values);
  rearReachCache.set(config,{key,value});
  return value;
}

export function requiredAnkleHalfSeparation(config:EquipmentConfig,vAngleRad:number,heelAngles?:readonly number[],bootPitchRad=0) {
  const reaches=heelAngles?heelAngles.map(a=>rearReachM(config,a,bootPitchRad)):[maximumRearReachM(config),maximumRearReachM(config)];
  return (config.ski.minTailGapM+config.ski.widthM*Math.cos(vAngleRad)+(reaches[0]+reaches[1])*Math.sin(vAngleRad))/2;
}
export function tailGapM(config:EquipmentConfig,ankleHalfSeparationM:number,vAngleRad:number,heelAngles?:readonly number[],bootPitchRad=0) {
  const reaches=heelAngles?heelAngles.map(a=>rearReachM(config,a,bootPitchRad)):[maximumRearReachM(config),maximumRearReachM(config)];
  return 2*ankleHalfSeparationM-config.ski.widthM*Math.cos(vAngleRad)-(reaches[0]+reaches[1])*Math.sin(vAngleRad);
}

/** Pressure-point torque about the actual FRONT mount, in world XY. */
export function skiPressureTorqueNm(config:EquipmentConfig,pitchRad:number,force:Point2) {
  const p=skiProperties(config),c=Math.cos(pitchRad),s=Math.sin(pitchRad);
  const dx=p.centerOfPressure.x-p.frontAttachment.x,dy=p.centerOfPressure.y-p.frontAttachment.y;
  return (dx*c-dy*s)*force.y-(dx*s+dy*c)*force.x;
}

export interface SkiBindingState {
  heelAngleRad:number;heelAngularVelocityRadS:number;
  absolutePitchRad:number;absoluteAngularVelocityRadS:number;
  reactionTorqueNm:number;aeroPitchTorqueNm:number;
  heelRiseM:number;rodLengthM:number;soleFlexAngleRad:number;
  angleOfAttackRad:number;edgeAngleRad:number;vAngleRad:number;
}
export interface BindingSystemState {
  bodyPitchRad:number;bodyAngularVelocityRadS:number;
  skis:[SkiBindingState,SkiBindingState];
}
export interface BindingSystemInput {
  bodyTorqueNm:number;skiTorqueNm:readonly [number,number];bodyInertiaKgM2:number;
  /** Optional actuator performs explicit internal work; game M1 leaves it zero. */
  muscleTorqueNm?:readonly [number,number];
}

export function createBindingSystemState(bodyPitchRad=0,bodyAngularVelocityRadS=0,config:EquipmentConfig=DEFAULT_EQUIPMENT):BindingSystemState {
  const geometry=heelGeometry(config,0);
  const ski=():SkiBindingState=>({heelAngleRad:0,heelAngularVelocityRadS:0,
    absolutePitchRad:bodyPitchRad,absoluteAngularVelocityRadS:bodyAngularVelocityRadS,
    reactionTorqueNm:0,aeroPitchTorqueNm:0,heelRiseM:0,rodLengthM:geometry.rodLengthM,soleFlexAngleRad:0,
    angleOfAttackRad:0,edgeAngleRad:0,vAngleRad:0});
  return {bodyPitchRad,bodyAngularVelocityRadS,skis:[ski(),ski()]};
}

type Triple=[number,number,number];
/** Reduced pitch system: one body and two independently rotating skis.
 * Backward Euler solves spring/sole compliance and damping together. Geometric
 * stops use a simultaneous active-set constraint solve, transferring equal and
 * opposite angular impulses. No global orientation target is imposed. */
export function stepBindingSystem(state:BindingSystemState,input:BindingSystemInput,config:EquipmentConfig,dt:number):BindingSystemState {
  const bodyI=input.bodyInertiaKgM2,skiI=skiProperties(config).pitchInertiaAboutFrontKgM2;
  if(!Number.isFinite(dt)||dt<=0||!Number.isFinite(bodyI)||bodyI<=0||!Number.isFinite(skiI)||skiI<=0)
    throw new Error('Binding integration requires a positive finite step and inertias.');
  const maxAngle=maximumHeelAngleRad(config),k=effectiveAngularStiffness(config),d=config.binding.dampingNmsPerRad;
  const muscle=input.muscleTorqueNm??[0,0];
  const torques=muscle.map(t=>Math.max(-config.binding.maxActuatorTorqueNm,Math.min(config.binding.maxActuatorTorqueNm,t)));
  if(![state.bodyPitchRad,state.bodyAngularVelocityRadS,input.bodyTorqueNm,...input.skiTorqueNm,...torques].every(Number.isFinite))
    throw new Error('Binding input must be finite.');
  const theta=state.skis.map(s=>s.heelAngleRad),old:Triple=[state.bodyAngularVelocityRadS,...state.skis.map(s=>s.absoluteAngularVelocityRadS)] as Triple;
  if(theta.some(t=>!Number.isFinite(t)||t< -1e-10||t>maxAngle+1e-10)||!old.every(Number.isFinite))
    throw new Error('Binding state violates its geometric stops.');
  const a=dt*(d+k*dt),A=bodyI+2*a,D=skiI+a,B=-a;
  const solve=(rhs:Triple):Triple=> {
    const body=(rhs[0]-B*(rhs[1]+rhs[2])/D)/(A-2*B*B/D);
    return [body,(rhs[1]-B*body)/D,(rhs[2]-B*body)/D];
  };
  const free=solve([
    bodyI*old[0]+dt*(input.bodyTorqueNm+k*(theta[0]+theta[1])-torques[0]-torques[1]),
    skiI*old[1]+dt*(input.skiTorqueNm[0]-k*theta[0]+torques[0]),
    skiI*old[2]+dt*(input.skiTorqueNm[1]-k*theta[1]+torques[1]),
  ]);
  const response=[solve([-1,1,0]),solve([-1,0,1])];
  const relative=(v:Triple,index:number)=>v[index+1]-v[0];
  const minimum=theta.map(t=>-t/dt),maximum=theta.map(t=>(maxAngle-t)/dt);
  let velocity:Triple|undefined,impulse:[number,number]=[0,0];
  const modes=[0,-1,1]; // 0 free, -1 sole contact, +1 rear-rod stop.
  for(const left of modes) {
    for(const right of modes) {
      const mode=[left,right],active=mode.map((m,i)=>m?i:-1).filter(i=>i>=0);
      const lambda:[number,number]=[0,0];
      if(active.length===1) {
        const i=active[0],target=mode[i]<0?minimum[i]:maximum[i];
        lambda[i]=(target-relative(free,i))/relative(response[i],i);
      } else if(active.length===2) {
        const x=(left<0?minimum[0]:maximum[0])-relative(free,0);
        const y=(right<0?minimum[1]:maximum[1])-relative(free,1);
        const aa=relative(response[0],0),bb=relative(response[1],0),cc=relative(response[0],1),dd=relative(response[1],1);
        const determinant=aa*dd-bb*cc;
        lambda[0]=(x*dd-bb*y)/determinant;lambda[1]=(aa*y-cc*x)/determinant;
      }
      const candidate=free.map((v,i)=>v+response[0][i]*lambda[0]+response[1][i]*lambda[1]) as Triple;
      const feasible=mode.every((m,i)=>relative(candidate,i)>=minimum[i]-1e-9&&relative(candidate,i)<=maximum[i]+1e-9
        &&(m===0||(m<0?lambda[i]>=-1e-9:lambda[i]<=1e-9)));
      if(feasible){velocity=candidate;impulse=lambda;break;}
    }
    if(velocity)break;
  }
  if(!velocity)throw new Error('Binding constraint solve failed.');
  const nextVelocity=velocity,bodyPitchRad=state.bodyPitchRad+nextVelocity[0]*dt;
  const skis=state.skis.map((ski,i):SkiBindingState=> {
    const rate=relative(nextVelocity,i),angle=Math.max(0,Math.min(maxAngle,theta[i]+rate*dt));
    const geometry=heelGeometry(config,angle);
    return {...ski,heelAngleRad:angle,heelAngularVelocityRadS:rate,
      absolutePitchRad:bodyPitchRad+angle,absoluteAngularVelocityRadS:nextVelocity[i+1],
      reactionTorqueNm:k*angle+d*rate-torques[i]-impulse[i]/dt,aeroPitchTorqueNm:input.skiTorqueNm[i],
      heelRiseM:geometry.heelRiseM,rodLengthM:geometry.rodLengthM,soleFlexAngleRad:geometry.soleFlexAngleRad};
  }) as [SkiBindingState,SkiBindingState];
  return {bodyPitchRad,bodyAngularVelocityRadS:nextVelocity[0],skis};
}

export function pitchAngularMomentum(state:BindingSystemState,bodyInertiaKgM2:number,config:EquipmentConfig=DEFAULT_EQUIPMENT) {
  const skiI=skiProperties(config).pitchInertiaAboutFrontKgM2;
  return bodyInertiaKgM2*state.bodyAngularVelocityRadS+skiI*(state.skis[0].absoluteAngularVelocityRadS+state.skis[1].absoluteAngularVelocityRadS);
}
export function rotationalEnergy(state:BindingSystemState,bodyInertiaKgM2:number,config:EquipmentConfig=DEFAULT_EQUIPMENT) {
  const skiI=skiProperties(config).pitchInertiaAboutFrontKgM2,k=effectiveAngularStiffness(config);
  return .5*bodyInertiaKgM2*state.bodyAngularVelocityRadS**2+
    state.skis.reduce((sum,s)=>sum+.5*skiI*s.absoluteAngularVelocityRadS**2+.5*k*s.heelAngleRad**2,0);
}
