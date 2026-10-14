import {readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:1400,height:1170},deviceScaleFactor:1});
let html='<style>body{margin:0;background:#172832;color:#eef3f5;font:18px system-ui;padding:24px}h1{font-size:25px;margin:0 0 16px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0}img{width:100%;height:495px;object-fit:contain;background:#dce3e8}figcaption{padding:8px 0}small{color:#b9cbd5}</style><h1>SKYLIFT · nowy zawodnik GLB</h1><small>Identyczne kamery i skala · stara oraz nowa docelowa poza kontrolera</small><div class="grid">';
for(const [view,label] of [['flight-side','LOT Z BOKU'],['reference-front','LOT Z PRZODU']])for(const [phase,title] of [['before','PRZED'],['after','PO']]){
 const bytes=await readFile(`artifacts/athlete-review/${phase}/${view}.png`);html+=`<figure><figcaption>${label} · ${title}</figcaption><img src="data:image/png;base64,${bytes.toString('base64')}"></figure>`;
}
await p.setContent(html+'</div>');await p.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await p.screenshot({path:'artifacts/athlete-review/before-after.png',fullPage:true});await b.close();
