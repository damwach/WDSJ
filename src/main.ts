import './style.css';
import { Simulation, FixedClock } from './physics/simulation';
import { GestureInput } from './input/gesture';
import { View, type CameraMode } from './render/scene';

const el = (id: string) => document.getElementById(id)!;
const canvas = el('scene') as HTMLCanvasElement;
const sim = new Simulation();
const clock = new FixedClock();
const input = new GestureInput(canvas);
let paused = false;
let last = 0;

function startApp() {
  const view = new View(canvas);
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
    input.clear();
    clock.accumulator = 0;
    paused = false;
    el('pause').textContent = 'Pauza';
    setCamera('broadcast');
  }
  function pause() {
    paused = !paused;
    el('pause').textContent = paused ? 'Wznów' : 'Pauza';
  }
  el('start').onclick = () => reset();
  el('demo').onclick = () => reset(true);
  el('pause').onclick = pause;
  el('help').onclick = () => {
    el('help-panel').hidden = !el('help-panel').hidden;
    el('help').setAttribute('aria-expanded', String(!el('help-panel').hidden));
  };
  for (const button of cameras) button.onclick = () => setCamera(button.dataset.camera as CameraMode);
  window.addEventListener('keydown', event => {
    if (event.repeat || (event.target as HTMLElement)?.tagName === 'BUTTON' && event.code === 'Space') return;
    if (event.code === 'KeyR') reset();
    if (event.code === 'KeyC') setCamera(modes[(modes.indexOf(view.mode) + 1) % modes.length]);
    if (event.code === 'Space') { event.preventDefault(); pause(); }
  });
  const phases: Record<string, string> = {
    ready: 'Gotowy do najazdu', inrun: 'Najazd', flight: 'Lot · przejście do V', landed: 'Kontakt ustany', fallen: 'Utrata stabilności',
  };
  function stats() {
    const inAir = sim.phase === 'flight';
    el('phase').textContent = phases[sim.phase];
    const speed = sim.phase === 'ready' ? 0 : inAir ? Math.hypot(sim.vx, sim.vy) : sim.v;
    el('speed').innerHTML = `${(speed * 3.6).toFixed(1)} <small>km/h</small>`;
    el('distance-label').textContent = sim.x > 0 ? 'OD PROGU' : 'DO PROGU';
    el('distance').innerHTML = `${Math.abs(sim.x).toFixed(1)} <small>m</small>`;
    el('extension').style.width = `${sim.extension * 100}%`;
    el('extension-value').textContent = `${Math.round(sim.extension * 100)}%`;
    const windowOpen = sim.x > -8 && sim.phase === 'inrun';
    document.body.dataset.window = windowOpen ? 'takeoff' : '';
    el('notice').textContent = sim.phase === 'ready' ? 'Obejrzyj skocznię lub rozpocznij trening'
      : windowOpen ? 'TERAZ · oba przyciski + płynny ruch w górę'
      : sim.phase === 'fallen' ? `Utrata stabilności · R, aby powtórzyć`
      : sim.phase === 'landed' ? 'Przejazd zakończony · R, aby powtórzyć'
      : inAir ? 'Lot · obserwuj pozycję ciała i nart'
      : sim.demo ? 'Pokaz techniki · automatyczne wybicie' : 'Zbliżasz się do progu · przygotuj wybicie';
  }
  function frame(time: number) {
    const dt = last ? (time - last) / 1000 : 0;
    last = time;
    if (!paused) {
      for (const gesture of input.consume()) sim.gesture(gesture);
      clock.advance(dt, () => sim.step());
    } else input.clear();
    view.render(sim);
    stats();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  Object.assign(window, { SKYLIFT: { sim, view, reset, pause, setCamera,
    step: (n: number) => { paused = true; el('pause').textContent = 'Wznów'; for (let i = 0; i < n; i++) sim.step(); view.render(sim); stats(); },
  } });
}
try { startApp(); } catch (error) {
  const box = el('fatal-error');
  box.hidden = false;
  box.textContent = 'Nie udało się uruchomić grafiki 3D. Sprawdź, czy przeglądarka ma włączoną akcelerację sprzętową, i odśwież stronę.';
  console.error(error);
}
