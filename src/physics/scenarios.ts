import {AIR_DENSITY,G} from './aerodynamics';
import {DT,Simulation,type SimOptions} from './simulation';
import {certificate} from '../world/hill';

/** Reproducible input comparisons, not optimal/experimentally measured jumps. */
export interface ScenarioDefinition {
  id:string;
  label:string;
  description:string;
  gesture:null|{startX:number;speedPxPerSecond:number;maxUpPx:number};
  flightTrim?:{startFlightSeconds:number;targetBodyLeanRad:number;speedPxPerSecond:number};
  windChanges?:readonly {atFlightSeconds:number;x:number;z:number}[];
}

export const SCENARIOS:readonly ScenarioDefinition[]=[
  {id:'no-takeoff',label:'Bez wybicia',description:'Najazd bez gestu; odlot z końca progu.',gesture:null},
  {id:'nominal',label:'Wybicie referencyjne',description:'500 px/s od x=−6.5 m, maksymalnie 120 px w górę. Nie jest wyznaczonym optimum.',gesture:{startX:-6.5,speedPxPerSecond:500,maxUpPx:120}},
  {id:'early',label:'Wczesne wybicie',description:'Ta sama prędkość i limit długości gestu od x=−8 m.',gesture:{startX:-8,speedPxPerSecond:500,maxUpPx:120}},
  {id:'late',label:'Spóźnione wybicie',description:'Ten sam gest zaczyna się dopiero przy x=−1 m; kontakt ogranicza jego wykonanie.',gesture:{startX:-1,speedPxPerSecond:500,maxUpPx:120}},
  {id:'excessive',label:'Przesadzone wybicie',description:'1200 px/s od x=−6.5 m, maksymalnie 180 px. Brak ruchu bocznego i gotowego obrotu.',gesture:{startX:-6.5,speedPxPerSecond:1200,maxUpPx:180}},
  {id:'changing-wind',label:'Zmienny wiatr',description:'Wybicie referencyjne; od 0.75 s lotu wiatr −2 m/s, od 1.75 s +2 m/s w osi X.',gesture:{startX:-6.5,speedPxPerSecond:500,maxUpPx:120},windChanges:[{atFlightSeconds:.75,x:-2,z:0},{atFlightSeconds:1.75,x:2,z:0}]},
  {id:'upright-flight',label:'Bardziej pionowy tułów',description:'Wybicie referencyjne; od 0.6 s lotu gest 1000 px/s zmierza do pochylenia tułowia 1.05 rad od lokalnego pionu.',gesture:{startX:-6.5,speedPxPerSecond:500,maxUpPx:120},flightTrim:{startFlightSeconds:.6,targetBodyLeanRad:1.05,speedPxPerSecond:1000}},
  {id:'flat-flight',label:'Bardziej płaski tułów',description:'Wybicie referencyjne; od 0.6 s lotu gest 1000 px/s zmierza do pochylenia tułowia 1.42 rad od lokalnego pionu.',gesture:{startX:-6.5,speedPxPerSecond:500,maxUpPx:120},flightTrim:{startFlightSeconds:.6,targetBodyLeanRad:1.42,speedPxPerSecond:1000}},
];

export interface ScenarioConfiguration extends Required<SimOptions>{windX:number;windZ:number}
export const DEFAULT_SCENARIO_CONFIGURATION:Readonly<ScenarioConfiguration>={mass:78,airDensity:AIR_DENSITY,gravity:G,gate:certificate.inrun.gates,windX:0,windZ:0};

export type ScenarioInput=
  |{tick:number;type:'gesture';up:number;side:number;duration:number}
  |{tick:number;type:'trim';up:number;side:number}
  |{tick:number;type:'wind';x:number;z:number};

export interface ScenarioMetrics {
  phase:string;stopReason:'contact'|'invalid'|'timeout';ticks:number;elapsedSeconds:number;flightSeconds:number;
  resultDistanceM:number;contactNormalSpeedMps:number;takeoffImpulseNs:number;positiveActuatorWorkJ:number;
  peakPitchRateRadPerSecond:number;peakRollRateRadPerSecond:number;peakNormalForceN:number;
  takeoffTimeSeconds:number|null;takeoffXMetres:number|null;takeoffPitchRad:number|null;takeoffPitchRateRadPerSecond:number|null;
  contactPitchRad:number;contactPitchRateRadPerSecond:number;gestureUpPx:number;gestureDurationSeconds:number;
}

export interface ScenarioRun {
  schemaVersion:1;scenario:ScenarioDefinition;configuration:ScenarioConfiguration;fixedStepSeconds:number;
  inputs:ScenarioInput[];metrics:ScenarioMetrics;
  finalState:{comX:number;comY:number;comZ:number;vx:number;vy:number;vz:number;pitch:number;roll:number;omega:number;rollRate:number;bodyLean:number};
}

function makeSimulation(configuration:ScenarioConfiguration){
  const sim=new Simulation(configuration);
  sim.wind=configuration.windX;sim.crossWind=configuration.windZ;sim.reset(false);
  return sim;
}

function applyInput(sim:Simulation,input:ScenarioInput){
  if(input.type==='gesture')sim.gesture(input);
  else if(input.type==='trim')sim.trim(input.up,input.side);
  else {sim.wind=input.x;sim.crossWind=input.z;}
}

