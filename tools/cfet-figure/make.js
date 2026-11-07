// node make.js <panel_a.png>   (portfolio root served on :8765); then: python3 panels.py <panel_a.png> <out.png>
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 2400, height: 2000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => errs.push(m.text()));
  await p.goto('http://localhost:8765/tools/cfet-figure/render.html');
  await p.waitForFunction(() => window.done, null, { timeout: 60000 });
  await p.screenshot({ path: process.argv[2] });
  console.log(errs.join('\n') || 'ok'); await b.close();
})();
