import * as T from 'three';
import { Athlete } from '../athlete/rig';
import { createVenue } from '../world/venue';
import type { Simulation } from '../physics/simulation';

export type CameraMode = 'overview' | 'broadcast' | 'athlete';

export class View {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(42, 1, .1, 1400);
  athlete = new Athlete();
  mode: CameraMode = 'overview';
  private sun: T.DirectionalLight;
  private look = new T.Vector3();
  private settled = false;
  private previousTime = performance.now();

  // Kept for replay/test compatibility; actual UI offers three explicit cameras.
  get side() { return this.mode === 'broadcast'; }
  set side(value: boolean) { this.setMode(value ? 'broadcast' : 'athlete'); }

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene.background = new T.Color('#b8d0e2');
    this.scene.fog = new T.Fog('#b8d0e2', 200, 900);
    this.scene.add(new T.HemisphereLight('#d3e8ff', '#738397', 2.0));
    this.sun = new T.DirectionalLight('#fff0d5', 3.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.normalBias = .015;
    this.sun.shadow.bias = -.00015;
    Object.assign(this.sun.shadow.camera, { left: -42, right: 42, top: 42, bottom: -42, near: .1, far: 180 });
    this.scene.add(this.sun, this.sun.target, createVenue(), this.athlete.root);
    this.athlete.root.name = 'athlete';
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  setMode(mode: CameraMode, immediate = false) {
    this.mode = mode;
    if (immediate) this.settled = false;
  }

  resize() {
    this.renderer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  render(s: Simulation) {
    const now = performance.now();
    const dt = Math.min(.05, (now - this.previousTime) / 1000);
    this.previousTime = now;
    this.athlete.pose(s.extension, s.flightTime, s.landingPose, {bodyLean:s.bodyLean, skiPitch:s.skiPitch});
    this.athlete.root.position.set(s.x, s.y, s.z);
    this.athlete.root.rotation.set(s.phase === 'fallen' ? 1.1 : s.roll, 0, s.pitch);

    const target = new T.Vector3();
    const eye = new T.Vector3();
    if (this.mode === 'overview') {
      target.set(60, -20, 0);
      const portrait = this.camera.aspect < .9;
      if (portrait) target.y = -29;
      eye.copy(target).add(portrait ? new T.Vector3(370, 170, 130) : new T.Vector3(86, 70, 246));
    } else if (this.mode === 'athlete') {
      target.set(s.x + .35, s.y + .7, s.z);
      eye.copy(target).add(new T.Vector3(2.9, 2.6, 6.1));
    } else {
      // A consistent lateral camera keeps the upcoming table/landing in frame.
      const lead = s.phase === 'flight' ? 5 : 3.8;
      target.set(s.x + lead, s.y - .6, s.z);
      eye.copy(target).add(new T.Vector3(2.5, 4.8, 19));
      if (this.camera.aspect < 1) eye.add(new T.Vector3(0, 3, 10));
    }
    const fog = this.scene.fog as T.Fog;
    fog.near = this.mode === 'overview' ? 550 : 160;
    fog.far = this.mode === 'overview' ? 1250 : 900;
    const blend = this.settled ? 1 - Math.exp(-dt * 5.5) : 1;
    this.camera.position.lerp(eye, blend);
    this.look.lerp(target, blend);
    this.camera.lookAt(this.look);
    this.settled = true;

    this.sun.position.set(s.x - 35, s.y + 75, 35);
    this.sun.target.position.set(s.x, s.y, 0);
    this.renderer.render(this.scene, this.camera);
  }
}
