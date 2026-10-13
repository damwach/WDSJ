// Metres. C1 continuous transition from 32° inrun to 10° table.
export const slope = (x:number) => x < -22 ? -Math.tan(32*Math.PI/180) : x > -6 ? -Math.tan(10*Math.PI/180) : (()=>{const t=(x+22)/16;return -Math.tan(32*Math.PI/180)+(Math.tan(32*Math.PI/180)-Math.tan(10*Math.PI/180))*t*t*(3-2*t)})();
export function height(x:number){let y=0;const n=Math.max(1,Math.ceil(Math.abs(x)/.05)),d=x/n;for(let i=0;i<n;i++)y+=slope((i+.5)*d)*d;return y;}
export const landing = (x:number) => -4-.42*x;
