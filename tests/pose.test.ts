import {describe, it, expect} from 'vitest';
import {jointPose, vDeployment} from '../src/athlete/pose';
import {centerOfMassOffset, extensionAtHeight} from '../src/physics/biomechanics';

describe('staged athlete motion', () => {
  it('raises COM monotonically and inverts the height used by the contact actuator', () => {
    let previous = centerOfMassOffset(0).y;
    for (let i = 1; i <= 100; i++) {
      const extension = i / 100;
      const current = centerOfMassOffset(extension).y;
      expect(current).toBeGreaterThan(previous);
      expect(extensionAtHeight(current)).toBeCloseTo(extension, 5);
      previous = current;
    }
  });

  it('drives knees before hips while maintaining a forward chest at the table', () => {
    const a = jointPose(0), b = jointPose(.12), full = jointPose(1);
    const hipProgress = (a.legs[0].upper - b.legs[0].upper) / (a.legs[0].upper - full.legs[0].upper);
    const kneeProgress = (b.legs[0].lower - a.legs[0].lower) / (full.legs[0].lower - a.legs[0].lower);
    expect(kneeProgress).toBeGreaterThan(hipProgress * 2);
    expect(b.trunkLean).toBe(a.trunkLean);
    expect(full.trunkLean).toBeGreaterThan(.65);
    expect(full.trunkLean).toBeLessThan(.85);
  });

  it('transfers the chest before opening V and finishes the setup within half a second', () => {
    expect(vDeployment(.1)).toBe(0);
    const start = jointPose(1), transfer = jointPose(1, .12), flight = jointPose(1, .52);
    expect(transfer.trunkLean).toBeGreaterThan(start.trunkLean);
    expect(transfer.v).toBe(0);
    expect(flight.v).toBe(1);
    expect(flight.trunkLean).toBeCloseTo(1.27, 10);
    expect(flight.legs[0].lower - flight.legs[0].upper).toBeLessThan(-.1);
  });

  it('has no positional jumps at the transition boundaries or during foot staggering', () => {
    let previous = jointPose(.6, 0);
    for (let i = 1; i <= 700; i++) {
      const time = i / 1000;
      const pose = jointPose(.6, time, Math.max(0, (time - .4) / .3));
      expect(Math.abs(pose.hipX - previous.hipX)).toBeLessThan(.012);
      expect(Math.abs(pose.hipY - previous.hipY)).toBeLessThan(.012);
      expect(Math.abs(pose.trunkLean - previous.trunkLean)).toBeLessThan(.012);
      for (const leg of pose.legs) expect(leg.lower - leg.upper).toBeLessThan(0);
      previous = pose;
    }
  });
});
