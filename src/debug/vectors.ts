import * as T from 'three';
import type { JumpFrame } from '../physics/recorder';

/** Presentation only. Force samples are evaluated at the beginning of a step. */
export class DebugForceVectors {
  readonly root = new T.Group();
  private readonly arrows = {
    lift: new T.ArrowHelper(new T.Vector3(0, 1, 0), new T.Vector3(), 1, '#61e6c5'),
    drag: new T.ArrowHelper(new T.Vector3(-1, 0, 0), new T.Vector3(), 1, '#ffab71'),
    gravity: new T.ArrowHelper(new T.Vector3(0, -1, 0), new T.Vector3(), 1, '#f4d16f'),
    contact: new T.ArrowHelper(new T.Vector3(0, 1, 0), new T.Vector3(), 1, '#cfa4ff'),
  };
  private reference?: T.Line;
  private reconstructed?: T.Line;
  private showForces = true;
  private showTrajectories = true;

  constructor(scene: T.Scene) {
    this.root.name = 'physics-debug-overlays';
    this.root.visible = false;
    for (const [name, arrow] of Object.entries(this.arrows)) {
      arrow.name = `debug-force-${name}`;
      arrow.renderOrder = 12;
      for (const mesh of [arrow.line, arrow.cone]) {
        const material = mesh.material as T.Material;
        material.depthTest = false;
        material.transparent = true;
        material.opacity = .94;
      }
      this.root.add(arrow);
    }
    scene.add(this.root);
  }

  setVisible(visible: boolean) { this.root.visible = visible; }
  setForcesVisible(visible: boolean) { this.showForces = visible; }
  setTrajectoriesVisible(visible: boolean) {
    this.showTrajectories = visible;
    if (this.reference) this.reference.visible = visible;
    if (this.reconstructed) this.reconstructed.visible = visible;
  }

  setTrajectories(recorded: readonly JumpFrame[], recomputed: readonly JumpFrame[]) {
    for (const line of [this.reference, this.reconstructed]) {
      if (!line) continue;
      this.root.remove(line);
      line.geometry.dispose();
      (line.material as T.Material).dispose();
    }
    const points = (frames: readonly JumpFrame[]) => frames.map(frame =>
      new T.Vector3(frame.com.position.x, frame.com.position.y, frame.com.position.z));
    this.reference = new T.Line(new T.BufferGeometry().setFromPoints(points(recorded)),
      new T.LineDashedMaterial({ color: '#f8f4de', dashSize: .8, gapSize: .45, transparent: true, opacity: .72, depthTest: false }));
    this.reference.name = 'debug-recorded-trajectory';
    this.reference.computeLineDistances();
    this.reconstructed = new T.Line(new T.BufferGeometry().setFromPoints(points(recomputed)),
      new T.LineBasicMaterial({ color: '#48dce0', transparent: true, opacity: .84, depthTest: false }));
    this.reconstructed.name = 'debug-recomputed-trajectory';
    for (const line of [this.reference, this.reconstructed]) {
      line.renderOrder = 11;
      line.visible = this.showTrajectories;
      this.root.add(line);
    }
  }

  update(frame?: JumpFrame) {
    for (const [name, arrow] of Object.entries(this.arrows)) {
      const force = frame?.forces[name as keyof typeof this.arrows];
      const magnitude = force ? Math.hypot(force.x, force.y, force.z) : 0;
      arrow.visible = this.showForces && magnitude > 1e-9;
      if (!force || !frame || !arrow.visible) continue;
      arrow.position.set(frame.com.position.x, frame.com.position.y, frame.com.position.z);
      arrow.setDirection(new T.Vector3(force.x, force.y, force.z).normalize());
      // A common linear scale: one metre represents 400 N. No magnitude clamp.
      const length = magnitude / 400;
      arrow.setLength(length, Math.min(.22, length * .24), Math.min(.12, length * .12));
    }
  }
}
