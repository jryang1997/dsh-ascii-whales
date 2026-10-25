import { build } from 'esbuild';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { normalizeConfig, DEFAULTS } from '../src/model.js';
import { WORK_METRICS } from '../src/work-metrics.js';
import { parseMeasurementOptions, measurementPlan, validateMeasurement, summarizeMeasurements, cpuDelta } from './measurement-data.mjs';
import { launchChrome } from './measurement-cdp.mjs';
import { publicMeasurementReport, formatPublicReport } from './measurement-report.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const save = (out, name, value) => writeFile(path.join(out, name), json(value));

if (process.argv.includes('--help')) {
  console.log('node scripts/measurement.mjs [--smoke --warmup-ms 1000 --sample-ms 2000 --rounds 1] [--headless] [--out .scratch/new-directory] [--chrome PATH] [--power-mode DESCRIPTION] [--background-load DESCRIPTION]\nDefaults: 30000ms warmup, 60000ms sample, 3 balanced rounds, idle/append/scroll, --conditions off,standard,economy. Use --rounds 5 for benchmark review (45 units, at least 67.5 minutes). Baseline only: --conditions off,standard. Full runs do not profile. Diagnostic only: --limiter-probe --smoke (profiles saved separately; never use their numbers as benchmark results). Output is a controlled file fixture, not actual DSH.');
} else {
  await main().catch(error => { console.error(error.stack || String(error)); process.exitCode = 1; });
}

