import * as T from 'three';
import { Athlete } from '../athlete/rig';
import { DEFAULT_TUNNEL_SETTINGS, sampleTunnel, sweepIncidence, type TunnelSettings } from './windTunnel';
import './windTunnel.css';

type Key = keyof TunnelSettings;
const fields: { key: Key; label: string; min: number; max: number; step: number; unit: string }[] = [
  { key: 'speed', label: 'Prędkość strumienia', min: 0, max: 40, step: .5, unit: 'm/s' },
  { key: 'incidenceDeg', label: 'Kąt natarcia nart', min: -10, max: 30, step: .5, unit: '°' },
  { key: 'bodyLeanDeg', label: 'Pochylenie tułowia od pionu', min: 50, max: 86, step: 1, unit: '°' },
  { key: 'vHalfAngleDeg', label: 'Połowa kąta V', min: 0, max: 14, step: .5, unit: '°' },
  { key: 'density', label: 'Gęstość powietrza', min: .85, max: 1.35, step: .01, unit: 'kg/m³' },
];
const display = (x: number, digits = 1) => x.toFixed(digits);
const copy = (s: TunnelSettings): TunnelSettings => ({ ...s });

/** A separate presentation lab: never mutates the live Simulation. */
export class WindTunnelPanel {
  isOpen = false;
  private settings = copy(DEFAULT_TUNNEL_SETTINGS);
  private root: HTMLElement;
  private scene?: T.Scene;
  private camera?: T.PerspectiveCamera;
  private renderer?: T.WebGLRenderer;
  private athlete?: Athlete;
  private liftArrow?: T.ArrowHelper;
  private dragArrow?: T.ArrowHelper;
  private flowDots: T.Mesh[] = [];
  private samples: Partial<Record<'A'|'B', ReturnType<typeof sampleTunnel>>> = {};
  private frameTime = 0;

  constructor() {
    const root = document.createElement('section');
    root.id = 'wind-tunnel';
    root.className = 'wind-lab';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Laboratorium aerodynamiki');
    root.innerHTML = `
      <div class="wind-shell">
        <div class="wind-head">
          <div><small>SKYLIFT / FIZYKA LOTU</small><h2>Tunel aerodynamiczny</h2>
          <p>Te same równania sił co w skoku. Model przybliżony, nie CFD ani badanie tunelowe.</p></div>
          <button class="wind-close" type="button" data-close aria-label="Zamknij tunel">Zamknij ×</button>
        </div>
        <div class="wind-columns">
          <div class="wind-viewport">
            <canvas class="wind-canvas" aria-label="Trójwymiarowy model skoczka w tunelu"></canvas>
            <div class="wind-legend"><span>● Siła nośna</span><span>● Opór</span></div>
            <small>Przepływ od dziobów nart w kierunku zawodnika • widok laboratoryjny</small>
          </div>
          <div class="wind-controls">
            <h3>Ustawienie zawodnika</h3>
            <div data-sliders></div>
            <div class="wind-readings" aria-live="polite">
              <div><label>Nośność pionowa</label><strong data-metric="lift"></strong></div>
              <div><label>Opór</label><strong data-metric="drag"></strong></div>
              <div><label>Siła / opór (L/D)</label><strong data-metric="ratio"></strong></div>
              <div><label>Moment pochylający</label><strong data-metric="moment"></strong></div>
              <div><label>Ciśnienie dynamiczne</label><strong data-metric="pressure"></strong></div>
              <div><label>Rzeczywisty kąt natarcia</label><strong data-metric="alpha"></strong></div>
            </div>
          </div>
        </div>
        <div class="wind-bottom">
          <div class="wind-plot-box">
            <div class="wind-plot-title">Przegląd kąta natarcia · wskaźnik L/D</div>
            <svg class="wind-plot" viewBox="0 0 460 160" aria-label="Stosunek siły nośnej do oporu dla różnych kątów">
              <line x1="28" x2="444" y1="141" y2="141" stroke="#ffffff55"/>
              <polyline data-curve fill="none" stroke="#87e5df" stroke-width="2.5" points=""/>
              <line data-cursor x1="28" x2="28" y1="12" y2="141" stroke="#ffaf77" stroke-width="1.5" stroke-dasharray="4 4"/>
              <text x="28" y="155" fill="#a7bacc" font-size="11">−10°</text>
              <text x="444" y="155" fill="#a7bacc" font-size="11" text-anchor="end">30°</text>
            </svg>
            <small>Krzywa prognozowana przez aktualny model, nie pomiar rzeczywisty.</small>
          </div>
          <div class="wind-actions">
            <button type="button" data-compare="A">Zapisz pozycję A</button>
            <button type="button" data-compare="B">Zapisz pozycję B</button>
            <div class="wind-compare" data-comparison>Porównaj dwa ustawienia ciała i nart.</div>
            <button type="button" data-export>Eksport krzywej CSV ↓</button>
          </div>
        </div>
      </div>`;
    document.body.append(root);
    this.root = root;
    root.querySelector('[data-close]')!.addEventListener('click', () => this.close());
    const controls = root.querySelector('[data-sliders]')!;
    for (const field of fields) {
      const line = document.createElement('label');
      line.className = 'wind-slider';
      line.innerHTML = `<span>${field.label} <output data-value></output></span><input type="range" min="${field.min}" max="${field.max}" step="${field.step}" data-key="${field.key}" aria-label="${field.label}">`;
      const input = line.querySelector('input')!;
      input.value = String(this.settings[field.key]);
      input.addEventListener('input', () => {
        this.settings[field.key] = Number(input.value);
        this.update();
      });
      controls.append(line);
    }
    root.querySelectorAll<HTMLButtonElement>('[data-compare]').forEach(button =>
      button.addEventListener('click', () => {
        const slot = button.dataset.compare as 'A'|'B';
        this.samples[slot] = sampleTunnel(this.settings);
        this.updateComparison();
      }));
    root.querySelector('[data-export]')!.addEventListener('click', () => this.exportCsv());
    window.addEventListener('resize', () => { if (this.isOpen) this.resize(); });
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.root.hidden = false;
    if (!this.renderer) this.create3D();
    this.resize();
    this.update();
    this.frameTime = performance.now();
    requestAnimationFrame(this.render);
    (this.root.querySelector('[data-close]') as HTMLButtonElement).focus();
  }

