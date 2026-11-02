// node make.js <out.png>  (portfolio root served on :8765)
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:900,height:1100},deviceScaleFactor:2});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8765/tools/cfet-figure/render.html');await p.waitForFunction(()=>window.done,null,{timeout:60000});await p.waitForTimeout(800);
await (await p.$('#fig')).screenshot({path:process.argv[2]});console.log(errs.join('\n')||'ok');await b.close();})();