async function main() {
  const options = parseMeasurementOptions(process.argv.slice(2));
  const scratch = path.join(root, '.scratch');
  await mkdir(scratch, { recursive: true });
  let out;
  if (options.out) {
    out = path.resolve(root, options.out);
    const relative = path.relative(scratch, out);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('--out must be a new directory inside this worktree .scratch');
    await mkdir(out);
  } else out = await mkdtemp(path.join(scratch, 'measurement-'));
  const profile = path.join(out, 'chrome-profile');
  await mkdir(profile);
  const supplied = options.config ? JSON.parse(await readFile(path.resolve(root, options.config), 'utf8')) : DEFAULTS;
  if (!supplied || typeof supplied !== 'object' || Array.isArray(supplied)) throw new Error('--config must contain a JSON object');
  const config = normalizeConfig(supplied);
  if (!config.enabled) throw new Error('--config must enable the plugin; OFF is a separate controlled condition');
  const plan = measurementPlan(options), samples = [], failures = [], queryWarnings = [];
  const manifest = { schemaVersion: 2, status: 'running', kind: options.limiterProbe ? 'limiter-probe' : options.smoke ? 'smoke' : options.conditions.length === 3 ? 'full-comparison' : 'full-baseline',
    surface: 'controlled-file-fixture; simulated text; no real model; NOT actual DSH',
    claim: 'Tool validity only. No performance benefit or CPU conclusion from smoke.',
    startedAt: new Date().toISOString(), options, seed: 20261025, config, plan, registry: WORK_METRICS,
    resource: { status: 'pending', compared: false }, gpuUtilization: null, energy: null,
    missingEnvironment: ['physical display refresh rate', 'power mode unless operator supplied', 'attribution of other applications and GPU engines', 'actual DSH host build'],
    reproduction: [process.execPath, 'scripts/measurement.mjs', ...process.argv.slice(2)], samples: [], statusProbes: [], failures, queryWarnings };
  let chrome = null;
  const safeQuery = async (name, query) => {
    try { return await query(); } catch (error) { queryWarnings.push({ name, error: String(error) }); return null; }
  };
  const machineBefore = hostSnapshot();
  try {
    const bundled = await build({ entryPoints: [path.join(root, 'scripts/measurement-fixture.js')], bundle: true,
      format: 'iife', platform: 'browser', target: 'es2022', write: false, metafile: true,
      minify: !options.limiterProbe, sourcemap: options.limiterProbe ? 'inline' : false });
    const script = bundled.outputFiles[0].text;
    const sources = {};
    for (const file of Object.keys(bundled.metafile.inputs).sort()) {
      const absolute = path.resolve(file);
      sources[path.relative(root, absolute).replaceAll('\\', '/')] = hash(await readFile(absolute));
    }
    for (const file of ['client.js', 'preview/whale-preview.html', 'src/resource-policy.js', 'src/work-metrics.js', 'scripts/measurement.mjs', 'scripts/measurement-data.mjs', 'scripts/measurement-cdp.mjs', 'scripts/measurement-report.mjs', 'package.json', 'pnpm-lock.yaml']) sources[file] = hash(await readFile(path.join(root, file)));
    const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true });
    if (git.status !== 0) throw new Error('Cannot capture Git build identity');
    const dirty = spawnSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8', windowsHide: true });
    if (dirty.status !== 0) throw new Error('Cannot capture working tree identity');
    manifest.build = { gitHead: git.stdout.trim(), dirty: dirty.stdout.trim(), sourceHashes: sources,
      fixtureBundleHash: hash(script), hash: hash(json(sources)), node: process.version };
    const html = `<!doctype html><meta charset="utf-8"><title>Whale measurement fixture (simulated, not DSH)</title>
<style>html,body{margin:0;height:100%;background:#f3f7fa;color:#243649;font:16px Arial}header{height:40px;padding:8px 24px;box-sizing:border-box}canvas{position:fixed;inset:40px 0 0;width:100%;height:calc(100% - 40px);pointer-events:none;z-index:2}[data-conversation-scroll]{position:absolute;inset:40px 0 100px;overflow:auto;padding:20px 120px}article{background:rgb(252,253,254);border-radius:18px;padding:18px;margin:0 0 20px;min-height:90px}p{margin:0;line-height:1.6}[data-composer-card]{position:fixed;bottom:12px;left:200px;right:100px;height:64px;background:white;border-radius:18px;padding:12px;box-sizing:border-box}</style>
<header>Controlled simulated conversation. OFF, standard and economy share this content. Not actual DSH.</header><div data-task-summary role="status"></div><main data-conversation-scroll></main><div data-composer-card contenteditable="true">Fixed composer content. No model or network requests.</div><canvas aria-hidden="true"></canvas><script>${script.replaceAll('</script', '<\\/script')}</script>`;
    const fixture = path.join(out, 'fixture.html');
    await writeFile(fixture, html);
    await save(out, 'manifest.json', manifest);
    chrome = await launchChrome({ ...options, profile }, out);
    const { page, browser } = chrome;
    const systemInfo = await safeQuery('SystemInfo.getInfo', () => browser.send('SystemInfo.getInfo'));
    manifest.environment = { host: machineBefore, chrome: chrome.version, chromeArgs: chrome.args,
      nativeFacts: nativeEnvironment(),
      systemInfo, powerMode: options.powerMode, backgroundLoad: options.backgroundLoad,
      hardwareAcceleration: systemInfo?.gpu?.featureStatus ?? null,
      limitations: 'OS CPU activity includes all applications. Isolated Chrome tree CPU includes fixture, CDP, browser and GPU process CPU. GPU utilization and energy are unmeasured.' };
    await save(out, 'environment.json', manifest.environment);
    for (let index = 0; index < plan.length; index++) {
      const unit = plan[index], id = `${String(index + 1).padStart(2, '0')}-${unit.scenario}-${unit.condition}-r${unit.round}`;
      page.events.length = 0;
      const navigation = await page.send('Page.navigate', { url: pathToFileURL(fixture).href });
      if (navigation.errorText) throw new Error(navigation.errorText);
      await page.evaluate(`new Promise((resolve,reject)=>{let tries=0;const check=()=>window.__measurement?resolve(true):++tries>200?reject(Error('Fixture startup timeout')):setTimeout(check,25);check();})`);
      await page.send('Page.bringToFront');
      const initialization = await page.evaluate(`window.__measurement.init(${JSON.stringify({ condition: unit.condition, seed: manifest.seed, config })})`);
      const refresh = await page.evaluate('window.__measurement.refreshProbe()');
      await save(out, `${id}-initialization.json`, { ...initialization, refresh });
      if (unit.condition !== 'off') {
        const probes = [];
        for (const reduced of [false, true]) {
          await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }] });
          for (const probeOptions of [{}, { burst: true }, { paused: true }]) {
            const probe = await page.evaluate(`window.__measurement.statusProbe(${JSON.stringify(probeOptions)})`);
            probes.push({ reduced, ...probe });
          }
        }
        await page.send('Emulation.setEmulatedMedia', { features: [] });
        await save(out, `${id}-status-latency.json`, probes);
        manifest.statusProbes.push({ condition: unit.condition, scenario: unit.scenario, round: unit.round, probes });
        if (probes.some(probe => !Number.isFinite(probe.textMs) || probe.textMs > 250
          || !Number.isFinite(probe.canvasMs) || probe.canvasMs > 250 || !probe.summary.includes('waiting'))) throw new Error(`Status endpoint budget failed ${id}`);
      }
      const warmup = await page.evaluate(`window.__measurement.runPhase(${JSON.stringify(unit.scenario)},${options.warmupMs})`, options.warmupMs + 30000);
      await save(out, `${id}-warmup.json`, warmup);
      if (options.limiterProbe) {
        await page.send('Profiler.enable');
        await page.send('Profiler.start');
      }
      const cpuStarted = performance.now();
      const cpuBefore = await safeQuery('CPU before', async () => (await browser.send('SystemInfo.getProcessInfo')).processInfo);
      const perfBefore = await performanceMetrics(page);
      const hostBefore = hostSnapshot();
      const measured = await page.evaluate(`window.__measurement.runPhase(${JSON.stringify(unit.scenario)},${options.sampleMs})`, options.sampleMs + 30000);
      const cpuAfter = await safeQuery('CPU after', async () => (await browser.send('SystemInfo.getProcessInfo')).processInfo);
      const cpuElapsed = performance.now() - cpuStarted;
      const perfAfter = await performanceMetrics(page);
      const hostAfter = hostSnapshot();
      const browserMetrics = Object.fromEntries(Object.keys(perfBefore).map(key => [key, perfAfter[key] - perfBefore[key]]));
      if (options.limiterProbe) {
        const profile = await page.send('Profiler.stop');
        await save(out, `${id}-unreported.cpuprofile`, profile.profile);
        await page.send('Profiler.disable');
      }
      const sample = { ...unit, ...measured, profiled: options.limiterProbe, id, config, seed: manifest.seed, requestedDurationMs: options.sampleMs, buildHash: manifest.build.hash,
        cpu: cpuDelta(cpuBefore, cpuAfter, cpuElapsed, os.availableParallelism()),
        cpuRaw: { before: cpuBefore, after: cpuAfter }, browser: browserMetrics, browserRaw: { before: perfBefore, after: perfAfter },
        hostRaw: { before: hostBefore, after: hostAfter }, gpuUtilization: null, energy: null,
        image: await page.evaluate('window.__measurement.image()'),
        initializationFile: `${id}-initialization.json`, warmupFile: `${id}-warmup.json` };
      if (sample.raw.some(raw => raw.visibility !== 'visible')) sample.errors.push('Page hidden during sampling');
      if (page.events.length) sample.errors.push(...page.events.map(event => JSON.stringify(event)));
      Object.freeze(sample);
      const file = `${id}-sample.json`;
      await save(out, file, sample);
      samples.push(sample);
      manifest.samples.push({ id, file });
      validateMeasurement(sample);
      if (Math.abs(sample.durationMs - options.sampleMs) > Math.max(1000, options.sampleMs * 0.1)) throw new Error(`Sampling duration drift ${id}`);
      if (unit.condition !== 'off' && sample.image.painted < 100) throw new Error(`Renderer produced no picture ${id}`);
      if (unit.condition === 'off' && sample.image.painted !== 0) throw new Error(`OFF fixture still painted ${id}`);
      const screenshot = await page.send('Page.captureScreenshot', { format: 'png' });
      await writeFile(path.join(out, `${id}.png`), Buffer.from(screenshot.data, 'base64'));
      await save(out, 'manifest.json', manifest);
      console.log(`${id} validated (${sample.metrics.counters.motionStep.count} internal ticks, ${sample.metrics.counters.draw.count} draws)`);
    }
    const summary = summarizeMeasurements(samples, options);
    if (!summary.completeness.complete) throw new Error(summary.completeness.issues.join('; '));
    manifest.resource = summary.resource;
    manifest.status = 'passed';
  } catch (error) {
    failures.push({ at: new Date().toISOString(), error: error.stack || String(error) });
    manifest.status = 'failed';
    throw error;
  } finally {
    try { if (chrome) manifest.cleanup = await chrome.close(); }
    catch (error) { manifest.status = 'failed'; failures.push({ cleanup: String(error) }); process.exitCode = 1; }
    manifest.finishedAt = new Date().toISOString();
    manifest.hostAfter = hostSnapshot();
    const summary = { ...summarizeMeasurements(samples, options), kind: manifest.kind, surface: manifest.surface,
      runStatus: manifest.status, fullComparison: options.smoke ? 'NOT YET MEASURED' : manifest.status === 'passed' ? 'measured for this controlled build only' : 'INCOMPLETE',
      eligibleForBenefit: !options.smoke && !options.limiterProbe && manifest.status === 'passed',
      build: manifest.build ?? null, sampleFiles: manifest.samples, environmentFile: 'environment.json' };
    if (manifest.status !== 'passed') { summary.resource.compared = false; summary.resource.status = 'incomplete'; }
    manifest.resource = summary.resource;
    await save(out, 'summary.json', summary);
    const publicReport = publicMeasurementReport(manifest, samples);
    await save(out, 'report-public.json', publicReport);
    await writeFile(path.join(out, 'report-public.md'), formatPublicReport(publicReport));
    await save(out, 'manifest.json', manifest);
    console.log(`Measurement ${manifest.status}: ${out}`);
  }
}

