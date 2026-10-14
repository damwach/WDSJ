import { loadAthleteAsset } from './athlete/skin';
import './style.css';
import { Simulation, FixedClock, DT } from './physics/simulation';
import { GestureInput } from './input/gesture';
import { View, captureRenderState, type CameraMode } from './render/scene';
import { WindTunnelPanel } from './lab/panel';
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
    sim.reset(demo);
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
  el('open-tunnel').onclick = () => tunnel.open();
  el('start').onclick = () => reset();
  el('demo').onclick = () => reset(true);
  el('pause').onclick = pause;
  const wind=el('wind') as HTMLInputElement;
  wind.oninput=()=>{sim.wind=Number(wind.value);el('wind-value').textContent=`${sim.wind.toFixed(1)} m/s`;};
  el('help').onclick = () => {
    el('help-panel').hidden = !el('help-panel').hidden;
    el('help').setAttribute('aria-expanded', String(!el('help-panel').hidden));
  };
  for (const button of cameras) button.onclick = () => setCamera(button.dataset.camera as CameraMode);
  window.addEventListener('keydown', event => {
    if (event.code === 'Escape' && tunnel.isOpen) { tunnel.close(); return; }
    if (tunnel.isOpen) return;
    if (event.repeat || (event.target as HTMLElement)?.tagName === 'BUTTON' && event.code === 'Space') return;
    if (event.code === 'KeyR') reset();
    if (event.code === 'KeyC') setCamera(modes[(modes.indexOf(view.mode) + 1) % modes.length]);
    if (event.code === 'Space') { event.preventDefault(); pause(); }
  });
  const phases: Record<string, string> = {
    ready: 'Gotowy do najazdu', inrun: 'Najazd', flight: 'Lot · przejście do V', landed: 'Lądowanie · wybieg', fallen: 'Upadek · ślizg', invalid: 'Błąd stanu symulacji',
  };
  function stats() {
    const inAir = sim.phase === 'flight';
    el('phase').textContent = phases[sim.phase];
    const speed = sim.phase === 'ready' ? 0 : inAir ? Math.hypot(sim.vx, sim.vy) : sim.v;
    el('speed').innerHTML = `${(speed * 3.6).toFixed(1)} <small>km/h</small>`;
    const completed=sim.phase==='landed'||sim.phase==='fallen';
    el('distance-label').textContent=completed?'WYNIK':sim.x>0?'DYSTANS':'DO PROGU';
    el('distance').innerHTML = `${(completed?sim.resultDistance:sim.x>0?distanceAt(sim.x):inrunDistance(sim.x)).toFixed(1)} <small>m</small>`;
    el('extension').style.width = `${sim.extension * 100}%`;
    el('extension-value').textContent = `${Math.round(sim.extension * 100)}%`;
    const windowOpen = sim.x > -8 && sim.phase === 'inrun' && !sim.takeoffClicked;
    document.body.dataset.window = windowOpen ? 'takeoff' : '';
    el('notice').textContent = sim.phase === 'ready' ? 'Obejrzyj skocznię lub rozpocznij trening'
      : windowOpen ? 'TERAZ · naciśnij lewy i prawy przycisk razem'
      : sim.phase === 'inrun' && sim.takeoffClicked ?
          sim.takeoffLegTimes.includes(null) ? 'Wybicie trwa · naciśnij drugi przycisk!' :
          `Wybicie obu nóg · różnica ${(sim.takeoffPressGapMs??0).toFixed(0)} ms`
      : sim.phase === 'fallen' ? `Upadek przy ${sim.resultDistance.toFixed(1)} m · kontakt ${sim.impact.toFixed(1)} m/s · R, aby powtórzyć`
      : sim.phase === 'landed' ? `Lądowanie ${sim.resultDistance.toFixed(1)} m · kontakt ${sim.impact.toFixed(1)} m/s · R, aby powtórzyć`
      : inAir ? sim.takeoffClickX===null ? 'Lot · bez aktywnego wybicia' :
          `Wybicie ${(-sim.takeoffClickX).toFixed(1)} m przed progiem · różnica nóg ${sim.takeoffPressGapMs===null?'brak drugiego kliknięcia':sim.takeoffPressGapMs.toFixed(0)+' ms'} · impuls ${Math.round(sim.takeoffImpulse)} N·s`
      : sim.demo ? 'Pokaz techniki · automatyczne wybicie' : 'Zbliżasz się do progu · przygotuj wybicie';
  }
  function frame(time: number) {
    const dt = last ? (time - last) / 1000 : 0;
    last = time;
    if (!paused && !tunnel.isOpen) {
      for (const press of input.consumePresses()) sim.clickTakeoff(press.side,press.timeStamp);
      input.consume(); // discard obsolete drag gestures; click timing is the only takeoff input
      for (const motion of input.consumeMotion()) sim.trim(motion.up,motion.side);
      clock.advance(dt, () => {
        previousRenderState = captureRenderState(sim);
        sim.step();
      });
    } else input.clear();
    if (paused || tunnel.isOpen) view.render(sim);
    else view.render(sim, previousRenderState, clock.accumulator / DT);
    stats();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  Object.assign(window, { SKYLIFT: { sim, view, tunnel, reset, pause, setCamera,
    step: (n: number) => {
      paused = true; el('pause').textContent = 'Wznów';
      for (let i = 0; i < n; i++) sim.step();
      previousRenderState = captureRenderState(sim);
      clock.accumulator = 0;
      view.render(sim); stats();
    },
  } });
}
loadAthleteAsset().then(startApp).catch(error => {
  const box = el('fatal-error');
  box.hidden = false;
  box.textContent = 'Nie udało się uruchomić grafiki 3D lub wczytać modelu zawodnika. Sprawdź, czy przeglądarka ma włączoną akcelerację sprzętową, i odśwież stronę.';
  console.error(error);
});
