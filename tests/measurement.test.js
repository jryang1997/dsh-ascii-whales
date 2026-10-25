import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMeasurementOptions, measurementPlan, validateMeasurement, summarizeMeasurements, cpuDelta } from '../scripts/measurement-data.mjs';
import { createWorkMetrics } from '../src/work-metrics.js';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

test('full measurements rotate three named conditions through every order position', () => {
  const options = parseMeasurementOptions([]);
  assert.equal(options.warmupMs, 30000);
  assert.equal(options.sampleMs, 60000);
  assert.equal(options.rounds, 3);
  assert.equal(options.smoke, false);
  assert.deepEqual(options.conditions, ['off', 'standard', 'economy']);
  const plan = measurementPlan(options);
  assert.equal(plan.length, 27);
  assert.deepEqual(plan.slice(0, 3).map(unit => unit.condition), ['off', 'standard', 'economy']);
  for (const condition of options.conditions) {
    assert.deepEqual(plan.filter(unit => unit.scenario === 'idle' && unit.condition === condition).map(unit => unit.order).sort(), [1, 2, 3]);
  }
  const baseline = parseMeasurementOptions(['--conditions', 'off,standard', '--rounds', '5']);
  assert.equal(measurementPlan(baseline).length, 30);
  assert.deepEqual(measurementPlan(baseline).slice(6, 8).map(unit => unit.condition), ['standard', 'off']);
  for (const value of ['off', 'off,off,standard', 'off,fast', 'standard,economy', 'off,standard,']) {
    assert.throws(() => parseMeasurementOptions(['--conditions', value]), /conditions/i);
  }
  const probe = parseMeasurementOptions(['--limiter-probe', '--smoke', '--rounds', '1', '--warmup-ms', '1000', '--sample-ms', '2000']);
  assert.equal(probe.limiterProbe, true);
  assert.throws(() => parseMeasurementOptions(['--limiter-probe']), /smoke/);
  assert.throws(() => parseMeasurementOptions(['--sample-ms', '100']), /smoke/);
  assert.throws(() => parseMeasurementOptions(['--smoke', '--rounds', '0']), /rounds/);
});

test('CLI browser launch failure exits nonzero and saves the failure rather than a successful baseline', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const result = spawnSync(process.execPath, ['scripts/measurement.mjs', '--smoke', '--warmup-ms', '1', '--sample-ms', '1', '--rounds', '1', '--chrome', path.join(root, '.scratch', 'nonexistent-chrome.exe')],
    { cwd: root, encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 1, result.stderr);
  const output = /Measurement failed: (.+)/.exec(result.stdout)?.[1]?.trim();
  assert.ok(output, result.stdout);
  const manifest = JSON.parse(readFileSync(path.join(output, 'manifest.json'), 'utf8'));
  assert.equal(manifest.status, 'failed');
  assert.equal(manifest.samples.length, 0);
  assert.ok(manifest.failures.length > 0);
});

const validOff = () => ({ condition: 'off', scenario: 'idle', durationMs: 1000,
  metrics: createWorkMetrics().snapshot(), errors: [], visibility: 'visible',
  raw: [{ atMs: 0, visibility: 'visible', metrics: createWorkMetrics().snapshot() },
    { atMs: 1000, visibility: 'visible', metrics: createWorkMetrics().snapshot() }], events: [], plannedEvents: [],
  contentHash: 'fixture-hash', environment: { dpr: 1 }, buildHash: 'build-hash',
  schedulerCallbacks: { raf: 0, timer: 0 }, effectiveResourceMode: null });

test('missing work data, skipped work, hidden pages and truncated observations fail validation', () => {
  const sample = validOff();
  assert.doesNotThrow(() => validateMeasurement(sample));
  assert.throws(() => validateMeasurement({ ...sample, metrics: null }), /metrics/);
  assert.throws(() => validateMeasurement({ ...sample, condition: 'standard' }), /work|policy/);
  assert.throws(() => validateMeasurement({ ...sample, visibility: 'hidden' }), /visible/);
  assert.throws(() => validateMeasurement({ ...sample, metrics: { ...sample.metrics, dropped: 1 } }), /truncated/);
  assert.throws(() => validateMeasurement({ ...sample, events: [{ atMs: 4 }] }), /event/);
  assert.throws(() => validateMeasurement({ ...sample, contentHash: null }), /identity/);
  assert.throws(() => validateMeasurement({ ...sample, raw: [{ atMs: 0 }, { atMs: 1000 }] }), /Raw/);
});

