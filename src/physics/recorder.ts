import {Simulation,DT,type SimOptions,type StepTelemetry} from './simulation';
import type {Gesture} from '../input/gesture';
import {jointPose} from '../athlete/pose';
import type {Vector3Like} from './aerodynamics';
import {certificate} from '../world/hill';
import {PHYSICS_VERSION,PHYSICS_FINGERPRINT,HILL_FINGERPRINT,BUILD_COMMIT} from './version';

/** Absolute same-engine numerical agreement, not physical measurement accuracy. */
export const REPLAY_TOLERANCE=1e-9;
export const RECORDING_SCHEMA_VERSION=1;
export const MAX_RECORDING_FRAMES=36_000;
const MAX_JSON_LENGTH=64*1024*1024;
const MAX_COMMANDS_PER_TICK=1024;
const MAX_HISTORY=10;
const phases=new Set(['ready','inrun','flight','landed','fallen','invalid']);

export type Command=
  |{type:'gesture';gesture:Gesture}
  |{type:'trim';up:number;side:number}
  |{type:'wind';x:number;z:number};
export type RecordedCommand=Command&{accepted:boolean;reason:string|null};
const stateKeys=[
  'x','y','z','v','vx','vy','vz','comX','comY','comZ','pitch','omega','roll','rollRate',
  'extension','extensionRate','target','stroke','effort','eccentricity','normalVelocity',
  'normalForce','takeoffImpulse','muscleWork','gestureDuration','gestureSpeed','flightTime',
  'time','phase','demo','wind','crossWind','impact','bodyLean','skiPitch','pilotBank',
  'landingPose','resultDistance','aftermathTime',
] as const;
export type JumpState=Pick<Simulation,typeof stateKeys[number]>;
export interface JumpFrame {
  tick:number;time:number;phase:string;state:JumpState;
  com:{position:Vector3Like;velocity:Vector3Like;velocitySource:'integrated-flight'|'post-impact-constraint'|'finite-difference-contact'};
  orientation:{pitch:number;roll:number;yaw:null};
  angularVelocity:{pitchRate:number;rollRate:number;yawRate:null};
  pose:ReturnType<typeof jointPose>;
  wind:{vector:Vector3Like;speed:number;directionRadians:number|null};
  inputs:RecordedCommand[];automaticInputs:Gesture[];evaluation:StepTelemetry;
  forces:{lift:Vector3Like;drag:Vector3Like;aerodynamic:Vector3Like;gravity:Vector3Like;
    contact:Vector3Like|null;net:Vector3Like|null;moments:{pitch:number;roll:number;yaw:null}};
}
export interface RecordingHeader {
  schemaVersion:1;physicsVersion:string;physicsFingerprint:string;buildCommit:string;hillHash:string;
  fixedStep:number;sampleRate:120;createdAt:string;options:Required<SimOptions>;demo:boolean;
  initialWind:Vector3Like;seed:0;randomness:'none';
  units:{position:'m';velocity:'m/s';time:'s';angles:'rad';force:'N';moment:'N*m';energy:'J';
    mass:'kg';density:'kg/m^3';impulse:'N*s';gestureDistance:'CSS px';gestureSpeed:'CSS px/s'};
}
export interface JumpRecording {header:RecordingHeader;initialState:JumpState;frames:readonly JumpFrame[]}
export interface ReplayReport {valid:true;frames:number;maxError:number;sim:Simulation;recomputedFrames:readonly JumpFrame[]}

