import { WORK_METRICS } from '../src/work-metrics.js';

export function validateMeasurement(sample) {
  if (!sample?.metrics?.counters) throw new Error('Missing metrics');
  if (sample.visibility !== 'visible') throw new Error('Page must remain visible');
  if (sample.errors?.length || !Array.isArray(sample.errors)) throw new Error('Browser errors or missing errors record');
  if (!(sample.durationMs > 0) || !Number.isFinite(sample.durationMs)) throw new Error('Missing duration');
  if (sample.metrics.dropped !== 0) throw new Error('Observation truncated');
  if (!sample.contentHash || !sample.buildHash || !sample.environment) throw new Error('Missing measurement identity');
  if (!['off', 'standard'].includes(sample.condition)) throw new Error('Unimplemented measurement condition');
  for (const key of Object.keys(WORK_METRICS)) {
    const value = sample.metrics.counters[key];
    if (!value || !Number.isSafeInteger(value.count) || value.count < 0 || !Number.isFinite(value.durationMs) || value.durationMs < 0) throw new Error(`Missing or invalid metrics ${key}`);
    if (sample.condition === 'off' && value.count !== 0) throw new Error('OFF condition did plugin work');
  }
  if (sample.condition === 'standard') {
    for (const key of ['wakeup', 'advance', 'motionStep', 'draw', 'layout']) {
      if (sample.metrics.counters[key].count < 1) throw new Error(`Required work did not happen: ${key}`);
    }
    if (sample.metrics.timeline.filter(event => event.name === 'draw').length !== sample.metrics.counters.draw.count) throw new Error('Draw timeline incomplete');
  }
  if (!Array.isArray(sample.raw) || sample.raw.length < 2 || sample.raw.some((entry, index) => !Number.isFinite(entry.atMs) || (index > 0 && entry.atMs < sample.raw[index - 1].atMs))) throw new Error('Raw samples missing or unordered');
  for (let index = 0; index < sample.raw.length; index++) {
    const entry = sample.raw[index], previous = sample.raw[index - 1];
    if (entry.visibility !== 'visible' || !entry.metrics?.counters || entry.metrics.dropped !== 0) throw new Error('Raw snapshot missing, hidden or truncated');
    for (const key of Object.keys(WORK_METRICS)) {
      const counter = entry.metrics.counters[key], prior = previous?.metrics?.counters[key];
      if (!counter || !Number.isSafeInteger(counter.count) || counter.count < 0 || !Number.isFinite(counter.durationMs) || counter.durationMs < 0
        || (prior && (counter.count < prior.count || counter.durationMs < prior.durationMs))
        || counter.count > sample.metrics.counters[key].count) throw new Error(`Raw counter invalid or reset: ${key}`);
    }
  }
  if (!Array.isArray(sample.metrics.timeline) || sample.metrics.timeline.some(event => !['draw', 'layout'].includes(event.name)
    || !Number.isFinite(event.atMs) || event.atMs < 0 || !Number.isFinite(event.durationMs) || event.durationMs < 0)) throw new Error('Invalid metrics timeline');
  if (!Array.isArray(sample.events) || !Array.isArray(sample.plannedEvents) || sample.events.length !== sample.plannedEvents.length
    || sample.events.some((event, index) => event.kind !== sample.plannedEvents[index].kind || event.scheduledMs !== sample.plannedEvents[index].atMs || !Number.isFinite(event.atMs))) throw new Error('Fixture event schedule incomplete');
  return sample;
}

