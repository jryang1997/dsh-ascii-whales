import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMeasurementOptions, measurementPlan, validateMeasurement, summarizeMeasurements, cpuDelta } from '../scripts/measurement-data.mjs';
import { createWorkMetrics } from '../src/work-metrics.js';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

test('full measurements rotate paired conditions and retain unimplemented resource as excluded', () => {
  const options = parseMeasurementOptions([]);
  assert.equal(options.warmupMs, 30000);
  assert.equal(options.sampleMs, 60000);
  assert.equal(options.rounds, 3);
  assert.equal(options.smoke, false);
  const plan = measurementPlan(options);
  assert.equal(plan.length, 18);
  assert.deepEqual(plan.slice(0, 2).map(unit => unit.condition), ['off', 'standard']);
  assert.deepEqual(plan.slice(6, 8).map(unit => unit.condition), ['standard', 'off']);
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
  contentHash: 'fixture-hash', environment: { dpr: 1 }, buildHash: 'build-hash' });

test('missing work data, skipped work, hidden pages and truncated observations fail validation', () => {
  const sample = validOff();
  assert.doesNotThrow(() => validateMeasurement(sample));
  assert.throws(() => validateMeasurement({ ...sample, metrics: null }), /metrics/);
  assert.throws(() => validateMeasurement({ ...sample, condition: 'standard' }), /work/);
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

test('summary keeps condition medians and ranges without adding an unimplemented comparison', () => {
  const samples = [1, 3, 2].map(value => ({ ...validOff(), cpu: { singleCorePercent: value }, browser: { LayoutDuration: value / 10 } }));
  const summary = summarizeMeasurements(samples);
  assert.equal(summary.groups[0].cpuSingleCorePercent.median, 2);
  assert.deepEqual(summary.groups[0].cpuSingleCorePercent.range, [1, 3]);
  assert.equal(summary.resource.status, 'not-implemented');
  assert.equal(summary.resource.compared, false);
});
