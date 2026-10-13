import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { Athlete } from '../src/athlete/rig';
import { dimensions } from '../src/athlete/pose';

function bodyMeshes(athlete: Athlete) {
  const found: T.Mesh[] = [];
  athlete.root.traverse(o => {
    if (!(o instanceof T.Mesh)) return;
    for (let p: T.Object3D | null = o; p; p = p.parent)
      if (p.userData.equipment) return;
    found.push(o);
  });
  return found;
}

describe('athlete anatomy v2', () => {
  it('has continuous fitted surfaces, real suit anatomy and distinct gloves', () => {
    const a = new Athlete();
    for (const name of [
      'suit-chest-and-back', 'suit-seat', 'deltoid-cap', 'glove-finger-0',
      'trapezius-shoulder-transition', 'helmet-shell', 'continuous-goggle-lens',
      'anatomical-nose', 'helmet-chinstrap'
    ]) expect(a.root.getObjectByName(name), name).toBeTruthy();
    const torso = a.root.getObjectByName('suit-chest-and-back') as T.Mesh;
    const geo = torso.geometry;
    expect(geo.getAttribute('position').count).toBeGreaterThan(1500);
    const normal = geo.getAttribute('normal');
    for (let i = 0; i < normal.count; i++) {
      const v = new T.Vector3().fromBufferAttribute(normal, i);
      expect(Number.isFinite(v.x + v.y + v.z)).toBe(true);
      expect(v.length()).toBeCloseTo(1, 3);
    }
  });

  it('builds a stable body across a full range of animated poses', () => {
    const athlete = new Athlete();
    const meshes = bodyMeshes(athlete);
    expect(meshes.length).toBeGreaterThan(40);
    const initialGeometryIds = meshes.map(m => m.geometry.uuid);
    for (const [e, t, c] of [[0, 0, 0], [.25, 0, 0], [1, .5, 0],
      [1, 1.0, 0], [1, 3, 1]] as const) {
      athlete.pose(e, t, c);
      athlete.root.updateMatrixWorld(true);
      for (const mesh of bodyMeshes(athlete)) {
        const position = mesh.geometry.getAttribute('position');
        for (let i = 0; i < position.count; i++) {
          const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
          expect(Number.isFinite(x+y+z)).toBe(true);
        }
      }
      for (const leg of athlete.legs) {
        const hip=leg.hip.getWorldPosition(new T.Vector3());
        const knee=leg.knee.getWorldPosition(new T.Vector3());
        const ankle=leg.ankle.getWorldPosition(new T.Vector3());
        expect(hip.distanceTo(knee)).toBeCloseTo(dimensions.thigh, 9);
        expect(knee.distanceTo(ankle)).toBeCloseTo(dimensions.shin, 9);
      }
    }
    expect(bodyMeshes(athlete).map(m=>m.geometry.uuid)).toEqual(initialGeometryIds);
  });
});
