import * as T from 'three';
import { JumpReplay, parseJumpRecording, REPLAY_TOLERANCE, type JumpFrame, type JumpRecording, type ReplayReport } from '../physics/recorder';
import type { Simulation } from '../physics/simulation';
import { DT } from '../physics/simulation';
import { DebugForceVectors } from './vectors';
import './debugger.css';

export interface PhysicsDebuggerCallbacks {
  getRecording(): JumpRecording | null;
  getRecordings?(): readonly JumpRecording[];
  onOpen(): void;
  onClose(): void;
  onPreview(sim: Simulation): void;
  onClearPreview(): void;
  onLayout(width: number, height: number): void;
}

const phases: Record<string, string> = {
  ready: 'Gotowy', inrun: 'Najazd', flight: 'Lot', landed: 'Lądowanie', fallen: 'Upadek', invalid: 'Błąd stanu',
};
const magnitude = (v: { x: number; y: number; z: number } | null | undefined) => v ? Math.hypot(v.x, v.y, v.z) : 0;
const charts: { key: string; title: string; unit: string; color: string; value(frame: JumpFrame): number }[] = [
  { key: 'lift', title: 'Siła nośna', unit: 'N', color: '#61e6c5', value: frame => magnitude(frame.forces.lift) },
  { key: 'drag', title: 'Opór aerodynamiczny', unit: 'N', color: '#ffab71', value: frame => magnitude(frame.forces.drag) },
  { key: 'moment', title: 'Moment · aero / wybicie', unit: 'N·m', color: '#86c6ff', value: frame => frame.forces.moments.pitch },
  { key: 'alpha', title: 'Kąt natarcia nart', unit: '°', color: '#efd479', value: frame => (frame.evaluation.aero?.alpha ?? 0) * 180 / Math.PI },
  { key: 'contact', title: 'Reakcja podłoża', unit: 'N', color: '#cfa4ff', value: frame => magnitude(frame.forces.contact) },
];

/** An inspector of a frozen recording. The live jump is never rewritten. */
export class PhysicsDebuggerPanel {
  isOpen = false;
  readonly vectors: DebugForceVectors;
  private readonly root: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly originalParent: Node;
  private readonly originalNextSibling: ChildNode | null;
  private returnFocus?: HTMLElement;
  private recording: JumpRecording | null = null;
  private recordings: JumpRecording[] = [];
  private replay?: JumpReplay;
  private report?: ReplayReport;
  private tick = 0;
  private playing = false;
  private previousTime = 0;
  private accumulator = 0;
  private animationFrame = 0;
  private loadGeneration = 0;
  private loading = false;
  private readonly resizeObserver: ResizeObserver;

