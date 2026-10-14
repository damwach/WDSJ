import * as T from 'three';
import { jointPose, dimensions, hipHalfWidthM, type PoseControl } from './pose';
import { AthleteSkin } from './skin';
import { DEFAULT_EQUIPMENT, type EquipmentConfig } from '../equipment/config';
import { SkiAssembly } from '../equipment/visual';
export { dimensions } from './pose';
export type { PoseControl } from './pose';

/** Fixed-length hierarchical rig; all surfaces are allocated once. */
export class Athlete {
  root = new T.Group();
  pelvis = new T.Group();
  torso = new T.Group();
  legs: { hip: T.Group; knee: T.Group; ankle: T.Group; ski: T.Group; boot: T.Group; equipment: SkiAssembly }[] = [];
  arms: T.Group[] = [];
  private elbows: T.Group[] = [];
  private head = new T.Group();
  private skin: AthleteSkin;
  private wrists: T.Group[] = [];
  private planeQuaternion = new T.Quaternion();
  private sagittalQuaternion = new T.Quaternion();
  private planeAxis = new T.Vector3();
  private zAxis = new T.Vector3(0, 0, 1);
  private equipmentConfig: EquipmentConfig;
  private equipmentSignature: string;

  constructor(equipment: EquipmentConfig = DEFAULT_EQUIPMENT) {
    this.equipmentConfig = equipment;
    this.equipmentSignature = JSON.stringify(equipment);
    this.root.name = 'ski-jumper';
    this.root.add(this.pelvis);
    this.pelvis.add(this.torso);
    this.head.name = 'helmet-and-head';
    this.head.position.set(.006, .558, 0);
    this.torso.add(this.head);

    for (const side of [-1, 1] as const) {
      const hip = new T.Group();
      hip.name = side === -1 ? 'left-hip' : 'right-hip';
      hip.position.z = side * hipHalfWidthM;
      this.pelvis.add(hip);
      const knee = new T.Group();
      knee.name = side === -1 ? 'left-knee' : 'right-knee';
      knee.position.y = -dimensions.thigh;
      hip.add(knee);
      const ankle = new T.Group();
      ankle.position.y = -dimensions.shin;
      knee.add(ankle);
      const assembly = new SkiAssembly(equipment, side === -1 ? 'left' : 'right');
      ankle.add(assembly.ski, assembly.boot);
      this.legs.push({ hip, knee, ankle, ski: assembly.ski, boot: assembly.boot, equipment: assembly });

      const arm = new T.Group();
      arm.position.set(-.005, .437, side * .173);
      this.torso.add(arm);
      const elbow = new T.Group();
      elbow.position.y = -.29;
      arm.add(elbow);
      const wrist = new T.Group();
      wrist.position.y = -.25;
      elbow.add(wrist);
      this.wrists.push(wrist);
      this.arms.push(arm);
      this.elbows.push(elbow);
    }
    const targets: Record<string,T.Object3D> = {pelvis:this.pelvis,torso:this.torso,head:this.head};
    for (const [i,s] of ['L','R'].entries()) {
      Object.assign(targets,{['hip_'+s]:this.legs[i].hip,['knee_'+s]:this.legs[i].knee,
        ['ankle_'+s]:this.legs[i].ankle,['arm_'+s]:this.arms[i],
        ['elbow_'+s]:this.elbows[i],['wrist_'+s]:this.wrists[i]});
    }
    this.skin = new AthleteSkin(this.root,targets);
    this.pose(0, 0, 0);
  }

  /** Rebuild only when equipment dimensions change; ordinary posing allocates
   * no scene objects or geometry. Suitable for the laboratory preview. */
  setEquipment(config: EquipmentConfig) {
    const signature = JSON.stringify(config);
    this.equipmentConfig = config;
    if (signature === this.equipmentSignature) return;
    this.equipmentSignature = signature;
    for (let i = 0; i < this.legs.length; i++) {
      const leg = this.legs[i];
      leg.equipment.dispose();
      leg.equipment = new SkiAssembly(config, i === 0 ? 'left' : 'right');
      leg.ski = leg.equipment.ski;
      leg.boot = leg.equipment.boot;
      leg.ankle.add(leg.ski, leg.boot);
    }
  }

  pose(extension: number, flightSeconds: number, landing: number, controls?: PoseControl) {
    if (controls?.equipment && (controls.equipment !== this.equipmentConfig || !Object.isFrozen(controls.equipment))) {
      this.setEquipment(controls.equipment);
    }
    const p = jointPose(extension, flightSeconds, landing, { ...controls, equipment: this.equipmentConfig });
    this.pelvis.position.set(p.hipX, p.hipY, 0);
    this.torso.rotation.z = -p.trunkLean;
    this.head.rotation.z = p.headRotation;
    this.arms.forEach((arm, i) => {
      arm.rotation.z = p.shoulder;
      arm.rotation.x = (i === 0 ? 1 : -1) * p.armSpread;
      this.elbows[i].rotation.z = p.elbow;
    });
    this.legs.forEach(({ hip, knee, ankle, equipment }, i) => {
      const leg = p.legs[i];
      this.planeAxis.set(leg.planeAxisX, leg.planeAxisY, 0);
      this.planeQuaternion.setFromAxisAngle(this.planeAxis, leg.abduction);
      this.sagittalQuaternion.setFromAxisAngle(this.zAxis, leg.upper);
      hip.quaternion.copy(this.planeQuaternion).multiply(this.sagittalQuaternion);
      knee.rotation.z = leg.lower - leg.upper;
      this.sagittalQuaternion.setFromAxisAngle(this.zAxis, leg.lower);
      ankle.quaternion.copy(this.planeQuaternion).multiply(this.sagittalQuaternion).invert();
      equipment.pose((i === 0 ? 1 : -1) * p.vAngleRad, p.skiPitch,
        controls?.skiStates?.[i]?.heelAngleRad ?? 0, leg.lower);
    });
    this.syncSkin();
  }

  syncSkin() { this.skin.update(); }
}