async function performanceMetrics(page) {
  const result = await page.send('Performance.getMetrics');
  const values = Object.fromEntries(result.metrics.map(metric => [metric.name, metric.value]));
  const keys = ['LayoutCount', 'RecalcStyleCount', 'LayoutDuration', 'RecalcStyleDuration', 'ScriptDuration', 'TaskDuration'];
  if (keys.some(key => !Number.isFinite(values[key]))) throw new Error('Missing CDP Performance metrics');
  return Object.fromEntries(keys.map(key => [key, values[key]]));
}

function nativeEnvironment() {
  if (process.platform !== 'win32') return { powerScheme: null, backgroundProcesses: null, reason: 'Native Windows queries unavailable on this OS' };
  const query = (command, args) => {
    const result = spawnSync(command, args, { timeout: 10000, windowsHide: true });
    if (result.status !== 0 || result.error) return { value: null, error: String(result.error || `exit ${result.status}`) };
    let value;
    try { value = new TextDecoder('gb18030').decode(result.stdout).trim(); }
    catch { value = result.stdout.toString('utf8').trim(); }
    return { value, command: [command, ...args] };
  };
  return { powerScheme: query('powercfg.exe', ['/getactivescheme']),
    backgroundProcesses: query('tasklist.exe', ['/FO', 'CSV', '/NH']),
    limitation: 'Active power scheme is not effective CPU/GPU power draw or Windows power slider. Process names/memory are a load inventory, not attribution.' };
}

function hostSnapshot() {
  return { at: new Date().toISOString(), platform: os.platform(), release: os.release(), version: os.version(),
    arch: os.arch(), cpu: os.cpus().map(cpu => ({ model: cpu.model, speedMHz: cpu.speed, times: cpu.times })),
    logicalProcessors: os.availableParallelism(), totalMemoryBytes: os.totalmem(), freeMemoryBytes: os.freemem(),
    loadAverage: process.platform === 'win32' ? null : os.loadavg(),
    loadAverageReason: process.platform === 'win32' ? 'Windows load average unavailable; use raw system CPU tick deltas and operator background-load note' : null };
}