const zero=():Vector3Like=>({x:0,y:0,z:0});
const add=(...vectors:Vector3Like[]):Vector3Like=>vectors.reduce((v,a)=>({x:v.x+a.x,y:v.y+a.y,z:v.z+a.z}),zero());
function state(s:Simulation):JumpState{return Object.fromEntries(stateKeys.map(key=>[key,s[key]])) as JumpState;}
function freeze<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    for(const item of Object.values(value))freeze(item);
    Object.freeze(value);
  }
  return value;
}
function clone<T>(value:T):T{return JSON.parse(JSON.stringify(value)) as T;}
export const HILL_HASH=HILL_FINGERPRINT;
function finite(value:unknown,label:string):asserts value is number {
  if(typeof value!=='number'||!Number.isFinite(value))throw new Error(`${label}: expected a finite number`);
}
function obj(value:unknown,label:string):asserts value is Record<string,unknown> {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${label}: expected an object`);
}
function exactKeys(value:Record<string,unknown>,keys:string[],label:string){
  if(Object.keys(value).length!==keys.length||keys.some(key=>!(key in value)))throw new Error(`${label}: invalid fields`);
}
function validOptions(value:unknown):asserts value is Required<SimOptions>{
  obj(value,'header.options');exactKeys(value,['mass','airDensity','gravity','gate'],'header.options');
  for(const key of ['mass','airDensity','gravity','gate'])finite(value[key],`options.${key}`);
  const o=value as unknown as Required<SimOptions>;
  if(o.mass<=0||o.mass>1000||o.airDensity<0||o.airDensity>5||o.gravity<0||o.gravity>30||!Number.isInteger(o.gate)||o.gate<1||o.gate>certificate.inrun.gates)throw new Error('header.options: parameters outside supported recording bounds');
}
function validCommand(value:unknown,recorded=false):asserts value is RecordedCommand {
  obj(value,'input');const extras=recorded?['accepted','reason']:[];
  if(recorded&&(typeof value.accepted!=='boolean'||!(value.reason===null||typeof value.reason==='string'&&value.reason.length<200)))throw new Error('input: invalid acceptance metadata');
  if(value.type==='gesture'){
    exactKeys(value,['type','gesture',...extras],'gesture input');obj(value.gesture,'gesture');exactKeys(value.gesture,['up','side','duration'],'gesture');
    finite(value.gesture.up,'gesture.up');finite(value.gesture.side,'gesture.side');finite(value.gesture.duration,'gesture.duration');
    if(Math.abs(value.gesture.up)>1e6||Math.abs(value.gesture.side)>1e6||Math.abs(value.gesture.duration)>10)throw new Error('gesture: outside supported bounds');
  }else if(value.type==='trim'){
    exactKeys(value,['type','up','side',...extras],'trim input');finite(value.up,'trim.up');finite(value.side,'trim.side');
    if(Math.abs(value.up)>1e6||Math.abs(value.side)>1e6)throw new Error('trim: outside supported bounds');
  }else if(value.type==='wind'){
    exactKeys(value,['type','x','z',...extras],'wind input');finite(value.x,'wind.x');finite(value.z,'wind.z');
    if(Math.abs(value.x)>100||Math.abs(value.z)>100)throw new Error('wind: outside supported bounds');
  }else throw new Error('input: unknown command type');
}
function compare(actual:unknown,expected:unknown,path:string,max:{value:number},tolerance=REPLAY_TOLERANCE){
  if(typeof actual==='number'){
    finite(expected,path);if(!Number.isFinite(actual))throw new Error(`${path}: nonfinite recomputed state`);
    const error=Math.abs(actual-expected);max.value=Math.max(max.value,error);
    if(error>tolerance)throw new Error(`${path}: replay differs by ${error} (tolerance ${tolerance})`);
  }else if(actual===null||typeof actual!=='object'){
    if(actual!==expected)throw new Error(`${path}: replay value mismatch`);
  }else if(Array.isArray(actual)){
    if(!Array.isArray(expected)||expected.length!==actual.length)throw new Error(`${path}: array length mismatch`);
    actual.forEach((item,index)=>compare(item,expected[index],`${path}[${index}]`,max,tolerance));
  }else{
    obj(expected,path);const keys=Object.keys(actual);exactKeys(expected,keys,path);
    for(const key of keys)compare((actual as Record<string,unknown>)[key],expected[key],`${path}.${key}`,max,tolerance);
  }
}
function validTree(value:unknown,label:string,depth=0){
  if(depth>20)throw new Error(`${label}: excessive nesting`);
  if(typeof value==='number'){finite(value,label);return;}
  if(value===null||typeof value==='boolean')return;
  if(typeof value==='string'){if(value.length>500)throw new Error(`${label}: oversized string`);return;}
  if(Array.isArray(value)){if(value.length>MAX_RECORDING_FRAMES)throw new Error(`${label}: oversized array`);value.forEach((item,i)=>validTree(item,`${label}[${i}]`,depth+1));return;}
  obj(value,label);if(Object.keys(value).length>100)throw new Error(`${label}: excessive fields`);
  for(const [key,item] of Object.entries(value))validTree(item,`${label}.${key}`,depth+1);
}
/** Structural validation uses numeric exemplars, never trajectory exemplars. */
function shape(template:unknown,value:unknown,path:string){
  if(typeof template==='number'){finite(value,path);return;}
  if(template===null){if(value!==null)throw new Error(`${path}: expected null`);return;}
  if(Array.isArray(template)){
    if(!Array.isArray(value)||value.length!==template.length)throw new Error(`${path}: invalid array shape`);
    template.forEach((item,i)=>shape(item,value[i],`${path}[${i}]`));return;
  }
  if(typeof template==='object'){
    obj(value,path);exactKeys(value,Object.keys(template),path);
    for(const [key,item] of Object.entries(template))shape(item,value[key],`${path}.${key}`);
  }else if(typeof value!==typeof template)throw new Error(`${path}: invalid value type`);
}
const aeroTemplate={time:0,poseSampleTime:0,state:{velocity:zero(),wind:zero(),pitch:0,roll:0,omega:0,bodyLean:0,vAngle:0},lift:zero(),drag:zero(),force:zero(),pitchMoment:0,rollMoment:0,alpha:0,cl:0,cd:0,airSpeed:0,dynamicPressure:0};
const contactTemplate={time:0,angle:0,curvature:0,normalForce:0,rawForce:0,normalVelocityBefore:0,normalVelocityAfter:0,reaction:zero(),reactionLever:0,pitchMoment:0,rollMoment:0,friction:zero(),drag:zero(),muscleWork:0,applied:false};
const outrunTemplate={time:0,angle:0,friction:zero(),drag:zero(),reactionResolved:false};
const takeoffTemplate={time:0,reason:'lip',position:zero(),velocity:zero(),impulse:0,normalVelocity:0,normalForceBeforeRelease:0};
const landingTemplate={time:0,fraction:0,position:zero(),normal:zero(),preImpactVelocity:zero(),postImpulseVelocity:zero(),normalSpeed:0,normalEnergy:0,absorptionCapacity:0,angleError:0,inPiste:false,result:'landed',distance:0};
function validState(value:unknown,path:string){
  obj(value,path);exactKeys(value,[...stateKeys],path);
  for(const key of stateKeys){
    if(key==='phase'){if(!phases.has(value[key] as string))throw new Error(`${path}.phase: unsupported phase`);}
    else if(key==='demo'){if(typeof value[key]!=='boolean')throw new Error(`${path}.demo: expected boolean`);}
    else finite(value[key],`${path}.${key}`);
  }
}
function validFrame(value:Record<string,unknown>,index:number){
  const path=`frames[${index}]`;validState(value.state,`${path}.state`);
  shape({position:zero(),velocity:zero(),velocitySource:''},value.com,`${path}.com`);
  const com=value.com as {velocitySource:string};if(!['integrated-flight','post-impact-constraint','finite-difference-contact'].includes(com.velocitySource))throw new Error(`${path}.com: unsupported velocity source`);
  shape({pitch:0,roll:0,yaw:null},value.orientation,`${path}.orientation`);
  shape({pitchRate:0,rollRate:0,yawRate:null},value.angularVelocity,`${path}.angularVelocity`);
  shape(jointPose(0),value.pose,`${path}.pose`);
  obj(value.wind,`${path}.wind`);exactKeys(value.wind,['vector','speed','directionRadians'],`${path}.wind`);
  shape(zero(),value.wind.vector,`${path}.wind.vector`);finite(value.wind.speed,`${path}.wind.speed`);
  if(value.wind.directionRadians!==null)finite(value.wind.directionRadians,`${path}.wind.directionRadians`);
  obj(value.forces,`${path}.forces`);exactKeys(value.forces,['lift','drag','aerodynamic','gravity','contact','net','moments'],`${path}.forces`);
  for(const key of ['lift','drag','aerodynamic','gravity'])shape(zero(),value.forces[key],`${path}.forces.${key}`);
  for(const key of ['contact','net'])if(value.forces[key]!==null)shape(zero(),value.forces[key],`${path}.forces.${key}`);
  shape({pitch:0,roll:0,yaw:null},value.forces.moments,`${path}.forces.moments`);
  obj(value.evaluation,`${path}.evaluation`);const e=value.evaluation;
  exactKeys(e,['timeStart','timeEnd','phaseStart','phaseEnd','gravity','aero','contact','outrun','takeoff','landing','automaticInputs'],`${path}.evaluation`);
  finite(e.timeStart,`${path}.evaluation.timeStart`);finite(e.timeEnd,`${path}.evaluation.timeEnd`);
  if(!phases.has(e.phaseStart as string)||!phases.has(e.phaseEnd as string))throw new Error(`${path}.evaluation: unsupported phase`);
  shape(zero(),e.gravity,`${path}.evaluation.gravity`);
  for(const [key,template] of Object.entries({aero:aeroTemplate,contact:contactTemplate,outrun:outrunTemplate,takeoff:takeoffTemplate,landing:landingTemplate}))if(e[key]!==null)shape(template,e[key],`${path}.evaluation.${key}`);
  if(!Array.isArray(e.automaticInputs)||e.automaticInputs.length>1)throw new Error(`${path}.evaluation: invalid demo events`);
  for(const list of [value.automaticInputs,e.automaticInputs] as unknown[][])for(const gesture of list)validCommand({type:'gesture',gesture});
}
/** Strict JSON import; verification against physics runs in JumpReplay. */
export function parseJumpRecording(value:string|unknown):JumpRecording {
  if(typeof value==='string'){
    if(value.length>MAX_JSON_LENGTH)throw new Error('Recording exceeds 64 MiB import limit');
    try{value=JSON.parse(value);}catch{throw new Error('Invalid recording JSON');}
  }
  obj(value,'recording');exactKeys(value,['header','initialState','frames'],'recording');
  obj(value.header,'header');const h=value.header;
  exactKeys(h,['schemaVersion','physicsVersion','physicsFingerprint','buildCommit','hillHash','fixedStep','sampleRate','createdAt','options','demo','initialWind','seed','randomness','units'],'header');
  if(h.schemaVersion!==RECORDING_SCHEMA_VERSION)throw new Error('Unsupported recording schema version');
  if(h.physicsVersion!==PHYSICS_VERSION||h.physicsFingerprint!==PHYSICS_FINGERPRINT)throw new Error('Incompatible physics version/fingerprint; use the original physics build');
  if(h.hillHash!==HILL_HASH)throw new Error('Incompatible hill geometry');
  if(h.fixedStep!==DT||h.sampleRate!==120||h.seed!==0||h.randomness!=='none')throw new Error('Unsupported timestep or randomness');
  if(typeof h.buildCommit!=='string'||h.buildCommit.length>100||typeof h.createdAt!=='string'||!Number.isFinite(Date.parse(h.createdAt))||typeof h.demo!=='boolean')throw new Error('Invalid recording metadata');
  validOptions(h.options);obj(h.initialWind,'header.initialWind');exactKeys(h.initialWind,['x','y','z'],'header.initialWind');
  validCommand({type:'wind',x:h.initialWind.x,z:h.initialWind.z});if(h.initialWind.y!==0)throw new Error('Vertical wind is unsupported');
  const unitReference=makeHeader(new Simulation(),false,'development').units;
  compare(unitReference,h.units,'header.units',{value:0},0);
  validState(value.initialState,'initialState');
  if(!Array.isArray(value.frames)||value.frames.length>MAX_RECORDING_FRAMES)throw new Error('Invalid or oversized frame array');
  value.frames.forEach((frame:unknown,index:number)=>{
    obj(frame,`frames[${index}]`);exactKeys(frame,['tick','time','phase','state','com','orientation','angularVelocity','pose','wind','inputs','automaticInputs','evaluation','forces'],`frames[${index}]`);
    if(frame.tick!==index+1||!phases.has(frame.phase as string))throw new Error(`frames[${index}]: invalid tick or phase`);
    finite(frame.time,`frames[${index}].time`);
    if(!Array.isArray(frame.inputs)||frame.inputs.length>MAX_COMMANDS_PER_TICK)throw new Error(`frames[${index}]: invalid input journal`);
    frame.inputs.forEach((input:unknown)=>validCommand(input,true));
    if(!Array.isArray(frame.automaticInputs)||frame.automaticInputs.length>1)throw new Error(`frames[${index}]: invalid automatic inputs`);
    validFrame(frame,index);
  });
  validTree(value,'recording');
  // Bound object imports too; files normally enter through the string path.
  const serialized=JSON.stringify(value);if(serialized.length>MAX_JSON_LENGTH)throw new Error('Recording exceeds 64 MiB import limit');
  return freeze(JSON.parse(serialized) as JumpRecording);
}
function makeHeader(sim:Simulation,demo:boolean,buildCommit:string):RecordingHeader {
  return {schemaVersion:1,physicsVersion:PHYSICS_VERSION,physicsFingerprint:PHYSICS_FINGERPRINT,buildCommit,
    hillHash:HILL_HASH,fixedStep:DT,sampleRate:120,createdAt:new Date().toISOString(),options:sim.getOptions(),demo,
    initialWind:{x:sim.wind,y:0,z:sim.crossWind},seed:0,randomness:'none',
    units:{position:'m',velocity:'m/s',time:'s',angles:'rad',force:'N',moment:'N*m',energy:'J',mass:'kg',density:'kg/m^3',impulse:'N*s',gestureDistance:'CSS px',gestureSpeed:'CSS px/s'}};
}
function capture(sim:Simulation,before:JumpState,tick:number,inputs:RecordedCommand[]):JumpFrame {
  const evaluation=sim.lastStep;if(!evaluation)throw new Error('Simulation did not produce a fixed-step diagnostic sample');
  const airborne=sim.phase==='flight'||Boolean(evaluation.landing);
  const velocity=airborne?{x:sim.vx,y:sim.vy,z:sim.vz}:{x:(sim.comX-before.comX)/DT,y:(sim.comY-before.comY)/DT,z:(sim.comZ-before.comZ)/DT};
  const aero=evaluation.aero,contact=evaluation.contact;
  const lift=aero?{...aero.lift}:zero(),drag=aero?{...aero.drag}:contact?{...contact.drag}:evaluation.outrun?{...evaluation.outrun.drag}:zero();
  const reaction=contact?{...contact.reaction}:null;
  const aerodynamic=aero?{...aero.force}:{...drag};
  const net=aero?add(aerodynamic,evaluation.gravity):contact?add(aerodynamic,evaluation.gravity,contact.reaction,contact.friction):null;
  const grounded=sim.phase==='landed'||sim.phase==='fallen';
  return freeze({tick,time:sim.time,phase:sim.phase,state:state(sim),
    com:{position:{x:sim.comX,y:sim.comY,z:sim.comZ},velocity,velocitySource:evaluation.landing?'post-impact-constraint':airborne?'integrated-flight':'finite-difference-contact'},
    orientation:{pitch:sim.pitch,roll:sim.roll,yaw:null},angularVelocity:{pitchRate:sim.omega,rollRate:sim.rollRate,yawRate:null},
    pose:jointPose(sim.extension,sim.flightTime,sim.landingPose,{bodyLean:sim.bodyLean,skiPitch:sim.skiPitch,groundedSeconds:grounded?sim.aftermathTime:undefined,impactSpeed:sim.impact,fallen:sim.phase==='fallen'}),
    wind:{vector:{x:sim.wind,y:0,z:sim.crossWind},speed:Math.hypot(sim.wind,sim.crossWind),directionRadians:sim.wind===0&&sim.crossWind===0?null:Math.atan2(sim.crossWind,sim.wind)},
    inputs,automaticInputs:clone(evaluation.automaticInputs),evaluation:clone(evaluation),
    forces:{lift,drag,aerodynamic,gravity:{...evaluation.gravity},contact:reaction,net,moments:{pitch:aero?.pitchMoment??contact?.pitchMoment??0,roll:aero?.rollMoment??contact?.rollMoment??0,yaw:null}}});
}

export class JumpRecorder {
  private header:RecordingHeader|null=null;
  private initial:JumpState|null=null;
  private framesBuffer:JumpFrame[]=[];
  private pending:Command[]=[];
  private expected:JumpState|null=null;
  private enabled=false;
  private invalidReason:string|null=null;
  private archived:JumpRecording[]=[];
  private readonly buildCommit:string;
  constructor(readonly sim:Simulation,options:{buildCommit?:string}={}){this.buildCommit=options.buildCommit??BUILD_COMMIT;}
  get active(){return this.enabled;}
  get invalidationReason(){return this.invalidReason;}
  get frameCount(){return this.framesBuffer.length;}
  get frames():readonly JumpFrame[]{return Object.freeze(this.framesBuffer.slice());}
  get history():readonly JumpRecording[]{return Object.freeze(this.archived.slice());}
  frameAt(tick:number){return this.framesBuffer[tick-1]??null;}
  get recording():JumpRecording|null{
    if(this.invalidReason)throw new Error(`Recording invalid: ${this.invalidReason}`);
    if(!this.header||!this.initial)return null;
    return freeze({header:clone(this.header),initialState:clone(this.initial),frames:this.framesBuffer.slice()});
  }
  start(demo=false){
    if(this.header&&!this.invalidReason&&this.framesBuffer.length){const previous=this.recording;if(previous){this.archived.push(previous);if(this.archived.length>MAX_HISTORY)this.archived.shift();}}
    // An idle wind slider may be queued just before Start. It is initial state,
    // while pointer events from the previous jump cannot leak into the new one.
    for(const command of this.pending)if(command.type==='wind'){this.sim.wind=command.x;this.sim.crossWind=command.z;}
    this.pending=[];this.sim.reset(demo);validOptions(this.sim.getOptions());
    validCommand({type:'wind',x:this.sim.wind,z:this.sim.crossWind});
    this.header=makeHeader(this.sim,demo,this.buildCommit);this.initial=state(this.sim);
    this.framesBuffer=[];this.expected=state(this.sim);this.enabled=true;this.invalidReason=null;
  }
  finish(){this.enabled=false;this.pending=[];}
  invalidate(reason:string){this.invalidReason=reason;this.enabled=false;this.pending=[];}
  matchesCurrentState(){
    if(!this.enabled||!this.expected)return true;
    try{compare(state(this.sim),this.expected,'live state',{value:0},0);return true;}catch{return false;}
  }
  private queue(command:Command){
    validCommand(command);if(this.pending.length>=MAX_COMMANDS_PER_TICK)throw new Error('More than 1024 commands queued for one simulation tick');
    this.pending.push(clone(command));
  }
  queueGesture(gesture:Gesture){this.queue({type:'gesture',gesture});}
  queueTrim(up:number,side:number){this.queue({type:'trim',up,side});}
  queueWind(x:number,z=0){this.queue({type:'wind',x,z});}
  step(){
    if(this.enabled&&!this.matchesCurrentState())throw new Error('Unjournaled simulation mutation; recording supports normal fresh-reset jumps only');
    if(this.enabled&&this.framesBuffer.length>=MAX_RECORDING_FRAMES)throw new Error('Recording reached the 300-second fixed-step limit');
    const before=state(this.sim);const commands=this.pending.splice(0);const inputs:RecordedCommand[]=[];
    for(const command of commands){
      let accepted=true,reason:string|null=null;
      if(command.type==='gesture'){
        accepted=this.sim.gesture(command.gesture);
        if(!accepted)reason=this.sim.phase!=='inrun'?'not-inrun':this.sim.x<-8?'before-takeoff-window':'invalid-duration';
      }else if(command.type==='trim'){
        accepted=this.sim.trim(command.up,command.side);if(!accepted)reason='not-flight';
      }else{this.sim.wind=command.x;this.sim.crossWind=command.z;}
      inputs.push({...command,accepted,reason});
    }
    this.sim.step();
    if(this.enabled){
      const frame=capture(this.sim,before,this.framesBuffer.length+1,inputs);this.framesBuffer.push(frame);this.expected=state(this.sim);
    }
    return this.framesBuffer.at(-1)??null;
  }
  exportJSON(){const recording=this.recording;if(!recording)throw new Error('No jump has been started');return JSON.stringify(recording);}
}

export class JumpReplay {
  readonly recording:JumpRecording;
  private recorder:JumpRecorder;
  private tick=0;
  private maximum={value:0};
  constructor(recording:JumpRecording|unknown){this.recording=parseJumpRecording(recording);this.recorder=this.fresh();}
  private fresh(){
    const h=this.recording.header,s=new Simulation(h.options);s.wind=h.initialWind.x;s.crossWind=h.initialWind.z;
    const recorder=new JumpRecorder(s,{buildCommit:h.buildCommit});recorder.start(h.demo);
    compare(state(s),this.recording.initialState,'initialState',this.maximum,0);
    return recorder;
  }
  get sim(){return this.recorder.sim;}
  get currentTick(){return this.tick;}
  get maxError(){return this.maximum.value;}
  seek(tick:number):Simulation {
    if(!Number.isInteger(tick)||tick<0||tick>this.recording.frames.length)throw new Error('Replay tick is outside the recording');
    if(tick<this.tick){this.maximum={value:0};this.recorder=this.fresh();this.tick=0;}
    while(this.tick<tick){
      const original=this.recording.frames[this.tick];
      for(const input of original.inputs){
        if(input.type==='gesture')this.recorder.queueGesture(input.gesture);
        else if(input.type==='trim')this.recorder.queueTrim(input.up,input.side);
        else this.recorder.queueWind(input.x,input.z);
      }
      const recomputed=this.recorder.step();
      compare(recomputed,original,`frames[${this.tick}]`,this.maximum);this.tick++;
    }
    return this.sim;
  }
  validate():ReplayReport {
    this.maximum={value:0};this.recorder=this.fresh();this.tick=0;this.seek(this.recording.frames.length);
    return {valid:true,frames:this.tick,maxError:this.maximum.value,sim:this.sim,recomputedFrames:this.recorder.frames};
  }
}
export function replayJump(recording:JumpRecording|unknown):ReplayReport{return new JumpReplay(recording).validate();}