export function cpuDelta(before, after, elapsedMs, logicalProcessors) {
  const unavailable = reason => ({ cpuSeconds: null, singleCorePercent: null, machinePercent: null, reason, elapsedMs });
  if (!Array.isArray(before) || !Array.isArray(after) || !before.length || !after.length) return unavailable('SystemInfo.getProcessInfo unavailable');
  const first = new Map(before.map(process => [process.id, process]));
  if (first.size !== after.length || after.some(process => !first.has(process.id) || first.get(process.id).type !== process.type)) return unavailable('Process tree changed during sample; exited-process CPU cannot be recovered');
  const processes = after.map(process => ({ id: process.id, type: process.type, cpuSeconds: process.cpuTime - first.get(process.id).cpuTime }));
  if (!(elapsedMs > 0) || processes.some(process => !Number.isFinite(process.cpuSeconds) || process.cpuSeconds < 0)) return unavailable('Invalid process CPU delta');
  const cpuSeconds = processes.reduce((sum, process) => sum + process.cpuSeconds, 0);
  const singleCorePercent = cpuSeconds / (elapsedMs / 1000) * 100;
  return { cpuSeconds, elapsedMs, singleCorePercent,
    machinePercent: logicalProcessors > 0 ? singleCorePercent / logicalProcessors : null, processes,
    scope: 'Isolated Chrome browser tree including browser, renderer, GPU and utility processes; includes CDP/fixture overhead' };
}

function distribution(values) {
  const sorted = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return { measured: sorted.length, median: sorted.length ? (sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2) : null,
    range: sorted.length ? [sorted[0], sorted.at(-1)] : null };
}

export function summarizeMeasurements(samples) {
  const groups = [];
  for (const scenario of ['idle', 'append', 'scroll']) for (const condition of ['off', 'standard']) {
    const units = samples.filter(sample => sample.scenario === scenario && sample.condition === condition);
    if (!units.length) continue;
    groups.push({ scenario, condition, rounds: units.length,
      cpuSingleCorePercent: distribution(units.map(sample => sample.cpu?.singleCorePercent)),
      browserLayoutMs: distribution(units.map(sample => Number.isFinite(sample.browser?.LayoutDuration) ? sample.browser.LayoutDuration * 1000 : null)),
      work: Object.fromEntries(Object.keys(WORK_METRICS).map(key => [key, {
        count: distribution(units.map(sample => sample.metrics.counters[key].count)),
        durationMs: distribution(units.map(sample => sample.metrics.counters[key].durationMs)),
      }])),
      drawIntervalMs: distribution(units.flatMap(sample => {
        const draws = sample.metrics.timeline.filter(event => event.name === 'draw');
        return draws.slice(1).map((event, index) => event.atMs - draws[index].atMs);
      })),
    });
  }
  return { verdict: 'inconclusive; no performance benefit claim', groups,
    resource: { status: 'not-implemented', compared: false }, gpuUtilization: null, energy: null };
}

export function parseMeasurementOptions(args) {
  const options = { smoke: false, warmupMs: 30000, sampleMs: 60000, rounds: 3,
    chrome: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: false,
    out: null, config: null, powerMode: null, backgroundLoad: null };
  const values = { '--warmup-ms': 'warmupMs', '--sample-ms': 'sampleMs', '--rounds': 'rounds',
    '--chrome': 'chrome', '--out': 'out', '--config': 'config', '--power-mode': 'powerMode', '--background-load': 'backgroundLoad' };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--smoke') options.smoke = true;
    else if (args[i] === '--headless') options.headless = true;
    else if (Object.hasOwn(values, args[i])) {
      const key = values[args[i]], value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
      options[key] = ['warmupMs', 'sampleMs', 'rounds'].includes(key) ? Number(value) : value;
    } else throw new Error(`Unknown argument ${args[i]}`);
  }
  for (const key of ['warmupMs', 'sampleMs', 'rounds']) {
    if (!Number.isInteger(options[key]) || options[key] < 1) throw new Error(`Invalid ${key}`);
  }
  if (options.rounds > 20 || options.warmupMs > 600000 || options.sampleMs > 600000) throw new Error('Measurement bounds exceeded');
  if (!options.smoke && (options.warmupMs < 30000 || options.sampleMs < 60000 || options.rounds < 3)) throw new Error('Short runs require --smoke');
  return Object.freeze(options);
}

export function measurementPlan(options) {
  return Array.from({ length: options.rounds }, (_, round) => ['idle', 'append', 'scroll'].flatMap(scenario => {
    const conditions = round % 2 ? ['standard', 'off'] : ['off', 'standard'];
    return conditions.map((condition, order) => Object.freeze({ round: round + 1, scenario, condition, order: order + 1 }));
  })).flat();
}