function evaluate(scenario:ScenarioDefinition,configuration:ScenarioConfiguration,maxTicks:number,
  inputsForTick:(sim:Simulation,tick:number)=>ScenarioInput[]):ScenarioRun{
  if(!Number.isInteger(maxTicks)||maxTicks<1||maxTicks>120*120)throw new RangeError('Scenario budget must be 1..14400 fixed ticks');
  const sim=makeSimulation(configuration),inputs:ScenarioInput[]=[];
  let peakPitch=0,peakRoll=0,peakNormal=0,takeoff:null|{time:number;x:number;pitch:number;omega:number}=null;
  let stopReason:ScenarioMetrics['stopReason']='timeout',ticks=0;
  for(let tick=0;tick<maxTicks;tick++){
    for(const input of inputsForTick(sim,tick)){applyInput(sim,input);inputs.push({...input});}
    const phaseBefore=sim.phase;
    sim.step();ticks=tick+1;
    peakPitch=Math.max(peakPitch,Math.abs(sim.omega));peakRoll=Math.max(peakRoll,Math.abs(sim.rollRate));
    peakNormal=Math.max(peakNormal,sim.lastStep?.contact?.normalForce??sim.normalForce);
    if(phaseBefore==='inrun'&&sim.phase==='flight')takeoff={time:sim.time,x:sim.x,pitch:sim.pitch,omega:sim.omega};
    if(sim.phase==='landed'||sim.phase==='fallen'){stopReason='contact';break;}
    if(sim.phase==='invalid'){stopReason='invalid';break;}
  }
  return {
    schemaVersion:1,scenario:structuredClone(scenario),configuration:{...configuration},fixedStepSeconds:DT,inputs,
    metrics:{phase:sim.phase,stopReason,ticks,elapsedSeconds:sim.time,flightSeconds:sim.flightTime,
      resultDistanceM:sim.resultDistance,contactNormalSpeedMps:sim.impact,takeoffImpulseNs:sim.takeoffImpulse,
      positiveActuatorWorkJ:sim.muscleWork,peakPitchRateRadPerSecond:peakPitch,peakRollRateRadPerSecond:peakRoll,
      peakNormalForceN:peakNormal,takeoffTimeSeconds:takeoff?.time??null,takeoffXMetres:takeoff?.x??null,
      takeoffPitchRad:takeoff?.pitch??null,takeoffPitchRateRadPerSecond:takeoff?.omega??null,
      contactPitchRad:sim.pitch,contactPitchRateRadPerSecond:sim.omega,
      gestureUpPx:inputs.reduce((sum,input)=>sum+(input.type==='gesture'?input.up:0),0),gestureDurationSeconds:sim.gestureDuration},
    finalState:{comX:sim.comX,comY:sim.comY,comZ:sim.comZ,vx:sim.vx,vy:sim.vy,vz:sim.vz,
      pitch:sim.pitch,roll:sim.roll,omega:sim.omega,rollRate:sim.rollRate,bodyLean:sim.bodyLean},
  };
}

/** Pointer inputs enter before each solver tick, independent of rendering fps.
 * A timeout is a diagnostic failure, never a forced landing. */
export function runScenario(scenarioOrId:ScenarioDefinition|string,options:{configuration?:Partial<ScenarioConfiguration>;maxTicks?:number}={}):ScenarioRun{
  const scenario=typeof scenarioOrId==='string'?SCENARIOS.find(item=>item.id===scenarioOrId):scenarioOrId;
  if(!scenario)throw new RangeError(`Unknown scenario: ${scenarioOrId}`);
  const configuration={...DEFAULT_SCENARIO_CONFIGURATION,...options.configuration};
  let sentUp=0,windIndex=0;
  return evaluate(scenario,configuration,options.maxTicks??Math.round(16/DT),(sim,tick)=>{
    const inputs:ScenarioInput[]=[];
    while(sim.phase==='flight'&&windIndex<(scenario.windChanges?.length??0)){
      const change=scenario.windChanges![windIndex];
      if(sim.flightTime+1e-12<change.atFlightSeconds)break;
      inputs.push({tick,type:'wind',x:change.x,z:change.z});windIndex++;
    }
    const gesture=scenario.gesture;
    if(gesture&&sim.phase==='inrun'&&sim.x>=gesture.startX&&sentUp<gesture.maxUpPx-1e-12){
      const up=Math.min(gesture.speedPxPerSecond*DT,gesture.maxUpPx-sentUp);
      // A truncated last event retains the prescribed pointer velocity.
      const duration=up/gesture.speedPxPerSecond;
      inputs.push({tick,type:'gesture',up,side:0,duration});sentUp+=up;
    }
    const trim=scenario.flightTrim;
    if(trim&&sim.phase==='flight'&&sim.flightTime+1e-12>=trim.startFlightSeconds){
      const remainingUp=(trim.targetBodyLeanRad-sim.bodyLean)/.001;
      const maximum=trim.speedPxPerSecond*DT;
      if(Math.abs(remainingUp)>1e-9)inputs.push({tick,type:'trim',up:Math.sign(remainingUp)*Math.min(Math.abs(remainingUp),maximum),side:0});
    }
    return inputs;
  });
}

/** Reapply observed tick-indexed input schedule, without re-running triggers.
 * This compact comparison replay is separate from the full JumpRecorder JSON. */
export function replayScenario(run:ScenarioRun):ScenarioRun{
  const byTick=new Map<number,ScenarioInput[]>();
  for(const input of run.inputs){const values=byTick.get(input.tick)??[];values.push(input);byTick.set(input.tick,values);}
  return evaluate(run.scenario,run.configuration,run.metrics.ticks,(_sim,tick)=>byTick.get(tick)??[]);
}

export const runScenarioSuite=()=>SCENARIOS.map(scenario=>runScenario(scenario));
