import './style.css';
import {Simulation,FixedClock} from './physics/simulation';
import {GestureInput} from './input/gesture';
import {View} from './render/scene';
const canvas=document.querySelector<HTMLCanvasElement>('#scene')!;const sim=new Simulation(),clock=new FixedClock(),input=new GestureInput(canvas),view=new View(canvas);let paused=false,last=0;
const el=(id:string)=>document.getElementById(id)!;
function reset(demo=false){sim.reset(demo);input.clear();clock.accumulator=0;paused=false;el('pause').textContent='Pauza'}
el('start').onclick=()=>reset();el('demo').onclick=()=>reset(true);el('camera').onclick=()=>{view.side=!view.side;el('camera').textContent=view.side?'Kamera: boczna':'Kamera: śledzenie'};function pause(){paused=!paused;el('pause').textContent=paused?'Wznów':'Pauza'}el('pause').onclick=pause;window.addEventListener('keydown',e=>{if(e.code==='KeyR')reset();if(e.code==='Space'){e.preventDefault();pause()}});
const phases:Record<string,string>={ready:'Gotowy do najazdu',inrun:'Najazd',flight:'Lot · przejście do V',landed:'Kontakt ustany',fallen:'Utrata stabilności'};
function frame(t:number){const dt=last?(t-last)/1000:0;last=t;if(!paused){for(const g of input.consume())sim.gesture(g);clock.advance(dt,()=>sim.step());}else input.clear();view.render(sim);el('phase').textContent=phases[sim.phase];el('speed').innerHTML=`${((sim.phase==='flight'?Math.hypot(sim.vx,sim.vy):sim.v)*3.6).toFixed(1)} <small>km/h</small>`;el('distance').innerHTML=`${Math.max(0,-sim.x).toFixed(1)} <small>m</small>`;el('extension').style.width=`${sim.extension*100}%`;el('notice').textContent=sim.x>-8&&sim.phase==='inrun'?'TERAZ · płynny gest w górę':sim.phase==='fallen'?`Kontakt: ${sim.impact.toFixed(1)} m/s · R, aby powtórzyć`:'Model eksperymentalny · skala w metrach';requestAnimationFrame(frame)}requestAnimationFrame(frame);
Object.assign(window,{SKYLIFT:{sim,view,reset,pause,step:(n:number)=>{paused=true;for(let i=0;i<n;i++)sim.step();view.render(sim)}}});
