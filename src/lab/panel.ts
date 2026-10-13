import * as T from 'three';
import { Athlete } from '../athlete/rig';
import { centerOfMassOffset } from '../physics/biomechanics';
import { DEFAULT_TUNNEL_SETTINGS, normalizeTunnelSettings, sampleTunnel, sweepIncidence, type TunnelSettings } from './windTunnel';
import './windTunnel.css';

type Key = keyof TunnelSettings;
const fields: { key: Key; label: string; min: number; max: number; step: number; unit: string }[] = [
  { key: 'speed', label: 'Prędkość strumienia', min: 0, max: 40, step: .5, unit: 'm/s' },
  { key: 'incidenceDeg', label: 'Kąt natarcia nart', min: -10, max: 30, step: .5, unit: '°' },
  { key: 'bodyLeanDeg', label: 'Pochylenie tułowia od pionu', min: 50, max: 86, step: 1, unit: '°' },
  { key: 'vHalfAngleDeg', label: 'Połowa kąta V', min: 0, max: 14, step: .5, unit: '°' },
  { key: 'density', label: 'Gęstość powietrza', min: 0, max: 1.5, step: .001, unit: 'kg/m³' },
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
  private animationFrame = 0;
  private returnFocus?: HTMLElement;

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
              <div><label>Nośność / opór (L/D)</label><strong data-metric="ratio"></strong></div>
              <div><label>Moment pochylający</label><strong data-metric="moment"></strong></div>
              <div><label>Ciśnienie dynamiczne</label><strong data-metric="pressure"></strong></div>
              <div><label>Kąt natarcia nart / tułowia</label><strong data-metric="alpha"></strong></div>
            </div>
          </div>
        </div>
        <div class="wind-bottom">
          <div class="wind-plot-box">
            <div class="wind-plot-title">Przegląd kąta natarcia · wskaźnik L/D</div>
            <svg class="wind-plot" viewBox="0 0 460 160" aria-label="Stosunek siły nośnej do oporu dla różnych kątów">
              <line x1="42" x2="444" y1="141" y2="141" stroke="#ffffff55"/>
              <line x1="42" x2="42" y1="15" y2="141" stroke="#ffffff55"/>
              <line data-zero x1="42" x2="444" y1="141" y2="141" stroke="#ffffff33" stroke-dasharray="3 4"/>
              <text data-y-max x="35" y="19" fill="#a7bacc" font-size="11" text-anchor="end"></text>
              <text data-y-min x="35" y="141" fill="#a7bacc" font-size="11" text-anchor="end"></text>
              <polyline data-curve fill="none" stroke="#87e5df" stroke-width="2.5" points=""/>
              <line data-cursor x1="28" x2="28" y1="12" y2="141" stroke="#ffaf77" stroke-width="1.5" stroke-dasharray="4 4"/>
              <circle data-operating-point r="3.5" fill="#ffaf77"/>
              <text x="42" y="155" fill="#a7bacc" font-size="11">−10°</text>
              <text x="444" y="155" fill="#a7bacc" font-size="11" text-anchor="end">30°</text>
            </svg>
            <small>Krzywa modelu bez walidacji pomiarowej. Strzałki sił i ruch znaczników przepływu są poglądowe.</small>
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
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); this.close();
      } else if (event.key === 'Tab') {
        const focusable = Array.from(root.querySelectorAll<HTMLElement>('button, input'));
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
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
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    this.isOpen = true;
    this.root.hidden = false;
    if (!this.renderer) this.create3D();
    this.resize();
    this.update();
    this.frameTime = performance.now();
    this.animationFrame = requestAnimationFrame(this.render);
    (this.root.querySelector('[data-close]') as HTMLButtonElement).focus();
  }

  close() {
    if (!this.isOpen) return;
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.isOpen = false;
    this.root.hidden = true;
    if (this.returnFocus?.isConnected) this.returnFocus.focus();
    else document.getElementById('open-tunnel')?.focus();
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
      dot.position.set(3.2 - dot.userData.phase * 6.4, dot.userData.y, dot.userData.z);
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
    this.frameSpecimen();
  }

  /** Keep the complete real-size specimen visible, including narrow screens. */
  private frameSpecimen() {
    if (!this.camera || !this.athlete) return;
    const bounds = new T.Box3().setFromObject(this.athlete.root).expandByScalar(.15);
    for (const arrow of [this.liftArrow, this.dragArrow])
      if (arrow?.visible) bounds.union(new T.Box3().setFromObject(arrow));
    const target = bounds.getCenter(new T.Vector3());
    const direction = new T.Vector3(3.4, 1.75, 4.9).normalize();
    const right = new T.Vector3().crossVectors(new T.Vector3(0, 1, 0), direction).normalize();
    const up = new T.Vector3().crossVectors(direction, right).normalize();
    const tanVertical = Math.tan(this.camera.fov * Math.PI / 360);
    const tanHorizontal = tanVertical * this.camera.aspect;
    let distance = 0;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y])
      for (const z of [bounds.min.z, bounds.max.z]) {
        const offset = new T.Vector3(x, y, z).sub(target);
        const depth = offset.dot(direction);
        distance = Math.max(distance, depth + Math.abs(offset.dot(right)) / (tanHorizontal * .80),
          depth + Math.abs(offset.dot(up)) / (tanVertical * .72));
      }
    this.camera.position.copy(target).addScaledVector(direction, Math.max(3.2, distance));
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();
  }

  private update() {
    this.settings = normalizeTunnelSettings(this.settings);
    const measured = sampleTunnel(this.settings);
    for (const field of fields) {
      const input = this.root.querySelector<HTMLInputElement>(`[data-key="${field.key}"]`)!;
      input.value = String(this.settings[field.key]);
      (input.parentElement!.querySelector('output')!).textContent =
        `${display(this.settings[field.key], Math.max(1, String(field.step).split('.')[1]?.length ?? 0))} ${field.unit}`;
    }
    const values: Record<string, string> = {
      lift: `${display(measured.liftVertical)} N`, drag: `${display(measured.dragLongitudinal)} N`,
      ratio: measured.dragLongitudinal > 1e-8 ? display(measured.ratio, 2) : '—', moment: `${display(measured.moment)} N·m`,
      pressure: `${display(measured.dynamicPressure)} Pa`,
      alpha: measured.airSpeed > 1e-6
        ? `${display(measured.alpha * 180 / Math.PI)}° / ${display(measured.alpha * 180 / Math.PI + 90 - this.settings.bodyLeanDeg)}°`
        : '— / —',
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
    if (this.athlete) {
      const root = this.athlete.root;
      root.rotation.z = tilt;
      root.position.y = 0;
      const specimen = new T.Box3().setFromObject(root);
      // Presentation translation only: the suspended specimen must not sink
      // into the display floor when incidence changes. Flight physics is intact.
      root.position.y = Math.max(0, .12 - specimen.min.y);
      root.updateMatrixWorld(true);
      const com = centerOfMassOffset(1, .85, 0, this.settings.bodyLeanDeg * Math.PI / 180);
      const origin = root.localToWorld(new T.Vector3(com.x, com.y, 0));
      this.liftArrow?.position.copy(origin);
      this.dragArrow?.position.copy(origin);
    }

    for (const [arrow, force] of [[this.liftArrow, measured.lift], [this.dragArrow, measured.drag]] as const) {
      if (!arrow) continue;
      const dir = new T.Vector3(force.x, force.y, force.z);
      const magnitude = dir.length();
      arrow.visible = magnitude > .001;
      if (magnitude > .001) {
        arrow.setDirection(dir.normalize());
        arrow.setLength(Math.min(1.6, .25 + magnitude / 350), .18, .10);
      }
    }
    this.updateChart();
    this.frameSpecimen();
  }

  private updateChart() {
    const rows = sweepIncidence(this.settings);
    const min = Math.min(0, ...rows.map(r => r.ratio));
    const max = Math.max(.5, ...rows.map(r => r.ratio));
    const span = max - min || 1;
    const y = (ratio: number) => 139 - 124 * (ratio - min) / span;
    const points = rows.map((r, i) => `${(42 + 402 * i / (rows.length - 1)).toFixed(1)},${y(r.ratio).toFixed(1)}`).join(' ');
    this.root.querySelector('[data-curve]')!.setAttribute('points', points);
    const x = 42 + (this.settings.incidenceDeg + 10) / 40 * 402;
    this.root.querySelector('[data-cursor]')!.setAttribute('x1', String(x));
    this.root.querySelector('[data-cursor]')!.setAttribute('x2', String(x));
    this.root.querySelector('[data-y-min]')!.textContent = display(min, 1);
    this.root.querySelector('[data-y-max]')!.textContent = display(max, 1);
    this.root.querySelector('[data-zero]')!.setAttribute('y1', String(y(0)));
    this.root.querySelector('[data-zero]')!.setAttribute('y2', String(y(0)));
    const current = sampleTunnel(this.settings);
    this.root.querySelector('[data-operating-point]')!.setAttribute('cx', String(x));
    this.root.querySelector('[data-operating-point]')!.setAttribute('cy', String(y(current.ratio)));
    (this.root.querySelector('[data-operating-point]') as SVGElement).style.display = current.dragLongitudinal > 1e-8 ? '' : 'none';
  }

  private updateComparison() {
    const a = this.samples.A, b = this.samples.B;
    const describe = (name: string, sample: NonNullable<typeof a>) => {
      const s = sample.settings;
      return `${name}: ${display(s.speed)} m/s · α ${display(s.incidenceDeg)}° · tułów ${display(s.bodyLeanDeg)}° · V ${display(2 * s.vHalfAngleDeg)}° · ρ ${display(s.density, 3)} kg/m³ · L/D ${sample.dragLongitudinal > 1e-8 ? display(sample.ratio, 2) : '—'}`;
    };
    this.root.querySelector('[data-comparison]')!.textContent = a && b
      ? `${describe('A', a)}\n${describe('B', b)}\nRóżnica L/D: ${a.dragLongitudinal > 1e-8 && b.dragLongitudinal > 1e-8 ? display(b.ratio - a.ratio, 2) : '—'}`
      : a ? `${describe('A', a)}. Zapisz B.`
      : b ? `${describe('B', b)}. Zapisz A.`
      : 'Porównaj dwa ustawienia ciała i nart.';
  }

  private exportCsv() {
    const rows = sweepIncidence(this.settings);
    const text = [
      'angle_deg,speed_m_s,body_lean_deg,v_half_angle_deg,density_kg_m3,lift_N,drag_N,lift_drag_ratio',
      ...rows.map(r => [r.angle, this.settings.speed, this.settings.bodyLeanDeg,
        this.settings.vHalfAngleDeg, this.settings.density, r.lift, r.drag,
        r.drag > 1e-8 ? r.ratio : ''].join(',')),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'skylift-wind-tunnel.csv';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  private render = (now: number) => {
    this.animationFrame = 0;
    if (!this.isOpen || !this.scene || !this.camera || !this.renderer) return;
    const dt = Math.min(.04, (now - this.frameTime) / 1000);
    this.frameTime = now;
    for (const dot of this.flowDots) {
      let p = dot.userData.phase as number;
      // Tracers are slowed for inspection. At zero flow they stay stationary.
      p = (p + dt * this.settings.speed * .08 / 6.4) % 1;
      dot.userData.phase = p;
      dot.position.set(3.2 - p * 6.4, dot.userData.y, dot.userData.z);
    }
    this.renderer.render(this.scene, this.camera);
    this.animationFrame = requestAnimationFrame(this.render);
  };
}
