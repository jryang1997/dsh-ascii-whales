import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { assembleBrowser } from './browser-build.mjs';
import { launchChrome } from './measurement-cdp.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(path.join(root, '.scratch'), { recursive: true });
const out = await mkdtemp(path.join(root, '.scratch/resource-smoke-'));
const source = await assembleBrowser('scripts/resource-smoke-fixture.js');
const fixture = path.join(out, 'fixture.html');
await writeFile(fixture, `<!doctype html><html lang="en"><meta charset="utf-8"><title>SIMULATED resource smoke, not DSH</title>
<style>body{margin:0;font:16px/1.5 system-ui;background:#f0f6fa;color:#234}header{height:80px;padding:12px 24px;box-sizing:border-box}main{position:absolute;inset:80px 0 150px;overflow:auto;padding:20px 18%}article,[data-composer-card]{background:white;border-radius:20px;padding:20px;margin:16px}aside{position:absolute;bottom:0;left:18%;right:18%;height:140px}canvas{position:absolute;inset:80px 0 0;width:100%;height:calc(100% - 80px);pointer-events:none}</style>
<header>SIMULATED fixture. Formal renderer. Work counters only. No CPU or energy claim.<span id="summary" role="status"></span></header><main data-conversation-scroll>${Array.from({ length: 12 }, (_, i) => `<article>Reading card ${i}. 固定阅读内容，检查文字保护与鲸群绘制。</article>`).join('')}</main><aside data-composer-seat><div data-composer-card>Fixture input. No model request.</div></aside><canvas></canvas><script>${source.replaceAll('</script', '<\\/script')}</script></html>`);
const identity = {};
for (const name of ['client.js', 'src/engine.js', 'src/motion.js', 'src/simulation.js', 'src/rain.js', 'src/resource-policy.js', 'src/work-metrics.js', 'scripts/resource-smoke-fixture.js']) {
  identity[name] = createHash('sha256').update(await readFile(path.join(root, name))).digest('hex');
}
const report = { kind: 'smoke', surface: 'headless Chrome file fixture, NOT installed DSH',
  scope: 'same-build actual runtime work counters; no extension of the OFF/standard benchmark comparison',
  cpu: null, gpuUtilization: null, energy: null, fullResourceComparison: 'PENDING #6',
  textEndpoint: 'fixture DOM textContent commit from shared onActivityChange, not installed DSH React or reader',
  liveHost: 'UNVERIFIED (parent reported GUI 401)', screenReader: 'UNVERIFIED', identity, samples: [], errors: [] };
const chrome = await launchChrome({ chrome: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  profile: path.join(out, 'chrome-profile'), headless: true }, out);
const page = chrome.page;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  report.browser = chrome.version;
  report.launchArgs = chrome.args;
  await page.send('Page.navigate', { url: pathToFileURL(fixture).href });
  for (let i = 0; i < 100 && !await page.evaluate('!!window.__resourceSmoke'); i++) await wait(50);
  assert.equal(await page.evaluate('!!window.__resourceSmoke'), true);
  report.environment = await page.evaluate(`({url:location.href,visibility:document.visibilityState,width:innerWidth,height:innerHeight,dpr:devicePixelRatio,userAgent:navigator.userAgent,cores:navigator.hardwareConcurrency,reduced:matchMedia('(prefers-reduced-motion:reduce)').matches})`);
  for (let round = 0; round < 5; round++) for (const mode of round % 2 ? ['economy', 'standard'] : ['standard', 'economy']) {
    await page.evaluate(`__resourceSmoke.init('${mode}')`);
    await wait(300);
    const sample = await page.evaluate('__resourceSmoke.sample(2000)');
    assert.equal(sample.visibility, 'visible');
    assert.deepEqual(sample.errors, []);
    assert.ok(sample.painted > 300);
    assert.equal(sample.metrics.dropped, 0);
    assert.ok(sample.metrics.counters.motionStep.count > 0);
    const draws = sample.metrics.timeline.filter(e => e.name === 'draw' && e.cause === 'animation');
    if (mode === 'economy') {
      assert.ok(sample.metrics.counters.wakeup.count <= 31);
      assert.ok(sample.metrics.counters.motionStep.count < sample.elapsedMs * 0.04);
      assert.ok(draws.length <= 31);
      assert.ok(draws.slice(1).every((e, i) => e.atMs - draws[i].atMs >= 65));
    }
    report.samples.push({ round: round + 1, mode, ...sample });
  }
  for (let round = 1; round <= 5; round++) {
    const a = report.samples.find(s => s.round === round && s.mode === 'standard');
    const b = report.samples.find(s => s.round === round && s.mode === 'economy');
    for (const name of ['wakeup', 'motionStep', 'rainStep', 'atmosphereUpdate', 'waterUpdate', 'draw']) {
      assert.ok(b.metrics.counters[name].count < a.metrics.counters[name].count, `${name} did not decrease`);
    }
  }
  await page.evaluate("__resourceSmoke.init('economy')");
  for (const reduced of [false, true]) {
    await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] });
    const probe = await page.evaluate('__resourceSmoke.eventProbe()');
    assert.ok(probe.textMs !== null && probe.textMs <= 250);
    assert.ok(probe.metrics.timeline.some(e => e.name === 'draw' && e.cause === 'activity' && e.atMs <= 250));
    report[reduced ? 'reducedEvent' : 'event'] = probe;
  }
  await page.send('Emulation.setEmulatedMedia', { features: [] });
  report.pause = await page.evaluate('__resourceSmoke.pauseProbe()');
  assert.equal(report.pause.unchanged, true);
  assert.equal(report.pause.stopped.counters.wakeup.count, 0);
  assert.equal(report.pause.stopped.counters.draw.count, 0);
  assert.equal(report.pause.refresh.counters.draw.count, 1);
  assert.ok(Object.values(report.pause.disposed.counters).every(c => c.count === 0));
  assert.deepEqual(page.events, []);
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.errors.push(String(error.stack)); throw error; }
finally {
  report.cleanup = await chrome.close();
  await writeFile(path.join(out, 'smoke.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Resource work smoke ${report.status}: ${out}`);
  for (const s of report.samples) console.log(JSON.stringify({ round: s.round, mode: s.mode, elapsedMs: s.elapsedMs,
    counts: Object.fromEntries(Object.entries(s.metrics.counters).map(([k, v]) => [k, v.count])) }));
}