  constructor(private readonly callbacks: PhysicsDebuggerCallbacks, scene: T.Scene) {
    this.canvas = document.getElementById('scene') as HTMLCanvasElement;
    this.originalParent = this.canvas.parentNode!;
    this.originalNextSibling = this.canvas.nextSibling;
    this.vectors = new DebugForceVectors(scene);
    const root = document.createElement('section');
    root.id = 'physics-debugger';
    root.className = 'physics-debugger';
    root.hidden = true;
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Physics Debugger');
    root.innerHTML = `
      <div class="physics-debug-head">
        <div><small>SKYLIFT / REJESTRATOR SKOKÓW</small><h2>Physics Debugger</h2>
          <p>Odtwarzanie z wejść przy 120 Hz. Zgodność replayu sprawdza obliczenia, nie realizm modelu.</p></div>
        <button type="button" class="physics-debug-close" data-close aria-label="Zamknij debugger">Zamknij ×</button>
      </div>
      <div class="physics-debug-body">
        <div class="physics-debug-preview" data-preview aria-label="Podgląd 3D odtwarzanego skoku">
          <div class="physics-debug-legend"><span>● Nośność</span><span>● Opór</span><span>● Grawitacja</span><span>● Kontakt</span>
            <small>1 m strzałki = 400 N · wspólna skala liniowa</small></div>
          <div class="physics-debug-caption"><b>— Zapisana trajektoria</b> · <span>— Odtworzona z wejść</span><br>
            Zgodne trajektorie nakładają się. Siły z początku kroku przy COM na końcu kroku.</div>
        </div>
        <div class="physics-debug-dock">
          <h3>Wybrany skok</h3>
          <select class="physics-debug-select" data-recordings aria-label="Wybierz zapisany skok"></select>
          <div class="physics-debug-meta" data-metadata></div>
          <div class="physics-debugger-empty" data-empty>Rozpocznij skok, aby zarejestrować jego przebieg. Możesz także wczytać nagranie JSON.</div>
          <div data-inspector hidden>
            <div class="physics-debug-state">
              <div><label>Czas</label><strong data-time>0.000 s</strong></div>
              <div><label>Prędkość COM</label><strong data-speed>0.0 m/s</strong></div>
              <div><label>Faza</label><strong data-phase>Gotowy</strong></div>
            </div>
            <label class="physics-debug-seek"><span>Przewiń skok <output data-tick>0 / 0</output></span>
              <input type="range" min="0" max="0" step="1" value="0" data-seek aria-label="Klatka skoku"></label>
            <div class="physics-debug-playback"><button type="button" data-play>Odtwórz</button>
              <button type="button" data-back aria-label="Poprzednia klatka">−1</button><button type="button" data-forward aria-label="Następna klatka">+1</button></div>
            <div class="physics-debug-checks"><label><input type="checkbox" data-forces checked> Wektory sił</label>
              <label><input type="checkbox" data-trajectories checked> Trajektorie</label></div>
            <div class="physics-debug-validation" data-validation data-state="busy" aria-live="polite">Sprawdzanie replayu…</div>
          </div>
          <div class="physics-debug-files"><button type="button" data-export disabled>Eksport JSON ↓</button>
            <label class="physics-debug-import" tabindex="0" role="button">Import JSON ↑<input type="file" accept=".json,application/json" data-import aria-label="Wczytaj nagranie JSON"></label></div>
          <div class="physics-debug-error" data-error role="alert" hidden></div>
          <div data-charts hidden>${charts.map(chart => `<div class="physics-debug-plot" data-chart="${chart.key}">
            <div><span>${chart.title}</span><output>0 ${chart.unit}</output></div>
            <svg viewBox="0 0 420 100" aria-label="${chart.title} w czasie">
              <line x1="40" x2="410" y1="79" y2="79" stroke="#ffffff24"/>
              <line data-zero x1="40" x2="410" y1="79" y2="79" stroke="#ffffff22" stroke-dasharray="3 4"/>
              <text data-max x="34" y="19" text-anchor="end" fill="#a3bfcd" font-size="9"></text>
              <text data-min x="34" y="80" text-anchor="end" fill="#a3bfcd" font-size="9"></text>
              <polyline data-curve fill="none" stroke="${chart.color}" stroke-width="1.8" points=""/>
              <line data-cursor x1="40" x2="40" y1="13" y2="80" stroke="#e8f4fab0" stroke-dasharray="3 3"/>
              <text x="40" y="96" fill="#a3bfcd" font-size="9">0 s</text>
              <text data-end x="410" y="96" text-anchor="end" fill="#a3bfcd" font-size="9"></text>
            </svg></div>`).join('')}</div>
          <p class="physics-debug-note">Wykresy przedstawiają próbki modelu, bez walidacji pomiarowej. Kąt natarcia wynosi tu 0 poza lotem (brak oceny aerodynamiki). Kontakt zawiera reakcję najazdu i oddzielny zapis impulsu lądowania w JSON; skok impulsowy nie jest siłą ciągłą.</p>
        </div>
      </div>`;
    document.body.append(root);
    this.root = root;
    root.querySelector('[data-close]')!.addEventListener('click', () => this.close());
    root.querySelector('[data-play]')!.addEventListener('click', () => this.togglePlay());
    root.querySelector('[data-back]')!.addEventListener('click', () => this.seek(this.tick - 1));
    root.querySelector('[data-forward]')!.addEventListener('click', () => this.seek(this.tick + 1));
    root.querySelector<HTMLInputElement>('[data-seek]')!.addEventListener('input', event => this.seek(Number((event.target as HTMLInputElement).value)));
    root.querySelector<HTMLSelectElement>('[data-recordings]')!.addEventListener('change', event => {
      const recording = this.recordings[Number((event.target as HTMLSelectElement).value)];
      if (recording) void this.load(recording);
    });
    root.querySelector<HTMLInputElement>('[data-forces]')!.addEventListener('change', event => {
      this.vectors.setForcesVisible((event.target as HTMLInputElement).checked);
      this.vectors.update(this.recording?.frames[this.tick - 1]);
    });
    root.querySelector<HTMLInputElement>('[data-trajectories]')!.addEventListener('change', event => this.vectors.setTrajectoriesVisible((event.target as HTMLInputElement).checked));
    root.querySelector('[data-export]')!.addEventListener('click', () => this.exportJSON());
    const importInput = root.querySelector<HTMLInputElement>('[data-import]')!;
    importInput.addEventListener('change', () => { void this.importJSON(importInput); });
    root.querySelector('.physics-debug-import')!.addEventListener('keydown', event => {
      const key = (event as KeyboardEvent).key;
      if (key === 'Enter' || key === ' ') { event.preventDefault(); importInput.click(); }
    });
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); this.close(); }
      if (event.key === 'Tab') {
        const focusable = Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled),input:not([type=file]),select,[tabindex="0"]')).filter(element => element.offsetParent !== null);
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(root.querySelector('[data-preview]')!);
    // View's existing resize listener runs first, then the preview overrides its size.
    window.addEventListener('resize', () => this.resize());
  }

  get selectedTick() { return this.tick; }
  get currentRecording() { return this.recording; }

  open() {
    if (this.isOpen) return;
    this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    this.isOpen = true;
    this.root.hidden = false;
    this.root.querySelector('[data-preview]')!.prepend(this.canvas);
    this.callbacks.onOpen();
    this.resize();
    this.vectors.setVisible(true);
    this.root.querySelector<HTMLButtonElement>('[data-close]')!.focus();
    this.showError('');
    this.recordings = [];
    try {
      const current = this.callbacks.getRecording();
      if (current) this.recordings.push(current);
    } catch (error) { this.showError(error); }
    for (const recording of [...(this.callbacks.getRecordings?.() ?? [])].reverse())
      if (!this.recordings.includes(recording)) this.recordings.push(recording);
    this.updateRecordingOptions();
    if (this.recordings[0]) void this.load(this.recordings[0]);
    else this.setEmpty();
    this.previousTime = performance.now();
    this.animationFrame = requestAnimationFrame(this.animate);
  }

  close() {
    if (!this.isOpen) return;
    this.setPlaying(false);
    this.loadGeneration++;
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.vectors.setVisible(false);
    if (this.originalNextSibling?.parentNode === this.originalParent) this.originalParent.insertBefore(this.canvas, this.originalNextSibling);
    else this.originalParent.appendChild(this.canvas);
    this.root.hidden = true;
    this.isOpen = false;
    this.callbacks.onClearPreview();
    this.callbacks.onClose();
    if (this.returnFocus?.isConnected) this.returnFocus.focus();
    else document.getElementById('open-debugger')?.focus();
  }

  private resize() {
    if (!this.isOpen) return;
    const bounds = this.root.querySelector('[data-preview]')!.getBoundingClientRect();
    if (bounds.width > 0 && bounds.height > 0) this.callbacks.onLayout(bounds.width, bounds.height);
  }

  private setEmpty() {
    this.recording = null; this.replay = undefined; this.report = undefined; this.tick = 0;
    this.root.querySelector<HTMLElement>('[data-empty]')!.hidden = false;
    this.root.querySelector<HTMLElement>('[data-inspector]')!.hidden = true;
    this.root.querySelector<HTMLElement>('[data-charts]')!.hidden = true;
    this.root.querySelector<HTMLButtonElement>('[data-export]')!.disabled = true;
    this.root.querySelector('[data-metadata]')!.textContent = 'Nie ma jeszcze próbek symulacji.';
    this.vectors.update();
    this.vectors.setTrajectories([], []);
  }

  private updateRecordingOptions() {
    const select = this.root.querySelector<HTMLSelectElement>('[data-recordings]')!;
    select.replaceChildren();
    this.recordings.forEach((recording, index) => {
      const option = document.createElement('option'); option.value = String(index);
      const last = recording.frames.at(-1);
      option.textContent = `Skok ${index + 1} · ${(last?.time ?? 0).toFixed(2)} s · ${phases[last?.phase ?? 'ready'] ?? last?.phase}`;
      select.append(option);
    });
    select.disabled = this.recordings.length === 0;
  }

  private async load(recording: JumpRecording, checked?: { replay: JumpReplay; report: ReplayReport }) {
    this.setPlaying(false);
    const generation = ++this.loadGeneration;
    this.loading = true;
    this.setStatus('Sprawdzanie wszystkich kroków replayu…', 'busy');
    // Let the checking status paint before running the deterministic verification.
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    if (generation !== this.loadGeneration || !this.isOpen) return;
    try {
      const replay = checked?.replay ?? new JumpReplay(recording);
      const report = checked?.report ?? replay.validate();
      if (generation !== this.loadGeneration || !this.isOpen) return;
      this.recording = recording; this.replay = replay; this.report = report;
      this.root.querySelector<HTMLElement>('[data-empty]')!.hidden = true;
      this.root.querySelector<HTMLElement>('[data-inspector]')!.hidden = false;
      this.root.querySelector<HTMLElement>('[data-charts]')!.hidden = false;
      this.root.querySelector<HTMLButtonElement>('[data-export]')!.disabled = false;
      const select = this.root.querySelector<HTMLSelectElement>('[data-recordings]')!;
      select.value = String(this.recordings.indexOf(recording));
      const duration = recording.frames.at(-1)?.time ?? 0;
      this.root.querySelector('[data-metadata]')!.textContent = `${recording.header.sampleRate} Hz · ${recording.frames.length} kroków · ${duration.toFixed(3)} s · fizyka ${recording.header.physicsVersion}`;
      const seek = this.root.querySelector<HTMLInputElement>('[data-seek]')!;
      seek.max = String(recording.frames.length);
      this.drawCharts();
      this.vectors.setTrajectories(recording.frames, report.recomputedFrames);
      this.setStatus(`Replay zgodny · ${report.frames} kroków · max |Δ| = ${report.maxError.toExponential(1)} ≤ ${REPLAY_TOLERANCE.toExponential(0)}.`, 'valid');
      this.showError('');
      this.loading = false;
      this.seek(recording.frames.length);
    } catch (error) {
      this.loading = false;
      this.showError(error);
      // Preserve an earlier validated replay if the new data are rejected.
      if (this.report) this.setStatus(`Poprzedni replay pozostaje aktywny · max |Δ| = ${this.report.maxError.toExponential(1)}.`, 'valid');
      else this.setStatus('Nagranie nie przeszło sprawdzenia zgodności.', 'error');
    }
  }

  private setStatus(message: string, state: 'busy' | 'valid' | 'error') {
    const status = this.root.querySelector<HTMLElement>('[data-validation]')!;
    status.dataset.state = state;
    status.replaceChildren(document.createTextNode(message));
    const note = document.createElement('small');
    note.textContent = 'Tolerancja bezwzględna dla zapisanych pól w ich jednostkach. Zgodność numeryczna nie potwierdza poprawności fizyki.';
    status.append(note);
  }

  private showError(error: unknown) {
    const box = this.root.querySelector<HTMLElement>('[data-error]')!;
    box.hidden = !error;
    box.textContent = error ? `Nie można wczytać nagrania: ${error instanceof Error ? error.message : String(error)}` : '';
  }

  private drawCharts() {
    if (!this.recording) return;
    const frames = this.recording.frames;
    const duration = Math.max(DT, frames.at(-1)?.time ?? DT);
    for (const chart of charts) {
      const box = this.root.querySelector(`[data-chart="${chart.key}"]`)!;
      const values = frames.map(chart.value);
      let min = 0, max = 0;
      for (const value of values) { min = Math.min(min, value); max = Math.max(max, value); }
      if (max - min < 1e-9) max = min + 1;
      const y = (value: number) => 79 - (value - min) / (max - min) * 64;
      // Min/max per bucket preserve sharp takeoff peaks in long recordings.
      const points: number[] = [];
      const bucketSize = Math.max(1, Math.ceil(frames.length / 320));
      for (let start = 0; start < frames.length; start += bucketSize) {
        const end = Math.min(frames.length, start + bucketSize);
        let lo = start, hi = start;
        for (let i = start; i < end; i++) { if (values[i] < values[lo]) lo = i; if (values[i] > values[hi]) hi = i; }
        const selected = [...new Set([start, lo, hi, end - 1])].sort((a, b) => a - b);
        points.push(...selected);
      }
      box.querySelector('[data-curve]')!.setAttribute('points', points.map(i => `${(40 + frames[i].time / duration * 370).toFixed(2)},${y(values[i]).toFixed(2)}`).join(' '));
      box.querySelector('[data-max]')!.textContent = max.toFixed(Math.abs(max) < 10 ? 1 : 0);
      box.querySelector('[data-min]')!.textContent = min.toFixed(Math.abs(min) < 10 ? 1 : 0);
      box.querySelector('[data-end]')!.textContent = `${duration.toFixed(2)} s`;
      const zero = box.querySelector('[data-zero]')!;
      zero.setAttribute('y1', String(y(0))); zero.setAttribute('y2', String(y(0)));
    }
  }

  seek(tick: number) {
    if (!this.recording || !this.replay || this.loading) return;
    this.setPlaying(false);
    this.preview(Math.max(0, Math.min(this.recording.frames.length, Math.round(tick))));
  }

  private preview(tick: number) {
    if (!this.recording || !this.replay) return;
    try {
      const sim = this.replay.seek(tick);
      this.tick = tick;
      const frame = this.recording.frames[tick - 1];
      this.callbacks.onPreview(sim);
      this.vectors.update(frame);
      this.root.querySelector<HTMLInputElement>('[data-seek]')!.value = String(tick);
      this.root.querySelector('[data-tick]')!.textContent = `${tick} / ${this.recording.frames.length}`;
      this.root.querySelector('[data-time]')!.textContent = `${sim.time.toFixed(3)} s`;
      const speed = frame ? magnitude(frame.com.velocity) : 0;
      this.root.querySelector('[data-speed]')!.textContent = `${speed.toFixed(1)} m/s`;
      this.root.querySelector('[data-phase]')!.textContent = phases[sim.phase] ?? sim.phase;
      const fraction = this.recording.frames.length ? tick / this.recording.frames.length : 0;
      for (const chart of charts) {
        const box = this.root.querySelector(`[data-chart="${chart.key}"]`)!;
        box.querySelector('output')!.textContent = `${(frame ? chart.value(frame) : 0).toFixed(chart.key === 'alpha' ? 1 : 2)} ${chart.unit}`;
        const cursor = box.querySelector('[data-cursor]')!;
        cursor.setAttribute('x1', String(40 + fraction * 370)); cursor.setAttribute('x2', String(40 + fraction * 370));
      }
    } catch (error) { this.setPlaying(false); this.showError(error); this.setStatus('Replay zatrzymany: wykryto rozbieżność.', 'error'); }
  }

  private setPlaying(playing: boolean) {
    this.playing = playing;
    this.root.querySelector('[data-play]')!.textContent = playing ? 'Zatrzymaj' : 'Odtwórz';
    this.root.querySelector('[data-play]')!.setAttribute('aria-pressed', String(playing));
    this.accumulator = 0;
  }

  private togglePlay() {
    if (!this.recording || !this.replay || this.loading) return;
    if (this.playing) this.setPlaying(false);
    else {
      if (this.tick >= this.recording.frames.length) this.preview(0);
      this.previousTime = performance.now(); this.setPlaying(true);
    }
  }

  private animate = (time: number) => {
    if (!this.isOpen) return;
    if (this.playing && this.recording) {
      this.accumulator += Math.max(0, Math.min(.25, (time - this.previousTime) / 1000));
      const steps = Math.floor((this.accumulator + 1e-12) / DT);
      if (steps > 0) {
        this.accumulator -= steps * DT;
        const tick = Math.min(this.recording.frames.length, this.tick + steps);
        this.preview(tick);
        if (tick === this.recording.frames.length) this.setPlaying(false);
      }
    }
    this.previousTime = time;
    this.animationFrame = requestAnimationFrame(this.animate);
  };

  private exportJSON() {
    if (!this.recording) return;
    const blob = new Blob([JSON.stringify(this.recording)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `SKYLIFT-skok-${Date.now()}.json`;
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private async importJSON(input: HTMLInputElement) {
    const file = input.files?.[0]; input.value = '';
    if (!file) return;
    try {
      if (file.size > 64 * 1024 * 1024) throw new Error('Plik przekracza limit 64 MiB.');
      const recording = parseJumpRecording(await file.text());
      const replay = new JumpReplay(recording);
      const report = replay.validate();
      this.recordings.unshift(recording);
      this.updateRecordingOptions();
      await this.load(recording, { replay, report });
    } catch (error) { this.showError(error); }
  }
}
