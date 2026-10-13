import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { Athlete, dimensions } from '../src/athlete/rig';

describe('athlete anatomical rig', () => {
  it('keeps measured limb lengths and both ski bases on the contact plane through the motion', () => {
    const athlete = new Athlete();
    for (const [extension, flight, landing] of [[0, 0, 0], [.4, 0, 0], [1, 0, 0], [1, .3, 0], [1, 1, 0], [1, 1, .5], [1, 1, 1]]) {
      athlete.pose(extension, flight, landing);
      athlete.root.updateMatrixWorld(true);
      for (const leg of athlete.legs) {
        const hip = leg.hip.getWorldPosition(new T.Vector3());
        const knee = leg.knee.getWorldPosition(new T.Vector3());
        const ankle = leg.ankle.getWorldPosition(new T.Vector3());
        expect(hip.distanceTo(knee)).toBeCloseTo(dimensions.thigh, 10);
        expect(knee.distanceTo(ankle)).toBeCloseTo(dimensions.shin, 10);
        expect(ankle.x).toBeCloseTo(0, 10);
        expect(ankle.y).toBeCloseTo(.115, 10);
        const ski = leg.ski.children[0] as T.Mesh;
        const bounds = new T.Box3().setFromObject(ski);
        expect(bounds.min.y).toBeCloseTo(0, 6);
      }
    }
  });

  it('has a compact tuck, rises in extension and opens a symmetric V in flight', () => {
    const athlete = new Athlete();
    athlete.root.updateMatrixWorld(true);
    const tuckHeight = new T.Box3().setFromObject(athlete.root).max.y;
    expect(tuckHeight).toBeGreaterThan(.9);
    expect(tuckHeight).toBeLessThan(1.2);
    const tuckPelvis = athlete.pelvis.position.y;
    athlete.pose(1, 0, 0);
    expect(athlete.pelvis.position.y - tuckPelvis).toBeGreaterThan(.3);
    const extendedHeight = new T.Box3().setFromObject(athlete.root).max.y;
    expect(extendedHeight).toBeGreaterThan(1.65);
    expect(extendedHeight).toBeLessThan(1.85);
    athlete.pose(1, 1, 0);
    expect(athlete.legs[0].ski.rotation.y).toBeCloseTo(-athlete.legs[1].ski.rotation.y, 10);
    expect(athlete.legs[0].ski.rotation.y).toBeGreaterThan(.2);
    athlete.pose(1, 1, 1);
    expect(athlete.legs[0].ski.rotation.y).toBe(0);
  });

  it('reuses geometry and scene objects while posing', () => {
    const athlete = new Athlete();
    const collect = () => {
      const objects: string[] = [];
      athlete.root.traverse(object => objects.push(object.uuid, ...(object instanceof T.Mesh ? [object.geometry.uuid] : [])));
      return objects;
    };
    const initial = collect();
    for (let i = 0; i < 120; i++) athlete.pose(i / 120, i / 120, 0);
    expect(collect()).toEqual(initial);
  });
});
