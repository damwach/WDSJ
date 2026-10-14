import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const label=process.argv[2]||'after';
const dir=`artifacts/athlete-review/${label}`;await mkdir(dir,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1100,height:850}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>window.requestAnimationFrame=()=>0);
await page.goto(process.env.ATHLETE_REVIEW_URL || 'http://localhost:5173');await page.waitForFunction(()=>!!window.SKYLIFT);
const trajectory=await page.evaluate(()=>{const a=window.SKYLIFT; a.reset(true);const rows=[];for(let i=0;i<2000;i++){a.sim.step();rows.push([a.sim.x,a.sim.y,a.sim.pitch,a.sim.roll,a.sim.extension,a.sim.phase,JSON.stringify(a.sim.skiBindings)]);}return rows;});
await writeFile(`${dir}/physics.json`,JSON.stringify(trajectory));
await page.evaluate(()=>{const v=window.SKYLIFT.view;const lights=v.scene.children.filter(o=>o.isLight);v.scene.clear();v.scene.add(...lights,v.athlete.root);v.scene.fog=null;v.scene.background.set('#dce3e8');for(const l of lights)if(l.isDirectionalLight){l.position.set(2,5,4);v.scene.add(l.target);}v.athlete.root.position.set(0,0,0);v.athlete.root.rotation.set(0,0,0);document.querySelectorAll('body > :not(canvas)').forEach(o=>o.style.display='none');});
const cases=[['neutral-front',1,0,0,'front',true],['neutral-side',1,0,0,'side',true],['neutral-back',1,0,0,'back',true],['neutral-quarter',1,0,0,'quarter',true],['inrun',0,0,0,'side'],['extension',1,0,0,'side'],['flight-020',1,.2,0,'side'],['flight-050',1,.5,0,'side'],['flight-side',1,1,0,'side'],['flight-front',1,1,0,'front'],['flight-top',1,1,0,'top'],['telemark',1,3,1,'quarter'],['flight-quarter',1,1,0,'quarter'],['reference-prevc',1,1,0,'prevc'],['reference-front',1,1,0,'refFront']];
for(const [name,e,f,l,angle,neutral] of cases){await page.evaluate(({e,f,l,angle,neutral})=>{const v=window.SKYLIFT.view,a=v.athlete;a.pose(e,f,l);if(neutral){a.pelvis.position.set(0,.985,0);a.torso.rotation.set(0,0,0);for(const leg of a.legs){leg.hip.rotation.set(0,0,0);leg.knee.rotation.set(0,0,0);leg.ankle.rotation.set(0,0,0);}a.head?.rotation.set(0,0,0);a.syncSkin?.();}const target=neutral?[0,.9,0]:[.55,.65,0];const eyes={side:[target[0],target[1],4.5],front:[5,neutral?.9:-1.5,0],back:[-4.6,1.7,0],quarter:[3.3,2.1,3.7],top:[.5,5,0.001],prevc:[.2,1.2,-4.5],refFront:[4.5,-3,0]};v.camera.position.set(...eyes[angle]);v.camera.lookAt(...target);v.camera.updateProjectionMatrix();v.renderer.render(v.scene,v.camera);},{e,f,l,angle,neutral});await page.screenshot({path:`${dir}/${name}.png`});}
await browser.close();if(errors.length)throw new Error(errors.join('\n'));console.log(`Captured ${cases.length} views and 2000 physics steps: ${dir}`);
