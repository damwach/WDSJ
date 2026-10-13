import {createServer} from 'vite';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const server=await createServer({server:{middlewareMode:true},logLevel:'silent'});
try {
 const m=await server.ssrLoadModule('/src/world/hill.ts');
 const points=m.hill.points;
 const sample=(from,to,height,slope)=>{
  const n=Math.ceil((to-from)/.25);
  return Array.from({length:n+1},(_,i)=>{
   const x=from+(to-from)*i/n;
   return {x,y:height(x),slope:slope(x)};
  });
 };
 const source=await readFile('docs/reference/HS140_2022.pdf');
 const data={source:{file:'docs/reference/HS140_2022.pdf',sha256:createHash('sha256').update(source).digest('hex')},
  certificate:m.certificate,reconstruction:m.reconstruction,points,
  inrun:sample(points.A.x,0,m.height,m.slope),landing:sample(0,points.outrunEnd.x,m.landing,m.landingSlope),
  derived:{actualHeightRatio:m.certificate.landing.h/m.certificate.landing.n,transitionPower:m.hill.transitionPower,
   gatePitchAlongTrack:m.certificate.inrun.es/(m.certificate.inrun.gates-1),knollArcLength:m.hill.knollArcLength}};
 await mkdir('artifacts',{recursive:true});
 await writeFile('artifacts/hs140-profile.json',JSON.stringify(data,null,2)+'\n');
 console.log('Metric profile exported: artifacts/hs140-profile.json');
} finally {await server.close();}
