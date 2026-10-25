import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { launchChrome } from './measurement-cdp.mjs';
import { FIELDS } from '../src/model.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('node scripts/status-demo.mjs [--chrome PATH] [--react-dir PATH] [--out DIRECTORY]\nGenerates SIMULATED PNG frames and bilingual formal settings screenshots. Requires pinned React 18.3.1 UMD files (downloaded to cache if --react-dir is omitted). Never contacts installed DSH.');
  process.exit(0);
}
const option = (name, fallback) => { const index = args.indexOf(name); return index < 0 ? fallback : args[index + 1]; };
const out = path.resolve(root, option('--out', '.scratch/status-demo'));
const reactDir = option('--react-dir', path.join(out, 'vendor'));
await mkdir(out, { recursive: true });
await mkdir(reactDir, { recursive: true });
const hash = text => createHash('sha256').update(text).digest('hex');
const reactSources = [];
for (const name of ['react', 'react-dom']) {
  const filename = `${name}.production.min.js`;
  const url = `https://unpkg.com/${name}@18.3.1/umd/${filename}`;
  const local = path.join(reactDir, filename);
  let source;
  try { source = await readFile(local, 'utf8'); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`React download failed ${response.status}`);
    source = await response.text();
    await writeFile(local, source);
  }
  const expected = { react: 'd949f1c3687aedadcedac85261865f29b17cd273997e7f6b2bfc53b2f9d4c4dd',
    'react-dom': '35f4f974f4b2bcd44da73963347f8952e341f83909e4498227d4e26b98f66f0d' };
  assert.equal(hash(source), expected[name], `Pinned ${name} 18.3.1 checksum mismatch`);
  reactSources.push({ name, version: '18.3.1', url, sha256: hash(source), source });
}
const client = await readFile(path.join(root, 'client.js'), 'utf8');
const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
if (git.status !== 0) throw new Error('Cannot determine build commit');
const commit = git.stdout.trim();
const sources = {};
for (const filename of ['client.js', 'src/settings.js', 'locale/zh.json', 'locale/en.json', 'scripts/status-demo-scenario.mjs', 'scripts/status-demo-fixture.js', 'scripts/status-demo.mjs', 'scripts/measurement-cdp.mjs', 'src/model.js']) {
  sources[filename] = hash(await readFile(path.join(root, filename)));
}
const buildIdentity = `base ${commit.slice(0, 7)} · client ${hash(client).slice(0, 12)}`;
const bundle = await build({ entryPoints: [path.join(root, 'scripts/status-demo-fixture.js')], bundle: true, write: false, format: 'iife' });
const fixture = path.join(out, 'fixture.html');
const scripts = [...reactSources.map(row => row.source), bundle.outputFiles[0].text, client].map(source => `<script>${source.replaceAll('</script', '<\\/script')}</script>`).join('');
await writeFile(fixture, `<!doctype html><html lang="en"><meta charset="utf-8"><title>SIMULATED ASCII Whales status demo</title><style>
html,body{margin:0;font:14px/1.5 system-ui,sans-serif;background:#eff5fa;color:#18324a;--dsw-alias-label-primary:#18324a;--dsw-alias-label-secondary:#4b6579;--dsw-alias-bg-layer-1:#fff;--dsw-alias-border-l1:#cad9e5;--dsh-windows-sidebar-width:0px;--dsh-frame-top-clearance:0px}header{height:92px;box-sizing:border-box;padding:14px 24px;border-bottom:1px solid #cad9e5;background:#fff}header strong{display:block;font-size:17px}header small{display:block}#root{position:absolute;inset:100px 0 0}main{position:absolute;left:42px;top:380px;width:580px;padding:24px;border:1px solid #cad9e5;border-radius:16px;background:#ffffffb0}main p{max-width:520px}main input{width:92%;padding:12px;border:1px solid #cad9e5;border-radius:8px}body[data-mode=settings] main{display:none}body[data-mode=settings] #root{inset:100px 24px 0}#stage{font-weight:600;color:#326888}.aw-overlay{top:0!important}.aw-overlay > [aria-hidden=true]{right:400px!important}body[data-mode=overlay] main{top:auto;bottom:24px;padding:12px 24px}body[data-mode=overlay] main h1{font-size:20px;margin:0}body[data-mode=overlay] main input{display:none}
</style><header><strong id="caption">SIMULATED states · formal renderer · NOT installed DSH</strong><small>${buildIdentity} · 1280 × 1000 · light · reduced motion</small><small id="stage"></small></header><main data-conversation-scroll><h1>文字蓝鲸 · ASCII Whales</h1><p id="explanation"></p><input id="composer" aria-label="Fixture input" value="Fixture only · no user conversation"></main><div id="root"></div>${scripts}</html>`);
const report = { surface: 'SIMULATED file fixture using formal client.js, not installed DSH', commit, buildIdentity, sources,
  react: reactSources.map(({ source, ...row }) => row), theme: 'light', reducedMotion: true, viewport: { width: 1280, height: 1000, dpr: 1 },
  installedHostRecording: 'UNVERIFIED', screenReader: 'UNMEASURED', performance: 'UNMEASURED', frames: [], interactions: [] };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const chrome = await launchChrome({ chrome: option('--chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe'), profile: await mkdtemp(path.join(out, 'chrome-profile-')), headless: true }, out);
