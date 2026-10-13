import {test,expect} from '@playwright/test';
import {height,landing,hill,certificate} from '../src/world/hill';

test('rendered HS140 uses the same metric profile and widths as collision',async({page})=>{
 const errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.goto('http://localhost:5173');
 await page.waitForFunction(()=>Boolean((window as any).SKYLIFT));
 const result=await page.evaluate(()=>{
  const a=(window as any).SKYLIFT;a.setCamera('overview',true);a.step(0);
  const samples=(name:string)=>{
   const object=a.view.scene.getObjectByName(name),position=object.geometry.getAttribute('position');
   return Array.from({length:Math.ceil(position.count/6)},(_,i)=>[position.getX(i*6),position.getY(i*6),position.getZ(i*6)]);
  };
  const width=(name:string)=>{
   const mesh=a.view.scene.getObjectByName(name);mesh.geometry.computeBoundingBox();
   return mesh.geometry.boundingBox.max.z-mesh.geometry.boundingBox.min.z;
  };
  const judges=a.view.scene.getObjectByName('judges-tower');
  return {track:samples('inrun-snow'),piste:samples('landing-piste'),
   trackWidth:width('inrun-snow'),kWidth:width('k-point-line'),
   judges:{x:judges.position.x,z:judges.position.z}};
 });
 for(const [x,y] of result.track)expect(y).toBeCloseTo(height(x),4);
 for(const [x,y] of result.piste)expect(y).toBeCloseTo(landing(x),4);
 expect(result.track[0][0]).toBeCloseTo(hill.points.A.x,4);
 expect(result.piste.at(-1)![0]).toBeGreaterThan(hill.points.outrunEnd.x-1);
 expect(result.trackWidth).toBeCloseTo(certificate.inrun.width,5);
 expect(result.kWidth).toBeCloseTo(certificate.landing.kWidth,5);
 expect(result.judges).toEqual({x:84,z:35});
 await expect(page.locator('#hill-name')).toHaveText('Wielka Krokiew');
 await expect(page.locator('#hill-meta')).toContainText('K 125 / HS 140');
 await page.screenshot({path:'artifacts/15-hs140-overview.png'});
 expect(errors).toEqual([]);
});
