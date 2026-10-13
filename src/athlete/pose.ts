/** Kinematics in metres/radians. +X is forward, Y up; every bone keeps its length.
 * One pose definition is shared by the visible skeleton and the COM model. */
import { DEFAULT_EQUIPMENT, type EquipmentConfig } from '../equipment/config';
import { requiredAnkleHalfSeparation, type SkiBindingState } from '../equipment/model';
export const dimensions = { thigh: .44, shin: .43, torso: .53, ski: 2.6 };
export const hipHalfWidthM = .105;
/** A modelling limit, not a measurement of this particular athlete. */
export const maxLegAbductionRad = Math.PI / 6;
/** Reference carried from the pre-lateral-IK rig: triangle projection .4891m²
 * on a 1mm grid, equipment excluded. The new wider stance has not yet been
 * remeasured; this remains an aero reference parameter, not a validation.
 * See scripts/measure-body-area.mjs for the current rig measurement procedure. */
export const BODY_REFERENCE_AREA = .489;
export const BODY_REFERENCE_SPAN = .452;
export const ankleHeight = .115;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (v: number, a: number, b: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export type PoseControl = {
  /** Inclination from +Y toward +X, independent of ski/root pitch. */
  bodyLean?: number;
  /** Tunnel-only explicit V deployment, 0..1; undefined preserves game timing. */
  vSpread?: number;
  /** Positive lifts the ski tips; boot and binding follow the ski. */
  skiPitch?: number;
  equipment?: EquipmentConfig;
  /** Actual complete system mass; COM segment weights use the same mass. */
  totalMassKg?: number;
  /** Mechanical solver state; heel angles are never invented by animation. */
  skiStates?: readonly SkiBindingState[];
  /** Ground presentation: absorption/recovery, not an extra flight impulse. */
  groundedSeconds?: number;
  impactSpeed?: number;
  fallen?: boolean;
};

/** Opening the skis follows the initial leg/hip transfer, rather than happening
 * simultaneously with the push against the table. */
export const vDeployment = (seconds: number) => smooth(seconds, .12, .52);

/** Embed a two-link leg in a plane which reaches the requested lateral ankle.
 * Rotating the whole plane keeps the knee hinge and both bone lengths intact. */
function legAt(hipX: number, hipY: number, ankleX: number, ankleZ: number, side: number, ankleY: number) {
  const dx = ankleX - hipX, dy = hipY - ankleY, dz = ankleZ - side * hipHalfWidthM;
  const sagittalReach = Math.hypot(dx, dy);
  const abduction = -Math.atan2(dz, sagittalReach);
  const planeAxisX = dy / Math.max(sagittalReach, 1e-9);
  const planeAxisY = dx / Math.max(sagittalReach, 1e-9);
  const projectedScale = 1 / Math.cos(abduction);
  const localX = dx * projectedScale, localY = dy * projectedScale;
  const a = dimensions.thigh, b = dimensions.shin;
  const flex = -Math.acos(clamp((localX * localX + localY * localY - a * a - b * b) / (2 * a * b), -1, 1));
  const upper = Math.atan2(localX, localY) - Math.atan2(b * Math.sin(flex), a + b * Math.cos(flex));
  return { upper, lower: upper + flex, ankleX, ankleZ, abduction, planeAxisX, planeAxisY };
}

/** Exact knee position matching the rig's plane rotation (Rodrigues formula). */
export function legKneePosition(pose: ReturnType<typeof jointPose>, index: number) {
  const leg = pose.legs[index], side = index === 0 ? -1 : 1;
  const x = dimensions.thigh * Math.sin(leg.upper), y = -dimensions.thigh * Math.cos(leg.upper);
  const c = Math.cos(leg.abduction), s = Math.sin(leg.abduction);
  const d = leg.planeAxisX * x + leg.planeAxisY * y;
  return {
    x: pose.hipX + x * c + leg.planeAxisX * d * (1 - c),
    y: pose.hipY + y * c + leg.planeAxisY * d * (1 - c),
    z: side * hipHalfWidthM + (leg.planeAxisX * y - leg.planeAxisY * x) * s,
  };
}

export function jointPose(extension: number, flightSeconds = 0, landing = 0, controls: PoseControl = {}) {
  const equipment = controls.equipment ?? DEFAULT_EQUIPMENT;
  const ankleHeightM = equipment.binding.ankleHeightM;
  const e = clamp(extension, 0, 1);
  const contact = smooth(landing, 0, 1);
  // Knee drive precedes the hip/chest opening. The chest remains forward at the
  // end of the push; it never follows a generic upright standing animation.
  const kneeDrive = smooth(e, 0, .88);
  const hipDrive = smooth(e, .08, 1);
  const chestDrive = smooth(e, .18, 1);
  const legTransfer = smooth(flightSeconds, .055, .44);
  const chestTransfer = smooth(flightSeconds, .035, .32);
  const flight = smooth(flightSeconds, .035, .44);
  const lean = clamp(controls.bodyLean ?? 1.27, .4, 1.52);
  let upper = mix(mix(1.24, .14, hipDrive), -.86, legTransfer);
  let lower = mix(mix(-.53, -.10, kneeDrive), -1.10, legTransfer);
  let trunkLean = mix(mix(1.17, .72, chestDrive), lean, chestTransfer);
  upper = mix(upper, .52, contact);
  lower = mix(lower, -.32, contact);
  trunkLean = mix(trunkLean, .35, contact);

  const grounded = Math.max(0, controls.groundedSeconds ?? 0);
  // A bounded visual response: quick absorption followed by a slower recovery.
  // It is not a validated muscle/compliance solver and cannot add flight energy.
  const absorption = controls.fallen ? 0 :
    (1 - Math.exp(-grounded / .065)) * Math.exp(-grounded / .30) * 1.7
    * clamp((controls.impactSpeed ?? 0) / 4, 0, 1) * contact;
  const recovery = controls.fallen ? 0 : smooth(grounded, .35, 1.4) * contact;
  upper = mix(upper + .23 * absorption, .25, recovery);
  lower = mix(lower - .16 * absorption, -.10, recovery);
  trunkLean = mix(trunkLean + .10 * absorption, .29, recovery);

  const nominalHipX = -(dimensions.thigh * Math.sin(upper) + dimensions.shin * Math.sin(lower));
  const nominalVertical = dimensions.thigh * Math.cos(upper) + dimensions.shin * Math.cos(lower);
  const legReach = Math.hypot(nominalHipX, nominalVertical);
  const deployment = (controls.vSpread === undefined ? vDeployment(flightSeconds) : clamp(controls.vSpread, 0, 1)) * (1 - contact);
  let vAngleRad = equipment.ski.vAngleRad * deployment;
  const neutralSeparation = requiredAnkleHalfSeparation(equipment, 0);
  const neutralPadding = Math.max(0, hipHalfWidthM - neutralSeparation) * (1 - deployment) ** 2;
  const separationAt = (angle: number) => requiredAnkleHalfSeparation(equipment, angle) + neutralPadding;
  // Wider/longer skis may demand an unreachable stance. Reduce opening within
  // the joint limit, rather than stretching bones or translating only the skis.
  const maxSeparation = hipHalfWidthM + legReach * Math.sin(maxLegAbductionRad);
  if (separationAt(vAngleRad) > maxSeparation) {
    let lo = 0, hi = vAngleRad;
    for (let i = 0; i < 24; i++) {
      const middle = (lo + hi) / 2;
      if (separationAt(middle) > maxSeparation) hi = middle; else lo = middle;
    }
    vAngleRad = lo;
  }
  const ankleHalfSeparationM = separationAt(vAngleRad);
  const lateralReach = Math.max(0, ankleHalfSeparationM - hipHalfWidthM);
  const abduction = Math.asin(clamp(lateralReach / Math.max(legReach, 1e-9), 0, 1));
  const hipX = nominalHipX * Math.cos(abduction);
  const hipY = ankleHeightM + nominalVertical * Math.cos(abduction);
  // Stagger the feet into a modest telemark. Limit stride by the reachable ankle
  // interval so neither leg stretches or snaps into knee hyperextension.
  const reachX = Math.sqrt(Math.max(0, (dimensions.thigh + dimensions.shin - .004) ** 2 - (hipY - ankleHeightM) ** 2 - lateralReach ** 2));
  const stride = Math.min(.16 * contact * (1 - .75 * recovery), Math.max(0, reachX - Math.abs(hipX)));
  const legs = [legAt(hipX, hipY, stride, -ankleHalfSeparationM, -1, ankleHeightM),
    legAt(hipX, hipY, -stride, ankleHalfSeparationM, 1, ankleHeightM)];
  const v = equipment.ski.vAngleRad > 0 ? vAngleRad / equipment.ski.vAngleRad : 0;
  const shoulder = mix(mix(.05, -.04, chestDrive), .075, flight) + .34 * contact - .13 * recovery;
  return {
    hipX, hipY, legs, trunkLean, flight, contact, v, vAngleRad, ankleHalfSeparationM, ankleHeightM,
    headRotation: trunkLean - mix(.11, .36, chestTransfer * (1 - contact)),
    shoulder, armSpread: .028 + .015 * flight + .21 * contact - .12 * recovery,
    elbow: -.12 + .035 * flight - .29 * contact + .13 * recovery,
    skiPitch: clamp(controls.skiPitch ?? 0, -.5, .5) * flight * (1 - contact),
  };
}