const page = chrome.page;
async function capture(filename, details) {
  const result = await page.send('Page.captureScreenshot', { format: 'png' });
  const bytes = Buffer.from(result.data, 'base64');
  await writeFile(path.join(out, filename), bytes);
  report.frames.push({ filename, sha256: hash(bytes), seed: 20261025, config: await page.evaluate('__demo.saved().value'), ...details });
}
async function click(selector) {
  await page.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center'})`);
  const point = await page.evaluate(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...point });
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...point });
  await pause(100);
}
try {
  report.browser = chrome.version.Browser;
  await page.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1000, deviceScaleFactor: 1, mobile: false });
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await page.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await page.send('Page.navigate', { url: pathToFileURL(fixture).href });
  for (let i = 0; i < 100 && !await page.evaluate('!!window.__demo'); i++) await pause(50);
  assert.equal(await page.evaluate('!!window.__demo'), true);
  for (const locale of ['zh', 'en']) {
    await page.evaluate(`__demo.mount('${locale}','overlay')`); await pause(150);
    for (const stage of ['running', 'waiting', 'completed', 'failed']) {
      await page.evaluate(`__demo.advance('${stage}')`); await pause(200);
      await page.evaluate("document.querySelector('.aw-activity-summary').open=true");
      const summary = await page.evaluate("document.querySelector('.aw-activity-summary').textContent");
      const expected = { zh: { running: '运行中', waiting: '等待你处理', completed: '后台任务完成', failed: '后台任务失败' },
        en: { running: 'Running', waiting: 'Waiting for you', completed: 'Background task completed', failed: 'Background task failed' } };
      assert.ok(summary.includes(expected[locale][stage]), `${locale} ${stage}: ${summary}`);
      await capture(`status-${locale}-${stage}.png`, { locale, stage, summary });
    }
    await page.evaluate(`__demo.mount('${locale}','settings')`); await pause(200);
    assert.equal(await page.evaluate("!!document.querySelector('.aw-settings .aw-legend')"), false);
    assert.equal(await page.evaluate("document.querySelector('.aw-advanced').open"), false);
    assert.deepEqual(await page.evaluate("[...document.querySelectorAll('[data-aw-field]')].map(e=>e.dataset.awField).sort()"),
      Object.entries(FIELDS).filter(([, field]) => !field.hidden).map(([key]) => key).sort());
    const picker = 'select[aria-describedby$="preset-hint"]';
    assert.deepEqual(await page.evaluate(`[...document.querySelector(${JSON.stringify(picker)}).options].map(o=>o.value)`), ['custom', 'default', 'rainy', 'minimal', 'night']);
    await capture(`settings-${locale}.png`, { locale, legend: 'hidden until opened', advanced: 'collapsed' });
    await page.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(picker)});e.value='rainy';e.dispatchEvent(new Event('change',{bubbles:true}))})()`); await pause(120);
    assert.equal(await page.evaluate('__demo.saved().value.rain'), false);
    assert.equal(await page.evaluate('__demo.writes().length'), 0);
    await click('button[type=submit]');
    assert.equal(await page.evaluate('__demo.saved().value.rain'), true);
    assert.equal(await page.evaluate('__demo.saved().value.text'), 'ASCII Whales');
    await page.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(picker)});e.value='night';e.dispatchEvent(new Event('change',{bubbles:true}))})()`); await pause(100);
    await click('.aw-action-buttons button:nth-child(2)');
    assert.equal(await page.evaluate(`document.querySelector(${JSON.stringify(picker)}).value`), 'rainy');
    await click('.aw-primary > button');
    assert.equal(await page.evaluate("!!document.querySelector('.aw-settings .aw-legend')"), true);
    await page.evaluate("document.querySelector('.aw-legend').scrollIntoView({block:'center'})");
    await capture(`settings-${locale}-legend.png`, { locale, preset: 'rainy', legend: 'explicitly opened' });
    const before = await page.evaluate('__demo.writes().length');
    await page.evaluate("document.querySelector('.aw-legend button').focus()");
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await pause(100);
    assert.equal(await page.evaluate("!!document.querySelector('.aw-settings .aw-legend')"), false);
    assert.equal(await page.evaluate('__demo.writes().length'), before);
    report.interactions.push({ locale, cdpMouseEventsInHeadlessFixture: ['save rainy draft', 'reload saved values', 'open legend'],
      cdpKeyboard: 'Enter on programmatically focused legend close button', visibleWindowPointerAcceptance: 'UNMEASURED',
      allVisibleFieldsExactlyOnce: true, hiddenLegacyFieldAbsent: true,
      scriptedSelectEvents: ['rainy preset', 'night preset'], result: 'passed on simulated fixture only' });
  }
  assert.deepEqual(page.events, []);
  await page.evaluate('__demo.dispose()');
} finally {
  report.cleanup = await chrome.close();
  await writeFile(path.join(out, 'manifest.json'), `${JSON.stringify(report, null, 2)}\n`);
}
console.log(`SIMULATED status assets and checks written to ${out}`);