test('CPU deltas identify process scope and never treat missing or replaced processes as zero', () => {
  const before = [{ id: 1, type: 'browser', cpuTime: 2 }, { id: 2, type: 'renderer', cpuTime: 1 }];
  const after = [{ id: 1, type: 'browser', cpuTime: 2.25 }, { id: 2, type: 'renderer', cpuTime: 1.25 }];
  const result = cpuDelta(before, after, 1000, 8);
  assert.equal(result.cpuSeconds, 0.5);
  assert.equal(result.singleCorePercent, 50);
  assert.equal(result.machinePercent, 6.25);
  assert.equal(cpuDelta(before, after.slice(0, 1), 1000, 8).cpuSeconds, null);
  assert.equal(cpuDelta(null, after, 1000, 8).cpuSeconds, null);
});

test('summary keeps condition medians and ranges without claiming incomplete comparison', () => {
  const samples = [1, 3, 2].map(value => ({ ...validOff(), cpu: { singleCorePercent: value }, browser: { LayoutDuration: value / 10 } }));
  const summary = summarizeMeasurements(samples);
  assert.equal(summary.groups[0].cpuSingleCorePercent.median, 2);
  assert.deepEqual(summary.groups[0].cpuSingleCorePercent.range, [1, 3]);
  assert.equal(summary.resource.status, 'incomplete');
  assert.equal(summary.resource.compared, false);
  assert.equal(summary.groups.length, 9);
  assert.equal(summary.groups.find(group => group.condition === 'economy').rounds, 0);
  assert.equal(summary.groups.find(group => group.condition === 'economy').cpuSingleCorePercent.median, null);
});

const activeSample = condition => {
  const metrics = createWorkMetrics();
  for (const key of ['wakeup', 'advance', 'motionStep', 'draw', 'layout']) metrics.end(key, metrics.begin(), key === 'draw' ? 'animation' : null);
  const result = metrics.snapshot();
  return { ...validOff(), condition, metrics: result, effectiveResourceMode: condition,
    schedulerCallbacks: { raf: condition === 'standard' ? 1 : 0, timer: condition === 'economy' ? 1 : 0 },
    raw: [{ atMs: 0, visibility: 'visible', metrics: createWorkMetrics().snapshot() },
      { atMs: 1000, visibility: 'visible', metrics: result }] };
};

test('economy requires real work and continuous draw budgets apply to both modes', () => {
  assert.doesNotThrow(() => validateMeasurement(activeSample('economy')));
  assert.throws(() => validateMeasurement({ ...activeSample('economy'), schedulerCallbacks: { raf: 1, timer: 0 } }), /scheduler/);
  assert.throws(() => validateMeasurement({ ...activeSample('economy'), effectiveResourceMode: 'standard' }), /policy/);
  assert.throws(() => validateMeasurement({ ...validOff(), condition: 'economy' }), /work|policy/);
  for (const condition of ['standard', 'economy']) {
    const sample = activeSample(condition);
    const count = condition === 'standard' ? 32 : 17;
    sample.metrics = structuredClone(sample.metrics);
    sample.metrics.counters.draw.count = count;
    sample.metrics.timeline = sample.metrics.timeline.filter(e => e.name !== 'draw');
    for (let i = 0; i < count; i++) sample.metrics.timeline.push({ name: 'draw', atMs: i * 10, durationMs: 0, cause: 'animation' });
    assert.throws(() => validateMeasurement(sample), /budget/);
  }
});

test('summary checks all expected groups and compares tuples regardless of array adjacency', () => {
  const options = parseMeasurementOptions([]);
  const samples = measurementPlan(options).map(unit => ({ ...(unit.condition === 'off' ? validOff() : activeSample(unit.condition)), ...unit }));
  const summary = summarizeMeasurements([...samples].reverse(), options);
  assert.equal(summary.resource.status, 'complete');
  assert.equal(summary.resource.compared, true);
  assert.equal(summary.completeness.expected, 27);
  assert.equal(summary.completeness.valid, 27);
  for (const broken of [samples.slice(1), [...samples, samples[0]], samples.map((s, i) => i === 3 ? { ...s, contentHash: 'other' } : s),
    samples.map((s, i) => i === 10 ? { ...s, buildHash: 'old' } : s), samples.map((s, i) => i === 4 ? { ...s, seed: 2 } : s)]) {
    assert.equal(summarizeMeasurements(broken, options).resource.compared, false);
  }
  const noCpu = summarizeMeasurements(samples, options);
  assert.equal(noCpu.cpuComparable, false);
  assert.match(noCpu.verdict, /inconclusive/);
});
