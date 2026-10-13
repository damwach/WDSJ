import type {EquipmentConfig} from './config';
import type {jointPose} from '../athlete/pose';
import type {Point3} from './model';

export const SKI_PROFILE_SECTIONS = 64;
const smooth = (value:number,min:number,max:number) => {
  const t=Math.max(0,Math.min(1,(value-min)/(max-min)));
  return t*t*(3-2*t);
};

/** Front-pivot-local coordinates shared by render geometry and contact samples.
 * s increases from tail 0 to tip L; yBottom is the actual ski sole. */
export function skiProfileAt(config:EquipmentConfig,s:number) {
  const {ski,binding}=config;
  const nose=smooth(s,ski.lengthM*.877,ski.lengthM);
  const tail=1-smooth(s,0,ski.lengthM*.02);
  return {x:s-binding.bootToePositionM-binding.frontAttachmentOffsetM,
    yBottom:-binding.frontPivotHeightM+ski.tipRiseM*nose*nose+ski.tailRiseM*tail,
    halfWidth:ski.widthM/2*(1-.75*nose**4)*(1-.30*tail)};
}

type ContactPose=Pick<ReturnType<typeof jointPose>,'legs'|'vAngleRad'|'skiPitch'|'ankleHeightM'>;
export interface SkiContactSample {
  /** Signed vertical distance to the terrain, negative means penetration. */
  minimumClearanceM:number;
  point:Point3;
  surfacePoint:Point3;
  localPoint:Point3;
  skiIndex:number;
  section:number;
  edge:-1|1;
}
export interface SkiContactResult extends SkiContactSample {
  hasSurface:boolean;
  skiSamples:[SkiContactSample|null,SkiContactSample|null];
}

const profiles=new WeakMap<EquipmentConfig,{signature:string;points:ReturnType<typeof skiProfileAt>[]}>();
function sampledProfile(config:EquipmentConfig) {
  const s=config.ski,b=config.binding;
  const signature=[s.lengthM,s.widthM,s.tipRiseM,s.tailRiseM,b.bootToePositionM,b.frontAttachmentOffsetM,b.frontPivotHeightM].join(',');
  const existing=profiles.get(config);
  if(existing?.signature===signature)return existing.points;
  const points=Array.from({length:SKI_PROFILE_SECTIONS+1},(_,i)=>skiProfileAt(config,s.lengthM*i/SKI_PROFILE_SECTIONS));
  profiles.set(config,{signature,points});
  return points;
}

/** Sample both edges of both ski soles using exactly the render transforms:
 * ankle + Ry(V) [rotated front attachment + Rz(boot pitch + heel) profile],
 * then the body's Rx(roll) Rz(pitch) and world position. The terrain callback
 * selects the shared inrun/landing profile; it cannot alter the ski geometry. */
export function sampleSkiContact(config:EquipmentConfig,pose:ContactPose,pitch:number,roll:number,
  rootPosition:Point3,heelAngles:readonly number[],surfaceHeight:(x:number,z:number)=>number|null):SkiContactResult {
  const b=config.binding,profile=sampledProfile(config);
  const cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);
  const cb=Math.cos(pose.skiPitch),sb=Math.sin(pose.skiPitch);
  const pivotX=-b.ankleOffsetM+b.frontAttachmentOffsetM,pivotY=b.frontPivotHeightM-pose.ankleHeightM;
  const frontX=pivotX*cb-pivotY*sb,frontY=pivotX*sb+pivotY*cb;
  let best:SkiContactSample|undefined;
  const skiSamples:SkiContactSample[]=[];
  for(let skiIndex=0;skiIndex<2;skiIndex++) {
    const leg=pose.legs[skiIndex],yaw=(skiIndex===0?1:-1)*pose.vAngleRad;
    const cy=Math.cos(yaw),sy=Math.sin(yaw),angle=pose.skiPitch+(heelAngles[skiIndex]??0);
    const ca=Math.cos(angle),sa=Math.sin(angle);
    for(let section=0;section<profile.length;section++)for(const edge of [-1,1] as const) {
      const vertex=profile[section],x=frontX+vertex.x*ca-vertex.yBottom*sa;
      const y=frontY+vertex.x*sa+vertex.yBottom*ca,z=edge*vertex.halfWidth;
      const localPoint={x:leg.ankleX+x*cy+z*sy,y:pose.ankleHeightM+y,z:leg.ankleZ-x*sy+z*cy};
      const alongX=localPoint.x*cp-localPoint.y*sp,alongY=localPoint.x*sp+localPoint.y*cp;
      const point={x:rootPosition.x+alongX,y:rootPosition.y+alongY*cr-localPoint.z*sr,
        z:rootPosition.z+alongY*sr+localPoint.z*cr};
      const surfaceY=surfaceHeight(point.x,point.z);
      if(surfaceY===null)continue; // Outside this collision surface's domain.
      const minimumClearanceM=point.y-surfaceY;
      if(!Number.isFinite(minimumClearanceM))throw new Error('Ski contact requires a finite surface and physical pose.');
      if(!skiSamples[skiIndex]||minimumClearanceM<skiSamples[skiIndex].minimumClearanceM) {
        skiSamples[skiIndex]={minimumClearanceM,point,surfacePoint:{x:point.x,y:surfaceY,z:point.z},localPoint,skiIndex,section,edge};
      }
      if(!best||minimumClearanceM<best.minimumClearanceM)best=skiSamples[skiIndex];
    }
  }
  const empty:SkiContactSample={minimumClearanceM:Infinity,point:{...rootPosition},surfacePoint:{...rootPosition},localPoint:{x:0,y:0,z:0},skiIndex:-1,section:-1,edge:-1};
  return {...(best??empty),hasSurface:Boolean(best),skiSamples:[skiSamples[0]??null,skiSamples[1]??null]};
}
