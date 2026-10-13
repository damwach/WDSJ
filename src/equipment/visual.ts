import * as T from 'three';
import { type EquipmentConfig } from './config';
import { heelGeometry, skiProperties } from './model';
import {skiProfileAt,SKI_PROFILE_SECTIONS} from './contact';

const skiWhite = new T.MeshStandardMaterial({ color: '#e9eee9', roughness: .47 });
const skiRed = new T.MeshStandardMaterial({ color: '#ef492d', roughness: .48 });
const bootDark = new T.MeshStandardMaterial({ color: '#162935', roughness: .57 });
const bootLight = new T.MeshStandardMaterial({ color: '#dee5e0', roughness: .57 });
const soleMaterial = new T.MeshStandardMaterial({ color: '#354d5b', roughness: .49 });
const metal = new T.MeshStandardMaterial({ color: '#adc1ca', roughness: .28, metalness: .78 });
const black = new T.MeshStandardMaterial({ color: '#101b22', roughness: .45 });

function mesh(geometry: T.BufferGeometry, material: T.Material, parent: T.Object3D,
  name: string, x = 0, y = 0, z = 0) {
  const object = new T.Mesh(geometry, material);
  object.name = name;
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  object.userData.equipment = true;
  parent.add(object);
  return object;
}
function marker(parent: T.Object3D, name: string, x: number, y: number) {
  const point = new T.Object3D();
  point.name = name;
  point.position.set(x, y, 0);
  point.userData.equipment = true;
  parent.add(point);
  return point;
}

/** The shape is tail-origin geometry translated to the actual front attachment.
 * Moving the binding changes every ski vertex relative to the boot. */
