import './style.css';
import { Simulation, FixedClock, DT } from './physics/simulation';
import { GestureInput } from './input/gesture';
import { View, captureRenderState, type CameraMode } from './render/scene';
import { WindTunnelPanel } from './lab/panel';
import { PhysicsDebuggerPanel } from './debug/panel';
import { JumpRecorder, MAX_RECORDING_FRAMES } from './physics/recorder';
import {certificate,distanceAt,inrunDistance} from './world/hill';

const el = (id: string) => document.getElementById(id)!;
const canvas = el('scene') as HTMLCanvasElement;
const sim = new Simulation();
const clock = new FixedClock();
const input = new GestureInput(canvas);
let paused = false;
let last = 0;

function startApp() {
  const view = new View(canvas);
  const tunnel = new WindTunnelPanel();
  const recorder = new JumpRecorder(sim);
  let preview: Simulation | undefined;
  let previousCamera: CameraMode = view.mode;
  const physicsDebugger = new PhysicsDebuggerPanel({
    getRecording: () => recorder.recording,
    getRecordings: () => recorder.history,
    onOpen: () => {
      tunnel.close(); input.clear(); clock.accumulator = 0;
      previousCamera = view.mode;
      setCamera('broadcast', true);
    },
    onClose: () => {
      view.resize();
      previousRenderState = captureRenderState(sim);
      clock.accumulator = 0; input.clear();
      setCamera(previousCamera, true);
    },
    onPreview: state => { preview = state; view.render(state); stats(state); },
    onClearPreview: () => { preview = undefined; },
    onLayout: (width, height) => {
      view.renderer.setSize(width, height, false);
      view.camera.aspect = width / height;
      view.camera.updateProjectionMatrix();
    },
  }, view.scene);
  el('hill-name').textContent=certificate.name;
  el('hill-meta').textContent=`${certificate.place} · K ${certificate.k} / HS ${certificate.hs}`;
  let previousRenderState = captureRenderState(sim);
  const cameras = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-camera]'));
  const modes: CameraMode[] = ['overview', 'broadcast', 'athlete'];
  function setCamera(mode: CameraMode, immediate = false) {
    view.setMode(mode, immediate);
    for (const button of cameras) {
      const active = button.dataset.camera === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }
  function reset(demo = false) {
    physicsDebugger.close(); tunnel.close();
    recorder.start(demo);
    previousRenderState = captureRenderState(sim);
    input.clear();
    clock.accumulator = 0;
    paused = false;
    el('pause').textContent = 'Pauza';
    setCamera('broadcast', true);
  }
  function pause() {
    paused = !paused;
    el('pause').textContent = paused ? 'Wznów' : 'Pauza';
  }
  el('open-tunnel').onclick = () => { physicsDebugger.close(); tunnel.open(); };
  el('open-debugger').onclick = () => physicsDebugger.open();
  el('start').onclick = () => reset();
  el('demo').onclick = () => reset(true);
  el('pause').onclick = pause;
  const wind=el('wind') as HTMLInputElement;
  wind.oninput=()=>{const value=Number(wind.value);recorder.queueWind(value,sim.crossWind);el('wind-value').textContent=`${value.toFixed(1)} m/s`;};
  el('help').onclick = () => {
    el('help-panel').hidden = !el('help-panel').hidden;
    el('help').setAttribute('aria-expanded', String(!el('help-panel').hidden));
  };
  for (const button of cameras) button.onclick = () => setCamera(button.dataset.camera as CameraMode);
  window.addEventListener('keydown', event => {
    if (event.code === 'Escape' && tunnel.isOpen) { tunnel.close(); return; }
    if (event.code === 'Escape' && physicsDebugger.isOpen) { physicsDebugger.close(); return; }
    if (tunnel.isOpen || physicsDebugger.isOpen) return;
    if (['INPUT','SELECT','TEXTAREA'].includes((event.target as HTMLElement)?.tagName)) return;
    if (event.repeat || (event.target as HTMLElement)?.tagName === 'BUTTON' && event.code === 'Space') return;
    if (event.code === 'KeyR') reset();
    if (event.code === 'KeyC') setCamera(modes[(modes.indexOf(view.mode) + 1) % modes.length]);
    if (event.code === 'Space') { event.preventDefault(); pause(); }
  });
  const phases: Record<string, string> = {
    ready: 'Gotowy do najazdu', inrun: 'Najazd', flight: 'Lot · przejście do V', landed: 'Lądowanie · wybieg', fallen: 'Upadek · ślizg', invalid: 'Błąd stanu symulacji',
  };
  function stats(simulation = sim) {
    const sim = simulation;
    const inAir = sim.phase === 'flight';
    el('phase').textContent = phases[sim.phase];
    const speed = sim.phase === 'ready' ? 0 : inAir ? Math.hypot(sim.vx, sim.vy) : sim.v;
    el('speed').innerHTML = `${(speed * 3.6).toFixed(1)} <small>km/h</small>`;
    const completed=sim.phase==='landed'||sim.phase==='fallen';
    el('distance-label').textContent=completed?'WYNIK':sim.x>0?'DYSTANS':'DO PROGU';
    el('distance').innerHTML = `${(completed?sim.resultDistance:sim.x>0?distanceAt(sim.x):inrunDistance(sim.x)).toFixed(1)} <small>m</small>`;
    el('extension').style.width = `${sim.extension * 100}%`;
    el('extension-value').textContent = `${Math.round(sim.extension * 100)}%`;
    const windowOpen = sim.x > -8 && sim.phase === 'inrun';
    document.body.dataset.window = windowOpen ? 'takeoff' : '';
    el('notice').textContent = sim.phase === 'ready' ? 'Obejrzyj skocznię lub rozpocznij trening'
      : windowOpen ? 'TERAZ · oba przyciski + płynny ruch w górę'
      : sim.phase === 'fallen' ? `Upadek przy ${sim.resultDistance.toFixed(1)} m · kontakt ${sim.impact.toFixed(1)} m/s · R, aby powtórzyć`
      : sim.phase === 'landed' ? `Lądowanie ${sim.resultDistance.toFixed(1)} m · kontakt ${sim.impact.toFixed(1)} m/s · R, aby powtórzyć`
      : inAir ? 'Lot · obserwuj pozycję ciała i nart'
      : sim.demo ? 'Pokaz techniki · automatyczne wybicie' : 'Zbliżasz się do progu · przygotuj wybicie';
  }
  function checkRecordingState() {
    // Existing developer tools can fabricate states outside the recorder's
    // fresh-jump contract. Keep that explicit and never export a false replay.
    if (recorder.active && !recorder.matchesCurrentState()) {
      recorder.invalidate('Stan zmieniono poza dziennikiem wejścia. Rozpocznij nowy skok, aby go nagrać.');
    }
    if (recorder.active && recorder.frameCount >= MAX_RECORDING_FRAMES) recorder.finish();
  }
  function stepSimulation() {
    checkRecordingState();
    recorder.step();
    if (recorder.active && (sim.phase === 'landed' || sim.phase === 'fallen') && sim.v <= .01) recorder.finish();
  }
  function frame(time: number) {
    const dt = last ? (time - last) / 1000 : 0;
    last = time;
    if (!paused && !tunnel.isOpen && !physicsDebugger.isOpen) {
      // Detect fabricated developer states before queuing this frame's mouse
      // input; invalidating a recording must not discard the new gesture.
      checkRecordingState();
      for (const gesture of input.consume()) recorder.queueGesture(gesture);
      for (const motion of input.consumeMotion()) recorder.queueTrim(motion.up,motion.side);
      clock.advance(dt, () => {
        previousRenderState = captureRenderState(sim);
        stepSimulation();
      });
    } else input.clear();
    if (physicsDebugger.isOpen) view.render(preview ?? sim);
    else if (paused || tunnel.isOpen) view.render(sim);
    else view.render(sim, previousRenderState, clock.accumulator / DT);
    stats(physicsDebugger.isOpen ? preview ?? sim : sim);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  Object.assign(window, { SKYLIFT: { sim, view, tunnel, recorder, debugger: physicsDebugger, reset, pause, setCamera,
    step: (n: number) => {
      paused = true; el('pause').textContent = 'Wznów';
      for (let i = 0; i < n; i++) stepSimulation();
      previousRenderState = captureRenderState(sim);
      clock.accumulator = 0;
      view.render(sim); stats();
    },
  } });
}
try { startApp(); } catch (error) {
  const box = el('fatal-error');
  box.hidden = false;
  box.textContent = 'Nie udało się uruchomić grafiki 3D. Sprawdź, czy przeglądarka ma włączoną akcelerację sprzętową, i odśwież stronę.';
  console.error(error);
}
