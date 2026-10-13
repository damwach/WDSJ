import { describe, expect, it } from 'vitest';
import { landing, landingSlope } from '../src/world/hill';
describe('landing bowl and shared collision surface', () => {
  it('joins every transition without position or tangent discontinuities', () => {
    for (const x of [0, 25, 70, 115, 160]) {
      expect(landing(x - 1e-5)).toBeCloseTo(landing(x + 1e-5), 4);
      expect(landingSlope(x - 1e-5)).toBeCloseTo(landingSlope(x + 1e-5), 5);
    }
  });
  it('descends monotonically, matches analytic slope and ends in a level outrun', () => {
    for (let x = 1; x < 160; x++) {
      expect(landing(x)).toBeLessThanOrEqual(landing(x - 1));
      expect(landingSlope(x)).toBeCloseTo((landing(x+.00001)-landing(x-.00001))/.00002, 6);
    }
    expect(landing(160)).toBe(landing(200));
    expect(landingSlope(180)).toBe(0);
  });
});
