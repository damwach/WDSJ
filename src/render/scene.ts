import * as T from 'three';
import { Athlete } from '../athlete/rig';
import { createVenue } from '../world/venue';
import type { Simulation } from '../physics/simulation';
import {hill,certificate} from '../world/hill';

export type CameraMode = 'overview' | 'broadcast' | 'athlete';

/** A presentation-only copy. The renderer never writes back into the simulation. */
export type RenderState = Pick<Simulation,
  'x' | 'y' | 'z' | 'pitch' | 'roll' | 'extension' | 'flightTime' |
  'landingPose' | 'bodyLean' | 'skiPitch' | 'aftermathTime' | 'time' | 'phase'>;

export function captureRenderState(s: Simulation): RenderState {
  return {
    x: s.x, y: s.y, z: s.z, pitch: s.pitch, roll: s.roll,
    extension: s.extension, flightTime: s.flightTime, landingPose: s.landingPose,
    bodyLean: s.bodyLean, skiPitch: s.skiPitch, aftermathTime: s.aftermathTime,
    time: s.time, phase: s.phase,
  };
}

function interpolateState(current: RenderState, previous: RenderState | undefined, alpha: number): RenderState {
  // Resets and replay seeks are cuts. Never blend an old jump into a new one.
  if (!previous || previous.time > current.time || current.time - previous.time > .02 ||
    Math.hypot(current.x - previous.x, current.y - previous.y, current.z - previous.z) > 30) return current;
  const t = T.MathUtils.clamp(alpha, 0, 1);
  const mix = (key: keyof Omit<RenderState, 'phase'>) => T.MathUtils.lerp(previous[key], current[key], t);
  const angle = (key: 'pitch' | 'roll' | 'bodyLean' | 'skiPitch') => previous[key] +
    Math.atan2(Math.sin(current[key] - previous[key]), Math.cos(current[key] - previous[key])) * t;
  return {
    x: mix('x'), y: mix('y'), z: mix('z'), pitch: angle('pitch'), roll: angle('roll'),
    extension: mix('extension'), flightTime: mix('flightTime'), landingPose: mix('landingPose'),
    bodyLean: angle('bodyLean'), skiPitch: angle('skiPitch'), aftermathTime: mix('aftermathTime'),
    time: mix('time'), phase: current.phase,
  };
}

export class View {
  renderer: T.WebGLRenderer;
  scene = new T.Scene();
  camera = new T.PerspectiveCamera(42, 1, .1, 1400);
  athlete = new Athlete();
  mode: CameraMode = 'overview';
  private sun: T.DirectionalLight;
  private look = new T.Vector3();
  private trackedPosition = new T.Vector3();
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

  /** The one-argument path stays exact for paused poses, replay tools and tests. */
  render(sim: Simulation, previous?: RenderState, alpha = 1) {
    const s = interpolateState(captureRenderState(sim), previous, alpha);
    const now = performance.now();
    const dt = Math.min(.05, (now - this.previousTime) / 1000);
    this.previousTime = now;
    const grounded = s.phase === 'landed' || s.phase === 'fallen';
    this.athlete.pose(s.extension, s.flightTime, s.landingPose, {
      bodyLean: s.bodyLean, skiPitch: s.skiPitch,
      groundedSeconds: grounded ? s.aftermathTime : undefined,
      impactSpeed: sim.impact, fallen: s.phase === 'fallen',
    });
    this.athlete.root.position.set(s.x, s.y, s.z);
    const fallBlend = T.MathUtils.smoothstep(s.aftermathTime, 0, .35);
    const fallenRoll = T.MathUtils.lerp(s.roll, s.roll < 0 ? -1.1 : 1.1, fallBlend);
    this.athlete.root.rotation.set(s.phase === 'fallen' ? fallenRoll : s.roll, 0, s.pitch);

    const target = new T.Vector3();
    const eye = new T.Vector3();
    if (this.mode === 'overview') {
      const portrait = this.camera.aspect < .9;
      const p=hill.points;
      const minX=p.A.x-6,maxX=p.outrunEnd.x+8,minY=p.U.y-2,maxY=p.A.y+5;
      target.set((minX+maxX)/2,(minY+maxY)/2,0);
      const direction=(portrait?new T.Vector3(1,.40,.35):new T.Vector3(.27,.23,1)).normalize();
      const right=new T.Vector3(direction.z,0,-direction.x).normalize();
      const up=new T.Vector3().crossVectors(direction,right);
      const tanV=Math.tan(this.camera.fov*Math.PI/360),tanH=tanV*this.camera.aspect;
      let distance=0;
      for(const x of [minX,maxX])for(const y of [minY,maxY])for(const z of [-certificate.landing.uWidth/2,certificate.landing.uWidth/2]){
        const offset=new T.Vector3(x,y,z).sub(target),depth=offset.dot(direction);
        distance=Math.max(distance,depth+Math.abs(offset.dot(right))/(tanH*.85),depth+Math.abs(offset.dot(up))/(tanV*.72));
      }
      eye.copy(target).addScaledVector(direction,distance);
    } else if (this.mode === 'athlete') {
      target.set(s.x + .35, s.y + .7, s.z);
      // A closer lateral position shows joint motion while the sightline to the
      // boots still clears the near-side table guardrail.
      eye.copy(target).add(new T.Vector3(1.3, 1.95, 3.65));
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
    if (this.settled && this.mode !== 'overview') {
      // Carry tracking cameras with the athlete before easing their framing.
      // Damping absolute world positions would leave a fast skier metres ahead
      // of the close-up, even though both eye and look-at appeared smooth.
      const motion = new T.Vector3(s.x, s.y, s.z).sub(this.trackedPosition);
      this.camera.position.add(motion);
      this.look.add(motion);
    }
    this.trackedPosition.set(s.x, s.y, s.z);
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
