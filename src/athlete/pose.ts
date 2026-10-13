/** Kinematics in metres/radians. +X is forward, Y up; every bone keeps its length.
 * One pose definition is shared by the visible skeleton and the COM model. */
export const dimensions = { thigh: .44, shin: .43, torso: .53, ski: 2.6 };
/** Union of the procedural body's triangles projected into its chord plane
 * (boots/skis/bindings excluded), 1mm grid: .4891m². This is geometry, not
 * validation of lift/drag coefficients. See scripts/measure-body-area.mjs. */
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
  /** Positive lifts the ski tips; boot and binding follow the ski. */
  skiPitch?: number;
  /** Ground presentation: absorption/recovery, not an extra flight impulse. */
  groundedSeconds?: number;
  impactSpeed?: number;
  fallen?: boolean;
};

/** Opening the skis follows the initial leg/hip transfer, rather than happening
 * simultaneously with the push against the table. */
export const vDeployment = (seconds: number) => smooth(seconds, .12, .52);

/** Sagittal two-link IK with the anatomical knee bending backward. */
function legAt(hipX: number, hipY: number, ankleX: number) {
  const dx = ankleX - hipX, dy = hipY - ankleHeight;
  const a = dimensions.thigh, b = dimensions.shin;
  const flex = -Math.acos(clamp((dx * dx + dy * dy - a * a - b * b) / (2 * a * b), -1, 1));
  const upper = Math.atan2(dx, dy) - Math.atan2(b * Math.sin(flex), a + b * Math.cos(flex));
  return { upper, lower: upper + flex, ankleX };
}

export function jointPose(extension: number, flightSeconds = 0, landing = 0, controls: PoseControl = {}) {
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

  const hipX = -(dimensions.thigh * Math.sin(upper) + dimensions.shin * Math.sin(lower));
  const hipY = ankleHeight + dimensions.thigh * Math.cos(upper) + dimensions.shin * Math.cos(lower);
  // Stagger the feet into a modest telemark. Limit stride by the reachable ankle
  // interval so neither leg stretches or snaps into knee hyperextension.
  const reachX = Math.sqrt(Math.max(0, (dimensions.thigh + dimensions.shin - .004) ** 2 - (hipY - ankleHeight) ** 2));
  const stride = Math.min(.16 * contact * (1 - .75 * recovery), Math.max(0, reachX - Math.abs(hipX)));
  const legs = stride > 1e-9
    ? [legAt(hipX, hipY, stride), legAt(hipX, hipY, -stride)]
    : [{ upper, lower, ankleX: 0 }, { upper, lower, ankleX: 0 }];
  const v = vDeployment(flightSeconds) * (1 - contact);
  const shoulder = mix(mix(.05, -.04, chestDrive), .075, flight) + .34 * contact - .13 * recovery;
  return {
    hipX, hipY, legs, trunkLean, flight, contact, v,
    headRotation: trunkLean - mix(.11, .36, chestTransfer * (1 - contact)),
    shoulder, armSpread: .028 + .015 * flight + .21 * contact - .12 * recovery,
    elbow: -.12 + .035 * flight - .29 * contact + .13 * recovery,
    skiPitch: clamp(controls.skiPitch ?? 0, -.5, .5) * flight * (1 - contact),
  };
}