  close() {
    this.isOpen = false;
    this.root.hidden = true;
    document.getElementById('open-tunnel')?.focus();
  }

  private create3D() {
    const canvas = this.root.querySelector('canvas')!;
    const renderer = new T.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer = renderer;
    this.scene = new T.Scene();
    this.scene.background = new T.Color('#142432');
    this.camera = new T.PerspectiveCamera(40, 1, .1, 100);
    this.camera.position.set(3.4, 2.45, 4.9);
    this.camera.lookAt(.15, .7, 0);
    this.scene.add(new T.HemisphereLight('#b8dfff', '#5a7180', 2.4));
    const key = new T.DirectionalLight('#fff4dc', 3.1);
    key.position.set(-3, 7, 5); this.scene.add(key);
    const athlete = new Athlete(); this.athlete = athlete;
    this.scene.add(athlete.root);
    const floor = new T.Mesh(new T.PlaneGeometry(13, 8),
      new T.MeshStandardMaterial({ color: '#244052', roughness: .8 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.22;
    this.scene.add(floor);
    const grid = new T.GridHelper(12, 24, '#43738a', '#2a4b60');
    grid.position.y = -.21; this.scene.add(grid);
    const tunnelWire = new T.LineSegments(
      new T.EdgesGeometry(new T.BoxGeometry(7, 3.8, 4.6)),
      new T.LineBasicMaterial({ color: '#4b788c', transparent: true, opacity: .38 }));
    tunnelWire.position.set(0, 1.65, 0);
    this.scene.add(tunnelWire);

    const liftArrow = new T.ArrowHelper(new T.Vector3(0, 1, 0), new T.Vector3(-.25, 1.1, -.35), 1, '#76e4df');
    const dragArrow = new T.ArrowHelper(new T.Vector3(-1, 0, 0), new T.Vector3(-.25, 1.1, .35), 1, '#ffae73');
    this.liftArrow = liftArrow; this.dragArrow = dragArrow;
    this.scene.add(liftArrow, dragArrow);

    const flowMaterial = new T.MeshBasicMaterial({ color: '#74c4e5' });
    for (let i = 0; i < 38; i++) {
      const dot = new T.Mesh(new T.SphereGeometry(.027, 6, 5), flowMaterial);
      dot.userData.phase = (i * .618034) % 1;
      dot.userData.y = .35 + (i % 7) * .42;
      dot.userData.z = ((i * 17) % 13 - 6) * .25;
      this.flowDots.push(dot);
      this.scene.add(dot);
    }
  }

  private resize() {
    if (!this.renderer || !this.camera) return;
    const canvas = this.root.querySelector('canvas')!;
    const bounds = canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    this.renderer.setSize(bounds.width, bounds.height, false);
    this.camera.aspect = bounds.width / bounds.height;
    this.camera.updateProjectionMatrix();
  }

  private update() {
    const measured = sampleTunnel(this.settings);
    for (const field of fields) {
      const input = this.root.querySelector<HTMLInputElement>(`[data-key="${field.key}"]`)!;
      input.value = String(this.settings[field.key]);
      (input.parentElement!.querySelector('output')!).textContent =
        `${display(this.settings[field.key], field.step < .1 ? 2 : 1)} ${field.unit}`;
    }
    const values: Record<string, string> = {
      lift: `${display(measured.liftVertical)} N`, drag: `${display(measured.dragLongitudinal)} N`,
      ratio: display(measured.ratio, 2), moment: `${display(measured.moment)} N·m`,
      pressure: `${display(measured.dynamicPressure)} Pa`,
      alpha: `${display(measured.alpha * 180 / Math.PI)}°`,
    };
    for (const [key, value] of Object.entries(values))
      this.root.querySelector(`[data-metric="${key}"]`)!.textContent = value;

    const tilt = this.settings.incidenceDeg * Math.PI / 180;
    // One pose definition drives both the wind-tunnel rig and its coefficient input.
    const v = this.settings.vHalfAngleDeg / (180 * .25 / Math.PI);
    this.athlete?.pose(1, .85, 0, {
      bodyLean: this.settings.bodyLeanDeg * Math.PI / 180,
      vSpread: Math.max(0, Math.min(1, v)),
    });
    if (this.athlete) this.athlete.root.rotation.z = tilt;

    for (const [arrow, force] of [[this.liftArrow, measured.lift], [this.dragArrow, measured.drag]] as const) {
      if (!arrow) continue;
      const dir = new T.Vector3(force.x, force.y, force.z);
      const magnitude = dir.length();
      arrow.visible = magnitude > .001;
      if (magnitude > .001) {
        arrow.setDirection(dir.normalize());
        arrow.setLength(Math.min(2.4, .25 + magnitude / 350), .18, .10);
      }
    }
    this.updateChart();
  }

  private updateChart() {
    const rows = sweepIncidence(this.settings);
    const min = Math.min(0, ...rows.map(r => r.ratio));
    const max = Math.max(.5, ...rows.map(r => r.ratio));
    const span = max - min || 1;
    const points = rows.map((r, i) => `${(28 + 416 * i / (rows.length - 1)).toFixed(1)},${(139 - 124 * (r.ratio - min) / span).toFixed(1)}`).join(' ');
    this.root.querySelector('[data-curve]')!.setAttribute('points', points);
    const x = 28 + (this.settings.incidenceDeg + 10) / 40 * 416;
    this.root.querySelector('[data-cursor]')!.setAttribute('x1', String(x));
    this.root.querySelector('[data-cursor]')!.setAttribute('x2', String(x));
  }

  private updateComparison() {
    const a = this.samples.A, b = this.samples.B;
    this.root.querySelector('[data-comparison]')!.textContent = a && b
      ? `A: L/D ${display(a.ratio, 2)} · B: ${display(b.ratio, 2)} · różnica ${display(b.ratio - a.ratio, 2)}`
      : a ? `Pozycja A zapisana (L/D ${display(a.ratio, 2)}). Zapisz B.`
      : b ? `Pozycja B zapisana (L/D ${display(b.ratio, 2)}). Zapisz A.`
      : 'Porównaj dwa ustawienia ciała i nart.';
  }

  private exportCsv() {
    const rows = sweepIncidence(this.settings);
    const text = [
      'angle_deg,lift_N,drag_N,lift_drag_ratio',
      ...rows.map(r => [r.angle, r.lift, r.drag, r.ratio].join(',')),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'skylift-wind-tunnel.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  private render = (now: number) => {
    if (!this.isOpen || !this.scene || !this.camera || !this.renderer) return;
    const dt = Math.min(.04, (now - this.frameTime) / 1000);
    this.frameTime = now;
    for (const dot of this.flowDots) {
      let p = dot.userData.phase as number;
      p = (p + dt * (.12 + this.settings.speed / 90)) % 1;
      dot.userData.phase = p;
      dot.position.set(3.2 - p * 6.4, dot.userData.y, dot.userData.z);
    }
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.render);
  };
}
