// Metres. C1 continuous transition from 32° inrun to 10° table.
export const slope = (x:number) => x < -22 ? -Math.tan(32*Math.PI/180) : x > -6 ? -Math.tan(10*Math.PI/180) : (()=>{const t=(x+22)/16;return -Math.tan(32*Math.PI/180)+(Math.tan(32*Math.PI/180)-Math.tan(10*Math.PI/180))*t*t*(3-2*t)})();
export function height(x:number){let y=0;const n=Math.max(1,Math.ceil(Math.abs(x)/.05)),d=x/n;for(let i=0;i<n;i++)y+=slope((i+.5)*d)*d;return y;}

// A design profile, not a certified hill: steep landing region blends into a flat outrun.
// Both rendering and collision use the same position and exact tangent.
const landingKnots = [
  [0, -4, -.20], [25, -12, -.40], [70, -35, -.60], [115, -60, -.43], [160, -72, 0],
] as const;
function landingSample(x: number, derivative: boolean): number {
  if (x <= 0) return derivative ? -.20 : -4 - .20 * x;
  if (x >= 160) return derivative ? 0 : -72;
  for (let i = 1; i < landingKnots.length; i++) {
    const a = landingKnots[i - 1], b = landingKnots[i];
    if (x > b[0]) continue;
    const span = b[0] - a[0], t = (x - a[0]) / span;
    if (derivative) return ((6*t*t-6*t)*a[1] + (3*t*t-4*t+1)*span*a[2] + (-6*t*t+6*t)*b[1] + (3*t*t-2*t)*span*b[2]) / span;
    return (2*t*t*t-3*t*t+1)*a[1] + (t*t*t-2*t*t+t)*span*a[2] + (-2*t*t*t+3*t*t)*b[1] + (t*t*t-t*t)*span*b[2];
  }
  return derivative ? 0 : -72;
}
export const landing = (x:number) => landingSample(x, false);
export const landingSlope = (x:number) => landingSample(x, true);
