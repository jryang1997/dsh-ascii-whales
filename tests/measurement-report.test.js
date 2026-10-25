import test from 'node:test';
import assert from 'node:assert/strict';
import { publicMeasurementReport, formatPublicReport } from '../scripts/measurement-report.mjs';
import { createWorkMetrics } from '../src/work-metrics.js';

test('shareable report emits only allowed aggregates and no local paths, task text or process inventory', () => {
  const secret = 'PRIVATE_SENTINEL';
  const manifest = { status: 'passed', kind: 'smoke', options: { smoke: true, rounds: 1, warmupMs: 1000, sampleMs: 2000, conditions: ['off', 'standard', 'economy'], out: secret, powerMode: secret },
    build: { hash: 'a'.repeat(64), gitHead: 'b'.repeat(40), dirty: secret, sourceHashes: { [secret]: secret } },
    environment: { nativeFacts: secret, host: { logicalProcessors: 8, cpu: [{ model: secret }] }, chrome: { Browser: 'Chrome/142.0.0.0', webSocketDebuggerUrl: secret }, backgroundLoad: secret }, failures: [secret] };
  const samples = [{ condition: 'off', scenario: 'idle', round: 1, order: 1, durationMs: 2000,
    visibility: 'visible', metrics: createWorkMetrics().snapshot(), errors: [],
    raw: [{ atMs: 0, visibility: 'visible', metrics: createWorkMetrics().snapshot() }, { atMs: 2000, visibility: 'visible', metrics: createWorkMetrics().snapshot() }],
    plannedEvents: [], events: [], contentHash: secret, buildHash: 'a'.repeat(64), environment: { url: secret }, cpuRaw: secret, hostRaw: secret }];
  const report = publicMeasurementReport(manifest, samples);
  const encoded = JSON.stringify(report) + formatPublicReport(report);
  assert.ok(!encoded.includes(secret));
  assert.equal(report.kind, 'smoke');
  assert.equal(report.fullComparison, 'unmeasured');
  assert.equal(report.runStatus, 'failed-or-incomplete');
  assert.equal(report.gpuUtilization, null);
  assert.equal(report.energy, null);
  assert.equal(report.rounds.length, 1);
  assert.equal(report.groups.length, 9);
  assert.match(report.verdict, /inconclusive/);
  assert.match(formatPublicReport(report), /NOT actual DSH/);
  assert.equal(report.rounds[0].cpuSingleCorePercent, null);
  assert.ok(report.rendererStatusProbe.every(group => group.withinProbeThreshold === false));
  const mirror = publicMeasurementReport({ ...manifest, rendererStatusProbes: [{ condition: 'standard', probes: [
    { reduced: false, mirrorTextMs: 0.1, canvasMs: 2 },
  ] }] }, []);
  assert.equal(mirror.rendererStatusProbe[0].withinProbeThreshold, true);
  assert.equal(mirror.formalReactCommitLatency, 'unmeasured');
  assert.equal(mirror.statusLatency, undefined);
  assert.match(formatPublicReport(mirror), /synchronous.*mirror.*not.*React/i);
  const profiled = publicMeasurementReport({ ...manifest, kind: 'limiter-probe', options: { ...manifest.options, limiterProbe: true } }, samples);
  assert.equal(profiled.kind, 'limiter-probe');
  assert.deepEqual(profiled.groups, []);
  assert.deepEqual(profiled.rounds, []);
  assert.equal(profiled.fullComparison, 'unmeasured');
});
