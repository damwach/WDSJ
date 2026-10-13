const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(v:number,a:number,b:number)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
/** Approximate segment mass distribution, matching the rig's fixed-length FK.
 * Body/equipment mass partition is a documented modelling assumption. */
export function centerOfMassOffset(extension:number,flightSeconds=0,landing=0,bodyLean=1.27){
  const e=clamp(extension,0,1),f=smooth(flightSeconds,.025,.40),l=smooth(landing,0,1);
  const upper=mix(mix(mix(1.24,.14,e),-.86,f),.63,l);
  const lower=mix(mix(mix(-.53,-.10,e),-1.10,f),-.40,l);
  const lean=mix(mix(mix(1.17,.40,e),bodyLean,f),.35,l);
  const hip={x:-(.44*Math.sin(upper)+.43*Math.sin(lower)),y:.115+.44*Math.cos(upper)+.43*Math.cos(lower)};
  const knee={x:hip.x+.44*Math.sin(upper),y:hip.y-.44*Math.cos(upper)};
  const axis={x:Math.sin(lean),y:Math.cos(lean)};
  const weighted=(key:'x'|'y')=>.50*(hip[key]+.24*axis[key])+.08*(hip[key]+.65*axis[key])+.127*(hip[key]+.22*axis[key])+
    .20*(hip[key]+knee[key])*.5+.093*(knee[key]+(key==='x'?0:.115))*.5;
  return {x:weighted('x')*70/78+.15*8/78,y:weighted('y')*70/78+.05*8/78};
}
export function extensionAtHeight(h:number){let lo=0,hi=1;for(let i=0;i<22;i++){const e=(lo+hi)/2;if(centerOfMassOffset(e).y<h)lo=e;else hi=e;}return (lo+hi)/2;}
export function rotatedOffset(e:number,f:number,l:number,lean:number,pitch:number,roll=0){
  const o=centerOfMassOffset(e,f,l,lean);
  return {x:o.x*Math.cos(pitch)-o.y*Math.sin(pitch),y:(o.x*Math.sin(pitch)+o.y*Math.cos(pitch))*Math.cos(roll),z:(o.x*Math.sin(pitch)+o.y*Math.cos(pitch))*Math.sin(roll)};
}
