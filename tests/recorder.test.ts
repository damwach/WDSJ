import {describe,expect,it} from 'vitest';
import {Simulation,FixedClock,DT} from '../src/physics/simulation';
import {JumpRecorder,JumpReplay,parseJumpRecording,replayJump,REPLAY_TOLERANCE,HILL_HASH} from '../src/physics/recorder';
import {aerodynamicForces} from '../src/physics/aerodynamics';
import {landingSlope} from '../src/world/hill';
import {PHYSICS_FINGERPRINT,PHYSICS_VERSION} from '../src/physics/version';

function demo(ticks=1450){const recorder=new JumpRecorder(new Simulation());recorder.start(true);for(let i=0;i<ticks;i++)recorder.step();return recorder;}
const editable=(recorder:JumpRecorder)=>JSON.parse(recorder.exportJSON());

describe('120 Hz jump recording and deterministic reconstruction',()=>{
  it('exports SI metadata and reconstructs a whole demo including landing and outrun',()=>{
    const recorder=demo(),recording=recorder.recording!;
    expect(recording.header).toMatchObject({schemaVersion:1,sampleRate:120,fixedStep:DT,seed:0,randomness:'none',physicsVersion:PHYSICS_VERSION,physicsFingerprint:PHYSICS_FINGERPRINT,hillHash:HILL_HASH,options:{mass:78,gate:34}});
    expect(recording.frames.some(f=>f.evaluation.landing)).toBe(true);
    const result=replayJump(parseJumpRecording(recorder.exportJSON()));
    expect(result.valid).toBe(true);expect(result.frames).toBe(1450);expect(result.maxError).toBe(0);
    expect(result.sim.snapshot()).toEqual(recorder.sim.snapshot());
    expect(result.recomputedFrames.at(-1)!.com.position).toEqual(recording.frames.at(-1)!.com.position);
  });

  it('queues commands for fixed ticks and reports valid ignored inputs without replaying demo twice',()=>{
    const recorder=new JumpRecorder(new Simulation());recorder.start(true);
    const raw={up:10,side:2,duration:.02};recorder.queueGesture(raw);raw.up=900;
    recorder.queueTrim(5,3);recorder.queueGesture({up:10,side:0,duration:0});recorder.queueWind(-2,1);
    expect(recorder.sim.wind).toBe(0);expect(recorder.sim.stroke).toBe(0);const frame=recorder.step()!;
    expect(frame.inputs).toEqual([
      {type:'gesture',gesture:{up:10,side:2,duration:.02},accepted:false,reason:'before-takeoff-window'},
      {type:'trim',up:5,side:3,accepted:false,reason:'not-flight'},
      {type:'gesture',gesture:{up:10,side:0,duration:0},accepted:false,reason:'before-takeoff-window'},
      {type:'wind',x:-2,z:1,accepted:true,reason:null},
    ]);
    for(let i=1;i<1200;i++)recorder.step();
    expect(recorder.frames.some(f=>f.automaticInputs.length===1)).toBe(true);
    expect(recorder.frames.filter(f=>f.inputs.length).length).toBe(1);
    expect(replayJump(recorder.recording!).maxError).toBe(0);
  });

  it('retains custom options, initial wind and all mid-flight changes in event order',()=>{
    const recorder=new JumpRecorder(new Simulation({mass:63,airDensity:.9,gravity:9.81,gate:25}));
    recorder.queueWind(-1,.4);recorder.start(false);expect(recorder.recording!.header.initialWind).toEqual({x:-1,y:0,z:.4});
    while(recorder.sim.phase==='inrun'&&recorder.sim.x<-6)recorder.step();
    recorder.queueGesture({up:120,side:8,duration:.2});recorder.step();
    while(recorder.sim.phase==='inrun')recorder.step();
    recorder.queueWind(2,-.5);recorder.queueTrim(20,-10);recorder.queueWind(-3,.8);recorder.step();
    for(let i=0;i<400;i++)recorder.step();
    const result=replayJump(recorder.recording!);
    expect(result.maxError).toBe(0);expect(result.sim.getOptions()).toEqual({mass:63,airDensity:.9,gravity:9.81,gate:25});
    expect(result.sim.wind).toBe(-3);expect(result.sim.crossWind).toBe(.8);expect(result.sim.bodyLean).toBe(recorder.sim.bodyLean);
  });

  it('records contact COM differences instead of stale airborne fields and retains reaction at release',()=>{
    const recorder=demo();const contact=recorder.frames.find(f=>f.phase==='inrun'&&f.state.v>10)!;
    expect(contact.state.vx).toBe(0);expect(contact.com.velocitySource).toBe('finite-difference-contact');
    expect(Math.hypot(...Object.values(contact.com.velocity))).toBeGreaterThan(10);
    expect(contact.forces.contact!.y).toBeGreaterThan(0);
    const launch=recorder.frames.find(f=>f.evaluation.takeoff)!;
    expect(launch.state.normalForce).toBe(0);
    expect(launch.evaluation.takeoff!.normalForceBeforeRelease).toBeGreaterThan(0);
    expect(launch.evaluation.contact!.normalForce).toBe(launch.evaluation.takeoff!.normalForceBeforeRelease);
    expect(launch.com.velocitySource).toBe('integrated-flight');
  });

  it('captures exact aerodynamic evaluation state independently of post-step pose and velocities',()=>{
    const recorder=demo(1050),frame=recorder.frames.find(f=>f.evaluation.aero)!;const a=frame.evaluation.aero!;
    const forces=aerodynamicForces(a.state,{density:recorder.sim.airDensity});
    expect(a.time).toBe(frame.evaluation.timeStart);expect(a.poseSampleTime).toBe(frame.time);
    expect(a.state.velocity).not.toEqual({x:frame.state.vx,y:frame.state.vy,z:frame.state.vz});
    for(const key of ['force','lift','drag'] as const)for(const axis of ['x','y','z'] as const)expect(a[key][axis]).toBeCloseTo(forces[key][axis],12);
    expect(a.pitchMoment).toBe(forces.moment);
    expect(frame.forces.net).toEqual({x:a.force.x,y:a.force.y-recorder.sim.mass*recorder.sim.gravity,z:a.force.z});
    expect(frame.orientation.yaw).toBeNull();expect(frame.angularVelocity.yawRate).toBeNull();expect(frame.forces.moments.yaw).toBeNull();
  });

  it('preserves pre-impact velocity, dissipated normal energy and post-impact constraint velocity',()=>{
    const recorder=demo(),frame=recorder.frames.find(f=>f.evaluation.landing)!;const l=frame.evaluation.landing!;
    const dot=l.preImpactVelocity.x*l.normal.x+l.preImpactVelocity.y*l.normal.y+l.preImpactVelocity.z*l.normal.z;
    expect(l.normalSpeed).toBeCloseTo(Math.abs(dot),12);expect(l.normalEnergy).toBe(.5*recorder.sim.mass*l.normalSpeed**2);
    expect(l.postImpulseVelocity.y-landingSlope(l.position.x)*l.postImpulseVelocity.x).toBeCloseTo(0,12);
    expect(frame.com.velocity).toEqual(l.postImpulseVelocity);expect(frame.com.velocitySource).toBe('post-impact-constraint');
    expect(l.time).toBeGreaterThanOrEqual(frame.evaluation.timeStart);expect(l.time).toBeLessThanOrEqual(frame.time);
    expect(recorder.frames.at(-1)!.evaluation.outrun!.reactionResolved).toBe(false);
    expect(recorder.frames.at(-1)!.forces.contact).toBeNull();expect(recorder.frames.at(-1)!.forces.net).toBeNull();
  });

  it('reconstructs incremental forward seeks and clean backward seeks without changing the live jump',()=>{
    const recorder=demo(1100),live=recorder.sim.snapshot(),replay=new JumpReplay(recorder.recording!);
    const first=replay.seek(10);expect(replay.seek(20)).toBe(first);expect(replay.currentTick).toBe(20);
    const late=replay.seek(1000).snapshot();expect(replay.seek(0).time).toBe(0);
    expect(replay.seek(1000).snapshot()).toEqual(late);expect(recorder.sim.snapshot()).toEqual(live);
    expect(()=>replay.seek(-1)).toThrow('outside');expect(()=>replay.seek(1101)).toThrow('outside');
  });

  it('has the same 120 Hz records regardless of presentation frame partition',()=>{
    const run=(fps:number)=>{const recorder=new JumpRecorder(new Simulation());recorder.start(true);const clock=new FixedClock();for(let i=0;i<8*fps;i++)clock.advance(1/fps,()=>{if(recorder.frameCount===850)recorder.queueWind(-1,.3);recorder.step();});return recorder.recording!;};
    const slow=run(30),fast=run(144);expect(slow.frames.length).toBe(960);expect(fast.frames).toEqual(slow.frames);
  });

  it('provides frozen detached exports, immutable samples and bounded prior-jump history',()=>{
    const recorder=demo(3),snapshot=recorder.recording!;recorder.step();
    expect(snapshot.frames.length).toBe(3);expect(recorder.frameCount).toBe(4);
    expect(Object.isFrozen(snapshot)).toBe(true);expect(Object.isFrozen(snapshot.frames[0].pose.legs[0])).toBe(true);
    expect(()=>{snapshot.frames[0].state.x=1;}).toThrow();
    for(let i=0;i<12;i++){recorder.start();recorder.step();recorder.finish();}
    expect(recorder.history.length).toBe(10);expect(Object.isFrozen(recorder.history[0])).toBe(true);
    expect(recorder.active).toBe(false);expect(recorder.recording!.frames.length).toBe(1);
  });

  it('rejects unjournaled direct mutations without advancing the simulation',()=>{
    const recorder=demo(10);recorder.sim.wind=3;const before=recorder.sim.time;
    expect(recorder.matchesCurrentState()).toBe(false);expect(()=>recorder.step()).toThrow('Unjournaled');expect(recorder.sim.time).toBe(before);
    recorder.invalidate('test fabricated initial state');expect(recorder.active).toBe(false);expect(recorder.invalidationReason).toBe('test fabricated initial state');
    expect(()=>recorder.exportJSON()).toThrow('Recording invalid');recorder.start();expect(recorder.invalidationReason).toBeNull();expect(recorder.history.length).toBe(0);
  });

  it('rejects tampered trajectories and input journals while reporting field-specific disagreement',()=>{
    const recorder=demo(20),a=editable(recorder);a.frames[10].com.position.x+=.1;
    expect(()=>replayJump(a)).toThrow('frames[10].com.position.x');
    const b=editable(recorder);b.frames[3].inputs.push({type:'wind',x:3,z:0,accepted:true,reason:null});
    expect(()=>replayJump(b)).toThrow('frames[3]');
    const c=editable(recorder);c.initialState.x+=.01;expect(()=>new JumpReplay(c)).toThrow('initialState.x');
  });

  it('uses a declared absolute tolerance and permits different commits with identical physics sources',()=>{
    const recorder=demo(10),a=editable(recorder);a.frames[4].state.x+=REPLAY_TOLERANCE/2;a.header.buildCommit='different-ui-only-commit';
    const result=replayJump(a);expect(result.maxError).toBeGreaterThan(0);expect(result.maxError).toBeLessThanOrEqual(REPLAY_TOLERANCE);
    a.frames[4].state.x+=REPLAY_TOLERANCE*2;expect(()=>replayJump(a)).toThrow('tolerance');
  });

  it.each(['schemaVersion','physicsVersion','physicsFingerprint','hillHash','fixedStep','sampleRate','seed'] as const)('rejects incompatible header %s before simulation',key=>{
    const a=editable(demo(1));a.header[key]=typeof a.header[key]==='number'?999:'incompatible';expect(()=>parseJumpRecording(a)).toThrow();
  });

  it('rejects malformed, nonfinite, oversized and unsupported imported data',()=>{
    const recorder=demo(1);expect(()=>parseJumpRecording('{bad')).toThrow('Invalid recording JSON');
    const malformed=editable(recorder);delete malformed.frames[0].forces.gravity.y;expect(()=>parseJumpRecording(malformed)).toThrow('invalid fields');
    const nonfinite=editable(recorder);nonfinite.frames[0].state.x=Infinity;expect(()=>parseJumpRecording(nonfinite)).toThrow('finite');
    const yaw=editable(recorder);yaw.frames[0].orientation.yaw=0;expect(()=>parseJumpRecording(yaw)).toThrow('null');
    const bounds=editable(recorder);bounds.header.options.mass=0;expect(()=>parseJumpRecording(bounds)).toThrow('bounds');
    const vertical=editable(recorder);vertical.header.initialWind.y=1;expect(()=>parseJumpRecording(vertical)).toThrow('Vertical wind');
    const ticks=editable(recorder);ticks.frames[0].tick=2;expect(()=>parseJumpRecording(ticks)).toThrow('invalid tick');
    const extra=editable(recorder);extra.frames[0].arbitrary=1;expect(()=>parseJumpRecording(extra)).toThrow('invalid fields');
    expect(()=>recorder.queueWind(Infinity)).toThrow('finite');
    const empty=new JumpRecorder(new Simulation());expect(empty.recording).toBeNull();expect(()=>empty.exportJSON()).toThrow('No jump');
  });
});
