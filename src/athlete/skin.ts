import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import asset from './assets/athlete.glb?url&inline';
import frames from './assets/bind-frames.json';

let template: T.Group | undefined;
let pending: Promise<void> | undefined;
/** Embedded GLB also works in the offline HTML. Parse once, clone skeletons only. */
export function loadAthleteAsset(): Promise<void> {
  return pending ??= (async () => {
    const encoded = asset.slice(asset.indexOf(',') + 1);
    const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    template = (await new GLTFLoader().parseAsync(bytes.buffer, '')).scene;
  })();
}

export class AthleteSkin {
  readonly model: T.Object3D;
  private bindings: { bone: T.Bone; target: T.Object3D; offset: T.Matrix4 }[] = [];
  private inverse = new T.Matrix4();
  private desired = new T.Matrix4();
  constructor(private root: T.Group, targets: Record<string, T.Object3D>) {
    if (!template) throw new Error('Athlete GLB must finish loading before the scene is created');
    this.model = clone(template);
    this.model.name = 'skinned-athlete';
    this.model.updateMatrixWorld(true);
    for (const frame of frames) {
      const bone = this.model.getObjectByName(frame.name) as T.Bone;
      if (!bone?.isBone || !targets[frame.target]) throw new Error(`Missing athlete joint: ${frame.name}`);
      // Authored A-pose joint frame to Blender bone frame. This retains Blender's
      // bone orientation and supports ordinary editing/re-export of the armature.
      const rest = new T.Matrix4().compose(new T.Vector3(...frame.joint as [number,number,number]),
        new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0), frame.angle), new T.Vector3(1,1,1));
      // Spine/clavicle targets use the torso origin, wrists the elbow frame.
      if (frame.target === 'torso') rest.identity();
      const offset = rest.invert().multiply(bone.matrixWorld);
      this.bindings.push({ bone, target: targets[frame.target], offset });
    }
    this.model.traverse(o => {
      if (o instanceof T.Mesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
    });
    root.add(this.model);
  }
  update() {
    this.root.updateMatrixWorld(true);
    // Parent-before-child order from the exported rig definition. No allocation,
    // animation mixer, independent trajectory, or generated geometry per frame.
    for (const { bone, target, offset } of this.bindings) {
      this.desired.copy(target.matrixWorld).multiply(offset);
      this.inverse.copy(bone.parent!.matrixWorld).invert();
      bone.matrix.multiplyMatrices(this.inverse, this.desired);
      bone.matrix.decompose(bone.position, bone.quaternion, bone.scale);
      bone.updateMatrixWorld(true);
    }
  }
}
