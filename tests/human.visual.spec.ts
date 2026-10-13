import { test, expect } from '@playwright/test';

test('sculpted athlete silhouette from front, side, rear and three-quarter angles', async ({page}) => {
  const errors: string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  await page.addInitScript(()=>{window.requestAnimationFrame=()=>0;});
  await page.setViewportSize({width:1120,height:900});
  await page.goto('http://127.0.0.1:5173');
  await page.waitForFunction(()=>Boolean((window as any).SKYLIFT));
  const views=[
    ['front',4.2,1.5,.1],
    ['side',1.7,1.8,4.5],
    ['rear',-4.0,1.6,0.2],
    ['three-quarter',3.0,2.1,3.7]
  ] as const;
  for(const [name,x,y,z] of views){
    const stats=await page.evaluate(({x,y,z})=>{
      const v=(window as any).SKYLIFT.view;
      const athlete=v.athlete;
      const lights=v.scene.children.filter((o:any)=>o.isLight).map((o:any)=>o.clone());
      v.scene.clear();v.scene.fog=null;v.scene.background.set('#d5dee4');
      v.scene.add(...lights);
      for(const light of lights)if(light.isDirectionalLight)v.scene.add(light.target);
      athlete.root.position.set(0,0,0);athlete.root.rotation.set(0,0,0);
      athlete.pose(1,1,0);
      v.scene.add(athlete.root);
      v.camera.position.set(x,y,z);v.camera.lookAt(.33,.76,0);
      v.camera.updateProjectionMatrix();
      v.renderer.render(v.scene,v.camera);
      let count=0,faces=0;
      athlete.root.traverse((o:any)=>{if(o.isMesh){count++;faces+=o.geometry.index?o.geometry.index.count/3:o.geometry.getAttribute('position').count/3;}});
      return {count,faces};
    },{x,y,z});
    expect(stats.count).toBeGreaterThan(40);
    expect(stats.faces).toBeGreaterThan(10000);
    await page.screenshot({path:'artifacts/anatomy-'+name+'.png'});
  }
  expect(errors).toEqual([]);
});
