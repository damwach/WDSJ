import {createServer} from 'vite';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const server=await createServer({server:{middlewareMode:true},logLevel:'silent'});
try{
  const {runScenarioSuite,replayScenario}=await server.ssrLoadModule('/src/physics/scenarios.ts');
  const files=['src/physics/aerodynamics.ts','src/physics/biomechanics.ts','src/physics/simulation.ts','src/athlete/pose.ts','src/athlete/rig.ts','src/world/hill.ts','src/world/certificate.ts','src/physics/scenarios.ts'];
  const sourceSha256=Object.fromEntries(await Promise.all(files.map(async file=>[file,createHash('sha256').update(await readFile(file)).digest('hex')])));
  const runs=runScenarioSuite();
  const replayChecks=runs.map(run=>{
    const replay=replayScenario(run);
    return {scenario:run.scenario.id,exactMetrics:JSON.stringify(replay.metrics)===JSON.stringify(run.metrics),exactFinalState:JSON.stringify(replay.finalState)===JSON.stringify(run.finalState)};
  });
  if(replayChecks.some(check=>!check.exactMetrics||!check.exactFinalState))throw new Error('Scenario input replay differs from the original');
  if(runs.some(run=>run.metrics.stopReason!=='contact'))throw new Error('A comparison did not reach hill contact');
  const summary={schemaVersion:1,createdAt:new Date().toISOString(),sourceSha256,
    status:'Calculations of an unvalidated reduced-order model; no measured trajectory or aerodynamic calibration.',
    comparison:'Same gate, mass, density, gravity, equipment and initial weather. Only the stated input/posture/wind disturbance changes.',
    workDefinition:'Positive work proxy of the reduced prismatic actuator, not measured muscle/joint work.',replayChecks,runs};
  await mkdir('artifacts',{recursive:true});
  await writeFile('artifacts/scenario-summary.json',JSON.stringify(summary,null,2)+'\n');
  const columns=['scenario','phase','distance_m','impact_normal_mps','takeoff_impulse_Ns','positive_actuator_work_J','peak_pitch_rate_radps','peak_normal_force_N','flight_s','total_s'];
  const rows=runs.map(({scenario,metrics:m})=>[scenario.id,m.phase,m.resultDistanceM,m.contactNormalSpeedMps,m.takeoffImpulseNs,m.positiveActuatorWorkJ,m.peakPitchRateRadPerSecond,m.peakNormalForceN,m.flightSeconds,m.elapsedSeconds]);
  await writeFile('artifacts/scenario-summary.csv',[columns,...rows].map(row=>row.join(',')).join('\n')+'\n');
  console.log('Scenario comparisons and exact input replay: artifacts/scenario-summary.json and .csv');
  console.table(rows.map(row=>Object.fromEntries(columns.map((name,i)=>[name,row[i]]))));
}finally{await server.close();}
