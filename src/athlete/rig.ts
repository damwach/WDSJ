import * as T from 'three';
import { jointPose, dimensions, ankleHeight, type PoseControl } from './pose';
import { athleteMaterials, makeTorso, makePelvis, makeLimb, makeHead, makeGlove, makeJointSleeve } from './surfaces';
export { dimensions } from './pose';
export type { PoseControl } from './pose';

const { suit, navy, cream, black } = athleteMaterials;
const sole = new T.MeshStandardMaterial({ color: '#405260', roughness: .45, metalness: .2 });
const edge = new T.MeshStandardMaterial({ color: '#98b0b9', roughness: .35, metalness: .65 });

function mesh(geometry: T.BufferGeometry, material: T.Material, parent: T.Object3D,
  x = 0, y = 0, z = 0) {
  const object = new T.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}
function ellipsoid(parent: T.Object3D, material: T.Material, at: number[], size: number[]) {
  const object = mesh(new T.SphereGeometry(1, 24, 16), material, parent, ...at as [number, number, number]);
  object.scale.set(...size as [number, number, number]);
  return object;
}

/** Full 2.60 m ski, with a rising shovel and rounded, tapered planform. */
function skiGeometry() {
  const positions: number[] = [], indices: number[] = [];
  const sections = 54;
  for (let i = 0; i <= sections; i++) {
    const x = -1.06 + dimensions.ski * i / sections;
    const nose = T.MathUtils.smoothstep(x, 1.22, 1.54);
    const tail = T.MathUtils.smoothstep(-x, 1.01, 1.06);
    const halfWidth = (.056 + .0015 * Math.abs(x) / 1.54) * (1 - .75 * nose ** 4) * (1 - .3 * tail);
    const y = -ankleHeight + .105 * nose ** 2 + .012 * tail;
    positions.push(x, y, -halfWidth, x, y, halfWidth,
      x, y + .021, -halfWidth, x, y + .021, halfWidth);
  }
  for (let i = 0; i < sections; i++) {
    const a = i * 4, b = a + 4;
    indices.push(a, a + 1, b + 1, a, b + 1, b,
      a + 2, b + 2, b + 3, a + 2, b + 3, a + 3,
      a, b, b + 2, a, b + 2, a + 2,
      a + 1, a + 3, b + 3, a + 1, b + 3, b + 1);
  }
  indices.push(0, 2, 3, 0, 3, 1);
  const end = sections * 4;
  indices.push(end, end + 1, end + 3, end, end + 3, end + 2);
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const skiShape = skiGeometry();
/** Fixed-length hierarchical rig; all surfaces are allocated once. */
export class Athlete {
  root = new T.Group();
  pelvis = new T.Group();
  torso = new T.Group();
  legs: { hip: T.Group; knee: T.Group; ankle: T.Group; ski: T.Group }[] = [];
  arms: T.Group[] = [];
  private elbows: T.Group[] = [];
  private head = new T.Group();
  private cuffs: T.Group[] = [];
  private kneeSleeves: ReturnType<typeof makeJointSleeve>[] = [];
  private elbowSleeves: ReturnType<typeof makeJointSleeve>[] = [];

  constructor() {
    this.root.name = 'ski-jumper';
    this.root.add(this.pelvis);
    this.pelvis.add(this.torso);
    this.pelvis.add(makePelvis());
    this.torso.add(makeTorso());
    this.head.name = 'helmet-and-head';
    this.head.position.set(.006, .558, 0);
    this.head.add(makeHead());
    this.torso.add(this.head);

    for (const side of [-1, 1] as const) {
      const hip = new T.Group();
      hip.name = side === -1 ? 'left-hip' : 'right-hip';
      hip.position.z = side * .105;
      this.pelvis.add(hip);
      hip.add(makeLimb(dimensions.thigh, 'thigh', side));
      const knee = new T.Group();
      knee.name = side === -1 ? 'left-knee' : 'right-knee';
      knee.position.y = -dimensions.thigh;
      hip.add(knee);
      knee.add(makeLimb(dimensions.shin, 'shin', side));
      const kneeSleeve = makeJointSleeve('knee');
      knee.add(kneeSleeve.object);
      this.kneeSleeves.push(kneeSleeve);
      const ankle = new T.Group();
      ankle.position.y = -dimensions.shin;
      knee.add(ankle);
      const ski = new T.Group();
      ankle.add(ski);
      mesh(skiShape, cream, ski);
      mesh(new T.BoxGeometry(1.47, .002, .021), suit, ski, .19, -ankleHeight + .022);
      mesh(new T.BoxGeometry(.32, .002, .083), navy, ski, -.74, -ankleHeight + .022);
      mesh(new T.BoxGeometry(.15, .003, .08), suit, ski, 1.10, -ankleHeight + .023);
      // The heel block, toe clamp, cuff and boot yaw with the actual ski.
      mesh(new T.BoxGeometry(.32, .027, .10), sole, ski, .045, -.080);
      mesh(new T.BoxGeometry(.065, .046, .105), black, ski, .158, -.052);
      mesh(new T.BoxGeometry(.078, .034, .086), edge, ski, -.079, -.058);
      ellipsoid(ski, cream, [.04, -.025, 0], [.14, .054, .052]);
      const cuff = new T.Group();
      ski.add(cuff);
      ellipsoid(cuff, navy, [-.012, .028, 0], [.060, .083, .054]);
      mesh(new T.BoxGeometry(.071, .017, .112), sole, cuff, -.012, .041);
      mesh(new T.BoxGeometry(.064, .015, .108), sole, cuff, -.011, .069);
      this.cuffs.push(cuff);
      this.legs.push({ hip, knee, ankle, ski });

      const arm = new T.Group();
      arm.position.set(-.005, .437, side * .173);
      this.torso.add(arm);
      arm.add(makeLimb(.29, 'upperArm', side));
      const elbow = new T.Group();
      elbow.position.y = -.29;
      arm.add(elbow);
      elbow.add(makeLimb(.25, 'forearm', side));
      const elbowSleeve = makeJointSleeve('elbow');
      elbow.add(elbowSleeve.object);
      this.elbowSleeves.push(elbowSleeve);
      const glove = makeGlove(side);
      glove.position.y = -.25;
      elbow.add(glove);
      this.arms.push(arm);
      this.elbows.push(elbow);
    }
    this.pose(0, 0, 0);
  }

  pose(extension: number, flightSeconds: number, landing: number, controls?: PoseControl) {
    const p = jointPose(extension, flightSeconds, landing, controls);
    this.pelvis.position.set(p.hipX, p.hipY, 0);
    this.torso.rotation.z = -p.trunkLean;
    this.head.rotation.z = p.headRotation;
    this.arms.forEach((arm, i) => {
      arm.rotation.z = p.shoulder;
      arm.rotation.x = (i === 0 ? 1 : -1) * p.armSpread;
      this.elbows[i].rotation.z = p.elbow;
      this.elbowSleeves[i].bend(p.elbow);
    });
    this.legs.forEach(({ hip, knee, ankle, ski }, i) => {
      const leg = p.legs[i];
      hip.rotation.z = leg.upper;
      knee.rotation.z = leg.lower - leg.upper;
      this.kneeSleeves[i].bend(knee.rotation.z);
      ankle.rotation.z = -leg.lower;
      ski.rotation.z = p.skiPitch;
      ski.rotation.y = (i === 0 ? 1 : -1) * .25 * p.v;
      this.cuffs[i].rotation.z = leg.lower * .6;
    });
  }
}