export function makeSkiGeometry(config: EquipmentConfig) {
  const { ski } = config;
  const positions: number[] = [], indices: number[] = [];
  const sections = SKI_PROFILE_SECTIONS;
  for (let i = 0; i <= sections; i++) {
    const s = ski.lengthM * i / sections;
    const {x,yBottom:y,halfWidth}=skiProfileAt(config,s);
    positions.push(x, y, -halfWidth, x, y, halfWidth,
      x, y + ski.thicknessM, -halfWidth, x, y + ski.thicknessM, halfWidth);
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

/** Two sibling bodies: the boot follows the ankle, the ski rotates around the
 * front fixation. A telescopic rear guide connects the solved anchor points. */
export class SkiAssembly {
  readonly ski = new T.Group();
  readonly boot = new T.Group();
  readonly cuff = new T.Group();
  readonly bootToe: T.Object3D;
  readonly bootFront: T.Object3D;
  readonly rearBoot: T.Object3D;
  readonly rearSki: T.Object3D;
  private rod: T.Mesh;
  private rodInner: T.Mesh;
  private frontPosition = new T.Vector3();
  private rodA = new T.Vector3();
  private rodB = new T.Vector3();
  private rodDirection = new T.Vector3();
  private rodRotation = new T.Quaternion();
  private up = new T.Vector3(0, 1, 0);

  constructor(readonly config: EquipmentConfig, readonly side: 'left' | 'right') {
    const { ski, binding } = config;
    const ankleHeight = binding.ankleHeightM;
    const toeX = -binding.ankleOffsetM;
    const frontX = toeX + binding.frontAttachmentOffsetM;
    const frontY = binding.frontPivotHeightM - ankleHeight;
    const toeY = binding.frontPivotHeightM - ankleHeight;
    const bootCenter = toeX - binding.bootLengthM / 2;
    this.ski.name = `${side}-ski`;
    this.boot.name = `${side}-boot`;
    this.ski.userData.equipment = this.boot.userData.equipment = true;
    // Preserve the main ski mesh as child 0 for existing diagnostic consumers.
    mesh(makeSkiGeometry(config), skiWhite, this.ski, `${side}-ski-surface`);
    const frontS = binding.bootToePositionM + binding.frontAttachmentOffsetM;
    const deckY = ski.thicknessM - binding.frontPivotHeightM + .001;
    mesh(new T.BoxGeometry(ski.lengthM * .56, .002, .020), skiRed, this.ski,
      `${side}-ski-stripe`, ski.lengthM * .52 - frontS, deckY);
    mesh(new T.BoxGeometry(ski.lengthM * .12, .002, ski.widthM * .70), bootDark, this.ski,
      `${side}-ski-tail-mark`, ski.lengthM * .13 - frontS, deckY);
    mesh(new T.BoxGeometry(ski.lengthM * .06, .002, ski.widthM * .64), skiRed, this.ski,
      `${side}-ski-front-mark`, ski.lengthM * .82 - frontS, deckY);
    // The toe clamp rotates with the ski around its genuine front pivot.
    mesh(new T.BoxGeometry(.052, .019, .102), black, this.ski, `${side}-binding-front`, 0, .006);
    mesh(new T.BoxGeometry(.045, .012, .112), metal, this.ski, `${side}-binding-front-jaw`, 0, .019);
    this.bootFront = marker(this.boot, `${side}-boot-front-attachment`, frontX, frontY);
    this.bootToe = marker(this.boot, `${side}-boot-toe`, toeX, toeY);
    marker(this.ski, `${side}-ski-front-attachment`, 0, 0);
    marker(this.ski, `${side}-ski-tip`, ski.lengthM - frontS,
      ski.tipRiseM + ski.thicknessM / 2 - binding.frontPivotHeightM);
    marker(this.ski, `${side}-ski-tail`, -frontS,
      ski.tailRiseM + ski.thicknessM / 2 - binding.frontPivotHeightM);
    const properties = skiProperties(config);
    marker(this.ski, `${side}-ski-center-of-mass`,
      properties.centerOfMass.x - properties.frontAttachment.x,
      properties.centerOfMass.y - properties.frontAttachment.y);
    marker(this.ski, `${side}-ski-center-of-pressure`,
      properties.centerOfPressure.x - properties.frontAttachment.x,
      properties.centerOfPressure.y - properties.frontAttachment.y);

    // A full-length jumping boot with a visible flexible middle of the sole.
    // Its compliance is the mechanical solver's series spring, not an idle pose.
    mesh(new T.BoxGeometry(binding.bootLengthM, binding.bootSoleHeightM, .101), soleMaterial,
      this.boot, `${side}-boot-sole`, bootCenter, toeY + binding.bootSoleHeightM / 2);
    const upper = mesh(new T.SphereGeometry(1, 24, 16), bootLight, this.boot,
      `${side}-boot-upper`, bootCenter, toeY + .055);
    upper.scale.set(binding.bootLengthM / 2, .053, .052);
    mesh(new T.BoxGeometry(.035, binding.bootSoleHeightM + .001, .102), black, this.boot,
      `${side}-boot-flex-zone`, bootCenter + .025, toeY + binding.bootSoleHeightM / 2);
    this.cuff.name = `${side}-boot-cuff`;
    this.cuff.userData.equipment = true;
    this.boot.add(this.cuff);
    const cuff = mesh(new T.SphereGeometry(1, 24, 16), bootDark, this.cuff,
      `${side}-boot-cuff-shell`, -.012, .028);
    cuff.scale.set(.060, .083, .054);
    mesh(new T.BoxGeometry(.071, .017, .112), soleMaterial, this.cuff, `${side}-boot-strap-lower`, -.012, .041);
    mesh(new T.BoxGeometry(.064, .015, .108), soleMaterial, this.cuff, `${side}-boot-strap-upper`, -.011, .069);

    const neutral = heelGeometry(config, 0);
    const guideZ = (side === 'left' ? -1 : 1) * binding.rearGuideLateralOffsetM;
    const rearSkiX = neutral.rearSkiPoint.x - neutral.frontPoint.x;
    const rearSkiY = neutral.rearSkiPoint.y - neutral.frontPoint.y;
    this.rearSki = marker(this.ski, `${side}-binding-rear-ski-anchor`, rearSkiX, rearSkiY);
    this.rearSki.position.z = guideZ;
    this.rearBoot = marker(this.boot, `${side}-binding-rear-boot-anchor`,
      toeX + binding.rearAttachmentOffsetM, binding.rearBootAttachmentHeightM - ankleHeight);
    this.rearBoot.position.z = guideZ;
    mesh(new T.BoxGeometry(.032, .015, .018), metal, this.ski,
      `${side}-binding-rear-guide`, rearSkiX, rearSkiY - .006, guideZ);
    mesh(new T.SphereGeometry(.008, 12, 8), metal, this.boot, `${side}-binding-rear-eye`,
      this.rearBoot.position.x, this.rearBoot.position.y, guideZ);
    this.rod = mesh(new T.CylinderGeometry(.0047, .0047, 1, 12), metal, this.ski, `${side}-binding-rear-rod`);
    this.rodInner = mesh(new T.CylinderGeometry(.0030, .0030, 1, 12), black, this.ski, `${side}-binding-rear-rod-inner`);
    this.boot.rotation.order = this.ski.rotation.order = 'YXZ';
    this.pose(0, 0, 0, 0);
  }

  pose(yaw: number, bootPitch: number, heelAngle: number, lowerLegAngle: number) {
    const binding = this.config.binding;
    this.boot.rotation.set(0, yaw, bootPitch, 'YXZ');
    this.boot.updateMatrix();
    this.frontPosition.set(-binding.ankleOffsetM + binding.frontAttachmentOffsetM,
      binding.frontPivotHeightM - binding.ankleHeightM, 0).applyQuaternion(this.boot.quaternion);
    this.ski.position.copy(this.frontPosition);
    this.ski.rotation.set(0, yaw, bootPitch + heelAngle, 'YXZ');
    this.cuff.rotation.z = lowerLegAngle * .6;
    const geometry = heelGeometry(this.config, heelAngle);
    const guideZ = (this.side === 'left' ? -1 : 1) * binding.rearGuideLateralOffsetM;
    this.rodA.set(geometry.rearSkiPoint.x - geometry.frontPoint.x,
      geometry.rearSkiPoint.y - geometry.frontPoint.y, guideZ);
    this.rodB.set(geometry.rearBootPoint.x - geometry.frontPoint.x,
      geometry.rearBootPoint.y - geometry.frontPoint.y, guideZ);
    this.rodDirection.subVectors(this.rodB, this.rodA);
    const length = this.rodDirection.length();
    this.rodRotation.setFromUnitVectors(this.up, this.rodDirection.normalize());
    this.rod.position.copy(this.rodA).lerp(this.rodB, .34);
    this.rod.quaternion.copy(this.rodRotation);
    this.rod.scale.y = length * .68;
    this.rodInner.position.copy(this.rodA).lerp(this.rodB, .68);
    this.rodInner.quaternion.copy(this.rodRotation);
    this.rodInner.scale.y = length * .64;
    this.ski.userData.heelAngleRad = heelAngle;
    this.ski.userData.rodLengthM = geometry.rodLengthM;
    this.ski.userData.heelRiseM = geometry.heelRiseM;
  }

  dispose() {
    for (const object of [this.boot, this.ski]) object.traverse(child => {
      if (child instanceof T.Mesh) child.geometry.dispose();
    });
    this.boot.removeFromParent();
    this.ski.removeFromParent();
  }
}
