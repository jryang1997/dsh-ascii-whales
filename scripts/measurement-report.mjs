import { summarizeMeasurements, parseMeasurementOptions } from './measurement-data.mjs';
import { WORK_METRICS } from '../src/work-metrics.js';

const number = value => Number.isFinite(value) ? value : null;
const digest = (value, length) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value) ? value : null;

export function publicMeasurementReport(manifest, samples) {
  const input = manifest.options;
  const options = parseMeasurementOptions([
    ...(input.smoke ? ['--smoke'] : []), ...(input.limiterProbe ? ['--limiter-probe'] : []), '--warmup-ms', String(input.warmupMs), '--sample-ms', String(input.sampleMs),
    '--rounds', String(input.rounds), '--conditions', input.conditions.join(','),
  ]);
  const summary = summarizeMeasurements(samples, options);
  const passed = manifest.status === 'passed' && summary.completeness.complete;
  return {
    schemaVersion: 2, kind: options.limiterProbe ? 'limiter-probe' : options.smoke ? 'smoke' : options.conditions.includes('economy') ? 'full-comparison' : 'full-baseline',
    surface: 'Controlled simulated Chrome file fixture. NOT actual DSH.',
    runStatus: passed ? 'passed' : 'failed-or-incomplete',
    verdict: 'inconclusive; no performance benefit or energy claim',
    fullComparison: passed && !options.smoke && options.conditions.includes('economy') ? 'measured-controlled-only' : 'unmeasured',
    buildHash: digest(manifest.build?.hash, 64), gitHead: digest(manifest.build?.gitHead, 40),
    browser: /^Chrome\/[\d.]+$/.test(manifest.environment?.chrome?.Browser) ? manifest.environment.chrome.Browser : null,
    headless: manifest.options.headless === true, logicalProcessors: number(manifest.environment?.host?.logicalProcessors),
    protocol: { warmupMs: options.warmupMs, sampleMs: options.sampleMs, rounds: options.rounds, conditions: options.conditions, seed: 20261025 },
    completeness: { complete: summary.completeness.complete, expected: summary.completeness.expected, received: summary.completeness.received,
      valid: summary.completeness.valid, issueCount: summary.completeness.issues.length },
    cpuComparable: summary.cpuComparable,
    cpuScope: 'Isolated Chrome browser tree including renderer, browser, GPU and utility CPU plus fixture and CDP overhead. Not plugin-exclusive CPU. Single-core percent; machine percent divides by logical processors.',
    groups: options.limiterProbe ? [] : summary.groups,
    statusLatency: ['standard', 'economy'].flatMap(condition => [false, true].flatMap(reduced => ['normal', 'burst', 'paused'].map(mode => {
      const probes = (manifest.statusProbes ?? []).filter(unit => unit.condition === condition).flatMap(unit => unit.probes)
        .filter(probe => probe.reduced === reduced && (mode === 'burst' ? probe.burst : mode === 'paused' ? probe.paused : !probe.burst && !probe.paused));
      const values = endpoint => probes.map(probe => probe[endpoint]).filter(value => Number.isFinite(value) && value >= 0).sort((a, b) => a - b);
      const text = values('textMs'), canvas = values('canvasMs');
      return { condition, reduced, mode, probes: probes.length, textMeasured: text.length, canvasMeasured: canvas.length,
        textRangeMs: text.length ? [text[0], text.at(-1)] : null, canvasRangeMs: canvas.length ? [canvas[0], canvas.at(-1)] : null,
        bothWithinBudget: probes.length > 0 && text.length === probes.length && canvas.length === probes.length && text.at(-1) <= 250 && canvas.at(-1) <= 250 };
    }))),
    statusEndpoint: 'Fixture DOM textContent commit and completed renderer draw, outside CPU sample; not installed DSH React or speech onset.',
    rounds: (options.limiterProbe ? [] : samples).filter(sample => ['idle', 'append', 'scroll'].includes(sample.scenario) && options.conditions.includes(sample.condition)).map(sample => ({
      scenario: sample.scenario, condition: sample.condition, round: number(sample.round), order: number(sample.order), durationMs: number(sample.durationMs),
      cpuSingleCorePercent: number(sample.cpu?.singleCorePercent), cpuMachinePercent: number(sample.cpu?.machinePercent),
      work: Object.fromEntries(Object.keys(WORK_METRICS).map(key => [key, { count: number(sample.metrics?.counters?.[key]?.count), durationMs: number(sample.metrics?.counters?.[key]?.durationMs) }])),
      longTaskCount: Array.isArray(sample.longTasks) ? sample.longTasks.length : null,
      errorCount: Array.isArray(sample.errors) ? sample.errors.length : null,
    })),
    gpuUtilization: null, energy: null,
    evidence: { limiterProfile: 'unmeasured; separate unreported profiling run required', actualDSH: 'unmeasured', screenReader: 'unmeasured',
      physicalRefreshRate: 'unmeasured', powerMode: 'operator record retained locally; excluded from shareable report' },
    limitations: ['Smoke validates execution only.', 'Counts, nested synchronous work durations and browser CPU measure different scopes.',
      'Full repeated runs and an independent limiter profile are required before any benefit verdict.', 'GPU process CPU does not measure GPU utilization.',
      'No power, battery or endurance measurement.', 'Raw environment, paths, task text, process IDs and inventory stay local.'],
  };
}

export function formatPublicReport(report) {
  const value = entry => entry.median === null ? 'unmeasured' : `${entry.median.toFixed(3)} [${entry.range.map(v => v.toFixed(3)).join(', ')}]`;
  return `# Resource comparison / 资源比较\n\n${report.verdict}\n\n${report.surface}\n\nRun / 运行: ${report.kind}, ${report.runStatus}. Full comparison / 完整比较: ${report.fullComparison}.\n\nBuild / 构建: ${report.buildHash ?? 'unmeasured'}.\n\nEach cell is median [min, max]. 每格为中位数及范围。Missing data stays unmeasured.\n\n| Scenario | Condition | Rounds | CPU single-core % | Animation draw interval ms |\n| --- | --- | --- | --- | --- |\n${report.groups.map(group => `| ${group.scenario} | ${group.condition} | ${group.rounds} | ${value(group.cpuSingleCorePercent)} | ${value(group.drawIntervalMs)} |`).join('\n')}\n\n${report.cpuScope}\n\nGPU utilization / GPU 利用率: unmeasured. Energy / 能耗: unmeasured. Actual DSH / 实际宿主: unmeasured. Screen reader / 读屏: unmeasured. Limiter profile / 瓶颈剖析: unmeasured.\n\nA separate unreported profile and full repeated runs are required before a benefit verdict. 正式收益判断须补独立剖析与完整重复测量。短冒烟没有收益结论。\n\nReproduce / 复跑: node scripts/measurement.mjs --headless --conditions off,standard,economy --rounds 5 --warmup-ms 30000 --sample-ms 60000\n\n${report.limitations.map(line => `- ${line}`).join('\n')}\n`;
}
