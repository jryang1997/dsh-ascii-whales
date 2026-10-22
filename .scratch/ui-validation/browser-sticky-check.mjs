import { spawn } from 'node:child_process';
import { mkdir, rm, readFile, open, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

// Headless-Chrome + CDP validation of the redesigned settings page: a sticky
// live preview beside the scrolling fields, driven through the same generated
// settings.html the host would embed (build-settings.mjs wraps the real
// client.js in a simulated plugin page whose own scroll container plays the
// role of .fO69Vq_page). React controlled inputs are driven with the native
// value setter plus a bubbling input event, the pattern React's onChange reads.
const root = new URL('../../', import.meta.url);
const here = new URL('./', import.meta.url);
const profile = fileURLToPath(new URL('chrome-profile/', here));
await rm(profile, { recursive: true, force: true });
await mkdir(profile, { recursive: true });
const log = await open(new URL('chrome-sticky.log', here), 'w');
const browser = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless', '--disable-gpu', '--disable-extensions', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`,
  pathToFileURL(fileURLToPath(new URL('settings.html', here))).href,
], { stdio: ['ignore', 'ignore', log.fd] });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket, seq = 0; const pending = new Map(), errors = [];
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
});
async function evaluate(expression) {
  const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (reply.exceptionDetails) throw Error(JSON.stringify(reply.exceptionDetails));
  return reply.result.value;
}
const shot = async name => {
  const capture = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(new URL(name, here), Buffer.from(capture.data, 'base64'));
};
const result = { animation: {}, sticky: {}, hotUpdate: {}, glassDemo: {}, narrow: {}, reducedMotion: {}, errors };
try {
  let port;
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      port = Number((await readFile(`${profile}/DevToolsActivePort`, 'utf8')).split('\n')[0]);
      await fetch(`http://127.0.0.1:${port}/json/version`); break;
    } catch { await pause(100); }
  }
  assert.ok(port, 'Chrome did not expose its local debug endpoint');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find(item => item.type === 'page' && item.url.includes('settings.html'));
  assert.ok(target, 'Settings page did not open');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = event => {
    const data = JSON.parse(event.data);
    if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.text);
    if (data.id) {
      const task = pending.get(data.id); pending.delete(data.id);
      if (data.error) task.reject(Error(JSON.stringify(data.error))); else task.resolve(data.result);
    }
  };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
  await evaluate(`new Promise(resolve=>{const check=()=>{const c=document.querySelector('.aw-preview canvas');if(c&&c.width>1&&document.querySelector('.aw-row'))resolve(true);else setTimeout(check,50);};check();})`);
  await pause(400);
  assert.deepEqual(errors, []);

  // 1. The preview is alive: two frames ~500ms apart differ while motion plays.
  const first = await evaluate(`document.querySelector('.aw-preview canvas').toDataURL()`);
  await pause(500);
  const second = await evaluate(`document.querySelector('.aw-preview canvas').toDataURL()`);
  result.animation.frameDiffers = first !== second;
  assert.ok(result.animation.frameDiffers, 'The preview did not animate between two frames');

  // 2. Sticky: scroll the page, then scroll further — the preview canvas must
  //    hold still while a field row travels with the content.
  const scrollBy = pixels => evaluate(`(()=>{const pm=document.querySelector('.pm-page');pm.scrollTop+=${pixels};return Math.round(pm.scrollTop);})()`);
  result.sticky.scrollStart = await scrollBy(Math.round(await evaluate(`document.querySelector('.pm-page').scrollHeight`) * 0.4));
  await pause(120);
  const topOf = selector => evaluate(`document.querySelector('${selector}').getBoundingClientRect().top`);
  result.sticky.canvasTopStart = await topOf('.aw-preview canvas');
  result.sticky.rowTopStart = await topOf('.aw-fields .aw-row');
  result.sticky.scrollEnd = await scrollBy(300);
  result.sticky.scrollDelta = result.sticky.scrollEnd - result.sticky.scrollStart;
  await pause(120);
  result.sticky.canvasTopEnd = await topOf('.aw-preview canvas');
  result.sticky.rowTopEnd = await topOf('.aw-fields .aw-row');
  result.sticky.canvasDelta = Math.abs(result.sticky.canvasTopEnd - result.sticky.canvasTopStart);
  result.sticky.rowDelta = Math.abs(result.sticky.rowTopEnd - result.sticky.rowTopStart);
  assert.ok(result.sticky.canvasDelta < 2, `Sticky preview moved ${result.sticky.canvasDelta}px while scrolling`);
  assert.ok(result.sticky.rowDelta > 100, `A field row moved only ${result.sticky.rowDelta}px while scrolling`);
  await shot('sticky-desktop.png');

  // 3. Draft hot update: drive the whale-size slider through React's native
  //    setter. The canvas node must survive (marker attribute) and repaint.
  const inkCount = `(()=>{const c=document.querySelector('.aw-preview canvas');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>20)n++;return n;})()`;
  result.hotUpdate.inkBefore = await evaluate(inkCount);
  await evaluate(`(()=>{
    const canvas=document.querySelector('.aw-preview canvas');canvas.dataset.probe='alive';
    const row=[...document.querySelectorAll('.aw-row')].find(r=>r.querySelector('label').textContent==='鲸鱼大小');
    const input=row.querySelector('input[type=range]');
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(input,'1.55');
    input.dispatchEvent(new Event('input',{bubbles:true}));
    return true;})()`);
  await pause(450);
  result.hotUpdate.sameCanvasNode = await evaluate(`document.querySelector('.aw-preview canvas').dataset.probe==='alive'`);
  result.hotUpdate.readout = await evaluate(`[...document.querySelectorAll('.aw-row')].find(r=>r.querySelector('label').textContent==='鲸鱼大小').querySelector('output').textContent`);
  result.hotUpdate.inkAfter = await evaluate(inkCount);
  assert.ok(result.hotUpdate.sameCanvasNode, 'The preview canvas was remounted by a draft change');
  assert.equal(result.hotUpdate.readout, '1.55', 'The slider readout did not follow the draft');
  assert.ok(result.hotUpdate.inkAfter > result.hotUpdate.inkBefore * 1.05,
    `A 1.55 whale painted ${result.hotUpdate.inkAfter}px vs ${result.hotUpdate.inkBefore}px at size 1`);

  // 4. The demo card: sample the first text line's band inside the injected
  //    card (alpha in the canvas's own bitmap — the card body is near-opaque,
  //    open water is transparent). Toggling the glass switch must remove it.
  const barCoverage = `(()=>{const c=document.querySelector('.aw-preview canvas');const ctx=c.getContext('2d');
    const W=c.width,H=c.height;const cx=0.1*W,cy=0.52*H,cw=0.8*W;
    const inset=14,barH=7;const inner=0.2*H-inset*2;const count=Math.min(4,Math.floor(inner/barH));
    const step=count>1?(inner-barH)/(count-1):0;const y=Math.round(cy+inset+step*0)+1;
    const x=Math.round(cx+inset)+2,w=Math.round(cw-inset*2)-4,h=4;
    const d=ctx.getImageData(x,y,w,h).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>100)n++;
    return {coverage:n/(w*h),lines:count};})()`;
  result.glassDemo.coverageOn = (await evaluate(barCoverage)).coverage;
  await shot('glass-demo-on.png');
  await evaluate(`document.querySelector('button[role=switch][aria-label="内容框毛玻璃"]').click()`);
  await pause(450);
  const off = await evaluate(barCoverage);
  result.glassDemo.coverageOff = off.coverage;
  result.glassDemo.switchFlipped = await evaluate(`document.querySelector('button[role=switch][aria-label="内容框毛玻璃"]').getAttribute('aria-checked')`) === 'false';
  await shot('glass-demo-off.png');
  await evaluate(`document.querySelector('button[role=switch][aria-label="内容框毛玻璃"]').click()`);
  await pause(450);
  result.glassDemo.coverageBackOn = (await evaluate(barCoverage)).coverage;
  assert.ok(result.glassDemo.coverageOn > 0.9, `The demo card text band was only ${result.glassDemo.coverageOn} covered with glass on`);
  assert.ok(result.glassDemo.switchFlipped, 'The glass switch did not flip in the draft');
  assert.ok(result.glassDemo.coverageOff < 0.5, `The demo card stayed ${result.glassDemo.coverageOff} covered with glass off`);
  assert.ok(result.glassDemo.coverageBackOn > 0.9, 'The demo card did not come back with glass on again');

  // 5. Narrow screen: one column, no horizontal overflow, shorter preview.
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await pause(450);
  result.narrow.documentScrollWidth = await evaluate(`document.documentElement.scrollWidth`);
  result.narrow.bodyScrollWidth = await evaluate(`document.body.scrollWidth`);
  result.narrow.canvasHeight = await evaluate(`document.querySelector('.aw-preview canvas').getBoundingClientRect().height`);
  result.narrow.singleColumn = await evaluate(`(()=>{
    const aside=document.querySelector('.aw-preview').getBoundingClientRect();
    const fields=document.querySelector('.aw-fields').getBoundingClientRect();
    return Math.abs(aside.left-fields.left)<2&&aside.bottom<=fields.top+1;})()`);
  assert.ok(result.narrow.documentScrollWidth <= 390 && result.narrow.bodyScrollWidth <= 390,
    `Horizontal overflow at 390px: document ${result.narrow.documentScrollWidth}, body ${result.narrow.bodyScrollWidth}`);
  assert.ok(result.narrow.singleColumn, 'The narrow layout did not collapse to one column');
  assert.ok(result.narrow.canvasHeight > 200 && result.narrow.canvasHeight < 280,
    `The narrow preview canvas is ${result.narrow.canvasHeight}px tall`);
  await shot('narrow-390.png');

  // 6. Reduced motion: the preview freezes on a painted frame — and a draft
  //    change still repaints exactly one frame instead of restarting the loop.
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await pause(300);
  const frozen = await evaluate(`document.querySelector('.aw-preview canvas').toDataURL()`);
  await pause(600);
  result.reducedMotion.staticFrame = frozen === await evaluate(`document.querySelector('.aw-preview canvas').toDataURL()`);
  result.reducedMotion.paintedPixels = await evaluate(inkCount);
  assert.ok(result.reducedMotion.staticFrame, 'Reduced motion did not freeze the preview');
  assert.ok(result.reducedMotion.paintedPixels > 1000, 'The frozen preview has no pixels');
  await evaluate(`(()=>{
    const row=[...document.querySelectorAll('.aw-row')].find(r=>r.querySelector('label').textContent==='背景浓度');
    const input=row.querySelector('input[type=range]');
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(input,'0.3');
    input.dispatchEvent(new Event('input',{bubbles:true}));
    return true;})()`);
  await pause(300);
  const repainted = await evaluate(`document.querySelector('.aw-preview canvas').toDataURL()`);
  result.reducedMotion.updateRepaintsOneFrame = repainted !== frozen;
  await pause(500);
  result.reducedMotion.stillStaticAfterUpdate = repainted === await evaluate(`document.querySelector('.aw-preview canvas').toDataURL()`);
  assert.ok(result.reducedMotion.updateRepaintsOneFrame, 'A draft change under reduced motion did not repaint');
  assert.ok(result.reducedMotion.stillStaticAfterUpdate, 'The repaint under reduced motion started an animation loop');
  await shot('reduced-motion.png');
  await send('Emulation.setEmulatedMedia', { features: [] });

  assert.deepEqual(errors, []);
  await writeFile(new URL('sticky-validation.json', here), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  await send('Browser.close');
} finally {
  if (socket) socket.close();
  if (browser.exitCode === null) browser.kill();
  await log.close();
}
